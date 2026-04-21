import { getRawDataUrl } from './config.js';

// Reusable render functions so we can call them on load AND on live preview
function renderSettings(s) {
    if (s.heroHeadline) document.querySelector('.hero h1').textContent = s.heroHeadline;
    if (s.heroSubtext) document.querySelector('.hero p').textContent = s.heroSubtext;
    if (s.heroImageUrl) document.querySelector('.hero').style.backgroundImage = `url('${s.heroImageUrl}')`;
    
    const promoBar = document.querySelector('.promo-bar');
    if (s.promoEnabled) {
        promoBar.style.display = 'block';
        if (s.promoText) {
            document.querySelectorAll('.marquee-content span').forEach(span => {
                span.textContent = s.promoText;
            });
        }
    } else {
        promoBar.style.display = 'none';
    }
}

function renderProducts(products) {
    const grid = document.querySelector('.grid');
    grid.innerHTML = ''; 
    
    let found = false;
    products.forEach((p) => {
        if (p.visible) {
            found = true;
            const a = document.createElement('a');
            a.href = `product.html?id=${p.id}`;
            a.className = 'grid-item';
            a.style.background = '#f8f9fa';
            a.innerHTML = `
                <div class="img-wrapper">
                    <img src="${p.imageUrl}" alt="${p.name}">
                </div>
                <h3>${p.name}</h3>
                <p>Tk ${p.price}</p>
            `;
            grid.appendChild(a);
        }
    });
    
    if (!found) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No products available right now. Check back soon!</p>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch Homepage Settings
    try {
        const response = await fetch(getRawDataUrl('settings.json'));
        if (response.ok) {
            const s = await response.json();
            renderSettings(s);
        }
    } catch (err) {
        console.error("Error loading settings", err);
    }

    // 2. Fetch Products
    try {
        const response = await fetch(getRawDataUrl('products.json'));
        if (response.ok) {
            const products = await response.json();
            renderProducts(products);
        }
    } catch (err) {
        console.error("Error loading products", err);
        document.querySelector('.grid').innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error loading products from server.</p>';
    }
});

// 3. Listen for Live Preview updates from Admin Panel
window.addEventListener('message', (event) => {
    // We don't check origin here because we want to allow cross-origin preview if testing locally
    if (event.data.type === 'PREVIEW_SETTINGS') {
        renderSettings(event.data.payload);
    } else if (event.data.type === 'PREVIEW_PRODUCTS') {
        renderProducts(event.data.payload);
    }
});
