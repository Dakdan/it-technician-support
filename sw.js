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
  self.skipWaiting(); // บังคับให้ Service Worker ตัวใหม่ทำงานทันที
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

  // ข้ามการตรวจ Cache สำหรับ Request ที่ไม่ใช่ GET (เช่น POST Data ไป Apps Script)
  // หรือ Request ที่ยิงไปยัง Domain ของ Google
  if (req.method !== 'GET' || reqUrl.includes('script.google.com') || reqUrl.includes('googleusercontent.com')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      // 3.1 ดึงไฟล์จาก Cache หากมีเก็บไว้แล้ว
      if (cachedResponse) {
        return cachedResponse;
      }

      // 3.2 หากไม่มีใน Cache ให้ดึงจาก Network และบันทึกเข้า Cache อัตโนมัติ (Dynamic Caching)
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
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
          return caches.match('./main_menu.html') || caches.match('./index.html');
        }
      });
    })
  );
});
