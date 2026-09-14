/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DEL MÓDULO DE CLIENTES (CLIENTS.JS)
 * ==========================================================================
 * Gestiona el ciclo de vida de la pantalla de clientes:
 * - Integración con Drawer, Navbar y Footer mediante loadAdminComponents().
 * - Tarjetas KPI estadísticas dinámicas.
 * - Barra de búsqueda en vivo con debounce y filtros avanzados.
 * - Renderizado de tabla responsiva con paginación y sanitización XSS.
 * - Modales de creación/edición, detalle con historial de órdenes y exportación.
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { showConfirmModal } from '../../components/modal/modal.js';
import {
  obtenerClientes,
  obtenerMetricasClientes,
  obtenerCiudades,
  obtenerDetalleCliente,
  obtenerPedidosCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  descargarReporteClientes
} from './clients.api.js';

// Estado global del módulo
const state = {
  clients: [],
  metrics: null,
  totalCount: 0,
  currentPage: 1,
  pageSize: 10,
  totalPages: 1,
  filters: {
    search: '',
    status: 'all',
    city: 'all',
    period: 'all'
  },
  activeMenuClient: null,
  debounceTimer: null,
  selectedDetailClient: null
};

/**
 * Escapa cadenas de texto para prevenir inyecciones HTML (XSS)
 * @param {string|number} str 
 * @returns {string}
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
 * Formatea valores numéricos como divisa USD ($1,234.56)
 */
function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formatea fechas a formato DD/MM/AAAA
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      const parts = String(dateStr).split('-');
      if (parts.length === 3) {
        return `${parts[2].slice(0, 2)}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Obtiene las iniciales del nombre de un cliente (ej. Juan Pérez -> JP)
 */
function getInitials(name) {
  if (!name || typeof name !== 'string') return 'CL';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Retorna una clase de color pastel para el avatar
 */
function getAvatarColorClass(id) {
  const colors = [
    'avatar-color-1',
    'avatar-color-2',
    'avatar-color-3',
    'avatar-color-4',
    'avatar-color-5',
    'avatar-color-6'
  ];
  const numId = parseInt(id, 10) || 1;
  return colors[(numId - 1) % colors.length];
}

/**
 * Mapea el código de estado de un pedido a su etiqueta en español y clase visual
 */
function getOrderStatusMeta(statusKey) {
  const map = {
    manufacturing: { label: 'En fabricación', badgeClass: 'badge-status-manufacturing' },
    payment_review: { label: 'Pago en revisión', badgeClass: 'badge-status-review' },
    initial_review: { label: 'Pago inicial en revisión', badgeClass: 'badge-status-review' },
    waiting_final_payment: { label: 'Esperando pago final', badgeClass: 'badge-status-review' },
    pending_payment: { label: 'Pendiente de pago', badgeClass: 'badge-status-pending' },
    shipped: { label: 'Enviado', badgeClass: 'badge-status-shipped' },
    completed: { label: 'Finalizado', badgeClass: 'badge-status-completed' },
    refunded: { label: 'Devuelto', badgeClass: 'badge-status-cancelled' },
    cancelled: { label: 'Cancelado', badgeClass: 'badge-status-cancelled' }
  };
  return map[statusKey] || { label: statusKey || 'Pendiente', badgeClass: 'badge-status-pending' };
}

/**
 * Muestra notificación flotante en el contenedor semántico estándar
 */
function showToast(type, title, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.setAttribute('role', 'alert');

  let iconSvg = '';
  switch (type) {
    case 'success':
      iconSvg = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      break;
    case 'danger':
    case 'error':
      iconSvg = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;
      break;
    case 'warning':
      iconSvg = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      `;
      break;
    default:
      iconSvg = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      `;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <strong class="toast-title">${escapeHtml(title)}</strong>
      <span class="toast-desc">${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close-btn" aria-label="Cerrar notificación">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const closeBtn = toast.querySelector('.toast-close-btn');
  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 200);
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', removeToast);
  }

  container.appendChild(toast);
  setTimeout(removeToast, 4500);
}

// ==========================================================================
// CARGA Y RENDERIZADO DE DATOS
// ==========================================================================

/**
 * Carga las métricas y actualiza las 5 tarjetas KPI superiores
 */
async function cargarMetricas() {
  try {
    const m = await obtenerMetricasClientes();
    state.metrics = m;

    const elTotal = document.getElementById('kpi-total-clients');
    const elNew = document.getElementById('kpi-new-clients');
    const elGrowth = document.getElementById('kpi-new-clients-growth');
    const elWithOrders = document.getElementById('kpi-clients-with-orders');
    const elOrdersPct = document.getElementById('kpi-clients-orders-pct');
    const elSpent = document.getElementById('kpi-total-spent');
    const elAvgTicket = document.getElementById('kpi-avg-ticket');

    if (elTotal) elTotal.textContent = (m.total_clients || 0).toLocaleString();
    if (elNew) elNew.textContent = (m.new_clients_this_month || 0).toLocaleString();
    if (elGrowth) elGrowth.textContent = m.growth_percentage || '+0% vs mes anterior';
    if (elWithOrders) elWithOrders.textContent = (m.clients_with_orders || 0).toLocaleString();
    if (elOrdersPct) elOrdersPct.textContent = m.clients_with_orders_percentage || '0.0%';
    if (elSpent) elSpent.textContent = formatCurrency(m.total_spent);
    if (elAvgTicket) elAvgTicket.textContent = formatCurrency(m.avg_ticket);
  } catch (err) {
    console.error('Error actualizando métricas KPI:', err);
  }
}

/**
 * Carga las ciudades disponibles para el dropdown de filtro preservando selección
 */
async function cargarCiudades() {
  try {
    const cities = await obtenerCiudades();
    const select = document.getElementById('filter-city');
    if (!select) return;

    const currentSelected = state.filters.city;
    select.innerHTML = '<option value="all">Todas</option>';
    cities.forEach((city) => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      if (city === currentSelected) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error cargando ciudades:', err);
  }
}

/**
 * Carga y renderiza el listado de clientes aplicando búsqueda y filtros
 */
async function cargarClientes() {
  const tbody = document.getElementById('clients-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr class="loading-row">
        <td colspan="9">
          <div class="table-spinner-wrap">
            <div class="table-spinner"></div>
            <span>Cargando clientes...</span>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const params = {
      page: state.currentPage,
      page_size: state.pageSize,
      search: state.filters.search,
      status: state.filters.status,
      city: state.filters.city,
      period: state.filters.period
    };

    const response = await obtenerClientes(params);

    let list = [];
    if (Array.isArray(response)) {
      list = response;
      state.totalCount = response.length;
      state.totalPages = Math.ceil(state.totalCount / state.pageSize) || 1;
    } else if (response && Array.isArray(response.results)) {
      list = response.results;
      state.totalCount = response.count || list.length;
      state.totalPages = response.total_pages || Math.ceil(state.totalCount / state.pageSize) || 1;
    } else if (response && response.data && Array.isArray(response.data)) {
      list = response.data;
      state.totalCount = response.count || list.length;
      state.totalPages = Math.ceil(state.totalCount / state.pageSize) || 1;
    }

    state.clients = list;
    renderizarTabla(list);
    renderizarPaginacion();
  } catch (err) {
    console.error('Error cargando clientes:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="9">
            <div class="empty-state-wrap">
              <span class="empty-icon">⚠️</span>
              <strong>Error al conectar con el servidor</strong>
              <span>No se pudieron cargar los datos de clientes. Intenta recargar la página.</span>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Renderiza las filas de la tabla de clientes con sanitización HTML
 */
function renderizarTabla(clients) {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;

  if (!clients || clients.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9">
          <div class="empty-state-wrap">
            <span class="empty-icon">👥</span>
            <strong>No se encontraron clientes</strong>
            <span>Intenta ajustar los filtros de búsqueda o registra un nuevo cliente.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clients.map((c) => {
    const initials = escapeHtml(getInitials(c.full_name));
    const colorClass = getAvatarColorClass(c.id);
    const docText = escapeHtml(c.identity_document ? String(c.identity_document) : 'Sin documento');
    const cityState = escapeHtml([c.city, c.state].filter(Boolean).join(', ') || '-');
    const totalSpentStr = escapeHtml(formatCurrency(c.total_spent));
    const lastOrderStr = escapeHtml(formatDate(c.last_order_date));
    const isActive = Boolean(c.is_active);
    const clientName = escapeHtml(c.full_name || c.username || 'Cliente');
    const clientEmail = escapeHtml(c.email || '-');
    const clientPhone = escapeHtml(c.phone || '-');

    return `
      <tr data-client-id="${c.id}">
        <!-- 1. Columna Cliente (Avatar + Nombre + Documento de Identidad debajo) -->
        <td>
          <div class="cell-client-profile">
            <div class="client-avatar-circle ${colorClass}" aria-hidden="true">${initials}</div>
            <div class="client-name-meta">
              <span class="client-full-name">${clientName}</span>
              <span class="client-doc-sub">${docText}</span>
            </div>
          </div>
        </td>

        <!-- 2. Columna Correo -->
        <td>
          <span class="cell-email">${clientEmail}</span>
        </td>

        <!-- 3. Columna Contacto -->
        <td>
          <div class="cell-phone-wrap">
            <svg class="phone-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
            <span>${clientPhone}</span>
          </div>
        </td>

        <!-- 4. Columna Ciudad -->
        <td>${cityState}</td>

        <!-- 5. Columna Pedidos -->
        <td class="cell-orders-count">${parseInt(c.orders_count, 10) || 0}</td>

        <!-- 6. Columna Total Comprado -->
        <td class="cell-total-spent">${totalSpentStr}</td>

        <!-- 7. Columna Último Pedido -->
        <td>${lastOrderStr}</td>

        <!-- 8. Columna Estado -->
        <td>
          <span class="status-pill ${isActive ? 'status-active' : 'status-inactive'}">
            ${isActive ? 'Activo' : 'Inactivo'}
          </span>
        </td>

        <!-- 9. Columna Acciones -->
        <td>
          <div class="actions-cell-wrap">
            <button type="button" class="action-icon-btn btn-view-client" data-id="${c.id}" title="Ver detalle del cliente" aria-label="Ver detalle">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" class="action-icon-btn btn-menu-client" data-id="${c.id}" title="Más opciones" aria-label="Más opciones" aria-haspopup="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
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
}

/**
 * Renderiza los controles de paginación y actualiza el texto de conteo
 */
function renderizarPaginacion() {
  const footerInfo = document.getElementById('footer-count-text');
  const paginationContainer = document.getElementById('table-pagination');

  if (!footerInfo || !paginationContainer) return;

  const total = state.totalCount;
  if (total === 0) {
    footerInfo.textContent = 'Mostrando 0 a 0 de 0 clientes';
    paginationContainer.innerHTML = '';
    return;
  }

  const start = (state.currentPage - 1) * state.pageSize + 1;
  const end = Math.min(state.currentPage * state.pageSize, total);
  footerInfo.textContent = `Mostrando ${start} a ${end} de ${total} clientes`;

  const totalPages = state.totalPages;
  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  let html = `
    <button type="button" class="page-btn btn-page-nav" data-page="${state.currentPage - 1}" ${state.currentPage <= 1 ? 'disabled' : ''} aria-label="Página anterior">
      &lt; Anterior
    </button>
  `;

  // Ventana de páginas
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= state.currentPage - 1 && p <= state.currentPage + 1)) {
      html += `
        <button type="button" class="page-btn btn-page-number ${p === state.currentPage ? 'active' : ''}" data-page="${p}" aria-label="Página ${p}">
          ${p}
        </button>
      `;
    } else if (p === state.currentPage - 2 || p === state.currentPage + 2) {
      html += `<span class="page-ellipsis" aria-hidden="true">...</span>`;
    }
  }

  html += `
    <button type="button" class="page-btn btn-page-nav" data-page="${state.currentPage + 1}" ${state.currentPage >= totalPages ? 'disabled' : ''} aria-label="Página siguiente">
      Siguiente &gt;
    </button>
  `;

  paginationContainer.innerHTML = html;
}

// ==========================================================================
// MANEJO DE FILTROS Y EVENTOS DE INTERFAZ
// ==========================================================================

function setupFiltersEvents() {
  const searchInput = document.getElementById('search-input');
  const statusSelect = document.getElementById('filter-status');
  const citySelect = document.getElementById('filter-city');
  const dateSelect = document.getElementById('filter-date');
  const clearBtn = document.getElementById('btn-clear-filters');

  // Búsqueda en vivo con debounce y Enter inmediato
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => {
        state.filters.search = e.target.value.trim();
        state.currentPage = 1;
        cargarClientes();
      }, 350);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(state.debounceTimer);
        state.filters.search = e.target.value.trim();
        state.currentPage = 1;
        cargarClientes();
      }
    });
  }

  // Cambio de Estado
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      state.currentPage = 1;
      cargarClientes();
    });
  }

  // Cambio de Ciudad
  if (citySelect) {
    citySelect.addEventListener('change', (e) => {
      state.filters.city = e.target.value;
      state.currentPage = 1;
      cargarClientes();
    });
  }

  // Cambio de Fecha
  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      state.filters.period = e.target.value;
      state.currentPage = 1;
      cargarClientes();
    });
  }

  // Limpiar filtros
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (statusSelect) statusSelect.value = 'all';
      if (citySelect) citySelect.value = 'all';
      if (dateSelect) dateSelect.value = 'all';

      state.filters.search = '';
      state.filters.status = 'all';
      state.filters.city = 'all';
      state.filters.period = 'all';
      state.currentPage = 1;

      cargarClientes();
    });
  }

  // Paginación delegada
  const paginationContainer = document.getElementById('table-pagination');
  if (paginationContainer) {
    paginationContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn:not([disabled])');
      if (btn && btn.dataset.page) {
        state.currentPage = parseInt(btn.dataset.page, 10);
        cargarClientes();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
}

// ==========================================================================
// MENÚ CONTEXTUAL DE ACCIONES (⋮)
// ==========================================================================

function setupActionsDropdown() {
  const menu = document.getElementById('actions-dropdown-menu');
  const tbody = document.getElementById('clients-table-body');

  if (!menu || !tbody) return;

  // Abrir menú contextual
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-menu-client');
    if (!btn) return;

    e.stopPropagation();
    const clientId = parseInt(btn.dataset.id, 10);
    const client = state.clients.find((c) => c.id === clientId);
    if (!client) return;

    state.activeMenuClient = client;

    // Actualizar texto de toggle status
    const statusText = document.getElementById('action-toggle-status-text');
    if (statusText) {
      statusText.textContent = client.is_active ? 'Desactivar cliente' : 'Activar cliente';
    }

    // Posicionar menú
    const rect = btn.getBoundingClientRect();
    const menuWidth = 180;
    let leftPos = rect.right - menuWidth + window.scrollX;
    if (leftPos < 10) leftPos = 10;

    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    menu.style.left = `${leftPos}px`;
    menu.classList.add('is-active');
  });

  // Cerrar menú al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) {
      menu.classList.remove('is-active');
    }
  });

  // Evento botón Ver Detalle de la tabla
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-client');
    if (!btn) return;

    const clientId = parseInt(btn.dataset.id, 10);
    const client = state.clients.find((c) => c.id === clientId);
    if (client) {
      abrirModalDetalle(client);
    }
  });

  // Acciones dentro del menú
  document.getElementById('action-view-detail')?.addEventListener('click', () => {
    menu.classList.remove('is-active');
    if (state.activeMenuClient) abrirModalDetalle(state.activeMenuClient);
  });

  document.getElementById('action-edit-client')?.addEventListener('click', () => {
    menu.classList.remove('is-active');
    if (state.activeMenuClient) abrirModalFormulario(state.activeMenuClient);
  });

  document.getElementById('action-toggle-status')?.addEventListener('click', async () => {
    menu.classList.remove('is-active');
    const client = state.activeMenuClient;
    if (!client) return;

    const newStatus = !client.is_active;
    const actionWord = newStatus ? 'activar' : 'desactivar';

    const confirmed = await showConfirmModal({
      title: `${newStatus ? 'Activar' : 'Desactivar'} Cliente`,
      message: `¿Estás seguro de que deseas ${actionWord} a ${client.full_name || client.username || 'este cliente'}?`,
      confirmText: newStatus ? 'Activar' : 'Desactivar',
      type: newStatus ? 'info' : 'warning'
    });

    if (!confirmed) return;

    try {
      await actualizarCliente(client.id, { is_active: newStatus });
      showToast('success', 'Estado Actualizado', `El cliente ha sido ${newStatus ? 'activado' : 'desactivado'} correctamente.`);
      cargarClientes();
      cargarMetricas();
    } catch (err) {
      console.error('Error cambiando estado:', err);
      showToast('danger', 'Error', 'No se pudo actualizar el estado del cliente.');
    }
  });

  document.getElementById('action-delete-client')?.addEventListener('click', async () => {
    menu.classList.remove('is-active');
    const client = state.activeMenuClient;
    if (!client) return;

    const confirmed = await showConfirmModal({
      title: 'Eliminar Cliente',
      message: `¿Estás seguro de que deseas eliminar a ${client.full_name || client.username || 'este cliente'}? Esta acción realizará un borrado lógico en el sistema.`,
      confirmText: 'Eliminar',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await eliminarCliente(client.id);
      showToast('success', 'Cliente Eliminado', 'El cliente ha sido eliminado exitosamente.');
      cargarClientes();
      cargarMetricas();
    } catch (err) {
      console.error('Error eliminando cliente:', err);
      showToast('danger', 'Error', 'No se pudo eliminar el cliente.');
    }
  });
}

// ==========================================================================
// MODAL: NUEVO / EDITAR CLIENTE
// ==========================================================================

function setupClientFormModal() {
  const backdrop = document.getElementById('modal-client-form-backdrop');
  const closeBtn = document.getElementById('btn-close-form-modal');
  const cancelBtn = document.getElementById('btn-cancel-form');
  const form = document.getElementById('form-client');
  const newClientBtn = document.getElementById('btn-new-client');
  const toggleCheckbox = document.getElementById('toggle-client-status');
  const toggleLabel = document.getElementById('toggle-status-text');

  if (!backdrop || !form) return;

  if (toggleCheckbox && toggleLabel) {
    toggleCheckbox.addEventListener('change', () => {
      toggleLabel.textContent = toggleCheckbox.checked ? 'Cliente Activo' : 'Cliente Inactivo';
    });
  }

  if (newClientBtn) {
    newClientBtn.addEventListener('click', () => abrirModalFormulario(null));
  }

  const cerrarModal = () => {
    backdrop.classList.remove('is-active');
  };

  if (closeBtn) closeBtn.addEventListener('click', cerrarModal);
  if (cancelBtn) cancelBtn.addEventListener('click', cerrarModal);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) cerrarModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Limpiar errores previos
    document.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));

    const idVal = document.getElementById('form-client-id').value;
    const firstName = document.getElementById('input-first-name').value.trim();
    const secondName = document.getElementById('input-second-name').value.trim();
    const lastName = document.getElementById('input-last-name').value.trim();
    const secondLastName = document.getElementById('input-second-last-name').value.trim();
    const docType = document.getElementById('select-doc-type').value;
    let docNum = document.getElementById('input-doc-number').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const phone = document.getElementById('input-phone').value.trim();
    const city = document.getElementById('input-city').value.trim();
    const stateVal = document.getElementById('input-state').value.trim();
    const isActive = document.getElementById('toggle-client-status').checked;

    let hasError = false;

    if (!firstName) {
      document.getElementById('error-first-name').textContent = 'El primer nombre es obligatorio.';
      hasError = true;
    }
    if (!lastName) {
      document.getElementById('error-last-name').textContent = 'El primer apellido es obligatorio.';
      hasError = true;
    }
    if (!docNum) {
      document.getElementById('error-doc').textContent = 'El número de documento es obligatorio.';
      hasError = true;
    }
    if (!email) {
      document.getElementById('error-email').textContent = 'El correo electrónico es obligatorio.';
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('error-email').textContent = 'Ingresa un correo electrónico válido.';
      hasError = true;
    }

    if (hasError) return;

    // Normalizar documento: eliminar letras o guiones si el usuario los escribió en el input numérico
    docNum = docNum.replace(/^[A-Za-z]-?/, '').replace(/\s+/g, '');
    const fullDoc = `${docType}-${docNum}`;

    const payload = {
      first_name: firstName,
      second_name: secondName,
      first_last_name: lastName,
      second_last_name: secondLastName,
      identity_document: fullDoc,
      email: email,
      phone: phone,
      city: city,
      state: stateVal,
      is_active: isActive
    };

    const submitBtn = document.getElementById('btn-submit-client');
    const submitSpinner = document.getElementById('form-spinner');
    const submitText = document.getElementById('btn-submit-text');

    if (submitBtn) submitBtn.disabled = true;
    if (submitSpinner) submitSpinner.style.display = 'inline-block';
    if (submitText) submitText.textContent = idVal ? 'Actualizando...' : 'Guardando...';

    try {
      if (idVal) {
        // Actualizar
        await actualizarCliente(idVal, payload);
        showToast('success', 'Cliente Actualizado', 'Los datos del cliente se actualizaron con éxito.');
      } else {
        // Crear
        await crearCliente(payload);
        showToast('success', 'Cliente Registrado', 'El nuevo cliente ha sido creado exitosamente.');
      }

      cerrarModal();
      cargarClientes();
      cargarMetricas();
      cargarCiudades();
    } catch (err) {
      console.error('Error guardando cliente:', err);
      let errMsg = 'Ocurrió un error al guardar los datos del cliente.';
      if (err.data && typeof err.data === 'object') {
        const errors = Object.entries(err.data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        if (errors.length > 0) errMsg = errors.join(' | ');
      }
      showToast('danger', 'Error al Guardar', errMsg);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (submitSpinner) submitSpinner.style.display = 'none';
      if (submitText) submitText.textContent = idVal ? 'Actualizar Cliente' : 'Guardar Cliente';
    }
  });
}

function abrirModalFormulario(client = null) {
  const backdrop = document.getElementById('modal-client-form-backdrop');
  const title = document.getElementById('modal-form-title');
  const form = document.getElementById('form-client');
  const submitText = document.getElementById('btn-submit-text');
  if (!backdrop || !form) return;

  form.reset();
  document.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));

  if (client) {
    title.textContent = 'Editar Cliente';
    if (submitText) submitText.textContent = 'Actualizar Cliente';
    document.getElementById('form-client-id').value = client.id;
    document.getElementById('input-first-name').value = client.first_name || '';
    document.getElementById('input-second-name').value = client.second_name || '';
    document.getElementById('input-last-name').value = client.first_last_name || '';
    document.getElementById('input-second-last-name').value = client.second_last_name || '';
    document.getElementById('input-email').value = client.email || '';
    document.getElementById('input-phone').value = client.phone || '';
    document.getElementById('input-city').value = client.city || '';
    document.getElementById('input-state').value = client.state || '';

    // Parsear tipo y número de documento
    const rawDoc = String(client.identity_document || '').trim();
    if (rawDoc.includes('-')) {
      const parts = rawDoc.split('-');
      document.getElementById('select-doc-type').value = parts[0].toUpperCase();
      document.getElementById('input-doc-number').value = parts.slice(1).join('-');
    } else if (/^[VEJG]/i.test(rawDoc)) {
      document.getElementById('select-doc-type').value = rawDoc[0].toUpperCase();
      document.getElementById('input-doc-number').value = rawDoc.slice(1);
    } else {
      document.getElementById('select-doc-type').value = 'V';
      document.getElementById('input-doc-number').value = rawDoc;
    }

    const toggle = document.getElementById('toggle-client-status');
    const toggleText = document.getElementById('toggle-status-text');
    if (toggle) toggle.checked = Boolean(client.is_active);
    if (toggleText) toggleText.textContent = client.is_active ? 'Cliente Activo' : 'Cliente Inactivo';
  } else {
    title.textContent = 'Nuevo Cliente';
    if (submitText) submitText.textContent = 'Guardar Cliente';
    document.getElementById('form-client-id').value = '';
    document.getElementById('select-doc-type').value = 'V';
    const toggle = document.getElementById('toggle-client-status');
    const toggleText = document.getElementById('toggle-status-text');
    if (toggle) toggle.checked = true;
    if (toggleText) toggleText.textContent = 'Cliente Activo';
  }

  backdrop.classList.add('is-active');
}

// ==========================================================================
// MODAL: DETALLE DEL CLIENTE
// ==========================================================================

function setupClientDetailModal() {
  const backdrop = document.getElementById('modal-client-detail-backdrop');
  const closeBtn = document.getElementById('btn-close-detail-modal');
  const closeFooterBtn = document.getElementById('btn-close-detail');
  const editBtn = document.getElementById('btn-edit-from-detail');

  if (!backdrop) return;

  const cerrarModal = () => {
    backdrop.classList.remove('is-active');
  };

  if (closeBtn) closeBtn.addEventListener('click', cerrarModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', cerrarModal);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) cerrarModal();
  });

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      cerrarModal();
      if (state.selectedDetailClient) {
        abrirModalFormulario(state.selectedDetailClient);
      }
    });
  }
}

async function abrirModalDetalle(client) {
  const backdrop = document.getElementById('modal-client-detail-backdrop');
  if (!backdrop || !client) return;

  state.selectedDetailClient = client;

  // Llenar datos de cabecera
  const avatar = document.getElementById('detail-avatar');
  const fullName = document.getElementById('detail-full-name');
  const docBadge = document.getElementById('detail-document');
  const statusBadge = document.getElementById('detail-status-badge');

  if (avatar) {
    avatar.textContent = getInitials(client.full_name);
    avatar.className = `detail-avatar-circle ${getAvatarColorClass(client.id)}`;
  }
  if (fullName) fullName.textContent = client.full_name || client.username || 'Cliente';
  if (docBadge) docBadge.textContent = client.identity_document || 'Sin documento';
  if (statusBadge) {
    statusBadge.textContent = client.is_active ? 'Activo' : 'Inactivo';
    statusBadge.className = `status-pill ${client.is_active ? 'status-active' : 'status-inactive'}`;
  }

  // Métricas
  const ordersCount = document.getElementById('detail-orders-count');
  const totalSpent = document.getElementById('detail-total-spent');
  const lastOrder = document.getElementById('detail-last-order');

  if (ordersCount) ordersCount.textContent = client.orders_count || 0;
  if (totalSpent) totalSpent.textContent = formatCurrency(client.total_spent);
  if (lastOrder) lastOrder.textContent = formatDate(client.last_order_date);

  // Información
  const emailEl = document.getElementById('detail-email');
  const phoneEl = document.getElementById('detail-phone');
  const dateEl = document.getElementById('detail-date-joined');
  const locEl = document.getElementById('detail-location');

  if (emailEl) emailEl.textContent = client.email || 'No registrado';
  if (phoneEl) phoneEl.textContent = client.phone || 'No registrado';
  if (dateEl) dateEl.textContent = formatDate(client.date_joined || client.created_at);
  if (locEl) locEl.textContent = [client.city, client.state].filter(Boolean).join(', ') || 'No especificada';

  // Cargar órdenes del cliente con estados visuales correctos y enlace
  const ordersTableBody = document.getElementById('detail-orders-table-body');
  if (ordersTableBody) {
    ordersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Cargando pedidos...</td></tr>';
    try {
      const orders = await obtenerPedidosCliente(client.id);
      if (orders && orders.length > 0) {
        ordersTableBody.innerHTML = orders.map((o) => {
          const statusMeta = getOrderStatusMeta(o.status);
          const orderCode = escapeHtml(o.order_number || `#${o.id}`);
          const orderTotal = escapeHtml(formatCurrency(o.total_price));
          const orderDate = escapeHtml(formatDate(o.created_at));

          return `
            <tr>
              <td><strong>${orderCode}</strong></td>
              <td>${orderDate}</td>
              <td><strong>${orderTotal}</strong></td>
              <td><span class="status-pill ${statusMeta.badgeClass}">${escapeHtml(statusMeta.label)}</span></td>
              <td style="text-align: right;">
                <a href="../order/order-detail.html?id=${o.id}" class="btn-order-link" target="_blank" title="Ver pedido">
                  <span>Ver</span>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        ordersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No tiene pedidos registrados todavía.</td></tr>';
      }
    } catch (e) {
      ordersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No se pudo cargar el historial de pedidos.</td></tr>';
    }
  }

  backdrop.classList.add('is-active');
}

// ==========================================================================
// MODAL: EXPORTAR REPORTE
// ==========================================================================

function setupExportModal() {
  const backdrop = document.getElementById('modal-client-export-backdrop');
  const openBtn = document.getElementById('btn-export-clients');
  const closeBtn = document.getElementById('btn-close-export-modal');
  const cancelBtn = document.getElementById('btn-cancel-export');
  const excelBtn = document.getElementById('btn-export-excel');
  const pdfBtn = document.getElementById('btn-export-pdf');

  if (!backdrop) return;

  const cerrarModal = () => {
    backdrop.classList.remove('is-active');
  };

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      backdrop.classList.add('is-active');
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', cerrarModal);
  if (cancelBtn) cancelBtn.addEventListener('click', cerrarModal);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) cerrarModal();
  });

  const ejecutarDescarga = async (tipo) => {
    cerrarModal();
    showToast('info', 'Generando Reporte', `Preparando reporte de clientes en formato ${tipo.toUpperCase()}...`);

    try {
      const blob = await descargarReporteClientes(tipo);
      const downloadUrl = window.URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `reporte_clientes_${timestamp}.${tipo === 'excel' ? 'xlsx' : 'pdf'}`;

      if (tipo === 'pdf') {
        window.open(downloadUrl, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      showToast('success', 'Descarga Completada', `El reporte en ${tipo.toUpperCase()} se generó con éxito.`);
    } catch (err) {
      console.error('Error al exportar reporte:', err);
      showToast('danger', 'Error de Exportación', 'No se pudo generar el reporte. Verifica tus permisos de administrador.');
    }
  };

  if (excelBtn) {
    excelBtn.addEventListener('click', () => ejecutarDescarga('excel'));
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => ejecutarDescarga('pdf'));
  }
}

// ==========================================================================
// ACCESIBILIDAD: TECLA ESCAPE
// ==========================================================================
function setupKeyboardAccessibility() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const menu = document.getElementById('actions-dropdown-menu');
      if (menu && menu.classList.contains('is-active')) {
        menu.classList.remove('is-active');
        return;
      }

      const activeModal = document.querySelector('.modal-backdrop.is-active');
      if (activeModal) {
        activeModal.classList.remove('is-active');
      }
    }
  });
}

// ==========================================================================
// INICIALIZACIÓN DEL MÓDULO
// ==========================================================================

async function initClientsModule() {
  // 1. Cargar componentes compartidos mediante el método centralizado de la app
  try {
    await loadAdminComponents();
  } catch (err) {
    console.warn('Advertencia al cargar componentes globales del admin:', err);
  }

  // 2. Configurar eventos de modales, filtros y accesibilidad
  setupFiltersEvents();
  setupActionsDropdown();
  setupClientFormModal();
  setupClientDetailModal();
  setupExportModal();
  setupKeyboardAccessibility();

  // 3. Cargar datos del servidor en paralelo
  await Promise.all([
    cargarMetricas(),
    cargarCiudades(),
    cargarClientes()
  ]);
}

// Arrancar al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClientsModule);
} else {
  initClientsModule();
}
