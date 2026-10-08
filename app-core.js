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

  // 1. ถ้าผู้ใช้ติดตั้งแอปไปแล้ว (อยู่ในหน้าจอ Standalone) ให้ซ่อนปุ่ม
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    installBtn.style.display = 'none';
    return;
  }

  // 2. เช็คว่าเป็น Smartphone / Tablet หรือไม่
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // 3. ถ้าเป็น Mobile -> สั่งแสดงปุ่มรอกดทันที!
  if (isMobile) {
    installBtn.style.display = 'block'; // หรือ 'inline-block' ตาม CSS

    installBtn.onclick = async () => {
      // 🅰️ กรณี iOS (Safari ไม่สนับสนุน Native Prompt) -> ขึ้น Modal สอนกด Share -> Add to Home Screen
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: 'วิธีติดตั้งบน iPhone / iPad',
            html: `<div style="text-align:left; font-size:0.95rem; line-height:1.7;">
                     1. เปิดด้วยเบราว์เซอร์ <b>Safari</b><br>
                     2. กดปุ่ม <b>แชร์ (Share)</b> ⎋ ด้านล่าง<br>
                     3. เลือก <b>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</b>
                   </div>`,
            icon: 'info',
            confirmButtonColor: '#ff1493'
          });
        } else {
          alert('วิธีติดตั้งบน iOS:\n1. เปิดด้วย Safari\n2. กดปุ่ม Share ⎋\n3. เลือก "เพิ่มไปยังหน้าจอโฮม"');
        }
        return;
      }

      // 🅱️ กรณี Android / PC
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          installBtn.style.display = 'none';
        }
        deferredPrompt = null;
      } else {
        // หาก Android ยังไม่ปล่อย Prompt มา -> สอนกดเมนู 3 จุด
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: 'วิธีติดตั้งบน Android',
            html: `<div style="text-align:left; font-size:0.95rem; line-height:1.7;">
                     1. กดปุ่ม <b>เมนู (จุด 3 จุด ⋮)</b> มุมขวาบนของ Chrome<br>
                     2. เลือก <b>"ติดตั้งแอป" (Install app)</b> หรือ <b>"เพิ่มลงในหน้าจอหลัก"</b>
                   </div>`,
            icon: 'info',
            confirmButtonColor: '#ff1493'
          });
        } else {
          alert('วิธีติดตั้งบน Android:\nกดเมนู จุด 3 จุด (⋮) มุมขวาบน -> เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"');
        }
      }
    };
  } else {
    // บน PC ถ้าไม่มี Prompt ให้ซ่อนไว้
    if (!deferredPrompt) {
      installBtn.style.display = 'none';
    }
  }
}
