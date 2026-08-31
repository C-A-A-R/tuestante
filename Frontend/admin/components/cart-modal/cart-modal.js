/**
 * Muestra una ventana modal preguntando al usuario si desea ir al carrito o seguir comprando.
 * @param {Object} product - { name, image, price }
 * @param {Function} [onViewCart] - Callback opcional al hacer clic en Ver Carrito
 * @param {Function} [onKeepShopping] - Callback opcional al hacer clic en Seguir Comprando
 */
export function showCartModal(product, onViewCart, onKeepShopping) {
    let overlay = document.getElementById('cart-added-modal-overlay');

    if (!overlay) {
        // Cargar CSS del modal de forma segura según la ubicación actual
        if (!document.getElementById('cart-modal-css')) {
            const link = document.createElement('link');
            link.id = 'cart-modal-css';
            link.rel = 'stylesheet';
            const isModulePage = window.location.pathname.includes('/modules/');
            link.href = isModulePage ? '../../components/cart-modal/cart-modal.css' : 'components/cart-modal/cart-modal.css';
            document.head.appendChild(link);
        }

        overlay = document.createElement('div');
        overlay.id = 'cart-added-modal-overlay';
        overlay.className = 'cart-modal-overlay';
        overlay.innerHTML = `
            <div class="cart-modal-container">
                <button class="cart-modal-close" id="cart-modal-close-btn" aria-label="Cerrar">&times;</button>
                <div class="cart-modal-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h3 class="cart-modal-title">¡Añadido al Carrito!</h3>
                <p class="cart-modal-subtitle">El producto ha sido agregado con éxito a tu carrito de compras.</p>
                
                <div class="cart-modal-prod-info">
                    <img id="cart-modal-img" src="" alt="" class="cart-modal-prod-img">
                    <div class="cart-modal-prod-details">
                        <span id="cart-modal-name" class="cart-modal-prod-name"></span>
                        <span id="cart-modal-price" class="cart-modal-prod-price"></span>
                    </div>
                </div>

                <div class="cart-modal-buttons">
                    <button id="cart-modal-btn-keep" class="btn-modal-keep-shopping">Quedarme aquí</button>
                    <button id="cart-modal-btn-view" class="btn-modal-view-cart">Ver Carrito</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const imgEl = overlay.querySelector('#cart-modal-img');
    const nameEl = overlay.querySelector('#cart-modal-name');
    const priceEl = overlay.querySelector('#cart-modal-price');

    if (imgEl) imgEl.src = product.image || '../../assets/images/productos/estante-blanco.jpeg';
    if (nameEl) nameEl.textContent = product.name || 'Producto';
    if (priceEl && product.price) priceEl.textContent = `$${parseFloat(product.price).toFixed(2)}`;

    // Mostrar modal con pequeña demora para animación
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    const closeBtn = overlay.querySelector('#cart-modal-close-btn');
    const keepBtn = overlay.querySelector('#cart-modal-btn-keep');
    const viewBtn = overlay.querySelector('#cart-modal-btn-view');

    function closeModal() {
        overlay.classList.remove('active');
        if (typeof onKeepShopping === 'function') onKeepShopping();
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (keepBtn) keepBtn.onclick = closeModal;
    if (viewBtn) {
        viewBtn.onclick = () => {
            overlay.classList.remove('active');
            if (typeof onViewCart === 'function') {
                onViewCart();
            } else {
                const path = window.location.pathname;
                if (path.includes('/modules/')) {
                    window.location.href = '../cart/cart.html';
                } else {
                    window.location.href = 'modules/cart/cart.html';
                }
            }
        };
    }
}

/**
 * Muestra una ventana modal preguntando al usuario si realmente desea vaciar el carrito.
 * @param {Function} onConfirm - Callback ejecutado si el usuario confirma vaciar el carrito.
 */
export function showEmptyCartConfirmModal(onConfirm) {
    let overlay = document.getElementById('cart-empty-modal-overlay');

    if (!overlay) {
        if (!document.getElementById('cart-modal-css')) {
            const link = document.createElement('link');
            link.id = 'cart-modal-css';
            link.rel = 'stylesheet';
            link.href = '../../components/cart-modal/cart-modal.css';
            document.head.appendChild(link);
        }

        overlay = document.createElement('div');
        overlay.id = 'cart-empty-modal-overlay';
        overlay.className = 'cart-modal-overlay';
        overlay.innerHTML = `
            <div class="cart-modal-container">
                <button class="cart-modal-close" id="cart-empty-close-btn" aria-label="Cerrar">&times;</button>
                <div class="cart-modal-icon danger">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </div>
                <h3 class="cart-modal-title">¿Vaciar todo el carrito?</h3>
                <p class="cart-modal-subtitle" style="margin-bottom: 24px;">Esta acción eliminará de forma permanente todos los productos seleccionados de tu pedido.</p>

                <div class="cart-modal-buttons">
                    <button id="cart-empty-btn-cancel" class="btn-modal-keep-shopping">Cancelar</button>
                    <button id="cart-empty-btn-confirm" class="btn-modal-danger">Sí, Vaciar Carrito</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    const closeBtn = overlay.querySelector('#cart-empty-close-btn');
    const cancelBtn = overlay.querySelector('#cart-empty-btn-cancel');
    const confirmBtn = overlay.querySelector('#cart-empty-btn-confirm');

    function closeModal() {
        overlay.classList.remove('active');
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            overlay.classList.remove('active');
            if (typeof onConfirm === 'function') onConfirm();
        };
    }
}
