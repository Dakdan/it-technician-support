/**
 * invstock.js - Frontend Client Module for Inventory & Stock Management System
 * Connected to Stock API (GAS 2) & Uses Centralized idbApp (indexeddb.js)
 */

const InvStockApp = {
    // API Endpoint ของ Stock API (GAS 2)
    API_URL: 'https://script.google.com/macros/s/AKfycbwH3wkFil31SDkKDPTcjOfgJ9VrHpBinsNT9ASgRa-WQmpSUg3eMf9wEJEKLLUcnkmx/exec',

    // Runtime State
    departments: [],
    assetTypes: [],
    cartItems: [],
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
            
            // โหลด Master Data จากระบบกลาง/API
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
        const searchInput = document.getElementById('assetSearchInput');
        if (searchInput) {
            let timeout = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.handleAssetSearch(e.target.value), 400);
            });
        }

        const stockInForm = document.getElementById('stockInForm');
        if (stockInForm) {
            stockInForm.addEventListener('submit', (e) => this.handleStockInSubmit(e));
        }
    },

    // -----------------------------------------------------------------
    // 2. HTTP API REQUESTS (Stock API - GAS 2)
    // -----------------------------------------------------------------
    async apiGet(action, params = {}) {
        const url = new URL(this.API_URL);
        url.searchParams.append('action', action);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url.toString(), { method: 'GET' });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return await response.json();
    },

    async apiPost(action, payload = {}) {
        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: action, payload: payload })
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return await response.json();
    },

    // -----------------------------------------------------------------
    // 3. MASTER DATA & INDEXEDDB INTEGRATION (เรียกใช้ idbApp)
    // -----------------------------------------------------------------
    async loadDepartments() {
        try {
            const res = await this.apiGet('getDepartments');
            this.departments = Array.isArray(res) ? res : [];
            this.renderDepartmentOptions('depIdSelect');
        } catch (err) {
            console.error("Failed to load departments:", err);
        }
    },

    async loadAssetTypes() {
        try {
            const res = await this.apiGet('getAssetTypes');
            if (res.success) {
                this.assetTypes = res.data || [];
                this.renderAssetTypeOptions('assetTypeSelect');
            }
        } catch (err) {
            console.error("Failed to load asset types:", err);
        }
    },

    // ซิงค์ข้อมูลจาก Stock API ลง idbApp (IndexedDB กลาง)
    async syncStockDataToLocal() {
        if (typeof idbApp === 'undefined') {
            console.warn("ไม่พบ idbApp (indexeddb.js) ในระบบ");
            return;
        }

        try {
            this.showLoading(true, "กำลังซิงค์ข้อมูลคลังลงเครื่อง...");
            const res = await this.apiGet('getAllInvData');
            
            if (res.status === 'success') {
                // บันทึกลง Object Stores ของ IndexedDB กลางผ่าน idbApp
                if (idbApp.saveData) {
                    await idbApp.saveData('stockIn', res.stockIn);
                    await idbApp.saveData('inventory', res.inventory);
                    await idbApp.saveData('peripherals', res.peripherals);
                    await idbApp.saveData('stockOut', res.stockOut);
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
    // 4. SEARCH & TRANSACTIONS
    // -----------------------------------------------------------------
    async handleAssetSearch(query) {
        if (!query || query.trim().length < 2) {
            this.renderSearchResults([]);
            return;
        }

        try {
            const results = await this.apiGet('searchAsset', { query: query.trim() });
            this.renderSearchResults(results || []);
        } catch (err) {
            console.error("Search Error:", err);
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

            const stockInPayload = {
                depId: document.getElementById('depIdSelect')?.value || '',
                sourceType: document.getElementById('sourceTypeSelect')?.value || '',
                referenceNo: document.getElementById('referenceNoInput')?.value || '',
                itUser: document.getElementById('itUserInput')?.value || '',
                userName: document.getElementById('userNameInput')?.value || '',
                docFileBase64: docBase64,
                docMimeType: docMime,
                docFileName: docName,
                signatureBase64: sigBase64
            };

            const stockInRes = await this.apiPost('saveStockIn', stockInPayload);
            
            if (stockInRes.status !== 'success') {
                throw new Error(stockInRes.message || "บันทึก Stock In ไม่สำเร็จ");
            }

            const stockInID = stockInRes.stockInID;
            const docId = stockInRes.docId;

            this.showLoading(true, "กำลังบันทึก รายการ Inventory...");
            
            for (const item of this.cartItems) {
                const invRes = await this.apiPost('saveSingleInventoryItem', {
                    stockInID: stockInID,
                    docId: docId,
                    item: item
                });

                if (item.peripheralsList && item.peripheralsList.length > 0) {
                    for (const peri of item.peripheralsList) {
                        await this.apiPost('saveSinglePeripheral', {
                            Inv_ID: invRes.invID || stockInID,
                            StockIn_ID: stockInID,
                            Item_ID: item.AssetID || item.NoID || '',
                            Name: peri.name,
                            Quantity: peri.quantity || 1,
                            Unit: peri.unit || 'ชิ้น',
                            Source_Type: stockInPayload.sourceType,
                            Reference_No: stockInPayload.referenceNo,
                            Note: peri.note || '',
                            User: stockInPayload.itUser
                        });
                    }
                }
            }

            this.showToast("บันทึกรับเข้าเรียบร้อยแล้ว", "success");
            this.resetStockInForm();
            
            // ซิงค์อัปเดตข้อมูลกลับลง idbApp
            this.syncStockDataToLocal();

        } catch (error) {
            console.error("Stock In Failed:", error);
            this.showToast("เกิดข้อผิดพลาด: " + error.message, "error");
        } finally {
            this.showLoading(false);
        }
    },

    // -----------------------------------------------------------------
    // 5. SIGNATURE & UTILITIES
    // -----------------------------------------------------------------
    setupSignatureCanvas(canvasId) {
        this.sigCanvas = document.getElementById(canvasId);
        if (!this.sigCanvas) return;

        this.sigCtx = this.sigCanvas.getContext('2d');
        this.sigCtx.lineWidth = 2;
        this.sigCtx.strokeStyle = '#000000';

        const getPos = (e) => {
            const rect = this.sigCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const startDraw = (e) => {
            this.isDrawing = true;
            const pos = getPos(e);
            this.sigCtx.beginPath();
            this.sigCtx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            this.sigCtx.lineTo(pos.x, pos.y);
            this.sigCtx.stroke();
        };

        const stopDraw = () => { this.isDrawing = false; };

        this.sigCanvas.addEventListener('mousedown', startDraw);
        this.sigCanvas.addEventListener('mousemove', draw);
        this.sigCanvas.addEventListener('mouseup', stopDraw);
        this.sigCanvas.addEventListener('mouseleave', stopDraw);

        this.sigCanvas.addEventListener('touchstart', startDraw);
        this.sigCanvas.addEventListener('touchmove', draw);
        this.sigCanvas.addEventListener('touchend', stopDraw);
    },

    clearSignature() {
        if (this.sigCanvas && this.sigCtx) {
            this.sigCtx.clearRect(0, 0, this.sigCanvas.width, this.sigCanvas.height);
        }
    },

    getSignatureBase64() {
        if (!this.sigCanvas) return "";
        const blank = document.createElement('canvas');
        blank.width = this.sigCanvas.width;
        blank.height = this.sigCanvas.height;
        if (this.sigCanvas.toDataURL() === blank.toDataURL()) return "";
        return this.sigCanvas.toDataURL('image/png');
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
            opt.value = type.Type_ID;
            opt.textContent = type.Type_Name;
            select.appendChild(opt);
        });
    },

    renderSearchResults(results) {
        const container = document.getElementById('searchResultsContainer');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = '<div class="p-2 text-muted">ไม่พบข้อมูลครุภัณฑ์</div>';
            return;
        }

        let html = '<ul class="list-group">';
        results.forEach(item => {
            html += `
                <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center cursor-pointer"
                    onclick="InvStockApp.addAssetToCart('${encodeURIComponent(JSON.stringify(item))}')">
                    <div>
                        <strong>[${item.AssetID || 'N/A'}]</strong> ${item.FullDescription}
                        <br><small class="text-muted">Serial: ${item.Serial || '-'} | ${item.AgeInfo}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" type="button">เลือก</button>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    },

    addAssetToCart(jsonStr) {
        const item = JSON.parse(decodeURIComponent(jsonStr));
        item.peripheralsList = [];
        this.cartItems.push(item);
        this.renderCart();
    },

    renderCart() {
        const container = document.getElementById('cartContainer');
        if (!container) return;

        if (this.cartItems.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3">ยังไม่มีรายการที่เลือก</p>';
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-bordered align-middle">';
        html += '<thead><tr><th>#</th><th>รหัสครุภัณฑ์</th><th>รายละเอียด</th><th>จัดการ</th></tr></thead><tbody>';

        this.cartItems.forEach((item, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${item.AssetID || '-'}</strong></td>
                    <td>${item.FullDescription}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="InvStockApp.removeFromCart(${index})">ลบ</button>
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

    resetStockInForm() {
        this.cartItems = [];
        this.renderCart();
        this.clearSignature();
        const form = document.getElementById('stockInForm');
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
