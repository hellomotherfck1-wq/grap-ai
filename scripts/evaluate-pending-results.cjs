'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qkkhguyngmsddnkunyws.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAGE_SIZE = 1000;
const PATCH_SIZE = 50;
const CONCURRENCY = 3;
const RETENTION_DAYS = 365;
const DEFAULT_HORIZON = 10;
const DEFAULT_COST = 0.20;
const RETRY_ERROR_MS = 6 * 60 * 60 * 1000;
const priceForecastModel = require('../js/denetci-fiyat-tahmini.js');

function intervalMs(timeframe) {
  return ({
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  })[timeframe] || 0;
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function recordFromRow(row) {
  const payload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
  return Object.assign({}, payload, {
    id: row.signal_id,
    symbol: row.symbol || payload.symbol || '',
    market: row.market || payload.market || 'Diğer',
    timeframe: row.timeframe || payload.timeframe || '',
    decision: row.decision || payload.decision || 'BEKLE',
    signalAt: Number(row.signal_at || payload.signalAt) || 0
  });
}

function isTestSignal(record) {
  if (!record) return false;
  const sources = Array.isArray(record.sources) ? record.sources : [record.source];
  const testSource = sources.some(function (source) {
    return /^E2E(?:\b|[\s_-])/i.test(String(source || '').trim());
  });
  return testSource || /^E2E[A-Z0-9]*USDT$/i.test(String(record.symbol || ''));
}

function isPending(record) {
  if (isTestSignal(record)) return false;
  return record.directionStatus === 'pending' ||
    (record.decision === 'AL' && record.tradeStatus === 'pending') ||
    (record.decision === 'SAT' && record.spotStatus !== 'completed' && record.spotStatus !== 'expired') ||
    (record.timeframe === '15m' && record.priceForecast && record.priceForecast.status === 'pending');
}

function isExpired(record) {
  return record.directionStatus === 'expired' ||
    (record.decision === 'AL' && record.tradeStatus === 'expired') ||
    (record.decision === 'SAT' && record.spotStatus === 'expired') ||
    (record.timeframe === '15m' && record.priceForecast && record.priceForecast.status === 'expired');
}

function summarizePending(records) {
  const pending = (records || []).filter(isPending);
  const pendingDataErrors = pending.filter(function (record) { return !!record.lastError; }).length;
  return {
    total: pending.length,
    normal: pending.length - pendingDataErrors,
    dataErrors: pendingDataErrors,
    expired: (records || []).filter(isExpired).length
  };
}

function shouldEvaluate(record, now, options) {
  const step = intervalMs(record.timeframe);
  if (!isPending(record) || !step || !isNumber(record.signalAt) || record.signalAt <= 0) return false;
  if (now < record.signalAt + step) return false;
  const forceRetryError = !!(options && options.forceRetryErrors && record.lastError);
  if (isNumber(record.nextCheckAt) && now < record.nextCheckAt && !forceRetryError) return false;
  return true;
}

function futureBars(record, bars, now) {
  const step = intervalMs(record.timeframe);
  return (Array.isArray(bars) ? bars : []).filter(function (bar) {
    return bar && isNumber(bar.t) && isNumber(bar.o) && isNumber(bar.h) &&
      isNumber(bar.l) && isNumber(bar.c) && bar.t >= record.signalAt &&
      bar.h >= Math.max(bar.o, bar.c) && bar.l <= Math.min(bar.o, bar.c);
  }).sort(function (a, b) { return a.t - b.t; }).filter(function (bar) {
    return bar.t + step <= now;
  });
}

function directionResult(record, bars, now) {
  const future = futureBars(record, bars, now);
  const horizon = Number(record.horizon) || DEFAULT_HORIZON;
  if (future.length < horizon || !(record.price > 0)) return null;
  const sample = future.slice(0, horizon);
  const end = sample[sample.length - 1];
  const highs = sample.map(function (bar) { return bar.h; });
  const lows = sample.map(function (bar) { return bar.l; });
  const forward = (end.c / record.price - 1) * 100;
  const cost = isNumber(record.costPct) ? record.costPct : DEFAULT_COST;
  return {
    status: 'completed',
    forwardPct: forward,
    exitPrice: end.c,
    exitAt: end.t,
    mfePct: (Math.max.apply(null, highs) / record.price - 1) * 100,
    maePct: (Math.min.apply(null, lows) / record.price - 1) * 100,
    classification: forward > cost ? 'up' : forward < -cost ? 'down' : 'flat'
  };
}

function tradeResult(record, bars, now) {
  if (record.decision !== 'AL') return null;
  const future = futureBars(record, bars, now);
  if (!future.length) return null;
  const horizon = Number(record.horizon) || DEFAULT_HORIZON;
  const entryBar = future[0];
  const entry = entryBar.o;
  if (!isNumber(entry) || entry <= 0) return null;

  const hasPlan = isNumber(record.stop) && isNumber(record.target) && record.stop < record.target;
  if (hasPlan) {
    if (entry <= record.stop) {
      return { status: 'skipped', reason: 'Sonraki açılışta stop seviyesi aşılmış; Spot AL yapılmadı.', entry: entry, entryAt: entryBar.t };
    }
    if (entry >= record.target) {
      return { status: 'skipped', reason: 'Sonraki açılışta hedef geçilmiş; Spot AL yapılmadı.', entry: entry, entryAt: entryBar.t };
    }
  }

  const limit = Math.min(future.length, horizon);
  let exit = null;
  let exitIndex = -1;
  let reason = 'Zaman çıkışı';
  for (let i = 0; i < limit; i++) {
    const bar = future[i];
    if (hasPlan) {
      if (bar.o <= record.stop) { exit = bar.o; reason = 'Stop boşluğu'; }
      else if (bar.l <= record.stop) { exit = record.stop; reason = 'Stop'; }
      else if (bar.o >= record.target) { exit = bar.o; reason = 'Hedef boşluğu'; }
      else if (bar.h >= record.target) { exit = record.target; reason = 'Hedef'; }
    }
    if (exit !== null) { exitIndex = i; break; }
  }

  if (exit === null) {
    if (future.length < horizon) return null;
    exitIndex = horizon - 1;
    exit = future[exitIndex].c;
    reason = hasPlan ? '10 mum zaman çıkışı' : '10 mum Spot AL yön testi (işlem planı yok)';
  }

  const sample = future.slice(0, exitIndex + 1);
  const maxHigh = Math.max.apply(null, sample.map(function (bar) { return bar.h; }));
  const minLow = Math.min.apply(null, sample.map(function (bar) { return bar.l; }));
  const gross = (exit - entry) / entry * 100;
  const cost = isNumber(record.costPct) ? record.costPct : DEFAULT_COST;
  const net = gross - cost;
  return {
    status: 'completed',
    reason: reason,
    entry: entry,
    entryAt: entryBar.t,
    exit: exit,
    exitAt: future[exitIndex].t,
    grossPct: gross,
    netPct: net,
    mfePct: (maxHigh - entry) / entry * 100,
    maePct: (minLow - entry) / entry * 100,
    outcome: net > 0 ? 'win' : net < 0 ? 'loss' : 'flat'
  };
}

function spotSaleResult(record, bars, now) {
  if (record.decision !== 'SAT') return null;
  const future = futureBars(record, bars, now);
  const horizon = Number(record.horizon) || DEFAULT_HORIZON;
  if (future.length < horizon || !(record.price > 0)) return null;
  const sample = future.slice(0, horizon);
  const sellBar = sample[0];
  const holdBar = sample[sample.length - 1];
  const sellPrice = sellBar && sellBar.o;
  const holdPrice = holdBar && holdBar.c;
  if (!isNumber(sellPrice) || sellPrice <= 0 || !isNumber(holdPrice) || holdPrice <= 0) return null;
  const saleAdvantage = (sellPrice / holdPrice - 1) * 100;
  const holdReturn = (holdPrice / sellPrice - 1) * 100;
  return {
    status: 'completed',
    mode: 'spot-sell-vs-hold',
    sellPrice: sellPrice,
    sellAt: sellBar.t,
    holdPrice: holdPrice,
    holdAt: holdBar.t,
    saleAdvantagePct: saleAdvantage,
    holdReturnPct: holdReturn,
    signalToHoldPct: (holdPrice / record.price - 1) * 100,
    outcome: saleAdvantage > 0 ? 'sell-better' : saleAdvantage < 0 ? 'hold-better' : 'similar'
  };
}

function evaluateRecord(record, bars, now) {
  return {
    trade: tradeResult(record, bars, now),
    spotSale: spotSaleResult(record, bars, now),
    direction: directionResult(record, bars, now),
    priceForecast: priceForecastModel.degerlendir(record, bars, now)
  };
}

function expiredPatch(record) {
  return {
    tradeStatus: record.decision === 'SAT' ? 'not-applicable'
      : record.decision === 'AL' && record.tradeStatus === 'pending' ? 'expired' : record.tradeStatus,
    tradeResult: record.decision === 'SAT' ? null : record.tradeResult,
    spotStatus: record.decision === 'SAT' && record.spotStatus !== 'completed' ? 'expired' : record.spotStatus,
    directionStatus: record.directionStatus === 'pending' ? 'expired' : record.directionStatus,
    priceForecast: record.priceForecast && record.priceForecast.status === 'pending'
      ? Object.assign({}, record.priceForecast, {
          status: 'expired',
          reason: 'Ücretsiz kaynağın geçmiş aralığı bu tahmini kapsamıyor.'
        }) : record.priceForecast,
    lastError: 'Ücretsiz kaynağın geçmiş aralığı bu sinyali kapsamıyor.'
  };
}

function evaluationPatch(record, bars, now) {
  const step = intervalMs(record.timeframe);
  const evaluated = evaluateRecord(record, bars, now);
  const patch = {
    lastCheckedAt: now,
    nextCheckAt: now + step,
    lastError: null
  };
  if (record.decision === 'SAT') {
    patch.tradeStatus = 'not-applicable';
    patch.tradeResult = null;
  }
  if (evaluated.trade && record.decision === 'AL' && record.tradeStatus === 'pending') {
    patch.tradeStatus = evaluated.trade.status;
    patch.tradeResult = evaluated.trade;
  }
  if (evaluated.spotSale && record.decision === 'SAT' &&
      record.spotStatus !== 'completed' && record.spotStatus !== 'expired') {
    patch.spotStatus = evaluated.spotSale.status;
    patch.spotResult = evaluated.spotSale;
  }
  if (evaluated.direction && record.directionStatus === 'pending') {
    patch.directionStatus = evaluated.direction.status;
    patch.forwardPct = evaluated.direction.forwardPct;
    patch.directionResult = evaluated.direction;
    if (record.decision === 'BEKLE') {
      patch.waitResult = evaluated.direction.classification === 'down' ? 'avoid-down'
        : evaluated.direction.classification === 'up' ? 'missed-up' : 'flat';
    }
  }
  if (evaluated.priceForecast) patch.priceForecast = evaluated.priceForecast;
  return patch;
}

function groupPending(records, now, options) {
  const groups = Object.create(null);
  (records || []).forEach(function (record) {
    if (!shouldEvaluate(record, now, options)) return;
    const key = record.market + '|' + record.symbol + '|' + record.timeframe;
    if (!groups[key]) groups[key] = {
      market: record.market, symbol: record.symbol, timeframe: record.timeframe, records: []
    };
    groups[key].records.push(record);
  });
  return Object.keys(groups).map(function (key) { return groups[key]; });
}

function safeError(error) {
  return String(error && error.message ? error.message : error || 'Veri kaynağına erişilemedi.')
    .replace(/https?:\/\/\S+/gi, '[veri kaynağı]')
    .replace(/\b(?:Bearer|apikey)\s+\S+/gi, '[gizli bilgi]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 350);
}

function normalizeFailureReason(message) {
  return String(message || '')
    .replace(/Invalid currency pair [A-Z0-9_]+/gi, 'Invalid currency pair [pair]')
    .replace(/symbol(?:=|\s+)[A-Z0-9_]+/gi, 'symbol [symbol]')
    .slice(0, 350);
}

async function fetchText(url, headers, timeoutMs, method, body) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs || 15000);
  try {
    const response = await fetch(url, {
      method: method || 'GET',
      headers: headers || {},
      body: body,
      cache: 'no-store',
      signal: controller.signal
    });
    const text = await response.text();
    return { response: response, text: text };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, headers, timeoutMs, method, body) {
  const result = await fetchText(url, headers, timeoutMs, method, body);
  if (!result.response.ok) {
    throw new Error('HTTP ' + result.response.status + ': ' + String(result.text || '').slice(0, 180));
  }
  let data;
  try { data = result.text ? JSON.parse(result.text) : null; }
  catch (error) { throw new Error('JSON yanıtı okunamadı.'); }
  return { data: data, response: result.response };
}

function supabaseHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

async function readAllSignals() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = [];
  let offset = 0;
  while (true) {
    const url = new URL(SUPABASE_URL + '/rest/v1/agent_signals_shared');
    url.searchParams.set('select', 'signal_id,symbol,market,timeframe,decision,signal_at,payload,created_at,updated_at');
    url.searchParams.set('created_at', 'gte.' + cutoff);
    url.searchParams.set('symbol', 'not.like.E2E*');
    url.searchParams.set('order', 'signal_at.asc');
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));
    let result;
    try {
      result = await fetchJson(url.toString(), supabaseHeaders(), 20000);
    } catch (error) {
      if (/HTTP 416|Requested range not satisfiable/i.test(error.message)) break;
      throw error;
    }
    const page = Array.isArray(result.data) ? result.data : [];
    rows.push.apply(rows, page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function normalizeBybitBars(rows) {
  return (Array.isArray(rows) ? rows : []).map(function (row) {
    return {
      t: Number(row[0]), o: Number(row[1]), h: Number(row[2]),
      l: Number(row[3]), c: Number(row[4])
    };
  }).filter(function (bar) {
    return isNumber(bar.t) && isNumber(bar.o) && isNumber(bar.h) &&
      isNumber(bar.l) && isNumber(bar.c);
  }).sort(function (a, b) { return a.t - b.t; });
}

function normalizeGateBars(rows) {
  return (Array.isArray(rows) ? rows : []).map(function (row) {
    return {
      t: Number(row[0]) * 1000,
      o: Number(row[5]),
      h: Number(row[3]),
      l: Number(row[4]),
      c: Number(row[2])
    };
  }).filter(function (bar) {
    return isNumber(bar.t) && isNumber(bar.o) && isNumber(bar.h) &&
      isNumber(bar.l) && isNumber(bar.c);
  }).sort(function (a, b) { return a.t - b.t; });
}

async function fetchBybitBars(symbol, timeframe) {
  const intervals = { '15m': '15', '1h': '60', '4h': '240', '1d': 'D' };
  const interval = intervals[timeframe];
  if (!interval) throw new Error('Bybit bu zaman dilimini desteklemiyor: ' + timeframe);
  const url = 'https://api.bybit.com/v5/market/kline?category=spot&symbol=' +
    encodeURIComponent(symbol) + '&interval=' + interval + '&limit=1000';
  const result = await fetchJson(url, { Accept: 'application/json' }, 18000);
  const payload = result.data || {};
  if (Number(payload.retCode) !== 0) {
    throw new Error('Bybit API ' + String(payload.retCode) + ': ' +
      String(payload.retMsg || 'Piyasa verisi alınamadı.'));
  }
  const bars = normalizeBybitBars(payload.result && payload.result.list);
  if (bars.length < 80) throw new Error('Yeterli Bybit geçmiş verisi yok.');
  return bars;
}

async function fetchGateBars(symbol, timeframe) {
  const intervals = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
  const interval = intervals[timeframe];
  if (!interval) throw new Error('Gate.io bu zaman dilimini desteklemiyor: ' + timeframe);
  const base = String(symbol).replace(/USDT$/i, '');
  const pair = base + '_USDT';
  const url = 'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=' +
    encodeURIComponent(pair) + '&interval=' + interval + '&limit=1000';
  const result = await fetchJson(url, { Accept: 'application/json' }, 18000);
  if (!Array.isArray(result.data)) throw new Error('Gate.io mum yanıtı geçersiz.');
  const bars = normalizeGateBars(result.data);
  if (bars.length < 80) throw new Error('Yeterli Gate.io geçmiş verisi yok.');
  return bars;
}

async function fetchCryptoBars(symbol, timeframe) {
  const errors = [];
  try {
    return await fetchGateBars(symbol, timeframe);
  } catch (error) {
    errors.push('Gate.io: ' + safeError(error));
  }
  try {
    return await fetchBybitBars(symbol, timeframe);
  } catch (error) {
    errors.push('Bybit: ' + safeError(error));
  }
  throw new Error('Kripto veri kaynakları yanıt vermedi. ' + errors.join(' | '));
}

async function fetchYahooBars(symbol, timeframe) {
  const ranges = {
    '15m': ['15m', '30d'],
    '1h': ['60m', '3mo'],
    '1d': ['1d', '2y']
  };
  const range = ranges[timeframe];
  if (!range) throw new Error('Yahoo Finance bu zaman dilimini desteklemiyor: ' + timeframe);
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=' + range[0] + '&range=' + range[1];
  const result = await fetchJson(url, {
    Accept: 'application/json',
    'User-Agent': 'GrapAI-Pending-Results-Worker/1.0'
  }, 18000);
  const chart = result.data && result.data.chart && result.data.chart.result &&
    result.data.chart.result[0];
  const quote = chart && chart.indicators && chart.indicators.quote &&
    chart.indicators.quote[0];
  if (!chart || !Array.isArray(chart.timestamp) || !quote) {
    throw new Error('Yahoo Finance geçmiş verisi bulunamadı.');
  }
  const bars = [];
  chart.timestamp.forEach(function (timestamp, index) {
    const o = quote.open && quote.open[index];
    const h = quote.high && quote.high[index];
    const l = quote.low && quote.low[index];
    const c = quote.close && quote.close[index];
    if (o != null && h != null && l != null && c != null) {
      bars.push({
        t: Number(timestamp) * 1000,
        o: Number(o), h: Number(h), l: Number(l), c: Number(c)
      });
    }
  });
  if (bars.length < 80) throw new Error('Yeterli Yahoo Finance geçmiş verisi yok.');
  return bars;
}

async function fetchGroupBars(group) {
  if (group.market === 'Kripto' || /USDT$/i.test(group.symbol)) {
    return fetchCryptoBars(group.symbol, group.timeframe);
  }
  if (group.market === 'BIST' && group.timeframe !== '1d') {
    throw new Error('BIST geçmiş verisi yalnızca günlük periyotta destekleniyor.');
  }
  if (group.timeframe === '4h') {
    throw new Error('4 saatlik geçmiş yalnızca Binance kripto varlıklarında destekleniyor.');
  }
  return fetchYahooBars(group.symbol, group.timeframe);
}

async function writePatches(patches) {
  for (let index = 0; index < patches.length; index += PATCH_SIZE) {
    const batch = patches.slice(index, index + PATCH_SIZE).map(function (item) {
      return { signal_id: String(item.id), patch: item.patch };
    });
    await fetchJson(SUPABASE_URL + '/rest/v1/rpc/grap_ai_shared_signals_worker_patch',
      supabaseHeaders(), 20000, 'POST', JSON.stringify({ p_patches: batch }));
  }
}

async function processGroup(group, stats) {
  let bars;
  try {
    bars = await fetchGroupBars(group);
  } catch (error) {
    const retryAt = Date.now() + RETRY_ERROR_MS;
    const message = safeError(error);
    const reason = normalizeFailureReason(message);
    const patches = group.records.map(function (record) {
      return {
        id: record.id,
        patch: {
          lastCheckedAt: Date.now(),
          nextCheckAt: retryAt,
          lastError: message
        }
      };
    });
    await writePatches(patches);
    stats.failedGroups += 1;
    stats.dataErrorRecords += patches.length;
    stats.updatedRecords += patches.length;
    const failureKey = group.market + '|' + group.timeframe + '|' + reason;
    const failure = stats.failureReasons[failureKey] || {
      market: group.market,
      timeframe: group.timeframe,
      reason: reason,
      groups: 0,
      records: 0,
      sampleSymbols: []
    };
    failure.groups += 1;
    failure.records += patches.length;
    if (failure.sampleSymbols.length < 5 && failure.sampleSymbols.indexOf(group.symbol) < 0) {
      failure.sampleSymbols.push(group.symbol);
    }
    stats.failureReasons[failureKey] = failure;
    return;
  }

  const now = Date.now();
  const step = intervalMs(group.timeframe);
  const closedBars = bars.filter(function (bar) { return bar.t + step <= now; })
    .sort(function (a, b) { return a.t - b.t; });
  const first = closedBars.length ? closedBars[0].t : null;
  const patches = [];
  group.records.forEach(function (record) {
    if (first && record.signalAt < first - step * 2) {
      patches.push({ id: record.id, patch: expiredPatch(record) });
      stats.expiredRecords += 1;
      return;
    }
    const patch = evaluationPatch(record, bars, now);
    patches.push({ id: record.id, patch: patch });
    if (patch.directionStatus === 'completed' ||
        patch.tradeStatus === 'completed' || patch.tradeStatus === 'skipped' ||
        patch.spotStatus === 'completed' ||
        (patch.priceForecast && patch.priceForecast.status === 'completed')) {
      stats.completedRecords += 1;
    }
    if (patch.lastError) stats.dataErrorRecords += 1;
    else stats.checkedRecords += 1;
  });
  await writePatches(patches);
  stats.updatedRecords += patches.length;
}

async function runWorker(records, now, options) {
  const groups = groupPending(records, now, options);
  const stats = {
    groups: groups.length,
    failedGroups: 0,
    checkedRecords: 0,
    completedRecords: 0,
    expiredRecords: 0,
    dataErrorRecords: 0,
    updatedRecords: 0,
    failureReasons: Object.create(null)
  };
  let index = 0;
  async function worker() {
    while (index < groups.length) {
      const group = groups[index++];
      await processGroup(group, stats);
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, groups.length); i++) workers.push(worker());
  await Promise.all(workers);
  return stats;
}

async function main() {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY GitHub Actions secret olarak tanımlanmamış.');
  const rows = await readAllSignals();
  const records = rows.map(recordFromRow);
  const pending = summarizePending(records);
  const forceRetryErrors = process.env.RETRY_DATA_ERRORS === 'true';
  const stats = await runWorker(records, Date.now(), { forceRetryErrors: forceRetryErrors });
  const failureBreakdown = Object.keys(stats.failureReasons).map(function (key) {
    return stats.failureReasons[key];
  }).sort(function (a, b) {
    return b.records - a.records;
  });
  console.log('Grap-AI arka plan sonuç değerlendirmesi tamamlandı: ' +
    JSON.stringify({
      scanned: rows.length,
      pendingBefore: pending.total,
      normalPendingBefore: pending.normal,
      dataErrorsBefore: pending.dataErrors,
      expiredBefore: pending.expired,
      forceRetryErrors: forceRetryErrors,
      groups: stats.groups,
      updated: stats.updatedRecords,
      newlyCompleted: stats.completedRecords,
      expiredNow: stats.expiredRecords,
      dataErrorRecords: stats.dataErrorRecords,
      failedGroups: stats.failedGroups,
      failureBreakdown: failureBreakdown
    }));
}

if (require.main === module) {
  main().catch(function (error) {
    console.error('Grap-AI arka plan sonuç ajanı başarısız:', safeError(error));
    process.exitCode = 1;
  });
}

module.exports = {
  intervalMs: intervalMs,
  recordFromRow: recordFromRow,
  isPending: isPending,
  isTestSignal: isTestSignal,
  isExpired: isExpired,
  summarizePending: summarizePending,
  shouldEvaluate: shouldEvaluate,
  futureBars: futureBars,
  directionResult: directionResult,
  tradeResult: tradeResult,
  spotSaleResult: spotSaleResult,
  evaluateRecord: evaluateRecord,
  expiredPatch: expiredPatch,
  evaluationPatch: evaluationPatch,
  priceForecastResult: priceForecastModel.degerlendir,
  groupPending: groupPending,
  normalizeBybitBars: normalizeBybitBars,
  normalizeGateBars: normalizeGateBars,
  fetchBybitBars: fetchBybitBars,
  fetchGateBars: fetchGateBars,
  safeError: safeError
};
