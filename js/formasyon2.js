const Formasyon2 = {
  yakin(n) { return n - Math.max(10, Math.round(n * 0.4)); },

  ortala(c, a, b) {
    const s = c.slice(Math.max(0, Math.round(a)), Math.round(b) + 1).map(k => k.l);
    return s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0;
  },

  ucluTepeDip(c, p) {
    const out = [], n = c.length;
    if (n < 20) return out;
    const y = this.yakin(n);
    const z = p.zirve.slice(-3), d = p.dip.slice(-3);
    if (z.length === 3 && z[2] >= y && z[1] - z[0] >= 3 && z[2] - z[1] >= 3) {
      const h = z.map(i => c[i].h);
      const mx = Math.max(...h), mn = Math.min(...h);
      if (mx - mn < 0.05) {
        const l1 = Math.min(...c.slice(z[0], z[1] + 1).map(k => k.l));
        const l2 = Math.min(...c.slice(z[1], z[2] + 1).map(k => k.l));
        const boyun = Math.min(l1, l2);
        const ort = (h[0] + h[1] + h[2]) / 3;
        if (ort - boyun > 0.1 && Math.abs(l1 - l2) < 0.12) out.push({
          ad: 'Üçlü tepe (olası)', yon: -1, tur: 'formasyon', i0: z[0], i1: n - 1,
          aciklama: 'Fiyat aynı direnç bölgesine üç kez çıkıp geri döndü. Alıcılar bu seviyeyi aşamıyor. Boyun çizgisinin altında kapanış gelirse düşüş yönlü dönüş sinyali güçlenir.',
          cizgiler: [{ i0: z[0], v0: boyun, i1: n - 1, v1: boyun }, { i0: z[0], v0: ort, i1: z[2], v1: ort }],
          seviyeler: [{ ad: 'Teyit (boyun çizgisi)', v: boyun }, { ad: 'Formasyon hedefi', v: boyun - (ort - boyun) }, { ad: 'İptal seviyesi', v: mx + 0.02 }]
        });
      }
    }
    if (d.length === 3 && d[2] >= y && d[1] - d[0] >= 3 && d[2] - d[1] >= 3) {
      const l = d.map(i => c[i].l);
      const mx = Math.max(...l), mn = Math.min(...l);
      if (mx - mn < 0.05) {
        const h1 = Math.max(...c.slice(d[0], d[1] + 1).map(k => k.h));
        const h2 = Math.max(...c.slice(d[1], d[2] + 1).map(k => k.h));
        const boyun = Math.max(h1, h2);
        const ort = (l[0] + l[1] + l[2]) / 3;
        if (boyun - ort > 0.1 && Math.abs(h1 - h2) < 0.12) out.push({
          ad: 'Üçlü dip (olası)', yon: 1, tur: 'formasyon', i0: d[0], i1: n - 1,
          aciklama: 'Fiyat aynı destek bölgesine üç kez inip yukarı döndü. Satıcılar bu seviyeyi kıramıyor. Boyun çizgisinin üstünde kapanış gelirse yükseliş yönlü dönüş sinyali güçlenir.',
          cizgiler: [{ i0: d[0], v0: boyun, i1: n - 1, v1: boyun }, { i0: d[0], v0: ort, i1: d[2], v1: ort }],
          seviyeler: [{ ad: 'Teyit (boyun çizgisi)', v: boyun }, { ad: 'Formasyon hedefi', v: boyun + (boyun - ort) }, { ad: 'İptal seviyesi', v: mn - 0.02 }]
        });
      }
    }
    return out;
  },

  fincan(c, p) {
    const n = c.length;
    if (n < 25) return [];
    const zz = p.zirve.slice(-5);
    const y = this.yakin(n);
    for (let b = zz.length - 1; b >= 1; b--) {
      for (let a = b - 1; a >= 0; a--) {
        const A = zz[a], B = zz[b], span = B - A;
        if (span < 10 || B < y || B > n - 3) continue;
        if (Math.abs(c[A].h - c[B].h) > 0.06) continue;
        const rim = (c[A].h + c[B].h) / 2;
        let bottom = Infinity, bi = A;
        for (let i = A; i <= B; i++) if (c[i].l < bottom) { bottom = c[i].l; bi = i; }
        const depth = rim - bottom;
        if (depth < 0.12) continue;
        const pos = (bi - A) / span;
        if (pos < 0.25 || pos > 0.75) continue;
        const q = (this.ortala(c, A + span * 0.2, A + span * 0.3) + this.ortala(c, A + span * 0.7, A + span * 0.8)) / 2;
        if (q > bottom + depth * 0.4) continue;
        const hlLen = n - 1 - B;
        if (hlLen < 2 || hlLen > span * 0.6) continue;
        const hl = Math.min(...c.slice(B + 1).map(k => k.l));
        if (rim - hl < 0.01 || rim - hl > depth * 0.5) continue;
        const kirdi = c[n - 1].c > rim + 0.01;
        return [{
          ad: 'Fincan ve kulp (olası)', yon: 1, tur: 'formasyon', i0: A, i1: n - 1,
          aciklama: 'Yuvarlak bir dipten toparlanma ve sağ kenarda küçük bir geri çekilme (kulp) var. ' +
            (kirdi ? 'Fiyat fincan kenarının üstüne çıkmış, kırılım gerçekleşmiş olabilir. Üstünde kalması önemli.'
              : 'Fincan kenarının üstünde kapanış gelirse yükseliş devamı için teyit olur.'),
          cizgiler: [{ i0: A, v0: rim, i1: n - 1, v1: rim }],
          seviyeler: [{ ad: 'Teyit (fincan kenarı)', v: rim }, { ad: 'Formasyon hedefi', v: rim + depth }, { ad: 'İptal seviyesi', v: hl - 0.02 }]
        }];
      }
    }
    return [];
  },

  megafon(c, p) {
    const n = c.length;
    if (n < 20) return [];
    const z = p.zirve.slice(-4).map(i => ({ x: i, y: c[i].h }));
    const d = p.dip.slice(-4).map(i => ({ x: i, y: c[i].l }));
    if (z.length < 3 || d.length < 3) return [];
    const esik = n - Math.max(8, Math.round(n * 0.3));
    if (z[z.length - 1].x < esik || d[d.length - 1].x < esik) return [];
    const i0 = Math.min(z[0].x, d[0].x), i1 = n - 1;
    if (i1 - i0 < 10) return [];
    const rz = Formasyon.regres(z), rd = Formasyon.regres(d);
    const hi = x => rz.a * x + rz.b, lo = x => rd.a * x + rd.b;
    if (rz.a * (i1 - i0) < 0.05 || rd.a * (i1 - i0) > -0.05) return [];
    const w0 = hi(i0) - lo(i0), w1 = hi(i1) - lo(i1);
    if (w1 <= w0 * 1.3 || w1 - w0 < 0.08) return [];
    const son = c[n - 1].c;
    if (son > hi(i1) + 0.06 || son < lo(i1) - 0.06) return [];
    return [{
      ad: 'Genişleyen formasyon (olası)', yon: 0, tur: 'formasyon', i0, i1,
      aciklama: 'Tepeler yükselirken dipler de düşüyor, fiyat aralığı genişliyor. Piyasa kararsız ve oynak. Bu yapıda sinyaller güvenilmez, stoplar sık tetiklenebilir. Üst ya da alt bandın dışında net kapanış gelene kadar beklemek daha temkinli.',
      cizgiler: [{ i0, v0: hi(i0), i1, v1: hi(i1) }, { i0, v0: lo(i0), i1, v1: lo(i1) }],
      seviyeler: [{ ad: 'Üst bant (şu an)', v: hi(i1) }, { ad: 'Alt bant (şu an)', v: lo(i1) }]
    }];
  },

  kirilim(c) {
    const out = [], n = c.length;
    if (n < 15) return out;
    const bas = Math.max(0, n - 30), son = n - 4;
    if (son - bas < 8) return out;
    const w = c.slice(bas, son + 1);
    const hi = Math.max(...w.map(k => k.h)), lo = Math.min(...w.map(k => k.l));
    if (hi - lo < 0.1) return out;
    const yuk = w.filter(k => k.h >= hi - 0.03).length;
    const dus = w.filter(k => k.l <= lo + 0.03).length;
    const last = c[n - 1];
    if (last.c > hi + 0.005 && yuk >= 2) {
      out.push({
        ad: 'Direnç kırılımı (olası)', yon: 1, tur: 'formasyon', i0: bas, i1: n - 1,
        aciklama: 'Fiyat, son mumlarda birkaç kez test edilen direncin üstünde kapandı. Kırılım kalıcı olursa yükseliş güçlenir. Fiyat direncin altına geri dönerse sahte kırılım olabilir. Genelde direnç, geri testte destek olarak denenir.',
        cizgiler: [{ i0: bas, v0: hi, i1: n - 1, v1: hi }],
        seviyeler: [{ ad: 'Kırılan direnç', v: hi }, { ad: 'Ölçülü hedef', v: hi + Math.min(hi - lo, 0.5) }, { ad: 'İptal (geri dönüş)', v: hi - 0.03 }]
      });
    } else if (last.c < lo - 0.005 && dus >= 2) {
      out.push({
        ad: 'Destek kırılımı (olası)', yon: -1, tur: 'formasyon', i0: bas, i1: n - 1,
        aciklama: 'Fiyat, son mumlarda birkaç kez test edilen desteğin altında kapandı. Kırılım kalıcı olursa düşüş güçlenir. Fiyat desteğin üstüne geri dönerse sahte kırılım olabilir. Genelde destek, geri testte direnç olarak denenir.',
        cizgiler: [{ i0: bas, v0: lo, i1: n - 1, v1: lo }],
        seviyeler: [{ ad: 'Kırılan destek', v: lo }, { ad: 'Ölçülü hedef', v: lo - Math.min(hi - lo, 0.5) }, { ad: 'İptal (geri dönüş)', v: lo + 0.03 }]
      });
    }
    return out;
  },

  hepsi(c, p) {
    return [].concat(this.ucluTepeDip(c, p), this.fincan(c, p), this.megafon(c, p), this.kirilim(c));
  }
};

(function () {
  const eski = Formasyon.hepsi;
  Formasyon.hepsi = function (c, p) {
    const a = eski.call(this, c, p);
    let b = [];
    try { b = Formasyon2.hepsi(c, p); } catch (e) {}
    return a.concat(b);
  };

  if (window.Yorum) {
    const eskiY = Yorum.olustur;
    Yorum.olustur = function (s, kal, uy) {
      const y = eskiY.call(this, s, kal, uy);
      try {
        const k = y.kartlar.find(x => x.baslik === 'Formasyonlar');
        if (k) {
          const ek = [];
          s.form.forEach(f => {
            if (f.seviyeler && f.seviyeler.length) {
              ek.push('📍 ' + f.ad + ' seviyeleri: ' + f.seviyeler.map(q => q.ad + ' ' + Analiz.fiyat(q.v, kal)).join(' | '));
            }
          });
          if (ek.length) {
            const i = k.satirlar.findIndex(t => t.startsWith('Not:'));
            if (i >= 0) k.satirlar.splice(i, 0, ...ek);
            else k.satirlar.push(...ek);
          }
        }
      } catch (e) {}
      return y;
    };
  }
})();
