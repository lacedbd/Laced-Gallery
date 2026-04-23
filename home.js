import { getRawDataUrl } from './config.js';

const SETTINGS_CACHE_KEY = 'laced_settings_cache';

// ── Apply settings to the page ───────────────────────────────────────────────
function renderSettings(s) {
    const h1 = document.querySelector('.hero h1');
    const p  = document.querySelector('.hero p');
    if (h1 && s.heroHeadline) h1.textContent = s.heroHeadline;
    if (p  && s.heroSubtext)  p.textContent  = s.heroSubtext;

    const hero = document.querySelector('.hero');
    if (hero) {
        if (s.heroImages && s.heroImages.length > 0) {
            hero.style.backgroundImage = `url('${s.heroImages[0]}')`;
            if (s.heroImages.length > 1) {
                let idx = 0;
                setInterval(() => {
                    idx = (idx + 1) % s.heroImages.length;
                    hero.style.backgroundImage = `url('${s.heroImages[idx]}')`;
                }, 5000);
            }
        } else if (s.heroImageUrl) {
            hero.style.backgroundImage = `url('${s.heroImageUrl}')`;
        }
    }

    const promoBar = document.querySelector('.promo-bar');
    if (promoBar) {
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

    const lookbookSection  = document.getElementById('lookbookSection');
    const lookbookCarousel = document.getElementById('lookbookCarousel');
    if (lookbookSection && lookbookCarousel) {
        if (s.lookbookImages && s.lookbookImages.length > 0) {
            lookbookSection.style.display = 'block';
            lookbookCarousel.innerHTML = '';
            s.lookbookImages.forEach(url => {
                const slide = document.createElement('div');
                slide.className = 'lookbook-slide';
                slide.style.backgroundImage = `url('${url}')`;
                lookbookCarousel.appendChild(slide);
            });
        } else {
            lookbookSection.style.display = 'none';
        }
    }
}

// ── Render product grid ───────────────────────────────────────────────────────
function renderProducts(products) {
    const grid = document.querySelector('.grid');
    grid.innerHTML = '';
    let found = false;
    products.forEach((p) => {
        if (p.visible) {
            found = true;
            let soldOut = false;
            if (typeof p.stock === 'number') {
                soldOut = p.stock <= 0;
            } else if (typeof p.stock === 'object' && p.stock !== null) {
                soldOut = Object.values(p.stock).reduce((a, b) => a + b, 0) <= 0;
            }
            const a = document.createElement('a');
            a.href = `product.html?id=${p.id}`;
            a.className = 'grid-item';
            a.style.background = '#f8f9fa';
            a.innerHTML = `
                <div class="img-wrapper">
                    ${soldOut ? '<span class="sale-badge" style="background:#000;">SOLD OUT</span>' : (p.onSale ? '<span class="sale-badge">SALE</span>' : '')}
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

// ── Main ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Apply cached settings immediately so layout looks right (BG, promo bar)
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (cached) {
        try { renderSettings(JSON.parse(cached)); } catch(e) {}
    }

    // 2. Hide the hero TEXT to prevent any flash of stale/wrong headline
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) heroContent.style.opacity = '0';

    // 3. Fetch FRESH settings, update everything, then reveal
    try {
        const res = await fetch(getRawDataUrl('settings.json'));
        if (res.ok) {
            const s = await res.json();
            localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s));
            renderSettings(s);
        }
    } catch (err) {
        console.error('Error loading settings', err);
    }

    // 4. Smooth fade-in once correct content is in place
    if (heroContent) {
        heroContent.style.transition = 'opacity 0.3s ease';
        heroContent.style.opacity = '1';
    }

    // 5. Fetch products
    try {
        const res = await fetch(getRawDataUrl('products.json'));
        if (res.ok) {
            const products = await res.json();
            renderProducts(products);
        }
    } catch (err) {
        console.error('Error fetching products', err);
    }

    // 6. View-mode toggle buttons
    const singleViewBtn = document.getElementById('singleViewBtn');
    const gridViewBtn   = document.getElementById('gridViewBtn');
    if (singleViewBtn && gridViewBtn) {
        singleViewBtn.addEventListener('click', () => {
            const grid = document.querySelector('.grid');
            if (grid) {
                grid.classList.remove('grid-view-active');
                singleViewBtn.style.opacity = '1';
                gridViewBtn.style.opacity = '0.3';
            }
        });
        gridViewBtn.addEventListener('click', () => {
            const grid = document.querySelector('.grid');
            if (grid) {
                grid.classList.add('grid-view-active');
                gridViewBtn.style.opacity = '1';
                singleViewBtn.style.opacity = '0.3';
            }
        });
    }
});
