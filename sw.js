const CACHE_NAME = 'it-udh-pwa-v3';
const urlsToCache = [
  './',
  './index.html',
  './main_menu.html',
  './app-core.js',
  './indexeddb.js',
  './invstock.js',
  './manifest.json',
  './logo512.png',
  './logo003v11.png'
];

// 1. Install & Cache Static Assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        urlsToCache.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache: ${url}`, err);
          });
        })
      );
    })
  );
});

// 2. Activate & Clear Old Cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const reqUrl = req.url;

  // ข้ามการตรวจ Cache สำหรับ Request ที่ไม่ใช่ GET หรือยิงไป Google API
  if (req.method !== 'GET' || reqUrl.includes('script.google.com') || reqUrl.includes('googleusercontent.com')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        // ปรับเงื่อนไขให้ยอมรับ 'cors' เพื่อให้ Cache CDN (เช่น FontAwesome, Bootstrap) ได้ด้วย
        if (!networkResponse || networkResponse.status !== 200 || 
           (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback กรณีออฟไลน์และเป็นการเปลี่ยนหน้า (Navigation)
        if (req.mode === 'navigate') {
          return caches.match('./main_menu.html') || caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
