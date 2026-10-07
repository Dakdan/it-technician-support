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
   ส่วนการจัดการ Service Worker และ PWA Installation (จบปัญหารองรับทั้ง Android & iOS)
   ========================================================================== */
let deferredPrompt = null;

// 1. ฟังก์ชันเช็กสถานะแอปและอุปกรณ์
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// 2. ลงทะเบียน Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('⚡ [PWA] ServiceWorker registered:', reg.scope))
      .catch((err) => console.error('❌ [PWA] ServiceWorker registration failed:', err));
  });
}

// 3. ตัวควบคุมการแสดงผลและคำสั่งบนปุ่มติดตั้ง #installAppBtn
function setupInstallButton() {
  const installBtn = document.getElementById('installAppBtn');
  if (!installBtn) return;

  // หากผู้ใช้ติดตั้งเป็นแอปแล้ว ให้ซ่อนปุ่มทันที
  if (isStandalone()) {
    installBtn.style.display = 'none';
    return;
  }

  // --- กรณีที่ 1: ผู้ใช้เปิดบน iOS (iPhone/iPad) ---
  if (isIOS()) {
    installBtn.style.display = 'block';
    installBtn.onclick = () => {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'วิธีติดตั้งบน iPhone / iPad',
          html: `
            <div style="text-align: left; font-size: 0.95rem; line-height: 1.7; color: #333;">
              <p><b>1.</b> เปิดเว็บนี้ด้วยเบราว์เซอร์ <b>Safari</b> เท่านั้น</p>
              <p><b>2.</b> กดปุ่ม <b>แชร์ (Share)</b> <span style="font-size:1.2rem;">⎋</span> ด้านล่างหน้าจอ</p>
              <p><b>3.</b> เลื่อนลงมาเลือก <b>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</b></p>
              <p><b>4.</b> กด <b>"เพิ่ม" (Add)</b> ที่มุมขวาบน</p>
            </div>
          `,
          icon: 'info',
          confirmButtonText: 'เข้าใจแล้ว',
          confirmButtonColor: '#ff1493'
        });
      } else {
        alert('วิธีติดตั้งบน iOS:\n1. เปิดด้วย Safari\n2. กดปุ่ม Share ⎋\n3. เลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)');
      }
    };
    return;
  }

  // --- กรณีที่ 2: ผู้ใช้เปิดบน Android / PC (Chrome, Edge, Samsung Internet) ---
  if (deferredPrompt) {
    installBtn.style.display = 'block';
    installBtn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        console.log('✅ [PWA] ผู้ใช้ติดตั้งแอปเรียบร้อยแล้ว');
      }
      deferredPrompt = null;
      installBtn.style.display = 'none';
    };
  } else {
    // ถ้ายังไม่มี Prompt ส่งมาจากเบราว์เซอร์ ให้ซ่อนปุ่มไว้ก่อน
    installBtn.style.display = 'none';
  }
}

// 4. ดักฟัง Event การติดตั้ง
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('📱 [PWA] พร้อมสำหรับการติดตั้ง');
  setupInstallButton();
});

window.addEventListener('appinstalled', () => {
  console.log('🎉 [PWA] ติดตั้งแอปเรียบร้อยแล้ว');
  deferredPrompt = null;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) installBtn.style.display = 'none';
});

// 5. รันการตรวจสอบทันทีเมื่อ DOM พร้อม
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupInstallButton);
} else {
  setupInstallButton();
}
