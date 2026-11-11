/* node .github/tests/binance-live-api.cjs
 * Live, read-only checks against Graph AI's public Binance Spot market data.
 * No API key, account access, derivatives data, or order placement is used.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HOUR = 60 * 60 * 1000;
const nativeFetch = global.fetch;
const requestLog = [];
const results = [];
const failures = [];

function safeUrl(value) {
  try {
    const u = new URL(String(value));
    return u.origin + u.pathname;
  } catch (_) {
    return String(value).split('?')[0];
  }
}

async function trackedFetch(url, init) {
  const started = Date.now();
  try {
    const response = await nativeFetch(url, init);
    requestLog.push({ url: safeUrl(url), status: response.status, durationMs: Date.now() - started });
    return response;
  } catch (error) {
    requestLog.push({ url: safeUrl(url), status: null, durationMs: Date.now() - started, error: String(error && error.message || error) });
    throw error;
  }
}

const sandbox = { fetch: trackedFetch, AbortController, setTimeout, clearTimeout, console, URL, Date };
sandbox.window = sandbox;
vm.createContext(sandbox);

const veriPath = path.join(process.cwd(), 'js', 'veri.js');
const agentsPath = path.join(process.cwd(), 'js', 'kripto-ajanlari.js');
vm.runInContext(fs.readFileSync(veriPath, 'utf8') + '\n;globalThis.Veri = Veri;', sandbox, { filename: veriPath });
vm.runInContext(fs.readFileSync(agentsPath, 'utf8'), sandbox, { filename: agentsPath });

const Veri = sandbox.Veri;
const Agents = sandbox.KriptoAjanlari;

async function check(name, fn, required = true) {
  try {
    const detail = await fn();
    results.push({ name, status: 'PASS', required, detail: detail ?? null });
    console.log('PASS ' + name + (detail ? ': ' + JSON.stringify(detail) : ''));
    return detail;
  } catch (error) {
    const message = String(error && error.message || error);
    results.push({ name, status: 'FAIL', required, error: message });
    console.error((required ? 'FAIL ' : 'OPTIONAL FAIL ') + name + ': ' + message);
    if (required) failures.push({ name, error: message });
    return null;
  }
}

function validateKlines(rows, label, timeframe) {
  assert.ok(Array.isArray(rows), label + ' JSON array dönmedi');
  assert.ok(rows.length >= 20, label + ' en az 20 mum döndürmedi');
  for (const row of rows) {
    assert.ok(Array.isArray(row) && row.length >= 12, label + ' 12 alanlı Spot Kline şemasıyla uyuşmuyor');
    for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      assert.ok(Number.isFinite(Number(row[index])), label + ' mum alanı sayısal değil: ' + index);
    }
    assert.ok(Number(row[2]) >= Math.max(Number(row[1]), Number(row[4])), label + ' high değeri tutarsız');
    assert.ok(Number(row[3]) <= Math.min(Number(row[1]), Number(row[4])), label + ' low değeri tutarsız');
    assert.ok(Number(row[10]) <= Number(row[7]) + 1e-8, label + ' taker buy quote volume toplam quote volume değerini aşıyor');
  }
  const step = timeframe === '1d' ? 24 * HOUR : timeframe === '4h' ? 4 * HOUR : timeframe === '15m' ? 15 * 60000 : HOUR;
  const now = Date.now();
  const closed = rows.filter(row => Number(row[6]) < now);
  assert.ok(closed.length >= 15, label + ' yeterli kapanmış mum döndürmedi');
  const latest = closed[closed.length - 1];
  const age = now - Number(latest[6]);
  assert.ok(age >= 0 && age <= 2 * step, label + ' son kapanmış mum eski veya gelecek zamanlı');
  return { rows: rows.length, closedCandles: closed.length, latestClosedAgeSeconds: Math.round(age / 1000) };
}

async function main() {
  assert.ok(Veri && typeof Veri.binance === 'function', 'js/veri.js yüklenemedi');
  assert.ok(Agents && typeof Agents.trendOku === 'function', 'js/kripto-ajanlari.js yüklenemedi');
  assert.ok(typeof Agents.futuresOku === 'undefined', 'Kripto ajanları Spot-only olmalı');

  let oneHourCandles = null;
  await check('Spot Kline: production Veri.binance BTCUSDT 1h', async () => {
    oneHourCandles = await Veri.binance('BTCUSDT', '1h', 120);
    const rows = oneHourCandles.map(row => [
      row.t, row.o, row.h, row.l, row.c, row.v, row.closeTime,
      row.quoteVolume, row.trades, row.takerBuyBaseVolume, row.takerBuyQuoteVolume, '0'
    ]);
    const detail = validateKlines(rows, 'Veri.binance BTCUSDT 1h', '1h');
    assert.ok(oneHourCandles.every(row => row.quoteVolume !== null && row.takerBuyBaseVolume !== null && row.takerBuyQuoteVolume !== null),
      'Spot mumlarında Order Flow alanları eksik');
    return detail;
  });

  await check('Spot fallback host: api.binance.com', async () => {
    const rows = await Veri.getir('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=20', 12000);
    return validateKlines(rows, 'api.binance.com BTCUSDT 1h', '1h');
  }, false);

  await check('Order Flow: canlı kapanmış mumlardan hacim hesabı', async () => {
    assert.ok(oneHourCandles, 'Önceki Spot Kline kontrolü başarısız');
    const closed = Veri.kapanmisMumlar(oneHourCandles, '1h');
    const flow = Agents.orderFlow(closed);
    assert.equal(flow.available, true, 'Order Flow canlı veriyi kullanılamaz buldu: ' + flow.reason);
    assert.ok(Number.isFinite(flow.score), 'Order Flow skoru sayısal değil');
    assert.ok(Number.isFinite(flow.buyShare), 'Order Flow alım payı hesaplanamadı');
    return { closedCandles: closed.length, decision: flow.decision, score: flow.score, buyShare: Number(flow.buyShare.toFixed(4)), volumeRatio: Number(flow.volumeRatio.toFixed(4)) };
  });

  await check('Çoklu zaman dilimi: canlı 1D / 4H / 15M Spot trend verisi', async () => {
    const rows = await Promise.all(['1d', '4h', '15m'].map(tf => Agents.trendOku('BTCUSDT', tf)));
    for (const row of rows) {
      assert.ok(row && Number.isFinite(row.lastCandleAt), row.timeframe + ' trend verisi okunamadı');
      assert.ok(row.lastCandleAt < Date.now(), row.timeframe + ' son mumu henüz kapanmamış');
    }
    return rows.map(row => ({ timeframe: row.timeframe, trend: row.trend, latestClosedAgeMinutes: Math.round((Date.now() - row.lastCandleAt) / 60000) }));
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only public Spot market data; no API key, derivatives data, or trading actions',
    requestLog, results, failures
  };
  fs.writeFileSync(path.join(process.cwd(), 'binance-live-api-report.json'), JSON.stringify(report, null, 2) + '\n');

  const summary = [
    '## Binance Spot live API probe', '',
    '| Check | Result | Required |',
    '|---|---:|---:|',
    ...results.map(row => '| ' + row.name.replace(/\|/g, '\\|') + ' | ' + row.status + ' | ' + (row.required ? 'yes' : 'no') + ' |'),
    '', 'Requests: ' + requestLog.length + ' · Required failures: ' + failures.length, '',
    'This probe uses public read-only Spot endpoints only; it does not use credentials, derivatives data, or place orders.'
  ].join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log('\n' + summary);
  console.log('Request log: ' + JSON.stringify(requestLog, null, 2));
  if (failures.length) {
    console.error('Live Binance Spot checks failed: ' + failures.map(row => row.name + ' (' + row.error + ')').join('; '));
    process.exitCode = 1;
  } else {
    console.log('PASS all required live Binance Spot checks');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
