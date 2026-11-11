(function () {
  'use strict';

  var FUTURES_API = 'https://fapi.binance.com';
  var TF_MS = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  };
  var SURUM = 'crypto-intelligence-2.0.0';
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
  async function api(path, params) {
    var query = Object.keys(params || {}).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
    var url = FUTURES_API + path + (query ? '?' + query : '');
    var lastError = null;
    for (var attempt = 0; attempt < 2; attempt++) {
      try { return await Veri.getir(url, 12000); }
      catch (error) {
        lastError = error;
        var message = String(error && error.message || error);
        var limited = message.indexOf('429') >= 0 || message.indexOf('418') >= 0;
        if (!limited || attempt > 0) break;
        await new Promise(function (resolve) { setTimeout(resolve, 700); });
      }
    }
    throw lastError || new Error('Binance Futures verisi alınamadı.');
  }
  function guvenliApi(path, params) { return api(path, params).catch(function () { return null; }); }
  function sonSatir(rows) { return Array.isArray(rows) && rows.length ? rows[rows.length - 1] : null; }
  function zaman(row) {
    if (!row) return null;
    var stamp = Number(row.timestamp != null ? row.timestamp : row.time);
    return sayi(stamp) && stamp > 0 ? stamp : null;
  }
  function taze(row, maxAge) {
    var stamp = zaman(row);
    return stamp !== null && stamp <= Date.now() && Date.now() - stamp <= maxAge;
  }

  /* Binance Kline taker alım/satım hacmi; balina tespiti değildir. */
  function orderFlow(mumlar) {
    var rows = (Array.isArray(mumlar) ? mumlar : []).filter(function (m) {
      var quote = Number(m && m.quoteVolume);
      var buy = Number(m && m.takerBuyQuoteVolume);
      return m && sayi(quote) && quote > 0 && sayi(buy) && buy >= 0 && buy <= quote;
    }).slice(-30);
    if (rows.length < 15) {
      return { available: false, decision: 'BEKLE', score: 0, reason: 'Order Flow için yeterli Binance alım/satım hacmi yok.' };
    }
    var latest = rows[rows.length - 1];
    var latestAt = latest.closeTime != null ? Number(latest.closeTime) : Number(latest.t) + TF_MS['1h'];
    if (!sayi(latestAt) || latestAt > Date.now() || Date.now() - latestAt > 2 * TF_MS['1h']) {
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

  async function fundingMapOku() {
    var rows = await guvenliApi('/fapi/v1/premiumIndex', {});
    var map = Object.create(null);
    if (Array.isArray(rows)) {
      rows.forEach(function (row) {
        if (row && row.symbol) map[String(row.symbol).toUpperCase()] = row;
      });
    } else if (rows && rows.symbol) {
      map[String(rows.symbol).toUpperCase()] = rows;
    }
    return map;
  }

  async function futuresOku(symbol, baseDirection, premiums) {
    var premium = premiums && premiums[symbol] ? premiums[symbol] : null;
    var result = await Promise.all([
      guvenliApi('/fapi/v1/openInterest', { symbol: symbol }),
      guvenliApi('/futures/data/openInterestHist', { symbol: symbol, period: '1h', limit: 6 }),
      guvenliApi('/futures/data/globalLongShortAccountRatio', { symbol: symbol, period: '1h', limit: 6 }),
      guvenliApi('/futures/data/takerlongshortRatio', { symbol: symbol, period: '1h', limit: 6 })
    ]);
    var oiNow = result[0];
    var oiRows = Array.isArray(result[1]) ? result[1] : [];
    var lsRows = Array.isArray(result[2]) ? result[2] : [];
    var takerRows = Array.isArray(result[3]) ? result[3] : [];
    var oiLast = sonSatir(oiRows);
    var oiFirst = oiRows.length ? oiRows[0] : null;
    var ls = sonSatir(lsRows);
    var taker = sonSatir(takerRows);

    var oiNowFresh = taze(oiNow, 5 * 60 * 1000);
    var oiHistoryFresh = taze(oiLast, 2 * TF_MS['1h']);
    var lsFresh = taze(ls, 2 * TF_MS['1h']);
    var takerFresh = taze(taker, 2 * TF_MS['1h']);
    var premiumFresh = taze(premium, 30 * 60 * 1000);

    var oiStart = oiFirst && Number(oiFirst.sumOpenInterest);
    var oiEnd = oiHistoryFresh && oiLast ? Number(oiLast.sumOpenInterest) : NaN;
    var oiDeltaPct = sayi(oiStart) && oiStart > 0 && sayi(oiEnd)
      ? ((oiEnd / oiStart) - 1) * 100 : null;
    var longShortRatio = lsFresh && sayi(Number(ls.longShortRatio)) ? Number(ls.longShortRatio) : null;
    var takerRatio = takerFresh && sayi(Number(taker.buySellRatio)) ? Number(taker.buySellRatio) : null;
    var fundingRate = premiumFresh && sayi(Number(premium.lastFundingRate))
      ? Number(premium.lastFundingRate) : null;

    var available = fundingRate !== null || oiDeltaPct !== null ||
      longShortRatio !== null || takerRatio !== null ||
      (oiNowFresh && sayi(Number(oiNow.openInterest)));
    var crowdedAgainst = false;
    var takerAgainst = false;
    if (baseDirection > 0) {
      crowdedAgainst = (fundingRate !== null && fundingRate >= 0.0005) ||
        (longShortRatio !== null && longShortRatio >= 1.8);
      takerAgainst = takerRatio !== null && takerRatio <= 0.8;
    } else if (baseDirection < 0) {
      crowdedAgainst = (fundingRate !== null && fundingRate <= -0.0005) ||
        (longShortRatio !== null && longShortRatio <= 0.55);
      takerAgainst = takerRatio !== null && takerRatio >= 1.2;
    }
    var score = 0;
    if (baseDirection !== 0 && crowdedAgainst) score -= 1;
    if (baseDirection !== 0 && takerAgainst) score -= 1;
    if (baseDirection > 0 && takerRatio !== null && takerRatio >= 1.2) score += 1;
    if (baseDirection < 0 && takerRatio !== null && takerRatio <= 0.8) score += 1;
    var veto = baseDirection !== 0 && crowdedAgainst && takerAgainst;
    var ts = {
      funding: premiumFresh ? zaman(premium) : null,
      openInterest: oiNowFresh ? zaman(oiNow) : null,
      openInterestHistory: oiHistoryFresh ? zaman(oiLast) : null,
      longShort: lsFresh ? zaman(ls) : null,
      taker: takerFresh ? zaman(taker) : null
    };
    return {
      available: available,
      decision: takerRatio !== null && takerRatio >= 1.2 ? 'AL' :
        takerRatio !== null && takerRatio <= 0.8 ? 'SAT' : 'BEKLE',
      score: score,
      veto: veto,
      fundingRate: fundingRate,
      openInterest: oiNowFresh && sayi(Number(oiNow.openInterest)) ? Number(oiNow.openInterest) : null,
      openInterestDeltaPct: oiDeltaPct,
      longShortRatio: longShortRatio,
      takerBuySellRatio: takerRatio,
      crowdedAgainst: crowdedAgainst,
      sourceTimestamps: ts,
      reason: available
        ? 'Funding ' + (fundingRate === null ? 'yok' : (fundingRate * 100).toFixed(3) + '%') +
          ' · OI değişimi ' + (oiDeltaPct === null ? 'yok' : oiDeltaPct.toFixed(2) + '%') +
          ' · Long/Short ' + (longShortRatio === null ? 'yok' : longShortRatio.toFixed(2)) +
          ' · Taker oranı ' + (takerRatio === null ? 'yok' : takerRatio.toFixed(2))
        : 'Bu coin için kullanılabilir vadeli piyasa verisi yok; ajan oy kullanmadı.'
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
        return {
          symbol: symbol, timeframe: tf,
          trend: direction > 0 ? 'Yükseliş' : direction < 0 ? 'Düşüş' : 'Yatay/Karışık',
          direction: direction,
          changePct: closes.length > 1 ? ((lastClose / closes[closes.length - 2]) - 1) * 100 : null,
          lastCandleAt: lastAt
        };
      });
    }
    return candleCache[key];
  }

  async function piyasaRejimiOku(quickResults) {
    var requests = [
      ['BTCUSDT', '1d'], ['BTCUSDT', '4h'],
      ['ETHUSDT', '1d'], ['ETHUSDT', '4h']
    ];
    var readings = await Promise.all(requests.map(function (item) {
      return trendOku(item[0], item[1]).catch(function () { return null; });
    }));
    var map = Object.create(null);
    readings.forEach(function (row) { if (row) map[row.symbol + '|' + row.timeframe] = row; });
    var btc1d = map['BTCUSDT|1d'] || null;
    var btc4h = map['BTCUSDT|4h'] || null;
    var eth1d = map['ETHUSDT|1d'] || null;
    var eth4h = map['ETHUSDT|4h'] || null;
    var changes = (Array.isArray(quickResults) ? quickResults : []).map(function (item) {
      return item ? item.sonMumDegisim : null;
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
    var available = !!(btc1d && btc4h && breadthReady);
    return {
      available: available,
      regime: bullish ? 'Yükseliş' : bearish ? 'Düşüş' : 'Karışık',
      bullish: bullish, bearish: bearish,
      breadth: { total: changes.length, up: up, down: down, upShare: upShare, downShare: downShare },
      btc: { daily: btc1d, fourHour: btc4h },
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
      trendOku(symbol, '15m').catch(function () { return null; })
    ]);
    var daily = results[0], fourHour = results[1], fifteen = results[2];
    var baseDirection = yon(base.karar);
    var dailyConflict = baseDirection !== 0 && daily && daily.direction === -baseDirection;
    var fourHourConflict = baseDirection !== 0 && fourHour && fourHour.direction === -baseDirection;
    var entryConflict = baseDirection !== 0 && fifteen && fifteen.direction === -baseDirection;
    var hourlyDirection = yon(base.trend);
    return {
      available: !!(daily || fourHour || fifteen),
      highTimeframeReady: !!(daily && fourHour),
      daily: daily, fourHour: fourHour,
      hourly: { trend: base.trend || 'Belirsiz', direction: hourlyDirection },
      fifteenMinute: fifteen,
      highTimeframeConflict: !!(dailyConflict && fourHourConflict),
      entryConflict: !!entryConflict,
      score: baseDirection === 0 ? 0 : [daily, fourHour, { direction: hourlyDirection }, fifteen]
        .filter(function (item) { return item && item.direction; })
        .reduce(function (sum, item) { return sum + (item.direction === baseDirection ? 1 : -1); }, 0)
    };
  }

  async function derinAnaliz(adaylar, onProgress) {
    var all = Array.isArray(adaylar) ? adaylar : [];
    candleCache = Object.create(null);
    var top = all.filter(function (item) {
      return item && item.sembol && item.sembol !== '—';
    }).slice().sort(function (a, b) {
      return (Number(b.skor) || 0) - (Number(a.skor) || 0);
    }).slice(0, 20);
    var selected = Object.create(null);
    top.forEach(function (item) { selected[item.sembol] = true; });
    var premiums = await fundingMapOku();
    var market = await piyasaRejimiOku(all);
    var next = 0, done = 0;

    async function worker() {
      while (next < top.length) {
        var item = top[next++];
        if (typeof onProgress === 'function') onProgress(done + 1, top.length, item.ad, 'Derin analiz');
        var baseDirection = yon(item.karar);
        try {
          var flow = orderFlow(item._mumlar || []);
          var values = await Promise.all([
            mtfOku(item),
            futuresOku(item.sembol, baseDirection, premiums)
          ]);
          var mtf = values[0], futures = values[1];
          var reasons = [], veto = false;
          if (baseDirection !== 0 && !mtf.highTimeframeReady) {
            veto = true;
            reasons.push('1G ve 4S verilerinin ikisi de doğrulanamadı; sinyal güvenli biçimde BEKLE’ye indirildi.');
          }
          if (baseDirection !== 0 && mtf.highTimeframeConflict) {
            veto = true;
            reasons.push('1G ve 4S trendleri ana sinyalin tersinde.');
          }
          if (baseDirection !== 0 && mtf.entryConflict) {
            veto = true;
            reasons.push('15D giriş zamanlaması ana sinyalin tersinde.');
          }
          if (baseDirection !== 0 && flow.available && flow.score * baseDirection <= -2) {
            veto = true;
            reasons.push('Order Flow güçlü biçimde ana sinyalin tersinde.');
          }
          if (baseDirection !== 0 && futures.veto) {
            veto = true;
            reasons.push('Vadeli piyasada aşırı pozisyonlanma ve ters taker akışı birlikte görülüyor.');
          }
          if (baseDirection !== 0 && market.available && market.vetoFor(baseDirection)) {
            veto = true;
            reasons.push('BTC/ETH piyasa rejimi ana sinyalin tersinde.');
          }

          item.flow = flow;
          item.futures = futures;
          item.mtf = mtf;
          item.marketRegime = {
            regime: market.regime, breadth: market.breadth,
            reason: market.reason, ethRelativeStrength: market.ethRelativeStrength
          };
          item.agentVersion = SURUM;
          item.deepScan = mtf.highTimeframeReady ? 'tamamlandı' : 'veri yetersiz';
          item.deepVeto = veto;
          item.deepReasons = reasons;
          item.sourceTimestamps = {
            '1h': item.signalAt || null,
            '1d': mtf.daily ? mtf.daily.lastCandleAt : null,
            '4h': mtf.fourHour ? mtf.fourHour.lastCandleAt : null,
            '15m': mtf.fifteenMinute ? mtf.fifteenMinute.lastCandleAt : null,
            futures: futures.sourceTimestamps || null
          };
          if (veto && baseDirection !== 0) {
            item.karar = 'BEKLE';
            item.skor = Math.min(Number(item.skor) || 0, 49);
            item.ozet = (item.ozet ? item.ozet + ' · ' : '') +
              'Kripto derin analizindeki veri eksikliği veya çelişki nedeniyle sinyal BEKLE’ye indirildi.';
          }
          item.tartisma = (Array.isArray(item.tartisma) ? item.tartisma : []).concat([
            '🟪 Order Flow: ' + flow.reason,
            '🟨 Futures: ' + futures.reason,
            '🟦 Çoklu zaman dilimi: 1G ' + (mtf.daily ? mtf.daily.trend : 'veri yok') +
              ' · 4S ' + (mtf.fourHour ? mtf.fourHour.trend : 'veri yok') +
              ' · 1S ' + (mtf.hourly.trend || 'veri yok') +
              ' · 15D ' + (mtf.fifteenMinute ? mtf.fifteenMinute.trend : 'veri yok'),
            '🌐 BTC piyasa ajanı: ' + market.reason
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

    await Promise.all([worker(), worker()]);
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
    futuresOku: futuresOku,
    piyasaRejimiOku: piyasaRejimiOku,
    trendOku: trendOku,
    mtfOku: mtfOku,
    derinAnaliz: derinAnaliz
  };
})();