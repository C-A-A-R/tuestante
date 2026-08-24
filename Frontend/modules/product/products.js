import { initNavbar } from '../../components/navbar/navbar.js';
import { obtenerProductos, obtenerCategorias, obtenerTiposProducto, resolveImageUrl } from './product.api.js';



/* ==========================================================================
   LÓGICA DEL ENCABEZADO (Carrusel de Tipos de Producto)
   ========================================================================== */

function initHeaderCarousel(types) {
    const wrapper = document.getElementById('types-slides-wrapper');
    const dotsContainer = document.getElementById('types-carousel-dots');
    const prevBtn = document.getElementById('types-prev-btn');
    const nextBtn = document.getElementById('types-next-btn');

    if (!wrapper || !types || types.length === 0) return;

    wrapper.innerHTML = '';
    dotsContainer.innerHTML = '';

    types.forEach((type, index) => {
        // Generar Slide
        const slide = document.createElement('div');
        slide.className = `types-slide ${index === 0 ? 'active' : ''}`;
        slide.innerHTML = `
            <div class="type-info-side">
                <h1 class="type-title">${type.name}</h1>
                <p class="type-desc">${type.description}</p>
                <a href="#group-type-${type.id}" class="type-btn">Ver Productos de este Tipo</a>
            </div>
            <div class="type-image-side">
                <img src="${type.image}" alt="${type.name}">
            </div>
        `;
        wrapper.appendChild(slide);

        // Generar Dot
        const dot = document.createElement('div');
        dot.className = `types-dot ${index === 0 ? 'active' : ''}`;
        dot.setAttribute('data-index', index);
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });

    let currentSlide = 0;
    let timer = null;

    function goToSlide(index) {
        const slides = wrapper.querySelectorAll('.types-slide');
        const dots = dotsContainer.querySelectorAll('.types-dot');

        if (index >= slides.length) index = 0;
        if (index < 0) index = slides.length - 1;

        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');

        slides[index].classList.add('active');
        dots[index].classList.add('active');

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
   LÓGICA DE FILTRADO Y BÚSQUEDA
   ========================================================================== */

function initFilters(types, categories, products) {
    const searchInput = document.getElementById('search-input');
    const filterTypeSelect = document.getElementById('filter-type');
    const filterCategorySelect = document.getElementById('filter-category');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // Llenar Select de Tipos
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        filterTypeSelect.appendChild(opt);
    });

    // Llenar Select de Categorías
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        filterCategorySelect.appendChild(opt);
    });

    function applyFilters() {
        const query = searchInput.value.trim().toLowerCase();
        const selectedType = filterTypeSelect.value;
        const selectedCat = filterCategorySelect.value;

        const filtered = products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query);
            const matchesType = selectedType === 'all' || p.typeId.toString() === selectedType.toString();
            const matchesCat = selectedCat === 'all' || p.categoryIds.some(id => id.toString() === selectedCat.toString());

            return matchesSearch && matchesType && matchesCat;
        });

        renderGroupedProducts(types, filtered);
    }

    searchInput.addEventListener('input', applyFilters);
    filterTypeSelect.addEventListener('change', applyFilters);
    filterCategorySelect.addEventListener('change', applyFilters);

    // Botón de Limpiar Filtros
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            searchInput.value = '';
            filterTypeSelect.value = 'all';
            filterCategorySelect.value = 'all';
            applyFilters();
        });
    }

    // Leer parámetros de URL (?search=..., ?cat=..., ?type=...)
    const urlParams = new URLSearchParams(window.location.search);
    const paramSearch = urlParams.get('search') || urlParams.get('q') || '';
    const paramCat = urlParams.get('cat');
    const paramType = urlParams.get('type');

    if (paramSearch && searchInput) {
        searchInput.value = paramSearch;
    }

    if (paramCat && filterCategorySelect) {
        const hasOption = Array.from(filterCategorySelect.options).some(o => o.value.toString() === paramCat.toString());
        if (hasOption) {
            filterCategorySelect.value = paramCat;
        }
    }

    if (paramType && filterTypeSelect) {
        const hasOption = Array.from(filterTypeSelect.options).some(o => o.value.toString() === paramType.toString());
        if (hasOption) {
            filterTypeSelect.value = paramType;
        }
    }

    // Ejecutar filtrado inicial respetando parámetros de URL o mostrando todo por defecto
    applyFilters();
}

/* ==========================================================================
   LÓGICA DEL LISTADO DE PRODUCTOS (Carruseles en 2 Filas por Tipo)
   ========================================================================== */

function renderGroupedProducts(types, products) {
    const catalogContainer = document.getElementById('products-catalog-container');
    if (!catalogContainer) return;

    catalogContainer.innerHTML = '';

    // Filtrar sólo los tipos que tengan productos tras la búsqueda/filtro
    const activeTypes = types.filter(type => products.some(p => p.typeId === type.id));

    if (activeTypes.length === 0) {
        catalogContainer.innerHTML = `
            <div class="empty-results-box">
                <div class="empty-results-icon">🔍</div>
                <h3 class="empty-results-title">No se encontraron productos</h3>
                <p class="empty-results-desc">Intenta ajustar tu búsqueda o presiona el botón "Limpiar Filtros" para ver todo el catálogo.</p>
            </div>
        `;
        return;
    }

    activeTypes.forEach(type => {
        const typeProducts = products.filter(p => p.typeId === type.id);

        const groupSection = document.createElement('div');
        groupSection.className = 'product-type-group';
        groupSection.id = `group-type-${type.id}`;

        groupSection.innerHTML = `
            <div class="group-header">
                <div class="group-title-box">
                    <h2 class="group-title">${type.name}</h2>
                    <p class="group-subtitle">${type.description}</p>
                </div>
                <span class="group-counter">${typeProducts.length} producto(s)</span>
            </div>

            <div class="product-carousel-wrapper">
                <button class="carousel-nav-btn prev-btn" aria-label="Anterior">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <button class="carousel-nav-btn next-btn" aria-label="Siguiente">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>

                <div class="product-carousel-viewport">
                    <div class="product-grid-track"></div>
                </div>
            </div>
        `;

        catalogContainer.appendChild(groupSection);

        // Configurar carrusel interactivo circular continuo con pausa al estar hover
        setupTwoRowCarousel(groupSection, typeProducts);
    });
}

/**
 * Configura la lógica del carrusel interactivo continuo (infinito) con desplazamiento continuo hacia adelante y pausa en hover.
 * @param {HTMLElement} groupSection Elemento contenedor de la sección del tipo
 * @param {Array} typeProducts Lista de productos de este tipo
 */
function setupTwoRowCarousel(groupSection, typeProducts) {
    const track = groupSection.querySelector('.product-grid-track');
    const viewport = groupSection.querySelector('.product-carousel-viewport');
    const prevBtn = groupSection.querySelector('.prev-btn');
    const nextBtn = groupSection.querySelector('.next-btn');

    if (!track || !viewport || !typeProducts || typeProducts.length === 0) return;

    let autoTimer = null;
    const slideDuration = 3000;
    let isTransitioning = false;

    function getVisibleCols() {
        const width = window.innerWidth;
        if (width <= 600) return 1;
        if (width <= 960) return 2;
        return 3;
    }

    const itemsPerRow = 3; // 3 productos por fila en escritorio

    function getCardPos(index, colOffset = 0) {
        const b = Math.floor(index / (2 * itemsPerRow));
        const pos = index % (2 * itemsPerRow);
        const row = pos < itemsPerRow ? 1 : 2;
        const col = (b * itemsPerRow) + (pos % itemsPerRow) + 1 + colOffset;
        return { row, col };
    }

    let totalCols = 0;
    typeProducts.forEach((_, idx) => {
        const pos = getCardPos(idx);
        if (pos.col > totalCols) totalCols = pos.col;
    });

    const visibleCols = getVisibleCols();
    const isInfinite = totalCols > visibleCols;

    function createCardHTML(p, row, col) {
        return `
            <div class="catalog-product-card" style="grid-row: ${row}; grid-column: ${col};">
                <a href="product-details.html?id=${p.id}" class="catalog-product-img-wrapper">
                    <div class="badge-destacado-star" title="Producto Destacado">
                        <svg class="star-icon" viewBox="0 0 24 24" fill="#94A3B8" stroke="#64748B" stroke-width="1.5">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        <span class="star-label">Producto Destacado</span>
                    </div>
                    <img src="${p.image}" alt="${p.name}" class="catalog-product-img">
                </a>
                <div class="catalog-product-body">
                    <div>
                        <h3 class="catalog-product-name">
                            <a href="product-details.html?id=${p.id}" style="color: inherit; text-decoration: none;">${p.name}</a>
                        </h3>
                        <p class="catalog-product-desc">${p.description}</p>
                    </div>
                    <div class="catalog-product-footer">
                        <span class="catalog-product-price">$${p.price.toFixed(2)}</span>
                        <a href="product-details.html?id=${p.id}" class="catalog-product-btn">Ver Detalle</a>
                    </div>
                </div>
            </div>
        `;
    }

    const cloneCount = Math.max(visibleCols, 3);
    let htmlContent = '';

    if (isInfinite) {
        // Clones al inicio (de las últimas columnas)
        typeProducts.forEach((p, idx) => {
            const pos = getCardPos(idx);
            if (pos.col > totalCols - cloneCount) {
                const cloneCol = pos.col - totalCols;
                htmlContent += createCardHTML(p, pos.row, cloneCol);
            }
        });

        // Productos reales
        typeProducts.forEach((p, idx) => {
            const pos = getCardPos(idx);
            htmlContent += createCardHTML(p, pos.row, pos.col);
        });

        // Clones al final (de las primeras columnas)
        typeProducts.forEach((p, idx) => {
            const pos = getCardPos(idx);
            if (pos.col <= cloneCount) {
                const cloneCol = pos.col + totalCols;
                htmlContent += createCardHTML(p, pos.row, cloneCol);
            }
        });
    } else {
        typeProducts.forEach((p, idx) => {
            const pos = getCardPos(idx);
            htmlContent += createCardHTML(p, pos.row, pos.col);
        });
    }

    track.innerHTML = htmlContent;

    let currentCol = 0;

    function getColOffsetPixels(colIndex) {
        const vCols = getVisibleCols();
        const gap = 20;
        const viewportWidth = viewport.clientWidth;
        const colWidth = (viewportWidth - (vCols - 1) * gap) / vCols;

        if (isInfinite) {
            return (colIndex + cloneCount) * (colWidth + gap);
        } else {
            return colIndex * (colWidth + gap);
        }
    }

    function updatePosition(animate = true) {
        const offset = getColOffsetPixels(currentCol);
        if (animate) {
            track.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
        } else {
            track.style.transition = 'none';
        }
        track.style.transform = `translateX(-${offset}px)`;

        if (!isInfinite) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        } else {
            if (prevBtn) prevBtn.style.display = 'flex';
            if (nextBtn) nextBtn.style.display = 'flex';
        }
    }

    function slideNext() {
        if (!isInfinite || isTransitioning) return;
        isTransitioning = true;
        currentCol++;
        updatePosition(true);

        setTimeout(() => {
            if (currentCol >= totalCols) {
                currentCol = 0;
                updatePosition(false);
            }
            isTransitioning = false;
        }, 500);
    }

    function slidePrev() {
        if (!isInfinite || isTransitioning) return;
        isTransitioning = true;
        currentCol--;
        updatePosition(true);

        setTimeout(() => {
            if (currentCol < 0) {
                currentCol = totalCols - 1;
                updatePosition(false);
            }
            isTransitioning = false;
        }, 500);
    }

    function startAutoSlide() {
        if (!isInfinite) return;
        stopAutoSlide();
        autoTimer = setInterval(slideNext, slideDuration);
    }

    function stopAutoSlide() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            slidePrev();
            startAutoSlide();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            slideNext();
            startAutoSlide();
        });
    }

    viewport.addEventListener('mouseenter', stopAutoSlide);
    viewport.addEventListener('mouseleave', startAutoSlide);

    window.addEventListener('resize', () => {
        updatePosition(false);
    });

    updatePosition(false);
    startAutoSlide();
}

/* ==========================================================================
   INICIALIZACIÓN DE COMPONENTES GLOBAL Y NAVEGACIÓN
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

function extractList(apiResult) {
    if (!apiResult) return [];
    if (Array.isArray(apiResult)) return apiResult;
    if (Array.isArray(apiResult.results)) return apiResult.results;
    return [];
}

function mapProductType(t) {
    if (!t) return null;
    return {
        id: t.id,
        name: t.product_type_name || t.name || 'Tipo General',
        description: t.description || '',
        image: resolveImageUrl(t.product_type_image || t.image, '../../assets/images/carrusel-index/Carrousel.png')
    };
}

function mapCategory(c) {
    if (!c) return null;
    return {
        id: c.id,
        name: c.category_name || c.name || 'Categoría General',
        description: c.description || '',
        image: resolveImageUrl(c.category_image || c.image, '../../assets/images/carrusel-index/Carrousel.png')
    };
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
        allCategoryNames: categoryNames.join(', '),
        name: p.product_name || p.name || 'Producto sin nombre',
        description: p.description || '',
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        image: resolveImageUrl(p.product_image || p.image, '../../assets/images/gallery/real_space_1.jpg'),
        badge: p.is_feature_product ? 'Destacado' : (p.badge || '')
    };
}

async function loadCatalogData() {
    let types = [];
    let categories = [];
    let products = [];

    try {
        const response = await obtenerProductos({ include_categories_and_types: 'true' });

        let rawProducts = [];
        let rawCategories = [];
        let rawTypes = [];

        if (response && response.products) {
            rawProducts = extractList(response.products);
            rawCategories = extractList(response.categories);
            rawTypes = extractList(response.product_types);
        } else {
            rawProducts = extractList(response);
            const [catsRes, typesRes] = await Promise.all([
                obtenerCategorias().catch(() => []),
                obtenerTiposProducto().catch(() => [])
            ]);
            rawCategories = extractList(catsRes);
            rawTypes = extractList(typesRes);
        }

        if (rawProducts.length > 0) {
            products = rawProducts.map(mapProduct).filter(Boolean);
        }
        if (rawCategories.length > 0) {
            categories = rawCategories.map(mapCategory).filter(Boolean);
        }
        if (rawTypes.length > 0) {
            types = rawTypes.map(mapProductType).filter(Boolean);
        }
    } catch (err) {
        console.error('Error al obtener datos del backend:', err);
    }

    return { types, categories, products };
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Navbar y Footer
    await Promise.all([
        loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
        loadComponent('footer-placeholder', '../../components/footer/footer.html')
    ]);

    // 2. Inicializar lógica del Navbar
    initNavbar();

    // Ajuste de layout de footer
    document.body.classList.add('drawer-collapsed');

    // 3. Cargar datos desde el backend (con fallback dummy)
    const { types, categories, products } = await loadCatalogData();

    initHeaderCarousel(types);
    initFilters(types, categories, products);
});

