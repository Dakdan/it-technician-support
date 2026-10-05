/* ==========================================================================
   PART 1: IndexedDB Helper (idbApp)
   รองรับ Offline-First Data Caching ร่วมกับ Google Apps Script API
   ========================================================================== */
const idbApp = {
    dbName: 'ITAssetDB',
    dbVersion: 1,
    storeName: 'assets',
    db: null,

    // 1.1 เริ่มต้นเปิดการเชื่อมต่อฐานข้อมูล
    init: function () {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            if (!('indexedDB' in window)) {
                console.warn("เบราว์เซอร์นี้ไม่รองรับ IndexedDB ระบบจะทำงานในโหมดออนไลน์");
                resolve(null);
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // กำหนด AssetID เป็น KeyPath หลัก
                    db.createObjectStore(this.storeName, { keyPath: 'AssetID' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB Open Error:", event.target.error);
                resolve(null); // Return null เพื่อให้หน้าเว็บไปดึงข้อมูลออนไลน์ต่อได้โดยไม่ค้าง
            };
        });
    },

    // 1.2 ดึงข้อมูลครุภัณฑ์ทั้งหมดจาก IndexedDB
    getAllAssets: function () {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve([]);
                return;
            }

            try {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    resolve(request.result || []);
                };

                request.onerror = (event) => {
                    console.error("IndexedDB getAll Error:", event.target.error);
                    resolve([]);
                };
            } catch (err) {
                console.error("IndexedDB getAll Exception:", err);
                resolve([]);
            }
        });
    },

    // 1.3 บันทึก/อัปเดตข้อมูลลง IndexedDB
    saveAssets: function (assetsArray) {
        return new Promise((resolve, reject) => {
            if (!this.db || !Array.isArray(assetsArray) || assetsArray.length === 0) {
                resolve(false);
                return;
            }

            try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);

                // เคลียร์ข้อมูลเก่าก่อนลงข้อมูลใหม่ เพื่อป้องกันข้อมูลตกค้าง
                const clearRequest = store.clear();

                clearRequest.onsuccess = () => {
                    assetsArray.forEach((item, index) => {
                        if (item) {
                            // Normalize AssetID เพื่อป้องกัน DataError กรณี AssetID ซ่อนอยู่ใน Asset_Detail
                            const primaryKey = item.AssetID || (item.Asset_Detail && item.Asset_Detail.AssetID) || `TEMP_KEY_${index}`;
                            
                            const dataToSave = {
                                ...item,
                                AssetID: String(primaryKey).trim()
                            };
                            
                            store.put(dataToSave);
                        }
                    });
                };

                transaction.oncomplete = () => {
                    resolve(true);
                };

                transaction.onerror = (event) => {
                    console.error("IndexedDB saveAssets Error:", event.target.error);
                    reject(event.target.error);
                };
            } catch (err) {
                console.error("IndexedDB saveAssets Exception:", err);
                reject(err);
            }
        });
    }
};


/* ==========================================================================
   PART 2: PWA & Service Worker Manager
   จัดการการลงทะเบียน Service Worker และปุ่มติดตั้งแอป (Android/iOS/Desktop)
   ========================================================================== */
let deferredPrompt = null;

// 2.1 ตรวจสอบสถานะการใช้งาน
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// 2.2 ลงทะเบียน Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('ServiceWorker registered with scope:', reg.scope);
            })
            .catch((err) => {
                console.error('ServiceWorker registration failed:', err);
            });
    });
}

// 2.3 ดักจับ Event ก่อนเปิด Prompt ติดตั้งแอป (Android / Chrome / Edge)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const installBtn = document.getElementById('installAppBtn');
    if (installBtn && !isStandalone()) {
        installBtn.style.display = 'block';

        installBtn.onclick = async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User choice outcome: ${outcome}`);
            deferredPrompt = null;
            installBtn.style.display = 'none';
        };
    }
});

// 2.4 จัดการ UI ปุ่มติดตั้ง PWA เมื่อ DOM พร้อมทำงาน
document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('installAppBtn');
    const iosInstructions = document.getElementById('iosInstallBanner');

    // ถ้าเปิดในโหมดแอป PWA (Standalone) เรียบร้อยแล้ว ให้ซ่อนปุ่มทั้งหมด
    if (isStandalone()) {
        if (installBtn) installBtn.style.display = 'none';
        if (iosInstructions) iosInstructions.style.display = 'none';
        return;
    }

    // กรณีใช้งานผ่าน iOS Safari
    if (isIOS() && installBtn) {
        installBtn.style.display = 'block';
        installBtn.addEventListener('click', () => {
            if (iosInstructions) {
                iosInstructions.style.display = 'block';
            } else {
                alert('วิธีติดตั้งบน iPhone/iPad:\n1. กดปุ่ม "แชร์" (Share) ที่แถบล่างสุดของ Safari\n2. เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)');
            }
        });
    }
});

// 2.5 เมื่อติดตั้งแอปสำเร็จ
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed successfully!');
    deferredPrompt = null;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'none';
});
