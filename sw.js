const SURUM = 'graph-ai-v40';
const DOSYALAR = [
  './',
  './index.html',
  './css/stil.css',
  './manifest.json',
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
  './js/ajan.js',
  './js/ajan2.js',
  './js/ajan-fk.js',
  './js/arayuz.js',
  './js/tahmin.js',
  './js/bist-arastirma.js',
  './js/finansal-panel.js',
  './js/haber-ajani.js',
  './js/kripto-ajanlari.js',
  './js/coin-tahmin.js',
  './js/ajan-performans.js',
  './js/admin.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SURUM)
      .then(cache => Promise.allSettled(DOSYALAR.map(async dosya => {
        const response = await fetch(dosya, { cache: 'reload' });
        if (response.ok) await cache.put(dosya, response);
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== SURUM).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(SURUM);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const home = await caches.match('./index.html');
        if (home) return home;
      }
      return new Response('Çevrimdışı: Bu dosya henüz önbelleğe alınmadı.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
