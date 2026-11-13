const fs = require('node:fs');
const assert = require('node:assert/strict');
const worker = require('../../scripts/evaluate-pending-results.cjs');

const admin = fs.readFileSync('js/ajan-performans.js', 'utf8');
const shared = fs.readFileSync('js/ortak-sonuc-havuzu.js', 'utf8');
const daily = fs.readFileSync('scripts/admin-daily-agent.cjs', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261113000200_pending_results_worker.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/pending-results-worker.yml', 'utf8');

new Function(fs.readFileSync('scripts/evaluate-pending-results.cjs', 'utf8'));

assert.equal(worker.intervalMs('15m'), 900000);
assert.equal(worker.intervalMs('1h'), 3600000);
assert.equal(worker.intervalMs('4h'), 14400000);
assert.equal(worker.intervalMs('1d'), 86400000);

const now = 2000000000000;
const step = worker.intervalMs('1h');
const bars = Array.from({ length: 10 }, function (_, index) {
  const open = 100 + index;
  return {
    t: now - step * (10 - index),
    o: open,
    h: open + 2,
    l: open - 1,
    c: open + 1
  };
});
const waitRecord = {
  id: 'TEST|1h|1', symbol: 'TESTUSDT', market: 'Kripto', timeframe: '1h',
  decision: 'BEKLE', signalAt: bars[0].t, price: 100, costPct: 0.2,
  horizon: 10, directionStatus: 'pending'
};
const direction = worker.directionResult(waitRecord, bars, now);
assert.ok(direction && direction.status === 'completed', 'Ten closed candles must complete direction evaluation');
assert.equal(direction.exitAt, bars[9].t);
const patch = worker.evaluationPatch(waitRecord, bars, now);
assert.equal(patch.directionStatus, 'completed');
assert.equal(patch.waitResult, 'missed-up');

const pendingRows = [
  { decision: 'BEKLE', directionStatus: 'pending' },
  { decision: 'AL', directionStatus: 'completed', tradeStatus: 'pending', lastError: 'HTTP 429' },
  { decision: 'SAT', directionStatus: 'expired', spotStatus: 'expired' }
];
assert.deepEqual(worker.summarizePending(pendingRows), {
  total: 2, normal: 1, dataErrors: 1, expired: 1
});

assert.equal(worker.shouldEvaluate(waitRecord, now), true);
assert.equal(worker.shouldEvaluate(Object.assign({}, waitRecord, { nextCheckAt: now + 1000 }), now), false);
assert.equal(worker.shouldEvaluate(Object.assign({}, waitRecord, { signalAt: now }), now), false);
assert.equal(worker.groupPending([waitRecord], now).length, 1);

const expired = worker.expiredPatch({
  decision: 'AL', tradeStatus: 'pending', directionStatus: 'pending'
});
assert.equal(expired.tradeStatus, 'expired');
assert.equal(expired.directionStatus, 'expired');

assert.ok(admin.includes('pendingDataErrors') && admin.includes('pendingNormal'),
  'The results panel must split normal pending records from data-source errors');
assert.ok(shared.includes('offset < 50000'),
  'The mobile admin view keeps a 50,000-row safety ceiling; server worker pagination is independent');
assert.ok(daily.includes(': Infinity;') && daily.includes('pendingDataErrors'),
  'The daily report must read beyond 5,000 and split pending reasons');
assert.ok(workflow.includes('*/15 * * * *') && workflow.includes('SUPABASE_SERVICE_ROLE_KEY'),
  'The background worker must run every 15 minutes using only the Actions secret');
assert.ok(migration.includes("auth.role(), '') <> 'service_role'") &&
  migration.includes('grant execute on function public.grap_ai_shared_signals_worker_patch(jsonb) to service_role'),
  'Only the server-side service role may execute the batch patch function');

console.log('PASS pending-result classification, candle evaluation, pagination, and worker security checks');
