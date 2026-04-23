import { getRawDataUrl } from './config.js';

const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

document.addEventListener('DOMContentLoaded', async () => {
    if (!productId) {
        document.getElementById('productTitle').textContent = "Product Not Found";
        return;
    }

    // Fetch Settings (for promo bar)
    try {
        const response = await fetch(getRawDataUrl('settings.json'));
        if (response.ok) {
            const s = await response.json();
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
        }
    } catch (err) {
        console.error("Error loading settings", err);
    }

    try {
        const response = await fetch(getRawDataUrl('products.json'));
        if (!response.ok) return;

        const products = await response.json();
        const product = products.find(p => p.id === productId);

        if (!product) {
            document.getElementById('productTitle').textContent = "Product Not Found";
            return;
        }

        // ── Stock helper ────────────────────────────────────────────────────────
        // If product.stock is an object (even empty {}), stock tracking is ON.
        // Any variant key that is missing from the object is treated as 0 stock.
        const hasStockTracking = typeof product.stock === 'object' && product.stock !== null;

        function getVariantStock(size, color) {
            if (typeof product.stock === 'number') return product.stock;
            if (!hasStockTracking) return 10; // No tracking → allow all
            const key = `${size}_${color}`;
            return product.stock[key] ?? 0;   // Missing key → 0 stock
        }

        // ── Product info ─────────────────────────────────────────────────────────
        document.getElementById('productTitle').textContent = product.name;

        let priceHTML = '';
        if (product.compareAtPrice && product.compareAtPrice > product.price) {
            priceHTML = `<span class="compare-price">Tk ${product.compareAtPrice.toLocaleString()}</span>`;
        }
        priceHTML += `Tk ${product.price.toLocaleString()}`;
        document.getElementById('productPrice').innerHTML = priceHTML;

        if (product.onSale) {
            const badge = document.getElementById('liveSaleBadge');
            if (badge) badge.style.display = 'block';
        }

        document.getElementById('mainProductImg').src = product.imageUrl;
        document.getElementById('productDesc').textContent = product.description;

        // ── Colors ───────────────────────────────────────────────────────────────
        const colorContainer = document.getElementById('colorOptions');
        colorContainer.innerHTML = '';
        let selectedColor = product.colors[0] || null;

        product.colors.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.className = 'color-btn';
            btn.style.backgroundColor = c;
            if (idx === 0) btn.classList.add('selected');
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedColor = c;
                refreshSizeAvailability();
                updateCartButton();
            });
            colorContainer.appendChild(btn);
        });

        // ── Sizes ────────────────────────────────────────────────────────────────
        const sizeContainer = document.getElementById('sizeOptions');
        sizeContainer.innerHTML = '';
        let selectedSize = null;

        product.sizes.forEach((s) => {
            const btn = document.createElement('button');
            btn.className = 'size-btn';
            btn.textContent = s;
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedSize = s;
                updateCartButton();
            });
            sizeContainer.appendChild(btn);
        });

        // ── Refresh disabled state of all size buttons based on selected color ──
        function refreshSizeAvailability() {
            document.querySelectorAll('.size-btn').forEach(b => {
                const sizeVal = b.textContent.trim();
                const stock = getVariantStock(sizeVal, selectedColor);
                b.disabled = stock <= 0;
                if (b.disabled && b.classList.contains('selected')) {
                    b.classList.remove('selected');
                    selectedSize = null;
                }
            });
        }

        // ── Add-to-Cart button ───────────────────────────────────────────────────
        const oldBtn = document.getElementById('addToCartBtn');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        function updateCartButton() {
            let stock;
            if (selectedSize && selectedColor) {
                stock = getVariantStock(selectedSize, selectedColor);
            } else if (hasStockTracking) {
                stock = Object.values(product.stock).reduce((a, b) => a + b, 0);
            } else {
                stock = 10;
            }

            if (stock <= 0) {
                newBtn.textContent = 'Sold Out';
                newBtn.disabled = true;
                newBtn.style.opacity = '0.5';
                newBtn.style.cursor = 'not-allowed';
            } else {
                newBtn.textContent = 'Add to Cart';
                newBtn.disabled = false;
                newBtn.style.opacity = '1';
                newBtn.style.cursor = 'pointer';
            }
        }

        newBtn.addEventListener('click', () => {
            if (!selectedSize) {
                alert('Please select a size first!');
                return;
            }
            if (newBtn.disabled) return;
            window.addToCart({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.imageUrl,
                size: selectedSize,
                color: selectedColor,
                quantity: 1
            });
        });

        // ── Initial render ───────────────────────────────────────────────────────
        refreshSizeAvailability();
        updateCartButton();

    } catch (err) {
        console.error("Error fetching product details", err);
    }
});
