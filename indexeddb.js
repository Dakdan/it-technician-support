/* ==========================================================================
   indexeddb.js : คลังเก็บข้อมูลกลางในเบราว์เซอร์ (IndexedDB Helper)
   ========================================================================== */

const idbApp = {
  dbName: 'ITAssetGlobalDB',
  dbVersion: 1,
  storeName: 'assets',
  db: null,

  // 1. เริ่มต้นเปิดฐานข้อมูล
  init: function () {
    return new Promise((resolve) => {
      if (this.db) {
        resolve(this.db);
        return;
      }
      if (!('indexedDB' in window)) {
        console.warn('เบราว์เซอร์นี้ไม่รองรับ IndexedDB');
        resolve(null);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // ใช้ AssetID เป็น Primary Key หลัก
          db.createObjectStore(this.storeName, { keyPath: 'AssetID' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB Open Error:', event.target.error);
        resolve(null);
      };
    });
  },

  // 2. ดึงข้อมูลทั้งหมดจาก IndexedDB
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

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => {
          console.error('IndexedDB getAll Error:', event.target.error);
          resolve([]);
        };
      } catch (err) {
        console.error('IndexedDB getAll Exception:', err);
        resolve([]);
      }
    });
  },

  // 3. บันทึก/อัปเดตข้อมูลทั้งหมดลง IndexedDB
  saveAssets: function (assetsArray) {
    return new Promise((resolve, reject) => {
      if (!this.db || !Array.isArray(assetsArray) || assetsArray.length === 0) {
        resolve(false);
        return;
      }
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        // เคลียร์ข้อมูลเก่าก่อนลงข้อมูลชุดใหม่
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          assetsArray.forEach((item, index) => {
            if (item) {
              // ตรวจหา AssetID จากโครงสร้างที่ส่งมาจาก Code.gs
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
          console.log('💾 บันทึกข้อมูลกลางลง IndexedDB เรียบร้อยแล้ว');
          resolve(true);
        };
        transaction.onerror = (event) => reject(event.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }
};
