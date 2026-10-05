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

// 2. ดักจับ Event ปกติ
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// บังคับเปิดแสดงผลทันทีหลังโหลดหน้าเว็บ (เพื่อทดสอบว่า HTML/CSS ขึ้นไหม)
document.addEventListener('DOMContentLoaded', () => {
  const installBanner = document.getElementById('pwaInstallBanner');
  const installButton = document.getElementById('installAppBtn');
  const closeBannerBtn = document.getElementById('closeBannerBtn');

  const isClosed = sessionStorage.getItem('pwaPromptClosed');

  // ถ้ายังไม่เคยปิด ให้แสดงแบนเนอร์ทันที (ไม่ต้องรอ event beforeinstallprompt)
  if (installBanner && isClosed !== 'true') {
    installBanner.classList.remove('d-none');
  }

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (deferredPrompt) {
        // ถ้าเบราว์เซอร์พร้อมติดตั้งจริง จะเรียกหน้าต่างติดตั้งระบบ
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response: ${outcome}`);
        deferredPrompt = null;
      } else {
        // กรณีเทสบนเบราว์เซอร์ที่ยังไม่รองรับ prompt อัตโนมัติ แจ้งเตือนผู้ใช้
        alert("เบราว์เซอร์นี้อาจไม่รองรับการติดตั้งอัตโนมัติ หรือติดตั้งไปแล้ว ให้ลองกดเมนู (จุด 3 จุด) ของเบราว์เซอร์แล้วเลือก 'ติดตั้งแอป' หรือ 'เพิ่มลงหน้าจอหลัก'");
      }
      if (installBanner) {
        installBanner.classList.add('d-none');
      }
    });
  }

  if (closeBannerBtn) {
    closeBannerBtn.addEventListener('click', () => {
      if (installBanner) {
        installBanner.classList.add('d-none');
      }
      sessionStorage.setItem('pwaPromptClosed', 'true');
    });
  }
});
