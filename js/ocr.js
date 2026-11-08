const OCR = {
  yukleniyor: null,

  motor() {
    if (window.Tesseract) return Promise.resolve();
    if (!this.yukleniyor) {
      this.yukleniyor = new Promise((ok, hata) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
        s.onload = ok;
        s.onerror = () => {
          this.yukleniyor = null;
          hata(new Error('OCR dosyaları yüklenemedi (ilk kullanımda internet gerekir).'));
        };
        document.head.appendChild(s);
      });
    }
    return this.yukleniyor;
  },

  serit(r, x0, x1) {
    const sw = x1 - x0;
    const k = r.h > 1400 ? 2 : 3;
    const cv = document.createElement('canvas');
    cv.width = Math.round(sw * k);
    cv.height = Math.round(r.h * k);
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = true;
    c.drawImage(r.canvas, x0, 0, sw, r.h, 0, 0, cv.width, cv.height);
    const d = c.getImageData(0, 0, cv.width, cv.height);
    const p = d.data;
    let t = 0;
    const n = p.length / 4;
    for (let i = 0; i < p.length; i += 4) t += (p[i] + p[i + 1] + p[i + 2]) / 3;
    const koyu = t / n < 128;
    for (let i = 0; i < p.length; i += 4) {
      let g = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
      if (koyu) g = 255 - g;
      const v = g < 150 ? 0 : 255;
      p[i] = p[i + 1] = p[i + 2] = v;
      p[i + 3] = 255;
    }
    c.putImageData(d, 0, 0);
    return { cv, k };
  },

  sayi(metin, mod) {
    let t = metin.replace(/[^0-9.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
    if (t.length < 2) return null;
    if (mod === 0) t = t.replace(/,/g, '');
    else t = t.replace(/\./g, '').replace(',', '.');
    const v = parseFloat(t);
    return isFinite(v) ? v : null;
  },

  uydur(pts) {
    if (pts.length < 3) return null;
    let en = null;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dy = pts[j].y - pts[i].y;
        if (Math.abs(dy) < 8) continue;
        const a = (pts[j].v - pts[i].v) / dy;
        if (a >= 0) continue;
        const b = pts[i].v - a * pts[i].y;
        const tol = Math.abs(a) * 8;
        const ic = pts.filter(q => Math.abs(a * q.y + b - q.v) <= tol);
        if (!en || ic.length > en.length) en = ic;
      }
    }
    if (!en || en.length < 3) return null;
    const n = en.length;
    const my = en.reduce((s, q) => s + q.y, 0) / n;
    const mv = en.reduce((s, q) => s + q.v, 0) / n;
    let pay = 0, payda = 0;
    en.forEach(q => { pay += (q.y - my) * (q.v - mv); payda += (q.y - my) * (q.y - my); });
    if (!payda) return null;
    const a = pay / payda;
    if (a >= 0) return null;
    const b = mv - a * my;
    let hata = 0;
    en.forEach(q => { hata += Math.pow(a * q.y + b - q.v, 2); });
    return { a, b, n, hata: Math.sqrt(hata / n) / Math.abs(a) };
  },

  coz(words, k) {
    const ham = [];
    words.forEach(w => {
      const t = (w.text || '').trim();
      if (!/\d/.test(t)) return;
      ham.push({ t: t.replace(/[^0-9.,]/g, ''), y: (w.bbox.y0 + w.bbox.y1) / 2 / k });
    });
    if (ham.length < 3) return null;
    const hepsiNokta = ham.every(h => /^\d{1,3}(\.\d{3})+$/.test(h.t));
    const hepsiVirgul = ham.every(h => /^\d{1,3}(,\d{3})+$/.test(h.t));
    const modlar = hepsiNokta ? [1] : hepsiVirgul ? [0] : [0, 1];
    let en = null;
    modlar.forEach(mod => {
      const pts = [];
      ham.forEach(h => {
        const v = this.sayi(h.t, mod);
        if (v !== null) pts.push({ y: h.y, v });
      });
      const f = this.uydur(pts);
      if (f && (!en || f.n > en.n || (f.n === en.n && f.hata < en.hata))) en = f;
    });
    return en;
  },

  async oku(r, m) {
    await this.motor();
    const worker = await Tesseract.createWorker('eng');
    try {
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789.,',
        tessedit_pageseg_mode: '11'
      });
      const sag = Math.max(...m.map(k => k.x1)) + 4;
      const sol = Math.min(...m.map(k => k.x0)) - 4;
      const adaylar = [];
      adaylar.push(r.w - sag >= 30 ? [sag, r.w] : [Math.round(r.w * 0.86), r.w]);
      if (sol >= 30) adaylar.push([0, sol]);
      const yT = Math.min(...m.map(k => k.ust));
      const yB = Math.max(...m.map(k => k.alt));
      for (const [x0, x1] of adaylar) {
        const s = this.serit(r, x0, x1);
        const { data } = await worker.recognize(s.cv);
        const f = this.coz(data.words || [], s.k);
        if (f) {
          const hi = f.a * yT + f.b, lo = f.a * yB + f.b;
          if (hi > lo) return { hi, lo, n: f.n };
        }
      }
      return null;
    } finally {
      await worker.terminate();
    }
  }
};
