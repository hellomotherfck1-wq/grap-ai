/**
 * Tahmin AI — günlük kurulum seçici
 * Diğer ajanlarla (Genel Analiz, Teknik, Hacim, Denetçi) bilgi alışverişi yapar.
 * Hafıza: localStorage.
 */
(function () {
  'use strict';

  var KEY = 'graphai_tahmin_v1';
  var BUGUN_KEY = 'graphai_tahmin_bugun';

  /** BIST 100 — uygulamadaki bist100.js ile aynı liste */
  var LISTE = [
    { q: 'AEFES', ad: 'Anadolu Efes' },
    { q: 'AGHOL', ad: 'AG Anadolu Grubu' },
    { q: 'AHGAZ', ad: 'Ahlatcı Doğalgaz' },
    { q: 'AKBNK', ad: 'Akbank' },
    { q: 'AKCNS', ad: 'Akçansa' },
    { q: 'AKFYE', ad: 'Akfen Yenilenebilir' },
    { q: 'AKSA', ad: 'Aksa Akrilik' },
    { q: 'AKSEN', ad: 'Aksa Enerji' },
    { q: 'ALARK', ad: 'Alarko Holding' },
    { q: 'ALBRK', ad: 'Albaraka Türk' },
    { q: 'ALTNY', ad: 'Altınay Savunma' },
    { q: 'ANHYT', ad: 'Anadolu Hayat' },
    { q: 'ANSGR', ad: 'Anadolu Sigorta' },
    { q: 'ARCLK', ad: 'Arçelik' },
    { q: 'ASELS', ad: 'Aselsan' },
    { q: 'ASTOR', ad: 'Astor Enerji' },
    { q: 'AYGAZ', ad: 'Aygaz' },
    { q: 'BERA', ad: 'Bera Holding' },
    { q: 'BIMAS', ad: 'BİM' },
    { q: 'BINHO', ad: '1000 Yatırımlar Holding' },
    { q: 'BRSAN', ad: 'Borusan Boru' },
    { q: 'BRYAT', ad: 'Borusan Yatırım' },
    { q: 'BTCIM', ad: 'Batıçim' },
    { q: 'CANTE', ad: 'Çan2 Termik' },
    { q: 'CCOLA', ad: 'Coca-Cola İçecek' },
    { q: 'CIMSA', ad: 'Çimsa' },
    { q: 'CVKMD', ad: 'CVK Maden' },
    { q: 'CWENE', ad: 'CW Enerji' },
    { q: 'DOAS', ad: 'Doğuş Otomotiv' },
    { q: 'DOHOL', ad: 'Doğan Holding' },
    { q: 'ECILC', ad: 'Eczacıbaşı İlaç' },
    { q: 'ECZYT', ad: 'Eczacıbaşı Yatırım' },
    { q: 'EGEEN', ad: 'Ege Endüstri' },
    { q: 'EGGUB', ad: 'Ege Gübre' },
    { q: 'EKGYO', ad: 'Emlak Konut' },
    { q: 'ENERY', ad: 'Enerya' },
    { q: 'ENJSA', ad: 'Enerjisa' },
    { q: 'ENKAI', ad: 'Enka İnşaat' },
    { q: 'ENTRA', ad: 'IC Enterra' },
    { q: 'EREGL', ad: 'Ereğli Demir Çelik' },
    { q: 'EUREN', ad: 'Europen Endüstri' },
    { q: 'FENER', ad: 'Fenerbahçe' },
    { q: 'FROTO', ad: 'Ford Otosan' },
    { q: 'GARAN', ad: 'Garanti BBVA' },
    { q: 'GLRMK', ad: 'Gülermak' },
    { q: 'GLYHO', ad: 'Global Yatırım Holding' },
    { q: 'GRSEL', ad: 'Gürsel Turizm' },
    { q: 'GUBRF', ad: 'Gübre Fabrikaları' },
    { q: 'GWIND', ad: 'Galata Wind' },
    { q: 'HALKB', ad: 'Halkbank' },
    { q: 'HEKTS', ad: 'Hektaş' },
    { q: 'ISCTR', ad: 'İş Bankası' },
    { q: 'ISDMR', ad: 'İskenderun Demir Çelik' },
    { q: 'ISMEN', ad: 'İş Yatırım' },
    { q: 'KARSN', ad: 'Karsan' },
    { q: 'KATMR', ad: 'Katmerciler' },
    { q: 'KCAER', ad: 'Kocaer Çelik' },
    { q: 'KCHOL', ad: 'Koç Holding' },
    { q: 'KORDS', ad: 'Kordsa' },
    { q: 'KRDMD', ad: 'Kardemir' },
    { q: 'LMKDC', ad: 'Limak Doğu Anadolu Çimento' },
    { q: 'MAVI', ad: 'Mavi' },
    { q: 'MGROS', ad: 'Migros' },
    { q: 'MPARK', ad: 'MLP Sağlık' },
    { q: 'OBAMS', ad: 'Oba Makarnacılık' },
    { q: 'ODAS', ad: 'Odaş Elektrik' },
    { q: 'OTKAR', ad: 'Otokar' },
    { q: 'OYAKC', ad: 'Oyak Çimento' },
    { q: 'PAHOL', ad: 'Pasifik Holding' },
    { q: 'PETKM', ad: 'Petkim' },
    { q: 'PGSUS', ad: 'Pegasus' },
    { q: 'RGYAS', ad: 'Rönesans GYO' },
    { q: 'RYSAS', ad: 'Reysaş' },
    { q: 'SAHOL', ad: 'Sabancı Holding' },
    { q: 'SASA', ad: 'Sasa Polyester' },
    { q: 'SISE', ad: 'Şişecam' },
    { q: 'SNGYO', ad: 'Sinpaş GYO' },
    { q: 'SOKM', ad: 'Şok Marketler' },
    { q: 'TABGD', ad: 'TAB Gıda' },
    { q: 'TAVHL', ad: 'TAV Havalimanları' },
    { q: 'TCELL', ad: 'Turkcell' },
    { q: 'TCKRC', ad: 'Kıraç Galvaniz' },
    { q: 'THYAO', ad: 'Türk Hava Yolları' },
    { q: 'TKFEN', ad: 'Tekfen Holding' },
    { q: 'TOASO', ad: 'Tofaş' },
    { q: 'TRALT', ad: 'Koza Altın' },
    { q: 'TRENJ', ad: 'İpek Doğal Enerji' },
    { q: 'TRGYO', ad: 'Torunlar GYO' },
    { q: 'TRMET', ad: 'Koza Anadolu Metal' },
    { q: 'TSKB', ad: 'TSKB' },
    { q: 'TTKOM', ad: 'Türk Telekom' },
    { q: 'TTRAK', ad: 'Türk Traktör' },
    { q: 'TUKAS', ad: 'Tukaş' },
    { q: 'TUPRS', ad: 'Tüpraş' },
    { q: 'TURSG', ad: 'Türkiye Sigorta' },
    { q: 'ULKER', ad: 'Ülker' },
    { q: 'VAKBN', ad: 'Vakıfbank' },
    { q: 'VESTL', ad: 'Vestel' },
    { q: 'YKBNK', ad: 'Yapı Kredi' },
    { q: 'ZOREN', ad: 'Zorlu Enerji' }
  ];

  function pad2(n) {
    n = String(n);
    return n.length < 2 ? '0' + n : n;
  }

  function bugunStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function okuHafiza() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { tahminler: [], meta: { dogru: 0, yanlis: 0, bekle: 0 } };
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return { tahminler: [], meta: { dogru: 0, yanlis: 0, bekle: 0 } };
      if (!Array.isArray(o.tahminler)) o.tahminler = [];
      if (!o.meta) o.meta = { dogru: 0, yanlis: 0, bekle: 0 };
      return o;
    } catch (e) {
      return { tahminler: [], meta: { dogru: 0, yanlis: 0, bekle: 0 } };
    }
  }

  function yazHafiza(h) {
    try {
      localStorage.setItem(KEY, JSON.stringify(h));
    } catch (e) { /* quota */ }
  }

  function okuBugunCache() {
    try {
      var raw = localStorage.getItem(BUGUN_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && o.tarih === bugunStr()) return o;
      return null;
    } catch (e) {
      return null;
    }
  }

  function yazBugunCache(kayit) {
    try {
      localStorage.setItem(BUGUN_KEY, JSON.stringify(kayit));
    } catch (e) { /* quota */ }
  }

  function dir(k) {
    return k === 'AL' ? 1 : k === 'SAT' ? -1 : 0;
  }

  function isaret(x) {
    return x > 0 ? 1 : x < 0 ? -1 : 0;
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /** Hafızaya yazılacak sade seçim (panel gibi ağır objeler yok) */
  function secimSade(s) {
    if (!s) return null;
    return {
      q: s.q || null,
      ad: s.ad || '—',
      sembol: s.sembol || '—',
      tur: s.tur || null,
      zd: s.zd || null,
      karar: s.karar || 'BEKLE',
      skor: typeof s.skor === 'number' ? s.skor : 0,
      uyum: s.uyum,
      genelKarar: s.genelKarar || null,
      teknikKarar: s.teknikKarar || null,
      hacimSkor: s.hacimSkor,
      hataPayi: s.hataPayi || null,
      ozet: s.ozet || '',
      tartisma: Array.isArray(s.tartisma) ? s.tartisma.slice(0, 12) : [],
      plan: s.plan || null,
      fiyat: s.fiyat,
      trend: s.trend || null,
      rsi: s.rsi,
      netYok: !!s.netYok
    };
  }

  function ajanlaraSor(s, kal) {
    var A = window.Ajan;
    var sonuc = {
      genel: { karar: (s && s.karar) || 'BEKLE', uyum: (s && s.uyum) || 0, score: (s && s.score) || 0 },
      teknik: null,
      hacim: null,
      denetci: null,
      nihai: null,
      tartisma: [],
      skor: 0,
      ozet: ''
    };

    if (!s || !Array.isArray(s.c) || s.c.length < 5) {
      sonuc.ozet = 'Yetersiz mum verisi.';
      sonuc.skor = 0;
      return sonuc;
    }

    if (!A || typeof A.hacimAjani !== 'function') {
      sonuc.ozet = 'Ajan modülleri yüklenmedi; yalnızca genel analiz kullanıldı.';
      sonuc.skor = skorSadeceGenel(s);
      sonuc.tartisma.push('⚠️ Hacim/Teknik ajan bulunamadı.');
      return sonuc;
    }

    var c = s.c;
    var v = null;
    if (Array.isArray(A.hacim) && A.hacim.length === c.length) {
      v = A.hacim.map(function (x) { return (isFinite(x) && x > 0) ? +x : 0; });
      var poz = 0;
      for (var i = 0; i < v.length; i++) if (v[i] > 0) poz++;
      if (poz < Math.max(10, c.length * 0.6)) v = null;
    }

    var H;
    try {
      H = A.hacimAjani(c, v);
    } catch (eH) {
      H = { var: false, skor: 0, iddia: 'Hacim ajanı hata: ' + (eH.message || eH), guven: 0, satirlar: [] };
    }
    sonuc.hacim = {
      var: !!H.var,
      skor: H.skor || 0,
      iddia: H.iddia || '',
      guven: H.guven || 0
    };
    sonuc.tartisma.push('🟦 Hacim: ' + (H.iddia || 'yorum yok'));

    var T = null;
    if (typeof A.teknikAjani === 'function') {
      try {
        T = A.teknikAjani(s, c);
        sonuc.teknik = {
          var: !!T.var,
          karar: T.karar || 'BEKLE',
          egilim: T.egilim || 0,
          guven: T.guven || 'düşük',
          ozet: T.ozet || '',
          rsi: T.rsi
        };
        sonuc.tartisma.push('🟩 Teknik: ' + (T.ozet || T.karar));
      } catch (eT) {
        sonuc.tartisma.push('🟩 Teknik: hata — ' + (eT.message || eT));
      }
    }

    var D = null;
    var N = null;
    try {
      if (typeof A.denetci === 'function') {
        D = A.denetci(s, kal || null, [], c, v, H);
      }
      if (D && typeof A.nihai === 'function' && T) {
        if (!D.teknikTeyit) D.teknikTeyit = 'yok';
        N = A.nihai(s, H, T, D);
      } else if (D && typeof A.ortak === 'function') {
        var O = A.ortak(s, H, D);
        N = { son: O.son, durum: O.durum, neden: O.neden };
      }
    } catch (eD) {
      sonuc.tartisma.push('🟧 Denetçi: hata — ' + (eD.message || eD));
    }

    if (D) {
      sonuc.denetci = {
        hata: D.hata || 'Orta',
        sorunSayisi: (D.sorunlar && D.sorunlar.length) || 0,
        teyit: D.teyit || D.teknikTeyit || ''
      };
      sonuc.tartisma.push(
        '🟧 Denetçi: hata payı ' + (D.hata || '?') +
        (D.sorunlar && D.sorunlar.length ? ', ' + D.sorunlar.length + ' sorun' : ', sorun yok')
      );
    }

    if (N) {
      sonuc.nihai = { son: N.son, durum: N.durum, neden: N.neden };
      sonuc.tartisma.push('⚖️ Nihai: ' + N.son + ' (' + N.durum + ')');
    }

    sonuc.skor = skorla(s, H, T, N, D);
    sonuc.ozet = ozetYap(s, H, T, N, sonuc.skor);
    return sonuc;
  }

  function skorSadeceGenel(s) {
    var base = 0;
    if (s.karar === 'AL' || s.karar === 'SAT') base = 40 + (s.uyum || 0) * 0.3;
    else base = 10 + Math.abs(s.score || 0) * 3;
    if (s.plan && isFinite(s.plan.rr)) {
      if (s.plan.rr >= 2) base += 13;
      else if (s.plan.rr >= 1.5) base += 8;
    }
    return Math.round(Math.min(100, Math.max(0, base)));
  }

  function skorla(s, H, T, N, D) {
    var skor = 0;
    var karar = (N && N.son) || s.karar || 'BEKLE';
    var y = dir(karar);

    if (y !== 0) skor += 35;
    else skor += 5;

    skor += Math.min(25, (s.uyum || 0) * 0.25);

    if (T && T.var) {
      var ty = dir(T.karar);
      if (ty === y && y !== 0) skor += 15;
      else if (ty === 0) skor += 3;
      else if (ty === -y) skor -= 12;
      if (T.guven === 'yüksek') skor += 6;
      else if (T.guven === 'orta') skor += 3;
    }

    if (H && H.var) {
      var hv = isaret(H.skor);
      if (hv === y && y !== 0) skor += 12 + Math.min(6, H.guven || 0);
      else if (hv === 0) skor += 2;
      else if (hv === -y) skor -= 10;
    } else {
      skor -= 3;
    }

    if (D) {
      if (D.hata === 'Düşük') skor += 10;
      else if (D.hata === 'Orta') skor += 3;
      else skor -= 15;
      skor -= Math.min(10, (D.sorunlar && D.sorunlar.length) || 0);
    }

    if (s.plan && isFinite(s.plan.rr)) {
      if (s.plan.rr >= 2) skor += 8;
      else if (s.plan.rr >= 1.5) skor += 5;
      else if (s.plan.rr < 1) skor -= 8;
    }

    var rsi = (T && T.rsi != null && isFinite(T.rsi)) ? T.rsi : s.rsi;
    if (isFinite(rsi)) {
      if (y > 0 && rsi > 72) skor -= 10;
      if (y < 0 && rsi < 28) skor -= 10;
      if (y > 0 && rsi >= 55 && rsi <= 68) skor += 4;
      if (y < 0 && rsi >= 32 && rsi <= 45) skor += 4;
    }

    if (N) {
      if (N.durum === 'güçlü teyit' || N.durum === 'teyitli') skor += 8;
      if (N.durum === 'hacim ters yönde' || N.durum === 'çelişki') skor -= 15;
      if (N.durum === 'temkinli') skor -= 3;
    }

    return Math.round(Math.min(100, Math.max(0, skor)));
  }

  function ozetYap(s, H, T, N, skor) {
    var karar = (N && N.son) || s.karar || 'BEKLE';
    var parcalar = [];
    parcalar.push('Karar ' + karar + ' (skor ' + skor + ')');
    if (T && T.var) parcalar.push('teknik: ' + T.karar);
    if (H && H.var) {
      parcalar.push('hacim: ' + (H.skor > 0 ? 'yükseliş' : H.skor < 0 ? 'düşüş' : 'nötr'));
    }
    if (N && N.neden) parcalar.push(N.neden);
    return parcalar.join(' · ');
  }

  async function taraBir(item, zd) {
    if (typeof Veri === 'undefined' || typeof Veri.ara !== 'function') {
      throw new Error('Veri modülü yok');
    }
    if (typeof Analiz === 'undefined' || typeof Analiz.yap !== 'function') {
      throw new Error('Analiz modülü yok');
    }
    if (typeof Goruntu === 'undefined' || typeof Goruntu.trend !== 'function') {
      throw new Error('Goruntu modülü yok');
    }

    var v = await Veri.ara(item.q, zd, function () {});
    var dn = Veri.donustur(v, 80);
    if (!dn || !dn.m || dn.m.length < 5) {
      throw new Error('Yeterli mum yok');
    }
    var t = Goruntu.trend(dn.m);
    var s = Analiz.yap(dn.m, t);
    var panel = ajanlaraSor(s, dn.kal);
    var karar = (panel.nihai && panel.nihai.son) || s.karar || 'BEKLE';
    var sonFiyat = (dn.d && dn.d.length) ? dn.d[dn.d.length - 1].c : null;

    return {
      q: item.q,
      ad: v.ad || item.ad,
      sembol: v.sembol,
      tur: v.tur,
      zd: zd,
      karar: karar,
      skor: panel.skor,
      uyum: s.uyum,
      genelKarar: s.karar,
      teknikKarar: panel.teknik ? panel.teknik.karar : null,
      hacimSkor: panel.hacim ? panel.hacim.skor : null,
      hataPayi: panel.denetci ? panel.denetci.hata : null,
      ozet: panel.ozet,
      tartisma: panel.tartisma,
      plan: s.plan && isFinite(s.plan.rr) ? {
        yon: s.plan.yon,
        rr: s.plan.rr,
        stop: s.plan.stop,
        t1: s.plan.t1,
        t2: s.plan.t2
      } : null,
      fiyat: sonFiyat,
      trend: t ? t.yon : null,
      rsi: s.rsi
    };
  }

  function kisaOzet(r) {
    return {
      ad: r.ad,
      sembol: r.sembol,
      karar: r.karar,
      skor: r.skor,
      teknik: r.teknikKarar,
      hacim: r.hacimSkor,
      hata: r.hataPayi
    };
  }

  async function bugunUret(zd, onProgress) {
    zd = zd || '1h';
    var adaylar = [];
    var hatalar = [];

    for (var i = 0; i < LISTE.length; i++) {
      var item = LISTE[i];
      if (typeof onProgress === 'function') onProgress(i + 1, LISTE.length, item.ad);
      try {
        var r = await taraBir(item, zd);
        adaylar.push(r);
      } catch (e) {
        hatalar.push(item.ad + ': ' + (e && e.message ? e.message : String(e)));
      }
      await sleep(280);
    }

    adaylar.sort(function (a, b) {
      var aNet = a.karar === 'BEKLE' ? -20 : 0;
      var bNet = b.karar === 'BEKLE' ? -20 : 0;
      return (b.skor + bNet) - (a.skor + aNet);
    });

    var enIyi = adaylar.length ? adaylar[0] : null;

    if (enIyi && enIyi.skor < 35) {
      enIyi = {
        karar: 'BEKLE',
        skor: enIyi.skor,
        ad: '—',
        sembol: '—',
        ozet: 'Bugün listede yeterince güçlü ve ajanların uyumlu olduğu bir kurulum bulunamadı. Temkinli kalın.',
        tartisma: enIyi.tartisma || [],
        netYok: true,
        zd: zd
      };
    }

    if (!enIyi) {
      enIyi = {
        karar: 'BEKLE',
        skor: 0,
        ad: '—',
        sembol: '—',
        ozet: 'Hiçbir varlık taranamadı. İnternet veya veri kaynağını kontrol et.',
        tartisma: [],
        netYok: true,
        zd: zd
      };
    }

    var secim = secimSade(enIyi);

    var kayit = {
      tarih: bugunStr(),
      saat: new Date().toISOString(),
      zd: zd,
      secim: secim,
      adaylar: adaylar.map(kisaOzet),
      hatalar: hatalar,
      ajanSurum: 'tahmin-v1.2'
    };

    var hafiza = okuHafiza();
    hafiza.tahminler = hafiza.tahminler.filter(function (t) { return t.tarih !== kayit.tarih; });
    hafiza.tahminler.unshift({
      tarih: kayit.tarih,
      sembol: secim.sembol,
      ad: secim.ad,
      karar: secim.karar,
      skor: secim.skor,
      ozet: secim.ozet,
      fiyat: secim.fiyat,
      zd: zd
    });
    if (hafiza.tahminler.length > 60) hafiza.tahminler = hafiza.tahminler.slice(0, 60);
    yazHafiza(hafiza);
    yazBugunCache(kayit);

    if (window.TahminAI) {
      window.TahminAI.sonDurum = kayit;
      window.TahminAI.paylasilan = {
        bugun: kayit.tarih,
        secim: secim,
        mesaj: secim.ad + ' → ' + secim.karar + ' (skor ' + secim.skor + ')'
      };
    }

    return kayit;
  }

  /* ---------- UI ---------- */

  function renkKarar(k) {
    if (k === 'AL') return '#26a69a';
    if (k === 'SAT') return '#ef5350';
    return '#f0b429';
  }

  function kart(baslik, satirlar, border) {
    var d = document.createElement('div');
    d.className = 'kart';
    if (border) d.style.borderLeft = '4px solid ' + border;
    if (baslik) {
      var h = document.createElement('h3');
      h.textContent = baslik;
      h.style.cssText = 'font-size:16px;margin-bottom:8px';
      d.appendChild(h);
    }
    (satirlar || []).forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      p.style.cssText = 'font-size:14px;line-height:1.5;margin-bottom:6px;color:#c8d1da';
      d.appendChild(p);
    });
    return d;
  }

  function renderKayit(kayit, alan) {
    if (!alan) return;
    alan.innerHTML = '';
    var s = kayit && kayit.secim;
    if (!s) {
      alan.appendChild(kart('Sonuç', ['Tahmin üretilemedi.']));
      return;
    }

    var baslik = s.netYok ? 'Bugün net kurulum yok' : ((s.ad || '?') + ' — ' + (s.karar || '?'));

    var ana = document.createElement('div');
    ana.className = 'kart';
    ana.style.borderLeft = '6px solid ' + renkKarar(s.karar);
    var k = document.createElement('div');
    k.textContent = s.karar || 'BEKLE';
    k.style.cssText = 'font-size:36px;font-weight:800;color:' + renkKarar(s.karar);
    ana.appendChild(k);
    var u = document.createElement('div');
    u.textContent = baslik + (s.skor != null ? ' · skor ' + s.skor + '/100' : '');
    u.style.cssText = 'font-size:15px;margin:6px 0 10px;color:#e6edf3';
    ana.appendChild(u);
    if (s.sembol && s.sembol !== '—') {
      var meta = document.createElement('p');
      meta.textContent = s.sembol +
        (s.fiyat != null && isFinite(s.fiyat) ? ' · son ~ ' + s.fiyat : '') +
        (s.zd ? ' · ' + s.zd : '') +
        (kayit.tarih ? ' · ' + kayit.tarih : '');
      meta.style.cssText = 'font-size:13px;color:#8b98a5;margin-bottom:8px';
      ana.appendChild(meta);
    }
    if (s.ozet) {
      var oz = document.createElement('p');
      oz.textContent = s.ozet;
      oz.style.cssText = 'font-size:14px;line-height:1.5';
      ana.appendChild(oz);
    }
    alan.appendChild(ana);

    if (s.tartisma && s.tartisma.length) {
      alan.appendChild(kart('Ajanların görüşü', s.tartisma, '#2f81f7'));
    }

    if (kayit.adaylar && kayit.adaylar.length) {
      var satirlar = kayit.adaylar.slice(0, 15).map(function (a, idx) {
        return (idx + 1) + '. ' + (a.ad || '?') + ' → ' + (a.karar || '?') +
          ' (skor ' + (a.skor != null ? a.skor : '?') +
          (a.teknik ? ', tek:' + a.teknik : '') +
          (a.hata ? ', hata:' + a.hata : '') + ')';
      });
      alan.appendChild(kart('Taranan adaylar', satirlar));
    }

    if (kayit.hatalar && kayit.hatalar.length) {
      alan.appendChild(kart('Veri alınamayanlar', kayit.hatalar.slice(0, 6), '#f0b429'));
    }

    alan.appendChild(kart('Uyarı', [
      'Bu otomatik bir tarama sonucudur; yatırım tavsiyesi değildir.',
      'Hata payı sıfır değildir. Kendi araştırmanızı yapın.'
    ]));
  }

  function renderGecmis(alan) {
    if (!alan) return;
    alan.innerHTML = '';
    var h = okuHafiza();
    if (!h.tahminler.length) {
      alan.appendChild(kart('Hafıza', ['Henüz kayıtlı günlük tahmin yok.']));
      return;
    }
    var satirlar = h.tahminler.slice(0, 14).map(function (t) {
      return (t.tarih || '?') + ' · ' + (t.ad || '?') + ' → ' + (t.karar || '?') +
        (t.skor != null ? ' (' + t.skor + ')' : '');
    });
    alan.appendChild(kart('Tahmin hafızası (son kayıtlar)', satirlar, '#8b98a5'));
  }

  function kurUI() {
    var sec = document.getElementById('strateji');
    if (!sec) return;

    sec.innerHTML =
      '<h2>Tahmin AI</h2>' +
      '<p class="alt">BIST 100’deki tüm hisseleri tarar; Teknik, Hacim ve Denetçi ajanlarına sorar; en yüksek skorlu kurulumu seçer. Hafıza bu cihazda saklanır.</p>' +
      '<select id="tahmin-zd" style="width:100%;padding:12px;margin-bottom:8px;border-radius:10px;border:1px solid #2a333d;background:#1a222c;color:#e6edf3;font-size:16px">' +
      '<option value="1h" selected>1 saatlik</option>' +
      '<option value="1d">Günlük</option>' +
      '<option value="15m">15 dakikalık</option>' +
      '</select>' +
      '<button type="button" id="tahmin-btn" class="buton">BUGÜNÜN TAHMİNİNİ ÜRET</button>' +
      '<p id="tahmin-durum" class="alt"></p>' +
      '<div id="tahmin-alan"></div>' +
      '<div id="tahmin-hafiza"></div>' +
      '<p class="kart" style="font-size:13px;color:#8b98a5">Not: BIST 100’ün tamamı taranır (~3–6 dk). Aynı gün tekrar üretirsen önceki kayıtın üzerine yazılır.</p>';

    var btn = document.getElementById('tahmin-btn');
    var durum = document.getElementById('tahmin-durum');
    var alan = document.getElementById('tahmin-alan');
    var hafizaEl = document.getElementById('tahmin-hafiza');

    function gosterCache() {
      var c = okuBugunCache();
      if (c) {
        renderKayit(c, alan);
        if (durum) durum.textContent = 'Bugünün tahmini hafızadan yüklendi. Yenilemek için tekrar üret.';
      }
      renderGecmis(hafizaEl);
    }

    if (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        if (alan) alan.innerHTML = '';
        var zdEl = document.getElementById('tahmin-zd');
        var zd = zdEl ? zdEl.value : '1h';
        bugunUret(zd, function (i, n, ad) {
          if (durum) durum.textContent = 'Taranıyor ' + i + '/' + n + ': ' + ad + '…';
        }).then(function (kayit) {
          if (durum) durum.textContent = 'Tamamlandı · ' + kayit.tarih;
          renderKayit(kayit, alan);
          renderGecmis(hafizaEl);
        }).catch(function (e) {
          if (durum) durum.textContent = 'Hata: ' + (e && e.message ? e.message : String(e));
        }).then(function () {
          btn.disabled = false;
        });
      });
    }

    var navBtn = document.querySelector('nav button[data-git="strateji"]');
    if (navBtn) {
      navBtn.addEventListener('click', function () {
        setTimeout(gosterCache, 30);
      });
    }
    gosterCache();
  }

  function navGuncelle() {
    var b = document.querySelector('nav button[data-git="strateji"]');
    if (!b) return;
    b.innerHTML = '<span>🎯</span>Tahmin';
  }

  window.TahminAI = {
    LISTE: LISTE,
    bugunUret: bugunUret,
    taraBir: taraBir,
    ajanlaraSor: ajanlaraSor,
    okuHafiza: okuHafiza,
    okuBugunCache: okuBugunCache,
    sonDurum: null,
    paylasilan: null
  };

  function baslat() {
    try {
      navGuncelle();
      kurUI();
    } catch (e) {
      try {
        var sec = document.getElementById('strateji');
        if (sec) sec.innerHTML = '<h2>Tahmin AI</h2><p class="kart">Arayüz hatası: ' + (e.message || e) + '</p>';
      } catch (e2) {}
    }
    try {
      var ay = document.getElementById('ayarlar');
      if (ay) {
        var pp = document.createElement('p');
        pp.className = 'kart';
        pp.textContent = 'Tahmin AI: yüklendi (v1.2 — BIST 100 tarama + ajan alışverişi)';
        ay.appendChild(pp);
      }
    } catch (e3) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }
})();