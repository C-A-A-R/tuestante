import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DEL MÓDULO DE PEDIDOS (ORDER.JS)
 * ==========================================================================
 * Gestiona el listado interactivo, filtros avanzados en tiempo real,
 * paginación, modales de detalle y registro de nuevos pedidos.
 */

import { 
  getOrders, 
  getOrderById, 
  createOrder, 
  updateOrderStatus, 
  issueManufacturingOrder 
} from './order.api.js';

/**
 * ESTADO GLOBAL DEL MÓDULO DE PEDIDOS
 */
const state = {
  orders: [],
  totalOrders: 0,
  currentPage: 1,
  pageSize: 8,
  totalPages: 1,
  filters: {
    search: '',
    status: 'all',
    date_from: '',
    date_to: ''
  },
  activeOrderId: null,
  activePopoverEl: null
};

/**
 * ==========================================================================
 * RENDERIZADO DE LA TABLA DE PEDIDOS
 * ==========================================================================
 */

/**
 * Renderiza el listado de pedidos en el <tbody>
 * @param {Array} orders Listado de pedidos
 */
function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-table-tbody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <svg style="width: 36px; height: 36px; color: var(--border-color);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <strong style="color: var(--text-main); font-size: 0.95rem;">No se encontraron pedidos</strong>
            <span style="font-size: 0.82rem;">Intente ajustar los filtros de búsqueda o fecha.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const code = order.order_code || `#00${order.id}`;
    const clientName = order.client?.name || order.customer_name || 'Cliente';
    const clientEmail = order.client?.email || order.customer_email || 'sin-email@tienda.com';
    
    // Contaje de productos
    const count = order.items_count || (order.items ? order.items.length : 1);
    const productsLabel = `${count} ${count === 1 ? 'producto' : 'productos'}`;

    // Total formateado
    const total = typeof order.total_amount === 'number' ? order.total_amount : parseFloat(order.total_amount || 0);
    const formattedTotal = `$${total.toFixed(2)}`;

    // Información de Pago
    const payInfo = order.payment_info || {};
    const payLabel = payInfo.status_label || (order.status === 'completed' ? 'Completo' : 'Pendiente');
    const paid = typeof payInfo.paid_amount === 'number' ? payInfo.paid_amount : 0;
    const payAmountFraction = `$${paid.toFixed(2)} / ${formattedTotal}`;
    const payColorClass = payInfo.color_class || (paid >= total ? 'payment-complete' : paid > 0 ? 'payment-half-approved' : 'payment-pending');

    // Badge de Estado
    const statusClass = order.status_badge_class || getStatusBadgeClass(order.status);
    const statusLabel = order.status_label || getStatusLabel(order.status);

    // Fecha y hora
    const dateFormatted = order.formatted_date || (order.created_at ? new Date(order.created_at).toLocaleDateString('es-ES') : '31/08/2026');
    const timeFormatted = order.formatted_time || (order.created_at ? new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '10:00');

    return `
      <tr data-order-id="${order.id}">
        <!-- 1. Pedido -->
        <td class="order-code-cell">
          <a href="order-detail.html?id=${order.id}" class="order-code-link" title="Ver pedido en pantalla completa">
            <strong>${escapeHtml(code)}</strong>
          </a>
        </td>

        <!-- 2. Cliente -->
        <td>
          <div class="client-cell">
            <span class="client-name">${escapeHtml(clientName)}</span>
            <span class="client-email">${escapeHtml(clientEmail)}</span>
          </div>
        </td>

        <!-- 3. Productos -->
        <td>
          <div class="products-cell">
            <span class="products-count">${productsLabel}</span>
            <button 
              type="button" 
              class="products-details-link btn-view-order-details" 
              data-order-id="${order.id}" 
              aria-label="Ver detalles de ${escapeHtml(code)}">
              Ver detalles
            </button>
          </div>
        </td>

        <!-- 4. Total -->
        <td class="total-cell">
          ${formattedTotal}
        </td>

        <!-- 5. Pago -->
        <td>
          <div class="payment-cell">
            <span class="payment-status-title">${escapeHtml(payLabel)}</span>
            <span class="payment-amount-fraction ${payColorClass}">${payAmountFraction}</span>
          </div>
        </td>

        <!-- 6. Estado -->
        <td>
          <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
        </td>

        <!-- 7. Fecha -->
        <td>
          <div class="date-cell">
            <span class="date-main">${dateFormatted}</span>
            <span class="date-time">${timeFormatted}</span>
          </div>
        </td>

        <!-- 8. Acciones -->
        <td>
          <div class="actions-cell">
            <!-- Botón Ver Vista Previa Modal (Ojo) -->
            <button 
              type="button" 
              class="table-action-btn btn-view-order-details" 
              data-order-id="${order.id}" 
              title="Ver vista previa del pedido" 
              aria-label="Ver vista previa de ${escapeHtml(code)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>

            <!-- Botón 3 Puntos (Menú Contextual) -->
            <button 
              type="button" 
              class="table-action-btn btn-order-menu" 
              data-order-id="${order.id}" 
              title="Más opciones" 
              aria-expanded="false" 
              aria-haspopup="true" 
              aria-label="Más opciones para pedido ${escapeHtml(code)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>

            <!-- Menú Flotante de Acciones -->
            <div class="action-popover" id="popover-${order.id}" role="menu">
              <a href="order-detail.html?id=${order.id}" class="action-popover-item" role="menuitem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span>Ver pantalla completa</span>
              </a>
              <button type="button" class="action-popover-item btn-view-order-details" data-order-id="${order.id}" role="menuitem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>Vista rápida</span>
              </button>
              <button type="button" class="action-popover-item btn-issue-mo" data-order-id="${order.id}" role="menuitem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 20h20"></path>
                  <path d="M5 20V8l5 4V4l6 5v11"></path>
                </svg>
                <span>Emitir Orden Fab.</span>
              </button>
              <button type="button" class="action-popover-item btn-change-status" data-order-id="${order.id}" role="menuitem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                <span>Avanzar fase</span>
              </button>
            </div>

          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Vincular eventos en los elementos recién renderizados
  attachTableEventListeners();
}

/**
 * Asigna eventos a los botones de la tabla de pedidos
 */
function attachTableEventListeners() {
  // 1. Ver detalles del pedido (Botón ojo, link de productos y menú contextual)
  document.querySelectorAll('.btn-view-order-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeActivePopover();
      const orderId = btn.getAttribute('data-order-id');
      openOrderDetailsModal(orderId);
    });
  });

  // 2. Menú contextual 3 puntos
  document.querySelectorAll('.btn-order-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.getAttribute('data-order-id');
      const popover = document.getElementById(`popover-${orderId}`);
      
      if (state.activePopoverEl && state.activePopoverEl !== popover) {
        state.activePopoverEl.classList.remove('is-active');
      }

      if (popover) {
        popover.classList.toggle('is-active');
        state.activePopoverEl = popover.classList.contains('is-active') ? popover : null;
      }
    });
  });

  // 3. Emitir Orden de Fabricación desde menú contextual
  document.querySelectorAll('.btn-issue-mo').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeActivePopover();
      const orderId = btn.getAttribute('data-order-id');
      await handleIssueManufacturingOrder(orderId);
    });
  });

  // 4. Cambiar / Avanzar fase
  document.querySelectorAll('.btn-change-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeActivePopover();
      const orderId = btn.getAttribute('data-order-id');
      await handleAdvanceOrderStatus(orderId);
    });
  });
}

/**
 * ==========================================================================
 * PAGINACIÓN Y RESUMEN
 * ==========================================================================
 */

/**
 * Renderiza los controles de paginación
 */
function renderPagination() {
  const infoText = document.getElementById('pagination-info-text');
  const numbersContainer = document.getElementById('pagination-numbers-container');
  const btnPrev = document.getElementById('btn-page-prev');
  const btnNext = document.getElementById('btn-page-next');

  if (!infoText || !numbersContainer) return;

  const total = state.totalOrders;
  const page = state.currentPage;
  const size = state.pageSize;
  const totalPages = state.totalPages || 1;

  // Texto resumen: "Mostrando 1 a 8 de 45 pedidos"
  if (total === 0) {
    infoText.textContent = 'Mostrando 0 pedidos';
  } else {
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    infoText.textContent = `Mostrando ${start} a ${end} de ${total} pedidos`;
  }

  // Estado botones Anterior / Siguiente
  if (btnPrev) btnPrev.disabled = (page <= 1);
  if (btnNext) btnNext.disabled = (page >= totalPages);

  // Generar números de página
  let pagesHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 6 && i > 4 && i < totalPages) {
      if (i === 5) pagesHtml += `<span class="page-ellipsis">...</span>`;
      continue;
    }
    const isActive = i === page ? 'active' : '';
    pagesHtml += `
      <button type="button" class="page-btn ${isActive}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  numbersContainer.innerHTML = pagesHtml;

  // Eventos de números de página
  numbersContainer.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (p && p !== state.currentPage) {
        goToPage(p);
      }
    });
  });
}

/**
 * Cambia a una página específica
 * @param {number} page Número de página
 */
async function goToPage(page) {
  state.currentPage = page;
  await loadOrdersData();
}

/**
 * ==========================================================================
 * CARGA DE DATOS CENTRALIZADA
 * ==========================================================================
 */

/**
 * Carga los pedidos aplicando los filtros activos y la paginación
 */
async function loadOrdersData() {
  try {
    const result = await getOrders({
      ...state.filters,
      page: state.currentPage,
      page_size: state.pageSize
    });

    state.orders = result.results || [];
    state.totalOrders = result.total || 0;
    state.totalPages = result.total_pages || 1;

    renderOrdersTable(state.orders);
    renderPagination();
  } catch (error) {
    console.error('[TuEstante Orders] Error al cargar los datos de pedidos:', error);
  }
}

/**
 * ==========================================================================
 * MODAL: DETALLE Y PRODUCTOS DEL PEDIDO
 * ==========================================================================
 */

/**
 * Abre el modal con el detalle completo del pedido
 * @param {number|string} orderId ID del pedido
 */
async function openOrderDetailsModal(orderId) {
  state.activeOrderId = orderId;
  const order = await getOrderById(orderId);
  if (!order) return;

  const modalBackdrop = document.getElementById('order-details-modal-backdrop');
  if (!modalBackdrop) return;

  // Botón Pantalla Completa
  const fullDetailBtn = document.getElementById('btn-modal-full-detail');
  if (fullDetailBtn) {
    fullDetailBtn.href = `order-detail.html?id=${orderId}`;
  }

  // Título y fecha
  const titleEl = document.getElementById('modal-order-title');
  const dateEl = document.getElementById('modal-order-date');
  if (titleEl) titleEl.textContent = `Detalle del Pedido ${order.order_code || '#' + order.id}`;
  if (dateEl) dateEl.textContent = `Registrado el ${order.formatted_date || '31/08/2026'} a las ${order.formatted_time || '10:30'}`;

  // Cliente
  const clientNameEl = document.getElementById('modal-client-name');
  const clientEmailEl = document.getElementById('modal-client-email');
  const clientPhoneEl = document.getElementById('modal-client-phone');
  if (clientNameEl) clientNameEl.textContent = order.client?.name || 'Cliente';
  if (clientEmailEl) clientEmailEl.textContent = order.client?.email || '';
  if (clientPhoneEl) clientPhoneEl.textContent = order.client?.phone || '+58 412 0000000';

  // Badge de Estado
  const badgeContainer = document.getElementById('modal-status-badge-container');
  if (badgeContainer) {
    const sClass = order.status_badge_class || getStatusBadgeClass(order.status);
    const sLabel = order.status_label || getStatusLabel(order.status);
    badgeContainer.innerHTML = `<span class="status-badge ${sClass}">${escapeHtml(sLabel)}</span>`;
  }

  // Resumen de pago
  const paySummaryEl = document.getElementById('modal-payment-summary');
  const payStageEl = document.getElementById('modal-payment-stage');
  const total = typeof order.total_amount === 'number' ? order.total_amount : parseFloat(order.total_amount || 0);
  const paid = order.payment_info?.paid_amount || 0;
  if (paySummaryEl) paySummaryEl.textContent = `$${paid.toFixed(2)} / $${total.toFixed(2)}`;
  if (payStageEl) payStageEl.textContent = order.payment_info?.status_label || 'Estado del pago';

  // Lista de Productos en la tabla del Modal
  const tbody = document.getElementById('modal-products-tbody');
  const totalPriceEl = document.getElementById('modal-order-total-price');
  if (totalPriceEl) totalPriceEl.textContent = `$${total.toFixed(2)}`;

  if (tbody) {
    const items = order.items && order.items.length > 0 ? order.items : [
      { product_name: "Estante Metálico Industrial", quantity: 1, unit_price: total, total_price: total, notes: "Configuración estándar" }
    ];

    tbody.innerHTML = items.map(it => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${escapeHtml(it.image || '../../assets/images/logo.jpeg')}" alt="${escapeHtml(it.product_name || 'Producto')}" style="width: 38px; height: 38px; min-width: 38px; max-width: 38px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border-color); background: var(--bg-secondary);" onerror="this.src='../../assets/images/logo.jpeg'">
            <div style="display: flex; flex-direction: column; min-width: 0;">
              <strong style="color: var(--text-main); font-size: 0.865rem;">${escapeHtml(it.product_name || 'Producto')}</strong>
              <span style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(it.specs || it.notes || 'Configuración estándar')}</span>
            </div>
          </div>
        </td>
        <td class="text-center font-bold">${it.quantity || 1}</td>
        <td class="text-right">$${(it.unit_price || total).toFixed(2)}</td>
        <td class="text-right font-bold text-primary">$${(it.total_price || total).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  // Notas
  const notesEl = document.getElementById('modal-order-notes');
  if (notesEl) {
    notesEl.textContent = order.notes || 'Sin observaciones adicionales registradas.';
  }

  // Mostrar modal
  modalBackdrop.classList.add('is-open');
}

/**
 * Cierra el modal de detalles
 */
function closeOrderDetailsModal() {
  const modalBackdrop = document.getElementById('order-details-modal-backdrop');
  if (modalBackdrop) modalBackdrop.classList.remove('is-open');
  state.activeOrderId = null;
}

/**
 * ==========================================================================
 * MODAL: CREAR NUEVO PEDIDO
 * ==========================================================================
 */

/**
 * Abre el modal de creación de pedido
 */
function openCreateOrderModal() {
  const modalBackdrop = document.getElementById('create-order-modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.classList.add('is-open');
  }
}

/**
 * Cierra el modal de creación de pedido
 */
function closeCreateOrderModal() {
  const modalBackdrop = document.getElementById('create-order-modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.classList.remove('is-open');
  }
  const form = document.getElementById('create-order-form');
  if (form) form.reset();
}

/**
 * Procesa el envío del formulario de creación de pedido
 * @param {Event} e 
 */
async function handleCreateOrderSubmit(e) {
  e.preventDefault();
  
  const clientSelect = document.getElementById('create-client-select');
  const productSelect = document.getElementById('create-product-select');
  const qtyInput = document.getElementById('create-product-qty');
  const notesInput = document.getElementById('create-order-notes');

  const selectedProductOpt = productSelect.options[productSelect.selectedIndex];
  const unitPrice = parseFloat(selectedProductOpt.getAttribute('data-price') || 200.00);
  const qty = parseInt(qtyInput.value, 10) || 1;
  const totalPrice = unitPrice * qty;

  const clientText = clientSelect.options[clientSelect.selectedIndex].text;
  const clientName = clientText.split('(')[0].trim();
  const clientEmail = clientText.includes('(') ? clientText.split('(')[1].replace(')', '').trim() : 'cliente@email.com';

  const orderPayload = {
    client: {
      name: clientName,
      email: clientEmail,
      phone: "+58 412 0000000"
    },
    items: [
      {
        product_name: selectedProductOpt.text.split('(')[0].trim(),
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        notes: notesInput.value.trim()
      }
    ],
    items_count: qty,
    total_amount: totalPrice,
    notes: notesInput.value.trim()
  };

  try {
    await createOrder(orderPayload);
    closeCreateOrderModal();
    state.currentPage = 1;
    await loadOrdersData();
    showToastNotification('¡Pedido creado con éxito!');
  } catch (error) {
    console.error('Error al registrar pedido:', error);
    alert('Error al crear el pedido.');
  }
}

/**
 * Maneja la emisión de Orden de Fabricación
 * @param {number|string} orderId 
 */
async function handleIssueManufacturingOrder(orderId) {
  try {
    await issueManufacturingOrder(orderId);
    showToastNotification(`Orden de Fabricación emitida para pedido #${orderId}`);
    closeOrderDetailsModal();
    await loadOrdersData();
  } catch (error) {
    console.error('Error al emitir orden de fabricación:', error);
  }
}

/**
 * Avanza el estado de un pedido
 * @param {number|string} orderId 
 */
async function handleAdvanceOrderStatus(orderId) {
  try {
    await updateOrderStatus(orderId, 'manufacturing', 'Avanzado desde panel administrativo');
    showToastNotification(`Estado del pedido #${orderId} actualizado a En fabricación`);
    await loadOrdersData();
  } catch (error) {
    console.error('Error al actualizar estado:', error);
  }
}

/**
 * ==========================================================================
 * UTILIDADES Y NOTIFICACIONES
 * ==========================================================================
 */

function closeActivePopover() {
  if (state.activePopoverEl) {
    state.activePopoverEl.classList.remove('is-active');
    state.activePopoverEl = null;
  }
}

function showToastNotification(message) {
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #005187;
    color: #fcffff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(0, 81, 135, 0.35);
    z-index: 9999;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  toast.innerHTML = `
    <svg style="width: 18px; height: 18px; color: #84b6f4;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${escapeHtml(message)}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'manufacturing': return 'badge-manufacturing';
    case 'payment_review': return 'badge-payment-review';
    case 'waiting_final_payment': return 'badge-waiting-final';
    case 'shipped': return 'badge-shipped';
    case 'pending_payment': return 'badge-pending-payment';
    case 'initial_review': return 'badge-initial-review';
    case 'completed': return 'badge-completed';
    case 'refunded': return 'badge-refunded';
    default: return 'badge-manufacturing';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'manufacturing': return 'En fabricación';
    case 'payment_review': return 'Pago en revisión';
    case 'waiting_final_payment': return 'Esperando pago final';
    case 'shipped': return 'Enviado';
    case 'pending_payment': return 'Pendiente de pago';
    case 'initial_review': return 'Pago inicial en revisión';
    case 'completed': return 'Finalizado';
    case 'refunded': return 'Devuelto';
    default: return status || 'En proceso';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * ==========================================================================
 * CONFIGURACIÓN DE FILTROS Y EVENTOS GLOBALES
 * ==========================================================================
 */
function setupEventListeners() {
  // 1. Buscador en tiempo real (Search input)
  const searchInput = document.getElementById('order-search-input');
  if (searchInput) {
    let searchDebounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        state.filters.search = searchInput.value;
        state.currentPage = 1;
        loadOrdersData();
      }, 250);
    });
  }

  // 2. Filtro de Estado
  const statusSelect = document.getElementById('order-status-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      state.filters.status = statusSelect.value;
      state.currentPage = 1;
      loadOrdersData();
    });
  }

  // 3. Filtros de Fecha (Desde y Hasta)
  const dateFromInput = document.getElementById('order-date-from');
  const dateToInput = document.getElementById('order-date-to');
  if (dateFromInput) {
    dateFromInput.addEventListener('change', () => {
      state.filters.date_from = dateFromInput.value;
      state.currentPage = 1;
      loadOrdersData();
    });
  }
  if (dateToInput) {
    dateToInput.addEventListener('change', () => {
      state.filters.date_to = dateToInput.value;
      state.currentPage = 1;
      loadOrdersData();
    });
  }

  // 4. Botón Limpiar Filtros
  const btnClearFilters = document.getElementById('btn-clear-filters');
  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (statusSelect) statusSelect.value = 'all';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';

      state.filters = { search: '', status: 'all', date_from: '', date_to: '' };
      state.currentPage = 1;
      loadOrdersData();
    });
  }

  // 5. Botón + Crear Pedido (Abrir modal)


  // 6. Cerrar modales (Botones X y Cancelar)
  const btnCloseDetails = document.getElementById('btn-close-details-modal');
  const btnCloseDetailsFooter = document.getElementById('btn-modal-close-footer');
  if (btnCloseDetails) btnCloseDetails.addEventListener('click', closeOrderDetailsModal);
  if (btnCloseDetailsFooter) btnCloseDetailsFooter.addEventListener('click', closeOrderDetailsModal);

  const btnCloseCreate = document.getElementById('btn-close-create-modal');
  const btnCancelCreate = document.getElementById('btn-cancel-create-order');
  if (btnCloseCreate) btnCloseCreate.addEventListener('click', closeCreateOrderModal);
  if (btnCancelCreate) btnCancelCreate.addEventListener('click', closeCreateOrderModal);

  // 7. Formulario Crear Pedido
  const createForm = document.getElementById('create-order-form');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateOrderSubmit);

    // Calcular monto estimado al cambiar producto o cantidad
    const prodSelect = document.getElementById('create-product-select');
    const qtyInput = document.getElementById('create-product-qty');
    const totalInput = document.getElementById('create-order-total');

    const updateTotalPreview = () => {
      const opt = prodSelect.options[prodSelect.selectedIndex];
      const price = parseFloat(opt?.getAttribute('data-price') || 0);
      const q = parseInt(qtyInput.value, 10) || 1;
      if (totalInput) totalInput.value = `$${(price * q).toFixed(2)}`;
    };

    if (prodSelect) prodSelect.addEventListener('change', updateTotalPreview);
    if (qtyInput) qtyInput.addEventListener('input', updateTotalPreview);
  }

  // 8. Botón Emitir Orden de Fabricación dentro del modal
  const btnModalIssueMO = document.getElementById('btn-modal-issue-mo');
  if (btnModalIssueMO) {
    btnModalIssueMO.addEventListener('click', () => {
      if (state.activeOrderId) {
        handleIssueManufacturingOrder(state.activeOrderId);
      }
    });
  }

  // 9. Paginación Anterior y Siguiente
  const btnPrev = document.getElementById('btn-page-prev');
  const btnNext = document.getElementById('btn-page-next');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (state.currentPage > 1) {
        goToPage(state.currentPage - 1);
      }
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (state.currentPage < state.totalPages) {
        goToPage(state.currentPage + 1);
      }
    });
  }

  // 10. Cerrar menús contextuales y modales al hacer clic fuera
  document.addEventListener('click', (e) => {
    closeActivePopover();

    const detailsModal = document.getElementById('order-details-modal-backdrop');
    if (detailsModal && e.target === detailsModal) {
      closeOrderDetailsModal();
    }

    const createModal = document.getElementById('create-order-modal-backdrop');
    if (createModal && e.target === createModal) {
      closeCreateOrderModal();
    }
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeOrderDetailsModal();
      closeCreateOrderModal();
      closeActivePopover();
    }
  });
}

/**
 * ==========================================================================
 * INICIALIZACIÓN GENERAL DEL MÓDULO DE PEDIDOS
 * ==========================================================================
 */
async function initOrdersModule() {
  try {
    // 1. Inicializar componentes compartidos (Navbar, Drawer y Footer)
    await loadAdminComponents({ title: 'Pedidos' });

    // 2. Configurar listeners de interacción
    setupEventListeners();

    // 3. Cargar listado inicial de pedidos
    await loadOrdersData();

    console.log('%c[TuEstante Admin] Módulo de Pedidos inicializado con éxito.', 'background: #005187; color: #fcffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  } catch (error) {
    console.error('[TuEstante Admin] Error al inicializar módulo de pedidos:', error);
  }
}

// Ejecución al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrdersModule);
} else {
  initOrdersModule();
}
