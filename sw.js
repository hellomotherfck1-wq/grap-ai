const SURUM = 'graph-ai-v4';
const DOSYALAR = [
  './', 'index.html', 'css/stil.css', 'js/arayuz.js', 'js/goruntu.js',
  'manifest.json', 'icons/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SURUM).then(c =>
    Promise.allSettled(DOSYALAR.map(d => c.add(d)))
  ));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(k => Promise.all(k.filter(x => x !== SURUM).map(x => caches.delete(x))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const kopya = r.clone();
      caches.open(SURUM).then(c => c.put(e.request, kopya));
      return r;
    }).catch(() => caches.match(e.request))
  );
}); 
