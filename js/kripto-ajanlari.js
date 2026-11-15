(function () {
  'use strict';

  var TF_MS = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  };
  var SURUM = 'crypto-intelligence-2.2.0';
  var candleCache = Object.create(null);

  function sayi(x) { return typeof x === 'number' && isFinite(x); }
  function yon(value) {
    var v = String(value || '').toLocaleLowerCase('tr-TR');
    if (v === 'al' || v === 'yükseliş' || v === 'yukselis') return 1;
    if (v === 'sat' || v === 'düşüş' || v === 'duşuş') return -1;
    return 0;
  }
  function ortalama(values) {
    return values.length ? values.reduce(function (sum, x) { return sum + x; }, 0) / values.length : null;
  }
  function medyan(values) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function trueRange(bars, index) {
    var current = bars[index], previous = bars[index - 1];
    return Math.max(current.h - current.l, Math.abs(current.h - previous.c), Math.abs(current.l - previous.c));
  }
  function atrSeries(bars) {
    var values = new Array(bars.length);
    if (bars.length < 15) return values;
    var total = 0;
    for (var i = 1; i <= 14; i++) total += trueRange(bars, i);
    var atr = total / 14;
    values[14] = atr;
    for (var j = 15; j < bars.length; j++) {
      atr = (atr * 13 + trueRange(bars, j)) / 14;
      values[j] = atr;
    }
    return values;
  }
  function adx14(bars) {
    if (!Array.isArray(bars) || bars.length < 29) return null;
    var tr = 0, plus = 0, minus = 0, dx = [];
    function movement(index) {
      var current = bars[index], previous = bars[index - 1];
      var up = current.h - previous.h;
      var down = previous.l - current.l;
      return {
        tr: trueRange(bars, index),
        plus: up > down && up > 0 ? up : 0,
        minus: down > up && down > 0 ? down : 0
      };
    }
    for (var i = 1; i <= 14; i++) {
      var initial = movement(i);
      tr += initial.tr; plus += initial.plus; minus += initial.minus;
    }
    for (var j = 14; j < bars.length; j++) {
      if (j > 14) {
        var next = movement(j);
        tr = tr - tr / 14 + next.tr;
        plus = plus - plus / 14 + next.plus;
        minus = minus - minus / 14 + next.minus;
      }
      var plusDi = tr > 0 ? 100 * plus / tr : 0;
      var minusDi = tr > 0 ? 100 * minus / tr : 0;
      var totalDi = plusDi + minusDi;
      dx.push(totalDi > 0 ? 100 * Math.abs(plusDi - minusDi) / totalDi : 0);
    }
    if (dx.length < 14) return null;
    var result = ortalama(dx.slice(0, 14));
    for (var k = 14; k < dx.length; k++) result = (result * 13 + dx[k]) / 14;
    return result;
  }
  function hacimDegeri(bar) {
    var quote = Number(bar && bar.quoteVolume);
    if (sayi(quote) && quote > 0) return quote;
    var volume = Number(bar && bar.v);
    return sayi(volume) && volume > 0 ? volume : null;
  }
  function breakoutRead(bars) {
    if (!Array.isArray(bars) || bars.length < 26) {
      return { direction: 'Yok', volumeRatio: null, confirmed: false };
    }
    var last = bars[bars.length - 1];
    var prior = bars.slice(-21, -1);
    var high = Math.max.apply(null, prior.map(function (bar) { return Number(bar.h); }));
    var low = Math.min.apply(null, prior.map(function (bar) { return Number(bar.l); }));
    var direction = last.c > high ? 'Yukarı' : last.c < low ? 'Aşağı' : 'Yok';
    var recent = bars.slice(-5).map(hacimDegeri).filter(sayi);
    var baseline = bars.slice(-25, -5).map(hacimDegeri).filter(sayi);
    var recentAverage = ortalama(recent), baselineAverage = ortalama(baseline);
    var volumeRatio = recentAverage > 0 && baselineAverage > 0 ? recentAverage / baselineAverage : null;
    return {
      direction: direction,
      volumeRatio: volumeRatio,
      confirmed: direction !== 'Yok' && sayi(volumeRatio) && volumeRatio >= 1.2
    };
  }
  function kapanmis(mumlar, tf) {
    if (window.Veri && typeof Veri.kapanmisMumlar === 'function') return Veri.kapanmisMumlar(mumlar, tf);
    var step = TF_MS[tf] || 0;
    var now = Date.now();
    return (Array.isArray(mumlar) ? mumlar : []).filter(function (m) {
      if (!m || !sayi(Number(m.t))) return false;
      if (m.closeTime !== null && m.closeTime !== undefined && sayi(Number(m.closeTime))) return Number(m.closeTime) < now;
      return step > 0 && Number(m.t) + step <= now;
    }).sort(function (a, b) { return Number(a.t) - Number(b.t); });
  }
  /* Binance Kline taker alım/satım hacmi; balina tespiti değildir. */
  function orderFlow(mumlar, timeframe) {
    var step = TF_MS[timeframe] || TF_MS['1h'];
    var rows = (Array.isArray(mumlar) ? mumlar : []).filter(function (m) {
      var quote = Number(m && m.quoteVolume);
      var buy = Number(m && m.takerBuyQuoteVolume);
      return m && sayi(quote) && quote > 0 && sayi(buy) && buy >= 0 && buy <= quote;
    }).slice(-30);
    if (rows.length < 15) {
      return { available: false, decision: 'BEKLE', score: 0, reason: 'Order Flow için yeterli Binance alım/satım hacmi yok.' };
    }
    var latest = rows[rows.length - 1];
    var latestAt = latest.closeTime != null ? Number(latest.closeTime) : Number(latest.t) + step - 1;
    if (!sayi(latestAt) || latestAt > Date.now() || Date.now() - latestAt > 2 * step) {
      return { available: false, decision: 'BEKLE', score: 0, reason: 'Order Flow verisi eski; ajan oy kullanmadı.' };
    }
    var recent = rows.slice(-5);
    var baseline = rows.slice(-25, -5);
    if (baseline.length < 10) {
      return { available: false, decision: 'BEKLE', score: 0, reason: 'Order Flow karşılaştırma geçmişi yetersiz.' };
    }
    function aggregate(list) {
      var quote = 0, buy = 0;
      list.forEach(function (m) {
        quote += Number(m.quoteVolume);
        buy += Number(m.takerBuyQuoteVolume);
      });
      return {
        quote: quote,
        buy: buy,
        imbalance: quote > 0 ? (2 * buy - quote) / quote : 0,
        buyShare: quote > 0 ? buy / quote : 0.5,
        avgQuote: list.length ? quote / list.length : 0
      };
    }
    var r = aggregate(recent);
    var b = aggregate(baseline);
    var volumeRatio = b.avgQuote > 0 ? r.avgQuote / b.avgQuote : 0;
    var score = 0;
    if (r.imbalance >= 0.08 && volumeRatio >= 1.05) score = 2;
    else if (r.imbalance >= 0.04) score = 1;
    else if (r.imbalance <= -0.08 && volumeRatio >= 1.05) score = -2;
    else if (r.imbalance <= -0.04) score = -1;
    return {
      available: true,
      decision: score > 0 ? 'AL' : score < 0 ? 'SAT' : 'BEKLE',
      score: score,
      imbalance: r.imbalance,
      baselineImbalance: b.imbalance,
      buyShare: r.buyShare,
      volumeRatio: volumeRatio,
      candles: recent.length,
      reason: 'Son 5 kapanmış mumda agresif alım payı %' + Math.round(r.buyShare * 100) +
        ', alım-satım dengesi ' + (r.imbalance >= 0 ? '+' : '') + (r.imbalance * 100).toFixed(1) +
        ' puan; hacim baz dönemin ' + volumeRatio.toFixed(2) + ' katı.'
    };
  }

  async function trendOku(symbol, tf) {
    var key = symbol + '|' + tf;
    if (!candleCache[key]) {
      candleCache[key] = Veri.binance(symbol, tf, 120).then(function (rows) {
        var bars = kapanmis(rows, tf);
        if (bars.length < 55) throw new Error(symbol + ' ' + tf + ' kapanmış mum sayısı yetersiz.');
        var last = bars[bars.length - 1];
        var lastAt = last.closeTime != null ? Number(last.closeTime) : Number(last.t) + TF_MS[tf] - 1;
        if (!sayi(lastAt) || lastAt >= Date.now() || Date.now() - lastAt > 2 * TF_MS[tf]) {
          throw new Error(symbol + ' ' + tf + ' verisi eski.');
        }
        var closes = bars.map(function (bar) { return Number(bar.c); }).filter(sayi);
        if (closes.length < 55) throw new Error(symbol + ' ' + tf + ' kapanış verisi eksik.');
        var fastNow = ortalama(closes.slice(-20));
        var slowNow = ortalama(closes.slice(-50));
        var fastPrev = ortalama(closes.slice(-30, -10));
        var lastClose = closes[closes.length - 1];
        var slope = fastPrev > 0 ? (fastNow / fastPrev) - 1 : 0;
        var direction = 0;
        if (lastClose > fastNow && fastNow > slowNow && slope > 0.001) direction = 1;
        else if (lastClose < fastNow && fastNow < slowNow && slope < -0.001) direction = -1;

        var atrs = atrSeries(bars);
        var atrNow = atrs[atrs.length - 1];
        var previousAtrs = atrs.slice(Math.max(14, atrs.length - 21), -1).filter(sayi);
        var baselineAtr = medyan(previousAtrs);
        var volatilityRatio = sayi(atrNow) && baselineAtr > 0 ? atrNow / baselineAtr : null;
        var volatilityRegime = !sayi(volatilityRatio) ? 'Belirsiz'
          : volatilityRatio >= 1.8 ? 'Yüksek' : volatilityRatio <= 0.65 ? 'Düşük' : 'Normal';
        var breakout = breakoutRead(bars);
        var momentum15BarsPct = closes.length > 15
          ? (lastClose / closes[closes.length - 16] - 1) * 100 : null;

        return {
          symbol: symbol, timeframe: tf,
          trend: direction > 0 ? 'Yükseliş' : direction < 0 ? 'Düşüş' : 'Yatay/Karışık',
          direction: direction,
          changePct: closes.length > 1 ? ((lastClose / closes[closes.length - 2]) - 1) * 100 : null,
          momentum15BarsPct: momentum15BarsPct,
          adx14: adx14(bars),
          atrPct: sayi(atrNow) && lastClose > 0 ? atrNow / lastClose * 100 : null,
          volatilityRatio: volatilityRatio,
          volatilityRegime: volatilityRegime,
          breakout: breakout.direction,
          breakoutVolumeRatio: breakout.volumeRatio,
          breakoutConfirmed: breakout.confirmed,
          lastCandleAt: lastAt
        };
      });
    }
    return candleCache[key];
  }

  async function piyasaRejimiOku(quickResults) {
    var requests = [
      ['BTCUSDT', '1d'], ['BTCUSDT', '4h'], ['BTCUSDT', '15m'],
      ['ETHUSDT', '1d'], ['ETHUSDT', '4h']
    ];
    var readings = await Promise.all(requests.map(function (item) {
      return trendOku(item[0], item[1]).catch(function () { return null; });
    }));
    var map = Object.create(null);
    readings.forEach(function (row) { if (row) map[row.symbol + '|' + row.timeframe] = row; });
    var btc1d = map['BTCUSDT|1d'] || null;
    var btc4h = map['BTCUSDT|4h'] || null;
    var btc15m = map['BTCUSDT|15m'] || null;
    var eth1d = map['ETHUSDT|1d'] || null;
    var eth4h = map['ETHUSDT|4h'] || null;
    var changes = (Array.isArray(quickResults) ? quickResults : []).map(function (item) {
      if (!item) return null;
      return sayi(Number(item.momentum4BarsPct)) ? Number(item.momentum4BarsPct) : item.sonMumDegisim;
    }).filter(function (value) {
      return value !== null && value !== undefined && isFinite(Number(value));
    }).map(Number);
    var up = changes.filter(function (value) { return value > 0; }).length;
    var down = changes.filter(function (value) { return value < 0; }).length;
    var upShare = changes.length ? up / changes.length : null;
    var downShare = changes.length ? down / changes.length : null;
    var breadthReady = changes.length >= 50;
    var bullish = !!(btc1d && btc4h && eth1d && eth4h && breadthReady &&
      btc1d.direction > 0 && btc4h.direction > 0 &&
      eth1d.direction >= 0 && eth4h.direction >= 0 && upShare >= 0.55);
    var bearish = !!(btc1d && btc4h && eth1d && eth4h && breadthReady &&
      btc1d.direction < 0 && btc4h.direction < 0 &&
      eth1d.direction <= 0 && eth4h.direction <= 0 && downShare >= 0.55);
    var available = !!(btc1d && btc4h && eth1d && eth4h && breadthReady);
    return {
      available: available,
      regime: bullish ? 'Yükseliş' : bearish ? 'Düşüş' : 'Karışık',
      bullish: bullish, bearish: bearish,
      breadth: { total: changes.length, up: up, down: down, upShare: upShare, downShare: downShare },
      btc: { daily: btc1d, fourHour: btc4h, fifteenMinute: btc15m },
      eth: { daily: eth1d, fourHour: eth4h },
      ethRelativeStrength: eth1d && btc1d && sayi(eth1d.changePct) && sayi(btc1d.changePct)
        ? eth1d.changePct - btc1d.changePct : null,
      vetoFor: function (baseDirection) {
        return baseDirection > 0 ? bearish : baseDirection < 0 ? bullish : false;
      },
      reason: !available
        ? 'BTC/ETH piyasa rejimi için yeterli trend veya coin genişliği verisi yok; ajan oy kullanmadı.'
        : (bullish ? 'BTC/ETH trendi ve coin genişliği yükselişi destekliyor.' :
          bearish ? 'BTC/ETH trendi ve coin genişliği düşüşü destekliyor.' :
          'BTC/ETH ve coin genişliği aynı yönde güçlü bir piyasa rejimi göstermiyor.')
    };
  }

  async function mtfOku(base) {
    var symbol = base.sembol;
    var results = await Promise.all([
      trendOku(symbol, '1d').catch(function () { return null; }),
      trendOku(symbol, '4h').catch(function () { return null; }),
      trendOku(symbol, '1h').catch(function () { return null; }),
      trendOku(symbol, '15m').catch(function () { return null; })
    ]);
    var daily = results[0], fourHour = results[1], hourly = results[2], fifteen = results[3];
    var baseDirection = yon(base.karar);
    var highTimeframeConflict = baseDirection !== 0 &&
      ((daily && daily.direction === -baseDirection) ||
       (fourHour && fourHour.direction === -baseDirection));
    var entryConflict = baseDirection !== 0 && hourly && hourly.direction === -baseDirection;
    return {
      available: !!(daily || fourHour || hourly || fifteen),
      highTimeframeReady: !!(daily && fourHour && hourly),
      daily: daily, fourHour: fourHour,
      hourly: hourly || { trend: 'Belirsiz', direction: 0 },
      fifteenMinute: fifteen,
      highTimeframeConflict: !!highTimeframeConflict,
      entryConflict: !!entryConflict,
      score: baseDirection === 0 ? 0 : [daily, fourHour, hourly, fifteen]
        .filter(function (item) { return item && item.direction; })
        .reduce(function (sum, item) { return sum + (item.direction === baseDirection ? 1 : -1); }, 0)
    };
  }

  async function derinAnaliz(adaylar, onProgress) {
    var all = Array.isArray(adaylar) ? adaylar : [];
    candleCache = Object.create(null);
    all.forEach(function (item) {
      if (item && item.zd === '15m' && item.sembol && Array.isArray(item._mumlar) && item._mumlar.length >= 55) {
        candleCache[item.sembol + '|15m'] = Promise.resolve(item._mumlar);
      }
    });
    var top = all.filter(function (item) {
      return item && item.sembol && item.sembol !== '—';
    }).slice().sort(function (a, b) {
      return (Number(b.skor) || 0) - (Number(a.skor) || 0);
    }).slice(0, 20);
    var selected = Object.create(null);
    top.forEach(function (item) { selected[item.sembol] = true; });
    var market = await piyasaRejimiOku(all);
    var next = 0, done = 0;

    async function worker() {
      while (next < top.length) {
        var item = top[next++];
        if (typeof onProgress === 'function') onProgress(done + 1, top.length, item.ad, 'Derin analiz');
        var baseDirection = yon(item.karar);
        try {
          var flow = orderFlow(item._mumlar || [], item.zd || '1h');
          var mtf = await mtfOku(item);
          var btc15 = market.btc && market.btc.fifteenMinute;
          var coin15 = mtf.fifteenMinute;
          var relativeStrength = coin15 && btc15 && sayi(coin15.momentum15BarsPct) && sayi(btc15.momentum15BarsPct)
            ? coin15.momentum15BarsPct - btc15.momentum15BarsPct : null;
          var sharedSkills = window.PiyasaBecerileri && typeof window.PiyasaBecerileri.oku === 'function'
            ? window.PiyasaBecerileri.oku(item._mumlar || [], { market: 'Binance', timeframe: item.zd || '15m', closedCandles: true, fresh: true }) : null;
          var skills = {
            mode: 'shadow',
            shared: sharedSkills,
            adx14: coin15 && sayi(coin15.adx14) ? coin15.adx14 : null,
            trendStrength: coin15 && sayi(coin15.adx14)
              ? (coin15.adx14 >= 25 ? 'Güçlü' : coin15.adx14 >= 20 ? 'Gelişiyor' : 'Zayıf') : 'Belirsiz',
            atrPct: coin15 && sayi(coin15.atrPct) ? coin15.atrPct : null,
            volatilityRatio: coin15 && sayi(coin15.volatilityRatio) ? coin15.volatilityRatio : null,
            volatilityRegime: coin15 ? coin15.volatilityRegime : 'Belirsiz',
            breakout: coin15 ? coin15.breakout : 'Belirsiz',
            breakoutVolumeRatio: coin15 && sayi(coin15.breakoutVolumeRatio) ? coin15.breakoutVolumeRatio : null,
            breakoutConfirmed: !!(coin15 && coin15.breakoutConfirmed),
            relativeStrengthVsBtcPct: relativeStrength
          };
          var reasons = [], veto = false;
          if (baseDirection !== 0 && !mtf.highTimeframeReady) {
            veto = true;
            reasons.push('1G, 4S ve 1S doğrulama verilerinin tamamı alınamadı; sinyal güvenli biçimde BEKLE’ye indirildi.');
          }
          if (baseDirection !== 0 && mtf.highTimeframeConflict) {
            veto = true;
            reasons.push('1G ve 4S trendleri ana sinyali birlikte teyit etmiyor.');
          }
          if (baseDirection !== 0 && mtf.entryConflict) {
            veto = true;
            reasons.push('1S ana zaman dilimi ana sinyalin tersinde.');
          }
          if (baseDirection !== 0 && flow.available && flow.score * baseDirection <= -2) {
            veto = true;
            reasons.push('Order Flow güçlü biçimde ana sinyalin tersinde.');
          }
          if (baseDirection !== 0 && market.available && market.vetoFor(baseDirection)) {
            veto = true;
            reasons.push('BTC/ETH piyasa rejimi ana sinyalin tersinde.');
          }

          item.flow = flow;
          item.mtf = mtf;
          item.skillReadings = skills;
          item.marketRegime = {
            regime: market.regime, breadth: market.breadth,
            reason: market.reason, ethRelativeStrength: market.ethRelativeStrength
          };
          item.agentVersion = SURUM;
          item.deepScan = mtf.highTimeframeReady ? 'tamamlandı' : 'veri yetersiz';
          item.deepVeto = veto;
          item.deepReasons = reasons;
          item.sourceTimestamps = {
            '1h': mtf.hourly ? mtf.hourly.lastCandleAt : null,
            '1d': mtf.daily ? mtf.daily.lastCandleAt : null,
            '4h': mtf.fourHour ? mtf.fourHour.lastCandleAt : null,
            '15m': mtf.fifteenMinute ? mtf.fifteenMinute.lastCandleAt : null
          };
          if (veto && baseDirection !== 0) {
            item.karar = 'BEKLE';
            item.skor = Math.min(Number(item.skor) || 0, 49);
            item.ozet = (item.ozet ? item.ozet + ' · ' : '') +
              'Kripto derin analizindeki veri eksikliği veya çelişki nedeniyle sinyal BEKLE’ye indirildi.';
          }
          item.tartisma = (Array.isArray(item.tartisma) ? item.tartisma : []).concat([
            '🧠 Ortak Binance becerileri (gölge): ' + (sharedSkills ? sharedSkills.signals.join(' · ') : 'veri yetersiz') +
              (sharedSkills && sharedSkills.warnings.length ? ' · Uyarı: ' + sharedSkills.warnings.join(' ') : ''),
            '🟪 Order Flow: ' + flow.reason,
            '🟦 Çoklu zaman dilimi: 1G ' + (mtf.daily ? mtf.daily.trend : 'veri yok') +
              ' · 4S ' + (mtf.fourHour ? mtf.fourHour.trend : 'veri yok') +
              ' · 1S ' + (mtf.hourly.trend || 'veri yok') +
              ' · 15D ' + (mtf.fifteenMinute ? mtf.fifteenMinute.trend : 'veri yok'),
            '🌐 BTC piyasa ajanı: ' + market.reason,
            '🧪 Ek beceriler (gölge test, kararı değiştirmez): ADX14 ' + (sayi(skills.adx14) ? skills.adx14.toFixed(1) : '—') +
              ' · ATR rejimi ' + skills.volatilityRegime + ' · 20 mum kırılımı ' + skills.breakout +
              ' · BTC’ye göre güç ' + (sayi(relativeStrength) ? (relativeStrength >= 0 ? '+' : '') + relativeStrength.toFixed(2) + '%' : '—')
          ]);
          if (reasons.length) item.tartisma.push('⛔ Güvenlik filtresi: ' + reasons.join(' '));
        } catch (error) {
          item.deepScan = 'veri yetersiz';
          item.deepError = error && error.message ? error.message : String(error);
          item.deepVeto = baseDirection !== 0;
          item.deepReasons = ['Derin analiz tamamlanamadı; doğrulanmamış AL/SAT sinyali engellendi.'];
          if (baseDirection !== 0) {
            item.karar = 'BEKLE';
            item.skor = Math.min(Number(item.skor) || 0, 49);
          }
        }
        done++;
      }
    }

    await Promise.all([worker(), worker(), worker(), worker()]);
    all.forEach(function (item) {
      if (item && item.sembol && !selected[item.sembol] &&
          (item.karar === 'AL' || item.karar === 'SAT')) {
        item.karar = 'BEKLE';
        item.skor = Math.min(Number(item.skor) || 0, 49);
        item.deepScan = 'ilk 20 dışında';
        item.deepVeto = true;
        item.deepReasons = ['Yalnızca ilk 20 aday derin doğrulamadan geçti; diğer sinyaller doğrulanmadığı için BEKLE’ye indirildi.'];
      }
    });
    return { adaylar: all, piyasa: market, derinTaranan: done, agentVersion: SURUM };
  }

  window.KriptoAjanlari = {
    surum: SURUM,
    orderFlow: orderFlow,
    piyasaRejimiOku: piyasaRejimiOku,
    trendOku: trendOku,
    mtfOku: mtfOku,
    derinAnaliz: derinAnaliz
  };
})();