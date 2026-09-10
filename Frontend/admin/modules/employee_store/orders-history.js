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
        <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
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
          <td colspan="8" style="text-align: center; padding: 40px; color: #dc2626;">
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
      const workerName = (o.employee_name || o.employee?.full_name || o.employee?.name || '').toLowerCase();
      const doc = (o.employee_doc || o.employee?.id_number || o.employee?.employee_number || '').toLowerCase();

      if (!orderNum.includes(searchVal) && !code.includes(searchVal) && !workerName.includes(searchVal) && !doc.includes(searchVal)) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
          No se encontraron órdenes con los criterios especificados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const formattedDate = formatDate(order.created_at);
    const workerName = order.employee_name || order.employee?.full_name || (order.employee?.first_name ? `${order.employee.first_name} ${order.employee.last_name || ''}` : 'Trabajador');
    const workerDoc = order.employee_doc || order.employee?.id_number || order.employee?.employee_number || 'S/D';
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
        <td style="text-align: center;">
          <span class="items-count-pill">${itemsCount} unids</span>
        </td>
        <td>
          <span class="amount-usd">$${totalUSD.toFixed(2)}</span>
        </td>
        <td>
          <span class="amount-ves">Bs. ${totalVES.toFixed(2)}</span>
        </td>
        <td style="text-align: center;">
          <div class="order-status-clickable" data-id="${order.id}" title="Haga clic para cambiar estado" style="cursor: pointer; display: inline-block;">
            ${statusPill}
          </div>
        </td>
        <td>
          <div class="row-actions">
            <!-- Botón Cambiar Estado -->
            <button type="button" class="btn-icon-action btn-change-status" data-id="${order.id}" title="Cambiar estado de la orden">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <!-- Botón Inspeccionar -->
            <button type="button" class="btn-icon-action btn-view-order" data-id="${order.id}" title="Inspeccionar orden y precios snapshot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <!-- Botón Reimprimir -->
            <button type="button" class="btn-icon-action btn-reprint-order" data-id="${order.id}" title="Reimprimir Comprobante de Despacho">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </button>
            <!-- Botón Anular (Solo si es Sin entregar / no finalizada) -->
            ${order.status === 'UNDELIVERED' ? `
              <button type="button" class="btn-icon-action btn-cancel-order" data-id="${order.id}" title="Anular orden y revertir inventario">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
              </button>
            ` : ''}
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
    el.addEventListener('click', () => openChangeStatusModal(el.dataset.id));
  });

  // Inspeccionar orden
  tbody.querySelectorAll('.btn-view-order').forEach(btn => {
    btn.addEventListener('click', () => openOrderDetailModal(btn.dataset.id));
  });

  // Reimprimir ticket
  tbody.querySelectorAll('.btn-reprint-order').forEach(btn => {
    btn.addEventListener('click', () => openReceiptModal(btn.dataset.id));
  });

  // Anular orden
  tbody.querySelectorAll('.btn-cancel-order').forEach(btn => {
    btn.addEventListener('click', () => handleCancelOrder(btn.dataset.id));
  });
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

  const workerName = order.employee_name || order.employee?.full_name || (order.employee?.first_name ? `${order.employee.first_name} ${order.employee.last_name || ''}` : 'Trabajador');
  const workerDoc = order.employee_doc || order.employee?.id_number || order.employee?.employee_number || 'S/D';
  const dept = order.employee?.department || order.employee?.position || '';

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
        <td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">
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
          <td style="text-align: center; font-weight: 600;">${qty}</td>
          <td style="text-align: right;">$${unitPrice.toFixed(2)}</td>
          <td style="text-align: right; font-weight: 700; color: #005187;">$${subtotal.toFixed(2)}</td>
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

  const workerName = order.employee_name || order.employee?.full_name || (order.employee?.first_name ? `${order.employee.first_name} ${order.employee.last_name || ''}` : 'EMPLEADO');
  const workerDoc = order.employee_doc || order.employee?.id_number || order.employee?.employee_number || 'S/D';
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
        <td style="text-align: right;">$${unitPrice.toFixed(2)}</td>
        <td style="text-align: right;">$${subtotal.toFixed(2)}</td>
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

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
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
