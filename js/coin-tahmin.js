/**
 * Coin Tahmin AI — kripto coin tarama ve ajanlı tahmin
 * BIST Tahmin AI ile aynı ajan altyapısını kullanır (Teknik, Hacim, Denetçi).
 * Hafıza: localStorage (ayrı anahtar).
 */
(function () {
  'use strict';

  var KEY = 'graphai_coin_tahmin_v1';
  var BUGUN_KEY = 'graphai_coin_tahmin_bugun';
  var CACHE_VERSION = 'crypto-intelligence-2.2.0';
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
      teknikVar: !!s.teknikVar,
      hacimVar: !!s.hacimVar,
      hacimKarar: s.hacimVar ? (s.hacimKarar || 'BEKLE') : null,
      denetciHata: s.denetciHata || null,
      denetciSorunSayisi: typeof s.denetciSorunSayisi === 'number' ? s.denetciSorunSayisi : null,
      denetciTeyit: s.denetciTeyit || null,
      nihaiDurum: s.nihaiDurum || null,
      nihaiNeden: s.nihaiNeden || null,
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
      deepScan: s.deepScan || (s.sembol && s.sembol !== '—' ? 'ilk 20 dışında' : null),
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
      teknikKarar: panel.teknik && panel.teknik.var ? panel.teknik.karar : null,
      teknikVar: !!(panel.teknik && panel.teknik.var),
      hacimSkor: panel.hacim ? panel.hacim.skor : null,
      hacimVar: !!(panel.hacim && panel.hacim.var),
      hacimKarar: panel.hacim && panel.hacim.var
        ? (panel.hacim.skor > 0 ? 'AL' : panel.hacim.skor < 0 ? 'SAT' : 'BEKLE') : null,
      denetciHata: panel.denetci ? panel.denetci.hata : null,
      denetciSorunSayisi: panel.denetci ? panel.denetci.sorunSayisi : null,
      denetciTeyit: panel.denetci ? (panel.denetci.teyit || panel.denetci.teknikTeyit || null) : null,
      nihaiDurum: panel.nihai ? panel.nihai.durum : null,
      nihaiNeden: panel.nihai ? panel.nihai.neden : null,
      hataPayi: panel.denetci ? panel.denetci.hata : null,
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
      hata: r.hataPayi,
      signalAt: r.signalAt,
      fiyat: r.fiyat,
      stopFiyat: r.stopFiyat,
      hedefFiyat: r.hedefFiyat,
      rr: r.rr,
      zd: r.zd,
      genelKarar: r.genelKarar,
      teknikKarar: r.teknikKarar,
      teknikVar: !!r.teknikVar,
      hacimVar: !!r.hacimVar,
      hacimKarar: r.hacimVar ? r.hacimKarar : null,
      denetciHata: r.denetciHata || null,
      denetciSorunSayisi: r.denetciSorunSayisi,
      denetciTeyit: r.denetciTeyit || null,
      nihaiDurum: r.nihaiDurum || null,
      nihaiNeden: r.nihaiNeden || null,
      hacimSkor: r.hacimSkor,
      trend: r.trend,
      rsi: r.rsi,
      sonMumDegisim: r.sonMumDegisim,
      flow: r.flow || null,
      mtf: r.mtf || null,
      marketRegime: r.marketRegime || null,
      deepScan: r.deepScan || 'ilk 20 dışında',
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

  function kararRozeti(karar) {
    var k = karar || 'VERİ YOK';
    var color = k === 'AL' ? '#26a69a' : k === 'SAT' ? '#ef5350' : k === 'BEKLE' ? '#f0b429' : '#8b98a5';
    var badge = document.createElement('span');
    badge.textContent = k;
    badge.style.cssText = 'display:inline-block;min-width:66px;text-align:center;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.2px;color:' + color + ';background:' + color + '20;border:1px solid ' + color + '70';
    return badge;
  }

  function botOylariniSay(s) {
    var decisions = [
      s && s.genelKarar,
      s && s.teknikVar ? s.teknikKarar : null,
      s && s.hacimVar ? s.hacimKarar : null
    ];
    var counts = { AL: 0, SAT: 0, BEKLE: 0, missing: 0 };
    decisions.forEach(function (decision) {
      if (decision === 'AL' || decision === 'SAT' || decision === 'BEKLE') counts[decision]++;
      else counts.missing++;
    });
    return counts;
  }

  function renderBotOylari(s) {
    var box = document.createElement('div');
    box.className = 'kart';
    box.style.borderLeft = '4px solid #2f81f7';
    var h = document.createElement('h3');
    h.textContent = 'Botların oyları';
    h.style.cssText = 'font-size:16px;margin-bottom:10px';
    box.appendChild(h);

    var rows = [
      { name: 'Genel analiz', decision: s.netYok ? null : s.genelKarar },
      { name: 'Teknik bot', decision: s.netYok || !s.teknikVar ? null : s.teknikKarar },
      { name: 'Hacim botu', decision: s.netYok || !s.hacimVar ? null : s.hacimKarar }
    ];
    rows.forEach(function (item) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #263442';
      var name = document.createElement('span');
      name.textContent = item.name;
      name.style.cssText = 'font-size:14px;color:#d7e0e8';
      row.appendChild(name);
      row.appendChild(kararRozeti(item.decision));
      box.appendChild(row);
    });

    if (s.netYok) {
      var noSignal = document.createElement('p');
      noSignal.textContent = 'Bugün yeterince güçlü bir coin adayı çıkmadı. Bu nedenle tek bir coin için AL/SAT sinyali vermiyoruz.';
      noSignal.style.cssText = 'font-size:13px;line-height:1.5;color:#c8d1da;margin-top:10px';
      box.appendChild(noSignal);
    } else {
      var counts = botOylariniSay(s);
      var summary = document.createElement('p');
      summary.textContent = 'Oy dağılımı: AL ' + counts.AL + ' · SAT ' + counts.SAT + ' · BEKLE ' + counts.BEKLE +
        (counts.missing ? ' · veri yok ' + counts.missing : '');
      summary.style.cssText = 'font-size:14px;font-weight:700;margin:10px 0;color:#e6edf3';
      box.appendChild(summary);
      if (s.nihaiNeden) {
        var reason = document.createElement('p');
        reason.textContent = 'Son kararın nedeni: ' + s.nihaiNeden;
        reason.style.cssText = 'font-size:13px;line-height:1.5;color:#c8d1da';
        box.appendChild(reason);
      }
      if (s.deepVeto && s.deepReasons && s.deepReasons.length) {
        var veto = document.createElement('p');
        veto.textContent = 'Güvenlik kontrolü AL/SAT sinyalini BEKLE’ye çevirdi: ' + s.deepReasons.join(' ');
        veto.style.cssText = 'font-size:13px;line-height:1.5;color:#f0b429;margin-top:8px';
        box.appendChild(veto);
      }
    }

    var reviewer = document.createElement('p');
    var risk = s.netYok ? 'Kontrol yapılacak güçlü aday yok' :
      (s.denetciHata ? 'Risk değerlendirmesi: ' + s.denetciHata.toLocaleLowerCase('tr-TR') :
        'Denetçi bilgisi bulunamadı');
    reviewer.textContent = 'Denetçi kontrolü: ' + risk +
      (typeof s.denetciSorunSayisi === 'number' ? ' · ' + s.denetciSorunSayisi + ' uyarı' : '');
    reviewer.style.cssText = 'font-size:12px;line-height:1.5;color:#9eacb9;margin-top:10px';
    box.appendChild(reviewer);

    var note = document.createElement('p');
    note.textContent = 'Denetçi oy kullanmaz; botların görüşlerini ve riskleri kontrol eder. Bu yüzden son karar, oyların çoğunluğundan farklı olabilir.';
    note.style.cssText = 'font-size:12px;line-height:1.5;color:#9eacb9;margin-top:6px';
    box.appendChild(note);
    return box;
  }

  function renderTaramaOzeti(kayit) {
    var adaylar = Array.isArray(kayit.adaylar) ? kayit.adaylar : [];
    var hatalar = Array.isArray(kayit.hatalar) ? kayit.hatalar : [];
    var counts = { AL: 0, SAT: 0, BEKLE: 0 };
    adaylar.forEach(function (item) {
      if (item && counts[item.karar] !== undefined) counts[item.karar]++;
    });
    var deepCount = adaylar.filter(function (item) { return item && item.deepScan === 'tamamlandı'; }).length;
    return kart('216 coin tarama özeti', [
      'Toplam ' + (adaylar.length + hatalar.length) + ' coin listelendi: ' + adaylar.length +
        ' coin verisi incelendi, ' + hatalar.length + ' coin için veri alınamadı.',
      'Son karar dağılımı: ' + counts.AL + ' AL · ' + counts.SAT + ' SAT · ' + counts.BEKLE + ' BEKLE.',
      deepCount + ' coin çoklu zaman dilimi ve Spot hacim verileriyle derin kontrolden geçti.',
      'Derin doğrulama almayan coinlerde AL/SAT sinyali gösterilmez; güvenlik için BEKLE yazılır.'
    ], '#2f81f7');
  }

  function oyOzetiYazi(item) {
    var counts = botOylariniSay(item);
    return 'Bot oyları: AL ' + counts.AL + ' · SAT ' + counts.SAT + ' · BEKLE ' + counts.BEKLE +
      (counts.missing ? ' · veri yok ' + counts.missing : '');
  }

  function renderCoinList(adaylar) {
    var details = document.createElement('details');
    details.className = 'kart';
    var summary = document.createElement('summary');
    summary.textContent = 'Öne çıkan 20 coin — karar listesini görmek için dokun';
    details.appendChild(summary);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:12px';
    (adaylar || []).slice(0, 20).forEach(function (item) {
      var row = document.createElement('div');
      row.style.cssText = 'padding:10px 0;border-bottom:1px solid #263442';
      var top = document.createElement('div');
      top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap';
      var name = document.createElement('strong');
      name.textContent = (item.ad || item.sembol || 'Coin') + (item.sembol ? ' · ' + item.sembol : '');
      name.style.cssText = 'font-size:14px;color:#e6edf3';
      top.appendChild(name);
      top.appendChild(kararRozeti(item.karar));
      row.appendChild(top);
      var votes = document.createElement('p');
      votes.textContent = oyOzetiYazi(item);
      votes.style.cssText = 'font-size:12px;color:#c8d1da;margin:6px 0 2px';
      row.appendChild(votes);
      var meta = document.createElement('p');
      var deepText = item.deepScan === 'tamamlandı' ? 'Derin kontrol tamamlandı' :
        item.deepScan === 'ilk 20 dışında' ? 'Derin kontrol yapılmadı (ilk 20 dışında)' :
          item.deepScan === 'veri yetersiz' ? 'Derin kontrol için veri yetersiz' : 'Derin kontrol bekleniyor';
      meta.textContent = deepText + (item.skor != null ? ' · analiz puanı ' + item.skor + '/100' : '');
      meta.style.cssText = 'font-size:11px;color:#8b98a5;margin:0';
      row.appendChild(meta);
      wrap.appendChild(row);
    });
    details.appendChild(wrap);
    return details;
  }

  function renderTeknikDetay(s) {
    var lines = [];
    if (s.ozet) lines.push('Analiz özeti: ' + s.ozet);
    if (s.nihaiDurum) lines.push('Denetçi durumu: ' + s.nihaiDurum);
    if (s.tartisma && s.tartisma.length) {
      s.tartisma.forEach(function (line) { lines.push(line); });
    }
    if (s.deepScan) lines.push('Derin tarama: ' + s.deepScan);
    if (s.flow) lines.push('Spot alım/satım hacmi: ' + (s.flow.reason || 'Veri yok'));
    if (s.marketRegime) lines.push('BTC/ETH piyasa durumu: ' + (s.marketRegime.reason || s.marketRegime.regime || 'Belirsiz'));
    if (s.mtf) {
      lines.push('Zaman dilimleri: Günlük ' + (s.mtf.daily ? s.mtf.daily.trend : 'veri yok') +
        ' · 4 saat ' + (s.mtf.fourHour ? s.mtf.fourHour.trend : 'veri yok') +
        ' · 1 saat ' + (s.mtf.hourly ? s.mtf.hourly.trend : 'veri yok') +
        ' · 15 dakika ' + (s.mtf.fifteenMinute ? s.mtf.fifteenMinute.trend : 'veri yok'));
    }
    (s.deepReasons || []).forEach(function (reason) { lines.push('Güvenlik kontrolü: ' + reason); });
    if (!lines.length) return null;
    var details = document.createElement('details');
    details.className = 'kart';
    var summary = document.createElement('summary');
    summary.textContent = 'Teknik ayrıntılar ve bot açıklamaları';
    details.appendChild(summary);
    var body = document.createElement('div');
    body.style.cssText = 'margin-top:10px';
    lines.forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      p.style.cssText = 'font-size:13px;line-height:1.5;color:#c8d1da;margin-bottom:7px';
      body.appendChild(p);
    });
    details.appendChild(body);
    return details;
  }

  function renderKayit(kayit, alan) {
    if (!alan) return;
    alan.innerHTML = '';
    var s = kayit && kayit.secim;
    if (!s) {
      alan.appendChild(kart('Sonuç', ['Tarama sonucu oluşturulamadı. Tekrar deneyin.']));
      return;
    }

    var ana = document.createElement('div');
    ana.className = 'kart';
    ana.style.borderLeft = '6px solid ' + renkKarar(s.karar);
    var heading = document.createElement('h3');
    heading.textContent = 'SİSTEMİN SON KARARI';
    heading.style.cssText = 'font-size:14px;letter-spacing:.4px;margin-bottom:10px;color:#c8d1da';
    ana.appendChild(heading);

    var decision = document.createElement('div');
    decision.textContent = s.karar || 'BEKLE';
    decision.style.cssText = 'font-size:36px;font-weight:850;line-height:1.1;color:' + renkKarar(s.karar);
    ana.appendChild(decision);

    var title = document.createElement('p');
    title.textContent = s.netYok ? 'Bugün güçlü ve doğrulanmış bir coin adayı bulunamadı.' :
      (s.ad || 'Coin') + (s.sembol ? ' · ' + s.sembol : '');
    title.style.cssText = 'font-size:16px;font-weight:700;margin:8px 0;color:#e6edf3';
    ana.appendChild(title);

    var meta = document.createElement('p');
    meta.textContent = (s.fiyat != null && isFinite(s.fiyat) ? 'Son fiyat: ' + Number(s.fiyat).toLocaleString('tr-TR', { maximumFractionDigits: 8 }) + ' · ' : '') +
      (s.zd ? 'Zaman dilimi: ' + s.zd + ' · ' : '') +
      (kayit.tarih ? 'Tarih: ' + kayit.tarih : '');
    meta.style.cssText = 'font-size:12px;color:#8b98a5;margin-bottom:10px';
    ana.appendChild(meta);

    var explanation = document.createElement('p');
    explanation.textContent = s.netYok || s.karar === 'BEKLE'
      ? 'BEKLE: Botlar yeterli teyitte birleşmedi. Şimdilik net bir işlem sinyali yok.'
      : s.karar === 'AL'
        ? 'AL: Botlar Spot piyasada alım yönünde yeterli teyit buldu. Bu bir garanti veya otomatik emir değildir.'
        : 'SAT: Spot piyasada elindeki coini satma veya azaltma yönünde sinyal. Açığa satış ya da kaldıraçlı işlem değildir.';
    explanation.style.cssText = 'font-size:14px;line-height:1.55;color:#e6edf3';
    ana.appendChild(explanation);

    if (s.skor != null && isFinite(s.skor)) {
      var score = document.createElement('p');
      score.textContent = 'Analiz puanı: ' + s.skor + '/100 · Kazanma olasılığı değildir.';
      score.style.cssText = 'font-size:12px;color:#9eacb9;margin-top:10px';
      ana.appendChild(score);
    }
    alan.appendChild(ana);
    alan.appendChild(renderBotOylari(s));
    alan.appendChild(renderTaramaOzeti(kayit));
    if (kayit.adaylar && kayit.adaylar.length) alan.appendChild(renderCoinList(kayit.adaylar));
    var technicalDetails = renderTeknikDetay(s);
    if (technicalDetails) alan.appendChild(technicalDetails);
    if (kayit.hatalar && kayit.hatalar.length) {
      alan.appendChild(kart('Veri alınamayan coinler', kayit.hatalar.slice(0, 8), '#f0b429'));
    }
    alan.appendChild(kart('Kararları nasıl okuyacaksın?', [
      'AL: Spot piyasada alım yönünde sinyal.',
      'SAT: Elindeki coini satma veya azaltma yönünde sinyal; açığa satış ve kaldıraç değildir.',
      'BEKLE: Botlar yeterli teyitte birleşmedi; net sinyal oluşmadı.'
    ]));
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
      '<p class="alt">216 coin Spot verileriyle taranır. En güçlü 20 aday ayrıca farklı zaman dilimleri, alım/satım hacmi ve BTC/ETH piyasa durumuyla kontrol edilir. Sonuçta botların AL/SAT/BEKLE oyları ve sistemin son kararı açıkça gösterilir.</p>' +
      '<button type="button" id="coin-tahmin-btn" class="buton">BUGÜNÜN COİN TARAMASINI BAŞLAT</button>' +
      '<p id="coin-tahmin-durum" class="alt"></p>' +
      '<div id="coin-tahmin-alan"></div>' +
      '<div id="coin-tahmin-hafiza"></div>' +
      '<p class="kart" style="font-size:13px;color:#8b98a5">AL: Spot alım sinyali. SAT: Elindeki coini satma/azaltma sinyali; açığa satış değildir. BEKLE: Yeterli teyit yok. Kaldıraçlı işlem kullanılmaz.</p>';

    var btn = document.getElementById('coin-tahmin-btn');
    var durum = document.getElementById('coin-tahmin-durum');
    var alan = document.getElementById('coin-tahmin-alan');
    var hafizaEl = document.getElementById('coin-tahmin-hafiza');

    function gosterCache() {
      var c = okuBugunCache();
      if (c) {
        renderKayit(c, alan);
        if (durum) durum.textContent = 'Bugünün coin taraması kayıtlı. Yenilemek için tekrar başlat.';
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
        pp.textContent = 'Coin Tahmin AI: yüklendi (v2.2 — 216 coin, anlaşılır bot kararları)';
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