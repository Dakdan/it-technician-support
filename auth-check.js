/**
 * auth.js
 * ใช้วางบนทุกหน้าที่ต้อง Login ก่อนเข้าใช้งาน
 */
(function () {
    try {
        const userData = localStorage.getItem('currentUser');
        if (!userData) {
            window.location.replace("index.html");
            return;
        }

        const user = JSON.parse(userData);
        if (!user || !user.UserPN) {
            localStorage.removeItem('currentUser');
            window.location.replace("index.html");
            return;
        }

        window.user = user;
    } catch (err) {
        console.error(err);
        localStorage.removeItem('currentUser');
        window.location.replace("index.html");
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
    if (!window.user) return "";
    return window.user.UserName + " " + window.user.UserSname;
}

/**
 * Logout โดยใช้ Modal ของระบบแทน confirm() เพื่อความสวยงาม
 */
function logout() {
    // ปรับใช้ Bootstrap Modal หากมีในหน้าเพจ หรือล้างค่าแล้ว redirect
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    window.location.replace("index.html");
}
