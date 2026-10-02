/* Reise nach Japan – Service Worker (Offline-Cache)
   Zwei Caches:
   - CACHE (Code, klein): Version zaehlt tools/commit.ps1 bei jeder Aenderung am Spiel hoch. Bei einer
     neuen Version wird der Code frisch geholt – am HTTP-Cache des Browsers vorbei (GitHub Pages
     schickt max-age=600, sonst kaeme bis zu 10 min lang die alte Datei in den neuen Cache).
   - MODELLE (gross, > 100 MB *_glb.js): eigene Version, zaehlt nur hoch, wenn sich ein Modell
     aendert. So muss nicht bei jedem Update alles neu geladen werden. */
const CACHE   = 'reise-nach-japan-v15';
const MODELLE = 'reise-nach-japan-modelle-v1';

/* Kern-Dateien: sofort bei der Installation cachen. */
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './story.js',
  './etappe2.js',
  './engine/engine.js',
  './engine/three.min.js',
  './engine/GLTFLoader.js',
  './engine/sounds.js',
  './engine/ambient.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];
const istModell = (url) => /_glb\.js$/.test(new URL(url).pathname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache:'reload' = am HTTP-Cache vorbei, wirklich die neue Datei vom Server
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MODELLE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first mit Nachfuellen (Modelle in ihren eigenen Cache). */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const ziel = istModell(req.url) ? MODELLE : CACHE;
  event.respondWith(
    caches.open(ziel).then((c) => c.match(req, { ignoreSearch: true })).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(ziel).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
