import { initNavbar } from '../../components/navbar/navbar.js';
import { obtenerProductoPorId, obtenerProductos, resolveImageUrl } from './product.api.js';



/* ==========================================================================
   CARGA DE COMPONENTES DE ESTRUCTURA (Navbar y Footer)
   ========================================================================== */

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

    const mainImage = resolveImageUrl(p.product_image || p.image, '../../assets/images/gallery/real_space_1.jpg');

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
        colors: colors,
        angles: angles
    };
}

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
        console.error('Error al obtener productos relacionados:', err);
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

    // Esquina: Tipo de Producto (Gris suave)
    const typeCornerEl = document.getElementById('detail-product-type');
    if (typeCornerEl) {
        typeCornerEl.textContent = product.typeName;
    }

    // Breadcrumbs
    const bcTypeEl = document.getElementById('breadcrumb-type');
    if (bcTypeEl) bcTypeEl.textContent = product.typeName;

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

    // Manejo de la Seguridad: Si no aplica o no hay seguridad, ocultar la casilla
    const secContainer = document.getElementById('detail-spec-security-container');
    const secEl = document.getElementById('detail-spec-security');
    if (product.security && product.security.trim() !== '') {
        if (secContainer) secContainer.style.display = 'flex';
        if (secEl) secEl.textContent = product.security;
    } else {
        if (secContainer) secContainer.style.display = 'none';
    }

    // Actualizar título de la página
    document.title = `${product.name} - TuEstante`;
}

/**
 * Renderiza la barra lateral de miniaturas de imágenes por ángulo y botón de video.
 */
function renderProductThumbnails(product) {
    const sidebarEl = document.getElementById('product-thumbnails-sidebar');
    if (!sidebarEl) return;

    const hasAngles = product.angles && product.angles.length > 0;
    const hasVideo = Boolean(product.video);

    if (!hasAngles && !hasVideo) {
        sidebarEl.style.display = 'none';
        sidebarEl.innerHTML = '';
        return;
    }

    sidebarEl.style.display = 'flex';

    let html = '';

    // 1. Imagen Principal como primera miniatura
    html += `
        <button type="button" 
                class="thumbnail-btn active" 
                data-image-url="${product.image}"
                data-title="Vista Principal - ${product.name}"
                title="Vista Principal"
                aria-label="Vista Principal">
            <img src="${product.image}" alt="${product.name}">
        </button>
    `;

    // 2. Miniaturas de Ángulos
    if (hasAngles) {
        product.angles.forEach((angleObj) => {
            html += `
                <button type="button" 
                        class="thumbnail-btn" 
                        data-image-url="${angleObj.image}"
                        data-title="${angleObj.angle}"
                        title="${angleObj.angle}"
                        aria-label="${angleObj.angle}">
                    <img src="${angleObj.image}" alt="${angleObj.angle}">
                </button>
            `;
        });
    }

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

    const primaryColorOption = {
        name: 'Color Primario',
        hex: '#005187',
        image: product.image,
        isLight: false,
        isPrimary: true
    };

    const colors = product.colors && product.colors.length > 0
        ? product.colors
        : [primaryColorOption];

    // Establecer primer color por defecto (Color Primario)
    if (selectedNameEl) {
        selectedNameEl.textContent = colors[0].name;
    }

    let html = '';
    colors.forEach((color, idx) => {
        const activeClass = idx === 0 ? 'active' : '';
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

            const rect = mainImgContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const lensW = lensBox.offsetWidth || 160;
            const lensH = lensBox.offsetHeight || 160;

            let lensX = x - lensW / 2;
            let lensY = y - lensH / 2;

            if (lensX < 0) lensX = 0;
            if (lensY < 0) lensY = 0;
            if (lensX > rect.width - lensW) lensX = rect.width - lensW;
            if (lensY > rect.height - lensH) lensY = rect.height - lensH;

            lensBox.style.left = `${lensX}px`;
            lensBox.style.top = `${lensY}px`;

            // Reflejo en la Pantalla Espejo (Sigue exactamente al cursor)
            const percentX = Math.max(0, Math.min(1, x / rect.width));
            const percentY = Math.max(0, Math.min(1, y / rect.height));

            mirrorImg.style.transformOrigin = `${percentX * 100}% ${percentY * 100}%`;
            mirrorImg.style.transform = 'scale(2.5)';
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
    const track = document.getElementById('related-grid-track');
    const viewport = document.getElementById('related-carousel-viewport');
    const prevBtn = document.getElementById('related-prev-btn');
    const nextBtn = document.getElementById('related-next-btn');

    if (!track || !viewport) return;

    const sourceList = Array.isArray(allProducts) ? allProducts : [];

    // Obtener productos del mismo tipo omitiendo el producto actual
    let relatedProducts = sourceList.filter(p => String(p.typeId) === String(currentProduct.typeId) && String(p.id) !== String(currentProduct.id));


    if (relatedProducts.length < 3) {
        const others = sourceList.filter(p => String(p.id) !== String(currentProduct.id) && !relatedProducts.some(r => String(r.id) === String(p.id)));
        relatedProducts = relatedProducts.concat(others.slice(0, 4 - relatedProducts.length));
    }


    const totalCols = relatedProducts.length;

    function getVisibleCols() {
        const width = window.innerWidth;
        if (width <= 600) return 1;
        if (width <= 960) return 2;
        return 3;
    }

    const visibleCols = getVisibleCols();
    const isInfinite = totalCols > visibleCols;

    function createCardHTML(p, col) {
        return `
            <div class="catalog-product-card" style="grid-row: 1; grid-column: ${col};">
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
}
