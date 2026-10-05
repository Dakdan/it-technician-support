const CACHE_NAME = 'it-udh-pwa-v2';
const urlsToCache = [
  './',
  './index.html',
  './main_menu.html',
  './invstock.js',
  './manifest.json',
  './indexeddb.js',
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

// 3. Fetch Event (ข้ามการ Cache หากเป็น API ของ Google Apps Script)
self.addEventListener('fetch', (event) => {
  const reqUrl = event.request.url;

  // ปล่อยผ่าน Request ที่ยิงไปยัง Google Apps Script API หรือ external domain ไม่ต้อง Cache
  if (reqUrl.includes('script.google.com') || reqUrl.includes('googleusercontent.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fallback กรณีออฟไลน์และเข้าหน้าหลัก
        if (event.request.mode === 'navigate') {
          return caches.match('./main_menu.html');
        }
      });
    })
  );
});
