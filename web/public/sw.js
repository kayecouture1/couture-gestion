// Service worker minimal : met en cache l'interface (fichiers statiques du même site) pour un démarrage rapide.
// Il ne met JAMAIS en cache les données (API, Supabase, factures) : celles-ci passent toujours par le réseau.
const VERSION = 'cg-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match('/'))); return; }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copie = res.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); return res; })));
  }
});
