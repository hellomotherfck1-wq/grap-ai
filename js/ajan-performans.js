/**
 * Ajan Performans Defteri
 * Yalnızca sinyal metaverisini ve sonuçlarını 365 gün IndexedDB'de saklar.
 * Ham fiyat geçmişi saklanmaz; değerlendirme gerektiğinde ücretsiz kaynaklardan çekilir.
 */
(function () {
  'use strict';

  var DB_NAME = 'graphai-agent-performance-v1';
  var STORE = 'signals';
  var DB_VERSION = 1;
  var RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
  var HORIZON = 10;
  var DEFAULT_COST = 0.20;
  var COST_KEY = 'graphai-agent-performance-cost-v1';
  var currentCostPct = DEFAULT_COST;
  try {
    var savedCostRaw = localStorage.getItem(COST_KEY);
    if (savedCostRaw !== null && savedCostRaw !== '') {
      var savedCost = Number(savedCostRaw);
      if (isFinite(savedCost) && savedCost >= 0 && savedCost <= 5) currentCostPct = savedCost;
    }
  } catch (e) {}
  var dbPromise = null;
  var updating = false;

  function num(x) { return typeof x === 'number' && isFinite(x); }
  function norm(x) { return String(x || '').trim().toUpperCase().replace(/\s+/g, ''); }
  function interval(tf) {
    return ({ '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000, '4h': 4 * 60 * 60 * 1000, '1d': 24 * 60 * 60 * 1000 })[tf] || 0;
  }
  function marketOf(symbol) {
    return /USDT$/i.test(symbol) ? 'Kripto' : /\.IS$/i.test(symbol) ? 'BIST' : 'Diğer';
  }
  function idFor(symbol, tf, signalAt) {
    return norm(symbol) + '|' + String(tf || '') + '|' + String(Math.round(Number(signalAt) || 0));
  }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('Bu tarayıcı IndexedDB desteklemiyor.')); return; }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('symbol', 'symbol', { unique: false });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Performans hafızası açılamadı.')); };
      request.onblocked = function () { reject(new Error('Performans hafızası başka bir sekmede güncelleniyor.')); };
    }).catch(function (e) {
      dbPromise = null;
      throw e;
    });
    return dbPromise;
  }

  function allRecords() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { reject(req.error || new Error('Sinyaller okunamadı.')); };
      });
    });
  }

  function putRecord(record) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var get = store.get(record.id);
        var finalRecord = record;
        get.onsuccess = function () {
          var old = get.result;
          if (old) {
            var sources = (old.sources || [old.source]).filter(Boolean);
            if (record.source && sources.indexOf(record.source) < 0) sources.push(record.source);
            var oldRank = old.source === 'Grafik analizi' ? 3 : 2;
            var newRank = record.source === 'Grafik analizi' ? 3 : 2;
            finalRecord = Object.assign({}, old, { sources: sources, updatedAt: Date.now() });
            if (newRank >= oldRank && old.tradeStatus !== 'completed' && old.directionStatus !== 'completed') {
              var changedDecision = old.decision !== record.decision;
              [
                'name', 'market', 'timeframe', 'signalAt', 'price', 'stop', 'target', 'rr',
                'decision', 'generalDecision', 'technicalDecision', 'volumeDecision',
                'volumeScore', 'flowDecision', 'flowScore', 'flowAvailable',
                'marketRegime', 'mtfAlignment', 'sourceTimestamps',
                'auditorError', 'auditorWarningCount', 'score', 'trend', 'rsi', 'fundamentalStatus',
                'fkPE', 'fkValuation', 'fkVeto', 'costPct', 'horizon', 'agentVersion'
              ].forEach(function (key) {
                if (record[key] !== undefined) finalRecord[key] = record[key];
              });
              if (changedDecision) {
                finalRecord.tradeStatus = record.decision === 'BEKLE' ? 'not-applicable' : 'pending';
                finalRecord.directionStatus = 'pending';
                finalRecord.tradeResult = null;
                finalRecord.forwardPct = null;
                finalRecord.waitResult = null;
              }
            }
          }
          store.put(finalRecord);
        };
        get.onerror = function () { reject(get.error || new Error('Sinyal kaydı okunamadı.')); };
        tx.oncomplete = function () { resolve(finalRecord); };
        tx.onerror = function () { reject(tx.error || new Error('Sinyal kaydedilemedi.')); };
        tx.onabort = function () { reject(tx.error || new Error('Sinyal kaydı iptal edildi.')); };
      });
    });
  }

  function patchRecord(id, patch) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var req = store.get(id);
        var updated = null;
        req.onsuccess = function () {
          if (!req.result) return;
          updated = Object.assign({}, req.result, patch, { updatedAt: Date.now() });
          store.put(updated);
        };
        req.onerror = function () { reject(req.error || new Error('Sinyal kaydı okunamadı.')); };
        tx.oncomplete = function () { resolve(updated); };
        tx.onerror = function () { reject(tx.error || new Error('Sinyal güncellenemedi.')); };
      });
    });
  }

  function prune() {
    var cutoff = Date.now() - RETENTION_MS;
    return allRecords().then(function (records) {
      var old = records.filter(function (r) { return !num(r.createdAt) || r.createdAt < cutoff; });
      if (!old.length) return 0;
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readwrite');
          var store = tx.objectStore(STORE);
          old.forEach(function (r) { store.delete(r.id); });
          tx.oncomplete = function () { resolve(old.length); };
          tx.onerror = function () { reject(tx.error || new Error('Eski kayıtlar temizlenemedi.')); };
        });
      });
    });
  }

  function safeRecord(input) {
    var symbol = norm(input.symbol);
    var tf = input.timeframe || input.zd;
    var at = input.signalAt === null || input.signalAt === undefined || input.signalAt === ''
      ? NaN : Number(input.signalAt);
    var price = Number(input.price);
    var decision = input.decision;
    if (!symbol || !interval(tf) || !num(at) || !num(price) || price <= 0 ||
        ['AL', 'SAT', 'BEKLE'].indexOf(decision) < 0) return null;
    var now = Date.now();
    var source = String(input.source || 'Grafik analizi');
    return {
      id: idFor(symbol, tf, at),
      createdAt: now,
      updatedAt: now,
      expiresAt: now + RETENTION_MS,
      source: source,
      sources: [source],
      symbol: symbol,
      name: String(input.name || symbol),
      market: input.market || marketOf(symbol),
      timeframe: tf,
      signalAt: at,
      price: price,
      stop: num(input.stop) && input.stop > 0 ? input.stop : null,
      target: num(input.target) && input.target > 0 ? input.target : null,
      rr: num(input.rr) ? input.rr : null,
      decision: decision,
      generalDecision: input.generalDecision || null,
      technicalDecision: input.technicalDecision || null,
      volumeDecision: input.volumeDecision || null,
      volumeScore: num(input.volumeScore) ? input.volumeScore : null,
      flowDecision: input.flowDecision || null,
      flowScore: num(input.flowScore) ? input.flowScore : null,
      flowAvailable: typeof input.flowAvailable === 'boolean' ? input.flowAvailable : null,
      marketRegime: input.marketRegime || null,
      mtfAlignment: num(input.mtfAlignment) ? input.mtfAlignment : null,
      sourceTimestamps: input.sourceTimestamps && typeof input.sourceTimestamps === 'object'
        ? input.sourceTimestamps : null,
      auditorError: input.auditorError || null,
      auditorWarningCount: num(input.auditorWarningCount) ? Math.max(0, input.auditorWarningCount) : null,
      score: num(input.score) ? input.score : null,
      trend: input.trend || null,
      rsi: num(input.rsi) ? input.rsi : null,
      fundamentalStatus: input.fundamentalStatus || 'not-included',
      fkPE: num(input.fkPE) ? input.fkPE : null,
      fkValuation: input.fkValuation || null,
      fkVeto: Boolean(input.fkVeto),
      costPct: num(input.costPct) ? Math.max(0, Math.min(5, input.costPct)) : currentCostPct,
      horizon: Math.max(2, Math.min(30, Number(input.horizon) || HORIZON)),
      tradeStatus: decision === 'BEKLE' ? 'not-applicable' : 'pending',
      directionStatus: 'pending',
      tradeResult: null,
      forwardPct: null,
      waitResult: null,
      agentVersion: String(input.agentVersion || 'graph-ai-agent-v1')
    };
  }

  function save(input) {
    var record = safeRecord(input || {});
    if (!record) return null;
    putRecord(record).then(function () {
      return allRecords().then(render);
    }).catch(function (e) {
      setStatus('Sinyal kaydedilemedi: ' + (e && e.message ? e.message : String(e)), true);
    });
    return record.id;
  }

  function voteFromVolume(score, available) {
    if (!available || !num(score) || score === 0) return 'BEKLE';
    return score > 0 ? 'AL' : 'SAT';
  }

  function saveAnalysis(input) {
    var s = input.s || {};
    var y = input.y || {};
    var c = Array.isArray(s.analysisC) && s.analysisC.length ? s.analysisC : s.c;
    var tech = null, volume = null, volumeScore = null;
    try {
      if (window.Ajan && typeof window.Ajan.teknikAjani === 'function' && Array.isArray(c)) {
        tech = window.Ajan.teknikAjani(s, c);
      }
      var rawVol = window.Ajan && Array.isArray(window.Ajan.hacim) ? window.Ajan.hacim.slice() : null;
      if (rawVol && Array.isArray(c) && rawVol.length >= c.length) {
        rawVol = rawVol.slice(0, c.length);
        var positive = rawVol.filter(function (v) { return num(v) && v > 0; }).length;
        if (positive >= Math.max(10, c.length * 0.6) &&
            window.Ajan && typeof window.Ajan.hacimAjani === 'function') {
          volume = window.Ajan.hacimAjani(c, rawVol);
          volumeScore = volume && num(volume.skor) ? volume.skor : null;
        }
      }
    } catch (e) {}

    var auditCard = Array.isArray(y.kartlar) ? y.kartlar.find(function (card) {
      return card && String(card.baslik || '').indexOf('🟧 Denetçi Ajan') === 0;
    }) : null;
    var auditTitle = auditCard ? String(auditCard.baslik || '') : '';
    var auditMatch = /hata payı:\s*(düşük|orta|yüksek)/i.exec(auditTitle);
    var auditCountMatch = auditCard && Array.isArray(auditCard.satirlar)
      ? /,\s*(\d+)\s+sorun bulundu/i.exec(String(auditCard.satirlar[0] || '')) : null;
    var votes = {
      generalDecision: s.karar || 'BEKLE',
      technicalDecision: tech && tech.karar ? tech.karar : null,
      volumeDecision: voteFromVolume(volumeScore, !!(volume && volume.var)),
      volumeScore: volumeScore,
      auditorError: auditMatch ? auditMatch[1].charAt(0).toLocaleUpperCase('tr-TR') + auditMatch[1].slice(1).toLocaleLowerCase('tr-TR') : null,
      auditorWarningCount: auditCountMatch ? Number(auditCountMatch[1]) : null
    };
    var symbol = input.symbol;
    var signalAt = Number(input.signalAt);
    var market = input.market || marketOf(symbol);
    var fundamentalStatus = input.fundamentalStatus || (market === 'BIST' ? 'pending' : 'not-applicable');
    var id = save({
      source: 'Grafik analizi',
      symbol: symbol,
      name: input.name,
      market: market,
      timeframe: input.timeframe,
      signalAt: signalAt,
      price: input.price,
      stop: input.stop,
      target: input.target,
      rr: input.rr,
      decision: y.karar || s.karar || 'BEKLE',
      generalDecision: votes.generalDecision,
      technicalDecision: votes.technicalDecision,
      volumeDecision: votes.volumeDecision,
      volumeScore: votes.volumeScore,
      auditorError: input.auditorError || votes.auditorError,
      auditorWarningCount: input.auditorWarningCount != null ? input.auditorWarningCount : votes.auditorWarningCount,
      score: y.uyum,
      trend: s.trend && s.trend.yon,
      rsi: s.rsi,
      fundamentalStatus: fundamentalStatus,
      agentVersion: 'graph-ai-live-v1'
    });
    return id;
  }

  function saveScan(candidates, meta) {
    if (!Array.isArray(candidates) || !candidates.length) return 0;
    meta = meta || {};
    var actionable = candidates.filter(function (c) { return c && (c.karar === 'AL' || c.karar === 'SAT'); });
    var chosen = actionable.slice(0, 40);
    var bestWait = candidates.find(function (c) {
      return c && c.karar === 'BEKLE' && c.sembol && c.sembol !== '—';
    });
    if (bestWait && !chosen.some(function (c) {
      return c.sembol === bestWait.sembol && c.signalAt === bestWait.signalAt;
    })) chosen.push(bestWait);
    var count = 0;
    var writes = [];
    chosen.forEach(function (c) {
      var record = safeRecord({
        source: meta.source || 'Tarama',
        symbol: c.sembol,
        name: c.ad,
        market: meta.market || marketOf(c.sembol),
        timeframe: meta.timeframe || c.zd,
        signalAt: c.signalAt,
        price: c.fiyat,
        stop: c.stopFiyat,
        target: c.hedefFiyat,
        rr: c.rr,
        decision: c.karar,
        generalDecision: c.genelKarar,
        technicalDecision: c.teknikKarar,
        volumeDecision: c.hacimKarar || voteFromVolume(c.hacimSkor, c.hacimSkor !== null && c.hacimSkor !== undefined),
        volumeScore: c.hacimSkor,
        flowDecision: c.flow && c.flow.available ? c.flow.decision : null,
        flowScore: c.flow && c.flow.available ? c.flow.score : null,
        flowAvailable: c.flow ? !!c.flow.available : null,
        marketRegime: c.marketRegime && c.marketRegime.regime,
        mtfAlignment: c.mtf && c.mtf.score,
        sourceTimestamps: c.sourceTimestamps,
        auditorError: c.hataPayi,
        auditorWarningCount: c.denetciSorunSayisi,
        score: c.skor,
        trend: c.trend,
        rsi: c.rsi,
        fundamentalStatus: 'not-included',
        agentVersion: meta.agentVersion || 'graph-ai-scan-v1'
      });
      if (record) { count++; writes.push(putRecord(record)); }
    });
    Promise.all(writes).then(allRecords).then(render).catch(function (e) {
      setStatus('Tarama sinyalleri kaydedilemedi: ' + (e && e.message ? e.message : String(e)), true);
    });
    return count;
  }

  function updateDecision(id, decision, extra) {
    if (!id || ['AL', 'SAT', 'BEKLE'].indexOf(decision) < 0) return Promise.resolve(null);
    var patch = Object.assign({}, extra || {}, { decision: decision });
    patch.tradeStatus = decision === 'BEKLE' ? 'not-applicable' : 'pending';
    patch.directionStatus = 'pending';
    return patchRecord(id, patch).then(function (updated) {
      return allRecords().then(function (records) {
        render(records);
        return updated;
      });
    }).catch(function (e) {
      setStatus('Ajan kararı güncellenemedi: ' + (e && e.message ? e.message : String(e)), true);
      return null;
    });
  }

  function futureBars(record, bars) {
    var step = interval(record.timeframe);
    return (Array.isArray(bars) ? bars : []).filter(function (bar) {
      return bar && num(bar.t) && num(bar.o) && num(bar.h) && num(bar.l) && num(bar.c) &&
        bar.t >= record.signalAt && bar.h >= Math.max(bar.o, bar.c) &&
        bar.l <= Math.min(bar.o, bar.c);
    }).sort(function (a, b) { return a.t - b.t; }).filter(function (bar) {
      return bar.t + step <= Date.now();
    });
  }

  function directionResult(record, bars) {
    var future = futureBars(record, bars);
    var horizon = record.horizon || HORIZON;
    if (future.length < horizon || !(record.price > 0)) return null;
    var sample = future.slice(0, horizon);
    var end = sample[sample.length - 1];
    var highs = sample.map(function (b) { return b.h; });
    var lows = sample.map(function (b) { return b.l; });
    var forward = (end.c / record.price - 1) * 100;
    return {
      status: 'completed',
      forwardPct: forward,
      exitPrice: end.c,
      exitAt: end.t,
      mfePct: (Math.max.apply(null, highs) / record.price - 1) * 100,
      maePct: (Math.min.apply(null, lows) / record.price - 1) * 100,
      classification: forward > record.costPct ? 'up' : forward < -record.costPct ? 'down' : 'flat'
    };
  }

  function tradeResult(record, bars) {
    if (record.decision !== 'AL' && record.decision !== 'SAT') return null;
    var future = futureBars(record, bars);
    if (!future.length) return null;
    var horizon = record.horizon || HORIZON;
    var dir = record.decision === 'AL' ? 1 : -1;
    var entryBar = future[0];
    var entry = entryBar.o;
    if (!num(entry) || entry <= 0) return null;

    var hasPlan = num(record.stop) && num(record.target);
    if (hasPlan) {
      if ((dir > 0 && entry <= record.stop) || (dir < 0 && entry >= record.stop)) {
        return { status: 'skipped', reason: 'Sonraki açılışta stop seviyesi aşılmış; işlem açılmadı.', entry: entry, entryAt: entryBar.t };
      }
      if ((dir > 0 && entry >= record.target) || (dir < 0 && entry <= record.target)) {
        return { status: 'skipped', reason: 'Sonraki açılışta hedef geçilmiş; işlem açılmadı.', entry: entry, entryAt: entryBar.t };
      }
    }

    var limit = Math.min(future.length, horizon);
    var exit = null, exitIndex = -1, reason = 'Zaman çıkışı';
    for (var i = 0; i < limit; i++) {
      var bar = future[i];
      if (hasPlan) {
        if (dir > 0) {
          if (bar.o <= record.stop) { exit = bar.o; reason = 'Stop boşluğu'; }
          else if (bar.l <= record.stop) { exit = record.stop; reason = 'Stop'; }
          else if (bar.o >= record.target) { exit = bar.o; reason = 'Hedef boşluğu'; }
          else if (bar.h >= record.target) { exit = record.target; reason = 'Hedef'; }
        } else {
          if (bar.o >= record.stop) { exit = bar.o; reason = 'Stop boşluğu'; }
          else if (bar.h >= record.stop) { exit = record.stop; reason = 'Stop'; }
          else if (bar.o <= record.target) { exit = bar.o; reason = 'Hedef boşluğu'; }
          else if (bar.l <= record.target) { exit = record.target; reason = 'Hedef'; }
        }
      }
      if (exit !== null) { exitIndex = i; break; }
    }

    if (exit === null) {
      if (future.length < horizon) return null;
      exitIndex = horizon - 1;
      exit = future[exitIndex].c;
      reason = hasPlan ? '10 mum zaman çıkışı' : '10 mum yön testi (işlem planı yok)';
    }

    var sample = future.slice(0, exitIndex + 1);
    var maxHigh = Math.max.apply(null, sample.map(function (b) { return b.h; }));
    var minLow = Math.min.apply(null, sample.map(function (b) { return b.l; }));
    var gross = dir * (exit - entry) / entry * 100;
    var net = gross - record.costPct;
    return {
      status: 'completed',
      reason: reason,
      entry: entry,
      entryAt: entryBar.t,
      exit: exit,
      exitAt: future[exitIndex].t,
      grossPct: gross,
      netPct: net,
      mfePct: dir > 0 ? (maxHigh - entry) / entry * 100 : (entry - minLow) / entry * 100,
      maePct: dir > 0 ? (minLow - entry) / entry * 100 : (entry - maxHigh) / entry * 100,
      outcome: net > 0 ? 'win' : net < 0 ? 'loss' : 'flat'
    };
  }

  function evaluateSignal(record, bars) {
    return {
      trade: tradeResult(record, bars),
      direction: directionResult(record, bars)
    };
  }

  function statusText(record) {
    if (record.directionStatus === 'expired' || record.tradeStatus === 'expired') return 'Veri aralığı dışında';
    if (record.lastError) return 'Veri alınamadı';
    if (record.tradeStatus === 'skipped') return 'İşlem açılmadı';
    if (record.decision === 'BEKLE' && record.directionStatus === 'completed') {
      return record.waitResult === 'avoid-down' ? 'Düşüşten kaçınma'
        : record.waitResult === 'missed-up' ? 'Yükseliş kaçırma' : 'Yatay';
    }
    if (record.tradeStatus === 'completed') {
      return record.tradeResult && record.tradeResult.outcome === 'win' ? 'Kârlı'
        : record.tradeResult && record.tradeResult.outcome === 'loss' ? 'Zararlı' : 'Başa baş';
    }
    return 'Sonuç bekleniyor';
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function setStatus(message, error) {
    var node = document.getElementById('ajan-performans-durum');
    if (node) {
      node.textContent = message;
      node.style.color = error ? '#ffb4a8' : '';
    }
  }

  function kpi(label, value) {
    var box = el('div', 'backtest-kpi');
    box.appendChild(el('span', '', label));
    box.appendChild(el('strong', '', value));
    return box;
  }

  function pct(value) {
    if (!num(value)) return '—';
    return (value > 0 ? '+' : '') + value.toFixed(2).replace('.', ',') + '%';
  }

  function winRate(rows) {
    var n = rows.length;
    if (!n) return { rate: null, low: null, high: null };
    var wins = rows.filter(function (r) { return r.tradeResult && r.tradeResult.outcome === 'win'; }).length;
    var p = wins / n, z = 1.96, den = 1 + z * z / n;
    var center = (p + z * z / (2 * n)) / den;
    var margin = z * Math.sqrt((p * (1 - p) / n) + (z * z / (4 * n * n))) / den;
    return { rate: p * 100, low: Math.max(0, center - margin) * 100, high: Math.min(1, center + margin) * 100 };
  }

  function agentStats(records, key) {
    var calls = records.filter(function (r) {
      return r.directionStatus === 'completed' &&
        (r[key] === 'AL' || r[key] === 'SAT') && num(r.forwardPct);
    });
    var correct = 0, wrong = 0, flat = 0;
    calls.forEach(function (r) {
      if (Math.abs(r.forwardPct) <= r.costPct) flat++;
      else if ((r[key] === 'AL' && r.forwardPct > 0) || (r[key] === 'SAT' && r.forwardPct < 0)) correct++;
      else wrong++;
    });
    var directional = correct + wrong;
    return { count: calls.length, correct: correct, wrong: wrong, flat: flat, rate: directional ? correct / directional * 100 : null };
  }

  function renderAgentTable(records) {
    var wrap = el('div', 'backtest-table-wrap');
    var table = el('table', 'backtest-trade-table');
    var head = el('thead');
    var hr = el('tr');
    ['Ajan', 'Yön sinyali', 'Doğru', 'Yanlış', 'Yatay', 'İsabet'].forEach(function (label) { hr.appendChild(el('th', '', label)); });
    head.appendChild(hr);
    table.appendChild(head);
    var body = el('tbody');
    [
      ['Genel analiz', 'generalDecision'],
      ['Teknik ajan', 'technicalDecision'],
      ['Hacim ajanı', 'volumeDecision'],
      ['Nihai kurul', 'decision']
    ].forEach(function (item) {
      var s = agentStats(records, item[1]);
      var row = el('tr');
      [item[0], String(s.count), String(s.correct), String(s.wrong), String(s.flat), s.rate === null ? '—' : '%' + s.rate.toFixed(1).replace('.', ',')].forEach(function (v) { row.appendChild(el('td', '', v)); });
      body.appendChild(row);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    return wrap;
  }

  function renderAuditorTable(records) {
    var wrap = el('div', 'backtest-table-wrap');
    var table = el('table', 'backtest-trade-table');
    var head = el('thead'), hr = el('tr');
    ['Denetçi seviyesi', 'Sinyal', 'Düşüş', 'Yükseliş', 'Yatay'].forEach(function (x) { hr.appendChild(el('th', '', x)); });
    head.appendChild(hr); table.appendChild(head);
    var body = el('tbody');
    ['Düşük', 'Orta', 'Yüksek'].forEach(function (level) {
      var rows = records.filter(function (r) {
        return r.directionStatus === 'completed' && r.auditorError === level && num(r.forwardPct);
      });
      var down = rows.filter(function (r) { return r.forwardPct < -r.costPct; }).length;
      var up = rows.filter(function (r) { return r.forwardPct > r.costPct; }).length;
      var flat = rows.length - down - up;
      var tr = el('tr');
      [level, String(rows.length), String(down), String(up), String(flat)].forEach(function (x) { tr.appendChild(el('td', '', x)); });
      body.appendChild(tr);
    });
    table.appendChild(body); wrap.appendChild(table);
    return wrap;
  }

  function renderBreakdown(records) {
    var groups = Object.create(null);
    records.forEach(function (r) {
      var key = (r.market || 'Diğer') + '|' + (r.timeframe || '—');
      if (!groups[key]) groups[key] = { market: r.market || 'Diğer', timeframe: r.timeframe || '—', rows: [] };
      groups[key].rows.push(r);
    });
    var wrap = el('div', 'backtest-table-wrap');
    var table = el('table', 'backtest-trade-table');
    var head = el('thead'), hr = el('tr');
    ['Piyasa', 'Periyot', 'Sinyal', 'İşlem', 'Kazanma', 'Ort. net'].forEach(function (x) { hr.appendChild(el('th', '', x)); });
    head.appendChild(hr); table.appendChild(head);
    var body = el('tbody');
    Object.keys(groups).sort().forEach(function (key) {
      var group = groups[key];
      var trades = group.rows.filter(function (r) { return r.tradeStatus === 'completed' && r.tradeResult; });
      var wins = trades.filter(function (r) { return r.tradeResult.outcome === 'win'; }).length;
      var average = trades.length
        ? trades.reduce(function (sum, r) { return sum + r.tradeResult.netPct; }, 0) / trades.length : null;
      var row = el('tr');
      [
        group.market, group.timeframe, String(group.rows.length), String(trades.length),
        trades.length ? '%' + (wins / trades.length * 100).toFixed(1).replace('.', ',') : '—',
        pct(average)
      ].forEach(function (x) { row.appendChild(el('td', '', x)); });
      body.appendChild(row);
    });
    table.appendChild(body); wrap.appendChild(table);
    return wrap;
  }

  function render(records) {
    var root = document.getElementById('ajan-performans-panel');
    if (!root) return;
    root.replaceChildren();
    var card = el('div', 'kart ajan-performans');
    var header = el('div', 'performans-baslik');
    var heading = el('div');
    heading.appendChild(el('h3', '', '🏆 Ajanların gerçek performansı'));
    heading.appendChild(el('p', 'backtest-not', 'Sinyaller 365 gün saklanır · ham fiyat geçmişi saklanmaz · bu cihazda tutulur.'));
    header.appendChild(heading);

    var actions = el('div', 'performans-eylemler');
    var refresh = el('button', 'buton', 'SONUÇLARI GÜNCELLE');
    refresh.type = 'button';
    refresh.id = 'ajan-performans-guncelle';
    var exportBtn = el('button', 'buton ikincil-buton', 'CSV İNDİR');
    exportBtn.type = 'button';
    exportBtn.id = 'ajan-performans-csv';
    actions.appendChild(refresh);
    actions.appendChild(exportBtn);
    var costField = el('div', 'performans-maliyet');
    var costLabel = el('label', '', 'Yeni sinyaller için toplam maliyet (%)');
    costLabel.htmlFor = 'ajan-performans-maliyet';
    var costInput = el('input');
    costInput.type = 'number';
    costInput.id = 'ajan-performans-maliyet';
    costInput.min = '0';
    costInput.max = '5';
    costInput.step = '0.01';
    costInput.value = currentCostPct.toFixed(2);
    var costSave = el('button', 'buton ikincil-buton', 'MALİYETİ KAYDET');
    costSave.type = 'button';
    costSave.id = 'ajan-performans-maliyet-kaydet';
    costField.appendChild(costLabel);
    costField.appendChild(costInput);
    costField.appendChild(costSave);
    actions.appendChild(costField);
    header.appendChild(actions);
    card.appendChild(header);

    var status = el('p', 'backtest-not', 'Sinyal kayıtları yükleniyor…');
    status.id = 'ajan-performans-durum';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    card.appendChild(status);

    var all = records;
    var completedTrades = all.filter(function (r) { return r.tradeStatus === 'completed' && r.tradeResult; });
    var wins = completedTrades.filter(function (r) { return r.tradeResult.outcome === 'win'; });
    var losses = completedTrades.filter(function (r) { return r.tradeResult.outcome === 'loss'; });
    var grossWins = wins.reduce(function (sum, r) { return sum + Math.max(0, r.tradeResult.netPct); }, 0);
    var grossLosses = Math.abs(losses.reduce(function (sum, r) { return sum + Math.min(0, r.tradeResult.netPct); }, 0));
    var pf = grossLosses > 0 ? (grossWins / grossLosses).toFixed(2).replace('.', ',')
      : grossWins > 0 ? '∞' : '—';
    var average = completedTrades.length
      ? completedTrades.reduce(function (sum, r) { return sum + r.tradeResult.netPct; }, 0) / completedTrades.length : null;
    var wr = winRate(completedTrades);
    var pending = all.filter(function (r) {
      return r.tradeStatus === 'pending' || r.directionStatus === 'pending';
    }).length;
    var expired = all.filter(function (r) { return r.tradeStatus === 'expired' || r.directionStatus === 'expired'; }).length;
    var observedWait = all.filter(function (r) { return r.decision === 'BEKLE' && r.directionStatus === 'completed'; });
    var avoided = observedWait.filter(function (r) { return r.waitResult === 'avoid-down'; }).length;
    var missed = observedWait.filter(function (r) { return r.waitResult === 'missed-up'; }).length;

    var grid = el('div', 'backtest-kpi-grid');
    [
      ['Kayıtlı sinyal', String(all.length)],
      ['Tamamlanan AL/SAT', String(completedTrades.length)],
      ['Kazanma oranı', wr.rate === null ? '—' : '%' + wr.rate.toFixed(1).replace('.', ',')],
      ['Ort. net işlem', pct(average)],
      ['Kâr faktörü', pf],
      ['Sonuç bekleyen', String(pending)],
      ['BEKLE değerlendirildi', String(observedWait.length)],
      ['Düşüşten kaçınma', String(avoided)],
      ['Yükseliş kaçırma', String(missed)],
      ['Denetçi yüksek risk', String(all.filter(function (r) { return r.auditorError === 'Yüksek'; }).length)],
      ['Denetçi bulgusu', String(all.reduce(function (sum, r) { return sum + (r.auditorWarningCount || 0); }, 0))],
      ['Veri aralığı dışında', String(expired)]
    ].forEach(function (x) { grid.appendChild(kpi(x[0], x[1])); });
    card.appendChild(grid);

    var quality = completedTrades.length < 30
      ? 'Örneklem yetersiz: 30 tamamlanmış işlemden önce başarı oranı güvenilir kabul edilmemeli.'
      : completedTrades.length < 100
        ? 'Ön sonuç: 30–99 işlem var. %95 Wilson aralığı yaklaşık %' + wr.low.toFixed(1) + '–%' + wr.high.toFixed(1) + '.'
        : 'Genişleyen örneklem: %95 Wilson aralığı yaklaşık %' + wr.low.toFixed(1) + '–%' + wr.high.toFixed(1) + '. Bu yine de gelecekteki başarıyı garanti etmez.';
    card.appendChild(el('p', 'backtest-not', quality));
    card.appendChild(el('h4', 'backtest-trades-title', 'Ajan bazında yön isabeti · sinyalden 10 mum sonra'));
    card.appendChild(renderAgentTable(all));
    card.appendChild(el('h4', 'backtest-trades-title', 'Piyasa ve zaman dilimi ayrımı'));
    card.appendChild(renderBreakdown(all));
    card.appendChild(el('h4', 'backtest-trades-title', 'Denetçi risk seviyesi sonrası 10 mum sonucu'));
    card.appendChild(renderAuditorTable(all));

    var fkRows = all.filter(function (r) { return r.fkVeto && r.directionStatus === 'completed'; });
    if (fkRows.length) {
      var fkAvoid = fkRows.filter(function (r) { return r.forwardPct < -r.costPct; }).length;
      var fkMiss = fkRows.filter(function (r) { return r.forwardPct > r.costPct; }).length;
      card.appendChild(el('p', 'backtest-not', 'F/K ajanının AL → BEKLE veto sayısı: ' + fkRows.length +
        ' · sonrasında düşüş: ' + fkAvoid + ' · yükseliş: ' + fkMiss + '.'));
    }

    card.appendChild(el('h4', 'backtest-trades-title', 'Son sinyaller'));
    var wrap = el('div', 'backtest-table-wrap');
    var table = el('table', 'backtest-trade-table');
    var head = el('thead'), row = el('tr');
    ['Tarih', 'Varlık', 'Periyot', 'Karar', 'Denetçi', 'F/K', 'Durum', 'Net sonuç'].forEach(function (x) { row.appendChild(el('th', '', x)); });
    head.appendChild(row); table.appendChild(head);
    var body = el('tbody');
    all.slice().sort(function (a, b) { return b.signalAt - a.signalAt; }).slice(0, 15).forEach(function (r) {
      var tr = el('tr');
      var net = r.tradeResult && num(r.tradeResult.netPct) ? pct(r.tradeResult.netPct)
        : r.directionStatus === 'completed' && num(r.forwardPct) ? pct(r.forwardPct) + ' (yön)' : '—';
      var fkLabel = r.fundamentalStatus === 'available'
        ? (num(r.fkPE) ? 'Var · ' + r.fkPE.toFixed(2) + 'x' : 'Veri var')
        : r.fundamentalStatus === 'pending' ? 'Bekliyor'
        : r.fundamentalStatus === 'unavailable' ? 'Veri yok'
        : r.fundamentalStatus === 'not-included' ? 'Tarama dışı' : 'Uygulanmaz';
      [new Date(r.signalAt).toLocaleDateString('tr-TR'), r.name || r.symbol, r.timeframe,
        r.decision, r.auditorError || '—', fkLabel, statusText(r), net].forEach(function (x) { tr.appendChild(el('td', '', x)); });
      body.appendChild(tr);
    });
    table.appendChild(body); wrap.appendChild(table); card.appendChild(wrap);

    card.appendChild(el('p', 'backtest-not',
      'AL/SAT işlem simülasyonu sonraki mum açılışından başlar. SAT işlemi kısa pozisyon varsayımıdır; spot piyasada short mümkün olmayabilir. Maliyet her sinyal için kaydedilir; yeni sinyallerin maliyeti yukarıdan değiştirilebilir. BEKLE kararları kazanma oranına katılmaz. Ajan yön isabeti, sinyalden sonraki 10 kapanmış mumun fiyat yönüyle ölçülür. İşlemler bağımsız sinyal bazında değerlendirilir; portföy ve eş zamanlı pozisyon simülasyonu değildir. Sonuçlar Sonuç ekranını açınca ücretsiz kaynaktan güncellenir. Ücretsiz 15 dakikalık/saatlik geçmiş daha kısa olduğundan uzun süre güncellenmeyen bazı kayıtlar veri aralığı dışında kalabilir. Tarama kayıtlarında F/K ajanı çalıştırılmadıysa bu açıkça işaretlenir. Tarayıcı verisi temizlenirse bu yerel kayıtlar da silinebilir.'));
    root.appendChild(card);

    refresh.addEventListener('click', function () { updateResults(); });
    exportBtn.addEventListener('click', function () { exportCSV(all); });
    costSave.addEventListener('click', function () {
      var value = Number(costInput.value);
      if (!num(value) || value < 0 || value > 5) {
        setStatus('Toplam maliyet %0 ile %5 arasında olmalı.', true);
        return;
      }
      currentCostPct = value;
      try { localStorage.setItem(COST_KEY, String(value)); } catch (e) {}
      setStatus('Yeni sinyaller için toplam maliyet %' + value.toFixed(2).replace('.', ',') +
        ' olarak kaydedildi. Önceki sinyaller kendi kayıtlı maliyetleriyle kalır.');
    });
  }

  function exportCSV(records) {
    var columns = ['signalAt', 'symbol', 'name', 'market', 'timeframe', 'decision', 'generalDecision',
      'technicalDecision', 'volumeDecision', 'flowDecision', 'flowScore', 'flowAvailable',
      'marketRegime', 'mtfAlignment', 'auditorError', 'auditorWarningCount', 'fundamentalStatus', 'price', 'stop', 'target',
      'costPct', 'tradeStatus', 'tradeOutcome', 'netPct', 'forwardPct', 'waitResult', 'source'];
    var rows = [columns.join(';')];
    records.slice().sort(function (a, b) { return a.signalAt - b.signalAt; }).forEach(function (r) {
      var values = [
        new Date(r.signalAt).toISOString(), r.symbol, r.name, r.market, r.timeframe, r.decision,
        r.generalDecision, r.technicalDecision, r.volumeDecision, r.flowDecision, r.flowScore, r.flowAvailable,
        r.marketRegime, r.mtfAlignment,
        r.auditorError, r.auditorWarningCount, r.fundamentalStatus, r.price, r.stop, r.target, r.costPct, r.tradeStatus,
        r.tradeResult ? r.tradeResult.outcome : '',
        r.tradeResult ? r.tradeResult.netPct : '',
        r.forwardPct == null ? '' : r.forwardPct, r.waitResult || '', (r.sources || [r.source]).join('+')
      ];
      rows.push(values.map(function (v) {
        var s = v == null ? '' : String(v);
        return '"' + s.replace(/"/g, '""') + '"';
      }).join(';'));
    });
    var blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'grap-ai-ajan-performansi-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function saveEvaluation(id, patch) {
    return patchRecord(id, patch);
  }

  function updateResults() {
    if (updating) return Promise.resolve();
    if (typeof Veri === 'undefined' || typeof Veri.gecmis !== 'function') {
      setStatus('Ücretsiz geçmiş veri modülü bulunamadı.', true);
      return Promise.resolve();
    }
    updating = true;
    var button = document.getElementById('ajan-performans-guncelle');
    if (button) button.disabled = true;
    setStatus('Bekleyen sinyallerin ücretsiz fiyat verileri kontrol ediliyor…');
    return prune().then(allRecords).then(function (records) {
      var groups = Object.create(null);
      records.forEach(function (r) {
        if (r.tradeStatus !== 'pending' && r.directionStatus !== 'pending') return;
        if (Date.now() < r.signalAt + interval(r.timeframe)) return;
        if (num(r.nextCheckAt) && Date.now() < r.nextCheckAt) return;
        var key = r.symbol + '|' + r.timeframe;
        if (!groups[key]) groups[key] = { symbol: r.symbol, timeframe: r.timeframe, records: [] };
        groups[key].records.push(r);
      });
      var list = Object.keys(groups).map(function (key) { return groups[key]; });
      if (!list.length) {
        return allRecords().then(function (fresh) {
          render(fresh);
          setStatus('Güncellenecek sinyal yok. Yeni sinyaller geldikçe burada birikecek.');
        });
      }
      var index = 0, completed = 0, failures = 0;
      function worker() {
        if (index >= list.length) return Promise.resolve();
        var group = list[index++];
        return Veri.gecmis(group.symbol, group.timeframe).then(function (data) {
          var step = interval(group.timeframe);
          var bars = (data.mumlar || []).filter(function (m) {
            return m && num(m.t) && m.t + step <= Date.now();
          });
          var first = bars.length ? bars[0].t : null;
          var tasks = [];
          group.records.forEach(function (record) {
            if (first && record.signalAt < first - step * 2) {
              tasks.push(saveEvaluation(record.id, {
                tradeStatus: record.tradeStatus === 'pending' ? 'expired' : record.tradeStatus,
                directionStatus: record.directionStatus === 'pending' ? 'expired' : record.directionStatus,
                lastError: 'Ücretsiz kaynağın geçmiş aralığı bu sinyali kapsamıyor.'
              }));
              return;
            }
            var evaluated = evaluateSignal(record, bars);
            var patch = {
              lastCheckedAt: Date.now(),
              nextCheckAt: Date.now() + step,
              lastError: null
            };
            if (evaluated.trade && record.tradeStatus === 'pending') {
              patch.tradeStatus = evaluated.trade.status;
              patch.tradeResult = evaluated.trade;
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
            if (Object.keys(patch).length > 2) tasks.push(saveEvaluation(record.id, patch));
            else tasks.push(saveEvaluation(record.id, patch));
          });
          return Promise.all(tasks).then(function () {
            completed++;
          });
        }).catch(function (e) {
          failures++;
          return Promise.all(group.records.map(function (r) {
            return saveEvaluation(r.id, {
              lastCheckedAt: Date.now(),
              nextCheckAt: Date.now() + 6 * 60 * 60 * 1000,
              lastError: e && e.message ? e.message : String(e)
            });
          }));
        }).then(function () {
          setStatus('Kontrol ediliyor: ' + completed + '/' + list.length + ' varlık · ' + failures + ' veri hatası…');
          return new Promise(function (resolve) { setTimeout(resolve, 160); });
        }).then(worker);
      }
      return Promise.all([worker(), worker(), worker()]).then(function () {
        return allRecords().then(function (fresh) {
          render(fresh);
          var pendingNow = fresh.filter(function (r) { return r.tradeStatus === 'pending' || r.directionStatus === 'pending'; }).length;
          setStatus('Güncelleme tamamlandı · ' + completed + '/' + list.length + ' varlık · ' +
            pendingNow + ' sinyalin sonucu bekleniyor · ' + failures + ' veri hatası.');
        });
      });
    }).catch(function (e) {
      setStatus('Performans verileri güncellenemedi: ' + (e && e.message ? e.message : String(e)), true);
    }).then(function () {
      updating = false;
      var button = document.getElementById('ajan-performans-guncelle');
      if (button) button.disabled = false;
    });
  }

  function init() {
    var root = document.getElementById('ajan-performans-panel');
    if (!root) return;
    openDB().then(prune).then(allRecords).then(render).then(function () {
      setStatus('Yerel performans hafızası hazır · son 365 gün.');
    }).catch(function (e) {
      setStatus('Performans hafızası açılamadı: ' + (e && e.message ? e.message : String(e)), true);
    });
    var resultNav = document.querySelector('nav button[data-git="sonuc"]');
    if (resultNav) resultNav.addEventListener('click', function () {
      updateResults();
    });
  }

  window.AjanPerformans = {
    kaydet: save,
    kaydetAnaliz: saveAnalysis,
    kaydetTarama: saveScan,
    guncelleKarar: updateDecision,
    listele: allRecords,
    sonucHesapla: evaluateSignal,
    guncelleSonuclar: updateResults,
    maliyetOku: function () { return currentCostPct; },
    ayarlar: { saklamaGun: 365, ufukMumu: HORIZON, varsayilanMaliyetYuzde: DEFAULT_COST }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
