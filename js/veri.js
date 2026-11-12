const Veri = {
  harita: {},

  ekle(anahtarlar, kaynak, sembol, ad, tur) {
    anahtarlar.forEach(a => { this.harita[a] = { kaynak, sembol, ad, tur }; });
  },

  hazirla() {
    const K = (a, s, ad) => this.ekle(a, 'b', s, ad, 'Kripto');
    K(['bitcoin', 'btc'], 'BTCUSDT', 'Bitcoin');
    K(['ethereum', 'eth', 'etherium'], 'ETHUSDT', 'Ethereum');
    K(['solana', 'sol'], 'SOLUSDT', 'Solana');
    K(['xrp', 'ripple'], 'XRPUSDT', 'XRP');
    K(['bnb'], 'BNBUSDT', 'BNB');
    K(['dogecoin', 'doge'], 'DOGEUSDT', 'Dogecoin');
    K(['cardano', 'ada'], 'ADAUSDT', 'Cardano');
    K(['avalanche', 'avax'], 'AVAXUSDT', 'Avalanche');
    K(['shiba', 'shib'], 'SHIBUSDT', 'Shiba Inu');
    const B = (a, s, ad) => this.ekle(a, 'y', s, ad, 'BIST hissesi');
    B(['pegasus', 'pgsus'], 'PGSUS.IS', 'Pegasus');
    B(['thy', 'turk hava yollari', 'thyao'], 'THYAO.IS', 'Türk Hava Yolları');
    B(['garanti', 'garan'], 'GARAN.IS', 'Garanti BBVA');
    B(['akbank', 'akbnk'], 'AKBNK.IS', 'Akbank');
    B(['is bankasi', 'isbank', 'isctr'], 'ISCTR.IS', 'İş Bankası');
    B(['yapi kredi', 'ykbnk'], 'YKBNK.IS', 'Yapı Kredi');
    B(['aselsan', 'asels'], 'ASELS.IS', 'Aselsan');
    B(['tupras', 'tuprs'], 'TUPRS.IS', 'Tüpraş');
    B(['eregli', 'ereğli', 'eregl'], 'EREGL.IS', 'Ereğli Demir Çelik');
    B(['bim', 'bimas'], 'BIMAS.IS', 'BİM');
    B(['koc holding', 'kchol'], 'KCHOL.IS', 'Koç Holding');
    B(['sabanci', 'sahol'], 'SAHOL.IS', 'Sabancı Holding');
    B(['sasa'], 'SASA.IS', 'SASA');
    B(['turkcell', 'tcell'], 'TCELL.IS', 'Turkcell');
    B(['ford otosan', 'froto'], 'FROTO.IS', 'Ford Otosan');
    B(['tofas', 'toaso'], 'TOASO.IS', 'Tofaş');
    B(['arcelik', 'arclk'], 'ARCLK.IS', 'Arçelik');
    B(['petkim', 'petkm'], 'PETKM.IS', 'Petkim');
    B(['hektas', 'hekts'], 'HEKTS.IS', 'Hektaş');
    this.ekle(['bist100', 'bist 100', 'xu100'], 'y', 'XU100.IS', 'BIST 100', 'Endeks');
    const Y = (a, s, ad, tur) => this.ekle(a, 'y', s, ad, tur);
    Y(['dolar', 'usdtry', 'dolar tl'], 'USDTRY=X', 'Dolar/TL', 'Forex');
    Y(['euro', 'eurtry', 'euro tl'], 'EURTRY=X', 'Euro/TL', 'Forex');
    Y(['eurusd'], 'EURUSD=X', 'EUR/USD', 'Forex');
    Y(['gbpusd', 'sterlin'], 'GBPUSD=X', 'GBP/USD', 'Forex');
    Y(['altin', 'gold', 'ons altin'], 'GC=F', 'Altın (ons)', 'Emtia');
    Y(['gumus', 'silver'], 'SI=F', 'Gümüş (ons)', 'Emtia');
    Y(['petrol', 'brent'], 'BZ=F', 'Brent Petrol', 'Emtia');
    Y(['wti'], 'CL=F', 'WTI Petrol', 'Emtia');
    Y(['sp500', 's&p 500', 'sp 500'], '^GSPC', 'S&P 500', 'Endeks');
    Y(['nasdaq'], '^IXIC', 'Nasdaq', 'Endeks');
    Y(['dax'], '^GDAXI', 'DAX', 'Endeks');
    Y(['apple', 'aapl'], 'AAPL', 'Apple', 'ABD hissesi');
    Y(['tesla', 'tsla'], 'TSLA', 'Tesla', 'ABD hissesi');
    Y(['nvidia', 'nvda'], 'NVDA', 'Nvidia', 'ABD hissesi');
    Y(['microsoft', 'msft'], 'MSFT', 'Microsoft', 'ABD hissesi');
    Y(['amazon', 'amzn'], 'AMZN', 'Amazon', 'ABD hissesi');
    Y(['google', 'googl'], 'GOOGL', 'Google', 'ABD hissesi');
    Y(['meta'], 'META', 'Meta', 'ABD hissesi');
  },

  norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')
      .replace(/\b(grafik|grafigi|hisse|hissesi|fiyat|fiyati|analiz|analizi)\b/g, '')
      .replace(/\s+/g, ' ').trim();
  },

  coz(girdi) {
    const n = this.norm(girdi);
    if (!n) return [];
    if (this.harita[n]) return [this.harita[n]];
    const ham = girdi.trim().toUpperCase();
    const kod = n.replace(/[^a-z0-9]/g, '').toUpperCase();
    const bistList = window.TahminAI && Array.isArray(window.TahminAI.LISTE) ? window.TahminAI.LISTE : [];
    const bistItem = kod && bistList.find(item => String(item.q || '').toUpperCase() === kod);
    if (bistItem) return [{ kaynak: 'y', sembol: kod + '.IS', ad: bistItem.ad || kod, tur: 'BIST hissesi' }];
    if (/[.=^-]/.test(ham)) return [{ kaynak: 'y', sembol: ham, ad: ham, tur: 'Diğer' }];
    const l = [];
    if (kod.length >= 2 && kod.length <= 10) {
      l.push({ kaynak: 'b', sembol: kod.endsWith('USDT') ? kod : kod + 'USDT', ad: kod, tur: 'Kripto' });
      l.push({ kaynak: 'y', sembol: kod + '.IS', ad: kod, tur: 'BIST hissesi' });
      l.push({ kaynak: 'y', sembol: kod, ad: kod, tur: 'Hisse / diğer' });
    }
    return l;
  },

  piyasaTahmini(girdi) {
    const ham = String(girdi || '').trim().toUpperCase();
    const n = this.norm(String(girdi || ''));
    const mapped = this.harita[n];
    if (mapped) {
      if (mapped.kaynak === 'b') return 'Kripto';
      if (String(mapped.sembol || '').toUpperCase().endsWith('.IS') ||
          /BIST hissesi|ABD hissesi/i.test(mapped.tur || '')) return 'Hisse';
      return mapped.tur || 'Diğer';
    }
    if (ham.endsWith('.IS')) return 'Hisse';
    if (ham.endsWith('USDT')) return 'Kripto';
    const code = ham.replace(/[^A-Z0-9]/g, '');
    const bistList = window.TahminAI && Array.isArray(window.TahminAI.LISTE) ? window.TahminAI.LISTE : [];
    if (code && bistList.some(item => String(item.q || '').toUpperCase() === code)) return 'Hisse';
    return 'Diğer';
  },

  zamanDilimleri(girdi) {
    const piyasa = this.piyasaTahmini(girdi);
    if (piyasa === 'Hisse') return ['1d'];
    if (piyasa === 'Kripto') return ['15m', '1h', '4h', '1d'];
    return ['15m', '1h', '1d'];
  },

  async getir(url, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms || 12000);
    try {
      const r = await fetch(url, { signal: ac.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  },

  async binance(sembol, zd, limit) {
    const hosts = ['https://data-api.binance.vision', 'https://api.binance.com'];
    const adet = Math.max(20, Math.min(1000, Number(limit) || 120));
    let son;
    for (const host of hosts) {
      try {
        const url = host + '/api/v3/klines?symbol=' + encodeURIComponent(sembol) +
          '&interval=' + encodeURIComponent(zd) + '&limit=' + adet;
        const rows = await this.getir(url, 20000);
        if (!Array.isArray(rows) || rows.length < 20) throw new Error('Yeterli Binance verisi yok');
        const n = value => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };
        const mumlar = rows.map(row => ({
          t: Number(row[0]),
          o: Number(row[1]),
          h: Number(row[2]),
          l: Number(row[3]),
          c: Number(row[4]),
          v: n(row[5]),
          closeTime: n(row[6]),
          quoteVolume: n(row[7]),
          trades: n(row[8]),
          takerBuyBaseVolume: n(row[9]),
          takerBuyQuoteVolume: n(row[10])
        })).filter(k =>
          Number.isFinite(k.t) && Number.isFinite(k.o) &&
          Number.isFinite(k.h) && Number.isFinite(k.l) &&
          Number.isFinite(k.c)
        );
        if (mumlar.length < 20) throw new Error('Geçerli Binance mumu yetersiz');
        return mumlar;
      } catch (e) { son = e; }
    }
    throw son || new Error('Binance verisi alınamadı');
  },

  kapanmisMumlar(mumlar, zd, simdi) {
    const sure = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    }[zd];
    if (!sure) throw new Error('Desteklenmeyen mum zaman dilimi: ' + zd);
    const now = Number.isFinite(simdi) ? simdi : Date.now();
    return (Array.isArray(mumlar) ? mumlar : []).filter(m => {
      if (!m || !Number.isFinite(Number(m.t))) return false;
      if (m.closeTime !== null && m.closeTime !== undefined &&
          Number.isFinite(Number(m.closeTime))) return Number(m.closeTime) < now;
      return Number(m.t) + sure <= now;
    }).sort((a, b) => Number(a.t) - Number(b.t));
  },

  async yahoo(sembol, zd) {
    const symbol = String(sembol || '').toUpperCase();
    const isMappedEquity = Object.keys(this.harita).some(key => {
      const item = this.harita[key];
      return item && item.sembol === symbol && /BIST hissesi|ABD hissesi/i.test(String(item.tur || ''));
    });
    if (symbol.endsWith('.IS') || isMappedEquity) zd = '1d';
    const p = { '15m': ['15m', '5d'], '1h': ['60m', '1mo'], '1d': ['1d', '6mo'] }[zd];
    if (!p) throw new Error('Yahoo Finance bu zaman dilimini desteklemiyor: ' + zd);
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sembol) + '?interval=' + p[0] + '&range=' + p[1];
    const yollar = [
      u => u,
      u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
      u => 'https://corsproxy.io/?' + encodeURIComponent(u)
    ];
    let son;
    for (const y of yollar) {
      try {
        const j = await this.getir(y(url));
        const r = j.chart && j.chart.result && j.chart.result[0];
        if (!r || !r.timestamp) { const e = new Error('Sembol bulunamadı'); e.kesin = true; throw e; }
        const q = r.indicators.quote[0];
        const out = [];
        r.timestamp.forEach((t, i) => {
          if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null)
            out.push({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume && q.volume[i] != null ? Number(q.volume[i]) : null });
        });
        if (out.length < 20) throw new Error('Yeterli veri yok');
        return out;
      } catch (e) { son = e; if (e.kesin) throw e; }
    }
    throw son;
  },

  async ara(girdi, zd, durum) {
    const l = this.coz(girdi);
    if (!l.length) throw new Error('Varlık adı anlaşılamadı.');
    const desteklenen = ['15m', '1h', '4h', '1d'];
    const istenenZd = desteklenen.includes(zd) ? zd : '1h';
    let hata;
    for (const a of l) {
      try {
        const sembol = String(a.sembol || '').toUpperCase();
        const hisse = /BIST hissesi|ABD hissesi|Hisse \/ diğer/i.test(String(a.tur || '')) || sembol.endsWith('.IS');
        const etkinZd = hisse ? '1d' : istenenZd;
        if (a.kaynak !== 'b' && etkinZd === '4h') {
          throw new Error('4 saatlik veri yalnızca kripto varlıklar için kullanılabilir.');
        }
        if (durum) durum(a.ad + ' aranıyor (' + (a.kaynak === 'b' ? 'Binance' : 'Yahoo Finance') + ')' +
          (hisse && istenenZd !== '1d' ? ' · Hisse verisi günlük periyoda sabitlendi' : '') + '...');
        const mumlar = a.kaynak === 'b'
          ? await this.binance(a.sembol, etkinZd)
          : await this.yahoo(a.sembol, etkinZd);
        return Object.assign({}, a, { mumlar, zd: etkinZd, cekim: new Date() });
      } catch (e) { hata = e; }
    }
    throw new Error('Veri bulunamadı' + (hata ? ' (' + hata.message + ').' : '.'));
  },

  donustur(v, adet) {
    const d = v.mumlar.slice(-adet);
    const hi = Math.max(...d.map(k => k.h)), lo = Math.min(...d.map(k => k.l));
    const S = 1000 / ((hi - lo) || 1);
    const y = p => (hi - p) * S;
    const m = d.map((k, i) => ({
      x0: i, x1: i, gen: 1, renk: k.c >= k.o ? 1 : 2,
      ust: y(k.h), alt: y(k.l), gu: y(Math.max(k.o, k.c)), ga: y(Math.min(k.o, k.c))
    }));
    return { m, d, kal: { hi, lo } };
  },

  fmt(a) {
    const x = Math.abs(a);
    return a.toFixed(x >= 100 ? 2 : x >= 1 ? 4 : 6);
  },

  tarih(ms, sadeceGun) {
    const o = { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' };
    if (!sadeceGun) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return new Date(ms).toLocaleString('tr-TR', o);
  },

  bilgi(v, d) {
    const gun = v.zd === '1d';
    const zdAd = { '15m': '15 dakika', '1h': '1 saat', '4h': '4 saat', '1d': '1 gün' }[v.zd];
    const L = [
      'Varlık: ' + v.ad + ' (' + v.sembol + ') – ' + v.tur,
      'Veri kaynağı: ' + (v.kaynak === 'b' ? 'Binance herkese açık piyasa verisi' : 'Yahoo Finance (gecikmeli olabilir)'),
      'Zaman dilimi: ' + zdAd + ', analiz edilen mum sayısı: ' + d.length,
      'Grafikteki son mum: ' + this.tarih(d[d.length - 1].t, gun) + ' (Türkiye saati)',
      'İlk mum: ' + this.tarih(d[0].t, gun) + ' (Türkiye saati)',
      'Son kapanış fiyatı: ' + this.fmt(d[d.length - 1].c),
      'Veri alınma zamanı: ' + this.tarih(v.cekim.getTime(), false)
    ];
    if (!gun) L.push('Son mum henüz kapanmamış olabilir. Borsa kapalıysa son seansın verisi görünür.');
    return L;
  }
};
Veri.hazirla(); 
