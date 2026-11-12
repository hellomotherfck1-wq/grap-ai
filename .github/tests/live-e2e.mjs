import { chromium } from 'playwright';
import fs from 'node:fs';

const baseURL = process.env.BASE_URL || 'https://hellomotherfck1-wq.github.io/grap-ai/';
const report = {
  baseURL,
  startedAt: new Date().toISOString(),
  checks: [],
  pageErrors: [],
  consoleErrors: []
};
let browser;
let page;

function check(name, passed, details = '') {
  report.checks.push({ name, passed: Boolean(passed), details: String(details || '') });
  console.log((passed ? 'PASS' : 'FAIL') + ' · ' + name + (details ? ' · ' + details : ''));
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul'
  });
  page = await context.newPage();
  page.setDefaultTimeout(25000);

  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });

  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  check('Canlı site HTTP yanıtı', Boolean(response && response.ok()), response ? String(response.status()) : 'Yanıt alınamadı');

  await page.waitForFunction(() =>
    Boolean(window.TahminAI && window.BistArastirma && window.GrafikAI && window.AjanPerformans &&
      window.HaberAjani && window.KriptoAjanlari) &&
    typeof Veri !== 'undefined' && typeof Analiz !== 'undefined' && typeof Cizim !== 'undefined',
    null,
    { timeout: 45000 }
  );
  check('Uygulama modülleri yüklendi', true, 'Veri / Analiz / Grafik / BIST araştırma / Haber / Kripto ajanları');
  const sharedPoolModule = await page.evaluate(() => ({
    loaded: !!window.GrapAISharedResults,
    save: typeof window.GrapAISharedResults?.kaydet,
    adminRead: typeof window.GrapAISharedResults?.adminRecords,
    patch: typeof window.GrapAISharedResults?.patchMany
  }));
  check('Ortak sonuç modülü yüklendi', sharedPoolModule.loaded &&
    sharedPoolModule.save === 'function' && sharedPoolModule.adminRead === 'function' &&
    sharedPoolModule.patch === 'function', JSON.stringify(sharedPoolModule));
  const spotOnlyAgents = await page.evaluate(() => ({
    orderFlow: typeof window.KriptoAjanlari.orderFlow,
    futuresAgent: typeof window.KriptoAjanlari.futuresOku
  }));
  check('Kripto ajanları Spot odaklı; Futures ajanı yüklenmiyor',
    spotOnlyAgents.orderFlow === 'function' && spotOnlyAgents.futuresAgent === 'undefined',
    JSON.stringify(spotOnlyAgents));
  const newsRules = await page.evaluate(() => ({
    positive: window.HaberAjani.siniflandir({ title: 'Şirket yeni sözleşme imzaladı', summary: '' }).impact,
    negative: window.HaberAjani.siniflandir({ title: 'Şirket zarar açıkladı', summary: '' }).impact
  }));
  check('Haber Ajanı olumlu ve olumsuz başlıkları ayırıyor',
    newsRules.positive === 'Olumlu' && newsRules.negative === 'Olumsuz', JSON.stringify(newsRules));

  const decisionRules = await page.evaluate(() => {
    const A = window.Ajan;
    const lowConsensus = A.nihai(
      { karar: 'AL', plan: { rr: 2 } },
      { var: true, skor: 1 },
      { var: true, karar: 'BEKLE', guven: 'yüksek' },
      { hata: 'Düşük' }
    );
    const confirmed = A.nihai(
      { karar: 'AL', plan: { rr: 2 } },
      { var: true, skor: 2 },
      { var: true, karar: 'AL', guven: 'yüksek' },
      { hata: 'Düşük' }
    );
    const noVolume = A.nihai(
      { karar: 'AL', plan: { rr: 2 } },
      { var: false },
      { var: true, karar: 'AL', guven: 'yüksek' },
      { hata: 'Düşük' }
    );
    const weakRR = A.nihai(
      { karar: 'AL', plan: { rr: 1.1 } },
      { var: true, skor: 2 },
      { var: true, karar: 'AL', guven: 'yüksek' },
      { hata: 'Düşük' }
    );
    return { lowConsensus: lowConsensus.son, confirmed: confirmed.son, noVolume: noVolume.son, weakRR: weakRR.son };
  });
  check('Tek ajan ve hacim tek başına AL üretemiyor', decisionRules.lowConsensus === 'BEKLE', JSON.stringify(decisionRules));
  check('Ajanlar, hacim ve risk/kazanç aynı yöndeyse karar veriyor', decisionRules.confirmed === 'AL', JSON.stringify(decisionRules));
  check('Hacim verisi yoksa nihai karar BEKLE', decisionRules.noVolume === 'BEKLE', JSON.stringify(decisionRules));
  check('Risk/kazanç 1:1,5 altındaysa BEKLE', decisionRules.weakRR === 'BEKLE', JSON.stringify(decisionRules));

  await page.locator('nav button[data-git="sonuc"]').click();
  await page.locator('#ajan-performans-guncelle').waitFor({ state: 'attached', timeout: 15000 });
  await page.setViewportSize({ width: 390, height: 844 });
  const performanceUI = await page.evaluate(() => ({
    panel: !!document.querySelector('#ajan-performans-panel .ajan-performans'),
    csv: !!document.getElementById('ajan-performans-csv'),
    costInput: document.getElementById('ajan-performans-maliyet')?.value || null,
    panelWidth: Math.round(document.getElementById('ajan-performans-panel').getBoundingClientRect().width),
    panelScrollWidth: document.getElementById('ajan-performans-panel').scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  check('Ajan performans paneli, CSV ve maliyet ayarı görünür',
    performanceUI.panel && performanceUI.csv && performanceUI.costInput === '0.20',
    JSON.stringify(performanceUI));
  check('Ajan performans paneli mobil ekrana sığıyor',
    performanceUI.panelWidth > 0 && performanceUI.panelWidth <= performanceUI.viewport + 1 &&
    performanceUI.panelScrollWidth <= performanceUI.viewport + 1, JSON.stringify(performanceUI));
  await page.setViewportSize({ width: 1440, height: 900 });
  const performanceChecks = await page.evaluate(async () => {
    const P = window.AjanPerformans;
    const signal = {
      symbol: 'E2EPERFUSDT',
      name: 'Performans test coin',
      timeframe: '1h',
      signalAt: Date.now() - 12 * 60 * 60 * 1000,
      price: 100,
      stop: 95,
      target: 110,
      decision: 'AL',
      generalDecision: 'AL',
      technicalDecision: 'AL',
      volumeDecision: 'AL',
      source: 'E2E test'
    };
    const id = P.kaydet(signal);
    P.kaydet(signal);
    const scanCount = P.kaydetTarama([{
      sembol: 'E2ESCANUSDT', ad: 'Tarama test coin', zd: '1h',
      signalAt: Date.now() - 12 * 60 * 60 * 1000, fiyat: 50,
      karar: 'AL', genelKarar: 'AL', teknikKarar: 'AL',
      hacimKarar: 'AL', hacimSkor: 2, hataPayi: 'Düşük', denetciSorunSayisi: 2,
      skor: 80, stopFiyat: 45, hedefFiyat: 60, rr: 2
    }, {
      sembol: 'E2EWAITUSDT', ad: 'Bekle test coin', zd: '1h',
      signalAt: Date.now() - 12 * 60 * 60 * 1000, fiyat: 25,
      karar: 'BEKLE', genelKarar: 'BEKLE', teknikKarar: 'BEKLE',
      hacimKarar: 'BEKLE', hacimSkor: 0, hataPayi: 'Yüksek',
      denetciSorunSayisi: 4, skor: 20
    }], { source: 'E2E tarama', market: 'Kripto', timeframe: '1h' });
    await new Promise(resolve => setTimeout(resolve, 120));
    await P.guncelleKarar(id, 'BEKLE', { fundamentalStatus: 'available', fkVeto: true });
    const all = await P.listele();
    const stored = all.filter(item => item.id === id);
    const scanStored = all.some(item => item.symbol === 'E2ESCANUSDT' &&
      item.source === 'E2E tarama' && item.decision === 'AL' &&
      item.auditorError === 'Düşük' && item.auditorWarningCount === 2);
    const waitStored = all.some(item => item.symbol === 'E2EWAITUSDT' &&
      item.decision === 'BEKLE' && item.auditorError === 'Yüksek');
    const fkUpdated = stored.length === 1 && stored[0].decision === 'BEKLE' &&
      stored[0].fundamentalStatus === 'available' && stored[0].fkVeto === true;
    const record = {
      decision: 'AL', signalAt: 1000, price: 100, stop: 95, target: 110,
      timeframe: '1h', horizon: 2, costPct: 0.2
    };
    const bars = [
      { t: 1000, o: 100, h: 112, l: 96, c: 110 },
      { t: 3601000, o: 110, h: 112, l: 109, c: 111 }
    ];
    const target = P.sonucHesapla(record, bars);
    const stop = P.sonucHesapla(record, [
      { t: 1000, o: 100, h: 112, l: 94, c: 108 },
      { t: 3601000, o: 108, h: 109, l: 107, c: 108 }
    ]);
    const wait = P.sonucHesapla({
      decision: 'BEKLE', signalAt: 1000, price: 100,
      timeframe: '1h', horizon: 2, costPct: 0.2
    }, [
      { t: 1000, o: 100, h: 102, l: 99, c: 101 },
      { t: 3601000, o: 101, h: 102, l: 100, c: 101.5 }
    ]);
    const satRecord = {
      decision: 'SAT', signalAt: 1000, price: 100,
      timeframe: '1h', horizon: 2, costPct: 0.2
    };
    const satDown = P.sonucHesapla(satRecord, [
      { t: 1000, o: 100, h: 101, l: 94, c: 95 },
      { t: 3601000, o: 95, h: 96, l: 89, c: 90 }
    ]);
    const satUp = P.sonucHesapla(satRecord, [
      { t: 1000, o: 100, h: 106, l: 99, c: 105 },
      { t: 3601000, o: 105, h: 111, l: 104, c: 110 }
    ]);
    const fullScanAt = Date.now() - 12 * 60 * 60 * 1000;
    const fullCandidates = Array.from({ length: 216 }, (_, i) => ({
      sembol: 'E2EALL' + i + 'USDT',
      ad: 'Tam tarama test ' + i,
      zd: '1h',
      signalAt: fullScanAt,
      fiyat: 10 + i,
      karar: 'BEKLE',
      genelKarar: i % 2 ? 'AL' : 'SAT',
      teknikKarar: i % 3 ? 'SAT' : 'AL',
      hacimVar: i !== 2,
      hacimKarar: i === 2 ? null : i % 2 ? 'AL' : 'BEKLE',
      hacimSkor: i === 2 ? 0 : i % 2 ? 2 : 0,
      volumeModelVersion: i !== 2 ? 'volume-heuristic-v1' : null,
      flow: { available: true, decision: 'AL', score: 2 },
      mtf: { score: 1 },
      marketRegime: { regime: 'bull' },
      deepScan: i < 20 ? 'tamamlandı' : 'ilk 20 dışında',
      deepVeto: i === 0,
      deepReasons: i === 0 ? ['Denetçi riski'] : [],
      nihaiNeden: i === 0 ? 'Test vetosu' : null,
      hataPayi: 'Düşük',
      denetciSorunSayisi: 1,
      skor: 75
    }));
    const fullScanCount = P.kaydetTarama(fullCandidates, {
      source: 'E2E tam tarama', market: 'Kripto', timeframe: '1h'
    });
    let fullScanRecords = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      const current = await P.listele();
      fullScanRecords = current.filter(item => item.source === 'E2E tam tarama');
      if (fullScanRecords.length === 216) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const firstFullRecord = fullScanRecords.find(item => item.symbol === 'E2EALL0USDT');
    const noVolumeRecord = fullScanRecords.find(item => item.symbol === 'E2EALL2USDT');
    return {
      storedOnce: stored.length === 1,
      rawCandlesNotStored: stored.length === 1 && !Array.isArray(stored[0].mumlar),
      agentVersionsSaved: stored.length === 1 &&
        stored[0].generalAgentVersion === window.Ajan.surumler.general &&
        stored[0].technicalAgentVersion === window.Ajan.surumler.technical &&
        stored[0].committeeVersion === window.Ajan.surumler.committee,
      scanCount: scanCount,
      scanStored: scanStored,
      waitStored: waitStored,
      fkUpdated: fkUpdated,
      retentionDays: P.ayarlar.saklamaGun,
      defaultCostPct: P.maliyetOku(),
      targetAtNextOpen: target.trade && target.trade.status === 'completed' &&
        target.trade.entry === 100 && target.trade.exit === 110 && target.trade.outcome === 'win',
      stopWinsSameCandleConflict: stop.trade && stop.trade.exit === 95 &&
        stop.trade.reason === 'Stop' && stop.trade.outcome === 'loss',
      waitSeparateFromWinRate: wait.trade === null && wait.spotSale === null && wait.direction &&
        wait.direction.classification === 'up' && wait.direction.forwardPct > 0,
      satNeverShorts: satDown.trade === null && satUp.trade === null,
      satSaleBeatsHoldingAfterDrop: satDown.spotSale && satDown.spotSale.outcome === 'sell-better' &&
        satDown.spotSale.saleAdvantagePct > 0 && satDown.direction.classification === 'down',
      holdingBeatsSaleAfterRise: satUp.spotSale && satUp.spotSale.outcome === 'hold-better' &&
        satUp.spotSale.saleAdvantagePct < 0 && satUp.direction.classification === 'up',
      fullScanCount: fullScanCount,
      fullScanStored: fullScanRecords.length,
      allVotesSaved: !!firstFullRecord && firstFullRecord.generalDecision === 'SAT' &&
        firstFullRecord.technicalDecision === 'AL' && firstFullRecord.volumeDecision === 'BEKLE' &&
        firstFullRecord.volumeAvailable === true && firstFullRecord.volumeModelVersion === 'volume-heuristic-v1' &&
        firstFullRecord.flowDecision === 'AL',
      noVolumeSaved: !!noVolumeRecord && noVolumeRecord.volumeAvailable === false &&
        noVolumeRecord.volumeDecision === null && noVolumeRecord.volumeScore === null,
      deepScanMetadataSaved: !!firstFullRecord && firstFullRecord.deepScan === 'tamamlandı' &&
        firstFullRecord.deepVeto === true && firstFullRecord.deepReasons[0] === 'Denetçi riski',
      deepScanBoundarySaved: fullScanRecords.filter(item => item.deepScan === 'tamamlandı').length === 20 &&
        fullScanRecords.filter(item => item.deepScan === 'ilk 20 dışında').length === 196
    };
  });
  check('Performans hafızası sinyalleri tekilleştiriyor, taramaları kaydediyor ve 365 gün tutuyor',
    performanceChecks.storedOnce && performanceChecks.rawCandlesNotStored &&
    performanceChecks.scanCount === 2 && performanceChecks.scanStored &&
    performanceChecks.waitStored && performanceChecks.fkUpdated &&
    performanceChecks.retentionDays === 365 &&
    performanceChecks.defaultCostPct === 0.20,
    JSON.stringify(performanceChecks));
  check('Her ajan için ayrı sürüm bilgisi kaydediliyor',
    performanceChecks.agentVersionsSaved, JSON.stringify(performanceChecks));
  check('Canlı sinyal değerlendirmesi sonraki mum açılışını kullanıyor',
    performanceChecks.targetAtNextOpen, JSON.stringify(performanceChecks));
  check('Performans testinde aynı mum stop/hedef çakışmasında stop öncelikli',
    performanceChecks.stopWinsSameCandleConflict, JSON.stringify(performanceChecks));
  check('BEKLE sinyali işlem kazanma oranından ayrı değerlendiriliyor',
    performanceChecks.waitSeparateFromWinRate, JSON.stringify(performanceChecks));
  check('216 coinlik taramanın tamamı performans hafızasına kaydediliyor',
    performanceChecks.fullScanCount === 216 && performanceChecks.fullScanStored === 216,
    JSON.stringify(performanceChecks));
  check('216 coin kaydında genel, teknik, hacim ve Order Flow oyları saklanıyor',
    performanceChecks.allVotesSaved, JSON.stringify(performanceChecks));
  check('Hacim verisi olmayan coine sahte BEKLE oyu yazılmıyor',
    performanceChecks.noVolumeSaved, JSON.stringify(performanceChecks));
  const agentBreakdownChecks = await page.evaluate(() => {
    const P = window.AjanPerformans;
    const base = {
      market: 'Kripto', timeframe: '1h', directionStatus: 'completed',
      costPct: 0.2, generalDecision: 'AL', technicalDecision: 'SAT',
      volumeDecision: 'AL', volumeAvailable: true, decision: 'AL',
      generalAgentVersion: 'general-v1', technicalAgentVersion: 'technical-v1',
      volumeModelVersion: 'volume-v1', committeeVersion: 'committee-v1'
    };
    const rows = [
      Object.assign({}, base, {
        symbol: 'E2EOVERLAPUSDT', signalAt: 1000, forwardPct: 1,
        directionResult: { exitAt: 3601000 }
      }),
      Object.assign({}, base, {
        symbol: 'E2EOVERLAPUSDT', signalAt: 1801000, forwardPct: -1,
        generalAgentVersion: 'general-v2',
        directionResult: { exitAt: 5401000 }
      }),
      Object.assign({}, base, {
        symbol: 'E2EOVERLAPUSDT', signalAt: 7201000, forwardPct: -1,
        generalDecision: 'SAT', directionResult: { exitAt: 10801000 }
      }),
      Object.assign({}, base, {
        symbol: 'E2EVERSIONUSDT', timeframe: '4h', signalAt: 1000,
        forwardPct: 1, generalAgentVersion: 'general-v2',
        directionResult: { exitAt: 14401000 }
      }),
      Object.assign({}, base, {
        symbol: 'E2EBIST.IS', market: 'BIST', timeframe: '1d', signalAt: 1000,
        forwardPct: -1, generalDecision: 'SAT',
        generalAgentVersion: 'general-bist-v1',
        directionResult: { exitAt: 86401000 }
      }),
      Object.assign({}, base, {
        symbol: 'E2EUNKNOWNUSDT', signalAt: 1000, forwardPct: 1,
        directionResult: null
      }),
      Object.assign({}, base, {
        symbol: 'E2EWAITUSDT', signalAt: 1000, generalDecision: 'BEKLE',
        forwardPct: 1, directionResult: { exitAt: 36001000 }
      })
    ];
    const stats = P.ajanIstatistik(rows, 'generalDecision');
    const groups = P.ajanKirilimi(rows);
    return {
      rawCount: stats.rawCount,
      independentCount: stats.count,
      overlapExcluded: stats.overlapExcluded,
      unknownHorizon: stats.unknownHorizon,
      separateMarketAndTimeframe: groups.some(row =>
        row.agentKey === 'generalDecision' && row.market === 'BIST' && row.timeframe === '1d'),
      separateAgentVersions: groups.some(row =>
        row.agentKey === 'generalDecision' && row.version === 'general-v1') &&
        groups.some(row => row.agentKey === 'generalDecision' && row.version === 'general-v2'),
      waitVotesShownSeparately: groups.some(row =>
        row.agentKey === 'generalDecision' && row.votes.BEKLE === 1),
      crossVersionOverlapExcluded: groups.some(row =>
        row.agentKey === 'generalDecision' && row.market === 'Kripto' &&
        row.timeframe === '1h' && row.version === 'general-v2' &&
        row.stats.count === 0 && row.stats.overlapExcluded === 1)
    };
  });
  check('Çakışan 10 mumluk sinyal pencereleri bağımsız örnek sayılmıyor',
    agentBreakdownChecks.rawCount === 6 && agentBreakdownChecks.independentCount === 4 &&
    agentBreakdownChecks.overlapExcluded === 1 && agentBreakdownChecks.unknownHorizon === 1,
    JSON.stringify(agentBreakdownChecks));
  check('Ajan performansı piyasa, periyot ve sürüme göre ayrılıyor',
    agentBreakdownChecks.separateMarketAndTimeframe && agentBreakdownChecks.separateAgentVersions,
    JSON.stringify(agentBreakdownChecks));
  check('BEKLE oyları yön isabetinden ayrı gösteriliyor',
    agentBreakdownChecks.waitVotesShownSeparately && agentBreakdownChecks.crossVersionOverlapExcluded,
    JSON.stringify(agentBreakdownChecks));

  const volumeBreakdownChecks = await page.evaluate(() => {
    const groups = window.AjanPerformans.hacimKirilimi([
      { symbol: 'BTCUSDT', market: 'Kripto', timeframe: '1h', signalAt: 1000,
        volumeDecision: 'AL', volumeAvailable: true, volumeModelVersion: 'volume-heuristic-v1',
        directionStatus: 'completed', forwardPct: 1, costPct: 0.2, directionResult: { exitAt: 3601000 } },
      { symbol: 'ETHUSDT', market: 'Kripto', timeframe: '1h', signalAt: 1000,
        volumeDecision: 'SAT', volumeAvailable: true, volumeModelVersion: 'volume-heuristic-v1',
        directionStatus: 'completed', forwardPct: -1, costPct: 0.2, directionResult: { exitAt: 3601000 } },
      { symbol: 'THYAO.IS', market: 'BIST', timeframe: '1d', signalAt: 1000,
        volumeDecision: 'AL', volumeAvailable: true, volumeModelVersion: 'legacy-test',
        directionStatus: 'completed', forwardPct: -1, costPct: 0.2, directionResult: { exitAt: 86401000 } },
      { symbol: 'SOLUSDT', market: 'Kripto', timeframe: '1h', signalAt: 1000,
        volumeDecision: 'AL', volumeAvailable: false, volumeModelVersion: 'volume-heuristic-v1',
        directionStatus: 'completed', forwardPct: 1, costPct: 0.2, directionResult: { exitAt: 3601000 } },
      { symbol: 'ADAUSDT', market: 'Kripto', timeframe: '1h', signalAt: 1000,
        volumeDecision: 'BEKLE', volumeAvailable: true, volumeModelVersion: 'volume-heuristic-v1',
        directionStatus: 'completed', forwardPct: -1, costPct: 0.2, directionResult: { exitAt: 3601000 } }
    ]);
    return groups.map(group => ({
      market: group.market, timeframe: group.timeframe, version: group.version,
      count: group.stats.count, rawCount: group.stats.rawCount, correct: group.stats.correct,
      wrong: group.stats.wrong, flat: group.stats.flat
    }));
  });
  check('Hacim performansı piyasa, periyot ve model sürümüne göre ayrılıyor',
    volumeBreakdownChecks.length === 2 &&
      volumeBreakdownChecks.some(x => x.market === 'Kripto' && x.timeframe === '1h' &&
        x.count === 2 && x.correct === 2 && x.wrong === 0) &&
      volumeBreakdownChecks.some(x => x.market === 'BIST' && x.timeframe === '1d' &&
        x.count === 1 && x.correct === 0 && x.wrong === 1),
    JSON.stringify(volumeBreakdownChecks));
  check('İlk 20 derin tarama ve 196 hızlı tarama ayrımı kaydediliyor',
    performanceChecks.deepScanMetadataSaved && performanceChecks.deepScanBoundarySaved,
    JSON.stringify(performanceChecks));
  check('Spot SAT short açmıyor; düşüşte erken satış tutmaya göre avantajlı',
    performanceChecks.satNeverShorts && performanceChecks.satSaleBeatsHoldingAfterDrop,
    JSON.stringify(performanceChecks));
  check('Yükselişte SAT yerine tutmanın daha iyi olduğu ölçülüyor',
    performanceChecks.holdingBeatsSaleAfterRise, JSON.stringify(performanceChecks));


  const candleAlignment = await page.evaluate(() => {
    const rows = Array.from({ length: 40 }, (_, i) => {
      const mid = 100 + i * 0.25 + Math.sin(i / 3) * 1.5;
      const y = value => 1000 - value * 5;
      const open = mid - 0.2, close = mid + 0.2;
      return { renk: 1, ust: y(mid + 0.8), alt: y(mid - 0.8), ga: y(open), gu: y(close) };
    });
    const result = Analiz.yap(rows, { yon: 'Yükseliş', guc: 70 }, { excludeLast: true });
    return { all: result.c.length, used: result.analysisC.length };
  });
  check('Açık mum grafikte kalırken analizden çıkarılıyor', candleAlignment.all === 40 && candleAlignment.used === 39, JSON.stringify(candleAlignment));

  const fkAgentLoaded = await page.evaluate(() => Boolean(window.Ajan && window.Ajan.fk && typeof window.Ajan.fk.degerlendir === 'function'));
  check('F/K ajanı modülü yüklendi', fkAgentLoaded, 'F/K değerleme ve karar denetimi hazır');
  const fkRules = await page.evaluate(() => {
    const fk = window.Ajan.fk;
    const high = fk.degerlendir({
      pe: 45, peType: 'Son 12 ay F/K', trailingPE: 45, forwardPE: null,
      trailingEps: 2, earningsGrowth: -0.15, roe: 0.03, profitMargins: -0.02,
      debtToEquity: 250, sector: 'Industrials', industry: 'Airlines'
    }, { karar: 'AL' }, { kartlar: [{ baslik: '⚖️ Nihai Karar (Denetçi): AL' }] }, 'THYAO.IS');
    const cheapSell = fk.degerlendir({
      pe: 5, peType: 'Son 12 ay F/K', trailingPE: 5, forwardPE: null,
      trailingEps: 1, earningsGrowth: 0.10, roe: 0.15, profitMargins: 0.12,
      debtToEquity: 80, sector: 'Industrials'
    }, { karar: 'SAT' }, { kartlar: [{ baslik: '⚖️ Nihai Karar (Denetçi): SAT' }] }, 'THYAO.IS');
    const missing = fk.degerlendir(null, { karar: 'AL' }, { kartlar: [{ baslik: '⚖️ Nihai Karar (Denetçi): AL' }] }, 'THYAO.IS');
    return { high: high.son, cheapSell: cheapSell.son, missing: missing.son };
  });
  check('Yüksek F/K ve zayıf kârlılık AL kararını BEKLE yapıyor', fkRules.high === 'BEKLE', JSON.stringify(fkRules));
  check('Düşük F/K teknik SAT kararını tek başına bozmuyor', fkRules.cheapSell === 'SAT', JSON.stringify(fkRules));
  check('F/K verisi yoksa sayı uydurulmadan teknik karar korunuyor', fkRules.missing === 'AL', JSON.stringify(fkRules));

  await page.waitForSelector('#bist-arastirma-kutusu', { state: 'attached', timeout: 30000 });
  const optionCount = await page.locator('#bist-arastirma-sembol option').count();
  check('BIST araştırma paneli ve sembol listesi', optionCount === 100, optionCount + ' hisse seçeneği');

  await page.locator('nav button[data-git="strateji"]').click();
  await page.waitForSelector('#bist-arastirma-kutusu', { state: 'visible', timeout: 15000 });
  const selectedValue = await page.locator('#bist-arastirma-sembol').evaluate(select => {
    const found = Array.from(select.options).find(option => option.value === 'THYAO');
    return found ? found.value : (select.options[0] ? select.options[0].value : '');
  });
  if (selectedValue) await page.locator('#bist-arastirma-sembol').selectOption(selectedValue);
  await page.locator('#bist-arastirma-kutusu button').click();

  await page.waitForFunction(() => {
    const status = document.querySelector('#bist-arastirma-kutusu .durum')?.textContent || '';
    return status.includes('Araştırma tamamlandı') || status.includes('Araştırma tamamlanamadı');
  }, null, { timeout: 150000 });

  const researchStatus = await page.locator('#bist-arastirma-kutusu .durum').innerText();
  const researchText = await page.locator('#bist-arastirma-sonuc').innerText();
  check('BIST araştırma akışı tamamlandı', researchStatus.includes('Araştırma tamamlandı'), researchStatus);
  check('Araştırma raporu ekrana çizildi', researchText.includes('Araştırma Ajanı') && researchText.includes('Son fiyat'), researchText.slice(0, 500));
  check('Araştırma raporunda fiyat verisi var', /Son fiyat:.*\d/.test(researchText), researchText.split('\n').find(line => line.includes('Son fiyat')) || 'Fiyat satırı bulunamadı');

  await page.locator('nav button[data-git="yukle"]').click();
  const bistChartTimeframes = await page.locator('#ara-bist-zd option').evaluateAll(options => options.map(option => option.value));
  check('Ara ekranında BIST 100 için yalnızca günlük zaman dilimi var',
    bistChartTimeframes.length === 1 && bistChartTimeframes[0] === '1d',
    JSON.stringify(bistChartTimeframes));
  const cryptoChartTimeframes = await page.locator('#ara-kripto-zd option').evaluateAll(options => options.map(option => option.value));
  check('Ara ekranında kripto için 15m, 1h, 4h ve 1d seçenekleri var',
    JSON.stringify(cryptoChartTimeframes) === JSON.stringify(['15m', '1h', '4h', '1d']),
    JSON.stringify(cryptoChartTimeframes));

  await page.locator('#ara-diger-panel summary').click();
  await page.locator('#ara-diger-ad').fill('AAPL');
  const usStockTimeframes = await page.locator('#ara-diger-zd option').evaluateAll(options => options.map(option => option.value));
  check('Diğer piyasalarda tanımlı ABD hisseleri günlük kalıyor',
    JSON.stringify(usStockTimeframes) === JSON.stringify(['1d']), JSON.stringify(usStockTimeframes));
  await page.locator('#ara-diger-ad').fill('Altın');
  const otherMarketTimeframes = await page.locator('#ara-diger-zd option').evaluateAll(options => options.map(option => option.value));
  check('Diğer piyasalarda emtia için 15m, 1h ve 1d korunuyor',
    JSON.stringify(otherMarketTimeframes) === JSON.stringify(['15m', '1h', '1d']), JSON.stringify(otherMarketTimeframes));
  await page.locator('#ara-diger-ad').fill('BIST100');
  const bistIndexTimeframes = await page.locator('#ara-diger-zd option').evaluateAll(options => options.map(option => option.value));
  check('BIST 100 endeksi de yalnızca günlük periyotta kalıyor',
    JSON.stringify(bistIndexTimeframes) === JSON.stringify(['1d']), JSON.stringify(bistIndexTimeframes));

  await page.locator('#ara-kripto-ad').fill('THYAO.IS');
  await page.locator('#ara-kripto-btn').click();
  await page.waitForFunction(() =>
    (document.querySelector('#ara-kripto-durum')?.textContent || '').includes('⚠️')
  );
  const cryptoIsolation = await page.locator('#ara-kripto-durum').innerText();
  check('Kripto arama alanı BIST hisselerini reddediyor',
    cryptoIsolation.includes('yalnızca kripto'), cryptoIsolation);

  await page.locator('#ara-bist-ad').fill('BTCUSDT');
  await page.locator('#ara-bist-btn').click();
  await page.waitForFunction(() =>
    (document.querySelector('#ara-bist-durum')?.textContent || '').includes('⚠️')
  );
  const bistIsolation = await page.locator('#ara-bist-durum').innerText();
  check('BIST 100 arama alanı coin sembollerini reddediyor',
    bistIsolation.includes('yalnızca BIST 100'), bistIsolation);

  await page.locator('#ara-bist-ad').fill('THYAO.IS');
  await page.locator('#ara-bist-zd').selectOption('1d');
  await page.locator('#ara-bist-btn').click();

  await page.waitForFunction(() => {
    const searchStatus = document.querySelector('#ara-bist-durum')?.textContent || '';
    const analysisStatus = document.querySelector('#analiz-durum')?.textContent || '';
    return searchStatus.includes('⚠️') || analysisStatus.includes('Analiz tamamlandı');
  }, null, { timeout: 120000 });

  const chartStatus = await page.locator('#analiz-durum').innerText();
  const searchStatus = await page.locator('#ara-bist-durum').innerText();
  const canvasCount = await page.locator('#tuval-alan canvas').count();
  check('THYAO.IS grafik araması', chartStatus.includes('Analiz tamamlandı'), chartStatus.includes('Analiz tamamlandı') ? chartStatus : searchStatus);
  check('Arama durum mesajı tamamlandı', searchStatus.includes('Analiz tamamlandı'), searchStatus);
  check('Teknik grafik canvas çizimi', canvasCount > 0, canvasCount + ' canvas');

  if (chartStatus.includes('Analiz tamamlandı')) {
    await page.waitForFunction(() => {
      const text = document.querySelector('#tuval-alan')?.innerText || '';
      return text.includes('Araştırma Ajanı') || text.includes('Araştırma ajanı şu anda veri alamadı');
    }, null, { timeout: 60000 }).catch(() => {});
    const chartAreaText = await page.locator('#tuval-alan').innerText();
    check('Grafik sonrası araştırma özeti', chartAreaText.includes('Araştırma Ajanı') || chartAreaText.includes('Araştırma ajanı şu anda veri alamadı'), chartAreaText.slice(-600));
    check('Grafik analizinde Haber Ajanı kartı açılıyor',
      chartAreaText.includes('Haber Ajanı'), chartAreaText.slice(-900));
  }

  await page.locator('nav button[data-git="sonuc"]').click();
  const resultPageText = await page.locator('#sonuc-alan').innerText();
  check('Analiz sonuçları ve geçmiş ekranı', resultPageText.includes('THYAO') || resultPageText.includes('THYAO.IS'), resultPageText.slice(0, 180));
  await page.locator('nav button[data-git="yukle"]').click();

  // Test local image upload, candle detection and chart rendering without OCR.
  const chartImage = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101820';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 32; i++) {
      const x = 35 + i * 25;
      const center = 250 + Math.sin(i / 3) * 70 - i * 1.2;
      const open = center + (i % 2 ? 14 : -14);
      const close = center + (i % 2 ? -14 : 14);
      const color = i % 2 ? '#20c997' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 6, center - 34);
      ctx.lineTo(x + 6, center + 34);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(x, Math.min(open, close), 12, Math.max(10, Math.abs(close - open)));
    }
    return canvas.toDataURL('image/png');
  });
  await page.locator('#dosya').setInputFiles({
    name: 'test-grafik.png',
    mimeType: 'image/png',
    buffer: Buffer.from(chartImage.split(',')[1], 'base64')
  });
  await page.locator('#fiyat-ust').fill('200');
  await page.locator('#fiyat-alt').fill('100');
  await page.locator('#analiz-btn').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#analiz-durum')?.textContent || '';
    return status.includes('Analiz tamamlandı') || status.startsWith('Hata:') || status.includes('yeterli veri okunamadı');
  }, null, { timeout: 30000 });
  const imageStatus = await page.locator('#analiz-durum').innerText();
  const imageCanvasCount = await page.locator('#tuval-alan canvas').count();
  check('Grafik görüntüsü yükleme ve mum tanıma', imageStatus.includes('Analiz tamamlandı'), imageStatus);
  check('Görüntü analiz grafiği çizimi', imageCanvasCount > 0, imageCanvasCount + ' canvas');

  await page.locator('#dosya').setInputFiles({
    name: 'gecersiz.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('bu bir grafik resmi değil')
  });
  const invalidImageState = await page.evaluate(() => ({
    buttonDisabled: document.querySelector('#analiz-btn').disabled,
    hasImage: Boolean(window.GrafikAI.resim),
    previewHidden: document.querySelector('#onizleme').hidden
  }));
  check(
    'Geçersiz görsel seçimi eski görseli temizler',
    invalidImageState.buttonDisabled && !invalidImageState.hasImage && invalidImageState.previewHidden,
    JSON.stringify(invalidImageState)
  );
  const ocrEngine = await page.evaluate(async () => {
    try {
      await OCR.motor();
      return { loaded: !!window.Tesseract && typeof window.Tesseract.createWorker === 'function', version: window.Tesseract && window.Tesseract.version || '' };
    } catch (error) {
      return { loaded: false, error: error && error.message ? error.message : String(error) };
    }
  });
  check('OCR motoru CDN yüklemesi', ocrEngine.loaded, JSON.stringify(ocrEngine));
  if (ocrEngine.loaded) {
    const ocrRecognition = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 520;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#000000';
      context.font = 'bold 88px Arial';
      context.fillText('123.45', 28, 125);
      let worker;
      try {
        worker = await window.Tesseract.createWorker('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789.', tessedit_pageseg_mode: '7' });
        const result = await worker.recognize(canvas);
        const text = String(result && result.data && result.data.text || '').replace(/\\s/g, '');
        return { ok: /123[.,]45/.test(text), text };
      } catch (error) {
        return { ok: false, error: error && error.message ? error.message : String(error) };
      } finally {
        if (worker) await worker.terminate().catch(() => {});
      }
    });
    check('OCR sayısal metin tanıma', ocrRecognition.ok, JSON.stringify(ocrRecognition));
  }

  // Exercise the full 100-symbol scan, not only the single-stock research path.
  await page.locator('nav button[data-git="strateji"]').click();
  const bistScanConfig = await page.evaluate(() => ({
    hasTimeframeSelector: Boolean(document.querySelector('#tahmin-zd')),
    timeframe: window.TahminAI && window.TahminAI.zamanDilimi,
    agentVersion: window.TahminAI && window.TahminAI.agentVersion
  }));
  check('BIST Tahmin ekranı yalnızca günlük periyoda sabit', !bistScanConfig.hasTimeframeSelector &&
    bistScanConfig.timeframe === '1d' && bistScanConfig.agentVersion === 'tahmin-v1.4-daily',
    JSON.stringify(bistScanConfig));
  await page.locator('#tahmin-btn').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#tahmin-durum')?.textContent || '';
    return status.startsWith('Tamamlandı') || status.startsWith('Hata:');
  }, null, { timeout: 600000 });

  const scanStatus = await page.locator('#tahmin-durum').innerText();
  const bistScanTimeframes = await page.evaluate(() => {
    const record = window.TahminAI && window.TahminAI.sonDurum;
    return {
      timeframe: record && record.zd,
      candidatesDaily: Boolean(record && Array.isArray(record.adaylar) && record.adaylar.every(item => item.zd === '1d'))
    };
  });
  check('BIST tarama kayıtları yalnızca günlük mumlardan oluşuyor',
    bistScanTimeframes.timeframe === '1d' && bistScanTimeframes.candidatesDaily,
    JSON.stringify(bistScanTimeframes));
  const scanSummary = await page.locator('#tahmin-alan details summary').first().innerText().catch(() => '');
  const scanRows = await page.locator('#tahmin-alan .bist-table tbody tr').count();
  const scanMatch = scanSummary.match(/BIST 100 tarama tablosu · (\d+) hisse(?: · (\d+) veri hatası)?/);
  const successCount = scanMatch ? Number(scanMatch[1]) : 0;
  const errorCount = scanMatch && scanMatch[2] ? Number(scanMatch[2]) : 0;
  check('BIST 100 tam tarama akışı', scanStatus.startsWith('Tamamlandı'), scanStatus);
  check('100 sembol için tarama sonucu', successCount + errorCount === 100, successCount + ' başarılı · ' + errorCount + ' veri hatası');
  check('Tarama tablosu satırları', successCount > 0 && scanRows === successCount, scanRows + ' sonuç satırı');

  if (scanRows > 0) {
    await page.locator('#tahmin-alan details').first().evaluate(element => { element.open = true; });
    const previousAnalysis = await page.evaluate(() => window.GrafikAI?.sonAnaliz?.tarih || '');
    await page.locator('#tahmin-alan .bist-mini-btn').first().click();
    await page.waitForFunction(previous => {
      const current = window.GrafikAI?.sonAnaliz?.tarih || '';
      return Boolean(current && current !== previous);
    }, previousAnalysis, { timeout: 120000 });
    const scanChartCount = await page.locator('#tuval-alan canvas').count();
    check('Tarama tablosundan hisse grafiği açma', scanChartCount > 0, scanChartCount + ' canvas');
  }

  // Verify the free research panel without any API key or paid provider.
  await page.locator('nav button[data-git="strateji"]').click();
  await page.locator('#finansal-panel').waitFor({ state: 'visible' });
  const financialOptions = await page.locator('#finansal-sembol option').count();
  check('Ücretsiz finansal araştırma paneli', financialOptions === 100, financialOptions + ' hisse seçeneği');

  const chartPayload = (() => {
    const now = Math.floor(Date.now() / 1000);
    const rows = Array.from({ length: 220 }, (_, i) => {
      const close = 250 + i * 0.35 + Math.sin(i / 5) * 3;
      return {
        timestamp: now - (220 - i) * 86400,
        open: close - 0.8,
        high: close + 2.1,
        low: close - 2.4,
        close,
        volume: 1000000 + (i % 17) * 35000
      };
    });
    return {
      chart: {
        result: [{
          meta: { symbol: 'THYAO.IS', currency: 'TRY' },
          timestamp: rows.map(x => x.timestamp),
          indicators: {
            quote: [{
              open: rows.map(x => x.open),
              high: rows.map(x => x.high),
              low: rows.map(x => x.low),
              close: rows.map(x => x.close),
              volume: rows.map(x => x.volume)
            }]
          }
        }],
        error: null
      }
    };
  })();

  await page.route('https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS**', async route => {
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(chartPayload) });
  });

  await page.route('https://grafik-vekil.hellomotherfck1.workers.dev/**', async route => {
    const requested = new URL(route.request().url()).searchParams.get('u') || '';
    if (requested.includes('/v8/finance/chart/THYAO.IS')) {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(chartPayload) });
      return;
    }
    if (requested.includes('/v8/finance/chart/FLAT.IS')) {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(flatPayload) });
      return;
    }
    if (requested.includes('/v8/finance/chart/FLAT.IS')) {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(flatPayload) });
      return;
    }
    if (requested.includes('/v10/finance/quoteSummary/THYAO.IS')) {
      const quoteSummary = {
        quoteSummary: {
          result: [{
            price: { currency: 'TRY', regularMarketPrice: { raw: 326.5 }, marketCap: { raw: 450000000000 } },
            summaryDetail: { trailingPE: { raw: 5.2 }, forwardPE: { raw: 4.7 }, dividendYield: { raw: 0.018 } },
            defaultKeyStatistics: { priceToBook: { raw: 0.95 }, trailingEps: { raw: 62.8 } },
            financialData: {
              currentPrice: { raw: 326.5 }, returnOnEquity: { raw: 0.18 },
              returnOnAssets: { raw: 0.07 }, profitMargins: { raw: 0.12 },
              revenueGrowth: { raw: 0.16 }, earningsGrowth: { raw: 0.11 },
              debtToEquity: { raw: 95 }, currentRatio: { raw: 1.3 },
              targetMeanPrice: { raw: 370 }, targetHighPrice: { raw: 410 },
              targetLowPrice: { raw: 330 }, numberOfAnalystOpinions: { raw: 8 },
              freeCashflow: { raw: 42000000000 }, totalDebt: { raw: 130000000000 },
              totalCash: { raw: 85000000000 }
            },
            assetProfile: { sector: 'Industrials', industry: 'Airlines' }
          }],
          error: null
        }
      };
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(quoteSummary) });
      return;
    }
    if (requested.includes('news.google.com/rss/search')) {
      const rssDate = new Date().toUTCString();
      const rss = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<rss version="2.0"><channel><item>' +
        '<title>Türk Hava Yolları yeni sipariş aldı</title>' +
        '<link>https://news.google.com/rss/articles/test-thy</link>' +
        '<pubDate>' + rssDate + '</pubDate>' +
        '<source url="https://example.com">Test Haber</source>' +
        '<description>Yeni sipariş ve büyüme gelişmesi.</description>' +
        '</item></channel></rss>';
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/rss+xml; charset=utf-8', body: rss });
      return;
    }
    if (requested.includes('/v1/finance/search?q=THYAO.IS')) {
      await route.fulfill({
        status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
        body: JSON.stringify({ news: [{ title: 'THYAO ücretsiz test haber başlığı', publisher: 'Test kaynağı', link: 'https://example.com/thy', providerPublishTime: Math.floor(Date.now() / 1000) }] })
      });
      return;
    }
    if (requested.includes('/v1/finance/search?q=FLAT.IS')) {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ news: [] }) });
      return;
    }
    if (requested.includes('/tr/api/member/filter/FLAT')) {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({}) });
      return;
    }
    if (requested.includes('/tr/api/member/filter/THYAO')) {
      await route.fulfill({
        status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
        body: JSON.stringify({ mkkMemberOid: 'TEST-MKK-OID', title: 'Türk Hava Yolları', permaLink: 'test-thy' })
      });
      return;
    }
    if (requested.includes('/tr/api/company-detail/disclosures/FR/TEST-MKK-OID')) {
      await route.fulfill({
        status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
        body: JSON.stringify([{ disclosureBasic: { title: '2026 ikinci çeyrek finansal raporu', disclosureIndex: 123456, publishDate: '09.11.2026', year: '2026', period: '6 Aylık' } }])
      });
      return;
    }
    if (requested.includes('/tr/api/company-detail/disclosures/ODA/TEST-MKK-OID')) {
      await route.fulfill({
        status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
        body: JSON.stringify([{ disclosureBasic: { title: 'Özel durum açıklaması', disclosureIndex: 123457, publishDate: '09.11.2026' } }])
      });
      return;
    }
    if (requested.includes('/tr/Bildirim/123456')) {
      const html = `<!doctype html><html><body><h1>Finansal Rapor</h1><table>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Hasılat</span></td><td class="taxonomy-context-value">1.234.567,00</td><td class="taxonomy-context-value">1.000.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Dönem Kârı (Zararı)</span></td><td class="taxonomy-context-value">(123.456,00)</td><td class="taxonomy-context-value">100.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Toplam Varlıklar</span></td><td class="taxonomy-context-value">5.000.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Toplam Özkaynaklar</span></td><td class="taxonomy-context-value">2.000.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Dönen Varlıklar</span></td><td class="taxonomy-context-value">1.500.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Kısa Vadeli Yükümlülükler</span></td><td class="taxonomy-context-value">1.000.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Nakit ve Nakit Benzerleri</span></td><td class="taxonomy-context-value">250.000</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Kısa Vadeli Borçlanmalar</span></td><td class="taxonomy-context-value">300.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Uzun Vadeli Borçlanmalar</span></td><td class="taxonomy-context-value">500.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">İşletme Faaliyetlerinden Nakit Akışları</span></td><td class="taxonomy-context-value">200.000,00</td></tr>
      </table></body></html>`;
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'text/html; charset=utf-8', body: html });
      return;
    }
    await route.fulfill({ status: 502, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ error: 'Unexpected test URL', requested }) });
  });

  await page.route('https://api.allorigins.win/**', async route => {
    const target = new URL(route.request().url()).searchParams.get('url') || '';
    if (target.includes('/v1/finance/search?q=FALLBACK')) {
      await route.fulfill({
        status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
        body: JSON.stringify({ news: [{ title: 'AllOrigins yedek haber testi', publisher: 'Test kaynağı', link: 'https://example.com/fallback', providerPublishTime: Math.floor(Date.now() / 1000) }] })
      });
      return;
    }
    await route.continue();
  });
  const fallbackNews = await page.evaluate(async () => window.BistArastirma.haberGetir('FALLBACK'));
  check('Yahoo haberlerinde ikinci ücretsiz proxy yedeği', fallbackNews.length === 1 && fallbackNews[0].title.includes('AllOrigins'), fallbackNews.map(x => x.title).join(', ') || 'Haber alınamadı');

  const makeBinanceRows = requestedUrl => {
    const parsed = new URL(requestedUrl);
    const tf = parsed.searchParams.get('interval') || '1h';
    const step = ({ '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000, '4h': 4 * 60 * 60 * 1000, '1d': 24 * 60 * 60 * 1000 })[tf] || 60 * 60 * 1000;
    const count = Math.max(20, Math.min(1000, Number(parsed.searchParams.get('limit')) || 120));
    const lastOpen = Math.floor((Date.now() - step - 1000) / step) * step;
    return Array.from({ length: count }, (_, i) => {
      const t = lastOpen - (count - 1 - i) * step;
      const open = 100 + i * 0.03;
      const close = open + 0.02;
      const quoteVolume = i >= count - 5 ? 120000 : 100000;
      const buyShare = i >= count - 5 ? 0.60 : 0.52;
      return [
        t, open.toFixed(4), (close + 0.04).toFixed(4), (open - 0.04).toFixed(4),
        close.toFixed(4), '1200', t + step - 1, String(quoteVolume), 500,
        '700', String(quoteVolume * buyShare), '0'
      ];
    });
  };
  const mockBinance = async route => {
    const rows = makeBinanceRows(route.request().url());
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify(rows)
    });
  };
  await page.route('https://data-api.binance.vision/**', mockBinance);
  await page.route('https://api.binance.com/**', mockBinance);

  // Historical candles remain available only to evaluate real signals in the agent performance ledger.
  await page.locator('nav button[data-git="strateji"]').click();
  const historyFeature = await page.evaluate(() => ({
    panelPresent: document.querySelector('#backtest-panel') !== null,
    engineLoaded: typeof window.BacktestAI !== 'undefined',
    performanceHistoryAvailable: typeof Veri !== 'undefined' && typeof Veri.gecmis === 'function'
  }));
  check('Bağımsız geçmiş sinyal testi paneli kaldırıldı',
    !historyFeature.panelPresent && !historyFeature.engineLoaded, JSON.stringify(historyFeature));
  check('Ajan performans karnesi için geçmiş veri erişimi korundu',
    historyFeature.performanceHistoryAvailable, JSON.stringify(historyFeature));

  const yahooVolume = await page.evaluate(async () => {
    const rows = await Veri.yahoo('THYAO.IS', '1d');
    return { count: rows.length, lastVolume: rows[rows.length - 1].v };
  });
  check('Yahoo mumlarında hacim alanı', yahooVolume.count >= 20 && yahooVolume.lastVolume > 0, JSON.stringify(yahooVolume));
  const yahooFallbackTests = await page.evaluate(async () => {
    const originalGetir = Veri.getir;
    const workerPrefix = 'https://grafik-vekil.hellomotherfck1.workers.dev/?u=';
    const makePayload = () => {
      const count = 30;
      const now = Math.floor(Date.now() / 1000);
      const timestamp = Array.from({ length: count }, (_, i) => now - (count - i) * 86400);
      const close = Array.from({ length: count }, (_, i) => 100 + i * 0.25);
      const open = close.map(value => value - 0.1);
      return {
        chart: {
          result: [{
            timestamp,
            indicators: {
              quote: [{
                open,
                high: close.map(value => value + 0.5),
                low: close.map(value => value - 0.5),
                close,
                volume: close.map((_, i) => 1000 + i * 10)
              }]
            }
          }],
          error: null
        }
      };
    };
    const result = {};

    try {
      let calls = { proxy: 0, direct: 0 };
      Veri.getir = async function (url) {
        if (url.indexOf(workerPrefix) === 0) {
          calls.proxy++;
          const error = new Error('simulated timeout');
          error.name = 'AbortError';
          throw error;
        }
        if (url.indexOf('https://query1.finance.yahoo.com/v8/finance/chart/TIMEOUT.IS') === 0) {
          calls.direct++;
          return makePayload();
        }
        throw new Error('Unexpected test URL: ' + url);
      };
      const timeoutRows = await Veri.yahoo('TIMEOUT.IS', '1d');
      result.timeoutFallback = {
        count: timeoutRows.length,
        volume: timeoutRows[timeoutRows.length - 1].v,
        proxyCalls: calls.proxy,
        directCalls: calls.direct
      };

      calls = { proxy: 0 };
      Veri.getir = async function (url) {
        if (url.indexOf(workerPrefix) === 0) {
          calls.proxy++;
          if (calls.proxy === 1) throw new Error('HTTP 503');
          return makePayload();
        }
        throw new Error('Unexpected retry URL: ' + url);
      };
      const retryRows = await Veri.yahoo('RETRY.IS', '1d');
      result.serverRetry = { count: retryRows.length, proxyCalls: calls.proxy };

      calls = { proxy: 0, direct: 0, allOrigins: 0 };
      Veri.getir = async function (url) {
        if (url.indexOf(workerPrefix) === 0) {
          calls.proxy++;
          const error = new Error('simulated timeout');
          error.name = 'AbortError';
          throw error;
        }
        if (url.indexOf('https://query1.finance.yahoo.com/v8/finance/chart/ALLORIGINS.IS') === 0) {
          calls.direct++;
          throw new Error('CORS network error');
        }
        if (url.indexOf('https://api.allorigins.win/raw?url=') === 0) {
          calls.allOrigins++;
          return makePayload();
        }
        throw new Error('Unexpected AllOrigins URL: ' + url);
      };
      const allOriginsRows = await Veri.yahoo('ALLORIGINS.IS', '1d');
      result.allOriginsFallback = {
        count: allOriginsRows.length,
        proxyCalls: calls.proxy,
        directCalls: calls.direct,
        allOriginsCalls: calls.allOrigins
      };

      calls = { proxy: 0, direct: 0, allOrigins: 0, corsProxy: 0 };
      Veri.getir = async function (url) {
        if (url.indexOf(workerPrefix) === 0) {
          calls.proxy++;
          const error = new Error('simulated timeout');
          error.name = 'AbortError';
          throw error;
        }
        if (url.indexOf('https://query1.finance.yahoo.com/v8/finance/chart/CORSPROXY.IS') === 0) {
          calls.direct++;
          throw new Error('CORS network error');
        }
        if (url.indexOf('https://api.allorigins.win/raw?url=') === 0) {
          calls.allOrigins++;
          throw new Error('HTTP 502');
        }
        if (url.indexOf('https://corsproxy.io/?') === 0) {
          calls.corsProxy++;
          return makePayload();
        }
        throw new Error('Unexpected CORS proxy URL: ' + url);
      };
      const corsProxyRows = await Veri.yahoo('CORSPROXY.IS', '1d');
      result.corsProxyFallback = {
        count: corsProxyRows.length,
        proxyCalls: calls.proxy,
        directCalls: calls.direct,
        allOriginsCalls: calls.allOrigins,
        corsProxyCalls: calls.corsProxy
      };

      Veri.getir = async function () { throw new Error('offline'); };
      try {
        await Veri.yahoo('OFFLINE.IS', '1d');
        result.allSourcesFail = { error: '' };
      } catch (error) {
        result.allSourcesFail = { error: error.message };
      }
      return result;
    } finally {
      Veri.getir = originalGetir;
    }
  });
  check('Vekil zaman aşımında Yahoo Finance yedeğine geçiliyor',
    yahooFallbackTests.timeoutFallback.count === 30 &&
    yahooFallbackTests.timeoutFallback.proxyCalls === 1 &&
    yahooFallbackTests.timeoutFallback.directCalls === 1 &&
    yahooFallbackTests.timeoutFallback.volume > 0,
    JSON.stringify(yahooFallbackTests.timeoutFallback));
  check('Vekil HTTP 503 hatasında bir kez otomatik tekrar deneniyor',
    yahooFallbackTests.serverRetry.count === 30 && yahooFallbackTests.serverRetry.proxyCalls === 2,
    JSON.stringify(yahooFallbackTests.serverRetry));
  check('Yahoo Finance erişilemezse AllOrigins yedeği çalışıyor',
    yahooFallbackTests.allOriginsFallback.count === 30 &&
    yahooFallbackTests.allOriginsFallback.allOriginsCalls === 1,
    JSON.stringify(yahooFallbackTests.allOriginsFallback));
  check('AllOrigins da çalışmazsa CORS proxy yedeği çalışıyor',
    yahooFallbackTests.corsProxyFallback.count === 30 &&
    yahooFallbackTests.corsProxyFallback.corsProxyCalls === 1,
    JSON.stringify(yahooFallbackTests.corsProxyFallback));
  check('Bütün kaynaklar kapalıysa hata kaynakları açıkça bildiriliyor',
    ['Cloudflare vekil', 'Yahoo Finance', 'AllOrigins', 'CORS proxy'].every(name =>
      yahooFallbackTests.allSourcesFail.error.includes(name)),
    yahooFallbackTests.allSourcesFail.error);

  const binanceVolume = await page.evaluate(async () => {
    const rows = await Veri.binance('BTCUSDT', '1d');
    const last = rows[rows.length - 1];
    return {
      count: rows.length, lastVolume: last.v, quoteVolume: last.quoteVolume,
      trades: last.trades, takerBuyQuoteVolume: last.takerBuyQuoteVolume,
      closeTime: last.closeTime
    };
  });
  check('Binance 12 alanlı Kline verisi korunuyor',
    binanceVolume.count >= 20 && binanceVolume.lastVolume > 0 &&
    binanceVolume.quoteVolume > 0 && binanceVolume.trades > 0 &&
    binanceVolume.takerBuyQuoteVolume > 0 && binanceVolume.closeTime > 0,
    JSON.stringify(binanceVolume));

  const timeframeChecks = await page.evaluate(async () => {
    const yahooDaily = await Veri.yahoo('THYAO.IS', '1d');
    const binance15 = await Veri.binance('BTCUSDT', '15m');
    const binance1h = await Veri.binance('BTCUSDT', '1h');
    const binance4h = await Veri.binance('BTCUSDT', '4h');
    const binance1d = await Veri.binance('BTCUSDT', '1d');
    const now = Date.now();
    const closed = Veri.kapanmisMumlar([
      { t: now - 60 * 60 * 1000, closeTime: now - 1 },
      { t: now, closeTime: now + 60 * 60 * 1000 - 1 }
    ], '1h');
    return {
      yahooDaily: yahooDaily.length,
      binance15: binance15.length, binance1h: binance1h.length,
      binance4h: binance4h.length, binance1d: binance1d.length,
      closedCount: closed.length
    };
  });
  check('Hisse günlük; kripto 15m, 1h, 4h ve 1d veri aralıkları',
    timeframeChecks.yahooDaily >= 20 && timeframeChecks.binance15 >= 20 &&
    timeframeChecks.binance1h >= 20 && timeframeChecks.binance4h >= 20 &&
    timeframeChecks.binance1d >= 20 && timeframeChecks.closedCount === 1,
    JSON.stringify(timeframeChecks));

  const bistVolumeAgent = await page.evaluate(async () => {
    const result = await TahminAI.taraBir({ q: 'THYAO', ad: 'Türk Hava Yolları' }, '15m');
    return { symbol: result.sembol, timeframe: result.zd, lastVolume: result.sonHacim, averageVolume: result.ortHacim20, ratio: result.hacimOrani, volumeAvailable: result.hacimVar, volumeModelVersion: result.volumeModelVersion };
  });
  check('BIST hacim ajanı istense bile günlük veri kullanıyor', bistVolumeAgent.timeframe === '1d' &&
    bistVolumeAgent.lastVolume > 0 && bistVolumeAgent.averageVolume > 0 && bistVolumeAgent.ratio > 0 &&
    bistVolumeAgent.volumeAvailable === true && bistVolumeAgent.volumeModelVersion === 'volume-heuristic-v1',
    JSON.stringify(bistVolumeAgent));

  const coinVolumeAgent = await page.evaluate(async () => {
    const result = await CoinTahminAI.taraBir({ q: 'BTC', ad: 'Bitcoin' }, '1d');
    return { symbol: result.sembol, price: result.fiyat, volumeScore: result.hacimSkor, generalDecision: result.genelKarar, technicalDecision: result.teknikKarar, technicalAvailable: result.teknikVar, volumeDecision: result.hacimKarar, volumeAvailable: result.hacimVar, reviewerRisk: result.denetciHata };
  });
  check('Coin hacim ajanına veri aktarımı', coinVolumeAgent.price > 0 && typeof coinVolumeAgent.volumeScore === 'number', JSON.stringify(coinVolumeAgent));
  check('Coin botlarının kararları ayrı ayrı kaydediliyor',
    ['AL', 'SAT', 'BEKLE'].includes(coinVolumeAgent.generalDecision) &&
    (coinVolumeAgent.technicalAvailable ? ['AL', 'SAT', 'BEKLE'].includes(coinVolumeAgent.technicalDecision) : coinVolumeAgent.technicalDecision === null) &&
    (coinVolumeAgent.volumeAvailable ? ['AL', 'SAT', 'BEKLE'].includes(coinVolumeAgent.volumeDecision) : coinVolumeAgent.volumeDecision === null),
    JSON.stringify(coinVolumeAgent));
  const flowCheck = await page.evaluate(() => {
    const now = Date.now(), hour = 60 * 60 * 1000;
    const bars = Array.from({ length: 30 }, (_, i) => {
      const recent = i >= 25, quote = recent ? 1200 : 1000;
      const t = now - (30 - i) * hour;
      return { t, closeTime: t + hour - 1, quoteVolume: quote, takerBuyQuoteVolume: quote * (recent ? 0.65 : 0.5) };
    });
    const flow = window.KriptoAjanlari.orderFlow(bars);
    const missing = window.KriptoAjanlari.orderFlow(bars.map(m => ({ t: m.t, closeTime: m.closeTime, v: 1 })));
    return { available: flow.available, score: flow.score, missingAvailable: missing.available };
  });
  check('Order Flow alıcı/satıcı baskısı ve eksik veride no-vote',
    flowCheck.available && flowCheck.score === 2 && !flowCheck.missingAvailable,
    JSON.stringify(flowCheck));

  const symbolMappings = await page.evaluate(() => ({
    bist: Veri.coz('PGSUS.IS')[0]?.sembol,
    bist100: Veri.coz('AEFES')[0]?.sembol,
    coin: Veri.coz('BTC')[0]?.sembol,
    stockTimeframes: Veri.zamanDilimleri('THYAO.IS'),
    usStockTimeframes: Veri.zamanDilimleri('AAPL'),
    bist100Timeframes: Veri.zamanDilimleri('AEFES'),
    cryptoTimeframes: Veri.zamanDilimleri('BTCUSDT')
  }));
  check('PGSUS.IS, BIST 100 hissesi ve BTCUSDT sembol eşleştirmesi',
    symbolMappings.bist === 'PGSUS.IS' && symbolMappings.bist100 === 'AEFES.IS' && symbolMappings.coin === 'BTCUSDT',
    JSON.stringify(symbolMappings));
  check('Veri katmanı hisseyi günlük, kriptoyu dört zaman dilimine ayırıyor',
    JSON.stringify(symbolMappings.stockTimeframes) === JSON.stringify(['1d']) &&
    JSON.stringify(symbolMappings.usStockTimeframes) === JSON.stringify(['1d']) &&
    JSON.stringify(symbolMappings.bist100Timeframes) === JSON.stringify(['1d']) &&
    JSON.stringify(symbolMappings.cryptoTimeframes) === JSON.stringify(['15m', '1h', '4h', '1d']),
    JSON.stringify(symbolMappings));
  const marketRouting = await page.evaluate(async () => {
    const originalBinance = Veri.binance, originalYahoo = Veri.yahoo;
    const calls = [];
    const candles = Array.from({ length: 30 }, (_, i) => ({
      t: Date.now() - (30 - i) * 86400000, o: 10, h: 11, l: 9, c: 10.5, v: 100
    }));
    Veri.binance = async (symbol, timeframe) => {
      calls.push({ source: 'Binance', symbol, timeframe });
      return candles;
    };
    Veri.yahoo = async (symbol, timeframe) => {
      calls.push({ source: 'Yahoo', symbol, timeframe });
      return candles;
    };
    try {
      const stock = await Veri.ara('THYAO.IS', '15m');
      const usStock = await Veri.ara('AAPL', '15m');
      const bist100 = await Veri.ara('AEFES', '15m');
      const crypto = await Veri.ara('BTC', '4h');
      return { stockTimeframe: stock.zd, usStockTimeframe: usStock.zd, bist100Timeframe: bist100.zd, bist100Symbol: bist100.sembol, cryptoTimeframe: crypto.zd, calls };
    } finally {
      Veri.binance = originalBinance;
      Veri.yahoo = originalYahoo;
    }
  });
  check('Veri yönlendiricisi hisseleri 1D’ye sabitliyor ve kriptoda 4H’yi koruyor',
    marketRouting.stockTimeframe === '1d' && marketRouting.usStockTimeframe === '1d' &&
    marketRouting.bist100Timeframe === '1d' && marketRouting.bist100Symbol === 'AEFES.IS' &&
    marketRouting.cryptoTimeframe === '4h' &&
    marketRouting.calls.some(call => call.source === 'Yahoo' && call.symbol === 'AAPL' && call.timeframe === '1d') &&
    marketRouting.calls.some(call => call.source === 'Yahoo' && call.symbol === 'AEFES.IS' && call.timeframe === '1d') &&
    marketRouting.calls.some(call => call.source === 'Binance' && call.timeframe === '4h'),
    JSON.stringify(marketRouting));
  await page.locator('nav button[data-git="gecmis"]').click();
  const coinUI = await page.locator('#coin-tahmin-btn').count();
  const coinCount = await page.evaluate(() => window.CoinTahminAI.LISTE.length);
  check('Coin Tahmin paneli ve sembol listesi', coinUI === 1 && coinCount >= 200, coinCount + ' coin seçeneği');
  await page.locator('#coin-tahmin-btn').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#coin-tahmin-durum')?.textContent || '';
    return status.startsWith('Tamamlandı') || status.startsWith('Hata:');
  }, null, { timeout: 600000 });
  const coinScan = await page.evaluate(() => {
    const result = window.CoinTahminAI.sonDurum;
    const deep = result && result.adaylar ? result.adaylar.filter(item => item.deepScan === 'tamamlandı') : [];
    const deepTimeframeCoverage = deep.length > 0 && deep.every(item =>
      item.mtf &&
      ['daily', 'fourHour', 'hourly', 'fifteenMinute'].every(key => Object.prototype.hasOwnProperty.call(item.mtf, key)) &&
      item.sourceTimestamps &&
      ['1h', '1d', '4h', '15m'].every(key => Object.prototype.hasOwnProperty.call(item.sourceTimestamps, key))
    );
    return {
      total: window.CoinTahminAI.LISTE.length,
      scanned: result && result.adaylar ? result.adaylar.length : 0,
      errors: result && result.hatalar ? result.hatalar.length : -1,
      deepScanned: deep.length,
      deepTimeframeCoverage,
      deepVersion: result && result.ajanSurum,
      errorDetails: result && result.hatalar ? result.hatalar.slice(0, 8) : [],
      status: document.querySelector('#coin-tahmin-durum')?.textContent || ''
    };
  });
  check(
    'Coin toplu tarama akışı',
    coinScan.scanned > 0 && coinScan.scanned + coinScan.errors === coinScan.total &&
      coinScan.deepScanned === 20 && coinScan.deepVersion === 'crypto-intelligence-2.2.0' &&
      coinScan.status.startsWith('Tamamlandı'),
    JSON.stringify(coinScan)
  );
  check('İlk 20 coin derin kontrolünde 15m, 1h, 4h ve 1d zaman damgaları var',
    coinScan.deepTimeframeCoverage, JSON.stringify(coinScan));
  const coinResultText = await page.locator('#coin-tahmin-alan').innerText();
  const coinReasonUI = await page.evaluate(() => {
    const node = window.CoinTahminAI.renderCoinList([{
      ad: 'Curve DAO', sembol: 'CRVUSDT', karar: 'BEKLE', skor: 41,
      deepScan: 'tamamlandı', deepVeto: true,
      deepReasons: ['Order Flow güçlü biçimde ana sinyalin tersinde.'],
      nihaiNeden: 'İlk kurul teyidi yetersiz.'
    }]);
    return node.textContent;
  });
  check('Coin listesindeki BEKLE kararı gerçek güvenlik nedenini gösteriyor',
    coinReasonUI.includes('BEKLE nedeni:') && coinReasonUI.includes('Order Flow'),
    coinReasonUI);
  check(
    'Coin veri hataları kullanıcıya gösteriliyor',
    coinScan.errors === 0 || coinResultText.includes('Veri alınamayanlar'),
    coinResultText.slice(-350)
  );
  check(
    'Coin sonuç ekranı AL/SAT/BEKLE kararlarını sade anlatıyor',
    coinResultText.includes('SİSTEMİN SON KARARI') &&
      coinResultText.includes('Botların oyları') &&
      coinResultText.includes('Genel analiz') &&
      coinResultText.includes('Teknik bot') &&
      coinResultText.includes('Hacim botu') &&
      coinResultText.includes('Denetçi kontrolü') &&
      coinResultText.includes('Spot piyasada alım') &&
      coinResultText.includes('açığa satış') &&
      coinResultText.includes('216 coin tarama özeti'),
    coinResultText.slice(0, 1000)
  );
  await page.locator('nav button[data-git="strateji"]').click();

  await page.locator('#finansal-sembol').selectOption('THYAO');
  await page.locator('#finansal-panel button').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#finansal-durum')?.textContent || '';
    return status.includes('Ücretsiz araştırma tamamlandı') || status.includes('Ücretsiz araştırma tamamlanamadı');
  }, null, { timeout: 90000 });
  const financialStatus = await page.locator('#finansal-durum').innerText();
  check('Ücretsiz araştırma isteği tamamlandı', financialStatus.includes('Ücretsiz araştırma tamamlandı'), financialStatus);
  const financialText = await page.locator('#finansal-sonuc').innerText();
  check('Ücretsiz piyasa ve teknik göstergeler', financialText.includes('RSI (14)') && financialText.includes('EMA 200') && financialText.includes('Son fiyat'), financialText.slice(0, 450));
  check('KAP finansal tablosundan temel oranlar', financialText.includes('Hasılat') && financialText.includes('Cari oran') && financialText.includes('1.234.567'), financialText.includes('Dönem net kârı') ? 'Hasılat, dönem kârı ve likidite oranı hesaplandı' : financialText.slice(0, 350));
  const kapMetrics = await page.evaluate(() => {
    const f = window.FinansalPanel?.sonRapor?.fundamentals || {};
    return { netProfit: f.netProfit, cash: f.cash, profitMargin: f.profitMargin };
  });
  check('KAP parantezli negatif tutar doğru okundu', kapMetrics.netProfit === -123456, JSON.stringify(kapMetrics));
  check('KAP ondalıksız binlik ayraç doğru okundu', kapMetrics.cash === 250000, JSON.stringify(kapMetrics));
  check('KAP bildirimleri ve haberler', financialText.includes('2026 ikinci çeyrek finansal raporu') && financialText.includes('THYAO ücretsiz test haber başlığı'), financialText.includes('Özel durum açıklaması') ? 'Finansal rapor, özel durum ve haber listelendi' : 'KAP veya haber eksik');
  check('Haber Ajanı Google News, Yahoo ve KAP başlıklarını özetliyor',
    financialText.includes('Haber Ajanı') && financialText.includes('Türk Hava Yolları yeni sipariş aldı') &&
    financialText.includes('Olumlu'), financialText.slice(-900));
  const sharedSymbol = await page.evaluate(() => window.TahminAI?.temelAnaliz?.symbol || '');
  check('Ücretsiz araştırma diğer ajanlarla paylaşıldı', sharedSymbol === 'THYAO', sharedSymbol || 'Paylaşılan rapor bulunamadı');
  const apiKeyFields = await page.locator('#finansal-panel input[type="password"]').count();
  check('Ücretli API anahtarı alanı kaldırıldı', apiKeyFields === 0, apiKeyFields + ' parola alanı');
  // Flat market fixture: RSI must be neutral (50), not overbought (100).
  const flatRows = Array.from({ length: 220 }, (_, i) => ({
    timestamp: Math.floor(Date.now() / 1000) - (220 - i) * 86400,
    open: 100, high: 101, low: 99, close: 100, volume: 500000
  }));
  const flatPayload = {
    chart: {
      result: [{
        meta: { symbol: 'FLAT.IS', currency: 'TRY' },
        timestamp: flatRows.map(x => x.timestamp),
        indicators: { quote: [{
          open: flatRows.map(x => x.open),
          high: flatRows.map(x => x.high),
          low: flatRows.map(x => x.low),
          close: flatRows.map(x => x.close),
          volume: flatRows.map(x => x.volume)
        }] }
      }],
      error: null
    }
  };
  const flatRsi = await page.evaluate(async () => {
    const status = document.querySelector('#finansal-durum');
    const result = document.querySelector('#finansal-sonuc');
    const button = document.querySelector('#finansal-panel button');
    await window.FinansalPanel.analizEt('FLAT', status, result, button);
    return window.FinansalPanel.sonRapor.metrics.rsi14;
  });
  check('Yatay piyasada RSI nötr değerde', flatRsi === 50, 'RSI: ' + flatRsi);

  // Confirm that a chart search receives free F/K data and renders the agent debate.
  await page.evaluate(() => window.GrafikAI.araVarlik('THYAO.IS', '1d'));
  await page.waitForFunction(() => {
    const status = document.querySelector('#analiz-durum')?.textContent || '';
    return status.includes('Analiz tamamlandı') || status.startsWith('Hata:');
  }, null, { timeout: 120000 });
  await page.waitForFunction(() => {
    const cards = Array.from(document.querySelectorAll('#tuval-alan .kart h3'));
    const card = cards.find(h => h.textContent.startsWith('📊 F/K Değerleme ve Ajanlar Arası Tartışma'));
    return card && card.parentElement.textContent.includes('Son 12 ay F/K: 5,2');
  }, null, { timeout: 30000 });
  const fkCardText = await page.locator('#tuval-alan .kart').filter({ hasText: 'F/K Değerleme ve Ajanlar Arası Tartışma' }).innerText();
  check('Grafik analizine gerçek F/K değeri aktarılıyor', fkCardText.includes('5,2x') || fkCardText.includes('5,2'), fkCardText.slice(0, 450));
  check('F/K ajanları tartışma ve nihai kararı gösteriyor', fkCardText.includes('F/K Ajanı:') && fkCardText.includes('Kurulun nihai kararı:'), fkCardText.slice(-500));

  await page.unroute('https://grafik-vekil.hellomotherfck1.workers.dev/**');
  await page.unroute('https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS**');
  await page.unroute('https://query1.finance.yahoo.com/v8/finance/chart/FLAT.IS**');

  await page.locator('nav button[data-git="ayarlar"]').click();
  const adminUI = await page.locator('#admin-giris').isVisible() &&
    await page.locator('#admin-email').count() === 1 &&
    await page.locator('#admin-sifre').count() === 1 &&
    await page.locator('#admin-giris-btn').count() === 1 &&
    await page.locator('#admin-yenile-btn').count() === 1 &&
    await page.locator('#admin-gelistirme-notlari').count() === 1 &&
    await page.locator('#admin-panel').isHidden();
  check('Admin giriş ekranı ve yönetici araçları hazır', adminUI,
    adminUI ? 'Giriş, yenileme ve yöneticiye özel not alanları hazır' : 'Admin arayüzünde eksik alan var');
  const adminNotes = await page.evaluate(() => {
    const notes = document.getElementById('admin-gelistirme-notlari');
    const groups = notes ? Array.from(notes.querySelectorAll(':scope > details.admin-not-grup')) : [];
    const initiallyCollapsed = !!notes && !notes.open;
    if (notes) notes.open = true;
    const expands = !!notes && notes.open;
    const hasPerformance = (notes?.textContent || '').includes('30\'dan az bağımsız örnek');
    const hasSecurity = (notes?.textContent || '').includes('service_role');
    if (notes) notes.open = false;
    return {
      insideAdmin: !!notes && !!notes.closest('#admin-panel'),
      parentHidden: !!notes && notes.closest('#admin-panel').hidden,
      initiallyCollapsed,
      expands,
      collapses: !!notes && !notes.open,
      groupCount: groups.length,
      hasPerformance,
      hasSecurity
    };
  });
  check('Eski geliştirme notları admin panelinde açılır-kapanır ve gruplu',
    adminNotes.insideAdmin && adminNotes.parentHidden && adminNotes.initiallyCollapsed &&
      adminNotes.expands && adminNotes.collapses && adminNotes.groupCount === 8 &&
      adminNotes.hasPerformance && adminNotes.hasSecurity,
    JSON.stringify(adminNotes));

  await page.locator('nav button[data-git="strateji"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll('body *')).map(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { tag: element.tagName, id: element.id, className: typeof element.className === 'string' ? element.className : '', left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), scrollWidth: element.scrollWidth, overflowX: style.overflowX, display: style.display };
    }).filter(item => item.display !== 'none' && item.width > 0 && (item.right > viewport + 2 || item.left < -2)).sort((a, b) => b.right - a.right).slice(0, 20);
    return { viewport, page: document.documentElement.scrollWidth, navVisible: Array.from(document.querySelectorAll('nav button')).every(button => { const rect = button.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }), offenders };
  });
  check('Mobil ekran taşma ve menü kontrolü', mobileLayout.page <= mobileLayout.viewport + 1 && mobileLayout.navVisible, JSON.stringify(mobileLayout));
  const mobileTable = await page.evaluate(() => {
    const table = document.querySelector('.bist-table');
    const details = table && table.closest('details');
    if (details) details.open = true;
    if (!table) return null;
    const rect = table.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      viewport: document.documentElement.clientWidth,
      scrollWidth: table.scrollWidth,
      clientWidth: table.clientWidth,
      labels: Array.from(table.querySelectorAll('tbody td')).every(td => td.hasAttribute('data-label'))
    };
  });
  check('BIST tablosu telefonda kart düzenine geçiyor',
    mobileTable && mobileTable.width <= mobileTable.viewport + 1 &&
    mobileTable.scrollWidth <= mobileTable.clientWidth + 1 && mobileTable.labels,
    JSON.stringify(mobileTable));

  check('Tarayıcı JavaScript hatası yok', report.pageErrors.length === 0, report.pageErrors.join(' | ') || 'Hata yakalanmadı');
  report.finalURL = page.url();
  report.finishedAt = new Date().toISOString();
  report.consoleErrors = report.consoleErrors.slice(0, 30);

  if (report.checks.some(item => !item.passed)) {
    await page.screenshot({ path: 'live-e2e-failure.png', fullPage: true }).catch(() => {});
  }
} catch (error) {
  report.fatalError = error.stack || error.message || String(error);
  report.financialStatus = await page.locator('#finansal-durum').textContent().catch(() => '');
  report.financialResult = await page.locator('#finansal-sonuc').innerText().catch(() => '');
  await page.screenshot({ path: 'live-e2e-failure.png', fullPage: true }).catch(() => {});
  console.error('E2E fatal error:', report.fatalError, '· Financial status:', report.financialStatus);
} finally {
  if (browser) await browser.close().catch(() => {});
  report.finishedAt = report.finishedAt || new Date().toISOString();
  fs.writeFileSync('live-e2e-report.json', JSON.stringify(report, null, 2));
  const failed = report.checks.filter(item => !item.passed);
  console.log('E2E summary: ' + report.checks.filter(item => item.passed).length + '/' + report.checks.length + ' passed');
  if (report.fatalError || failed.length) process.exitCode = 1;
}
