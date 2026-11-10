/**
 * Ücretsiz geçmiş sinyal testi.
 * Sinyal yalnızca geçmişteki kapanmış mumlarla hesaplanır; giriş sonraki mum açılışındadır.
 * Tarihsel F/K/KAP/haber verisi bulunmadığından yalnızca teknik + hacim ajanları test edilir.
 */
(function () {
  'use strict';

  var ISINMA = 60;
  var AZAMI_BEKLEME = 10;
  var AZAMI_MUM = 600;

  function sayi(x) {
    return typeof x === 'number' && isFinite(x);
  }

  function fiyat(x) {
    if (!sayi(x)) return '—';
    var a = Math.abs(x);
    return x.toLocaleString('tr-TR', {
      minimumFractionDigits: a >= 100 ? 2 : a >= 1 ? 3 : 5,
      maximumFractionDigits: a >= 100 ? 2 : a >= 1 ? 3 : 5
    });
  }

  function yuzde(x) {
    if (!sayi(x)) return '—';
    return (x > 0 ? '+' : '') + x.toFixed(2).replace('.', ',') + '%';
  }

  function tarih(ms) {
    if (!sayi(ms)) return '—';
    return new Date(ms).toLocaleDateString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Bir sinyali sonraki mum açılışından itibaren simüle eder.
   * Aynı mumda hem stop hem hedef görülürse temkinli biçimde stop önce kabul edilir.
   */
  function simuleIslem(karar, giris, stop, hedef, mumlar, baslangic, bekleme, maliyet) {
    var yon = karar === 'AL' ? 1 : karar === 'SAT' ? -1 : 0;
    if (!yon || !sayi(giris) || giris <= 0 || !sayi(stop) || !sayi(hedef)) return null;
    if (yon > 0 && !(stop < giris && hedef > giris)) return null;
    if (yon < 0 && !(stop > giris && hedef < giris)) return null;

    var son = Math.min(mumlar.length - 1, baslangic + bekleme - 1);
    if (baslangic > son) return null;
    var cikis = null;
    var cikisIndex = baslangic;
    var neden = 'Zaman çıkışı';

    for (var i = baslangic; i <= son; i++) {
      var m = mumlar[i];
      if (!m || !sayi(m.o) || !sayi(m.h) || !sayi(m.l) || !sayi(m.c)) continue;

      if (yon > 0) {
        if (m.o <= stop) {
          cikis = m.o;
          neden = 'Stop boşluğu';
        } else if (m.l <= stop) {
          cikis = stop;
          neden = 'Stop';
        } else if (m.o >= hedef || m.h >= hedef) {
          cikis = hedef;
          neden = 'Hedef 1';
        }
      } else {
        if (m.o >= stop) {
          cikis = m.o;
          neden = 'Stop boşluğu';
        } else if (m.h >= stop) {
          cikis = stop;
          neden = 'Stop';
        } else if (m.o <= hedef || m.l <= hedef) {
          cikis = hedef;
          neden = 'Hedef 1';
        }
      }

      if (cikis !== null) {
        cikisIndex = i;
        break;
      }
      cikisIndex = i;
    }

    if (cikis === null) {
      var sonMum = mumlar[son];
      if (!sonMum || !sayi(sonMum.c)) return null;
      cikis = sonMum.c;
      cikisIndex = son;
    }

    var brut = yon * (cikis - giris) / giris * 100;
    var net = brut - Math.max(0, sayi(maliyet) ? maliyet : 0);
    return {
      karar: karar,
      yon: yon,
      giris: giris,
      stop: stop,
      hedef: hedef,
      cikis: cikis,
      baslangicIndex: baslangic,
      cikisIndex: cikisIndex,
      neden: neden,
      brutYuzde: brut,
      netYuzde: net
    };
  }

  function mumGecerli(m) {
    return m && sayi(m.t) && sayi(m.o) && sayi(m.h) && sayi(m.l) && sayi(m.c) &&
      m.o > 0 && m.h > 0 && m.l > 0 && m.c > 0 &&
      m.h >= Math.max(m.o, m.c) && m.l <= Math.min(m.o, m.c);
  }

  /**
   * Yalnızca kendisine verilen geçmiş mumları kullanır.
   * Son mum olası açık mum olabileceği için her zaman dışarıda bırakılır.
   */
  function analizEt(gelenMumlar, zd, maliyet, risk) {
    if (!window.Ajan || !window.TahminAI || typeof window.TahminAI.ajanlaraSor !== 'function') {
      throw new Error('Ajan modülleri yüklenemedi.');
    }
    if (typeof Veri === 'undefined' || typeof Veri.donustur !== 'function' ||
        typeof Analiz === 'undefined' || typeof Analiz.yap !== 'function' ||
        typeof Goruntu === 'undefined' || typeof Goruntu.trend !== 'function') {
      throw new Error('Teknik analiz modülleri yüklenemedi.');
    }

    var ham = Array.isArray(gelenMumlar) ? gelenMumlar.slice(0, -1) : [];
    var mumlar = ham.filter(mumGecerli);
    if (mumlar.length > AZAMI_MUM) mumlar = mumlar.slice(-AZAMI_MUM);
    if (mumlar.length < ISINMA + AZAMI_BEKLEME + 1) {
      throw new Error('Yeterli geçmiş veri yok. En az ' + (ISINMA + AZAMI_BEKLEME + 2) + ' mum gerekli.');
    }

    maliyet = Math.max(0, Math.min(5, sayi(maliyet) ? maliyet : 0.20));
    risk = Math.max(0.1, Math.min(5, sayi(risk) ? risk : 1));
    var A = window.Ajan;
    var eskiHacim = Array.isArray(A.hacim) ? A.hacim.slice() : A.hacim;
    var islemler = [];
    var sinyalSayisi = 0;
    var atlanan = 0;
    var sermaye = 100;
    var tepe = 100;
    var azamiDus = 0;

    try {
      for (var i = ISINMA; i < mumlar.length - AZAMI_BEKLEME; i++) {
        if (sermaye <= 0) break;
        var gecmis = mumlar.slice(0, i + 1);
        var donusum = Veri.donustur({ mumlar: gecmis }, gecmis.length);
        if (!donusum || !Array.isArray(donusum.m) || donusum.m.length < ISINMA) continue;

        A.hacim = gecmis.map(function (m) { return sayi(m.v) && m.v > 0 ? m.v : 0; });
        var trend = Goruntu.trend(donusum.m);
        var s = Analiz.yap(donusum.m, trend);
        var kurul = window.TahminAI.ajanlaraSor(s, donusum.kal);
        var karar = kurul && kurul.nihai && kurul.nihai.son ? kurul.nihai.son : s.karar;

        if (karar !== 'AL' && karar !== 'SAT') continue;
        sinyalSayisi++;
        if (!s.plan || !sayi(s.plan.stop) || !sayi(s.plan.t1)) {
          atlanan++;
          continue;
        }

        var aralik = donusum.kal.hi - donusum.kal.lo;
        if (!sayi(aralik) || aralik <= 0) {
          atlanan++;
          continue;
        }
        var stop = donusum.kal.lo + s.plan.stop * aralik;
        var hedef = donusum.kal.lo + s.plan.t1 * aralik;
        var girisMumu = mumlar[i + 1];
        var giris = girisMumu && girisMumu.o;
        var islem = simuleIslem(karar, giris, stop, hedef, mumlar, i + 1, AZAMI_BEKLEME, maliyet);
        if (!islem) {
          atlanan++;
          continue;
        }

        var riskMesafesi = Math.abs(giris - stop);
        if (riskMesafesi <= 0) {
          atlanan++;
          continue;
        }
        var baslangicSermaye = sermaye;
        var riskButcesi = sermaye * risk / 100;
        var miktar = Math.min(riskButcesi / riskMesafesi, sermaye / giris);
        if (!sayi(miktar) || miktar <= 0) {
          atlanan++;
          continue;
        }

        var brutKar = miktar * islem.yon * (islem.cikis - giris);
        var masraf = miktar * giris * (maliyet / 100);
        var netKar = brutKar - masraf;
        sermaye = Math.max(0, sermaye + netKar);

        islem.sembolKar = karar;
        islem.sinyalZamani = mumlar[i].t;
        islem.girisZamani = mumlar[i + 1].t;
        islem.cikisZamani = mumlar[islem.cikisIndex].t;
        islem.miktar = miktar;
        islem.brutKar = brutKar;
        islem.masraf = masraf;
        islem.netKar = netKar;
        islem.portfoyDegisim = baslangicSermaye > 0 ? netKar / baslangicSermaye * 100 : 0;
        islem.sermayeSonra = sermaye;
        islemler.push(islem);

        tepe = Math.max(tepe, sermaye);
        if (tepe > 0) azamiDus = Math.max(azamiDus, (tepe - sermaye) / tepe * 100);

        // Aynı anda birden fazla pozisyon açılmaz. Çıkış mumundan sonraki kapanışta
        // yeni sinyal aranabilir; bu nedenle döngü çıkış mumuna geri alınır.
        i = islem.cikisIndex - 1;
      }
    } finally {
      A.hacim = eskiHacim;
    }

    var kazanan = islemler.filter(function (x) { return x.netKar > 0; });
    var kaybeden = islemler.filter(function (x) { return x.netKar < 0; });
    var brutKazanc = kazanan.reduce(function (top, x) { return top + x.netKar; }, 0);
    var brutKayip = Math.abs(kaybeden.reduce(function (top, x) { return top + x.netKar; }, 0));
    var ortalama = islemler.length
      ? islemler.reduce(function (top, x) { return top + x.netYuzde; }, 0) / islemler.length : null;

    return {
      zamanDilimi: zd,
      mumSayisi: mumlar.length,
      ilkMum: mumlar[0].t,
      sonMum: mumlar[mumlar.length - 1].t,
      sonMumHaric: true,
      isinmaMumu: ISINMA,
      azamiBekleme: AZAMI_BEKLEME,
      maliyet: maliyet,
      risk: risk,
      sinyalSayisi: sinyalSayisi,
      atlanan: atlanan,
      islemler: islemler,
      islemSayisi: islemler.length,
      kazanan: kazanan.length,
      kaybeden: kaybeden.length,
      kazanmaOrani: islemler.length ? kazanan.length / islemler.length * 100 : null,
      toplamGetiri: sermaye - 100,
      azamiDus: azamiDus,
      karFaktoru: brutKayip > 0 ? brutKazanc / brutKayip : (brutKazanc > 0 ? Infinity : null),
      ortalamaIslem: ortalama
    };
  }

  async function testEt(sembol, zd, maliyet, risk, durum) {
    if (typeof Veri === 'undefined' || typeof Veri.gecmis !== 'function') {
      throw new Error('Ücretsiz geçmiş veri modülü yüklenemedi.');
    }
    zd = zd || '1d';
    if (typeof durum === 'function') durum('Ücretsiz geçmiş mumları alınıyor…');
    var veri = await Veri.gecmis(sembol, zd);
    if (typeof durum === 'function') durum('Kapanmış mumlar üzerinde ajan kararları test ediliyor…');
    var sonuc = analizEt(veri.mumlar, zd, maliyet, risk);
    sonuc.ad = veri.ad || veri.sembol;
    sonuc.sembol = veri.sembol;
    sonuc.kaynak = veri.kaynak === 'b' ? 'Binance herkese açık veri' : 'Yahoo Finance herkese açık veri';
    sonuc.veriCekim = veri.cekim ? veri.cekim.getTime() : Date.now();
    return sonuc;
  }

  function kpi(baslik, deger) {
    var kutu = document.createElement('div');
    kutu.className = 'backtest-kpi';
    var etiket = document.createElement('span');
    etiket.textContent = baslik;
    var sayiEl = document.createElement('strong');
    sayiEl.textContent = deger;
    kutu.appendChild(etiket);
    kutu.appendChild(sayiEl);
    return kutu;
  }

  function sonucCiz(sonuc, alan) {
    alan.replaceChildren();
    var grid = document.createElement('div');
    grid.className = 'backtest-kpi-grid';
    var karFaktoru = sonuc.karFaktoru === Infinity ? '∞'
      : sonuc.karFaktoru == null ? '—' : sonuc.karFaktoru.toFixed(2).replace('.', ',');
    [
      ['İşlem sayısı', String(sonuc.islemSayisi)],
      ['Kazanma oranı', sonuc.kazanmaOrani == null ? '—' : '%' + sonuc.kazanmaOrani.toFixed(1).replace('.', ',')],
      ['Simüle portföy', yuzde(sonuc.toplamGetiri)],
      ['Azami düşüş', '%' + sonuc.azamiDus.toFixed(2).replace('.', ',')],
      ['Kâr faktörü', karFaktoru],
      ['AL/SAT sinyali', String(sonuc.sinyalSayisi)]
    ].forEach(function (satir) { grid.appendChild(kpi(satir[0], satir[1])); });
    alan.appendChild(grid);

    var bilgi = document.createElement('p');
    bilgi.className = 'backtest-not';
    bilgi.textContent = sonuc.kaynak + ' · ' + sonuc.sembol + ' · ' + sonuc.mumSayisi +
      ' kapanmış mum · ' + tarih(sonuc.ilkMum) + ' – ' + tarih(sonuc.sonMum) +
      ' · işlem başı risk %' + sonuc.risk.toFixed(2).replace('.', ',') +
      ' · toplam gidiş-dönüş maliyeti %' + sonuc.maliyet.toFixed(2).replace('.', ',');
    alan.appendChild(bilgi);

    var aciklama = document.createElement('p');
    aciklama.className = 'backtest-not';
    aciklama.textContent = 'Sinyal mum kapanışında hesaplandı, giriş sonraki mum açılışında varsayıldı. Son mum test dışında. Stop ve hedef aynı mumda görülürse stop önce sayıldı. F/K, KAP ve haberler tarihsel olmadığı için bu teste dahil değil.';
    alan.appendChild(aciklama);

    if (!sonuc.islemler.length) {
      var bos = document.createElement('p');
      bos.className = 'backtest-not';
      bos.textContent = 'Bu veri aralığında ajan kurulu tarafından tamamlanmış AL/SAT işlemi üretilemedi. Kazanma oranı hesaplanmadı.';
      alan.appendChild(bos);
      return;
    }

    var baslik = document.createElement('h4');
    baslik.className = 'backtest-trades-title';
    baslik.textContent = 'Son işlemler';
    alan.appendChild(baslik);

    var wrap = document.createElement('div');
    wrap.className = 'backtest-table-wrap';
    var table = document.createElement('table');
    table.className = 'backtest-trade-table';
    var head = document.createElement('thead');
    var row = document.createElement('tr');
    ['Sinyal', 'Giriş', 'Çıkış', 'Karar', 'Net işlem %', 'Çıkış nedeni'].forEach(function (label) {
      var th = document.createElement('th');
      th.textContent = label;
      row.appendChild(th);
    });
    head.appendChild(row);
    table.appendChild(head);

    var body = document.createElement('tbody');
    sonuc.islemler.slice(-10).reverse().forEach(function (islem) {
      var tr = document.createElement('tr');
      [
        tarih(islem.sinyalZamani),
        fiyat(islem.giris),
        fiyat(islem.cikis),
        islem.karar,
        yuzde(islem.netYuzde),
        islem.neden
      ].forEach(function (value, index) {
        var td = document.createElement('td');
        td.textContent = value;
        if (index === 3) td.style.fontWeight = '800';
        if (index === 3) td.style.color = islem.karar === 'AL' ? '#26a69a' : '#ef5350';
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    alan.appendChild(wrap);

    var dipnot = document.createElement('p');
    dipnot.className = 'backtest-not';
    dipnot.textContent = 'Portföy hesabı: başlangıç 100 birim, işlem başı risk ' +
      sonuc.risk.toFixed(2).replace('.', ',') + '%, kaldıraçsız ve aynı anda tek pozisyon. SAT yönü kısa pozisyon varsayar; her spot piyasada short mümkün değildir.';
    alan.appendChild(dipnot);
  }

  function alan(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function kurUI() {
    var hedef = document.getElementById('strateji');
    if (!hedef || document.getElementById('backtest-panel')) return;

    var panel = alan('details', 'kart backtest-panel');
    panel.id = 'backtest-panel';
    panel.appendChild(alan('summary', '', 'Ücretsiz geçmiş sinyal testi (beta)'));
    panel.appendChild(alan('p', 'alt', 'Hisse veya coin sembolünü gir. Ücretsiz Yahoo Finance / Binance geçmiş verisi kullanılır; API anahtarı gerekmez.'));

    var grid = alan('div', 'backtest-controls');
    function alanEkle(labelText, id, type, value, placeholder) {
      var field = alan('div', 'backtest-field');
      var label = alan('label', '', labelText);
      label.htmlFor = id;
      var input = document.createElement(type === 'select' ? 'select' : 'input');
      input.id = id;
      if (type === 'select') {
        [['1d', 'Günlük'], ['1h', '1 saat'], ['15m', '15 dakika']].forEach(function (option) {
          var opt = document.createElement('option');
          opt.value = option[0];
          opt.textContent = option[1];
          input.appendChild(opt);
        });
      } else {
        input.type = type;
        input.value = value;
        input.placeholder = placeholder || '';
      }
      field.appendChild(label);
      field.appendChild(input);
      grid.appendChild(field);
      return input;
    }

    var sembol = alanEkle('Varlık sembolü', 'backtest-sembol', 'text', 'THYAO', 'THYAO, ASELS, BTC');
    var zaman = alanEkle('Zaman dilimi', 'backtest-zd', 'select');
    var maliyet = alanEkle('Toplam maliyet (%)', 'backtest-maliyet', 'number', '0.20');
    maliyet.min = '0';
    maliyet.max = '5';
    maliyet.step = '0.01';
    var risk = alanEkle('İşlem başı risk (%)', 'backtest-risk', 'number', '1');
    risk.min = '0.1';
    risk.max = '5';
    risk.step = '0.1';
    panel.appendChild(grid);

    var button = alan('button', 'buton', 'GEÇMİŞİ TEST ET');
    button.type = 'button';
    button.id = 'backtest-btn';
    panel.appendChild(button);
    var status = alan('p', 'durum', 'Varsayılan: günlük grafik, işlem başı %1 risk ve toplam %0,20 işlem maliyeti.');
    status.id = 'backtest-durum';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    panel.appendChild(status);
    var result = alan('div', 'backtest-sonuc');
    result.id = 'backtest-sonuc';
    panel.appendChild(result);
    hedef.appendChild(panel);

    button.addEventListener('click', function () {
      var symbol = String(sembol.value || '').trim();
      var cost = Number(maliyet.value);
      var riskValue = Number(risk.value);
      if (!symbol) {
        status.textContent = 'Önce bir hisse veya coin sembolü gir.';
        sembol.focus();
        return;
      }
      if (!sayi(cost) || cost < 0 || cost > 5 || !sayi(riskValue) || riskValue < 0.1 || riskValue > 5) {
        status.textContent = 'Maliyet %0–5, işlem başı risk %0,1–5 arasında olmalı.';
        return;
      }

      button.disabled = true;
      result.replaceChildren();
      status.textContent = 'Test başlatılıyor…';
      testEt(symbol, zaman.value, cost, riskValue, function (message) {
        status.textContent = message;
      }).then(function (sonuc) {
        sonucCiz(sonuc, result);
        status.textContent = 'Test tamamlandı · ' + sonuc.islemSayisi + ' işlem · ' + sonuc.mumSayisi + ' kapanmış mum.';
      }).catch(function (error) {
        status.textContent = 'Test tamamlanamadı: ' + (error && error.message ? error.message : String(error));
      }).then(function () {
        button.disabled = false;
      });
    });
  }

  window.BacktestAI = {
    analizEt: analizEt,
    testEt: testEt,
    simuleIslem: simuleIslem,
    ayarlar: { isinmaMumu: ISINMA, azamiBekleme: AZAMI_BEKLEME, azamiMum: AZAMI_MUM }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kurUI);
  } else {
    kurUI();
  }
})();