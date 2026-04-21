import { getRawDataUrl } from './config.js';

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
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No products available for this category right now. Check back soon!</p>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let category = urlParams.get('category') || 'high'; // Default to high

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
        // Update URL
        const newUrl = window.location.pathname + '?category=' + category;
        window.history.replaceState(null, '', newUrl);

        // Update toggle UI
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

        // Render filtered products
        const filtered = allProducts.filter(p => p.category === category);
        renderProducts(filtered);
    }

    filterHighBtn.addEventListener('click', () => {
        category = 'high';
        updateView();
    });

    filterLowBtn.addEventListener('click', () => {
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
