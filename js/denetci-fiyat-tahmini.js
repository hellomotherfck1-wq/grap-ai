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
  var MODEL_VERSION = 'auditor-price-5bar-chart-v3';

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

  function isContiguous(bars, start, end) {
    if (!Array.isArray(bars) || start < 0 || end >= bars.length || end < start) return false;
    for (var i = start + 1; i <= end; i++) {
      if (bars[i].t - bars[i - 1].t !== STEP_MS) return false;
    }
    return true;
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

  function ema(values, period) {
    if (!Array.isArray(values) || !values.length) return null;
    var alpha = 2 / (period + 1);
    var value = values[0];
    for (var i = 1; i < values.length; i++) {
      value = values[i] * alpha + value * (1 - alpha);
    }
    return value;
  }

  function rsi(values, period) {
    if (!Array.isArray(values) || values.length < period + 1) return null;
    var gains = 0, losses = 0;
    for (var i = 1; i <= period; i++) {
      var change = values[i] - values[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    gains /= period;
    losses /= period;
    for (var j = period + 1; j < values.length; j++) {
      var delta = values[j] - values[j - 1];
      gains = (gains * (period - 1) + (delta > 0 ? delta : 0)) / period;
      losses = (losses * (period - 1) + (delta < 0 ? -delta : 0)) / period;
    }
    if (gains + losses === 0) return 50;
    if (losses === 0) return 100;
    if (gains === 0) return 0;
    return 100 * gains / (gains + losses);
  }

  function averageTrueRange(bars, endIndex, period) {
    var start = Math.max(1, endIndex - period + 1);
    var total = 0, count = 0;
    for (var i = start; i <= endIndex; i++) {
      var current = bars[i], previous = bars[i - 1];
      var tr = Math.max(
        current.h - current.l,
        Math.abs(current.h - previous.c),
        Math.abs(current.l - previous.c)
      );
      if (finite(tr) && tr >= 0) { total += tr; count++; }
    }
    return count ? total / count : null;
  }

  function supportResistance(bars, endIndex, close) {
    var support = null, resistance = null;
    var start = Math.max(2, endIndex - 39);
    // Yalnızca endIndex'e kadar tamamlanmış mumlarla iki taraflı pivot ara.
    for (var i = start; i <= endIndex - 2; i++) {
      var bar = bars[i];
      var pivotHigh = bar.h >= bars[i - 2].h && bar.h >= bars[i - 1].h &&
        bar.h >= bars[i + 1].h && bar.h >= bars[i + 2].h;
      var pivotLow = bar.l <= bars[i - 2].l && bar.l <= bars[i - 1].l &&
        bar.l <= bars[i + 1].l && bar.l <= bars[i + 2].l;
      if (pivotLow && bar.l < close) support = support === null ? bar.l : Math.max(support, bar.l);
      if (pivotHigh && bar.h > close) resistance = resistance === null ? bar.h : Math.min(resistance, bar.h);
    }
    // Pivot bulunamazsa, son 40 kapanmış mumdaki en yakın gerçek aralığı kullan.
    if (support === null || resistance === null) {
      for (var j = Math.max(0, endIndex - 39); j < endIndex; j++) {
        if (support === null && bars[j].l < close) {
          support = support === null ? bars[j].l : Math.max(support, bars[j].l);
        } else if (support !== null && bars[j].l < close && bars[j].l > support) {
          support = bars[j].l;
        }
        if (resistance === null && bars[j].h > close) {
          resistance = resistance === null ? bars[j].h : Math.min(resistance, bars[j].h);
        } else if (resistance !== null && bars[j].h > close && bars[j].h < resistance) {
          resistance = bars[j].h;
        }
      }
    }
    return { support: support, resistance: resistance };
  }

  function lastCandlePattern(bars, endIndex) {
    var current = bars[endIndex];
    var previous = bars[endIndex - 1];
    var range = current.h - current.l;
    if (!(range > 0)) return 'Belirsiz mum';
    var body = Math.abs(current.c - current.o);
    var upper = current.h - Math.max(current.o, current.c);
    var lower = Math.min(current.o, current.c) - current.l;
    if (body <= range * 0.10) return 'Doji (kararsızlık)';
    if (lower >= body * 2 && upper <= body) return 'Çekiç benzeri mum';
    if (upper >= body * 2 && lower <= body) return 'Kayan yıldız benzeri mum';
    if (previous) {
      var previousBody = Math.abs(previous.c - previous.o);
      var currentBull = current.c > current.o;
      var previousBull = previous.c > previous.o;
      if (currentBull && !previousBull && body > previousBody &&
          current.o <= previous.c && current.c >= previous.o) return 'Yutan boğa mumu';
      if (!currentBull && previousBull && body > previousBody &&
          current.o >= previous.c && current.c <= previous.o) return 'Yutan ayı mumu';
    }
    return 'Belirgin formasyon yok';
  }

  function chartFeatures(bars, endIndex) {
    var closes = bars.slice(0, endIndex + 1).map(function (bar) { return bar.c; });
    var last = bars[endIndex];
    var atrValue = averageTrueRange(bars, endIndex, 14);
    var ema9 = ema(closes.slice(-Math.min(closes.length, 60)), 9);
    var ema21 = ema(closes.slice(-Math.min(closes.length, 60)), 21);
    var safeAtr = finite(atrValue) && atrValue > 0 ? atrValue : Math.max(last.c * 1e-8, 1e-8);
    var trend = (ema9 - ema21) / safeAtr;
    var momentumBase = bars[Math.max(0, endIndex - 5)].c;
    var momentumLog = Math.log(last.c / momentumBase);
    var atrPct = safeAtr / last.c;
    var momentum = momentumLog / Math.max(atrPct * Math.sqrt(5), 1e-8);
    var momentumPct = (Math.exp(momentumLog) - 1) * 100;
    var levels = supportResistance(bars, endIndex, last.c);
    var candleShapes = [];
    for (var i = Math.max(0, endIndex - 4); i <= endIndex; i++) {
      var bar = bars[i];
      var range = Math.max(bar.h - bar.l, 1e-12);
      candleShapes.push([
        (bar.c - bar.o) / range,
        (bar.h - Math.max(bar.o, bar.c)) / range,
        (Math.min(bar.o, bar.c) - bar.l) / range,
        (bar.c - bar.l) / range
      ]);
    }
    return {
      candles: candleShapes,
      trend: trend,
      momentum: momentum,
      momentumPct: momentumPct,
      rsi: rsi(closes, 14),
      support: levels.support,
      resistance: levels.resistance,
      supportDistance: levels.support === null ? 5 : Math.min((last.c - levels.support) / safeAtr, 5),
      resistanceDistance: levels.resistance === null ? 5 : Math.min((levels.resistance - last.c) / safeAtr, 5),
      pressure: volumePressure(bars, Math.max(0, endIndex - PATTERN_LENGTH + 1), endIndex),
      lastCandle: lastCandlePattern(bars, endIndex)
    };
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
    var chart = chartFeatures(bars, endIndex);
    return {
      shape: returns.map(function (value) { return value / divisor; }),
      scale: divisor,
      pressure: chart.pressure,
      candles: chart.candles,
      trend: chart.trend,
      momentum: chart.momentum,
      rsi: chart.rsi,
      supportDistance: chart.supportDistance,
      resistanceDistance: chart.resistanceDistance,
      chart: chart
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
    var candleTotal = 0, candleCount = 0;
    for (var j = 0; j < Math.min(a.candles.length, b.candles.length); j++) {
      for (var k = 0; k < Math.min(a.candles[j].length, b.candles[j].length); k++) {
        var candleDelta = a.candles[j][k] - b.candles[j][k];
        candleTotal += candleDelta * candleDelta;
        candleCount++;
      }
    }
    var candleDistance = candleCount ? Math.sqrt(candleTotal / candleCount) : 0;
    var bounded = function (x, y, divisor) {
      if (!finite(x) || !finite(y)) return 0;
      return Math.min(Math.abs(x - y) / divisor, 1);
    };
    var trendDistance = bounded(a.trend, b.trend, 4);
    var momentumDistance = bounded(a.momentum, b.momentum, 4);
    var rsiDistance = bounded(a.rsi, b.rsi, 50);
    var levelDistance = (bounded(a.supportDistance, b.supportDistance, 5) +
      bounded(a.resistanceDistance, b.resistanceDistance, 5)) / 2;
    return shapeDistance + 0.20 * scaleDistance + 0.10 * volumeDistance +
      0.16 * candleDistance + 0.14 * trendDistance + 0.10 * momentumDistance +
      0.08 * rsiDistance + 0.06 * levelDistance;
  }

  function chartRead(features) {
    var chart = features && features.chart ? features.chart : {};
    var trend = chart.trend > 0.20 ? 'Yükseliş' : chart.trend < -0.20 ? 'Düşüş' : 'Yatay';
    return {
      trend: trend,
      rsi: finite(chart.rsi) ? Math.round(chart.rsi * 10) / 10 : null,
      momentum5BarsPct: finite(chart.momentumPct) ? chart.momentumPct : null,
      lastCandle: String(chart.lastCandle || 'Belirsiz'),
      support: finite(chart.support) ? chart.support : null,
      resistance: finite(chart.resistance) ? chart.resistance : null,
      volumePressure: finite(chart.pressure) ? chart.pressure : null
    };
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
    if (!isContiguous(bars, bars.length - MIN_BARS, bars.length - 1)) {
      return unavailable('Son 60 kapanmış mumda 15 dakikalık veri boşluğu var; eksik mumlarla tahmin üretilmedi.');
    }
    var last = bars[bars.length - 1];
    if (currentTime - (last.t + STEP_MS) > 3 * STEP_MS) {
      return unavailable('Son kapanmış 15 dakikalık mum eski; yeni ve doğrulanmış veri bekleniyor.');
    }
    if (finite(Number(meta.lastClosedAt)) && Number(meta.lastClosedAt) !== last.t) {
      return unavailable('Analiz mumu ile tahmin verisinin son mum zamanı eşleşmiyor.');
    }

    var currentFeatures = patternFeatures(bars, bars.length - 1);
    if (!currentFeatures) return unavailable('Son 10 mumun fiyat dizisi hesaplanamadı.');

    var candidates = [];
    // Adayların beş mumluk sonucu, bugünkü 10 mumluk örüntünün başlangıcından
    // önce bitmelidir. Böylece tahmin anından sonraki hiçbir veri örnek olarak sızmaz.
    var lastCandidateEnd = bars.length - PATTERN_LENGTH - HORIZON - 2;
    for (var endIndex = Math.max(PATTERN_LENGTH, 20); endIndex <= lastCandidateEnd; endIndex++) {
      if (!isContiguous(bars, endIndex - PATTERN_LENGTH, endIndex + HORIZON)) continue;
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
      method: 'Grafik okuması (mum gövdeleri/fitilleri, EMA9-EMA21 trendi, RSI14, 5 mum momentumu, destek/direnç ve hacim) ile eşleştirilen geçmiş örüntülerin sonraki 5 mum getirisi',
      chartRead: chartRead(currentFeatures),
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
    for (var i = 0; i < sample.length; i++) {
      if (sample[i].t !== signalAt + i * STEP_MS) return null;
    }
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
    isContiguous: isContiguous,
    olustur: olustur,
    degerlendir: degerlendir,
    modelVersion: MODEL_VERSION
  };
});
