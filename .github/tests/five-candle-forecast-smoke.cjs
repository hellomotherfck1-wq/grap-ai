'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const forecast = require('../../js/denetci-fiyat-tahmini.js');
const worker = require('../../scripts/evaluate-pending-results.cjs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const auditor = fs.readFileSync('js/ajan2.js', 'utf8');
const performance = fs.readFileSync('js/ajan-performans.js', 'utf8');
const shared = fs.readFileSync('js/ortak-sonuc-havuzu.js', 'utf8');
const workerSource = fs.readFileSync('scripts/evaluate-pending-results.cjs', 'utf8');
const sql = fs.readFileSync(
  'supabase/migrations/20261114000100_auditor_five_candle_forecast.sql', 'utf8'
);
const workerWorkflow = fs.readFileSync('.github/workflows/pending-results-worker.yml', 'utf8');
const browserWorkflow = fs.readFileSync('.github/workflows/live-e2e.yml', 'utf8');
const coinScan = fs.readFileSync('js/coin-tahmin.js', 'utf8');

new Function(workerSource);
new Function(auditor);
new Function(performance);

const now = Date.now();
const step = forecast.intervalMs();
assert.equal(step, 15 * 60 * 1000);

const bars = Array.from({ length: 80 }, function (_, index) {
  const close = 100 * Math.exp(index * 0.00018 + 0.004 * Math.sin(index * 0.43));
  const previous = index === 0 ? close * 0.999 : barsPreviousClose(index);
  return {
    t: now - step - 1000 - (79 - index) * step,
    o: previous,
    h: Math.max(previous, close) * 1.0015,
    l: Math.min(previous, close) * 0.9985,
    c: close,
    v: 900 + (index % 9) * 125
  };
});
function barsPreviousClose(index) {
  return 100 * Math.exp((index - 1) * 0.00018 + 0.004 * Math.sin((index - 1) * 0.43));
}

const meta = {
  timeframe: '15m',
  source: 'Binance Spot',
  sourceInfo: { stale: false, failed: false, route: 'test-live' },
  fetchedAt: now - 1000,
  lastClosedAt: bars[bars.length - 1].t,
  intervalMs: step
};
const prediction = forecast.olustur(bars, meta, now);
assert.equal(prediction.status, 'pending', 'A fresh 15m chart with enough closed OHLCV must produce a pending forecast');
assert.equal(prediction.horizonBars, 5);
assert.equal(prediction.timeframe, '15m');
assert.equal(prediction.modelVersion, 'auditor-price-5bar-chart-v2');
assert.ok(prediction.chartRead && ['Yükseliş', 'Düşüş', 'Yatay'].includes(prediction.chartRead.trend),
  'The forecast must include a chart-derived EMA trend reading');
assert.ok(Number.isFinite(prediction.chartRead.rsi),
  'The forecast must include an RSI14 reading');
assert.ok(Number.isFinite(prediction.chartRead.momentum5BarsPct),
  'The forecast must include the last five-candle momentum');
assert.ok(typeof prediction.chartRead.lastCandle === 'string' && prediction.chartRead.lastCandle.length > 0,
  'The forecast must identify or explicitly reject the last candle pattern');
assert.ok(prediction.method.includes('EMA9-EMA21') && prediction.method.includes('destek/direnç'),
  'The forecast method must disclose its chart-reading features');
assert.ok(Number.isFinite(prediction.basePrice) && prediction.basePrice > 0);
assert.ok(Number.isFinite(prediction.predictedPrice) && prediction.predictedPrice > 0);
assert.ok(prediction.predictedLow <= prediction.predictedHigh);
assert.ok(prediction.historicalSampleCount >= 5);
assert.equal(prediction.volumeUsed, true);

assert.equal(forecast.olustur(bars, Object.assign({}, meta, { timeframe: '1h' }), now), null,
  '1h forecasts must be excluded');
assert.equal(forecast.olustur(bars, Object.assign({}, meta, { timeframe: '4h' }), now), null,
  '4h forecasts must be excluded');
assert.equal(forecast.olustur(bars, Object.assign({}, meta, { timeframe: '1d' }), now), null,
  'daily forecasts must be excluded');
assert.equal(forecast.olustur(bars.slice(0, 50), meta, now).status, 'unavailable',
  'Insufficient closed candles must never be replaced with an invented estimate');
assert.equal(forecast.olustur(bars, Object.assign({}, meta, {
  sourceInfo: { stale: true, failed: false, route: 'stale-cache' }
}), now).status, 'unavailable',
  'Stale market data must not produce a forecast');

const futureBars = [];
let previousClose = bars[bars.length - 1].c;
for (let index = 0; index < 5; index++) {
  const close = previousClose * (1 + (index % 2 === 0 ? 0.0012 : -0.00035));
  futureBars.push({
    t: prediction.signalAt + index * step,
    o: previousClose,
    h: Math.max(previousClose, close) * 1.001,
    l: Math.min(previousClose, close) * 0.999,
    c: close,
    v: 1200 + index * 100
  });
  previousClose = close;
}
const evaluationTime = prediction.signalAt + 5 * step;
const forecastRecord = {
  id: 'TESTUSDT|15m|' + prediction.signalAt,
  symbol: 'TESTUSDT',
  market: 'Kripto',
  timeframe: '15m',
  decision: 'BEKLE',
  signalAt: prediction.signalAt,
  price: prediction.basePrice,
  horizon: 10,
  costPct: 0.2,
  directionStatus: 'completed',
  priceForecast: prediction
};
const evaluated = forecast.degerlendir(forecastRecord, bars.concat(futureBars), evaluationTime);
assert.equal(evaluated.status, 'completed');
assert.equal(evaluated.evaluatedBars, 5);
assert.equal(evaluated.actualPrice, futureBars[4].c);
assert.ok(Number.isFinite(evaluated.absoluteErrorPct) && evaluated.absoluteErrorPct >= 0);

assert.equal(worker.isPending(forecastRecord), true,
  'A forecast-only record must remain in the background evaluation queue');
assert.equal(worker.groupPending([forecastRecord], evaluationTime).length, 1);
const workerPatch = worker.evaluationPatch(forecastRecord, bars.concat(futureBars), evaluationTime);
assert.equal(workerPatch.priceForecast.status, 'completed',
  'The scheduled worker must save the result after exactly five closed candles');
assert.equal(workerPatch.priceForecast.actualPrice, futureBars[4].c);
const expired = worker.expiredPatch({
  decision: 'BEKLE',
  directionStatus: 'completed',
  priceForecast: prediction
});
assert.equal(expired.priceForecast.status, 'expired');

assert.ok(index.includes('js/denetci-fiyat-tahmini.js?v=2') && index.includes('js/ajan2.js?v=6') &&
  index.includes('js/coin-tahmin.js?v=12'),
  'The forecast module must load in the browser');
assert.ok(sw.includes('graph-ai-v62') && sw.includes('./js/denetci-fiyat-tahmini.js'),
  'The service worker must cache the new module under a fresh version');
assert.ok(auditor.includes('5 mum sonrası tahmini fiyat') && auditor.includes('priceForecast') && auditor.includes('Grafik okuması'),
  'The Denetçi card must display and pass the forecast to result storage');
assert.ok(performance.includes('renderFiveBarForecast') &&
  performance.includes('absoluteErrorPct') && performance.includes('priceForecast') &&
  performance.includes('priceForecast: c.priceForecast') && performance.includes('chartRead') &&
  performance.includes("directionStatus: c.priceForecast ? 'not-applicable' : 'pending'"),
  'The Results section must display forecasts and measured price errors');
assert.ok(shared.includes("'fkVeto', 'priceForecast'"),
  'Admin shared-result patches must allow the forecast payload');
assert.ok(workerSource.includes("require('../js/denetci-fiyat-tahmini.js')"),
  'The background evaluator must use the same forecast evaluator');
assert.ok(sql.includes("'fkVeto', 'priceForecast'") &&
  sql.includes("'lastError', 'updatedAt', 'priceForecast'") &&
  sql.includes('service_role_required') &&
  sql.includes("notify pgrst, 'reload schema'"),
  'Both secured Supabase patch RPCs must accept forecast outcomes');
const listStart = coinScan.indexOf('var LISTE = [');
const listEnd = coinScan.indexOf('  ];', listStart);
const listedCoins = listStart >= 0 && listEnd > listStart
  ? (coinScan.slice(listStart, listEnd).match(/{ q: '/g) || []).length : 0;
assert.equal(listedCoins, 216, 'The forecast sweep must cover all 216 coins in the app list');
assert.ok(coinScan.includes("Veri.binance(symbol, '15m', 120)") &&
  coinScan.includes('tumCoinTahminleriniUret') &&
  coinScan.includes('priceForecastSummary') &&
  coinScan.includes('renderTopluTahminList'),
  'The Coin Tahmin scan must produce and show 15m five-candle forecasts for the entire app list');
assert.ok(workerWorkflow.includes('five-candle-forecast-smoke.cjs') &&
  browserWorkflow.includes('five-candle-forecast-smoke.cjs'),
  'Both worker and browser CI must run the forecast smoke test');

console.log('PASS auditor five-candle forecast: 15m-only, real closed OHLCV, stale-data rejection, 5-bar evaluation, and Results persistence');
