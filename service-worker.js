const CACHE_NAME = 'riflelog-v43';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-180-v2.png',
  './icon-512-v2.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== 'riflelog-runtime').map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Eksterne filer som kan lagres: biblioteket og skriftene. Alt annet (som databasen) går rett til nettet.
const RUNTIME_HOSTS = ['esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    // Bruk lagret kopi med en gang og oppdater i bakgrunnen
    event.respondWith(
      caches.open('riflelog-runtime').then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
