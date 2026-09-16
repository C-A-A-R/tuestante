/**
 * ==========================================================================
 * MÓDULO DE GALERÍA DE INSPIRACIÓN "ESPACIOS REALES" - TUESTANTE
 * Conexión directa y exclusiva al modelo de Galería del backend (apps/gallery).
 * Muestra las imágenes aprobadas del modelo Gallery en el patrón dinámico
 * de cuadrícula con tarjeta CTA "Añadir nueva imagen", estado vacío y visor Lightbox.
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { obtenerGaleria } from './gallery.api.js';
import { backendOrigin } from '../../js/config.js';

// Estado global de la galería
let allGalleryItems = [];
let filteredGalleryItems = [];
let visibleCount = 13; // Lote inicial (1 ciclo completo del patrón: hasta 13 imágenes + 1 tarjeta CTA)

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
 * Consulta la API de Galería del backend Django (apps/gallery) en tiempo real.
 * Solo procesa y muestra los registros correspondientes al modelo Gallery.
 */
async function fetchGalleryFromBackend() {
    try {
        const galResp = await obtenerGaleria();
        const rawGallery = extractList(galResp);

        allGalleryItems = rawGallery
            .filter(item => item.image && item.is_active !== false)
            .map((item, idx) => {
                const title = item.caption || `Espacio Real ${idx + 1}`;
                const description = item.caption || 'Fotografía de la comunidad TuEstante.';
                const author = item.social_media_handle || (item.social_network ? `@${item.social_network}` : '@tuestante.ve');

                return {
                    id: item.id || `gal_${idx}`,
                    title,
                    description,
                    author,
                    socialNetwork: (item.social_network || '').toLowerCase(),
                    socialUrl: item.social_media_url || '',
                    socialHandle: item.social_media_handle || '',
                    mediaType: 'image',
                    image: resolveImageUrl(item.image)
                };
            });

        filteredGalleryItems = [...allGalleryItems];
        renderGalleryPattern();
    } catch (e) {
        console.warn('Backend API de galería no disponible o vacía:', e);
        allGalleryItems = [];
        filteredGalleryItems = [];
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
 * Genera el HTML para una tarjeta de imagen del modelo Gallery (grande o pequeña).
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
        <div class="gallery-card ${sizeClass} ${isVideo ? 'video-card' : ''} fade-in" data-id="${item.id}" tabindex="0" role="button" aria-label="Ver foto: ${item.title}">
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
 * Renderiza el estado vacío (Empty State) cuando no hay imágenes en el modelo Gallery.
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
                <h3 class="gallery-empty-title">Aún no hay fotos en la galería</h3>
                <p class="gallery-empty-desc">
                    Sé el primero en formar parte de nuestra comunidad compartiendo una fotografía de tu espacio organizado con mobiliario metálico de <strong>TuEstante</strong>.
                </p>
                <div class="gallery-empty-actions">
                    <a href="https://www.instagram.com/tuestante.ve/" target="_blank" rel="noopener" class="gallery-empty-btn gallery-empty-btn-instagram">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                        <span>Instagram</span>
                    </a>
                    <a href="https://www.tiktok.com/@tuestante.ve" target="_blank" rel="noopener" class="gallery-empty-btn gallery-empty-btn-tiktok">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.4a6.33 6.33 0 0 0-.85-.06A6.34 6.34 0 0 0 3 15.68a6.34 6.34 0 0 0 6.34 6.34c3.48 0 6.32-2.82 6.34-6.3V8.85a8.28 8.28 0 0 0 4.91 1.59V7a4.81 4.81 0 0 1-1-.31z"/></svg>
                        <span>TikTok</span>
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
 * Renderiza la galería aplicando el patrón secuencial estructurado:
 * 1. Imagen Grande (izq 2x2) + 4 Pequeñas (der 2x2, donde la 1ª es la tarjeta CTA 'Añadir nueva imagen').
 * 2. Orden Inverso: 4 Pequeñas (izq 2x2) + Imagen Grande (der 2x2).
 * 3. Fila de 4 imágenes pequeñas seguidas (1x4).
 */
function renderGalleryPattern() {
    const container = document.getElementById('gallery-grid-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!container) return;

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
    let blockPhase = 0;
    let ctaInserted = false;

    while (itemIdx < visibleItems.length) {
        if (blockPhase === 0) {
            // BLOQUE 1: Imagen Grande a la Izquierda (2x2) + 4 Pequeñas a la Derecha (2x2)
            if (itemIdx < visibleItems.length) {
                htmlBuffer += createCardHtml(visibleItems[itemIdx++], 'large-item');
            }

            if (!ctaInserted) {
                htmlBuffer += createCtaCardHtml();
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

            blockPhase = 0;
        }
    }

    container.innerHTML = htmlBuffer;

    if (loadMoreBtn) {
        if (visibleCount >= filteredGalleryItems.length) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.querySelector('.btn-text').textContent = 'Has visto todas las fotos';
        } else {
            loadMoreBtn.disabled = false;
            loadMoreBtn.querySelector('.btn-text').textContent = 'Mostrar más';
        }
    }

    attachLightboxEvents();
}

/**
 * Asigna los eventos de clic a las tarjetas para abrir el visor Lightbox.
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
 * Abre el visor modal Lightbox con la imagen del modelo Gallery.
 * @param {Object} item Objeto de la galería
 */
function openLightbox(item) {
    const lightbox = document.getElementById('gallery-lightbox');
    const mediaWrapper = document.getElementById('lightbox-media-wrapper');
    const titleEl = document.getElementById('lightbox-title');
    const descEl = document.getElementById('lightbox-desc');
    const tagEl = document.getElementById('lightbox-tag');

    if (!lightbox || !mediaWrapper) return;

    mediaWrapper.innerHTML = `
        <img id="lightbox-img" src="${item.image}" alt="${item.title}" class="lightbox-img" onerror="this.src='../../assets/images/categoria/estante.png'">
    `;

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
 * Cierra el visor modal Lightbox.
 */
function closeLightbox() {
    const lightbox = document.getElementById('gallery-lightbox');
    if (!lightbox) return;

    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

/**
 * Inicializa la acción del botón "Mostrar más".
 */
function initLoadMore() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!loadMoreBtn) return;

    loadMoreBtn.addEventListener('click', () => {
        visibleCount += 13;
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

    // 3. Inicializar eventos base
    initLoadMore();
    initLightboxEvents();

    // 4. Consultar directamente al backend Django (apps/gallery)
    await fetchGalleryFromBackend();
});
