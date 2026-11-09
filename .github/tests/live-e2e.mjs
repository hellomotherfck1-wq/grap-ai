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

  // Verify the new standalone financial panel and its API contract using deterministic mock responses.
  await page.locator('nav button[data-git="strateji"]').click();
  await page.locator('#finansal-panel').waitFor({ state: 'visible' });
  const financialOptions = await page.locator('#finansal-sembol option').count();
  check('Bağımsız finansal analiz paneli', financialOptions === 100, financialOptions + ' hisse seçeneği');

  await page.locator('#finansal-panel button').click();
  await page.waitForFunction(() => (document.querySelector('#finansal-durum')?.textContent || '').includes('Geçerli bir istfin API anahtarı gir'));
  check('API anahtarı doğrulaması', true, 'Anahtar olmadan istek gönderilmiyor');

  await page.route('https://api.istfin.com/v1/**', async route => {
    const url = new URL(route.request().url());
    const statement = url.pathname.split('/').pop();
    let data;
    if (url.pathname.endsWith('/fundamentals/THYAO')) {
      data = {
        symbol: 'THYAO',
        asOfQuarter: '2026Q2',
        updatedAt: '2026-10-05T21:30:00.000Z',
        valuation: { marketCap: 431250000000, peRatio: 4.8, pbRatio: 0.9, evToEbitda: 3.7 },
        income: { revenue: 645000000000, profit: 89000000000, ebitda: 165000000000 },
        ratios: { currentRatio: 1.1, roe: 19.2, profitMargin: 13.8, netDebtToEbitda: 1.1 },
        growth: { revenueYoY: 21.4, profitYoY: -8.2 },
        balanceSheet: { totalAssets: 1060000000000, totalEquity: 470000000000, totalDebt: 320000000000, cashAndEquivalents: 140000000000 },
        cashFlow: { operating: 150000000000, investing: -95000000000, financing: -30000000000, free: 55000000000 }
      };
    } else {
      data = {
        symbol: 'THYAO',
        statement,
        periods: ['2026-06', '2026-03', '2025-12', '2025-09'],
        items: [{ code: '3C', tr: statement === 'income' ? 'Hasılat' : 'Örnek kalem', values: { '2026-06': 180000000000, '2026-03': 142000000000, '2025-12': 171000000000, '2025-09': 152000000000 } }]
      };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });

  await page.locator('#finansal-sembol').selectOption('THYAO');
  await page.locator('#finansal-api-anahtari').fill('istfin_test_key_for_e2e');
  await page.locator('#finansal-panel button').click();
  await page.waitForFunction(() => (document.querySelector('#finansal-durum')?.textContent || '').includes('Temel analiz tamamlandı'));
  const financialText = await page.locator('#finansal-sonuc').innerText();
  check('Finansal API yanıtı işleniyor', financialText.includes('THYAO') && financialText.includes('F/K'), financialText.slice(0, 350));
  check('Gelir, bilanço ve nakit akış tabloları', ['Gelir tablosu', 'Bilanço', 'Nakit akış tablosu'].every(label => financialText.includes(label)), financialText.includes('Nakit akış tablosu') ? 'Üç tablo da oluşturuldu' : 'Tablo eksik');
  const sharedSymbol = await page.evaluate(() => window.TahminAI?.temelAnaliz?.symbol || '');
  check('Finansal rapor diğer ajanlarla paylaşıldı', sharedSymbol === 'THYAO', sharedSymbol || 'Paylaşılan rapor bulunamadı');
  await page.unroute('https://api.istfin.com/v1/**');

  check('Tarayıcı JavaScript hatası yok', report.pageErrors.length === 0, report.pageErrors.join(' | ') || 'Hata yakalanmadı');
  report.finalURL = page.url();
  report.finishedAt = new Date().toISOString();
  report.consoleErrors = report.consoleErrors.slice(0, 30);

  if (report.checks.some(item => !item.passed)) {
    await page.screenshot({ path: 'live-e2e-failure.png', fullPage: true }).catch(() => {});
  }
} catch (error) {
  report.fatalError = error.stack || error.message || String(error);
  console.error('E2E fatal error:', report.fatalError);
} finally {
  if (browser) await browser.close().catch(() => {});
  report.finishedAt = report.finishedAt || new Date().toISOString();
  fs.writeFileSync('live-e2e-report.json', JSON.stringify(report, null, 2));
  const failed = report.checks.filter(item => !item.passed);
  console.log('E2E summary: ' + report.checks.filter(item => item.passed).length + '/' + report.checks.length + ' passed');
  if (report.fatalError || failed.length) process.exitCode = 1;
}
