import { CONFIG } from './config.js';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const GITHUB_API_BASE = `https://api.github.com/repos/${CONFIG.githubUsername}/${CONFIG.githubRepo}/contents`;
let githubToken = localStorage.getItem('laced_github_token') || '';

let currentProductsSha = null;
let productsCache = [];
let inventoryHistoryCache = [];
let currentInventoryHistorySha = null;
let settingsCache = null;
let currentSettingsSha = null;

// IMAGE MANAGER STATE
let workingImages = []; // Array of image URLs (can be blob/base64 during edit)
let croppieInstance = null;
let currentEditingImageIndex = -1; // -1 means new image

// =========================================================
// GITHUB API HELPERS
// =========================================================
async function githubApiRequest(path, method = 'GET', body = null) {
    if (!githubToken) throw new Error("Not authenticated");
    
    const headers = {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const url = `${GITHUB_API_BASE}/${path}${method === 'GET' ? `?t=${Date.now()}` : ''}`;
    
    const res = await fetch(url, options);
    if (!res.ok) {
        if (res.status === 404 && method === 'GET') return null;
        const err = await res.json();
        throw new Error(err.message || "GitHub API Error");
    }
    return await res.json();
}

async function getJsonFile(path) {
    const data = await githubApiRequest(path);
    if (!data) return { content: null, sha: null };
    const decoded = decodeURIComponent(escape(atob(data.content)));
    return { content: JSON.parse(decoded), sha: data.sha };
}

async function saveJsonFile(path, jsonContent, existingSha = null, message = "Update JSON") {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(jsonContent, null, 2))));
    const body = {
        message: message,
        content: encoded,
    };
    if (existingSha) body.sha = existingSha;
    const res = await githubApiRequest(path, 'PUT', body);
    return res.content.sha;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const b64 = reader.result.split(',')[1];
            resolve(b64);
        };
        reader.onerror = error => reject(error);
    });
}

async function uploadImageToGithub(file) {
    const base64Content = await fileToBase64(file);
    const filename = `data/images/${Date.now()}_${file.name}`;
    const body = {
        message: `Upload ${file.name}`,
        content: base64Content
    };
    const res = await githubApiRequest(filename, 'PUT', body);
    return res.content.download_url;
}

// =========================================================
// INIT & AUTH
// =========================================================
async function checkAuthAndLoad() {
    if (githubToken) {
        try {
            // Check contents endpoint instead of repo metadata to avoid fine-grained permission issues
            const res = await fetch(`https://api.github.com/repos/${CONFIG.githubUsername}/${CONFIG.githubRepo}/contents/data/products.json`, {
                headers: { 
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${githubToken}` 
                }
            });
            if (!res.ok) {
                const errJson = await res.json().catch(()=>({}));
                throw new Error(errJson.message || "Invalid token or repository access denied");
            }

            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            loadDashboardData();
        } catch (err) {
            console.error(err);
            githubToken = '';
            localStorage.removeItem('laced_github_token');
            loginScreen.classList.remove('hidden');
            dashboard.classList.add('hidden');
            throw err;
        }
    } else {
        loginScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('githubToken').value.trim();
    const btn = document.getElementById('loginBtn');
    
    try {
        btn.textContent = 'Connecting...';
        githubToken = token;
        localStorage.setItem('laced_github_token', token);
        await checkAuthAndLoad();
    } catch (error) {
        console.error("Login failed:", error);
        loginError.textContent = "Connection failed: " + (error.message || "Unknown error");
    } finally {
        btn.textContent = 'Connect to GitHub';
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuthAndLoad();
    } catch (e) {
        // Silently fail on initial load
    }
});

logoutBtn.addEventListener('click', () => {
    githubToken = '';
    localStorage.removeItem('laced_github_token');
    window.location.reload();
});

// Sidebar Tab Switching
document.querySelectorAll('.nav-btn').forEach(btn => {
    if(btn.id === 'logoutBtn') return;
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + 'Tab').classList.remove('hidden');
    });
});

async function loadDashboardData() {
    await loadProducts();
    await loadSettings();
}

// =========================================================
// PRODUCT MANAGEMENT (VISUAL EDITOR)
// =========================================================
const productsTableBody = document.getElementById('productsTableBody');
const productsListView = document.getElementById('productsListView');
const productVisualEditor = document.getElementById('productVisualEditor');

// Manage Images handled by manageProductImagesBtn logic below

document.getElementById('openAddProductBtn').addEventListener('click', () => {
    document.getElementById('vpId').value = '';
    document.getElementById('vpName').innerText = '';
    document.getElementById('vpPrice').innerText = '';
    document.getElementById('vpComparePrice').innerText = '';
    document.getElementById('vpCategory').value = 'high';
    document.querySelectorAll('#vpSizesContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('vpColors').innerText = '';
    document.getElementById('vpDesc').innerText = '';
    document.getElementById('vpVisible').checked = true;
    document.getElementById('vpOnSale').checked = false;
    
    // Clear working images
    workingImages = [];
    updateVpGalleryPreview();
    
    document.getElementById('vpSaleBadge').style.display = 'none';
    
    productsListView.classList.add('hidden');
    productVisualEditor.classList.remove('hidden');
});

document.getElementById('vpOnSale').addEventListener('change', updateSaleBadgePreview);

function updateSaleBadgePreview() {
    if (document.getElementById('vpOnSale').checked) {
        document.getElementById('vpSaleBadge').style.display = 'block';
    } else {
        document.getElementById('vpSaleBadge').style.display = 'none';
    }
}

document.getElementById('cancelProductBtn').addEventListener('click', () => {
    productsListView.classList.remove('hidden');
    productVisualEditor.classList.add('hidden');
});

async function loadProducts() {
    productsTableBody.innerHTML = '<tr><td colspan="6">Loading products...</td></tr>';
    try {
        const fileData = await getJsonFile('data/products.json');
        productsCache = fileData.content || [];
        currentProductsSha = fileData.sha;

        try {
            const historyData = await getJsonFile('data/inventory_history.json');
            inventoryHistoryCache = historyData.content || [];
            currentInventoryHistorySha = historyData.sha;
        } catch (e) {
            console.log("No inventory history found, starting fresh.");
            inventoryHistoryCache = [];
            currentInventoryHistorySha = null;
        }

        renderProductsTable();
        renderInventory();

    } catch (error) {
        console.error("Error loading products:", error);
        productsTableBody.innerHTML = '<tr><td colspan="6">Error loading products. Check console.</td></tr>';
    }
}

function renderProductsTable() {
    productsTableBody.innerHTML = '';
    
    if (productsCache.length === 0) {
        productsTableBody.innerHTML = '<tr><td colspan="6">No products found.</td></tr>';
        return;
    }

    productsCache.forEach((p) => {
        let totalStock = 0;
        if (typeof p.stock === 'number') {
            totalStock = p.stock;
        } else if (typeof p.stock === 'object' && p.stock !== null) {
            totalStock = Object.values(p.stock).reduce((a, b) => a + b, 0);
        } else {
            totalStock = 10; // Default
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${p.imageUrl || ''}" alt="product"></td>
            <td><strong>${p.name}</strong><br><small>${p.category}</small></td>
            <td>Tk ${p.price}</td>
            <td>${totalStock}</td>
            <td>${p.visible ? '<span style="color:green">Visible</span>' : '<span style="color:red">Hidden</span>'}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${p.id}">Edit</button>
                <button class="action-btn delete-btn" data-id="${p.id}" style="color:red">Delete</button>
            </td>
        `;
        productsTableBody.appendChild(tr);
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => editProduct(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteProduct(e.target.dataset.id));
    });
}

function renderInventory() {
    const inventoryTableBody = document.getElementById('inventoryTableBody');
    if (!inventoryTableBody) return;
    
    inventoryTableBody.innerHTML = '';
    
    if (productsCache.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="6">No products found.</td></tr>';
    } else {
        productsCache.forEach((p) => {
            if (typeof p.stock === 'number' || p.stock === undefined) {
                p.stock = {};
            }

            const sizes = p.sizes && p.sizes.length > 0 ? p.sizes : ['Default'];
            const colors = p.colors && p.colors.length > 0 ? p.colors : ['Default'];
            const variantCount = sizes.length * colors.length;
            let isFirstVariant = true;

            sizes.forEach(size => {
                colors.forEach(color => {
                    const variantKey = `${size}_${color}`;
                    const currentStock = p.stock[variantKey] || 0;

                    const tr = document.createElement('tr');
                    let rowHtml = '';
                    
                    if (isFirstVariant) {
                        rowHtml += `
                            <td rowspan="${variantCount}" style="vertical-align: middle; border-bottom: 2px solid #ddd;"><img src="${p.imageUrl || ''}" alt="product" style="width: 50px; height: 50px; object-fit: contain;"></td>
                            <td rowspan="${variantCount}" style="vertical-align: middle; border-bottom: 2px solid #ddd;"><strong>${p.name}</strong><br><small style="color:#666;">${p.id}</small></td>
                        `;
                        isFirstVariant = false;
                    }

                    const borderBottom = (sizes.indexOf(size) === sizes.length - 1 && colors.indexOf(color) === colors.length - 1) ? 'border-bottom: 2px solid #ddd;' : 'border-bottom: 1px solid #eee;';

                    rowHtml += `
                        <td style="${borderBottom}">${size}</td>
                        <td style="${borderBottom}">
                            ${color.startsWith('#') ? `<div style="width: 20px; height: 20px; background-color: ${color}; border: 1px solid #ccc; border-radius: 50%;" title="${color}"></div>` : color}
                        </td>
                        <td style="${borderBottom}">
                            <input type="number" id="stock-input-${p.id}-${variantKey}" value="${currentStock}" style="width: 80px; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
                        </td>
                        <td style="${borderBottom}">
                            <button class="btn-primary save-variant-btn" data-id="${p.id}" data-variant="${variantKey}" style="padding: 4px 10px; font-size: 0.8rem;">Save</button>
                        </td>
                    `;
                    tr.innerHTML = rowHtml;
                    inventoryTableBody.appendChild(tr);
                });
            });
        });

        document.querySelectorAll('.save-variant-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleSaveVariant(e.target));
        });
    }

    renderInventoryHistory();
}

function renderInventoryHistory() {
    const historyBody = document.getElementById('inventoryHistoryBody');
    if (!historyBody) return;
    historyBody.innerHTML = '';

    if (!inventoryHistoryCache || inventoryHistoryCache.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="5">No history found.</td></tr>';
        return;
    }

    const sortedHistory = [...inventoryHistoryCache].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedHistory.forEach(log => {
        const tr = document.createElement('tr');
        const isIncrease = log.change > 0;
        const color = isIncrease ? 'green' : (log.change < 0 ? 'red' : 'gray');
        const changeStr = (log.change > 0 ? '+' : '') + log.change;

        tr.innerHTML = `
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td><strong>${log.productName}</strong></td>
            <td>${log.variant.replace('_', ' / ')}</td>
            <td style="color: ${color}; font-weight: bold;">${changeStr}</td>
            <td>${log.newTotal}</td>
        `;
        historyBody.appendChild(tr);
    });
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        if (!modal) { resolve(confirm(message)); return; } // Fallback
        const titleEl = document.getElementById('customModalTitle');
        const msgEl = document.getElementById('customModalMessage');
        const cancelBtn = document.getElementById('customModalCancel');
        const confirmBtn = document.getElementById('customModalConfirm');

        titleEl.textContent = title;
        msgEl.textContent = message;
        cancelBtn.style.display = 'inline-block';
        modal.classList.remove('hidden');

        const cleanup = () => {
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.classList.add('hidden');
        };

        const onCancel = () => { cleanup(); resolve(false); };
        const onConfirm = () => { cleanup(); resolve(true); };

        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
    });
}

function showCustomAlert(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        if (!modal) { alert(message); resolve(); return; } // Fallback
        const titleEl = document.getElementById('customModalTitle');
        const msgEl = document.getElementById('customModalMessage');
        const cancelBtn = document.getElementById('customModalCancel');
        const confirmBtn = document.getElementById('customModalConfirm');

        titleEl.textContent = title;
        msgEl.textContent = message;
        cancelBtn.style.display = 'none'; // Hide cancel for alert
        modal.classList.remove('hidden');

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            modal.classList.add('hidden');
        };

        const onConfirm = () => { cleanup(); resolve(); };

        confirmBtn.addEventListener('click', onConfirm);
    });
}

async function handleSaveVariant(btn) {
    const pId = btn.getAttribute('data-id');
    const variantKey = btn.getAttribute('data-variant');
    const inputField = document.getElementById(`stock-input-${pId}-${variantKey}`);
    const newVal = parseInt(inputField.value);

    if (isNaN(newVal)) {
        await showCustomAlert("Invalid Input", "Please enter a valid number for stock.");
        return;
    }

    const p = productsCache.find(prod => prod.id === pId);
    if (!p) return;

    if (typeof p.stock !== 'object' || p.stock === null) p.stock = {};
    const oldVal = p.stock[variantKey] || 0;

    const diff = newVal - oldVal;
    if (diff === 0) {
        await showCustomAlert("No Changes", "No change made to stock.");
        return;
    }

    const action = diff > 0 ? 'INCREASE' : 'DECREASE';
    const msg = `Are you sure you want to ${action} the stock for ${p.name} (Variant: ${variantKey.replace('_', ' / ')}) by ${Math.abs(diff)}?\n\nNew total will be: ${newVal}`;
    
    const isConfirmed = await showCustomConfirm("Confirm Stock Change", msg);
    if (!isConfirmed) {
        inputField.value = oldVal;
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';

    p.stock[variantKey] = newVal;

    try {
        currentProductsSha = await saveJsonFile('data/products.json', productsCache, currentProductsSha, `Update stock for ${p.name}`);
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            productId: p.id,
            productName: p.name,
            variant: variantKey,
            change: diff,
            newTotal: newVal
        };
        inventoryHistoryCache.push(logEntry);
        
        currentInventoryHistorySha = await saveJsonFile('data/inventory_history.json', inventoryHistoryCache, currentInventoryHistorySha, `Log inventory history for ${p.name}`);
        
        renderInventory();
        renderProductsTable(); // Update products tab total stock view
        await showCustomAlert("Success", 'Stock updated successfully!');
    } catch (err) {
        console.error(err);
        await showCustomAlert("Error", 'Failed to save stock. Please check console for details.');
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

document.getElementById('saveProductBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveProductBtn');
    btn.textContent = 'Publishing...';
    btn.disabled = true;

    try {
        const id = document.getElementById('vpId').value;
        
        const comparePriceText = document.getElementById('vpComparePrice').innerText.trim().replace(/[^0-9.]/g, '');
        const comparePrice = comparePriceText ? Number(comparePriceText) : null;
        
        const sizes = Array.from(document.querySelectorAll('#vpSizesContainer input[type="checkbox"]:checked')).map(cb => cb.value);

        // Upload all new base64 images to GitHub
        const finalImageUrls = [];
        for (const img of workingImages) {
            if (img.startsWith('data:image')) {
                const blob = await (await fetch(img)).blob();
                const uploadedUrl = await uploadImageToGithub(blob);
                finalImageUrls.push(uploadedUrl);
            } else {
                finalImageUrls.push(img);
            }
        }

        const productData = {
            id: id || 'prod_' + Date.now().toString(36),
            name: document.getElementById('vpName').innerText.trim() || 'Untitled Product',
            price: Number(document.getElementById('vpPrice').innerText.trim().replace(/[^0-9.]/g, '')) || 0,
            compareAtPrice: comparePrice,
            category: document.getElementById('vpCategory').value,
            sizes: sizes,
            colors: document.getElementById('vpColors').innerText.split(',').map(c => c.trim()).filter(c => c),
            description: document.getElementById('vpDesc').innerText.trim(),
            visible: document.getElementById('vpVisible').checked,
            onSale: document.getElementById('vpOnSale').checked,
            imageUrl: finalImageUrls[0] || '', // Primary image is the first one
            imageUrls: finalImageUrls
        };

        if (!productData.imageUrl && finalImageUrls.length === 0) {
            throw new Error("At least one image is required. Please click Manage Images.");
        }

        if (id) {
            const index = productsCache.findIndex(p => p.id === id);
            if (index !== -1) {
                productsCache[index] = productData;
            }
        } else {
            productsCache.push(productData);
        }

        currentProductsSha = await saveJsonFile('data/products.json', productsCache, currentProductsSha, `Update product ${productData.name}`);

        await showCustomAlert("Success", "Product published successfully!");
        productsListView.classList.remove('hidden');
        productVisualEditor.classList.add('hidden');
        loadProducts();
    } catch (error) {
        console.error("Error saving product:", error);
        alert(error.message);
    } finally {
        btn.textContent = 'Publish Product';
        btn.disabled = false;
    }
});

function editProduct(id) {
    const p = productsCache.find(prod => prod.id === id);
    if (p) {
        document.getElementById('vpId').value = p.id;
        document.getElementById('vpName').innerText = p.name;
        document.getElementById('vpPrice').innerText = p.price;
        document.getElementById('vpComparePrice').innerText = p.compareAtPrice || '';
        document.getElementById('vpCategory').value = p.category;
        
        document.querySelectorAll('#vpSizesContainer input[type="checkbox"]').forEach(cb => {
            cb.checked = p.sizes && p.sizes.includes(cb.value);
        });

        document.getElementById('vpColors').innerText = p.colors.join(', ');
        document.getElementById('vpDesc').innerText = p.description;
        document.getElementById('vpVisible').checked = p.visible;
        document.getElementById('vpOnSale').checked = p.onSale || false;
        
        // Populate working images
        workingImages = p.imageUrls ? [...p.imageUrls] : (p.imageUrl ? [p.imageUrl] : []);
        updateVpGalleryPreview();
        
        productsListView.classList.add('hidden');
        productVisualEditor.classList.remove('hidden');
    }
}

// Visual Editor Preview Helpers
function updateVpGalleryPreview() {
    const mainImg = document.getElementById('vpImagePreview');
    const thumbContainer = document.getElementById('vpThumbsPreview');
    
    if (workingImages.length > 0) {
        mainImg.src = workingImages[0];
    } else {
        mainImg.src = '';
    }
    
    if (thumbContainer) {
        thumbContainer.innerHTML = '';
        if (workingImages.length > 1) {
            workingImages.forEach((url, i) => {
                const thumb = document.createElement('div');
                thumb.className = 'thumb' + (i === 0 ? ' active' : '');
                thumb.innerHTML = `<img src="${url}">`;
                thumb.addEventListener('click', () => {
                    mainImg.src = url;
                    thumbContainer.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
                thumbContainer.appendChild(thumb);
            });
        }
    }
}

// =========================================================
// IMAGE MANAGEMENT LOGIC
// =========================================================

// Initialize Croppie
function initCroppie() {
    const el = document.getElementById('cropperContainer');
    if (croppieInstance) croppieInstance.destroy();
    croppieInstance = new Croppie(el, {
        viewport: { width: 300, height: 300, type: 'square' },
        boundary: { width: 350, height: 350 },
        showZoomer: true,
        enableOrientation: true
    });
}

// Handle Manage Images Click
document.getElementById('manageProductImagesBtn').addEventListener('click', () => {
    renderImageManagerGrid();
    document.getElementById('imageManagerModal').classList.remove('hidden');
});

document.getElementById('closeImageManager').addEventListener('click', () => {
    document.getElementById('imageManagerModal').classList.add('hidden');
});

document.getElementById('saveImagesBtn').addEventListener('click', () => {
    document.getElementById('imageManagerModal').classList.add('hidden');
    updateVpGalleryPreview();
});

// Add New Image
document.getElementById('addNewImageBtn').addEventListener('click', () => {
    document.getElementById('newImageInput').click();
});

document.getElementById('newImageInput').addEventListener('change', function(e) {
    if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('cropperModal').classList.remove('hidden');
            initCroppie();
            // Wait for modal to render to avoid zero-size container bugs
            setTimeout(() => {
                croppieInstance.bind({
                    url: event.target.result
                }).then(() => {
                    console.log('Croppie bind complete');
                });
            }, 100);
        };
        reader.readAsDataURL(this.files[0]);
    }
});

document.getElementById('cancelCrop').addEventListener('click', () => {
    document.getElementById('cropperModal').classList.add('hidden');
    document.getElementById('newImageInput').value = '';
});

document.getElementById('applyCrop').addEventListener('click', () => {
    croppieInstance.result({
        type: 'base64',
        size: 'viewport',
        format: 'png',
        quality: 1
    }).then(function(base64) {
        workingImages.push(base64);
        document.getElementById('cropperModal').classList.add('hidden');
        document.getElementById('newImageInput').value = '';
        renderImageManagerGrid();
    });
});

function renderImageManagerGrid() {
    const grid = document.getElementById('imageManagerGrid');
    grid.innerHTML = '';
    
    workingImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'image-manager-item';
        item.style = 'position:relative; background:#f9f9f9; padding:10px; border-radius:8px; border:1px solid #eee; text-align:center;';
        
        item.innerHTML = `
            <img src="${img}" style="width:100%; aspect-ratio:1; object-fit:contain; background:#fff; border-radius:4px; margin-bottom:8px;">
            <div style="display:flex; justify-content:center; gap:5px;">
                <button class="mgr-btn move-left" data-index="${index}" style="padding:4px 8px; font-size:0.7rem;" ${index === 0 ? 'disabled' : ''}>←</button>
                <button class="mgr-btn delete-img" data-index="${index}" style="padding:4px 8px; font-size:0.7rem; background:#ff4444; color:#fff;">Delete</button>
                <button class="mgr-btn move-right" data-index="${index}" style="padding:4px 8px; font-size:0.7rem;" ${index === workingImages.length - 1 ? 'disabled' : ''}>→</button>
            </div>
            ${index === 0 ? '<span style="position:absolute; top:5px; left:5px; background:#000; color:#fff; font-size:0.6rem; padding:2px 5px; border-radius:3px;">Main</span>' : ''}
        `;
        
        grid.appendChild(item);
    });
    
    // Attach event listeners to the buttons
    grid.querySelectorAll('.move-left').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            [workingImages[idx - 1], workingImages[idx]] = [workingImages[idx], workingImages[idx - 1]];
            renderImageManagerGrid();
        });
    });
    
    grid.querySelectorAll('.move-right').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            [workingImages[idx], workingImages[idx + 1]] = [workingImages[idx + 1], workingImages[idx]];
            renderImageManagerGrid();
        });
    });
    
    grid.querySelectorAll('.delete-img').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            workingImages.splice(idx, 1);
            renderImageManagerGrid();
        });
    });
}

async function deleteProduct(id) {
    const p = productsCache.find(prod => prod.id === id);
    const pName = p ? p.name : id;
    
    const isConfirmed = await showCustomConfirm(
        "Delete Product", 
        `Are you sure you want to permanently delete "${pName}"? This action cannot be undone.`
    );
    
    if (isConfirmed) {
        try {
            productsCache = productsCache.filter(p => p.id !== id);
            currentProductsSha = await saveJsonFile('data/products.json', productsCache, currentProductsSha, `Delete product ${pName}`);
            await showCustomAlert("Deleted", "Product has been removed from the catalog.");
            loadProducts();
        } catch (error) {
            console.error("Error deleting product:", error);
            await showCustomAlert("Error", "Failed to delete product. Please try again.");
        }
    }
}

// =========================================================
// HOMEPAGE VISUAL EDITOR
// =========================================================
const heroHeadlineVisual = document.getElementById('heroHeadlineVisual');
const heroSubtextVisual = document.getElementById('heroSubtextVisual');
const promoEnabledVisual = document.getElementById('promoEnabledVisual');
const promoTextVisual = document.getElementById('promoTextVisual');
const promoBarVisualContainer = document.getElementById('promoBarVisualContainer');
const heroVisualSection = document.getElementById('heroVisualSection');
const changeHeroImageBtn = document.getElementById('changeHeroImageBtn');
const heroImageInput = document.getElementById('heroImageInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const settingsStatus = document.getElementById('settingsStatus');

const changeLookbookImageBtn = document.getElementById('changeLookbookImageBtn');
const lookbookImageInput = document.getElementById('lookbookImageInput');
const lookbookPreview = document.getElementById('lookbookPreview');

promoEnabledVisual.addEventListener('change', (e) => {
    promoBarVisualContainer.style.display = e.target.checked ? 'block' : 'none';
});

changeHeroImageBtn.addEventListener('click', () => {
    heroImageInput.click();
});

heroImageInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        heroVisualSection.style.backgroundImage = `url('${URL.createObjectURL(files[0])}')`;
        if (files.length > 1) {
            settingsStatus.textContent = `${files.length} images selected for slideshow!`;
            settingsStatus.style.color = "blue";
        }
    }
});

changeLookbookImageBtn.addEventListener('click', () => {
    lookbookImageInput.click();
});

lookbookImageInput.addEventListener('change', (e) => {
    const files = e.target.files;
    lookbookPreview.innerHTML = '';
    for (let i = 0; i < files.length; i++) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(files[i]);
        img.style.height = '100px';
        img.style.borderRadius = '4px';
        lookbookPreview.appendChild(img);
    }
});

async function loadSettings() {
    try {
        const fileData = await getJsonFile('data/settings.json');
        currentSettingsSha = fileData.sha;
        currentSettingsState = fileData.content || {};

        if (currentSettingsState.heroHeadline) heroHeadlineVisual.innerText = currentSettingsState.heroHeadline;
        if (currentSettingsState.heroSubtext) heroSubtextVisual.innerText = currentSettingsState.heroSubtext;
        
        const isPromoEnabled = currentSettingsState.promoEnabled || false;
        promoEnabledVisual.checked = isPromoEnabled;
        promoBarVisualContainer.style.display = isPromoEnabled ? 'block' : 'none';
        
        if (currentSettingsState.promoText) promoTextVisual.innerText = currentSettingsState.promoText;
        if (currentSettingsState.heroImages && currentSettingsState.heroImages.length > 0) {
            heroVisualSection.style.backgroundImage = `url('${currentSettingsState.heroImages[0]}')`;
        } else if (currentSettingsState.heroImageUrl) {
            heroVisualSection.style.backgroundImage = `url('${currentSettingsState.heroImageUrl}')`;
        }

        if (currentSettingsState.lookbookImages && currentSettingsState.lookbookImages.length > 0) {
            lookbookPreview.innerHTML = '';
            currentSettingsState.lookbookImages.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.style.height = '100px';
                img.style.borderRadius = '4px';
                lookbookPreview.appendChild(img);
            });
        }

        // Reveal editor content now that real values are filled in
        const visualHeroContent = document.getElementById('visualHeroContent');
        if (visualHeroContent) visualHeroContent.style.opacity = '1';

    } catch (error) {
        console.error("Error loading settings:", error);
        // Still reveal so the editor isn't broken if fetch fails
        const visualHeroContent = document.getElementById('visualHeroContent');
        if (visualHeroContent) visualHeroContent.style.opacity = '1';
    }
}

saveSettingsBtn.addEventListener('click', async () => {
    saveSettingsBtn.textContent = 'Saving...';
    saveSettingsBtn.disabled = true;
    
    try {
        const files = heroImageInput.files;
        let heroImages = currentSettingsState.heroImages || [];
        
        if (heroImages.length === 0 && currentSettingsState.heroImageUrl) {
            heroImages = [currentSettingsState.heroImageUrl];
        }

        if (files.length > 0) {
            heroImages = [];
            for (let i = 0; i < files.length; i++) {
                heroImages.push(await uploadImageToGithub(files[i]));
            }
        }

        const lbFiles = lookbookImageInput.files;
        let lookbookImages = currentSettingsState.lookbookImages || [];

        if (lbFiles.length > 0) {
            lookbookImages = [];
            for (let i = 0; i < lbFiles.length; i++) {
                lookbookImages.push(await uploadImageToGithub(lbFiles[i]));
            }
        }

        const newSettings = {
            heroHeadline: heroHeadlineVisual.innerText.trim(),
            heroSubtext: heroSubtextVisual.innerText.trim(),
            promoEnabled: promoEnabledVisual.checked,
            promoText: promoTextVisual.innerText.trim(),
            heroImages: heroImages,
            lookbookImages: lookbookImages,
            _savedAt: Date.now()  // timestamp so live site can detect stale CDN data
        };

        currentSettingsState = newSettings;
        // Also update localStorage cache immediately so live site sees it on next visit
        localStorage.setItem('laced_settings_cache', JSON.stringify(newSettings));
        currentSettingsSha = await saveJsonFile('data/settings.json', newSettings, currentSettingsSha, "Update homepage settings via visual editor");
        
        settingsStatus.textContent = "Changes saved live!";
        settingsStatus.style.color = "green";
        setTimeout(() => settingsStatus.textContent = '', 3000);
    } catch (error) {
        console.error("Error saving settings:", error);
        settingsStatus.textContent = "Error saving changes.";
        settingsStatus.style.color = 'red';
    } finally {
        saveSettingsBtn.textContent = 'Save Changes';
        saveSettingsBtn.disabled = false;
    }
});

// Init
checkAuthAndLoad();
