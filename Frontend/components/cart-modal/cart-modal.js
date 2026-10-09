/**
 * ==========================================================================
 * TUESTANTE - MODAL DE CONFIRMACIÓN DE AGREGADO AL CARRITO Y SELECTOR DE CANTIDAD
 * ==========================================================================
 * Permite seleccionar y modificar la cantidad de artículos deseada directamente
 * desde el modal emergente tras añadir un producto, sincronizando automáticamente
 * el estado en LocalStorage ('tuestante_cart') y el indicador del Navbar.
 */

const CART_STORAGE_KEY = 'tuestante_cart';

/**
 * Carga el CSS del modal de forma segura según la ubicación actual en el navegador.
 */
function ensureCartModalCss() {
    if (document.getElementById('cart-modal-css')) return;
    const link = document.createElement('link');
    link.id = 'cart-modal-css';
    link.rel = 'stylesheet';
    const path = window.location.pathname;
    if (path.includes('/modules/') || path.includes('/admin/')) {
        link.href = '../../components/cart-modal/cart-modal.css';
    } else {
        link.href = 'components/cart-modal/cart-modal.css';
    }
    document.head.appendChild(link);
}

/**
 * Consulta la cantidad actual almacenada de un producto en el carrito (localStorage).
 * @param {string|number} productId
 * @param {string} [color]
 * @returns {number}
 */
function getCartItemQuantity(productId, color) {
    if (!productId) return 1;
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return 1;
        const items = JSON.parse(raw);
        if (!Array.isArray(items)) return 1;
        const found = items.find(i => String(i.id) === String(productId) && (!color || i.color === color));
        if (found) {
            return parseInt(found.qty, 10) || parseInt(found.quantity, 10) || 1;
        }
    } catch (e) {
        console.warn('[CartModal] Error leyendo cantidad del carrito:', e);
    }
    return 1;
}

/**
 * Guarda y sincroniza la cantidad seleccionada en el carrito de compras (localStorage).
 * Dispara el evento global 'cart-updated' para sincronizar el badge del navbar en tiempo real.
 * @param {Object} product
 * @param {number} newQty
 */
function syncCartItemQuantity(product, newQty) {
    if (!product || !product.id) return;
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        let items = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(items)) items = [];

        const targetColor = product.color || 'Estándar';
        const index = items.findIndex(i => String(i.id) === String(product.id) && (!product.color || i.color === targetColor));

        const numericPrice = typeof product.price === 'number'
            ? product.price
            : parseFloat(String(product.price || 0).replace(/[^0-9.-]+/g, '')) || 0;

        if (index > -1) {
            items[index].qty = newQty;
        } else {
            items.push({
                id: product.id,
                name: product.name || 'Producto',
                price: numericPrice,
                image: product.image || '../../assets/images/productos/estante-blanco.jpeg',
                color: targetColor,
                qty: newQty
            });
        }

        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
        console.error('[CartModal] Error guardando cantidad en el carrito:', err);
    }
}

/**
 * Muestra una ventana modal permitiendo al usuario seleccionar la cantidad deseada,
 * ver el subtotal calculado y decidir entre seguir comprando o ir al carrito.
 * @param {Object} product - { id, name, image, price, color, stock, qty }
 * @param {Function} [onViewCart] - Callback opcional al hacer clic en Ver Carrito
 * @param {Function} [onKeepShopping] - Callback opcional al hacer clic en Quedarme aquí o Cerrar
 * @param {Function} [onQuantityChange] - Callback opcional al modificar la cantidad
 */
export function showCartModal(product, onViewCart, onKeepShopping, onQuantityChange) {
    ensureCartModalCss();

    let overlay = document.getElementById('cart-added-modal-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cart-added-modal-overlay';
        overlay.className = 'cart-modal-overlay';
        overlay.innerHTML = `
            <div class="cart-modal-container" role="dialog" aria-modal="true" aria-labelledby="cart-modal-title">
                <button class="cart-modal-close" id="cart-modal-close-btn" aria-label="Cerrar">&times;</button>
                <div class="cart-modal-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h3 class="cart-modal-title" id="cart-modal-title">¡Añadido al Carrito!</h3>
                <p class="cart-modal-subtitle">Ajusta la cantidad deseada o continúa explorando nuestro catálogo.</p>
                
                <div class="cart-modal-prod-info">
                    <img id="cart-modal-img" src="" alt="" class="cart-modal-prod-img">
                    <div class="cart-modal-prod-details">
                        <span id="cart-modal-name" class="cart-modal-prod-name"></span>
                        <div class="cart-modal-prod-meta">
                            <span id="cart-modal-price" class="cart-modal-prod-price"></span>
                            <span id="cart-modal-variant" class="cart-modal-prod-variant" style="display: none;"></span>
                        </div>
                    </div>
                </div>

                <!-- Selector de Cantidad Dinámico -->
                <div class="cart-modal-qty-section">
                    <div class="cart-modal-qty-header">
                        <span class="cart-modal-qty-label">Cantidad a llevar:</span>
                        <div class="cart-modal-subtotal-display">
                            <span>Subtotal:</span>
                            <strong id="cart-modal-subtotal">$0.00</strong>
                        </div>
                    </div>
                    <div class="cart-modal-qty-row">
                        <div class="cart-modal-qty-control">
                            <button type="button" class="cart-modal-qty-btn btn-qty-minus" id="cart-modal-qty-minus" aria-label="Disminuir cantidad">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                            <input type="number" id="cart-modal-qty-input" class="cart-modal-qty-input" value="1" min="1" max="999" aria-label="Cantidad de productos" />
                            <button type="button" class="cart-modal-qty-btn btn-qty-plus" id="cart-modal-qty-plus" aria-label="Aumentar cantidad">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </div>
                        <span class="cart-modal-qty-hint" id="cart-modal-unit-hint">$0.00 c/u</span>
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

    // Datos del producto
    const imgEl = overlay.querySelector('#cart-modal-img');
    const nameEl = overlay.querySelector('#cart-modal-name');
    const priceEl = overlay.querySelector('#cart-modal-price');
    const variantEl = overlay.querySelector('#cart-modal-variant');

    if (imgEl) imgEl.src = product.image || '../../assets/images/productos/estante-blanco.jpeg';
    if (nameEl) nameEl.textContent = product.name || 'Producto';

    const numericPrice = typeof product.price === 'number'
        ? product.price
        : parseFloat(String(product.price || 0).replace(/[^0-9.-]+/g, '')) || 0;

    if (priceEl) priceEl.textContent = `$${numericPrice.toFixed(2)}`;

    if (variantEl) {
        if (product.color && product.color !== 'Estándar') {
            variantEl.textContent = `Color: ${product.color}`;
            variantEl.style.display = 'inline-block';
        } else {
            variantEl.style.display = 'none';
        }
    }

    // Cantidad inicial del producto
    let initialQty = product.qty ? parseInt(product.qty, 10) : getCartItemQuantity(product.id, product.color);
    if (isNaN(initialQty) || initialQty < 1) initialQty = 1;

    let currentQty = initialQty;
    const maxStock = typeof product.stock === 'number' && product.stock > 0 ? product.stock : 999;

    const qtyInput = overlay.querySelector('#cart-modal-qty-input');
    const btnMinus = overlay.querySelector('#cart-modal-qty-minus');
    const btnPlus = overlay.querySelector('#cart-modal-qty-plus');
    const subtotalEl = overlay.querySelector('#cart-modal-subtotal');
    const unitHintEl = overlay.querySelector('#cart-modal-unit-hint');

    function renderQtyState(qty) {
        if (qtyInput) qtyInput.value = qty;
        if (btnMinus) btnMinus.disabled = qty <= 1;
        if (btnPlus) btnPlus.disabled = qty >= maxStock;
        if (subtotalEl) {
            const subtotal = numericPrice * qty;
            subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        }
        if (unitHintEl) {
            if (product.stock && product.stock > 0) {
                unitHintEl.textContent = `$${numericPrice.toFixed(2)} c/u (${product.stock} disp.)`;
            } else {
                unitHintEl.textContent = `$${numericPrice.toFixed(2)} c/u`;
            }
        }
    }

    function setQuantity(newQty) {
        let clamped = parseInt(newQty, 10);
        if (isNaN(clamped) || clamped < 1) clamped = 1;
        if (clamped > maxStock) clamped = maxStock;
        currentQty = clamped;
        renderQtyState(currentQty);
        syncCartItemQuantity(product, currentQty);
        if (typeof onQuantityChange === 'function') {
            onQuantityChange(currentQty, product);
        }
    }

    // Inicializar estado visual de cantidad y subtotal
    renderQtyState(currentQty);

    // Controles de incremento y decremento
    if (btnMinus) {
        btnMinus.onclick = (e) => {
            e.stopPropagation();
            if (currentQty > 1) {
                setQuantity(currentQty - 1);
            }
        };
    }

    if (btnPlus) {
        btnPlus.onclick = (e) => {
            e.stopPropagation();
            if (currentQty < maxStock) {
                setQuantity(currentQty + 1);
            }
        };
    }

    if (qtyInput) {
        qtyInput.oninput = (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1) {
                setQuantity(val);
            }
        };

        qtyInput.onblur = (e) => {
            const val = parseInt(e.target.value, 10);
            if (isNaN(val) || val < 1) {
                setQuantity(1);
            } else if (val > maxStock) {
                setQuantity(maxStock);
            }
        };

        qtyInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                qtyInput.blur();
            }
        };
    }

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

    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };

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
    ensureCartModalCss();

    let overlay = document.getElementById('cart-empty-modal-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cart-empty-modal-overlay';
        overlay.className = 'cart-modal-overlay';
        overlay.innerHTML = `
            <div class="cart-modal-container">
                <button class="cart-modal-close" id="cart-empty-close-btn" aria-label="Cerrar">&times;</button>
                <div class="cart-modal-icon danger">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
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

    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            overlay.classList.remove('active');
            if (typeof onConfirm === 'function') onConfirm();
        };
    }
}
