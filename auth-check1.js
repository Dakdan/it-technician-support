 <script>
        (function () {
            try {
                // ดึงข้อมูลจาก LocalStorage ด้วย Key: 'currentUser'
                const userData = localStorage.getItem('currentUser');
                
                // เงื่อนไข 1: หากไม่มีข้อมูลในระบบ
                if (!userData) {
                    window.user = null; // ปรับไม่ให้เด้งหนี เพื่อส่งค่าไปเปลี่ยนสลับปุ่มล็อกอินที่หน้าหลักแทน
                    return;
                }

                const user = JSON.parse(userData);
                
                // เงื่อนไข 2: หากมีข้อมูลแต่โครงสร้างไม่ถูกต้อง (ไม่มี UserPN)
                if (!user || !user.UserPN) {
                    localStorage.removeItem('currentUser'); // ล้างข้อมูลขยะทิ้ง
                    window.user = null;
                    return;
                }

                // เงื่อนไข 3: ข้อมูลถูกต้อง
                // ผูก Object ผู้ใช้งานเข้ากับ Global Window สำหรับการดึงใช้งานในหน้าเพจได้อย่างอิสระ
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
                window.location.replace("index.html"); // ใช้ replace เพื่อไม่ให้กด Back กลับมาได้
            } catch(e) {
                window.location.href = "index.html"; // Fallback กรณี Browser ไม่รองรับ replace
            }
        }
    </script> 
