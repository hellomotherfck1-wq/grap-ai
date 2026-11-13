'use strict';

const worker = require('../../scripts/evaluate-pending-results.cjs');

async function main() {
  const providers = [
    { name: 'Gate.io', fetch: worker.fetchGateBars },
    { name: 'Bybit', fetch: worker.fetchBybitBars }
  ];
  let available = 0;
  for (const provider of providers) {
    try {
      const bars = await provider.fetch('BTCUSDT', '1h');
      const latest = bars[bars.length - 1];
      available += 1;
      console.log('PASS ' + provider.name + ' BTCUSDT 1h · ' + bars.length +
        ' mum · son kapanış ' + new Date(latest.t).toISOString());
    } catch (error) {
      console.log('WARN ' + provider.name + ' BTCUSDT 1h · ' + worker.safeError(error));
    }
  }
  if (!available) {
    console.log('WARN: GitHub Actions sunucusundan erişilebilen alternatif kripto mum kaynağı bulunamadı.');
    process.exitCode = 1;
  }
}

main().catch(function (error) {
  console.error('Kripto veri kaynağı kontrolü tamamlanamadı:', worker.safeError(error));
  process.exitCode = 1;
});
