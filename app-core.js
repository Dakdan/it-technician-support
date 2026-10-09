/* ==========================================================================
   app-core.js : ตัวควบคุมข้อมูลกลาง (Global Data Store) & PWA Manager
   ========================================================================== */

// 📍 ฟังก์ชันเปิด Modal อย่างปลอดภัย (กำหนด Retry ไม่เกิน 10 ครั้ง ป้องกันลูปค้าง)
function openModalSafely(modalId, retryCount = 0) {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) {
    console.warn(`⚠️ [AppCore] ไม่พบ Element Modal: #${modalId}`);
    return;
  }

  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    try {
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
      modalInstance.show();
    } catch (err) {
      console.error(`❌ [AppCore] เปิด Modal #${modalId} ล้มเหลว:`, err);
    }
  } else if (retryCount < 10) {
    // พยายามลองใหม่สูงสุด 10 ครั้ง (1 วินาที) หากยังไม่ได้จะยกเลิกทันที ป้องกันลูปค้าง
    setTimeout(() => openModalSafely(modalId, retryCount + 1), 100);
  } else {
    console.error(`❌ [AppCore] Bootstrap JS ยังไม่พร้อมใช้งาน ยกเลิกการเปิด #${modalId}`);
  }
}

const AppCore = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxW9EpEUH8eHnPlVGphf6n7qU0ox-VGj33nwpDgJ9hByuPQpHW2-He9ErqO4F8XNWvFZA/exec',

  getGlobalAssets: async function (forceRefresh = false) {
    // 🟢 เช็กและเริ่มการทำงานของ IndexedDB อย่างปลอดภัย
    if (typeof idbApp !== 'undefined' && typeof idbApp.init === 'function') {
      try {
        await idbApp.init();
      } catch (e) {
        console.warn('⚠️ [AppCore] ไม่สามารถเริ่มต้น IndexedDB ได้:', e);
      }
    }

    if (!forceRefresh && typeof idbApp !== 'undefined' && typeof idbApp.getAllAssets === 'function') {
      try {
        const localData = await idbApp.getAllAssets();
        if (localData && localData.length > 0) {
          console.log('⚡ [AppCore] โหลดข้อมูลกลางจาก IndexedDB สำเร็จ');
          return localData;
        }
      } catch (e) {
        console.warn('⚠️ [AppCore] อ่านข้อมูลจาก IndexedDB ล้มเหลว:', e);
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

      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const result = await response.json();

      if (result && (result.status === 'success' || result.success) && Array.isArray(result.data)) {
        console.log(`✅ [AppCore] ดึงข้อมูลสำเร็จ ทั้งหมด ${result.totalCount || result.data.length} รายการ`);
        if (typeof idbApp !== 'undefined' && typeof idbApp.saveAssets === 'function') {
          await idbApp.saveAssets(result.data).catch(err => console.warn('บันทึก IDB ล้มเหลว:', err));
        }
        return result.data;
      } else {
        throw new Error(result.message || 'โครงสร้างข้อมูลไม่ถูกต้อง');
      }
    } catch (error) {
      console.warn('⚠️ [AppCore] เรียก API ไม่สำเร็จ (เข้าสู่โหมด Offline):', error);
      if (typeof idbApp !== 'undefined' && typeof idbApp.getAllAssets === 'function') {
        try {
          return await idbApp.getAllAssets();
        } catch (e) {
          return [];
        }
      }
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
   ส่วนการจัดการ Service Worker และ PWA Installation
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

// 3. ตัวควบคุมการแสดงผลปุ่มติดตั้ง และ PWA Banner
function setupInstallButton() {
  try {
    const installBtn = document.getElementById('installAppBtn');
    const bannerContainer = document.getElementById('pwaInstallBanner');
    const closeBtn = document.getElementById('closeBannerBtn');

    // ถ้าอยู่ในโหมด Standalone แล้ว ให้ซ่อน Banner ทั้งหมด
    if (isStandalone()) {
      if (bannerContainer) bannerContainer.classList.add('d-none');
      if (installBtn) installBtn.style.display = 'none';
      return;
    }

    // ผูกการทำงานปุ่มปิดแบนเนอร์
    if (closeBtn && bannerContainer) {
      closeBtn.onclick = () => {
        bannerContainer.classList.add('d-none');
      };
    }

    // แสดง Banner/ปุ่ม หากเป็นมือถือ หรือเปิดรับ Prompt
    if (isMobileDevice() || deferredPrompt) {
      if (bannerContainer) bannerContainer.classList.remove('d-none');
      if (installBtn) installBtn.style.display = 'inline-block';

      if (installBtn) {
        installBtn.onclick = async () => {
          // 🅰️ กรณี iOS (Safari)
          if (isIOS()) {
            if (typeof Swal !== 'undefined') {
              Swal.fire({
                title: 'วิธีติดตั้งบน iPhone / iPad',
                html: `<div style="text-align:left; font-size:0.95rem; line-height:1.7;">
                         1. เปิดด้วยเบราว์เซอร์ <b>Safari</b><br>
                         2. กดปุ่ม <b>แชร์ (Share)</b> ⎋ ด้านล่าง<br>
                         3. เลือก <b>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</b>
                       </div>`,
                icon: 'info',
                confirmButtonColor: '#d63384'
              });
            } else {
              alert('วิธีติดตั้งบน iOS:\n1. เปิดด้วย Safari\n2. กดปุ่ม Share ⎋\n3. เลือก "เพิ่มไปยังหน้าจอโฮม"');
            }
            return;
          }

          // 🅱️ กรณี Android / Desktop
          if (deferredPrompt) {
            deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'accepted') {
              if (bannerContainer) bannerContainer.classList.add('d-none');
              installBtn.style.display = 'none';
            }
            deferredPrompt = null;
          } else {
            if (typeof Swal !== 'undefined') {
              Swal.fire({
                title: 'วิธีติดตั้งบน Android',
                html: `<div style="text-align:left; font-size:0.95rem; line-height:1.7;">
                         1. กดปุ่ม <b>เมนู (จุด 3 จุด ⋮)</b> มุมขวาบนของ Chrome<br>
                         2. เลือก <b>"ติดตั้งแอป" (Install app)</b> หรือ <b>"เพิ่มลงในหน้าจอหลัก"</b>
                       </div>`,
                icon: 'info',
                confirmButtonColor: '#d63384'
              });
            } else {
              alert('วิธีติดตั้งบน Android:\nกดเมนู จุด 3 จุด (⋮) มุมขวาบน -> เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"');
            }
          }
        };
      }
    } else {
      if (bannerContainer) bannerContainer.classList.add('d-none');
      if (installBtn) installBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('❌ [PWA] setupInstallButton Error:', err);
  }
}

// 4. Event Listeners ตรวจจับการติดตั้ง PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('📱 [PWA] พร้อมสำหรับการติดตั้ง');
  setupInstallButton();
});

window.addEventListener('appinstalled', () => {
  console.log('🎉 [PWA] ติดตั้งแอปเรียบร้อยแล้ว');
  deferredPrompt = null;
  const bannerContainer = document.getElementById('pwaInstallBanner');
  const installBtn = document.getElementById('installAppBtn');
  if (bannerContainer) bannerContainer.classList.add('d-none');
  if (installBtn) installBtn.style.display = 'none';
});

// 5. สั่งรันเมื่อ DOM พร้อมทำงาน
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupInstallButton);
} else {
  setupInstallButton();
}
