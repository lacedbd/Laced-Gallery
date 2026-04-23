import { getRawDataUrl } from './config.js';

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
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No products available for this category right now. Check back soon!</p>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let category = urlParams.get('category') || 'high';
    let searchQuery = urlParams.get('q');

    const filterHighBtn = document.getElementById('filterHighTops');
    const filterLowBtn = document.getElementById('filterLowTops');

    let allProducts = [];

    // Apply cached promo settings INSTANTLY to avoid flash
    const SETTINGS_CACHE_KEY = 'laced_settings_cache';
    function applyPromo(s) {
        const promoBar = document.querySelector('.promo-bar');
        if (!promoBar) return;
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
    const cachedSettings = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (cachedSettings) {
        try { applyPromo(JSON.parse(cachedSettings)); } catch(e) {}
    }
    // Fetch settings and products in PARALLEL — settings load never blocks products
    const [settingsResult, productsResult] = await Promise.allSettled([
        fetch(getRawDataUrl('settings.json')),
        fetch(getRawDataUrl('products.json'))
    ]);

    // Apply settings
    if (settingsResult.status === 'fulfilled' && settingsResult.value.ok) {
        try {
            const s = await settingsResult.value.json();
            localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s));
            applyPromo(s);
        } catch(e) { console.error('Settings parse error', e); }
    }

    // Render products
    if (productsResult.status === 'fulfilled' && productsResult.value.ok) {
        try {
            allProducts = await productsResult.value.json();
            updateView();
        } catch(e) {
            console.error('Products parse error', e);
            document.querySelector('.grid').innerHTML = '<p style="grid-column:1/-1;text-align:center;">Error loading products. Please refresh.</p>';
        }
    } else {
        console.error('Products fetch failed', productsResult.reason);
        document.querySelector('.grid').innerHTML = '<p style="grid-column:1/-1;text-align:center;">Could not load products. Please check your connection and refresh.</p>';
    }

    function updateView() {
        let newUrl = window.location.pathname;
        if (searchQuery) {
            newUrl += '?q=' + encodeURIComponent(searchQuery);
        } else {
            newUrl += '?category=' + category;
        }
        window.history.replaceState(null, '', newUrl);

        let filtered = [];
        const categoryToggle = document.querySelector('.category-toggle');
        const sectionH2 = document.querySelector('.section-header h2');
        const sectionP  = document.querySelector('.section-header p');

        if (searchQuery) {
            if (categoryToggle) categoryToggle.style.display = 'none';
            if (sectionH2) sectionH2.textContent = `Search results for "${searchQuery}"`;
            if (sectionP)  sectionP.textContent = '';
            filtered = allProducts.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            if (filtered.length === 0) {
                const grid = document.querySelector('.grid');
                if (grid) grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">No products found matching "${searchQuery}".</p>`;
                return;
            }
        } else {
            if (categoryToggle) categoryToggle.style.display = 'flex';
            if (sectionH2) sectionH2.textContent = 'Collection';
            if (sectionP)  sectionP.textContent = 'Shop by silhouette';

            if (filterHighBtn && filterLowBtn) {
                if (category === 'high') {
                    filterHighBtn.style.background = '#000';
                    filterHighBtn.style.color = '#fff';
                    filterLowBtn.style.background = 'transparent';
                    filterLowBtn.style.color = '#000';
                } else {
                    filterLowBtn.style.background = '#000';
                    filterLowBtn.style.color = '#fff';
                    filterHighBtn.style.background = 'transparent';
                    filterHighBtn.style.color = '#000';
                }
            }
            filtered = allProducts.filter(p => p.category === category);
        }

        renderProducts(filtered);
    }

    filterHighBtn.addEventListener('click', () => {
        searchQuery = null;
        category = 'high';
        updateView();
    });

    filterLowBtn.addEventListener('click', () => {
        searchQuery = null;
        category = 'low';
        updateView();
    });



    // Grid View Toggle Logic (Reused from home.js)
    const singleViewBtn = document.getElementById('singleViewBtn');
    const gridViewBtn = document.getElementById('gridViewBtn');
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
