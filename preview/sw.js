/* Service worker for the Personal Finance Tracker PWA.
   Precaches the app shell so the app loads full-screen and offline from the
   home screen (Req 10.4). No build tooling / Workbox — plain SW API. */

const CACHE = 'finance-tracker-v38';

/** App shell: everything needed for a cold offline start. Relative paths so
    the SW works regardless of the base path it's served from. */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './src/styles.css',
  './src/main.js',
  './src/types.js',
  './src/data/db.js',
  './src/lib/dates.js',
  './src/lib/dom.js',
  './src/lib/format.js',
  './src/lib/i18n.js',
  './src/lib/icons.js',
  './src/lib/validation.js',
  './src/state/store.js',
  './src/views/modal.js',
  './src/views/monthSelect.js',
  './src/views/transactionForm.js',
  './src/views/transactions.js',
  './src/views/categoryManager.js',
  './src/views/settings.js',
  './src/views/photoViewer.js',
  './src/views/beranda.js',
  './src/views/wallets.js',
  './src/views/lainnya.js',
  './src/views/budget.js',
  './src/views/assets.js',
  './src/views/debts.js',
  './src/views/investments.js',
  './src/views/laporan.js',
  './src/views/chart.js',
  './icons/favicon.svg',
  './icons/apple-touch-icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

// Precache the shell. Use individual adds so one failure doesn't abort install.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
      self.skipWaiting();
    })()
  );
});

// Clean up old caches on activate.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Fetch strategy:
//  - Navigations: network-first, fall back to cached index.html when offline
//    (so the app always boots from the home screen).
//  - Same-origin assets: cache-first, updating the cache in the background.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't touch cross-origin

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put('./index.html', fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached =
            (await caches.match('./index.html')) || (await caches.match('./'));
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) {
        // Revalidate in the background.
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE).then((c) => c.put(req, res.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        return Response.error();
      }
    })()
  );
});
