/**
 * Coin Tahmin AI — kripto coin tarama ve ajanlı tahmin
 * BIST Tahmin AI ile aynı ajan altyapısını kullanır (Teknik, Hacim, Denetçi).
 * Hafıza: localStorage (ayrı anahtar).
 */
(function () {
  'use strict';

  var KEY = 'graphai_coin_tahmin_v1';
  var BUGUN_KEY = 'graphai_coin_tahmin_bugun';
  var CACHE_VERSION = 'crypto-intelligence-2.1.0';
  function cacheKey(zd) {
    return BUGUN_KEY + ':' + CACHE_VERSION + ':' + (zd || '1h');
  }

  /** Binance'te kesin USDT çifti olan ~200 coin */
  var LISTE = [
    { q: 'BTC', ad: 'Bitcoin' },
    { q: 'ETH', ad: 'Ethereum' },
    { q: 'BNB', ad: 'BNB' },
    { q: 'SOL', ad: 'Solana' },
    { q: 'XRP', ad: 'XRP' },
    { q: 'ADA', ad: 'Cardano' },
    { q: 'DOGE', ad: 'Dogecoin' },
    { q: 'AVAX', ad: 'Avalanche' },
    { q: 'DOT', ad: 'Polkadot' },
    { q: 'LINK', ad: 'Chainlink' },
    { q: 'POL', ad: 'Polygon' },
    { q: 'LTC', ad: 'Litecoin' },
    { q: 'UNI', ad: 'Uniswap' },
    { q: 'ATOM', ad: 'Cosmos' },
    { q: 'NEAR', ad: 'NEAR Protocol' },
    { q: 'APT', ad: 'Aptos' },
    { q: 'SUI', ad: 'Sui' },
    { q: 'PEPE', ad: 'Pepe' },
    { q: 'SHIB', ad: 'Shiba Inu' },
    { q: 'TRX', ad: 'TRON' },
    { q: 'ICP', ad: 'Internet Computer' },
    { q: 'FIL', ad: 'Filecoin' },
    { q: 'ARB', ad: 'Arbitrum' },
    { q: 'OP', ad: 'Optimism' },
    { q: 'INJ', ad: 'Injective' },
    { q: 'AAVE', ad: 'Aave' },
    { q: 'RENDER', ad: 'Render' },
    { q: 'FET', ad: 'Fetch.ai' },
    { q: 'HBAR', ad: 'Hedera' },
    { q: 'VET', ad: 'VeChain' },
    { q: 'ALGO', ad: 'Algorand' },
    { q: 'SAND', ad: 'The Sandbox' },
    { q: 'MANA', ad: 'Decentraland' },
    { q: 'AXS', ad: 'Axie Infinity' },
    { q: 'GALA', ad: 'Gala' },
    { q: 'IMX', ad: 'Immutable' },
    { q: 'APE', ad: 'ApeCoin' },
    { q: 'LDO', ad: 'Lido DAO' },
    { q: 'CRV', ad: 'Curve DAO' },
    { q: 'SNX', ad: 'Synthetix' },
    { q: 'COMP', ad: 'Compound' },
    { q: 'YFI', ad: 'yearn.finance' },
    { q: '1INCH', ad: '1inch' },
    { q: 'ENS', ad: 'Ethereum Name Service' },
    { q: 'GRT', ad: 'The Graph' },
    { q: 'THETA', ad: 'Theta Network' },
    { q: 'XTZ', ad: 'Tezos' },
    { q: 'EOS', ad: 'EOS' },
    { q: 'FLOW', ad: 'Flow' },
    { q: 'KAVA', ad: 'Kava' },
    { q: 'ZIL', ad: 'Zilliqa' },
    { q: 'ONE', ad: 'Harmony' },
    { q: 'CELO', ad: 'Celo' },
    { q: 'QTUM', ad: 'Qtum' },
    { q: 'IOTA', ad: 'IOTA' },
    { q: 'NEO', ad: 'NEO' },
    { q: 'WAVES', ad: 'Waves' },
    { q: 'ZEC', ad: 'Zcash' },
    { q: 'DASH', ad: 'Dash' },
    { q: 'BCH', ad: 'Bitcoin Cash' },
    { q: 'ETC', ad: 'Ethereum Classic' },
    { q: 'XLM', ad: 'Stellar' },
    { q: 'HOT', ad: 'Holo' },
    { q: 'BAT', ad: 'Basic Attention Token' },
    { q: 'ZRX', ad: '0x' },
    { q: 'ENJ', ad: 'Enjin Coin' },
    { q: 'CHZ', ad: 'Chiliz' },
    { q: 'LRC', ad: 'Loopring' },
    { q: 'ANKR', ad: 'Ankr' },
    { q: 'STORJ', ad: 'Storj' },
    { q: 'SKL', ad: 'Skale' },
    { q: 'CELR', ad: 'Celer Network' },
    { q: 'CTSI', ad: 'Cartesi' },
    { q: 'BAND', ad: 'Band Protocol' },
    { q: 'API3', ad: 'API3' },
    { q: 'RLC', ad: 'iExec RLC' },
    { q: 'NMR', ad: 'Numeraire' },
    { q: 'BAL', ad: 'Balancer' },
    { q: 'SUSHI', ad: 'SushiSwap' },
    { q: 'CAKE', ad: 'PancakeSwap' },
    { q: 'BAKE', ad: 'BakeryToken' },
    { q: 'ALPHA', ad: 'Stella' },
    { q: 'TWT', ad: 'Trust Wallet Token' },
    { q: 'CFX', ad: 'Conflux' },
    { q: 'MINA', ad: 'Mina' },
    { q: 'ROSE', ad: 'Oasis' },
    { q: 'KSM', ad: 'Kusama' },
    { q: 'GLMR', ad: 'Moonbeam' },
    { q: 'MOVR', ad: 'Moonriver' },
    { q: 'ASTR', ad: 'Astar' },
    { q: 'ACA', ad: 'Acala' },
    { q: 'WAXP', ad: 'WAX' },
    { q: 'TLM', ad: 'Alien Worlds' },
    { q: 'ALICE', ad: 'MyNeighborAlice' },
    { q: 'CHR', ad: 'Chromia' },
    { q: 'GTC', ad: 'Gitcoin' },
    { q: 'RAD', ad: 'Radicle' },
    { q: 'MASK', ad: 'Mask Network' },
    { q: 'AUDIO', ad: 'Audius' },
    { q: 'DYDX', ad: 'dYdX' },
    { q: 'GMX', ad: 'GMX' },
    { q: 'MAGIC', ad: 'Magic' },
    { q: 'BLUR', ad: 'Blur' },
    { q: 'ID', ad: 'SPACE ID' },
    { q: 'ARKM', ad: 'Arkham' },
    { q: 'WLD', ad: 'Worldcoin' },
    { q: 'TIA', ad: 'Celestia' },
    { q: 'SEI', ad: 'Sei' },
    { q: 'JUP', ad: 'Jupiter' },
    { q: 'WIF', ad: 'dogwifhat' },
    { q: 'BONK', ad: 'Bonk' },
    { q: 'FLOKI', ad: 'FLOKI' },
    { q: 'NOT', ad: 'Notcoin' },
    { q: 'BOME', ad: 'BOOK OF MEME' },
    { q: 'ORDI', ad: 'ORDI' },
    { q: '1000SATS', ad: '1000SATS' },
    { q: 'POPCAT', ad: 'Popcat' },
    { q: 'MEW', ad: 'cat in a dogs world' },
    { q: 'PNUT', ad: 'Peanut the Squirrel' },
    { q: 'GOAT', ad: 'Goatseus Maximus' },
    { q: 'ACT', ad: 'Act I The AI Prophecy' },
    { q: 'TAO', ad: 'Bittensor' },
    { q: 'VIRTUAL', ad: 'Virtuals Protocol' },
    { q: 'NEIRO', ad: 'Neiro' },
    { q: 'DOGS', ad: 'Dogs' },
    { q: 'HMSTR', ad: 'Hamster Kombat' },
    { q: 'CATI', ad: 'Catizen' },
    { q: 'EIGEN', ad: 'EigenLayer' },
    { q: 'ETHFI', ad: 'ether.fi' },
    { q: 'PENDLE', ad: 'Pendle' },
    { q: 'ENA', ad: 'Ethena' },
    { q: 'JTO', ad: 'Jito' },
    { q: 'PYTH', ad: 'Pyth Network' },
    { q: 'JASMY', ad: 'JasmyCoin' },
    { q: 'RSR', ad: 'Reserve Rights' },
    { q: 'COTI', ad: 'COTI' },
    { q: 'IOST', ad: 'IOST' },
    { q: 'IOTX', ad: 'IoTeX' },
    { q: 'CKB', ad: 'Nervos Network' },
    { q: 'RUNE', ad: 'THORChain' },
    { q: 'OSMO', ad: 'Osmosis' },
    { q: 'STRK', ad: 'Starknet' },
    { q: 'ZK', ad: 'ZKsync' },
    { q: 'MANTA', ad: 'Manta Network' },
    { q: 'ALT', ad: 'Altlayer' },
    { q: 'PIXEL', ad: 'Pixels' },
    { q: 'PORTAL', ad: 'Portal' },
    { q: 'ACE', ad: 'Fusionist' },
    { q: 'NTRN', ad: 'Neutron' },
    { q: 'DYM', ad: 'Dymension' },
    { q: 'OMNI', ad: 'Omni Network' },
    { q: 'REZ', ad: 'Renzo' },
    { q: 'BB', ad: 'BounceBit' },
    { q: 'LISTA', ad: 'Lista DAO' },
    { q: 'ZRO', ad: 'LayerZero' },
    { q: 'IO', ad: 'io.net' },
    { q: 'AIXBT', ad: 'aixbt by Virtuals' },
    { q: 'AI', ad: 'Artificial Superintelligence Alliance' },
    { q: 'SAGA', ad: 'Saga' },
    { q: 'W', ad: 'Wormhole' },
    { q: 'ONG', ad: 'Ontology Gas' },
    { q: 'ONT', ad: 'Ontology' },
    { q: 'ICX', ad: 'ICON' },
    { q: 'LSK', ad: 'Lisk' },
    { q: 'ARK', ad: 'Ark' },
    { q: 'RVN', ad: 'Ravencoin' },
    { q: 'DGB', ad: 'DigiByte' },
    { q: 'SC', ad: 'Siacoin' },
    { q: 'DCR', ad: 'Decred' },
    { q: 'ZEN', ad: 'Horizen' },
    { q: 'STEEM', ad: 'Steem' },
    { q: 'HIVE', ad: 'Hive' },
    { q: 'ARDR', ad: 'Ardor' },
    { q: 'KMD', ad: 'Komodo' },
    { q: 'SYS', ad: 'Syscoin' },
    { q: 'XVG', ad: 'Verge' },
    { q: 'BTTC', ad: 'BitTorrent' },
    { q: 'WIN', ad: 'WINkLink' },
    { q: 'JST', ad: 'JUST' },
    { q: 'SUN', ad: 'Sun Token' },
    { q: 'PAXG', ad: 'PAX Gold' },
    { q: 'WBTC', ad: 'Wrapped Bitcoin' },
    { q: 'WBETH', ad: 'Wrapped Beacon ETH' },
    { q: 'STX', ad: 'Stacks' },
    { q: 'AR', ad: 'Arweave' },
    { q: 'ACH', ad: 'Alchemy Pay' },
    { q: 'SSV', ad: 'ssv.network' },
    { q: 'RPL', ad: 'Rocket Pool' },
    { q: 'LPT', ad: 'Livepeer' },
    { q: 'ILV', ad: 'Illuvium' },
    { q: 'CVX', ad: 'Convex Finance' },
    { q: 'SPELL', ad: 'Spell Token' },
    { q: 'GMT', ad: 'STEPN' },
    { q: 'HOOK', ad: 'Hooked Protocol' },
    { q: 'HFT', ad: 'Hashflow' },
    { q: 'EDU', ad: 'Open Campus' },
    { q: 'CYBER', ad: 'Cyber' },
    { q: 'MAV', ad: 'Maverick Protocol' },
    { q: 'BANANA', ad: 'Banana Gun' },
    { q: 'BIGTIME', ad: 'Big Time' },
    { q: 'ONDO', ad: 'Ondo' },
    { q: 'MORPHO', ad: 'Morpho' },
    { q: 'HYPE', ad: 'Hyperliquid' },
    { q: 'ASTER', ad: 'Aster' },
    { q: 'BERA', ad: 'Berachain' },
    { q: 'MOVE', ad: 'Movement' },
    { q: 'ME', ad: 'Magic Eden' },
    { q: 'TRUMP', ad: 'OFFICIAL TRUMP' },
    { q: 'WLFI', ad: 'World Liberty Financial' },
    { q: 'KAIA', ad: 'Kaia' },
    { q: 'AERO', ad: 'Aerodrome Finance' },
    { q: 'EUL', ad: 'Euler' },
    { q: 'GNS', ad: 'Gains Network' },
    { q: 'JOE', ad: 'JOE' },
    { q: 'RAY', ad: 'Raydium' },
    { q: 'ORCA', ad: 'Orca' }
  ];
  function pad2(n) {
    n = String(n);
    return n.length < 2 ? '0' + n : n;
  }

  function bugunStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function okuHafiza() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { tahminler: [], meta: { dogru: 0, yanlis: 0, bekle: 0 } };
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return { tahminler: [], meta: { dogru: 0, yanlis: 0, bekle: 0 } };
      if (!Array.isArray(o.tahminler)) o.tahminler = [];
      if (!o.meta) o.meta = { dogru: 0, yanlis: 0, bekle: 0 };
      return o;
    } catch (e) {
      return { tahminler: [], meta: { dogru: 0, yanlis: 0, bekle: 0 } };
    }
  }

  function yazHafiza(h) {
    try {
      localStorage.setItem(KEY, JSON.stringify(h));
    } catch (e) { /* quota */ }
  }

  function okuBugunCache() {
    try {
      var raw = localStorage.getItem(cacheKey('1h'));
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && o.tarih === bugunStr() && o.ajanSurum === CACHE_VERSION && o.zd === '1h') return o;
      return null;
    } catch (e) {
      return null;
    }
  }

  function yazBugunCache(kayit) {
    try {
      localStorage.setItem(cacheKey(kayit.zd || '1h'), JSON.stringify(kayit));
    } catch (e) { /* quota */ }
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function secimSade(s) {
    if (!s) return null;
    return {
      q: s.q || null,
      ad: s.ad || '—',
      sembol: s.sembol || '—',
      tur: s.tur || null,
      zd: s.zd || null,
      karar: s.karar || 'BEKLE',
      skor: typeof s.skor === 'number' ? s.skor : 0,
      uyum: s.uyum,
      genelKarar: s.genelKarar || null,
      teknikKarar: s.teknikKarar || null,
      hacimSkor: s.hacimSkor,
      hataPayi: s.hataPayi || null,
      ozet: s.ozet || '',
      tartisma: Array.isArray(s.tartisma) ? s.tartisma.slice(0, 12) : [],
      plan: s.plan || null,
      fiyat: s.fiyat,
      trend: s.trend || null,
      rsi: s.rsi,
      netYok: !!s.netYok,
      flow: s.flow || null,
      mtf: s.mtf || null,
      marketRegime: s.marketRegime || null,
      deepScan: s.deepScan || null,
      deepVeto: !!s.deepVeto,
      deepReasons: Array.isArray(s.deepReasons) ? s.deepReasons.slice(0, 8) : [],
      sourceTimestamps: s.sourceTimestamps || null,
      agentVersion: s.agentVersion || CACHE_VERSION
    };
  }

  /** BIST TahminAI ajanlarını yeniden kullan */
  function ajanlaraSor(s, kal, context) {
    if (window.TahminAI && typeof window.TahminAI.ajanlaraSor === 'function') {
      return window.TahminAI.ajanlaraSor(s, kal, context);
    }
    // Fallback (TahminAI yoksa basit skor)
    var sonuc = {
      genel: { karar: (s && s.karar) || 'BEKLE', uyum: (s && s.uyum) || 0 },
      teknik: null, hacim: null, denetci: null, nihai: null,
      tartisma: ['⚠️ TahminAI ajanları bulunamadı, sadece genel analiz kullanıldı.'],
      skor: 0, ozet: ''
    };
    if (!s || !Array.isArray(s.c) || s.c.length < 5) {
      sonuc.ozet = 'Yetersiz mum verisi.';
      return sonuc;
    }
    sonuc.skor = s.karar === 'AL' || s.karar === 'SAT' ? 40 + (s.uyum || 0) * 0.3 : 15;
    sonuc.ozet = 'Karar ' + (s.karar || 'BEKLE') + ' (skor ' + Math.round(sonuc.skor) + ')';
    return sonuc;
  }

  async function taraBir(item, zd) {
    if (typeof Veri === 'undefined' || typeof Veri.ara !== 'function') {
      throw new Error('Veri modülü yok');
    }
    if (typeof Analiz === 'undefined' || typeof Analiz.yap !== 'function') {
      throw new Error('Analiz modülü yok');
    }
    if (typeof Goruntu === 'undefined' || typeof Goruntu.trend !== 'function') {
      throw new Error('Goruntu modülü yok');
    }

    // Coin taraması yalnızca Binance USDT çiftini kullanır.
    // Genel sembol eşleştiricisi aynı kodu bir BIST hissesiyle karıştırabilir.
    var code = String(item.q || '').toUpperCase().replace(/USDT$/, '');
    if (!/^[A-Z0-9]{1,12}$/.test(code)) throw new Error('Geçersiz Binance coin sembolü');
    var symbol = code + 'USDT';
    var candles = await Veri.binance(symbol, zd);
    var v = {
      kaynak: 'b',
      sembol: symbol,
      ad: item.ad || code,
      tur: 'Kripto',
      zd: zd,
      mumlar: candles,
      cekim: new Date()
    };
    var aralikMs = zd === '15m' ? 15 * 60 * 1000 :
      zd === '4h' ? 4 * 60 * 60 * 1000 :
      zd === '1d' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    var kapanmisHam = typeof Veri.kapanmisMumlar === 'function'
      ? Veri.kapanmisMumlar(candles, zd)
      : candles.filter(function (m) {
          return m && Number.isFinite(Number(m.t)) &&
            (m.closeTime != null ? Number(m.closeTime) < Date.now() : Number(m.t) + aralikMs <= Date.now());
        });
    if (kapanmisHam.length < 20) throw new Error('Kapanmış mum sayısı yetersiz.');
    var sonKapali = kapanmisHam[kapanmisHam.length - 1];
    var kapanisZamani = sonKapali.closeTime != null
      ? Number(sonKapali.closeTime) : Number(sonKapali.t) + aralikMs - 1;
    if (!Number.isFinite(kapanisZamani) || kapanisZamani >= Date.now() ||
        Date.now() - kapanisZamani > 2 * aralikMs) {
      throw new Error('Binance kapanmış mum verisi eski; sinyal üretilmedi.');
    }
    var vKapanmis = Object.assign({}, v, { mumlar: kapanmisHam });
    var dn = Veri.donustur(vKapanmis, 80);
    if (!dn || !dn.m || dn.m.length < 5 || !dn.d.length) {
      throw new Error('Yeterli kapanmış mum yok');
    }
    var t = Goruntu.trend(dn.m);
    var s = Analiz.yap(dn.m, t);
    var panel = ajanlaraSor(s, dn.kal, {
      volume: dn.d.map(function (m) { return m.v; }),
      symbol: symbol,
      timeframe: zd
    });
    var karar = (panel.nihai && panel.nihai.son) || s.karar || 'BEKLE';
    var sonFiyat = (dn.d && dn.d.length) ? dn.d[dn.d.length - 1].c : null;
    var sonMum = dn.d.length ? dn.d[dn.d.length - 1] : null;
    var oncekiMum = dn.d.length > 1 ? dn.d[dn.d.length - 2] : null;
    var sonMumDegisim = sonMum && oncekiMum && oncekiMum.c
      ? ((sonMum.c / oncekiMum.c) - 1) * 100 : null;
    var signalAt = sonMum
      ? (sonMum.closeTime != null ? Number(sonMum.closeTime) + 1 : Number(sonMum.t) + aralikMs)
      : null;

    return {
      q: item.q,
      ad: v.ad || item.ad,
      sembol: v.sembol,
      tur: v.tur || 'Kripto',
      zd: zd,
      karar: karar,
      skor: panel.skor,
      uyum: s.uyum,
      genelKarar: s.karar,
      teknikKarar: panel.teknik ? panel.teknik.karar : null,
      hacimSkor: panel.hacim ? panel.hacim.skor : null,
      hacimKarar: panel.hacim && panel.hacim.var
        ? (panel.hacim.skor > 0 ? 'AL' : panel.hacim.skor < 0 ? 'SAT' : 'BEKLE') : 'BEKLE',
      hataPayi: panel.denetci ? panel.denetci.hata : null,
      denetciSorunSayisi: panel.denetci ? panel.denetci.sorunSayisi : null,
      ozet: panel.ozet,
      tartisma: panel.tartisma,
      plan: s.plan && isFinite(s.plan.rr) ? {
        yon: s.plan.yon,
        rr: s.plan.rr,
        stop: s.plan.stop,
        t1: s.plan.t1,
        t2: s.plan.t2
      } : null,
      fiyat: sonFiyat,
      signalAt: signalAt,
      stopFiyat: s.plan ? dn.kal.lo + s.plan.stop * (dn.kal.hi - dn.kal.lo) : null,
      hedefFiyat: s.plan ? dn.kal.lo + s.plan.t1 * (dn.kal.hi - dn.kal.lo) : null,
      rr: s.plan && isFinite(s.plan.rr) ? s.plan.rr : null,
      trend: t ? t.yon : null,
      rsi: s.rsi,
      sonMumDegisim: sonMumDegisim,
      _mumlar: dn.d.map(function (m) { return Object.assign({}, m); }),
      agentVersion: CACHE_VERSION
    };
  }

  function kisaOzet(r) {
    return {
      ad: r.ad,
      sembol: r.sembol,
      karar: r.karar,
      skor: r.skor,
      teknik: r.teknikKarar,
      hacim: r.hacimSkor,
      hacimKarar: r.hacimKarar,
      hata: r.hataPayi,
      denetciSorunSayisi: r.denetciSorunSayisi,
      signalAt: r.signalAt,
      fiyat: r.fiyat,
      stopFiyat: r.stopFiyat,
      hedefFiyat: r.hedefFiyat,
      rr: r.rr,
      zd: r.zd,
      genelKarar: r.genelKarar,
      teknikKarar: r.teknikKarar,
      hacimSkor: r.hacimSkor,
      trend: r.trend,
      rsi: r.rsi,
      sonMumDegisim: r.sonMumDegisim,
      flow: r.flow || null,
      mtf: r.mtf || null,
      marketRegime: r.marketRegime || null,
      deepScan: r.deepScan || null,
      deepVeto: !!r.deepVeto,
      deepReasons: Array.isArray(r.deepReasons) ? r.deepReasons.slice(0, 8) : [],
      sourceTimestamps: r.sourceTimestamps || null,
      agentVersion: r.agentVersion || CACHE_VERSION
    };
  }

  async function bugunUret(zd, onProgress) {
    // 216 coin için yalnızca 1 saatlik hızlı tarama; derin analiz ilk 20 adayda çalışır.
    zd = '1h';
    var adaylar = [];
    var hatalar = [];

    for (var i = 0; i < LISTE.length; i++) {
      var item = LISTE[i];
      if (typeof onProgress === 'function') onProgress(i + 1, LISTE.length, item.ad, 'Hızlı tarama');
      try {
        var r = await taraBir(item, zd);
        adaylar.push(r);
      } catch (e) {
        hatalar.push(item.ad + ': ' + (e && e.message ? e.message : String(e)));
      }
      await sleep(220);
    }

    if (window.KriptoAjanlari && typeof window.KriptoAjanlari.derinAnaliz === 'function' && adaylar.length) {
      var derinSonuc = await window.KriptoAjanlari.derinAnaliz(adaylar, onProgress);
      adaylar = derinSonuc.adaylar;
    }

    adaylar.sort(function (a, b) {
      var aNet = a.karar === 'BEKLE' ? -20 : 0;
      var bNet = b.karar === 'BEKLE' ? -20 : 0;
      return (b.skor + bNet) - (a.skor + aNet);
    });

    if (window.AjanPerformans && typeof window.AjanPerformans.kaydetTarama === 'function') {
      window.AjanPerformans.kaydetTarama(adaylar, {
        source: 'Coin tarama',
        market: 'Kripto',
        timeframe: zd,
        agentVersion: CACHE_VERSION
      });
    }

    var enIyi = adaylar.length ? adaylar[0] : null;

    if (enIyi && enIyi.skor < 35) {
      enIyi = {
        karar: 'BEKLE',
        skor: enIyi.skor,
        ad: '—',
        sembol: '—',
        ozet: 'Bugün listede yeterince güçlü ve ajanların uyumlu olduğu bir coin kurulumu bulunamadı. Temkinli kalın.',
        tartisma: enIyi.tartisma || [],
        netYok: true,
        zd: zd
      };
    }

    if (!enIyi) {
      enIyi = {
        karar: 'BEKLE',
        skor: 0,
        ad: '—',
        sembol: '—',
        ozet: 'Hiçbir coin taranamadı. İnternet veya veri kaynağını kontrol et.',
        tartisma: [],
        netYok: true,
        zd: zd
      };
    }

    var secim = secimSade(enIyi);

    var kayit = {
      tarih: bugunStr(),
      saat: new Date().toISOString(),
      zd: zd,
      secim: secim,
      adaylar: adaylar.map(kisaOzet),
      hatalar: hatalar,
      ajanSurum: CACHE_VERSION
    };

    var hafiza = okuHafiza();
    hafiza.tahminler = hafiza.tahminler.filter(function (t) { return t.tarih !== kayit.tarih; });
    hafiza.tahminler.unshift({
      tarih: kayit.tarih,
      sembol: secim.sembol,
      ad: secim.ad,
      karar: secim.karar,
      skor: secim.skor,
      ozet: secim.ozet,
      fiyat: secim.fiyat,
      zd: zd
    });
    if (hafiza.tahminler.length > 60) hafiza.tahminler = hafiza.tahminler.slice(0, 60);
    yazHafiza(hafiza);
    yazBugunCache(kayit);

    if (window.CoinTahminAI) {
      window.CoinTahminAI.sonDurum = kayit;
      window.CoinTahminAI.paylasilan = {
        bugun: kayit.tarih,
        secim: secim,
        mesaj: secim.ad + ' → ' + secim.karar + ' (skor ' + secim.skor + ')'
      };
    }

    return kayit;
  }

  /* ---------- UI ---------- */

  function renkKarar(k) {
    if (k === 'AL') return '#26a69a';
    if (k === 'SAT') return '#ef5350';
    return '#f0b429';
  }

  function kart(baslik, satirlar, border) {
    var d = document.createElement('div');
    d.className = 'kart';
    if (border) d.style.borderLeft = '4px solid ' + border;
    if (baslik) {
      var h = document.createElement('h3');
      h.textContent = baslik;
      h.style.cssText = 'font-size:16px;margin-bottom:8px';
      d.appendChild(h);
    }
    (satirlar || []).forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      p.style.cssText = 'font-size:14px;line-height:1.5;margin-bottom:6px;color:#c8d1da';
      d.appendChild(p);
    });
    return d;
  }

  function renderKayit(kayit, alan) {
    if (!alan) return;
    alan.innerHTML = '';
    var s = kayit && kayit.secim;
    if (!s) {
      alan.appendChild(kart('Sonuç', ['Tahmin üretilemedi.']));
      return;
    }

    var baslik = s.netYok ? 'Bugün net kurulum yok' : ((s.ad || '?') + ' — ' + (s.karar || '?'));

    var ana = document.createElement('div');
    ana.className = 'kart';
    ana.style.borderLeft = '6px solid ' + renkKarar(s.karar);
    var k = document.createElement('div');
    k.textContent = s.karar || 'BEKLE';
    k.style.cssText = 'font-size:36px;font-weight:800;color:' + renkKarar(s.karar);
    ana.appendChild(k);
    var u = document.createElement('div');
    u.textContent = baslik + (s.skor != null ? ' · skor ' + s.skor + '/100' : '');
    u.style.cssText = 'font-size:15px;margin:6px 0 10px;color:#e6edf3';
    ana.appendChild(u);
    if (s.sembol && s.sembol !== '—') {
      var meta = document.createElement('p');
      meta.textContent = s.sembol +
        (s.fiyat != null && isFinite(s.fiyat) ? ' · son ~ ' + s.fiyat : '') +
        (s.zd ? ' · ' + s.zd : '') +
        (kayit.tarih ? ' · ' + kayit.tarih : '');
      meta.style.cssText = 'font-size:13px;color:#8b98a5;margin-bottom:8px';
      ana.appendChild(meta);
    }
    if (s.ozet) {
      var oz = document.createElement('p');
      oz.textContent = s.ozet;
      oz.style.cssText = 'font-size:14px;line-height:1.5';
      ana.appendChild(oz);
    }
    alan.appendChild(ana);

    if (s.tartisma && s.tartisma.length) {
      alan.appendChild(kart('Ajanların görüşü', s.tartisma, '#2f81f7'));
    }

    if (s.flow || s.mtf || s.marketRegime || s.deepScan) {
      var deepLines = [];
      if (s.deepScan) deepLines.push('Derin tarama: ' + s.deepScan + (s.deepVeto ? ' · AL/SAT güvenlik filtresi uygulandı' : ''));
      if (s.flow) deepLines.push('Order Flow: ' + (s.flow.reason || 'Veri yok'));
      if (s.marketRegime) deepLines.push('BTC/ETH piyasa rejimi: ' + (s.marketRegime.reason || s.marketRegime.regime || 'Belirsiz'));
      if (s.mtf) {
        deepLines.push('Zaman dilimleri: 1G ' + (s.mtf.daily ? s.mtf.daily.trend : 'veri yok') +
          ' · 4S ' + (s.mtf.fourHour ? s.mtf.fourHour.trend : 'veri yok') +
          ' · 1S ' + (s.mtf.hourly ? s.mtf.hourly.trend : 'veri yok') +
          ' · 15D ' + (s.mtf.fifteenMinute ? s.mtf.fifteenMinute.trend : 'veri yok'));
      }
      (s.deepReasons || []).forEach(function (reason) { deepLines.push('Güvenlik: ' + reason); });
      alan.appendChild(kart('🧠 Kripto derin analiz', deepLines, '#8b5cf6'));
    }

    if (kayit.adaylar && kayit.adaylar.length) {
      var satirlar = kayit.adaylar.slice(0, 20).map(function (a, idx) {
        return (idx + 1) + '. ' + (a.ad || '?') + ' → ' + (a.karar || '?') +
          ' (skor ' + (a.skor != null ? a.skor : '?') +
          (a.teknik ? ', tek:' + a.teknik : '') +
          (a.hata ? ', hata:' + a.hata : '') + ')';
      });
      alan.appendChild(kart('Taranan coinler', satirlar));
    }

    if (kayit.hatalar && kayit.hatalar.length) {
      alan.appendChild(kart('Veri alınamayanlar', kayit.hatalar.slice(0, 8), '#f0b429'));
    }

    alan.appendChild(kart('Uyarı', [
      'Bu otomatik bir tarama sonucudur; yatırım tavsiyesi değildir.',
      'Kripto piyasası yüksek volatilite içerir. Kendi araştırmanızı yapın.'
    ]));
  }

  function renderGecmis(alan) {
    if (!alan) return;
    alan.innerHTML = '';
    var h = okuHafiza();
    if (!h.tahminler.length) {
      alan.appendChild(kart('Hafıza', ['Henüz kayıtlı günlük coin tahmini yok.']));
      return;
    }
    var satirlar = h.tahminler.slice(0, 14).map(function (t) {
      return (t.tarih || '?') + ' · ' + (t.ad || '?') + ' → ' + (t.karar || '?') +
        (t.skor != null ? ' (' + t.skor + ')' : '');
    });
    alan.appendChild(kart('Coin tahmin hafızası (son kayıtlar)', satirlar, '#8b98a5'));
  }

  function kurUI() {
    var sec = document.getElementById('gecmis');
    if (!sec) return;

    sec.innerHTML =
      '<h2>Coin Tahmin AI</h2>' +
      '<p class="alt">216 coin 1 saatlik hızlı taranır. En güçlü 20 aday 1G, 4S, 1S ve 15D zaman dilimleri, Order Flow ve BTC\/ETH piyasa rejimiyle derinlemesine incelenir. Hafıza bu cihazda saklanır.</p>' +
      '<button type="button" id="coin-tahmin-btn" class="buton">BUGÜNÜN COİN TAHMİNİNİ ÜRET</button>' +
      '<p id="coin-tahmin-durum" class="alt"></p>' +
      '<div id="coin-tahmin-alan"></div>' +
      '<div id="coin-tahmin-hafiza"></div>' +
      '<p class="kart" style="font-size:13px;color:#8b98a5">Not: 200 Binance coin taranır. Açık mumlar hesaplamaya alınmaz. AL/SAT sinyalleri (en fazla 40) ve ayrıca en güçlü BEKLE adayı performans karnesine kaydedilir.</p>';

    var btn = document.getElementById('coin-tahmin-btn');
    var durum = document.getElementById('coin-tahmin-durum');
    var alan = document.getElementById('coin-tahmin-alan');
    var hafizaEl = document.getElementById('coin-tahmin-hafiza');

    function gosterCache() {
      var c = okuBugunCache();
      if (c) {
        renderKayit(c, alan);
        if (durum) durum.textContent = 'Bugünün coin tahmini hafızadan yüklendi. Yenilemek için tekrar üret.';
      }
      renderGecmis(hafizaEl);
    }

    if (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        if (alan) alan.innerHTML = '';
        bugunUret('1h', function (i, n, ad, phase) {
          if (durum) durum.textContent = (phase || 'Taranıyor') + ' ' + i + '/' + n + ': ' + ad + '…';
        }).then(function (kayit) {
          if (durum) durum.textContent = 'Tamamlandı · ' + kayit.tarih;
          renderKayit(kayit, alan);
          renderGecmis(hafizaEl);
        }).catch(function (e) {
          if (durum) durum.textContent = 'Hata: ' + (e && e.message ? e.message : String(e));
        }).then(function () {
          btn.disabled = false;
        });
      });
    }

    var navBtn = document.querySelector('nav button[data-git="gecmis"]');
    if (navBtn) {
      navBtn.addEventListener('click', function () {
        setTimeout(gosterCache, 30);
      });
    }
    gosterCache();
  }

  function navGuncelle() {
    var b = document.querySelector('nav button[data-git="gecmis"]');
    if (!b) return;
    b.innerHTML = '<span>🪙</span>Coin Tahmin';
  }

  window.CoinTahminAI = {
    LISTE: LISTE,
    bugunUret: bugunUret,
    taraBir: taraBir,
    okuHafiza: okuHafiza,
    okuBugunCache: okuBugunCache,
    sonDurum: null,
    paylasilan: null
  };

  function baslat() {
    try {
      navGuncelle();
      kurUI();
    } catch (e) {
      try {
        var sec = document.getElementById('gecmis');
        if (sec) sec.innerHTML = '<h2>Coin Tahmin AI</h2><p class="kart">Arayüz hatası: ' + (e.message || e) + '</p>';
      } catch (e2) {}
    }
    try {
      var ay = document.getElementById('ayarlar');
      if (ay) {
        var pp = document.createElement('p');
        pp.className = 'kart';
        pp.textContent = 'Coin Tahmin AI: yüklendi (v1.1 — 200 Binance coin + ajan alışverişi)';
        ay.appendChild(pp);
      }
    } catch (e3) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }
})();