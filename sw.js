const V = 'allomapiol-beta-3';
const FICHIERS = ['./', 'index.html', 'app.css', 'app.js', 'logo-white.png', 'logo-dark.png', 'sym-white.png', 'sym-violet.png', 'icone-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FICHIERS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((k) => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
