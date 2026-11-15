'use strict';
const assert = require('node:assert/strict');
global.window = global;
require('../../js/piyasa-becerileri.js');
const skills = global.PiyasaBecerileri;
assert.equal(skills.version, 'market-skills-1.0.0');
const now = Date.now(), step = 15 * 60 * 1000;
const bars = Array.from({ length: 260 }, (_, i) => {
  const close = 100 + i * 0.12 + Math.sin(i / 5) * 0.35;
  const quote = i > 254 ? 1500 : 1000;
  return { t: now - (260 - i) * step, o: close - 0.08, h: close + 0.3,
    l: close - 0.3, c: close, v: 100 + i, quoteVolume: quote,
    takerBuyQuoteVolume: quote * (i > 254 ? 0.62 : 0.5) };
});
const crypto = skills.oku(bars, { market: 'Binance', timeframe: '15m', closedCandles: true, fresh: true });
assert.equal(crypto.candleCount, 260);
assert.equal(crypto.quality, 'geçerli');
assert.equal(Number.isFinite(crypto.indicators.rsi14), true);
assert.equal(Number.isFinite(crypto.indicators.ema200), true);
assert.equal(Number.isFinite(crypto.indicators.atrPercent), true);
assert.equal(Number.isFinite(crypto.indicators.adx14), true);
assert.equal(Number.isFinite(crypto.indicators.macdHistogram), true);
assert.equal(Number.isFinite(crypto.volume.relativeVolume), true);
assert.equal(Number.isFinite(crypto.volume.binanceAggressiveBuyShare), true);
assert.equal(typeof crypto.structure.candlePattern, 'string');
assert.ok(Object.prototype.hasOwnProperty.call(crypto.structure, 'support'));
assert.ok(Object.prototype.hasOwnProperty.call(crypto.structure, 'resistance'));
assert.equal(crypto.mode, 'shadow');
assert.equal(crypto.decisionImpact, 'none');
const bist = skills.oku(bars, { market: 'BIST', timeframe: '1d', closedCandles: true, fresh: true });
assert.ok(bist.signals.some(x => x.indexOf('BIST notu:') === 0));
const fundamentals = skills.temelVeriKontrol({ revenueGrowth: 0.1, roe: 0.15, debtToEquity: 80 });
assert.ok(fundamentals.warnings.some(x => x.indexOf('raporlama dönemi') >= 0));
assert.ok(fundamentals.missingFields.includes('trailingPE'));
const missing = skills.oku([{ o: 1, h: 1, l: 1, c: 1, v: null }], { market: 'Binance' });
assert.equal(missing.quality, 'yetersiz');
console.log('PASS shared market skills: BIST/Binance indicators, Spot flow, fundamentals freshness and insufficient-data guard');
