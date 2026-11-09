const SURUM = 'graph-ai-v10';

const DOSYALAR = [
  './',
  './index.html',
  './manifest.json',
  './css/stil.css',
  './icons/icon.svg',
  './js/goruntu.js',
  './js/formasyon.js',
  './js/analiz.js',
  './js/yorum.js',
  './js/formasyon2.js',
  './js/tani.js',
  './js/cizim.js',
  './js/ocr.js',
  './js/veri.js',
  './js/liste.js',
  './js/bist100.js',
  './js/yahoo3.js',
  './js/ajan.js',
  './js/ajan2.js',
  './js/arayuz.js',
  './js/tahmin.js',
  './js/coin-tahmin.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil((async function() {
    const cache = await caches.open(SURUM);
    const results = await Promise.allSettled(
      DOSYALAR.map(function(dosya) { return cache.add(dosya); })
    );
    const hatalar = results
      .map(function(sonuc, i) {
        return sonuc.status === 'rejected' ? DOSYALAR[i] : null;
      })
      .filter(Boolean);

    if (hatalar.length) console.warn('Önbelleğe alınamayan dosyalar:', hatalar);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    const anahtarlar = await caches.keys();
    await Promise.all(
      anahtarlar
        .filter(function(anahtar) { return anahtar !== SURUM; })
        .map(function(anahtar) { return caches.delete(anahtar); })
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  const istekURL = new URL(event.request.url);
  if (istekURL.origin !== self.location.origin) return;

  event.respondWith((async function() {
    try {
      const yanit = await fetch(event.request);
      if (yanit && yanit.ok) {
        const cache = await caches.open(SURUM);
        await cache.put(event.request, yanit.clone());
      }
      return yanit;
    } catch (hata) {
      const kayitli = await caches.match(event.request);
      if (kayitli) return kayitli;

      if (event.request.mode === 'navigate') {
        const anaSayfaURL = new URL('./index.html', self.registration.scope).href;
        const anaSayfa = await caches.match(anaSayfaURL);
        if (anaSayfa) return anaSayfa;
      }

      return new Response('Çevrimdışı: Bu dosya önbellekte bulunamadı.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
