/*
 * ============================================================================
 * ไฟล์: auth-check.js (Hard Check Version)
 * วัตถุประสงค์: ตรวจสอบสถานะการเข้าสู่ระบบ หากไม่ผ่านจะ Redirect ไปหน้า login.html ทันที
 * ============================================================================
 */
(function () {
    const LOGIN_PAGE = 'login.html'; // กำหนดปลายทางกรณีไม่ผ่านการยืนยันตัวตน

    // ฟังก์ชันสำหรับเคลียร์ Session และสั่ง Redirect
    function redirectToLogin() {
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('currentUser');
        window.user = null;
        
        // ใช้ replace เพื่อป้องกันไม่ให้ผู้ใช้กดปุ่ม Back กลับเข้ามาที่หน้านี้ได้
        try {
            window.location.replace(LOGIN_PAGE);
        } catch (e) {
            window.location.href = LOGIN_PAGE;
        }
    }

    try {
        // ดึงข้อมูลจาก sessionStorage (Mobile) หรือ localStorage (PC)
        const userData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');

        // เงื่อนไข 1: ไม่มีข้อมูลในระบบ
        if (!userData) {
            redirectToLogin();
            return;
        }

        const user = JSON.parse(userData);

        // เงื่อนไข 2: มีข้อมูลแต่โครงสร้างไม่ถูกต้อง (ไม่มี UserPN)
        if (!user || !user.UserPN) {
            redirectToLogin();
            return;
        }

        // เงื่อนไข 3: ตรวจสอบเวลาหมดอายุ (TTL)
        if (user.loginTime && user.expiresIn) {
            const now = new Date().getTime();
            if (now - user.loginTime > user.expiresIn) {
                redirectToLogin();
                return;
            }
        }

        // เงื่อนไข 4: ผ่านการตรวจสอบ -> ผูก Object เข้ากับ Global Window
        window.user = user;
    } catch (err) {
        console.error("Auth-Check error: ", err);
        redirectToLogin();
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
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    try {
        window.location.replace("login.html");
    } catch(e) {
        window.location.href = "login.html";
    }
}
