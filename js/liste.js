(function () {
  const ANAHTAR = 'graphai-binance-liste';
  Veri.binanceListe = null;

  Veri.listeYukle = async function () {
    if (this.binanceListe) return this.binanceListe;
    try {
      const k = JSON.parse(localStorage.getItem(ANAHTAR) || 'null');
      if (k && Date.now() - k.t < 3 * 86400000 && k.l && k.l.length > 50) {
        this.binanceListe = k.l;
        return k.l;
      }
    } catch (e) {}
    const hosts = ['https://data-api.binance.vision', 'https://api.binance.com'];
    let son;
    for (const h of hosts) {
      try {
        const j = await this.getir(h + '/api/v3/ticker/price', 20000);
        if (!Array.isArray(j) || j.length < 50) throw new Error('Liste boş');
        const l = j.map(x => x.symbol);
        this.binanceListe = l;
        try { localStorage.setItem(ANAHTAR, JSON.stringify({ t: Date.now(), l })); } catch (e) {}
        return l;
      } catch (e) { son = e; }
    }
    throw son;
  };

  Veri.binanceBul = function (girdi) {
    const L = this.binanceListe;
    if (!L) return null;
    const k = girdi.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!k) return null;
    if (L.includes(k + 'USDT')) return k + 'USDT';
    if (L.includes(k)) return k;
    return null;
  };

  Veri.yahooAra = async function (q) {
    const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=8&newsCount=0';
    const yollar = [
      u => u,
      u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
      u => 'https://corsproxy.io/?' + encodeURIComponent(u)
    ];
    for (const y of yollar) {
      try {
        const j = await this.getir(y(url), 10000);
        const l = (j.quotes || []).filter(x => x.symbol);
        const ist = l.filter(x => x.symbol.endsWith('.IS'));
        const diger = l.filter(x => !x.symbol.endsWith('.IS')).slice(0, 2);
        return ist.concat(diger).map(x => ({
          kaynak: 'y', sembol: x.symbol,
          ad: x.shortname || x.longname || x.symbol,
          tur: x.symbol.endsWith('.IS') ? 'BIST hissesi' : (x.quoteType || 'Diğer')
        }));
      } catch (e) {}
    }
    return [];
  };

  Veri.ara = async function (girdi, zd, durum) {
    const bildir = x => { if (durum) durum(x); };
    const n = this.norm(girdi);
    if (!n) throw new Error('Varlık adı anlaşılamadı.');
    const adaylar = [];
    const ham = girdi.trim().toUpperCase().replace(/\s+/g, '');
    const kod = n.replace(/[^a-z0-9]/g, '').toUpperCase();
    const bistList = typeof window !== 'undefined' && window.TahminAI && Array.isArray(window.TahminAI.LISTE)
      ? window.TahminAI.LISTE : [];
    const bistItem = kod && bistList.find(item => String(item.q || '').toUpperCase() === kod);
    if (ham.endsWith('.IS')) {
      adaylar.push({ kaynak: 'y', sembol: ham, ad: ham.slice(0, -3), tur: 'BIST hissesi' });
    } else if (this.harita[n]) {
      adaylar.push(this.harita[n]);
    } else if (bistItem) {
      adaylar.push({ kaynak: 'y', sembol: kod + '.IS', ad: bistItem.ad || kod, tur: 'BIST hissesi' });
    } else {
      bildir('Binance listesi kontrol ediliyor...');
      try { await this.listeYukle(); } catch (e) {}
      const b = this.binanceBul(girdi);
      if (b) adaylar.push({ kaynak: 'b', sembol: b, ad: b.replace(/USDT$/, ''), tur: 'Kripto (Binance)' });
      if (/[.=^-]/.test(ham)) {
        adaylar.push({ kaynak: 'y', sembol: ham, ad: ham, tur: 'Diğer' });
      } else if (/^[A-Z0-9]{2,6}$/.test(ham)) {
        adaylar.push({ kaynak: 'y', sembol: ham + '.IS', ad: ham, tur: 'BIST hissesi' });
        if (!b) adaylar.push({ kaynak: 'y', sembol: ham, ad: ham, tur: 'Hisse / diğer' });
      }
    }
    let hata;
    const dene = async a => {
      const sembol = String(a.sembol || '').toUpperCase();
      const yalnizHisse = /BIST hissesi|ABD hissesi|Hisse \/ diğer/i.test(String(a.tur || '')) ||
        sembol.endsWith('.IS') || (a.kaynak === 'y' && /^[A-Z0-9]{1,10}$/.test(sembol));
      const istenenZd = ['15m', '1h', '4h', '1d'].includes(zd) ? zd : '1h';
      const etkinZd = yalnizHisse ? '1d' : istenenZd;
      if (a.kaynak !== 'b' && etkinZd === '4h') {
        throw new Error('4 saatlik veri yalnızca kripto varlıklar için kullanılabilir.');
      }
      bildir(a.ad + ' aranıyor (' + (a.kaynak === 'b' ? 'Binance' : 'Yahoo Finance') + ')' +
        (yalnizHisse && istenenZd !== '1d' ? ' · Hisse verisi günlük periyoda sabitlendi' : '') + '...');
      const mumlar = a.kaynak === 'b'
        ? await this.binance(a.sembol, etkinZd)
        : await this.yahoo(a.sembol, etkinZd);
      return Object.assign({}, a, { mumlar, zd: etkinZd, cekim: new Date() });
    };
    for (const a of adaylar) {
      try { return await dene(a); } catch (e) { hata = e; }
    }
    bildir('İsimle arama yapılıyor...');
    const bulunan = await this.yahooAra(girdi);
    for (const a of bulunan) {
      try { return await dene(a); } catch (e) { hata = e; }
    }
    throw new Error('Veri bulunamadı' + (hata ? ' (' + hata.message + ').' : '.'));
  };

  Veri.oneriDoldur = function () {
    const giris = document.getElementById('ara-ad');
    if (!giris) return;
    let dl = document.getElementById('oneri');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'oneri';
      document.body.appendChild(dl);
      giris.setAttribute('list', 'oneri');
    }
    const set = new Set();
    Object.values(this.harita).forEach(h => set.add(h.ad));
    (this.binanceListe || []).forEach(s => { if (s.endsWith('USDT')) set.add(s.slice(0, -4)); });
    dl.innerHTML = '';
    Array.from(set).sort().forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      dl.appendChild(o);
    });
  };

  Veri.oneriDoldur();
  if (navigator.onLine) {
    Veri.listeYukle().then(() => Veri.oneriDoldur()).catch(() => {});
  }
})(); 
