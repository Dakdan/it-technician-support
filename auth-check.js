/*
 * ============================================================================
 * ไฟล์: auth-check.js
 * วัตถุประสงค์: ตรวจสอบสถานะการล็อกอิน, ตรวจสอบ TTL, และตรวจจับการไม่ได้ใช้งาน
 * ============================================================================
 */

(function () {
    try {
        // ตรวจดึงข้อมูลจากทั้ง sessionStorage และ localStorage
        const rawData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');

        if (!rawData) {
            window.user = null;
            return;
        }

        const user = JSON.parse(rawData);

        // ตรวจสอบฟิลด์ UserPN หรือ username
        if (!user || (!user.UserPN && !user.username)) {
            clearSessionAndRedirect("โครงสร้างข้อมูลผู้ใช้ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
            return;
        }

        // ตรวจสอบการหมดอายุของ Session (TTL Expiry)
        if (user.loginTime && user.expiresIn) {
            const now = new Date().getTime();
            if (now - user.loginTime > user.expiresIn) {
                clearSessionAndRedirect("เซสชันของคุณหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
                return;
            }
        }

        // ผ่านทุกเงื่อนไข -> บันทึกเข้า Global Object
        window.user = user;

        // เริ่มต้นระบบตรวจจับผู้ใช้ไม่ได้ใช้งาน (Inactivity Checker)
        initInactivityChecker();

    } catch (err) {
        console.error("Auth-Check error: ", err);
        clearSessionAndRedirect("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ กรุณาเข้าสู่ระบบใหม่");
    }
})();

// ล้าง Session จากทั้ง 2 Storage และแจ้งเตือนผ่าน Modal ก่อนเด้งกลับหน้า Login
function clearSessionAndRedirect(customMessage) {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    window.user = null;

    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'index.html' || currentPage === 'login.html' || currentPage === '') {
        return;
    }

    const modal = document.getElementById('sessionExpiredModal');
    const msgEl = document.getElementById('sessionExpiredMessage');

    if (modal) {
        if (msgEl && customMessage) {
            msgEl.innerText = customMessage;
        }
        modal.classList.remove('hidden');
    } else {
        if (customMessage) {
            alert(customMessage);
        }
        window.location.replace("index.html");
    }
}

// ฟังก์ชันสำหรับปุ่มตกลงบน Modal ในการย้ายกลับหน้า Login
function redirectToLogin() {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    window.user = null;
    
    try {
        window.location.replace("index.html");
    } catch (e) {
        window.location.href = "index.html";
    }
}

// ตรวจจับการไม่ได้ใช้งานนาน (Inactivity Checker)
function initInactivityChecker() {
    // ตั้งเวลานิ่งเกิน 15 นาที -> บังคับ Logout (15 * 60 * 1000 ms)
    const INACTIVITY_LIMIT = 15 * 60 * 1000;
    let timeoutId;

    function resetTimer() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            clearSessionAndRedirect("คุณไม่ได้ใช้งานระบบเป็นเวลานาน เพื่อความปลอดภัย กรุณายืนยันตัวตนใหม่อีกครั้ง");
        }, INACTIVITY_LIMIT);
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(evt => document.addEventListener(evt, resetTimer, false));

    resetTimer();
}

function getCurrentUser() {
    return window.user || null;
}

function hasRole(role) {
    if (!window.user) return false;
    const currentRole = window.user.UserTypeID || window.user.Role || '';
    return String(currentRole).toUpperCase() === String(role).toUpperCase();
}

function getDisplayName() {
    if (!window.user) return "ผู้ใช้งานทั่วไป";
    return (window.user.UserName || "") + " " + (window.user.UserSname || "");
}

function logout() {
    clearSessionAndRedirect();
}

function requireAuth(allowedRoles = []) {
    const user = getCurrentUser();
    
    if (!user) {
        clearSessionAndRedirect();
        return false;
    }
    
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

async function callApi(action, payload = {}) {
    if (typeof API_URL === 'undefined' && typeof window.API_URL === 'undefined') {
        console.error("API_URL is not defined in this page.");
        return { success: false, message: "ไม่ได้กำหนดค่า API_URL ในหน้าเว็บนี้" };
    }

    const apiUrl = window.API_URL || API_URL;
    const user = getCurrentUser();
    const token = user ? (user.Token || user.token) : '';

    const requestData = {
        action: action,
        token: token,
        ...payload
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify(requestData),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });

        const result = await response.json();

        if (!result.success && result.message && result.message.includes("Unauthorized")) {
            clearSessionAndRedirect("เซสชันของคุณหมดอายุหรือเข้าสู่ระบบจากที่อื่น กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
            return null;
        }

        return result;
    } catch (error) {
        console.error("API Call Error: ", error);
        return { success: false, message: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: " + error.message };
    }
}
