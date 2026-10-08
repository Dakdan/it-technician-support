/**
 * login-script.js
 * ใช้วางบนทุกหน้าที่ต้อง Login ก่อนเข้าใช้งาน
 * รองรับการแยกบันทึกข้อมูลตามประเภทอุปกรณ์ (PC / Smartphone) พร้อมระบบ TTL และการจัดเก็บ Token
 */

// กำหนด API_URL (ใช้ window.API_URL เพื่อป้องกันปัญหา Identifier Error กรณีโหลดหลายสคริปต์)
window.API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycby5WekOkEZJBTR-uC-HRSpyBx9BMoWoI10pyrgcKS9AGmWQdNG2UsThnYaaM55C2xKP/exec";

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loading = document.getElementById('loadingOverlay');

    if (!loginForm) return;

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const usernameInput = document.getElementById('userpn');
        const passwordInput = document.getElementById('userpw');

        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            if (typeof showAlert === 'function') {
                showAlert('คำเตือน', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'warning');
            } else {
                alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
            }
            return;
        }

        if (loading) loading.style.display = 'flex';

        try {
            const response = await fetch(window.API_URL, {
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
                if (typeof showAlert === 'function') {
                    showAlert('เข้าสู่ระบบไม่สำเร็จ', result.message, 'error');
                } else {
                    alert('เข้าสู่ระบบไม่สำเร็จ: ' + result.message);
                }
                return;
            }

            // 1. ตรวจสอบประเภทอุปกรณ์เพื่อเลือก Storage
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const targetStorage = isMobile ? sessionStorage : localStorage;
            const otherStorage = isMobile ? localStorage : sessionStorage;

            // 2. ล้าง Session ตกค้างใน Storage ฝั่งตรงข้าม เพื่อป้องกันข้อมูลตีกัน
            otherStorage.removeItem('currentUser');

            // 3. จัดเตรียม Session Data
            const sessionData = {
                ...result.data,
                loginTime: new Date().getTime(),
                expiresIn: 8 * 60 * 60 * 1000 // 8 ชั่วโมง
            };

            // 4. กรณีต้องบังคับเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน
            if (result.resetRequired === true) {
                // เก็บชั่วคราวแต่ตั้ง Flag ไว้ หรือไม่บันทึกเป็น Session สมบูรณ์
                sessionData.mustChangePassword = true;
                targetStorage.setItem('tempUserForReset', JSON.stringify(sessionData));

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

            // 5. บันทึก Session สมบูรณ์ลงใน Storage
            targetStorage.setItem('currentUser', JSON.stringify(sessionData));

            // 6. เปลี่ยนหน้าไปยังเมนูหลัก
            if (typeof safeRedirect === 'function') {
                safeRedirect('main_menu.html');
            } else {
                window.location.href = 'main_menu.html';
            }

        } catch (error) {
            if (loading) loading.style.display = 'none';
            if (typeof showAlert === 'function') {
                showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อระบบได้: ' + error.message, 'error');
            } else {
                alert('ไม่สามารถเชื่อมต่อระบบได้: ' + error.message);
            }
        }
    });
});
