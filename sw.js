// Chapelwood Resource Finder — Service Worker
// NOTE: When promoting to production, change all /Chapelwood-Resource-Tool-Dev/ paths
// to /Chapelwood-Resource-Tool/ and bump CACHE_NAME to cw-resources-v2.

const CACHE_NAME = 'cw-resources-v1';

const SHELL_FILES = [
  '/Chapelwood-Resource-Tool-Dev/',
  '/Chapelwood-Resource-Tool-Dev/index.html',
  '/Chapelwood-Resource-Tool-Dev/admin-tool.html',
  '/Chapelwood-Resource-Tool-Dev/manifest.json',
  '/Chapelwood-Resource-Tool-Dev/icons/icon-192.png',
  '/Chapelwood-Resource-Tool-Dev/icons/icon-512.png',
];

const DATA_FILES = [
  '/Chapelwood-Resource-Tool-Dev/resources.json',
];

// ── INSTALL — pre-cache shell + data ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([...SHELL_FILES, ...DATA_FILES])
    )
  );
  self.skipWaiting();
});

// ── ACTIVATE — delete old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH — cache-first for shell, network-first for data ────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for resources.json — always try to get fresh data
  if (url.pathname.endsWith('resources.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for shell files
  if (SHELL_FILES.some(f => url.pathname === f || url.href === event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Everything else (fonts, CDN libs, APIs, map tiles): network only
});

// ── UPDATE NOTIFICATION — tell clients a new version is waiting ──────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
