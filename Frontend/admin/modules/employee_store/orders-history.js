import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * orders-history.js
 * Historial y Auditoría Global de Órdenes de Proveeduría - TuEstante Admin
 */

import {
  fetchOrders,
  fetchOrder,
  cancelOrder,
  updateOrderStatus,
  createDebtPayment
} from './employee-store.api.js';

import { getBcvRate } from '../../js/service/exchange-rate.service.js';
import { showConfirmModal } from '../../components/modal/modal.js';

// ============================================================================
// ESTADO
// ============================================================================
let currentExchangeRate = 80.00;
let ordersList = [];
let selectedOrderForModal = null;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Notificación de orden registrada inmediatamente al cargar
  checkPendingOrderNotification();

  try {
    await loadAdminComponents({ title: 'Historial de Órdenes' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load error:', err);
  }

  await loadExchangeRate();
  setupEventListeners();
  await loadOrders();
});

async function loadExchangeRate() {
  try {
    const rate = await getBcvRate();
    if (rate && !isNaN(rate) && rate > 0) {
      currentExchangeRate = parseFloat(rate);
      const badgeVal = document.getElementById('navbar-exchange-val');
      if (badgeVal) badgeVal.textContent = `Bs. ${currentExchangeRate.toFixed(2)}`;
    }
  } catch (err) {
    console.warn('Fallback BCV rate active');
  }
}

async function loadOrders() {
  const tbody = document.getElementById('tbody-orders');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-loading-cell">
          Cargando historial de despachos...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetchOrders();
    ordersList = Array.isArray(res) ? res : (res.results || []);
    updateKpis();
    renderOrdersTable();
  } catch (err) {
    console.error('Error cargando órdenes:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-error-cell">
            Error al consultar órdenes de proveeduría.
          </td>
        </tr>
      `;
    }
    showToast('No se pudo cargar el historial de órdenes', 'error');
  }
}

function updateKpis() {
  const kpiCount = document.getElementById('kpi-total-orders');
  const kpiAmount = document.getElementById('kpi-total-amount');
  const kpiCancelled = document.getElementById('kpi-total-cancelled');

  let totalUSD = 0;
  let cancelledCount = 0;

  ordersList.forEach(o => {
    if (o.status === 'CANCELLED') {
      cancelledCount++;
    } else {
      totalUSD += parseFloat(o.total_amount || 0);
    }
  });

  if (kpiCount) kpiCount.textContent = ordersList.length;
  if (kpiAmount) kpiAmount.textContent = `$${totalUSD.toFixed(2)}`;
  if (kpiCancelled) kpiCancelled.textContent = cancelledCount;
}

// ============================================================================
// RENDERIZADO DE TABLA Y FILTROS
// ============================================================================
function getWorkerDoc(order) {
  if (!order) return 'S/D';
  if (order.employee_doc) return order.employee_doc;
  if (order.employee_identity_document) return order.employee_identity_document;
  if (order.employee_number) return order.employee_number;
  if (order.employee && typeof order.employee === 'object') {
    return order.employee.identity_document || order.employee.id_number || order.employee.employee_number || 'S/D';
  }
  if (order.employee && Array.isArray(employeesList)) {
    const matched = employeesList.find(e => String(e.id) === String(order.employee));
    if (matched) {
      return matched.identity_document || matched.id_number || matched.employee_number || 'S/D';
    }
  }
  return 'S/D';
}

function getWorkerName(order) {
  if (!order) return 'Trabajador';
  if (order.employee_name) return order.employee_name;
  if (order.employee && typeof order.employee === 'object') {
    return order.employee.full_name || `${order.employee.first_name || ''} ${order.employee.last_name || ''}`.trim() || order.employee.username || 'Trabajador';
  }
  if (order.employee && Array.isArray(employeesList)) {
    const matched = employeesList.find(e => String(e.id) === String(order.employee));
    if (matched) {
      return matched.full_name || `${matched.first_name || ''} ${matched.last_name || ''}`.trim() || matched.username || 'Trabajador';
    }
  }
  return 'Trabajador';
}

function renderOrdersTable() {
  const tbody = document.getElementById('tbody-orders');
  if (!tbody) return;

  const searchVal = (document.getElementById('filter-order-search')?.value || '').toLowerCase().trim();
  const dateFrom = document.getElementById('filter-date-from')?.value || '';
  const dateTo = document.getElementById('filter-date-to')?.value || '';
  const statusVal = document.getElementById('filter-status')?.value || 'all';

  const filtered = ordersList.filter(o => {
    // Estado
    if (statusVal !== 'all') {
      const orderStatus = (o.status === 'COMPLETED') ? 'DELIVERED' : o.status;
      if (orderStatus !== statusVal && o.status !== statusVal) return false;
    }

    // Fechas
    if (dateFrom) {
      const orderDate = (o.created_at || '').substring(0, 10);
      if (orderDate && orderDate < dateFrom) return false;
    }
    if (dateTo) {
      const orderDate = (o.created_at || '').substring(0, 10);
      if (orderDate && orderDate > dateTo) return false;
    }

    // Búsqueda
    if (searchVal) {
      const orderNum = String(o.id || '').toLowerCase();
      const code = (o.order_number || '').toLowerCase();
      const workerName = getWorkerName(o).toLowerCase();
      const doc = getWorkerDoc(o).toLowerCase();

      if (!orderNum.includes(searchVal) && !code.includes(searchVal) && !workerName.includes(searchVal) && !doc.includes(searchVal)) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-loading-cell">
          No se encontraron órdenes con los criterios especificados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const formattedDate = formatDate(order.created_at);
    const workerName = getWorkerName(order);
    const workerDoc = getWorkerDoc(order);
    const totalUSD = parseFloat(order.total_amount || 0);
    const orderRate = parseFloat(order.exchange_rate_snapshot || currentExchangeRate);
    const totalVES = totalUSD * orderRate;
    const itemsCount = (order.items || []).reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 1), 0);

    const isCancelled = order.status === 'CANCELLED';
    const statusPill = getOrderStatusBadge(order.status);

    const orderNum = order.order_number || `ORD-INT${String(order.id).padStart(4, '0')}-${new Date(order.created_at).getFullYear()}`;
    return `
      <tr data-id="${order.id}">
        <td>
          <span class="order-code-badge">${escapeHtml(orderNum)}</span>
        </td>
        <td>
          <span class="order-date-text">${formattedDate}</span>
        </td>
        <td>
          <div class="worker-cell">
            <span class="worker-cell-name">${escapeHtml(workerName)}</span>
            <span class="worker-cell-sub">Doc: ${escapeHtml(workerDoc)}</span>
          </div>
        </td>
        <td class="col-center">
          <span class="items-count-pill">${itemsCount} unids</span>
        </td>
        <td>
          <span class="amount-usd">$${totalUSD.toFixed(2)}</span>
        </td>
        <td>
          <span class="amount-ves">Bs. ${totalVES.toFixed(2)}</span>
        </td>
        <td class="col-center">
          <div class="order-status-clickable" data-id="${order.id}" title="Haga clic para cambiar estado">
            ${statusPill}
          </div>
        </td>
        <td>
          <div class="row-actions">
            <!-- Botón Cambiar Estado -->
            <button type="button" class="btn-icon-action btn-change-status" data-id="${order.id}" title="Cambiar estado de la orden">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <!-- Botón Inspeccionar -->
            <button type="button" class="btn-icon-action btn-view-order" data-id="${order.id}" title="Inspeccionar orden y precios snapshot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <!-- Menú de 3 Puntos (Agrupa Reimprimir, Cobrar y Anular) -->
            <div class="order-more-menu-container">
              <button type="button" class="btn-icon-action btn-order-more-trigger" data-id="${order.id}" title="Más opciones de la orden" aria-label="Más opciones">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="5" r="1.5"></circle>
                  <circle cx="12" cy="12" r="1.5"></circle>
                  <circle cx="12" cy="19" r="1.5"></circle>
                </svg>
              </button>
              <div class="order-more-dropdown hidden" id="order-more-dropdown-${order.id}">
                <button type="button" class="order-dropdown-item btn-reprint-order" data-id="${order.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  <span>Reimprimir Comprobante</span>
                </button>
                ${order.status !== 'PAID' && order.status !== 'CANCELLED' ? `
                  <button type="button" class="order-dropdown-item btn-pay-order" data-id="${order.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    <span>Registrar Pago / Cobrar</span>
                  </button>
                ` : ''}
                ${order.status === 'UNDELIVERED' ? `
                  <button type="button" class="order-dropdown-item btn-cancel-order text-danger" data-id="${order.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                    </svg>
                    <span>Anular Orden</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachTableRowListeners();
}

function attachTableRowListeners() {
  const tbody = document.getElementById('tbody-orders');
  if (!tbody) return;

  // Cambiar estado rápido
  tbody.querySelectorAll('.btn-change-status, .order-status-clickable').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openChangeStatusModal(el.dataset.id);
    });
  });

  // Inspeccionar orden
  tbody.querySelectorAll('.btn-view-order').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openOrderDetailModal(btn.dataset.id);
    });
  });

  // Toggle del menú de 3 puntos
  tbody.querySelectorAll('.btn-order-more-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.dataset.id;
      const targetDropdown = document.getElementById(`order-more-dropdown-${orderId}`);
      
      document.querySelectorAll('.order-more-dropdown').forEach(dd => {
        if (dd !== targetDropdown) dd.classList.add('hidden');
      });

      if (targetDropdown) {
        targetDropdown.classList.toggle('hidden');
      }
    });
  });

  // Reimprimir ticket
  tbody.querySelectorAll('.btn-reprint-order').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = btn.closest('.order-more-dropdown');
      if (dd) dd.classList.add('hidden');
      openReceiptModal(btn.dataset.id);
    });
  });

  // Registrar pago de orden
  tbody.querySelectorAll('.btn-pay-order').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = btn.closest('.order-more-dropdown');
      if (dd) dd.classList.add('hidden');
      openOrderPaymentModal(btn.dataset.id);
    });
  });

  // Anular orden
  tbody.querySelectorAll('.btn-cancel-order').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = btn.closest('.order-more-dropdown');
      if (dd) dd.classList.add('hidden');
      handleCancelOrder(btn.dataset.id);
    });
  });

  if (!window._orderMoreDropdownGlobalHandlerAttached) {
    window._orderMoreDropdownGlobalHandlerAttached = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.order-more-menu-container')) {
        document.querySelectorAll('.order-more-dropdown').forEach(dd => dd.classList.add('hidden'));
      }
    });
  }
}

// ============================================================================
// MODAL 1: INSPECCIÓN DETALLADA DE ORDEN
// ============================================================================
async function openOrderDetailModal(orderId) {
  let order = ordersList.find(o => String(o.id) === String(orderId));
  if (!order) return;

  try {
    // Si no tiene items completos, traerla desde API
    if (!order.items || order.items.length === 0) {
      const detailed = await fetchOrder(orderId);
      if (detailed) {
        order = detailed;
        const idx = ordersList.findIndex(o => String(o.id) === String(orderId));
        if (idx !== -1) ordersList[idx] = detailed;
      }
    }
  } catch (err) {
    console.warn('Detalle directo usado como fallback', err);
  }

  selectedOrderForModal = order;

  // Rellenar datos
  const detailOrderNum = order.order_number || `ORD-INT${String(order.id).padStart(4, '0')}-${new Date(order.created_at).getFullYear()}`;
  document.getElementById('detail-order-number').textContent = `Orden ${detailOrderNum}`;
  document.getElementById('detail-order-date').textContent = formatDate(order.created_at);

  const workerName = getWorkerName(order);
  const workerDoc = getWorkerDoc(order);
  const dept = order.employee_department || order.employee?.department || order.employee?.position || '';

  document.getElementById('detail-worker-name').textContent = workerName;
  document.getElementById('detail-worker-id').textContent = `Doc: ${workerDoc} ${dept ? `| Depto: ${dept}` : ''}`;

  const badgeWrap = document.getElementById('detail-status-badge');
  if (badgeWrap) {
    badgeWrap.innerHTML = getOrderStatusBadge(order.status);
  }

  const selectStatus = document.getElementById('detail-select-status');
  if (selectStatus) {
    selectStatus.value = (order.status === 'COMPLETED') ? 'DELIVERED' : (order.status || 'UNDELIVERED');
  }

  const notesPreview = document.getElementById('detail-notes-preview');
  if (notesPreview) {
    notesPreview.textContent = order.notes ? `Notas: ${order.notes}` : 'Sin notas especiales';
  }

  // Renderizar Items
  const itemsTbody = document.getElementById('detail-items-tbody');
  const items = order.items || [];
  let totalQty = 0;

  if (items.length === 0) {
    itemsTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-loading-cell">
          No hay artículos registrados en esta orden.
        </td>
      </tr>
    `;
  } else {
    itemsTbody.innerHTML = items.map(it => {
      const qty = parseInt(it.quantity, 10) || 1;
      totalQty += qty;
      const unitPrice = parseFloat(it.unit_price || it.price || 0);
      const subtotal = parseFloat(it.subtotal || (qty * unitPrice));
      const productName = it.product_name || it.product?.name || 'Artículo Despachado';
      const barcode = it.barcode || it.product?.barcode || 'S/C';

      return `
        <tr>
          <td><span class="order-code-badge">${escapeHtml(barcode)}</span></td>
          <td><strong>${escapeHtml(productName)}</strong></td>
          <td class="col-center font-semibold">${qty}</td>
          <td class="col-right">$${unitPrice.toFixed(2)}</td>
          <td class="col-right font-bold text-primary">$${subtotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  }

  const totalUSD = parseFloat(order.total_amount || 0);
  const rate = parseFloat(order.exchange_rate_snapshot || currentExchangeRate);
  const totalVES = totalUSD * rate;

  document.getElementById('detail-total-qty').textContent = `${totalQty} unidades`;
  document.getElementById('detail-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
  document.getElementById('detail-total-ves').textContent = `Bs. ${totalVES.toFixed(2)} (Tasa: Bs. ${rate.toFixed(2)})`;

  const btnPayDetail = document.getElementById('btn-pay-from-detail');
  if (btnPayDetail) {
    btnPayDetail.style.display = (order.status !== 'PAID' && order.status !== 'CANCELLED') ? 'inline-flex' : 'none';
  }

  const modal = document.getElementById('modal-order-detail');
  if (modal) modal.classList.add('is-active');
}

function closeOrderDetailModal() {
  const modal = document.getElementById('modal-order-detail');
  if (modal) modal.classList.remove('is-active');
}

// ============================================================================
// MODAL 2: COMPROBANTE DE DESPACHO IMPRIMIBLE (RECEIPT)
// ============================================================================
async function openReceiptModal(orderId) {
  let order = ordersList.find(o => String(o.id) === String(orderId));
  if (!order) return;

  if (!order.items || order.items.length === 0) {
    try {
      const detailed = await fetchOrder(orderId);
      if (detailed) order = detailed;
    } catch (err) {
      console.warn('Fallback en modal receipt', err);
    }
  }

  const workerName = getWorkerName(order);
  const workerDoc = getWorkerDoc(order);
  const totalUSD = parseFloat(order.total_amount || 0);
  const rate = parseFloat(order.exchange_rate_snapshot || currentExchangeRate);
  const totalVES = totalUSD * rate;

  const receiptOrderNum = order.order_number || `ORD-INT${String(order.id).padStart(4, '0')}-${new Date(order.created_at).getFullYear()}`;
  document.getElementById('receipt-order-id').textContent = receiptOrderNum;
  document.getElementById('receipt-date').textContent = formatDate(order.created_at);
  document.getElementById('receipt-worker').textContent = workerName.toUpperCase();
  document.getElementById('receipt-worker-doc').textContent = workerDoc;

  const receiptTbody = document.getElementById('receipt-items-tbody');
  const items = order.items || [];
  receiptTbody.innerHTML = items.map(it => {
    const qty = parseInt(it.quantity, 10) || 1;
    const unitPrice = parseFloat(it.unit_price || it.price || 0);
    const subtotal = parseFloat(it.subtotal || (qty * unitPrice));
    const name = it.product_name || it.product?.name || 'Artículo';

    return `
      <tr>
        <td>${qty} x ${escapeHtml(name.substring(0, 20))}</td>
        <td class="receipt-col-right">$${unitPrice.toFixed(2)}</td>
        <td class="receipt-col-right">$${subtotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('receipt-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
  document.getElementById('receipt-total-ves').textContent = `Bs. ${totalVES.toFixed(2)}`;
  document.getElementById('receipt-rate-notice').textContent = `Tasa Oficial BCV: Bs. ${rate.toFixed(2)} / USD`;

  const modal = document.getElementById('modal-receipt');
  if (modal) modal.classList.add('is-active');
}

function closeReceiptModal() {
  const modal = document.getElementById('modal-receipt');
  if (modal) modal.classList.remove('is-active');
}

// ============================================================================
// ANULACIÓN DE ORDEN CON REVERSIÓN
// ============================================================================
async function handleCancelOrder(orderId) {
  const order = ordersList.find(o => String(o.id) === String(orderId));
  const orderNum = order?.order_number || `ORD-INT${String(orderId).padStart(4, '0')}-${new Date().getFullYear()}`;

  if (!order || order.status !== 'UNDELIVERED') {
    showToast('Solo se pueden anular órdenes en estado "Sin entregar". Las órdenes ya finalizadas o entregadas no pueden ser anuladas.', 'warning');
    return;
  }

  const confirmed = typeof window.showConfirmModal === 'function'
    ? await window.showConfirmModal({
        title: 'Anular Orden',
        message: `¿Confirmas la anulación de la orden ${orderNum}?\n\nEsta operación:\n1. Reintegrará inmediatamente el stock físico a almacén.\n2. Revertirá el saldo pendiente cargado a la nómina del trabajador.`,
        confirmText: 'Anular Orden',
        cancelText: 'Cancelar',
        type: 'danger'
      })
    : confirm(`¿Confirmas la anulación de la orden ${orderNum}?`);

  if (confirmed) {
    try {
      await cancelOrder(orderId);
      // Actualizar estado en memoria
      const idx = ordersList.findIndex(o => String(o.id) === String(orderId));
      if (idx !== -1) {
        ordersList[idx].status = 'CANCELLED';
      }
      updateKpis();
      renderOrdersTable();
      showToast(`Orden ${orderNum} anulada y existencias reintegradas`, 'success');
    } catch (err) {
      console.error('Error anulando orden:', err);
      const msg = err.data?.detail || err.data?.error || err.message || 'Error al procesar la anulación de la orden';
      showToast(msg, 'error');
    }
  }
}

// ============================================================================
// MODAL RÁPIDO DE CAMBIO DE ESTADO (DESDE TABLA O BADGE)
// ============================================================================
let selectedOrderForStatusModal = null;

function openChangeStatusModal(orderId) {
  const order = ordersList.find(o => String(o.id) === String(orderId));
  if (!order) return;
  selectedOrderForStatusModal = order;

  const currentStatus = order.status === 'COMPLETED' ? 'DELIVERED' : order.status;
  const workerName = order.employee_name || order.employee?.full_name || 'Trabajador';

  const orderCodeEl = document.getElementById('change-status-order-code');
  const workerNameEl = document.getElementById('change-status-worker-name');
  const currentBadgeEl = document.getElementById('change-status-current-badge');

  const statusModalOrderNum = order.order_number || `ORD-INT${String(order.id).padStart(4, '0')}-${new Date(order.created_at).getFullYear()}`;
  if (orderCodeEl) orderCodeEl.textContent = statusModalOrderNum;
  if (workerNameEl) workerNameEl.textContent = workerName;
  if (currentBadgeEl) currentBadgeEl.innerHTML = getOrderStatusBadge(currentStatus);

  // Seleccionar radio correspondiente
  const radioMap = {
    'UNDELIVERED': 'opt-undelivered',
    'DELIVERED': 'opt-delivered',
    'PAID': 'opt-paid',
    'CANCELLED': 'opt-cancelled'
  };
  const radioId = radioMap[currentStatus] || 'opt-undelivered';
  const radioEl = document.getElementById(radioId);
  if (radioEl) radioEl.checked = true;

  // Restringir regresión de estado (Sin entregar)
  const wrapUndelivered = document.getElementById('wrap-opt-undelivered');
  const optUndelivered = document.getElementById('opt-undelivered');
  const descUndelivered = document.getElementById('desc-opt-undelivered');

  if (currentStatus === 'DELIVERED' || currentStatus === 'PAID') {
    if (wrapUndelivered) wrapUndelivered.classList.add('is-disabled');
    if (optUndelivered) optUndelivered.disabled = true;
    if (descUndelivered) descUndelivered.textContent = 'No disponible: el estado no puede regresar a "Sin entregar".';
  } else {
    if (wrapUndelivered) wrapUndelivered.classList.remove('is-disabled');
    if (optUndelivered) optUndelivered.disabled = false;
    if (descUndelivered) descUndelivered.textContent = 'Pendiente por entrega física al trabajador.';
  }

  // Restringir regresión de estado (Entregado si ya está Pagado)
  const wrapDelivered = document.getElementById('wrap-opt-delivered');
  const optDelivered = document.getElementById('opt-delivered');
  const descDelivered = document.getElementById('desc-opt-delivered');

  if (currentStatus === 'PAID') {
    if (wrapDelivered) wrapDelivered.classList.add('is-disabled');
    if (optDelivered) optDelivered.disabled = true;
    if (descDelivered) descDelivered.textContent = 'No disponible: la orden ya ha sido liquidada/pagada.';
  } else {
    if (wrapDelivered) wrapDelivered.classList.remove('is-disabled');
    if (optDelivered) optDelivered.disabled = false;
    if (descDelivered) descDelivered.textContent = 'Despacho físico realizado y conforme.';
  }

  // Restringir cancelación si ya fue finalizada
  const wrapCancelled = document.getElementById('wrap-opt-cancelled');
  const optCancelled = document.getElementById('opt-cancelled');
  const descCancelled = document.getElementById('desc-opt-cancelled');

  if (currentStatus !== 'UNDELIVERED' && currentStatus !== 'CANCELLED') {
    if (wrapCancelled) wrapCancelled.classList.add('is-disabled');
    if (optCancelled) optCancelled.disabled = true;
    if (descCancelled) descCancelled.textContent = 'No disponible: solo las órdenes "Sin entregar" pueden ser anuladas.';
  } else {
    if (wrapCancelled) wrapCancelled.classList.remove('is-disabled');
    if (optCancelled) optCancelled.disabled = false;
    if (descCancelled) descCancelled.textContent = 'Anula la orden y reintegra el stock a almacén.';
  }

  const modal = document.getElementById('modal-change-status');
  if (modal) modal.classList.add('is-active');
}

function closeChangeStatusModal() {
  selectedOrderForStatusModal = null;
  const modal = document.getElementById('modal-change-status');
  if (modal) modal.classList.remove('is-active');
}

async function handleSaveOrderStatus() {
  if (!selectedOrderForStatusModal) return;
  const selectedRadio = document.querySelector('input[name="quick-status-radio"]:checked');
  if (!selectedRadio) return;

  const newStatus = selectedRadio.value;
  const currentStatus = selectedOrderForStatusModal.status === 'COMPLETED' ? 'DELIVERED' : selectedOrderForStatusModal.status;

  if (newStatus === currentStatus) {
    closeChangeStatusModal();
    return;
  }

  // Validaciones de no regresión de estado
  if ((currentStatus === 'DELIVERED' || currentStatus === 'PAID') && newStatus === 'UNDELIVERED') {
    showToast('El estado de una orden no puede regresar. Una orden entregada o pagada no puede volver a "Sin entregar".', 'warning');
    return;
  }

  if (currentStatus === 'PAID' && newStatus === 'DELIVERED') {
    showToast('Una orden en estado "Pagada" no puede regresar a "Entregada".', 'warning');
    return;
  }

  if (newStatus === 'CANCELLED' && currentStatus !== 'UNDELIVERED') {
    showToast('Solo se pueden anular órdenes en estado "Sin entregar". Las órdenes finalizadas no pueden ser canceladas.', 'warning');
    return;
  }

  const statusLabels = {
    'UNDELIVERED': 'Sin entregar',
    'DELIVERED': 'Entregado',
    'PAID': 'Pagado',
    'CANCELLED': 'Cancelado'
  };

  // Si selecciona "PAID", abrir modal de pago para registrar la modalidad y referencia
  if (newStatus === 'PAID') {
    const orderIdToPay = selectedOrderForStatusModal.id;
    closeChangeStatusModal();
    openOrderPaymentModal(orderIdToPay);
    return;
  }

  const orderNum = selectedOrderForStatusModal.order_number || `ORD-INT${String(selectedOrderForStatusModal.id).padStart(4, '0')}-${new Date().getFullYear()}`;
  const confirmed = typeof window.showConfirmModal === 'function'
    ? await window.showConfirmModal({
        title: 'Actualizar Estado',
        message: newStatus === 'CANCELLED'
          ? `¿Confirmas la anulación de la orden ${orderNum}?\n\nEsta operación reintegrará el stock de productos y cancelará el cargo de nómina.`
          : `¿Deseas cambiar el estado de la orden ${orderNum} a "${statusLabels[newStatus] || newStatus}"?`,
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        type: newStatus === 'CANCELLED' ? 'danger' : 'info'
      })
    : confirm(`¿Cambiar estado a "${statusLabels[newStatus]}"?`);

  if (!confirmed) return;

  try {
    if (newStatus === 'CANCELLED') {
      await cancelOrder(selectedOrderForStatusModal.id);
    } else {
      await updateOrderStatus(selectedOrderForStatusModal.id, newStatus);
    }

    selectedOrderForStatusModal.status = newStatus;
    const idx = ordersList.findIndex(o => String(o.id) === String(selectedOrderForStatusModal.id));
    if (idx !== -1) {
      ordersList[idx].status = newStatus;
    }

    updateKpis();
    renderOrdersTable();
    closeChangeStatusModal();
    showToast(`Estado de la orden ${orderNum} actualizado a "${statusLabels[newStatus]}"`, 'success');
  } catch (err) {
    console.error('Error al cambiar estado:', err);
    const msg = err.data?.detail || err.data?.error || err.message || 'Error al actualizar el estado de la orden';
    showToast(msg, 'error');
  }
}

// ============================================================================
// ACTUALIZACIÓN DE ESTADO DESDE MODAL DETALLE
// ============================================================================
async function handleUpdateOrderStatus() {
  if (!selectedOrderForModal) return;
  const selectStatus = document.getElementById('detail-select-status');
  if (!selectStatus) return;
  const newStatus = selectStatus.value;
  const currentStatus = selectedOrderForModal.status === 'COMPLETED' ? 'DELIVERED' : selectedOrderForModal.status;

  if (newStatus === currentStatus) {
    showToast('La orden ya posee este estado', 'info');
    return;
  }

  if (newStatus === 'CANCELLED' && currentStatus !== 'UNDELIVERED') {
    showToast('Solo se pueden anular órdenes en estado "Sin entregar". Las órdenes finalizadas no pueden ser canceladas.', 'warning');
    return;
  }

  const statusLabels = {
    'UNDELIVERED': 'Sin entregar',
    'DELIVERED': 'Entregado',
    'PAID': 'Pagado',
    'CANCELLED': 'Cancelado'
  };

  const detailStatusOrderNum = selectedOrderForModal.order_number || `ORD-INT${String(selectedOrderForModal.id).padStart(4, '0')}-${new Date().getFullYear()}`;
  const confirmed = typeof window.showConfirmModal === 'function'
    ? await window.showConfirmModal({
        title: 'Cambiar Estado de la Orden',
        message: `¿Deseas cambiar el estado de la orden ${detailStatusOrderNum} a "${statusLabels[newStatus] || newStatus}"?`,
        confirmText: 'Actualizar Estado',
        cancelText: 'Cancelar',
        type: newStatus === 'CANCELLED' ? 'danger' : 'info'
      })
    : confirm(`¿Cambiar estado a "${statusLabels[newStatus]}"?`);

  if (!confirmed) return;

  try {
    if (newStatus === 'CANCELLED') {
      await cancelOrder(selectedOrderForModal.id);
    } else {
      await updateOrderStatus(selectedOrderForModal.id, newStatus);
    }

    selectedOrderForModal.status = newStatus;
    const idx = ordersList.findIndex(o => String(o.id) === String(selectedOrderForModal.id));
    if (idx !== -1) {
      ordersList[idx].status = newStatus;
    }
    const badgeWrap = document.getElementById('detail-status-badge');
    if (badgeWrap) {
      badgeWrap.innerHTML = getOrderStatusBadge(newStatus);
    }
    updateKpis();
    renderOrdersTable();
    showToast(`Estado actualizado a "${statusLabels[newStatus]}"`, 'success');
  } catch (err) {
    console.error('Error actualizando estado:', err);
    const msg = err.data?.detail || err.data?.error || err.message || 'Error al actualizar el estado de la orden';
    showToast(msg, 'error');
  }
}

// ============================================================================
// HELPER BADGES DE ESTADO
// ============================================================================
function getOrderStatusBadge(status) {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'UNDELIVERED':
      return '<span class="status-badge status-undelivered">Sin entregar</span>';
    case 'DELIVERED':
    case 'COMPLETED':
      return '<span class="status-badge status-delivered">Entregado</span>';
    case 'PAID':
      return '<span class="status-badge status-paid">Pagado</span>';
    case 'CANCELLED':
      return '<span class="status-badge status-cancelled">Cancelado</span>';
    default:
      return `<span class="status-badge">${escapeHtml(status || 'Desconocido')}</span>`;
  }
}

// ============================================================================
// MODAL 4: REGISTRO DE PAGO DE ORDEN
// ============================================================================
let selectedOrderForPayment = null;

function openOrderPaymentModal(orderId) {
  const order = ordersList.find(o => String(o.id) === String(orderId));
  if (!order) return;
  selectedOrderForPayment = order;

  const modal = document.getElementById('modal-order-payment');
  if (!modal) return;

  const empId = (typeof order.employee === 'object' && order.employee !== null) 
    ? order.employee.id 
    : (order.employee || order.employee_id || 1);
  const orderNum = order.order_number || `ORD-INT${String(order.id).padStart(4, '0')}-${new Date().getFullYear()}`;
  const workerName = getWorkerName(order) || 'Colaborador';
  const totalAmount = parseFloat(order.total_amount || order.total_usd || 0);

  const inpEmpId = document.getElementById('pay-order-emp-id');
  const inpOrderId = document.getElementById('pay-order-id');
  const lblOrderNum = document.getElementById('pay-modal-order-num');
  const lblWorkerName = document.getElementById('pay-modal-worker-name');
  const lblOrderAmount = document.getElementById('pay-modal-order-amount');
  const inpAmount = document.getElementById('pay-modal-amount');
  const lblVes = document.getElementById('pay-modal-ves-preview');
  const inpRef = document.getElementById('pay-modal-ref');
  const inpNotes = document.getElementById('pay-modal-notes');

  if (inpEmpId) inpEmpId.value = empId;
  if (inpOrderId) inpOrderId.value = order.id;
  if (lblOrderNum) lblOrderNum.textContent = `Orden ${orderNum}`;
  if (lblWorkerName) lblWorkerName.textContent = workerName;
  if (lblOrderAmount) lblOrderAmount.textContent = `$${totalAmount.toFixed(2)}`;
  if (inpAmount) inpAmount.value = totalAmount.toFixed(2);
  if (inpRef) inpRef.value = '';
  if (inpNotes) inpNotes.value = `Cobro directo de orden ${orderNum}`;

  if (lblVes) {
    const ves = totalAmount * currentExchangeRate;
    lblVes.textContent = `Equivalente: Bs. ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  modal.classList.add('is-active');
}

function closeOrderPaymentModal() {
  selectedOrderForPayment = null;
  const modal = document.getElementById('modal-order-payment');
  if (modal) {
    modal.classList.remove('is-active');
  }
  document.getElementById('form-order-payment')?.reset();
  resetOrderPayVoucherPreview();
}

function resetOrderPayVoucherPreview() {
  const inpFile = document.getElementById('pay-modal-voucher');
  if (inpFile) inpFile.value = '';
  const dropzone = document.getElementById('pay-modal-voucher-dropzone');
  const preview = document.getElementById('pay-modal-voucher-preview');
  if (dropzone) dropzone.classList.remove('hidden');
  if (preview) preview.classList.add('hidden');
}

function setupOrderPayVoucherEvents() {
  const inpFile = document.getElementById('pay-modal-voucher');
  const dropzone = document.getElementById('pay-modal-voucher-dropzone');
  const preview = document.getElementById('pay-modal-voucher-preview');
  const imgThumb = document.getElementById('pay-modal-voucher-img');
  const nameLabel = document.getElementById('pay-modal-voucher-name');
  const sizeLabel = document.getElementById('pay-modal-voucher-size');
  const btnRemove = document.getElementById('btn-remove-pay-modal-voucher');

  inpFile?.addEventListener('change', () => {
    const file = inpFile.files?.[0];
    if (!file) {
      resetOrderPayVoucherPreview();
      return;
    }

    if (nameLabel) nameLabel.textContent = file.name;
    if (sizeLabel) sizeLabel.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (imgThumb) imgThumb.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      if (imgThumb) imgThumb.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="%23005187" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }

    if (dropzone) dropzone.classList.add('hidden');
    if (preview) preview.classList.remove('hidden');
  });

  btnRemove?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetOrderPayVoucherPreview();
  });
}

function setupOrderPaymentEvents() {
  setupOrderPayVoucherEvents();

  const modal = document.getElementById('modal-order-payment');
  const btnClose = document.getElementById('btn-close-pay-modal');
  const btnCancel = document.getElementById('btn-cancel-pay-modal');
  const inpAmount = document.getElementById('pay-modal-amount');
  const lblVes = document.getElementById('pay-modal-ves-preview');
  const form = document.getElementById('form-order-payment');

  btnClose?.addEventListener('click', closeOrderPaymentModal);
  btnCancel?.addEventListener('click', closeOrderPaymentModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeOrderPaymentModal();
  });

  inpAmount?.addEventListener('input', () => {
    const val = parseFloat(inpAmount.value) || 0;
    const ves = val * currentExchangeRate;
    if (lblVes) {
      lblVes.textContent = `Equivalente: Bs. ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedOrderForPayment) return;

    const empId = document.getElementById('pay-order-emp-id')?.value;
    const orderId = document.getElementById('pay-order-id')?.value || selectedOrderForPayment.id;
    const amount = parseFloat(document.getElementById('pay-modal-amount')?.value);
    const payment_type = document.getElementById('pay-modal-type')?.value || 'CASH';
    const reference = document.getElementById('pay-modal-ref')?.value?.trim();
    const notes = document.getElementById('pay-modal-notes')?.value?.trim();
    const voucherFile = document.getElementById('pay-modal-voucher')?.files?.[0];

    if (isNaN(amount) || amount <= 0) {
      showToast('Ingresa un monto de pago válido mayor a 0', 'warning');
      return;
    }

    const orderNum = selectedOrderForPayment.order_number || `#ORD-${orderId}`;
    const confirmed = typeof window.showConfirmModal === 'function'
      ? await window.showConfirmModal({
          title: 'Confirmar Registro de Pago',
          message: `¿Registrar pago por $${amount.toFixed(2)} USD para la orden ${orderNum} y cambiar su estado a "Pagado"?`,
          confirmText: 'Registrar Pago',
          cancelText: 'Cancelar',
          type: 'info'
        })
      : confirm(`¿Registrar pago por $${amount.toFixed(2)} USD para la orden ${orderNum}?`);

    if (!confirmed) return;

    const btnSubmit = document.getElementById('btn-save-order-payment');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
      const formData = new FormData();
      formData.append('employee', empId);
      formData.append('order', orderId);
      formData.append('amount', amount);
      formData.append('payment_type', payment_type);
      formData.append('reference', reference || `Pago Orden ${orderNum}`);
      formData.append('notes', notes || `Cobro de orden ${orderNum}`);
      if (voucherFile) formData.append('voucher', voucherFile);

      await createDebtPayment(formData);
      await updateOrderStatus(orderId, 'PAID');

      selectedOrderForPayment.status = 'PAID';
      const idx = ordersList.findIndex(o => String(o.id) === String(orderId));
      if (idx !== -1) {
        ordersList[idx].status = 'PAID';
      }

      updateKpis();
      renderOrdersTable();
      closeOrderPaymentModal();
      showToast(`Pago registrado exitosamente para la orden ${orderNum}`, 'success');
    } catch (err) {
      console.error('Error registrando pago de orden:', err);
      const msg = err.data?.detail || err.data?.error || err.message || 'Error al registrar el pago';
      showToast(msg, 'error');
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
    }
  });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Filtros
  document.getElementById('filter-order-search')?.addEventListener('input', renderOrdersTable);
  document.getElementById('filter-date-from')?.addEventListener('change', renderOrdersTable);
  document.getElementById('filter-date-to')?.addEventListener('change', renderOrdersTable);
  document.getElementById('filter-status')?.addEventListener('change', renderOrdersTable);

  document.getElementById('btn-clear-order-filters')?.addEventListener('click', () => {
    document.getElementById('filter-order-search').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-status').value = 'all';
    renderOrdersTable();
  });

  // Modal Detalle
  document.getElementById('btn-close-detail-modal')?.addEventListener('click', closeOrderDetailModal);
  document.getElementById('btn-ok-detail')?.addEventListener('click', closeOrderDetailModal);
  document.getElementById('btn-update-detail-status')?.addEventListener('click', handleUpdateOrderStatus);
  document.getElementById('btn-reprint-from-detail')?.addEventListener('click', () => {
    if (selectedOrderForModal) {
      closeOrderDetailModal();
      openReceiptModal(selectedOrderForModal.id);
    }
  });
  document.getElementById('btn-pay-from-detail')?.addEventListener('click', () => {
    if (selectedOrderForModal) {
      const orderIdToPay = selectedOrderForModal.id;
      closeOrderDetailModal();
      openOrderPaymentModal(orderIdToPay);
    }
  });

  // Modal Recibo
  document.getElementById('btn-close-receipt-modal')?.addEventListener('click', closeReceiptModal);
  document.getElementById('btn-cancel-receipt')?.addEventListener('click', closeReceiptModal);
  document.getElementById('btn-print-receipt')?.addEventListener('click', () => {
    window.print();
  });

  // Modal Cambio Rápido de Estado
  document.getElementById('btn-close-status-modal')?.addEventListener('click', closeChangeStatusModal);
  document.getElementById('btn-cancel-status-modal')?.addEventListener('click', closeChangeStatusModal);
  document.getElementById('btn-confirm-status-change')?.addEventListener('click', handleSaveOrderStatus);

  // Eventos Modal Pago de Orden
  setupOrderPaymentEvents();
}

// ============================================================================
// HELPERS
// ============================================================================
function formatDate(isoStr) {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';

  toast.innerHTML = `
    <div class="toast-content-wrap">
      <span class="toast-icon">${icon}</span>
      <div class="toast-body">
        ${title ? `<strong class="toast-title">${escapeHtml(title)}</strong>` : ''}
        <span class="toast-message">${escapeHtml(message)}</span>
      </div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, match => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}

function checkPendingOrderNotification() {
  const pendingToast = sessionStorage.getItem('pending_order_toast');
  if (pendingToast) {
    sessionStorage.removeItem('pending_order_toast');
    try {
      const data = JSON.parse(pendingToast);
      showToast(data.message, data.type || 'success', data.title || '¡Registro Exitoso!');
    } catch (e) {
      showToast('El pedido fue registrado exitosamente con estado "Sin entregar".', 'success', '¡Registro Exitoso!');
    }
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('created') === 'true') {
    const orderNum = urlParams.get('order') || '';
    const msg = orderNum 
      ? `El pedido #${orderNum} fue registrado exitosamente con estado "Sin entregar".` 
      : 'El pedido fue registrado exitosamente con estado "Sin entregar".';
    showToast(msg, 'success', '¡Registro Exitoso!');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}


