import { getRawDataUrl } from './config.js';

const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

document.addEventListener('DOMContentLoaded', async () => {
    if(!productId) {
        document.getElementById('productTitle').textContent = "Product Not Found";
        return;
    }

    try {
        const response = await fetch(getRawDataUrl('products.json'));
        if (response.ok) {
            const products = await response.json();
            const product = products.find(p => p.id === productId);

            if (product) {
                // Render product info
                document.getElementById('productTitle').textContent = product.name;
                
                let priceHTML = '';
                if (product.compareAtPrice && product.compareAtPrice > product.price) {
                    priceHTML = `<span class="compare-price">Tk ${product.compareAtPrice.toLocaleString()}</span>`;
                }
                priceHTML += `Tk ${product.price.toLocaleString()}`;
                
                if (product.onSale) {
                    const badge = document.getElementById('liveSaleBadge');
                    if (badge) badge.style.display = 'block';
                }
                
                document.getElementById('productPrice').innerHTML = priceHTML;
                document.getElementById('mainProductImg').src = product.imageUrl;
                document.getElementById('productDesc').textContent = product.description;

                // Render colors
                const colorContainer = document.getElementById('colorOptions');
                colorContainer.innerHTML = '';
                let selectedColor = null;

                product.colors.forEach((c, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'color-btn';
                    btn.style.backgroundColor = c;
                    if(idx === 0) {
                        btn.classList.add('selected');
                        selectedColor = c;
                    }
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        selectedColor = c;
                        updateCartButton();
                    });
                    colorContainer.appendChild(btn);
                });

                // Render sizes
                const sizeContainer = document.getElementById('sizeOptions');
                sizeContainer.innerHTML = '';
                let selectedSize = null;

                product.sizes.forEach((s) => {
                    const btn = document.createElement('button');
                    btn.className = 'size-btn';
                    btn.textContent = s;
                    // Set disabled based on current selectedColor and stock
                    if (selectedColor) {
                        const key = `${s}_${selectedColor}`;
                        if (typeof product.stock === 'object' && product.stock[key] !== undefined) {
                            btn.disabled = product.stock[key] <= 0;
                        }
                    }
                    btn.addEventListener('click', () => {
                        // Prevent selection if out of stock
                        if (btn.disabled) return;
                        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        selectedSize = s;
                        updateCartButton();
                    });
                    sizeContainer.appendChild(btn);
                });

                // Refresh size button disabled state when a color is selected
                function refreshSizeAvailability() {
                    document.querySelectorAll('.size-btn').forEach(b => {
                        const sizeVal = b.textContent.trim();
                        if (selectedColor) {
                            const key = `${sizeVal}_${selectedColor}`;
                            if (typeof product.stock === 'object' && product.stock[key] !== undefined) {
                                b.disabled = product.stock[key] <= 0;
                            } else {
                                b.disabled = false;
                            }
                        } else {
                            b.disabled = false;
                        }
                        // Deselect if currently selected but now disabled
                        if (b.disabled && b.classList.contains('selected')) {
                            b.classList.remove('selected');
                            selectedSize = null;
                        }
                    });
                    updateCartButton();
                }

                // Hook into color selection to update sizes
                colorContainer.addEventListener('click', (e) => {
                    if (e.target && e.target.classList.contains('color-btn')) {
                        refreshSizeAvailability();
                    }
                });

                const oldBtn = document.getElementById('addToCartBtn');
                const newBtn = oldBtn.cloneNode(true);
                oldBtn.parentNode.replaceChild(newBtn, oldBtn);

                function updateCartButton() {
                    let variantStock = 10; // Default
                    if (typeof product.stock === 'number') {
                        variantStock = product.stock;
                    } else if (typeof product.stock === 'object' && product.stock !== null) {
                        if (selectedSize && selectedColor) {
                            variantStock = product.stock[`${selectedSize}_${selectedColor}`] || 0;
                        } else {
                            // If no size selected yet, check if ANY variant has stock
                            variantStock = Object.values(product.stock).reduce((a, b) => a + b, 0);
                        }
                    }

                    if (variantStock <= 0) {
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
                
                // Initial check
                updateCartButton();

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

            } else {
                document.getElementById('productTitle').textContent = "Product Not Found";
            }
        }
    } catch (err) {
        console.error("Error fetching product details", err);
    }
});
