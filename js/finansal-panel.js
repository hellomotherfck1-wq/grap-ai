(function () {
  'use strict';

  var API = 'https://api.istfin.com/v1';
  var sonRapor = null;

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = String(text);
    return el;
  }

  function link(text, href) {
    var a = node('a', '', text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function sayi(n, digits) {
    if (n == null || n === '' || !isFinite(Number(n))) return '—';
    return new Intl.NumberFormat('tr-TR', {
      maximumFractionDigits: digits == null ? 2 : digits
    }).format(Number(n));
  }

  function para(n) {
    if (n == null || !isFinite(Number(n))) return '—';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(Number(n));
  }

  function yuzde(n) {
    return n == null || !isFinite(Number(n)) ? '—' : '%' + sayi(n, 1);
  }

  function kat(n) {
    return n == null || !isFinite(Number(n)) ? '—' : sayi(n, 2) + 'x';
  }

  async function apiGet(path, key) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch(API + path, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        signal: controller.signal
      });
      var body = null;
      try { body = await response.json(); } catch (e) {}
      if (!response.ok) {
        var detail = body && body.error && (body.error.message || body.error.code);
        throw new Error('HTTP ' + response.status + (detail ? ' · ' + detail : ''));
      }
      if (!body || typeof body !== 'object') throw new Error('API geçerli JSON döndürmedi.');
      return body.data != null ? body.data : body;
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('Finansal veri isteği zaman aşımına uğradı.');
      if (e instanceof TypeError) throw new Error('API bağlantısı tarayıcı tarafından engellendi. CORS veya internet bağlantısı kontrol edilmeli.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function kpi(parent, title, value, hint) {
    var box = node('div', 'finansal-kpi');
    box.appendChild(node('span', 'finansal-kpi-baslik', title));
    box.appendChild(node('strong', 'finansal-kpi-deger', value));
    if (hint) box.appendChild(node('small', 'finansal-kpi-ipucu', hint));
    parent.appendChild(box);
  }

  function tablo(parent, report, key, title) {
    var data = report[key];
    if (!data || !Array.isArray(data.items) || !data.items.length) return;
    var details = node('details', 'finansal-tablo-detay');
    var summary = node('summary', '', title + ' · ' + (data.periods || []).length + ' dönem');
    details.appendChild(summary);
    var wrap = node('div', 'finansal-tablo-kaydir');
    var table = node('table', 'finansal-tablo');
    var thead = node('thead');
    var trh = node('tr');
    trh.appendChild(node('th', '', 'Kalem'));
    (data.periods || []).slice(0, 4).forEach(function (period) {
      trh.appendChild(node('th', '', period));
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    var tbody = node('tbody');
    data.items.slice(0, 14).forEach(function (item) {
      var tr = node('tr');
      tr.appendChild(node('td', '', item.tr || item.code || 'Finansal kalem'));
      (data.periods || []).slice(0, 4).forEach(function (period) {
        var value = item.values && item.values[period];
        tr.appendChild(node('td', '', value == null ? '—' : sayi(value, 0)));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    details.appendChild(wrap);
    parent.appendChild(details);
  }

  function yorumla(data) {
    var r = data.ratios || {};
    var g = data.growth || {};
    var c = data.cashFlow || {};
    var olumlu = [];
    var risk = [];

    if (g.revenueYoY != null) {
      if (g.revenueYoY > 5) olumlu.push('Hasılat yıllık bazda büyüyor (' + yuzde(g.revenueYoY) + ').');
      else if (g.revenueYoY < 0) risk.push('Hasılat yıllık bazda gerilemiş (' + yuzde(g.revenueYoY) + ').');
    }
    if (g.profitYoY != null) {
      if (g.profitYoY > 5) olumlu.push('Kâr büyümesi pozitif (' + yuzde(g.profitYoY) + ').');
      else if (g.profitYoY < 0) risk.push('Kâr yıllık bazda düşmüş (' + yuzde(g.profitYoY) + ').');
    }
    if (r.roe != null) {
      if (r.roe >= 15) olumlu.push('Özkaynak kârlılığı güçlü seviyede (' + yuzde(r.roe) + ').');
      else if (r.roe < 5) risk.push('Özkaynak kârlılığı düşük (' + yuzde(r.roe) + ').');
    }
    if (r.netDebtToEbitda != null) {
      if (r.netDebtToEbitda > 3) risk.push('Net borç/FAVÖK yüksek (' + kat(r.netDebtToEbitda) + ').');
      else if (r.netDebtToEbitda < 1) olumlu.push('Net borç/FAVÖK düşük (' + kat(r.netDebtToEbitda) + ').');
    }
    if (r.currentRatio != null && r.currentRatio < 1) risk.push('Cari oran 1’in altında; kısa vadeli likidite izlenmeli.');
    if (c.free != null) {
      if (c.free > 0) olumlu.push('Serbest nakit akışı pozitif (' + para(c.free) + ').');
      else if (c.free < 0) risk.push('Serbest nakit akışı negatif (' + para(c.free) + ').');
    }

    var label = olumlu.length >= 2 && olumlu.length > risk.length
      ? 'Destekleyici temel görünüm'
      : (risk.length >= 2 && risk.length > olumlu.length ? 'Temel riskler öne çıkıyor' : 'Karışık temel görünüm');
    return { label: label, olumlu: olumlu, risk: risk };
  }

  function raporCiz(data, income, balance, cashflow, symbol, result) {
    result.replaceChildren();
    var valuation = data.valuation || {};
    var ratios = data.ratios || {};
    var growth = data.growth || {};
    var incomeData = data.income || {};
    var balanceData = data.balanceSheet || {};
    var cashData = data.cashFlow || {};
    var summary = yorumla(data);

    var head = node('div', 'finansal-rapor-baslik');
    head.appendChild(node('h4', '', (data.symbol || symbol) + ' · Temel analiz raporu'));
    head.appendChild(node('p', 'alt', 'Rapor dönemi: ' + (data.asOfQuarter || 'Belirtilmedi') +
      ' · Güncelleme: ' + (data.updatedAt ? new Date(data.updatedAt).toLocaleString('tr-TR') : 'Bilinmiyor')));
    result.appendChild(head);

    var metrics = node('div', 'finansal-kpi-grid');
    kpi(metrics, 'Piyasa değeri', para(valuation.marketCap));
    kpi(metrics, 'F/K', kat(valuation.peRatio), 'Sektör kıyası gerekir');
    kpi(metrics, 'PD/DD', kat(valuation.pbRatio), 'Sektör kıyası gerekir');
    kpi(metrics, 'FD/FAVÖK', kat(valuation.evToEbitda));
    kpi(metrics, 'ROE', yuzde(ratios.roe));
    kpi(metrics, 'Net kâr marjı', yuzde(ratios.profitMargin));
    kpi(metrics, 'Hasılat büyümesi', yuzde(growth.revenueYoY));
    kpi(metrics, 'Kâr büyümesi', yuzde(growth.profitYoY));
    kpi(metrics, 'Net borç/FAVÖK', kat(ratios.netDebtToEbitda));
    kpi(metrics, 'Cari oran', kat(ratios.currentRatio));
    result.appendChild(metrics);

    var judgement = node('div', 'finansal-yorum');
    judgement.appendChild(node('h4', '', 'Otomatik temel görünüm özeti · ' + summary.label));
    if (!summary.olumlu.length && !summary.risk.length) {
      judgement.appendChild(node('p', '', 'Yeterli temel gösterge bulunmadığı için olumlu veya olumsuz hüküm üretilmedi.'));
    }
    summary.olumlu.forEach(function (line) {
      judgement.appendChild(node('p', 'finansal-olumlu', '＋ ' + line));
    });
    summary.risk.forEach(function (line) {
      judgement.appendChild(node('p', 'finansal-risk', '⚠ ' + line));
    });
    judgement.appendChild(node('p', 'alt', 'Bu sınıflandırma yalnızca gelen finansal göstergelerin kural tabanlı özetidir; sektör medyanı, şirket özelindeki muhasebe etkileri ve güncel fiyat ayrıca incelenmelidir.'));
    result.appendChild(judgement);

    var table = node('div', 'finansal-ozet-kart');
    table.appendChild(node('h4', '', 'Bilanço ve nakit akışı özeti'));
    var rows = [
      ['Hasılat', incomeData.revenue],
      ['Net kâr', incomeData.profit],
      ['FAVÖK', incomeData.ebitda],
      ['Toplam varlıklar', balanceData.totalAssets],
      ['Özkaynaklar', balanceData.totalEquity],
      ['Toplam borç', balanceData.totalDebt],
      ['Nakit ve nakit benzerleri', balanceData.cashAndEquivalents],
      ['Faaliyet nakit akışı', cashData.operating],
      ['Serbest nakit akışı', cashData.free]
    ];
    rows.forEach(function (row) {
      var line = node('div', 'finansal-ozet-satir');
      line.appendChild(node('span', '', row[0]));
      line.appendChild(node('strong', '', para(row[1])));
      table.appendChild(line);
    });
    result.appendChild(table);

    var statements = {
      income: income,
      balance: balance,
      cashflow: cashflow
    };
    tablo(result, statements, 'income', 'Gelir tablosu');
    tablo(result, statements, 'balance', 'Bilanço');
    tablo(result, statements, 'cashflow', 'Nakit akış tablosu');

    var note = node('p', 'alt', 'Kaynak: istfin API; finansal tablolar KAP bildirimlerinden derlenir. Rakamlar sağlayıcının güncelleme zamanına bağlıdır. F/K ve PD/DD tek başına ucuzluk kanıtı değildir. Bu rapor yatırım tavsiyesi değildir.');
    result.appendChild(note);

    var actions = node('div', 'finansal-aksiyonlar');
    actions.appendChild(link('KAP bildirimlerini aç', 'https://www.kap.org.tr/tr/bildirim-sorgu'));
    actions.appendChild(link('API dokümantasyonu', 'https://api.istfin.com/docs'));
    result.appendChild(actions);

    sonRapor = {
      symbol: data.symbol || symbol,
      asOfQuarter: data.asOfQuarter || null,
      updatedAt: data.updatedAt || null,
      fundamentals: data,
      incomeStatement: income,
      balanceSheetStatement: balance,
      cashFlowStatement: cashflow,
      assessment: summary
    };
    window.FinansalPanel.sonRapor = sonRapor;
    if (window.TahminAI) window.TahminAI.temelAnaliz = sonRapor;
    if (window.GrafikAI) window.GrafikAI.temelAnaliz = sonRapor;
  }

  async function analizEt(symbol, key, status, result, button) {
    if (!key || key.trim().length < 12) throw new Error('Geçerli bir istfin API anahtarı gir.');
    button.disabled = true;
    status.textContent = 'Finansal özet, gelir tablosu, bilanço ve nakit akışı alınıyor…';
    result.replaceChildren();

    try {
      var code = encodeURIComponent(String(symbol).toUpperCase().replace(/\.IS$/, ''));
      var requests = await Promise.allSettled([
        apiGet('/fundamentals/' + code, key.trim()),
        apiGet('/financials/' + code + '/income?period=quarterly&limit=4', key.trim()),
        apiGet('/financials/' + code + '/balance?period=cumulative&limit=4', key.trim()),
        apiGet('/financials/' + code + '/cashflow?period=quarterly&limit=4', key.trim())
      ]);
      if (requests[0].status !== 'fulfilled') throw requests[0].reason;
      var income = requests[1].status === 'fulfilled' ? requests[1].value : null;
      var balance = requests[2].status === 'fulfilled' ? requests[2].value : null;
      var cashflow = requests[3].status === 'fulfilled' ? requests[3].value : null;

      raporCiz(requests[0].value, income, balance, cashflow, code, result);
      var failed = requests.slice(1).filter(function (item) { return item.status === 'rejected'; }).length;
      status.textContent = 'Temel analiz tamamlandı · ' + (failed ? (failed + ' tablo alınamadı') : '4 veri grubu alındı') +
        ' · ' + new Date().toLocaleString('tr-TR');
    } finally {
      button.disabled = false;
    }
  }

  function uiKur() {
    var section = document.getElementById('strateji');
    if (!section || document.getElementById('finansal-panel')) return;

    var list = window.TahminAI && Array.isArray(window.TahminAI.LISTE) ? window.TahminAI.LISTE : [];
    var wrap = node('div', 'kart finansal-panel');
    wrap.id = 'finansal-panel';

    wrap.appendChild(node('h3', '', '🏦 Temel Analiz ve Finansal Veri Merkezi'));
    wrap.appendChild(node('p', 'alt', 'BIST hisselerinin şirket finansallarını, değerleme oranlarını, büyümesini ve nakit akışını teknik analiz ekranından bağımsız incele. Sonuçlar mevcut ajanların okuyabilmesi için paylaşılır.'));

    var label = node('label', '', 'Araştırılacak BIST hissesi');
    label.htmlFor = 'finansal-sembol';
    wrap.appendChild(label);

    var select = node('select', 'form-alani');
    select.id = 'finansal-sembol';
    list.forEach(function (item) {
      var option = node('option', '', item.q + ' — ' + item.ad);
      option.value = item.q;
      select.appendChild(option);
    });
    if (!list.length) {
      var option = node('option', '', 'BIST listesi yüklenemedi');
      option.value = '';
      select.appendChild(option);
    }
    wrap.appendChild(select);

    var keyLabel = node('label', '', 'istfin API anahtarı');
    keyLabel.htmlFor = 'finansal-api-anahtari';
    wrap.appendChild(keyLabel);

    var key = node('input', 'form-alani');
    key.id = 'finansal-api-anahtari';
    key.type = 'password';
    key.autocomplete = 'off';
    key.placeholder = 'istfin_live_…';
    wrap.appendChild(key);

    wrap.appendChild(node('p', 'finansal-guvenlik-notu', 'Anahtar GitHub dosyalarına veya tarayıcı depolamasına kaydedilmez; yalnızca bu oturumdaki isteklerde kullanılır. Tarayıcıdan yapılan API çağrısında anahtar ağ isteğinde görünür.'));

    var button = node('button', 'buton', 'FİNANSAL ANALİZİ BAŞLAT');
    button.type = 'button';
    wrap.appendChild(button);

    var status = node('p', 'durum');
    status.id = 'finansal-durum';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    wrap.appendChild(status);

    var result = node('div');
    result.id = 'finansal-sonuc';
    wrap.appendChild(result);

    var links = node('p', 'finansal-kaynaklar');
    links.appendChild(link('istfin API ve anahtar bilgisi', 'https://api.istfin.com/docs'));
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(link('Resmî KAP bildirimleri', 'https://www.kap.org.tr/tr/bildirim-sorgu'));
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(link('Açık kaynak KAP-MCP', 'https://github.com/semudu/kap-client'));
    wrap.appendChild(links);

    var footer = node('p', 'alt', 'Not: istfin temel veri uçları API anahtarı ve fundamentals:read yetkisi gerektirir; kullanım ücretli bir plan gerektirebilir. Anahtarın yoksa KAP bağlantılarından şirket raporlarını ücretsiz inceleyebilirsin. Kısa vadeli fiyat hareketi için üstteki grafik ve teknik analiz ajanlarını kullan.');
    wrap.appendChild(footer);

    button.addEventListener('click', function () {
      if (button.disabled) return;
      analizEt(select.value, key.value, status, result, button).catch(function (error) {
        status.textContent = 'Finansal analiz tamamlanamadı: ' + (error && error.message ? error.message : String(error));
      });
    });

    section.appendChild(wrap);
  }

  window.FinansalPanel = {
    analizEt: analizEt,
    sonRapor: null
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', uiKur);
  else uiKur();
})();