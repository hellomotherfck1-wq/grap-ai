const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const admin = fs.readFileSync('js/admin.js', 'utf8');
const monitor = fs.readFileSync('js/system-monitor.js', 'utf8');
const transport = fs.readFileSync('js/veri-koprusu.js', 'utf8');
const worker = fs.readFileSync('sw.js', 'utf8');
const sql = fs.readFileSync('supabase/migrations/20261113000100_admin_daily_agent.sql', 'utf8');
const agent = fs.readFileSync('scripts/admin-daily-agent.cjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/admin-daily-agent.yml', 'utf8');

new Function(admin);
new Function(monitor);
new Function(transport);
new Function(agent);

const panelStart = html.indexOf('<div id="admin-panel" hidden>');
const reportStart = html.indexOf('id="admin-gunluk-ajan"');
const panelEnd = html.indexOf('</div>', reportStart);
assert.ok(panelStart >= 0 && reportStart > panelStart && panelEnd > reportStart,
  'Daily report UI must be inside the hidden admin panel');
assert.ok(html.includes('id="admin-ajan-ozet"') && html.includes('id="admin-ajan-hatalar"') &&
  html.includes('id="admin-ajan-kontroller"') && html.includes('id="admin-ajan-sonuclar"'),
  'Admin daily report must show summary, errors, checks, and result overview');

const sharedScript = html.indexOf('js/ortak-sonuc-havuzu.js');
const monitorScript = html.indexOf('js/system-monitor.js');
const adminScript = html.indexOf('js/admin.js');
assert.ok(sharedScript >= 0 && monitorScript > sharedScript && adminScript > monitorScript,
  'Shared Supabase client must load before error monitor and admin UI');
const transportScript = html.indexOf('js/veri-koprusu.js');
const marketDataScript = html.indexOf('js/veri.js');
assert.ok(transportScript >= 0 && marketDataScript > transportScript,
  'Shared external data transport must load before market-data modules');
assert.ok(transport.includes('inflight') && transport.includes('staleMaxAgeMs') &&
  transport.includes('blockedUntil') && transport.includes('apiFailure'),
  'Shared data transport must deduplicate requests, cache stale responses, cool down failing proxies, and log final failures');

assert.ok(admin.includes("from('admin_daily_reports')"), 'Admin must load saved daily reports');
assert.ok(admin.includes('ajanRaporuYukle()'), 'Admin must refresh the report after authorized login');
assert.ok(monitor.includes("rpc('grap_ai_log_system_event'"), 'Browser errors must be sent through the constrained RPC');
assert.ok(monitor.includes('unhandledrejection') && monitor.includes('resource_error'),
  'Monitor must capture runtime and resource errors');
assert.ok(!monitor.includes('var originalFetch = window.fetch') &&
  monitor.includes('info.final = true') && monitor.includes('apiFailure: logApiFailure'),
  'Monitor must not count recoverable fetch fallback attempts; only explicit final API failures are logged');
assert.ok(agent.includes('event.details.final === true') &&
  agent.includes('findings.softwareFindings.length') && agent.includes('softwareErrorOccurrences'),
  'Daily report must ignore legacy per-attempt API noise and separate distinct errors from repeated records');
assert.ok(agent.includes('const recentSignalErrors = signals.filter') &&
  agent.includes('NOW.getTime() - 24 * 60 * 60 * 1000') &&
  agent.includes('groupErrors(browserErrors, signals, recentSignalErrors)'),
  'Daily software-error report must exclude stale lastError values from the 30-day signal window');
assert.ok(admin.includes('function raporGorunumu') &&
  !admin.includes('Farklı yazılım/API hatası') &&
  !admin.includes('Yazılım ve API hataları') &&
  admin.includes('Geçici yazılım/API bağlantı kayıtları gösterilmiyor'),
  'Routine software/API errors must stay hidden from the admin UI');
assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]\s*['\"][^'\"]+/i.test(admin + monitor + html),
  'No privileged Supabase key may be shipped to browser files');

assert.ok(/create table if not exists public\.admin_system_events/i.test(sql), 'System error table must exist');
assert.ok(/create table if not exists public\.admin_daily_reports/i.test(sql), 'Daily report table must exist');
assert.ok(/enable row level security/i.test(sql), 'RLS must be enabled');
assert.ok(/admin_system_events_admin_read[\s\S]*to authenticated[\s\S]*app_metadata[\s\S]*admin/i.test(sql),
  'System error reads must require admin role');
assert.ok(/admin_daily_reports_admin_read[\s\S]*to authenticated[\s\S]*app_metadata[\s\S]*admin/i.test(sql),
  'Daily report reads must require admin role');
assert.ok(/grap_ai_log_system_event[\s\S]*security definer/i.test(sql),
  'Public error submission must use a constrained server-side RPC');
assert.ok(/v_recent_count >= 30/i.test(sql), 'Error logging RPC must rate-limit devices');

assert.ok(workflow.includes('0 5 * * *'), 'Daily agent must run every day at 08:00 Europe/Istanbul');
assert.ok(!workflow.includes('\\${{'), 'GitHub Actions expressions must not be escaped as plain text');
assert.ok(workflow.includes('SUPABASE_SERVICE_ROLE_KEY') && workflow.includes('secrets.SUPABASE_SERVICE_ROLE_KEY'),
  'Service key must be supplied only from GitHub Actions secrets');
assert.ok(agent.includes('admin_daily_reports?on_conflict=report_date'), 'Agent must upsert one report per local day');
assert.ok(agent.includes('directional.reliable') && agent.includes('results.pending'),
  'Agent must summarize evaluated and pending signal results');
assert.ok(agent.includes('groupErrors') && agent.includes('checkExternalApis'),
  'Agent must inspect recent errors and external data providers');
assert.ok(agent.includes("const key = type + '|' + sourceLabel + '|' + clean") &&
  agent.includes('softwareFindings') && agent.includes('analysisFindings'),
  'Findings must be grouped by source/asset and separated into software versus analysis warnings');
assert.ok(!agent.includes('.slice(0, 8)'),
  'Coin-level analysis findings must not be silently truncated to a small fixed number');
assert.ok(agent.includes('analysisWarningTotal') && agent.includes('softwareErrorTotal'),
  'Report totals must keep software errors separate from auditor warnings');
assert.ok(agent.includes("binanceResults.length ? 'ok' : 'info'") &&
  agent.includes("count ? 'ok' : 'info'") &&
  agent.includes("'Arka plan tanılama kayıtları', 'info'") &&
  agent.includes("warningChecks.length || analysisWarningTotal ? 'warning' : 'ok'") &&
  !agent.includes('const issueTotal = softwareErrorTotal + analysisWarningTotal'),
  'Transient provider and browser noise must not change user-facing status; critical checks remain active');
assert.ok(agent.includes('softwareFindings: findings.softwareFindings') &&
  agent.includes('softwareOccurrences: softwareErrorOccurrences'),
  'Hidden software/API diagnostics must remain stored privately for troubleshooting');
assert.ok(agent.includes('const analysisWarningTotal = signals.filter') &&
  agent.includes('Number(payload.auditorWarningCount) > 0'),
  'Each signal with auditor findings must be counted once even if it has multiple warning items');
assert.ok(admin.includes('Coin bazlı analiz / denetçi uyarıları') &&
  admin.includes('Denetçi uyarısı') &&
  !admin.includes("raporBulguBolumu('Yazılım ve API hataları'"),
  'Admin UI must show analysis warnings but not routine software/API error cards');
assert.ok(agent.includes("url.searchParams.set('limit', String(count))") &&
  agent.includes("url.searchParams.set('offset', String(offset))") && !/Range:\s*offset/.test(agent),
  'Supabase pagination must use non-negative PostgREST offset/limit query parameters');
assert.ok(!agent.includes('GITHUB_STEP_SUMMARY') && !agent.includes('writeStepSummary'),
  'Private report details must not be exposed in public workflow summaries');
assert.ok(worker.includes('graph-ai-v56') && worker.includes('./js/system-monitor.js') &&
  worker.includes('./js/veri-koprusu.js'),
  'Service worker must cache the monitor and shared data transport with the new cache version');

console.log('PASS daily admin agent, error logging, report privacy, and service-worker checks');