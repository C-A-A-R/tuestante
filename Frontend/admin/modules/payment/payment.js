/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DEL MÓDULO DE PAGOS (PAYMENT.JS)
 * ==========================================================================
 * Gestiona el listado interactivo de pagos y comprobantes con:
 * - Doble moneda (USD y Bolívares) con montos históricos de backend.
 * - Modal de resumen de orden con detalle de productos, precios y estados.
 * - Diálogos modales y notificaciones Toast para aprobaciones/rechazos (sin alertas).
 * - Modal de previsualización de recibos y registro manual de pagos.
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { 
  getPayments, 
  getPaymentById, 
  createPayment, 
  reviewPayment, 
  getPaymentMetrics, 
  getOrdersForPaymentSelect,
  getOrderSummaryForPayment
} from './payment.api.js';

import { 
  getDualPrice, 
  formatUSD, 
  formatVES, 
  convertUsdToVes 
} from '../../js/service/currency-converter.service.js';

/**
 * ESTADO GLOBAL DEL MÓDULO DE PAGOS
 */
const state = {
  payments: [],
  totalPayments: 0,
  currentPage: 1,
  pageSize: 8,
  totalPages: 1,
  filters: {
    search: '',
    status: 'all',
    stage: 'all',
    payment_method: 'all',
    date_from: '',
    date_to: ''
  },
  activePaymentId: null,
  pendingApprovalPayment: null,
  pendingOrdersList: []
};

/**
 * ==========================================================================
 * 0. SISTEMA DE NOTIFICACIONES TOAST (SIN WINDOW.ALERT)
 * ==========================================================================
 */
export function showToast(type = 'success', title = 'Éxito', message = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastEl = document.createElement('div');
  toastEl.className = `toast-message toast-${type}`;

  const iconSvg = type === 'success' ? `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ` : type === 'error' ? `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  ` : `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  `;

  toastEl.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <strong class="toast-title">${title}</strong>
      <span class="toast-desc">${message}</span>
    </div>
    <button type="button" class="toast-close-btn" aria-label="Cerrar notificación">
      <svg style="width: 15px; height: 15px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  container.appendChild(toastEl);

  const closeBtn = toastEl.querySelector('.toast-close-btn');
  const dismiss = () => {
    toastEl.classList.add('toast-hiding');
    setTimeout(() => {
      if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 250);
  };

  if (closeBtn) closeBtn.addEventListener('click', dismiss);
  setTimeout(dismiss, 4200);
}

/**
 * ==========================================================================
 * 1. RENDERIZADO DE MÉTRICAS KPI SUPERIORES (DOBLE MONEDA)
 * ==========================================================================
 */
async function loadAndRenderMetrics() {
  try {
    const metrics = await getPaymentMetrics();
    
    const revenueEl = document.getElementById('kpi-total-revenue');
    const revenueVesEl = document.getElementById('kpi-total-revenue-ves');
    const totalVouchersEl = document.getElementById('kpi-total-vouchers');
    const inReviewEl = document.getElementById('kpi-in-review');
    const tabReviewCountEl = document.getElementById('tab-review-count');
    const initialStageEl = document.getElementById('kpi-initial-stage');
    const finalStageEl = document.getElementById('kpi-final-stage');

    if (revenueEl) revenueEl.textContent = metrics.formattedTotalRevenue || `$${metrics.totalRevenue?.toFixed(2) || '0.00'}`;
    if (revenueVesEl) revenueVesEl.textContent = metrics.formattedTotalRevenueVes || formatVES(metrics.totalRevenueVes || (metrics.totalRevenue * 36.50));
    if (totalVouchersEl) totalVouchersEl.textContent = `${metrics.totalVouchers || 0} comprobantes procesados`;
    if (inReviewEl) inReviewEl.textContent = metrics.inReviewCount || 0;
    if (tabReviewCountEl) tabReviewCountEl.textContent = metrics.inReviewCount || 0;
    if (initialStageEl) initialStageEl.textContent = metrics.initialStageCount || 0;
    if (finalStageEl) finalStageEl.textContent = metrics.finalStageCount || 0;
  } catch (error) {
    console.warn('[TuEstante Payment] Error al cargar métricas:', error);
  }
}

/**
 * ==========================================================================
 * 2. RENDERIZADO DE LA TABLA DE PAGOS (DOBLE MONEDA Y BOTÓN DE PRODUCTOS)
 * ==========================================================================
 */
function renderPaymentsTable(payments) {
  const tbody = document.getElementById('payments-table-tbody');
  if (!tbody) return;

  if (!payments || payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <svg style="width: 38px; height: 38px; color: var(--border-color);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
            <strong style="color: var(--text-main); font-size: 0.95rem;">No se encontraron comprobantes de pago</strong>
            <span style="font-size: 0.82rem;">Intenta ajustar los filtros de búsqueda o fecha.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = payments.map(payment => {
    const isReview = payment.status === 'review';
    const itemsCount = payment.order_summary?.items?.length || payment.order_summary?.items_count || 1;

    // Formateo de monto en Bolívares (usando valor guardado en backend o calculado)
    const amountVesText = payment.formatted_amount_ves || (payment.amount_ves ? formatVES(payment.amount_ves) : formatVES(payment.amount * (payment.exchange_rate || 36.50)));

    // Botones de acción según el estado
    const actionsHtml = isReview ? `
      <div class="inline-actions" style="justify-content: flex-end;">
        <button 
          type="button" 
          class="btn-action-icon btn-action-approve btn-quick-approve" 
          data-payment-id="${payment.id}"
          title="Aprobar pago"
          aria-label="Aprobar comprobante ${payment.payment_code}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <button 
          type="button" 
          class="btn-action-icon btn-action-reject btn-quick-reject" 
          data-payment-id="${payment.id}"
          title="Rechazar pago"
          aria-label="Rechazar comprobante ${payment.payment_code}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    ` : `
      <div style="text-align: right; font-size: 0.775rem; color: var(--text-muted); font-weight: 600;">
        ${payment.status === 'approved' ? '<span style="color: #16a34a;">✓ Verificado</span>' : '<span style="color: #dc2626;">✕ Descartado</span>'}
      </div>
    `;

    return `
      <tr id="payment-row-${payment.id}">
        <td>
          <span class="cell-code">${payment.payment_code}</span>
        </td>
        <td>
          <button 
            type="button" 
            class="cell-order-btn btn-view-order-summary" 
            data-order-id="${payment.order_id}"
            title="Ver productos y resumen del pedido ${payment.order_code}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <span>${payment.order_code} (${itemsCount} prod.)</span>
          </button>
        </td>
        <td>
          <div class="cell-client-meta">
            <span class="client-name-bold">${payment.client.name}</span>
            <span class="client-email-muted">${payment.client.phone || payment.client.email}</span>
          </div>
        </td>
        <td>
          <div class="cell-amount-dual">
            <span class="amount-usd">${payment.formatted_amount}</span>
            <span class="amount-ves">${amountVesText}</span>
          </div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span class="cell-method-box">
              <strong>${payment.payment_method_label}</strong>
            </span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${payment.bank_name || ''} Ref: <code>${payment.reference_number}</code></span>
          </div>
        </td>
        <td>
          <span class="stage-badge ${payment.stage_badge_class}">
            ${payment.payment_stage_label}
          </span>
        </td>
        <td>
          <span class="status-badge ${payment.status_badge_class}">
            ${payment.status_label}
          </span>
        </td>
        <td>
          <span style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
            ${payment.formatted_date} <small style="color: #94a3b8;">${payment.formatted_time || ''}</small>
          </span>
        </td>
        <td>
          <button 
            type="button" 
            class="btn-receipt-preview btn-open-receipt" 
            data-payment-id="${payment.id}"
            title="Ver comprobante adjunto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Ver Recibo</span>
          </button>
        </td>
        <td style="text-align: right;">
          ${actionsHtml}
        </td>
      </tr>
    `;
  }).join('');

  setupTableEventListeners(payments);
}

/**
 * ==========================================================================
 * 3. CONTROLADORES DE EVENTOS EN LA TABLA
 * ==========================================================================
 */
function setupTableEventListeners(payments) {
  // Botones para ver Resumen de Orden y Productos
  const orderSummaryButtons = document.querySelectorAll('.btn-view-order-summary');
  orderSummaryButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.getAttribute('data-order-id');
      openOrderSummaryModal(orderId);
    });
  });

  // Botones "Ver Recibo"
  const receiptButtons = document.querySelectorAll('.btn-open-receipt');
  receiptButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const paymentId = parseInt(btn.getAttribute('data-payment-id'), 10);
      const payment = payments.find(p => p.id === paymentId);
      if (payment) {
        openReceiptReviewModal(payment);
      }
    });
  });

  // Botón Rápido Aprobar en fila (Abre diálogo de confirmación modal sin alerts)
  const approveButtons = document.querySelectorAll('.btn-quick-approve');
  approveButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const paymentId = parseInt(btn.getAttribute('data-payment-id'), 10);
      const payment = payments.find(p => p.id === paymentId);
      if (payment) {
        openApproveConfirmModal(payment);
      }
    });
  });

  // Botón Rápido Rechazar en fila
  const rejectButtons = document.querySelectorAll('.btn-quick-reject');
  rejectButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const paymentId = parseInt(btn.getAttribute('data-payment-id'), 10);
      const payment = payments.find(p => p.id === paymentId);
      if (payment) {
        openReceiptReviewModal(payment, true);
      }
    });
  });
}

/**
 * ==========================================================================
 * 4. MODAL 1: RESUMEN DE ORDEN, PRODUCTOS Y ESTADOS (DOBLE MONEDA)
 * ==========================================================================
 */
async function openOrderSummaryModal(orderId) {
  const modal = document.getElementById('order-summary-modal-backdrop');
  if (!modal) return;

  try {
    const order = await getOrderSummaryForPayment(orderId);

    document.getElementById('modal-order-summary-title').textContent = `Resumen del Pedido ${order.order_code}`;
    
    const badgeEl = document.getElementById('modal-order-status-badge');
    if (badgeEl) {
      badgeEl.className = `status-badge ${order.status_badge_class || 'badge-manufacturing'}`;
      badgeEl.textContent = order.status_label || 'En fabricación';
    }

    document.getElementById('modal-order-client-name').textContent = order.client?.name || 'Cliente';
    document.getElementById('modal-order-client-contact').textContent = `${order.client?.email || ''} • ${order.client?.phone || ''}`;
    document.getElementById('modal-order-date').textContent = order.formatted_date || new Date().toLocaleDateString('es-ES');

    // Tabla de productos
    const tbody = document.getElementById('modal-order-products-tbody');
    const items = order.items || [];
    
    tbody.innerHTML = items.map(item => {
      const unitUsd = item.unit_price_usd || item.unit_price || 0;
      const totalUsd = item.total_price_usd || item.total_price || (unitUsd * (item.quantity || 1));
      
      // Si el pago ya fue aprobado, usar valores históricos guardados en backend
      const rate = order.exchange_rate || 36.50;
      const unitVes = item.unit_price_ves || (unitUsd * rate);
      const totalVes = item.total_price_ves || (totalUsd * rate);

      return `
        <tr>
          <td>
            <span class="product-item-name">${item.product_name}</span>
            ${item.notes ? `<span class="product-item-notes">${item.notes}</span>` : ''}
          </td>
          <td style="text-align: center; font-weight: 700;">
            ${item.quantity || 1}
          </td>
          <td style="text-align: right;">
            <div><strong>${formatUSD(unitUsd)}</strong></div>
            <div style="font-size: 0.75rem; color: var(--secondary);">${formatVES(unitVes)}</div>
          </td>
          <td style="text-align: right;">
            <div><strong>${formatUSD(totalUsd)}</strong></div>
            <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 600;">${formatVES(totalVes)}</div>
          </td>
        </tr>
      `;
    }).join('');

    // Totales y desglose de pago inicial y saldo final
    const totalAmount = order.total_amount || 350.00;
    const totalAmountVes = order.total_amount_ves || (totalAmount * (order.exchange_rate || 36.50));
    const halfUsd = totalAmount * 0.5;
    const halfVes = totalAmountVes * 0.5;

    document.getElementById('modal-order-total-usd').textContent = formatUSD(totalAmount);
    document.getElementById('modal-order-total-ves').textContent = `(${formatVES(totalAmountVes)})`;
    document.getElementById('modal-order-initial-usd').textContent = formatUSD(halfUsd);
    document.getElementById('modal-order-initial-ves').textContent = `(${formatVES(halfVes)})`;
    document.getElementById('modal-order-final-usd').textContent = formatUSD(halfUsd);
    document.getElementById('modal-order-final-ves').textContent = `(${formatVES(halfVes)})`;

    // Aviso de tipo de tasa (Tasa del pago registrado si existe, o tasa actual del sistema)
    const rateNoticeText = document.getElementById('modal-order-rate-text');
    if (rateNoticeText) {
      if (order.has_registered_payment && order.registered_payment) {
        const rp = order.registered_payment;
        rateNoticeText.textContent = `Tasa fijada al registrar el pago (${rp.payment_code} - ${rp.payment_stage_label}): Bs. ${rp.exchange_rate.toFixed(2)}/$ (Fecha: ${rp.formatted_date}).`;
      } else {
        rateNoticeText.textContent = `Montos en Bolívares calculados según la tasa del sistema (Tasa: Bs. ${(order.exchange_rate || 36.50).toFixed(2)}/$).`;
      }
    }

    // Redirección directa a la pantalla de detalle del pedido
    const orderLinkDetail = document.getElementById('modal-order-link-detail');
    if (orderLinkDetail) {
      orderLinkDetail.href = `../order/order-detail.html?id=${order.id}`;
    }

    modal.classList.add('is-open');
  } catch (error) {
    showToast('error', 'Error', 'No se pudo cargar el resumen del pedido.');
  }
}

function closeOrderSummaryModal() {
  const modal = document.getElementById('order-summary-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
}

/**
 * ==========================================================================
 * 5. MODAL 2: DIÁLOGO DE CONFIRMACIÓN DE APROBACIÓN (SIN ALERTS)
 * ==========================================================================
 */
function openApproveConfirmModal(payment) {
  state.pendingApprovalPayment = payment;
  const modal = document.getElementById('approve-confirm-modal-backdrop');
  if (!modal) return;

  const vesAmount = payment.formatted_amount_ves || (payment.amount_ves ? formatVES(payment.amount_ves) : formatVES(payment.amount * 36.50));

  document.getElementById('modal-approve-confirm-msg').innerHTML = `
    ¿Deseas confirmar la aprobación del comprobante <strong>${payment.payment_code}</strong>?
  `;
  document.getElementById('modal-approve-amount-text').textContent = `${payment.formatted_amount} (${vesAmount})`;
  document.getElementById('modal-approve-order-text').textContent = `${payment.order_code} - ${payment.client.name}`;

  const noteEl = document.getElementById('modal-approve-stage-note');
  if (noteEl) {
    if (payment.payment_stage === 'initial') {
      noteEl.textContent = '⚙️ Esta acción pasará el pedido a "En fabricación" y generará la Orden de Fabricación para el taller.';
    } else {
      noteEl.textContent = '🚚 Esta acción completará el pago del 100% y habilitará el despacho y envío del pedido.';
    }
  }

  modal.classList.add('is-open');
}

function closeApproveConfirmModal() {
  const modal = document.getElementById('approve-confirm-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  state.pendingApprovalPayment = null;
}

/**
 * Ejecuta la aprobación definitiva tras confirmación en el modal
 */
async function executeConfirmedApproval() {
  if (!state.pendingApprovalPayment) return;
  const payment = state.pendingApprovalPayment;

  try {
    const res = await reviewPayment(payment.id, 'approved');
    closeApproveConfirmModal();
    closeReceiptReviewModal();
    
    showToast('success', '¡Pago Aprobado con Éxito!', res.message || `Comprobante ${payment.payment_code} aprobado.`);
    await refreshData();
  } catch (err) {
    showToast('error', 'Error al Aprobar', err.message || 'Ocurrió un error al procesar la aprobación.');
  }
}

/**
 * ==========================================================================
 * 6. MODAL 3: REVISIÓN DE COMPROBANTE DE PAGO
 * ==========================================================================
 */
function openReceiptReviewModal(payment, autoFocusRejection = false) {
  state.activePaymentId = payment.id;
  const modal = document.getElementById('receipt-modal-backdrop');
  if (!modal) return;

  const vesAmount = payment.formatted_amount_ves || (payment.amount_ves ? formatVES(payment.amount_ves) : formatVES(payment.amount * 36.50));

  document.getElementById('modal-receipt-title').textContent = `Comprobante ${payment.payment_code} - Pedido ${payment.order_code}`;
  
  const imgUrl = payment.receipt_file_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80';
  const imgEl = document.getElementById('modal-receipt-img');
  if (imgEl) {
    imgEl.src = imgUrl;
    imgEl.alt = `Comprobante ${payment.reference_number}`;
  }

  // Disparador de zoom en pantalla completa
  const zoomTrigger = document.getElementById('receipt-preview-zoom-trigger');
  if (zoomTrigger) {
    zoomTrigger.onclick = () => {
      openReceiptLightbox(imgUrl);
    };
  }

  document.getElementById('modal-receipt-order').textContent = payment.order_code;
  document.getElementById('modal-receipt-client').textContent = `${payment.client.name} (${payment.client.phone || payment.client.email})`;
  document.getElementById('modal-receipt-amount').textContent = payment.formatted_amount;
  document.getElementById('modal-receipt-amount-ves').textContent = vesAmount;
  document.getElementById('modal-receipt-stage').textContent = payment.payment_stage_label;
  document.getElementById('modal-receipt-bank').textContent = `${payment.payment_method_label} - ${payment.bank_name || 'N/A'}`;
  document.getElementById('modal-receipt-reference').textContent = payment.reference_number;
  document.getElementById('modal-receipt-notes').textContent = payment.notes || 'Sin notas adicionales.';

  // Botón para ver productos del pedido directamente desde el visor de recibo
  const viewOrderProductsBtn = document.getElementById('btn-modal-view-order-products');
  if (viewOrderProductsBtn) {
    viewOrderProductsBtn.onclick = () => {
      openOrderSummaryModal(payment.order_id);
    };
  }

  const rejectionBox = document.getElementById('modal-rejection-box');
  const rejectionInput = document.getElementById('modal-rejection-input');
  const rejectBtn = document.getElementById('btn-modal-reject-action');
  const approveBtn = document.getElementById('btn-modal-approve-action');

  if (rejectionInput) rejectionInput.value = '';

  if (autoFocusRejection) {
    if (rejectionBox) rejectionBox.classList.add('is-visible');
    if (rejectionInput) setTimeout(() => rejectionInput.focus(), 150);
  } else {
    if (rejectionBox) rejectionBox.classList.remove('is-visible');
  }

  if (payment.status !== 'review') {
    if (rejectBtn) rejectBtn.style.display = 'none';
    if (approveBtn) approveBtn.style.display = 'none';
  } else {
    if (rejectBtn) rejectBtn.style.display = 'inline-flex';
    if (approveBtn) approveBtn.style.display = 'inline-flex';
  }

  modal.classList.add('is-open');
}

function closeReceiptReviewModal() {
  const modal = document.getElementById('receipt-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  state.activePaymentId = null;
}

/**
 * ==========================================================================
 * 7. MODAL 5: VISOR FLOTANTE DE COMPROBANTE EN PANTALLA COMPLETA (LIGHTBOX)
 * ==========================================================================
 */
function openReceiptLightbox(imageUrl) {
  const lightbox = document.getElementById('receipt-lightbox-backdrop');
  const lightboxImg = document.getElementById('lightbox-img');
  if (!lightbox || !lightboxImg) return;

  lightboxImg.src = imageUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80';
  lightbox.classList.add('is-open');
}

function closeReceiptLightbox() {
  const lightbox = document.getElementById('receipt-lightbox-backdrop');
  if (lightbox) lightbox.classList.remove('is-open');
}

/**
 * Ejecuta el rechazo del pago con motivo
 */
async function executePaymentRejection(paymentId) {
  const rejectionBox = document.getElementById('modal-rejection-box');
  const rejectionInput = document.getElementById('modal-rejection-input');

  if (rejectionBox && !rejectionBox.classList.contains('is-visible')) {
    rejectionBox.classList.add('is-visible');
    if (rejectionInput) rejectionInput.focus();
    return;
  }

  const reason = rejectionInput ? rejectionInput.value.trim() : '';
  if (!reason) {
    showToast('info', 'Motivo Requerido', 'Por favor especifica el motivo del rechazo para notificar al cliente.');
    if (rejectionInput) rejectionInput.focus();
    return;
  }

  try {
    await reviewPayment(paymentId, 'rejected', reason);
    closeReceiptReviewModal();
    showToast('error', 'Comprobante Rechazado', 'Se ha marcado el comprobante como rechazado y registrado el motivo.');
    await refreshData();
  } catch (err) {
    showToast('error', 'Error', 'Error al procesar el rechazo: ' + err.message);
  }
}

/**
 * ==========================================================================
 * 7. MODAL 4: REGISTRAR NUEVO PAGO MANUAL
 * ==========================================================================
 */
/**
 * ==========================================================================
 * 7. MODAL 4: REGISTRAR NUEVO PAGO MANUAL (CON SEARCHABLE INPUT SELECT)
 * ==========================================================================
 */
function renderSearchableOrderOptions(searchTerm = '') {
  const dropdownList = document.getElementById('payment-order-dropdown-list');
  const clearBtn = document.getElementById('payment-order-search-clear');
  const searchInput = document.getElementById('payment-order-search-input');
  if (!dropdownList) return;

  const term = searchTerm.toLowerCase().trim();
  let orders = state.pendingOrdersList || [];

  if (clearBtn) {
    if (term || (searchInput && searchInput.value.trim())) {
      clearBtn.classList.add('is-visible');
    } else {
      clearBtn.classList.remove('is-visible');
    }
  }

  if (term) {
    orders = orders.filter(o => {
      const codeMatch = (o.order_code || '').toLowerCase().includes(term);
      const idMatch = String(o.id || '').includes(term);
      const nameMatch = (o.client_name || '').toLowerCase().includes(term);
      const emailMatch = (o.client_email || '').toLowerCase().includes(term);
      const dateMatch = (o.formatted_date || '').includes(term) || (o.created_at || '').includes(term);
      return codeMatch || idMatch || nameMatch || emailMatch || dateMatch;
    });
  }

  if (orders.length === 0) {
    dropdownList.innerHTML = `
      <div class="searchable-dropdown-empty">
        <svg style="width: 24px; height: 24px; color: #94a3b8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <strong>No se encontraron pedidos pendientes</strong>
        <span style="font-size: 0.75rem; color: var(--text-muted);">
          Sin coincidencias para "${searchTerm}". Prueba con número (#00125) o fecha (DD/MM/AAAA).
        </span>
      </div>
    `;
    return;
  }

  dropdownList.innerHTML = `
    <div class="searchable-dropdown-header">
      <span>${orders.length} pedido(s) con pago pendiente</span>
      <span style="font-size: 0.7rem; font-weight: 500;">Búsqueda por Nro / Fecha</span>
    </div>
    ${orders.map(order => {
      const stageLabel = order.pending_stage === 'final' ? 'Pago Final (Saldo)' : 'Pago Inicial';
      const stageBadgeClass = order.pending_stage === 'final' ? 'badge-stage-final' : 'badge-stage-initial';
      const dateText = order.formatted_date || (order.created_at ? new Date(order.created_at).toLocaleDateString('es-ES') : 'Reciente');
      const dueUsd = order.amount_due || 0;
      const dueVes = dueUsd * 36.50;

      return `
        <div class="searchable-dropdown-item" data-order-id="${order.id}" role="option" tabindex="0">
          <div class="searchable-item-left">
            <div class="searchable-item-top">
              <span class="searchable-item-code">${order.order_code || `#00${order.id}`}</span>
              <span class="searchable-item-date">
                <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${dateText}
              </span>
              <span class="stage-badge ${stageBadgeClass}" style="font-size: 0.68rem; padding: 2px 7px;">
                ${stageLabel}
              </span>
            </div>
            <span class="searchable-item-client">
              ${order.client_name || 'Cliente'} ${order.client_email ? `• <span style="color: var(--text-muted);">${order.client_email}</span>` : ''}
            </span>
          </div>
          <div class="searchable-item-right">
            <span class="searchable-item-amount-usd">${formatUSD(dueUsd)}</span>
            <span class="searchable-item-amount-ves">${formatVES(dueVes)}</span>
          </div>
        </div>
      `;
    }).join('')}
  `;

  // Asignar clics a las opciones
  const items = dropdownList.querySelectorAll('.searchable-dropdown-item');
  items.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = parseInt(item.getAttribute('data-order-id'), 10);
      selectOrderForPayment(orderId);
    });
  });
}

function selectOrderForPayment(orderId) {
  const order = (state.pendingOrdersList || []).find(o => o.id === orderId);
  if (!order) return;

  const hiddenSelect = document.getElementById('payment-order-select');
  const searchInput = document.getElementById('payment-order-search-input');
  const amountInput = document.getElementById('payment-amount-input');
  const stageSelect = document.getElementById('payment-stage-select');
  const clearBtn = document.getElementById('payment-order-search-clear');
  const dropdownList = document.getElementById('payment-order-dropdown-list');
  const container = document.getElementById('searchable-order-select-container');

  if (hiddenSelect) hiddenSelect.value = order.id;
  if (searchInput) {
    searchInput.value = `${order.order_code} - ${order.client_name} (${order.formatted_date || 'Reciente'})`;
  }
  if (amountInput && order.amount_due) {
    amountInput.value = order.amount_due.toFixed(2);
  }
  if (stageSelect && order.pending_stage) {
    stageSelect.value = order.pending_stage;
  }
  if (clearBtn) clearBtn.classList.add('is-visible');

  // Cerrar menú desplegable
  if (dropdownList) dropdownList.classList.remove('is-open');
  if (container) container.classList.remove('is-open');
}

function clearOrderSelection() {
  const hiddenSelect = document.getElementById('payment-order-select');
  const searchInput = document.getElementById('payment-order-search-input');
  const amountInput = document.getElementById('payment-amount-input');
  const clearBtn = document.getElementById('payment-order-search-clear');
  const dropdownList = document.getElementById('payment-order-dropdown-list');
  const container = document.getElementById('searchable-order-select-container');

  if (hiddenSelect) hiddenSelect.value = '';
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  if (amountInput) amountInput.value = '';
  if (clearBtn) clearBtn.classList.remove('is-visible');

  renderSearchableOrderOptions('');
  if (dropdownList) dropdownList.classList.add('is-open');
  if (container) container.classList.add('is-open');
}

async function openNewPaymentModal() {
  const modal = document.getElementById('new-payment-modal-backdrop');
  if (!modal) return;

  try {
    const orders = await getOrdersForPaymentSelect();
    state.pendingOrdersList = orders;
    renderSearchableOrderOptions('');
  } catch (err) {
    console.warn('[TuEstante Payment] Error al cargar pedidos pendientes:', err);
  }

  modal.classList.add('is-open');
}

function closeNewPaymentModal() {
  const modal = document.getElementById('new-payment-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  const form = document.getElementById('new-payment-form');
  if (form) form.reset();
  
  const hiddenSelect = document.getElementById('payment-order-select');
  const searchInput = document.getElementById('payment-order-search-input');
  const clearBtn = document.getElementById('payment-order-search-clear');
  const dropdownList = document.getElementById('payment-order-dropdown-list');
  const container = document.getElementById('searchable-order-select-container');

  if (hiddenSelect) hiddenSelect.value = '';
  if (searchInput) searchInput.value = '';
  if (clearBtn) clearBtn.classList.remove('is-visible');
  if (dropdownList) dropdownList.classList.remove('is-open');
  if (container) container.classList.remove('is-open');
}

function setupNewPaymentFormAutoFill() {
  const searchInput = document.getElementById('payment-order-search-input');
  const clearBtn = document.getElementById('payment-order-search-clear');
  const dropdownList = document.getElementById('payment-order-dropdown-list');
  const container = document.getElementById('searchable-order-select-container');

  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      renderSearchableOrderOptions(searchInput.value);
      if (dropdownList) dropdownList.classList.add('is-open');
      if (container) container.classList.add('is-open');
    });

    searchInput.addEventListener('input', () => {
      renderSearchableOrderOptions(searchInput.value);
      if (dropdownList) dropdownList.classList.add('is-open');
      if (container) container.classList.add('is-open');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearOrderSelection();
    });
  }

  // Cerrar menú al hacer clic fuera del contenedor
  document.addEventListener('click', (e) => {
    if (container && !container.contains(e.target)) {
      if (dropdownList) dropdownList.classList.remove('is-open');
      if (container) container.classList.remove('is-open');
    }
  });

  const form = document.getElementById('new-payment-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const selectEl = document.getElementById('payment-order-select');
      const orderId = parseInt(selectEl.value, 10);
      if (!orderId) {
        showToast('info', 'Selecciona un Pedido', 'Por favor selecciona un pedido de la lista para continuar.');
        if (searchInput) searchInput.focus();
        return;
      }

      const selectedOrder = (state.pendingOrdersList || []).find(o => o.id === orderId);
      const orderCode = selectedOrder?.order_code || `#00${orderId}`;
      const stage = document.getElementById('payment-stage-select').value;
      const amount = parseFloat(document.getElementById('payment-amount-input').value);
      const method = document.getElementById('payment-method-select').value;
      const bank = document.getElementById('payment-bank-input').value;
      const ref = document.getElementById('payment-ref-input').value;
      const notes = document.getElementById('payment-notes-input').value;

      const payload = {
        order: orderId,
        order_code: orderCode,
        payment_stage: stage,
        amount: amount,
        payment_method: method,
        bank_name: bank,
        reference_number: ref,
        notes: notes
      };

      try {
        await createPayment(payload);
        closeNewPaymentModal();
        showToast('success', 'Pago Registrado', `Comprobante guardado con éxito en estado "En revisión".`);
        await refreshData();
      } catch (err) {
        showToast('error', 'Error', 'No se pudo registrar el pago: ' + err.message);
      }
    });
  }
}

/**
 * ==========================================================================
 * 8. FILTRADO, BÚSQUEDA Y PAGINACIÓN
 * ==========================================================================
 */
function setupFiltersAndPagination() {
  const tabButtons = document.querySelectorAll('.status-tab-btn');
  tabButtons.forEach(tab => {
    tab.addEventListener('click', () => {
      tabButtons.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      state.filters.status = tab.getAttribute('data-status');
      state.currentPage = 1;
      fetchAndRender();
    });
  });

  const searchInput = document.getElementById('search-payments-input');
  if (searchInput) {
    // Inicializar búsqueda si viene por parámetro de URL (ej: redirección desde una notificación)
    const urlParams = new URLSearchParams(window.location.search);
    const initialSearch = urlParams.get('search') || urlParams.get('order') || urlParams.get('order_id');
    if (initialSearch) {
      searchInput.value = initialSearch;
      state.filters.search = initialSearch;
    }

    let debounceTimeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        state.filters.search = searchInput.value.trim();
        state.currentPage = 1;
        fetchAndRender();
      }, 250);
    });
  }

  const stageSelect = document.getElementById('filter-stage-select');
  if (stageSelect) {
    stageSelect.addEventListener('change', () => {
      state.filters.stage = stageSelect.value;
      state.currentPage = 1;
      fetchAndRender();
    });
  }

  const methodSelect = document.getElementById('filter-method-select');
  if (methodSelect) {
    methodSelect.addEventListener('change', () => {
      state.filters.payment_method = methodSelect.value;
      state.currentPage = 1;
      fetchAndRender();
    });
  }

  const dateFrom = document.getElementById('filter-date-from');
  const dateTo = document.getElementById('filter-date-to');
  if (dateFrom) {
    dateFrom.addEventListener('change', () => {
      state.filters.date_from = dateFrom.value;
      state.currentPage = 1;
      fetchAndRender();
    });
  }
  if (dateTo) {
    dateTo.addEventListener('change', () => {
      state.filters.date_to = dateTo.value;
      state.currentPage = 1;
      fetchAndRender();
    });
  }

  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.filters = {
        search: '',
        status: 'all',
        stage: 'all',
        payment_method: 'all',
        date_from: '',
        date_to: ''
      };

      if (searchInput) searchInput.value = '';
      if (stageSelect) stageSelect.value = 'all';
      if (methodSelect) methodSelect.value = 'all';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';

      tabButtons.forEach(t => {
        if (t.getAttribute('data-status') === 'all') {
          t.classList.add('is-active');
          t.setAttribute('aria-selected', 'true');
        } else {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        }
      });

      state.currentPage = 1;
      fetchAndRender();
    });
  }

  const refreshBtn = document.getElementById('btn-refresh-payments');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      showToast('info', 'Actualizando', 'Recargando lista de comprobantes...');
      refreshData();
    });
  }
}

function renderPaginationControls() {
  const container = document.getElementById('pagination-controls-container');
  const infoEl = document.getElementById('pagination-info-text');
  if (!container) return;

  const total = state.totalPayments;
  const page = state.currentPage;
  const pages = state.totalPages;
  const start = total === 0 ? 0 : (page - 1) * state.pageSize + 1;
  const end = Math.min(page * state.pageSize, total);

  if (infoEl) {
    infoEl.textContent = `Mostrando ${start} a ${end} de ${total} comprobantes`;
  }

  let html = `
    <button type="button" class="page-btn" id="btn-page-prev" ${page <= 1 ? 'disabled' : ''} aria-label="Página anterior">
      ‹
    </button>
  `;

  for (let i = 1; i <= pages; i++) {
    html += `
      <button type="button" class="page-btn ${i === page ? 'is-active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  html += `
    <button type="button" class="page-btn" id="btn-page-next" ${page >= pages ? 'disabled' : ''} aria-label="Página siguiente">
      ›
    </button>
  `;

  container.innerHTML = html;

  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPage = parseInt(btn.getAttribute('data-page'), 10);
      fetchAndRender();
    });
  });

  const prevBtn = document.getElementById('btn-page-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        fetchAndRender();
      }
    });
  }

  const nextBtn = document.getElementById('btn-page-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.currentPage < state.totalPages) {
        state.currentPage++;
        fetchAndRender();
      }
    });
  }
}

async function fetchAndRender() {
  try {
    const data = await getPayments({
      ...state.filters,
      page: state.currentPage,
      page_size: state.pageSize
    });

    state.payments = data.results || [];
    state.totalPayments = data.total || 0;
    state.totalPages = data.total_pages || 1;

    renderPaymentsTable(state.payments);
    renderPaginationControls();
  } catch (error) {
    console.error('[TuEstante Payment] Error al obtener pagos:', error);
  }
}

async function refreshData() {
  await Promise.all([
    fetchAndRender(),
    loadAndRenderMetrics()
  ]);
}

/**
 * ==========================================================================
 * 9. CONFIGURACIÓN DE EVENTOS DE MODALES
 * ==========================================================================
 */
function setupModalEvents() {
  // Modal de Resumen de Orden y Productos
  const orderClose = document.getElementById('modal-order-summary-close');
  const orderBtnClose = document.getElementById('modal-order-summary-btn-close');
  const orderBackdrop = document.getElementById('order-summary-modal-backdrop');
  if (orderClose) orderClose.addEventListener('click', closeOrderSummaryModal);
  if (orderBtnClose) orderBtnClose.addEventListener('click', closeOrderSummaryModal);
  if (orderBackdrop) {
    orderBackdrop.addEventListener('click', (e) => {
      if (e.target === orderBackdrop) closeOrderSummaryModal();
    });
  }

  // Modal de Confirmación de Aprobación
  const approveConfirmClose = document.getElementById('modal-approve-confirm-close');
  const approveConfirmCancel = document.getElementById('modal-approve-confirm-cancel');
  const approveConfirmBtn = document.getElementById('modal-approve-confirm-btn');
  const approveConfirmBackdrop = document.getElementById('approve-confirm-modal-backdrop');

  if (approveConfirmClose) approveConfirmClose.addEventListener('click', closeApproveConfirmModal);
  if (approveConfirmCancel) approveConfirmCancel.addEventListener('click', closeApproveConfirmModal);
  if (approveConfirmBtn) approveConfirmBtn.addEventListener('click', executeConfirmedApproval);
  if (approveConfirmBackdrop) {
    approveConfirmBackdrop.addEventListener('click', (e) => {
      if (e.target === approveConfirmBackdrop) closeApproveConfirmModal();
    });
  }

  // Modal de Recibo
  const receiptClose = document.getElementById('modal-receipt-close');
  const receiptCancel = document.getElementById('modal-receipt-cancel');
  const receiptBackdrop = document.getElementById('receipt-modal-backdrop');
  
  if (receiptClose) receiptClose.addEventListener('click', closeReceiptReviewModal);
  if (receiptCancel) receiptCancel.addEventListener('click', closeReceiptReviewModal);
  if (receiptBackdrop) {
    receiptBackdrop.addEventListener('click', (e) => {
      if (e.target === receiptBackdrop) closeReceiptReviewModal();
    });
  }

  const approveActionBtn = document.getElementById('btn-modal-approve-action');
  if (approveActionBtn) {
    approveActionBtn.addEventListener('click', () => {
      if (state.activePaymentId) {
        const payment = state.payments.find(p => p.id === state.activePaymentId);
        if (payment) openApproveConfirmModal(payment);
      }
    });
  }

  const rejectActionBtn = document.getElementById('btn-modal-reject-action');
  if (rejectActionBtn) {
    rejectActionBtn.addEventListener('click', () => {
      if (state.activePaymentId) executePaymentRejection(state.activePaymentId);
    });
  }

  // Modal de Nuevo Pago
  const openNewBtn = document.getElementById('btn-open-new-payment-modal');
  const newClose = document.getElementById('modal-new-payment-close');
  const newCancel = document.getElementById('modal-new-payment-cancel');
  const newBackdrop = document.getElementById('new-payment-modal-backdrop');

  if (openNewBtn) openNewBtn.addEventListener('click', openNewPaymentModal);
  if (newClose) newClose.addEventListener('click', closeNewPaymentModal);
  if (newCancel) newCancel.addEventListener('click', closeNewPaymentModal);
  if (newBackdrop) {
    newBackdrop.addEventListener('click', (e) => {
      if (e.target === newBackdrop) closeNewPaymentModal();
    });
  }

  // Modal 5: Visor de Recibo en Pantalla Completa (Lightbox)
  const lightboxClose = document.getElementById('lightbox-close-btn');
  const lightboxBackdrop = document.getElementById('receipt-lightbox-backdrop');

  if (lightboxClose) lightboxClose.addEventListener('click', closeReceiptLightbox);
  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener('click', (e) => {
      // Cerrar si se hace clic en el fondo o en el botón
      if (e.target === lightboxBackdrop || e.target.classList.contains('lightbox-content-wrapper')) {
        closeReceiptLightbox();
      }
    });
  }

  // Cerrar con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeReceiptLightbox();
      closeOrderSummaryModal();
      closeApproveConfirmModal();
      closeReceiptReviewModal();
      closeNewPaymentModal();
    }
  });
}

/**
 * ==========================================================================
 * INICIALIZACIÓN GLOBAL DEL MÓDULO DE PAGOS
 * ==========================================================================
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar componentes (Navbar, Drawer, Footer)
  await loadAdminComponents({ title: 'Pagos' });

  // 2. Configurar eventos de UI
  setupFiltersAndPagination();
  setupModalEvents();
  setupNewPaymentFormAutoFill();

  // 3. Cargar datos iniciales
  await refreshData();

  console.log('%c[TuEstante Admin] Módulo de Pagos inicializado con soporte de doble moneda, modal de productos y confirmaciones UI.', 'background: #005187; color: #fff; padding: 4px 8px; border-radius: 4px;');
});
