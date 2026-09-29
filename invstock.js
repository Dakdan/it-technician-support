// invstock.js

let deferredPrompt;

// 1. ลงทะเบียน Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
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
