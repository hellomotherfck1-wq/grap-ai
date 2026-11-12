-- Grap-AI ortak sonuç havuzu
-- Run once in the Supabase SQL Editor for project qkkhguyngmsddnkunyws.
-- Public clients can submit their own analysis records, but cannot read the pool.
-- Only a user with app_metadata.role = 'admin' or app_metadata.roles containing 'admin' can read/update outcomes.

create table if not exists public.agent_signals_shared (
  signal_id text primary key,
  device_id uuid not null,
  device_ids uuid[] not null default '{}'::uuid[],
  symbol text not null,
  market text not null,
  timeframe text not null check (timeframe in ('15m', '1h', '4h', '1d')),
  decision text not null check (decision in ('AL', 'SAT', 'BEKLE')),
  signal_at bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_signals_shared_created_at_idx
  on public.agent_signals_shared (created_at desc);
create index if not exists agent_signals_shared_signal_at_idx
  on public.agent_signals_shared (signal_at desc);
create index if not exists agent_signals_shared_market_timeframe_idx
  on public.agent_signals_shared (market, timeframe);

alter table public.agent_signals_shared enable row level security;

revoke all on table public.agent_signals_shared from public;
revoke all on table public.agent_signals_shared from anon, authenticated;
grant select on table public.agent_signals_shared to authenticated;

drop policy if exists agent_signals_shared_admin_read on public.agent_signals_shared;
create policy agent_signals_shared_admin_read
  on public.agent_signals_shared
  for select
  to authenticated
  using (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'roles') = 'array'
            then auth.jwt() -> 'app_metadata' -> 'roles'
          else '[]'::jsonb
        end
      ) as roles(role)
      where lower(roles.role) = 'admin'
    )
  );

create or replace function public.grap_ai_shared_signals_upsert(p_records jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_item jsonb;
  v_record jsonb;
  v_symbol text;
  v_market text;
  v_timeframe text;
  v_decision text;
  v_signal_at bigint;
  v_device_id uuid;
  v_signal_id text;
  v_rows integer;
  v_touched integer := 0;
begin
  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'p_records must be a JSON array';
  end if;
  if jsonb_array_length(p_records) > 50 then
    raise exception 'A maximum of 50 records is allowed per request';
  end if;

  for v_item in select value from jsonb_array_elements(p_records)
  loop
    v_record := v_item -> 'record';
    if coalesce(jsonb_typeof(v_record), 'null') <> 'object' then
      continue;
    end if;

    begin
      v_device_id := (v_item ->> 'device_id')::uuid;
      v_signal_at := round((v_record ->> 'signalAt')::numeric)::bigint;
    exception when others then
      continue;
    end;

    v_symbol := upper(regexp_replace(trim(coalesce(v_record ->> 'symbol', '')), '\s+', '', 'g'));
    v_market := coalesce(v_record ->> 'market', '');
    v_timeframe := coalesce(v_record ->> 'timeframe', '');
    v_decision := coalesce(v_record ->> 'decision', '');

    if v_device_id is null or v_symbol = '' or length(v_symbol) > 80
      or v_signal_at is null or v_signal_at <= 0 then
      continue;
    end if;
    if v_market not in ('Kripto', 'BIST', 'Diğer') then
      continue;
    end if;
    if v_timeframe not in ('15m', '1h', '4h', '1d') then
      continue;
    end if;
    if v_market = 'BIST' and v_timeframe <> '1d' then
      continue;
    end if;
    if v_decision not in ('AL', 'SAT', 'BEKLE') then
      continue;
    end if;
    if octet_length(v_record::text) > 50000 then
      continue;
    end if;

    v_signal_id := v_symbol || '|' || v_timeframe || '|' || v_signal_at::text;

    insert into public.agent_signals_shared as existing_row (
      signal_id, device_id, device_ids, symbol, market, timeframe,
      decision, signal_at, payload
    ) values (
      v_signal_id, v_device_id, array[v_device_id], v_symbol, v_market,
      v_timeframe, v_decision, v_signal_at, v_record
    )
    on conflict (signal_id) do update
      set device_ids = (
            select array_agg(distinct devices.device_value)
            from unnest(existing_row.device_ids || excluded.device_ids) as devices(device_value)
          ),
          payload = case
            when existing_row.device_id = excluded.device_id
              and coalesce(existing_row.payload ->> 'directionStatus', 'pending') <> 'completed'
              and coalesce(existing_row.payload ->> 'tradeStatus', 'pending') <> 'completed'
              and coalesce(existing_row.payload ->> 'spotStatus', 'pending') <> 'completed'
            then excluded.payload
            else existing_row.payload
          end,
          decision = case
            when existing_row.device_id = excluded.device_id
              and coalesce(existing_row.payload ->> 'directionStatus', 'pending') <> 'completed'
              and coalesce(existing_row.payload ->> 'tradeStatus', 'pending') <> 'completed'
              and coalesce(existing_row.payload ->> 'spotStatus', 'pending') <> 'completed'
            then excluded.decision
            else existing_row.decision
          end,
          updated_at = case
            when existing_row.device_id = excluded.device_id
              and coalesce(existing_row.payload ->> 'directionStatus', 'pending') <> 'completed'
              and coalesce(existing_row.payload ->> 'tradeStatus', 'pending') <> 'completed'
              and coalesce(existing_row.payload ->> 'spotStatus', 'pending') <> 'completed'
            then now()
            else existing_row.updated_at
          end;

    get diagnostics v_rows = row_count;
    v_touched := v_touched + v_rows;
  end loop;

  return v_touched;
end;
$function$;

create or replace function public.grap_ai_shared_signals_patch(p_patches jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_item jsonb;
  v_patch jsonb;
  v_signal_id text;
  v_key text;
  v_rows integer;
  v_touched integer := 0;
  v_allowed text[] := array[
    'decision', 'generalDecision', 'technicalDecision', 'volumeDecision',
    'tradeStatus', 'tradeResult', 'spotStatus', 'spotResult',
    'directionStatus', 'forwardPct', 'directionResult', 'waitResult',
    'lastCheckedAt', 'nextCheckAt', 'lastError', 'updatedAt',
    'score', 'trend', 'rsi', 'auditorError', 'auditorWarningCount',
    'fundamentalStatus', 'fkPE', 'fkValuation', 'fkVeto'
  ];
begin
  if auth.uid() is null or not (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'roles') = 'array'
            then auth.jwt() -> 'app_metadata' -> 'roles'
          else '[]'::jsonb
        end
      ) as roles(role)
      where lower(roles.role) = 'admin'
    )
  ) then
    raise exception 'admin_required';
  end if;

  if jsonb_typeof(p_patches) <> 'array' then
    raise exception 'p_patches must be a JSON array';
  end if;
  if jsonb_array_length(p_patches) > 50 then
    raise exception 'A maximum of 50 patches is allowed per request';
  end if;

  for v_item in select value from jsonb_array_elements(p_patches)
  loop
    v_signal_id := left(coalesce(v_item ->> 'signal_id', ''), 180);
    v_patch := v_item -> 'patch';
    if v_signal_id = '' or jsonb_typeof(v_patch) <> 'object' or octet_length(v_patch::text) > 30000 then
      continue;
    end if;

    for v_key in select jsonb_object_keys(v_patch)
    loop
      if not (v_key = any(v_allowed)) then
        raise exception 'Unsupported patch field: %', v_key;
      end if;
    end loop;

    update public.agent_signals_shared
    set payload = payload || v_patch || jsonb_build_object(
          'updatedAt', floor(extract(epoch from now()) * 1000)::bigint
        ),
        decision = coalesce(v_patch ->> 'decision', decision),
        updated_at = now()
    where signal_id = v_signal_id;

    get diagnostics v_rows = row_count;
    v_touched := v_touched + v_rows;
  end loop;

  return v_touched;
end;
$function$;

create or replace function public.grap_ai_shared_signals_prune()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_deleted integer;
begin
  if auth.uid() is null or not (
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'roles') = 'array'
            then auth.jwt() -> 'app_metadata' -> 'roles'
          else '[]'::jsonb
        end
      ) as roles(role)
      where lower(roles.role) = 'admin'
    )
  ) then
    raise exception 'admin_required';
  end if;

  delete from public.agent_signals_shared
  where created_at < now() - interval '365 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.grap_ai_shared_signals_upsert(jsonb) from public;
revoke all on function public.grap_ai_shared_signals_patch(jsonb) from public;
revoke all on function public.grap_ai_shared_signals_prune() from public;

grant execute on function public.grap_ai_shared_signals_upsert(jsonb) to anon, authenticated;
grant execute on function public.grap_ai_shared_signals_patch(jsonb) to authenticated;
grant execute on function public.grap_ai_shared_signals_prune() to authenticated;
