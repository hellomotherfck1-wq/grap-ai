(function () {
  Veri.vekil = 'https://grafik-vekil.hellomotherfck1.workers.dev/?u=';

  function yollar() {
    const l = [];
    if  Veri.vekil = https://cool-resonance-e2e8.hellomotherfck1.workers.dev/ u=';
    l.push({ ad: 'doğrudan', f: u => u });
    l.push({ ad: 'allorigins', f: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) });
    l.push({ ad: 'allorigins-get', f: u => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), sar: true });
    l.push({ ad: 'codetabs', f: u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u) });
    l.push({ ad: 'thingproxy', f: u => 'https://thingproxy.freeboard.io/fetch/' + u });
    l.push({ ad: 'corsproxy', f: u => 'https://corsproxy.io/?' + encodeURIComponent(u) });
    return l;
  }

  Veri.vekilGetir = async function (url, kontrol) {
    const hatalar = [];
    const denemeler = yollar().map(async y => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 20000);
      try {
        const r = await fetch(y.f(url), { signal: ac.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        let j = await r.json();
        if (y.sar) j = JSON.parse(j.contents);
        kontrol(j);
        return j;
      } catch (e) {
        const m = y.ad + ': ' + (e.name === 'AbortError' ? 'zaman aşımı' : e.message);
        hatalar.push(m);
        throw new Error(m);
      } finally {
        clearTimeout(t);
      }
    });
    try {
      return await Promise.any(denemeler);
    } catch (e) {
      throw new Error('Hiçbir yoldan veri alınamadı. ' + hatalar.join(' | '));
    }
  };

  Veri.yahoo = async function (sembol, zd) {
    const p = { '15m': ['15m', '5d'], '1h': ['60m', '1mo'], '1d': ['1d', '6mo'] }[zd];
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sembol) + '?interval=' + p[0] + '&range=' + p[1];
    const j = await this.vekilGetir(url, x => {
      if (!x || !x.chart) throw new Error('geçersiz yanıt');
    });
    const r = j.chart.result && j.chart.result[0];
    if (!r || !r.timestamp) throw new Error('Sembol bulunamadı');
    const q = r.indicators.quote[0];
    const out = [];
    r.timestamp.forEach((t, i) => {
      if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null)
        out.push({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] });
    });
    if (out.length < 20) throw new Error('Yeterli veri yok');
    return out;
  };

  Veri.yahooAra = async function (q) {
    try {
      const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=8&newsCount=0';
      const j = await this.vekilGetir(url, x => {
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
})();
