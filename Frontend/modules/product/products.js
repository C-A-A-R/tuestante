import { initNavbar } from '../../components/navbar/navbar.js';
import { resolveImageUrl, extractList } from '../../js/api.js';
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
        const cleanHtml = html
            .replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, '')
            .replace(/<\/body>/gi, '');
        const container = document.getElementById(placeholderId);
        if (container) container.innerHTML = cleanHtml;
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

function normalizeText(text) {
    if (!text) return '';
    return text.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function initFilters(types, products) {
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const filterTypeSelect = document.getElementById('filter-type');
    const filterOutletSelect = document.getElementById('filter-outlet');
    const filterFeaturedSelect = document.getElementById('filter-featured');
    const filterSortSelect = document.getElementById('filter-sort');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const resultsCountBadge = document.getElementById('filter-results-badge');
    const chipsContainer = document.getElementById('active-filter-chips');

    // Poblar el selector de tipos de producto dinámicamente
    if (filterTypeSelect) {
        filterTypeSelect.innerHTML = '<option value="all">Todos los Tipos</option>';
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = String(t.id);
            opt.textContent = t.product_type_name;
            filterTypeSelect.appendChild(opt);
        });
    }

    function updateStatusAndChips(filteredCount, totalCount, activeFilters) {
        if (resultsCountBadge) {
            if (filteredCount === 0) {
                resultsCountBadge.innerHTML = 'No se encontraron productos';
            } else if (filteredCount === 1) {
                resultsCountBadge.innerHTML = 'Mostrando <strong>1</strong> producto';
            } else if (filteredCount === totalCount) {
                resultsCountBadge.innerHTML = `Mostrando todos los <strong>${totalCount}</strong> productos`;
            } else {
                resultsCountBadge.innerHTML = `Mostrando <strong>${filteredCount}</strong> de ${totalCount} productos`;
            }
        }

        if (chipsContainer) {
            chipsContainer.innerHTML = '';
            activeFilters.forEach(chip => {
                const chipEl = document.createElement('div');
                chipEl.className = 'filter-chip';
                chipEl.innerHTML = `
                    <span>${chip.label}</span>
                    <button type="button" class="filter-chip-remove" aria-label="Remover filtro ${chip.label}" title="Quitar este filtro">&times;</button>
                `;
                chipEl.querySelector('.filter-chip-remove').addEventListener('click', () => {
                    chip.onRemove();
                });
                chipsContainer.appendChild(chipEl);
            });
        }
    }

    function updateUrlParams(query, selectedType, selectedOutlet, isFeaturedOnly, selectedSort) {
        const url = new URL(window.location);
        if (query) url.searchParams.set('search', query); else url.searchParams.delete('search');
        if (selectedType !== 'all') url.searchParams.set('type', selectedType); else url.searchParams.delete('type');
        if (selectedOutlet !== 'all') url.searchParams.set('outlet', selectedOutlet); else url.searchParams.delete('outlet');
        if (isFeaturedOnly) url.searchParams.set('featured', 'true'); else url.searchParams.delete('featured');
        if (selectedSort !== 'default') url.searchParams.set('sort', selectedSort); else url.searchParams.delete('sort');
        
        window.history.replaceState({}, '', url.toString());
    }

    function applyFilters(updateUrl = true) {
        const rawQuery = searchInput ? searchInput.value.trim() : '';
        const normQuery = normalizeText(rawQuery);
        const queryTerms = normQuery.split(/\s+/).filter(Boolean);
        const selectedType = filterTypeSelect ? filterTypeSelect.value : 'all';
        const selectedOutlet = filterOutletSelect ? filterOutletSelect.value : 'all';
        const isFeaturedOnly = filterFeaturedSelect ? (filterFeaturedSelect.value === 'featured') : false;
        const selectedSort = filterSortSelect ? filterSortSelect.value : 'default';

        if (searchClearBtn) {
            searchClearBtn.style.display = rawQuery ? 'flex' : 'none';
        }

        const activeFilters = [];

        if (rawQuery) {
            activeFilters.push({
                label: `Búsqueda: "${rawQuery}"`,
                onRemove: () => {
                    if (searchInput) searchInput.value = '';
                    if (searchClearBtn) searchClearBtn.style.display = 'none';
                    applyFilters();
                }
            });
        }

        if (selectedType !== 'all') {
            const selectedOpt = filterTypeSelect ? filterTypeSelect.options[filterTypeSelect.selectedIndex] : null;
            activeFilters.push({
                label: `Tipo: ${selectedOpt ? selectedOpt.textContent : selectedType}`,
                onRemove: () => {
                    if (filterTypeSelect) filterTypeSelect.value = 'all';
                    applyFilters();
                }
            });
        }

        if (selectedOutlet === 'outlet') {
            activeFilters.push({
                label: '⚡ Solo Outlet',
                onRemove: () => {
                    if (filterOutletSelect) filterOutletSelect.value = 'all';
                    applyFilters();
                }
            });
        } else if (selectedOutlet === 'regular') {
            activeFilters.push({
                label: '📦 Catálogo Estándar',
                onRemove: () => {
                    if (filterOutletSelect) filterOutletSelect.value = 'all';
                    applyFilters();
                }
            });
        }

        if (isFeaturedOnly) {
            activeFilters.push({
                label: '⭐ Más Deseados',
                onRemove: () => {
                    if (filterFeaturedSelect) filterFeaturedSelect.value = 'all';
                    applyFilters();
                }
            });
        }

        if (selectedSort !== 'default') {
            const sortOpt = filterSortSelect ? filterSortSelect.options[filterSortSelect.selectedIndex] : null;
            activeFilters.push({
                label: `Orden: ${sortOpt ? sortOpt.textContent : selectedSort}`,
                onRemove: () => {
                    if (filterSortSelect) filterSortSelect.value = 'default';
                    applyFilters();
                }
            });
        }

        let filtered = products.filter(p => {
            // Regla de negocio de la plataforma: Productos outlet sin cantidad disponible (<= 0) no se muestran
            if (p.is_outlet && (p.quantity !== undefined && p.quantity !== null && Number(p.quantity) <= 0)) {
                return false;
            }

            // Búsqueda multi-palabra insensible a mayúsculas y acentos
            let matchesSearch = true;
            if (queryTerms.length > 0) {
                const nameNorm = normalizeText(p.product_name);
                const descNorm = normalizeText(p.description);
                const typeNameNorm = normalizeText(p.product_type_detail?.product_type_name);
                const colorsNorm = Array.isArray(p.color_images)
                    ? p.color_images.map(c => normalizeText(c.color_name)).join(' ')
                    : '';
                const fullSearchTarget = `${nameNorm} ${descNorm} ${typeNameNorm} ${colorsNorm}`;

                matchesSearch = queryTerms.every(term => fullSearchTarget.includes(term));
            }

            // Coincidencia de tipo de producto robusta (soporta IDs u objetos anidados)
            let matchesType = true;
            if (selectedType !== 'all') {
                const pTypeId = p.product_type?.id || p.product_type || p.product_type_detail?.id;
                matchesType = String(pTypeId) === String(selectedType);
            }

            // Filtro por Outlet / Catálogo Regular
            let matchesOutlet = true;
            if (selectedOutlet === 'outlet') {
                matchesOutlet = Boolean(p.is_outlet);
            } else if (selectedOutlet === 'regular') {
                matchesOutlet = !p.is_outlet;
            }

            // Filtro por Destacados / Más Deseados
            const matchesFeatured = !isFeaturedOnly || Boolean(p.is_feature_product);

            return matchesSearch && matchesType && matchesOutlet && matchesFeatured;
        });

        // Ordenamiento del catálogo
        filtered.sort((a, b) => {
            if (selectedSort === 'price-asc') {
                return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
            }
            if (selectedSort === 'price-desc') {
                return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
            }
            if (selectedSort === 'popular') {
                return (b.favorites_count || 0) - (a.favorites_count || 0) || b.id - a.id;
            }
            if (selectedSort === 'name-asc') {
                return (a.product_name || '').localeCompare(b.product_name || '', 'es', { sensitivity: 'base' });
            }

            // Orden por defecto: si es filtro destacado, priorizar popularidad; si no, los más recientes
            if (isFeaturedOnly) {
                return (b.favorites_count || 0) - (a.favorites_count || 0) || b.id - a.id;
            }
            return b.id - a.id;
        });

        renderUnifiedProducts(filtered);
        updateStatusAndChips(filtered.length, products.length, activeFilters);

        if (updateUrl) {
            updateUrlParams(rawQuery, selectedType, selectedOutlet, isFeaturedOnly, selectedSort);
        }
    }

    // Debounce para la entrada de búsqueda de texto
    let searchDebounceTimer = null;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchClearBtn) {
                searchClearBtn.style.display = searchInput.value.trim() ? 'flex' : 'none';
            }
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => applyFilters(true), 120);
        });
    }

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchClearBtn.style.display = 'none';
                searchInput.focus();
                applyFilters(true);
            }
        });
    }

    if (filterTypeSelect) filterTypeSelect.addEventListener('change', () => applyFilters(true));
    if (filterOutletSelect) filterOutletSelect.addEventListener('change', () => applyFilters(true));
    if (filterFeaturedSelect) filterFeaturedSelect.addEventListener('change', () => applyFilters(true));
    if (filterSortSelect) filterSortSelect.addEventListener('change', () => applyFilters(true));

    function resetFilters() {
        if (searchInput) searchInput.value = '';
        if (searchClearBtn) searchClearBtn.style.display = 'none';
        if (filterTypeSelect) filterTypeSelect.value = 'all';
        if (filterOutletSelect) filterOutletSelect.value = 'all';
        if (filterFeaturedSelect) filterFeaturedSelect.value = 'all';
        if (filterSortSelect) filterSortSelect.value = 'default';
        applyFilters(true);
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', resetFilters);
    }

    // Exponer resetFilters globalmente para el botón del estado vacío
    window.__tuestante_reset_product_filters = resetFilters;

    // Sincronizar filtros a partir de los parámetros de la URL
    function syncFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const paramSearch = urlParams.get('search') || urlParams.get('buscar') || urlParams.get('q') || '';
        const paramOutlet = urlParams.get('outlet') || urlParams.get('is_outlet');
        const paramType = urlParams.get('type') || urlParams.get('typeId') || urlParams.get('tipo');
        const paramFeatured = urlParams.get('featured') || urlParams.get('destacados');
        const paramSort = urlParams.get('sort') || urlParams.get('orden');

        if (paramSearch && searchInput) {
            searchInput.value = paramSearch;
            if (searchClearBtn) searchClearBtn.style.display = 'flex';
        }

        if (paramOutlet && filterOutletSelect) {
            if (['true', '1', 'yes', 'outlet'].includes(paramOutlet.toLowerCase())) {
                filterOutletSelect.value = 'outlet';
            } else if (['regular', 'no_outlet', 'false', '0'].includes(paramOutlet.toLowerCase())) {
                filterOutletSelect.value = 'regular';
            } else {
                filterOutletSelect.value = 'all';
            }
        }

        if (paramType && filterTypeSelect) {
            const matchOpt = Array.from(filterTypeSelect.options).find(o => 
                String(o.value) === String(paramType) || 
                normalizeText(o.textContent) === normalizeText(paramType) ||
                normalizeText(o.textContent).includes(normalizeText(paramType))
            );
            if (matchOpt) filterTypeSelect.value = matchOpt.value;
        }

        if (paramFeatured && filterFeaturedSelect && ['true', '1', 'yes', 'si', 'featured'].includes(paramFeatured.toLowerCase())) {
            filterFeaturedSelect.value = 'featured';
        }

        if (paramSort && filterSortSelect) {
            if (Array.from(filterSortSelect.options).some(o => o.value === paramSort)) {
                filterSortSelect.value = paramSort;
            }
        }

        applyFilters(false);
    }

    syncFromUrl();

    // Responder a la navegación del historial del navegador (Atrás/Adelante)
    window.addEventListener('popstate', syncFromUrl);
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
                <p class="empty-results-desc" style="color: #64748b; font-size: 0.95rem; max-width: 500px; margin: 0 auto 16px;">No encontramos ningún producto que coincida con tus criterios de búsqueda o filtros seleccionados.</p>
                <button type="button" class="btn-clear-empty-state" id="empty-clear-filters-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l6.73-6.19"></path>
                    </svg>
                    Restablecer Filtros
                </button>
            </div>
        `;
        const emptyBtn = document.getElementById('empty-clear-filters-btn');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => {
                if (typeof window.__tuestante_reset_product_filters === 'function') {
                    window.__tuestante_reset_product_filters();
                }
            });
        }
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
        products = extractList(productsData);
        types = extractList(typesData);
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
