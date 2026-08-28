/**
 * ==========================================================================
 * MÓDULO DE GALERÍA DE INSPIRACIÓN "ESPACIOS REALES" - TUESTANTE
 * Manejo de la carga de imágenes desde el backend Django y respaldos provisionales,
 * ordenamiento según el patrón de 4 columnas iguales (Bloque 1 -> Bloque 2 Inverso -> Bloque 3 Fila de 4),
 * tarjeta CTA "Añadir nueva imagen", paginación "Mostrar más" y visor modal (Lightbox).
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { obtenerProyectos } from '../project/project.api.js';
import { obtenerProductos } from '../product/product.api.js';
import { backendOrigin } from '../../js/config.js';

/**
 * Lista provisional de fotografías de Espacios Reales con productos TuEstante.
 * Garantiza visualización inmediata de la grilla en el patrón de 4 columnas.
 */
const PROVISIONAL_GALLERY_ITEMS = [
    { id: 1, title: 'Estudio Creativo & Mueble Archivador', description: 'Organización moderna con gabinete rosado pastel.', author: '@tuestante.ve', category: 'hogar', mediaType: 'image', image: '../../assets/images/gallery/real_space_1.jpg' },
    { id: 2, title: 'Mueble Consola en Sala de Estar', description: 'Gabinete amarillo mostaza como consola de audio.', author: '@bisley_fan', category: 'hogar', mediaType: 'image', image: '../../assets/images/gallery/real_space_2.jpg' },
    { id: 3, title: 'Locker Armario en Habitación Infantil', description: 'Armario locker metálico azul cielo.', author: '@espacio_infantil', category: 'lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_3.jpg' },
    { id: 4, title: 'Taller & Loft Industrial', description: 'Estantería metálica industrial de alta resistencia.', author: '@loft_design', category: 'estantes', mediaType: 'image', image: '../../assets/images/gallery/real_space_4.jpg' },
    { id: 5, title: 'Oficina Ejecutiva Corporativa', description: 'Batería de lockers metálicos ejecutivos.', author: '@oficinas_ve', category: 'oficina', mediaType: 'image', image: '../../assets/images/gallery/real_space_5.jpg' },
    { id: 6, title: 'Divisor de Ambientes con Plantas', description: 'Estantería metálica azul noche.', author: '@green_spaces', category: 'estantes', mediaType: 'image', image: '../../assets/images/gallery/real_space_6.jpg' },
    { id: 7, title: 'Locker Ejecutivo Gris 4 Casillas', description: 'Locker metálico de alta durabilidad.', author: '@tuestante.ve', category: 'lockers', mediaType: 'image', image: '../../assets/images/carrusel-index/LocekrL4Gris.jpg' },
    { id: 8, title: 'Lockers Para Gimnasios', description: 'Estilo contemporáneo para ambientes de trabajo.', author: '', category: 'lockers', mediaType: 'video', videoUrl: '../../assets/videos/gym_mujer.mp4' },
    { id: 9, title: 'Lockers de Puertas Amarillas y Cuerpo Negro', description: 'Estante metálico refinado con accesorios.', author: '@C4_BOXX', category: 'lockers', mediaType: 'video', videoUrl: '../../assets/videos/c4_boxx.mp4' },
    { id: 10, title: 'Estantería de Gran Capacidad', description: 'Diseño robusto para optimizar depósitos.', author: '@logistica_ve', category: 'oficina', mediaType: 'image', image: '../../assets/images/carrusel-index/Carrousel.png' },
    { id: 11, title: 'Conjunto de Lockers Ejecutivos', description: 'Almacenamiento metálico de seguridad.', author: '', category: 'oficina', mediaType: 'video', videoUrl: '../../assets/videos/elt.mp4' },
    { id: 12, title: 'Locker Amarillo Mostaza en Sala de Estar', description: 'Mueble metálico modular de 6 casillas en tono cálido con plantas tropicales.', author: '@tuestante.ve', category: 'lockers', mediaType: 'image', image: '../../assets/images/gallery/real_space_7.jpg' },
    { id: 13, title: 'Estantería Industrial de Alta Carga', description: 'Estructura metálica gris oscuro organizando estudio de arquitectura.', author: '@tuestante.ve', category: 'estantes', mediaType: 'image', image: '../../assets/images/gallery/real_space_8.jpg' },
    { id: 14, title: 'Archivador Metálico Turquesa', description: 'Gabinete organizador de 4 gavetas para oficina iluminada.', author: '@tuestante.ve', category: 'oficina', mediaType: 'image', image: '../../assets/images/gallery/real_space_9.jpg' },
    { id: 15, title: 'Lockers Combinados Naranja & Azul', description: 'Mobiliario metálico de alta resistencia para áreas corporativas.', author: '@tuestante.ve', category: 'oficina', mediaType: 'image', image: '../../assets/images/gallery/real_space_10.jpg' },
    { id: 16, title: 'Estante & Armario Verde Menta', description: 'Línea de almacenamiento metálico para cocinas y comedores modernos.', author: '@tuestante.ve', category: 'hogar', mediaType: 'image', image: '../../assets/images/gallery/real_space_11.jpg' },
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
 * Carga componentes estáticos HTML (Navbar / Footer) dinámicamente.
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
 * Consulta la API del backend Django para obtener proyectos y productos real-time.
 * Si retorna imágenes, las combina con el catálogo provisional.
 */
async function fetchGalleryFromBackend() {
    let rawItems = [];

    try {
        const projResp = await obtenerProyectos();
        const projList = extractList(projResp);
        rawItems = [...projList];
    } catch (e) {
        console.warn('Backend API de proyectos no disponible, usando imágenes provisionales:', e);
    }

    try {
        const prodResp = await obtenerProductos();
        const prodList = extractList(prodResp);
        rawItems = [...rawItems, ...prodList];
    } catch (e) {
        console.warn('Backend API de productos no disponible, usando imágenes provisionales:', e);
    }

    if (rawItems.length === 0) return;

    // Mapear elementos traídos del backend Django
    const backendItems = rawItems.map((item, idx) => {
        const title = item.project_name || item.product_name || item.name || `Espacio Real Backend ${idx + 1}`;
        const description = item.description || 'Mobiliario metálico TuEstante diseñado para dar estilo y orden.';
        const author = item.author || '@tuestante.ve';
        const category = (item.category_detail?.category_name || item.categoryName || (idx % 2 === 0 ? 'lockers' : 'estantes')).toLowerCase();
        const imgPath = item.project_images || item.product_image || item.image || item.category_image;
        const image = resolveImageUrl(imgPath, PROVISIONAL_GALLERY_ITEMS[idx % PROVISIONAL_GALLERY_ITEMS.length].image);

        return {
            id: `api_${item.id || idx}`,
            title,
            description,
            author,
            category,
            image
        };
    });

    // Combinar elementos del backend al inicio de la lista
    allGalleryItems = [...backendItems, ...PROVISIONAL_GALLERY_ITEMS];
    if (currentFilter === 'all') {
        filteredGalleryItems = [...allGalleryItems];
    } else {
        filteredGalleryItems = allGalleryItems.filter(item => item.category.includes(currentFilter));
    }

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
        mediaHtml = `<img src="${item.image}" alt="${item.title}" class="gallery-card-img" loading="lazy">`;
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

    // Enforzar silenciamiento estricto a los videos de la grilla (sin permitir que se les active el sonido)
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
            // Garantizar que NO se le pueda activar el sonido jamás
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
 * Inicializa los eventos de la barra de filtrado de categorías.
 */
function initFilterBar() {
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilter = btn.getAttribute('data-filter');
            visibleCount = 13;

            if (currentFilter === 'all') {
                filteredGalleryItems = [...allGalleryItems];
            } else {
                filteredGalleryItems = allGalleryItems.filter(item =>
                    item.category.includes(currentFilter) || currentFilter.includes(item.category)
                );
            }

            renderGalleryPattern();
        });
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

    // 3. Inicializar eventos y renderizar inmediatamente las imágenes provisionales
    initFilterBar();
    initLoadMore();
    initLightboxEvents();
    renderGalleryPattern();

    // 4. Consultar en segundo plano al backend Django para actualizar si hay nuevos datos
    fetchGalleryFromBackend();
});
