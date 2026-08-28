import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { showEmptyCartConfirmModal } from '../../components/cart-modal/cart-modal.js';

const CART_STORAGE_KEY = 'tuestante_cart';

/**
 * Carga un componente HTML (Navbar / Footer) en un elemento placeholder.
 */
async function loadComponent(placeholderId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Error al cargar ${filePath}`);
        const html = await response.text();
        const container = document.getElementById(placeholderId);
        if (container) container.innerHTML = html;
    } catch (error) {
        console.error(`Error al cargar ${filePath}:`, error);
    }
}

/**
 * Obtiene la lista de productos almacenados en el Carrito desde LocalStorage.
 */
export function getCartItems() {
    try {
        const data = localStorage.getItem(CART_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error al leer el carrito de localStorage:', e);
        return [];
    }
}

/**
 * Guarda los productos del Carrito en LocalStorage.
 */
export function saveCartItems(items) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
        console.error('Error al guardar el carrito en localStorage:', e);
    }
}

/**
 * Añade un producto al Carrito o incrementa su cantidad si ya existe.
 */
export function addToCart(product) {
    const items = getCartItems();
    const existingIndex = items.findIndex(
        item => item.id === product.id && (item.color || '') === (product.color || '')
    );

    if (existingIndex > -1) {
        items[existingIndex].qty = (items[existingIndex].qty || 1) + (product.qty || 1);
    } else {
        items.push({
            id: product.id,
            name: product.name || 'Producto TuEstante',
            price: typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0,
            image: product.image || '../../assets/images/productos/estante-blanco.jpeg',
            color: product.color || 'Estándar',
            qty: product.qty || 1
        });
    }

    saveCartItems(items);
}

// Variables de estado del cupón
let appliedDiscountPercent = 0;
let appliedCouponCode = '';

const VALID_COUPONS = {
    'TUESTANTE10': 0.10,
    'DESCUENTO10': 0.10,
    'PROMO15': 0.15,
    'PROMO20': 0.20
};

/**
 * Renderiza la interfaz principal del Carrito.
 */
function renderCart() {
    const wrapper = document.getElementById('cart-content-wrapper');
    if (!wrapper) return;

    const items = getCartItems();

    if (items.length === 0) {
        wrapper.innerHTML = `
            <div class="empty-cart-container">
                <div class="empty-cart-icon-bg">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                </div>
                <h2 class="empty-cart-title">Tu carrito está vacío</h2>
                <p class="empty-cart-text">Aún no has añadido ningún producto a tu pedido. Explora nuestro catálogo de mobiliario metálico y organización inteligente.</p>
                <a href="../product/products.html" class="btn btn-primary btn-explore-products">
                    Explorar Productos
                </a>
            </div>
        `;
        return;
    }

    // Si hay productos, renderizamos la estructura de 2 columnas
    wrapper.innerHTML = `
        <div class="cart-items-column">
            <div class="cart-table-header">
                <span class="header-col col-product">Producto</span>
                <span class="header-col col-price">Precio</span>
                <span class="header-col col-qty">Cantidad</span>
                <span class="header-col col-subtotal">Subtotal</span>
                <span class="header-col col-action"></span>
            </div>

            <div id="cart-items-list" class="cart-items-list">
                ${items.map((item, index) => {
        const subtotal = (item.price * item.qty).toFixed(2);
        return `
                        <div class="cart-item-card" data-index="${index}">
                            <div class="cart-item-product">
                                <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='../../assets/images/productos/estante-blanco.jpeg'">
                                <div class="cart-item-details">
                                    <a href="../product/product-details.html?id=${item.id}" class="cart-item-title">${item.name}</a>
                                    <div class="cart-item-meta">
                                        <span>Color: ${item.color}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="cart-item-card-values">
                                <div class="cart-item-price">$${item.price.toFixed(2)}</div>

                                <div class="qty-control">
                                    <button class="qty-btn btn-qty-minus" data-index="${index}">-</button>
                                    <input type="number" class="qty-input" value="${item.qty}" min="1" max="99" data-index="${index}">
                                    <button class="qty-btn btn-qty-plus" data-index="${index}">+</button>
                                </div>

                                <div class="cart-item-subtotal">$${subtotal}</div>
                            </div>

                            <button class="btn-remove-item" data-index="${index}" title="Eliminar producto" aria-label="Eliminar producto">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    `;
    }).join('')}
            </div>

            <div class="cart-actions-footer">
                <a href="../product/products.html" class="btn btn-secondary btn-continue-shopping">
                    ← Seguir Comprando
                </a>

                <div class="shipping-state-box">
                    <span class="shipping-state-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </span>
                    <div class="shipping-state-content">
                        <label for="shipping-state-select" class="shipping-state-label">Estado de Envío:</label>
                        <select id="shipping-state-select" class="shipping-state-select">
                            <option value="Táchira">Táchira (Sede Principal)</option>
                            <option value="Mérida">Mérida</option>
                            <option value="Trujillo">Trujillo</option>
                            <option value="Barinas">Barinas</option>
                            <option value="Zulia">Zulia</option>
                            <option value="Lara">Lara</option>
                            <option value="Portuguesa">Portuguesa</option>
                            <option value="Falcón">Falcón</option>
                            <option value="Yaracuy">Yaracuy</option>
                            <option value="Cojedes">Cojedes</option>
                            <option value="Apure">Apure</option>
                            <option value="Carabobo">Carabobo</option>
                            <option value="Aragua">Aragua</option>
                            <option value="Distrito Capital (Caracas)">Distrito Capital (Caracas)</option>
                            <option value="Miranda">Miranda</option>
                            <option value="Guárico">Guárico</option>
                            <option value="La Guaira">La Guaira</option>
                            <option value="Anzoátegui">Anzoátegui</option>
                            <option value="Monagas">Monagas</option>
                            <option value="Sucre">Sucre</option>
                            <option value="Bolívar">Bolívar</option>
                            <option value="Nueva Esparta (Margarita)">Nueva Esparta (Margarita)</option>
                            <option value="Amazonas">Amazonas</option>
                            <option value="Delta Amacuro">Delta Amacuro</option>
                        </select>
                    </div>
                </div>

                <button id="btn-empty-cart" class="btn-clear-cart">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Vaciar Carrito
                </button>
            </div>
        </div>

        <div class="cart-summary-column">
            <div class="cart-summary-card">
                <h2 class="summary-title">Resumen del Pedido</h2>
                <div class="summary-divider"></div>

                <div class="summary-row">
                    <span>Subtotal</span>
                    <span id="summary-subtotal" class="summary-val">$0.00</span>
                </div>

                <div class="summary-row">
                    <span>Envío (<span id="shipping-state-name">Táchira</span>)</span>
                    <span id="summary-shipping" class="summary-val free-badge">Gratis (Táchira)</span>
                </div>

                <div id="coupon-applied-row" class="summary-row coupon-applied-row" style="${appliedDiscountPercent > 0 ? '' : 'display: none;'}">
                    <span>Descuento (<span id="coupon-code-text">${appliedCouponCode}</span>)</span>
                    <span id="summary-discount" class="summary-val discount-val">-$0.00</span>
                </div>

                <div class="summary-promo-box">
                    <label for="promo-code-input" class="promo-label">¿Tienes un cupón?</label>
                    <div class="promo-input-wrapper">
                        <input type="text" id="promo-code-input" placeholder="Ej: TUESTANTE10" aria-label="Código de descuento" autocomplete="off" value="${appliedCouponCode}">
                        <button id="btn-apply-promo" class="btn-promo-apply">Aplicar</button>
                    </div>
                    <span id="promo-message" class="promo-message ${appliedDiscountPercent > 0 ? 'success' : ''}">
                        ${appliedDiscountPercent > 0 ? `¡Cupón aplicado (${appliedDiscountPercent * 100}% de descuento)!` : ''}
                    </span>
                </div>

                <div class="summary-divider"></div>

                <div class="summary-row total-row">
                    <span>Total Estimado</span>
                    <span id="summary-total" class="total-val">$0.00</span>
                </div>

                <div class="summary-buttons">
                    <button id="btn-checkout-whatsapp" class="btn btn-primary btn-checkout-whatsapp">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                        Cotizar por WhatsApp
                    </button>
                    <button id="btn-checkout-direct" class="btn btn-secondary btn-checkout-direct">
                        Finalizar Compra
                    </button>
                </div>

                <div class="summary-security-badge">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    <span>Compra garantizada y atención personalizada</span>
                </div>
            </div>
        </div>
    `;

    bindCartEvents();
    updateSummary();
}

const VENEZUELA_SHIPPING_RATES = {
    'Táchira': { price: 0, isFree: true, label: 'Gratis (Táchira)' },
    'Mérida': { price: 15, isFree: false, label: '$15.00' },
    'Trujillo': { price: 20, isFree: false, label: '$20.00' },
    'Barinas': { price: 25, isFree: false, label: '$25.00' },
    'Zulia': { price: 25, isFree: false, label: '$25.00' },
    'Lara': { price: 30, isFree: false, label: '$30.00' },
    'Portuguesa': { price: 30, isFree: false, label: '$30.00' },
    'Falcón': { price: 35, isFree: false, label: '$35.00' },
    'Yaracuy': { price: 35, isFree: false, label: '$35.00' },
    'Cojedes': { price: 35, isFree: false, label: '$35.00' },
    'Apure': { price: 40, isFree: false, label: '$40.00' },
    'Carabobo': { price: 40, isFree: false, label: '$40.00' },
    'Aragua': { price: 40, isFree: false, label: '$40.00' },
    'Distrito Capital (Caracas)': { price: 45, isFree: false, label: '$45.00' },
    'Miranda': { price: 45, isFree: false, label: '$45.00' },
    'Guárico': { price: 45, isFree: false, label: '$45.00' },
    'La Guaira': { price: 50, isFree: false, label: '$50.00' },
    'Anzoátegui': { price: 55, isFree: false, label: '$55.00' },
    'Monagas': { price: 60, isFree: false, label: '$60.00' },
    'Sucre': { price: 65, isFree: false, label: '$65.00' },
    'Bolívar': { price: 70, isFree: false, label: '$70.00' },
    'Nueva Esparta (Margarita)': { price: 75, isFree: false, label: '$75.00' },
    'Amazonas': { price: 75, isFree: false, label: '$75.00' },
    'Delta Amacuro': { price: 80, isFree: false, label: '$80.00' }
};

function getShippingInfo(stateName) {
    if (!stateName) return VENEZUELA_SHIPPING_RATES['Táchira'];
    for (const key in VENEZUELA_SHIPPING_RATES) {
        if (stateName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(stateName.toLowerCase())) {
            return VENEZUELA_SHIPPING_RATES[key];
        }
    }
    return { price: 45, isFree: false, label: '$45.00' };
}

function formatShortStateName(name) {
    if (!name) return 'Táchira';
    if (name.includes('Distrito Capital')) return 'Caracas';
    if (name.includes('Margarita')) return 'Margarita';
    return name.split('(')[0].trim();
}

/**
 * Calcula y actualiza los montos del resumen del pedido.
 */
function updateSummary() {
    const items = getCartItems();
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const discountAmount = subtotal * appliedDiscountPercent;

    const selectedState = localStorage.getItem('tuestante_selected_state') || 'Táchira';
    const shippingInfo = getShippingInfo(selectedState);

    const total = Math.max(0, subtotal - discountAmount + shippingInfo.price);

    const subtotalEl = document.getElementById('summary-subtotal');
    const shippingNameEl = document.getElementById('shipping-state-name');
    const shippingEl = document.getElementById('summary-shipping');
    const discountRow = document.getElementById('coupon-applied-row');
    const discountEl = document.getElementById('summary-discount');
    const totalEl = document.getElementById('summary-total');

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (shippingNameEl) shippingNameEl.textContent = formatShortStateName(selectedState);

    if (shippingEl) {
        if (shippingInfo.isFree) {
            shippingEl.textContent = 'Gratis (Táchira)';
            shippingEl.className = 'summary-val free-badge';
        } else {
            shippingEl.textContent = `$${shippingInfo.price.toFixed(2)}`;
            shippingEl.className = 'summary-val';
        }
    }

    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    if (discountRow && discountEl) {
        if (appliedDiscountPercent > 0) {
            discountRow.style.display = 'flex';
            discountEl.textContent = `-$${discountAmount.toFixed(2)}`;
        } else {
            discountRow.style.display = 'none';
        }
    }
}

/**
 * Asigna los eventos interactivos a los botones de la lista y resumen.
 */
function bindCartEvents() {
    const wrapper = document.getElementById('cart-content-wrapper');
    if (!wrapper) return;

    // Botones de Incrementar / Decrementar cantidad
    wrapper.querySelectorAll('.btn-qty-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.getAttribute('data-index'), 10);
            const items = getCartItems();
            if (items[index]) {
                if (items[index].qty > 1) {
                    items[index].qty -= 1;
                    saveCartItems(items);
                    renderCart();
                }
            }
        });
    });

    wrapper.querySelectorAll('.btn-qty-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.getAttribute('data-index'), 10);
            const items = getCartItems();
            if (items[index]) {
                items[index].qty += 1;
                saveCartItems(items);
                renderCart();
            }
        });
    });

    // Input directo de cantidad
    wrapper.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', () => {
            const index = parseInt(input.getAttribute('data-index'), 10);
            let val = parseInt(input.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            const items = getCartItems();
            if (items[index]) {
                items[index].qty = val;
                saveCartItems(items);
                renderCart();
            }
        });
    });

    // Eliminar un producto
    wrapper.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.getAttribute('data-index'), 10);
            const items = getCartItems();
            items.splice(index, 1);
            saveCartItems(items);
            renderCart();
        });
    });

    // Vaciar todo el carrito con Modal de Confirmación
    const btnEmpty = document.getElementById('btn-empty-cart');
    if (btnEmpty) {
        btnEmpty.addEventListener('click', () => {
            showEmptyCartConfirmModal(() => {
                saveCartItems([]);
                appliedDiscountPercent = 0;
                appliedCouponCode = '';
                renderCart();
            });
        });
    }

    // Aplicar cupón de descuento
    const btnPromo = document.getElementById('btn-apply-promo');
    const inputPromo = document.getElementById('promo-code-input');
    const msgPromo = document.getElementById('promo-message');

    if (btnPromo && inputPromo && msgPromo) {
        btnPromo.addEventListener('click', () => {
            const code = inputPromo.value.trim().toUpperCase();
            if (!code) {
                msgPromo.textContent = 'Ingresa un código válido.';
                msgPromo.className = 'promo-message error';
                return;
            }

            if (VALID_COUPONS[code]) {
                appliedDiscountPercent = VALID_COUPONS[code];
                appliedCouponCode = code;
                msgPromo.textContent = `¡Cupón ${code} aplicado (${appliedDiscountPercent * 100}% desc.)!`;
                msgPromo.className = 'promo-message success';
                renderCart();
            } else {
                msgPromo.textContent = 'Código de descuento no válido o expirado.';
                msgPromo.className = 'promo-message error';
            }
        });
    }

    // Manejo del selector de Estado de Envío (a la izquierda de Vaciar Carrito)
    const selectState = document.getElementById('shipping-state-select');
    if (selectState) {
        const savedState = localStorage.getItem('tuestante_selected_state') || 'Táchira';
        for (let i = 0; i < selectState.options.length; i++) {
            if (selectState.options[i].value.toLowerCase() === savedState.toLowerCase()) {
                selectState.selectedIndex = i;
                break;
            }
        }

        selectState.addEventListener('change', () => {
            const selectedVal = selectState.value;
            localStorage.setItem('tuestante_selected_state', selectedVal);
            updateSummary();
        });
    }

    // Botón Cotizar por WhatsApp
    const btnWhatsapp = document.getElementById('btn-checkout-whatsapp');
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => {
            const items = getCartItems();
            if (items.length === 0) return;

            const selectedState = localStorage.getItem('tuestante_selected_state') || 'Táchira';
            const shippingInfo = getShippingInfo(selectedState);

            let text = 'Hola! Deseo cotizar los siguientes productos de mi carrito en TuEstante:\n\n';
            let subtotal = 0;

            items.forEach((item, i) => {
                const itemSub = item.price * item.qty;
                subtotal += itemSub;
                text += `${i + 1}. *${item.name}* (x${item.qty}) - Color: ${item.color} - $${itemSub.toFixed(2)}\n`;
            });

            const discount = subtotal * appliedDiscountPercent;
            const total = subtotal - discount + shippingInfo.price;

            text += `\n📍 *Estado de Envío*: ${selectedState}`;
            text += `\n🚚 *Costo de Envío (Origen Táchira)*: ${shippingInfo.isFree ? 'Gratis (Sede Táchira)' : `$${shippingInfo.price.toFixed(2)}`}`;

            if (appliedDiscountPercent > 0) {
                text += `\n*Descuento (${appliedCouponCode})*: -$${discount.toFixed(2)}`;
            }

            text += `\n*Total Estimado con Envío*: $${total.toFixed(2)}\n\n¿Me podrías brindar información sobre opciones de envío y disponibilidad para ${selectedState}? ¡Gracias!`;

            const encoded = encodeURIComponent(text);
            window.open(`https://wa.me/584120000000?text=${encoded}`, '_blank');
        });
    }

    // Botón Finalizar Compra Directa
    const btnDirect = document.getElementById('btn-checkout-direct');
    if (btnDirect) {
        btnDirect.addEventListener('click', () => {
            const selectedState = localStorage.getItem('tuestante_selected_state') || 'Táchira';
            alert(`¡Gracias por tu interés! Tu pedido con envío a ${selectedState} ha sido registrado con éxito. Un representante de ventas se pondrá en contacto contigo pronto.`);
            saveCartItems([]);
            appliedDiscountPercent = 0;
            appliedCouponCode = '';
            renderCart();
        });
    }
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async () => {
    await loadComponent('navbar-placeholder', '../../components/navbar/navbar.html');
    initNavbar();

    await loadComponent('footer-placeholder', '../../components/footer/footer.html');
    initFooter();

    renderCart();
});
