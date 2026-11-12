const fs = require('node:fs');
const assert = require('node:assert/strict');

const helper = fs.readFileSync('js/ortak-sonuc-havuzu.js', 'utf8');
const performance = fs.readFileSync('js/ajan-performans.js', 'utf8');
const admin = fs.readFileSync('js/admin.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const worker = fs.readFileSync('sw.js', 'utf8');
const migrationPath = 'supabase/migrations/202611120001_shared_agent_results.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');
const workflow = fs.readFileSync('.github/workflows/live-e2e.yml', 'utf8');

new Function(helper);
new Function(performance);
new Function(admin);

const supabaseScript = html.indexOf('supabase-js@2');
const sharedScript = html.indexOf('js/ortak-sonuc-havuzu.js');
const performanceScript = html.indexOf('js/ajan-performans.js');
const adminScript = html.indexOf('js/admin.js');
assert.ok(supabaseScript >= 0 && supabaseScript < sharedScript, 'Supabase SDK must load before shared pool');
assert.ok(sharedScript < performanceScript && performanceScript < adminScript, 'Shared pool must load before performance/admin modules');

assert.ok(helper.includes("rpc('grap_ai_shared_signals_upsert'"), 'Devices must send records through the insert RPC');
assert.ok(helper.includes("rpc('grap_ai_shared_signals_patch'"), 'Admin must sync evaluation patches through RPC');
assert.ok(helper.includes("if (!admin) return { records: [], isAdmin: false"), 'Non-admin clients must not query shared rows');
assert.ok(helper.includes(".from(TABLE)"), 'Admin must read the shared table');
assert.ok(admin.includes('window.GrapAISharedResults.client'), 'Admin login must reuse the shared Supabase session');
assert.ok(performance.includes('shared.syncLocal(local)'), 'Existing local records must be backfilled');
assert.ok(performance.includes('shared.patchMany(remotePatches)'), 'Evaluation outcomes must sync in batches');
assert.ok(performance.includes('Ortak sonuç havuzu'), 'Admin shared-pool state must be visible in results');

assert.ok(sql.includes('enable row level security'), 'RLS must be enabled');
assert.ok(/create policy agent_signals_shared_admin_read[\s\S]*for select[\s\S]*to authenticated/i.test(sql), 'Only authenticated users can reach the read policy');
assert.ok(/app_metadata[\s\S]*admin/i.test(sql), 'Read policy must require admin app_metadata');
assert.ok(/revoke all on table public\.agent_signals_shared from anon, authenticated/i.test(sql), 'Direct table access must be revoked');
assert.ok(/grant select on table public\.agent_signals_shared to authenticated/i.test(sql), 'Authenticated role must have SELECT subject to RLS');
assert.ok(/grap_ai_shared_signals_upsert[\s\S]*security definer/i.test(sql), 'Public write must be handled by a constrained SECURITY DEFINER RPC');
assert.ok(/grap_ai_shared_signals_patch[\s\S]*admin_required/i.test(sql), 'Result patches must require admin');
assert.ok(/grap_ai_shared_signals_prune[\s\S]*admin_required/i.test(sql), 'Retention cleanup must require admin');
assert.ok(/grant execute on function public\.grap_ai_shared_signals_upsert\(jsonb\) to anon, authenticated/i.test(sql), 'Anonymous devices must be able to submit records');
assert.ok(!/service_role\\s*[:=]\\s*['"][^'"]+/i.test(helper + admin + sql), 'No service_role secret may be shipped to browsers');
assert.ok(!/SUPABASE_SERVICE_ROLE_KEY/i.test(helper + admin + sql), 'No service_role environment key may be referenced by browser code');
assert.ok(worker.includes('graph-ai-v48') && worker.includes('./js/ortak-sonuc-havuzu.js'), 'Service worker cache must include the new module');
assert.ok(workflow.includes('shared-results-smoke.cjs') && workflow.includes('supabase/**'), 'CI must run shared-pool smoke checks and watch migrations');

console.log('PASS shared admin-only results pool static security, loading, sync, and cache checks');