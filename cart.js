// cart.js

// Cart State Management
let cart = JSON.parse(localStorage.getItem('laced_cart')) || [];

function saveCart() {
    localStorage.setItem('laced_cart', JSON.stringify(cart));
}

function formatPrice(price) {
    return 'Tk ' + price.toLocaleString();
}

function getCartTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function getCartCount() {
    return cart.reduce((count, item) => count + item.quantity, 0);
}

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        const count = getCartCount();
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    const container = document.getElementById('cartItemsContainer');
    if (!container) return; // not on a page with cart drawer

    container.innerHTML = '';

    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Your cart is empty.</div>';
        document.getElementById('checkoutBtn').style.pointerEvents = 'none';
        document.getElementById('checkoutBtn').style.opacity = '0.5';
    } else {
        document.getElementById('checkoutBtn').style.pointerEvents = 'auto';
        document.getElementById('checkoutBtn').style.opacity = '1';

        cart.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>Size: ${item.size} | Color: ${item.color}</p>
                    <p class="cart-item-price">${formatPrice(item.price)}</p>
                    <div class="cart-item-controls">
                        <button class="qty-btn minus" data-index="${index}">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn plus" data-index="${index}">+</button>
                    </div>
                </div>
                <button class="remove-btn" data-index="${index}">&times;</button>
            `;
            container.appendChild(itemEl);
        });
    }

    document.getElementById('cartTotalAmount').textContent = formatPrice(getCartTotal());
    attachCartListeners();
}

function attachCartListeners() {
    document.querySelectorAll('.qty-btn.minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            if (cart[index].quantity > 1) {
                cart[index].quantity--;
            } else {
                cart.splice(index, 1);
            }
            saveCart();
            updateCartUI();
        });
    });

    document.querySelectorAll('.qty-btn.plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            cart[index].quantity++;
            saveCart();
            updateCartUI();
        });
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            cart.splice(index, 1);
            saveCart();
            updateCartUI();
        });
    });
}

function addToCart(product) {
    const existingIndex = cart.findIndex(item => 
        item.id === product.id && item.size === product.size && item.color === product.color
    );

    if (existingIndex > -1) {
        cart[existingIndex].quantity += product.quantity;
    } else {
        cart.push(product);
    }
    
    saveCart();
    updateCartUI();
    openCart();
}

// Drawer UI Logic
const cartOverlay = document.getElementById('cartOverlay');
const cartDrawer = document.getElementById('cartDrawer');
const navCartBtn = document.getElementById('navCartBtn');
const closeCartBtn = document.getElementById('closeCartBtn');

function openCart() {
    if (cartDrawer && cartOverlay) {
        cartDrawer.classList.add('open');
        cartOverlay.classList.add('open');
        updateCartUI();
    }
}

function closeCart() {
    if (cartDrawer && cartOverlay) {
        cartDrawer.classList.remove('open');
        cartOverlay.classList.remove('open');
    }
}

if (navCartBtn) navCartBtn.addEventListener('click', openCart);
if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

// Init on load
document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
});
