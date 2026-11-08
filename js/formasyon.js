const Formasyon = {
  govde(k) { return Math.abs(k.c - k.o); },
  aralik(k) { return (k.h - k.l) || 0.001; },

  oncekiYon(c, b) {
    if (b < 5) return 0;
    const d = c[b].c - c[b - 5].c;
    return d > 0.05 ? 1 : d < -0.05 ? -1 : 0;
  },

  regres(pts) {
    const n = pts.length;
    const mx = pts.reduce((s, q) => s + q.x, 0) / n;
    const my = pts.reduce((s, q) => s + q.y, 0) / n;
    let pay = 0, payda = 0;
    pts.forEach(q => { pay += (q.x - mx) * (q.y - my); payda += (q.x - mx) * (q.x - mx); });
    const a = payda ? pay / payda : 0;
    return { a, b: my - a * mx };
  },

  mum(c) {
    const n = c.length, out = [];
    if (n < 6) return out;
    const a = c[n - 1], b = c[n - 2], d = c[n - 3];
    const ga = this.govde(a), gb = this.govde(b), gd = this.govde(d);
    const ra = this.aralik(a);
    const ust = a.h - Math.max(a.o, a.c);
    const alt = Math.min(a.o, a.c) - a.l;
    const onc = this.oncekiYon(c, n - 2);
    const onc2 = this.oncekiYon(c, n - 3);
    const ekle = (ad, yon, ac, k) => out.push({ ad, yon, tur: 'mum', i0: n - k, i1: n - 1, aciklama: ac });

    if (ga < ra * 0.1) ekle('Doji', 0, 'Açılış ve kapanış neredeyse aynı. Alıcı ve satıcı dengede; yön değişimine işaret edebilir ama tek başına yeterli değildir.', 1);
    else if (alt > ga * 2 && ust < ga && onc < 0) ekle('Çekiç', 1, 'Düşüşten sonra uzun alt fitil: satıcılar fiyatı aşağı itti ama alıcılar geri çekti. Olası dönüş işareti.', 1);
    else if (ust > ga * 2 && alt < ga && onc > 0) ekle('Kayan yıldız', -1, 'Yükselişten sonra uzun üst fitil: alıcılar yukarı itti ama satıcılar geri çekti. Olası dönüş işareti.', 1);

    if (a.yes && !b.yes && ga > gb && a.c > b.o && a.o < b.c) ekle('Yutan boğa', 1, 'Yeşil mum önceki kırmızı mumu tamamen yutmuş. Alıcılar kontrolü ele almış olabilir.', 2);
    if (!a.yes && b.yes && ga > gb && a.c < b.o && a.o > b.c) ekle('Yutan ayı', -1, 'Kırmızı mum önceki yeşil mumu tamamen yutmuş. Satıcılar kontrolü ele almış olabilir.', 2);

    if (!d.yes && gd > 0.05 && gb < gd * 0.4 && a.yes && a.c > (d.o + d.c) / 2)
      ekle('Sabah yıldızı', 1, 'Büyük kırmızı mum, küçük kararsız mum, sonra güçlü yeşil mum. Düşüşün bitip yükselişe dönebileceğine işaret eder.', 3);
    if (d.yes && gd > 0.05 && gb < gd * 0.4 && !a.yes && a.c < (d.o + d.c) / 2)
      ekle('Akşam yıldızı', -1, 'Büyük yeşil mum, küçük kararsız mum, sonra güçlü kırmızı mum. Yükselişin bitip düşüşe dönebileceğine işaret eder.', 3);

    if (a.yes && b.yes && d.yes && a.c > b.c && b.c > d.c && ga > 0.03 && gb > 0.03 && gd > 0.03 &&
        b.o >= d.o && b.o <= d.c && a.o >= b.o && a.o <= b.c)
      ekle('Üç beyaz asker', 1, 'Üst üste üç güçlü yeşil mum. Alıcıların istikrarlı şekilde devam ettiğini gösterir.', 3);
    if (!a.yes && !b.yes && !d.yes && a.c < b.c && b.c < d.c && ga > 0.03 && gb > 0.03 && gd > 0.03 &&
        b.o <= d.o && b.o >= d.c && a.o <= b.o && a.o >= b.c)
      ekle('Üç kara karga', -1, 'Üst üste üç güçlü kırmızı mum. Satıcıların istikrarlı şekilde devam ettiğini gösterir.', 3);

    if (gb > 0.05 && ga < gb * 0.5 && Math.max(a.o, a.c) < Math.max(b.o, b.c) && Math.min(a.o, a.c) > Math.min(b.o, b.c) &&
        (b.yes ? onc2 > 0 : onc2 < 0))
      ekle('Harami', b.yes ? -1 : 1, 'Küçük mum, önceki büyük mumun içinde kaldı. Mevcut hareketin yavaşladığını gösterir, dönüş ihtimali artar.', 2);
    return out;
  },

  cift(c, p) {
    const out = [], n = c.length;
    const yakin = n - Math.max(10, Math.round(n * 0.4));
    const z = p.zirve.slice(-2), d = p.dip.slice(-2);
    if (z.length === 2 && z[1] >= yakin && z[1] - z[0] >= 4 && Math.abs(c[z[0]].h - c[z[1]].h) < 0.04) {
      const ara = Math.min(...c.slice(z[0], z[1] + 1).map(k => k.l));
      if (c[z[0]].h - ara > 0.1) out.push({
        ad: 'Çift tepe (olası)', yon: -1, tur: 'formasyon', i0: z[0], i1: n - 1,
        aciklama: 'Fiyat aynı seviyeden iki kez geri döndü. Boyun çizgisinin altına inilirse düşüş yönlü sinyal güçlenir.',
        cizgiler: [{ i0: z[0], v0: ara, i1: n - 1, v1: ara }]
      });
    }
    if (d.length === 2 && d[1] >= yakin && d[1] - d[0] >= 4 && Math.abs(c[d[0]].l - c[d[1]].l) < 0.04) {
      const ara = Math.max(...c.slice(d[0], d[1] + 1).map(k => k.h));
      if (ara - c[d[0]].l > 0.1) out.push({
        ad: 'Çift dip (olası)', yon: 1, tur: 'formasyon', i0: d[0], i1: n - 1,
        aciklama: 'Fiyat aynı seviyeden iki kez yukarı döndü. Boyun çizgisinin üstüne çıkılırsa yükseliş yönlü sinyal güçlenir.',
        cizgiler: [{ i0: d[0], v0: ara, i1: n - 1, v1: ara }]
      });
    }
    return out;
  },

  obo(c, p) {
    const out = [], n = c.length;
    const yakin = n - Math.max(10, Math.round(n * 0.4));
    const z = p.zirve.slice(-3), d = p.dip.slice(-3);
    if (z.length === 3 && z[2] >= yakin && z[1] - z[0] >= 3 && z[2] - z[1] >= 3) {
      const a = c[z[0]].h, b = c[z[1]].h, e = c[z[2]].h;
      if (b > a + 0.03 && b > e + 0.03 && Math.abs(a - e) < 0.07) {
        const l1 = Math.min(...c.slice(z[0], z[1] + 1).map(k => k.l));
        const l2 = Math.min(...c.slice(z[1], z[2] + 1).map(k => k.l));
        if (Math.abs(l1 - l2) < 0.1) {
          const boyun = (l1 + l2) / 2;
          out.push({
            ad: 'Omuz baş omuz (olası)', yon: -1, tur: 'formasyon', i0: z[0], i1: n - 1,
            aciklama: 'Ortadaki tepe iki yandakinden yüksek. Boyun çizgisi aşağı kırılırsa düşüş yönlü dönüş sinyali olur.',
            cizgiler: [{ i0: z[0], v0: boyun, i1: n - 1, v1: boyun }]
          });
        }
      }
    }
    if (d.length === 3 && d[2] >= yakin && d[1] - d[0] >= 3 && d[2] - d[1] >= 3) {
      const a = c[d[0]].l, b = c[d[1]].l, e = c[d[2]].l;
      if (b < a - 0.03 && b < e - 0.03 && Math.abs(a - e) < 0.07) {
        const h1 = Math.max(...c.slice(d[0], d[1] + 1).map(k => k.h));
        const h2 = Math.max(...c.slice(d[1], d[2] + 1).map(k => k.h));
        if (Math.abs(h1 - h2) < 0.1) {
          const boyun = (h1 + h2) / 2;
          out.push({
            ad: 'Ters omuz baş omuz (olası)', yon: 1, tur: 'formasyon', i0: d[0], i1: n - 1,
            aciklama: 'Ortadaki dip iki yandakinden düşük. Boyun çizgisi yukarı kırılırsa yükseliş yönlü dönüş sinyali olur.',
            cizgiler: [{ i0: d[0], v0: boyun, i1: n - 1, v1: boyun }]
          });
        }
      }
    }
    return out;
  },

  ucgen(c, p) {
    const out = [], n = c.length;
    const esik = n - Math.max(8, Math.round(n * 0.3));
    const z = p.zirve.slice(-4).map(i => ({ x: i, y: c[i].h }));
    const d = p.dip.slice(-4).map(i => ({ x: i, y: c[i].l }));
    if (z.length < 2 || d.length < 2) return out;
    if (z[z.length - 1].x < esik || d[d.length - 1].x < esik) return out;
    const i0 = Math.min(z[0].x, d[0].x), i1 = n - 1;
    if (i1 - i0 < 8) return out;
    const rz = this.regres(z), rd = this.regres(d);
    const hi = x => rz.a * x + rz.b, lo = x => rd.a * x + rd.b;
    const sz = rz.a * (i1 - i0), sd = rd.a * (i1 - i0);
    const w0 = hi(i0) - lo(i0), w1 = hi(i1) - lo(i1);
    if (w1 <= 0.02 || w0 <= 0.02) return out;
    const son = c[n - 1].c;
    if (son > hi(i1) + 0.06 || son < lo(i1) - 0.06) return out;
    const T = 0.05;
    const dz = sz > T ? 1 : sz < -T ? -1 : 0;
    const dd = sd > T ? 1 : sd < -T ? -1 : 0;
    const yaki = w1 < w0 * 0.75;
    const paralel = Math.abs(w1 - w0) < 0.06;
    let ad = null, yon = 0, ac = '';
    if (yaki) {
      if (dz === 0 && dd === 1) { ad = 'Yükselen üçgen (olası)'; yon = 1; ac = 'Direnç yatay, dipler yükseliyor. Genelde yukarı kırılımla sonuçlanır.'; }
      else if (dz === -1 && dd === 0) { ad = 'Alçalan üçgen (olası)'; yon = -1; ac = 'Destek yatay, tepeler alçalıyor. Genelde aşağı kırılımla sonuçlanır.'; }
      else if (dz === -1 && dd === 1) { ad = 'Simetrik üçgen (olası)'; yon = 0; ac = 'Tepeler alçalıyor, dipler yükseliyor. Fiyat sıkışıyor; kırılımın yönü belirleyici olur.'; }
      else if (dz === 1 && dd === 1) { ad = 'Yükselen kama (olası)'; yon = -1; ac = 'Fiyat yükseliyor ama aralık daralıyor. Genelde zayıflama ve aşağı kırılım işareti sayılır.'; }
      else if (dz === -1 && dd === -1) { ad = 'Alçalan kama (olası)'; yon = 1; ac = 'Fiyat düşüyor ama aralık daralıyor. Genelde satış gücünün azaldığı ve yukarı kırılım işareti sayılır.'; }
    } else if (paralel) {
      if (dz === 1 && dd === 1) { ad = 'Yükselen kanal (olası)'; yon = 1; ac = 'Fiyat yukarı eğimli paralel bir kanalda ilerliyor. Alt bant altına inilirse kanal bozulur.'; }
      else if (dz === -1 && dd === -1) { ad = 'Alçalan kanal (olası)'; yon = -1; ac = 'Fiyat aşağı eğimli paralel bir kanalda ilerliyor. Üst bant üstüne çıkılırsa kanal bozulur.'; }
      else if (dz === 0 && dd === 0 && w0 > 0.1) { ad = 'Yatay kanal (olası)'; yon = 0; ac = 'Fiyat yatay bir bant içinde gidip geliyor. Bandın hangi yönden kırılacağı beklenmeli.'; }
    }
    if (ad) out.push({
      ad, yon, tur: 'formasyon', i0, i1, aciklama: ac,
      cizgiler: [{ i0, v0: hi(i0), i1, v1: hi(i1) }, { i0, v0: lo(i0), i1, v1: lo(i1) }]
    });
    return out;
  },

  bayrak(c) {
    const n = c.length;
    if (n < 15) return [];
    for (let L = 5; L <= 12; L++) {
      const e = n - 1 - L;
      if (e < 5) break;
      for (let k = 4; k <= 10; k++) {
        const s = e - k;
        if (s < 0) break;
        const kutup = c[e].c - c[s].c;
        if (Math.abs(kutup) < 0.25) continue;
        const f = c.slice(e, n);
        const fh = Math.max(...f.map(x => x.h)), fl = Math.min(...f.map(x => x.l));
        if (fh - fl > Math.abs(kutup) * 0.6) continue;
        const geri = c[n - 1].c - c[e].c;
        if (kutup > 0 && geri < 0 && -geri < kutup * 0.5) return [{
          ad: 'Boğa bayrağı (olası)', yon: 1, tur: 'formasyon', i0: s, i1: n - 1,
          aciklama: 'Sert yükselişten sonra dar ve hafif aşağı eğimli bir toparlanma. Genelde yükselişin devamı olarak okunur.'
        }];
        if (kutup < 0 && geri > 0 && geri < -kutup * 0.5) return [{
          ad: 'Ayı bayrağı (olası)', yon: -1, tur: 'formasyon', i0: s, i1: n - 1,
          aciklama: 'Sert düşüşten sonra dar ve hafif yukarı eğimli bir toparlanma. Genelde düşüşün devamı olarak okunur.'
        }];
      }
    }
    return [];
  },

  hepsi(c, p) {
    return [].concat(this.obo(c, p), this.cift(c, p), this.ucgen(c, p), this.bayrak(c), this.mum(c));
  }
}; 
