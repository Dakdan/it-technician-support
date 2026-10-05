const CACHE_NAME = 'invstock-pwa-cache-v1';
const urlsToCache = [
  './',
  './main_menu.html',
  './invstock.js',
  './manifest.json',
  './indexeddb.js',
  './logo512.png',
  './logo003v11.png'
];

// ติดตั้ง Service Worker แบบปลอดภัย (ถ้าไฟล์ไหนหาไม่เจอ จะเตือนใน Console แต่ไม่ทำให้แอปพัง)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // ใช้ Promise.all และ catch ทีละไฟล์ เพื่อกัน Error 404 ทำให้ Service Worker ล่ม
        return Promise.all(
          urlsToCache.map((url) => {
            return cache.add(url).catch((error) => {
              console.warn(`Failed to cache: ${url}`, error);
            });
          })
        );
      })
  );
});

// ดึงข้อมูลจาก Cache เมื่อมีการ Request (ช่วยให้ออฟไลน์ได้)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // ถ้าเจอไฟล์ใน Cache ให้ส่งคืน
        if (response) {
          return response;
        }
        // ถ้าไม่เจอให้ไปโหลดจาก Network
        return fetch(event.request);
      })
  );
});

// อัปเดตและลบ Cache เก่า
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
