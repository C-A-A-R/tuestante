/**
 * ==========================================================================
 * LÓGICA DE LA PANTALLA 'PRODUCTOS DESEADOS' (WISHLIST) - TUESTANTE
 * Conexión completa al backend para listar únicamente los favoritos del usuario,
 * estados vacíos informativos, filtros reactivos y desmarcado en tiempo real.
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import {
    obtenerFavoritosUsuario,
    alternarFavoritoProducto,
    obtenerTiposProducto
} from './product.api.js';
import { backendOrigin } from '../../js/config.js';
import { getAccessToken } from '../../js/storage.js';
import { showCartModal } from '../../components/cart-modal/cart-modal.js';
import { showInfoToast, showSuccessToast, showErrorToast } from '../../components/toast/toast.js';

let userFavoriteProducts = [];
let allTypes = [];
let allCategories = [];

function resolveImageUrl(imagePath, fallback = '../../assets/images/categoria/estante.png') {
    if (!imagePath) return fallback;

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        if (imagePath.includes('/media/')) {
            const mediaPath = imagePath.substring(imagePath.indexOf('/media/'));
            return `${backendOrigin}${mediaPath}`;
        }
        return imagePath;
    }

    if (imagePath.startsWith('/media/') || imagePath.startsWith('media/')) {
        const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
        return `${backendOrigin}${cleanPath}`;
    }

    if (imagePath.includes('assets/')) {
        if (!imagePath.startsWith('../') && !imagePath.startsWith('/')) {
            return `../../${imagePath}`;
        }
        return imagePath;
    }

    if (imagePath.startsWith('/')) {
        return `${backendOrigin}${imagePath}`;
    }

    return `${backendOrigin}/${imagePath}`;
}

function extractList(apiResult) {
    if (!apiResult) return [];
    if (Array.isArray(apiResult)) return apiResult;
    if (Array.isArray(apiResult.results)) return apiResult.results;
    return [];
}

function mapProduct(p) {
    if (!p) return null;

    let categoryIds = [];
    if (Array.isArray(p.categories) && p.categories.length > 0) {
        categoryIds = p.categories.map(c => (typeof c === 'object' && c !== null ? c.id : c));
    } else if (Array.isArray(p.categories_detail) && p.categories_detail.length > 0) {
        categoryIds = p.categories_detail.map(c => c.id);
    } else if (p.category || p.category_detail?.id || p.categoryId) {
        categoryIds = [p.category || p.category_detail?.id || p.categoryId];
    }

    let categoryNames = [];
    if (Array.isArray(p.categories_detail) && p.categories_detail.length > 0) {
        categoryNames = p.categories_detail.map(c => c.category_name || c.name);
    } else if (p.category_detail?.category_name || p.categoryName) {
        categoryNames = [p.category_detail?.category_name || p.categoryName];
    } else {
        categoryNames = ['General'];
    }

    return {
        id: p.id,
        typeId: p.product_type || p.product_type_detail?.id || p.typeId || 1,
        typeName: p.product_type_detail?.product_type_name || p.typeName || 'General',
        categoryIds: categoryIds,
        categoryId: categoryIds[0] || 1,
        categoryNames: categoryNames,
        categoryName: categoryNames[0] || 'General',
        name: p.product_name || p.name || 'Producto sin nombre',
        description: p.description || '',
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        rating: p.rating !== undefined ? parseFloat(p.rating) : (p.badge === 'Destacado' ? 5.0 : 4.5),
        image: resolveImageUrl(p.product_image || p.image, '../../assets/images/productos/estante-blanco.jpeg'),
        badge: (p.rating === 5.0 || p.badge === 'Destacado' || p.is_feature_product) ? 'Destacado' : '',
        favorites_count: p.favorites_count || 0
    };
}

/* ==========================================================================
   RENDERIZADO DE TARJETAS DE PRODUCTOS DESEADOS
   ========================================================================== */

function createUnifiedCardHTML(p) {
    const isFeatured = !!(p.rating === 5.0 || p.badge === 'Destacado' || p.is_feature_product);
    const starBadgeHTML = isFeatured ? `
        <div class="badge-destacado-star" title="Producto Destacado">
            <svg class="star-icon" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span class="star-label">Producto Destacado</span>
        </div>
    ` : '';

    return `
        <div class="unified-product-card" id="wishlist-card-${p.id}">
            <div class="unified-card-media">
                <a href="product-details.html?id=${p.id}" class="unified-card-img-link">
                    <img src="${p.image}" alt="${p.name}" class="unified-card-img" loading="lazy">
                </a>
                
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
                            <a href="product-details.html?id=${p.id}">${p.name}</a>
                        </h3>
                        <span class="unified-card-price">$${p.price.toFixed(2)}</span>
                    </div>

                    <p class="unified-card-desc">${p.description}</p>

                    <div class="unified-card-swatches">
                        <span class="swatch-dot" style="background-color: #ea580c;" title="Naranja"></span>
                        <span class="swatch-dot" style="background-color: #0f172a;" title="Gris Oscuro"></span>
                        <span class="swatch-dot" style="background-color: #15803d;" title="Verde Sabana"></span>
                        <span class="swatch-dot" style="background-color: #005187;" title="Azul"></span>
                        <span class="swatch-more">+4</span>
                    </div>
                </div>

                <div class="unified-card-actions">
                    <a href="product-details.html?id=${p.id}" class="unified-btn btn-details">Ver Detalle</a>
                    <button class="unified-btn btn-card-add-cart" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-image="${p.image}">
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
    const filterCategorySelect = document.getElementById('filter-category');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // 1. Popular tipos
    if (filterTypeSelect) {
        filterTypeSelect.innerHTML = '<option value="all">Todos los Tipos</option>';
        allTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            filterTypeSelect.appendChild(opt);
        });
    }

    // 2. Popular categorías
    if (filterCategorySelect) {
        filterCategorySelect.innerHTML = '<option value="all">Todas las Categorías</option>';
        allCategories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            filterCategorySelect.appendChild(opt);
        });
    }

    function applyFilters() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedType = filterTypeSelect ? filterTypeSelect.value : 'all';
        const selectedCat = filterCategorySelect ? filterCategorySelect.value : 'all';

        const filtered = userFavoriteProducts.filter(p => {
            const matchesSearch = !query ||
                (p.name && p.name.toLowerCase().includes(query)) ||
                (p.description && p.description.toLowerCase().includes(query));

            const matchesType = selectedType === 'all' ||
                (p.typeId !== undefined && p.typeId.toString() === selectedType.toString());

            const pCatIds = Array.isArray(p.categoryIds) ? p.categoryIds : (p.categoryId !== undefined ? [p.categoryId] : [1]);
            const matchesCat = selectedCat === 'all' ||
                pCatIds.some(id => id !== undefined && id.toString() === selectedCat.toString());

            return matchesSearch && matchesType && matchesCat;
        });

        renderWishlistProducts(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterTypeSelect) filterTypeSelect.addEventListener('change', applyFilters);
    if (filterCategorySelect) filterCategorySelect.addEventListener('change', applyFilters);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterTypeSelect) filterTypeSelect.value = 'all';
            if (filterCategorySelect) filterCategorySelect.value = 'all';
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
        const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Error al cargar ${filePath}`);
        const html = await response.text();
        const container = document.getElementById(placeholderId);
        if (container) container.innerHTML = html;
    } catch (error) {
        console.error(`Error al cargar el componente ${filePath}:`, error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Navbar y Footer
    await Promise.all([
        loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
        loadComponent('footer-placeholder', '../../components/footer/footer.html')
    ]);

    initNavbar();
    initFooter();
    document.body.classList.add('drawer-collapsed');

    // 2. Verificar autenticación
    const token = getAccessToken();
    if (!token) {
        renderUnauthenticatedState();
        return;
    }

    // 3. Cargar datos del backend
    try {
        const [favsRes, typesRes] = await Promise.all([
            obtenerFavoritosUsuario().catch(err => {
                console.error('Error al obtener favoritos:', err);
                return [];
            }),
            obtenerTiposProducto().catch(() => [])
        ]);

        const rawFavs = extractList(favsRes);
        userFavoriteProducts = rawFavs.map(mapProduct).filter(Boolean);

        allTypes = extractList(typesRes).map(t => ({
            id: t.id,
            name: t.product_type_name || t.name || 'Tipo General'
        }));

        allCategories = [];

        // 4. Inicializar Filtros y Renderizar
        initFilters();

    } catch (err) {
        console.error('Error al inicializar favoritos:', err);
        showErrorToast('Error', 'No se pudieron cargar tus productos deseados.');
    }

    // 5. Delegación de eventos para Wishlist (Toggle Real) y Carrito
    document.addEventListener('click', async (e) => {
        // A. Desmarcar de lista de deseos
        const wishlistBtn = e.target.closest('.unified-wishlist-btn');
        if (wishlistBtn) {
            const id = wishlistBtn.getAttribute('data-id');
            if (!id) return;

            wishlistBtn.disabled = true;

            try {
                const res = await alternarFavoritoProducto(id);
                const isNowFavorite = res && typeof res.is_favorite === 'boolean' ? res.is_favorite : false;

                if (!isNowFavorite) {
                    // Remover de la lista local en memoria
                    userFavoriteProducts = userFavoriteProducts.filter(p => String(p.id) !== String(id));
                    
                    // Aplicar filtros de nuevo para refrescar la vista
                    const searchInput = document.getElementById('search-input');
                    const filterTypeSelect = document.getElementById('filter-type');
                    const filterCategorySelect = document.getElementById('filter-category');

                    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
                    const selectedType = filterTypeSelect ? filterTypeSelect.value : 'all';
                    const selectedCat = filterCategorySelect ? filterCategorySelect.value : 'all';

                    const filtered = userFavoriteProducts.filter(p => {
                        const matchesSearch = !query ||
                            (p.name && p.name.toLowerCase().includes(query)) ||
                            (p.description && p.description.toLowerCase().includes(query));

                        const matchesType = selectedType === 'all' ||
                            (p.typeId !== undefined && p.typeId.toString() === selectedType.toString());

                        const pCatIds = Array.isArray(p.categoryIds) ? p.categoryIds : (p.categoryId !== undefined ? [p.categoryId] : [1]);
                        const matchesCat = selectedCat === 'all' ||
                            pCatIds.some(catId => catId !== undefined && catId.toString() === selectedCat.toString());

                        return matchesSearch && matchesType && matchesCat;
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

        // B. Agregar al carrito
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
