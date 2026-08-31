/**
 * ==========================================================================
 * MÓDULO DE GALERÍA DE INSPIRACIÓN "ESPACIOS REALES" - TUESTANTE
 * Manejo de la carga de imágenes desde el backend Django y respaldos provisionales,
 * filtros dinámicos basados en Categorías y Tipos de Productos de la Base de Datos,
 * ordenamiento según el patrón de 4 columnas iguales (Bloque 1 -> Bloque 2 Inverso -> Bloque 3 Fila de 4),
 * tarjeta CTA "Añadir nueva imagen", paginación "Mostrar más" y visor modal (Lightbox).
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { obtenerProyectos } from '../project/project.api.js';
import { obtenerProductos, obtenerCategorias, obtenerTiposProducto } from '../product/product.api.js';
import { backendOrigin } from '../../js/config.js';

/**
 * Lista provisional de fotografías de Espacios Reales con productos TuEstante.
 * Garantiza visualización inmediata de la grilla en el patrón de 4 columnas.
 */
const PROVISIONAL_GALLERY_ITEMS = [
    { id: 1, title: 'Estudio Creativo & Mueble Archivador', description: 'Organización moderna con gabinete rosado pastel.', author: '@tuestante.ve', category: 'hogar', categoryId: 2, categoryName: 'Muebles para Hogar', typeName: 'Gabinetes', mediaType: 'image', image: '../../assets/images/gallery/real_space_1.jpg' },
    { id: 2, title: 'Mueble Consola en Sala de Estar', description: 'Gabinete amarillo mostaza como consola de audio.', author: '@bisley_fan', category: 'hogar', categoryId: 2, categoryName: 'Muebles para Hogar', typeName: 'Armarios', mediaType: 'image', image: '../../assets/images/gallery/real_space_2.jpg' },
    { id: 3, title: 'Locker Armario en Habitación Infantil', description: 'Armario locker metálico azul cielo.', author: '@espacio_infantil', category: 'lockers', categoryId: 1, categoryName: 'Estantería Industrial', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_3.jpg' },
    { id: 4, title: 'Taller & Loft Industrial', description: 'Estantería metálica industrial de alta resistencia.', author: '@loft_design', category: 'estantes', categoryId: 3, categoryName: 'Racks de Almacenamiento', typeName: 'Racks', mediaType: 'image', image: '../../assets/images/gallery/real_space_4.jpg' },
    { id: 5, title: 'Oficina Ejecutiva Corporativa', description: 'Batería de lockers metálicos ejecutivos.', author: '@oficinas_ve', category: 'oficina', categoryId: 1, categoryName: 'Estantería Industrial', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_5.jpg' },
    { id: 6, title: 'Divisor de Ambientes con Plantas', description: 'Estantería metálica azul noche.', author: '@green_spaces', category: 'estantes', categoryId: 2, categoryName: 'Muebles para Hogar', typeName: 'Estanterías', mediaType: 'image', image: '../../assets/images/gallery/real_space_6.jpg' },
    { id: 7, title: 'Locker Ejecutivo Gris 4 Casillas', description: 'Locker metálico de alta durabilidad.', author: '@tuestante.ve', category: 'lockers', categoryId: 1, categoryName: 'Estantería Industrial', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/carrusel-index/LocekrL4Gris.jpg' },
    { id: 8, title: 'Lockers Para Gimnasios', description: 'Estilo contemporáneo para ambientes de trabajo.', author: '', category: 'lockers', categoryId: 1, categoryName: 'Estantería Industrial', typeName: 'Lockers', mediaType: 'video', videoUrl: '../../assets/videos/gym_mujer.mp4' },
    { id: 9, title: 'Lockers de Puertas Amarillas y Cuerpo Negro', description: 'Estante metálico refinado con accesorios.', author: '@C4_BOXX', category: 'lockers', categoryId: 1, categoryName: 'Estantería Industrial', typeName: 'Lockers', mediaType: 'video', videoUrl: '../../assets/videos/c4_boxx.mp4' },
    { id: 10, title: 'Estantería de Gran Capacidad', description: 'Diseño robusto para optimizar depósitos.', author: '@logistica_ve', category: 'oficina', categoryId: 3, categoryName: 'Racks de Almacenamiento', typeName: 'Racks', mediaType: 'image', image: '../../assets/images/carrusel-index/Carrousel.png' },
    { id: 11, title: 'Conjunto de Lockers Ejecutivos', description: 'Almacenamiento metálico de seguridad.', author: '', category: 'oficina', categoryId: 1, categoryName: 'Estantería Industrial', typeName: 'Lockers', mediaType: 'video', videoUrl: '../../assets/videos/elt.mp4' },
    { id: 12, title: 'Locker Amarillo Mostaza en Sala de Estar', description: 'Mueble metálico modular de 6 casillas en tono cálido con plantas tropicales.', author: '@tuestante.ve', category: 'lockers', categoryId: 2, categoryName: 'Muebles para Hogar', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_7.jpg' },
    { id: 13, title: 'Estantería Industrial de Alta Carga', description: 'Estructura metálica gris oscuro organizando estudio de arquitectura.', author: '@tuestante.ve', category: 'estantes', categoryId: 3, categoryName: 'Racks de Almacenamiento', typeName: 'Estanterías Industriales', mediaType: 'image', image: '../../assets/images/gallery/real_space_8.jpg' },
    { id: 14, title: 'Archivador Metálico Turquesa', description: 'Gabinete organizador de 4 gavetas para oficina iluminada.', author: '@tuestante.ve', category: 'oficina', categoryId: 1, categoryName: 'Estantería Industrial', typeName: 'Archivadores', mediaType: 'image', image: '../../assets/images/gallery/real_space_9.jpg' },
    { id: 15, title: 'Lockers Combinados Naranja & Azul', description: 'Mobiliario metálico de alta resistencia para áreas corporativas.', author: '@tuestante.ve', category: 'oficina', categoryId: 1, categoryName: 'Estantería Industrial', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_10.jpg' },
    { id: 16, title: 'Estante & Armario Verde Menta', description: 'Línea de almacenamiento metálico para cocinas y comedores modernos.', author: '@tuestante.ve', category: 'hogar', categoryId: 2, categoryName: 'Muebles para Hogar', typeName: 'Armarios', mediaType: 'image', image: '../../assets/images/gallery/real_space_11.jpg' },
];

// Estado global de la galería
let allGalleryItems = [...PROVISIONAL_GALLERY_ITEMS];
let filteredGalleryItems = [...allGalleryItems];
let visibleCount = 13; // Lote inicial (1 ciclo completo del patrón: 13 imágenes + 1 tarjeta CTA)
let currentFilter = 'all';

/**
 * Extrae una lista homogénea desde la respuesta de la API de Django (paginada o directa).
 */
function extractList(apiResult) {
    if (!apiResult) return [];
    if (Array.isArray(apiResult)) return apiResult;
    if (Array.isArray(apiResult.results)) return apiResult.results;
    return [];
}

/**
 * Resuelve la URL completa para una imagen proveniente del backend o un asset local.
 */
function resolveImageUrl(path, fallback = '../../assets/images/categoria/estante.png') {
    if (!path) return fallback;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const origin = backendOrigin.startsWith('http://') || backendOrigin.startsWith('https://') ? backendOrigin : `http://${backendOrigin}`;
    if (path.startsWith('/')) return `${origin}${path}`;
    return `${origin}/${path}`;
}

/**
 * Carga componentes estáticos HTML (Navbar / Footer) dinámicamente con bypass de caché.
 */
async function loadComponent(placeholderId, filePath) {
    try {
        const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        const container = document.getElementById(placeholderId);
        if (container) {
            container.innerHTML = html;
        }
    } catch (error) {
        console.error(`Error cargando componente desde ${filePath}:`, error);
    }
}

/**
 * Consulta las categorías y tipos de productos del backend Django para generar
 * dinámicamente los botones de filtrado de la galería.
 */
async function loadDynamicFilters() {
    const filterBar = document.getElementById('gallery-filter-bar');
    if (!filterBar) return;

    try {
        const [catResp, typeResp] = await Promise.allSettled([
            obtenerCategorias(),
            obtenerTiposProducto()
        ]);

        const categories = catResp.status === 'fulfilled' ? extractList(catResp.value) : [];
        const productTypes = typeResp.status === 'fulfilled' ? extractList(typeResp.value) : [];

        let filterButtonsHtml = `<button class="gallery-filter-btn active" data-filter="all">Todos</button>`;

        // Categorías reales de la BD
        if (Array.isArray(categories) && categories.length > 0) {
            categories.forEach((cat) => {
                const catName = cat.category_name || cat.name || 'Categoría';
                filterButtonsHtml += `
                    <button class="gallery-filter-btn" data-filter="cat_${cat.id}" data-category-id="${cat.id}" data-category-name="${catName}">
                        ${catName}
                    </button>
                `;
            });
        }

        // Tipos de Producto reales de la BD
        if (Array.isArray(productTypes) && productTypes.length > 0) {
            productTypes.forEach((type) => {
                const typeName = type.type_name || type.name || 'Tipo';
                filterButtonsHtml += `
                    <button class="gallery-filter-btn" data-filter="type_${type.id}" data-type-id="${type.id}" data-type-name="${typeName}">
                        ${typeName}
                    </button>
                `;
            });
        }

        filterBar.innerHTML = filterButtonsHtml;
        initFilterBar();
    } catch (e) {
        console.warn('Aviso cargando filtros dinámicos de la galería:', e);
    }
}

/**
 * Consulta la API del backend Django para obtener proyectos y productos real-time.
 * Si retorna imágenes, las combina con el catálogo provisional.
 */
async function fetchGalleryFromBackend() {
    let rawProjects = [];
    let rawProducts = [];

    try {
        const projResp = await obtenerProyectos();
        rawProjects = extractList(projResp);
    } catch (e) {
        console.warn('Backend API de proyectos no disponible:', e);
    }

    try {
        const prodResp = await obtenerProductos();
        rawProducts = extractList(prodResp);
    } catch (e) {
        console.warn('Backend API de productos no disponible:', e);
    }

    const backendItems = [];

    // 1. Mapear Proyectos
    rawProjects.forEach((item, idx) => {
        const title = item.project_name || item.title || `Proyecto Real ${idx + 1}`;
        const description = item.description || 'Proyecto realizado con mobiliario metálico TuEstante.';
        const author = item.client_name || '@tuestante.ve';
        const imgPath = item.project_images || item.image || item.featured_image;
        if (imgPath) {
            backendItems.push({
                id: `proj_${item.id || idx}`,
                title,
                description,
                author,
                category: 'Proyectos',
                categoryId: item.category_id || item.category?.id || null,
                categoryName: item.category_detail?.category_name || item.category?.name || 'Proyectos',
                image: resolveImageUrl(imgPath)
            });
        }
    });

    // 2. Mapear Productos reales
    rawProducts.forEach((item, idx) => {
        const title = item.product_name || item.name || `Producto TuEstante ${idx + 1}`;
        const description = item.description || 'Mobiliario metálico resistente de alta calidad.';
        const author = '@tuestante.ve';
        const imgPath = item.product_image || item.image || (Array.isArray(item.images) && item.images[0]?.image);
        const categoryId = item.category?.id || item.category_id || item.categoryId || (typeof item.category === 'number' ? item.category : null);
        const categoryName = item.category_detail?.category_name || item.category?.category_name || item.categoryName || (typeof item.category === 'string' ? item.category : '');
        const typeId = item.product_type?.id || item.product_type_id || item.typeId || (typeof item.product_type === 'number' ? item.product_type : null);
        const typeName = item.product_type_detail?.type_name || item.product_type?.type_name || item.typeName || '';

        if (imgPath) {
            backendItems.push({
                id: `prod_${item.id || idx}`,
                title,
                description,
                author,
                category: categoryName || 'Productos',
                categoryId,
                categoryName,
                typeId,
                typeName,
                image: resolveImageUrl(imgPath)
            });
        }
    });

    if (backendItems.length > 0) {
        // Combinar elementos reales del backend con los provisionales
        allGalleryItems = [...backendItems, ...PROVISIONAL_GALLERY_ITEMS];
        filteredGalleryItems = [...allGalleryItems];
        renderGalleryPattern();
    }
}

/**
 * Retorna el HTML de la tarjeta interactiva de CTA "Añadir nueva imagen" (cuenta como 1 espacio pequeño).
 */
function createCtaCardHtml() {
    return `
        <div class="gallery-cta-card fade-in">
            <h3 class="gallery-cta-title">Comparte tu estilo – sube una foto de tu TuEstante</h3>
            <a href="https://wa.link/lpe0md" target="_blank" rel="noopener" class="gallery-cta-btn">SUBIR MI FOTO</a>
        </div>
    `;
}

/**
 * Genera el HTML para una tarjeta de imagen (grande o pequeña).
 * @param {Object} item Objeto de la imagen
 * @param {string} sizeClass 'large-item' para grande (2x2) o 'small-item' para pequeña (1x1)
 */
function createCardHtml(item, sizeClass) {
    const isVideo = item.mediaType === 'video' || Boolean(item.videoUrl || item.video);

    let mediaHtml = '';
    let videoBadgeHtml = '';

    if (isVideo) {
        const videoSrc = item.videoUrl || item.video;
        mediaHtml = `
            <video src="${videoSrc}" poster="${item.image || ''}" class="gallery-card-video" autoplay loop muted playsinline disableRemotePlayback></video>
        `;
        videoBadgeHtml = `
            <div class="gallery-card-video-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                <span>VIDEO</span>
            </div>
        `;
    } else {
        mediaHtml = `<img src="${item.image}" alt="${item.title}" class="gallery-card-img" loading="lazy" onerror="this.src='../../assets/images/categoria/estante.png'">`;
    }

    return `
        <div class="gallery-card ${sizeClass} ${isVideo ? 'video-card' : ''} fade-in" data-id="${item.id}" tabindex="0" role="button" aria-label="Ver ${isVideo ? 'video' : 'foto'}: ${item.title}">
            ${mediaHtml}
            ${videoBadgeHtml}
            <div class="gallery-card-overlay">
                <h3 class="gallery-card-title">${item.title}</h3>
                <span class="gallery-card-author">${item.author}</span>
            </div>
            <div class="gallery-card-zoom-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
            </div>
        </div>
    `;
}

/**
 * Renderiza la galería aplicando el patrón secuencial exigido:
 * 1. Imagen Grande (izq 2x2) + 4 Pequeñas (der 2x2, donde la 1ª es la tarjeta CTA 'Añadir nueva imagen').
 * 2. Orden Inverso: 4 Pequeñas (izq 2x2) + Imagen Grande (der 2x2).
 * 3. Fila de 4 imágenes pequeñas seguidas (1x4).
 * 4. Repite todo el patrón secuencialmente hasta agotar las fotos.
 */
function renderGalleryPattern() {
    const container = document.getElementById('gallery-grid-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!container) return;

    const visibleItems = filteredGalleryItems.slice(0, visibleCount);

    let htmlBuffer = '';
    let itemIdx = 0;
    let blockPhase = 0; // 0 = Bloque 1 (Grande Izq), 1 = Bloque 2 (Grande Der / Inverso), 2 = Bloque 3 (Fila 4)
    let ctaInserted = false;

    while (itemIdx < visibleItems.length) {
        if (blockPhase === 0) {
            // BLOQUE 1: Imagen Grande a la Izquierda (2x2) + 4 Pequeñas a la Derecha (2x2)
            if (itemIdx < visibleItems.length) {
                htmlBuffer += createCardHtml(visibleItems[itemIdx++], 'large-item');
            }

            // 4 espacios pequeños a la derecha. La tarjeta CTA "Añadir nueva imagen" es la primera de las pequeñas.
            if (!ctaInserted) {
                htmlBuffer += createCtaCardHtml(); // 1er espacio pequeño
                ctaInserted = true;

                for (let s = 0; s < 3 && itemIdx < visibleItems.length; s++) {
                    htmlBuffer += createCardHtml(visibleItems[itemIdx++], 'small-item');
                }
            } else {
                for (let s = 0; s < 4 && itemIdx < visibleItems.length; s++) {
                    htmlBuffer += createCardHtml(visibleItems[itemIdx++], 'small-item');
                }
            }

            blockPhase = 1;

        } else if (blockPhase === 1) {
            // BLOQUE 2: ORDEN INVERSO - 4 Pequeñas a la Izquierda (2x2) + Imagen Grande a la Derecha (2x2)
            for (let s = 0; s < 4 && itemIdx < visibleItems.length; s++) {
                htmlBuffer += createCardHtml(visibleItems[itemIdx++], 'small-item');
            }

            if (itemIdx < visibleItems.length) {
                htmlBuffer += createCardHtml(visibleItems[itemIdx++], 'large-item');
            }

            blockPhase = 2;

        } else if (blockPhase === 2) {
            // BLOQUE 3: Fila de 4 Imágenes Pequeñas Seguidas (1x4)
            for (let s = 0; s < 4 && itemIdx < visibleItems.length; s++) {
                htmlBuffer += createCardHtml(visibleItems[itemIdx++], 'small-item');
            }

            blockPhase = 0; // Reiniciar el patrón para el siguiente ciclo
        }
    }

    container.innerHTML = htmlBuffer;

    // Actualizar estado del botón "Mostrar más"
    if (loadMoreBtn) {
        if (visibleCount >= filteredGalleryItems.length) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.querySelector('.btn-text').textContent = 'Has visto todas las fotos';
        } else {
            loadMoreBtn.disabled = false;
            loadMoreBtn.querySelector('.btn-text').textContent = 'Mostrar más';
        }
    }

    // Vincular los eventos para la apertura del modal Lightbox
    attachLightboxEvents();
}

/**
 * Asigna los eventos de clic a las tarjetas para abrir el visor Lightbox y desactiva el sonido en los videos.
 */
function attachLightboxEvents() {
    const cards = document.querySelectorAll('.gallery-card');
    cards.forEach(card => {
        if (card.dataset.lightboxBound) return;
        card.dataset.lightboxBound = 'true';

        card.addEventListener('click', () => {
            const rawId = card.getAttribute('data-id');
            const item = allGalleryItems.find(i => String(i.id) === String(rawId));
            if (item) {
                openLightbox(item);
            }
        });
    });

    // Enforzar silenciamiento estricto a los videos de la grilla
    const cardVideos = document.querySelectorAll('.gallery-card-video');
    cardVideos.forEach(v => {
        v.muted = true;
        v.volume = 0;
        v.addEventListener('volumechange', () => {
            v.muted = true;
            v.volume = 0;
        });
        v.addEventListener('play', () => {
            v.muted = true;
            v.volume = 0;
        });
    });
}

/**
 * Abre el modal Lightbox con la foto o video ampliado a pantalla completa y detalles del espacio.
 */
function openLightbox(item) {
    const lightbox = document.getElementById('gallery-lightbox');
    const mediaWrapper = document.getElementById('lightbox-media-wrapper');
    const title = document.getElementById('lightbox-title');
    const desc = document.getElementById('lightbox-desc');
    const tag = document.getElementById('lightbox-tag');

    if (!lightbox || !mediaWrapper) return;

    const isVideo = item.mediaType === 'video' || Boolean(item.videoUrl || item.video);

    if (isVideo) {
        const videoSrc = item.videoUrl || item.video;
        mediaWrapper.innerHTML = `
            <video id="lightbox-video" src="${videoSrc}" poster="${item.image || ''}" autoplay loop muted playsinline disableRemotePlayback class="lightbox-fullscreen-media"></video>
        `;

        const lbVideo = document.getElementById('lightbox-video');
        if (lbVideo) {
            lbVideo.muted = true;
            lbVideo.volume = 0;
            lbVideo.addEventListener('volumechange', () => {
                lbVideo.muted = true;
                lbVideo.volume = 0;
            });
            lbVideo.addEventListener('play', () => {
                lbVideo.muted = true;
                lbVideo.volume = 0;
            });
        }
    } else {
        mediaWrapper.innerHTML = `
            <img id="lightbox-img" src="${item.image}" alt="${item.title}" class="lightbox-fullscreen-media">
        `;
    }

    if (title) title.textContent = item.title;
    if (desc) desc.textContent = item.description;
    if (tag) tag.textContent = item.author;

    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

/**
 * Cierra el modal Lightbox y detiene cualquier video en reproducción.
 */
function closeLightbox() {
    const lightbox = document.getElementById('gallery-lightbox');
    if (!lightbox) return;

    const lbVideo = document.getElementById('lightbox-video');
    if (lbVideo) {
        lbVideo.pause();
        lbVideo.src = '';
    }

    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

/**
 * Inicializa los eventos de la barra de filtrado de categorías y tipos de productos.
 */
function initFilterBar() {
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterKey = btn.getAttribute('data-filter') || 'all';
            const catId = btn.getAttribute('data-category-id');
            const catName = (btn.getAttribute('data-category-name') || '').toLowerCase().trim();
            const typeId = btn.getAttribute('data-type-id');
            const typeName = (btn.getAttribute('data-type-name') || '').toLowerCase().trim();

            currentFilter = filterKey;
            visibleCount = 13;

            if (filterKey === 'all') {
                filteredGalleryItems = [...allGalleryItems];
            } else if (catId || catName) {
                // Filtrar por categoría
                filteredGalleryItems = allGalleryItems.filter(item => {
                    const itemCatId = String(item.categoryId || item.category_id || item.category || '');
                    const itemCatName = String(item.categoryName || item.category || '').toLowerCase();
                    const itemTitle = String(item.title || '').toLowerCase();
                    const itemDesc = String(item.description || '').toLowerCase();

                    return (catId && itemCatId === String(catId)) ||
                           (catName && (itemCatName.includes(catName) || itemTitle.includes(catName) || itemDesc.includes(catName)));
                });
            } else if (typeId || typeName) {
                // Filtrar por tipo de producto
                filteredGalleryItems = allGalleryItems.filter(item => {
                    const itemTypeId = String(item.typeId || item.product_type || item.productType || '');
                    const itemTypeName = String(item.typeName || '').toLowerCase();
                    const itemTitle = String(item.title || '').toLowerCase();
                    const itemDesc = String(item.description || '').toLowerCase();

                    return (typeId && itemTypeId === String(typeId)) ||
                           (typeName && (itemTypeName.includes(typeName) || itemTitle.includes(typeName) || itemDesc.includes(typeName)));
                });
            } else {
                filteredGalleryItems = allGalleryItems.filter(item =>
                    String(item.category || '').toLowerCase().includes(filterKey.toLowerCase())
                );
            }

            // Fallback para evitar dejar la grilla vacía si no hay coincidencias exactas
            if (filteredGalleryItems.length === 0 && allGalleryItems.length > 0) {
                const term = (catName || typeName || filterKey).toLowerCase();
                filteredGalleryItems = allGalleryItems.filter(item => {
                    return String(item.title).toLowerCase().includes(term) ||
                           String(item.description).toLowerCase().includes(term) ||
                           String(item.category).toLowerCase().includes(term);
                });
                if (filteredGalleryItems.length === 0) {
                    filteredGalleryItems = [...allGalleryItems];
                }
            }

            renderGalleryPattern();
        };
    });
}

/**
 * Inicializa la acción del botón "Mostrar más" para cargar el siguiente lote de imágenes.
 */
function initLoadMore() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!loadMoreBtn) return;

    loadMoreBtn.addEventListener('click', () => {
        visibleCount += 13; // Añadir un nuevo ciclo completo del patrón por cada clic
        renderGalleryPattern();
    });
}

/**
 * Inicializa los eventos de cierre del modal Lightbox.
 */
function initLightboxEvents() {
    const closeBtn = document.getElementById('lightbox-close-btn');
    const overlay = document.getElementById('lightbox-overlay');

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (overlay) overlay.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
}

// Inicialización del módulo de la Galería al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Navbar y Footer compartidos
    await Promise.all([
        loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
        loadComponent('footer-placeholder', '../../components/footer/footer.html')
    ]);

    // 2. Inicializar lógica funcional de Navbar y Footer
    initNavbar();
    initFooter();

    // 3. Inicializar eventos base y renderizar inmediatamente las imágenes iniciales
    initFilterBar();
    initLoadMore();
    initLightboxEvents();
    renderGalleryPattern();

    // 4. Cargar filtros dinámicos de Categorías y Tipos de Productos desde la BD
    loadDynamicFilters();

    // 5. Consultar en segundo plano al backend Django para enriquecer la galería con proyectos/productos
    fetchGalleryFromBackend();
});
