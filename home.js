import { getRawDataUrl } from './config.js';

// Reusable render functions so we can call them on load AND on live preview
function renderSettings(s) {
    if (s.heroHeadline) document.querySelector('.hero h1').textContent = s.heroHeadline;
    if (s.heroSubtext) document.querySelector('.hero p').textContent = s.heroSubtext;
    
    const hero = document.querySelector('.hero');
    if (s.heroImages && s.heroImages.length > 0) {
        hero.style.backgroundImage = `url('${s.heroImages[0]}')`;
        hero.style.transition = 'background-image 1s ease-in-out';
        
        if (s.heroImages.length > 1) {
            let currentIdx = 0;
            setInterval(() => {
                currentIdx = (currentIdx + 1) % s.heroImages.length;
                hero.style.backgroundImage = `url('${s.heroImages[currentIdx]}')`;
            }, 5000);
        }
    } else if (s.heroImageUrl) {
        hero.style.backgroundImage = `url('${s.heroImageUrl}')`;
    }
    
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
                    ${p.compareAtPrice && p.compareAtPrice > p.price ? '<span class="sale-badge">SALE</span>' : ''}
                    <img src="${p.imageUrl}" alt="${p.name}">
                </div>
                <h3>${p.name}</h3>
                <p>
                    ${p.compareAtPrice && p.compareAtPrice > p.price ? `<span class="compare-price">Tk ${p.compareAtPrice.toLocaleString()}</span>` : ''}
                    Tk ${p.price.toLocaleString()}
                </p>
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
        console.error("Error fetching products", err);
    }
});

