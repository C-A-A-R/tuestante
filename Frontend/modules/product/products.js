import { initNavbar } from '../../components/navbar/navbar.js';
import { obtenerProductos, obtenerTiposProducto, alternarFavoritoProducto } from './product.api.js';
import { backendOrigin } from '../../js/config.js';
import { getAccessToken } from '../../js/storage.js';
import { showCartModal } from '../../components/cart-modal/cart-modal.js';
import { showSuccessToast, showInfoToast, showErrorToast } from '../../components/toast/toast.js';

function resolveImageUrl(imagePath, fallback = '../../assets/images/productos/estante-blanco.jpeg') {
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
        const typeBtn = slide.querySelector('.type-btn');
        if (typeBtn) {
            typeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const filterTypeSelect = document.getElementById('filter-type');
                if (filterTypeSelect) {
                    filterTypeSelect.value = type.id;
                    const event = new Event('change');
                    filterTypeSelect.dispatchEvent(event);
                }
                const catalogContainer = document.getElementById('products-catalog-container');
                if (catalogContainer) {
                    catalogContainer.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
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
   LÓGICA DE FILTRADO Y BÚSQUEDA DEL CATÁLOGO
   ========================================================================== */

function initFilters(types, products) {
    const searchInput = document.getElementById('search-input');
    const filterTypeSelect = document.getElementById('filter-type');
    const filterOutletSelect = document.getElementById('filter-outlet');
    const filterFeaturedSelect = document.getElementById('filter-featured');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // 1. Llenar Select de Tipos
    if (filterTypeSelect) {
        filterTypeSelect.innerHTML = '<option value="all">Todos los Tipos</option>';
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            filterTypeSelect.appendChild(opt);
        });
    }

    // 2. Función principal de aplicación de filtros
    function applyFilters() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedType = filterTypeSelect ? filterTypeSelect.value : 'all';
        const selectedOutlet = filterOutletSelect ? filterOutletSelect.value : 'all';
        const isFeaturedOnly = filterFeaturedSelect ? (filterFeaturedSelect.value === 'featured') : false;

        let filtered = products.filter(p => {
            // Regla de negocio: Los clientes pueden visualizar todos los productos que tengan o no stock,
            // con excepción de los que son outlet y no tienen stock disponible (quantity <= 0).
            if (p.is_outlet && (!p.quantity || p.quantity <= 0)) {
                return false;
            }

            const matchesSearch = !query || 
                (p.name && p.name.toLowerCase().includes(query)) || 
                (p.description && p.description.toLowerCase().includes(query));
            
            const matchesType = selectedType === 'all' || 
                (p.typeId !== undefined && p.typeId.toString() === selectedType.toString());
            
            let matchesOutlet = true;
            if (selectedOutlet === 'outlet') {
                matchesOutlet = Boolean(p.is_outlet);
            } else if (selectedOutlet === 'regular') {
                matchesOutlet = !p.is_outlet;
            }

            // Filtro de destacados / más deseados
            const isFeaturedProduct = Boolean(
                p.badge === 'Destacado' || 
                p.is_feature_product || 
                (p.rating && p.rating >= 4.8) || 
                (p.favorites_count && p.favorites_count > 0)
            );
            const matchesFeatured = !isFeaturedOnly || isFeaturedProduct;

            return matchesSearch && matchesType && matchesOutlet && matchesFeatured;
        });

        // Ordenamiento prioritario
        if (isFeaturedOnly) {
            // Ordenar de más deseado/destacado a menos deseado
            filtered.sort((a, b) => {
                const aScore = (a.favorites_count || 0) + (a.badge === 'Destacado' || a.is_feature_product ? 100 : 0);
                const bScore = (b.favorites_count || 0) + (b.badge === 'Destacado' || b.is_feature_product ? 100 : 0);
                return bScore - aScore || b.id - a.id;
            });
        } else {
            // Orden predeterminado (por fecha / ID descendente)
            filtered.sort((a, b) => b.id - a.id);
        }

        renderUnifiedProducts(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterTypeSelect) filterTypeSelect.addEventListener('change', applyFilters);
    if (filterOutletSelect) filterOutletSelect.addEventListener('change', applyFilters);
    if (filterFeaturedSelect) filterFeaturedSelect.addEventListener('change', applyFilters);

    // Botón Limpiar Filtros
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterTypeSelect) filterTypeSelect.value = 'all';
            if (filterOutletSelect) filterOutletSelect.value = 'all';
            if (filterFeaturedSelect) filterFeaturedSelect.value = 'all';
            applyFilters();
        });
    }

    // Leer parámetros de URL (?search=..., ?buscar=..., ?outlet=..., ?type=..., ?featured=...)
    const urlParams = new URLSearchParams(window.location.search);
    const paramSearch = urlParams.get('search') || urlParams.get('buscar') || urlParams.get('q') || '';
    const paramOutlet = urlParams.get('outlet') || urlParams.get('is_outlet');
    const paramType = urlParams.get('type') || urlParams.get('typeId');
    const paramFeatured = urlParams.get('featured') || urlParams.get('destacados') || urlParams.get('most_favorited');

    if (paramSearch && searchInput) {
        searchInput.value = paramSearch;
    }

    if (paramOutlet && filterOutletSelect) {
        if (['true', '1', 'yes', 'outlet'].includes(paramOutlet.toLowerCase())) {
            filterOutletSelect.value = 'outlet';
        }
    }

    if (paramType && filterTypeSelect) {
        const matchOpt = Array.from(filterTypeSelect.options).find(o => 
            o.value.toString() === paramType.toString() || 
            o.textContent.toLowerCase().includes(paramType.toLowerCase())
        );
        if (matchOpt) {
            filterTypeSelect.value = matchOpt.value;
        }
    }

    if (paramFeatured && filterFeaturedSelect) {
        if (['true', '1', 'yes', 'si', 'featured'].includes(paramFeatured.toLowerCase())) {
            filterFeaturedSelect.value = 'featured';
        }
    }

    applyFilters();
}

/* ==========================================================================
   RENDERIZADO UNIFICADO DE PRODUCTOS (GRID MEZCLADO SIN CAJAS NI GRUPOS)
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

    const outletBadgeHTML = p.is_outlet ? `
        <div class="badge-outlet-flag" style="position: absolute; top: 12px; left: 12px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35); z-index: 3; display: flex; align-items: center; gap: 4px;">
            <span>⚡ OUTLET</span>
            ${p.quantity > 0 ? `<span style="background: rgba(0,0,0,0.25); padding: 1px 6px; border-radius: 10px; font-size: 0.68rem;">${p.quantity} disp.</span>` : ''}
        </div>
    ` : '';
    
    return `
        <div class="unified-product-card">
            <div class="unified-card-media" style="position: relative;">
                <a href="product-details.html?id=${p.id}" class="unified-card-img-link">
                    <img src="${p.image}" alt="${p.name}" class="unified-card-img">
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

function renderUnifiedProducts(products) {
    const catalogContainer = document.getElementById('products-catalog-container');
    const countNumberEl = document.getElementById('products-count-number');
    if (!catalogContainer) return;

    if (countNumberEl) {
        countNumberEl.textContent = products ? products.length : 0;
    }

    if (!products || products.length === 0) {
        catalogContainer.innerHTML = `
            <div class="empty-results-box" style="grid-column: 1 / -1; width: 100%;">
                <div class="empty-results-icon">🔍</div>
                <h3 class="empty-results-title">No se encontraron productos</h3>
                <p class="empty-results-desc">Intenta ajustar tu búsqueda o presiona el botón "Limpiar Filtros" para ver todo el catálogo.</p>
            </div>
        `;
        return;
    }

    catalogContainer.innerHTML = products.map(p => createUnifiedCardHTML(p)).join('');
}

/* ==========================================================================
   INICIALIZACIÓN DE COMPONENTES GLOBAL Y NAVEGACIÓN
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
        image: resolveImageUrl(t.product_type_image || t.image, '../../assets/images/categoria/estante.png')
    };
}

function mapProduct(p) {
    if (!p) return null;

    return {
        id: p.id,
        typeId: p.product_type || p.product_type_detail?.id || p.typeId || 1,
        typeName: p.product_type_detail?.product_type_name || p.typeName || 'General',
        name: p.product_name || p.name || 'Producto sin nombre',
        description: p.description || '',
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        rating: p.rating !== undefined ? parseFloat(p.rating) : (p.badge === 'Destacado' ? 5.0 : 4.5),
        image: resolveImageUrl(p.product_image || p.image, '../../assets/images/productos/estante-blanco.jpeg'),
        badge: (p.rating === 5.0 || p.badge === 'Destacado' || p.is_feature_product) ? 'Destacado' : '',
        is_active: p.is_active !== undefined ? Boolean(p.is_active) : true,
        is_outlet: Boolean(p.is_outlet),
        quantity: typeof p.quantity === 'number' ? p.quantity : parseInt(p.quantity, 10) || 0,
        is_favorite: Boolean(p.is_favorite),
        favorites_count: p.favorites_count || 0
    };
}

async function loadCatalogData() {
    let types = [];
    let products = [];

    try {
        const [productsRes, typesRes] = await Promise.all([
            obtenerProductos().catch(() => []),
            obtenerTiposProducto().catch(() => [])
        ]);

        const rawProducts = extractList(productsRes);
        const rawTypes = extractList(typesRes);

        if (rawProducts.length > 0) {
            products = rawProducts.map(mapProduct).filter(Boolean);
        }
        if (rawTypes.length > 0) {
            types = rawTypes.map(mapProductType).filter(Boolean);
        }
    } catch (err) {
        console.error('Error al obtener datos del backend:', err);
    }

    return { types, products };
}

export const LOCAL_5_PRODUCTS = [
    {
        id: 101,
        typeId: 1,
        typeName: 'Lockers',
        name: 'LOCKER METÁLICO EJECUTIVO L4',
        description: 'Locker metálico de 4 compartimentos con cerradura individual y ventilación reforzada.',
        price: 399.00,
        rating: 5.0,
        image: '../../assets/images/carrusel-index/LocekrL4Gris.jpg',
        badge: 'Destacado',
        is_outlet: true,
        quantity: 5
    },
    {
        id: 102,
        typeId: 2,
        typeName: 'Armarios',
        name: 'ARMARIO METÁLICO MODULAR VERDE',
        description: 'Armario metálico con puertas de cristal y estantes ajustables para almacenamiento.',
        price: 610.00,
        rating: 4.5,
        image: '../../assets/images/gallery/real_space_11.jpg',
        badge: '',
        is_outlet: false,
        quantity: 0
    },
    {
        id: 103,
        typeId: 1,
        typeName: 'Lockers',
        name: 'LOCKER GABINETE MODULAR M3',
        description: 'Locker gabinete modular compacto de 3 casilla para vestuarios y oficinas.',
        price: 280.00,
        rating: 4.8,
        image: '../../assets/images/gallery/real_space_1.jpg',
        badge: '',
        is_outlet: false,
        quantity: 0
    },
    {
        id: 104,
        typeId: 4,
        typeName: 'Estantes',
        name: 'ESTANTE INDUSTRIAL DE ALTA CARGA',
        description: 'Estantería metálica con 5 baldas de alta resistencia para depósitos y talleres.',
        price: 195.00,
        rating: 4.0,
        image: '../../assets/images/gallery/real_space_4.jpg',
        badge: '',
        is_outlet: true,
        quantity: 2
    },
    {
        id: 105,
        typeId: 3,
        typeName: 'Gabinetes',
        name: 'GABINETE ARCHIVADOR TURQUESA',
        description: 'Archivador metálico de carpeta suspendida en elegante color turquesa.',
        price: 320.00,
        rating: 5.0,
        image: '../../assets/images/gallery/real_space_9.jpg',
        badge: 'Destacado',
        is_outlet: false,
        quantity: 0
    }
];

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

    // 3. Cargar datos desde el backend (con fallback a los 5 productos locales)
    let { types, products } = await loadCatalogData();

    if (!products || products.length === 0) {
        products = LOCAL_5_PRODUCTS;
    }

    if (!types || types.length === 0) {
        types = [
            { id: 1, name: 'Lockers', description: 'Lockers metálicos de seguridad', image: '../../assets/images/carrusel-index/LocekrL4Gris.jpg' },
            { id: 2, name: 'Armarios', description: 'Armarios metálicos ejecutivos', image: '../../assets/images/gallery/real_space_11.jpg' },
            { id: 3, name: 'Gabinetes', description: 'Gabinetes y archivadores de oficina', image: '../../assets/images/gallery/real_space_1.jpg' },
            { id: 4, name: 'Estantes', description: 'Estanterías industriales reforzadas', image: '../../assets/images/gallery/real_space_4.jpg' }
        ];
    }

    initHeaderCarousel(types);
    initFilters(types, products);

    // Event listener delegado para wishlist y botones + Carrito
    document.addEventListener('click', async (e) => {
        const wishlistBtn = e.target.closest('.unified-wishlist-btn');
        if (wishlistBtn) {
            const id = wishlistBtn.getAttribute('data-id') || wishlistBtn.closest('.unified-product-card')?.querySelector('.btn-card-add-cart')?.getAttribute('data-id');
            if (!id) return;

            const token = getAccessToken();
            if (!token) {
                showInfoToast('Inicia Sesión', 'Debes iniciar sesión para guardar productos en tu lista de deseos.');
                return;
            }

            wishlistBtn.disabled = true;
            try {
                const res = await alternarFavoritoProducto(id);
                if (res && typeof res.is_favorite === 'boolean') {
                    wishlistBtn.classList.toggle('active', res.is_favorite);
                    wishlistBtn.setAttribute('title', res.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos');
                    
                    // Actualizar estado en array local
                    const targetProd = products.find(prod => String(prod.id) === String(id));
                    if (targetProd) {
                        targetProd.is_favorite = res.is_favorite;
                    }

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

