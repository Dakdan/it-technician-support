/**
 * invstock.js - Frontend Client Module for Inventory & Stock Management System
 * Connected to Stock API (GAS 2) & Uses Centralized idbApp (indexeddb.js) & Auth Check
 */

const InvStockApp = {
    // API Endpoint ของ Stock API (GAS 2)
    API_URL: 'https://script.google.com/macros/s/AKfycbwH3wkFil31SDkKDPTcjOfgJ9VrHpBinsNT9ASgRa-WQmpSUg3eMf9wEJEKLLUcnkmx/exec',

    // Runtime State
    departments: [],
    assetTypes: [],
    cartItems: [],         // สำหรับ Stock In
    stockOutCart: [],     // เพิ่มสำหรับ Stock Out (รายการครุภัณฑ์ที่จะจ่ายออก)
    searchResults: [], 
    stockOutSearchResults: [], // เพิ่มสำหรับผลการค้นหาฝั่ง Stock Out
    sigCanvas: null,
    sigCtx: null,
    isDrawing: false,

    // -----------------------------------------------------------------
    // 1. INITIALIZATION
    // -----------------------------------------------------------------
    async init() {
        try {
            this.bindEvents();
            this.setupSignatureCanvas('signatureCanvas');
            this.setupSignatureCanvas('signatureCanvasOut'); // รองรับ Canvas ฝั่ง Stock Out (ถ้ามี)
            
            // โหลด Master Data
            await Promise.all([
                this.loadDepartments(),
                this.loadAssetTypes()
            ]);
        } catch (error) {
            console.error("InvStock Init Error:", error);
            this.showToast("เกิดข้อผิดพลาดในการเริ่มต้นระบบคลัง", "error");
        }
    },

    bindEvents() {
        // Stock In Search
        const searchInput = document.getElementById('assetSearchInput');
        if (searchInput) {
            let timeout = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.handleAssetSearch(e.target.value), 400);
            });
        }

        // Stock Out Search (ค้นหาครุภัณฑ์ในสต็อกเพื่อจ่ายออก)
        const stockOutSearchInput = document.getElementById('stockOutSearchInput');
        if (stockOutSearchInput) {
            let timeoutOut = null;
            stockOutSearchInput.addEventListener('input', (e) => {
                clearTimeout(timeoutOut);
                timeoutOut = setTimeout(() => this.handleStockOutAssetSearch(e.target.value), 400);
            });
        }

        const stockInForm = document.getElementById('stockInForm');
        if (stockInForm) {
            stockInForm.addEventListener('submit', (e) => this.handleStockInSubmit(e));
        }

        const stockOutForm = document.getElementById('stockOutForm');
        if (stockOutForm) {
            stockOutForm.addEventListener('submit', (e) => this.handleStockOutSubmit(e));
        }
    },

    // -----------------------------------------------------------------
    // 2. HTTP API REQUESTS (รองรับ Auth Token และ Error Handling)
    // -----------------------------------------------------------------
    getAuthToken() {
        if (typeof getCurrentUser === 'function') {
            const user = getCurrentUser();
            return user ? (user.Token || user.token || '') : '';
        }
        return '';
    },

    async apiGet(action, params = {}) {
        const url = new URL(this.API_URL);
        url.searchParams.append('action', action);
        url.searchParams.append('token', this.getAuthToken());
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url.toString(), { method: 'GET' });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const result = await response.json();

        // ตรวจสอบกรณี Token หมดอายุ
        if (result && result.message && result.message.includes("Unauthorized")) {
            alert("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
            if (typeof logout === 'function') logout();
            return null;
        }
        return result;
    },

    async apiPost(action, payload = {}) {
        const requestData = {
            action: action,
            token: this.getAuthToken(),
            payload: payload
        };

        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(requestData)
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const result = await response.json();

        if (result && result.message && result.message.includes("Unauthorized")) {
            alert("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
            if (typeof logout === 'function') logout();
            return null;
        }
        return result;
    },

    // -----------------------------------------------------------------
    // 3. MASTER DATA & INDEXEDDB INTEGRATION
    // -----------------------------------------------------------------
    async loadDepartments() {
        try {
            const res = await this.apiGet('getDepartments');
            this.departments = Array.isArray(res) ? res : (res?.data || []);
            this.renderDepartmentOptions('depIdSelect');
            this.renderDepartmentOptions('depIdSelectOut'); // รองรับฟอร์ม Stock Out
        } catch (err) {
            console.error("Failed to load departments:", err);
        }
    },

    async loadAssetTypes() {
        try {
            const res = await this.apiGet('getAssetTypes');
            if (res && res.success) {
                this.assetTypes = res.data || [];
                this.renderAssetTypeOptions('assetTypeSelect');
            }
        } catch (err) {
            console.error("Failed to load asset types:", err);
        }
    },

    async syncStockDataToLocal() {
        if (typeof idbApp === 'undefined') {
            console.warn("ไม่พบ idbApp (indexeddb.js) ในระบบ");
            return;
        }

        try {
            this.showLoading(true, "กำลังซิงค์ข้อมูลคลังลงเครื่อง...");
            const res = await this.apiGet('getAllInvData');
             
            if (res && (res.status === 'success' || res.success)) {
                const dataToSave = res.inventory || res.data || [];
                 
                if (typeof idbApp.saveAssets === 'function') {
                    await idbApp.saveAssets(dataToSave);
                }
                this.showToast("ซิงค์ข้อมูลคลังพัสดุสำเร็จ", "success");
            }
        } catch (err) {
            console.error("Sync Stock Data Error:", err);
            this.showToast("เกิดข้อผิดพลาดในการซิงค์ข้อมูล", "error");
        } finally {
            this.showLoading(false);
        }
    },

    // -----------------------------------------------------------------
    // 4. SEARCH & TRANSACTIONS (Stock In & Stock Out)
    // -----------------------------------------------------------------
    async handleAssetSearch(query) {
        if (!query || query.trim().length < 2) {
            this.searchResults = [];
            this.renderSearchResults([]);
            return;
        }

        try {
            const results = await this.apiGet('searchAsset', { query: query.trim() });
            this.searchResults = results || [];
            this.renderSearchResults(this.searchResults);
        } catch (err) {
            console.error("Search Error:", err);
        }
    },

    // ค้นหาครุภัณฑ์ในระบบเพื่อทำ Stock Out (ค้นหาจาก Inventory หรือ Asset ที่พร้อมจ่าย)
    async handleStockOutAssetSearch(query) {
        if (!query || query.trim().length < 2) {
            this.stockOutSearchResults = [];
            this.renderStockOutSearchResults([]);
            return;
        }

        try {
            // สามารถเรียกผ่าน IndexedDB หากมีข้อมูลอยู่ในเครื่อง หรือเรียกผ่าน API 'getInventory' / 'searchAsset'
            if (typeof idbApp !== 'undefined' && typeof idbApp.getAssets === 'function') {
                const localAssets = await idbApp.getAssets();
                const q = query.trim().toLowerCase();
                this.stockOutSearchResults = localAssets.filter(item => 
                    String(item.AssetID || '').toLowerCase().includes(q) ||
                    String(item.Inv_ID || '').toLowerCase().includes(q) ||
                    String(item.FullDescription || '').toLowerCase().includes(q)
                ).slice(0, 20);
            } else {
                const res = await this.apiGet('getInventory');
                const items = Array.isArray(res) ? res : (res?.data || []);
                const q = query.trim().toLowerCase();
                this.stockOutSearchResults = items.filter(item => 
                    String(item.AssetID || '').toLowerCase().includes(q) ||
                    String(item.Inv_ID || '').toLowerCase().includes(q) ||
                    String(item.FullDescription || '').toLowerCase().includes(q)
                ).slice(0, 20);
            }
            this.renderStockOutSearchResults(this.stockOutSearchResults);
        } catch (err) {
            console.error("StockOut Search Error:", err);
        }
    },

    async handleStockInSubmit(e) {
        e.preventDefault();
         
        if (this.cartItems.length === 0) {
            this.showToast("กรุณาเลือกรายการครุภัณฑ์อย่างน้อย 1 รายการ", "warning");
            return;
        }

        try {
            this.showLoading(true, "กำลังบันทึกเอกสารรับเข้า...");

            const docFile = document.getElementById('docFileInput')?.files[0];
            let docBase64 = "", docMime = "", docName = "";
            if (docFile) {
                docBase64 = await this.fileToBase64(docFile);
                docMime = docFile.type;
                docName = docFile.name;
            }

            const sigBase64 = this.getSignatureBase64();

            const fullStockInPayload = {
                depId: document.getElementById('depIdSelect')?.value || '',
                sourceType: document.getElementById('sourceTypeSelect')?.value || '',
                referenceNo: document.getElementById('referenceNoInput')?.value || '',
                itUser: document.getElementById('itUserInput')?.value || '',
                userName: document.getElementById('userNameInput')?.value || '',
                docFileBase64: docBase64,
                docMimeType: docMime,
                docFileName: docName,
                signatureBase64: sigBase64,
                items: this.cartItems 
            };

            const stockInRes = await this.apiPost('saveBatchStockIn', fullStockInPayload);
             
            if (!stockInRes || (stockInRes.status !== 'success' && !stockInRes.success)) {
                throw new Error(stockInRes?.message || "บันทึก Stock In ไม่สำเร็จ");
            }

            this.showToast("บันทึกรับเข้าเรียบร้อยแล้ว", "success");
            this.resetStockInForm();
            this.syncStockDataToLocal();

        } catch (error) {
            console.error("Stock In Failed:", error);
            this.showToast("เกิดข้อผิดพลาด: " + error.message, "error");
        } finally {
            this.showLoading(false);
        }
    },

    // ฟังก์ชันจัดการบันทึก Stock Out ส่งไปยัง GAS Backend ตามโครงสร้างใหม่ที่รองรับ
    async handleStockOutSubmit(e) {
        e.preventDefault();

        if (this.stockOutCart.length === 0) {
            this.showToast("กรุณาเลือกรายการครุภัณฑ์ที่จะจ่ายออกอย่างน้อย 1 รายการ", "warning");
            return;
        }

        try {
            this.showLoading(true, "กำลังบันทึกเอกสารจ่ายออก (Stock Out)...");

            const docFile = document.getElementById('docFileOutInput')?.files[0];
            let docBase64 = "", docMime = "", docName = "";
            if (docFile) {
                docBase64 = await this.fileToBase64(docFile);
                docMime = docFile.type;
                docName = docFile.name;
            }

            const userConfirmBase64 = this.getSignatureBase64('signatureCanvasOut');

            const stockOutPayload = {
                depId: document.getElementById('depIdSelectOut')?.value || '',
                sourceType: document.getElementById('sourceTypeSelectOut')?.value || '',
                referenceNo: document.getElementById('referenceNoInputOut')?.value || '',
                itUser: document.getElementById('itUserOutInput')?.value || '',
                userName: document.getElementById('userNameOutInput')?.value || '',
                issueTo: document.getElementById('issueToInput')?.value || '',
                note: document.getElementById('stockOutNoteInput')?.value || '',
                docFileBase64: docBase64,
                docMimeType: docMime,
                docFileName: docName,
                userConfirmBase64: userConfirmBase64,
                items: this.stockOutCart,       // ส่งรายการ Inventory_Asset_Out
                peripherals: []                 // สามารถพ่วงอุปกรณ์ต่อพ่วง (Peripherals_Device_Out) ถ้ามี
            };

            const stockOutRes = await this.apiPost('saveStockOut', stockOutPayload);

            if (!stockOutRes || (stockOutRes.status !== 'success' && !stockOutRes.success)) {
                throw new Error(stockOutRes?.message || "บันทึก Stock Outไม่สำเร็จ");
            }

            this.showToast("บันทึกจ่ายออกสำเร็จ", "success");
            this.resetStockOutForm();
            this.syncStockDataToLocal();

        } catch (error) {
            console.error("Stock Out Failed:", error);
            this.showToast("เกิดข้อผิดพลาด: " + error.message, "error");
        } finally {
            this.showLoading(false);
        }
    },

    // -----------------------------------------------------------------
    // 5. SIGNATURE & UTILITIES
    // -----------------------------------------------------------------
    setupSignatureCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000000';

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const startDraw = (e) => {
            this.isDrawing = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        };

        const stopDraw = () => { this.isDrawing = false; };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDraw);
        canvas.addEventListener('mouseleave', stopDraw);

        canvas.addEventListener('touchstart', startDraw);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDraw);
    },

    clearSignature(canvasId = 'signatureCanvas') {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    },

    getSignatureBase64(canvasId = 'signatureCanvas') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return "";
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        if (canvas.toDataURL() === blank.toDataURL()) return "";
        return canvas.toDataURL('image/png');
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    // -----------------------------------------------------------------
    // 6. UI RENDER HELPERS
    // -----------------------------------------------------------------
    renderDepartmentOptions(elementId) {
        const select = document.getElementById(elementId);
        if (!select) return;
        select.innerHTML = '<option value="">-- เลือกหน่วยงาน --</option>';
        this.departments.forEach(dept => {
            const opt = document.createElement('option');
            opt.value = dept.DEP_ID || dept.dep_id || dept.ID || '';
            opt.textContent = dept.DEP_NAME || dept.dep_name || dept.Name || opt.value;
            select.appendChild(opt);
        });
    },

    renderAssetTypeOptions(elementId) {
        const select = document.getElementById(elementId);
        if (!select) return;
        select.innerHTML = '<option value="">-- เลือกประเภทครุภัณฑ์ --</option>';
        this.assetTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.Type_ID || type.type_id || '';
            opt.textContent = type.Type_Name || type.type_name || opt.value;
            select.appendChild(opt);
        });
    },

    renderSearchResults(results) {
        const container = document.getElementById('searchResultsContainer');
        if (!container) return;

        if (!results || results.length === 0) {
            container.innerHTML = '<div class="p-2 text-muted">ไม่พบข้อมูลครุภัณฑ์</div>';
            return;
        }

        let html = '<ul class="list-group">';
        results.forEach((item, index) => {
            html += `
                <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center cursor-pointer"
                    onclick="InvStockApp.addAssetToCartByIndex(${index})">
                    <div>
                        <strong>[${item.AssetID || 'N/A'}]</strong> ${item.FullDescription || item.Name || ''}
                        <br><small class="text-muted">Serial: ${item.Serial || '-'} | ${item.AgeInfo || ''}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" type="button">เลือก</button>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    },

    // เรนเดอร์ผลการค้นหาฝั่ง Stock Out
    renderStockOutSearchResults(results) {
        const container = document.getElementById('stockOutSearchResultsContainer');
        if (!container) return;

        if (!results || results.length === 0) {
            container.innerHTML = '<div class="p-2 text-muted">ไม่พบข้อมูลครุภัณฑ์ในสต็อก</div>';
            return;
        }

        let html = '<ul class="list-group">';
        results.forEach((item, index) => {
            html += `
                <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center cursor-pointer"
                    onclick="InvStockApp.addAssetToStockOutCartByIndex(${index})">
                    <div>
                        <strong>[Inv: ${item.Inv_ID || 'N/A'}] Asset ID: ${item.AssetID || '-'}</strong> 
                        <br>${item.FullDescription || ''}
                        <br><small class="text-muted">สถานะ: ${item.InvStatus || 'ปกติ'}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-success" type="button">เลือกจ่ายออก</button>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    },

    addAssetToCartByIndex(index) {
        const item = this.searchResults[index];
        if (!item) return;

        const cartItem = JSON.parse(JSON.stringify(item));
        cartItem.peripheralsList = cartItem.peripheralsList || [];
         
        this.cartItems.push(cartItem);
        this.renderCart();
    },

    // เพิ่มครุภัณฑ์ลงในตะกร้า Stock Out
    addAssetToStockOutCartByIndex(index) {
        const item = this.stockOutSearchResults[index];
        if (!item) return;

        // ตรวจสอบว่ามีอยู่ในตะกร้า Stock Out แล้วหรือยัง
        const exists = this.stockOutCart.some(i => (i.Inv_ID && i.Inv_ID === item.Inv_ID) || (i.AssetID && i.AssetID === item.AssetID));
        if (exists) {
            this.showToast("รายการนี้อยู่ในรายการจ่ายออกแล้ว", "warning");
            return;
        }

        const cartItem = JSON.parse(JSON.stringify(item));
        this.stockOutCart.push(cartItem);
        this.renderStockOutCart();
    },

    renderCart() {
        const container = document.getElementById('cartContainer');
        if (!container) return;

        if (this.cartItems.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3">ยังไม่มีรายการรับเข้าที่เลือก</p>';
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-bordered align-middle">';
        html += '<thead><tr><th>#</th><th>รหัสครุภัณฑ์</th><th>รายละเอียด</th><th>จัดการ</th></tr></thead><tbody>';

        this.cartItems.forEach((item, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${item.AssetID || '-'}</strong></td>
                    <td>${item.FullDescription || item.Name || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="InvStockApp.removeFromCart(${index})">ลบ</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    // เรนเดอร์ตะกร้า Stock Out
    renderStockOutCart() {
        const container = document.getElementById('stockOutCartContainer');
        if (!container) return;

        if (this.stockOutCart.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3">ยังไม่มีรายการจ่ายออกที่เลือก</p>';
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-bordered align-middle">';
        html += '<thead><tr><th>#</th><th>Inv ID</th><th>รหัสครุภัณฑ์</th><th>รายละเอียด</th><th>จัดการ</th></tr></thead><tbody>';

        this.stockOutCart.forEach((item, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><small>${item.Inv_ID || '-'}</small></td>
                    <td><strong>${item.AssetID || '-'}</strong></td>
                    <td>${item.FullDescription || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="InvStockApp.removeFromStockOutCart(${index})">ลบ</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    removeFromCart(index) {
        this.cartItems.splice(index, 1);
        this.renderCart();
    },

    removeFromStockOutCart(index) {
        this.stockOutCart.splice(index, 1);
        this.renderStockOutCart();
    },

    resetStockInForm() {
        this.cartItems = [];
        this.searchResults = [];
        this.renderCart();
        this.clearSignature('signatureCanvas');
        const form = document.getElementById('stockInForm');
        if (form) form.reset();
    },

    resetStockOutForm() {
        this.stockOutCart = [];
        this.stockOutSearchResults = [];
        this.renderStockOutCart();
        this.clearSignature('signatureCanvasOut');
        const form = document.getElementById('stockOutForm');
        if (form) form.reset();
    },

    showLoading(show, message = "กำลังประมวลผล...") {
        const loader = document.getElementById('globalLoader');
        const loaderMsg = document.getElementById('globalLoaderMsg');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
            if (loaderMsg) loaderMsg.textContent = message;
        }
    },

    showToast(message, type = 'info') {
        if (window.Swal) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: type,
                title: message,
                showConfirmButton: false,
                timer: 3000
            });
        } else {
            alert(`[${type.toUpperCase()}] ${message}`);
        }
    }
};

// Initialize เมื่อ DOM พร้อม
document.addEventListener('DOMContentLoaded', () => {
    InvStockApp.init();
});
