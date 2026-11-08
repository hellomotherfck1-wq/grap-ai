const SURUM = 'graph-ai-v2';
const DOSYALAR = [
  './', 'index.html', 'css/stil.css', 'js/arayuz.js',
  'manifest.json', 'icons/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(DOSYALAR)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(k => Promise.all(k.filter(x => x !== SURUM).map(x => caches.delete(x))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
}); 
