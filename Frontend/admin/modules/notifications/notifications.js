/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DE NOTIFICACIONES (NOTIFICATIONS.JS)
 * ==========================================================================
 * Orquesta la interfaz completa del módulo de notificaciones:
 * - Integración con Navbar, Drawer y Footer compartidos.
 * - Alternancia fluida entre las dos tablas:
 *     1. Lista de notificaciones
 *     2. Pedidos con notificaciones (acordeón expandible)
 * - Modal flotante a la derecha (Quick View) con visualización de adjuntos.
 * - Visor Lightbox para imágenes y videos adjuntos.
 * - Formulario modal para composición de nuevas notificaciones manuales.
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { showConfirmModal } from '../../components/modal/modal.js';
import {
  obtenerNotificaciones,
  obtenerNotificacionesPorPedido,
  obtenerDetalleNotificacion,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  eliminarNotificacion,
  crearNotificacionManual,
  obtenerPedidosSelector,
  obtenerClientesSelector
} from './notifications.api.js';

// Estado global del módulo
const state = {
  currentTab: 'notifications', // 'notifications' | 'orders'
  
  // Estado para Tabla 1 (Lista de notificaciones)
  notifications: [],
  totalNotifications: 0,
  currentPage: 1,
  pageSize: 10,
  totalPages: 1,
  
  // Estado para Tabla 2 (Pedidos con notificaciones)
  ordersWithNotifs: [],
  expandedOrders: new Set(),
  ordersPage: 1,
  ordersPageSize: 10,
  
  // Filtros compartidos
  filters: {
    search: '',
    type: 'all',
    status: 'all'
  },
  
  // Selección activa para Quick View flotante
  activeQuickViewNotif: null,
  
  // Menú contextual flotante
  contextMenuTarget: null,
  orderContextMenuTarget: null,
  
  // Archivos seleccionados para creación
  selectedFiles: []
};

let searchDebounceTimer = null;

/**
 * Muestra una alerta Toast temporal en pantalla
 */
function showToast(type = 'success', title = '', message = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const iconSvg = type === 'success'
    ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
    : type === 'error'
    ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
    : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';

  toast.innerHTML = `
    <div class="toast-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        ${iconSvg}
      </svg>
    </div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Cerrar notificación">&times;</button>
  `;

  container.appendChild(toast);

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

/**
 * Escapa cadenas para prevenir inyecciones XSS
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formatea fechas a formato legible (DD/MM/YYYY HH:mm)
 */
function formatDateTime(dateStr) {
  if (!dateStr) return { date: '-', time: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: String(dateStr).substring(0, 10), time: '' };
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}`
    };
  } catch {
    return { date: '-', time: '' };
  }
}

/**
 * Formatea moneda USD
 */
function formatCurrency(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(num);
}

/**
 * Resuelve URL completa de archivo multimedia
 */
function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = window.location.origin;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ==========================================================================
// INICIALIZACIÓN Y CONFIGURACIÓN DE PESTAÑAS
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar componentes compartidos de TuEstante
  try {
    await loadAdminComponents({ activePage: 'notificaciones' });
  } catch (err) {
    console.warn('[Notificaciones] Error cargando componentes compartidos:', err);
  }

  // 2. Configurar eventos de pestañas
  setupTabs();

  // 3. Configurar filtros y buscador en vivo
  setupFilters();

  // 4. Configurar modal flotante a la derecha (Quick View)
  setupQuickViewFloating();

  // 5. Configurar modal de nueva notificación manual
  setupCreateNotificationModal();

  // 6. Configurar Lightbox de medios
  setupMediaLightbox();

  // 7. Configurar menú contextual de acciones para notificaciones y pedidos
  setupContextMenu();
  setupOrderContextMenu();

  // 8. Configurar modal dedicado de pedido con notificaciones
  setupOrderNotificationsModal();

  // 9. Cargar datos iniciales
  cargarDatosVistaActual();
});

/**
 * Alternancia entre las dos pestañas / tablas
 */
function setupTabs() {
  const tabNotifs = document.getElementById('tab-notifications');
  const tabOrders = document.getElementById('tab-orders');
  const viewNotifs = document.getElementById('view-notifications-list');
  const viewOrders = document.getElementById('view-orders-list');

  tabNotifs.addEventListener('click', () => {
    if (state.currentTab === 'notifications') return;
    state.currentTab = 'notifications';
    tabNotifs.classList.add('active');
    tabNotifs.setAttribute('aria-selected', 'true');
    tabOrders.classList.remove('active');
    tabOrders.setAttribute('aria-selected', 'false');

    viewNotifs.style.display = 'block';
    viewOrders.style.display = 'none';

    cargarNotificaciones();
  });

  tabOrders.addEventListener('click', () => {
    if (state.currentTab === 'orders') return;
    state.currentTab = 'orders';
    tabOrders.classList.add('active');
    tabOrders.setAttribute('aria-selected', 'true');
    tabNotifs.classList.remove('active');
    tabNotifs.setAttribute('aria-selected', 'false');

    viewOrders.style.display = 'block';
    viewNotifs.style.display = 'none';

    cargarPedidosConNotificaciones();
  });
}

/**
 * Carga los datos correspondientes a la pestaña activa
 */
function cargarDatosVistaActual() {
  if (state.currentTab === 'notifications') {
    cargarNotificaciones();
  } else {
    cargarPedidosConNotificaciones();
  }
}

/**
 * Configura los controles de búsqueda y selectores
 */
function setupFilters() {
  const searchInput = document.getElementById('input-search');
  const selectType = document.getElementById('select-type');
  const selectStatus = document.getElementById('select-status');
  const btnReset = document.getElementById('btn-reset-filters');
  const btnClearSearch = document.getElementById('btn-clear-search');

  // Búsqueda con debounce de 300ms
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      state.currentPage = 1;
      cargarDatosVistaActual();
    }, 300);
  });

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput.value) {
        searchInput.value = '';
        state.filters.search = '';
        state.currentPage = 1;
        cargarDatosVistaActual();
      }
    });
  }

  // Filtro de Tipo
  selectType.addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    state.currentPage = 1;
    cargarDatosVistaActual();
  });

  // Filtro de Estado
  selectStatus.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    state.currentPage = 1;
    cargarDatosVistaActual();
  });

  // Restablecer Filtros
  btnReset.addEventListener('click', () => {
    searchInput.value = '';
    selectType.value = 'all';
    selectStatus.value = 'all';
    state.filters.search = '';
    state.filters.type = 'all';
    state.filters.status = 'all';
    state.currentPage = 1;
    cargarDatosVistaActual();
    showToast('info', 'Filtros Reiniciados', 'Se han restablecido los criterios de búsqueda.');
  });
}

// ==========================================================================
// TABLA 1: LISTA DE NOTIFICACIONES DIRECTA
// ==========================================================================
async function cargarNotificaciones() {
  const loading = document.getElementById('loading-notifications');
  const empty = document.getElementById('empty-notifications');
  const tbody = document.getElementById('tbody-notifications');
  const paginationContainer = document.getElementById('pagination-notifications-container');

  tbody.innerHTML = '';
  loading.style.display = 'flex';
  empty.style.display = 'none';

  try {
    const isManualParam = state.filters.type === 'manual' ? 'true' : state.filters.type === 'auto' ? 'false' : undefined;
    const res = await obtenerNotificaciones({
      page: state.currentPage,
      pageSize: state.pageSize,
      search: state.filters.search,
      isManual: isManualParam,
      status: state.filters.status
    });

    const notifs = Array.isArray(res) ? res : (res?.results || []);
    state.notifications = notifs;
    state.totalNotifications = res?.count ?? notifs.length;
    state.totalPages = Math.ceil(state.totalNotifications / state.pageSize) || 1;

    loading.style.display = 'none';

    if (!notifs.length) {
      empty.style.display = 'flex';
      paginationContainer.style.display = 'none';
      return;
    }

    paginationContainer.style.display = 'flex';
    renderTablaNotificaciones(notifs);
    renderPaginacionNotificaciones();

  } catch (err) {
    loading.style.display = 'none';
    console.error('[Notificaciones] Error cargando lista:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #dc2626; padding: 32px;">
          Error al cargar las notificaciones. Por favor, intenta de nuevo.
        </td>
      </tr>
    `;
  }
}

/**
 * Renderiza las filas de la Tabla 1
 */
function renderTablaNotificaciones(items) {
  const tbody = document.getElementById('tbody-notifications');
  tbody.innerHTML = items.map((notif) => {
    const orderNumber = notif.order_number || (notif.order_id ? `#${String(notif.order_id).padStart(5, '0')}` : '-');
    const orderLink = notif.order_id ? `../order/order-detail.html?id=${notif.order_id}` : '#';
    const clientName = notif.user_name || notif.user || 'Cliente';
    const isManual = Boolean(notif.is_manual);
    const typeBadge = isManual
      ? '<span class="badge badge-manual">Manual</span>'
      : '<span class="badge badge-auto">Automática</span>';

    // Adjuntos
    const imgCount = notif.images_count || (notif.media_files ? notif.media_files.filter(m => m.media_type === 'image').length : 0);
    const vidCount = notif.videos_count || (notif.media_files ? notif.media_files.filter(m => m.media_type === 'video').length : 0);
    let attachmentsHtml = '-';
    if (imgCount > 0 || vidCount > 0) {
      const parts = [];
      if (imgCount > 0) {
        parts.push(`
          <span class="attachment-chip" title="${imgCount} imagen(es)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            ${imgCount}
          </span>
        `);
      }
      if (vidCount > 0) {
        parts.push(`
          <span class="attachment-chip" title="${vidCount} video(s)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            ${vidCount}
          </span>
        `);
      }
      attachmentsHtml = `<div class="cell-attachments-badge">${parts.join('')}</div>`;
    }

    // Fecha
    const dt = formatDateTime(notif.created_at);

    // Estado
    let statusBadge = '<span class="badge badge-sent">Enviada</span>';
    if (notif.status === 'pending') {
      statusBadge = '<span class="badge badge-pending">Pendiente</span>';
    } else if (notif.status === 'read' || notif.is_read) {
      statusBadge = '<span class="badge badge-read">Leída</span>';
    }

    return `
      <tr data-notif-id="${notif.id}">
        <!-- Pedido -->
        <td>
          ${notif.order_id 
            ? `<a href="${orderLink}" class="col-order-link">${escapeHtml(orderNumber)}</a>` 
            : '<span style="color: #94a3b8;">-</span>'}
        </td>
        <!-- Cliente -->
        <td>
          <span class="col-client-name">${escapeHtml(clientName)}</span>
        </td>
        <!-- Asunto / Mensaje -->
        <td>
          <div class="cell-subject-message">
            <span class="cell-subject">${escapeHtml(notif.title || 'Sin asunto')}</span>
            <span class="cell-message-snippet">${escapeHtml(notif.message || '')}</span>
          </div>
        </td>
        <!-- Tipo -->
        <td>${typeBadge}</td>
        <!-- Adjuntos -->
        <td>${attachmentsHtml}</td>
        <!-- Fecha -->
        <td>
          <div class="cell-datetime">
            <span class="cell-date-main">${dt.date}</span>
            <span class="cell-date-sub">${dt.time}</span>
          </div>
        </td>
        <!-- Estado -->
        <td>${statusBadge}</td>
        <!-- Acciones -->
        <td>
          <div class="cell-actions">
            <button type="button" class="btn-table-action btn-view-quick" data-notif-id="${notif.id}" title="Vista rápida de notificación" aria-label="Ver">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" class="btn-table-action btn-more-actions" data-notif-id="${notif.id}" title="Más opciones" aria-label="Opciones">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Vincular eventos de botones de acción
  tbody.querySelectorAll('.btn-view-quick').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-notif-id');
      const found = state.notifications.find(n => String(n.id) === String(id));
      if (found) {
        abrirQuickViewFlotante(found);
      }
    });
  });

  tbody.querySelectorAll('.btn-more-actions').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-notif-id');
      const found = state.notifications.find(n => String(n.id) === String(id));
      if (found) {
        mostrarMenuContextual(btn, found);
      }
    });
  });
}

/**
 * Renderiza la paginación de la Tabla 1
 */
function renderPaginacionNotificaciones() {
  const infoEl = document.getElementById('pagination-notifications-info');
  const controlsEl = document.getElementById('pagination-notifications-controls');

  const start = (state.currentPage - 1) * state.pageSize + 1;
  const end = Math.min(state.currentPage * state.pageSize, state.totalNotifications);
  infoEl.textContent = `Mostrando ${start} a ${end} de ${state.totalNotifications} notificaciones`;

  let html = `
    <button type="button" class="page-btn" id="btn-prev-page" ${state.currentPage <= 1 ? 'disabled' : ''}>
      &lt; Anterior
    </button>
  `;

  for (let i = 1; i <= state.totalPages; i++) {
    if (i === 1 || i === state.totalPages || (i >= state.currentPage - 1 && i <= state.currentPage + 1)) {
      html += `
        <button type="button" class="page-btn ${i === state.currentPage ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    } else if (i === state.currentPage - 2 || i === state.currentPage + 2) {
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
    }
  }

  html += `
    <button type="button" class="page-btn" id="btn-next-page" ${state.currentPage >= state.totalPages ? 'disabled' : ''}>
      Siguiente &gt;
    </button>
  `;

  controlsEl.innerHTML = html;

  controlsEl.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (p !== state.currentPage) {
        state.currentPage = p;
        cargarNotificaciones();
      }
    });
  });

  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        cargarNotificaciones();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.currentPage < state.totalPages) {
        state.currentPage++;
        cargarNotificaciones();
      }
    });
  }
}

// ==========================================================================
// TABLA 2: PEDIDOS CON NOTIFICACIONES (ACORDEÓN EXPANDIBLE)
// ==========================================================================
async function cargarPedidosConNotificaciones() {
  const loading = document.getElementById('loading-orders');
  const empty = document.getElementById('empty-orders');
  const tbody = document.getElementById('tbody-orders');
  const paginationContainer = document.getElementById('pagination-orders-container');

  tbody.innerHTML = '';
  loading.style.display = 'flex';
  empty.style.display = 'none';

  try {
    const res = await obtenerNotificacionesPorPedido({
      search: state.filters.search,
      type: state.filters.type,
      status: state.filters.status
    });

    const orders = Array.isArray(res) ? res : [];
    state.ordersWithNotifs = orders;

    loading.style.display = 'none';

    if (!orders.length) {
      empty.style.display = 'flex';
      paginationContainer.style.display = 'none';
      return;
    }

    paginationContainer.style.display = 'flex';
    renderTablaPedidos(orders);
    renderPaginacionPedidos(orders.length);

  } catch (err) {
    loading.style.display = 'none';
    console.error('[Notificaciones] Error cargando pedidos con notificaciones:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #dc2626; padding: 32px;">
          Error al cargar pedidos. Por favor, intenta de nuevo.
        </td>
      </tr>
    `;
  }
}

/**
 * Renderiza las filas de la Tabla 2
 */
function renderTablaPedidos(orders) {
  const tbody = document.getElementById('tbody-orders');

  tbody.innerHTML = orders.map((ord) => {
    const orderNumber = ord.order_number || `#${String(ord.order_id).padStart(5, '0')}`;
    const orderLink = `../order/order-detail.html?id=${ord.order_id}`;
    const clientName = ord.client_name || 'Cliente';
    const totalFormatted = formatCurrency(ord.total_price);
    const isExpanded = state.expandedOrders.has(ord.order_id);

    // Estado del pedido
    const statusDisplay = ord.order_status_display || ord.order_status || 'Registrado';
    let statusClass = 'badge-status-manufacturing';
    if (ord.order_status === 'shipped') statusClass = 'badge-status-shipped';
    else if (ord.order_status === 'finalized') statusClass = 'badge-status-finalized';
    else if (ord.order_status?.includes('pending')) statusClass = 'badge-status-pending';

    // Última notificación
    const lastNotif = ord.last_notification;
    let lastNotifText = '-';
    if (lastNotif) {
      const dt = formatDateTime(lastNotif.created_at);
      const tag = lastNotif.is_manual ? '(Manual)' : '(Automática)';
      lastNotifText = `
        <div class="cell-datetime">
          <span class="cell-date-main">${dt.date} ${dt.time}</span>
          <span class="cell-date-sub">${tag}</span>
        </div>
      `;
    }

    // Subtabla de notificaciones anidadas
    const notifsList = ord.notifications || [];
    const nestedRowsHtml = notifsList.map((subN) => {
      const subDt = formatDateTime(subN.created_at);
      const subTypeBadge = subN.is_manual
        ? '<span class="badge badge-manual">Manual</span>'
        : '<span class="badge badge-auto">Automática</span>';

      const imgC = subN.images_count || (subN.media_files ? subN.media_files.filter(m => m.media_type === 'image').length : 0);
      const vidC = subN.videos_count || (subN.media_files ? subN.media_files.filter(m => m.media_type === 'video').length : 0);
      let subAttachmentsHtml = '-';
      if (imgC > 0 || vidC > 0) {
        const parts = [];
        if (imgC > 0) parts.push(`<span class="attachment-chip"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> ${imgC}</span>`);
        if (vidC > 0) parts.push(`<span class="attachment-chip"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg> ${vidC}</span>`);
        subAttachmentsHtml = `<div class="cell-attachments-badge">${parts.join('')}</div>`;
      }

      let subStatus = '<span class="badge badge-sent">Enviada</span>';
      if (subN.status === 'pending') subStatus = '<span class="badge badge-pending">Pendiente</span>';
      else if (subN.status === 'read' || subN.is_read) subStatus = '<span class="badge badge-read">Leída</span>';

      return `
        <tr>
          <td><span style="font-weight: 500;">${subDt.date} ${subDt.time}</span></td>
          <td><span style="font-weight: 600; color: #1e293b;">${escapeHtml(subN.title || 'Notificación')}</span></td>
          <td>${subTypeBadge}</td>
          <td>${subAttachmentsHtml}</td>
          <td>${subStatus}</td>
          <td style="text-align: center;">
            <button type="button" class="btn-table-action btn-view-quick" data-notif-id="${subN.id}" title="Ver vista rápida">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!-- Fila Principal de la Orden -->
      <tr class="row-order-main" data-order-id="${ord.order_id}">
        <!-- Pedido (Chevron + #00125) -->
        <td>
          <div class="cell-order-expand">
            <button type="button" class="chevron-expand-btn ${isExpanded ? 'is-expanded' : ''}" data-order-toggle="${ord.order_id}" aria-label="Expandir pedido">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <a href="${orderLink}" class="col-order-link" style="font-weight: 700;">${escapeHtml(orderNumber)}</a>
          </div>
        </td>
        <!-- Cliente -->
        <td>
          <span class="col-client-name">${escapeHtml(clientName)}</span>
        </td>
        <!-- Total -->
        <td>
          <span style="font-weight: 600; color: #0f172a;">${totalFormatted}</span>
        </td>
        <!-- Estado del pedido -->
        <td>
          <span class="badge-order-status ${statusClass}">${escapeHtml(statusDisplay)}</span>
        </td>
        <!-- Última notificación -->
        <td>${lastNotifText}</td>
        <!-- Contador de Notificaciones -->
        <td style="text-align: center;">
          <span class="badge-count-pill">${ord.notifications_count || notifsList.length}</span>
        </td>
        <!-- Acciones -->
        <td>
          <div class="cell-actions">
            <button type="button" class="btn-table-action btn-view-order-modal" data-order-id="${ord.order_id}" title="Ver resumen y notificaciones" aria-label="Ver resumen">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" class="btn-table-action btn-more-order-actions" data-order-id="${ord.order_id}" title="Opciones de pedido" aria-label="Opciones">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
          </div>
        </td>
      </tr>

      <!-- Fila Expandible con Historial de Notificaciones de la Orden -->
      <tr class="expanded-order-details-row" id="expanded-row-${ord.order_id}" style="display: ${isExpanded ? 'table-row' : 'none'};">
        <td colspan="7">
          <div class="nested-notifications-card">
            <table class="nested-table">
              <thead>
                <tr>
                  <th style="width: 170px;">Fecha</th>
                  <th>Asunto / Mensaje</th>
                  <th style="width: 120px;">Tipo</th>
                  <th style="width: 120px;">Adjuntos</th>
                  <th style="width: 120px;">Estado</th>
                  <th style="width: 70px; text-align: center;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${nestedRowsHtml || '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Sin notificaciones registradas</td></tr>'}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Vincular eventos de expansión de acordeón
  tbody.querySelectorAll('[data-order-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = parseInt(btn.getAttribute('data-order-toggle'), 10);
      toggleExpandirPedido(orderId);
    });
  });

  // Vincular eventos para ver resumen y notificaciones del pedido
  tbody.querySelectorAll('.btn-view-order-modal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.getAttribute('data-order-id');
      const order = state.ordersWithNotifs.find(o => String(o.order_id) === String(orderId));
      if (order) {
        abrirModalPedidoNotificaciones(order);
      }
    });
  });

  // Vincular eventos de 3 puntos (menú contextual de opciones para pedidos)
  tbody.querySelectorAll('.btn-more-order-actions').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.getAttribute('data-order-id');
      const order = state.ordersWithNotifs.find(o => String(o.order_id) === String(orderId));
      if (order) {
        mostrarMenuContextualOrden(btn, order);
      }
    });
  });

  // Vincular eventos de vista rápida en botones de la subtabla anidada
  tbody.querySelectorAll('.nested-table .btn-view-quick').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const notifId = btn.getAttribute('data-notif-id');
      let found = null;
      for (const ord of state.ordersWithNotifs) {
        found = (ord.notifications || []).find(n => String(n.id) === String(notifId));
        if (found) break;
      }
      if (!found && state.notifications.length) {
        found = state.notifications.find(n => String(n.id) === String(notifId));
      }
      if (found) {
        abrirQuickViewFlotante(found);
      }
    });
  });
}

/**
 * Expande o contrae la fila de un pedido
 */
function toggleExpandirPedido(orderId) {
  const rowDetails = document.getElementById(`expanded-row-${orderId}`);
  const btnChevron = document.querySelector(`[data-order-toggle="${orderId}"]`);

  if (!rowDetails) return;

  if (state.expandedOrders.has(orderId)) {
    state.expandedOrders.delete(orderId);
    rowDetails.style.display = 'none';
    btnChevron?.classList.remove('is-expanded');
  } else {
    state.expandedOrders.add(orderId);
    rowDetails.style.display = 'table-row';
    btnChevron?.classList.add('is-expanded');
  }
}

/**
 * Renderiza paginación de la Tabla 2
 */
function renderPaginacionPedidos(totalCount) {
  const infoEl = document.getElementById('pagination-orders-info');
  const controlsEl = document.getElementById('pagination-orders-controls');

  infoEl.textContent = `Mostrando 1 a ${totalCount} de ${totalCount} pedidos`;
  controlsEl.innerHTML = `
    <button type="button" class="page-btn" disabled>&lt; Anterior</button>
    <button type="button" class="page-btn active">1</button>
    <button type="button" class="page-btn" disabled>Siguiente &gt;</button>
  `;
}

// ==========================================================================
// 4. MODAL FLOTANTE A LA DERECHA: VISTA RÁPIDA DE NOTIFICACIÓN
// ==========================================================================
function setupQuickViewFloating() {
  const panel = document.getElementById('floating-quick-view');
  const btnClose = document.getElementById('btn-close-floating');
  const btnCloseFooter = document.getElementById('btn-close-floating-footer');

  const closeQuickView = () => {
    if (panel) {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    state.activeQuickViewNotif = null;
  };

  if (btnClose) btnClose.addEventListener('click', closeQuickView);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeQuickView);

  // Cerrar al hacer clic sobre la cortina / backdrop
  if (panel) {
    panel.addEventListener('click', (e) => {
      if (e.target === panel) {
        closeQuickView();
      }
    });
  }

  // Cerrar al presionar la tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel && panel.classList.contains('is-open')) {
      closeQuickView();
    }
  });
}

/**
 * Abre y puebla el panel flotante a la derecha con la información de la notificación
 */
function abrirQuickViewFlotante(notif) {
  state.activeQuickViewNotif = notif;
  const panel = document.getElementById('floating-quick-view');

  // 1. Pedido
  const orderLink = document.getElementById('detail-order-link');
  const targetOrderId = notif.order_id || notif.order;
  const orderNum = notif.order_number || (targetOrderId ? `#${String(targetOrderId).padStart(5, '0')}` : '-');
  orderLink.textContent = orderNum;
  if (targetOrderId) {
    orderLink.href = `../order/order-detail.html?id=${targetOrderId}`;
    orderLink.style.pointerEvents = 'auto';
  } else {
    orderLink.href = '#';
    orderLink.style.pointerEvents = 'none';
  }

  // 2. Cliente
  document.getElementById('detail-client-name').textContent = notif.user_name || notif.user || 'Cliente';

  // 3. Fecha
  const dt = formatDateTime(notif.created_at);
  document.getElementById('detail-date').textContent = `${dt.date} ${dt.time}`;

  // 4. Badges de Tipo y Estado
  const typeContainer = document.getElementById('detail-type-badge-container');
  typeContainer.innerHTML = notif.is_manual
    ? '<span class="badge badge-manual">Manual</span>'
    : '<span class="badge badge-auto">Automática</span>';

  const statusContainer = document.getElementById('detail-status-badge-container');
  if (notif.status === 'pending') {
    statusContainer.innerHTML = '<span class="badge badge-pending">Pendiente</span>';
  } else if (notif.status === 'read' || notif.is_read) {
    statusContainer.innerHTML = '<span class="badge badge-read">Leída</span>';
  } else {
    statusContainer.innerHTML = '<span class="badge badge-sent">Enviada</span>';
  }

  // 5. Conteo de Adjuntos
  const attachmentsCountEl = document.getElementById('detail-attachments-counts');
  const mediaFiles = notif.media_files || [];
  const imgCount = notif.images_count || mediaFiles.filter(m => m.media_type === 'image').length;
  const vidCount = notif.videos_count || mediaFiles.filter(m => m.media_type === 'video').length;

  if (imgCount > 0 || vidCount > 0) {
    const parts = [];
    if (imgCount > 0) {
      parts.push(`
        <span class="attachment-chip">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          ${imgCount}
        </span>
      `);
    }
    if (vidCount > 0) {
      parts.push(`
        <span class="attachment-chip">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          ${vidCount}
        </span>
      `);
    }
    attachmentsCountEl.innerHTML = parts.join(' ');
  } else {
    attachmentsCountEl.textContent = '-';
  }

  // 6. Asunto y Mensaje
  document.getElementById('detail-subject').textContent = notif.title || 'Sin asunto';
  document.getElementById('detail-message-box').textContent = notif.message || 'Sin contenido de mensaje.';

  // 7. Grid de Archivos Adjuntos
  const attachmentsSection = document.getElementById('detail-attachments-section');
  const attachmentsGrid = document.getElementById('detail-attachments-grid');

  if (mediaFiles.length > 0) {
    attachmentsSection.style.display = 'flex';
    attachmentsGrid.innerHTML = mediaFiles.map((m) => {
      const isVideo = m.media_type === 'video';
      const fileUrl = resolveMediaUrl(m.file_url || m.file);
      const fileName = m.file_name || (isVideo ? 'video_adjunto.mp4' : 'imagen_adjunta.webp');
      const fileSize = m.file_size || '-';

      return `
        <div class="attachment-media-card" data-media-url="${fileUrl}" data-media-type="${m.media_type}" title="Clic para ampliar">
          <div class="media-thumbnail-container">
            ${isVideo ? `
              <video src="${fileUrl}" preload="metadata" style="width: 100%; height: 100%; object-fit: cover;"></video>
              <div class="media-play-overlay">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </div>
            ` : `
              <img src="${fileUrl}" alt="${escapeHtml(fileName)}" class="media-thumbnail-img" loading="lazy">
            `}
          </div>
          <div class="media-card-info">
            <span class="media-card-name">${escapeHtml(fileName)}</span>
            <span class="media-card-size">${escapeHtml(fileSize)}</span>
          </div>
        </div>
      `;
    }).join('');

    attachmentsGrid.querySelectorAll('.attachment-media-card').forEach((card) => {
      card.addEventListener('click', () => {
        const url = card.getAttribute('data-media-url');
        const type = card.getAttribute('data-media-type');
        abrirLightbox(url, type);
      });
    });
  } else {
    attachmentsSection.style.display = 'none';
    attachmentsGrid.innerHTML = '';
  }

  // 8. Botón Ver completa
  const btnViewComplete = document.getElementById('btn-view-complete-order');
  // const targetOrderId = notif.order_id || notif.order;
  if (targetOrderId) {
    btnViewComplete.href = `../order/order-detail.html?id=${targetOrderId}`;
    btnViewComplete.style.display = 'inline-flex';
  } else {
    btnViewComplete.style.display = 'none';
  }

  // Abrir modal flotante centrado con cortina
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Si no estaba leída, marcar como leída automáticamente
  if (!notif.is_read) {
    marcarNotificacionLeida(notif.id).then(() => {
      notif.is_read = true;
      notif.status = 'read';
    }).catch(e => console.warn('[Notificaciones] Error marcando leída:', e));
  }
}

// ==========================================================================
// 5. VISOR LIGHTBOX PARA MEDIOS EN PANTALLA COMPLETA
// ==========================================================================
function setupMediaLightbox() {
  const lightbox = document.getElementById('media-lightbox');
  const btnClose = document.getElementById('btn-close-lightbox');

  const closeLightbox = () => {
    lightbox.style.display = 'none';
    lightbox.setAttribute('aria-hidden', 'true');
    const content = document.getElementById('lightbox-content');
    content.innerHTML = '';
  };

  btnClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.style.display !== 'none') {
      closeLightbox();
    }
  });
}

function abrirLightbox(url, mediaType) {
  const lightbox = document.getElementById('media-lightbox');
  const content = document.getElementById('lightbox-content');

  if (mediaType === 'video') {
    content.innerHTML = `
      <video src="${url}" controls autoplay style="max-width: 90vw; max-height: 85vh; border-radius: 8px;"></video>
    `;
  } else {
    content.innerHTML = `
      <img src="${url}" alt="Vista previa de adjunto" style="max-width: 90vw; max-height: 85vh; border-radius: 8px; object-fit: contain;">
    `;
  }

  lightbox.style.display = 'flex';
  lightbox.setAttribute('aria-hidden', 'false');
}

/**
 * Abre el modal para componer y enviar una nueva notificación manual
 * Permite preseleccionar un pedido específico si se pasa su ID
 */
async function abrirModalNuevaNotificacion(preselectedOrderId = null) {
  const backdrop = document.getElementById('modal-create-notif-backdrop');
  const form = document.getElementById('form-create-notification');
  const radioOrder = document.getElementById('radio-order');
  const radioClient = document.getElementById('radio-client');
  const groupOrder = document.getElementById('group-select-order');
  const groupClient = document.getElementById('group-select-client');
  const selectOrder = document.getElementById('compose-select-order');
  const selectClient = document.getElementById('compose-select-client');
  const selectedFilesList = document.getElementById('selected-files-list');

  form.reset();
  state.selectedFiles = [];
  selectedFilesList.innerHTML = '';
  limpiarErroresFormulario();

  radioOrder.checked = true;
  groupOrder.style.display = 'block';
  groupClient.style.display = 'none';
  selectOrder.required = true;
  selectClient.required = false;

  backdrop.style.display = 'flex';
  backdrop.setAttribute('aria-hidden', 'false');

  try {
    const [orders, clients] = await Promise.all([
      obtenerPedidosSelector(),
      obtenerClientesSelector()
    ]);

    selectOrder.innerHTML = '<option value="">Selecciona un pedido...</option>' + orders.map(o => {
      const num = o.order_number || `#${o.id}`;
      const clientName = o.user?.first_name ? `${o.user.first_name} ${o.user.first_last_name || ''}` : (o.user?.username || 'Cliente');
      return `<option value="${o.id}">${num} - ${clientName}</option>`;
    }).join('');

    selectClient.innerHTML = '<option value="">Selecciona un cliente...</option>' + clients.map(c => {
      const name = c.first_name ? `${c.first_name} ${c.first_last_name || ''}` : (c.username || c.email);
      return `<option value="${c.id}">${name} (${c.email || c.identity_document || 'Cliente'})</option>`;
    }).join('');

    if (preselectedOrderId) {
      selectOrder.value = String(preselectedOrderId);
      setTimeout(() => {
        document.getElementById('compose-input-subject')?.focus();
      }, 100);
    }
  } catch (e) {
    console.warn('[Notificaciones] Error cargando selectores de orden/cliente:', e);
  }
}

// ==========================================================================
// 6. MODAL FORMULARIO: COMPONER NUEVA NOTIFICACIÓN
// ==========================================================================
function setupCreateNotificationModal() {
  const btnOpen = document.getElementById('btn-new-notification');
  const backdrop = document.getElementById('modal-create-notif-backdrop');
  const btnClose = document.getElementById('btn-close-compose-modal');
  const btnCancel = document.getElementById('btn-cancel-compose');
  const form = document.getElementById('form-create-notification');

  const radioOrder = document.getElementById('radio-order');
  const radioClient = document.getElementById('radio-client');
  const groupOrder = document.getElementById('group-select-order');
  const groupClient = document.getElementById('group-select-client');
  const selectOrder = document.getElementById('compose-select-order');
  const selectClient = document.getElementById('compose-select-client');

  const dropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('compose-file-input');
  const selectedFilesList = document.getElementById('selected-files-list');

  // Alternar destinatario entre Pedido y Cliente
  radioOrder.addEventListener('change', () => {
    groupOrder.style.display = 'block';
    groupClient.style.display = 'none';
    selectOrder.required = true;
    selectClient.required = false;
  });

  radioClient.addEventListener('change', () => {
    groupOrder.style.display = 'none';
    groupClient.style.display = 'block';
    selectOrder.required = false;
    selectClient.required = true;
  });

  // Abrir modal y cargar pedidos/clientes
  btnOpen.addEventListener('click', () => {
    abrirModalNuevaNotificacion();
  });

  const closeModal = () => {
    backdrop.style.display = 'none';
    backdrop.setAttribute('aria-hidden', 'true');
    form.reset();
    state.selectedFiles = [];
    selectedFilesList.innerHTML = '';
  };

  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  // Manejo de Dropzone y selección de archivos
  fileInput.addEventListener('change', (e) => {
    handleArchivosSeleccionados(Array.from(e.target.files));
    fileInput.value = '';
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files?.length) {
      handleArchivosSeleccionados(Array.from(e.dataTransfer.files));
    }
  });

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErroresFormulario();

    const isByOrder = radioOrder.checked;
    const orderId = selectOrder.value;
    const clientId = selectClient.value;
    const subject = document.getElementById('compose-input-subject').value.trim();
    const message = document.getElementById('compose-textarea-message').value.trim();

    let hasErrors = false;

    if (isByOrder && !orderId) {
      document.getElementById('error-compose-order').textContent = 'Debes seleccionar un pedido.';
      hasErrors = true;
    } else if (!isByOrder && !clientId) {
      document.getElementById('error-compose-client').textContent = 'Debes seleccionar un cliente.';
      hasErrors = true;
    }

    if (!subject) {
      document.getElementById('error-compose-subject').textContent = 'El asunto es requerido.';
      hasErrors = true;
    }

    if (!message) {
      document.getElementById('error-compose-message').textContent = 'El mensaje no puede estar vacío.';
      hasErrors = true;
    }

    if (hasErrors) return;

    const submitBtn = document.getElementById('btn-submit-notification');
    const spinner = document.getElementById('compose-spinner');
    const submitText = document.getElementById('compose-submit-text');

    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';
    submitText.textContent = 'Enviando...';

    try {
      const formData = new FormData();
      formData.append('title', subject);
      formData.append('message', message);

      if (isByOrder) {
        formData.append('order_id', orderId);
      } else {
        formData.append('user_id', clientId);
      }

      state.selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      await crearNotificacionManual(formData);

      closeModal();
      showToast('success', 'Notificación Enviada', 'La notificación se registró y envió exitosamente.');
      cargarDatosVistaActual();

    } catch (err) {
      console.error('[Notificaciones] Error creando notificación manual:', err);
      showToast('error', 'Error al Enviar', err.message || 'No se pudo enviar la notificación.');
    } finally {
      submitBtn.disabled = false;
      spinner.style.display = 'none';
      submitText.textContent = 'Enviar notificación';
    }
  });
}

function handleArchivosSeleccionados(files) {
  const container = document.getElementById('selected-files-list');

  files.forEach((f) => {
    // Validar tamaño máximo de 25MB
    if (f.size > 25 * 1024 * 1024) {
      showToast('error', 'Archivo muy pesado', `El archivo ${f.name} excede el límite de 25MB.`);
      return;
    }
    state.selectedFiles.push(f);
  });

  renderSelectedFilesList();
}

function renderSelectedFilesList() {
  const container = document.getElementById('selected-files-list');
  container.innerHTML = state.selectedFiles.map((file, index) => {
    const isVideo = file.type.startsWith('video');
    const sizeKb = (file.size / 1024).toFixed(0);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

    return `
      <div class="selected-file-item">
        <div class="file-item-left">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            ${isVideo 
              ? '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>' 
              : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>'}
          </svg>
          <span class="file-name-text">${escapeHtml(file.name)}</span>
          <span style="color: #94a3b8; font-size: 11.5px;">(${sizeStr})</span>
        </div>
        <button type="button" class="btn-remove-file" data-file-idx="${index}" title="Remover archivo">&times;</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-remove-file').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-file-idx'), 10);
      state.selectedFiles.splice(idx, 1);
      renderSelectedFilesList();
    });
  });
}

function limpiarErroresFormulario() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

// ==========================================================================
// 7. MENÚ CONTEXTUAL FLOTANTE DE OPCIONES
// ==========================================================================
function setupContextMenu() {
  const menu = document.getElementById('actions-dropdown');

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) {
      menu.style.display = 'none';
      state.contextMenuTarget = null;
    }
  });

  const btnEditNotif = document.getElementById('action-edit-notif');
  if (btnEditNotif) {
    btnEditNotif.addEventListener('click', () => {
      const notif = state.contextMenuTarget;
      menu.style.display = 'none';
      if (notif && notif.id) {
        window.location.href = `notification-edit.html?id=${notif.id}`;
      }
    });
  }

  document.getElementById('action-go-order').addEventListener('click', () => {
    if (state.contextMenuTarget?.order_id) {
      window.location.href = `../order/order-detail.html?id=${state.contextMenuTarget.order_id}`;
    } else {
      showToast('info', 'Sin Pedido Asociado', 'Esta notificación no está vinculada a un pedido.');
    }
    menu.style.display = 'none';
  });

  document.getElementById('action-delete-notif').addEventListener('click', () => {
    const notif = state.contextMenuTarget;
    menu.style.display = 'none';
    if (!notif) return;

    showConfirmModal({
      title: 'Eliminar Notificación',
      message: `¿Estás seguro de que deseas eliminar la notificación "${escapeHtml(notif.title)}"?`,
      confirmText: 'Eliminar',
      confirmColor: 'danger',
      onConfirm: async () => {
        try {
          await eliminarNotificacion(notif.id);
          showToast('success', 'Notificación Eliminada', 'El registro ha sido removido del sistema.');
          cargarDatosVistaActual();
        } catch (err) {
          showToast('error', 'Error al Eliminar', 'No se pudo eliminar la notificación.');
        }
      }
    });
  });
}

function mostrarMenuContextual(triggerBtn, notif) {
  state.contextMenuTarget = notif;
  const menu = document.getElementById('actions-dropdown');
  const orderMenu = document.getElementById('order-actions-dropdown');
  if (orderMenu) orderMenu.style.display = 'none';

  const rect = triggerBtn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${Math.max(10, rect.left + window.scrollX - 120)}px`;
  menu.style.display = 'flex';
}

// ==========================================================================
// 8. MENÚ CONTEXTUAL FLOTANTE PARA PEDIDOS (TABLA 2)
// ==========================================================================
function setupOrderContextMenu() {
  const orderMenu = document.getElementById('order-actions-dropdown');
  if (!orderMenu) return;

  document.addEventListener('click', (e) => {
    if (!orderMenu.contains(e.target)) {
      orderMenu.style.display = 'none';
      state.orderContextMenuTarget = null;
    }
  });

  // Opción 1: Ver resumen y notificaciones (Modal dedicado)
  document.getElementById('order-action-view-modal')?.addEventListener('click', () => {
    const ord = state.orderContextMenuTarget;
    orderMenu.style.display = 'none';
    if (ord) {
      abrirModalPedidoNotificaciones(ord);
    }
  });

  // Opción 2: Nueva notificación para este pedido
  document.getElementById('order-action-new-notif')?.addEventListener('click', () => {
    const ord = state.orderContextMenuTarget;
    orderMenu.style.display = 'none';
    if (ord?.order_id) {
      abrirModalNuevaNotificacion(ord.order_id);
    }
  });

  // Opción 3: Ver detalle del pedido
  document.getElementById('order-action-go-detail')?.addEventListener('click', () => {
    const ord = state.orderContextMenuTarget;
    orderMenu.style.display = 'none';
    if (ord?.order_id) {
      window.location.href = `../order/order-detail.html?id=${ord.order_id}`;
    }
  });

  // Opción 4: Expandir o contraer historial en tabla
  document.getElementById('order-action-toggle-expand')?.addEventListener('click', () => {
    const ord = state.orderContextMenuTarget;
    orderMenu.style.display = 'none';
    if (ord?.order_id) {
      toggleExpandirPedido(ord.order_id);
    }
  });

  // Opción 5: Copiar número de pedido
  document.getElementById('order-action-copy-code')?.addEventListener('click', async () => {
    const ord = state.orderContextMenuTarget;
    orderMenu.style.display = 'none';
    if (!ord) return;

    const orderCode = ord.order_number || `#${String(ord.order_id).padStart(5, '0')}`;
    try {
      await navigator.clipboard.writeText(orderCode);
      showToast('success', 'Copiado al Portapapeles', `Pedido ${orderCode} copiado exitosamente.`);
    } catch {
      showToast('info', 'Número de Pedido', orderCode);
    }
  });
}

function mostrarMenuContextualOrden(triggerBtn, order) {
  state.orderContextMenuTarget = order;
  const menu = document.getElementById('order-actions-dropdown');
  const notifMenu = document.getElementById('actions-dropdown');
  if (notifMenu) notifMenu.style.display = 'none';
  if (!menu) return;

  // Actualizar etiqueta según el estado de expansión de la fila
  const expandLabel = document.getElementById('order-action-toggle-expand-text');
  if (expandLabel) {
    const isExpanded = state.expandedOrders.has(order.order_id);
    expandLabel.textContent = isExpanded ? 'Contraer historial' : 'Ver historial en tabla';
  }

  const rect = triggerBtn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${Math.max(10, rect.left + window.scrollX - 180)}px`;
  menu.style.display = 'flex';
}

// ==========================================================================
// 9. MODAL DEDICADO DE PEDIDO CON NOTIFICACIONES (RESUMEN + LISTADO)
// ==========================================================================
function setupOrderNotificationsModal() {
  const modal = document.getElementById('modal-order-notifications');
  const btnClose = document.getElementById('btn-close-order-notifs');
  const btnCloseFooter = document.getElementById('btn-close-order-notifs-footer');

  if (btnClose) btnClose.addEventListener('click', cerrarModalPedidoNotificaciones);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', cerrarModalPedidoNotificaciones);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cerrarModalPedidoNotificaciones();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('is-open')) {
      cerrarModalPedidoNotificaciones();
    }
  });
}

function abrirModalPedidoNotificaciones(order) {
  const modal = document.getElementById('modal-order-notifications');
  if (!modal || !order) return;

  const orderNum = order.order_number || `#${String(order.order_id).padStart(5, '0')}`;
  const clientName = order.client_name || 'Cliente';
  const totalFormatted = formatCurrency(order.total_price);
  const statusDisplay = order.order_status_display || order.order_status || 'Registrado';
  const notifsList = order.notifications || [];

  // Encabezado
  document.getElementById('order-notifs-modal-title').textContent = `Notificaciones: ${orderNum}`;
  document.getElementById('order-notifs-modal-subtitle').textContent = `Cliente: ${clientName} • Total: ${totalFormatted}`;

  // Mini Resumen
  const linkNum = document.getElementById('modal-order-number');
  linkNum.textContent = orderNum;
  linkNum.href = `../order/order-detail.html?id=${order.order_id}`;

  document.getElementById('modal-order-client').textContent = clientName;
  document.getElementById('modal-order-total').textContent = totalFormatted;
  document.getElementById('modal-order-notifs-count').textContent = `${notifsList.length} ${notifsList.length === 1 ? 'notificación' : 'notificaciones'}`;

  // Badge de Estado de Orden
  const statusBadge = document.getElementById('modal-order-status-badge');
  statusBadge.textContent = statusDisplay;
  statusBadge.className = 'badge-order-status';
  if (order.order_status === 'shipped') statusBadge.classList.add('badge-status-shipped');
  else if (order.order_status === 'finalized') statusBadge.classList.add('badge-status-finalized');
  else if (order.order_status?.includes('pending')) statusBadge.classList.add('badge-status-pending');
  else statusBadge.classList.add('badge-status-manufacturing');

  // Enlace ver completo en footer
  const btnDetail = document.getElementById('btn-modal-order-detail-link');
  if (btnDetail) {
    btnDetail.href = `../order/order-detail.html?id=${order.order_id}`;
  }

  // Botón nueva notificación en footer
  const btnNewNotif = document.getElementById('btn-modal-order-new-notif');
  if (btnNewNotif) {
    btnNewNotif.onclick = () => {
      cerrarModalPedidoNotificaciones();
      abrirModalNuevaNotificacion(order.order_id);
    };
  }

  // Renderizar listado de notificaciones de este pedido
  const container = document.getElementById('modal-order-notifs-container');
  if (!notifsList.length) {
    container.innerHTML = `
      <div class="order-notif-empty-state">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#94a3b8" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <p style="margin: 0;">Este pedido no tiene notificaciones registradas.</p>
      </div>
    `;
  } else {
    container.innerHTML = notifsList.map((n, idx) => {
      const dt = formatDateTime(n.created_at);
      const typeBadge = n.is_manual
        ? '<span class="badge badge-manual">Manual</span>'
        : '<span class="badge badge-auto">Automática</span>';

      let statusBadgeHtml = '<span class="badge badge-sent">Enviada</span>';
      if (n.status === 'pending') statusBadgeHtml = '<span class="badge badge-pending">Pendiente</span>';
      else if (n.status === 'read' || n.is_read) statusBadgeHtml = '<span class="badge badge-read">Leída</span>';

      // Miniaturas o chips de adjuntos
      let attachmentsHtml = '';
      if (n.media_files && n.media_files.length) {
        const attachThumbs = n.media_files.map(m => {
          if (m.media_type === 'video') {
            return `
              <span class="attachment-chip" data-media-url="${escapeHtml(m.file)}" data-media-type="video" style="cursor: pointer; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 11.5px; border: 1px solid #e2e8f0;" title="Ver video">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg> Video adjunto
              </span>
            `;
          } else {
            return `
              <img src="${escapeHtml(m.file)}" alt="Adjunto" class="order-notif-attach-thumb" data-media-url="${escapeHtml(m.file)}" data-media-type="image" title="Clic para ampliar">
            `;
          }
        }).join('');
        attachmentsHtml = `<div class="order-notif-item-attachments">${attachThumbs}</div>`;
      }

      return `
        <div class="order-notif-item-card">
          <div class="order-notif-item-top">
            <div class="order-notif-item-meta">
              <span class="order-notif-item-date">${dt.date} ${dt.time}</span>
              <div class="order-notif-item-badges">
                ${typeBadge}
                ${statusBadgeHtml}
              </div>
            </div>
            <button type="button" class="btn-table-action btn-item-quick-view" data-notif-idx="${idx}" title="Ver vista detallada">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
          <h5 class="order-notif-item-title">${escapeHtml(n.title || 'Notificación')}</h5>
          ${n.message ? `<div class="order-notif-item-msg">${escapeHtml(n.message)}</div>` : ''}
          ${attachmentsHtml}
        </div>
      `;
    }).join('');

    // Listeners para abrir adjuntos en Lightbox
    container.querySelectorAll('[data-media-url]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = el.getAttribute('data-media-url');
        const type = el.getAttribute('data-media-type');
        abrirLightbox(url, type);
      });
    });

    // Listeners para abrir vista rápida individual de una notificación específica
    container.querySelectorAll('.btn-item-quick-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-notif-idx'), 10);
        const notif = notifsList[idx];
        if (notif) {
          cerrarModalPedidoNotificaciones();
          abrirQuickViewFlotante(notif);
        }
      });
    });
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function cerrarModalPedidoNotificaciones() {
  const modal = document.getElementById('modal-order-notifications');
  if (modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

// Exponer para interoperabilidad y pruebas
window.abrirQuickViewFlotante = abrirQuickViewFlotante;
window.abrirModalPedidoNotificaciones = abrirModalPedidoNotificaciones;
window.abrirModalNuevaNotificacion = abrirModalNuevaNotificacion;
