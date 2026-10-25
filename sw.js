// Service worker : l'app fonctionne hors ligne une fois visitée.
// Réseau d'abord pour tout : en ligne, on a toujours la dernière version publiée,
// sans numéro de version à gérer. Le cache ne sert qu'hors ligne.
const CACHE = 'hc';
const SHELL = ['./', 'index.html', 'style.css', 'js/app.js', 'js/rules.js', 'js/art.js', 'manifest.json', 'icon.svg', 'puzzles/index.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Nettoie les caches des anciennes versions (hc-v1, hc-v2…).
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  // no-cache : revalide auprès du serveur (GitHub Pages met 10 min de cache HTTP).
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
