(function () {
  'use strict';

  var TF_MS = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  };
  var SURUM = 'crypto-intelligence-2.1.0';
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
    var available = !!(btc1d && btc4h && eth1d && eth4h && breadthReady);
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
    var highTimeframeConflict = baseDirection !== 0 && daily && fourHour &&
      (daily.direction !== baseDirection || fourHour.direction !== baseDirection);
    var entryConflict = baseDirection !== 0 && fifteen && fifteen.direction === -baseDirection;
    var hourlyDirection = yon(base.trend);
    return {
      available: !!(daily || fourHour || fifteen),
      highTimeframeReady: !!(daily && fourHour),
      daily: daily, fourHour: fourHour,
      hourly: { trend: base.trend || 'Belirsiz', direction: hourlyDirection },
      fifteenMinute: fifteen,
      highTimeframeConflict: !!highTimeframeConflict,
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
    var market = await piyasaRejimiOku(all);
    var next = 0, done = 0;

    async function worker() {
      while (next < top.length) {
        var item = top[next++];
        if (typeof onProgress === 'function') onProgress(done + 1, top.length, item.ad, 'Derin analiz');
        var baseDirection = yon(item.karar);
        try {
          var flow = orderFlow(item._mumlar || []);
          var mtf = await mtfOku(item);
          var reasons = [], veto = false;
          if (baseDirection !== 0 && !mtf.highTimeframeReady) {
            veto = true;
            reasons.push('1G ve 4S verilerinin ikisi de doğrulanamadı; sinyal güvenli biçimde BEKLE’ye indirildi.');
          }
          if (baseDirection !== 0 && mtf.highTimeframeConflict) {
            veto = true;
            reasons.push('1G ve 4S trendleri ana sinyali birlikte teyit etmiyor.');
          }
          if (baseDirection !== 0 && mtf.entryConflict) {
            veto = true;
            reasons.push('15D giriş zamanlaması ana sinyalin tersinde.');
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
            '15m': mtf.fifteenMinute ? mtf.fifteenMinute.lastCandleAt : null
          };
          if (veto && baseDirection !== 0) {
            item.karar = 'BEKLE';
            item.skor = Math.min(Number(item.skor) || 0, 49);
            item.ozet = (item.ozet ? item.ozet + ' · ' : '') +
              'Kripto derin analizindeki veri eksikliği veya çelişki nedeniyle sinyal BEKLE’ye indirildi.';
          }
          item.tartisma = (Array.isArray(item.tartisma) ? item.tartisma : []).concat([
            '🟪 Order Flow: ' + flow.reason,
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
    piyasaRejimiOku: piyasaRejimiOku,
    trendOku: trendOku,
    mtfOku: mtfOku,
    derinAnaliz: derinAnaliz
  };
})();