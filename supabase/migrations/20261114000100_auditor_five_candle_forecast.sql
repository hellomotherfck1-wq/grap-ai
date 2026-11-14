-- Add the auditor's 5-candle price forecast to the constrained result-patch RPCs.
-- The forecast remains in the existing JSONB payload; no raw OHLCV history is stored.

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
    'fundamentalStatus', 'fkPE', 'fkValuation', 'fkVeto', 'priceForecast'
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

create or replace function public.grap_ai_shared_signals_worker_patch(p_patches jsonb)
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
    'tradeStatus', 'tradeResult', 'spotStatus', 'spotResult',
    'directionStatus', 'forwardPct', 'directionResult', 'waitResult',
    'lastCheckedAt', 'nextCheckAt', 'lastError', 'updatedAt', 'priceForecast'
  ];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
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
        updated_at = now()
    where signal_id = v_signal_id;

    get diagnostics v_rows = row_count;
    v_touched := v_touched + v_rows;
  end loop;

  return v_touched;
end;
$function$;

revoke all on function public.grap_ai_shared_signals_patch(jsonb) from public, anon;
grant execute on function public.grap_ai_shared_signals_patch(jsonb) to authenticated;

revoke all on function public.grap_ai_shared_signals_worker_patch(jsonb) from public, anon, authenticated;
grant execute on function public.grap_ai_shared_signals_worker_patch(jsonb) to service_role;

notify pgrst, 'reload schema';
