/* Service worker: la app funciona sin conexión.
   Red primero y caché como respaldo, así nunca se queda con código viejo.
   Todo lo que se carga una vez (JS/CSS con hash, imágenes, audio) queda en caché. */

const CACHE = 'concursillo-uth-v4';
const CORE = ['./', './index.html', './buzzer.html', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || req.headers.has('range')) return;
    if (new URL(req.url).origin !== location.origin) return;

    e.respondWith(
        fetch(req)
            .then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req))
    );
});
