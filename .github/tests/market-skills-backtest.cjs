'use strict';
/*
 * Read-only walk-forward evaluation of the shared BIST/Binance skills.
 * Each forecast sees only candles before its timestamp; outcome is the next 5 closed candles.
 * No synthetic data, orders, API keys or derivatives endpoints.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
global.window = global;
require('../../js/piyasa-becerileri.js');
const Skills = global.PiyasaBecerileri;
const HOUR = 3600000, DAY = 24 * HOUR, STEP = 5;
const now = Date.now();
const symbols = [
  { market: 'Binance', symbol: 'BTCUSDT', interval: '15m', step: 900000, lookback: 220, minSamples: 40 },
  { market: 'Binance', symbol: 'ETHUSDT', interval: '15m', step: 900000, lookback: 220, minSamples: 40 },
  { market: 'Binance', symbol: 'SOLUSDT', interval: '15m', step: 900000, lookback: 220, minSamples: 40 },
  { market: 'Binance', symbol: 'BNBUSDT', interval: '15m', step: 900000, lookback: 220, minSamples: 40 },
  { market: 'Binance', symbol: 'XRPUSDT', interval: '15m', step: 900000, lookback: 220, minSamples: 40 },
  { market: 'BIST', symbol: 'THYAO.IS', interval: '1d', step: DAY, lookback: 30, minSamples: 10 },
  { market: 'BIST', symbol: 'ASELS.IS', interval: '1d', step: DAY, lookback: 30, minSamples: 10 },
  { market: 'BIST', symbol: 'GARAN.IS', interval: '1d', step: DAY, lookback: 30, minSamples: 10 },
  { market: 'BIST', symbol: 'TUPRS.IS', interval: '1d', step: DAY, lookback: 30, minSamples: 10 },
  { market: 'BIST', symbol: 'BIMAS.IS', interval: '1d', step: DAY, lookback: 30, minSamples: 10 },
  { market: 'BIST', symbol: 'XU100.IS', interval: '1d', step: DAY, lookback: 30, minSamples: 10 }
];
const fetchLog = [];
async function getJson(url, label) {
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'GrapAI-read-only-market-skills-backtest/1.0' } });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    fetchLog.push({ label, status: response.status, ms: Date.now() - started });
    return data;
  } catch (error) {
    fetchLog.push({ label, status: 'ERROR', error: String(error && error.message || error), ms: Date.now() - started });
    throw error;
  }
}
async function load(item) {
  if (item.market === 'Binance') {
    let rows, lastError;
    for (const host of ['https://data-api.binance.vision', 'https://api.binance.com']) {
      try {
        rows = await getJson(host + '/api/v3/klines?symbol=' + item.symbol + '&interval=15m&limit=1000', item.symbol + ' Binance Spot');
        break;
      } catch (error) { lastError = error; }
    }
    if (!Array.isArray(rows)) throw lastError || new Error('Binance Kline response invalid');
    return rows.filter(r => Array.isArray(r) && Number(r[6]) < now).map(r => ({
      t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]),
      v: Number(r[5]), quoteVolume: Number(r[7]), takerBuyQuoteVolume: Number(r[10])
    })).filter(validBar);
  }
  const data = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(item.symbol) + '?interval=1d&range=6mo', item.symbol + ' Yahoo Finance');
  const result = data && data.chart && data.chart.result && data.chart.result[0];
  const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
  if (!result || !Array.isArray(result.timestamp) || !quote) throw new Error('Yahoo chart data missing');
  return result.timestamp.map((t, i) => ({
    t: Number(t) * 1000, o: quote.open[i], h: quote.high[i], l: quote.low[i], c: quote.close[i],
    v: quote.volume && quote.volume[i] != null ? Number(quote.volume[i]) : null
  })).filter(validBar).filter(b => b.t + DAY <= now);
}
function validBar(b) {
  return b && [b.o,b.h,b.l,b.c].every(x => Number.isFinite(Number(x))) &&
    Number(b.o)>0 && Number(b.c)>0 && Number(b.h)>=Math.max(Number(b.o),Number(b.c)) &&
    Number(b.l)<=Math.min(Number(b.o),Number(b.c)) && Number(b.h)>=Number(b.l);
}
function stats(rows, key) {
  const selected = rows.filter(r => r[key] !== null);
  const wins = selected.filter(r => r[key] === r.actual).length;
  return { signals: selected.length, accuracy: selected.length ? wins / selected.length : null,
    bullish: selected.filter(r => r[key] === 1).length, bearish: selected.filter(r => r[key] === -1).length };
}
async function evaluate(item) {
  const bars = await load(item);
  if (bars.length < item.lookback + STEP + 10) throw new Error('Yeterli geçmiş kapanmış mum yok: ' + bars.length);
  const rows = [];
  for (let end = item.lookback; end + STEP <= bars.length; end += STEP) {
    const history = bars.slice(end - item.lookback, end);
    const future = bars.slice(end, end + STEP);
    if (future.length !== STEP) continue;
    const last = history[history.length - 1], next = future[future.length - 1];
    const ret = (next.c / last.c - 1) * 100;
    const deadband = item.market === 'Binance' ? 0.10 : 0.35;
    const actual = ret > deadband ? 1 : ret < -deadband ? -1 : 0;
    const skill = Skills.oku(history, { market: item.market, timeframe: item.interval, closedCandles: true, fresh: true, expectedIntervalMs: item.step });
    const direction = skill.score.direction === 'yükseliş' ? 1 : skill.score.direction === 'düşüş' ? -1 : null;
    const baselineReturn = (last.c / history[history.length - 21].c - 1) * 100;
    const baseline = baselineReturn > 0.15 ? 1 : baselineReturn < -0.15 ? -1 : null;
    rows.push({ at: new Date(last.t).toISOString(), return5Pct: ret, actual,
      skill: direction, baseline, score: skill.score.value, confidence: skill.score.confidence,
      rsi14: skill.indicators.rsi14, adx14: skill.indicators.adx14 });
  }
  const directional = rows.filter(r => r.actual !== 0);
  const skillRows = directional.filter(r => r.skill !== null);
  const baseRows = directional.filter(r => r.baseline !== null);
  const skillStats = stats(directional, 'skill');
  const baseStats = stats(directional, 'baseline');
  return { market:item.market, symbol:item.symbol, interval:item.interval, closedCandles:bars.length,
    windows:rows.length, directionalOutcomes:directional.length, skill:skillStats, baseline:baseStats,
    skillCoverage: directional.length ? skillRows.length/directional.length : null,
    baselineCoverage: directional.length ? baseRows.length/directional.length : null,
    deltaAccuracy: skillStats.accuracy!==null&&baseStats.accuracy!==null?skillStats.accuracy-baseStats.accuracy:null,
    sample:rows.slice(-5) };
}
(async()=>{
  const results=[], errors=[];
  for (const item of symbols) {
    try { const result=await evaluate(item); results.push(result); console.log('PASS '+item.symbol+' '+JSON.stringify({candles:result.closedCandles,windows:result.windows,skill:result.skill,baseline:result.baseline,delta:result.deltaAccuracy})); }
    catch(error) { errors.push({market:item.market,symbol:item.symbol,error:String(error&&error.message||error)}); console.error('SKIP '+item.symbol+': '+String(error&&error.message||error)); }
  }
  const byMarket={};
  for (const market of ['Binance','BIST']) {
    const rows=results.filter(r=>r.market===market);
    const skillTotal=rows.reduce((s,r)=>s+r.skill.signals,0), skillCorrect=rows.reduce((s,r)=>s+(r.skill.accuracy===null?0:r.skill.accuracy*r.skill.signals),0);
    const baseTotal=rows.reduce((s,r)=>s+r.baseline.signals,0), baseCorrect=rows.reduce((s,r)=>s+(r.baseline.accuracy===null?0:r.baseline.accuracy*r.baseline.signals),0);
    const totalDirectional=rows.reduce((s,r)=>s+r.directionalOutcomes,0);
    byMarket[market]={symbols:rows.length,directionalOutcomes:totalDirectional,skill:{signals:skillTotal,accuracy:skillTotal?skillCorrect/skillTotal:null},baseline:{signals:baseTotal,accuracy:baseTotal?baseCorrect/baseTotal:null},coverage:totalDirectional?skillTotal/totalDirectional:null};
  }
  const report={generatedAt:new Date().toISOString(),method:'walk-forward; only prior closed candles used; next 5 closed candles evaluated; non-overlapping windows; deadband Binance 0.10%, BIST 0.35%; read-only public data',results,byMarket,errors,fetchLog};
  fs.writeFileSync('market-skills-backtest-report.json',JSON.stringify(report,null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY){
    const lines=['## Shared market skills: 5-candle walk-forward','', '| Market | Symbols | Evaluated outcomes | Skills accuracy | Baseline accuracy | Skill coverage |','|---|---:|---:|---:|---:|---:|'];
    for(const m of ['Binance','BIST']){const x=byMarket[m];lines.push('| '+m+' | '+x.symbols+' | '+x.directionalOutcomes+' | '+pct(x.skill.accuracy)+' | '+pct(x.baseline.accuracy)+' | '+pct(x.coverage)+' |');}
    lines.push('','Per symbol:','', '| Symbol | Closed candles | Windows | Skill accuracy | Baseline accuracy | Difference |','|---|---:|---:|---:|---:|---:|');
    results.forEach(r=>lines.push('| '+r.symbol+' | '+r.closedCandles+' | '+r.windows+' | '+pct(r.skill.accuracy)+' | '+pct(r.baseline.accuracy)+' | '+pct(r.deltaAccuracy)+' |'));
    lines.push('','Skipped symbols: '+errors.length,'','Method: '+report.method,'','Accuracy is conditional on a directional (non-flat) five-candle outcome; neutral model outputs count as no signal, not as wrong. This is historical evaluation, not a promise of future performance.');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
  }
  console.log(JSON.stringify({byMarket,errors,report:'market-skills-backtest-report.json'},null,2));
  const binance=byMarket.Binance,BIST=byMarket.BIST;
  if(!binance.symbols||!BIST.symbols||binance.directionalOutcomes<20||BIST.directionalOutcomes<20){
    console.error('INSUFFICIENT LIVE HISTORY: need Binance and BIST data with at least 20 directional outcomes per market.');
    process.exitCode=2;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
function pct(x){return x===null||x===undefined?'n/a':(x*100).toFixed(1)+'%';}
