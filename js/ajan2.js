(function () {
  'use strict';
  var A = (typeof window !== 'undefined') ? window.Ajan : null;
  if (!A || typeof A.denetci !== 'function' || typeof A.hacimAjani !== 'function') return;

  function ort(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return a.length ? t / a.length : 0; }
  function f1(x) { return isFinite(x) ? x.toFixed(1).replace('.', ',') : '?'; }
  function isaret(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
  function dir(k) { return k === 'AL' ? 1 : k === 'SAT' ? -1 : 0; }

  function sayi(x) { return typeof x === 'number' && isFinite(x); }
  function temizS(s) {
    var o = {}, k;
    for (k in s) if (Object.prototype.hasOwnProperty.call(s, k)) o[k] = s[k];
    if (!sayi(o.rsi)) o.rsi = NaN;
    if (!sayi(o.alici)) o.alici = NaN;
    o.form = (Array.isArray(o.form) ? o.form : []).filter(function (f) { return f && typeof f === 'object'; })
      .map(function (f) { return { ad: String(f.ad || 'formasyon'), yon: sayi(f.yon) ? f.yon : 0 }; });
    o.oylar = (Array.isArray(o.oylar) ? o.oylar : []).filter(function (x) { return x && typeof x === 'object'; });
    if (!o.trend || typeof o.trend !== 'object') o.trend = null;
    if (!o.sv || typeof o.sv !== 'object') o.sv = { destekler: [], direncler: [] };
    if (!o.plan || typeof o.plan !== 'object') o.plan = null;
    return o;
  }

  function hacimHazirla(hacim, n) {
    if (!Array.isArray(hacim) || hacim.length !== n) return null;
    var v = hacim.map(function (x) { return (isFinite(x) && x > 0) ? +x : 0; });
    var poz = v.filter(function (x) { return x > 0; }).length;
    if (poz < Math.max(10, n * 0.6)) return null;
    return v;
  }

  function ema(a, p) {
    var k = 2 / (p + 1), o = [], i;
    for (i = 0; i < a.length; i++) o.push(i === 0 ? a[0] : a[i] * k + o[i - 1] * (1 - k));
    return o;
  }

  function rsiW(cl, p) {
    if (cl.length < p + 1) return null;
    var g = 0, l = 0, i, d;
    for (i = 1; i <= p; i++) { d = cl[i] - cl[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= p; l /= p;
    for (i = p + 1; i < cl.length; i++) {
      d = cl[i] - cl[i - 1];
      g = (g * (p - 1) + (d > 0 ? d : 0)) / p;
      l = (l * (p - 1) + (d < 0 ? -d : 0)) / p;
    }
    if (g + l === 0) return 50;
    if (l === 0) return 100;
    if (g === 0) return 0;
    return 100 * g / (g + l);
  }

  function atr(c, p) {
    if (!Array.isArray(c) || c.length < 2) return null;
    var tr = [];
    for (var i = 1; i < c.length; i++) {
      var range = c[i].h - c[i].l;
      var gapUp = Math.abs(c[i].h - c[i - 1].c);
      var gapDown = Math.abs(c[i].l - c[i - 1].c);
      var value = Math.max(range, gapUp, gapDown);
      if (sayi(value) && value >= 0) tr.push(value);
    }
    if (!tr.length) return null;
    return ort(tr.slice(-Math.max(1, p || 14)));
  }

  /* ---------- 3. AJAN: TEKNİK AJAN ---------- */
  function teknikAjani(s, c) {
    var n = c.length;
    var T = { var: false, karar: 'BEKLE', skor: 0, egilim: 0, guven: 'düşük', satirlar: [], oylar: [], ozet: '', uyari: '', nedenler: [] };
    if (n < 15) {
      T.satirlar = ['Mum sayısı az (' + n + '). Teknik yorum için en az 15 mum gerekir.'];
      T.ozet = 'Mum sayısı az, teknik yorum yapamadım.';
      T.uyari = 'Teknik ajan yeterli veriye sahip değil.';
      return T;
    }
    T.var = true;
    var cl = c.map(function (k) { return k.c; });
    var son = cl[n - 1];
    var oy = [];
    function ekle(ad, puan, yazi) { oy.push({ ad: ad, puan: puan, yazi: yazi }); }

    var t = s.trend;
    if (t && t.yon === 'Yükseliş' && t.guc >= 20) ekle('Trend', 1, 'Genel trend yukarı yönlü.');
    else if (t && t.yon === 'Düşüş' && t.guc >= 20) ekle('Trend', -1, 'Genel trend aşağı yönlü.');
    else ekle('Trend', 0, 'Genel trend yatay ya da zayıf.');

    var e9 = ema(cl, 9), e21 = ema(cl, 21);
    var kisaUst = e9[n - 1] > e21[n - 1];
    var fiyatUst = son > e21[n - 1];
    if (kisaUst && fiyatUst) ekle('Ortalamalar', 1, 'Kısa ortalama (EMA9) uzun ortalamanın (EMA21) üstünde ve fiyat ortalamaların üstünde. Eğilim yukarı.');
    else if (!kisaUst && !fiyatUst) ekle('Ortalamalar', -1, 'Kısa ortalama (EMA9) uzun ortalamanın (EMA21) altında ve fiyat ortalamaların altında. Eğilim aşağı.');
    else ekle('Ortalamalar', 0, 'Ortalamalar ve fiyat birbiriyle uyumsuz. Net eğilim yok.');

    if (n >= 35) {
      var e12 = ema(cl, 12), e26 = ema(cl, 26), m = [], i;
      for (i = 0; i < n; i++) m.push(e12[i] - e26[i]);
      var sg = ema(m, 9);
      var h1 = m[n - 1] - sg[n - 1], h0 = m[n - 2] - sg[n - 2];
      if (h1 > 0 && h1 >= h0) ekle('MACD', 1, 'MACD momentumu yukarı yönde ve güçleniyor.');
      else if (h1 < 0 && h1 <= h0) ekle('MACD', -1, 'MACD momentumu aşağı yönde ve güçleniyor.');
      else if (h1 > 0) ekle('MACD', 0, 'MACD yukarı yönde ama güç kaybediyor.');
      else if (h1 < 0) ekle('MACD', 0, 'MACD aşağı yönde ama güç kaybediyor.');
      else ekle('MACD', 0, 'MACD nötr.');
    } else ekle('MACD', 0, 'MACD için mum sayısı yetersiz (en az 35).');

    var rsi = rsiW(cl, 14);
    T.rsi = rsi;
    if (rsi === null) ekle('RSI', 0, 'RSI için mum sayısı yetersiz.');
    else {
      var rr = Math.round(rsi);
      if (rsi > 70) ekle('RSI', 0, 'RSI ' + rr + ': aşırı alım bölgesi, geri çekilme riski var.');
      else if (rsi >= 55) ekle('RSI', 1, 'RSI ' + rr + ': alıcılar güçlü.');
      else if (rsi < 30) ekle('RSI', 0, 'RSI ' + rr + ': aşırı satım bölgesi, tepki yükselişi gelebilir.');
      else if (rsi <= 45) ekle('RSI', -1, 'RSI ' + rr + ': satıcılar güçlü.');
      else ekle('RSI', 0, 'RSI ' + rr + ': nötr.');
    }

    if (n >= 20) {
      var w = cl.slice(n - 20), mu = ort(w), vr = 0, j;
      for (j = 0; j < w.length; j++) vr += (w[j] - mu) * (w[j] - mu);
      var sd = Math.sqrt(vr / w.length);
      if (sd > 1e-9) {
        var pb = (son - (mu - 2 * sd)) / (4 * sd);
        if (pb > 1) ekle('Bollinger', 0, 'Fiyat Bollinger üst bandının dışında: aşırı yükselmiş olabilir.');
        else if (pb < 0) ekle('Bollinger', 0, 'Fiyat Bollinger alt bandının dışında: aşırı düşmüş olabilir.');
        else if (pb >= 0.55) ekle('Bollinger', 1, 'Fiyat Bollinger bandının üst yarısında: yukarı eğilim.');
        else if (pb <= 0.45) ekle('Bollinger', -1, 'Fiyat Bollinger bandının alt yarısında: aşağı eğilim.');
        else ekle('Bollinger', 0, 'Fiyat Bollinger bandının ortasında.');
      } else ekle('Bollinger', 0, 'Bollinger hesaplanamadı (fiyat çok sabit).');
    } else ekle('Bollinger', 0, 'Bollinger için mum sayısı yetersiz (en az 20).');

    var sv = s.sv || { destekler: [], direncler: [] };
    var d0 = sv.direncler && sv.direncler[0] ? sv.direncler[0].seviye : null;
    var s0 = sv.destekler && sv.destekler[0] ? sv.destekler[0].seviye : null;
    var atrDeger = atr(c, 14);
    var yakinlik = Math.max((atrDeger || 0) * 0.6, 0.006);
    var yakinD = d0 !== null && isFinite(d0) && Math.abs(d0 - son) <= yakinlik;
    var yakinS = s0 !== null && isFinite(s0) && Math.abs(son - s0) <= yakinlik;
    if (yakinD && !yakinS) ekle('Destek/direnç', -1, 'Fiyat dirence yakın: geri dönüş riski var.');
    else if (yakinS && !yakinD) ekle('Destek/direnç', 1, 'Fiyat desteğe yakın: tepki yükselişi gelebilir.');
    else ekle('Destek/direnç', 0, 'Fiyat destek ve dirence yakın değil.');

    var form = Array.isArray(s.form) ? s.form : [];
    var fs = 0, fa = [];
    form.forEach(function (f) { if (f && isFinite(f.yon)) { fs += f.yon; if (f.yon !== 0 && fa.length < 2) fa.push(f.ad); } });
    if (fs > 0) ekle('Formasyonlar', 1, 'Yükseliş yönlü formasyon var' + (fa.length ? ' (' + fa.join(', ') + ').' : '.'));
    else if (fs < 0) ekle('Formasyonlar', -1, 'Düşüş yönlü formasyon var' + (fa.length ? ' (' + fa.join(', ') + ').' : '.'));
    else ekle('Formasyonlar', 0, 'Belirgin yönlü formasyon yok.');

    var al = s.alici;
    if (sayi(al)) {
      if (al >= 60) ekle('Alıcı/satıcı', 1, 'Son mumlarda alıcılar baskın (%' + Math.round(al) + ').');
      else if (al <= 40) ekle('Alıcı/satıcı', -1, 'Son mumlarda satıcılar baskın (%' + Math.round(100 - al) + ').');
      else ekle('Alıcı/satıcı', 0, 'Alıcı ve satıcı dengede.');
    } else ekle('Alıcı/satıcı', 0, 'Alıcı/satıcı baskısı hesaplanamadı.');

    var sc = 0, pro = 0, con = 0;
    oy.forEach(function (o) { sc += o.puan; if (o.puan > 0) pro++; else if (o.puan < 0) con++; });

    // Birbirine çok benzeyen göstergeler ayrı ayrı oy sayılmasın:
    // trend/EMA, momentum, fiyat yapısı/formasyon ve alıcı baskısı dört gruptur.
    var trendOy = isaret((oy[0] ? oy[0].puan : 0) + (oy[1] ? oy[1].puan : 0));
    var momentumOy = isaret((oy[2] ? oy[2].puan : 0) + (oy[3] ? oy[3].puan : 0) + (oy[4] ? oy[4].puan : 0));
    var yapiOy = isaret((oy[5] ? oy[5].puan : 0) + (oy[6] ? oy[6].puan : 0));
    var katilimOy = isaret(oy[7] ? oy[7].puan : 0);
    var gruplar = [
      { ad: 'Trend', yon: trendOy },
      { ad: 'Momentum', yon: momentumOy },
      { ad: 'Fiyat yapısı', yon: yapiOy },
      { ad: 'Alıcı baskısı', yon: katilimOy }
    ];
    var up = gruplar.filter(function (g) { return g.yon > 0; }).length;
    var down = gruplar.filter(function (g) { return g.yon < 0; }).length;
    var agirlikli = trendOy * 1.5 + momentumOy + yapiOy + katilimOy * 0.5;
    var aday = agirlikli >= 2.5 ? 1 : agirlikli <= -2.5 ? -1 : 0;
    var mutabakat = aday > 0 ? up : aday < 0 ? down : 0;

    T.oylar = oy;
    T.kategoriler = gruplar;
    T.skor = agirlikli;
    T.egilim = agirlikli >= 1.5 ? 1 : agirlikli <= -1.5 ? -1 : 0;
    T.karar = (n >= 35 && aday !== 0 && trendOy === aday && mutabakat >= 3)
      ? (aday > 0 ? 'AL' : 'SAT') : 'BEKLE';
    T.trendBlok = aday !== 0 && trendOy !== aday;
    T.guven = (mutabakat >= 3 && n >= 60) ? 'yüksek'
      : (mutabakat >= 2 && n >= 35) ? 'orta' : 'düşük';
    T.nedenler = oy.filter(function (o) { return o.puan !== 0 && (T.egilim === 0 || o.puan === T.egilim); })
      .slice(0, 2).map(function (o) { return o.yazi; });
    T.satirlar = oy.map(function (o) { return (o.puan > 0 ? '🟢 ' : o.puan < 0 ? '🔴 ' : '⚪ ') + o.yazi; });
    T.satirlar.push('Bağımsız grup teyidi: ' + gruplar.map(function (g) {
      return g.ad + ' ' + (g.yon > 0 ? 'yukarı' : g.yon < 0 ? 'aşağı' : 'nötr');
    }).join(' · ') + '.');
    var etiket = T.trendBlok ? 'Göstergeler ' + (aday > 0 ? 'yukarı' : 'aşağı') + ' yönlü ama trend grubu bunu teyit etmiyor (BEKLE)'
      : T.karar === 'AL' ? 'Bağımsız gösterge grupları yükselişi destekliyor (AL)'
      : T.karar === 'SAT' ? 'Bağımsız gösterge grupları düşüşü destekliyor (SAT)'
      : T.egilim > 0 ? 'Yükseliş eğilimi var ancak grup teyidi yeterli değil (BEKLE)'
      : T.egilim < 0 ? 'Düşüş eğilimi var ancak grup teyidi yeterli değil (BEKLE)'
      : 'Teknik görünüm net değil (BEKLE)';
    T.ozet = etiket + '.';
    T.satirlar.push('Sonuç: ' + etiket + '. ' + up + ' bağımsız grup yukarı, ' + down + ' grup aşağı. (güven: ' + T.guven + ')');
    return T;
  }

  /* ---------- Denetçi: üç kaynağı karşılaştır ---------- */
  function denetle(s, kal, uy, c, v, H, T) {
    var D = A.denetci(s, kal, uy, c, v, H);
    function e(a, x) { D.sorunlar.push({ a: a, t: x }); }
    if (c.length < 35) e(2, 'Kapanmış mum sayısı 35’in altında; güçlü sinyal üretmek için veri yetersiz.');
    var yA = dir(s.karar), yT = dir(T.karar);
    var teknikTeyit;
    if (!T.var) { teknikTeyit = 'yok'; e(2, 'Teknik ajan yeterli veriye sahip değil.'); }
    else {
      if (yA * yT < 0) { teknikTeyit = 'Teyit edilemedi'; e(3, 'Genel analiz (' + s.karar + ') ile teknik ajan (' + T.karar + ') ters yönde.'); }
      else if (yA === yT) teknikTeyit = 'Teyit';
      else {
        teknikTeyit = 'Kısmen teyit';
        if (yA !== 0) e(1, 'Teknik ajan genel analizi teyit etmiyor (BEKLE).');
        else e(1, 'Teknik ajan ' + T.karar + ' diyor ama genel analiz net değil.');
      }
      if (T.guven === 'düşük' && yT !== 0) e(1, 'Teknik ajanın güveni düşük.');
    }
    var top = 0;
    D.sorunlar.forEach(function (x) { top += x.a; });
    D.hata = top <= 2 ? 'Düşük' : top <= 5 ? 'Orta' : 'Yüksek';
    D.sorunlar.sort(function (x, y) { return y.a - x.a; });
    D.kontrol = (D.kontrol || 11) + 4;
    D.teknikTeyit = teknikTeyit;
    return D;
  }

  /* ---------- Nihai karar (Denetçi verir) ---------- */
  function nihai(s, H, T, D) {
    var a = dir(s && s.karar), t = T && T.var ? dir(T.karar) : 0;
    var vv = H && H.var ? isaret(H.skor) : 0;
    var yon = a || t;
    var yonAd = yon > 0 ? 'yükseliş' : yon < 0 ? 'düşüş' : 'belirsiz';
    var plan = s && s.plan;
    var rr = plan && sayi(plan.rr) ? plan.rr : null;
    var son = 'BEKLE', durum = 'yetersiz teyit', neden = '';

    if (D && D.hata === 'Yüksek') {
      durum = 'yüksek risk';
      neden = 'Denetçi yüksek risk buldu; işlem sinyali verilmedi.';
    } else if (!T || !T.var || !a || !t) {
      durum = 'eksik teyit';
      neden = 'Genel analiz ve teknik ajan aynı yönde açık sinyal üretmedi.';
    } else if (a !== t) {
      durum = 'ajanlar çelişiyor';
      neden = 'Genel analiz ile teknik ajan farklı yönlerde; karar BEKLE.';
    } else if (T.guven !== 'yüksek') {
      durum = 'teknik güven düşük';
      neden = 'Teknik ajan bağımsız gösterge gruplarından yüksek güvenli teyit alamadı.';
    } else if (!H || !H.var) {
      durum = 'hacim verisi yok';
      neden = 'Hacim teyidi bulunmadığı için AL/SAT kararı verilmedi.';
    } else if (vv !== a) {
      durum = vv === 0 ? 'hacim nötr' : 'hacim ters yönde';
      neden = vv === 0
        ? 'Hacim sinyali yönü doğrulamıyor; BEKLE.'
        : 'Hacim, genel analiz ve teknik ajanın ' + yonAd + ' sinyaliyle çelişiyor; BEKLE.';
    } else if (rr === null || rr < 1.5) {
      durum = rr === null
        ? 'risk/kazanç planı yok' : 'risk/kazanç yetersiz';
      neden = rr === null
        ? 'Geçerli stop ve hedef içeren işlem planı oluşturulamadı.'
        : 'Risk/kazanç oranı 1:1,5 altında (' + f1(rr) + '); işlem cazip değil.';
    } else {
      son = a > 0 ? 'AL' : 'SAT';
      durum = D && D.hata === 'Düşük' ? 'yüksek teyit' : 'teyitli';
      neden = 'Genel analiz, yüksek güvenli teknik ajan, hacim ve en az 1:1,5 risk/kazanç planı aynı ' +
        yonAd + ' yönünde birleşti.';
    }
    return { son: son, durum: durum, neden: neden, riskKazanc: rr };
  }

  function kartlar3(sHam, kal, uy) {
    var s = temizS(sHam);
    var tamC = s.c;
    var c = Array.isArray(s.analysisC) && s.analysisC.length ? s.analysisC : tamC;
    if (!Array.isArray(c) || c.length < 5) return null;
    var hamHacim = Array.isArray(A.hacim) ? A.hacim : null;
    if (hamHacim && Array.isArray(tamC) && hamHacim.length === tamC.length && c.length < tamC.length) {
      hamHacim = hamHacim.slice(0, c.length);
    }
    var v = hacimHazirla(hamHacim, c.length);
    var H = A.hacimAjani(c, v);
    var T = teknikAjani(s, c);
    var D = denetle(s, kal, uy, c, v, H, T);
    var N = nihai(s, H, T, D);

    var vv = H.var ? isaret(H.skor) : 0;
    var oyLine = 'Oylar: Genel analiz ' + (s.karar || 'BEKLE') + ' | Teknik ajan ' + (T.var ? T.karar : 'veri yok') + ' | Hacim ' + (H.var ? (vv > 0 ? 'yükseliş' : vv < 0 ? 'düşüş' : 'nötr') : 'veri yok');
    var nh = [
      'Karar: ' + N.son + ' (' + N.durum + ')',
      N.neden,
      oyLine,
      'Teknik güven: ' + T.guven + ' · Bağımsız grup teyidi: ' +
        (T.kategoriler || []).map(function (g) { return g.ad + ': ' + (g.yon > 0 ? 'yukarı' : g.yon < 0 ? 'aşağı' : 'nötr'); }).join(' / '),
      'Hata payı: ' + D.hata + '. Hata payı sıfır değildir; bu bir yatırım tavsiyesi değildir.'
    ];
    if (s.meta && s.meta.sonMumAcik) nh.push('Devam eden son mum analize alınmadı; yalnızca kapanmış mumlar kullanıldı.');
    var ogrenilenAgirliklar = window.AjanPerformans && typeof window.AjanPerformans.agirliklar === 'function'
      ? window.AjanPerformans.agirliklar({ market: s.meta && s.meta.market, timeframe: s.meta && s.meta.zd }) : null;
    if (ogrenilenAgirliklar) {
      nh.push('Geçmiş performans katsayıları (yalnızca tarama puanlamasında kullanılır): Genel ' +
        ogrenilenAgirliklar.general.katsayi.toFixed(2) + 'x · Teknik ' +
        ogrenilenAgirliklar.technical.katsayi.toFixed(2) + 'x · Hacim ' +
        ogrenilenAgirliklar.volume.katsayi.toFixed(2) + 'x. Yeterli örnek yoksa katsayı 1,00x kalır.');
      nh.push('Bu öğrenme nihai AL/SAT güvenlik şartlarını gevşetmez; karar için tüm zorunlu teyitler yine gerekir.');
    }

    var dn = [];
    dn.push(D.kontrol + ' kontrol yapıldı, ' + D.sorunlar.length + ' sorun bulundu. Hata payı: ' + D.hata + '.');
    if (!D.sorunlar.length) dn.push('Ciddi bir sorun görmedim.');
    D.sorunlar.slice(0, 6).forEach(function (x) { dn.push((x.a >= 3 ? '🔴 ' : x.a === 2 ? '🟠 ' : '🟡 ') + x.t); });
    dn.push('Hacim ajanının yorumu: ' + D.teyit + '. Teknik ajanın yorumu: ' + D.teknikTeyit + '.');

    var tt = [];
    tt.push('🟩 Teknik Ajan: ' + T.ozet + (T.nedenler.length ? ' Nedenleri: ' + T.nedenler.join(' ') : ''));
    tt.push('🟩 Teknik Ajan: Benzer göstergeleri ayrı ayrı saymadım; trend, momentum, fiyat yapısı ve katılım gruplarını karşılaştırdım.');
    if (!H.var) tt.push('🟦 Hacim Ajanı: Hacim verisi yok, teknik yoruma katkı veremiyorum.');
    else if (T.egilim === 0) tt.push('🟦 Hacim Ajanı: ' + (vv !== 0 ? 'Teknik net değil ama hacim ' + (vv > 0 ? 'yükselişe' : 'düşüşe') + ' meyilli.' : 'Hacim de net bir yön vermiyor.'));
    else if (vv === T.egilim) tt.push('🟦 Hacim Ajanı: Hacim teknik yorumu destekliyor.');
    else if (vv === 0) tt.push('🟦 Hacim Ajanı: Hacim net bir yön vermiyor, teknik yorumu teyit edemiyorum.');
    else tt.push('🟦 Hacim Ajanı: Hacim teknik yorumla aynı fikirde değil. ' + H.iddia);
    if (T.var && H.var && T.egilim !== 0 && vv === -T.egilim) tt.push('🟩 Teknik Ajan: Haklısın, bu yüzden güvenimi azaltıyorum.');
    else if (T.var && H.var && T.egilim !== 0 && vv === T.egilim) tt.push('🟩 Teknik Ajan: Teşekkürler, hacim görüşümü güçlendiriyor.');
    else if (T.var) tt.push('🟩 Teknik Ajan: Yorumum aynı kalıyor.');
    tt.push('🟧 Denetçi: Genel analiz ' + (s.karar || 'BEKLE') + ', teknik ajan ' + (T.var ? T.karar : 'veri yok') + '.' + (D.sorunlar.length ? ' Dikkat çeken nokta: ' + D.sorunlar[0].t : ' Ciddi bir sorun görmedim.'));
    tt.push('🟧 Denetçi: Hata payı ' + D.hata + '. Nihai karar: ' + N.son + ' (' + N.durum + ').');

    return [
      { baslik: '⚖️ Nihai Karar (Denetçi): ' + N.son, satirlar: nh },
      { baslik: '🟩 Teknik Ajan', satirlar: T.satirlar },
      { baslik: '🟦 Hacim Ajanı', satirlar: H.satirlar.slice() },
      { baslik: '🟧 Denetçi Ajan (hata payı: ' + D.hata + ')', satirlar: dn },
      { baslik: '💬 Ajanların Tartışması', satirlar: tt }
    ];
  }

  A.teknikAjani = teknikAjani;
  A.nihai = nihai;
  A.kartlar3 = kartlar3;

  if (typeof Yorum !== 'undefined' && Yorum && typeof Yorum.olustur === 'function') {
    var eskiY = Yorum.olustur;
    Yorum.olustur = function (s, kal, uy) {
      var y = eskiY.call(this, s, kal, uy);
      try {
        var yeni = kartlar3(s, kal, uy);
        if (yeni && y && Array.isArray(y.kartlar)) {
          var eskiBaslik = ['🤝 Ortak Sonuç', '🤝 Ajanlar', '🟦 Hacim Ajanı', '🟧 Denetçi Ajan', '💬 Ajanların'];
          y.kartlar = y.kartlar.filter(function (k) {
            return !(k && typeof k.baslik === 'string' && eskiBaslik.some(function (p) { return k.baslik.indexOf(p) === 0; }));
          });
          Array.prototype.unshift.apply(y.kartlar, yeni);

          // Ekranın ana kararı ve performans kaydı, teknik ön kararı değil kurulun nihai kararını göstermeli.
          var nihaiKart = yeni.find(function (k) { return k && String(k.baslik || '').indexOf('⚖️ Nihai Karar') === 0; });
          var eslesenKarar = nihaiKart && /:\s*(AL|SAT|BEKLE)\s*$/.exec(String(nihaiKart.baslik || ''));
          if (eslesenKarar) {
            y.karar = eslesenKarar[1];
            y.renk = y.karar === 'AL' ? '#26a69a' : y.karar === 'SAT' ? '#ef5350' : '#f0b429';
            var neden = nihaiKart.satirlar && nihaiKart.satirlar[1] ? String(nihaiKart.satirlar[1]) : '';
            y.ozet = ['Ajan kurulunun nihai kararı: ' + y.karar + '. ' + neden].concat(y.ozet || []);
            if (y.karar === 'BEKLE' && window.TahminAI && typeof window.TahminAI.beklemeKosullari === 'function') {
              var kosullar = window.TahminAI.beklemeKosullari(s, kal);
              if (kosullar && kosullar.satirlar && kosullar.satirlar.length) {
                y.kartlar.push({ baslik: '⏳ BEKLE koşulları · ne olursa AL/SAT?', satirlar: kosullar.satirlar });
              }
            }
          }
        }
      } catch (e) { /* hata olursa önceki ajan kartları kalır */ }
      return y;
    };
  }

  try {
    var ay = document.getElementById('ayarlar');
    if (ay) {
      var pp = document.createElement('p');
      pp.className = 'kart';
      pp.textContent = 'Teknik ajan modülü: yüklendi (3 ajan + nihai karar)';
      ay.appendChild(pp);
    }
  } catch (e3) {}
})();