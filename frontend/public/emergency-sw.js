/** Acil mod — harita karoları ve uygulama kabuğu önbelleği */
const SHELL = 'afet-shell-v1';
const TILES = 'afet-osm-tiles-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      cache.addAll(['/', '/index.html', '/favicon.svg']).catch(() => undefined)
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function isOsmTile(url) {
  return url.includes('tile.openstreetmap.org') || url.includes('tiles.openstreetmap');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = request.url;

  if (isOsmTile(url)) {
    event.respondWith(
      caches.open(TILES).then(async (cache) => {
        const cached = await cache.match(request);
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return cached || new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  if (url.includes('/data/') && url.endsWith('.json')) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const cached = await cache.match(request);
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return cached;
        }
      })
    );
  }
});
