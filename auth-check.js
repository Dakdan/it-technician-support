/*
 * ============================================================================
 * ไฟล์: auth-check.js (เวอร์ชันปรับปรุง: รองรับ Hard Check, Role Check และ Call API พร้อม Token)
 * วัตถุประสงค์: ตรวจสอบสถานะ, สิทธิ์การเข้าใช้งาน และจัดการการสื่อสารกับ Backend
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
 * [ส่วนเดิม] ฟังก์ชันสำหรับหน้า HTML ที่ต้องการบังคับตรวจสิทธิ์/ตำแหน่ง (Hard Check)
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

/* 
 * ============================================================================
 * [ส่วนเพิ่มใหม่] ฟังก์ชันกลางสำหรับเรียกใช้งาน API พร้อมแนบ Token และจัดการ Error อัตโนมัติ
 * ============================================================================
 */
async function callApi(action, payload = {}) {
    // ตรวจสอบว่าในหน้า HTML นั้น ๆ มีการประกาศตัวแปร API_URL ไว้หรือไม่
    if (typeof API_URL === 'undefined') {
        console.error("API_URL is not defined in this page.");
        return { success: false, message: "ไม่ได้กำหนดค่า API_URL ในหน้าเว็บนี้" };
    }

    const user = getCurrentUser();
    const token = user ? (user.Token || user.token) : '';

    const requestData = {
        action: action,
        token: token,
        ...payload
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(requestData),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });

        const result = await response.json();

        // ตรวจสอบกรณี Backend แจ้งว่า Token ไม่ถูกต้องหรือหมดอายุ (Unauthorized)
        if (!result.success && result.message && result.message.includes("Unauthorized")) {
            alert("เซสชันของคุณหมดอายุหรือเข้าสู่ระบบจากที่อื่น กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
            logout();
            return null;
        }

        return result;
    } catch (error) {
        console.error("API Call Error: ", error);
        return { success: false, message: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: " + error.message };
    }
}
