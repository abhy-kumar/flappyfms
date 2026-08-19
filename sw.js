/* ==========================================================================
   SERVICE WORKER - FLAPPY FMS (PWA NETWORK-FIRST & OFFLINE CACHE)
   ========================================================================== */

const CACHE_NAME = 'flappyfms-v2.3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './bird.png',
  './bird.jpeg',
  './js/store.js',
  './js/audio.js',
  './js/game.js',
  './js/app.js',
  './robots.txt',
  './sitemap.xml',
  './llms.txt',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Press+Start+2P&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('SW pre-cache note:', err);
      });
    })
  );
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Don't intercept Firebase RTDB REST API requests
  if (event.request.url.includes('firebaseio.com') || event.request.url.includes('firebasedatabase.app')) {
    return;
  }

  // Network-First for app code (HTML, JS, CSS) to guarantee instant live updates
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
