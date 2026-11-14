(function () {
  'use strict';

  var YAHOO = 'https://query1.finance.yahoo.com';

  function raw(x) {
    if (x && typeof x === 'object' && Object.prototype.hasOwnProperty.call(x, 'raw')) return Number(x.raw);
    if (typeof x === 'number') return x;
    return null;
  }

  function alan(o, k) {
    return o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null;
  }

  function sayi(x) {
    return typeof x === 'number' && isFinite(x) ? x : null;
  }

  function yuzde(x) {
    return x == null ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(x * 100) + '%';
  }

  function fiyatYaz(x, para) {
    if (x == null || !isFinite(x)) return '—';
    var p = para === 'TRY' ? 'TRY' : (para || 'TRY');
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: p, maximumFractionDigits: 2 }).format(x);
    } catch (e) {
      return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(x) + ' ' + p;
    }
  }

  function oranYaz(x) {
    return x == null ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(x);
  }

  async function jsonGet(url) {
    if (!window.GrapAIDataTransport) throw new Error('Ortak veri aktarım katmanı yüklenmedi.');
    return window.GrapAIDataTransport.json(url, {
      cacheTtlMs: 10 * 60 * 1000,
      staleMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
      timeoutMs: 6500,
      validate: function (value) {
        return !!(value && typeof value === 'object' && Array.isArray(value.news));
      }
    });
  }

  async function haberGetir(sembol) {
    var url = YAHOO + '/v1/finance/search?q=' + encodeURIComponent(sembol) + '&quotesCount=0&newsCount=8';
    var json = await jsonGet(url);
    var items = Array.isArray(json && json.news) ? json.news : [];
    return items.slice(0, 8).map(function (x) {
      return {
        title: String(x.title || 'Başlıksız haber'),
        publisher: String(x.publisher || x.provider || 'Kaynak belirtilmemiş'),
        link: String(x.link || x.url || ''),
        date: x.providerPublishTime ? new Date(x.providerPublishTime * 1000) : null
      };
    }).filter(function (x) { return x.link.indexOf('http') === 0; });
  }

  function kisaVade(panel, teknik, hacim) {
    var karar = panel && panel.nihai && panel.nihai.son ? panel.nihai.son :
      (teknik && teknik.karar ? teknik.karar : 'BEKLE');
    var neden = panel && panel.nihai && panel.nihai.neden ? panel.nihai.neden :
      (teknik && teknik.ozet ? teknik.ozet : 'Teknik ajanlardan net bir sonuç alınamadı.');
    var hacimMetni = hacim && hacim.iddia ? ' Hacim ajanı: ' + hacim.iddia : '';
    return karar + ' — ' + neden + hacimMetni;
  }

  function uzunVade(f) {
    if (!f) return 'Uzun vadeli temel görünüm için güvenilir finansal alanlar alınamadı; bilanço ve nakit akışı olmadan yön tahmini üretmiyorum.';
    var olumlu = 0, olumsuz = 0, veri = 0;
    if (f.revenueGrowth != null) { veri++; if (f.revenueGrowth > 0.05) olumlu++; else if (f.revenueGrowth < -0.05) olumsuz++; }
    if (f.earningsGrowth != null) { veri++; if (f.earningsGrowth > 0.05) olumlu++; else if (f.earningsGrowth < -0.05) olumsuz++; }
    if (f.roe != null) { veri++; if (f.roe > 0.12) olumlu++; else if (f.roe < 0.05) olumsuz++; }
    if (f.profitMargins != null) { veri++; if (f.profitMargins > 0.10) olumlu++; else if (f.profitMargins < 0) olumsuz++; }
    if (f.debtToEquity != null && !/financial|bank|insurance/i.test((f.sector || '') + ' ' + (f.industry || ''))) {
      veri++; if (f.debtToEquity < 100) olumlu++; else if (f.debtToEquity > 200) olumsuz++;
    }
    if (!veri) return 'Uzun vadeli görünüm için yeterli temel veri yok.';
    if (olumlu >= 2 && olumlu > olumsuz) return 'Basit temel göstergeler destekleyici; büyüme ve özkaynak kârlılığı olumlu. Borç ve nakit akışı ayrıca kontrol edilmeli.';
    if (olumsuz >= 2 && olumsuz > olumlu) return 'Temel göstergelerde zayıflık var; büyüme, kârlılık veya borçluluk kaynaklı riskler incelenmeli.';
    return 'Temel göstergeler karışık; uzun vadeli yön için yeni finansal raporlar ve sektör karşılaştırması gerekli.';
  }

  function degerleme(f, currentPrice) {
    if (!f) return {
      text: 'Değerleme verisi alınamadı. Fiyatın adil olup olmadığına dair sayı üretmiyorum.',
      scenarios: null,
      target: null
    };

    var eps = sayi(f.trailingEps);
    var scenarios = eps != null && eps > 0 ? {
      low: eps * 8,
      mid: eps * 12,
      high: eps * 16
    } : null;
    var target = sayi(f.targetMeanPrice);
    var upside = target != null && currentPrice > 0 ? ((target / currentPrice) - 1) * 100 : null;
    var pieces = [];
    if (f.trailingPE != null) pieces.push('F/K ' + oranYaz(f.trailingPE));
    if (f.forwardPE != null) pieces.push('ileri F/K ' + oranYaz(f.forwardPE));
    if (f.priceToBook != null) pieces.push('PD/DD ' + oranYaz(f.priceToBook));
    if (target != null) pieces.push('analist ortalama hedefi ' + fiyatYaz(target, f.currency) +
      (upside == null ? '' : ' (' + (upside >= 0 ? '+' : '') + oranYaz(upside) + '%)'));
    if (scenarios) pieces.push('EPS×8/12/16 senaryo bandı ' +
      fiyatYaz(scenarios.low, f.currency) + ' / ' + fiyatYaz(scenarios.mid, f.currency) + ' / ' + fiyatYaz(scenarios.high, f.currency));
    if (!pieces.length) pieces.push('Değerleme oranları sağlayıcıda bulunamadı.');
    return {
      text: pieces.join(' · '),
      scenarios: scenarios,
      target: target,
      upside: upside
    };
  }

  function raporOlustur(v, dn, panel, f, haberler, hata) {
    var son = dn && dn.d && dn.d.length ? dn.d[dn.d.length - 1].c : null;
    var fiyat = f && f.currentPrice != null ? f.currentPrice : son;
    var teknik = panel && panel.teknik;
    var hacim = panel && panel.hacim;
    var deger = degerleme(f, fiyat);
    return {
      name: v.ad || v.sembol,
      symbol: v.sembol,
      price: fiyat,
      currency: f && f.currency || 'TRY',
      shortTerm: kisaVade(panel, teknik, hacim),
      longTerm: uzunVade(f),
      valuation: deger,
      fundamentals: f,
      news: haberler || [],
      errors: hata || []
    };
  }

  function satir(parent, label, value) {
    var p = document.createElement('p');
    p.className = 'bist-research-line';
    var b = document.createElement('strong');
    b.textContent = label + ': ';
    var span = document.createElement('span');
    span.textContent = value == null || value === '' ? '—' : String(value);
    p.append(b, span);
    parent.appendChild(p);
  }

  function render(report, container) {
    container.replaceChildren();
    var h = document.createElement('h3');
    h.textContent = '🧭 Araştırma Ajanı · ' + report.name + ' (' + report.symbol + ')';
    container.appendChild(h);

    satir(container, 'Son fiyat', fiyatYaz(report.price, report.currency));
    satir(container, 'Kısa vade · 1–4 hafta', report.shortTerm);
    satir(container, 'Uzun vade · 6–12 ay', report.longTerm);
    satir(container, 'Değerleme ekranı', report.valuation.text);

    var f = report.fundamentals;
    if (f) {
      var metrics = [];
      if (f.sector) metrics.push('Sektör: ' + f.sector + (f.industry ? ' / ' + f.industry : ''));
      if (f.roe != null) metrics.push('ROE: ' + yuzde(f.roe));
      if (f.revenueGrowth != null) metrics.push('Gelir büyümesi: ' + yuzde(f.revenueGrowth));
      if (f.earningsGrowth != null) metrics.push('Kâr büyümesi: ' + yuzde(f.earningsGrowth));
      if (f.profitMargins != null) metrics.push('Net kâr marjı: ' + yuzde(f.profitMargins));
      if (f.debtToEquity != null) metrics.push('Borç/özkaynak: ' + oranYaz(f.debtToEquity));
      if (f.dividendYield != null) metrics.push('Temettü verimi: ' + yuzde(f.dividendYield));
      if (metrics.length) {
        var m = document.createElement('p');
        m.className = 'bist-research-line';
        m.textContent = metrics.join(' · ');
        container.appendChild(m);
      }
    }

    if (report.valuation.scenarios) {
      satir(container, 'F/K varsayım bandı', '8x: ' + fiyatYaz(report.valuation.scenarios.low, report.currency) +
        ' · 12x: ' + fiyatYaz(report.valuation.scenarios.mid, report.currency) +
        ' · 16x: ' + fiyatYaz(report.valuation.scenarios.high, report.currency));
    }

    if (report.news.length) {
      var newsTitle = document.createElement('h3');
      newsTitle.textContent = 'Son haber başlıkları';
      newsTitle.style.marginTop = '12px';
      container.appendChild(newsTitle);
      report.news.forEach(function (item) {
        var p = document.createElement('p');
        p.className = 'bist-research-news';
        var a = document.createElement('a');
        a.href = item.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = item.title;
        p.appendChild(a);
        var small = document.createElement('small');
        small.textContent = ' · ' + item.publisher + (item.date ? ' · ' + item.date.toLocaleString('tr-TR') : '');
        p.appendChild(small);
        container.appendChild(p);
      });
    } else {
      satir(container, 'Haberler', 'Yahoo Finance haber akışından başlık alınamadı.');
    }

    var sources = document.createElement('p');
    sources.className = 'bist-research-sources';
    var links = [
      { text: 'KAP bildirim sorgusu', href: 'https://www.kap.org.tr/tr/bildirim-sorgu' },
      { text: 'Borsa İstanbul verileri', href: 'https://www.borsaistanbul.com/en/data' },
      { text: 'Yahoo Finance şirket sayfası', href: 'https://finance.yahoo.com/quote/' + encodeURIComponent(report.symbol) }
    ];
    links.forEach(function (item, index) {
      if (index) sources.appendChild(document.createTextNode(' · '));
      var a = document.createElement('a');
      a.href = item.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = item.text;
      sources.appendChild(a);
    });
    container.appendChild(sources);

    var note = document.createElement('p');
    note.className = 'alt';
    note.textContent = 'Veri kaynağı: Yahoo Finance ve herkese açık KAP/Borsa İstanbul sayfaları. F/K×8/12/16 yalnızca varsayımsal senaryodur; sektör medyanı veya kesin içsel değer değildir. Analist hedefi de garanti değildir. Veriler gecikmeli/eksik olabilir; bu çıktı yatırım tavsiyesi değildir.';
    container.appendChild(note);

    if (report.errors.length) {
      var warn = document.createElement('p');
      warn.className = 'alt';
      warn.textContent = 'Haber akışına şu anda erişilemiyor. Teknik ve finansal analiz mevcut verilerle tamamlandı; haber etkisi değerlendirmeye alınmadı.';
      container.appendChild(warn);
    }
  }

  async function research(v, dn, panel) {
    var tasks = await Promise.allSettled([haberGetir(v.sembol)]);
    var news = tasks[0].status === 'fulfilled' ? tasks[0].value : [];
    var errors = [];
    if (tasks[0].status === 'rejected') errors.push('Haber akışı: ' + tasks[0].reason.message);
    return raporOlustur(v, dn, panel, null, news, errors);
  }

  async function grafikOzet(v, dn, sonuc, container) {
    var panel = window.TahminAI && typeof window.TahminAI.ajanlaraSor === 'function'
      ? window.TahminAI.ajanlaraSor(sonuc.s, dn.kal)
      : null;
    var report = await research(v, dn, panel);
    render(report, container);
    if (window.HaberAjani && typeof window.HaberAjani.analizEt === 'function') {
      var newsBox = document.createElement('div');
      newsBox.className = 'kart';
      newsBox.textContent = '📰 Haber Ajanı son 7 günün KAP ve haber akışını tarıyor…';
      if (container.parentNode) container.parentNode.insertBefore(newsBox, container.nextSibling);
      window.HaberAjani.analizEt(v, { yahoo: report.news || [] }).then(function (newsReport) {
        window.HaberAjani.render(newsReport, newsBox);
      }).catch(function (error) {
        newsBox.textContent = 'Haber kaynağı şu anda erişilemiyor; diğer analizler etkilenmedi.';
      });
    }
    return report;
  }

  async function derinArastir(sembol, status, result) {
    if (!window.Veri && typeof Veri === 'undefined') throw new Error('Piyasa veri modülü bulunamadı.');
    if (typeof Veri.ara !== 'function') throw new Error('Piyasa veri modülü hazır değil.');
    status.textContent = 'Günlük fiyat ve hacim geçmişi alınıyor…';
    var v = await Veri.ara(sembol, '1d', function (message) { status.textContent = message; });
    var mumlar = v.sonMumAcik && v.mumlar.length > 1 ? v.mumlar.slice(0, -1) : v.mumlar;
    var dn = Veri.donustur(Object.assign({}, v, { mumlar: mumlar }), 120);
    if (!dn || !dn.d || dn.d.length < 20) throw new Error('Kapanmış günlük mum sayısı araştırma için yetersiz.');
    var trend = Goruntu.trend(dn.m);
    var s = Analiz.yap(dn.m, trend);
    var panel = window.TahminAI && typeof window.TahminAI.ajanlaraSor === 'function'
      ? window.TahminAI.ajanlaraSor(s, dn.kal) : null;
    status.textContent = 'Finansal göstergeler ve haber başlıkları araştırılıyor…';
    var report = await research(v, dn, panel);
    var newsBox = null;
    if (window.HaberAjani && typeof window.HaberAjani.analizEt === 'function') {
      newsBox = document.createElement('div');
      newsBox.className = 'kart';
      newsBox.textContent = '📰 Haber Ajanı son 7 günün KAP ve haber akışını tarıyor…';
      window.HaberAjani.analizEt(v, { yahoo: report.news || [] }).then(function (newsReport) {
        window.HaberAjani.render(newsReport, newsBox);
        status.textContent = 'Araştırma tamamlandı · ' + new Date().toLocaleString('tr-TR');
      }).catch(function (error) {
        newsBox.textContent = 'Haber kaynağı şu anda erişilemiyor; diğer analizler etkilenmedi.';
        status.textContent = 'Araştırma tamamlandı · Haber kaynağına erişilemedi';
      });
    }
    result.replaceChildren();
    if (typeof Cizim !== 'undefined' && Cizim.grafik) {
      var canvas = Cizim.grafik(s, dn.kal);
      if (canvas) {
        canvas.className = 'analiz-grafik';
        result.appendChild(canvas);
      }
    }
    var content = document.createElement('div');
    content.className = 'kart';
    render(report, content);
    result.appendChild(content);
    if (newsBox) result.appendChild(newsBox);
    status.textContent = 'Araştırma tamamlandı · Haber Ajanı arka planda güncelleniyor';
  }

  function uiKur() {
    var section = document.getElementById('strateji');
    if (!section || document.getElementById('bist-arastirma-kutusu')) return;
    var list = window.TahminAI && Array.isArray(window.TahminAI.LISTE) ? window.TahminAI.LISTE : [];
    if (!list.length) return;

    var wrap = document.createElement('div');
    wrap.id = 'bist-arastirma-kutusu';
    wrap.className = 'kart';

    var title = document.createElement('h3');
    title.textContent = '🧭 BIST 100 Araştırma Ajanı';
    wrap.appendChild(title);

    var desc = document.createElement('p');
    desc.className = 'alt';
    desc.textContent = 'Bir BIST 100 şirketini seç. Ajan; fiyat/hacim geçmişini, mevcut teknik ajanların ortak görüşünü, erişilebilen temel oranları ve haber başlıklarını tek raporda birleştirir.';
    wrap.appendChild(desc);

    var label = document.createElement('label');
    label.textContent = 'Araştırılacak hisse';
    label.htmlFor = 'bist-arastirma-sembol';
    wrap.appendChild(label);

    var select = document.createElement('select');
    select.id = 'bist-arastirma-sembol';
    select.className = 'form-alani';
    list.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.q;
      option.textContent = item.q + ' — ' + item.ad;
      select.appendChild(option);
    });
    wrap.appendChild(select);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'buton';
    button.textContent = 'HİSSEYİ DERİN ARAŞTIR';
    wrap.appendChild(button);

    var status = document.createElement('p');
    status.className = 'durum';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    wrap.appendChild(status);

    var result = document.createElement('div');
    result.id = 'bist-arastirma-sonuc';
    wrap.appendChild(result);

    button.addEventListener('click', function () {
      if (button.disabled) return;
      button.disabled = true;
      result.replaceChildren();
      derinArastir(select.value, status, result).catch(function (e) {
        status.textContent = 'Araştırma tamamlanamadı: ' + (e && e.message ? e.message : String(e));
      }).then(function () {
        button.disabled = false;
      });
    });

    section.appendChild(wrap);
  }

  window.BistArastirma = {
    grafikOzet: grafikOzet,
    derinArastir: derinArastir,
    haberGetir: haberGetir
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', uiKur);
  else uiKur();
})();
