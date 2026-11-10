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
    Boolean(window.TahminAI && window.BistArastirma && window.GrafikAI && window.BacktestAI && window.AjanPerformans) &&
    typeof Veri !== 'undefined' && typeof Analiz !== 'undefined' && typeof Cizim !== 'undefined',
    null,
    { timeout: 45000 }
  );
  check('Uygulama modülleri yüklendi', true, 'Veri / Analiz / Grafik / BIST araştırma ajanı');

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
  const stopPriority = await page.evaluate(() => {
    const trade = window.BacktestAI.simuleIslem(
      'AL', 100, 95, 110,
      [{ t: 1, o: 100, h: 112, l: 94, c: 108 }],
      0, 1, 0.20
    );
    return trade && { exit: trade.cikis, reason: trade.neden, net: trade.netYuzde };
  });
  check('Aynı mumda stop ve hedef görülürse stop önce sayılıyor',
    stopPriority && stopPriority.exit === 95 && stopPriority.reason === 'Stop' && stopPriority.net < 0,
    JSON.stringify(stopPriority));

  await page.locator('#ajan-performans-guncelle').waitFor({ state: 'attached', timeout: 15000 });
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
      hacimKarar: 'AL', hacimSkor: 2, hataPayi: 'Düşük',
      skor: 80, stopFiyat: 45, hedefFiyat: 60, rr: 2
    }], { source: 'E2E tarama', market: 'Kripto', timeframe: '1h' });
    await new Promise(resolve => setTimeout(resolve, 120));
    const all = await P.listele();
    const stored = all.filter(item => item.id === id);
    const scanStored = all.some(item => item.symbol === 'E2ESCANUSDT' &&
      item.source === 'E2E tarama' && item.decision === 'AL');
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
    return {
      storedOnce: stored.length === 1,
      rawCandlesNotStored: stored.length === 1 && !Array.isArray(stored[0].mumlar),
      scanCount: scanCount,
      scanStored: scanStored,
      retentionDays: P.ayarlar.saklamaGun,
      targetAtNextOpen: target.trade && target.trade.status === 'completed' &&
        target.trade.entry === 100 && target.trade.exit === 110 && target.trade.outcome === 'win',
      stopWinsSameCandleConflict: stop.trade && stop.trade.exit === 95 &&
        stop.trade.reason === 'Stop' && stop.trade.outcome === 'loss',
      waitSeparateFromWinRate: wait.trade === null && wait.direction &&
        wait.direction.classification === 'up' && wait.direction.forwardPct > 0
    };
  });
  check('Performans hafızası sinyalleri tekilleştiriyor, taramaları kaydediyor ve 365 gün tutuyor',
    performanceChecks.storedOnce && performanceChecks.rawCandlesNotStored &&
    performanceChecks.scanCount === 1 && performanceChecks.scanStored &&
    performanceChecks.retentionDays === 365,
    JSON.stringify(performanceChecks));
  check('Canlı sinyal değerlendirmesi sonraki mum açılışını kullanıyor',
    performanceChecks.targetAtNextOpen, JSON.stringify(performanceChecks));
  check('Performans testinde aynı mum stop/hedef çakışmasında stop öncelikli',
    performanceChecks.stopWinsSameCandleConflict, JSON.stringify(performanceChecks));
  check('BEKLE sinyali işlem kazanma oranından ayrı değerlendiriliyor',
    performanceChecks.waitSeparateFromWinRate, JSON.stringify(performanceChecks));


  const backtestEngine = await page.evaluate(() => {
    const oldAnaliz = Analiz.yap;
    const oldAjanlar = window.TahminAI.ajanlaraSor;
    try {
      Analiz.yap = function (m, trend) {
        const result = oldAnaliz.call(this, m, trend);
        result.plan = { stop: 0, t1: 1.5, rr: 2 };
        return result;
      };
      window.TahminAI.ajanlaraSor = function () {
        return { nihai: { son: 'AL' } };
      };
      const rows = Array.from({ length: 120 }, (_, i) => {
        const close = 100 + i * 0.5;
        return {
          t: Date.now() - (120 - i) * 86400000,
          o: close - 0.2, h: close + 1, l: close - 1, c: close, v: 1000 + i * 10
        };
      });
      const result = window.BacktestAI.analizEt(rows, '1d', 0.20, 1);
      return {
        trades: result.islemSayisi,
        entriesAfterSignal: result.islemler.every(trade => trade.girisZamani > trade.sinyalZamani),
        portfolioReturn: result.toplamGetiri
      };
    } finally {
      Analiz.yap = oldAnaliz;
      window.TahminAI.ajanlaraSor = oldAjanlar;
    }
  });
  check('Backtest sinyali sonraki mum açılışında işleme dönüştürüyor',
    backtestEngine.trades > 0 && backtestEngine.entriesAfterSignal,
    JSON.stringify(backtestEngine));

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
  await page.locator('#ara-ad').fill('THYAO.IS');
  await page.locator('#ara-zd').selectOption('1d');
  await page.locator('#ara-btn').click();

  await page.waitForFunction(() => {
    const searchStatus = document.querySelector('#ara-durum')?.textContent || '';
    const analysisStatus = document.querySelector('#analiz-durum')?.textContent || '';
    return searchStatus.includes('⚠️') || analysisStatus.includes('Analiz tamamlandı');
  }, null, { timeout: 120000 });

  const chartStatus = await page.locator('#analiz-durum').innerText();
  const searchStatus = await page.locator('#ara-durum').innerText();
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
  await page.locator('#tahmin-zd').selectOption('1d');
  await page.locator('#tahmin-btn').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#tahmin-durum')?.textContent || '';
    return status.startsWith('Tamamlandı') || status.startsWith('Hata:');
  }, null, { timeout: 600000 });

  const scanStatus = await page.locator('#tahmin-durum').innerText();
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

  const binanceRows = chartPayload.chart.result[0].timestamp.map((timestamp, i) => {
    const quote = chartPayload.chart.result[0].indicators.quote[0];
    return [timestamp * 1000, quote.open[i], quote.high[i], quote.low[i], quote.close[i], quote.volume[i]];
  });
  await page.route('https://data-api.binance.vision/**', async route => {
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(binanceRows) });
  });
  await page.route('https://api.binance.com/**', async route => {
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(binanceRows) });
  });

  // The backtest must use free public history and execute only after the signal candle closes.
  await page.locator('nav button[data-git="strateji"]').click();
  await page.locator('#backtest-panel').waitFor({ state: 'attached', timeout: 15000 });
  await page.locator('#backtest-panel summary').click();
  const historyCheck = await page.evaluate(async () => {
    const data = await Veri.gecmis('THYAO', '1d');
    return { symbol: data.sembol, count: data.mumlar.length, source: data.kaynak };
  });
  check('Ücretsiz Yahoo Finance geçmiş verisi alınıyor',
    historyCheck.symbol === 'THYAO.IS' && historyCheck.count >= 80 && historyCheck.source === 'y',
    JSON.stringify(historyCheck));

  await page.locator('#backtest-sembol').fill('THYAO');
  await page.locator('#backtest-zd').selectOption('1d');
  await page.locator('#backtest-btn').click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#backtest-durum')?.textContent || '';
    return status.startsWith('Test tamamlandı') || status.startsWith('Test tamamlanamadı:');
  }, null, { timeout: 90000 });
  const backtestStatus = await page.locator('#backtest-durum').innerText();
  const backtestText = await page.locator('#backtest-sonuc').innerText();
  check('Ücretsiz geçmiş sinyal testi arayüzü çalışıyor',
    backtestStatus.startsWith('Test tamamlandı') && backtestText.includes('Yahoo Finance') && backtestText.includes('Son mum test dışında'),
    backtestStatus + ' · ' + backtestText.slice(0, 350));


  const yahooVolume = await page.evaluate(async () => {
    const rows = await Veri.yahoo('THYAO.IS', '1d');
    return { count: rows.length, lastVolume: rows[rows.length - 1].v };
  });
  check('Yahoo mumlarında hacim alanı', yahooVolume.count >= 20 && yahooVolume.lastVolume > 0, JSON.stringify(yahooVolume));
  const binanceVolume = await page.evaluate(async () => {
    const rows = await Veri.binance('BTCUSDT', '1d');
    return { count: rows.length, lastVolume: rows[rows.length - 1].v };
  });
  check('Binance mumlarında hacim alanı', binanceVolume.count >= 20 && binanceVolume.lastVolume > 0, JSON.stringify(binanceVolume));

  const timeframeChecks = await page.evaluate(async () => {
    const yahoo15 = await Veri.yahoo('THYAO.IS', '15m');
    const yahoo1h = await Veri.yahoo('THYAO.IS', '1h');
    const binance15 = await Veri.binance('BTCUSDT', '15m');
    const binance1h = await Veri.binance('BTCUSDT', '1h');
    return { yahoo15: yahoo15.length, yahoo1h: yahoo1h.length, binance15: binance15.length, binance1h: binance1h.length };
  });
  check('15 dakika, 1 saat ve günlük veri aralıkları', Object.values(timeframeChecks).every(count => count >= 20), JSON.stringify(timeframeChecks));

  const bistVolumeAgent = await page.evaluate(async () => {
    const result = await TahminAI.taraBir({ q: 'THYAO', ad: 'Türk Hava Yolları' }, '1d');
    return { symbol: result.sembol, lastVolume: result.sonHacim, averageVolume: result.ortHacim20, ratio: result.hacimOrani };
  });
  check('BIST hacim ajanına veri aktarımı', bistVolumeAgent.lastVolume > 0 && bistVolumeAgent.averageVolume > 0 && bistVolumeAgent.ratio > 0, JSON.stringify(bistVolumeAgent));

  const coinVolumeAgent = await page.evaluate(async () => {
    const result = await CoinTahminAI.taraBir({ q: 'BTC', ad: 'Bitcoin' }, '1d');
    return { symbol: result.sembol, price: result.fiyat, volumeScore: result.hacimSkor };
  });
  check('Coin hacim ajanına veri aktarımı', coinVolumeAgent.price > 0 && typeof coinVolumeAgent.volumeScore === 'number', JSON.stringify(coinVolumeAgent));

  const symbolMappings = await page.evaluate(() => ({
    bist: Veri.coz('PGSUS.IS')[0]?.sembol,
    coin: Veri.coz('BTC')[0]?.sembol,
    timeframes: ['15m', '1h', '1d'].every(value => ['15m', '1h', '1d'].includes(value))
  }));
  check('PGSUS.IS ve BTCUSDT sembol eşleştirmesi', symbolMappings.bist === 'PGSUS.IS' && symbolMappings.coin === 'BTCUSDT', JSON.stringify(symbolMappings));

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
    return {
      total: window.CoinTahminAI.LISTE.length,
      scanned: result && result.adaylar ? result.adaylar.length : 0,
      errors: result && result.hatalar ? result.hatalar.length : -1,
      errorDetails: result && result.hatalar ? result.hatalar.slice(0, 8) : [],
      status: document.querySelector('#coin-tahmin-durum')?.textContent || ''
    };
  });
  check(
    'Coin toplu tarama akışı',
    coinScan.scanned > 0 && coinScan.scanned + coinScan.errors === coinScan.total && coinScan.status.startsWith('Tamamlandı'),
    JSON.stringify(coinScan)
  );
  const coinResultText = await page.locator('#coin-tahmin-alan').innerText();
  check(
    'Coin veri hataları kullanıcıya gösteriliyor',
    coinScan.errors === 0 || coinResultText.includes('Veri alınamayanlar'),
    coinResultText.slice(-350)
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
    await page.locator('#admin-giris-btn').count() === 1;
  check('Admin giriş ekranı yükleniyor', adminUI, adminUI ? 'E-posta, şifre ve giriş kontrolleri hazır' : 'Admin giriş alanları eksik');

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
