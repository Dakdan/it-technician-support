/**
 * auth-check.js
 * ใช้วางบนหน้าเมนูหลักเพื่อตรวจสอบและดึงโปรไฟล์ผู้ใช้งานจาก LocalStorage
 */
(function () {
    try {
        const userData = localStorage.getItem('currentUser');
        if (!userData) {
            window.user = null; // ปรับไม่ให้เด้งหนี เพื่อส่งค่าไปเปลี่ยนสลับปุ่มล็อกอินที่หน้าหลักแทน
            return;
        }

        const user = JSON.parse(userData);
        if (!user || !user.UserPN) {
            localStorage.removeItem('currentUser');
            window.user = null;
            return;
        }

        // ผูก Object ผู้ใช้งานเข้ากับ Global Window สำหรับการดึงใช้งานในหน้าเพจ
        window.user = user;
    } catch (err) {
        console.error("Auth-Check error: ", err);
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
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    try {
        window.location.replace("index.html");
    } catch(e) {
        window.location.href = "index.html";
    }
}
