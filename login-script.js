/**
 * login-script.js
 * ใช้วางบนทุกหน้าที่ต้อง Login ก่อนเข้าใช้งาน
 */
const API_URL = "https://script.google.com/macros/s/AKfycby5WekOkEZJBTR-uC-HRSpyBx9BMoWoI10pyrgcKS9AGmWQdNG2UsThnYaaM55C2xKP/exec";

const loginForm = document.getElementById('loginForm');
const loading = document.getElementById('loadingOverlay');

loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('userpn').value.trim();
    const password = document.getElementById('userpw').value;

    loading.style.display = 'flex';

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
        loading.style.display = 'none';

        if (!result.success) {
            showAlert('เข้าสู่ระบบไม่สำเร็จ', result.message, 'error');
            return;
        }

        // 🟢 Token จาก Backend จะถูกบันทึกรวมอยู่ใน result.data ลง LocalStorage อัตโนมัติแล้ว!
        localStorage.setItem('currentUser', JSON.stringify(result.data));

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

        if (typeof safeRedirect === 'function') {
            safeRedirect('main_menu.html');
        } else {
            window.location.href = 'main_menu.html';
        }

    } catch (error) {
        // 🔴 ปิดบล็อก try...catch ที่หายไปตรงนี้ เพื่อป้องกันสคริปต์พังเวลาเน็ตหลุด
        loading.style.display = 'none';
        showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อระบบได้: ' + error.message, 'error');
    }
}); 
// สิ้นสุด Event Listener
