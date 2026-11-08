// Hisaab Barabar Progressive Web App Service Worker
const CACHE_NAME = 'hisaab-cache-v5';
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache note:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First for Navigation (HTML) to guarantee users always get the latest bundle
// Stale-While-Revalidate for cached static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip Firestore, Google APIs, and external endpoints
  if (url.origin !== self.location.origin) return;

  // Skip Vite dev internals, APIs, HMR, and source modules
  if (
    url.pathname.startsWith('/@') || 
    url.pathname.startsWith('/api') || 
    url.pathname.startsWith('/src') ||
    url.pathname.startsWith('/node_modules') || 
    url.pathname.includes('vite')
  ) {
    return;
  }

  // 1. Navigation (HTML documents): Network-first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/') || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, images, fonts): Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle incoming background push events if supported
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Hisaab Barabar Update';
    const options = {
      body: data.body || 'You have a new update in your ledger.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: data
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn('Push notification error:', err);
  }
});
