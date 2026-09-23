// ==========================================
// ไฟล์: indexeddb.js
// ระบบจัดการฐานข้อมูล Local สำหรับ IT UDON HOSP
// ==========================================

const DB_NAME = 'IT_UDH_DB';
const DB_VERSION = 1;

// กำหนดชื่อ Object Store ตามโครงสร้างระบบ
const STORE_ASSET = 'ASSET';
const STORE_DEPARTMENT = 'DEPARTMENT';
const STORE_PM = 'PM';
const STORE_SYNC_QUEUE = 'SYNC_QUEUE';

const idbApp = {
    db: null,

    // 1. ฟังก์ชันเริ่มต้นสร้าง/เชื่อมต่อฐานข้อมูล
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // สร้าง Store เผื่อไว้สำหรับ Production (ตามที่คุณระบุ)
                if (!db.objectStoreNames.contains(STORE_ASSET)) {
                    // ใช้ AssetID เป็น Key หลักในการอ้างอิง
                    db.createObjectStore(STORE_ASSET, { keyPath: 'AssetID' });
                }
                if (!db.objectStoreNames.contains(STORE_DEPARTMENT)) {
                    db.createObjectStore(STORE_DEPARTMENT, { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains(STORE_PM)) {
                    db.createObjectStore(STORE_PM, { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
                    db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB Init Error:", event.target.errorCode);
                reject(event.target.error);
            };
        });
    },

    // ==========================================
    // ส่วนเชื่อมต่อเฉพาะ ASSET SEARCH 
    // ==========================================

    // 2. บันทึกข้อมูลครุภัณฑ์ทั้งหมดจาก Server ลง IndexedDB
    saveAssets: function(assetsArray) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("Database not initialized");
            
            const transaction = this.db.transaction([STORE_ASSET], 'readwrite');
            const store = transaction.objectStore(STORE_ASSET);

            // ล้างข้อมูลเก่าก่อนเคลียร์ทับใหม่ เพื่อป้องกันข้อมูลตกค้าง
            const clearRequest = store.clear();
            
            clearRequest.onsuccess = () => {
                assetsArray.forEach(asset => {
                    // จัดเตรียม KeyPath ให้ตรงกับโครงสร้างข้อมูลจากฝั่ง Google Apps Script ของคุณ
                    const assetId = asset.AssetID || (asset.Asset_Detail ? asset.Asset_Detail.AssetID : null);
                    if (assetId) {
                        let itemToSave = { ...asset };
                        itemToSave.AssetID = assetId; // บังคับสร้าง keyPath ไว้ชั้นนอก
                        store.put(itemToSave);
                    }
                });
            };

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (event) => reject(event.target.error);
        });
    },

    // 3. ดึงข้อมูลครุภัณฑ์ทั้งหมดจาก IndexedDB ไปใช้งาน
    getAllAssets: function() {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("Database not initialized");
            
            const transaction = this.db.transaction([STORE_ASSET], 'readonly');
            const store = transaction.objectStore(STORE_ASSET);
            const request = store.getAll();

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }
};
