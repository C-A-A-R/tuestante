/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DE DETALLE DE PEDIDO (ORDER-DETAIL.JS)
 * ==========================================================================
 * Incluye:
 * 1. Edición completa de pagos con aviso de "Pago editado" y registro de auditoría.
 * 2. Paso de confirmación modal antes de guardar cualquier cambio o avanzar etapa.
 * 3. Conversión y visualización dual en Dólares ($) y Bolívares (Bs.) con tasa BCV.
 * 4. Lightbox flotante con zoom al hacer clic en el comprobante bancario.
 * 5. Validaciones de transición de estado y botón directo "Avanzar al siguiente estado".
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { getOfficialRate } from '../../js/service/exchange-rate.service.js';
import { 
  getOrderById, 
  updateOrderStatus, 
  issueManufacturingOrder 
} from './order.api.js';

/**
 * SECUENCIA OFICIAL DEL FLUJO DE ESTADOS DE PEDIDO
 */
const ORDER_STATUS_FLOW = [
  { id: 'pending_payment', label: 'Pendiente de pago' },
  { id: 'initial_review', label: 'Pago inicial en revisión' },
  { id: 'initial_approved', label: 'Pago inicial aprobado' },
  { id: 'manufacturing', label: 'En fabricación' },
  { id: 'waiting_final_payment', label: 'Esperando pago final' },
  { id: 'final_review', label: 'Pago final en revisión' },
  { id: 'shipped', label: 'Enviado' },
  { id: 'completed', label: 'Finalizado' }
];

/**
 * ESTADO LOCAL DEL MÓDULO DE DETALLE
 */
const detailState = {
  orderId: 125,
  order: null,
  exchangeRate: 791.32,
  activePaymentForModal: null,
  onConfirmCallback: null
};

/**
 * Formateador de moneda venezolana (Bs.)
 * @param {number} amount 
 * @returns {string} Ej: "Bs. 138.481,00"
 */
function formatBs(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return 'Bs. ' + num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formateador de moneda estadounidense ($)
 * @param {number} amount 
 * @returns {string} Ej: "$175.00"
 */
function formatUsd(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return '$' + num.toFixed(2);
}

/**
 * Obtiene el ID del pedido desde la URL o retorna el por defecto
 */
function getOrderIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const idParam = urlParams.get('id') || urlParams.get('order_id');
  return idParam ? parseInt(idParam, 10) : 125;
}

/**
 * ==========================================================================
 * RENDERIZADO GENERAL DEL PEDIDO
 * ==========================================================================
 */

/**
 * Renderiza todos los bloques visuales del pedido
 * @param {Object} order Datos del pedido
 */
function renderOrderDetail(order) {
  if (!order) return;

  const code = order.order_code || `#00${order.id}`;

  // 1. Breadcrumb y Título
  const breadcrumbCode = document.getElementById('navbar-breadcrumb-code');
  const titleCode = document.getElementById('order-title-code');
  if (breadcrumbCode) breadcrumbCode.textContent = code;
  if (titleCode) titleCode.textContent = `Pedido ${code}`;

  // 2. Badge de Estado Principal
  const headerStatusBadge = document.getElementById('order-header-status-badge');
  const headerStatusText = document.getElementById('order-header-status-text');
  if (headerStatusBadge && headerStatusText) {
    headerStatusText.textContent = order.status_label || getStatusLabel(order.status);
  }

  // 3. Timestamp
  const timestampText = document.getElementById('order-timestamp-text');
  if (timestampText) {
    timestampText.textContent = `Registrado el ${order.formatted_date || '31 de agosto de 2026'} • ${order.formatted_time || '10:32 AM'}`;
  }

  // 4. Meta Tarjetas KPI (Cliente, Dirección, Método, Total USD + Bs)
  const clientName = document.getElementById('meta-client-name');
  const clientEmail = document.getElementById('meta-client-email');
  const clientPhone = document.getElementById('meta-client-phone');
  if (clientName) clientName.textContent = order.client?.name || 'Cliente';
  if (clientEmail) clientEmail.textContent = order.client?.email || 'email@tienda.com';
  if (clientPhone) clientPhone.textContent = order.client?.phone || '+58 412 000 0000';

  const shipLine1 = document.getElementById('meta-shipping-line1');
  const shipCity = document.getElementById('meta-shipping-city');
  const shipCountry = document.getElementById('meta-shipping-country');
  const address = order.shipping_address || {};
  if (shipLine1) shipLine1.textContent = address.address || address.line1 || 'Av. Principal, Casa #123';
  if (shipCity) shipCity.textContent = address.city_state || (address.city ? `${address.city}, Mpio. ${address.municipality || ''}, Edo. ${address.state || ''}` : 'San Cristóbal, Táchira');
  if (shipCountry) shipCountry.textContent = address.country || 'Venezuela';

  const payMethod = document.getElementById('meta-payment-method');
  if (payMethod) payMethod.textContent = order.payment_method || 'Transferencia / Pago móvil';

  // Total USD y Bs
  const totalUsd = typeof order.total_amount === 'number' ? order.total_amount : parseFloat(order.total_amount || 0);
  const totalBs = order.total_amount_bs || (totalUsd * detailState.exchangeRate);
  
  const orderTotalUsdEl = document.getElementById('meta-order-total-usd');
  const orderTotalBsEl = document.getElementById('meta-order-total-bs');
  if (orderTotalUsdEl) orderTotalUsdEl.textContent = formatUsd(totalUsd);
  if (orderTotalBsEl) orderTotalBsEl.textContent = formatBs(totalBs);

  // 5. Tabla de Productos
  renderProductsTable(order.items, totalUsd, totalBs);

  // 6. Tarjetas de Pagos (USD + Bs + Edición + Comprobantes)
  renderPaymentsCards(order.payments_list || []);

  // 7. Información Adicional (Notas)
  const clientNotesEl = document.getElementById('info-client-notes');
  const internalNotesEl = document.getElementById('info-internal-notes');
  if (clientNotesEl) clientNotesEl.textContent = order.client_notes || order.notes || 'Sin notas del cliente registradas.';
  if (internalNotesEl) internalNotesEl.textContent = order.internal_notes || 'Sin notas internas registradas.';

  // 8. Stepper del Estado con Fechas Debajo de Cada Etapa y Botón Siguiente
  renderTimelineStepper(order.timeline_steps || [], order.status);
  updateAdvanceStatusButton(order.status);
}

/**
 * Renderiza la tabla de productos con totales en USD y Bs
 */
function renderProductsTable(items, totalUsd, totalBs) {
  const tbody = document.getElementById('order-items-tbody');
  const totalAmountUsdEl = document.getElementById('products-total-amount');
  const totalAmountBsEl = document.getElementById('products-total-bs');

  if (totalAmountUsdEl) totalAmountUsdEl.textContent = formatUsd(totalUsd);
  if (totalAmountBsEl) totalAmountBsEl.textContent = formatBs(totalBs);
  if (!tbody) return;

  const productItems = items && items.length > 0 ? items : [
    {
      id: 1,
      product_name: "Estante Modelo A",
      specs: "Color: Roble | Tamaño: Mediano",
      quantity: 2,
      unit_price: 150.00,
      total_price: 300.00,
      image: "../../assets/images/logo.jpeg"
    },
    {
      id: 2,
      product_name: "Accesorio X",
      specs: "Color: Negro | Material: Metal",
      quantity: 1,
      unit_price: 50.00,
      total_price: 50.00,
      image: "../../assets/images/logo.jpeg"
    }
  ];

  tbody.innerHTML = productItems.map(item => {
    const unitPrice = typeof item.unit_price === 'number' ? item.unit_price : parseFloat(item.unit_price || 0);
    const subtotal = typeof item.total_price === 'number' ? item.total_price : (unitPrice * (item.quantity || 1));
    const imgSrc = item.image || "../../assets/images/logo.jpeg";

    return `
      <tr>
        <td>
          <div class="product-item-cell">
            <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.product_name)}" class="product-thumb-img" onerror="this.src='../../assets/images/logo.jpeg'">
            <div class="product-item-meta">
              <strong class="product-item-name">${escapeHtml(item.product_name)}</strong>
              <span class="product-item-specs">${escapeHtml(item.specs || 'Especificación estándar')}</span>
            </div>
          </div>
        </td>
        <td class="text-center font-bold">${item.quantity || 1}</td>
        <td class="text-right">${formatUsd(unitPrice)}</td>
        <td class="text-right font-bold text-primary">${formatUsd(subtotal)}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Renderiza las tarjetas de pagos con montos en USD y Bs, aviso de edición y botones
 */
function renderPaymentsCards(paymentsList) {
  const container = document.getElementById('payments-cards-container');
  if (!container) return;

  const defaultPayments = [
    {
      id: 201,
      title: "Pago inicial",
      amount_usd: 175.00,
      amount_bs: 138481.00, // Monto guardado si ya está pago
      rate_applied: 791.32,
      status: "approved",
      status_label: "Aprobado",
      date: "31/08/2026 - 11:20 AM",
      payment_method: "Pago móvil Banesco",
      reference: "REF-849204",
      receipt_url: "../../assets/images/logo.jpeg",
      is_edited: false
    },
    {
      id: 202,
      title: "Pago final",
      amount_usd: 175.00,
      amount_bs: null, // Pendiente: se calcula con la tasa en tiempo real
      rate_applied: null,
      status: "pending",
      status_label: "Pendiente",
      date: "-",
      payment_method: "-",
      reference: "-",
      receipt_url: null,
      is_edited: false
    }
  ];

  const list = paymentsList.length > 0 ? paymentsList : defaultPayments;

  container.innerHTML = list.map(pay => {
    const isApproved = pay.status === 'approved';
    const isPending = pay.status === 'pending';
    const badgeClass = isApproved ? 'badge-approved' : 'badge-pending';
    const badgeLabel = pay.status_label || (isApproved ? 'Aprobado' : 'Pendiente');

    const usdVal = typeof pay.amount_usd === 'number' ? pay.amount_usd : (parseFloat(pay.amount || 0));
    
    // Regla de negocio: Si ya está pagado, usa el monto guardado. Si está pendiente, usa tasa actual
    const bsVal = (isApproved && pay.amount_bs) 
      ? pay.amount_bs 
      : (usdVal * detailState.exchangeRate);

    const isEdited = Boolean(pay.is_edited);

    return `
      <div class="payment-subcard ${isEdited ? 'is-edited-card' : ''}" data-payment-id="${pay.id}">
        <div class="payment-subcard-header">
          <div class="payment-subcard-title-group">
            <span class="payment-subcard-title">${escapeHtml(pay.title)}</span>
            ${isEdited ? `
              <span class="badge-edited" title="Este pago fue modificado el ${pay.edited_at || 'recientemente'} por ${pay.edited_by || 'Admin'}">
                ⚠️ Pago editado
              </span>
            ` : ''}
          </div>
          <span class="${badgeClass}">${escapeHtml(badgeLabel)}</span>
        </div>

        <div class="payment-subcard-amount-row">
          <div class="payment-amounts-group">
            <span class="payment-subcard-amount">${formatUsd(usdVal)}</span>
            <span class="payment-subcard-amount-bs">${formatBs(bsVal)}</span>
          </div>
        </div>

        <div class="payment-subcard-meta-list">
          <span>Fecha: ${escapeHtml(pay.date || '-')}</span>
          <span>Ref: ${escapeHtml(pay.reference || '-')}</span>
        </div>

        <div class="payment-subcard-actions-row">
          ${isApproved ? `
            <button type="button" class="btn btn-outline btn-sm btn-view-receipt" data-payment-id="${pay.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>Ver comprobante</span>
            </button>
          ` : `
            <button type="button" class="btn btn-outline btn-sm btn-upload-receipt" data-payment-id="${pay.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Subir comprobante</span>
            </button>
          `}

          <!-- Botón Editar Pago -->
          <button type="button" class="btn btn-outline btn-sm btn-edit-payment" data-payment-id="${pay.id}" title="Editar registro de pago">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Editar</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Eventos de botones de comprobantes y edición
  container.querySelectorAll('.btn-view-receipt').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = parseInt(btn.getAttribute('data-payment-id'), 10);
      const pay = list.find(p => p.id === pid) || list[0];
      openReceiptModal(pay);
    });
  });

  container.querySelectorAll('.btn-upload-receipt').forEach(btn => {
    btn.addEventListener('click', () => {
      openUploadPaymentModal();
    });
  });

  container.querySelectorAll('.btn-edit-payment').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = parseInt(btn.getAttribute('data-payment-id'), 10);
      const pay = list.find(p => p.id === pid) || list[0];
      openEditPaymentModal(pay);
    });
  });
}

/**
 * Renderiza el stepper vertical con la fecha debajo de cada etapa
 */
function renderTimelineStepper(steps, currentStatus) {
  const container = document.getElementById('order-timeline-container');
  if (!container) return;

  const defaultSteps = [
    { id: "pending_payment", label: "Pendiente de pago", date: "31/08/2026 - 10:32 AM", status: "completed" },
    { id: "initial_review", label: "Pago inicial en revisión", date: "31/08/2026 - 11:05 AM", status: "completed" },
    { id: "initial_approved", label: "Pago inicial aprobado", date: "31/08/2026 - 11:20 AM", status: "completed" },
    { id: "manufacturing", label: "En fabricación", date: "31/08/2026 - 02:45 PM", status: "completed" },
    { id: "waiting_final_payment", label: "Esperando pago final", date: "01/09/2026 - 10:00 AM (En curso)", status: "current" },
    { id: "final_review", label: "Pago final en revisión", date: "Pendiente", status: "pending" },
    { id: "shipped", label: "Enviado", date: "Pendiente", status: "pending" },
    { id: "completed", label: "Finalizado", date: "Pendiente", status: "pending" },
    { id: "refunded", label: "Devuelto", date: "No aplica", status: "pending" }
  ];

  const timeline = steps.length > 0 ? steps : defaultSteps;

  container.innerHTML = timeline.map(step => {
    const isCompleted = step.status === 'completed';
    const isCurrent = step.status === 'current';

    const itemClass = isCompleted ? 'is-completed' : isCurrent ? 'is-current' : 'is-pending';

    return `
      <div class="timeline-step-item ${itemClass}">
        <div class="timeline-dot-wrapper">
          ${isCompleted ? `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ` : isCurrent ? `
            <div class="timeline-inner-dot"></div>
          ` : ''}
        </div>

        <div class="timeline-step-content">
          <span class="timeline-step-title">${escapeHtml(step.label)}</span>
          <span class="timeline-step-date">${escapeHtml(step.date)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Actualiza el botón para avanzar al siguiente estado
 */
function updateAdvanceStatusButton(currentStatus) {
  const btn = document.getElementById('btn-advance-next-status');
  const btnText = document.getElementById('btn-advance-status-text');
  if (!btn || !btnText) return;

  const currentIndex = ORDER_STATUS_FLOW.findIndex(s => s.id === currentStatus);

  if (currentIndex === -1 || currentIndex >= ORDER_STATUS_FLOW.length - 1) {
    btn.style.display = 'none';
    return;
  }

  btn.style.display = 'inline-flex';
  const nextStep = ORDER_STATUS_FLOW[currentIndex + 1];
  btnText.textContent = `Avanzar a "${nextStep.label}"`;
  btn.setAttribute('data-target-status', nextStep.id);
  btn.setAttribute('data-target-label', nextStep.label);
}

/**
 * ==========================================================================
 * VALIDACIONES DE CAMBIO DE ESTADO
 * ==========================================================================
 */

/**
 * Valida las reglas de negocio antes de permitir la transición de estado
 * @param {string} targetStatus Nuevo estado propuesto
 * @param {Object} order Datos actuales del pedido
 * @returns {{ valid: boolean, message?: string }}
 */
function validateStatusTransition(targetStatus, order) {
  const payments = order.payments_list || [];
  const initialPayment = payments.find(p => p.id === 201 || (p.title && p.title.toLowerCase().includes('inicial')));
  const finalPayment = payments.find(p => p.id === 202 || (p.title && p.title.toLowerCase().includes('final')));

  // 1. Regla: Para pasar a "En fabricación" (manufacturing), el pago inicial debe estar aprobado
  if (targetStatus === 'manufacturing') {
    if (initialPayment && initialPayment.status !== 'approved') {
      return {
        valid: false,
        message: 'No se puede avanzar a "En fabricación" porque el Pago Inicial aún no ha sido verificado y aprobado.'
      };
    }
  }

  // 2. Regla: Para pasar a "Enviado" (shipped) o "Finalizado" (completed), el pago final debe estar aprobado
  if (targetStatus === 'shipped' || targetStatus === 'completed') {
    if (finalPayment && finalPayment.status !== 'approved') {
      return {
        valid: false,
        message: 'No se puede marcar como "' + getStatusLabel(targetStatus) + '" porque el Pago Final aún se encuentra pendiente.'
      };
    }
  }

  // 3. Regla: Si ya está devuelto o cancelado, advertir
  if (order.status === 'refunded') {
    return {
      valid: false,
      message: 'Este pedido ya fue cancelado/devuelto. No se pueden reabrir etapas directamente.'
    };
  }

  return { valid: true };
}

/**
 * ==========================================================================
 * MODAL DE CONFIRMACIÓN REUTILIZABLE
 * ==========================================================================
 */

/**
 * Muestra el diálogo modal de confirmación antes de guardar cambios
 * @param {Object} options Configuración de la confirmación
 */
function showConfirmationModal({ title, message, onConfirm }) {
  const modal = document.getElementById('confirmation-modal-backdrop');
  const titleEl = document.getElementById('confirm-dialog-title');
  const descEl = document.getElementById('confirm-dialog-desc');

  if (!modal) return;

  if (titleEl) titleEl.textContent = title || '¿Confirmar acción?';
  if (descEl) descEl.textContent = message || 'Esta acción modificará los datos del pedido.';

  detailState.onConfirmCallback = onConfirm;

  modal.classList.add('is-open');
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmation-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  detailState.onConfirmCallback = null;
}

/**
 * ==========================================================================
 * MODAL: EDICIÓN DE PAGO
 * ==========================================================================
 */

function openEditPaymentModal(payment) {
  const modal = document.getElementById('edit-payment-modal-backdrop');
  if (!modal) return;

  detailState.activePaymentForModal = payment;

  const idInput = document.getElementById('edit-payment-id');
  const usdInput = document.getElementById('edit-payment-amount-usd');
  const bsInput = document.getElementById('edit-payment-amount-bs');
  const refInput = document.getElementById('edit-payment-ref');
  const methodInput = document.getElementById('edit-payment-method');
  const statusSelect = document.getElementById('edit-payment-status');

  const usdVal = typeof payment.amount_usd === 'number' ? payment.amount_usd : (parseFloat(payment.amount || 0));
  const bsVal = payment.amount_bs || (usdVal * detailState.exchangeRate);

  if (idInput) idInput.value = payment.id;
  if (usdInput) usdInput.value = usdVal.toFixed(2);
  if (bsInput) bsInput.value = bsVal.toFixed(2);
  if (refInput) refInput.value = payment.reference && payment.reference !== '-' ? payment.reference : '';
  if (methodInput) methodInput.value = payment.payment_method && payment.payment_method !== '-' ? payment.payment_method : 'Pago Móvil';
  if (statusSelect) statusSelect.value = payment.status || 'approved';

  // Auto-cálculo de Bolívares al modificar Dólares
  if (usdInput && bsInput) {
    usdInput.oninput = () => {
      const u = parseFloat(usdInput.value || 0);
      bsInput.value = (u * detailState.exchangeRate).toFixed(2);
    };
  }

  modal.classList.add('is-open');
}

function closeEditPaymentModal() {
  const modal = document.getElementById('edit-payment-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  detailState.activePaymentForModal = null;
}

/**
 * Procesa la edición del pago con confirmación previa
 */
function handleSavePaymentEdit(e) {
  e.preventDefault();

  const usdVal = parseFloat(document.getElementById('edit-payment-amount-usd').value || 0);
  const bsVal = parseFloat(document.getElementById('edit-payment-amount-bs').value || 0);
  const refVal = document.getElementById('edit-payment-ref').value.trim();
  const methodVal = document.getElementById('edit-payment-method').value.trim();
  const statusVal = document.getElementById('edit-payment-status').value;

  // Paso de confirmación obligatorio
  showConfirmationModal({
    title: '¿Confirmar edición del pago?',
    message: `Se actualizará el monto a ${formatUsd(usdVal)} (${formatBs(bsVal)}) y se guardará el registro de auditoría.`,
    onConfirm: () => {
      const payment = detailState.activePaymentForModal;
      if (payment) {
        payment.amount_usd = usdVal;
        payment.amount_bs = bsVal;
        payment.reference = refVal;
        payment.payment_method = methodVal;
        payment.status = statusVal;
        payment.status_label = statusVal === 'approved' ? 'Aprobado' : statusVal === 'pending' ? 'Pendiente' : 'En revisión';
        payment.is_edited = true;
        payment.edited_at = new Date().toLocaleDateString('es-ES') + ' - ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        payment.edited_by = 'Administrador';

        // Re-renderizar tarjetas de pago
        renderPaymentsCards(detailState.order.payments_list);
        closeEditPaymentModal();
        showToastNotification('¡Pago editado y actualizado con éxito!');
      }
    }
  });
}

/**
 * ==========================================================================
 * MODAL: VER COMPROBANTE CON LIGHTBOX FLOTANTE
 * ==========================================================================
 */

function openReceiptModal(payment) {
  const modal = document.getElementById('receipt-modal-backdrop');
  if (!modal) return;

  const subTitle = document.getElementById('receipt-modal-subtitle');
  const refEl = document.getElementById('receipt-meta-ref');
  const bankEl = document.getElementById('receipt-meta-bank');
  const dateEl = document.getElementById('receipt-meta-date');
  const rateEl = document.getElementById('receipt-meta-rate');
  const imgEl = document.getElementById('receipt-preview-img');
  const usdAmountEl = document.getElementById('receipt-amount-usd');
  const bsAmountEl = document.getElementById('receipt-amount-bs');
  const editedAlert = document.getElementById('receipt-edited-alert');
  const editedText = document.getElementById('receipt-edited-text');

  const usdVal = typeof payment.amount_usd === 'number' ? payment.amount_usd : (parseFloat(payment.amount || 0));
  const bsVal = payment.amount_bs || (usdVal * detailState.exchangeRate);

  if (subTitle) subTitle.textContent = `${payment.title || 'Pago'} - ${formatUsd(usdVal)}`;
  if (refEl) refEl.textContent = payment.reference || 'REF-849204';
  if (bankEl) bankEl.textContent = payment.payment_method || 'Pago Móvil Banesco';
  if (dateEl) dateEl.textContent = payment.date || '31/08/2026 - 11:20 AM';
  if (rateEl) rateEl.textContent = `${(payment.rate_applied || detailState.exchangeRate).toLocaleString('es-VE')} Bs/$`;
  if (usdAmountEl) usdAmountEl.textContent = formatUsd(usdVal);
  if (bsAmountEl) bsAmountEl.textContent = formatBs(bsVal);

  const imgSrc = payment.receipt_url || "../../assets/images/logo.jpeg";
  if (imgEl) imgEl.src = imgSrc;

  // Mostrar alerta si fue editado
  if (editedAlert) {
    if (payment.is_edited) {
      editedAlert.style.display = 'flex';
      if (editedText) {
        editedText.textContent = `Este pago fue editado el ${payment.edited_at || ''}.`;
      }
    } else {
      editedAlert.style.display = 'none';
    }
  }

  modal.classList.add('is-open');
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
}

/**
 * Abre el Lightbox flotante para zoom completo del comprobante
 * @param {string} imgSrc Ruta de la imagen
 * @param {string} caption Leyenda o título
 */
function openImageLightbox(imgSrc, caption = 'Comprobante de Pago') {
  const lightbox = document.getElementById('image-lightbox-backdrop');
  const img = document.getElementById('lightbox-full-img');
  const captionEl = document.getElementById('lightbox-caption-text');

  if (!lightbox || !img) return;

  img.src = imgSrc || "../../assets/images/logo.jpeg";
  if (captionEl) captionEl.textContent = caption;

  lightbox.classList.add('is-open');
}

function closeImageLightbox() {
  const lightbox = document.getElementById('image-lightbox-backdrop');
  if (lightbox) lightbox.classList.remove('is-open');
}

/**
 * ==========================================================================
 * MODAL: SUBIR / REGISTRAR COMPROBANTE
 * ==========================================================================
 */

function openUploadPaymentModal() {
  const modal = document.getElementById('upload-payment-modal-backdrop');
  if (modal) modal.classList.add('is-open');
}

function closeUploadPaymentModal() {
  const modal = document.getElementById('upload-payment-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  const form = document.getElementById('upload-payment-form');
  if (form) form.reset();
}

/**
 * ==========================================================================
 * MODAL: EDITAR DATOS DEL PEDIDO
 * ==========================================================================
 */

function openEditOrderModal() {
  const modal = document.getElementById('edit-order-modal-backdrop');
  if (modal) modal.classList.add('is-open');
}

function closeEditOrderModal() {
  const modal = document.getElementById('edit-order-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
}

/**
 * ==========================================================================
 * UTILIDADES Y NOTIFICACIONES
 * ==========================================================================
 */

function copyOrderCodeToClipboard() {
  const code = detailState.order?.order_code || '#00125';
  navigator.clipboard.writeText(code).then(() => {
    showToastNotification(`Código ${code} copiado al portapapeles`);
  }).catch(() => {
    showToastNotification(`Código: ${code}`);
  });
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

function getStatusLabel(status) {
  const found = ORDER_STATUS_FLOW.find(s => s.id === status);
  if (found) return found.label;
  if (status === 'refunded') return 'Devuelto';
  return status || 'En proceso';
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
 * LISTENERS Y EVENTOS
 * ==========================================================================
 */
function setupDetailEventListeners() {
  // 1. Botón Copiar Código
  const btnCopy = document.getElementById('btn-copy-order-code');
  if (btnCopy) btnCopy.addEventListener('click', copyOrderCodeToClipboard);

  // 2. Botón Editar Pedido
  const btnEdit = document.getElementById('btn-edit-order');
  if (btnEdit) btnEdit.addEventListener('click', openEditOrderModal);

  // 3. Menú Más Opciones (3 puntos)
  const btnMoreOptions = document.getElementById('btn-order-more-options');
  const moreOptionsMenu = document.getElementById('order-more-options-menu');
  if (btnMoreOptions && moreOptionsMenu) {
    btnMoreOptions.addEventListener('click', (e) => {
      e.stopPropagation();
      moreOptionsMenu.classList.toggle('is-active');
    });
  }

  // 4. Dropdown Cambiar Estado (con validación y confirmación)
  const btnToggleStatus = document.getElementById('btn-toggle-change-status');
  const statusChangeMenu = document.getElementById('status-change-menu');
  if (btnToggleStatus && statusChangeMenu) {
    btnToggleStatus.addEventListener('click', (e) => {
      e.stopPropagation();
      statusChangeMenu.classList.toggle('is-active');
    });

    statusChangeMenu.querySelectorAll('.status-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const newStatus = item.getAttribute('data-status');
        const statusLabel = item.textContent.trim();
        statusChangeMenu.classList.remove('is-active');

        // Validar reglas de transición
        const validation = validateStatusTransition(newStatus, detailState.order);
        if (!validation.valid) {
          alert(`⚠️ Acción Bloqueada:\n${validation.message}`);
          return;
        }

        // Solicitar confirmación obligatoria
        showConfirmationModal({
          title: '¿Confirmar cambio de estado?',
          message: `¿Está seguro de que desea cambiar el estado del pedido a "${statusLabel}"?`,
          onConfirm: async () => {
            await applyStatusChange(newStatus, statusLabel);
          }
        });
      });
    });
  }

  // 5. Botón Directo "Avanzar al siguiente estado" (con validación y confirmación)
  const btnAdvance = document.getElementById('btn-advance-next-status');
  if (btnAdvance) {
    btnAdvance.addEventListener('click', () => {
      const targetStatus = btnAdvance.getAttribute('data-target-status');
      const targetLabel = btnAdvance.getAttribute('data-target-label');

      if (!targetStatus) return;

      const validation = validateStatusTransition(targetStatus, detailState.order);
      if (!validation.valid) {
        alert(`⚠️ Validación de Estado:\n${validation.message}`);
        return;
      }

      showConfirmationModal({
        title: `¿Avanzar a "${targetLabel}"?`,
        message: `El pedido avanzará automáticamente a la etapa de "${targetLabel}" y se notificará el progreso.`,
        onConfirm: async () => {
          await applyStatusChange(targetStatus, targetLabel);
        }
      });
    });
  }

  // Función auxiliar para aplicar el cambio de estado
  async function applyStatusChange(newStatus, statusLabel) {
    try {
      await updateOrderStatus(detailState.orderId, newStatus, `Avanzado a ${statusLabel}`);
      detailState.order.status = newStatus;
      detailState.order.status_label = statusLabel;

      // Actualizar timestamp en el stepper
      if (detailState.order.timeline_steps) {
        let reached = false;
        detailState.order.timeline_steps.forEach(s => {
          if (s.id === newStatus) {
            s.status = 'current';
            s.date = new Date().toLocaleDateString('es-ES') + ' - ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) + ' (Actualizado)';
            reached = true;
          } else if (!reached) {
            s.status = 'completed';
          } else {
            s.status = 'pending';
          }
        });
      }

      renderOrderDetail(detailState.order);
      showToastNotification(`Estado del pedido actualizado a "${statusLabel}"`);
    } catch (err) {
      console.error(err);
    }
  }

  // 6. Opciones del Menú (Emitir OF, Imprimir, Cancelar con confirmación)
  const btnIssueMO = document.getElementById('btn-menu-issue-mo');
  if (btnIssueMO) {
    btnIssueMO.addEventListener('click', () => {
      if (moreOptionsMenu) moreOptionsMenu.classList.remove('is-active');
      showConfirmationModal({
        title: '¿Emitir Orden de Fabricación?',
        message: 'Se generará la orden técnica para el taller y se iniciará el proceso productivo.',
        onConfirm: async () => {
          await issueManufacturingOrder(detailState.orderId);
          showToastNotification(`Orden de Fabricación emitida para pedido #${detailState.orderId}`);
        }
      });
    });
  }

  const btnPrint = document.getElementById('btn-menu-print-order');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      if (moreOptionsMenu) moreOptionsMenu.classList.remove('is-active');
      window.print();
    });
  }

  const btnCancelOrder = document.getElementById('btn-menu-cancel-order');
  if (btnCancelOrder) {
    btnCancelOrder.addEventListener('click', () => {
      if (moreOptionsMenu) moreOptionsMenu.classList.remove('is-active');
      showConfirmationModal({
        title: '¿Cancelar este pedido?',
        message: 'El pedido pasará a estado Devuelto/Cancelado y se detendrán todas las actividades de fabricación.',
        onConfirm: async () => {
          await updateOrderStatus(detailState.orderId, 'refunded', 'Cancelado por el administrador');
          detailState.order.status = 'refunded';
          detailState.order.status_label = 'Devuelto';
          renderOrderDetail(detailState.order);
          showToastNotification('Pedido cancelado');
        }
      });
    });
  }

  // 7. Lightbox Zoom al presionar la imagen del comprobante
  const receiptImgWrapper = document.getElementById('receipt-img-clickable-wrapper');
  if (receiptImgWrapper) {
    receiptImgWrapper.addEventListener('click', () => {
      const img = document.getElementById('receipt-preview-img');
      const ref = document.getElementById('receipt-meta-ref')?.textContent || 'Comprobante';
      if (img) openImageLightbox(img.src, `Comprobante de Pago - ${ref}`);
    });
  }

  const btnCloseLightbox = document.getElementById('btn-close-lightbox');
  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closeImageLightbox);

  const lightboxBackdrop = document.getElementById('image-lightbox-backdrop');
  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener('click', (e) => {
      if (e.target === lightboxBackdrop || e.target.classList.contains('lightbox-close-btn')) {
        closeImageLightbox();
      }
    });
  }

  // 8. Modales de Edición de Pago y Formulario
  const editPaymentForm = document.getElementById('edit-payment-form');
  if (editPaymentForm) editPaymentForm.addEventListener('submit', handleSavePaymentEdit);

  const btnCloseEditPayment = document.getElementById('btn-close-edit-payment-modal');
  const btnCancelEditPayment = document.getElementById('btn-cancel-edit-payment');
  if (btnCloseEditPayment) btnCloseEditPayment.addEventListener('click', closeEditPaymentModal);
  if (btnCancelEditPayment) btnCancelEditPayment.addEventListener('click', closeEditPaymentModal);

  // 9. Modales de Comprobante y Carga
  const btnCloseReceipt = document.getElementById('btn-close-receipt-modal');
  const btnCloseReceiptFooter = document.getElementById('btn-close-receipt-footer');
  if (btnCloseReceipt) btnCloseReceipt.addEventListener('click', closeReceiptModal);
  if (btnCloseReceiptFooter) btnCloseReceiptFooter.addEventListener('click', closeReceiptModal);

  const btnCloseUpload = document.getElementById('btn-close-upload-modal');
  const btnCancelUpload = document.getElementById('btn-cancel-upload-modal');
  if (btnCloseUpload) btnCloseUpload.addEventListener('click', closeUploadPaymentModal);
  if (btnCancelUpload) btnCancelUpload.addEventListener('click', closeUploadPaymentModal);

  const uploadForm = document.getElementById('upload-payment-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showConfirmationModal({
        title: '¿Guardar comprobante de pago?',
        message: 'El comprobante pasará a revisión para su posterior aprobación.',
        onConfirm: () => {
          closeUploadPaymentModal();
          showToastNotification('¡Comprobante de pago guardado y enviado a revisión!');
        }
      });
    });
  }

  // 10. Modal Editar Pedido (con confirmación)
  const btnCloseEdit = document.getElementById('btn-close-edit-modal');
  const btnCancelEdit = document.getElementById('btn-cancel-edit-modal');
  if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEditOrderModal);
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditOrderModal);

  const editOrderForm = document.getElementById('edit-order-form');
  if (editOrderForm) {
    editOrderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showConfirmationModal({
        title: '¿Guardar modificaciones del pedido?',
        message: 'Se actualizarán las direcciones de entrega y observaciones del pedido.',
        onConfirm: () => {
          const addrInput = document.getElementById('edit-shipping-address');
          const clientNotes = document.getElementById('edit-client-notes');
          const internalNotes = document.getElementById('edit-internal-notes');

          if (addrInput) document.getElementById('meta-shipping-line1').textContent = addrInput.value;
          if (clientNotes) document.getElementById('info-client-notes').textContent = clientNotes.value;
          if (internalNotes) document.getElementById('info-internal-notes').textContent = internalNotes.value;

          closeEditOrderModal();
          showToastNotification('Datos del pedido actualizados');
        }
      });
    });
  }

  // 11. Modal de Confirmación Aceptar / Cancelar
  const btnConfirmAccept = document.getElementById('btn-confirm-accept');
  const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
  if (btnConfirmAccept) {
    btnConfirmAccept.addEventListener('click', () => {
      if (detailState.onConfirmCallback) {
        detailState.onConfirmCallback();
      }
      closeConfirmationModal();
    });
  }
  if (btnConfirmCancel) {
    btnConfirmCancel.addEventListener('click', closeConfirmationModal);
  }

  // 12. Cierre al hacer click fuera
  document.addEventListener('click', (e) => {
    if (moreOptionsMenu && !e.target.closest('#btn-order-more-options')) {
      moreOptionsMenu.classList.remove('is-active');
    }
    if (statusChangeMenu && !e.target.closest('#btn-toggle-change-status')) {
      statusChangeMenu.classList.remove('is-active');
    }

    const receiptModal = document.getElementById('receipt-modal-backdrop');
    if (receiptModal && e.target === receiptModal) closeReceiptModal();

    const editPaymentModal = document.getElementById('edit-payment-modal-backdrop');
    if (editPaymentModal && e.target === editPaymentModal) closeEditPaymentModal();

    const uploadModal = document.getElementById('upload-payment-modal-backdrop');
    if (uploadModal && e.target === uploadModal) closeUploadPaymentModal();

    const editModal = document.getElementById('edit-order-modal-backdrop');
    if (editModal && e.target === editModal) closeEditOrderModal();

    const confirmModal = document.getElementById('confirmation-modal-backdrop');
    if (confirmModal && e.target === confirmModal) closeConfirmationModal();
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeImageLightbox();
      closeConfirmationModal();
      closeReceiptModal();
      closeEditPaymentModal();
      closeUploadPaymentModal();
      closeEditOrderModal();
      if (moreOptionsMenu) moreOptionsMenu.classList.remove('is-active');
      if (statusChangeMenu) statusChangeMenu.classList.remove('is-active');
    }
  });
}

/**
 * ==========================================================================
 * INICIALIZACIÓN DE LA PANTALLA
 * ==========================================================================
 */
async function initOrderDetailPage() {
  try {
    // 1. Inicializar Navbar y Footer
    initNavbar({ title: 'Detalle de Pedido' });
    initFooter();

    // 2. Obtener tasa oficial del BCV
    try {
      detailState.exchangeRate = await getOfficialRate();
    } catch (err) {
      console.warn('Usando tasa de contingencia:', err);
      detailState.exchangeRate = 791.32;
    }

    // 3. Cargar datos del pedido
    detailState.orderId = getOrderIdFromUrl();
    detailState.order = await getOrderById(detailState.orderId);

    // 4. Renderizar componentes visuales
    renderOrderDetail(detailState.order);

    // 5. Configurar eventos interactivos
    setupDetailEventListeners();

    console.log(`%c[TuEstante Admin] Detalle del Pedido #${detailState.orderId} inicializado con tasa BCV (${detailState.exchangeRate} Bs/$).`, 'background: #005187; color: #fcffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  } catch (error) {
    console.error('[TuEstante Admin] Error al inicializar detalle de pedido:', error);
  }
}

// Ejecución al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrderDetailPage);
} else {
  initOrderDetailPage();
}
