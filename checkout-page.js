import { CONFIG } from './config.js';

const checkoutForm = document.getElementById('checkoutForm');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.querySelector('.checkout-submit-btn');

        const cartItems = JSON.parse(localStorage.getItem('laced_cart')) || [];

        if (cartItems.length === 0) {
            alert("Your cart is empty!");
            return;
        }

        btn.textContent = 'Sending Order...';
        btn.disabled = true;

        try {
            const inputs = checkoutForm.querySelectorAll('input, textarea');
            
            // Format cart items beautifully for the email
            const itemsText = cartItems.map(item => 
                `- ${item.quantity}x ${item.name} (Size: ${item.size}, Color: ${item.color}) - Tk ${item.price * item.quantity}`
            ).join('\n');
            const total = cartItems.reduce((t, i) => t + (i.price * i.quantity), 0);

            const formData = new FormData();
            formData.append('access_key', CONFIG.web3formsKey);
            formData.append('subject', `New LACED Order from ${inputs[0].value}`);
            formData.append('Customer Name', inputs[0].value);
            formData.append('Phone Number', inputs[1].value);
            formData.append('Delivery Address', inputs[2].value);
            formData.append('Payment Method', document.querySelector('input[name="payment"]:checked').value);
            formData.append('Order Total', `Tk ${total}`);
            formData.append('Order Items', itemsText);

            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert("Order placed successfully! Our team will contact you shortly.");
                localStorage.removeItem('laced_cart');
                window.location.href = 'index.html';
            } else {
                throw new Error("Web3Forms submission failed");
            }
        } catch (err) {
            console.error("Error placing order", err);
            alert("Error placing order. Please check your config keys.");
            btn.textContent = 'Place Order';
            btn.disabled = false;
        }
    });
}
