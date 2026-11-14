'use strict';

/* node .github/tests/market-data-safety-smoke.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function marketDataTests() {
  const sandbox = {
    window: { GrapAISystemMonitor: { apiFailure: function () {} } },
    Date, Intl, Map, Number, Object, Array, Math, URL, AbortController,
    setTimeout, clearTimeout,
    fetch: async function () { throw new Error('Unexpected network request in smoke test'); }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('js/veri.js', 'utf8') + '\nglobalThis.__Veri = Veri;', sandbox);
  const Veri = sandbox.__Veri;
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  const good = { t: now - 2 * hour, o: 100, h: 103, l: 98, c: 101, v: 50 };
  const invalid = { t: now - 3 * hour, o: 100, h: 100, l: 98, c: 102, v: 50 };
  const future = { t: now + 10 * 60 * 1000, o: 100, h: 103, l: 98, c: 101, v: 50 };
  const duplicate = Object.assign({}, good, { c: 102 });
  const normalized = Veri.mumlariDogrula([good, invalid, future, duplicate], now);
  assert.equal(normalized.length, 1, 'Invalid OHLC, future and duplicate candles must be rejected');
  assert.equal(normalized[0].c, 102, 'Latest duplicate timestamp must be deterministic');

  const closed = { t: now - 2 * hour, o: 100, h: 103, l: 98, c: 101, closeTime: now - 1 };
  const open = { t: now - hour, o: 101, h: 104, l: 100, c: 103, closeTime: now + 1 };
  assert.equal(Veri.kapanmisMumlar([closed, open], '1h', now).length, 1,
    'An open Binance candle must never enter closed-candle analysis');

  const sessionStart = Date.parse('2026-11-13T07:00:00Z');
  const sessionEnd = Date.parse('2026-11-13T15:00:00Z');
  const currentDaily = {
    t: Date.parse('2026-11-13T00:00:00Z'), o: 100, h: 103, l: 98, c: 101, v: 100
  };
  const previousDaily = {
    t: Date.parse('2026-11-12T00:00:00Z'), o: 99, h: 102, l: 97, c: 100, v: 100
  };
  const meta = {
    exchangeTimezoneName: 'Europe/Istanbul',
    currentTradingPeriod: { regular: { start: sessionStart / 1000, end: sessionEnd / 1000 } }
  };
  const duringSession = Date.parse('2026-11-13T12:00:00Z');
  assert.equal(Veri.sonMumAcikMi([previousDaily, currentDaily], '1d', meta, duringSession, 'y'), true,
    'Yahoo daily candle for the active exchange session must be treated as open');
  assert.equal(Veri.sonMumAcikMi([previousDaily, currentDaily], '1d', meta,
    Date.parse('2026-11-13T16:00:00Z'), 'y'), false,
    'Yahoo daily candle must be considered closed after the regular session ends');
  assert.equal(Veri.kapanmisYahooMumlar([previousDaily, currentDaily], '1d', meta, duringSession).length, 1,
    'Yahoo open daily candle must be excluded from analysis');

  const timestamps = Array.from({ length: 20 }, (_, i) =>
    Math.floor((Date.now() - (20 - i) * 24 * hour) / 1000));
  const quote = {
    open: timestamps.map(() => 100),
    high: timestamps.map(() => 103),
    low: timestamps.map(() => 98),
    close: timestamps.map(() => 101),
    volume: timestamps.map(() => 1000)
  };
  const payload = {
    chart: {
      result: [{
        timestamp: timestamps,
        meta: {},
        indicators: { quote: [quote] }
      }]
    }
  };
  let requestedOptions = null;
  let sourceInfo = { stale: true, failed: false, fetchedAt: new Date().toISOString() };
  sandbox.window.GrapAIDataTransport = {
    json: async function (_url, options) {
      requestedOptions = options;
      return payload;
    },
    info: function () { return sourceInfo; }
  };
  await assert.rejects(() => Veri.yahoo('AAPL', '1d'), /güncelliği doğrulanamadı/i,
    'Yahoo stale cache must be rejected for market analysis');
  assert.equal(requestedOptions.staleMaxAgeMs, 0,
    'Financial chart data must not permit stale-if-error cache fallback');

  sourceInfo = { stale: false, failed: false, fetchedAt: new Date().toISOString(), route: 'test-live' };
  const freshYahoo = await Veri.yahoo('AAPL', '1d');
  assert.equal(freshYahoo.mumlar.length, 20, 'Fresh Yahoo data must still be usable');
  assert.equal(freshYahoo.sourceInfo.stale, false);

  const originalCoz = Veri.coz;
  const originalBinance = Veri.binance;
  Veri.coz = function () {
    return [{ kaynak: 'b', sembol: 'BTCUSDT', ad: 'Bitcoin', tur: 'Kripto' }];
  };
  const makeBars = function (lastCloseAgeMs) {
    const current = Date.now();
    const lastOpen = current - hour - lastCloseAgeMs;
    return Array.from({ length: 30 }, (_, i) => {
      const t = lastOpen - (29 - i) * hour;
      return { t, o: 100, h: 103, l: 98, c: 101, v: 100,
        closeTime: t + hour - 1 };
    });
  };
  Veri.binance = async function () { return makeBars(4 * hour); };
  await assert.rejects(() => Veri.ara('BTC', '1h'), /güncel değil/i,
    'Old but structurally valid Binance candles must be rejected');

  Veri.binance = async function () { return makeBars(10 * 60 * 1000); };
  const freshBinance = await Veri.ara('BTC', '1h');
  assert.equal(freshBinance.sonMumAcik, false);
  assert.equal(freshBinance.mumlar.length, 30,
    'Fresh Binance candles must remain available after validation');
  Veri.coz = originalCoz;
  Veri.binance = originalBinance;

  console.log('PASS market-data safety: OHLC integrity, duplicate/future rejection, closed candles, Yahoo stale-cache block, Binance freshness');
}

function committeeDecisionTests() {
  const agent = {
    hacim: Array(60).fill(1000),
    hacimAjani: function () {
      return { var: true, skor: 0, satirlar: ['Test hacim verisi'], iddia: 'Hacim nötr.' };
    },
    denetci: function () {
      return {
        sorunlar: [], hata: 'Düşük', kontrol: 11,
        teyit: 'Hacim nötr', teknikTeyit: 'Kısmi teyit'
      };
    }
  };
  const sandbox = {
    window: { Ajan: agent },
    Yorum: {
      olustur: function (s) {
        return { karar: s.karar, renk: '#f0b429', uyum: 50, ozet: ['İlk analiz özeti'], kartlar: [] };
      }
    },
    Analiz: {
      fiyat: function (level, kal) {
        return (kal.lo + level * (kal.hi - kal.lo)).toFixed(2);
      }
    },
    document: { getElementById: function () { return null; } },
    Date, Math, Number, Object, Array, String, isFinite
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('js/ajan2.js', 'utf8'), sandbox);

  const candles = Array.from({ length: 60 }, (_, i) => {
    const close = 100 + Math.sin(i / 4) * 1.5 + i * 0.01;
    const open = close - 0.1;
    return { t: i, o: open, h: close + 0.6, l: open - 0.6, c: close, v: 1000 };
  });
  const s = {
    c: candles,
    analysisC: candles,
    karar: 'BEKLE',
    uyum: 50,
    rsi: 50,
    alici: 50,
    trend: { yon: 'Yatay', guc: 0 },
    form: [],
    oylar: [],
    sv: {
      destekler: [{ seviye: 0.25 }],
      direncler: [{ seviye: 0.75 }]
    },
    plan: null
  };
  const y = sandbox.Yorum.olustur(s, { hi: 120, lo: 80 }, []);
  const finalCard = y.kartlar[0];
  const titleMatch = String(finalCard.baslik).match(/:\s*(AL|SAT|BEKLE)\s*$/i);
  assert.ok(titleMatch, 'Committee final decision card must contain a parseable decision');
  assert.equal(y.karar, titleMatch[1].toUpperCase(),
    'The main decision value must match the visible committee decision card');
  assert.ok(finalCard.satirlar.some(line => line.indexOf('AL için izlenecek koşul:') === 0),
    'BEKLE card must show a numeric upside confirmation condition');
  assert.ok(finalCard.satirlar.some(line => line.indexOf('SAT için izlenecek koşul:') === 0),
    'BEKLE card must show a numeric downside confirmation condition');
  assert.ok(finalCard.satirlar.some(line => line.indexOf('otomatik emir') >= 0),
    'Confirmation levels must be clearly described as non-automatic and non-guaranteed');
  console.log('PASS committee safety: displayed decision synchronized and BEKLE confirmation conditions are explicit');
}

(async function () {
  await marketDataTests();
  committeeDecisionTests();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
