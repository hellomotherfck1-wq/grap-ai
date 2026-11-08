const Goruntu = {
  async yukle(dosya) {
    const bmp = await createImageBitmap(dosya);
    const olcek = Math.min(1, 1200 / bmp.width);
    const w = Math.round(bmp.width * olcek);
    const h = Math.round(bmp.height * olcek);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    return { canvas, ctx, w, h, veri: ctx.getImageData(0, 0, w, h), orijinalW: bmp.width, orijinalH: bmp.height };
  },

  kalite(r) {
    const uyarilar = [];
    const { data } = r.veri, n = r.w * r.h;
    const gri = new Float32Array(n);
    let toplam = 0;
    for (let i = 0; i < n; i++) {
      const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      gri[i] = g; toplam += g;
    }
    const parlaklik = toplam / n;
    let lap = 0, say = 0, ort = 0;
    const vals = [];
    for (let y = 1; y < r.h - 1; y += 2) {
      for (let x = 1; x < r.w - 1; x += 2) {
        const i = y * r.w + x;
        const v = 4 * gri[i] - gri[i - 1] - gri[i + 1] - gri[i - r.w] - gri[i + r.w];
        vals.push(v); ort += v; say++;
      }
    }
    ort /= say;
    for (const v of vals) lap += (v - ort) * (v - ort);
    lap /= say;
    if (r.orijinalW < 500 || r.orijinalH < 300) uyarilar.push('Görüntü çözünürlüğü düşük.');
    if (parlaklik > 215) uyarilar.push('Görüntü çok açık renkli, sonuç zayıf olabilir.');
    if (lap < 20) uyarilar.push('Görüntü bulanık olabilir.');
    return uyarilar;
  },

  mumlar(r) {
    const { data } = r.veri, w = r.w, h = r.h;
    const sinif = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const R = data[i * 4], G = data[i * 4 + 1], B = data[i * 4 + 2];
      if (G > R + 40 && G >= B - 20 && G > 80) sinif[i] = 1;
      else if (R > G + 60 && R > B + 50 && R > 120) sinif[i] = 2;
    }
    const kolon = new Uint8Array(w);
    for (let x = 0; x < w; x++) {
      let g = 0, k = 0;
      for (let y = 0; y < h; y++) {
        const s = sinif[y * w + x];
        if (s === 1) g++; else if (s === 2) k++;
      }
      kolon[x] = (g >= 3 && g >= k) ? 1 : (k >= 3 ? 2 : 0);
    }
    let liste = [];
    let x = 0;
    while (x < w) {
      if (!kolon[x]) { x++; continue; }
      const renk = kolon[x];
      let x1 = x;
      while (x1 + 1 < w && kolon[x1 + 1] === renk) x1++;
      const gen = x1 - x + 1;
      const satir = new Uint16Array(h);
      let ust = -1, alt = -1;
      for (let y = 0; y < h; y++) {
        let c = 0;
        for (let xx = x; xx <= x1; xx++) if (sinif[y * w + xx] === renk) c++;
        satir[y] = c;
        if (c > 0) { if (ust < 0) ust = y; alt = y; }
      }
      if (ust >= 0 && alt - ust >= 2) {
        const esik = gen < 3 ? 1 : Math.max(2, Math.ceil(gen * 0.6));
        let gu = -1, ga = -1;
        for (let y = ust; y <= alt; y++) if (satir[y] >= esik) { if (gu < 0) gu = y; ga = y; }
        if (gu < 0) { gu = ust; ga = alt; }
        liste.push({ x0: x, x1, gen, renk, ust, alt, gu, ga });
      }
      x = x1 + 1;
    }
    if (liste.length) {
      const gens = liste.map(m => m.gen).sort((a, b) => a - b);
      const med = gens[Math.floor(gens.length / 2)];
      liste = liste.filter(m => m.gen <= med * 3 + 1);
    }
    return liste;
  },

  trend(m) {
    const n = m.length;
    if (n < 5) return null;
    const y = m.map(k => (k.gu + k.ga) / 2);
    const mx = (n - 1) / 2;
    const my = y.reduce((a, b) => a + b, 0) / n;
    let pay = 0, payda = 0;
    for (let i = 0; i < n; i++) { pay += (i - mx) * (y[i] - my); payda += (i - mx) * (i - mx); }
    const egim = pay / payda;
    const aralik = Math.max(...m.map(k => k.alt)) - Math.min(...m.map(k => k.ust));
    const oran = -egim * (n - 1) / aralik;
    let yon = 'Yatay';
    if (oran > 0.15) yon = 'Yükseliş';
    else if (oran < -0.15) yon = 'Düşüş';
    return { yon, guc: Math.min(100, Math.round(Math.abs(oran) * 150)) };
  },

  ciz(r, m) {
    const c = r.ctx;
    c.lineWidth = 1;
    for (const k of m) {
      c.strokeStyle = k.renk === 1 ? '#00ffaa' : '#ffd400';
      c.strokeRect(k.x0 - 1.5, k.ust - 1.5, k.gen + 3, k.alt - k.ust + 3);
    }
    return r.canvas;
  }
};
