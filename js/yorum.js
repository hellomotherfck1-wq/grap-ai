const Yorum = {
  yonYazi(y) { return y > 0 ? 'yükseliş yönlü' : y < 0 ? 'düşüş yönlü' : 'yönü belirsiz'; },

  olustur(s, kal, uyarilar) {
    const f = x => Analiz.fiyat(x, kal);
    const D = s.sv.destekler, R = s.sv.direncler;
    const son = s.c[s.c.length - 1].c;
    const poz = s.oylar.filter(o => o.puan > 0).length;
    const neg = s.oylar.filter(o => o.puan < 0).length;
    const nt = s.oylar.length - poz - neg;
    const t = s.trend;

    let p1 = '';
    if (!t) p1 = 'Trend yönü net okunamadı. ';
    else if (t.yon === 'Yatay') p1 = 'Fiyat belirgin bir yön vermeden yatay seyrediyor. ';
    else {
      const g = t.guc >= 60 ? 'güçlü' : t.guc >= 30 ? 'orta güçte' : 'zayıf';
      p1 = 'Genel eğilim ' + t.yon.toLowerCase() + ' yönünde ve ' + g + ' görünüyor. ';
    }
    p1 += s.alici >= 60 ? 'Son mumlarda alıcılar daha baskın (%' + s.alici + ').'
      : s.alici <= 40 ? 'Son mumlarda satıcılar daha baskın (%' + (100 - s.alici) + ').'
      : 'Son mumlarda alıcı ve satıcı dengede.';

    const sayac = '(' + poz + ' yükseliş, ' + neg + ' düşüş, ' + nt + ' nötr oy)';
    let p2;
    if (s.karar === 'AL') p2 = 'Yöntemlerin çoğu yükseliş yönünde uyuşuyor ' + sayac + '. Bu yüzden değerlendirme AL.';
    else if (s.karar === 'SAT') p2 = 'Yöntemlerin çoğu düşüş yönünde uyuşuyor ' + sayac + '. Bu yüzden değerlendirme SAT.';
    else p2 = 'Yöntemler net bir yönde uyuşmuyor ' + sayac + '. Net sinyal gelene kadar beklemek daha temkinli. ' + (s.not || '');

    let p3 = '';
    if (s.plan) {
      const p = s.plan, a = Math.min(p.g1, p.g2), b = Math.max(p.g1, p.g2);
      const yonAd = p.yon > 0 ? 'alım' : 'satım';
      if (s.karar === 'BEKLE') p3 = 'Net sinyal yok. Yine de ' + yonAd + ' yönü hafif ağır basıyor: ' + f(a) + ' – ' + f(b) + ' bölgesinde ve ancak teyit mumu gelirse düşünülebilir. Teyit gelmeden işleme girmemek daha güvenli.';
      else p3 = 'Plan ' + yonAd + ' yönlü: giriş bölgesi ' + f(a) + ' – ' + f(b) + ', stop ' + f(p.stop) + '.';
      if (p.yon > 0 && son > b + 0.03) p3 += ' Fiyat şu an giriş bölgesinin üstünde; kovalamak yerine geri çekilme beklemek riski azaltır.';
      if (p.yon < 0 && son < a - 0.03) p3 += ' Fiyat şu an giriş bölgesinin altında; kovalamak yerine yukarı doğru bir tepki beklemek riski azaltır.';
    } else p3 = 'Net bir işlem planı çıkmadı.';

    const kartlar = [];

    const sd = [];
    D.slice(0, 2).forEach((d, i) => sd.push('Destek ' + (i + 1) + ': ' + f(d.seviye) + '. ' +
      (d.guc > 1 ? 'Fiyat burada ' + d.guc + ' kez tepki vermiş, daha güvenilir bir seviye.' : 'Fiyat burada bir kez tepki vermiş, zayıf bir seviye olabilir.')));
    R.slice(0, 2).forEach((d, i) => sd.push('Direnç ' + (i + 1) + ': ' + f(d.seviye) + '. ' +
      (d.guc > 1 ? 'Fiyat burada ' + d.guc + ' kez geri dönmüş, daha güvenilir bir seviye.' : 'Fiyat burada bir kez geri dönmüş, zayıf bir seviye olabilir.')));
    if (!D.length) sd.push('Fiyatın altında net bir destek bulunamadı.');
    if (!R.length) sd.push('Fiyatın üstünde net bir direnç bulunamadı.');
    if (D.length && son - D[0].seviye < 0.08) sd.push('Fiyat desteğe yakın: tutunursa tepki yükselişi gelebilir, kırarsa düşüş hızlanabilir.');
    if (R.length && R[0].seviye - son < 0.08) sd.push('Fiyat dirence yakın: aşarsa yükseliş güçlenebilir, geri dönerse düşüş başlayabilir.');
    kartlar.push({ baslik: 'Destek ve direnç', satirlar: sd });

    const fs = [];
    if (s.form.length) s.form.forEach(x => fs.push('• ' + x.ad + ' (' + this.yonYazi(x.yon) + '): ' + x.aciklama));
    else fs.push('Belirgin bir formasyon tespit edilmedi. Bu, formasyon olmadığı anlamına gelmez; otomatik tarama bulamadı.');
    fs.push('Not: Elliott, Wyckoff, harmonik ve ICT/SMC gibi öznel yöntemler otomatik olarak kesin tespit edilmez.');
    kartlar.push({ baslik: 'Formasyonlar', satirlar: fs });

    const ac = {
      'Trend': ['Genel yön aşağı.', 'Genel yön yatay ya da belirsiz.', 'Genel yön yukarı.'],
      'Ortalamalar (10/20)': ['Kısa ortalama uzun ortalamanın altında; ivme zayıf.', 'Ortalamalar birbirine yakın; belirgin üstünlük yok.', 'Kısa ortalama uzun ortalamanın üstünde; ivme güçlü.'],
      'Fiyat yapısı': ['Tepeler ve dipler düşüyor; satıcılar kontrolde.', 'Net bir tepe/dip yapısı yok.', 'Tepeler ve dipler yükseliyor; alıcılar kontrolde.'],
      'RSI (yaklaşık)': ['RSI düşük; satış baskısı var.', 'RSI nötr bölgede.', 'RSI yüksek; alış gücü var.'],
      'Alıcı/satıcı baskısı': ['Son mumlarda satıcılar baskın.', 'Alıcı ve satıcı dengede.', 'Son mumlarda alıcılar baskın.'],
      'Formasyonlar': ['Düşüş yönlü formasyon var.', 'Belirgin formasyon yok ya da sinyaller dengeli.', 'Yükseliş yönlü formasyon var.']
    };
    const ys = s.oylar.map(o => {
      let a = (ac[o.ad] || ['', '', ''])[o.puan + 1];
      if (o.ad === 'RSI (yaklaşık)' && s.rsi !== null) {
        if (s.rsi > 70) a = 'Aşırı alım bölgesi: yükseliş yorulmuş olabilir, geri çekilme riski artar.';
        else if (s.rsi < 30) a = 'Aşırı satım bölgesi: düşüş yorulmuş olabilir, tepki yükselişi gelebilir.';
      }
      return (o.puan > 0 ? '🟢 ' : o.puan < 0 ? '🔴 ' : '⚪ ') + o.ad + ' – ' + o.yazi + '. ' + a;
    });
    kartlar.push({ baslik: 'Yöntemler tek tek', satirlar: ys });

    const sen = [];
    sen.push('Yükseliş senaryosu: ' + (R[0]
      ? 'Fiyat ' + f(R[0].seviye) + ' direncinin üzerinde mum kapanışı yaparsa yükseliş güçlenir' + (R[1] ? ' ve ' + f(R[1].seviye) + ' bölgesi hedef olabilir.' : '; yeni zirveler denenebilir.')
      : 'Yakında net direnç yok; yeni zirve denemesi olabilir.'));
    sen.push('Düşüş senaryosu: ' + (D[0]
      ? 'Fiyat ' + f(D[0].seviye) + ' desteğinin altında mum kapanışı yaparsa düşüş güçlenir' + (D[1] ? ' ve ' + f(D[1].seviye) + ' bölgesi gündeme gelebilir.' : '; yeni dipler denenebilir.')
      : 'Yakında net destek yok; yeni dip denemesi olabilir.'));
    kartlar.push({ baslik: 'Senaryolar', satirlar: sen });

    if (s.plan) {
      const p = s.plan, a = Math.min(p.g1, p.g2), b = Math.max(p.g1, p.g2);
      const pl = [
        (p.yon > 0 ? 'Alım yönlü' : 'Satım yönlü') + ' plan' + (s.karar === 'BEKLE' ? ' (koşullu, henüz onaylı değil)' : '') + '.',
        'Olası giriş bölgesi: ' + f(a) + ' – ' + f(b),
        'Stop-loss: ' + f(p.stop) + ' (fiyat buraya gelirse fikir geçersiz sayılır)',
        'Hedef 1: ' + f(p.t1) + '   Hedef 2: ' + f(p.t2),
        'Risk/kazanç: 1 / ' + p.rr.toFixed(1) + '. Bir birim riske karşılık yaklaşık ' + p.rr.toFixed(1) + ' birim potansiyel kazanç.' + (p.rr < 1.5 ? ' Oran düşük, plan çok cazip değil.' : '')
      ];
      kartlar.push({ baslik: 'İşlem planı', satirlar: pl });
    }

    const dk = [];
    (uyarilar || []).forEach(u => dk.push('⚠️ ' + u));
    if (!kal) dk.push('Fiyatlar, grafikteki aralığın yüzdesi olarak gösteriliyor (%0 en alt, %100 en üst). Gerçek fiyat için "Analiz" ekranındaki iki kutuya en yüksek ve en düşük fiyatı yaz.');
    dk.push('Teknik uyum puanı yöntemlerin ne kadar uyuştuğunu gösterir, kazanma olasılığı değildir.');
    dk.push('Bu otomatik ve yaklaşık bir hesaptır, yatırım tavsiyesi değildir.');
    kartlar.push({ baslik: 'Dikkat', satirlar: dk });

    return {
      karar: s.karar, uyum: s.uyum,
      renk: s.karar === 'AL' ? '#26a69a' : s.karar === 'SAT' ? '#ef5350' : '#f0b429',
      ozet: [p1, p2, p3], kartlar
    };
  }
}; 
