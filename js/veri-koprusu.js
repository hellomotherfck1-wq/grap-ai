(function () {
  'use strict';

  var PREFIX = 'grap-ai-data-cache-v1:';
  var DEFAULT_TIMEOUT = 6500;
  var DEFAULT_TTL = 5 * 60 * 1000;
  var DEFAULT_STALE = 24 * 60 * 60 * 1000;
  var MAX_RESPONSE_CHARS = 1500000;
  var inflight = new Map();
  var memory = new Map();
  var routeHealth = Object.create(null);
  var lastInfo = Object.create(null);

  var routes = [
    {
      id: 'cloudflare-worker',
      name: 'Cloudflare Worker',
      url: function (target) {
        return 'https://grafik-vekil.hellomotherfck1.workers.dev/?u=' + encodeURIComponent(target);
      }
    },
    {
      id: 'allorigins',
      name: 'AllOrigins',
      url: function (target) {
        return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(target);
      }
    },
    {
      id: 'corsproxy',
      name: 'CORS proxy',
      url: function (target) {
        return 'https://corsproxy.io/?' + encodeURIComponent(target);
      }
    }
  ];

  function makeKey(url, type) {
    return PREFIX + type + ':' + encodeURIComponent(String(url));
  }

  function storageGet(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Number.isFinite(Number(parsed.savedAt)) ||
          !Object.prototype.hasOwnProperty.call(parsed, 'value')) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function cacheRead(key) {
    if (memory.has(key)) return memory.get(key);
    var saved = storageGet(key);
    if (saved) memory.set(key, saved);
    return saved;
  }

  function cacheWrite(key, value) {
    var entry = { savedAt: Date.now(), value: value };
    memory.set(key, entry);
    try {
      var raw = JSON.stringify(entry);
      if (raw.length <= MAX_RESPONSE_CHARS) window.localStorage.setItem(key, raw);
    } catch (e) {
      // Storage may be disabled or full; the in-memory cache still works.
    }
    return entry;
  }

  function cacheRemove(key) {
    memory.delete(key);
    try { window.localStorage.removeItem(key); } catch (e) {}
  }

  function valid(value, validator) {
    if (typeof validator !== 'function') return true;
    try { return validator(value) !== false; } catch (e) { return false; }
  }

  function routeKey(route, target) {
    var host = 'unknown';
    try { host = new URL(String(target)).hostname || host; } catch (e) {}
    return route.id + '|' + host;
  }

  function routeState(route, target) {
    var key = routeKey(route, target);
    if (!routeHealth[key]) routeHealth[key] = { failures: 0, blockedUntil: 0 };
    return routeHealth[key];
  }

  function markRouteFailure(route, target, error) {
    var state = routeState(route, target);
    state.failures = Math.min(3, state.failures + 1);
    var delays = [0, 15000, 45000, 120000];
    state.blockedUntil = Date.now() + delays[state.failures];
    state.lastError = String(error && error.message ? error.message : error || 'Bilinmeyen hata').slice(0, 160);
  }

  function markRouteSuccess(route, target) {
    routeHealth[routeKey(route, target)] = { failures: 0, blockedUntil: 0, lastError: null };
  }

  async function readRoute(route, target, type, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    var request = (async function () {
      var options = { method: 'GET', cache: 'no-store' };
      if (controller) options.signal = controller.signal;
      var response = await fetch(route.url(target), options);
      if (!response || !response.ok) {
        throw new Error('HTTP ' + (response ? response.status : 'yanıt yok'));
      }
      var body = await response.text();
      if (typeof body !== 'string' || body.length > MAX_RESPONSE_CHARS) {
        throw new Error('Yanıt boş veya izin verilen boyuttan büyük');
      }
      if (type === 'text') return body;
      try {
        return JSON.parse(body.replace(/^\uFEFF/, '').trim());
      } catch (error) {
        throw new Error('JSON yanıtı okunamadı');
      }
    })();

    var timeout = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error('Zaman aşımı (' + timeoutMs + ' ms)'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function load(url, type, options, key, cached) {
    var timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_TIMEOUT);
    var failures = [];

    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      var state = routeState(route, url);
      if (state.blockedUntil > Date.now()) {
        failures.push(route.name + ': geçici olarak beklemede');
        continue;
      }

      try {
        var value = await readRoute(route, url, type, timeoutMs);
        if (!valid(value, options.validate)) {
          throw new Error('Kaynak yanıtı beklenen veri biçiminde değil');
        }
        markRouteSuccess(route, url);
        cacheWrite(key, value);
        lastInfo[key] = {
          cached: false,
          stale: false,
          route: route.name,
          fetchedAt: new Date().toISOString()
        };
        return value;
      } catch (error) {
        markRouteFailure(route, url, error);
        failures.push(route.name + ': ' + String(error && error.message ? error.message : error));
      }
    }

    var staleMaxAgeMs = options.staleMaxAgeMs == null ? DEFAULT_STALE : Math.max(0, Number(options.staleMaxAgeMs) || 0);
    var age = cached ? Math.max(0, Date.now() - cached.savedAt) : Infinity;
    if (cached && age <= staleMaxAgeMs && valid(cached.value, options.validate)) {
      lastInfo[key] = {
        cached: true,
        stale: true,
        route: 'Yerel önbellek',
        ageMs: age,
        fetchedAt: new Date(cached.savedAt).toISOString()
      };
      return cached.value;
    }

    var finalError = new Error('Veri aktarım servisleri yanıt vermedi: ' + failures.join(' · '));
    if (window.GrapAISystemMonitor &&
        typeof window.GrapAISystemMonitor.apiFailure === 'function') {
      window.GrapAISystemMonitor.apiFailure(url, finalError, {
        service: 'shared-data-transport',
        responseType: type,
        providers: failures,
        final: true
      });
      finalError.grapAiLogged = true;
    }
    lastInfo[key] = {
      cached: false,
      stale: false,
      failed: true,
      providers: failures,
      failedAt: new Date().toISOString()
    };
    throw finalError;
  }

  function request(url, type, options) {
    options = options || {};
    var target = String(url || '');
    var parsed;
    try { parsed = new URL(target, window.location.href); } catch (e) {
      return Promise.reject(new Error('Geçersiz veri kaynağı adresi'));
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return Promise.reject(new Error('Yalnızca HTTP/HTTPS veri kaynakları desteklenir'));
    }

    var key = makeKey(target, type);
    var ttlMs = options.cacheTtlMs == null ? DEFAULT_TTL : Math.max(0, Number(options.cacheTtlMs) || 0);
    var cached = cacheRead(key);
    var age = cached ? Math.max(0, Date.now() - cached.savedAt) : Infinity;

    if (cached && ttlMs > 0 && age <= ttlMs && valid(cached.value, options.validate)) {
      lastInfo[key] = {
        cached: true,
        stale: false,
        route: 'Önbellek',
        ageMs: age,
        fetchedAt: new Date(cached.savedAt).toISOString()
      };
      return Promise.resolve(cached.value);
    }
    if (cached && !valid(cached.value, options.validate)) {
      cacheRemove(key);
      cached = null;
    }

    if (inflight.has(key)) return inflight.get(key);
    var promise = load(target, type, options, key, cached).finally(function () {
      inflight.delete(key);
    });
    inflight.set(key, promise);
    return promise;
  }

  window.GrapAIDataTransport = {
    json: function (url, options) { return request(url, 'json', options); },
    text: function (url, options) { return request(url, 'text', options); },
    info: function (url, type) {
      return lastInfo[makeKey(url, type || 'json')] || null;
    },
    health: function () {
      return routes.map(function (route) {
        var prefix = route.id + '|';
        var hosts = Object.keys(routeHealth).filter(function (key) {
          return key.indexOf(prefix) === 0;
        }).map(function (key) {
          var state = routeHealth[key];
          return {
            host: key.slice(prefix.length),
            failures: state.failures,
            coolingDown: state.blockedUntil > Date.now(),
            retryAfterMs: Math.max(0, state.blockedUntil - Date.now()),
            lastError: state.lastError || null
          };
        });
        return { provider: route.name, hosts: hosts };
      });
    },
    clear: function () {
      memory.clear();
      routeHealth = Object.create(null);
      lastInfo = Object.create(null);
      try {
        var keys = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var key = window.localStorage.key(i);
          if (key && key.indexOf(PREFIX) === 0) keys.push(key);
        }
        keys.forEach(function (key) { window.localStorage.removeItem(key); });
      } catch (e) {}
    }
  };
})();
