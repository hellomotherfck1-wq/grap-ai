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
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });

  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  check('Canlı site HTTP yanıtı', Boolean(response && response.ok()), response ? String(response.status()) : 'Yanıt alınamadı');

  await page.waitForFunction(() =>
    Boolean(window.TahminAI && window.BistArastirma && window.GrafikAI) &&
    typeof Veri !== 'undefined' && typeof Analiz !== 'undefined' && typeof Cizim !== 'undefined',
    null,
    { timeout: 45000 }
  );
  check('Uygulama modülleri yüklendi', true, 'Veri / Analiz / Grafik / BIST araştırma ajanı');

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
  check('Teknik grafik canvas çizimi', canvasCount > 0, canvasCount + ' canvas');

  if (chartStatus.includes('Analiz tamamlandı')) {
    await page.waitForFunction(() => {
      const text = document.querySelector('#tuval-alan')?.innerText || '';
      return text.includes('Araştırma Ajanı') || text.includes('Araştırma ajanı şu anda veri alamadı');
    }, null, { timeout: 60000 }).catch(() => {});
    const chartAreaText = await page.locator('#tuval-alan').innerText();
    check('Grafik sonrası araştırma özeti', chartAreaText.includes('Araştırma Ajanı') || chartAreaText.includes('Araştırma ajanı şu anda veri alamadı'), chartAreaText.slice(-600));
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
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Dönem Kârı (Zararı)</span></td><td class="taxonomy-context-value">123.456,00</td><td class="taxonomy-context-value">100.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Toplam Varlıklar</span></td><td class="taxonomy-context-value">5.000.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Toplam Özkaynaklar</span></td><td class="taxonomy-context-value">2.000.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Dönen Varlıklar</span></td><td class="taxonomy-context-value">1.500.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Kısa Vadeli Yükümlülükler</span></td><td class="taxonomy-context-value">1.000.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Nakit ve Nakit Benzerleri</span></td><td class="taxonomy-context-value">250.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Kısa Vadeli Borçlanmalar</span></td><td class="taxonomy-context-value">300.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">Uzun Vadeli Borçlanmalar</span></td><td class="taxonomy-context-value">500.000,00</td></tr>
        <tr class="x_role_data-input-row y presentation-enabled"><td><span class="gwt-Label multi-language-content content-tr">İşletme Faaliyetlerinden Nakit Akışları</span></td><td class="taxonomy-context-value">200.000,00</td></tr>
      </table></body></html>`;
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'text/html; charset=utf-8', body: html });
      return;
    }
    await route.fulfill({ status: 502, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ error: 'Unexpected test URL', requested }) });
  });

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
  check('KAP bildirimleri ve haberler', financialText.includes('2026 ikinci çeyrek finansal raporu') && financialText.includes('THYAO ücretsiz test haber başlığı'), financialText.includes('Özel durum açıklaması') ? 'Finansal rapor, özel durum ve haber listelendi' : 'KAP veya haber eksik');
  const sharedSymbol = await page.evaluate(() => window.TahminAI?.temelAnaliz?.symbol || '');
  check('Ücretsiz araştırma diğer ajanlarla paylaşıldı', sharedSymbol === 'THYAO', sharedSymbol || 'Paylaşılan rapor bulunamadı');
  const apiKeyFields = await page.locator('#finansal-panel input[type="password"]').count();
  check('Ücretli API anahtarı alanı kaldırıldı', apiKeyFields === 0, apiKeyFields + ' parola alanı');
  await page.unroute('https://grafik-vekil.hellomotherfck1.workers.dev/**');
  await page.unroute('https://query1.finance.yahoo.com/v8/finance/chart/THYAO.IS**');

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
