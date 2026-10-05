const idbApp = {
    dbName: 'ITAssetDB',
    dbVersion: 1,
    storeName: 'assets',
    db: null,

    // 1. เริ่มต้นและเปิดการเชื่อมต่อ IndexedDB
    init: function () {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            if (!('indexedDB' in window)) {
                console.warn("เบราว์เซอร์นี้ไม่รองรับ IndexedDB");
                resolve(null);
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // กำหนด AssetID เป็น Key หลัก
                    db.createObjectStore(this.storeName, { keyPath: 'AssetID' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB Open Error:", event.target.error);
                reject(event.target.error);
            };
        });
    },

    // 2. ดึงข้อมูลครุภัณฑ์ทั้งหมดจาก Local Storage (IndexedDB)
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
                    resolve([]); // คืนค่า array ว่าง เพื่อไม่ให้ระบบหน้าหลักค้าง
                };
            } catch (err) {
                console.error("IndexedDB getAll Exception:", err);
                resolve([]);
            }
        });
    },

    // 3. บันทึก/อัปเดตข้อมูลครุภัณฑ์ลง IndexedDB แบบยกชุด (Silent Sync)
    saveAssets: function (assetsArray) {
        return new Promise((resolve, reject) => {
            if (!this.db || !Array.isArray(assetsArray) || assetsArray.length === 0) {
                resolve(false);
                return;
            }

            try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);

                // เคลียร์ข้อมูลเก่าก่อนลงข้อมูลชุดใหม่ เพื่อป้องกันข้อมูลตกค้าง
                const clearRequest = store.clear();

                clearRequest.onsuccess = () => {
                    assetsArray.forEach((item, index) => {
                        if (item) {
                            // ป้องกัน Error หาก AssetID อยู่ข้างใน Asset_Detail
                            const primaryKey = item.AssetID || (item.Asset_Detail && item.Asset_Detail.AssetID) || `TEMP_KEY_${index}`;
                            
                            const dataToSave = {
                                ...item,
                                AssetID: primaryKey
                            };
                            
                            store.put(dataToSave);
                        }
                    });
                };

                transaction.oncomplete = () => {
                    resolve(true);
                };

                transaction.onerror = (event) => {
                    console.error("IndexedDB saveAssets Transaction Error:", event.target.error);
                    reject(event.target.error);
                };
            } catch (err) {
                console.error("IndexedDB saveAssets Exception:", err);
                reject(err);
            }
        });
    }
};
