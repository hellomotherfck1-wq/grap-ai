'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qkkhguyngmsddnkunyws.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPOSITORY = process.env.GITHUB_REPOSITORY || 'hellomotherfck1-wq/grap-ai';
const NOW = new Date();

function isoAgo(hours) {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function turkeyDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(NOW);
  const values = {};
  parts.forEach(function (part) { values[part.type] = part.value; });
  return values.year + '-' + values.month + '-' + values.day;
}

function addCheck(checks, name, status, detail) {
  checks.push({ name: name, status: status, detail: String(detail || '').slice(0, 500) });
}

function runNode(args, timeout) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT, encoding: 'utf8', timeout: timeout || 90000, maxBuffer: 4 * 1024 * 1024
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return {
    ok: result.status === 0,
    detail: (result.error ? result.error.message + ' ' : '') +
      (output || (result.status === 0 ? 'Kontrol başarılı.' : 'Komut başarısız.')).slice(-450)
  };
}

async function fetchText(url, headers, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeout || 12000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers || {},
      cache: 'no-store',
      signal: controller.signal
    });
    const text = await response.text();
    return { response: response, text: text };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, headers, timeout) {
  const result = await fetchText(url, headers, timeout);
  let data;
  try { data = result.text ? JSON.parse(result.text) : null; }
  catch (error) { throw new Error('JSON yanıtı okunamadı: ' + error.message); }
  if (!result.response.ok) {
    throw new Error('HTTP ' + result.response.status + ': ' + String(result.text || '').slice(0, 180));
  }
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

async function supabaseRows(table, filters, maxRows) {
  const rows = [];
  const pageSize = 1000;
  const requestedMax = Number(maxRows);
  const totalLimit = Number.isFinite(requestedMax) && requestedMax > 0
    ? Math.floor(requestedMax) : 5000;

  for (let offset = 0; offset < totalLimit; offset += pageSize) {
    const url = new URL(SUPABASE_URL + '/rest/v1/' + table);
    Object.keys(filters || {}).forEach(function (key) {
      url.searchParams.set(key, filters[key]);
    });

    const count = Math.min(pageSize, totalLimit - offset);
    if (count <= 0) break;

    // Use PostgREST's query pagination consistently. Combining Range headers
    // with a limit query parameter can produce PGRST103 on some deployments.
    url.searchParams.set('limit', String(count));
    url.searchParams.set('offset', String(offset));

    let result;
    try {
      result = await fetchJson(url.toString(), supabaseHeaders(), 15000);
    } catch (error) {
      // An out-of-range page means there are no more rows to read.
      if (/HTTP 416|Requested range not satisfiable/i.test(error.message)) break;
      throw error;
    }

    const page = Array.isArray(result.data) ? result.data : [];
    rows.push.apply(rows, page);
    if (page.length < count) break;
  }
  return rows;
}

function safeText(value) {
  return String(value || 'Bilinmeyen hata')
    .replace(/https?:\/\/\S+/gi, '[adres]')
    .replace(/\b(?:Bearer|apikey)\s+\S+/gi, '[gizli bilgi]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 450);
}

function groupErrors(events, signals, recentErrorSignals) {
  const softwareGroups = new Map();
  const analysisGroups = new Map();

  function addSoftware(type, source, message, date, severity) {
    const clean = safeText(message);
    const sourceLabel = safeText(source || 'Uygulama');
    // Include the source (especially the asset symbol) in the key so that
    // identical messages from different coins are never merged together.
    const key = type + '|' + sourceLabel + '|' + clean;
    const current = softwareGroups.get(key) || {
      category: 'software',
      severity: severity || 'warning',
      title: clean,
      source: sourceLabel,
      count: 0,
      lastSeen: date || null,
      explanation: '',
      action: ''
    };
    current.count += 1;
    if (date && (!current.lastSeen || date > current.lastSeen)) current.lastSeen = date;
    softwareGroups.set(key, current);
  }

  function levelRank(level) {
    const value = String(level || '').toLocaleLowerCase('tr-TR');
    if (value.indexOf('yüksek') >= 0 || value.indexOf('high') >= 0) return 3;
    if (value.indexOf('orta') >= 0 || value.indexOf('medium') >= 0) return 2;
    if (value.indexOf('düşük') >= 0 || value.indexOf('low') >= 0) return 1;
    return 0;
  }

  (events || []).forEach(function (event) {
    const type = event.event_type || 'js_error';
    const message = event.message || 'Tarayıcı hatası';
    const source = event.source || 'Bilinmeyen kaynak';
    const severity = type === 'js_error' ? 'warning' : 'info';
    addSoftware(type, source, message, event.created_at, severity);
  });

  (signals || []).forEach(function (row) {
    const payload = row.payload || {};
    const symbol = row.symbol || payload.symbol || 'Bilinmeyen varlık';
    const market = row.market || payload.market || '';
    const source = market ? String(symbol) + ' · ' + String(market) : symbol;
    const date = row.updated_at || row.created_at;

    const auditorLevel = String(payload.auditorError || '').trim();
    const warningCount = Math.max(0, Math.floor(Number(payload.auditorWarningCount) || 0));
    if ((auditorLevel && levelRank(auditorLevel) > 1) || warningCount > 0) {
      const key = String(source);
      const current = analysisGroups.get(key) || {
        category: 'analysis',
        severity: 'warning',
        source: safeText(source),
        symbol: safeText(symbol),
        count: 0,
        warningCount: 0,
        level: '',
        levelRank: 0,
        lastSeen: date || null
      };
      current.count += 1;
      current.warningCount += warningCount;
      if (levelRank(auditorLevel) > current.levelRank) {
        current.level = auditorLevel;
        current.levelRank = levelRank(auditorLevel);
      }
      if (date && (!current.lastSeen || date > current.lastSeen)) current.lastSeen = date;
      analysisGroups.set(key, current);
    }
  });

  const softwareFindings = Array.from(softwareGroups.values()).sort(function (a, b) {
    return b.count - a.count;
  });

  softwareFindings.forEach(function (item) {
    if (item.count >= 5) item.severity = 'critical';
    if (item.title.toLowerCase().indexOf('http 429') >= 0) {
      item.explanation = 'Veri sağlayıcı istek sınırına takılmış olabilir.';
      item.action = 'İstek sıklığını azalt ve kısa süre sonra yeniden kontrol et.';
    } else if (item.title.toLowerCase().indexOf('failed to fetch') >= 0 ||
               item.title.toLowerCase().indexOf('network') >= 0) {
      item.explanation = 'Tarayıcı ile veri kaynağı arasında bağlantı kurulamamış.';
      item.action = 'Kaynağın erişilebilirliğini ve internet bağlantısını kontrol et.';
    } else if (item.title.toLowerCase().indexOf('http 5') >= 0) {
      item.explanation = 'Uzak servis geçici bir sunucu hatası döndürmüş.';
      item.action = 'Servis durumunu tekrar kontrol et; sürekli tekrarlarsa sağlayıcıyı incele.';
    } else if (item.title.toLowerCase().indexOf('http 4') >= 0) {
      item.explanation = 'Uzak servis isteği kabul etmemiş; uç nokta veya istek sınırları değişmiş olabilir.';
      item.action = 'İlgili veri kaynağının güncel API yanıtını incele.';
    } else {
      item.explanation = item.count > 1
        ? 'Aynı yazılım/veri kaynağı hatası bu kaynakta ' + item.count + ' kez kaydedilmiş.'
        : 'Tek seferlik bir uygulama veya veri kaynağı hatası kaydedilmiş.';
      item.action = 'Önce belirtilen kaynağı incele; tekrarlıyorsa ilgili modülün kayıtlarını kontrol et.';
    }
  });

  (recentErrorSignals || signals || []).forEach(function (row) {
    const payload = row.payload || {};
    if (!payload.lastError) return;
    const symbol = row.symbol || payload.symbol || 'Bilinmeyen varlık';
    const market = row.market || payload.market || '';
    const timeframe = row.timeframe || payload.timeframe || '';
    const source = String(symbol) + (market ? ' · ' + String(market) : '') +
      (timeframe ? ' · ' + String(timeframe) : '');
    addSoftware('signal_error', source, payload.lastError,
      row.updated_at || row.created_at, 'warning');
  });

  const analysisFindings = Array.from(analysisGroups.values()).map(function (item) {
    item.title = item.level
      ? 'Denetçi değerlendirmesi: ' + item.level
      : 'Denetçi uyarısı';
    item.explanation = 'Bu varlıkta ' + item.count + ' sinyal denetçi uyarısı taşıyor' +
      (item.warningCount ? ' (' + item.warningCount + ' uyarı maddesi)' : '') +
      '. Bu bir analiz kalite/risk uyarısıdır; yazılım arızası değildir.';
    item.action = 'Sinyal ayrıntısındaki denetçi maddelerini incele; yalnızca bu uyarıya bakarak AL/SAT kararı verme.';
    delete item.levelRank;
    return item;
  }).sort(function (a, b) {
    return (b.warningCount + b.count) - (a.warningCount + a.count);
  });

  return {
    softwareFindings: softwareFindings,
    analysisFindings: analysisFindings,
    findings: softwareFindings.concat(analysisFindings)
  };
}
function summarizeResults(rows) {
  const decisions = { AL: 0, SAT: 0, BEKLE: 0 };
  const completed = [];
  const pending = [];
  const expired = [];
  const signalErrors = [];
  let alWins = 0, alLosses = 0, alFlat = 0;
  let satSellBetter = 0, satHoldBetter = 0, satSimilar = 0;
  let waitAvoidDown = 0, waitMissedUp = 0;
  let auditorErrorSignals = 0, auditorWarningCount = 0;

  function intervalMs(timeframe) {
    return ({
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    })[timeframe] || 0;
  }

  (rows || []).forEach(function (row) {
    const payload = row.payload || {};
    const decision = row.decision || payload.decision || 'BEKLE';
    if (Object.prototype.hasOwnProperty.call(decisions, decision)) decisions[decision] += 1;

    if (payload.directionStatus === 'completed' &&
        payload.forwardPct !== null && payload.forwardPct !== undefined &&
        Number.isFinite(Number(payload.forwardPct))) {
      completed.push({
        row: row,
        payload: payload,
        decision: decision,
        forwardPct: Number(payload.forwardPct),
        costPct: Number.isFinite(Number(payload.costPct)) ? Number(payload.costPct) : 0,
        signalAt: Number(row.signal_at || payload.signalAt),
        timeframe: row.timeframe || payload.timeframe || ''
      });
    } else if (payload.directionStatus === 'expired' || payload.tradeStatus === 'expired' ||
               payload.spotStatus === 'expired') {
      expired.push(row);
    } else {
      pending.push(row);
    }

    if (payload.lastError) signalErrors.push(row);
    if (payload.auditorError && payload.auditorError !== 'Düşük') auditorErrorSignals += 1;
    auditorWarningCount += Math.max(0, Number(payload.auditorWarningCount) || 0);
    if (payload.tradeResult && payload.tradeResult.outcome === 'win') alWins += 1;
    if (payload.tradeResult && payload.tradeResult.outcome === 'loss') alLosses += 1;
    if (payload.tradeResult && payload.tradeResult.outcome === 'flat') alFlat += 1;
    if (payload.spotResult && payload.spotResult.outcome === 'sell-better') satSellBetter += 1;
    if (payload.spotResult && payload.spotResult.outcome === 'hold-better') satHoldBetter += 1;
    if (payload.spotResult && payload.spotResult.outcome === 'similar') satSimilar += 1;
    if (payload.waitResult === 'avoid-down') waitAvoidDown += 1;
    if (payload.waitResult === 'missed-up') waitMissedUp += 1;
  });

  const directionalCalls = completed.filter(function (item) {
    return item.decision === 'AL' || item.decision === 'SAT';
  }).sort(function (a, b) {
    return a.signalAt - b.signalAt;
  });
  const lastEndByAsset = Object.create(null);
  const independent = [];
  let overlapExcluded = 0;
  let unknownHorizon = 0;

  directionalCalls.forEach(function (item) {
    const exitAt = Number(item.payload.directionResult && item.payload.directionResult.exitAt);
    const step = intervalMs(item.timeframe);
    const signalAt = item.signalAt;
    if (!Number.isFinite(exitAt) || !step || !Number.isFinite(signalAt) || exitAt < signalAt) {
      unknownHorizon += 1;
      return;
    }
    const assetKey = String(item.row.symbol || item.payload.symbol || '') + '|' + item.timeframe;
    const previousEnd = lastEndByAsset[assetKey];
    if (Number.isFinite(previousEnd) && signalAt < previousEnd) {
      overlapExcluded += 1;
      return;
    }
    independent.push(item);
    lastEndByAsset[assetKey] = exitAt + step;
  });

  let correct = 0, wrong = 0, flat = 0;
  independent.forEach(function (item) {
    if (Math.abs(item.forwardPct) <= item.costPct) flat += 1;
    else if ((item.decision === 'AL' && item.forwardPct > 0) ||
             (item.decision === 'SAT' && item.forwardPct < 0)) correct += 1;
    else wrong += 1;
  });

  const directionalCount = correct + wrong;
  return {
    windowDays: 30,
    totalSignals: (rows || []).length,
    decisions: decisions,
    completedDirection: completed.length,
    pending: pending.length,
    expired: expired.length,
    signalErrors: signalErrors.length,
    auditorErrorSignals: auditorErrorSignals,
    auditorWarningCount: auditorWarningCount,
    waitResults: { avoidDown: waitAvoidDown, missedUp: waitMissedUp },
    directional: {
      sampleCount: directionalCount,
      independentCount: independent.length,
      correct: correct,
      wrong: wrong,
      flat: flat,
      overlapExcluded: overlapExcluded,
      unknownHorizon: unknownHorizon,
      rate: directionalCount ? correct / directionalCount * 100 : null,
      reliable: directionalCount >= 30
    },
    spotAL: { wins: alWins, losses: alLosses, flat: alFlat },
    spotSAT: {
      sellBetter: satSellBetter,
      holdBetter: satHoldBetter,
      similar: satSimilar
    },
    caution: 'Bu değerler geçmiş sinyal yönü ve simülasyon özetidir; gerçek portföy getirisi veya yatırım tavsiyesi değildir.'
  };
}
async function checkExternalApis(checks) {
  const binanceHosts = [
    'https://data-api.binance.vision/api/v3/ping',
    'https://api.binance.com/api/v3/ping'
  ];
  const binanceResults = [];
  for (const url of binanceHosts) {
    try {
      const result = await fetchJson(url, { Accept: 'application/json' }, 10000);
      if (result.response.ok) binanceResults.push(new URL(url).hostname);
    } catch (error) {}
  }
  addCheck(checks, 'Binance Spot veri kaynağı',
    binanceResults.length ? 'ok' : 'warning',
    binanceResults.length
      ? 'Erişilebilen uç noktalar: ' + binanceResults.join(', ')
      : 'Binance Spot ping uç noktalarına erişilemedi.');

  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS?range=1d&interval=1d';
    const result = await fetchJson(url, { Accept: 'application/json', 'User-Agent': 'GrapAI-Daily-Agent/1.0' }, 12000);
    const chart = result.data && result.data.chart && result.data.chart.result;
    const count = chart && chart[0] && Array.isArray(chart[0].timestamp) ? chart[0].timestamp.length : 0;
    addCheck(checks, 'Yahoo Finance / BIST fiyat verisi', count ? 'ok' : 'warning',
      count ? 'THYAO.IS için ' + count + ' fiyat zaman damgası alındı.' : 'Yahoo Finance yanıt verdi ancak fiyat mumu bulunamadı.');
  } catch (error) {
    addCheck(checks, 'Yahoo Finance / BIST fiyat verisi', 'warning', error.message);
  }
}

async function checkGithubActions(checks) {
  if (!GITHUB_TOKEN) {
    addCheck(checks, 'GitHub tarayıcı testleri', 'info', 'GITHUB_TOKEN verilmedi; bu kontrol atlandı.');
    return;
  }
  try {
    const url = 'https://api.github.com/repos/' + REPOSITORY + '/actions/workflows/live-e2e.yml/runs?branch=main&per_page=10';
    const result = await fetchJson(url, {
      Authorization: 'Bearer ' + GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, 12000);
    const runs = result.data && Array.isArray(result.data.workflow_runs) ? result.data.workflow_runs : [];
    const latest = runs.find(function (run) { return run.status === 'completed'; });
    if (!latest) {
      addCheck(checks, 'GitHub tarayıcı testleri', 'warning', 'Tamamlanmış bir canlı test çalıştırması bulunamadı.');
      return;
    }
    const ageHours = (NOW.getTime() - Date.parse(latest.updated_at || latest.created_at)) / 3600000;
    const ok = latest.conclusion === 'success' && ageHours <= 48;
    addCheck(checks, 'GitHub tarayıcı testleri', ok ? 'ok' : 'warning',
      'Son tamamlanan test: ' + latest.conclusion + ' · ' +
      new Date(latest.updated_at || latest.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) +
      (ageHours > 48 ? ' · 48 saatten eski' : ''));
  } catch (error) {
    addCheck(checks, 'GitHub tarayıcı testleri', 'warning', error.message);
  }
}


async function main() {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY GitHub secret olarak tanımlanmamış.');
  const checks = [];
  const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(function (file) { return file.endsWith('.js'); });
  const syntaxFailures = [];
  jsFiles.forEach(function (file) {
    const result = runNode(['--check', path.join('js', file)], 30000);
    if (!result.ok) syntaxFailures.push(file + ': ' + result.detail);
  });
  addCheck(checks, 'JavaScript sözdizimi', syntaxFailures.length ? 'critical' : 'ok',
    syntaxFailures.length ? syntaxFailures.slice(0, 3).join(' | ') : jsFiles.length + ' dosya kontrol edildi.');

  const testFiles = [
    '.github/tests/crypto-agent-smoke.cjs',
    '.github/tests/shared-results-smoke.cjs',
    '.github/tests/admin-agent-smoke.cjs'
  ];
  testFiles.forEach(function (file) {
    const result = runNode([file], 90000);
    addCheck(checks, path.basename(file), result.ok ? 'ok' : 'critical', result.detail);
  });

  await checkExternalApis(checks);
  await checkGithubActions(checks);

  let events = [];
  let signals = [];
  let browserErrors = [];
  try {
    events = await supabaseRows('events', {
      select: 'event_type,created_at',
      created_at: 'gte.' + isoAgo(24 * 7),
      order: 'created_at.desc'
    }, 5000);
    addCheck(checks, 'Supabase kullanım kayıtları', 'ok', 'Son 7 günden ' + events.length + ' kayıt okundu.');
  } catch (error) {
    addCheck(checks, 'Supabase kullanım kayıtları', 'critical', error.message);
  }

  try {
    signals = await supabaseRows('agent_signals_shared', {
      select: 'signal_id,symbol,market,timeframe,decision,signal_at,payload,created_at,updated_at',
      created_at: 'gte.' + isoAgo(24 * 30),
      order: 'signal_at.desc'
    }, 5000);
    addCheck(checks, 'Supabase ortak sonuç havuzu', 'ok', 'Son 30 günden ' + signals.length + ' sinyal okundu.');
  } catch (error) {
    addCheck(checks, 'Supabase ortak sonuç havuzu', 'critical', error.message);
  }

  try {
    browserErrors = (await supabaseRows('admin_system_events', {
      select: 'event_type,source,message,details,created_at',
      created_at: 'gte.' + isoAgo(24),
      order: 'created_at.desc'
    }, 1000)).filter(function (event) {
      // Older monitor versions logged every failed fallback attempt. Only keep
      // API events explicitly marked as a final application-level failure.
      return event.event_type !== 'api_error' ||
        !!(event.details && event.details.final === true);
    });
    addCheck(checks, 'Tarayıcı hata kayıtları', 'ok', 'Son 24 saatte ' + browserErrors.length + ' hata olayı bulundu.');
  } catch (error) {
    addCheck(checks, 'Tarayıcı hata kayıtları', 'warning', error.message);
  }

  const recentSignalErrors = signals.filter(function (row) {
    const payload = row.payload || {};
    const stamp = Date.parse(row.updated_at || row.created_at || '');
    return !!payload.lastError && Number.isFinite(stamp) &&
      stamp >= NOW.getTime() - 24 * 60 * 60 * 1000;
  });
  const findings = groupErrors(browserErrors, signals, recentSignalErrors);
  const results = summarizeResults(signals);
  const visits = events.filter(function (event) { return event.event_type === 'visit'; }).length;
  const analyses = events.filter(function (event) { return event.event_type === 'analiz'; }).length;
  // Findings are deduplicated by error type + source + message. Keep the
  // raw occurrence count separately so repeated events do not look like
  // hundreds of different software defects.
  const softwareErrorTotal = findings.softwareFindings.length;
  const softwareErrorOccurrences = browserErrors.length + recentSignalErrors.length;
  // Count each affected signal once even when it has both a medium/high level
  // and multiple auditor warning items.
  const analysisWarningTotal = signals.filter(function (row) {
    const payload = row.payload || {};
    const level = String(payload.auditorError || '').trim();
    return (level && level !== 'Düşük') || Number(payload.auditorWarningCount) > 0;
  }).length;
  const issueTotal = softwareErrorTotal + analysisWarningTotal;
  const criticalChecks = checks.filter(function (check) { return check.status === 'critical'; });
  const warningChecks = checks.filter(function (check) { return check.status === 'warning'; });
  const status = criticalChecks.length ? 'critical'
    : (warningChecks.length || issueTotal ? 'warning' : 'ok');

  let summary;
  if (status === 'critical') {
    summary = 'Günlük kontrolde ' + criticalChecks.length + ' kritik sistem kontrolü başarısız. Önce başarısız testler ve bağlantılar incelenmeli.';
  } else if (status === 'warning') {
    summary = 'Sistem kontrolleri tamamlandı; ' + softwareErrorTotal +
      ' farklı yazılım/API hata grubu (' + softwareErrorOccurrences +
      ' kayıt) ve ' + analysisWarningTotal +
      ' sinyalde analiz/denetçi uyarısı ayrı olarak raporlandı.';
  } else {
    summary = 'Günlük sistem kontrolü temiz. Kritik bağlantı veya test hatası görülmedi.';
  }

  const commentary = [];
  if (results.totalSignals === 0) {
    commentary.push('Son 30 günde ortak havuzda sinyal yok; sonuç performansı için henüz veri oluşmamış.');
  } else {
    commentary.push('Son 30 günde ' + results.totalSignals + ' sinyal var; AL ' +
      results.decisions.AL + ', SAT ' + results.decisions.SAT + ', BEKLE ' + results.decisions.BEKLE + '.');
  }
  if (results.directional.reliable) {
    commentary.push('Yön ölçümünde ' + results.directional.sampleCount + ' tamamlanmış örnekle yaklaşık %' +
      results.directional.rate.toFixed(1).replace('.', ',') + ' isabet görüldü; bu gerçek portföy getirisi değildir.');
  } else {
    commentary.push('Yön başarısı için 30 bağımsız örnek eşiği henüz karşılanmadı; oran güvenilir başarı olarak sunulmuyor.');
  }
  if (results.pending) commentary.push(results.pending + ' sinyalin değerlendirmesi bekliyor.');
  if (softwareErrorTotal) {
    commentary.push(softwareErrorTotal + ' farklı yazılım/API hata grubu var; tekrarlarla birlikte ' +
      softwareErrorOccurrences + ' kayıt oluşmuş. Başarısız yedek kaynak denemeleri artık hata sayılmıyor.');
  }
  if (analysisWarningTotal) {
    commentary.push(analysisWarningTotal + ' sinyalde denetçi uyarısı var; bunlar yazılım arızalarından ayrı analiz riski olarak gösteriliyor.');
  }
  if (!issueTotal) commentary.push('Son 24 saatte yazılım veya analiz uyarısı kaydedilmedi.');

  const report = {
    report_date: turkeyDate(),
    status: status,
    summary: summary,
    checked_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    details: {
      agent: 'Grap-AI Günlük Sistem Ajanı',
      agentMode: 'Kural tabanlı otomatik teşhis ve yorum',
      timezone: 'Europe/Istanbul',
      checks: checks,
      errors: {
        total: softwareErrorTotal,
        softwareTotal: softwareErrorTotal,
        softwareOccurrences: softwareErrorOccurrences,
        analysisWarningTotal: analysisWarningTotal,
        browser: browserErrors.length,
        signal: recentSignalErrors.length,
        auditor: results.auditorErrorSignals,
        auditorWarnings: results.auditorWarningCount,
        findings: findings.findings,
        softwareFindings: findings.softwareFindings,
        analysisFindings: findings.analysisFindings
      },
      results: results,
      activity: { windowDays: 7, visits: visits, analyses: analyses },
      commentary: commentary
    }
  };

  const url = SUPABASE_URL + '/rest/v1/admin_daily_reports?on_conflict=report_date';
  const response = await fetch(url, {
    method: 'POST',
    headers: Object.assign({}, supabaseHeaders(), {
      Prefer: 'resolution=merge-duplicates,return=representation'
    }),
    body: JSON.stringify([report])
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error('Günlük rapor Supabase tablosuna yazılamadı. HTTP ' +
      response.status + ': ' + responseText.slice(0, 500));
  }

  console.log('Grap-AI günlük raporu özel yönetici tablosuna kaydedildi.');
}

main().catch(function (error) {
  console.error('Grap-AI günlük ajanı başarısız:', error && error.message ? error.message : error);
  process.exitCode = 1;
});