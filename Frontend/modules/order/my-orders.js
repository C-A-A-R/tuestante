/**
 * ==========================================================================
 * LÓGICA DE LA PANTALLA 'MIS COMPRAS' - TUESTANTE
 * Maneja la visualización de compras simplificadas con imagen principal,
 * productos separados por comas, filtros por fecha (3 meses, 6 meses, este año),
 * buscador por productos, ordenamiento prioritario y paginación de 10 elementos.
 * ==========================================================================
 */

import { obtenerMisPedidos } from './orders.api.js';
import { getAccessToken, getCurrentUser } from '../../js/storage.js';
import { resolveImageUrl, extractList } from '../../js/api.js';
import { showErrorToast } from '../../components/toast/toast.js';
import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';

// Diccionario de Estados de Orden
const ORDER_STATUS_CONFIG = {
    'pending_initial_payment': { label: 'Pendiente pago inicial', className: 'status-pending' },
    'initial_payment_review': { label: 'Pago inicial en revisión', className: 'status-review' },
    'manufacturing': { label: 'En fabricación', className: 'status-manufacturing' },
    'waiting_final_payment': { label: 'Esperando pago final', className: 'status-pending' },
    'final_payment_review': { label: 'Pago final en revisión', className: 'status-review' },
    'shipped': { label: 'Enviado / En camino', className: 'status-shipped' },
    'finalized': { label: 'Finalizado / Entregado', className: 'status-finalized' },
    'returned_manufacturing': { label: 'En refabricación', className: 'status-manufacturing' },
    'cancelled': { label: 'Cancelado', className: 'status-cancelled' }
};

const ITEMS_PER_PAGE = 10;

// Estado Global
let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
let selectedDatePeriod = 'all'; // 'all', '3_months', '6_months', 'this_year'
let currentSearchTerm = '';

// Cargar Navbar y Footer
async function loadComponent(elementId, filePath) {
    try {
        const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
            const html = await response.text();
            const el = document.getElementById(elementId);
            if (el) el.innerHTML = html;
        }
    } catch (err) {
        console.error(`Error al cargar componente ${filePath}:`, err);
    }
}

// Inicialización de la pantalla
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar Autenticación
    const token = getAccessToken();
    if (!token) {
        window.location.href = `../../modules/auth/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
    }

    // 2. Cargar Navbar y Footer
    await loadComponent('navbar-container', '../../components/navbar/navbar.html');
    await loadComponent('footer-container', '../../components/footer/footer.html');
    initNavbar();
    initFooter();

    // 3. Configurar Etiqueta de "Este año (YYYY)"
    const labelThisYear = document.getElementById('label-this-year');
    if (labelThisYear) {
        labelThisYear.textContent = `Este año (${new Date().getFullYear()})`;
    }

    // 4. Configurar Eventos de Filtros de Fecha y Buscador
    setupDateFilterEvents();
    setupProductSearchEvents();

    // 5. Cargar Compras desde la API
    await fetchOrders();
});

/**
 * Consulta la API de pedidos con la ruta optimizada:
 * GET /api/orders/my-orders/?prioritize_unfinished=true
 */
async function fetchOrders() {
    const loadingState = document.getElementById('orders-loading-state');
    const listContainer = document.getElementById('orders-list-container');
    const emptyState = document.getElementById('orders-empty-state');
    const paginationContainer = document.getElementById('orders-pagination-container');

    if (loadingState) loadingState.style.display = 'block';
    if (listContainer) listContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (paginationContainer) paginationContainer.style.display = 'none';

    try {
        const response = await obtenerMisPedidos({ prioritize_unfinished: true });
        const ordersData = extractList(response);

        // Ordenamiento prioritario:
        // 1. Órdenes no finalizadas primero
        // 2. Dentro de cada grupo, ordenadas de más recientes a más antiguas
        allOrders = sortOrdersPrioritizingUnfinished(ordersData);

        // Aplicar filtros iniciales y renderizar
        applyFiltersAndRender();

    } catch (err) {
        console.error('Error al obtener el historial de compras:', err);
        showErrorToast('Error al cargar pedidos', 'No se pudieron consultar tus compras. Por favor intenta nuevamente.');
    } finally {
        if (loadingState) loadingState.style.display = 'none';
    }
}

/**
 * Ordena las compras colocando las no finalizadas de primeras
 * y ordenando por fecha descendente dentro de cada bloque.
 */
function sortOrdersPrioritizingUnfinished(ordersList) {
    if (!Array.isArray(ordersList)) return [];

    return [...ordersList].sort((a, b) => {
        const aFinalized = (a.status === 'finalized' || a.status === 'cancelled') ? 1 : 0;
        const bFinalized = (b.status === 'finalized' || b.status === 'cancelled') ? 1 : 0;

        if (aFinalized !== bFinalized) {
            return aFinalized - bFinalized;
        }

        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
    });
}

/**
 * Aplica los filtros de fecha y búsqueda por productos sobre la lista de pedidos.
 */
function applyFiltersAndRender() {
    let result = [...allOrders];

    // 1. Filtrar por período de fecha
    if (selectedDatePeriod !== 'all') {
        result = result.filter(order => isWithinDatePeriod(order.created_at, selectedDatePeriod));
    }

    // 2. Filtrar por búsqueda en productos de la orden
    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase().trim();
        result = result.filter(order => {
            if (!Array.isArray(order.details)) return false;
            return order.details.some(d => {
                const prod = d.order_products?.[0]?.product;
                const prodName = (prod?.product_name || prod?.name || '').toLowerCase();
                const notes = (d.notes || '').toLowerCase();
                return prodName.includes(term) || notes.includes(term);
            });
        });
    }

    filteredOrders = result;
    currentPage = 1;
    renderCurrentPage();
}

/**
 * Valida si una fecha cae dentro del período seleccionado.
 */
function isWithinDatePeriod(dateString, period) {
    if (!dateString || period === 'all') return true;
    const orderDate = new Date(dateString);
    if (isNaN(orderDate.getTime())) return true;

    const now = new Date();

    if (period === '3_months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setDate(now.getDate() - 90);
        return orderDate >= threeMonthsAgo;
    }

    if (period === '6_months') {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setDate(now.getDate() - 180);
        return orderDate >= sixMonthsAgo;
    }

    if (period === 'this_year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return orderDate >= startOfYear;
    }

    return true;
}

/**
 * Renderiza la lista paginada de 10 compras por vista.
 */
function renderCurrentPage() {
    const listContainer = document.getElementById('orders-list-container');
    const emptyState = document.getElementById('orders-empty-state');
    const noSearchResults = document.getElementById('orders-no-search-results');
    const paginationContainer = document.getElementById('orders-pagination-container');

    if (!listContainer) return;

    // Caso 1: Usuario no tiene ninguna orden registrada
    if (allOrders.length === 0) {
        listContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        if (noSearchResults) noSearchResults.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }

    // Caso 2: La búsqueda o filtro de fecha no arrojó resultados
    if (filteredOrders.length === 0) {
        listContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (noSearchResults) noSearchResults.style.display = 'flex';
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }

    // Caso 3: Mostrar resultados
    if (emptyState) emptyState.style.display = 'none';
    if (noSearchResults) noSearchResults.style.display = 'none';
    listContainer.style.display = 'flex';

    // Segmentar para la página actual (máximo 10 compras)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredOrders.length);
    const currentBatch = filteredOrders.slice(startIndex, endIndex);

    listContainer.innerHTML = currentBatch.map(order => buildSimplifiedOrderCardHtml(order)).join('');

    // Asignar clics a las tarjetas para abrir el detalle
    listContainer.querySelectorAll('.order-card-link').forEach(card => {
        card.addEventListener('click', (e) => {
            // Si el clic fue en un enlace o botón interno, permitir su flujo
            if (e.target.closest('a, button')) return;
            const orderId = card.dataset.orderId;
            if (orderId) {
                window.location.href = `./order-details.html?id=${orderId}`;
            }
        });
    });

    // Renderizar controles de paginación
    renderPaginationControls(filteredOrders.length, startIndex, endIndex);
}

/**
 * Genera el HTML simplificado y limpio de la tarjeta de compra:
 * - Sin número de orden en cabecera
 * - Fecha a la izquierda y badge de estado a la derecha
 * - Imagen del primer producto a la izquierda
 * - Lista de productos en una misma fila separados por comas
 * - Monto total en dólares
 * - Sin cajas de pago repetidas ni botones redundantes
 */
function buildSimplifiedOrderCardHtml(order) {
    const statusKey = order.status || 'pending_initial_payment';
    const statusConfig = ORDER_STATUS_CONFIG[statusKey] || { label: statusKey, className: 'status-pending' };
    const formattedDate = order.created_at ? formatReadableDate(order.created_at) : 'Fecha no registrada';
    const totalPriceUSD = parseFloat(order.total_price || 0).toFixed(2);

    const details = Array.isArray(order.details) ? order.details : [];

    // Obtener la imagen del primer producto buscando en todos los campos posibles
    let firstImg = '';
    let firstProdName = 'Producto TuEstante';

    for (const d of details) {
        const prod = d.order_products?.[0]?.product || d.product || d;
        const img = prod?.image || prod?.product_image || prod?.product?.image || d.product_image || d.image;
        if (img) {
            firstImg = img;
            firstProdName = prod?.product_name || prod?.name || firstProdName;
            break;
        }
        if (prod?.product_name || prod?.name) {
            firstProdName = prod.product_name || prod.name;
        }
    }

    if (!firstImg && order.image) {
        firstImg = order.image;
    }

    const firstImgSrc = firstImg ? resolveImageUrl(firstImg, '../../assets/images/categoria/estante.png') : '';

    // Lista de productos en una sola fila separados por comas
    const productsListText = details.length > 0
        ? details.map(d => {
            const prod = d.order_products?.[0]?.product;
            const name = prod?.product_name || prod?.name || 'Mueble';
            const qty = d.quantity || 1;
            return `${name}${qty > 1 ? ` (${qty} unid.)` : ''}`;
        }).join(', ')
        : 'Sin productos registrados';

    return `
        <article class="simplified-order-card order-card-link" data-order-id="${order.id}">
            <!-- Cabecera: Fecha a la izquierda y Estado a la derecha (Sin número de orden) -->
            <div class="simplified-card-header">
                <div class="simplified-card-date">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>${formattedDate}</span>
                </div>
                <span class="status-badge ${statusConfig.className}">${statusConfig.label}</span>
            </div>

            <!-- Cuerpo: Imagen del primer producto, lista separada por comas y total -->
            <div class="simplified-card-body">
                <!-- Imagen del primer producto -->
                <div class="simplified-image-col">
                    ${firstImgSrc ? `
                        <img src="${escapeHtml(firstImgSrc)}" alt="${escapeHtml(firstProdName)}" class="simplified-product-img" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'simplified-img-placeholder\\'>🪵</div>'">
                    ` : `
                        <div class="simplified-img-placeholder">🪵</div>
                    `}
                </div>

                <!-- Detalles de productos en una sola fila y precio -->
                <div class="simplified-info-col">
                    <p class="simplified-products-text" title="${escapeHtml(productsListText)}">
                        ${escapeHtml(productsListText)}
                    </p>
                    <div class="simplified-pricing-row">
                        <span class="simplified-price-label">Total:</span>
                        <span class="simplified-price-value">$${totalPriceUSD} USD</span>
                    </div>
                </div>

                <!-- Botón de acción directo -->
                <div class="simplified-action-col">
                    <a href="./order-details.html?id=${order.id}" class="btn-view-simplified">
                        <span>Ver Detalle</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </a>
                </div>
            </div>
        </article>
    `;
}

/**
 * Configura los botones de filtro por período de fecha.
 */
function setupDateFilterEvents() {
    const filterButtons = document.querySelectorAll('.date-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            selectedDatePeriod = btn.dataset.period || 'all';
            applyFiltersAndRender();
        });
    });

    // Botón de restablecer filtros en vista sin resultados
    const btnReset = document.getElementById('btn-reset-filters');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            selectedDatePeriod = 'all';
            currentSearchTerm = '';
            const searchInput = document.getElementById('orders-search-input');
            if (searchInput) searchInput.value = '';
            const btnClear = document.getElementById('btn-clear-search');
            if (btnClear) btnClear.style.display = 'none';

            filterButtons.forEach(b => {
                if (b.dataset.period === 'all') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });

            applyFiltersAndRender();
        });
    }
}

/**
 * Configura el buscador enfocado exclusivamente en productos de la orden.
 */
function setupProductSearchEvents() {
    const searchInput = document.getElementById('orders-search-input');
    const btnClear = document.getElementById('btn-clear-search');

    if (!searchInput) return;

    let debounceTimer = null;

    searchInput.addEventListener('input', () => {
        const val = searchInput.value;
        if (btnClear) btnClear.style.display = val ? 'block' : 'none';

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearchTerm = val;
            applyFiltersAndRender();
        }, 250);
    });

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            searchInput.value = '';
            btnClear.style.display = 'none';
            currentSearchTerm = '';
            applyFiltersAndRender();
            searchInput.focus();
        });
    }
}

/**
 * Renderiza los botones de navegación de paginación (máximo 10 compras por página).
 */
function renderPaginationControls(totalItems, startIndex, endIndex) {
    const container = document.getElementById('orders-pagination-container');
    const rangeText = document.getElementById('pagination-range-text');
    const controls = document.getElementById('pagination-controls');

    if (!container || !controls) return;

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    if (rangeText) {
        rangeText.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${totalItems} compras`;
    }

    let buttonsHtml = `
        <button type="button" class="page-btn page-prev" ${currentPage === 1 ? 'disabled' : ''} aria-label="Página anterior">
            &laquo; Anterior
        </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
            buttonsHtml += `
                <button type="button" class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">
                    ${p}
                </button>
            `;
        } else if (p === currentPage - 2 || p === currentPage + 2) {
            buttonsHtml += `<span class="page-ellipsis">...</span>`;
        }
    }

    buttonsHtml += `
        <button type="button" class="page-btn page-next" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Página siguiente">
            Siguiente &raquo;
        </button>
    `;

    controls.innerHTML = buttonsHtml;

    // Asignar eventos de clic en los botones de página
    controls.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pageNum = parseInt(btn.dataset.page, 10);
            if (!isNaN(pageNum) && pageNum !== currentPage) {
                currentPage = pageNum;
                renderCurrentPage();
                window.scrollTo({ top: 120, behavior: 'smooth' });
            }
        });
    });

    const prevBtn = controls.querySelector('.page-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentPage > 1) {
                currentPage--;
                renderCurrentPage();
                window.scrollTo({ top: 120, behavior: 'smooth' });
            }
        });
    }

    const nextBtn = controls.querySelector('.page-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentPage < totalPages) {
                currentPage++;
                renderCurrentPage();
                window.scrollTo({ top: 120, behavior: 'smooth' });
            }
        });
    }
}

/**
 * Formatea fechas al formato en español (ej. '26 ago. 2026').
 */
function formatReadableDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-VE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

/**
 * Sanitiza texto simple para evitar inyecciones HTML.
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
