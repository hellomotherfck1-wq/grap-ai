/* node .github/tests/crypto-agent-smoke.cjs */
'use strict';
const assert = require('node:assert/strict');

global.window = global;
const hour = 60 * 60 * 1000;
const now = Date.now();

function makeBars(symbol, tf, direction) {
  const step = ({ '15m': 15 * 60 * 1000, '1h': hour, '4h': 4 * hour, '1d': 24 * hour })[tf];
  const lastOpen = Math.floor((now - step - 1000) / step) * step;
  return Array.from({ length: 120 }, (_, i) => {
    const t = lastOpen - (119 - i) * step;
    const close = direction < 0 ? 220 - i * 0.4 : 100 + i * 0.4;
    const quote = i >= 115 ? 1200 : 1000;
    const buyShare = i >= 115 ? (direction < 0 ? 0.4 : 0.65) : 0.5;
    return {
      t, o: close - 0.1, h: close + 0.3, l: close - 0.3, c: close,
      v: 100, closeTime: t + step - 1,
      quoteVolume: quote, trades: 500,
      takerBuyBaseVolume: 50, takerBuyQuoteVolume: quote * buyShare
    };
  });
}

global.Veri = {
  kapanmisMumlar(rows, tf) {
    const step = ({ '15m': 15 * 60 * 1000, '1h': hour, '4h': 4 * hour, '1d': 24 * hour })[tf];
    return rows.filter(row => Number(row.closeTime) < now && Number(row.t) + step <= now);
  },
  async binance(symbol, tf) {
    return makeBars(symbol, tf, 1);
  },
  async getir(url) {
    assert.ok(!/fapi\.binance\.com|\/futures\/data/i.test(String(url)), 'Kripto ajanı Spot dışı veri çağırdı');
    throw new Error('Smoke testte beklenmeyen doğrudan API çağrısı: ' + url);
  }
};

require('../../js/kripto-ajanlari.js');
const agents = global.KriptoAjanlari;

const flowBars = Array.from({ length: 30 }, (_, i) => {
  const t = now - (30 - i) * hour;
  const recent = i >= 25, quote = recent ? 1200 : 1000;
  return { t, closeTime: t + hour - 1, quoteVolume: quote, takerBuyQuoteVolume: quote * (recent ? 0.65 : 0.5) };
});
const flow = agents.orderFlow(flowBars);
assert.equal(flow.available, true);
assert.equal(flow.score, 2);
assert.equal(agents.orderFlow(flowBars.map(row => ({ t: row.t, closeTime: row.closeTime, v: 10 }))).available, false);
const stale = flowBars.map(row => Object.assign({}, row, { closeTime: now - 4 * hour }));
assert.equal(agents.orderFlow(stale).available, false);
assert.equal(typeof agents.futuresOku, 'undefined', 'Futures ajanı dışa aktarılmamalı');

(async () => {
  const rising = await agents.trendOku('BTCUSDT', '4h');
  assert.equal(rising.direction, 1);

  const candidates = Array.from({ length: 22 }, (_, i) => ({
    ad: 'Coin ' + i, sembol: 'COIN' + i + 'USDT',
    karar: 'AL', skor: 90 - i, trend: 'Yükseliş',
    signalAt: now - hour, _mumlar: flowBars
  }));
  const result = await agents.derinAnaliz(candidates, null);
  assert.equal(result.derinTaranan, 20);
  assert.equal(result.adaylar.filter(item => item.deepScan === 'tamamlandı').length, 20);
  assert.equal(result.adaylar.slice(20).every(item => item.karar === 'BEKLE'), true);
  assert.equal(result.adaylar.slice(0, 20).every(item => item.futures === undefined), true);

  console.log('PASS crypto-agent smoke: Spot order flow, stale data, MTF, market regime and top-20 gate; no derivatives calls');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
