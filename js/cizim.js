const Cizim = {
  grafik(s, kal) {
    const c = s.c, n = c.length;
    const W = 900, H = 700, px0 = 16, px1 = W - 190, py0 = 36, py1 = H - 40;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#0f1419'; x.fillRect(0, 0, W, H);

    const dg = [0, 1];
    s.sv.destekler.slice(0, 2).forEach(d => dg.push(d.seviye));
    s.sv.direncler.slice(0, 2).forEach(d => dg.push(d.seviye));
    if (s.plan) dg.push(s.plan.stop, s.plan.t1, s.plan.t2, s.plan.g1, s.plan.g2);
    const vmin = Math.min(...dg), vmax = Math.max(...dg);
    const pad = (vmax - vmin) * 0.04;
    const lo = vmin - pad, hi = vmax + pad;
    const Y = v => py1 - (v - lo) / (hi - lo) * (py1 - py0);
    const adim = (px1 - px0) / n;
    const X = i => px0 + (i + 0.5) * adim;
    const F = px => px + 'px sans-serif';

    const etiket = (v, renk, yazi) => {
      const y = Y(v);
      x.fillStyle = renk; x.fillRect(px1 + 2, y - 17, W - px1 - 4, 34);
      x.fillStyle = '#0f1419'; x.font = F(26); x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillText(yazi || Analiz.fiyat(v, kal), px1 + 8, y);
      x.textBaseline = 'alphabetic';
    };

    [0, 0.25, 0.5, 0.75, 1].forEach(v => {
      x.strokeStyle = '#1f2933'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(px0, Y(v)); x.lineTo(px1, Y(v)); x.stroke();
      x.fillStyle = '#6b7785'; x.font = F(24); x.textAlign = 'left';
      x.fillText(Analiz.fiyat(v, kal), px1 + 8, Y(v) + 8);
    });

    if (s.plan) {
      const a = Math.min(s.plan.g1, s.plan.g2), b = Math.max(s.plan.g1, s.plan.g2);
      x.fillStyle = s.plan.yon > 0 ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)';
      x.fillRect(px0, Y(b), px1 - px0, Math.max(4, Y(a) - Y(b)));
    }

    const bw = Math.max(2, adim * 0.62);
    c.forEach((k, i) => {
      const col = k.yes ? '#26a69a' : '#ef5350';
      x.strokeStyle = col; x.fillStyle = col;
      x.lineWidth = Math.max(1.5, adim * 0.12);
      x.beginPath(); x.moveTo(X(i), Y(k.h)); x.lineTo(X(i), Y(k.l)); x.stroke();
      const yT = Y(Math.max(k.o, k.c)), yB = Y(Math.min(k.o, k.c));
      x.fillRect(X(i) - bw / 2, yT, bw, Math.max(2, yB - yT));
    });

    const seviye = (v, renk, ad) => {
      x.strokeStyle = renk; x.lineWidth = 2; x.setLineDash([10, 6]);
      x.beginPath(); x.moveTo(px0, Y(v)); x.lineTo(px1, Y(v)); x.stroke(); x.setLineDash([]);
      x.fillStyle = renk; x.font = F(24); x.textAlign = 'left';
      x.fillText(ad, px0 + 6, Y(v) - 6);
      etiket(v, renk);
    };
    s.sv.destekler.slice(0, 2).forEach((d, i) => seviye(d.seviye, '#4da3ff', 'Destek ' + (i + 1)));
    s.sv.direncler.slice(0, 2).forEach((d, i) => seviye(d.seviye, '#ff7b7b', 'Direnç ' + (i + 1)));
    if (s.plan) {
      seviye(s.plan.stop, '#ff9800', 'Stop');
      seviye(s.plan.t1, '#ffd54f', 'Hedef 1');
      seviye(s.plan.t2, '#ffd54f', 'Hedef 2');
    }

    x.save();
    x.beginPath(); x.rect(px0, py0 - 10, px1 - px0, py1 - py0 + 20); x.clip();
    s.form.forEach((f, k) => {
      const i0 = Math.max(0, f.i0), i1 = Math.min(n - 1, f.i1);
      const renk = f.yon > 0 ? '#26a69a' : f.yon < 0 ? '#ef5350' : '#b0bec5';
      if (f.cizgiler) f.cizgiler.forEach(l => {
        x.strokeStyle = '#ffd54f'; x.lineWidth = 3;
        x.beginPath(); x.moveTo(X(l.i0), Y(l.v0)); x.lineTo(X(l.i1), Y(l.v1)); x.stroke();
      });
      let top = -Infinity, bot = Infinity;
      for (let i = i0; i <= i1; i++) { top = Math.max(top, c[i].h); bot = Math.min(bot, c[i].l); }
      const bx = X(i0) - adim * 0.8, bwid = X(i1) - X(i0) + adim * 1.6;
      x.strokeStyle = renk; x.lineWidth = 2; x.setLineDash([8, 5]);
      x.strokeRect(bx, Y(top) - 8, bwid, Y(bot) - Y(top) + 16); x.setLineDash([]);
      x.fillStyle = renk; x.font = F(24); x.textAlign = 'left';
      const tw = x.measureText(f.ad).width;
      const tx = Math.min(bx, px1 - tw - 4);
      const ty = Math.max(py0 + 12, Y(top) - 16 - (k % 3) * 28);
      x.fillText(f.ad, Math.max(px0, tx), ty);
    });
    x.restore();

    const son = c[n - 1];
    x.strokeStyle = '#8b98a5'; x.lineWidth = 1; x.setLineDash([3, 4]);
    x.beginPath(); x.moveTo(px0, Y(son.c)); x.lineTo(px1, Y(son.c)); x.stroke(); x.setLineDash([]);
    etiket(son.c, son.yes ? '#26a69a' : '#ef5350');

    x.fillStyle = '#6b7785'; x.font = F(22); x.textAlign = 'left';
    x.fillText('Mavi: destek  Kırmızı: direnç  Sarı: formasyon çizgisi', px0, H - 10);
    return cv;
  }
}; 
