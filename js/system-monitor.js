(function () {
  'use strict';

  var shared = window.GrapAISharedResults;
  var client = shared && shared.client;
  if (!client || typeof client.rpc !== 'function') return;

  var DEVICE_KEY = 'grap-ai-system-monitor-device-v1';
  var lastLogged = Object.create(null);
  var monitoredHosts = [
    'binance.com', 'binance.vision', 'finance.yahoo.com',
    'grafik-vekil.hellomotherfck1.workers.dev', 'allorigins.win',
    'news.google.com', 'kap.org.tr'
  ];

  function deviceId() {
    try {
      var saved = localStorage.getItem(DEVICE_KEY);
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
      saved = window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 3 | 8)).toString(16);
          });
      localStorage.setItem(DEVICE_KEY, saved);
      return saved;
    } catch (e) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      });
    }
  }

  function safeMessage(value) {
    return String(value || 'Bilinmeyen hata')
      .replace(/https?:\/\/\S+/gi, '[adres]')
      .replace(/\b(?:Bearer|apikey)\s+\S+/gi, '[gizli bilgi]')
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, 450);
  }

  function safeSource(value) {
    try {
      var url = new URL(String(value || ''), window.location.href);
      return (url.origin === window.location.origin ? '' : url.hostname) +
        (url.pathname || '/');
    } catch (e) {
      return String(value || 'unknown').split('?')[0].slice(0, 180);
    }
  }

  function log(type, source, message, details) {
    var id = deviceId();
    if (!id) return;
    var cleanMessage = safeMessage(message);
    var key = type + '|' + safeSource(source) + '|' + cleanMessage;
    var now = Date.now();
    if (lastLogged[key] && now - lastLogged[key] < 120000) return;
    lastLogged[key] = now;

    Promise.resolve(client.rpc('grap_ai_log_system_event', {
      p_event_type: type,
      p_source: safeSource(source),
      p_message: cleanMessage,
      p_details: details && typeof details === 'object' ? details : {},
      p_device_id: id
    })).then(function (result) {
      if (result && result.error) {
        console.warn('Grap-AI hata kaydı gönderilemedi:', result.error.message);
      }
    }).catch(function (error) {
      console.warn('Grap-AI hata kaydı gönderilemedi:', error && error.message ? error.message : error);
    });
  }

  window.addEventListener('error', function (event) {
    if (event.target && event.target !== window) {
      var target = event.target;
      var source = target.src || target.href || target.currentSrc || 'kaynak';
      log('resource_error', source, 'Kaynak yüklenemedi', {
        tag: String(target.tagName || 'unknown').slice(0, 30)
      });
      return;
    }
    log('js_error', event.filename || 'window', event.message || 'JavaScript hatası', {
      line: Number(event.lineno) || 0,
      column: Number(event.colno) || 0
    });
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    log('unhandled_rejection', 'window',
      reason && reason.message ? reason.message : String(reason || 'İşlenmeyen Promise hatası'), {});
  });

  var originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function (input, init) {
      var rawUrl = typeof input === 'string' ? input : input && input.url ? input.url : '';
      var host = '';
      try { host = new URL(rawUrl, window.location.href).hostname; } catch (e) {}
      var tracked = monitoredHosts.some(function (item) {
        return host === item || host.endsWith('.' + item);
      });

      return originalFetch.apply(this, arguments).then(function (response) {
        if (tracked && !response.ok) {
          log('api_error', rawUrl, 'HTTP ' + response.status, { status: response.status });
        }
        return response;
      }).catch(function (error) {
        if (tracked) {
          log('api_error', rawUrl, error && error.message ? error.message : 'Veri kaynağına erişilemedi', {});
        }
        throw error;
      });
    };
  }

  window.GrapAISystemMonitor = { log: log };
  var pendingErrors = Array.isArray(window.__GrapAISystemPendingErrors)
    ? window.__GrapAISystemPendingErrors.slice(0, 30) : [];
  window.__GrapAISystemPendingErrors = [];
  pendingErrors.forEach(function (item) {
    if (item) log(item.type, item.source, item.message, item.details);
  });
})();