import { initNavbar } from '../../components/navbar/navbar.js';
import { resolveImageUrl } from '../../js/api.js';
import { obtenerProductos, obtenerTiposProducto, alternarFavoritoProducto } from './product.api.js';
import { getAccessToken } from '../../js/storage.js';
import { showCartModal } from '../../components/cart-modal/cart-modal.js';
import { showSuccessToast, showInfoToast, showErrorToast } from '../../components/toast/toast.js';

/* ==========================================================================
   CARGA DE COMPONENTES ESTRUCTURALES
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

/* ==========================================================================
   LÓGICA DEL ENCABEZADO (Carrusel de Tipos de Producto)
   ========================================================================== */

function initHeaderCarousel(types) {
    const wrapper = document.getElementById('types-slides-wrapper');
    const dotsContainer = document.getElementById('types-carousel-dots');
    const prevBtn = document.getElementById('types-prev-btn');
    const nextBtn = document.getElementById('types-next-btn');

    if (!wrapper || !types || !types.length) return;

    wrapper.innerHTML = '';
    if (dotsContainer) dotsContainer.innerHTML = '';

    types.forEach((type, index) => {
        const slide = document.createElement('div');
        slide.className = `types-slide ${index === 0 ? 'active' : ''}`;
        slide.innerHTML = `
            <div class="type-info-side">
                <h1 class="type-title">${type.product_type_name}</h1>
                <p class="type-desc">${type.description || ''}</p>
                <a href="#filter-type" class="type-btn" data-type-id="${type.id}">Ver Productos de este Tipo</a>
            </div>
            <div class="type-image-side">
                <img src="${resolveImageUrl(type.product_type_image, '../../assets/images/categoria/estante.png')}" alt="${type.product_type_name}">
            </div>
        `;

        const typeBtn = slide.querySelector('.type-btn');
        if (typeBtn) {
            typeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const filterTypeSelect = document.getElementById('filter-type');
                if (filterTypeSelect) {
                    filterTypeSelect.value = String(type.id);
                    filterTypeSelect.dispatchEvent(new Event('change'));
                }
                const catalogContainer = document.getElementById('products-catalog-container');
                if (catalogContainer) {
                    catalogContainer.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
        wrapper.appendChild(slide);

        if (dotsContainer) {
            const dot = document.createElement('div');
            dot.className = `types-dot ${index === 0 ? 'active' : ''}`;
            dot.setAttribute('data-index', index);
            dot.addEventListener('click', () => goToSlide(index));
            dotsContainer.appendChild(dot);
        }
    });

    let currentSlide = 0;
    let timer = null;

    function goToSlide(index) {
        const slides = wrapper.querySelectorAll('.types-slide');
        const dots = dotsContainer ? dotsContainer.querySelectorAll('.types-dot') : [];

        if (index >= slides.length) index = 0;
        if (index < 0) index = slides.length - 1;

        slides[currentSlide]?.classList.remove('active');
        if (dots.length > currentSlide) dots[currentSlide]?.classList.remove('active');

        slides[index]?.classList.add('active');
        if (dots.length > index) dots[index]?.classList.add('active');

        currentSlide = index;
    }

    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    function prevSlide() {
        goToSlide(currentSlide - 1);
    }

    function startTimer() {
        stopTimer();
        timer = setInterval(nextSlide, 5000);
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startTimer(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startTimer(); });

    startTimer();
}

/* ==========================================================================
   LÓGICA DE FILTRADO Y BÚSQUEDA DEL CATÁLOGO
   ========================================================================== */

function initFilters(types, products) {
    const searchInput = document.getElementById('search-input');
    const filterTypeSelect = document.getElementById('filter-type');
    const filterOutletSelect = document.getElementById('filter-outlet');
    const filterFeaturedSelect = document.getElementById('filter-featured');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    if (filterTypeSelect) {
        filterTypeSelect.innerHTML = '<option value="all">Todos los Tipos</option>';
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = String(t.id);
            opt.textContent = t.product_type_name;
            filterTypeSelect.appendChild(opt);
        });
    }

    function applyFilters() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedType = filterTypeSelect ? filterTypeSelect.value : 'all';
        const selectedOutlet = filterOutletSelect ? filterOutletSelect.value : 'all';
        const isFeaturedOnly = filterFeaturedSelect ? (filterFeaturedSelect.value === 'featured') : false;

        let filtered = products.filter(p => {
            if (p.is_outlet && (!p.quantity || p.quantity <= 0)) {
                return false;
            }

            const matchesSearch = !query || 
                (p.product_name && p.product_name.toLowerCase().includes(query)) || 
                (p.description && p.description.toLowerCase().includes(query));
            
            const matchesType = selectedType === 'all' || String(p.product_type) === selectedType;
            
            let matchesOutlet = true;
            if (selectedOutlet === 'outlet') {
                matchesOutlet = Boolean(p.is_outlet);
            } else if (selectedOutlet === 'regular') {
                matchesOutlet = !p.is_outlet;
            }

            const matchesFeatured = !isFeaturedOnly || Boolean(p.is_feature_product);

            return matchesSearch && matchesType && matchesOutlet && matchesFeatured;
        });

        if (isFeaturedOnly) {
            filtered.sort((a, b) => (b.favorites_count || 0) - (a.favorites_count || 0) || b.id - a.id);
        } else {
            filtered.sort((a, b) => b.id - a.id);
        }

        renderUnifiedProducts(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterTypeSelect) filterTypeSelect.addEventListener('change', applyFilters);
    if (filterOutletSelect) filterOutletSelect.addEventListener('change', applyFilters);
    if (filterFeaturedSelect) filterFeaturedSelect.addEventListener('change', applyFilters);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterTypeSelect) filterTypeSelect.value = 'all';
            if (filterOutletSelect) filterOutletSelect.value = 'all';
            if (filterFeaturedSelect) filterFeaturedSelect.value = 'all';
            applyFilters();
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const paramSearch = urlParams.get('search') || urlParams.get('buscar') || urlParams.get('q') || '';
    const paramOutlet = urlParams.get('outlet') || urlParams.get('is_outlet');
    const paramType = urlParams.get('type') || urlParams.get('typeId');
    const paramFeatured = urlParams.get('featured') || urlParams.get('destacados');

    if (paramSearch && searchInput) {
        searchInput.value = paramSearch;
    }

    if (paramOutlet && filterOutletSelect && ['true', '1', 'yes', 'outlet'].includes(paramOutlet.toLowerCase())) {
        filterOutletSelect.value = 'outlet';
    }

    if (paramType && filterTypeSelect) {
        const matchOpt = Array.from(filterTypeSelect.options).find(o => 
            String(o.value) === String(paramType) || 
            o.textContent.toLowerCase().includes(paramType.toLowerCase())
        );
        if (matchOpt) filterTypeSelect.value = matchOpt.value;
    }

    if (paramFeatured && filterFeaturedSelect && ['true', '1', 'yes', 'si', 'featured'].includes(paramFeatured.toLowerCase())) {
        filterFeaturedSelect.value = 'featured';
    }

    applyFilters();
}

/* ==========================================================================
   RENDERIZADO DE TARJETAS
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
    const priceFormatted = parseFloat(p.price || 0).toFixed(2);

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
        <div class="unified-product-card">
            <div class="unified-card-media" style="position: relative;">
                <a href="product-details.html?id=${p.id}" class="unified-card-img-link">
                    <img src="${prodImg}" alt="${p.product_name}" class="unified-card-img" loading="lazy">
                </a>
                
                ${outletBadgeHTML}
                ${starBadgeHTML}
                
                <button class="unified-wishlist-btn ${p.is_favorite ? 'active' : ''}" data-id="${p.id}" title="${p.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos'}" aria-label="Añadir a favoritos">
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
                        <span class="unified-card-price">$${priceFormatted}</span>
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

function renderUnifiedProducts(products) {
    const catalogContainer = document.getElementById('products-catalog-container');
    if (!catalogContainer) return;

    if (!products || products.length === 0) {
        catalogContainer.innerHTML = `
            <div class="empty-results-box" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 60px 20px;">
                <div class="empty-results-icon" style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
                <h3 class="empty-results-title" style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 8px;">No se encontraron productos</h3>
                <p class="empty-results-desc" style="color: #64748b; font-size: 0.95rem;">Intenta ajustar tu búsqueda o presiona el botón "Limpiar Filtros" para ver todo el catálogo.</p>
            </div>
        `;
        return;
    }

    catalogContainer.innerHTML = products.map(p => createUnifiedCardHTML(p)).join('');
}

/* ==========================================================================
   INICIALIZACIÓN PRINCIPAL
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
        loadComponent('footer-placeholder', '../../components/footer/footer.html')
    ]);

    initNavbar();
    document.body.classList.add('drawer-collapsed');

    let products = [];
    let types = [];

    try {
        const [productsData, typesData] = await Promise.all([
            obtenerProductos(),
            obtenerTiposProducto()
        ]);
        products = Array.isArray(productsData) ? productsData : [];
        types = Array.isArray(typesData) ? typesData : [];
    } catch (err) {
        console.error('Error al conectar con el backend:', err);
    }

    initHeaderCarousel(types);
    initFilters(types, products);

    document.addEventListener('click', async (e) => {
        const wishlistBtn = e.target.closest('.unified-wishlist-btn');
        if (wishlistBtn) {
            const id = wishlistBtn.getAttribute('data-id');
            if (!id) return;

            if (!getAccessToken()) {
                showInfoToast('Inicia Sesión', 'Debes iniciar sesión para guardar productos en tu lista de deseos.');
                return;
            }

            wishlistBtn.disabled = true;
            try {
                const res = await alternarFavoritoProducto(id);
                if (res && typeof res.is_favorite === 'boolean') {
                    wishlistBtn.classList.toggle('active', res.is_favorite);
                    wishlistBtn.setAttribute('title', res.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos');
                    
                    const targetProd = products.find(prod => String(prod.id) === String(id));
                    if (targetProd) targetProd.is_favorite = res.is_favorite;

                    if (res.is_favorite) {
                        showSuccessToast('Lista de Deseos', res.message || 'Producto agregado a tus favoritos.');
                    } else {
                        showInfoToast('Lista de Deseos', res.message || 'Producto eliminado de tus favoritos.');
                    }
                }
            } catch (err) {
                console.error('Error al alternar favorito en catálogo:', err);
                showErrorToast('Error', 'No se pudo actualizar la lista de deseos.');
            } finally {
                wishlistBtn.disabled = false;
            }
            return;
        }

        const btn = e.target.closest('.btn-card-add-cart');
        if (btn) {
            const id = parseInt(btn.getAttribute('data-id'), 10);
            const name = btn.getAttribute('data-name');
            const price = parseFloat(btn.getAttribute('data-price')) || 0;
            const image = btn.getAttribute('data-image');

            const CART_STORAGE_KEY = 'tuestante_cart';
            let items = [];
            try {
                const raw = localStorage.getItem(CART_STORAGE_KEY);
                if (raw) items = JSON.parse(raw);
            } catch (err) {
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
