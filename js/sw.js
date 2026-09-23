// sw.js

const CACHE_NAME = 'invstock-pwa-cache-v1';
const urlsToCache = [
  '/',
  '/add_inv_stock.html', // เปลี่ยนชื่อให้ตรงกับไฟล์ HTML หลักของคุณ
  '/invstock.js',
  '/manifest.json'
  // หากมีไฟล์ CSS, JS รูปภาพ หรือไอคอนอื่นๆ ให้เพิ่ม URL ลงที่นี่
];

// ติดตั้ง Service Worker และ Caching ไฟล์ที่กำหนด
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
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
