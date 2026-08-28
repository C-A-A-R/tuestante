import { initNavbar } from '../../components/navbar/navbar.js';
import { obtenerProductoPorId, obtenerProductos, alternarFavoritoProducto } from './product.api.js';
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
   CARGA DE COMPONENTES DE ESTRUCTURA (Navbar y Footer)
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
        console.error(`Error al cargar ${filePath}:`, error);
    }
}

/* ==========================================================================
   INICIALIZACIÓN PRINCIPAL
   ========================================================================== */

const DEFAULT_COLOR_PALETTE = [
    { name: 'Amarillo Sol', hex: '#FACC15', isLight: true },
    { name: 'Verde Lima', hex: '#84CC16' },
    { name: 'Verde Esmeralda', hex: '#16A34A' },
    { name: 'Verde Turquesa', hex: '#0D9488' },
    { name: 'Azul Rey', hex: '#0284C7' },
    { name: 'Azul Cobalto', hex: '#2563EB' },
    { name: 'Morado Real', hex: '#7C3AED' },
    { name: 'Magenta Fucsia', hex: '#C026D3' },
    { name: 'Rojo Carmín', hex: '#DC2626' },
    { name: 'Naranja Intenso', hex: '#EA580C' },
    { name: 'Naranja Cálido', hex: '#F59E0B' },
    { name: 'Amarillo Dorado', hex: '#FBBF24', isLight: true },
    { name: 'Gris Industrial', hex: '#64748b' },
    { name: 'Blanco Ostra', hex: '#f8fafc', isLight: true },
    { name: 'Negro Mate', hex: '#1e293b' }
];

function isColorLight(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return false;
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length !== 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 180;
}

function mapProduct(p) {
    if (!p) return null;

    const mainImage = resolveImageUrl(p.product_image || p.image, '../../assets/images/productos/estante-blanco.jpeg');

    let categoryIds = [];
    if (Array.isArray(p.categories) && p.categories.length > 0) {
        categoryIds = p.categories.map(c => (typeof c === 'object' && c !== null ? c.id : c));
    } else if (Array.isArray(p.categories_detail) && p.categories_detail.length > 0) {
        categoryIds = p.categories_detail.map(c => c.id);
    } else if (p.category || p.category_detail?.id || p.categoryId) {
        categoryIds = [p.category || p.category_detail?.id || p.categoryId];
    }

    let categories = [];
    if (Array.isArray(p.categories_detail) && p.categories_detail.length > 0) {
        categories = p.categories_detail.map(c => ({ id: c.id, name: c.category_name || c.name }));
    } else if (p.category_detail?.category_name || p.categoryName) {
        categories = [{ id: categoryIds[0] || 1, name: p.category_detail?.category_name || p.categoryName }];
    } else {
        categories = [{ id: 1, name: 'General' }];
    }

    const primaryColorOption = {
        name: 'Color Primario',
        hex: '#005187',
        image: mainImage,
        color_image: mainImage,
        isLight: false,
        isPrimary: true
    };

    const rawColorImages = Array.isArray(p.color_images) && p.color_images.length > 0
        ? p.color_images
        : (Array.isArray(p.images) ? p.images : (Array.isArray(p.product_image_set) ? p.product_image_set : []));

    let colors = [primaryColorOption];
    if (rawColorImages.length > 0) {
        rawColorImages.forEach((imgObj, idx) => {
            const colorHex = imgObj.color_hex || '#005187';
            const colorName = imgObj.color_name || (imgObj.color_hex ? `Color ${imgObj.color_hex}` : `Color ${idx + 1}`);
            const colorImg = resolveImageUrl(imgObj.color_image || imgObj.image, mainImage);
            colors.push({
                name: colorName,
                hex: colorHex,
                image: colorImg,
                color_image: colorImg,
                isLight: isColorLight(colorHex),
                isPrimary: false
            });
        });
    }

    let angles = [];
    const rawAngleImages = Array.isArray(p.angle_images) ? p.angle_images : [];
    if (rawAngleImages.length > 0) {
        rawAngleImages.forEach((imgObj, idx) => {
            const angleImg = resolveImageUrl(imgObj.image, mainImage);
            angles.push({
                id: imgObj.id || idx,
                image: angleImg,
                angle: imgObj.angle || `Ángulo ${idx + 1}`,
                order: imgObj.order !== undefined ? imgObj.order : idx
            });
        });
        angles.sort((a, b) => a.order - b.order);
    }

    return {
        id: p.id,
        typeId: p.product_type || p.product_type_detail?.id || p.typeId || 1,
        typeName: p.product_type_detail?.product_type_name || p.typeName || 'General',
        categoryIds: categoryIds,
        categoryId: categoryIds[0] || 1,
        categories: categories,
        categoryName: categories[0]?.name || 'General',
        name: p.product_name || p.name || 'Producto sin nombre',
        description: p.description || '',
        fullDescription: p.fullDescription || p.description || '',
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        image: mainImage,
        video: resolveImageUrl(p.product_video || p.video, null),
        heightCm: p.height_cm !== undefined ? parseFloat(p.height_cm) : (p.heightCm || 0),
        lengthCm: p.depth_cm !== undefined ? parseFloat(p.depth_cm) : (p.lengthCm || 0),
        widthCm: p.width_cm !== undefined ? parseFloat(p.width_cm) : (p.widthCm || 0),
        security: p.security || '',
        badge: p.is_feature_product ? 'Destacado' : (p.badge || ''),
        is_favorite: Boolean(p.is_favorite),
        favorites_count: p.favorites_count || 0,
        colors: colors,
        angles: angles
    };
}

const LOCAL_5_PRODUCTS = [
    {
        id: 101,
        typeId: 1,
        typeName: 'Lockers',
        categoryId: 1,
        categoryName: 'Lockers Metálicos',
        name: 'LOCKER METÁLICO EJECUTIVO L4',
        description: 'Locker metálico de 4 compartimentos con cerradura individual y ventilación reforzada.',
        fullDescription: 'Locker metálico de alta resistencia fabricado en lámina de acero de 0.8mm con recubrimiento en pintura electrostática gris industrial. Ideal para vestuarios, empresas y gimnasios.',
        price: 399.00,
        image: '../../assets/images/carrusel-index/LocekrL4Gris.jpg',
        heightCm: 180,
        lengthCm: 90,
        widthCm: 45,
        security: 'Cerradura de cilindro con 2 llaves por casilla',
        badge: 'Destacado'
    },
    {
        id: 102,
        typeId: 2,
        typeName: 'Armarios',
        categoryId: 2,
        categoryName: 'Armarios Metálicos',
        name: 'ARMARIO METÁLICO MODULAR VERDE',
        description: 'Armario metálico con puertas de cristal y estantes ajustables para almacenamiento.',
        fullDescription: 'Armario metálico multifuncional estilo vintage-industrial en acabado verde menta. Incluye 4 niveles de estantería interna regulables y cerradura centralizada.',
        price: 610.00,
        image: '../../assets/images/gallery/real_space_11.jpg',
        heightCm: 190,
        lengthCm: 100,
        widthCm: 50,
        security: 'Cerradura de falleba de 3 puntos',
        badge: 'Destacado'
    },
    {
        id: 103,
        typeId: 3,
        typeName: 'Gabinetes',
        categoryId: 3,
        categoryName: 'Gabinetes de Oficina',
        name: 'GABINETE ORGANIZADOR COMPACTO',
        description: 'Gabinete organizador compacto de 4 cajones para oficina y hogar.',
        fullDescription: 'Gabinete metálico moderno en tono rosado pastel para oficinas creativas y del hogar. Dispone de correderas telescópicas con apertura suave y alta capacidad de carga.',
        price: 280.00,
        image: '../../assets/images/gallery/real_space_1.jpg',
        heightCm: 110,
        lengthCm: 80,
        widthCm: 40,
        security: 'Cerradura llave maestra única',
        badge: ''
    },
    {
        id: 104,
        typeId: 4,
        typeName: 'Estantes',
        categoryId: 4,
        categoryName: 'Estanterías Industriales',
        name: 'ESTANTE INDUSTRIAL DE ALTA CARGA',
        description: 'Estantería metálica con 5 baldas de alta resistencia para depósitos y talleres.',
        fullDescription: 'Estantería metálica reforzada capaz de soportar hasta 250kg por bandeja. Ensamblado sin tornillos por sistema de encaje a presión con acabado anti-corrosión.',
        price: 195.00,
        image: '../../assets/images/gallery/real_space_4.jpg',
        heightCm: 200,
        lengthCm: 120,
        widthCm: 60,
        security: 'Estructura auto-portante con anclaje a pared',
        badge: ''
    },
    {
        id: 105,
        typeId: 3,
        typeName: 'Gabinetes',
        categoryId: 3,
        categoryName: 'Gabinetes de Oficina',
        name: 'GABINETE ARCHIVADOR TURQUESA',
        description: 'Archivador metálico de carpeta suspendida en elegante color turquesa.',
        fullDescription: 'Archivador ejecutivo de 4 gavetas para carpetas oficio y carta. Sistema anti-vuelco de seguridad que permite la apertura de una sola gaveta a la vez.',
        price: 320.00,
        image: '../../assets/images/gallery/real_space_9.jpg',
        heightCm: 135,
        lengthCm: 50,
        widthCm: 65,
        security: 'Cerradura central anti-vuelco',
        badge: ''
    }
];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Navbar y Footer
    await Promise.all([
        loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
        loadComponent('footer-placeholder', '../../components/footer/footer.html')
    ]);

    // 2. Inicializar Comportamiento de Navbar
    initNavbar();
    document.body.classList.add('drawer-collapsed');

    // 3. Obtener el ID del producto de los parámetros de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    let product = null;
    let allProducts = [];

    if (productId) {
        try {
            const rawProd = await obtenerProductoPorId(productId);
            if (rawProd) {
                product = mapProduct(rawProd?.product || rawProd);
            }
        } catch (err) {
            console.error(`Error al obtener el producto ${productId} desde el backend:`, err);
        }

        if (!product) {
            const localMatch = LOCAL_5_PRODUCTS.find(p => String(p.id) === String(productId));
            if (localMatch) {
                product = mapProduct(localMatch);
            }
        }
    }

    // Intentar obtener listado de productos para relacionales
    try {
        const rawListRes = await obtenerProductos();
        const listData = Array.isArray(rawListRes)
            ? rawListRes
            : (Array.isArray(rawListRes?.results) ? rawListRes.results : (Array.isArray(rawListRes?.products) ? rawListRes.products : []));
        if (listData.length > 0) {
            allProducts = listData.map(mapProduct).filter(Boolean);
        }
    } catch (err) {
        // Fallback silencioso a productos locales cuando el backend no está disponible
        allProducts = [];
    }

    if (!allProducts || allProducts.length === 0) {
        allProducts = LOCAL_5_PRODUCTS.map(mapProduct).filter(Boolean);
    }

    if (product) {
        // Poblar datos en la pantalla de detalle
        populateProductDetails(product);
        initImageInteractions(product);
        renderRelatedProducts(product, allProducts);
    } else {
        const detailContainer = document.querySelector('.product-details-container') || document.querySelector('main');
        if (detailContainer) {
            detailContainer.innerHTML = `
                <div class="empty-results-box" style="padding: 60px 20px; text-align: center;">
                    <div class="empty-results-icon" style="font-size: 3rem;">🔍</div>
                    <h3 class="empty-results-title">Producto no encontrado</h3>
                    <p class="empty-results-desc">El producto solicitado no existe o no se encuentra disponible actualmente.</p>
                    <a href="products.html" class="type-btn" style="display: inline-block; margin-top: 20px; text-decoration: none;">Volver al Catálogo</a>
                </div>
            `;
        }
    }
});


/**
 * Poblar todos los datos del producto en la vista.
 */
function populateProductDetails(product) {
    // Estrella "Producto Destacado" (Solo visible si el producto es efectivamente un producto destacado)
    const starBadgeEl = document.getElementById('badge-destacado-star');
    const isFeatured = !!(product.badge === 'Destacado' || product.is_feature_product || product.isFeatured);
    if (starBadgeEl) {
        starBadgeEl.style.display = isFeatured ? 'inline-flex' : 'none';
    }

    // Imagen principal
    const imgEl = document.getElementById('detail-product-img');
    if (imgEl) {
        imgEl.src = product.image;
        imgEl.alt = product.name;
    }

    // Imagen en Pantalla Espejo de Lupa
    const mirrorImgEl = document.getElementById('zoom-mirror-img');
    if (mirrorImgEl) {
        mirrorImgEl.src = product.image;
        mirrorImgEl.alt = product.name;
    }

    // Esquina: Tipo de Producto (Pill badge en mayúsculas)
    const typeCornerEl = document.getElementById('detail-product-type');
    if (typeCornerEl) {
        typeCornerEl.textContent = (product.typeName || 'General').toUpperCase();
    }

    // Breadcrumbs
    const bcTypeLink = document.getElementById('breadcrumb-type-link');
    if (bcTypeLink) {
        bcTypeLink.href = `products.html?type=${encodeURIComponent(product.typeId || '')}`;
    }

    const bcTypeEl = document.getElementById('breadcrumb-type');
    if (bcTypeEl) bcTypeEl.textContent = product.typeName || 'Productos';

    const bcProdEl = document.getElementById('breadcrumb-product');
    if (bcProdEl) bcProdEl.textContent = product.name;

    // Nombre
    const nameEl = document.getElementById('detail-product-name');
    if (nameEl) nameEl.textContent = product.name;

    const priceEl = document.getElementById('detail-product-price');
    if (priceEl) priceEl.textContent = `$${product.price.toFixed(2)}`;

    // Renderizar Barra Lateral de Miniaturas (Ángulos + Video)
    renderProductThumbnails(product);

    // Renderizar Sección de Colores Disponibles
    renderProductColors(product);

    // Descripción Completa
    const descEl = document.getElementById('detail-product-desc');
    if (descEl) descEl.textContent = product.fullDescription || product.description;

    // Especificaciones Técnicas (Alto, Largo, Ancho en cm, Seguridad)
    const heightEl = document.getElementById('detail-spec-height');
    if (heightEl) heightEl.textContent = `${product.heightCm || 180} cm`;

    const lengthEl = document.getElementById('detail-spec-length');
    if (lengthEl) lengthEl.textContent = `${product.lengthCm || 90} cm`;

    const widthEl = document.getElementById('detail-spec-width');
    if (widthEl) widthEl.textContent = `${product.widthCm || 45} cm`;

    // Manejo de la Seguridad: Mostrar siempre el tipo de seguridad disponible
    const secContainer = document.getElementById('detail-spec-security-container');
    const secEl = document.getElementById('detail-spec-security');
    const securityVal = (product.security && product.security.trim() !== '')
        ? product.security
        : 'Porta candado / Llave individual';
    if (secContainer) secContainer.style.display = 'flex';
    if (secEl) secEl.textContent = securityVal;

    // Actualizar título de la página
    document.title = `${product.name} - TuEstante`;

    // Conectar botón Agregar al Carrito (Utiliza la misma estructura e identificación data-* que en catálogo)
    const btnAddCart = document.getElementById('btn-add-to-cart');
    if (btnAddCart) {
        btnAddCart.setAttribute('data-id', product.id);
        btnAddCart.setAttribute('data-name', product.name);
        btnAddCart.setAttribute('data-price', product.price);
        btnAddCart.setAttribute('data-image', product.image);

        btnAddCart.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            const id = parseInt(btnAddCart.getAttribute('data-id'), 10) || product.id;
            const name = btnAddCart.getAttribute('data-name') || product.name;
            const price = parseFloat(btnAddCart.getAttribute('data-price')) || product.price || 0;
            const image = btnAddCart.getAttribute('data-image') || product.image;

            let selectedColor = 'Bisley Orange';
            const activeSwatch = document.querySelector('.color-swatch-btn.active');
            if (activeSwatch) {
                const colorTitle = activeSwatch.getAttribute('title') || activeSwatch.getAttribute('data-color-name');
                if (colorTitle) selectedColor = colorTitle;
            }

            const qtyInput = document.getElementById('detail-qty-input');
            const addQty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;

            const CART_STORAGE_KEY = 'tuestante_cart';
            let items = [];
            try {
                const raw = localStorage.getItem(CART_STORAGE_KEY);
                if (raw) items = JSON.parse(raw);
            } catch (e) {
                items = [];
            }

            const existingIndex = items.findIndex(i => String(i.id) === String(id) && i.color === selectedColor);
            if (existingIndex > -1) {
                items[existingIndex].qty += addQty;
            } else {
                items.push({ id, name, price, image, color: selectedColor, qty: addQty });
            }
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
            window.dispatchEvent(new Event('cart-updated'));

            showCartModal({ id, name, price, image });
        };
    }

    // Conectar botón Lista de Deseos
    const btnWishlist = document.getElementById('btn-detail-wishlist');
    if (btnWishlist) {
        btnWishlist.classList.toggle('active', Boolean(product.is_favorite));
        btnWishlist.setAttribute('title', product.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos');

        btnWishlist.onclick = async (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            const token = getAccessToken();
            if (!token) {
                showInfoToast('Inicia Sesión', 'Debes iniciar sesión para guardar productos en tu lista de deseos.');
                return;
            }

            btnWishlist.disabled = true;
            try {
                const res = await alternarFavoritoProducto(product.id);
                if (res && typeof res.is_favorite === 'boolean') {
                    product.is_favorite = res.is_favorite;
                    btnWishlist.classList.toggle('active', res.is_favorite);
                    btnWishlist.setAttribute('title', res.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos');

                    if (res.is_favorite) {
                        showSuccessToast('Lista de Deseos', res.message || 'Producto agregado a tus favoritos.');
                    } else {
                        showInfoToast('Lista de Deseos', res.message || 'Producto eliminado de tus favoritos.');
                    }
                }
            } catch (err) {
                console.error('Error al alternar favorito en detalle:', err);
                showErrorToast('Error', 'No se pudo actualizar la lista de deseos.');
            } finally {
                btnWishlist.disabled = false;
            }
        };
    }

    // Configuración del campo e incrementadores de cantidad (Máximo 4 dígitos = 9999)
    const qtyMinus = document.getElementById('qty-minus');
    const qtyPlus = document.getElementById('qty-plus');
    const qtyInput = document.getElementById('detail-qty-input');

    if (qtyInput) {
        // Bloquear caracteres no numéricos como 'e', '+', '-', '.'
        qtyInput.addEventListener('keydown', (e) => {
            if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                e.preventDefault();
            }
        });

        // Limitar en tiempo real a máximo 4 dígitos
        qtyInput.addEventListener('input', () => {
            if (qtyInput.value.length > 4) {
                qtyInput.value = qtyInput.value.slice(0, 4);
            }
        });

        // Validar y normalizar al perder foco o cambiar (rango: 1 - 9999)
        qtyInput.addEventListener('blur', () => {
            let val = parseInt(qtyInput.value, 10);
            if (isNaN(val) || val < 1) {
                qtyInput.value = 1;
            } else if (val > 9999) {
                qtyInput.value = 9999;
            } else {
                qtyInput.value = val;
            }
        });

        qtyInput.addEventListener('change', () => {
            let val = parseInt(qtyInput.value, 10);
            if (isNaN(val) || val < 1) {
                qtyInput.value = 1;
            } else if (val > 9999) {
                qtyInput.value = 9999;
            } else {
                qtyInput.value = val;
            }
        });
    }

    if (qtyMinus && qtyInput) {
        qtyMinus.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            let val = parseInt(qtyInput.value, 10) || 1;
            if (val > 1) {
                qtyInput.value = val - 1;
            }
        };
    }
    if (qtyPlus && qtyInput) {
        qtyPlus.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            let val = parseInt(qtyInput.value, 10) || 1;
            if (val < 9999) {
                qtyInput.value = val + 1;
            }
        };
    }
}

/**
 * Renderiza la barra lateral de miniaturas de imágenes por ángulo y botón de video.
 */
function renderProductThumbnails(product) {
    const sidebarEl = document.getElementById('product-thumbnails-sidebar');
    if (!sidebarEl) return;

    const hasVideo = !!(product && product.video && String(product.video).trim() !== '');

    sidebarEl.style.display = 'flex';

    const EXISTING_GALLERY_IMAGES = [
        '../../assets/images/gallery/real_space_1.jpg',
        '../../assets/images/gallery/real_space_2.jpg',
        '../../assets/images/gallery/real_space_3.jpg',
        '../../assets/images/gallery/real_space_4.jpg',
        '../../assets/images/gallery/real_space_5.jpg',
        '../../assets/images/gallery/real_space_6.jpg',
        '../../assets/images/gallery/real_space_7.jpg',
        '../../assets/images/gallery/real_space_8.jpg',
        '../../assets/images/gallery/real_space_9.jpg',
        '../../assets/images/gallery/real_space_10.jpg',
        '../../assets/images/gallery/real_space_11.jpg'
    ];

    const pId = parseInt(product.id, 10) || 1;
    const secondImg = EXISTING_GALLERY_IMAGES[(pId + 1) % EXISTING_GALLERY_IMAGES.length];
    const thirdImg = EXISTING_GALLERY_IMAGES[(pId + 3) % EXISTING_GALLERY_IMAGES.length];

    // Construir lista de 3 miniaturas distintas utilizando imágenes existentes del proyecto
    let thumbnailItems = [];

    // 1. Imagen Principal del Producto
    thumbnailItems.push({
        url: product.image,
        title: `Vista Frontal - ${product.name}`,
        active: true
    });

    // 2. Segunda Vista (Imagen de Galería Existente 1)
    thumbnailItems.push({
        url: (product.angles && product.angles[0]?.image) || secondImg,
        title: `Vista Lateral - ${product.name}`,
        active: false
    });

    // 3. Tercera Vista (Imagen de Galería Existente 2)
    thumbnailItems.push({
        url: (product.angles && product.angles[1]?.image) || thirdImg,
        title: `Vista Ambientada - ${product.name}`,
        active: false
    });

    let html = '';
    thumbnailItems.forEach((item, idx) => {
        html += `
            <button type="button" 
                    class="thumbnail-btn ${idx === 0 ? 'active' : ''}" 
                    data-image-url="${item.url}"
                    data-title="${item.title}"
                    title="${item.title}"
                    aria-label="${item.title}">
                <img src="${item.url}" alt="${item.title}">
            </button>
        `;
    });

    // 3. Botón/Icono de Video en la lista de miniaturas
    if (hasVideo) {
        html += `
            <button type="button" 
                    class="thumbnail-btn video-thumbnail-btn" 
                    data-video-url="${product.video}" 
                    title="Ver Video del Producto"
                    aria-label="Ver Video del Producto">
                <img src="../../assets/icons/camara-de-video.png" alt="Video del Producto" class="video-thumb-icon">
            </button>
        `;
    }

    sidebarEl.innerHTML = html;

    const mainImgEl = document.getElementById('detail-product-img');
    const mainVideoEl = document.getElementById('detail-product-video');
    const mirrorImgEl = document.getElementById('zoom-mirror-img');
    const lightboxImgEl = document.getElementById('lightbox-img');
    const lightboxVideoEl = document.getElementById('lightbox-video');
    const selectedNameEl = document.getElementById('selected-color-name');

    sidebarEl.querySelectorAll('.thumbnail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sidebarEl.querySelectorAll('.thumbnail-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (btn.classList.contains('video-thumbnail-btn')) {
                const videoUrl = btn.getAttribute('data-video-url');
                if (selectedNameEl) selectedNameEl.textContent = 'Video del Producto';

                if (mainImgEl) mainImgEl.style.display = 'none';
                if (mainVideoEl) {
                    mainVideoEl.src = videoUrl;
                    mainVideoEl.style.display = 'block';
                    mainVideoEl.play().catch(() => { });
                }

                const lensBox = document.getElementById('zoom-lens-box');
                const mirrorPanel = document.getElementById('zoom-mirror-panel');
                if (lensBox) lensBox.classList.remove('active');
                if (mirrorPanel) mirrorPanel.classList.remove('active');

                if (lightboxImgEl) lightboxImgEl.style.display = 'none';
                if (lightboxVideoEl) {
                    lightboxVideoEl.src = videoUrl;
                    lightboxVideoEl.style.display = 'block';
                }
            } else {
                const newImgUrl = btn.getAttribute('data-image-url');
                const title = btn.getAttribute('data-title');

                if (mainVideoEl) {
                    mainVideoEl.pause();
                    mainVideoEl.style.display = 'none';
                }

                if (mainImgEl && newImgUrl) {
                    mainImgEl.src = newImgUrl;
                    mainImgEl.alt = title || product.name;
                    mainImgEl.style.display = 'block';
                }

                if (mirrorImgEl && newImgUrl) {
                    mirrorImgEl.src = newImgUrl;
                    mirrorImgEl.alt = title || product.name;
                }

                if (lightboxVideoEl) {
                    lightboxVideoEl.pause();
                    lightboxVideoEl.style.display = 'none';
                }
                if (lightboxImgEl && newImgUrl) {
                    lightboxImgEl.src = newImgUrl;
                    lightboxImgEl.style.display = 'block';
                }
            }
        });
    });
}

/**
 * Renderiza la lista interactiva de colores disponibles.
 */
function renderProductColors(product) {
    const swatchListEl = document.getElementById('colors-swatch-list');
    const selectedNameEl = document.getElementById('selected-color-name');
    if (!swatchListEl) return;

    const DEFAULT_SWATCHES = [
        { name: 'Slate Dark', hex: '#334155', image: product.image },
        { name: 'Negro Mate', hex: '#1e293b', image: product.image },
        { name: 'Bisley Orange', hex: '#EA580C', image: product.image, isPrimary: true },
        { name: 'Verde Oliva', hex: '#556b2f', image: product.image },
        { name: 'Azul Rey', hex: '#3b82f6', image: product.image },
        { name: 'Gris Claro', hex: '#cbd5e1', image: product.image },
        { name: 'Rosa Pastel', hex: '#fda4af', image: product.image },
        { name: 'Amarillo Mostaza', hex: '#d97706', image: product.image },
        { name: 'Blanco Ostra', hex: '#ffffff', isLight: true, image: product.image },
        { name: 'Beige Cálido', hex: '#d4a373', image: product.image },
        { name: 'Verde Azulado', hex: '#0f4c5c', image: product.image }
    ];

    const colors = product.colors && product.colors.length > 1
        ? product.colors
        : DEFAULT_SWATCHES;

    // Buscar color primario o activo por defecto (Bisley Orange)
    const initialIndex = colors.findIndex(c => c.isPrimary || c.name.includes('Orange') || c.name.includes('Naranja'));
    const defaultIdx = initialIndex > -1 ? initialIndex : 0;

    if (selectedNameEl) {
        selectedNameEl.textContent = colors[defaultIdx].name;
    }

    let html = '';
    colors.forEach((color, idx) => {
        const activeClass = idx === defaultIdx ? 'active' : '';
        const lightClass = color.isLight ? 'is-light' : '';
        const primaryClass = color.isPrimary ? 'is-primary' : '';
        const colorImgUrl = color.color_image || color.image || product.image;
        html += `
            <button type="button" 
                    class="color-swatch-btn ${activeClass} ${lightClass} ${primaryClass}" 
                    style="background-color: ${color.hex};" 
                    data-color-name="${color.name}"
                    data-color-image="${colorImgUrl}"
                    title="${color.name}"
                    aria-label="${color.name}">
            </button>
        `;
    });

    swatchListEl.innerHTML = html;

    const mainImgEl = document.getElementById('detail-product-img');
    const mainVideoEl = document.getElementById('detail-product-video');
    const mirrorImgEl = document.getElementById('zoom-mirror-img');
    const lightboxImgEl = document.getElementById('lightbox-img');
    const lightboxVideoEl = document.getElementById('lightbox-video');

    swatchListEl.querySelectorAll('.color-swatch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            swatchListEl.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const name = btn.getAttribute('data-color-name');
            const newImage = btn.getAttribute('data-color-image');

            if (selectedNameEl) selectedNameEl.textContent = name;

            // Desactivar estado activo en miniaturas de lateral izquierdo para evitar conflicto visual
            const sidebarEl = document.getElementById('product-thumbnails-sidebar');
            if (sidebarEl) {
                sidebarEl.querySelectorAll('.thumbnail-btn').forEach(b => b.classList.remove('active'));
            }

            // Pausar y ocultar el video si estaba activo, mostrar la imagen principal
            if (mainVideoEl) {
                mainVideoEl.pause();
                mainVideoEl.style.display = 'none';
            }
            if (mainImgEl && newImage) {
                mainImgEl.src = newImage;
                mainImgEl.alt = `${product.name} - ${name}`;
                mainImgEl.style.display = 'block';
            }

            // Cambiar la imagen en el panel espejo de la lupa
            if (newImage && mirrorImgEl) {
                mirrorImgEl.src = newImage;
                mirrorImgEl.alt = `${product.name} - ${name}`;
            }

            // Cambiar la imagen en el modal lightbox
            if (lightboxVideoEl) {
                lightboxVideoEl.pause();
                lightboxVideoEl.style.display = 'none';
            }
            if (newImage && lightboxImgEl) {
                lightboxImgEl.src = newImage;
                lightboxImgEl.style.display = 'block';
            }
        });
    });
}

/**
 * Inicializar Lupa Espejo (Acotada a la sección inferior de descripción/especificaciones) y Lightbox Modal.
 */
function initImageInteractions(product) {
    const mainImgContainer = document.getElementById('main-image-container');
    const mainImg = document.getElementById('detail-product-img');
    const mainVideo = document.getElementById('detail-product-video');
    const lensBox = document.getElementById('zoom-lens-box');
    const galleryCard = document.querySelector('.product-gallery-card');

    const mirrorPanel = document.getElementById('zoom-mirror-panel');
    const mirrorImg = document.getElementById('zoom-mirror-img');
    const toggleLupaBtn = document.getElementById('toggle-lupa-btn');
    const lupaBtnText = document.getElementById('lupa-btn-text');

    // Lightbox Modal Elements
    const modal = document.getElementById('image-lightbox-modal');
    const modalImg = document.getElementById('lightbox-img');
    const modalVideo = document.getElementById('lightbox-video');
    const closeBtn = document.getElementById('lightbox-close');
    const overlay = document.getElementById('lightbox-overlay');

    // Estado de la Lupa (True por defecto)
    let isLupaActive = true;

    function updateLupaBtnUI() {
        if (!toggleLupaBtn) return;
        if (isLupaActive) {
            toggleLupaBtn.classList.add('active');
            if (lupaBtnText) lupaBtnText.textContent = 'Lupa: ACTIVADA';
        } else {
            toggleLupaBtn.classList.remove('active');
            if (lupaBtnText) lupaBtnText.textContent = 'Lupa: DESACTIVADA';
            if (lensBox) lensBox.classList.remove('active');
            if (mirrorPanel) mirrorPanel.classList.remove('active');
        }
    }

    // 1. Botón Único Encender / Apagar Lupa
    if (toggleLupaBtn) {
        toggleLupaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isLupaActive = !isLupaActive;
            updateLupaBtnUI();
        });
    }

    // 2. Movimiento de Lupa y Proyección Espejo en el Área Inferior (Descripción y Especificaciones)
    if (mainImgContainer && mainImg && lensBox && mirrorPanel && mirrorImg) {
        mainImgContainer.addEventListener('mouseenter', () => {
            const isVideoVisible = mainVideo && mainVideo.style.display !== 'none';
            if (isLupaActive && !isVideoVisible) {
                lensBox.classList.add('active');
                mirrorPanel.classList.add('active');
            }
        });

        mainImgContainer.addEventListener('mousemove', (e) => {
            const isVideoVisible = mainVideo && mainVideo.style.display !== 'none';
            if (!isLupaActive || isVideoVisible) {
                if (lensBox) lensBox.classList.remove('active');
                if (mirrorPanel) mirrorPanel.classList.remove('active');
                return;
            }

            const containerRect = mainImgContainer.getBoundingClientRect();
            const imgRect = mainImg.getBoundingClientRect();

            // Dimensiones y límites de la imagen real dentro del contenedor
            const imgLeft = imgRect.left - containerRect.left;
            const imgTop = imgRect.top - containerRect.top;
            const imgW = imgRect.width || 1;
            const imgH = imgRect.height || 1;

            const lensW = lensBox.offsetWidth || 150;
            const lensH = lensBox.offsetHeight || 150;

            // Posición del cursor en el contenedor
            const containerX = e.clientX - containerRect.left;
            const containerY = e.clientY - containerRect.top;

            // Mantener la lente dentro de la imagen del producto
            let lensX = containerX - lensW / 2;
            let lensY = containerY - lensH / 2;

            if (lensX < imgLeft) lensX = imgLeft;
            if (lensY < imgTop) lensY = imgTop;
            if (lensX > imgLeft + imgW - lensW) lensX = imgLeft + imgW - lensW;
            if (lensY > imgTop + imgH - lensH) lensY = imgTop + imgH - lensH;

            lensBox.style.left = `${lensX}px`;
            lensBox.style.top = `${lensY}px`;

            // Centro exacto del recuadro azul de la lente sobre la imagen
            const lensCenterX = (lensX + lensW / 2) - imgLeft;
            const lensCenterY = (lensY + lensH / 2) - imgTop;

            const ratioX = Math.max(0, Math.min(1, lensCenterX / imgW));
            const ratioY = Math.max(0, Math.min(1, lensCenterY / imgH));

            // Dimensiones del visor espejo
            const viewport = mirrorImg.parentElement;
            const viewW = viewport ? viewport.clientWidth : 500;
            const viewH = viewport ? viewport.clientHeight : 500;

            const scale = 2.5;

            // Ajustar imagen espejo al tamaño de la imagen original
            mirrorImg.style.width = `${imgW}px`;
            mirrorImg.style.height = `${imgH}px`;

            // Traslación exacta para que el punto central de la lente quede en el centro del visor
            const targetX = ratioX * imgW * scale;
            const targetY = ratioY * imgH * scale;

            const tx = (viewW / 2) - targetX;
            const ty = (viewH / 2) - targetY;

            mirrorImg.style.transformOrigin = '0 0';
            mirrorImg.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
        });

        mainImgContainer.addEventListener('mouseleave', () => {
            const isVideoVisible = mainVideo && mainVideo.style.display !== 'none';
            if (isLupaActive && !isVideoVisible) {
                lensBox.classList.remove('active');
                mirrorPanel.classList.remove('active');
            }
        });
    }

    // 3. Ventana Flotante (Lightbox Modal) al hacer clic en la imagen o video
    function openLightbox() {
        if (!modal) return;
        const isVideoVisible = mainVideo && mainVideo.style.display !== 'none';
        if (isVideoVisible && modalVideo && product.video) {
            if (modalImg) modalImg.style.display = 'none';
            modalVideo.src = product.video;
            modalVideo.style.display = 'block';
            modalVideo.play().catch(() => { });
        } else if (modalImg) {
            if (modalVideo) {
                modalVideo.pause();
                modalVideo.style.display = 'none';
            }
            modalImg.src = mainImg ? mainImg.src : product.image;
            modalImg.alt = product.name;
            modalImg.style.display = 'block';
        }
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        if (!modal) return;
        if (modalVideo) modalVideo.pause();
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    if (galleryCard) {
        galleryCard.addEventListener('click', (e) => {
            // Evitar abrir modal si hace clic en miniaturas laterales, botones de color, encender/apagar lupa, estrella o controles de video
            if (
                e.target.closest('#product-thumbnails-sidebar') ||
                e.target.closest('#colors-swatch-list') ||
                e.target.closest('.color-swatch-btn') ||
                e.target.closest('.thumbnail-btn') ||
                e.target.closest('#toggle-lupa-btn') ||
                e.target.closest('.badge-destacado-star') ||
                e.target.closest('video')
            ) return;
            openLightbox();
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (overlay) overlay.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeLightbox();
        }
    });

    updateLupaBtnUI();
}

/**
 * Renderiza el carrusel de productos relacionados del mismo tipo (EN 1 SOLA FILA).
 */
function renderRelatedProducts(currentProduct, allProducts = []) {
    const section = document.querySelector('.related-products-section');
    const track = document.getElementById('related-grid-track');
    const viewport = document.getElementById('related-carousel-viewport');
    const prevBtn = document.getElementById('related-prev-btn');
    const nextBtn = document.getElementById('related-next-btn');

    if (!track || !viewport) {
        if (section) section.style.display = 'none';
        return;
    }

    const sourceList = Array.isArray(allProducts) ? allProducts : [];

    // Obtener productos del mismo tipo omitiendo el producto actual
    const currentTypeId = currentProduct?.typeId || currentProduct?.product_type || currentProduct?.product_type_detail?.id;
    const currentProdId = currentProduct?.id;

    let relatedProducts = [];
    if (currentTypeId !== undefined && currentTypeId !== null) {
        relatedProducts = sourceList.filter(p => {
            const pTypeId = p.typeId || p.product_type || p.product_type_detail?.id;
            return String(pTypeId) === String(currentTypeId) && String(p.id) !== String(currentProdId);
        });
    }

    // Si NO existen productos del mismo tipo, no mostrar el carrusel
    if (!relatedProducts || relatedProducts.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    // Si existen productos, asegurarse de que la sección sea visible
    if (section) section.style.display = 'block';

    const totalCols = relatedProducts.length;

    function getVisibleCols() {
        const width = window.innerWidth;
        if (width <= 480) return 1;
        if (width <= 768) return 2;
        if (width <= 1100) return 3;
        return 4;
    }

    function getGapPixels() {
        const width = window.innerWidth;
        if (width <= 480) return 12;
        if (width <= 768) return 16;
        if (width <= 1100) return 20;
        return 20;
    }

    const visibleCols = getVisibleCols();
    const isInfinite = totalCols > visibleCols;

    function createCardHTML(p, col) {
        const isFeatured = !!(p.rating === 5.0 || p.badge === 'Destacado' || p.is_feature_product !== false);
        const starBadgeHTML = isFeatured ? `
            <div class="badge-destacado-star" title="Producto Destacado">
                <svg class="star-icon" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span class="star-label">Producto Destacado</span>
            </div>
        ` : '';

        return `
            <div class="unified-product-card" style="grid-row: 1; grid-column: ${col}; height: 100%;">
                <div class="unified-card-media">
                    <a href="product-details.html?id=${p.id}" class="unified-card-img-link">
                        <img src="${p.image}" alt="${p.name}" class="unified-card-img">
                    </a>
                    
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
                            <span class="unified-card-price">$${parseFloat(p.price || 0).toFixed(2)}</span>
                        </div>

                        <p class="unified-card-desc">${p.description || ''}</p>

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

    const cloneCount = Math.max(visibleCols, 3);
    let htmlContent = '';

    if (isInfinite) {
        relatedProducts.forEach((p, idx) => {
            const col = idx + 1;
            if (col > totalCols - cloneCount) {
                const cloneCol = col - totalCols;
                htmlContent += createCardHTML(p, cloneCol);
            }
        });

        relatedProducts.forEach((p, idx) => {
            const col = idx + 1;
            htmlContent += createCardHTML(p, col);
        });

        relatedProducts.forEach((p, idx) => {
            const col = idx + 1;
            if (col <= cloneCount) {
                const cloneCol = col + totalCols;
                htmlContent += createCardHTML(p, cloneCol);
            }
        });
    } else {
        relatedProducts.forEach((p, idx) => {
            const col = idx + 1;
            htmlContent += createCardHTML(p, col);
        });
    }

    track.innerHTML = htmlContent;

    let currentCol = 0;
    let isTransitioning = false;
    let autoTimer = null;

    function getColOffsetPixels(colIndex) {
        const vCols = getVisibleCols();
        const gap = getGapPixels();
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
        autoTimer = setInterval(slideNext, 3000);
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

    // Eventos para botones de tarjetas relacionadas (+ Carrito y Lista de Deseos)
    track.addEventListener('click', async (e) => {
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

                    if (res.is_favorite) {
                        showSuccessToast('Lista de Deseos', res.message || 'Producto agregado a tus favoritos.');
                    } else {
                        showInfoToast('Lista de Deseos', res.message || 'Producto eliminado de tus favoritos.');
                    }
                }
            } catch (err) {
                console.error('Error al alternar favorito en productos relacionados:', err);
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
}
