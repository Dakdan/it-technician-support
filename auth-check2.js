/*
 * ============================================================================
 * ไฟล์: auth-check.js
 * วัตถุประสงค์: ตรวจสอบและจัดการสถานะการเข้าสู่ระบบ (Authentication) จาก LocalStorage
 * รูปแบบการทำงาน: แบบ Soft Check (ไม่บังคับเด้งออก) เพื่อให้หน้า HTML ปลายทาง 
 *                สามารถจัดการ UI (เช่น สลับปุ่มล็อกอิน/แสดงข้อมูล) ได้เอง
 * 
 * ----------------------------------------------------------------------------
 * 📌 แนวทางการนำไปใช้งานในหน้า HTML อื่นๆ:
 * 1. การเรียกใช้: 
 *    นำโค้ดบรรทัดนี้ไปวางไว้ในแท็ก <head> ของทุกหน้า HTML ที่ต้องการตรวจสอบสิทธิ์
 *    <script src="auth-check.js"></script>
 * 
 * 2. ลำดับการวาง: 
 *    ควรวางก่อน Script อื่นๆ ที่ต้องใช้ข้อมูลผู้ใช้ เพื่อให้ window.user พร้อมใช้งานทันที
 * 
 * 3. ตัวอย่างการเขียนเงื่อนไขในหน้า HTML (JS):
 *    - ตรวจสอบว่าล็อกอินหรือไม่: 
 *      if (getCurrentUser()) { ...ทำคำสั่งเมื่อล็อกอินแล้ว... } else { ...แจ้งเตือนให้ล็อกอิน... }
 *    - ตรวจสอบสิทธิ์การเข้าถึง (Role): 
 *      if (hasRole('ADMIN')) { ...แสดงเมนูผู้ดูแล... }
 *    - ดึงชื่อไปแสดงผล: 
 *      document.getElementById('user-name').innerText = getDisplayName();
 * ============================================================================
 */
/*
 * ============================================================================
 * ไฟล์: auth-check.js
 * วัตถุประสงค์: ตรวจสอบและจัดการสถานะการเข้าสู่ระบบ (Authentication) 
 * รองรับ: แยกพฤติกรรมระหว่าง PC (localStorage + TTL + Idle Timeout) และ Smartphone (sessionStorage)
 * ============================================================================
 */

(function () {
    try {
        // ตรวจสอบประเภทอุปกรณ์จาก User-Agent เพื่อเลือกที่จัดเก็บ Session
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // - Smartphone ใช้ sessionStorage (ปิดเบราว์เซอร์/แท็บ ข้อมูลหายทันที)
        // - PC ใช้ localStorage (จำค่าไว้ แต่มีระบบกำหนดอายุ TTL และ Idle Timeout ควบคุม)
        const storage = isMobile ? sessionStorage : localStorage;
        let userData = storage.getItem('currentUser');
        
        // 🟢 ส่วนที่เพิ่มใหม่: Fallback เช็ค Storage อีกฝั่งเผื่อผู้ใช้สลับโหมด Desktop/Mobile View
        if (!userData) {
            const fallbackStorage = isMobile ? localStorage : sessionStorage;
            userData = fallbackStorage.getItem('currentUser');
        }
        
        if (!userData) {
            window.user = null;
            return;
        }

        const user = JSON.parse(userData);
        
        // ตรวจสอบโครงสร้างข้อมูลเบื้องต้น
        if (!user || !user.UserPN) {
            sessionStorage.removeItem('currentUser');
            localStorage.removeItem('currentUser');
            window.user = null;
            return;
        }

        // --- สำหรับ PC: ตรวจสอบเวลาหมดอายุของเซสชัน (TTL Check: 8 ชั่วโมง) ---
        if (!isMobile && user.loginTime && user.expiresIn) {
            const currentTime = new Date().getTime();
            if (currentTime - user.loginTime > user.expiresIn) {
                storage.removeItem('currentUser');
                window.user = null;
                return;
            }
        }

        // ข้อมูลถูกต้อง ผูกเข้ากับ Global Window
        window.user = user;

        // --- สำหรับ PC เพิ่มเติม: ระบบตัดการทำงานอัตโนมัติเมื่อไม่มีการเคลื่อนไหว (Idle Timeout 15 นาที) ---
        if (!isMobile) {
            let idleTimeout;
            const IDLE_LIMIT = 15 * 60 * 1000; // 15 นาที

            function resetIdleTimer() {
                clearTimeout(idleTimeout);
                idleTimeout = setTimeout(() => {
                    alert('ระบบทำการออกจากระบบให้อัตโนมัติเนื่องจากไม่มีการใช้งานเป็นเวลานาน');
                    logout();
                }, IDLE_LIMIT);
            }

            // ดักจับความเคลื่อนไหวบน PC
            window.onload = resetIdleTimer;
            window.onmousemove = resetIdleTimer;
            window.onkeypress = resetIdleTimer;
            window.onclick = resetIdleTimer;
            window.onscroll = resetIdleTimer;
        }

    } catch (err) {
        console.error("Auth-Check error: ", err);
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('currentUser');
        window.user = null;
    }
})();
function getCurrentUser() {
    return window.user || null;
}

function hasRole(role) {
    if (!window.user) return false;
    return String(window.user.UserTypeID).toUpperCase() === String(role).toUpperCase();
}

function getDisplayName() {
    if (!window.user) return "ผู้ใช้งานทั่วไป";
    return (window.user.UserName || "") + " " + (window.user.UserSname || "");
}

function logout() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const storage = isMobile ? sessionStorage : localStorage;
    
    storage.removeItem('currentUser');
    sessionStorage.clear();
    localStorage.removeItem('currentUser'); // ล้างเผื่อไว้ทั้งสองที่เพื่อความปลอดภัย
    
    try {
        window.location.replace("index.html");
    } catch(e) {
        window.location.href = "index.html";
    }
}
