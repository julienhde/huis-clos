// Service worker : l'app fonctionne hors ligne une fois visitée.
// Incrémente VERSION à chaque déploiement qui touche aux fichiers de l'app.
const VERSION = 'hc-v5';
const SHELL = ['./', 'index.html', 'style.css', 'js/app.js', 'js/rules.js', 'js/art.js', 'manifest.json', 'icon.svg', 'puzzles/index.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Grilles : réseau d'abord (pour voir les nouvelles), cache en secours.
// Le reste : cache d'abord.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  if (url.pathname.includes('/puzzles/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
        .catch(() => caches.match(e.request)),
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
