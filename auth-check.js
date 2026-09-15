/*
 * ============================================================================
 * ไฟล์: auth-check.js (เวอร์ชันเดิม + เพิ่มระบบ Hard Check & Role Check)
 * วัตถุประสงค์: ตรวจสอบสถานะและสิทธิ์การเข้าใช้งาน
 * ============================================================================
 */
(function () {
    try {
        // ดึงข้อมูลจาก sessionStorage (สำหรับ Mobile) หรือ localStorage (สำหรับ PC)
        const userData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');

        // เงื่อนไข 1: หากไม่มีข้อมูลในระบบ
        if (!userData) {
            window.user = null;
            return;
        }

        const user = JSON.parse(userData);

        // เงื่อนไข 2: หากมีข้อมูลแต่โครงสร้างไม่ถูกต้อง (ไม่มี UserPN)
        if (!user || !user.UserPN) {
            sessionStorage.removeItem('currentUser');
            localStorage.removeItem('currentUser');
            window.user = null;
            return;
        }

        // เงื่อนไข 3: ตรวจสอบเวลาหมดอายุ (TTL)
        if (user.loginTime && user.expiresIn) {
            const now = new Date().getTime();
            if (now - user.loginTime > user.expiresIn) {
                sessionStorage.removeItem('currentUser');
                localStorage.removeItem('currentUser');
                window.user = null;
                return;
            }
        }

        // เงื่อนไข 4: ข้อมูลถูกต้อง -> ผูกเข้า Global Window
        window.user = user;
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
    // ตรวจสอบทั้ง UserTypeID หรือ Role ตามโครงสร้างข้อมูลที่มี
    const currentRole = window.user.UserTypeID || window.user.Role || '';
    return String(currentRole).toUpperCase() === String(role).toUpperCase();
}

function getDisplayName() {
    if (!window.user) return "ผู้ใช้งานทั่วไป";
    return (window.user.UserName || "") + " " + (window.user.UserSname || "");
}

function logout() {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    try {
        window.location.replace("index.html");
    } catch(e) {
        window.location.href = "index.html";
    }
}

/* 
 * ============================================================================
 * [ส่วนที่เพิ่มใหม่] ฟังก์ชันสำหรับหน้า HTML ที่ต้องการบังคับตรวจสิทธิ์/ตำแหน่ง (Hard Check)
 * ============================================================================
 */
function requireAuth(allowedRoles = []) {
    const user = getCurrentUser();
    
    // 1. ถ้ายังไม่ได้ล็อกอิน ให้เด้งไปหน้า login.html
    if (!user) {
        logout();
        return false;
    }
    
    // 2. ถ้ามีการระบุ Role ที่อนุญาต แล้ว User ไม่มีสิทธิ์ตรงตามนั้น
    if (allowedRoles.length > 0) {
        const hasPermission = allowedRoles.some(role => hasRole(role));
        if (!hasPermission) {
            alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
            window.location.replace("main_menu.html");
            return false;
        }
    }
    
    return true;
}
