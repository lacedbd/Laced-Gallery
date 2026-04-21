import { CONFIG } from './config.js';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const GITHUB_API_BASE = `https://api.github.com/repos/${CONFIG.githubUsername}/${CONFIG.githubRepo}/contents`;
let githubToken = localStorage.getItem('laced_github_token') || '';

let currentSettingsSha = null;
let currentSettingsState = {};
let currentProductsSha = null;
let productsCache = [];

// =========================================================
// GITHUB API HELPERS
// =========================================================
async function githubApiRequest(path, method = 'GET', body = null) {
    if (!githubToken) throw new Error("Not authenticated");
    
    const headers = {
        'Authorization': `token ${githubToken}`,
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
            const res = await fetch(`https://api.github.com/repos/${CONFIG.githubUsername}/${CONFIG.githubRepo}`, {
                headers: { 'Authorization': `token ${githubToken}` }
            });
            if (!res.ok) throw new Error("Invalid token or repo");

            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            loadDashboardData();
        } catch (err) {
            console.error(err);
            githubToken = '';
            localStorage.removeItem('laced_github_token');
            loginScreen.classList.remove('hidden');
            dashboard.classList.add('hidden');
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
        loginError.textContent = "Connection failed. Check token and config.js.";
    } finally {
        btn.textContent = 'Connect to GitHub';
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

function loadDashboardData() {
    loadProducts();
    loadSettings();
}

// =========================================================
// PRODUCT MANAGEMENT (VISUAL EDITOR)
// =========================================================
const productsTableBody = document.getElementById('productsTableBody');
const productsListView = document.getElementById('productsListView');
const productVisualEditor = document.getElementById('productVisualEditor');

const vpImageInput = document.getElementById('vpImageInput');
const vpImagePreview = document.getElementById('vpImagePreview');

document.getElementById('changeProductImageBtn').addEventListener('click', () => {
    vpImageInput.click();
});

vpImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        vpImagePreview.src = URL.createObjectURL(file);
    }
});

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
    document.getElementById('vpImagePreview').src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Transparent placeholder
    document.getElementById('vpImageInput').value = '';
    document.getElementById('vpSaleBadge').style.display = 'none';
    
    productsListView.classList.add('hidden');
    productVisualEditor.classList.remove('hidden');
});

document.getElementById('vpComparePrice').addEventListener('input', updateSaleBadgePreview);
document.getElementById('vpPrice').addEventListener('input', updateSaleBadgePreview);

function updateSaleBadgePreview() {
    const p = Number(document.getElementById('vpPrice').innerText.trim().replace(/[^0-9.]/g, '')) || 0;
    const cpText = document.getElementById('vpComparePrice').innerText.trim().replace(/[^0-9.]/g, '');
    const cp = cpText ? Number(cpText) : 0;
    
    if (cp > p && p > 0) {
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

        productsTableBody.innerHTML = '';
        
        if (productsCache.length === 0) {
            productsTableBody.innerHTML = '<tr><td colspan="6">No products found.</td></tr>';
            return;
        }

        productsCache.forEach((p) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${p.imageUrl || ''}" alt="product"></td>
                <td><strong>${p.name}</strong><br><small>${p.category}</small></td>
                <td>Tk ${p.price}</td>
                <td>${p.stock !== undefined ? p.stock : 10}</td>
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

        renderInventory();

    } catch (error) {
        console.error("Error loading products:", error);
        productsTableBody.innerHTML = '<tr><td colspan="6">Error loading products. Check console.</td></tr>';
    }
    }
}

function renderInventory() {
    const inventoryTableBody = document.getElementById('inventoryTableBody');
    if (!inventoryTableBody) return;
    
    inventoryTableBody.innerHTML = '';
    
    if (productsCache.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="4">No products found.</td></tr>';
        return;
    }

    productsCache.forEach((p) => {
        if (p.stock === undefined) p.stock = 10;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${p.imageUrl || ''}" alt="product" style="width: 40px; height: 40px; object-fit: contain;"></td>
            <td><strong>${p.name}</strong></td>
            <td>${p.visible ? '<span style="color:green">Visible</span>' : '<span style="color:red">Hidden</span>'}</td>
            <td>
                <input type="number" class="inventory-input" data-id="${p.id}" value="${p.stock}" style="width: 80px; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
            </td>
        `;
        inventoryTableBody.appendChild(tr);
    });
}

const saveInventoryBtn = document.getElementById('saveInventoryBtn');
if (saveInventoryBtn) {
    saveInventoryBtn.addEventListener('click', async () => {
        saveInventoryBtn.textContent = 'Saving...';
        saveInventoryBtn.disabled = true;

        const inputs = document.querySelectorAll('.inventory-input');
        inputs.forEach(input => {
            const id = input.getAttribute('data-id');
            const stockVal = parseInt(input.value) || 0;
            const p = productsCache.find(prod => prod.id === id);
            if (p) p.stock = stockVal;
        });

        try {
            currentProductsSha = await saveJsonFile('data/products.json', productsCache, currentProductsSha, 'Update inventory levels');
            alert('Inventory saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save inventory.');
        }

        saveInventoryBtn.textContent = 'Save Inventory';
        saveInventoryBtn.disabled = false;
    });
}

document.getElementById('saveProductBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveProductBtn');
    btn.textContent = 'Publishing...';
    btn.disabled = true;

    try {
        const id = document.getElementById('vpId').value;
        const file = document.getElementById('vpImageInput').files[0];
        
        let imageUrl = '';
        if (file) {
            imageUrl = await uploadImageToGithub(file);
        }

        const comparePriceText = document.getElementById('vpComparePrice').innerText.trim().replace(/[^0-9.]/g, '');
        const comparePrice = comparePriceText ? Number(comparePriceText) : null;
        
        const sizes = Array.from(document.querySelectorAll('#vpSizesContainer input[type="checkbox"]:checked')).map(cb => cb.value);

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
        };

        if (id) {
            const index = productsCache.findIndex(p => p.id === id);
            if(index !== -1) {
                if (imageUrl) productData.imageUrl = imageUrl; 
                else productData.imageUrl = productsCache[index].imageUrl; 
                productsCache[index] = productData;
            }
        } else {
            if (!imageUrl) throw new Error("Image is required for new products. Please click Change Image.");
            productData.imageUrl = imageUrl;
            productsCache.push(productData);
        }

        currentProductsSha = await saveJsonFile('data/products.json', productsCache, currentProductsSha, `Update product ${productData.name}`);

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
        document.getElementById('vpImagePreview').src = p.imageUrl || '';
        document.getElementById('vpImageInput').value = '';
        
        updateSaleBadgePreview();
        
        productsListView.classList.add('hidden');
        productVisualEditor.classList.remove('hidden');
    }
}

async function deleteProduct(id) {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            const pName = productsCache.find(p => p.id === id)?.name || id;
            productsCache = productsCache.filter(p => p.id !== id);
            currentProductsSha = await saveJsonFile('data/products.json', productsCache, currentProductsSha, `Delete product ${pName}`);
            loadProducts();
        } catch (error) {
            console.error("Error deleting product:", error);
            alert("Error deleting product.");
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

    } catch (error) {
        console.error("Error loading settings:", error);
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
            lookbookImages: lookbookImages
        };

        currentSettingsState = newSettings;
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
