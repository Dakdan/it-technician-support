/* ==========================================================================
   app-core.js : ตัวควบคุมข้อมูลกลาง (Global Data Store) & PWA Manager
   ========================================================================== */

const AppCore = {
  // 📍 URL ของ Google Apps Script (Asset & Search API)
  API_URL: 'https://script.google.com/macros/s/AKfycbxW9EpEUH8eHnPlVGphf6n7qU0ox-VGj33nwpDgJ9hByuPQpHW2-He9ErqO4F8XNWvFZA/exec',

  /**
   * ดึงข้อมูลครุภัณฑ์ทั้งหมด (Smart Cache: อ่านจาก IndexedDB ก่อน ถ้าไม่มีเน็ตหรือสั่ง Force Refresh ให้ยิง API)
   * @param {boolean} forceRefresh - กำหนด true หากต้องการบังคับดึงข้อมูลใหม่จาก GAS
   */
  getGlobalAssets: async function (forceRefresh = false) {
    // 1. เปิดฐานข้อมูล IndexedDB ในเครื่องก่อน
    await idbApp.init();

    // 2. ถ้าไม่ได้สั่ง forceRefresh ให้ลองอ่านจาก IndexedDB ก่อน
    if (!forceRefresh) {
      const localData = await idbApp.getAllAssets();
      if (localData && localData.length > 0) {
        console.log('⚡ [AppCore] โหลดข้อมูลกลางจาก IndexedDB สำเร็จ');
        return localData;
      }
    }

    // 3. ยิง API ไปที่ Code.gs (ใช้ mode: 'getAllData')
    try {
      console.log('🌐 [AppCore] กำลังดึงข้อมูลกลางล่าสุดจาก GAS API...');
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          mode: 'getAllData',
          forceRefresh: forceRefresh
        })
      });

      const result = await response.json();

      // รองรับโครงสร้าง response จาก getAllDataForFrontend()
      if (result && (result.status === 'success' || result.success) && Array.isArray(result.data)) {
        console.log(`✅ [AppCore] ดึงข้อมูลสำเร็จ ทั้งหมด ${result.totalCount || result.data.length} รายการ`);
        
        // เซฟข้อมูลลง IndexedDB ทันที
        await idbApp.saveAssets(result.data);
        return result.data;
      } else {
        throw new Error(result.message || 'โครงสร้างข้อมูลไม่ถูกต้อง');
      }
    } catch (error) {
      console.warn('⚠️ [AppCore] เรียก API ไม่สำเร็จ (เข้าสู่โหมด Offline):', error);
      // Fallback อ่านข้อมูลเดิมในเครื่องกรณีเน็ตหลุด
      return await idbApp.getAllAssets();
    }
  },

  /**
   * ดึงประเภทครุภัณฑ์ (Asset Types) สำหรับใช้ใน Dropdown
   */
  getAssetTypes: async function () {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ mode: 'getAssetTypes' })
      });
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('❌ [AppCore] getAssetTypes Error:', error);
      return [];
    }
  },

  /**
   * ดึงรายชื่อหน่วยงาน (Departments)
   */
  getDepartments: async function () {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ mode: 'getDepartments' })
      });
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('❌ [AppCore] getDepartments Error:', error);
      return [];
    }
  }
};

/* ==========================================================================
   ส่วนการจัดการ Service Worker และ PWA Installation
   ========================================================================== */
let deferredPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('ServiceWorker registered:', reg.scope))
      .catch((err) => console.error('ServiceWorker registration failed:', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn && !isStandalone()) {
    installBtn.style.display = 'block';
    installBtn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.style.display = 'none';
    };
  }
});
