/* node .github/tests/binance-live-api.cjs
 * Live, read-only checks against the same public Binance endpoints used by Graph AI.
 * No API key, account access, order placement, or trading permission is used.
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
    requestLog.push({
      url: safeUrl(url),
      status: response.status,
      durationMs: Date.now() - started
    });
    return response;
  } catch (error) {
    requestLog.push({
      url: safeUrl(url),
      status: null,
      durationMs: Date.now() - started,
      error: String(error && error.message || error)
    });
    throw error;
  }
}

const sandbox = {
  fetch: trackedFetch,
  AbortController,
  setTimeout,
  clearTimeout,
  console,
  URL,
  Date
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const veriPath = path.join(process.cwd(), 'js', 'veri.js');
const agentsPath = path.join(process.cwd(), 'js', 'kripto-ajanlari.js');
vm.runInContext(
  fs.readFileSync(veriPath, 'utf8') + '\n;globalThis.Veri = Veri;',
  sandbox,
  { filename: veriPath }
);
vm.runInContext(
  fs.readFileSync(agentsPath, 'utf8'),
  sandbox,
  { filename: agentsPath }
);

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

function validateKlines(rows, label) {
  assert.ok(Array.isArray(rows), label + ' JSON array dönmedi');
  assert.ok(rows.length >= 20, label + ' en az 20 mum döndürmedi');
  for (const row of rows) {
    assert.ok(Array.isArray(row) && row.length >= 12, label + ' 12 alanlı Binance Kline şemasıyla uyuşmuyor');
    for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      assert.ok(Number.isFinite(Number(row[index])), label + ' mum alanı sayısal değil: ' + index);
    }
    assert.ok(Number(row[2]) >= Math.max(Number(row[1]), Number(row[4])), label + ' high değeri tutarsız');
    assert.ok(Number(row[3]) <= Math.min(Number(row[1]), Number(row[4])), label + ' low değeri tutarsız');
    assert.ok(Number(row[10]) <= Number(row[7]) + 1e-8, label + ' taker buy quote volume toplam quote volume değerini aşıyor');
  }
  const now = Date.now();
  const closed = rows.filter(row => Number(row[6]) < now);
  assert.ok(closed.length >= 15, label + ' yeterli kapanmış mum döndürmedi');
  const latest = closed[closed.length - 1];
  const age = now - Number(latest[6]);
  assert.ok(age >= 0 && age <= 2 * HOUR, label + ' son kapanmış mum eski veya gelecek zamanlı');
  return { rows: rows.length, closedCandles: closed.length, latestClosedAgeSeconds: Math.round(age / 1000) };
}

async function main() {
  assert.ok(Veri && typeof Veri.binance === 'function', 'js/veri.js yüklenemedi');
  assert.ok(Agents && typeof Agents.futuresOku === 'function', 'js/kripto-ajanlari.js yüklenemedi');

  let oneHourCandles = null;
  await check('Spot Kline: production Veri.binance BTCUSDT 1h', async () => {
    oneHourCandles = await Veri.binance('BTCUSDT', '1h', 120);
    const detail = validateKlines(
      oneHourCandles.map(row => [
        row.t, row.o, row.h, row.l, row.c, row.v, row.closeTime,
        row.quoteVolume, row.trades, row.takerBuyBaseVolume,
        row.takerBuyQuoteVolume, '0'
      ]),
      'Veri.binance BTCUSDT 1h'
    );
    assert.ok(oneHourCandles.every(row =>
      row.quoteVolume !== null &&
      row.takerBuyBaseVolume !== null &&
      row.takerBuyQuoteVolume !== null
    ), 'Spot mumlarında Order Flow alanları eksik');
    return detail;
  });

  await check('Spot fallback host: api.binance.com', async () => {
    const rows = await Veri.getir(
      'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=20',
      12000
    );
    return validateKlines(rows, 'api.binance.com BTCUSDT 1h');
  }, false);

  await check('Order Flow: canlı kapanmış mumlardan hacim hesabı', async () => {
    assert.ok(oneHourCandles, 'Önceki Spot Kline kontrolü başarısız');
    const closed = Veri.kapanmisMumlar(oneHourCandles, '1h');
    const flow = Agents.orderFlow(closed);
    assert.equal(flow.available, true, 'Order Flow canlı veriyi kullanılamaz buldu: ' + flow.reason);
    assert.ok(Number.isFinite(flow.score), 'Order Flow skoru sayısal değil');
    assert.ok(Number.isFinite(flow.buyShare), 'Order Flow alım payı hesaplanamadı');
    return {
      closedCandles: closed.length,
      decision: flow.decision,
      score: flow.score,
      buyShare: Number(flow.buyShare.toFixed(4)),
      volumeRatio: Number(flow.volumeRatio.toFixed(4))
    };
  });

  await check('Çoklu zaman dilimi: canlı 1D / 4H / 15M trend verisi', async () => {
    const rows = await Promise.all(['1d', '4h', '15m'].map(tf => Agents.trendOku('BTCUSDT', tf)));
    for (const row of rows) {
      assert.ok(row && Number.isFinite(row.lastCandleAt), row.timeframe + ' trend verisi okunamadı');
      assert.ok(row.lastCandleAt < Date.now(), row.timeframe + ' son mumu henüz kapanmamış');
    }
    return rows.map(row => ({
      timeframe: row.timeframe,
      trend: row.trend,
      latestClosedAgeMinutes: Math.round((Date.now() - row.lastCandleAt) / 60000)
    }));
  });

  let premiumMap = Object.create(null);
  await check('Futures: premiumIndex canlı BTCUSDT fonlama verisi', async () => {
    const raw = await Veri.getir('https://fapi.binance.com/fapi/v1/premiumIndex', 15000);
    assert.ok(Array.isArray(raw), 'premiumIndex tüm semboller için dizi döndürmedi');
    const btc = raw.find(row => row && row.symbol === 'BTCUSDT');
    assert.ok(btc, 'premiumIndex yanıtında BTCUSDT yok');
    const stamp = Number(btc.time);
    assert.ok(Number.isFinite(stamp), 'premiumIndex time alanı eksik');
    const age = Date.now() - stamp;
    assert.ok(age >= -5 * 60000 && age <= 30 * 60000, 'premiumIndex verisi güncel değil');
    assert.ok(Number.isFinite(Number(btc.lastFundingRate)), 'lastFundingRate sayısal değil');
    premiumMap.BTCUSDT = btc;
    return {
      symbols: raw.length,
      fundingRate: Number(btc.lastFundingRate),
      ageSeconds: Math.round(age / 1000)
    };
  });

  let futures = null;
  await check('Futures ajanı: dört canlı USD-M endpointini okuyabiliyor', async () => {
    futures = await Agents.futuresOku('BTCUSDT', 1, premiumMap);
    assert.equal(futures.available, true, 'Futures ajanı kullanılabilir veri bulamadı: ' + futures.reason);
    assert.ok(futures.sourceTimestamps, 'Futures kaynak zamanları bulunamadı');
    return {
      openInterest: futures.openInterest,
      openInterestDeltaPct: futures.openInterestDeltaPct,
      longShortRatio: futures.longShortRatio,
      takerBuySellRatio: futures.takerBuySellRatio,
      veto: futures.veto,
      sourceTimestamps: futures.sourceTimestamps
    };
  });

  await check('Futures: /fapi/v1/openInterest güncel veri', async () => {
    assert.ok(futures && futures.openInterest !== null, 'openInterest alanı alınamadı');
    assert.ok(futures.sourceTimestamps.openInterest, 'openInterest zaman damgası eksik/eski');
    return { openInterest: futures.openInterest, timestamp: futures.sourceTimestamps.openInterest };
  });

  await check('Futures: /futures/data/openInterestHist geçmiş veri', async () => {
    assert.ok(futures && futures.openInterestDeltaPct !== null, 'openInterestHist değişimi hesaplanamadı');
    assert.ok(futures.sourceTimestamps.openInterestHistory, 'openInterestHist zaman damgası eksik/eski');
    return {
      changePct: Number(futures.openInterestDeltaPct.toFixed(4)),
      timestamp: futures.sourceTimestamps.openInterestHistory
    };
  });

  await check('Futures: /futures/data/globalLongShortAccountRatio', async () => {
    assert.ok(futures && futures.longShortRatio !== null, 'Long/Short oranı alınamadı');
    assert.ok(futures.sourceTimestamps.longShort, 'Long/Short zaman damgası eksik/eski');
    return { ratio: futures.longShortRatio, timestamp: futures.sourceTimestamps.longShort };
  });

  await check('Futures: /futures/data/takerlongshortRatio', async () => {
    assert.ok(futures && futures.takerBuySellRatio !== null, 'Taker buy/sell oranı alınamadı');
    assert.ok(futures.sourceTimestamps.taker, 'Taker zaman damgası eksik/eski');
    return { ratio: futures.takerBuySellRatio, timestamp: futures.sourceTimestamps.taker };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only public market data; no API key or trading actions',
    requestLog,
    results,
    failures
  };
  fs.writeFileSync(
    path.join(process.cwd(), 'binance-live-api-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  );

  const summary = [
    '## Binance live API probe',
    '',
    '| Check | Result | Required |',
    '|---|---:|---:|',
    ...results.map(row => '| ' + row.name.replace(/\|/g, '\\|') + ' | ' + row.status + ' | ' + (row.required ? 'yes' : 'no') + ' |'),
    '',
    'Requests: ' + requestLog.length + ' · Required failures: ' + failures.length,
    '',
    'This probe uses public read-only market endpoints only; it does not use credentials or place orders.'
  ].join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  console.log('\n' + summary);
  console.log('Request log: ' + JSON.stringify(requestLog, null, 2));
  if (failures.length) {
    console.error('Live Binance checks failed: ' + failures.map(row => row.name + ' (' + row.error + ')').join('; '));
    process.exitCode = 1;
  } else {
    console.log('PASS all required live Binance checks');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
