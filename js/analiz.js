const Analiz = {
  hazirla(m) {
    const yT = Math.min(...m.map(k => k.ust));
    const yB = Math.max(...m.map(k => k.alt));
    const R = (yB - yT) || 1;
    const v = y => (yB - y) / R;
    const c = m.map(k => {
      const yes = k.renk === 1;
      return { yes, h: v(k.ust), l: v(k.alt), o: v(yes ? k.ga : k.gu), c: v(yes ? k.gu : k.ga) };
    });
    return { c, yB, R };
  },

  ort(a, n) {
    const s = a.slice(-n);
    return s.reduce((x, y) => x + y, 0) / s.length;
  },

  rsi(kap, n) {
    if (!Array.isArray(kap) || kap.length < n + 1) return null;
    let g = 0, z = 0;
    for (let i = 1; i <= n; i++) {
      const d = kap[i] - kap[i - 1];
      if (d > 0) g += d;
      else z -= d;
    }
    g /= n;
    z /= n;
    for (let i = n + 1; i < kap.length; i++) {
      const d = kap[i] - kap[i - 1];
      g = (g * (n - 1) + (d > 0 ? d : 0)) / n;
      z = (z * (n - 1) + (d < 0 ? -d : 0)) / n;
    }
    if (g + z === 0) return 50;
    if (z === 0) return 100;
    if (g === 0) return 0;
    return Math.round(100 * g / (g + z));
  },

  pivotlar(c) {
    const zirve = [], dip = [];
    for (let i = 2; i < c.length - 2; i++) {
      const hs = [c[i - 2].h, c[i - 1].h, c[i + 1].h, c[i + 2].h];
      const ls = [c[i - 2].l, c[i - 1].l, c[i + 1].l, c[i + 2].l];
      if (c[i].h >= Math.max(...hs)) zirve.push(i);
      if (c[i].l <= Math.min(...ls)) dip.push(i);
    }
    return { zirve, dip };
  },

  kumele(degerler) {
    const s = degerler.slice().sort((a, b) => a - b);
    const gruplar = [];
    for (const d of s) {
      const g = gruplar[gruplar.length - 1];
      if (g && d - g.son <= 0.03) { g.say++; g.toplam += d; g.son = d; }
      else gruplar.push({ say: 1, toplam: d, son: d });
    }
    return gruplar.map(g => ({ seviye: g.toplam / g.say, guc: g.say }));
  },

  seviyeler(c, p) {
    const son = c[c.length - 1].c;
    const direncler = this.kumele(p.zirve.map(i => c[i].h))
      .filter(x => x.seviye > son + 0.02).sort((a, b) => a.seviye - b.seviye);
    const destekler = this.kumele(p.dip.map(i => c[i].l))
      .filter(x => x.seviye < son - 0.02).sort((a, b) => b.seviye - a.seviye);
    const enUst = Math.max(...c.map(k => k.h));
    const enAlt = Math.min(...c.map(k => k.l));
    if (!direncler.length && enUst > son + 0.02) direncler.push({ seviye: enUst, guc: 1 });
    if (!destekler.length && enAlt < son - 0.02) destekler.push({ seviye: enAlt, guc: 1 });
    return { destekler, direncler };
  },

  mumFormasyon(c) {
    const a = c[c.length - 1], b = c[c.length - 2];
    const r = (a.h - a.l) || 0.001;
    const g = Math.abs(a.c - a.o);
    const ustG = a.h - Math.max(a.o, a.c);
    const altG = Math.min(a.o, a.c) - a.l;
    const out = [];
    if (g < r * 0.1) out.push({ ad: 'Doji (kararsızlık)', yon: 0 });
    else if (altG > g * 2 && ustG < g) out.push({ ad: 'Çekiç benzeri mum', yon: 1 });
    else if (ustG > g * 2 && altG < g) out.push({ ad: 'Kayan yıldız benzeri mum', yon: -1 });
    const bg = Math.abs(b.c - b.o);
    if (a.yes && !b.yes && g > bg && a.c > b.o && a.o < b.c) out.push({ ad: 'Yutan boğa mumu', yon: 1 });
    if (!a.yes && b.yes && g > bg && a.c < b.o && a.o > b.c) out.push({ ad: 'Yutan ayı mumu', yon: -1 });
    return out;
  },

  ikiliFormasyon(c, p) {
    const out = [];
    const z = p.zirve.slice(-2), d = p.dip.slice(-2);
    if (z.length === 2 && z[1] - z[0] >= 4 && Math.abs(c[z[0]].h - c[z[1]].h) < 0.04) {
      const ara = Math.min(...c.slice(z[0], z[1] + 1).map(k => k.l));
      if (c[z[0]].h - ara > 0.1) out.push({ ad: 'Olası çift tepe', yon: -1 });
    }
    if (d.length === 2 && d[1] - d[0] >= 4 && Math.abs(c[d[0]].l - c[d[1]].l) < 0.04) {
      const ara = Math.max(...c.slice(d[0], d[1] + 1).map(k => k.h));
      if (ara - c[d[0]].l > 0.1) out.push({ ad: 'Olası çift dip', yon: 1 });
    }
    return out;
  },

  yapi(c, p) {
    const z = p.zirve.slice(-2), d = p.dip.slice(-2);
    if (z.length < 2 || d.length < 2) return 0;
    const zy = c[z[1]].h - c[z[0]].h;
    const dy = c[d[1]].l - c[d[0]].l;
    if (zy > 0.02 && dy > 0.02) return 1;
    if (zy < -0.02 && dy < -0.02) return -1;
    return 0;
  },

  yap(m, trend, options) {
    const { c, yB, R } = this.hazirla(m);
    // Canlı grafikte henüz kapanmamış son mum sinyalleri bozmasın.
    // Grafik çizimi için tüm mumlar korunur; göstergeler yalnızca kapanan mumları kullanır.
    const analysisC = options && options.excludeLast && c.length > 1 ? c.slice(0, -1) : c;
    const n = analysisC.length;
    const kap = analysisC.map(k => k.c);
    const son = kap[n - 1];
    const p = this.pivotlar(analysisC);
    const sv = this.seviyeler(analysisC, p);
    const rsi = this.rsi(kap, 14);

    let ga = 0, gk = 0;
    analysisC.slice(-10).forEach(k => {
      const g = Math.abs(k.c - k.o) + 0.001;
      if (k.yes) ga += g; else gk += g;
    });
    const alici = Math.round(100 * ga / (ga + gk));

    const oylar = [];
    const oy = (ad, puan, yazi) => oylar.push({ ad, puan, yazi });
    if (trend) oy('Trend', trend.yon === 'Yükseliş' ? 1 : trend.yon === 'Düşüş' ? -1 : 0, trend.yon);
    else oy('Trend', 0, 'belirsiz');
    if (n >= 20) {
      const d = this.ort(kap, 10) - this.ort(kap, 20);
      oy('Ortalamalar (10/20)', d > 0.01 ? 1 : d < -0.01 ? -1 : 0,
        d > 0.01 ? 'kısa ortalama üstte' : d < -0.01 ? 'kısa ortalama altta' : 'yatay');
    } else oy('Ortalamalar (10/20)', 0, 'yeterli mum yok');
    const ys = this.yapi(analysisC, p);
    oy('Fiyat yapısı', ys, ys > 0 ? 'yükselen tepe ve dipler' : ys < 0 ? 'alçalan tepe ve dipler' : 'net yapı yok');
    let rp = 0, ry = 'belirsiz';
    if (rsi !== null) {
      if (rsi > 70) ry = rsi + ' (aşırı alım bölgesi)';
      else if (rsi >= 55) { rp = 1; ry = rsi + ' (güçlü)'; }
      else if (rsi < 30) ry = rsi + ' (aşırı satım bölgesi)';
      else if (rsi <= 45) { rp = -1; ry = rsi + ' (zayıf)'; }
      else ry = rsi + ' (nötr)';
    }
    oy('RSI (yaklaşık)', rp, ry);
    oy('Alıcı/satıcı baskısı', alici >= 60 ? 1 : alici <= 40 ? -1 : 0, '%' + alici + ' alıcı');
    const form = Formasyon.hepsi(analysisC, p);
    const fs = form.reduce((a, x) => a + x.yon, 0);
    oy('Formasyonlar', Math.sign(fs), form.length ? form.map(x => x.ad).join(', ') : 'belirgin yok');

    const score = oylar.reduce((a, o) => a + o.puan, 0);
    let karar = 'BEKLE', not = '';
    if (n < 15) not = 'Mum sayısı az. Güvenilir değerlendirme için en az 15 mum gerekir.';
    else if (score >= 3) {
      if (rsi !== null && rsi > 70) not = 'Yöntemler yükselişi gösteriyor ama RSI aşırı alımda, beklemek daha temkinli.';
      else karar = 'AL';
    } else if (score <= -3) {
      if (rsi !== null && rsi < 30) not = 'Yöntemler düşüşü gösteriyor ama RSI aşırı satımda, beklemek daha temkinli.';
      else karar = 'SAT';
    } else not = 'Yöntemler net bir yönde uyuşmuyor.';

    let plan = null;
    if (n >= 15 && score !== 0) {
      const D = sv.destekler, Rr = sv.direncler;
      if (score > 0) {
        const dest = D.length ? D[0].seviye : son - 0.15;
        const g1 = son - (son - dest) * 0.25, g2 = son, stop = dest - 0.02;
        const mid = (g1 + g2) / 2, risk = mid - stop;
        if (risk > 0.01) {
          const t1 = Rr.length ? Rr[0].seviye : mid + risk * 1.5;
          let t2 = Rr.length > 1 ? Rr[1].seviye : mid + risk * 2.5;
          if (t2 <= t1) t2 = t1 + risk;
          plan = { yon: 1, g1, g2, stop, t1, t2, rr: (t1 - mid) / risk };
        }
      } else {
        const dir = Rr.length ? Rr[0].seviye : son + 0.15;
        const g1 = son, g2 = son + (dir - son) * 0.25, stop = dir + 0.02;
        const mid = (g1 + g2) / 2, risk = stop - mid;
        if (risk > 0.01) {
          const t1 = D.length ? D[0].seviye : mid - risk * 1.5;
          let t2 = D.length > 1 ? D[1].seviye : mid - risk * 2.5;
          if (t2 >= t1) t2 = t1 - risk;
          plan = { yon: -1, g1, g2, stop, t1, t2, rr: (mid - t1) / risk };
        }
      }
    }
    return { c, analysisC, p, yB, R, sv, trend, rsi, alici, oylar, form, score, karar, not, plan,
             uyum: Math.round(Math.abs(score) / 6 * 100) };
  },

  fiyat(x, kal) {
    if (kal) {
      const p = kal.lo + x * (kal.hi - kal.lo);
      const a = Math.abs(p);
      return p.toFixed(a >= 100 ? 2 : a >= 1 ? 4 : 6);
    }
    return '%' + Math.round(x * 100);
  },

  ciz(ctx, w, s) {
    const y = v => s.yB - v * s.R;
    const cizgi = (v, renk, etiket) => {
      ctx.strokeStyle = renk; ctx.fillStyle = renk;
      ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, y(v)); ctx.lineTo(w, y(v)); ctx.stroke();
      ctx.setLineDash([]); ctx.font = '14px sans-serif';
      ctx.fillText(etiket, 4, y(v) - 3);
    };
    s.sv.destekler.slice(0, 2).forEach((d, i) => cizgi(d.seviye, '#4da3ff', 'Destek ' + (i + 1)));
    s.sv.direncler.slice(0, 2).forEach((d, i) => cizgi(d.seviye, '#ff5c5c', 'Direnç ' + (i + 1)));
    if (s.plan) {
      cizgi(s.plan.stop, '#ff9800', 'Stop');
      cizgi(s.plan.t1, '#ffffff', 'Hedef 1');
      cizgi(s.plan.t2, '#ffffff', 'Hedef 2');
    }
  },

  rapor(s, n, kal) {
    const f = x => this.fiyat(x, kal);
    const D = s.sv.destekler, Rr = s.sv.direncler;
    const L = [];
    if (s.meta && s.meta.sembol) {
      L.push('Varlık: ' + (s.meta.ad || s.meta.sembol) + ' (' + s.meta.sembol + ') · ' +
        (s.meta.zd || 'zaman dilimi bilinmiyor') + ' · ' + (s.meta.kaynak || 'kaynak bilinmiyor'));
      if (s.meta.sonMumZamani) {
        L.push('Son mum zamanı: ' + new Date(s.meta.sonMumZamani).toLocaleString('tr-TR') +
          (s.meta.sonMumAcik ? ' · henüz kapanmadı, göstergelerden çıkarıldı.' : ' · kapanmış mum.'));
      }
    } else {
      L.push('Varlık: ekran görüntüsü · sembol ve zaman dilimi doğrulanamadı.');
    }
    L.push('Mum sayısı: ' + n);
    L.push('Trend: ' + (s.trend ? s.trend.yon + ' (güç %' + s.trend.guc + ')' : 'belirsiz'));
    L.push('Analizde kullanılan kapanmış mum sayısı: ' + (Array.isArray(s.analysisC) ? s.analysisC.length : n));
    L.push('');
    L.push('Destek: ' + (D.slice(0, 2).map(d => f(d.seviye) + ' (güç ' + d.guc + ')').join(', ') || 'bulunamadı'));
    L.push('Direnç: ' + (Rr.slice(0, 2).map(d => f(d.seviye) + ' (güç ' + d.guc + ')').join(', ') || 'bulunamadı'));
    L.push('Alıcı baskısı: %' + s.alici + ', satıcı baskısı: %' + (100 - s.alici));
    L.push('');
    L.push('Yöntem oyları:');
    s.oylar.forEach(o => L.push((o.puan > 0 ? '🟢 ' : o.puan < 0 ? '🔴 ' : '⚪ ') + o.ad + ': ' + o.yazi));
    L.push('');
    L.push('Yükseliş senaryosu: ' + (Rr[0]
      ? f(Rr[0].seviye) + ' direncinin üstünde kalıcı kapanış olursa ' + (Rr[1] ? f(Rr[1].seviye) : 'yeni zirve') + ' bölgesi gündeme gelebilir.'
      : 'Yakında net direnç yok, yeni zirve denemesi olabilir.'));
    L.push('Düşüş senaryosu: ' + (D[0]
      ? f(D[0].seviye) + ' desteğinin altında kalıcı kapanış olursa ' + (D[1] ? f(D[1].seviye) : 'daha aşağı') + ' bölgesi gündeme gelebilir.'
      : 'Yakında net destek yok, yeni dip denemesi olabilir.'));
    L.push('');
    if (s.plan) {
      const p = s.plan;
      L.push((p.yon > 0 ? 'Alım yönlü' : 'Satım yönlü') + ' plan' + (s.karar === 'BEKLE' ? ' (koşullu, henüz onaylı değil)' : '') + ':');
      L.push('Olası giriş bölgesi: ' + f(Math.min(p.g1, p.g2)) + ' – ' + f(Math.max(p.g1, p.g2)));
      L.push('Stop-loss: ' + f(p.stop));
      L.push('Hedef 1: ' + f(p.t1) + ', Hedef 2: ' + f(p.t2));
      L.push('Risk/kazanç (Hedef 1): 1 / ' + p.rr.toFixed(1));
    } else L.push('Net bir işlem planı çıkmadı.');
    L.push('');
    L.push('DEĞERLENDİRME: ' + s.karar);
    if (s.not) L.push(s.not);
    L.push('Teknik uyum puanı: %' + s.uyum + ' (kazanma olasılığı değildir)');
    if (!kal) L.push('Seviyeler grafikteki fiyat aralığının yüzdesidir (%0 en alt, %100 en üst).');
    L.push('Yaklaşık, otomatik bir hesaptır. Yatırım tavsiyesi değildir.');
    return L;
  }
}
