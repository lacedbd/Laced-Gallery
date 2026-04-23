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

    // Fetch Products
    try {
        const response = await fetch(getRawDataUrl('products.json'));
        if (response.ok) {
            allProducts = await response.json();
            updateView();
        }
    } catch (err) {
        console.error("Error fetching products", err);
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

        if (searchQuery) {
            document.querySelector('.category-toggle').style.display = 'none';
            document.querySelector('.section-header h2').textContent = `Search results for "${searchQuery}"`;
            document.querySelector('.section-header p').textContent = '';
            filtered = allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase()));
            
            if (filtered.length === 0) {
                const grid = document.querySelector('.grid');
                grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">No products found matching "${searchQuery}".</p>`;
                return;
            }
        } else {
            document.querySelector('.category-toggle').style.display = 'flex';
            document.querySelector('.section-header h2').textContent = 'Collection';
            document.querySelector('.section-header p').textContent = 'Shop by silhouette';

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
