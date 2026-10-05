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

// ติดตั้ง Service Worker แบบปลอดภัย
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
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

// ดึงข้อมูลจาก Cache (เพิ่มเงื่อนไขป้องกันการพังของ API ภายนอก)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. ถ้าไม่ใช่ Method 'GET' (เช่น POST ส่งข้อมูลไป Google Sheets) หรือเป็นลิงก์ Apps Script ให้ปล่อยผ่าน Network ปกติทันที
  if (event.request.method !== 'GET' || url.hostname.includes('script.google.com')) {
    return;
  }

  // 2. สำหรับไฟล์ภายในเว็บ ให้ใช้ระบบ Cache ปกติ
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // เผื่อกรณีออฟไลน์แล้วโหลดหน้าเว็บไม่พบ
          if (event.request.destination === 'document') {
            return caches.match('./main_menu.html');
          }
        });
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
