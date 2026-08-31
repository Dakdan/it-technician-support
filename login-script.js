/**
 * login-script.js
 * ใช้วางบนทุกหน้าที่ต้อง Login ก่อนเข้าใช้งาน
 * รองรับการแยกบันทึกข้อมูลตามประเภทอุปกรณ์ (PC / Smartphone) พร้อมระบบ TTL
 */
const API_URL = "https://script.google.com/macros/s/AKfycby5WekOkEZJBTR-uC-HRSpyBx9BMoWoI10pyrgcKS9AGmWQdNG2UsThnYaaM55C2xKP/exec";

const loginForm = document.getElementById('loginForm');
const loading = document.getElementById('loadingOverlay');

loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('userpn').value.trim();
    const password = document.getElementById('userpw').value;

    if (loading) loading.style.display = 'flex';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'login',
                username: username,
                password: password
            }),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });

        const result = await response.json();
        if (loading) loading.style.display = 'none';

        if (!result.success) {
            showAlert('เข้าสู่ระบบไม่สำเร็จ', result.message, 'error');
            return;
        }

        // 🟢 ตรวจสอบประเภทอุปกรณ์เพื่อเลือกที่จัดเก็บ Session ให้สอดคล้องกับ auth-check.js
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const targetStorage = isMobile ? sessionStorage : localStorage;

        // บันทึกข้อมูลพร้อมพารามิเตอร์ควบคุมเวลาหมดอายุเฉพาะบน PC (8 ชั่วโมง)
        const sessionData = {
            ...result.data,
            loginTime: new Date().getTime(),
            expiresIn: 8 * 60 * 60 * 1000 
        };

        targetStorage.setItem('currentUser', JSON.stringify(sessionData));

        // ตรวจสอบเงื่อนไขการบังคับเปลี่ยนรหัสผ่าน
        if (result.resetRequired === true) {
            if (typeof forceResetUser !== 'undefined') {
                forceResetUser = result.data;
            }

            if (typeof switchState === 'function') {
                switchState('changeState');
            }

            const changeUserpn = document.getElementById('changeUserpn');
            if (changeUserpn) {
                changeUserpn.value = username;
                changeUserpn.readOnly = true;
            }

            const changePassDesc = document.getElementById('changePassDesc');
            if (changePassDesc) {
                changePassDesc.innerHTML = `<span class="text-danger fw-bold"><i class="fa-solid fa-triangle-exclamation me-1"></i>ระบบบังคับให้เปลี่ยนรหัสผ่านใหม่ก่อนเข้าใช้งาน</span><br>กรุณากำหนดรหัสผ่านใหม่เพื่อความปลอดภัยของบัญชี`;
            }
            
            const btnBackToLogin = document.getElementById('btnBackToLogin');
            const changeDivider = document.getElementById('changeDivider');
            if (btnBackToLogin) btnBackToLogin.classList.add('d-none');
            if (changeDivider) changeDivider.classList.add('d-none');

            return;
        }

        // เปลี่ยนหน้าเข้าสู่ระบบหลัก
        if (typeof safeRedirect === 'function') {
            safeRedirect('main_menu.html');
        } else {
            window.location.href = 'main_menu.html';
        }

    } catch (error) {
        if (loading) loading.style.display = 'none';
        showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อระบบได้: ' + error.message, 'error');
    }
});
