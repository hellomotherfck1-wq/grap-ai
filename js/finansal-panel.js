(function () {
  'use strict';

  var PROXY = 'https://grafik-vekil.hellomotherfck1.workers.dev/?u=';
  var kapCache = new Map();
  var lastReport = null;

  function el(tag, cls, value) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value != null) n.textContent = String(value);
    return n;
  }

  function addLink(parent, label, href) {
    if (!href) return;
    var a = el('a', '', label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    parent.appendChild(a);
  }

  function number(value, digits) {
    if (value == null || value === '' || !isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('tr-TR', {
      maximumFractionDigits: digits == null ? 2 : digits
    }).format(Number(value));
  }

  function money(value, currency) {
    if (value == null || !isFinite(Number(value))) return '—';
    try {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: currency || 'TRY',
        maximumFractionDigits: 2
      }).format(Number(value));
    } catch (e) {
      return number(value, 2) + ' ' + (currency || 'TRY');
    }
  }

  function pct(value) {
    return value == null || !isFinite(Number(value)) ? '—' : '%' + number(value, 1);
  }

  function safeDate(value) {
    if (!value) return 'Tarih belirtilmedi';
    var d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString('tr-TR');
  }

  async function jsonViaProxy(url) {
    var routes = [
      PROXY + encodeURIComponent(url),
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)
    ];
    var lastError;
    for (var i = 0; i < routes.length; i++) {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 18000);
      try {
        var response = await fetch(routes[i], {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return await response.json();
      } catch (e) {
        lastError = e && e.name === 'AbortError' ? new Error('Kaynak zaman aşımına uğradı') : e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError || new Error('Ücretsiz kaynaklara erişilemedi');
  }

  function ema(values, period) {
    if (!Array.isArray(values) || values.length < period) return null;
    var sum = 0;
    for (var i = 0; i < period; i++) sum += values[i];
    var result = sum / period;
    var k = 2 / (period + 1);
    for (var j = period; j < values.length; j++) result = values[j] * k + result * (1 - k);
    return result;
  }

  function rsi(values, period) {
    period = period || 14;
    if (!Array.isArray(values) || values.length <= period) return null;
    var gain = 0, loss = 0, i;
    for (i = 1; i <= period; i++) {
      var delta = values[i] - values[i - 1];
      if (delta > 0) gain += delta;
      else loss -= delta;
    }
    var avgGain = gain / period;
    var avgLoss = loss / period;
    for (i = period + 1; i < values.length; i++) {
      var change = values[i] - values[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    }
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + avgGain / avgLoss));
  }

  function metricsFromCandles(candles) {
    var rows = Array.isArray(candles) ? candles.filter(function (x) {
      return x && isFinite(x.c) && isFinite(x.h) && isFinite(x.l);
    }) : [];
    var closes = rows.map(function (x) { return Number(x.c); });
    var last = rows[rows.length - 1];
    var previous = rows.length > 1 ? rows[rows.length - 2] : null;
    var volumes = rows.map(function (x) { return Number(x.v) || 0; });
    var lastVolume = volumes[volumes.length - 1] || null;
    var priorVolumes = volumes.slice(Math.max(0, volumes.length - 21), Math.max(0, volumes.length - 1))
      .filter(function (x) { return x > 0; });
    var avgVolume = priorVolumes.length ? priorVolumes.reduce(function (a, b) { return a + b; }, 0) / priorVolumes.length : null;
    var maxHigh = rows.length ? Math.max.apply(null, rows.map(function (x) { return Number(x.h); })) : null;
    var minLow = rows.length ? Math.min.apply(null, rows.map(function (x) { return Number(x.l); })) : null;
    function returnPct(days) {
      if (closes.length <= days) return null;
      return (closes[closes.length - 1] / closes[closes.length - 1 - days] - 1) * 100;
    }
    var price = last ? Number(last.c) : null;
    var daily = previous && previous.c ? (price / previous.c - 1) * 100 : null;
    var volumeRatio = lastVolume && avgVolume ? lastVolume / avgVolume : null;
    var e20 = ema(closes, 20);
    var e50 = ema(closes, 50);
    var e100 = ema(closes, 100);
    var e200 = ema(closes, 200);
    var strength = rsi(closes, 14);
    var longTrend = null;
    if (e50 != null && e200 != null) {
      longTrend = price > e50 && e50 > e200 ? 'Yukarı' :
        (price < e50 && e50 < e200 ? 'Aşağı' : 'Karışık');
    } else if (e50 != null) {
      longTrend = price > e50 ? 'Yukarı' : 'Aşağı';
    }
    return {
      count: rows.length,
      price: price,
      dailyChange: daily,
      return20: returnPct(20),
      return60: returnPct(60),
      volume: lastVolume,
      averageVolume20: avgVolume,
      volumeRatio: volumeRatio,
      rsi14: strength,
      ema20: e20,
      ema50: e50,
      ema100: e100,
      ema200: e200,
      highPeriod: maxHigh,
      lowPeriod: minLow,
      longTrend: longTrend,
      lastTime: last && last.t ? new Date(last.t) : null,
      currency: 'TRY'
    };
  }

  async function kapArastir(symbol) {
    var key = String(symbol || '').toUpperCase();
    var cached = kapCache.get(key);
    if (cached && Date.now() - cached.time < 15 * 60 * 1000) return cached.value;

    var member = await jsonViaProxy('https://www.kap.org.tr/tr/api/member/filter/' + encodeURIComponent(key));
    if (Array.isArray(member)) member = member[0];
    if (!member || !(member.mkkMemberOid || member.companyId)) throw new Error('KAP şirket kaydı bulunamadı');

    var oid = member.mkkMemberOid || member.companyId;
    var lists = await Promise.allSettled([
      jsonViaProxy('https://www.kap.org.tr/tr/api/company-detail/disclosures/FR/' + encodeURIComponent(oid)),
      jsonViaProxy('https://www.kap.org.tr/tr/api/company-detail/disclosures/ODA/' + encodeURIComponent(oid))
    ]);

    function normalize(result) {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value)) return [];
      return result.value.map(function (item) {
        var d = item && item.disclosureBasic ? item.disclosureBasic : item;
        if (!d) return null;
        var index = d.disclosureIndex || d.index;
        if (!index) return null;
        return {
          index: index,
          title: d.title || d.subject || d.summary || 'KAP bildirimi',
          summary: d.summary || d.subject || '',
          date: d.publishDate || d.date || '',
          year: d.year || '',
          period: d.period || d.ruleType || ''
        };
      }).filter(Boolean).slice(0, 6);
    }

    var permalink = member.permaLink || '';
    var result = {
      company: member.title || member.kapMemberTitle || key,
      oid: oid,
      profileUrl: permalink ? 'https://www.kap.org.tr/tr/sirket-bilgileri/ozet/' + permalink : 'https://www.kap.org.tr/tr/Endeksler',
      financialReports: normalize(lists[0]),
      disclosures: normalize(lists[1]),
      errors: lists.filter(function (x) { return x.status === 'rejected'; }).length
    };
    kapCache.set(key, { time: Date.now(), value: result });
    return result;
  }

  function card(parent, title, value, hint) {
    var box = el('div', 'finansal-kpi');
    box.appendChild(el('span', 'finansal-kpi-baslik', title));
    box.appendChild(el('strong', 'finansal-kpi-deger', value));
    if (hint) box.appendChild(el('small', 'finansal-kpi-ipucu', hint));
    parent.appendChild(box);
  }

  function disclosureList(parent, title, rows) {
    var details = el('details', 'finansal-tablo-detay');
    details.open = true;
    details.appendChild(el('summary', '', title + ' · ' + rows.length + ' kayıt'));
    if (!rows.length) {
      details.appendChild(el('p', 'alt', 'Bu sorguda bildirim alınamadı. KAP sayfasından elle kontrol edebilirsin.'));
    }
    rows.forEach(function (item) {
      var line = el('p', 'finansal-kap-satir');
      var a = el('a', '', item.title);
      a.href = 'https://www.kap.org.tr/tr/Bildirim/' + encodeURIComponent(item.index);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      line.appendChild(a);
      var meta = [item.date, item.year, item.period].filter(Boolean).join(' · ');
      if (meta) line.appendChild(el('small', '', ' · ' + meta));
      if (item.summary && item.summary !== item.title) line.appendChild(el('small', 'finansal-kap-ozet', item.summary));
      details.appendChild(line);
    });
    parent.appendChild(details);
  }

  function buildAssessment(m, agents, fundamentals) {
    var positives = [];
    var risks = [];
    if (fundamentals) {
      if (fundamentals.revenueGrowth != null) {
        if (fundamentals.revenueGrowth > 0.05) positives.push('Gelir büyümesi pozitif (' + pct(fundamentals.revenueGrowth * 100) + ').');
        else if (fundamentals.revenueGrowth < -0.05) risks.push('Gelir büyümesi negatif (' + pct(fundamentals.revenueGrowth * 100) + ').');
      }
      if (fundamentals.earningsGrowth != null) {
        if (fundamentals.earningsGrowth > 0.05) positives.push('Kâr büyümesi pozitif (' + pct(fundamentals.earningsGrowth * 100) + ').');
        else if (fundamentals.earningsGrowth < -0.05) risks.push('Kâr büyümesi negatif (' + pct(fundamentals.earningsGrowth * 100) + ').');
      }
      if (fundamentals.roe != null) {
        if (fundamentals.roe > 0.12) positives.push('Özkaynak kârlılığı destekleyici (' + pct(fundamentals.roe * 100) + ').');
        else if (fundamentals.roe < 0.05) risks.push('Özkaynak kârlılığı zayıf (' + pct(fundamentals.roe * 100) + ').');
      }
      if (fundamentals.profitMargins != null) {
        if (fundamentals.profitMargins > 0.1) positives.push('Net kâr marjı pozitif ve güçlü (' + pct(fundamentals.profitMargins * 100) + ').');
        else if (fundamentals.profitMargins < 0) risks.push('Net kâr marjı negatif.');
      }
      if (fundamentals.debtToEquity != null && fundamentals.debtToEquity > 200) risks.push('Borç/özkaynak oranı yüksek; sektörle karşılaştırılmalı.');
      if (fundamentals.currentRatio != null && fundamentals.currentRatio < 1) risks.push('Cari oran 1 altında; likidite riski incelenmeli.');
    }

    if (m.longTrend === 'Yukarı') positives.push('Fiyat EMA50 ve EMA200 üzerinde; uzun dönem teknik eğilim yukarı.');
    else if (m.longTrend === 'Aşağı') risks.push('Fiyat EMA50 ve EMA200 altında; uzun dönem teknik eğilim zayıf.');

    if (m.rsi14 != null && m.rsi14 >= 70) risks.push('RSI 70 üzerinde; kısa vadeli aşırı alım riski var.');
    else if (m.rsi14 != null && m.rsi14 <= 30) positives.push('RSI 30 altında; tepki olasılığı izlenebilir, tek başına al sinyali değildir.');

    var short = agents && agents.nihai ? agents.nihai.son : (agents && agents.teknik ? agents.teknik.karar : 'BEKLE');
    var reason = agents && agents.nihai && agents.nihai.neden ? agents.nihai.neden :
      (agents && agents.ozet ? agents.ozet : 'Teknik ajanlar net sinyal üretmedi.');
    var long = m.longTrend ? 'Teknik uzun vade görünüm: ' + m.longTrend + '.' :
      'Uzun vadeli teknik görünüm için yeterli geçmiş veri yok.';
    if (!fundamentals || (fundamentals.trailingPE == null && fundamentals.priceToBook == null &&
      fundamentals.roe == null && fundamentals.revenueGrowth == null && fundamentals.earningsGrowth == null)) {
      long += ' Şirket kârlılığı, nakit akışı ve borçluluğu için KAP finansal tabloları ayrıca incelenmeli; bu veriler olmadan adil değer tahmini yapılmıyor.';
    } else if (positives.length > risks.length) {
      long += ' Erişilebilen temel göstergeler teknik görünümü destekliyor; sektör kıyası yine gerekli.';
    } else if (risks.length > positives.length) {
      long += ' Temel ve teknik riskler birlikte değerlendirilmeli.';
    } else {
      long += ' Temel ve teknik göstergeler karışık.';
    }

    var label = positives.length > risks.length ? 'Olumlu sinyaller ağır basıyor' :
      risks.length > positives.length ? 'Riskler ağır basıyor' : 'Görünüm karışık';
    return {
      shortTerm: short + ' — ' + reason,
      longTerm: long,
      label: label,
      positives: positives,
      risks: risks
    };
  }

  function render(report, result) {
    result.replaceChildren();
    var header = el('div', 'finansal-rapor-baslik');
    header.appendChild(el('h4', '', report.company + ' · Ücretsiz araştırma raporu'));
    header.appendChild(el('p', 'alt', 'Sembol: ' + report.symbol + ' · Veri zamanı: ' + safeDate(report.generatedAt) +
      ' · Son mum: ' + safeDate(report.metrics.lastTime)));
    result.appendChild(header);

    var m = report.metrics;
    var grid = el('div', 'finansal-kpi-grid');
    card(grid, 'Son fiyat', money(m.price, m.currency));
    card(grid, 'Günlük değişim', pct(m.dailyChange));
    card(grid, 'RSI (14)', number(m.rsi14, 1));
    card(grid, '20 günlük getiri', pct(m.return20));
    card(grid, 'Son hacim', m.volume == null ? 'Veri yok' : number(m.volume, 0));
    card(grid, 'Hacim / 20g ort.', m.volumeRatio == null ? 'Veri yok' : number(m.volumeRatio, 2) + 'x');
    card(grid, 'EMA 20', money(m.ema20, m.currency));
    card(grid, 'EMA 50', money(m.ema50, m.currency));
    card(grid, 'EMA 200', money(m.ema200, m.currency));
    card(grid, '52 hafta içi en yüksek', money(m.highPeriod, m.currency));
    card(grid, '52 hafta içi en düşük', money(m.lowPeriod, m.currency));
    card(grid, 'Uzun trend', m.longTrend || 'Yetersiz geçmiş');
    result.appendChild(grid);

    var assessment = el('div', 'finansal-yorum');
    assessment.appendChild(el('h4', '', 'Ajanların ortak değerlendirmesi · ' + report.assessment.label));
    assessment.appendChild(el('p', '', 'Kısa vade: ' + report.assessment.shortTerm));
    assessment.appendChild(el('p', '', 'Uzun vade: ' + report.assessment.longTerm));
    report.assessment.positives.forEach(function (x) { assessment.appendChild(el('p', 'finansal-olumlu', '＋ ' + x)); });
    report.assessment.risks.forEach(function (x) { assessment.appendChild(el('p', 'finansal-risk', '⚠ ' + x)); });
    result.appendChild(assessment);

    var f = report.fundamentals;
    var valuation = el('div', 'finansal-ozet-kart');
    valuation.appendChild(el('h4', '', 'Ücretsiz kaynaklardan erişilebilen temel veriler'));
    var rows = [
      ['F/K', f && f.trailingPE != null ? number(f.trailingPE, 2) : '—'],
      ['İleri F/K', f && f.forwardPE != null ? number(f.forwardPE, 2) : '—'],
      ['PD/DD', f && f.priceToBook != null ? number(f.priceToBook, 2) : '—'],
      ['EPS', f && f.trailingEps != null ? money(f.trailingEps, f.currency) : '—'],
      ['ROE', f && f.roe != null ? pct(f.roe * 100) : '—'],
      ['Gelir büyümesi', f && f.revenueGrowth != null ? pct(f.revenueGrowth * 100) : '—'],
      ['Kâr büyümesi', f && f.earningsGrowth != null ? pct(f.earningsGrowth * 100) : '—'],
      ['Net kâr marjı', f && f.profitMargins != null ? pct(f.profitMargins * 100) : '—'],
      ['Borç/özkaynak', f && f.debtToEquity != null ? number(f.debtToEquity, 1) : '—'],
      ['Analist hedefi', f && f.targetMeanPrice != null ? money(f.targetMeanPrice, f.currency) : '—']
    ];
    rows.forEach(function (row) {
      var line = el('div', 'finansal-ozet-satir');
      line.appendChild(el('span', '', row[0]));
      line.appendChild(el('strong', '', row[1]));
      valuation.appendChild(line);
    });
    if (!f || rows.every(function (x) { return x[1] === '—'; })) {
      valuation.appendChild(el('p', 'alt', 'Yahoo Finance bu hisse için temel oranları ücretsiz uçtan sağlamadı. Bu nedenle F/K, PD/DD veya hedef fiyat uydurulmadı. KAP finansal raporları aşağıda listelenmiştir.'));
    }
    if (f && f.trailingEps != null && f.trailingEps > 0 && m.price != null) {
      var scenario = el('div', 'finansal-ozet-kart');
      scenario.appendChild(el('h4', '', 'Varsayımsal EPS çarpanı senaryosu'));
      var multiples = [8, 12, 16];
      multiples.forEach(function (multiple) {
        var estimate = f.trailingEps * multiple;
        var difference = (estimate / m.price - 1) * 100;
        var line = el('div', 'finansal-ozet-satir');
        line.appendChild(el('span', '', 'EPS × ' + multiple));
        line.appendChild(el('strong', '', money(estimate, m.currency) + ' · ' + (difference >= 0 ? '+' : '') + pct(difference)));
        scenario.appendChild(line);
      });
      scenario.appendChild(el('p', 'alt', 'Bunlar sektör değerlemesi veya hedef fiyat değildir; yalnızca 8x/12x/16x varsayımsal F/K çarpanlarıyla yapılan senaryolardır. Şirketin sektör, borç, nakit akışı, enflasyon ve tek seferlik kalemleri ayrıca incelenmelidir.'));
      result.appendChild(scenario);
    }
    result.appendChild(valuation);

    if (report.kap) {
      var kapLinks = el('p', 'finansal-kaynaklar');
      addLink(kapLinks, 'KAP şirket profili', report.kap.profileUrl);
      addLink(kapLinks, 'KAP bildirim arama', 'https://www.kap.org.tr/tr/bildirim-sorgu');
      addLink(kapLinks, 'KAP finansal tablo kalem sorgulama', 'https://www.kap.org.tr/tr/kalem-karsilastirma');
      result.appendChild(kapLinks);
      disclosureList(result, 'KAP finansal rapor bildirimleri', report.kap.financialReports);
      disclosureList(result, 'KAP özel durum açıklamaları', report.kap.disclosures);
    } else {
      var kapFallback = el('p', 'alt', 'KAP bildirimleri otomatik alınamadı. Resmî KAP sorgusunu kullanabilirsin.');
      addLink(kapFallback, 'KAP bildirim sorgusunu aç', 'https://www.kap.org.tr/tr/bildirim-sorgu');
      result.appendChild(kapFallback);
    }

    var newsBox = el('div', 'finansal-ozet-kart');
    newsBox.appendChild(el('h4', '', 'Ücretsiz haber başlıkları'));
    if (report.news.length) {
      report.news.forEach(function (item) {
        var line = el('p', 'finansal-kap-satir');
        addLink(line, item.title, item.link);
        line.appendChild(el('small', '', ' · ' + item.publisher + (item.date ? ' · ' + safeDate(item.date) : '')));
        newsBox.appendChild(line);
      });
    } else {
      newsBox.appendChild(el('p', 'alt', 'Yahoo Finance haber akışından başlık alınamadı.'));
    }
    result.appendChild(newsBox);

    if (report.errors && report.errors.length) {
      var errorBox = el('div', 'finansal-veri-notu');
      errorBox.appendChild(el('strong', '', 'Yanıt vermeyen kaynaklar'));
      report.errors.forEach(function (message) {
        errorBox.appendChild(el('p', '', message));
      });
      result.appendChild(errorBox);
    }
    var sources = el('p', 'alt', 'Kaynaklar: Yahoo Finance herkese açık fiyat/haber uçları ve KAP kamuya açık şirket/bildirim sayfaları. Yahoo uçları resmî, garantili API değildir; kesilebilir veya gecikebilir. KAP kurumsal veri yayın servisi kullanılmıyor. Bu çıktı yatırım tavsiyesi değildir.');
    result.appendChild(sources);
  }

  async function analizEt(symbol, status, result, button) {
    if (!symbol) throw new Error('Önce bir BIST hissesi seç.');
    button.disabled = true;
    result.replaceChildren();
    var code = String(symbol).toUpperCase().replace(/\.IS$/, '');
    try {
      status.textContent = code + ' için ücretsiz fiyat ve hacim geçmişi alınıyor…';
      var market = await Veri.ara(code + '.IS', '1d', function (message) {
        status.textContent = message || 'Piyasa verisi alınıyor…';
      });
      var converted = Veri.donustur(market, 220);
      if (!converted || !converted.d || converted.d.length < 30) throw new Error('Teknik analiz için yeterli günlük veri alınamadı.');

      var trend = Goruntu.trend(converted.m);
      var technical = Analiz.yap(converted.m, trend);
      var agents = window.TahminAI && typeof window.TahminAI.ajanlaraSor === 'function'
        ? window.TahminAI.ajanlaraSor(technical, converted.kal) : null;
      var metrics = metricsFromCandles(converted.d);
      metrics.currency = 'TRY';

      status.textContent = 'Yahoo Finance ve KAP üzerindeki ücretsiz şirket bilgileri araştırılıyor…';
      var tasks = await Promise.allSettled([
        window.BistArastirma && typeof window.BistArastirma.finansalGetir === 'function'
          ? window.BistArastirma.finansalGetir(code + '.IS') : Promise.reject(new Error('Temel veri modülü bulunamadı')),
        window.BistArastirma && typeof window.BistArastirma.haberGetir === 'function'
          ? window.BistArastirma.haberGetir(code + '.IS') : Promise.resolve([]),
        kapArastir(code)
      ]);
      var fundamentals = tasks[0].status === 'fulfilled' ? tasks[0].value : null;
      var news = tasks[1].status === 'fulfilled' ? tasks[1].value : [];
      var kap = tasks[2].status === 'fulfilled' ? tasks[2].value : null;
      var errors = [];
      tasks.forEach(function (task, i) {
        if (task.status === 'rejected') errors.push(['Temel oranlar', 'Haberler', 'KAP bildirimleri'][i] + ': ' + (task.reason && task.reason.message ? task.reason.message : String(task.reason)));
      });

      if (fundamentals && fundamentals.currentPrice != null) metrics.price = fundamentals.currentPrice;
      var assessment = buildAssessment(metrics, agents, fundamentals);
      var report = {
        symbol: code,
        company: kap && kap.company ? kap.company : (market.ad || code),
        generatedAt: new Date(),
        source: 'Yahoo Finance + KAP public pages',
        metrics: metrics,
        technical: technical,
        agents: agents,
        fundamentals: fundamentals,
        kap: kap,
        news: news,
        errors: errors,
        assessment: assessment
      };

      lastReport = report;
      window.FinansalPanel.sonRapor = report;
      if (window.TahminAI) {
        window.TahminAI.temelAnaliz = report;
        window.TahminAI.arastirmaBaglami = report;
      }
      if (window.Ajan) window.Ajan.temelAnaliz = report;
      if (window.GrafikAI) window.GrafikAI.temelAnaliz = report;
      if (window.BistArastirma) window.BistArastirma.sonRapor = report;

      render(report, result);
      status.textContent = 'Ücretsiz araştırma tamamlandı · ' + new Date().toLocaleString('tr-TR') +
        (errors.length ? ' · Bazı kaynaklar yanıt vermedi' : ' · Tüm kaynaklar yanıt verdi');
    } finally {
      button.disabled = false;
    }
  }

  function uiKur() {
    var section = document.getElementById('strateji');
    if (!section || document.getElementById('finansal-panel')) return;
    var list = window.TahminAI && Array.isArray(window.TahminAI.LISTE) ? window.TahminAI.LISTE : [];
    var wrap = el('div', 'kart finansal-panel');
    wrap.id = 'finansal-panel';
    wrap.appendChild(el('h3', '', '🆓 Ücretsiz BIST Finansal Araştırma Ajanı'));
    wrap.appendChild(el('p', 'alt', 'Ücretli API anahtarı yok. Yahoo Finance üzerinden erişilebilen fiyat/hacim ve haberler, KAP kamuya açık bildirimleri ve uygulamadaki teknik/hacim ajanları birlikte değerlendirilir.'));

    var label = el('label', '', 'Araştırılacak BIST hissesi');
    label.htmlFor = 'finansal-sembol';
    wrap.appendChild(label);
    var select = el('select', 'form-alani');
    select.id = 'finansal-sembol';
    list.forEach(function (item) {
      var option = el('option', '', item.q + ' — ' + item.ad);
      option.value = item.q;
      select.appendChild(option);
    });
    if (!list.length) {
      var option = el('option', '', 'BIST listesi yüklenemedi');
      option.value = '';
      select.appendChild(option);
    }
    wrap.appendChild(select);

    var note = el('p', 'finansal-veri-notu', 'Veriler gecikmeli veya eksik olabilir. Ücretsiz fiyat kaynağı resmî borsa veri akışı değildir. Temel oranlar bulunamazsa ajan adil fiyat uydurmaz; KAP raporlarını gösterir.');
    wrap.appendChild(note);

    var button = el('button', 'buton', 'ÜCRETSİZ ARAŞTIRMAYI BAŞLAT');
    button.type = 'button';
    wrap.appendChild(button);
    var status = el('p', 'durum');
    status.id = 'finansal-durum';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    wrap.appendChild(status);
    var result = el('div');
    result.id = 'finansal-sonuc';
    wrap.appendChild(result);

    var links = el('p', 'finansal-kaynaklar');
    addLink(links, 'Yahoo Finance', 'https://finance.yahoo.com/');
    addLink(links, 'KAP', 'https://www.kap.org.tr/tr');
    addLink(links, 'Borsa İstanbul', 'https://www.borsaistanbul.com/');
    wrap.appendChild(links);

    button.addEventListener('click', function () {
      if (button.disabled) return;
      analizEt(select.value, status, result, button).catch(function (error) {
        status.textContent = 'Ücretsiz araştırma tamamlanamadı: ' + (error && error.message ? error.message : String(error));
      });
    });
    section.appendChild(wrap);
  }

  window.FinansalPanel = {
    analizEt: analizEt,
    sonRapor: null,
    kapArastir: kapArastir
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', uiKur);
  else uiKur();
})();