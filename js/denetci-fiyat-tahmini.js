(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GrapAIDenetciFiyatTahmini = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var STEP_MS = 15 * 60 * 1000;
  var HORIZON = 5;
  var PATTERN_LENGTH = 10;
  var MIN_BARS = 60;
  var NEIGHBORS = 7;
  var MODEL_VERSION = 'auditor-price-5bar-knn-v1';

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function median(values) {
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    if (!sorted.length) return null;
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function quantile(values, q) {
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    if (!sorted.length) return null;
    var position = (sorted.length - 1) * q;
    var lower = Math.floor(position);
    var upper = Math.ceil(position);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  function normalizeBars(input, now) {
    var currentTime = finite(now) ? now : Date.now();
    var byTime = new Map();
    (Array.isArray(input) ? input : []).forEach(function (bar) {
      if (!bar || typeof bar !== 'object') return;
      var t = Number(bar.t);
      var o = Number(bar.o);
      var h = Number(bar.h);
      var l = Number(bar.l);
      var c = Number(bar.c);
      if (![t, o, h, l, c].every(Number.isFinite) ||
          t <= 0 || t + STEP_MS > currentTime ||
          o <= 0 || h <= 0 || l <= 0 || c <= 0 ||
          h < Math.max(o, c) || l > Math.min(o, c) || h < l) return;
      if (bar.closeTime !== null && bar.closeTime !== undefined) {
        var closeTime = Number(bar.closeTime);
        if (!Number.isFinite(closeTime) || closeTime < t || closeTime >= currentTime) return;
      }
      var volume = null;
      if (bar.v !== null && bar.v !== undefined && bar.v !== '') {
        var parsedVolume = Number(bar.v);
        if (Number.isFinite(parsedVolume) && parsedVolume >= 0) volume = parsedVolume;
      }
      byTime.set(t, { t: t, o: o, h: h, l: l, c: c, v: volume });
    });
    return Array.from(byTime.values()).sort(function (a, b) { return a.t - b.t; });
  }

  function volumePressure(bars, start, end) {
    var weighted = 0;
    var total = 0;
    for (var i = start; i <= end; i++) {
      var bar = bars[i];
      if (!finite(bar.v) || bar.v <= 0) continue;
      var range = bar.h - bar.l;
      if (!(range > 0)) continue;
      weighted += bar.v * ((bar.c - bar.o) / range);
      total += bar.v;
    }
    return total > 0 ? weighted / total : null;
  }

  function patternFeatures(bars, endIndex) {
    var returns = [];
    for (var i = endIndex - PATTERN_LENGTH + 1; i <= endIndex; i++) {
      var previous = bars[i - 1].c;
      var current = bars[i].c;
      if (!(previous > 0) || !(current > 0)) return null;
      returns.push(Math.log(current / previous));
    }
    var squareTotal = returns.reduce(function (sum, value) {
      return sum + value * value;
    }, 0);
    var scale = Math.sqrt(squareTotal / returns.length);
    var divisor = Math.max(scale, 1e-8);
    return {
      shape: returns.map(function (value) { return value / divisor; }),
      scale: divisor,
      pressure: volumePressure(bars, endIndex - PATTERN_LENGTH + 1, endIndex)
    };
  }

  function distance(a, b) {
    var total = 0;
    for (var i = 0; i < a.shape.length; i++) {
      var delta = a.shape[i] - b.shape[i];
      total += delta * delta;
    }
    var shapeDistance = Math.sqrt(total / a.shape.length);
    var scaleDistance = Math.abs(Math.log(a.scale / b.scale));
    var volumeDistance = a.pressure === null || b.pressure === null
      ? 0 : Math.abs(a.pressure - b.pressure);
    return shapeDistance + 0.20 * scaleDistance + 0.10 * volumeDistance;
  }

  function unavailable(reason) {
    return { status: 'unavailable', reason: reason, modelVersion: MODEL_VERSION };
  }

  function olustur(inputBars, meta, now) {
    meta = meta || {};
    var currentTime = finite(now) ? now : Date.now();
    if (meta.timeframe !== '15m') return null;
    if (!meta.sourceInfo || meta.sourceInfo.failed || meta.sourceInfo.stale) {
      return unavailable('Veri kaynağının güncelliği doğrulanamadı.');
    }
    if (Number(meta.intervalMs) !== STEP_MS) {
      return unavailable('Kaynak zaman dilimi 15 dakikalık olarak doğrulanamadı.');
    }

    var fetchedAt = Number(meta.fetchedAt);
    if (!Number.isFinite(fetchedAt) && meta.sourceInfo && meta.sourceInfo.fetchedAt) {
      fetchedAt = Date.parse(meta.sourceInfo.fetchedAt);
    }
    if (!Number.isFinite(fetchedAt) || fetchedAt > currentTime + 60000 ||
        currentTime - fetchedAt > 30 * 60 * 1000) {
      return unavailable('Gerçek veri alım zamanı güncel değil.');
    }

    var bars = normalizeBars(inputBars, currentTime);
    if (bars.length < MIN_BARS) {
      return unavailable('En az ' + MIN_BARS + ' kapanmış 15 dakikalık mum gerekli; bulunan: ' + bars.length + '.');
    }
    var last = bars[bars.length - 1];
    if (currentTime - (last.t + STEP_MS) > 3 * STEP_MS) {
      return unavailable('Son kapanmış 15 dakikalık mum eski; yeni ve doğrulanmış veri bekleniyor.');
    }
    if (finite(Number(meta.lastClosedAt)) &&
        Math.abs(Number(meta.lastClosedAt) - last.t) > STEP_MS) {
      return unavailable('Analiz mumu ile tahmin verisinin son mum zamanı eşleşmiyor.');
    }

    var currentFeatures = patternFeatures(bars, bars.length - 1);
    if (!currentFeatures) return unavailable('Son 10 mumun fiyat dizisi hesaplanamadı.');

    var candidates = [];
    // Adayların beş mumluk sonucu, bugünkü 10 mumluk örüntünün başlangıcından
    // önce bitmelidir. Böylece tahmin anından sonraki hiçbir veri örnek olarak sızmaz.
    var lastCandidateEnd = bars.length - PATTERN_LENGTH - HORIZON - 2;
    for (var endIndex = PATTERN_LENGTH; endIndex <= lastCandidateEnd; endIndex++) {
      var features = patternFeatures(bars, endIndex);
      if (!features) continue;
      var futureClose = bars[endIndex + HORIZON].c;
      var baseClose = bars[endIndex].c;
      if (!(futureClose > 0) || !(baseClose > 0)) continue;
      candidates.push({
        index: endIndex,
        distance: distance(currentFeatures, features),
        forwardReturn: Math.log(futureClose / baseClose),
        pressure: features.pressure
      });
    }
    if (candidates.length < NEIGHBORS) {
      return unavailable('Benzer geçmiş örüntü sayısı tahmin için yetersiz.');
    }

    candidates.sort(function (a, b) {
      return a.distance - b.distance || a.index - b.index;
    });
    var selected = [];
    candidates.forEach(function (candidate) {
      if (selected.length >= NEIGHBORS) return;
      if (selected.every(function (item) { return Math.abs(item.index - candidate.index) >= HORIZON; })) {
        selected.push(candidate);
      }
    });
    if (selected.length < 5) {
      return unavailable('Birbirinden yeterince ayrışan geçmiş örnek sayısı yetersiz.');
    }

    var outcomes = selected.map(function (item) { return item.forwardReturn; });
    var expectedReturn = median(outcomes);
    var lowReturn = quantile(outcomes, 0.20);
    var highReturn = quantile(outcomes, 0.80);
    var basePrice = last.c;
    var signalAt = last.t + STEP_MS;
    var volumeUsed = currentFeatures.pressure !== null &&
      selected.every(function (item) { return item.pressure !== null; });

    return {
      status: 'pending',
      modelVersion: MODEL_VERSION,
      method: '10 mumluk geçmiş örüntü benzerliği; en yakın 7 geçmiş örneğin sonraki 5 mum getirisi medyanı',
      timeframe: '15m',
      horizonBars: HORIZON,
      basePrice: basePrice,
      predictedPrice: basePrice * Math.exp(expectedReturn),
      predictedLow: basePrice * Math.exp(lowReturn),
      predictedHigh: basePrice * Math.exp(highReturn),
      predictedChangePct: (Math.exp(expectedReturn) - 1) * 100,
      historicalSampleCount: selected.length,
      historicalCandidateCount: candidates.length,
      nearestDistance: selected[0].distance,
      volumeUsed: volumeUsed,
      source: String(meta.source || 'Bilinmeyen kaynak').slice(0, 60),
      sourceRoute: String(meta.sourceInfo && meta.sourceInfo.route || meta.source || 'Bilinmeyen').slice(0, 80),
      sourceFetchedAt: fetchedAt,
      lastClosedCandleAt: last.t,
      signalAt: signalAt,
      dueAt: signalAt + HORIZON * STEP_MS,
      createdAt: currentTime
    };
  }

  function degerlendir(record, inputBars, now) {
    if (!record || record.timeframe !== '15m' ||
        !record.priceForecast || record.priceForecast.status !== 'pending') return null;
    var forecast = record.priceForecast;
    var currentTime = finite(now) ? now : Date.now();
    var signalAt = Number(forecast.signalAt || record.signalAt);
    var basePrice = Number(forecast.basePrice || record.price);
    var predictedPrice = Number(forecast.predictedPrice);
    if (!Number.isFinite(signalAt) || signalAt <= 0 ||
        !Number.isFinite(basePrice) || basePrice <= 0 ||
        !Number.isFinite(predictedPrice) || predictedPrice <= 0 ||
        Number(forecast.horizonBars) !== HORIZON) return null;

    var future = normalizeBars(inputBars, currentTime).filter(function (bar) {
      return bar.t >= signalAt;
    }).sort(function (a, b) { return a.t - b.t; });
    if (future.length < HORIZON) return null;
    var sample = future.slice(0, HORIZON);
    var actualBar = sample[HORIZON - 1];
    var actualPrice = actualBar.c;
    if (!(actualPrice > 0)) return null;

    var predictedChangePct = (predictedPrice / basePrice - 1) * 100;
    var actualChangePct = (actualPrice / basePrice - 1) * 100;
    var signedErrorPct = (predictedPrice / actualPrice - 1) * 100;
    var highs = sample.map(function (bar) { return bar.h; });
    var lows = sample.map(function (bar) { return bar.l; });
    var predictedDirection = Math.sign(predictedChangePct);
    var actualDirection = Math.sign(actualChangePct);

    return Object.assign({}, forecast, {
      status: 'completed',
      actualPrice: actualPrice,
      actualAt: actualBar.t + STEP_MS,
      actualLastCandleAt: actualBar.t,
      actualHigh: Math.max.apply(null, highs),
      actualLow: Math.min.apply(null, lows),
      actualChangePct: actualChangePct,
      predictedChangePct: predictedChangePct,
      signedErrorPct: signedErrorPct,
      absoluteErrorPct: Math.abs(predictedPrice - actualPrice) / actualPrice * 100,
      predictedDirection: predictedDirection > 0 ? 'up' : predictedDirection < 0 ? 'down' : 'flat',
      actualDirection: actualDirection > 0 ? 'up' : actualDirection < 0 ? 'down' : 'flat',
      directionCorrect: predictedDirection === actualDirection,
      evaluatedBars: HORIZON,
      evaluatedAt: currentTime
    });
  }

  return {
    intervalMs: function () { return STEP_MS; },
    normalizeBars: normalizeBars,
    olustur: olustur,
    degerlendir: degerlendir,
    modelVersion: MODEL_VERSION
  };
});
