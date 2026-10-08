/* ==========================================================================
   sw.js : Service Worker สำหรับจัดการ Offline Cache (IT-UDH PWA)
   ========================================================================== */

const CACHE_NAME = 'it-udh-pwa-v3';

// 1. เพิ่มไฟล์ระบบหลักให้ครอบคลุมทุกไฟล์ที่ต้องใช้ขณะออฟไลน์
const urlsToCache = [
  './',
  './index.html',
  './main_menu.html',
  './auth-check.js',
  './login-script.js',
  './app-core.js',
  './indexeddb.js',
  './invstock.js',
  './manifest.json',
  './logo512.png',
  './logo003v11.png'
];

// 1. Install Event : ดาวน์โหลดและบันทึก Assets ตั้งต้น
self.addEventListener('install', (event) => {
  self.skipWaiting(); // บังคับให้ SW ตัวใหม่ทำงานทันที
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

// 2. Activate Event : เคลียร์ Cache เวอร์ชันเก่า
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

// 3. Fetch Event : จัดการการดึงข้อมูลแบบ Smart Hybrid Strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const reqUrl = req.url;

  // ❌ ข้าม Request ที่ไม่ใช่ GET หรือส่งไปยัง Google Apps Script / Drive / External API
  if (req.method !== 'GET' || reqUrl.includes('script.google.com') || reqUrl.includes('googleusercontent.com')) {
    return;
  }

  // 🅰️ สำหรับไฟล์ HTML / Navigation (ใช้ Network-First เพื่อให้ได้เวอร์ชันล่าสุดเสมอ)
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          // ถ้าดึงจาก Server ได้ ให้เก็บลง Cache สำรองไว้
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return networkResponse;
        })
        .catch(() => {
          // กรณีเน็ตหลุด ให้ไปดึงจาก Cache หรือแสดงหน้า Fallback
          return caches.match(req).then((cached) => {
            return cached || caches.match('./main_menu.html') || caches.match('./index.html') || caches.match('./');
          });
        })
    );
    return;
  }

  // 🅱️ สำหรับไฟล์ Assets ทั่วไป (JS, CSS, Images, Fonts) ใช้ Cache-First
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        // ยอมรับเฉพาะ HTTP 200 และประเภท basic/cors (รองรับ CDN เช่น FontAwesome, Bootstrap)
        if (!networkResponse || networkResponse.status !== 200 || 
           (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      }).catch((err) => {
        console.warn(`[SW] Fetch failed for: ${reqUrl}`, err);
      });
    })
  );
});
