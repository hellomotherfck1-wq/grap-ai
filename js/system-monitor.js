(function () {
  'use strict';

  var shared = window.GrapAISharedResults;
  var client = shared && shared.client;
  if (!client || typeof client.rpc !== 'function') return;

  var DEVICE_KEY = 'grap-ai-system-monitor-device-v1';
  var lastLogged = Object.create(null);
  var ephemeralDeviceId = null;
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
      if (!ephemeralDeviceId) {
        ephemeralDeviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
      }
      return ephemeralDeviceId;
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


  function logApiFailure(source, error, details) {
    var info = details && typeof details === 'object' ? Object.assign({}, details) : {};
    info.final = true;
    log('api_error', source, error && error.message ? error.message : String(error || 'API isteği başarısız'), info);
  }

  // Do not monitor every fetch attempt globally: fallback providers commonly
  // return errors before a later provider succeeds. Call apiFailure only when
  // the whole application-level data operation has failed.
  window.GrapAISystemMonitor = { log: log, apiFailure: logApiFailure };
  var pendingErrors = Array.isArray(window.__GrapAISystemPendingErrors)
    ? window.__GrapAISystemPendingErrors.slice(0, 30) : [];
  window.__GrapAISystemPendingErrors = [];
  pendingErrors.forEach(function (item) {
    if (item) log(item.type, item.source, item.message, item.details);
  });
})();