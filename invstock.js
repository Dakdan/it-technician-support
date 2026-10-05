let deferredPrompt = null;

// 1. Register Service Worker
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

// 2. ตรวจสอบว่าเปิดผ่าน iOS Safari หรือไม่
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// 3. จัดการปุ่มติดตั้งแอปสำหรับ Android/Desktop และ คำสั่งสำหรับ iOS
document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('installAppBtn');
  const iosInstructions = document.getElementById('iosInstallBanner'); // UI แสดงวิธีติดตั้งของ iOS (ถ้ามี)

  if (!installBtn) return;

  // ถ้าเปิดในโหมดแอป PWA เรียบร้อยแล้ว ให้ซ่อนปุ่ม
  if (isStandalone()) {
    installBtn.style.display = 'none';
    if (iosInstructions) iosInstructions.style.display = 'none';
    return;
  }

  // กรณีเป็น iOS (Safari)
  if (isIOS()) {
    installBtn.addEventListener('click', () => {
      alert('วิธีติดตั้งบน iPhone/iPad:\n1. กดปุ่ม "แชร์" (Share) ที่แถบล่างสุดของ Safari\n2. เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)');
    });
    installBtn.style.display = 'block';
  }
});

// 4. บันทึก Prompt สำหรับ Android (Chrome / Edge)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
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

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed successfully!');
  deferredPrompt = null;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) installBtn.style.display = 'none';
});
