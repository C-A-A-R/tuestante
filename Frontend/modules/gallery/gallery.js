/**
 * ==========================================================================
 * MÓDULO DE GALERÍA DE INSPIRACIÓN "ESPACIOS REALES" - TUESTANTE
 * Manejo de la carga de imágenes desde el backend Django (apps/gallery) y proyectos,
 * filtros dinámicos basados en Redes Sociales y Tipos de Productos de la BD,
 * ordenamiento según el patrón de 4 columnas iguales (Bloque 1 -> Bloque 2 Inverso -> Bloque 3 Fila de 4),
 * tarjeta CTA "Añadir nueva imagen", paginación "Mostrar más", estado vacío (Empty State) y visor modal (Lightbox).
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { obtenerProyectos } from '../project/project.api.js';
import { obtenerProductos, obtenerTiposProducto } from '../product/product.api.js';
import { obtenerGaleria } from './gallery.api.js';
import { backendOrigin } from '../../js/config.js';

/**
 * Lista provisional de fotografías de Espacios Reales con productos TuEstante.
 * Garantiza visualización inmediata de la grilla en el patrón de 4 columnas si el backend no cuenta con imágenes.
 */
const PROVISIONAL_GALLERY_ITEMS = [
    { id: 1, title: 'Estudio Creativo & Mueble Archivador', description: 'Organización moderna con gabinete rosado pastel.', author: '@tuestante.ve', socialNetwork: 'instagram', typeName: 'Gabinetes', mediaType: 'image', image: '../../assets/images/gallery/real_space_1.jpg' },
    { id: 2, title: 'Mueble Consola en Sala de Estar', description: 'Gabinete amarillo mostaza como consola de audio.', author: '@bisley_fan', socialNetwork: 'instagram', typeName: 'Armarios', mediaType: 'image', image: '../../assets/images/gallery/real_space_2.jpg' },
    { id: 3, title: 'Locker Armario en Habitación Infantil', description: 'Armario locker metálico azul cielo.', author: '@espacio_infantil', socialNetwork: 'instagram', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_3.jpg' },
    { id: 4, title: 'Taller & Loft Industrial', description: 'Estantería metálica industrial de alta resistencia.', author: '@loft_design', socialNetwork: 'tiktok', typeName: 'Racks', mediaType: 'image', image: '../../assets/images/gallery/real_space_4.jpg' },
    { id: 5, title: 'Oficina Ejecutiva Corporativa', description: 'Batería de lockers metálicos ejecutivos.', author: '@oficinas_ve', socialNetwork: 'instagram', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_5.jpg' },
    { id: 6, title: 'Divisor de Ambientes con Plantas', description: 'Estantería metálica azul noche.', author: '@green_spaces', socialNetwork: 'instagram', typeName: 'Estanterías', mediaType: 'image', image: '../../assets/images/gallery/real_space_6.jpg' },
    { id: 7, title: 'Locker Ejecutivo Gris 4 Casillas', description: 'Locker metálico de alta durabilidad.', author: '@tuestante.ve', socialNetwork: 'tiktok', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/carrusel-index/LocekrL4Gris.jpg' },
    { id: 8, title: 'Lockers Para Gimnasios', description: 'Estilo contemporáneo para ambientes de trabajo.', author: '@tuestante.ve', socialNetwork: 'tiktok', typeName: 'Lockers', mediaType: 'video', videoUrl: '../../assets/videos/gym_mujer.mp4' },
    { id: 9, title: 'Lockers de Puertas Amarillas y Cuerpo Negro', description: 'Estante metálico refinado con accesorios.', author: '@C4_BOXX', socialNetwork: 'tiktok', typeName: 'Lockers', mediaType: 'video', videoUrl: '../../assets/videos/c4_boxx.mp4' },
    { id: 10, title: 'Estantería de Gran Capacidad', description: 'Diseño robusto para optimizar depósitos.', author: '@logistica_ve', socialNetwork: 'instagram', typeName: 'Racks', mediaType: 'image', image: '../../assets/images/carrusel-index/Carrousel.png' },
    { id: 11, title: 'Conjunto de Lockers Ejecutivos', description: 'Almacenamiento metálico de seguridad.', author: '@tuestante.ve', socialNetwork: 'tiktok', typeName: 'Lockers', mediaType: 'video', videoUrl: '../../assets/videos/elt.mp4' },
    { id: 12, title: 'Locker Amarillo Mostaza en Sala de Estar', description: 'Mueble metálico modular de 6 casillas en tono cálido con plantas tropicales.', author: '@tuestante.ve', socialNetwork: 'instagram', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_7.jpg' },
    { id: 13, title: 'Estantería Industrial de Alta Carga', description: 'Estructura metálica gris oscuro organizando estudio de arquitectura.', author: '@tuestante.ve', socialNetwork: 'instagram', typeName: 'Estanterías', mediaType: 'image', image: '../../assets/images/gallery/real_space_8.jpg' },
    { id: 14, title: 'Archivador Metálico Turquesa', description: 'Gabinete organizador de 4 gavetas para oficina iluminada.', author: '@tuestante.ve', socialNetwork: 'instagram', typeName: 'Archivadores', mediaType: 'image', image: '../../assets/images/gallery/real_space_9.jpg' },
    { id: 15, title: 'Lockers Combinados Naranja & Azul', description: 'Mobiliario metálico de alta resistencia para áreas corporativas.', author: '@tuestante.ve', socialNetwork: 'tiktok', typeName: 'Lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_10.jpg' },
    { id: 16, title: 'Estante & Armario Verde Menta', description: 'Línea de almacenamiento metálico para cocinas y comedores modernos.', author: '@tuestante.ve', socialNetwork: 'instagram', typeName: 'Armarios', mediaType: 'image', image: '../../assets/images/gallery/real_space_11.jpg' },
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
 * Consulta los tipos de producto del backend Django para generar dinámicamente
 * los botones de filtrado de la galería, sin depender de categorías.
 */
async function loadDynamicFilters() {
    const filterBar = document.getElementById('gallery-filter-bar');
    if (!filterBar) return;

    try {
        const typeResp = await obtenerTiposProducto().catch(() => []);
        const productTypes = extractList(typeResp);

        let filterButtonsHtml = `<button class="gallery-filter-btn active" data-filter="all">Todos</button>`;

        // Filtro Instagram
        filterButtonsHtml += `
            <button class="gallery-filter-btn" data-filter="instagram" data-network="instagram">
                <svg class="filter-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                Instagram
            </button>
        `;

        // Filtro TikTok
        filterButtonsHtml += `
            <button class="gallery-filter-btn" data-filter="tiktok" data-network="tiktok">
                <svg class="filter-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.4a6.33 6.33 0 0 0-.85-.06A6.34 6.34 0 0 0 3 15.68a6.34 6.34 0 0 0 6.34 6.34c3.48 0 6.32-2.82 6.34-6.3V8.85a8.28 8.28 0 0 0 4.91 1.59V7a4.81 4.81 0 0 1-1-.31z"/></svg>
                TikTok
            </button>
        `;

        // Tipos de Producto reales de la BD
        if (Array.isArray(productTypes) && productTypes.length > 0) {
            productTypes.forEach((type) => {
                const typeName = type.product_type_name || type.type_name || type.name || 'Tipo';
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
        console.warn('Aviso cargando filtros de la galería:', e);
    }
}

/**
 * Consulta la API del backend Django (apps/gallery, proyectos y productos) en tiempo real.
 * Conecta directamente a la aplicación de Galería.
 */
async function fetchGalleryFromBackend() {
    let rawGallery = [];
    let rawProjects = [];
    let rawProducts = [];

    // 1. Conexión a la aplicación de galería del backend (apps/gallery)
    try {
        const galResp = await obtenerGaleria();
        rawGallery = extractList(galResp);
    } catch (e) {
        console.warn('Backend API de galería no disponible:', e);
    }

    // 2. Conexión a proyectos del backend
    try {
        const projResp = await obtenerProyectos();
        rawProjects = extractList(projResp);
    } catch (e) {
        console.warn('Backend API de proyectos no disponible:', e);
    }

    // 3. Conexión a productos del backend
    try {
        const prodResp = await obtenerProductos();
        rawProducts = extractList(prodResp);
    } catch (e) {
        console.warn('Backend API de productos no disponible:', e);
    }

    const backendItems = [];

    // Mapear fotos desde la aplicación de Galería (apps/gallery)
    rawGallery.forEach((item, idx) => {
        const title = item.caption || `Espacio Real ${idx + 1}`;
        const description = item.caption || 'Fotografía de la comunidad TuEstante.';
        const author = item.social_media_handle || (item.social_network ? `@${item.social_network}` : '@tuestante.ve');
        const imgPath = item.image;
        if (imgPath) {
            backendItems.push({
                id: `gal_${item.id || idx}`,
                title,
                description,
                author,
                socialNetwork: (item.social_network || '').toLowerCase(),
                socialUrl: item.social_media_url || '',
                socialHandle: item.social_media_handle || '',
                mediaType: 'image',
                image: resolveImageUrl(imgPath)
            });
        }
    });

    // Mapear Proyectos
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
                socialNetwork: 'proyectos',
                image: resolveImageUrl(imgPath)
            });
        }
    });

    // Mapear Productos reales con imágenes
    rawProducts.forEach((item, idx) => {
        const title = item.product_name || item.name || `Producto TuEstante ${idx + 1}`;
        const description = item.description || 'Mobiliario metálico resistente de alta calidad.';
        const author = '@tuestante.ve';
        const imgPath = item.product_image || item.image || (Array.isArray(item.images) && item.images[0]?.image);
        const typeId = item.product_type?.id || item.product_type_id || item.typeId || (typeof item.product_type === 'number' ? item.product_type : null);
        const typeName = item.product_type_detail?.type_name || item.product_type?.product_type_name || item.product_type?.type_name || item.typeName || '';

        if (imgPath) {
            backendItems.push({
                id: `prod_${item.id || idx}`,
                title,
                description,
                author,
                socialNetwork: 'catalogo',
                typeId,
                typeName,
                image: resolveImageUrl(imgPath)
            });
        }
    });

    // Si se obtuvieron fotos del backend, enriquecer la galería
    if (backendItems.length > 0) {
        allGalleryItems = [...backendItems, ...PROVISIONAL_GALLERY_ITEMS];
    }

    filteredGalleryItems = [...allGalleryItems];
    renderGalleryPattern();
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
 * Renderiza el estado vacío (Empty State) cuando no hay imágenes disponibles o el filtro no tiene resultados.
 */
function renderEmptyState(container, loadMoreBtn) {
    container.innerHTML = `
        <div class="gallery-empty-state fade-in">
            <div class="gallery-empty-card">
                <div class="gallery-empty-icon-wrap">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
                <h3 class="gallery-empty-title">Aún no hay fotos en esta sección</h3>
                <p class="gallery-empty-desc">
                    Sé parte de nuestra comunidad compartiendo una foto de tu espacio real organizado con mobiliario y estanterías metálicas de <strong>TuEstante</strong>.
                </p>
                <div class="gallery-empty-actions">
                    <a href="https://www.instagram.com/tuestante.ve/" target="_blank" rel="noopener" class="gallery-empty-btn gallery-empty-btn-instagram">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                        <span>Etiquétanos en Instagram</span>
                    </a>
                    <a href="https://www.tiktok.com/@tuestante.ve" target="_blank" rel="noopener" class="gallery-empty-btn gallery-empty-btn-tiktok">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.4a6.33 6.33 0 0 0-.85-.06A6.34 6.34 0 0 0 3 15.68a6.34 6.34 0 0 0 6.34 6.34c3.48 0 6.32-2.82 6.34-6.3V8.85a8.28 8.28 0 0 0 4.91 1.59V7a4.81 4.81 0 0 1-1-.31z"/></svg>
                        <span>Síguenos en TikTok</span>
                    </a>
                    <a href="https://wa.link/lpe0md" target="_blank" rel="noopener" class="gallery-empty-btn gallery-empty-btn-upload">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 3 21 3 21 8"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        <span>Subir mi foto</span>
                    </a>
                </div>
            </div>
        </div>
    `;

    if (loadMoreBtn) {
        loadMoreBtn.style.display = 'none';
    }
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

    // Si la lista está vacía, renderizar el estado vacío
    if (!filteredGalleryItems || filteredGalleryItems.length === 0) {
        renderEmptyState(container, loadMoreBtn);
        return;
    }

    if (loadMoreBtn) {
        loadMoreBtn.style.display = '';
    }

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
            const id = card.getAttribute('data-id');
            const item = allGalleryItems.find(i => String(i.id) === String(id));
            if (item) {
                openLightbox(item);
            }
        });

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
    });
}

/**
 * Abre el visor modal Lightbox con la imagen o video en alta calidad.
 * @param {Object} item Objeto de la galería
 */
function openLightbox(item) {
    const lightbox = document.getElementById('gallery-lightbox');
    const mediaWrapper = document.getElementById('lightbox-media-wrapper');
    const titleEl = document.getElementById('lightbox-title');
    const descEl = document.getElementById('lightbox-desc');
    const tagEl = document.getElementById('lightbox-tag');

    if (!lightbox || !mediaWrapper) return;

    const isVideo = item.mediaType === 'video' || Boolean(item.videoUrl || item.video);

    if (isVideo) {
        const videoSrc = item.videoUrl || item.video;
        mediaWrapper.innerHTML = `
            <video src="${videoSrc}" class="lightbox-video" controls autoplay playsinline></video>
        `;
    } else {
        mediaWrapper.innerHTML = `
            <img id="lightbox-img" src="${item.image}" alt="${item.title}" class="lightbox-img" onerror="this.src='../../assets/images/categoria/estante.png'">
        `;
    }

    if (titleEl) titleEl.textContent = item.title;
    if (descEl) descEl.textContent = item.description;
    if (tagEl) {
        tagEl.textContent = item.author || '@tuestante.ve';
        if (item.socialUrl) {
            tagEl.innerHTML = `<a href="${item.socialUrl}" target="_blank" rel="noopener" style="color: inherit; text-decoration: underline;">${item.author || '@tuestante.ve'}</a>`;
        }
    }

    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

/**
 * Cierra el visor modal Lightbox y detiene cualquier reproducción de video activa.
 */
function closeLightbox() {
    const lightbox = document.getElementById('gallery-lightbox');
    if (!lightbox) return;

    const activeVideo = lightbox.querySelector('video');
    if (activeVideo) {
        activeVideo.pause();
    }

    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

/**
 * Inicializa los eventos de la barra de filtrado de redes sociales y tipos de productos.
 */
function initFilterBar() {
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterKey = btn.getAttribute('data-filter') || 'all';
            const network = btn.getAttribute('data-network');
            const typeId = btn.getAttribute('data-type-id');
            const typeName = (btn.getAttribute('data-type-name') || '').toLowerCase().trim();

            currentFilter = filterKey;
            visibleCount = 13;

            if (filterKey === 'all') {
                filteredGalleryItems = [...allGalleryItems];
            } else if (network) {
                // Filtrar por red social (Instagram, TikTok, etc.)
                filteredGalleryItems = allGalleryItems.filter(item => {
                    const itemNet = String(item.socialNetwork || '').toLowerCase();
                    const itemAuthor = String(item.author || '').toLowerCase();
                    const itemUrl = String(item.socialUrl || '').toLowerCase();
                    return itemNet.includes(network) || itemAuthor.includes(network) || itemUrl.includes(network);
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
                    String(item.title || '').toLowerCase().includes(filterKey.toLowerCase()) ||
                    String(item.description || '').toLowerCase().includes(filterKey.toLowerCase())
                );
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

    // 4. Cargar filtros dinámicos (Tipos de Productos y Redes Sociales) desde el backend
    loadDynamicFilters();

    // 5. Consultar en segundo plano al backend Django (apps/gallery) para enriquecer la galería
    fetchGalleryFromBackend();
});
