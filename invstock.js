// invstock.js

let deferredPrompt;

// 1. ลงทะเบียน Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

// 2. จัดการปุ่ม "ติดตั้งแอป" (Install PWA)
window.addEventListener('beforeinstallprompt', (e) => {
  // ป้องกันไม่ให้เบราว์เซอร์แสดง Prompt อัตโนมัติ
  e.preventDefault();
  // เก็บ event ไว้ใช้ภายหลังเมื่อผู้ใช้กดปุ่ม
  deferredPrompt = e;
  
  // แสดงปุ่ม "ติดตั้งแอป" ใน UI ของคุณ (ตัวอย่างเช่นการลบ class 'hidden')
  const installButton = document.getElementById('installAppBtn');
  if (installButton) {
    installButton.style.display = 'block';
    
    installButton.addEventListener('click', async () => {
      // แสดง Prompt ให้ผู้ใช้กดยืนยันการติดตั้ง
      deferredPrompt.prompt();
      // รอผลลัพธ์ว่าผู้ใช้กดยอมรับหรือปฏิเสธ
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      // เคลียร์ค่าตัวแปร
      deferredPrompt = null;
      // ซ่อนปุ่ม
      installButton.style.display = 'none';
    });
  }
});

// ตรวจสอบเมื่อติดตั้งแอปสำเร็จ
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed successfully!');
  deferredPrompt = null;
});

// เก็บตัวแปร Event การติดตั้ง
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // ป้องกันไม่ให้เบราว์เซอร์แสดง Prompt อัตโนมัติแบบเด้งแล้วหาย
  e.preventDefault();
  deferredPrompt = e;

  const installBanner = document.getElementById('pwaInstallBanner');
  
  // ตรวจสอบว่าผู้ใช้เคยกดปิดแบนเนอร์ไปแล้วหรือยังในเซสชันนี้
  const isClosed = sessionStorage.getItem('pwaPromptClosed');

  // ถ้ายังไม่เคยปิด และมีแบนเนอร์อยู่ในหน้านั้น ให้แสดงผล
  if (installBanner && isClosed !== 'true') {
    installBanner.classList.remove('hidden');
    // รองรับ Bootstrap class d-none ด้วย (เผื่อใช้สลับ)
    installBanner.classList.remove('d-none'); 
  }
});

// จัดการเมื่อคลิกปุ่มติดตั้ง
document.addEventListener('DOMContentLoaded', () => {
  const installBanner = document.getElementById('pwaInstallBanner');
  const installButton = document.getElementById('installAppBtn');
  const closeBannerBtn = document.getElementById('closeBannerBtn');

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) return;

      // แสดงหน้าต่างติดตั้งของเบราว์เซอร์
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);

      deferredPrompt = null;
      if (installBanner) {
        installBanner.classList.add('d-none');
      }
    });
  }

  // เมื่อผู้ใช้กดปุ่มกากบาท (ปิดแบนเนอร์)
  if (closeBannerBtn) {
    closeBannerBtn.addEventListener('click', () => {
      if (installBanner) {
        installBanner.classList.add('d-none');
      }
      // บันทึกลงใน sessionStorage ว่าปิดไปแล้ว จะไม่แสดงซ้ำจนกว่าจะเปิดแท็บใหม่
      sessionStorage.setItem('pwaPromptClosed', 'true');
    });
  }
});

// ซ่อนแบนเนอร์ทันทีเมื่อติดตั้งแอปสำเร็จ
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed successfully!');
  deferredPrompt = null;
  const installBanner = document.getElementById('pwaInstallBanner');
  if (installBanner) {
    installBanner.classList.add('d-none');
  }
});
