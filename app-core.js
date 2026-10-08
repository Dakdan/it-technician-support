/* ==========================================================================
   app-core.js : ตัวควบคุมข้อมูลกลาง (Global Data Store) & PWA Manager
   ========================================================================== */

const AppCore = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxW9EpEUH8eHnPlVGphf6n7qU0ox-VGj33nwpDgJ9hByuPQpHW2-He9ErqO4F8XNWvFZA/exec',

  getGlobalAssets: async function (forceRefresh = false) {
    if (typeof idbApp !== 'undefined') await idbApp.init();

    if (!forceRefresh && typeof idbApp !== 'undefined') {
      const localData = await idbApp.getAllAssets();
      if (localData && localData.length > 0) {
        console.log('⚡ [AppCore] โหลดข้อมูลกลางจาก IndexedDB สำเร็จ');
        return localData;
      }
    }

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

      if (result && (result.status === 'success' || result.success) && Array.isArray(result.data)) {
        console.log(`✅ [AppCore] ดึงข้อมูลสำเร็จ ทั้งหมด ${result.totalCount || result.data.length} รายการ`);
        if (typeof idbApp !== 'undefined') await idbApp.saveAssets(result.data);
        return result.data;
      } else {
        throw new Error(result.message || 'โครงสร้างข้อมูลไม่ถูกต้อง');
      }
    } catch (error) {
      console.warn('⚠️ [AppCore] เรียก API ไม่สำเร็จ (เข้าสู่โหมด Offline):', error);
      if (typeof idbApp !== 'undefined') return await idbApp.getAllAssets();
      return [];
    }
  },

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
   ส่วนการจัดการ Service Worker และ PWA Installation (ปรับปรุงแก้ไขเรื่องปุ่มไม่แสดง)
   ========================================================================== */
let deferredPrompt = null;

// 1. ฟังก์ชันเช็กสถานะ PWA และประเภทอุปกรณ์
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true || 
         document.referrer.includes('android-app://');
}

function isMobileDevice() {
  const ua = navigator.userAgent;
  const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // สำหรับ iPadOS
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || isTouchMac;
}

function isIOS() {
  const ua = navigator.userAgent;
  const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || isTouchMac;
}

// 2. ลงทะเบียน Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('⚡ [PWA] ServiceWorker registered:', reg.scope))
      .catch((err) => console.error('❌ [PWA] ServiceWorker registration failed:', err));
  });
}

// 3. ตัวควบคุมการแสดงผลปุ่มติดตั้ง
function setupInstallButton() {
  const installBtn = document.getElementById('installAppBtn');
  if (!installBtn) return;

  // เงื่อนไข 1: หากติดตั้งแอปเรียบร้อยแล้ว ให้ซ่อนปุ่มทันที
  if (isStandalone()) {
    installBtn.style.display = 'none';
    return;
  }

  // เงื่อนไข 2: ถ้าเป็น Smartphone / Tablet หรือมี Prompt พร้อมใช้งาน -> ให้แสดงปุ่มเสมอ
  if (isMobileDevice() || deferredPrompt) {
    installBtn.style.display = 'block'; // หรือ 'inline-block' ตามดีไซน์
    
    installBtn.onclick = async () => {
      // 🅰️ หากเป็น iOS (iPhone / iPad) -> แสดง Popup แนะนำวิธีติดตั้ง
      if (isIOS()) {
        showIOSInstruction();
        return;
      }

      // 🅱️ หากเป็น Android / PC และมี Prompt พร้อม -> เรียก Native Install Dialog
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          console.log('✅ [PWA] ผู้ใช้ติดตั้งแอปเรียบร้อยแล้ว');
          installBtn.style.display = 'none';
        }
        deferredPrompt = null;
      } else {
        // 🅒 หากเป็น Android แต่ Prompt ยังไม่พร้อม -> แสดง คำแนะนำติดตั้งผ่านเมนูเบราว์เซอร์
        showAndroidInstruction();
      }
    };
  } else {
    // บน PC ที่ไม่ใช่ Browser รองรับ PWA Prompt ให้ซ่อนไว้
    installBtn.style.display = 'none';
  }
}

// 4. คำแนะนำการติดตั้งสำหรับ iOS
function showIOSInstruction() {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'วิธีติดตั้งบน iPhone / iPad',
      html: `
        <div style="text-align: left; font-size: 0.95rem; line-height: 1.7; color: #333;">
          <p><b>1.</b> เปิดเว็บนี้ด้วยเบราว์เซอร์ <b>Safari</b></p>
          <p><b>2.</b> กดปุ่ม <b>แชร์ (Share)</b> <span style="font-size:1.2rem;">⎋</span> ด้านล่าง</p>
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
}

// 5. คำแนะนำการติดตั้งสำหรับ Android กรณี Native Prompt ยังไม่ทำงาน
function showAndroidInstruction() {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'วิธีติดตั้งบน Android',
      html: `
        <div style="text-align: left; font-size: 0.95rem; line-height: 1.7; color: #333;">
          <p><b>1.</b> กดปุ่ม <b>เมนู (จุด 3 จุด ⋮)</b> ที่มุมขวาบนของ Chrome</p>
          <p><b>2.</b> เลือก <b>"ติดตั้งแอป" (Install app)</b> หรือ <b>"เพิ่มลงในหน้าจอหลัก" (Add to Home screen)</b></p>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'เข้าใจแล้ว',
      confirmButtonColor: '#ff1493'
    });
  } else {
    alert('วิธีติดตั้งบน Android:\nกดเมนู จุด 3 จุด (⋮) มุมขวาบน -> เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"');
  }
}

// 6. Event Listeners สำหรับดักฟังการติดตั้ง
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

// 7. ตรวจสอบและแสดงปุ่มเมื่อ DOM โหลดเสร็จ
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupInstallButton);
} else {
  setupInstallButton();
}
