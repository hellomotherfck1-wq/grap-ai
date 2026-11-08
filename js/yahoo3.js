(function () {
  const VEKIL = 'https://grafik-vekil.hellomotherfck1.workers.dev/?u=';

  async function getir(url, kontrol) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 25000);
    try {
      const r = await fetch(VEKIL + encodeURIComponent(url), { signal: ac.signal });
      if (!r.ok) {
        let ek = '';
        try { ek = (await r.text()).slice(0, 120); } catch (e) {}
        throw new Error('HTTP ' + r.status + ' ' + ek);
      }
      const j = await r.json();
      kontrol(j);
      return j;
    } catch (e) {
      throw new Error('[yahoo3] Vekil hatası: ' + (e.name === 'AbortError' ? 'zaman aşımı' : e.message));
    } finally {
      clearTimeout(t);
    }
  }

  Veri.yahoo = async function (sembol, zd) {
    const p = { '15m': ['15m', '5d'], '1h': ['60m', '1mo'], '1d': ['1d', '6mo'] }[zd];
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sembol) + '?interval=' + p[0] + '&range=' + p[1];
    const j = await getir(url, x => {
      if (!x || !x.chart) throw new Error('geçersiz yanıt');
    });
    const r = j.chart.result && j.chart.result[0];
    if (!r || !r.timestamp) throw new Error('[yahoo3] Sembol bulunamadı: ' + sembol);
    const q = r.indicators.quote[0];
    const out = [];
    r.timestamp.forEach((t, i) => {
      if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null)
        out.push({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] });
    });
    if (out.length < 20) throw new Error('[yahoo3] Yeterli veri yok (' + out.length + ' mum)');
    return out;
  };

  Veri.yahooAra = async function (q) {
    try {
      const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=8&newsCount=0';
      const j = await getir(url, x => {
        if (!x || !Array.isArray(x.quotes)) throw new Error('geçersiz yanıt');
      });
      const l = j.quotes.filter(x => x.symbol);
      const ist = l.filter(x => x.symbol.endsWith('.IS'));
      const diger = l.filter(x => !x.symbol.endsWith('.IS')).slice(0, 2);
      return ist.concat(diger).map(x => ({
        kaynak: 'y', sembol: x.symbol,
        ad: x.shortname || x.longname || x.symbol,
        tur: x.symbol.endsWith('.IS') ? 'BIST hissesi' : (x.quoteType || 'Diğer')
      }));
    } catch (e) {
      return [];
    }
  };

  const ay = document.getElementById('ayarlar');
  if (ay) {
    const p = document.createElement('p');
    p.className = 'kart';
    p.textContent = 'Yahoo modülü: yahoo3 yüklendi (vekil açık)';
    ay.appendChild(p);
  }
})();
