// Minimal service worker. Its only jobs: (1) make the app installable
// (browsers require a fetch handler), and (2) cache immutable static assets
// for fast repeat loads / light offline support.
//
// It deliberately does NOT cache HTML pages or API responses, so it can never
// serve one user's data to another or show stale content — every page and
// data request still goes straight to the network as normal.
const CACHE = 'reading-app-static-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname === '/icon.svg' ||
      url.pathname === '/manifest.webmanifest');

  if (!isStatic) return; // everything else: let the browser hit the network

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
