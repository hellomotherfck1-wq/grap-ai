(function () {
  'use strict';
  var VEKIL = 'https://grafik-vekil.hellomotherfck1.workers.dev/?u=';
  var Ajan = { hacim: null };
  window.Ajan = Ajan;

  function topla(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }
  function ort(a) { return a.length ? topla(a) / a.length : 0; }
  function medyan(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function f1(x) { return isFinite(x) ? x.toFixed(1).replace('.', ',') : '?'; }
  function yuzde(x) { return isFinite(x) ? String(Math.round(x * 100)) : '?'; }
  function sinirla(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---------- Hacim verisini hazırla ---------- */
  function hacimHazirla(hacim, n) {
    if (!Array.isArray(hacim) || hacim.length !== n) return null;
    var v = hacim.map(function (x) { return (isFinite(x) && x > 0) ? +x : 0; });
    var pozitif = v.filter(function (x) { return x > 0; }).length;
    if (pozitif < Math.max(10, n * 0.6)) return null;
    return v;
  }

  /* ---------- 1. AJAN: HACİM AJANI ---------- */
  function hacimAjani(c, v) {
    var n = c.length;
    var R = { var: false, skor: 0, guven: 0, satirlar: [], iddia: '', olcu: null };
    if (!v) {
      R.satirlar = ['Bu grafikte hacim verisi yok (ekran görüntüsü, döviz ya da endeks olabilir).', 'Hacim hakkında yorum yapamıyorum.'];
      R.iddia = 'Hacim verisi yok, yorum yapamadım.';
      return R;
    }
    if (n < 25) {
      R.satirlar = ['Mum sayısı az (' + n + '). Hacim yorumu için en az 25 mum gerekir.'];
      R.iddia = 'Mum sayısı az, hacim yorumu yapamadım.';
      return R;
    }
    // Çağıran modül açık mumu ayıklayarak yalnızca kapanmış mumları gönderir.
    var son = n - 1;
    var baz = medyan(v.slice(Math.max(0, son - 29), son - 4));
    if (!(baz > 0)) {
      R.satirlar = ['Hacim verisi yetersiz, yorum yapamıyorum.'];
      R.iddia = 'Hacim verisi yetersiz.';
      return R;
    }
    var a5 = ort(v.slice(son - 4, son + 1));
    var b5 = ort(v.slice(son - 9, son - 4));
    var oran5 = a5 / baz;
    var fark = c[son].c - c[son - 10].c;
    var yonF = fark > 0.04 ? 1 : fark < -0.04 ? -1 : 0;
    var r = b5 > 0 ? a5 / b5 : 1;
    var hv = r > 1.2 ? 1 : r < 0.8 ? -1 : 0;
    var up = 0, dn = 0, i;
    for (i = son - 9; i <= son; i++) { if (c[i].yes) up += v[i]; else dn += v[i]; }
    var pay = (up + dn) > 0 ? up / (up + dn) : 0.5;
    var spike = null;
    for (i = son - 2; i <= son; i++) {
      var o = v[i] / baz;
      if (o >= 2 && (!spike || o > spike.oran)) spike = { oran: o, yesil: !!c[i].yes };
    }
    var s = 0, pro = 0, con = 0;
    function say(d) { s += d; if (d > 0) pro++; else if (d < 0) con++; }
    if (yonF > 0 && hv > 0) say(1);
    else if (yonF > 0 && hv < 0) say(-1);
    else if (yonF < 0 && hv > 0) say(-1);
    else if (yonF < 0 && hv < 0) say(0.5);
    if (pay >= 0.6) say(1); else if (pay <= 0.4) say(-1);
    if (spike) say(spike.yesil ? 1 : -1);
    R.var = true;
    R.skor = s >= 1.5 ? 2 : s >= 0.75 ? 1 : s <= -1.5 ? -2 : s <= -0.75 ? -1 : 0;
    var g = 1;
    if (n >= 50) g++;
    if (Math.abs(s) >= 1.5) g++;
    if (n < 35) g--;
    R.guven = sinirla(g, 0, 3);
    R.olcu = { baz: baz, oran5: oran5, yonF: yonF, hv: hv, pay: pay, spike: spike };

    var L = [];
    if (oran5 >= 1.5) L.push('Son mumlarda işlem hacmi normalin yaklaşık ' + f1(oran5) + ' katı. İlgi çok artmış.');
    else if (oran5 >= 1.15) L.push('Son mumlarda işlem hacmi normalin biraz üstünde.');
    else if (oran5 <= 0.6) L.push('Son mumlarda işlem hacmi normalin yarısı kadar. İlgi azalmış.');
    else if (oran5 <= 0.85) L.push('Son mumlarda işlem hacmi normalin altında.');
    else L.push('Son mumlarda işlem hacmi normal seviyede.');
    var fh;
    if (yonF > 0) fh = hv > 0 ? 'Fiyat yükselirken hacim de artıyor. Bu, yükselişin sağlam olduğuna işaret eder.'
      : hv < 0 ? 'Fiyat yükseliyor ama hacim azalıyor. Yükseliş zayıflıyor olabilir.'
      : 'Fiyat yükseliyor, hacim ise sabit.';
    else if (yonF < 0) fh = hv > 0 ? 'Fiyat düşerken hacim artıyor. Satıcılar güçlü, düşüş sert olabilir.'
      : hv < 0 ? 'Fiyat düşüyor ama hacim azalıyor. Satış baskısı yavaşlıyor olabilir.'
      : 'Fiyat düşüyor, hacim ise sabit.';
    else fh = hv > 0 ? 'Fiyat yatay ama hacim artıyor. Bir hareket hazırlanıyor olabilir.'
      : hv < 0 ? 'Fiyat yatay ve hacim azalıyor. Piyasa ilgisiz.'
      : 'Fiyat yatay, hacim sabit.';
    L.push(fh);
    L.push('Son 10 mumda hacmin yaklaşık %' + yuzde(pay) + '\'i yeşil mumlarda: ' +
      (pay >= 0.6 ? 'alıcılar baskın.' : pay <= 0.4 ? 'satıcılar baskın.' : 'alıcı ve satıcı dengede.'));
    if (spike) L.push('Son mumlardan birinde hacim patlaması var (normalin ' + f1(spike.oran) + ' katı, ' + (spike.yesil ? 'yeşil' : 'kırmızı') + ' mum).');
    var karisik = R.skor === 0 && pro > 0 && con > 0;
    var sonuc = R.skor >= 1 ? 'Hacim yükselişi destekliyor.' : R.skor <= -1 ? 'Hacim düşüşü destekliyor.'
      : karisik ? 'Hacim sinyalleri karışık, net bir yön yok.' : 'Hacim net bir yön göstermiyor.';
    L.push('Sonuç: ' + sonuc + ' (güven: ' + ['düşük', 'düşük', 'orta', 'yüksek'][R.guven] + ')');
    R.satirlar = L;
    R.iddia = sonuc;
    R.fiyatHacim = fh;
    return R;
  }

  /* ---------- 2. AJAN: DENETÇİ (güçlendirilmiş) ---------- */
  function denetci(s, kal, uy, c, v, H) {
    var n = c.length;
    var sor = [];
    function ekle(a, t) { sor.push({ a: a, t: t }); }
    var karar = s.karar || 'BEKLE';
    var yon = karar === 'AL' ? 1 : karar === 'SAT' ? -1 : 0;
    var oylar = Array.isArray(s.oylar) ? s.oylar : [];
    var pos = oylar.filter(function (o) { return o.puan > 0; }).length;
    var neg = oylar.filter(function (o) { return o.puan < 0; }).length;
    var i, j;

    /* ---- 1) Veri kalitesi ---- */
    if (n < 20) ekle(3, 'Mum sayısı çok az (' + n + '). Sonuç güvenilir değil.');
    else if (n < 30) ekle(2, 'Mum sayısı az (' + n + ').');

    var uyarilar = Array.isArray(uy) ? uy : [];
    var okunamadi = false;
    for (i = 0; i < uyarilar.length; i++) {
      var u = String(uyarilar[i]);
      if (u.indexOf('okunamad') >= 0) { okunamadi = true; ekle(1, 'Fiyat ekseni okunamadı, fiyatlar yüzde olarak gösteriliyor.'); }
      else ekle(2, 'Görüntü uyarısı: ' + u);
    }
    if (!kal && !okunamadi) ekle(1, 'Gerçek fiyat bilinmiyor, seviyeler yüzde olarak gösteriliyor.');

    /* ---- 2) Oy ve trend çelişkisi ---- */
    if (yon === 1 && neg >= 2) ekle(2, 'Karar AL ama ' + neg + ' yöntem düşüş diyor.');
    else if (yon === -1 && pos >= 2) ekle(2, 'Karar SAT ama ' + pos + ' yöntem yükseliş diyor.');
    else if (pos >= 2 && neg >= 2) ekle(1, 'Yöntemler iki yöne ayrılmış.');

    var t = s.trend;
    if (!t) ekle(1, 'Trend yönü belirlenemedi.');
    else if (yon === 1 && t.yon === 'Düşüş') ekle(2, 'Karar AL ama genel trend düşüş.');
    else if (yon === -1 && t.yon === 'Yükseliş') ekle(2, 'Karar SAT ama genel trend yükseliş.');

    if (isFinite(s.rsi)) {
      if (yon === 1 && s.rsi > 70) ekle(2, 'RSI aşırı alım bölgesinde (' + s.rsi + ').');
      if (yon === -1 && s.rsi < 30) ekle(2, 'RSI aşırı satım bölgesinde (' + s.rsi + ').');
    }

    /* ---- 3) Plan / RR ---- */
    var p = s.plan;
    if (yon !== 0) {
      if (!p) ekle(2, 'İşlem planı çıkarılamadı.');
      else {
        if (p.rr < 1) ekle(3, 'Risk/kazanç oranı çok düşük (1/' + f1(p.rr) + ').');
        else if (p.rr < 1.5) ekle(2, 'Risk/kazanç oranı düşük (1/' + f1(p.rr) + ').');
        var sonF = c[n - 1].c;
        var gMax = Math.max(p.g1, p.g2), gMin = Math.min(p.g1, p.g2);
        if (yon === 1 && sonF > gMax + 0.03) ekle(1, 'Fiyat giriş bölgesinin üstünde, geç kalınmış olabilir.');
        if (yon === -1 && sonF < gMin - 0.03) ekle(1, 'Fiyat giriş bölgesinin altında, geç kalınmış olabilir.');
      }
    }

    var form = Array.isArray(s.form) ? s.form : [];
    var ters = form.filter(function (f) { return yon !== 0 && f.yon * yon < 0; }).slice(0, 2);
    ters.forEach(function (f) { ekle(1, 'Kararın tersi yönde formasyon var: ' + f.ad + '.'); });

    var sv = s.sv || { destekler: [], direncler: [] };
    if (!(sv.destekler && sv.destekler.length) && !(sv.direncler && sv.direncler.length)) ekle(1, 'Net destek ve direnç bulunamadı.');

    /* ============================================================
       YENİ KONTROLLER (Denetçi güçlendirme)
       ============================================================ */

    /* ---- 4) Mum fitil / tuzak (son 3 mum) ---- */
    if (n >= 5) {
      for (i = n - 3; i < n; i++) {
        var m = c[i];
        var govde = Math.abs(m.c - m.o);
        var ustFitil = m.h - Math.max(m.c, m.o);
        var altFitil = Math.min(m.c, m.o) - m.l;
        var aralik = m.h - m.l;
        if (aralik <= 0) continue;
        if (ustFitil > govde * 1.8 && ustFitil / aralik >= 0.55) {
          if (yon === 1) ekle(2, 'Son mumlarda uzun üst fitil (alıcı ret / tuzak riski).');
          else ekle(1, 'Uzun üst fitil var; yukarı deneme reddedilmiş olabilir.');
          break;
        }
        if (altFitil > govde * 1.8 && altFitil / aralik >= 0.55) {
          if (yon === -1) ekle(2, 'Son mumlarda uzun alt fitil (satıcı ret / tuzak riski).');
          else ekle(1, 'Uzun alt fitil var; aşağı deneme reddedilmiş olabilir.');
          break;
        }
        if (govde / aralik < 0.12 && aralik > 0) {
          ekle(1, 'Son mumlarda doji benzeri kararsız mum var.');
          break;
        }
      }
    }

    /* ---- 5) Ani / aşırı mum (likidite avı) ---- */
    if (n >= 12) {
      var govdeler = [];
      for (i = n - 12; i < n - 1; i++) govdeler.push(Math.abs(c[i].c - c[i].o));
      var medG = medyan(govdeler);
      var sonG = Math.abs(c[n - 1].c - c[n - 1].o);
      var sonAr = c[n - 1].h - c[n - 1].l;
      if (medG > 0 && (sonG > medG * 3.5 || sonAr > medG * 4.5)) {
        ekle(2, 'Son mum normalin çok üzerinde (ani hareket / likidite avı riski).');
      }
    }

    /* ---- 6) Bollinger sıkışması ---- */
    if (n >= 22) {
      var cl = [];
      for (i = 0; i < n; i++) cl.push(c[i].c);
      var w = cl.slice(n - 20);
      var mu = ort(w), vr = 0;
      for (j = 0; j < w.length; j++) vr += (w[j] - mu) * (w[j] - mu);
      var sd = Math.sqrt(vr / w.length);
      if (sd > 1e-12 && mu > 0) {
        var genislik = (4 * sd) / mu;
        if (genislik < 0.03) ekle(2, 'Volatilite çok düşük (Bollinger sıkışması). Patlama riski yüksek, yön belirsiz.');
        else if (genislik < 0.05) ekle(1, 'Volatilite düşük; sıkışma sonrası ani hareket gelebilir.');
      }
    }

    /* ---- 7) RSI divergans (basit) ---- */
    if (n >= 30 && isFinite(s.rsi)) {
      var cl2 = [];
      for (i = 0; i < n; i++) cl2.push(c[i].c);
      var son14 = cl2.slice(n - 14);
      var once14 = cl2.slice(n - 28, n - 14);
      var maxSon = Math.max.apply(null, son14);
      var maxOnce = Math.max.apply(null, once14);
      var minSon = Math.min.apply(null, son14);
      var minOnce = Math.min.apply(null, once14);
      if (yon === 1 && maxSon > maxOnce * 1.005 && s.rsi > 65) {
        ekle(2, 'Fiyat yeni zirveye yakın ama RSI yüksek; negatif divergans riski (AL zayıf olabilir).');
      }
      if (yon === -1 && minSon < minOnce * 0.995 && s.rsi < 35) {
        ekle(2, 'Fiyat yeni dibe yakın ama RSI düşük; pozitif divergans riski (SAT zayıf olabilir).');
      }
    }

    /* ---- 8) Trend kırılımı ---- */
    if (n >= 10 && t && t.yon) {
      var yukselisKirik = 0, dususKirik = 0;
      for (i = n - 5; i < n; i++) {
        if (c[i].c < c[i - 1].c) yukselisKirik++;
        if (c[i].c > c[i - 1].c) dususKirik++;
      }
      if (t.yon === 'Yükseliş' && yon === 1 && yukselisKirik >= 4) {
        ekle(2, 'Trend yükseliş görünüyor ama son 5 mumun çoğu kırmızı; yapı bozuluyor olabilir.');
      }
      if (t.yon === 'Düşüş' && yon === -1 && dususKirik >= 4) {
        ekle(2, 'Trend düşüş görünüyor ama son 5 mumun çoğu yeşil; yapı bozuluyor olabilir.');
      }
    }

    /* ---- 9) Hacim + fitil uyumsuzluğu ---- */
    if (H && H.var && v && n >= 5) {
      var sonM = c[n - 1];
      var gov = Math.abs(sonM.c - sonM.o);
      var ar = sonM.h - sonM.l;
      var uF = sonM.h - Math.max(sonM.c, sonM.o);
      var aF = Math.min(sonM.c, sonM.o) - sonM.l;
      var bazH = 0, sayH = 0;
      for (i = Math.max(0, n - 25); i < n - 3; i++) {
        if (v[i] > 0) { bazH += v[i]; sayH++; }
      }
      bazH = sayH ? bazH / sayH : 0;
      var sonV = v[n - 1] || 0;
      if (bazH > 0 && sonV >= bazH * 1.8) {
        if (uF > gov * 1.5 && uF / (ar || 1) >= 0.4 && yon === 1) {
          ekle(3, 'Yüksek hacim + uzun üst fitil: alıcılar reddedilmiş olabilir (AL için kırmızı bayrak).');
        }
        if (aF > gov * 1.5 && aF / (ar || 1) >= 0.4 && yon === -1) {
          ekle(3, 'Yüksek hacim + uzun alt fitil: satıcılar reddedilmiş olabilir (SAT için kırmızı bayrak).');
        }
      }
    }

    /* ---- 10) Destek/direnç test sayısı ---- */
    if (sv) {
      var sonC = c[n - 1].c;
      function yakinTest(seviyeler, esik) {
        if (!Array.isArray(seviyeler) || !seviyeler.length) return 0;
        var sev = seviyeler[0].seviye;
        if (!isFinite(sev)) return 0;
        var say = 0;
        for (i = Math.max(0, n - 30); i < n; i++) {
          if (Math.abs(c[i].h - sev) <= esik || Math.abs(c[i].l - sev) <= esik) say++;
        }
        return say;
      }
      var es = Math.abs(sonC) * 0.008;
      var tD = yakinTest(sv.direncler, es);
      var tS = yakinTest(sv.destekler, es);
      if (yon === 1 && tD >= 3) ekle(2, 'Direnç en az ' + tD + ' kez test edilmiş; kırılım olmadan AL riskli.');
      if (yon === -1 && tS >= 3) ekle(2, 'Destek en az ' + tS + ' kez test edilmiş; kırılım olmadan SAT riskli.');
    }

    /* ---- 11) Coin volatilite ---- */
    var tur = (s.tur || '').toLowerCase();
    var kripto = tur.indexOf('kripto') >= 0 || tur.indexOf('coin') >= 0 || tur.indexOf('crypto') >= 0;
    if (kripto && yon !== 0 && n >= 5) {
      var pct = Math.abs(c[n - 1].c - c[n - 2].c) / (Math.abs(c[n - 2].c) || 1);
      if (pct > 0.08) ekle(2, 'Kripto: son mumda %' + Math.round(pct * 100) + ' hareket (yüksek volatilite, temkinli ol).');
    }

    /* ---- Hacim teyidi ---- */
    var teyit = 'yok', teyitMetni = 'Teyit edilecek hacim yorumu yok.', yon2 = 0, oran2 = 0;
    if (H && H.var && v) {
      // c dizisi açık mumdan arındırılmıştır; OBV son kapanmış muma kadar hesaplanır.
      var son2 = n - 1, obv = 0, top = 0;
      for (i = son2 - 9; i <= son2; i++) {
        if (i < 1) continue;
        var d = c[i].c - c[i - 1].c;
        obv += (d > 0 ? 1 : d < 0 ? -1 : 0) * v[i];
        top += v[i];
      }
      oran2 = top > 0 ? obv / top : 0;
      yon2 = oran2 > 0.15 ? 1 : oran2 < -0.15 ? -1 : 0;
      var uyum;
      if (H.skor === 0 && yon2 === 0) uyum = 'uyumlu';
      else if (H.skor * yon2 > 0) uyum = 'uyumlu';
      else if (H.skor * yon2 < 0) uyum = 'celisik';
      else uyum = 'kismen';
      if (uyum === 'uyumlu') { teyit = 'Teyit'; teyitMetni = 'Kendi yöntemimle (fiyat yönü x hacim) baktım, aynı sonucu buldum.'; }
      else if (uyum === 'kismen') { teyit = 'Kısmen teyit'; teyitMetni = 'Kendi yöntemimle baktım, sonuç tam net değil, kısmen katılıyorum.'; }
      else { teyit = 'Teyit edilemedi'; teyitMetni = 'Kendi yöntemimle baktım, farklı bir sonuç buldum. Bu yoruma tam güvenmiyorum.'; }
      if (n < 30 && teyit === 'Teyit') { teyit = 'Kısmen teyit'; teyitMetni += ' Ancak mum sayısı az.'; }
      if (uyum === 'celisik') ekle(2, 'Hacim ajanının yorumu bağımsız yöntemle teyit edilemedi.');
      if (yon !== 0) {
        var hv = H.skor * yon;
        if (hv < 0) ekle(2, 'Hacim, kararın tersi yönde sinyal veriyor.');
        else if (hv === 0) ekle(1, 'Hacim kararı net teyit etmiyor.');
      }
    }

    var toplam = 0;
    sor.forEach(function (x) { toplam += x.a; });
    var hata = toplam <= 2 ? 'Düşük' : toplam <= 5 ? 'Orta' : 'Yüksek';
    sor.sort(function (x, y) { return y.a - x.a; });
    return {
      sorunlar: sor,
      hata: hata,
      teyit: teyit,
      teyitMetni: teyitMetni,
      yon2: yon2,
      oran2: oran2,
      kontrol: 18
    };
  }

  /* ---------- Ortak sonuç ---------- */
  function ortak(s, H, D) {
    var k = s.karar || 'BEKLE';
    var yon = k === 'AL' ? 1 : k === 'SAT' ? -1 : 0;
    var son = k, durum = 'temkinli', neden = '';
    if (yon === 0) {
      son = 'BEKLE'; durum = 'net sinyal yok';
      neden = 'Grafikte yöntemler net bir yönde uyuşmuyor.';
      if (H.var && H.skor !== 0) neden += ' Hacim ' + (H.skor > 0 ? 'yükselişe' : 'düşüşe') + ' meyilli ama tek başına yeterli değil.';
    } else if (D.hata === 'Yüksek') {
      son = 'BEKLE'; durum = 'temkinli';
      neden = 'Denetçi birden fazla sorun buldu, bu yüzden acele edilmemeli.';
    } else if (!H.var) {
      son = k; durum = D.hata === 'Düşük' ? 'hacim teyidi yok' : 'temkinli';
      neden = 'Hacim verisi olmadığı için hacim teyidi yapılamadı.';
    } else {
      var hv = H.skor * yon;
      if (hv > 0) {
        son = k;
        durum = (D.teyit === 'Teyit edilemedi' || D.hata === 'Orta') ? 'temkinli' : 'teyitli';
        neden = 'Hacim de ' + (yon > 0 ? 'yükseliş' : 'düşüş') + ' yönünü destekliyor.';
      } else if (hv < 0) {
        son = 'BEKLE'; durum = 'hacim ters yönde';
        neden = 'Grafik ' + (yon > 0 ? 'yükseliş' : 'düşüş') + ' gösteriyor ama hacim bunu desteklemiyor.';
      } else {
        son = k; durum = 'temkinli';
        neden = 'Hacim bu yönü net teyit etmiyor.';
      }
    }
    return { son: son, durum: durum, neden: neden };
  }

  /* ---------- Kartlar ---------- */
  function kartlar(s, kal, uy) {
    var c = s.c;
    if (!Array.isArray(c) || c.length < 5) return null;
    var v = hacimHazirla(Ajan.hacim, c.length);
    var H = hacimAjani(c, v);
    var D = denetci(s, kal, uy, c, v, H);
    var O = ortak(s, H, D);

    var ort1 = ['Sonuç: ' + O.son + ' (' + O.durum + ')', O.neden,
      'Hata payı: ' + D.hata + '. Hata payı sıfır değildir; bu bir yatırım tavsiyesi değildir.'];

    var hAj = H.satirlar.slice();

    var dn = [];
    dn.push(D.kontrol + ' kontrol yapıldı, ' + D.sorunlar.length + ' sorun bulundu. Hata payı: ' + D.hata + '.');
    if (!D.sorunlar.length) dn.push('Ciddi bir sorun görmedim.');
    D.sorunlar.slice(0, 6).forEach(function (x) { dn.push((x.a >= 3 ? '🔴 ' : x.a === 2 ? '🟠 ' : '🟡 ') + x.t); });
    dn.push('Hacim ajanının yorumu: ' + D.teyit + '.');

    var tt = [];
    tt.push('🟦 Hacim Ajanı: ' + H.iddia + (H.fiyatHacim && H.skor !== 0 ? ' ' + H.fiyatHacim : ''));
    if (H.var) tt.push('🟧 Denetçi: ' + D.teyitMetni);
    else tt.push('🟧 Denetçi: Hacim verisi yok, bu yüzden yalnızca grafiği denetledim.');
    if (D.sorunlar.length) tt.push('🟧 Denetçi: Grafikte dikkat çeken nokta: ' + D.sorunlar[0].t);
    else tt.push('🟧 Denetçi: Grafikte ciddi bir sorun görmedim.');
    if (H.var) {
      if (D.teyit === 'Teyit edilemedi') tt.push('🟦 Hacim Ajanı: Haklısın, yorumumu zayıf kabul ediyorum.');
      else if (D.sorunlar.some(function (x) { return x.t.indexOf('Hacim, kararın tersi') === 0; })) tt.push('🟦 Hacim Ajanı: Evet, hacim kararla ters. İşlem için acele edilmemeli.');
      else tt.push('🟦 Hacim Ajanı: Teşekkürler, yorumum aynı kalıyor.');
    }
    tt.push('🟧 Denetçi: Hata payı ' + D.hata + '. Ortak sonuç: ' + O.son + ' (' + O.durum + ').');

    return [
      { baslik: '🤝 Ortak Sonuç: ' + O.son, satirlar: ort1 },
      { baslik: '🟦 Hacim Ajanı', satirlar: hAj },
      { baslik: '🟧 Denetçi Ajan (hata payı: ' + D.hata + ')', satirlar: dn },
      { baslik: '💬 Ajanların Tartışması', satirlar: tt }
    ];
  }
  Ajan.kartlar = kartlar;
  Ajan.hacimAjani = hacimAjani;
  Ajan.denetci = denetci;
  Ajan.ortak = ortak;

  /* ---------- Veri kaynağına hacim ekle ---------- */
  if (typeof Veri !== 'undefined' && Veri) {
    Veri.binance = async function (sembol, zd) {
      var hosts = ['https://data-api.binance.vision', 'https://api.binance.com'];
      var son;
      for (var h = 0; h < hosts.length; h++) {
        try {
          var j = await this.getir(hosts[h] + '/api/v3/klines?symbol=' + sembol + '&interval=' + zd + '&limit=120');
          if (!Array.isArray(j) || j.length < 20) throw new Error('Yeterli veri yok');
          return j.map(function (a) { return { t: a[0], o: +a[1], h: +a[2], l: +a[3], c: +a[4], v: +a[5] }; });
        } catch (e) { son = e; }
      }
      throw son;
    };

    Veri.yahoo = async function (sembol, zd) {
      var p = { '15m': ['15m', '5d'], '1h': ['60m', '1mo'], '1d': ['1d', '6mo'] }[zd];
      var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sembol) + '?interval=' + p[0] + '&range=' + p[1];
      var ac = new AbortController();
      var tm = setTimeout(function () { ac.abort(); }, 25000);
      var j;
      try {
        var r = await fetch(VEKIL + encodeURIComponent(url), { signal: ac.signal });
        if (!r.ok) {
          var ek = '';
          try { ek = (await r.text()).slice(0, 120); } catch (e1) {}
          throw new Error('HTTP ' + r.status + ' ' + ek);
        }
        j = await r.json();
      } catch (e) {
        throw new Error('[ajan] Vekil hatası: ' + (e.name === 'AbortError' ? 'zaman aşımı' : e.message));
      } finally {
        clearTimeout(tm);
      }
      if (!j || !j.chart) throw new Error('[ajan] Geçersiz yanıt');
      var r0 = j.chart.result && j.chart.result[0];
      if (!r0 || !r0.timestamp) throw new Error('[ajan] Sembol bulunamadı: ' + sembol);
      var q = r0.indicators.quote[0];
      var out = [];
      r0.timestamp.forEach(function (tt, i) {
        if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null) {
          out.push({ t: tt * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: (q.volume && q.volume[i] != null) ? q.volume[i] : 0 });
        }
      });
      if (out.length < 20) throw new Error('[ajan] Yeterli veri yok (' + out.length + ' mum)');
      return out;
    };

    // Backtest için daha uzun geçmiş: Yahoo Finance herkese açık chart ucu / Binance public klines.
    // Ücretli API anahtarı kullanılmaz. Güncel tarama uçları değiştirilmeden ayrı tutulur.
    Veri.gecmis = async function (girdi, zd) {
      var adaylar = this.coz(girdi);
      if (!adaylar.length) throw new Error('Varlık sembolü anlaşılamadı.');
      var aralik = {
        '15m': { yahoo: ['15m', '30d'], binance: '15m' },
        '1h': { yahoo: ['60m', '3mo'], binance: '1h' },
        '1d': { yahoo: ['1d', '2y'], binance: '1d' }
      }[zd || '1d'];
      if (!aralik) throw new Error('Desteklenmeyen zaman dilimi.');
      var sonHata = null;

      for (var a = 0; a < adaylar.length; a++) {
        var aday = adaylar[a];
        try {
          var mumlar = [];
          if (aday.kaynak === 'b') {
            var hosts = ['https://data-api.binance.vision', 'https://api.binance.com'];
            var binanceHata = null;
            for (var h = 0; h < hosts.length; h++) {
              try {
                var rows = await this.getir(
                  hosts[h] + '/api/v3/klines?symbol=' + encodeURIComponent(aday.sembol) +
                  '&interval=' + aralik.binance + '&limit=1000',
                  30000
                );
                if (!Array.isArray(rows) || rows.length < 80) throw new Error('Yeterli Binance geçmiş verisi yok.');
                mumlar = rows.map(function (row) {
                  return { t: Number(row[0]), o: Number(row[1]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]), v: Number(row[5]) };
                });
                break;
              } catch (eBinance) { binanceHata = eBinance; }
            }
            if (!mumlar.length) throw binanceHata || new Error('Binance geçmiş verisi alınamadı.');
          } else {
            var yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
              encodeURIComponent(aday.sembol) + '?interval=' + aralik.yahoo[0] + '&range=' + aralik.yahoo[1];
            var controller = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, 30000);
            var payload;
            try {
              var response = await fetch(VEKIL + encodeURIComponent(yahooUrl), { signal: controller.signal });
              if (!response.ok) throw new Error('Yahoo geçmiş veri HTTP ' + response.status);
              payload = await response.json();
            } finally {
              clearTimeout(timeout);
            }
            var chart = payload && payload.chart && payload.chart.result && payload.chart.result[0];
            if (!chart || !Array.isArray(chart.timestamp)) throw new Error('Yahoo Finance geçmiş verisi bulunamadı.');
            var quote = chart.indicators && chart.indicators.quote && chart.indicators.quote[0];
            if (!quote) throw new Error('Yahoo Finance mum alanları eksik.');
            chart.timestamp.forEach(function (time, index) {
              var o = quote.open && quote.open[index];
              var h = quote.high && quote.high[index];
              var l = quote.low && quote.low[index];
              var c = quote.close && quote.close[index];
              if (o != null && h != null && l != null && c != null) {
                mumlar.push({
                  t: Number(time) * 1000,
                  o: Number(o), h: Number(h), l: Number(l), c: Number(c),
                  v: quote.volume && quote.volume[index] != null ? Number(quote.volume[index]) : 0
                });
              }
            });
          }

          if (mumlar.length < 80) throw new Error('Geçmiş veri kısa (' + mumlar.length + ' mum).');
          return Object.assign({}, aday, {
            mumlar: mumlar,
            zd: zd || '1d',
            cekim: new Date(),
            gecmisAraligi: aday.kaynak === 'b' ? 'Binance son 1000 mum' : aralik.yahoo[1]
          });
        } catch (e) {
          sonHata = e;
        }
      }
      throw new Error('Ücretsiz geçmiş veri alınamadı' + (sonHata ? ': ' + (sonHata.message || sonHata) : '.'));
    };

    if (typeof Veri.donustur === 'function') {
      var eskiD = Veri.donustur;
      Veri.donustur = function (v, adet) {
        var r = eskiD.call(this, v, adet);
        try { Ajan.hacim = r.d.map(function (k) { return k.v; }); } catch (e) { Ajan.hacim = null; }
        return r;
      };
    }
  }

  if (typeof Goruntu !== 'undefined' && Goruntu && typeof Goruntu.mumlar === 'function') {
    var eskiM = Goruntu.mumlar;
    Goruntu.mumlar = function (r) { Ajan.hacim = null; return eskiM.call(this, r); };
  }

  if (typeof Yorum !== 'undefined' && Yorum && typeof Yorum.olustur === 'function') {
    var eskiY = Yorum.olustur;
    Yorum.olustur = function (s, kal, uy) {
      var y = eskiY.call(this, s, kal, uy);
      try {
        var k = kartlar(s, kal, uy);
        if (k && y && Array.isArray(y.kartlar)) Array.prototype.unshift.apply(y.kartlar, k);
      } catch (e) {
        try { y.kartlar.unshift({ baslik: '🤝 Ajanlar', satirlar: ['Ajan değerlendirmesi yapılamadı: ' + e.message] }); } catch (e2) {}
      }
      return y;
    };
  }

  try {
    var ay = document.getElementById('ayarlar');
    if (ay) {
      var pp = document.createElement('p');
      pp.className = 'kart';
      pp.textContent = 'Ajan modülü: yüklendi (hacim ajanı + güçlendirilmiş denetçi v2)';
      ay.appendChild(pp);
    }
  } catch (e3) {}
})();