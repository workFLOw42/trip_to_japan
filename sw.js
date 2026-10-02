/* Reise nach Japan – Service Worker (Offline-Cache)
   Die Version zaehlt der pre-commit-Hook (tools/pre-commit) automatisch hoch, sobald sich eine
   gecachte Datei aendert. Neue Version -> alter Cache wird verworfen, alles frisch geladen. */
const CACHE = 'reise-nach-japan-v2';

/* Kern-Dateien: sofort bei der Installation cachen. */
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './story.js',
  './engine/engine.js',
  './engine/three.min.js',
  './engine/GLTFLoader.js',
  './engine/sounds.js',
  './engine/ambient.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

/* Grosse Modelle (*_glb.js, zusammen > 100 MB) NICHT vorab, sondern beim ersten Laden cachen.
   Nach einem kompletten Durchlauf mit Netz ist das Spiel damit offline spielbar. */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first mit Nachfuellen. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});