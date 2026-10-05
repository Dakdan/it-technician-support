// ==========================================
// ไฟล์: indexeddb.js
// ระบบจัดการฐานข้อมูล Local สำหรับ IT UDON HOSP
// ==========================================

const DB_NAME = 'IT_UDH_DB';
const DB_VERSION = 3; // ปรับ Version เพื่อสร้าง Store ใหม่

// 1. Stores สำหรับ Master Data
const STORE_ASSET = 'ASSET';
const STORE_DEPARTMENT = 'DEPARTMENT';
const STORE_ASSET_TYPE = 'ASSET_TYPE';
const STORE_STATUS_MAP = 'STATUS_MAP';
const STORE_PRIORITY_MAP = 'PRIORITY_MAP';
const STORE_SHIFT_MAP = 'SHIFT_MAP';

// 2. Stores สำหรับ Inv_Asset
const STORE_STOCK_IN = 'STOCK_IN';
const STORE_STOCK_OUT = 'STOCK_OUT';
const STORE_INVENTORY = 'INVENTORY';
const STORE_PERIPHERALS = 'PERIPHERALS';

// 3. Stores สำหรับ Audit
const STORE_AUDIT_LOGS = 'AUDIT_LOGS';
const STORE_ACTION_LOGS = 'ACTION_LOGS';
const STORE_AUDIT_CONFIRM = 'AUDIT_CONFIRM';
const STORE_AUDIT_IMAGES = 'AUDIT_IMAGES';

const idbApp = {
  db: null,

  // เริ่มต้นสร้าง/เชื่อมต่อฐานข้อมูล
  init: function() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Master Stores
        if (!db.objectStoreNames.contains(STORE_ASSET)) db.createObjectStore(STORE_ASSET, { keyPath: 'AssetID' });
        if (!db.objectStoreNames.contains(STORE_DEPARTMENT)) db.createObjectStore(STORE_DEPARTMENT, { keyPath: 'DEP_ID' });
        if (!db.objectStoreNames.contains(STORE_ASSET_TYPE)) db.createObjectStore(STORE_ASSET_TYPE, { keyPath: 'Type_ID' });
        if (!db.objectStoreNames.contains(STORE_STATUS_MAP)) db.createObjectStore(STORE_STATUS_MAP, { keyPath: 'code' });
        if (!db.objectStoreNames.contains(STORE_PRIORITY_MAP)) db.createObjectStore(STORE_PRIORITY_MAP, { keyPath: 'code' });
        if (!db.objectStoreNames.contains(STORE_SHIFT_MAP)) db.createObjectStore(STORE_SHIFT_MAP, { keyPath: 'code' });

        // Inv_Asset Stores
        if (!db.objectStoreNames.contains(STORE_STOCK_IN)) db.createObjectStore(STORE_STOCK_IN, { keyPath: 'Stock_In_No' });
        if (!db.objectStoreNames.contains(STORE_STOCK_OUT)) db.createObjectStore(STORE_STOCK_OUT, { keyPath: 'Stock_Out_No' });
        if (!db.objectStoreNames.contains(STORE_INVENTORY)) db.createObjectStore(STORE_INVENTORY, { keyPath: 'Inv_No' });
        if (!db.objectStoreNames.contains(STORE_PERIPHERALS)) db.createObjectStore(STORE_PERIPHERALS, { keyPath: 'id', autoIncrement: true });

        // Audit Stores
        if (!db.objectStoreNames.contains(STORE_AUDIT_LOGS)) db.createObjectStore(STORE_AUDIT_LOGS, { keyPath: 'ACTION_LOG_ID' });
        if (!db.objectStoreNames.contains(STORE_ACTION_LOGS)) db.createObjectStore(STORE_ACTION_LOGS, { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains(STORE_AUDIT_CONFIRM)) db.createObjectStore(STORE_AUDIT_CONFIRM, { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains(STORE_AUDIT_IMAGES)) db.createObjectStore(STORE_AUDIT_IMAGES, { keyPath: 'NO' });
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

  // ------------------------------------------
  // ฟังก์ชันสแกน/บันทึก Master Data
  // ------------------------------------------
  saveMasterData: function(masterObj) {
    return new Promise(async (resolve, reject) => {
      if (!this.db) await this.init();
      const stores = [STORE_DEPARTMENT, STORE_ASSET_TYPE, STORE_STATUS_MAP, STORE_PRIORITY_MAP, STORE_SHIFT_MAP];
      const transaction = this.db.transaction(stores, 'readwrite');

      try {
        if (masterObj.departments) {
          const s = transaction.objectStore(STORE_DEPARTMENT);
          s.clear();
          masterObj.departments.forEach(item => s.put(item));
        }
        if (masterObj.assetTypes) {
          const s = transaction.objectStore(STORE_ASSET_TYPE);
          s.clear();
          masterObj.assetTypes.forEach(item => s.put(item));
        }
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (e) => reject(e.target.error);
      } catch (err) { reject(err); }
    });
  },

  // ------------------------------------------
  // ฟังก์ชันสำหรับ Inv_Asset
  // ------------------------------------------
  saveInvData: function(invDataObj) {
    return new Promise(async (resolve, reject) => {
      if (!this.db) await this.init();
      const stores = [STORE_STOCK_IN, STORE_STOCK_OUT, STORE_INVENTORY, STORE_PERIPHERALS];
      const transaction = this.db.transaction(stores, 'readwrite');

      try {
        if (invDataObj.stockIn) {
          const s = transaction.objectStore(STORE_STOCK_IN);
          s.clear();
          invDataObj.stockIn.forEach(item => s.put(item));
        }
        if (invDataObj.stockOut) {
          const s = transaction.objectStore(STORE_STOCK_OUT);
          s.clear();
          invDataObj.stockOut.forEach(item => s.put(item));
        }
        if (invDataObj.inventory) {
          const s = transaction.objectStore(STORE_INVENTORY);
          s.clear();
          invDataObj.inventory.forEach(item => s.put(item));
        }
        if (invDataObj.peripherals) {
          const s = transaction.objectStore(STORE_PERIPHERALS);
          s.clear();
          invDataObj.peripherals.forEach(item => s.put(item));
        }

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (e) => reject(e.target.error);
      } catch (err) { reject(err); }
    });
  },

  // ------------------------------------------
  // ฟังก์ชันสำหรับ Audit Data
  // ------------------------------------------
  saveAuditData: function(auditDataObj) {
    return new Promise(async (resolve, reject) => {
      if (!this.db) await this.init();
      const stores = [STORE_AUDIT_LOGS, STORE_ACTION_LOGS, STORE_AUDIT_CONFIRM, STORE_AUDIT_IMAGES];
      const transaction = this.db.transaction(stores, 'readwrite');

      try {
        if (auditDataObj.auditLogs) {
          const s = transaction.objectStore(STORE_AUDIT_LOGS);
          s.clear();
          auditDataObj.auditLogs.forEach(item => {
            if (item.ACTION_LOG_ID) s.put(item);
          });
        }
        if (auditDataObj.actionLogs) {
          const s = transaction.objectStore(STORE_ACTION_LOGS);
          s.clear();
          auditDataObj.actionLogs.forEach(item => s.put(item));
        }
        if (auditDataObj.confirmLogs) {
          const s = transaction.objectStore(STORE_AUDIT_CONFIRM);
          s.clear();
          auditDataObj.confirmLogs.forEach(item => s.put(item));
        }
        if (auditDataObj.imageLogs) {
          const s = transaction.objectStore(STORE_AUDIT_IMAGES);
          s.clear();
          auditDataObj.imageLogs.forEach(item => {
            if (item.NO) s.put(item);
          });
        }

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (e) => reject(e.target.error);
      } catch (err) { reject(err); }
    });
  },

  // ------------------------------------------
  // Generic Get & Save Helpers
  // ------------------------------------------
  getData: function(storeName) {
    return new Promise(async (resolve, reject) => {
      if (!this.db) await this.init();
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  putSingleRecord: function(storeName, item) {
    return new Promise(async (resolve, reject) => {
      if (!this.db) await this.init();
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }
};

// Auto Init เมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', () => {
  idbApp.init().catch(err => console.error("Auto IDB Init failed:", err));
});
