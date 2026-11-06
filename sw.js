/* Service worker: la app funciona sin conexión.
   - Archivos propios: red primero, caché como respaldo (así no se queda con código viejo).
   - SweetAlert (CDN): caché después de la primera carga. */

const CACHE = 'jeopardy-uth-v3';
const CORE = ['./', './index.html', './index.css', './css/extras.css', './css/theme.css', './css/mobile.css', './buzzer.html', './manifest.webmanifest'];

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
    const url = new URL(req.url);
    const sameOrigin = url.origin === location.origin;
    const cdn = url.hostname === 'cdn.jsdelivr.net';
    if (!sameOrigin && !cdn) return;

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
