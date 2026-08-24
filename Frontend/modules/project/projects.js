/**
 * ==========================================================================
 * MÓDULO DE PROYECTOS Y PORTAFOLIO - TUESTANTE
 * Maneja la visualización del catálogo de proyectos ejecutados,
 * búsqueda interactiva por palabras clave y paginación dinámicas.
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { obtenerProyectos, resolveImageUrl, extractList } from './project.api.js';
import { backendOrigin } from '../../js/config.js';

function resolveDocumentUrl(docPath) {
    if (!docPath) return null;
    if (docPath.startsWith('http://') || docPath.startsWith('https://')) {
        if (docPath.includes('/media/')) {
            const mediaPath = docPath.substring(docPath.indexOf('/media/'));
            return `${backendOrigin}${mediaPath}`;
        }
        return docPath;
    }
    if (docPath.startsWith('/media/') || docPath.startsWith('media/')) {
        const cleanPath = docPath.startsWith('/') ? docPath : `/${docPath}`;
        return `${backendOrigin}${cleanPath}`;
    }
    if (docPath.startsWith('/')) {
        return `${backendOrigin}${docPath}`;
    }
    return `${backendOrigin}/${docPath}`;
}

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

function mapProject(p) {
    if (!p) return null;
    return {
        id: p.id,
        title: p.project_name || p.name || 'Proyecto TuEstante',
        description: p.description || 'Proyecto de estantería y mobiliario metálico industrial diseñado y ejecutado por TuEstante.',
        image: resolveImageUrl(p.project_images || p.image, '../../assets/images/carrusel-index/Carrousel.png'),
        document: resolveDocumentUrl(p.project_document || p.document)
    };
}

/* Estado global de la vista de proyectos */
let allProjects = [];
let filteredProjects = [];
let currentPage = 1;
const itemsPerPage = 27; // 3 columnas x 9 filas máximo por página

/**
 * Renderiza los proyectos correspondientes a la página actual.
 */
function renderCurrentPageProjects() {
    const gridContainer = document.getElementById('projects-grid');
    const counterEl = document.getElementById('projects-counter');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';

    if (filteredProjects.length === 0) {
        gridContainer.innerHTML = `
            <div class="empty-projects-box">
                <div class="empty-projects-icon">📂</div>
                <h3 class="empty-projects-title">No se encontraron proyectos</h3>
                <p class="empty-projects-desc">Intenta ajustar tu búsqueda para encontrar los proyectos deseados.</p>
            </div>
        `;
        if (counterEl) counterEl.textContent = '0 proyectos encontrador';
        renderPaginationControls(0);
        return;
    }

    if (counterEl) {
        counterEl.textContent = `${filteredProjects.length} proyecto(s) encontrado(s)`;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProjects = filteredProjects.slice(startIndex, endIndex);

    let html = '';
    pageProjects.forEach((p, idx) => {
        const hasDoc = Boolean(p.document);
        html += `
            <div class="project-card" data-project-id="${p.id}" data-doc-url="${p.document || ''}" style="transition-delay: ${(idx % 3) * 0.08}s;">
                <div class="project-card-image-wrapper">
                    <img src="${p.image}" alt="${p.title}" class="project-card-img" loading="lazy">
                    ${hasDoc ? `
                        <span class="project-pdf-badge" title="Ver Documento PDF">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            PDF
                        </span>
                    ` : ''}
                </div>
                <div class="project-card-body">
                    <div>
                        <h3 class="project-title">${p.title}</h3>
                        <p class="project-description">${p.description}</p>
                    </div>
                    <div class="project-card-footer">
                        <span class="project-action-text">
                            ${hasDoc ? 'Ver Documento del Proyecto →' : 'Ver Proyecto →'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });

    gridContainer.innerHTML = html;

    // Agregar escuchadores de eventos para abrir el archivo del proyecto
    gridContainer.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => {
            const docUrl = card.getAttribute('data-doc-url');
            if (docUrl && docUrl.trim() !== '') {
                window.open(docUrl, '_blank', 'noopener,noreferrer');
            } else {
                alert('Este proyecto no tiene un documento PDF adjunto en este momento.');
            }
        });
    });

    // Inicializar IntersectionObserver para animaciones de despliegue al hacer scroll
    initScrollAnimations();

    // Renderizar controles de paginación
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    renderPaginationControls(totalPages);
}

/**
 * Renderiza los botones de la paginación numerada.
 */
function renderPaginationControls(totalPages) {
    const paginationWrapper = document.getElementById('pagination-wrapper');
    if (!paginationWrapper) return;

    if (totalPages <= 1) {
        paginationWrapper.innerHTML = '';
        return;
    }

    let html = '';

    // Botón Anterior
    html += `
        <button class="pagination-btn prev-page-btn" ${currentPage === 1 ? 'disabled' : ''} aria-label="Página anterior">
            Anterior
        </button>
    `;

    // Botones Numerados
    for (let page = 1; page <= totalPages; page++) {
        const activeClass = page === currentPage ? 'active' : '';
        html += `
            <button class="pagination-btn number-page-btn ${activeClass}" data-page="${page}">
                ${page}
            </button>
        `;
    }

    // Botón Siguiente
    html += `
        <button class="pagination-btn next-page-btn" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Página siguiente">
            Siguiente
        </button>
    `;

    paginationWrapper.innerHTML = html;

    // Escuchadores de eventos para los botones de paginación
    paginationWrapper.querySelectorAll('.number-page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.getAttribute('data-page'), 10);
            if (page && page !== currentPage) {
                currentPage = page;
                renderCurrentPageProjects();
                scrollToTopProjects();
            }
        });
    });

    const prevBtn = paginationWrapper.querySelector('.prev-page-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderCurrentPageProjects();
                scrollToTopProjects();
            }
        });
    }

    const nextBtn = paginationWrapper.querySelector('.next-page-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderCurrentPageProjects();
                scrollToTopProjects();
            }
        });
    }
}

function scrollToTopProjects() {
    const catalogSection = document.querySelector('.projects-catalog-section');
    if (catalogSection) {
        catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Inicializa las animaciones de revelado progresivo al hacer scroll.
 */
function initScrollAnimations() {
    const cards = document.querySelectorAll('.project-card');

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px'
        });

        cards.forEach(card => observer.observe(card));
    } else {
        // Fallback si el navegador no soporta IntersectionObserver
        cards.forEach(card => card.classList.add('reveal-visible'));
    }
}

/**
 * Inicializa la búsqueda y filtrado dinámico.
 */
function initProjectsFilter() {
    const searchInput = document.getElementById('project-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        filteredProjects = allProjects.filter(p => {
            return p.title.toLowerCase().includes(query) || p.description.toLowerCase().includes(query);
        });
        currentPage = 1;
        renderCurrentPageProjects();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Navbar y Footer
    await Promise.all([
        loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
        loadComponent('footer-placeholder', '../../components/footer/footer.html')
    ]);

    // 2. Inicializar lógica del Navbar
    initNavbar();
    document.body.classList.add('drawer-collapsed');

    // 3. Cargar datos de proyectos desde el backend
    try {
        const rawRes = await obtenerProyectos();
        const rawList = extractList(rawRes);
        if (rawList.length > 0) {
            allProjects = rawList.map(mapProject).filter(Boolean);
        } else {
            allProjects = [];
        }
    } catch (err) {
        console.error('Error al cargar los proyectos del backend:', err);
        allProjects = [];
    }

    filteredProjects = [...allProjects];

    // 4. Inicializar vista y filtros
    initProjectsFilter();
    renderCurrentPageProjects();
});
