/**
 * Grap-AI ortak sonuç havuzu.
 * Anon cihazlar yalnızca kayıt gönderebilir; ortak kayıtları yalnızca admin JWT okuyabilir.
 * Tarayıcıda yalnızca Supabase publishable/anon anahtarı bulunur; service_role kullanılmaz.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://qkkhguyngmsddnkunyws.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_21uKtVP_-Es7lWeTDefk7Q_r-pb8i0-';
  var DEVICE_KEY = 'grap-ai-shared-results-device-v1';
  var TABLE = 'agent_signals_shared';
  var BATCH_SIZE = 50;
  var client = null;
  var lastSyncFingerprint = null;
  var lastPruneAt = 0;
  var ephemeralDeviceId = null;
  var adminAuthorized = false;
  var initError = null;

  function isE2ETestMode() {
    return typeof window !== 'undefined' && window.__GRAP_AI_E2E_TEST__ === true;
  }

  function isTestSignal(record) {
    if (!record) return false;
    var sources = Array.isArray(record.sources) ? record.sources : [record.source];
    var testSource = sources.some(function (source) {
      return /^E2E(?:\b|[\s_-])/i.test(String(source || '').trim());
    });
    return testSource || /^E2E[A-Z0-9]*USDT$/i.test(String(record.symbol || ''));
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function deviceId() {
    try {
      var saved = localStorage.getItem(DEVICE_KEY);
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
      saved = uuid();
      localStorage.setItem(DEVICE_KEY, saved);
      return saved;
    } catch (e) {
      if (!ephemeralDeviceId) ephemeralDeviceId = uuid();
      return ephemeralDeviceId;
    }
  }

  function isAdminUser(user) {
    var meta = user && user.app_metadata ? user.app_metadata : {};
    var roles = Array.isArray(meta.roles) ? meta.roles : [];
    return String(meta.role || '').toLowerCase() === 'admin' ||
      roles.some(function (role) { return String(role).toLowerCase() === 'admin'; });
  }

  function getSession() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (result) {
      if (result.error) throw result.error;
      return result.data && result.data.session ? result.data.session : null;
    });
  }

  function isAdmin() {
    return Promise.resolve(adminAuthorized);
  }

  function fingerprint(records) {
    var maxUpdated = 0;
    var maxCreated = 0;
    (records || []).forEach(function (record) {
      maxUpdated = Math.max(maxUpdated, Number(record.updatedAt) || 0);
      maxCreated = Math.max(maxCreated, Number(record.createdAt) || 0);
    });
    return String((records || []).length) + '|' + String(maxUpdated) + '|' + String(maxCreated);
  }

  function kaydet(records) {
    if (isE2ETestMode()) return Promise.resolve({ ok: true, skipped: true, count: 0 });
    if (!client) return Promise.resolve({ ok: false, error: initError || 'Supabase bağlantısı hazır değil.' });
    var list = (Array.isArray(records) ? records : []).filter(function (record) {
      return record && record.id && record.symbol && record.timeframe && record.decision;
    });
    if (!list.length) return Promise.resolve({ ok: true, count: 0 });

    var index = 0;
    var touched = 0;
    function worker() {
      if (index >= list.length) return Promise.resolve({ ok: true, count: touched });
      var batch = list.slice(index, index + BATCH_SIZE);
      index += BATCH_SIZE;
      var rows = batch.map(function (record) {
        return { device_id: deviceId(), record: record };
      });
      return client.rpc('grap_ai_shared_signals_upsert', { p_records: rows }).then(function (result) {
        if (result.error) throw result.error;
        touched += Number(result.data) || 0;
        return worker();
      });
    }
    return worker().then(function (result) {
      lastSyncFingerprint = null;
      return result;
    }).catch(function (error) {
      console.warn('Grap-AI ortak havuz kayıt gönderimi başarısız:', error && error.message ? error.message : error);
      return { ok: false, error: error && error.message ? error.message : String(error) };
    });
  }

  function syncLocal(records) {
    var list = Array.isArray(records) ? records : [];
    var current = fingerprint(list);
    if (current === lastSyncFingerprint) return Promise.resolve({ ok: true, skipped: true, count: 0 });
    return kaydet(list).then(function (result) {
      if (result.ok) lastSyncFingerprint = current;
      return result;
    });
  }

  function patchMany(patches) {
    if (isE2ETestMode()) return Promise.resolve({ ok: true, skipped: true, count: 0 });
    if (!client) return Promise.resolve({ ok: false, error: initError || 'Supabase bağlantısı hazır değil.' });
    var allowed = [
      'decision', 'generalDecision', 'technicalDecision', 'volumeDecision',
      'tradeStatus', 'tradeResult', 'spotStatus', 'spotResult',
      'directionStatus', 'forwardPct', 'directionResult', 'waitResult',
      'lastCheckedAt', 'nextCheckAt', 'lastError', 'updatedAt',
      'score', 'trend', 'rsi', 'auditorError', 'auditorWarningCount',
      'fundamentalStatus', 'fkPE', 'fkValuation', 'fkVeto', 'priceForecast'
    ];
    var list = (Array.isArray(patches) ? patches : []).map(function (item) {
      var clean = {};
      var patch = item && item.patch ? item.patch : {};
      allowed.forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) clean[key] = patch[key];
      });
      return item && item.id && Object.keys(clean).length
        ? { signal_id: String(item.id), patch: clean } : null;
    }).filter(Boolean);
    if (!list.length) return Promise.resolve({ ok: true, count: 0 });

    return isAdmin().then(function (admin) {
      if (!admin) return { ok: true, skipped: true, count: 0 };
      var index = 0;
      var touched = 0;
      function worker() {
        if (index >= list.length) return Promise.resolve({ ok: true, count: touched });
        var batch = list.slice(index, index + BATCH_SIZE);
        index += BATCH_SIZE;
        return client.rpc('grap_ai_shared_signals_patch', { p_patches: batch }).then(function (result) {
          if (result.error) throw result.error;
          touched += Number(result.data) || 0;
          return worker();
        });
      }
      return worker();
    }).catch(function (error) {
      console.warn('Grap-AI ortak havuz sonuç güncellemesi başarısız:', error && error.message ? error.message : error);
      return { ok: false, error: error && error.message ? error.message : String(error) };
    });
  }

  function adminRecords() {
    if (isE2ETestMode()) return Promise.resolve({ records: [], isAdmin: false, error: null });
    if (!adminAuthorized) {
      return Promise.resolve({ records: [], isAdmin: false, error: null });
    }
    var cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    var prune = Date.now() - lastPruneAt < 24 * 60 * 60 * 1000
      ? Promise.resolve()
      : client.rpc('grap_ai_shared_signals_prune').then(function (pruneResult) {
          if (pruneResult.error) throw pruneResult.error;
          lastPruneAt = Date.now();
        });
    return prune.then(function () {
      var offset = 0;
      var rows = [];
      function readPage() {
        return client.from(TABLE)
          .select('signal_id, device_id, device_ids, payload, created_at, updated_at')
          .gte('created_at', cutoff)
          .not('symbol', 'like', 'E2E%')
          .order('signal_at', { ascending: false })
          .range(offset, offset + 999)
          .then(function (result) {
            if (result.error) throw result.error;
            var page = Array.isArray(result.data) ? result.data : [];
            rows = rows.concat(page);
            offset += page.length;
            if (page.length === 1000 && offset < 50000) return readPage();
            return rows;
          });
      }
      return readPage().then(function (data) {
        var records = data.map(function (row) {
          var payload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
          var dbCreated = Date.parse(row.created_at) || Date.now();
          var dbUpdated = Date.parse(row.updated_at) || dbCreated;
          return Object.assign({}, payload, {
            id: row.signal_id,
            deviceId: row.device_id || null,
            deviceIds: Array.isArray(row.device_ids) ? row.device_ids : [],
            sharedPool: true,
            createdAt: Number(payload.createdAt) || dbCreated,
            updatedAt: Number(payload.updatedAt) || dbUpdated
          });
        }).filter(function (record) { return !isTestSignal(record); });
        return { records: records, isAdmin: true, error: null };
      });
    }).catch(function (error) {
      return { records: [], isAdmin: true, error: error && error.message ? error.message : String(error) };
    });
  }
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (error) {
      initError = error && error.message ? error.message : String(error);
    }
  } else {
    initError = 'Supabase istemci kütüphanesi yüklenemedi.';
  }

  window.GrapAISharedResults = {
    client: client,
    deviceId: deviceId,
    isAdmin: isAdmin,
    kaydet: kaydet,
    syncLocal: syncLocal,
    adminRecords: adminRecords,
    patchMany: patchMany,
    setAdminAccess: function (allowed) { adminAuthorized = Boolean(allowed); },
    hata: function () { return initError; }
  };
})();