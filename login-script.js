const API_URL = "https://script.google.com/macros/s/AKfycby5WekOkEZJBTR-uC-HRSpyBx9BMoWoI10pyrgcKS9AGmWQdNG2UsThnYaaM55C2xKP/exec";

const loginForm = document.getElementById('loginForm');
const loading = document.getElementById('loadingOverlay');

loginForm.addEventListener('submit', async function(e) {


e.preventDefault();

const username =
    document.getElementById('userpn').value.trim();

const password =
    document.getElementById('userpw').value;

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

        showAlert(
            'เข้าสู่ระบบไม่สำเร็จ',
            result.message,
            'error'
        );

        return;
    }

    localStorage.setItem(
        'currentUser',
        JSON.stringify(result.data)
    );

    if (result.resetRequired === true) {

        window.location.href =
            'change-password.html';

        return;
    }

    window.location.href = 'main_menu.html';

} catch (err) {

    loading.style.display = 'none';

    console.error(err);

    showAlert(
        'ระบบขัดข้อง',
        'ไม่สามารถเชื่อมต่อ Server ได้',
        'error'
    );

}


});

function logout() {


localStorage.removeItem('currentUser');

window.location.href = 'index.html';


}

function getCurrentUser() {


return JSON.parse(
    localStorage.getItem('currentUser')
);


}
