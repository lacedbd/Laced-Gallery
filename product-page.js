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
                document.getElementById('productPrice').textContent = 'Tk ' + product.price.toLocaleString();
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
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        selectedSize = s;
                    });
                    sizeContainer.appendChild(btn);
                });

                const oldBtn = document.getElementById('addToCartBtn');
                const newBtn = oldBtn.cloneNode(true);
                oldBtn.parentNode.replaceChild(newBtn, oldBtn);

                newBtn.addEventListener('click', () => {
                    if (!selectedSize) {
                        alert('Please select a size first!');
                        return;
                    }
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
