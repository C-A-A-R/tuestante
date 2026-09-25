/**
 * ==========================================================================
 * TUESTANTE – COMPONENTE REUTILIZABLE PRODUCT CART (TIENDA PÚBLICA)
 * Genera el HTML de una carta de producto con el estilo unificado del index.
 * Soporta: badge Outlet, badge Destacado, swatches de color, wishlist,
 * botón "Añadir al Carrito" y botón "Ver Detalle".
 * ==========================================================================
 */

import { API_BASE_URL } from '../../js/config.js';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Normaliza una URL de imagen de producto para que apunte siempre al backend.
 * @param {string|null} imagePath  Ruta relativa o URL absoluta devuelta por la API.
 * @param {string}      fallback   Ruta de imagen de respaldo.
 * @returns {string}
 */
export function formatProductImageUrl(imagePath, fallback = '') {
    if (!imagePath || typeof imagePath !== 'string') return fallback;
    const trimmed = imagePath.trim();
    if (!trimmed) return fallback;
    if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:')
    ) {
        return trimmed;
    }
    const backendOrigin = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:8000';
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${backendOrigin}${cleanPath}`;
}

// Asegurar carga de estilos del componente
function ensureProductCartStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('product-cart-css')) return;

    const isModulePage = window.location.pathname.includes('/modules/') || window.location.pathname.includes('/admin/');
    const cssPath = isModulePage ? '../../components/product-cart/product-cart.css' : 'components/product-cart/product-cart.css';

    const existing = document.querySelector('link[href*="product-cart.css"]');
    if (existing) {
        existing.id = 'product-cart-css';
        return;
    }

    const link = document.createElement('link');
    link.id = 'product-cart-css';
    link.rel = 'stylesheet';
    link.href = cssPath;
    document.head.appendChild(link);
}

/**
 * Genera el HTML del badge de "Producto Destacado" (estrella expandible al hover).
 * @param {boolean} show
 * @returns {string}
 */
function createStarBadgeHTML(show) {
    if (!show) return '';
    return `
        <div class="badge-destacado-star" title="Producto Destacado">
            <svg class="star-icon" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span class="star-label">Destacado</span>
        </div>`;
}

/**
 * Genera el HTML del badge de "Outlet" con stock disponible.
 * @param {number|null} qty
 * @returns {string}
 */
function createOutletBadgeHTML(qty) {
    if (qty == null || qty <= 0) return '';
    return `
        <div class="badge-outlet-tag" title="Stock disponible para entrega inmediata">
            <span>⚡ OUTLET (${qty} disp.)</span>
        </div>`;
}

/**
 * Genera el contenedor unificado de badges (Outlet y/o Destacado) asegurando que no choquen.
 * @param {number|null} outletQty
 * @param {boolean} isFeatured
 * @returns {string}
 */
function createCardBadgesHTML(outletQty, isFeatured) {
    const outletHTML = createOutletBadgeHTML(outletQty);
    const starHTML = createStarBadgeHTML(isFeatured);
    if (!outletHTML && !starHTML) return '';
    return `
        <div class="unified-card-badges">
            ${outletHTML}
            ${starHTML}
        </div>`;
}

/* ─── Función principal ───────────────────────────────────────────────────── */

/**
 * Crea y retorna el HTML string de una carta de producto pública.
 *
 * @param {Object}  product                    Objeto de producto de la API.
 * @param {Object}  [options]                  Opciones de configuración.
 * @param {string}  [options.detailBaseUrl]    Base de la URL de detalle (ej: "modules/product/product-details.html").
 * @param {boolean} [options.showWishlistBtn]  Muestra el botón de favoritos (default: true).
 * @param {boolean} [options.showCartBtn]      Muestra el botón "Añadir al carrito" (default: true).
 * @param {boolean} [options.showPrice]        Muestra el precio (default: true).
 * @param {string}  [options.fallbackImage]    URL de imagen de reserva.
 * @returns {string}  HTML string del componente.
 */
export function createProductCartHTML(product, options = {}) {
    ensureProductCartStyles();

    const {
        detailBaseUrl = 'modules/product/product-details.html',
        showWishlistBtn = true,
        showCartBtn = true,
        showPrice = true,
        fallbackImage = 'assets/images/gallery/real_space_1.jpg',
    } = options;

    const id = product.id;
    const name = product.product_name || product.name || 'Producto';
    const price = typeof product.price === 'number'
        ? product.price
        : parseFloat(product.price) || 0;
    const priceFormatted = price.toFixed(2);
    const isFavorite = Boolean(product.is_favorite);
    const isFeatured = Boolean(
        product.rating === 5.0 ||
        product.badge === 'Destacado' ||
        product.is_feature_product !== false
    );
    const outletQty = (product.is_outlet && product.quantity != null)
        ? product.quantity
        : null;

    const imgSrc = formatProductImageUrl(
        product.product_image || product.image,
        fallbackImage
    );
    const detailUrl = `${detailBaseUrl}?id=${id}`;

    const wishlistBtnHTML = showWishlistBtn ? `
        <button
            class="unified-wishlist-btn${isFavorite ? ' active' : ''}"
            data-id="${id}"
            title="${isFavorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos'}"
            aria-label="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? '#ef4444' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
        </button>` : '';

    const cartBtnHTML = showCartBtn ? `
        <button
            class="unified-btn btn-card-add-cart"
            data-id="${id}"
            data-name="${name}"
            data-price="${price}"
            data-image="${imgSrc}"
            aria-label="Añadir ${name} al carrito"
        >+ Carrito</button>` : '';

    const priceHTML = showPrice
        ? `<span class="unified-card-price">$${priceFormatted}</span>`
        : '';

    return `
        <div class="unified-product-card" data-product-id="${id}">
            <div class="unified-card-media" style="position: relative;">
                <a href="${detailUrl}" class="unified-card-img-link" aria-label="Ver detalle de ${name}">
                    <img src="${imgSrc}" alt="${name}" class="unified-card-img" loading="lazy">
                </a>
                ${createCardBadgesHTML(outletQty, isFeatured)}
                ${wishlistBtnHTML}
            </div>

            <div class="unified-card-body">
                <div class="unified-card-header">
                    ${priceHTML}
                    <h3 class="unified-card-title">
                        <a href="${detailUrl}">${name}</a>
                    </h3>
                </div>

                <div class="unified-card-divider"></div>

                <div class="unified-card-actions">
                    <a href="${detailUrl}" class="unified-btn btn-details">Ver Detalle</a>
                    ${cartBtnHTML}
                </div>
            </div>
        </div>`;
}

/**
 * Crea y retorna un HTMLElement (article) de la carta de producto.
 * Útil para insertar con `appendChild`.
 *
 * @param {Object}  product   Objeto de producto de la API.
 * @param {Object}  [options] Mismas opciones que `createProductCartHTML`.
 * @returns {HTMLElement}
 */
export function createProductCartElement(product, options = {}) {
    const template = document.createElement('template');
    template.innerHTML = createProductCartHTML(product, options).trim();
    return template.content.firstElementChild;
}

/**
 * Renderiza un array de productos en un contenedor del DOM.
 *
 * @param {HTMLElement} container  El elemento contenedor (debe existir).
 * @param {Array}       products   Array de objetos producto.
 * @param {Object}      [options]  Opciones de createProductCartHTML.
 * @param {string}      [emptyMessage] Mensaje cuando no hay productos.
 */
export function renderProductsInContainer(container, products, options = {}, emptyMessage = 'No hay productos disponibles.') {
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="pc-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
                <p>${emptyMessage}</p>
            </div>`;
        return;
    }

    container.innerHTML = products.map(p => createProductCartHTML(p, options)).join('');
}
