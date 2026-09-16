import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { resolveImageUrl } from '../../js/api.js';
import {
    obtenerFavoritosUsuario,
    alternarFavoritoProducto,
    obtenerTiposProducto
} from './product.api.js';
import { getAccessToken } from '../../js/storage.js';
import { showCartModal } from '../../components/cart-modal/cart-modal.js';
import { showInfoToast, showSuccessToast, showErrorToast } from '../../components/toast/toast.js';

let userFavoriteProducts = [];
let allTypes = [];

/* ==========================================================================
   RENDERIZADO DE TARJETAS DE PRODUCTOS DESEADOS
   ========================================================================== */

function createUnifiedCardHTML(p) {
    const starBadgeHTML = p.is_feature_product ? `
        <div class="badge-destacado-star" title="Producto Destacado">
            <svg class="star-icon" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span class="star-label">Producto Destacado</span>
        </div>
    ` : '';

    const outletBadgeHTML = p.is_outlet ? `
        <div class="badge-outlet-flag" style="position: absolute; top: 12px; left: 12px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35); z-index: 3; display: flex; align-items: center; gap: 4px;">
            <span>⚡ OUTLET</span>
            ${p.quantity > 0 ? `<span style="background: rgba(0,0,0,0.25); padding: 1px 6px; border-radius: 10px; font-size: 0.68rem;">${p.quantity} disp.</span>` : ''}
        </div>
    ` : '';

    const prodImg = resolveImageUrl(p.product_image, '../../assets/images/productos/estante-blanco.jpeg');
    const formattedPrice = parseFloat(p.price || 0).toFixed(2);

    let swatchesHTML = '';
    if (Array.isArray(p.color_images) && p.color_images.length > 0) {
        const visibleColors = p.color_images.slice(0, 4);
        const remaining = p.color_images.length - 4;
        const dots = visibleColors.map(c => `
            <span class="swatch-dot" style="background-color: ${c.color_hex || '#cbd5e1'};" title="${c.color_name || 'Color'}"></span>
        `).join('');
        const more = remaining > 0 ? `<span class="swatch-more">+${remaining}</span>` : '';
        swatchesHTML = `<div class="unified-card-swatches">${dots}${more}</div>`;
    }

    return `
        <div class="unified-product-card" id="wishlist-card-${p.id}">
            <div class="unified-card-media" style="position: relative;">
                <a href="product-details.html?id=${p.id}" class="unified-card-img-link">
                    <img src="${prodImg}" alt="${p.product_name}" class="unified-card-img" loading="lazy">
                </a>
                
                ${outletBadgeHTML}
                ${starBadgeHTML}
                
                <button class="unified-wishlist-btn active" data-id="${p.id}" title="Quitar de lista de deseos" aria-label="Quitar de favoritos">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
            </div>

            <div class="unified-card-body">
                <div>
                    <div class="unified-card-header">
                        <h3 class="unified-card-title">
                            <a href="product-details.html?id=${p.id}">${p.product_name}</a>
                        </h3>
                        <span class="unified-card-price">$${formattedPrice}</span>
                    </div>

                    <p class="unified-card-desc">${p.description || ''}</p>

                    ${swatchesHTML}
                </div>

                <div class="unified-card-actions">
                    <a href="product-details.html?id=${p.id}" class="unified-btn btn-details">Ver Detalle</a>
                    <button class="unified-btn btn-card-add-cart" data-id="${p.id}" data-name="${p.product_name}" data-price="${p.price}" data-image="${prodImg}">
                        + Carrito
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderWishlistProducts(products) {
    const catalogContainer = document.getElementById('wishlist-catalog-container');
    const emptyBox = document.getElementById('wishlist-empty-box');
    const countNumberEl = document.getElementById('wishlist-count-number');

    if (countNumberEl) {
        countNumberEl.textContent = products ? products.length : 0;
    }

    if (!catalogContainer) return;

    if (!products || products.length === 0) {
        catalogContainer.innerHTML = '';
        if (emptyBox) {
            emptyBox.style.display = 'flex';
            emptyBox.innerHTML = `
                <div class="wishlist-empty-icon">🤍</div>
                <h3 class="wishlist-empty-title">No tienes productos deseados aún</h3>
                <p class="wishlist-empty-desc">
                    Tu lista de deseos está vacía. Explora nuestro catálogo y presiona el ícono de corazón en los muebles que te gusten para guardarlos aquí.
                </p>
                <a href="products.html" class="btn-explore-catalog">
                    Explorar Catálogo de Productos
                </a>
            `;
        }
        return;
    }

    if (emptyBox) emptyBox.style.display = 'none';
    catalogContainer.innerHTML = products.map(p => createUnifiedCardHTML(p)).join('');
}

function renderUnauthenticatedState() {
    const catalogContainer = document.getElementById('wishlist-catalog-container');
    const emptyBox = document.getElementById('wishlist-empty-box');
    const countNumberEl = document.getElementById('wishlist-count-number');

    if (countNumberEl) countNumberEl.textContent = '0';
    if (catalogContainer) catalogContainer.innerHTML = '';

    if (emptyBox) {
        emptyBox.style.display = 'flex';
        emptyBox.innerHTML = `
            <div class="wishlist-empty-icon">🔒</div>
            <h3 class="wishlist-empty-title">Inicia sesión para ver tus favoritos</h3>
            <p class="wishlist-empty-desc">
                Para consultar y administrar tu lista de productos deseados de forma segura en todos tus dispositivos, por favor ingresa a tu cuenta.
            </p>
            <a href="../auth/login.html?redirect=${encodeURIComponent(window.location.pathname)}" class="btn-explore-catalog">
                Iniciar Sesión
            </a>
        `;
    }
}

/* ==========================================================================
   LÓGICA DE FILTRADO
   ========================================================================== */

function initFilters() {
    const searchInput = document.getElementById('search-input');
    const filterTypeSelect = document.getElementById('filter-type');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    if (filterTypeSelect) {
        filterTypeSelect.innerHTML = '<option value="all">Todos los Tipos</option>';
        allTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = String(t.id);
            opt.textContent = t.product_type_name;
            filterTypeSelect.appendChild(opt);
        });
    }

    function applyFilters() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedType = filterTypeSelect ? filterTypeSelect.value : 'all';

        const filtered = userFavoriteProducts.filter(p => {
            const matchesSearch = !query ||
                (p.product_name && p.product_name.toLowerCase().includes(query)) ||
                (p.description && p.description.toLowerCase().includes(query));

            const matchesType = selectedType === 'all' || String(p.product_type) === selectedType;

            return matchesSearch && matchesType;
        });

        renderWishlistProducts(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterTypeSelect) filterTypeSelect.addEventListener('change', applyFilters);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterTypeSelect) filterTypeSelect.value = 'all';
            applyFilters();
        });
    }

    applyFilters();
}

/* ==========================================================================
   INICIALIZACIÓN DE LA PANTALLA
   ========================================================================== */

async function loadComponent(placeholderId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Error al cargar ${filePath}`);
        const html = await response.text();
        const container = document.getElementById(placeholderId);
        if (container) container.innerHTML = html;
    } catch (error) {
        console.error(`Error al cargar el componente ${filePath}:`, error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
        loadComponent('footer-placeholder', '../../components/footer/footer.html')
    ]);

    initNavbar();
    initFooter();
    document.body.classList.add('drawer-collapsed');

    if (!getAccessToken()) {
        renderUnauthenticatedState();
        return;
    }

    try {
        const [favsRes, typesRes] = await Promise.all([
            obtenerFavoritosUsuario(),
            obtenerTiposProducto()
        ]);

        userFavoriteProducts = Array.isArray(favsRes) ? favsRes : [];
        allTypes = Array.isArray(typesRes) ? typesRes : [];

        initFilters();
    } catch (err) {
        console.error('Error al inicializar favoritos:', err);
        showErrorToast('Error', 'No se pudieron cargar tus productos deseados.');
    }

    document.addEventListener('click', async (e) => {
        const wishlistBtn = e.target.closest('.unified-wishlist-btn');
        if (wishlistBtn) {
            const id = wishlistBtn.getAttribute('data-id');
            if (!id) return;

            wishlistBtn.disabled = true;

            try {
                const res = await alternarFavoritoProducto(id);
                const isNowFavorite = res && typeof res.is_favorite === 'boolean' ? res.is_favorite : false;

                if (!isNowFavorite) {
                    userFavoriteProducts = userFavoriteProducts.filter(p => String(p.id) !== String(id));
                    
                    const searchInput = document.getElementById('search-input');
                    const filterTypeSelect = document.getElementById('filter-type');

                    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
                    const selectedType = filterTypeSelect ? filterTypeSelect.value : 'all';

                    const filtered = userFavoriteProducts.filter(p => {
                        const matchesSearch = !query ||
                            (p.product_name && p.product_name.toLowerCase().includes(query)) ||
                            (p.description && p.description.toLowerCase().includes(query));

                        const matchesType = selectedType === 'all' || String(p.product_type) === selectedType;

                        return matchesSearch && matchesType;
                    });

                    renderWishlistProducts(filtered);
                    showInfoToast('Lista de Deseos', res.message || 'Producto eliminado de tus favoritos.');
                }
            } catch (err) {
                console.error('Error al alternar favorito:', err);
                showErrorToast('Error', 'No se pudo actualizar la lista de deseos.');
                wishlistBtn.disabled = false;
            }
            return;
        }

        const btnCart = e.target.closest('.btn-card-add-cart');
        if (btnCart) {
            const id = parseInt(btnCart.getAttribute('data-id'), 10);
            const name = btnCart.getAttribute('data-name');
            const price = parseFloat(btnCart.getAttribute('data-price')) || 0;
            const image = btnCart.getAttribute('data-image');

            const CART_STORAGE_KEY = 'tuestante_cart';
            let items = [];
            try {
                const raw = localStorage.getItem(CART_STORAGE_KEY);
                if (raw) items = JSON.parse(raw);
            } catch {
                items = [];
            }

            const existingIndex = items.findIndex(i => String(i.id) === String(id));
            if (existingIndex > -1) {
                items[existingIndex].qty += 1;
            } else {
                items.push({ id, name, price, image, color: 'Estándar', qty: 1 });
            }

            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
            window.dispatchEvent(new Event('cart-updated'));
            showCartModal({ id, name, price, image });
        }
    });
});
