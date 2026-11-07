import { loadAdminComponents } from '../../components/navbar/navbar.js';
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

import { getOfficialRate } from '../../js/service/exchange-rate.service.js';
import { 
  getOrderById, 
  updateOrderStatus, 
  updateOrderDetails,
  issueManufacturingOrder,
  reviewPayment,
  updatePayment,
  createPayment,
  getDailyExchangeRate
} from './order.api.js';

/**
 * SECUENCIA OFICIAL DEL FLUJO DE ESTADOS DE PEDIDO
 */
const ORDER_STATUS_FLOW = [
  { id: 'pending_initial_payment', label: 'Pendiente de pago inicial' },
  { id: 'initial_payment_review', label: 'Pago inicial en revisión' },
  { id: 'manufacturing', label: 'En fabricación' },
  { id: 'waiting_final_payment', label: 'Esperando pago final' },
  { id: 'final_payment_review', label: 'Pago final en revisión' },
  { id: 'shipped', label: 'Enviado' },
  { id: 'finalized', label: 'Finalizado' }
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

  // Botones de Notificaciones vinculados dinámicamente a la creación con este pedido preseleccionado
  const orderTargetId = order.id || detailState.orderId;
  const targetNotifUrl = `../notifications/notification-create.html?order_id=${orderTargetId}`;
  const btnViewNotifs = document.getElementById('btn-view-order-notifs');
  if (btnViewNotifs) {
    btnViewNotifs.href = targetNotifUrl;
  }
  const btnGotoNotifs = document.getElementById('btn-goto-notifications');
  if (btnGotoNotifs) {
    btnGotoNotifs.href = targetNotifUrl;
  }

  // 2. Badge de Estado Principal
  const headerStatusBadge = document.getElementById('order-header-status-badge');
  const headerStatusText = document.getElementById('order-header-status-text');
  if (headerStatusBadge && headerStatusText) {
    headerStatusText.textContent = order.status_label || getStatusLabel(order.status);
    headerStatusBadge.className = 'order-status-badge-header';
    const statusClassMap = {
      'pending_initial_payment': 'badge-pending-payment',
      'initial_payment_review': 'badge-payment-review',
      'manufacturing': 'badge-manufacturing',
      'waiting_final_payment': 'badge-waiting-final',
      'final_payment_review': 'badge-payment-review',
      'shipped': 'badge-shipped',
      'finalized': 'badge-approved',
      'returned_manufacturing': 'badge-pending',
      'cancelled': 'badge-pending'
    };
    headerStatusBadge.classList.add(statusClassMap[order.status] || 'badge-manufacturing');
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

  // Usar tasa congelada en el pedido si existe
  if (order.bcv_rate && Number(order.bcv_rate) > 0) {
    detailState.exchangeRate = Number(order.bcv_rate);
  }

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

  const list = Array.isArray(paymentsList) && paymentsList.length > 0 ? paymentsList : [];
  if (list.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding: 16px;">No hay registros de pago vinculados.</p>';
    return;
  }

  container.innerHTML = list.map(pay => {
    const isApproved = pay.status === 'approved';
    const isPending = pay.status === 'pending';
    const isRejected = pay.status === 'rejected';
    const isUnregistered = pay.status === 'unregistered';
    const badgeClass = isApproved ? 'badge-approved' : (isRejected ? 'badge-pending' : (isPending ? 'badge-payment-review' : 'badge-pending'));
    const badgeLabel = pay.status_label || (isApproved ? 'Aprobado' : (isRejected ? 'Rechazado' : (isPending ? 'En revisión' : 'Pendiente por registrar')));

    const usdVal = typeof pay.amount_usd === 'number' ? pay.amount_usd : (parseFloat(pay.amount || 0));
    const bsVal = (isApproved && pay.amount_bs) 
      ? pay.amount_bs 
      : (usdVal * detailState.exchangeRate);

    const isEdited = Boolean(pay.is_edited);
    const hasReceipt = Boolean(pay.receipt_url);

    return `
      <div class="payment-subcard ${isEdited ? 'is-edited-card' : ''}" data-payment-id="${pay.id || ''}">
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
          <span>Método: ${escapeHtml(pay.payment_method || '-')}</span>
        </div>

        <div class="payment-subcard-actions-row">
          ${hasReceipt ? `
            <button type="button" class="btn btn-outline btn-sm btn-view-receipt" data-payment-id="${pay.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>Ver comprobante</span>
            </button>
          ` : ''}

          ${isPending && pay.id ? `
            <button type="button" class="btn btn-success btn-sm btn-approve-pay" data-payment-id="${pay.id}" data-usd="${usdVal}" data-bs="${bsVal}" title="Aprobar este pago y avanzar etapa del pedido">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Aprobar</span>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm btn-reject-pay" data-payment-id="${pay.id}" title="Rechazar comprobante de pago">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>Rechazar</span>
            </button>
          ` : ''}

          ${(!hasReceipt || isUnregistered) ? `
            <button type="button" class="btn btn-primary btn-sm btn-upload-receipt" data-stage="${pay.payment_stage}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Subir comprobante</span>
            </button>
          ` : ''}

          ${(pay.id && !isUnregistered) ? `
            <button type="button" class="btn btn-outline btn-sm btn-edit-payment" data-payment-id="${pay.id}" title="Editar registro de pago">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Editar</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Eventos de botones
  container.querySelectorAll('.btn-view-receipt').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-payment-id');
      const pay = list.find(p => String(p.id) === String(pid)) || list[0];
      openReceiptModal(pay);
    });
  });

  container.querySelectorAll('.btn-approve-pay').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-payment-id');
      const usdVal = btn.getAttribute('data-usd');
      const bsVal = btn.getAttribute('data-bs');
      showConfirmationModal({
        title: '¿Aprobar pago?',
        message: `¿Confirmar la aprobación de este pago por $${usdVal} (Bs. ${Number(bsVal).toLocaleString('es-VE')})? El estado del pedido se actualizará en el backend.`,
        onConfirm: async () => {
          try {
            await reviewPayment(pid, 'approved');
            detailState.order = await getOrderById(detailState.orderId);
            renderOrderDetail(detailState.order);
            showToastNotification('¡Pago aprobado con éxito! El pedido avanzó automáticamente.');
          } catch (err) {
            console.error(err);
            alert('Error al aprobar el pago: ' + (err.message || err));
          }
        }
      });
    });
  });

  container.querySelectorAll('.btn-reject-pay').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-payment-id');
      const reason = prompt('Indique el motivo del rechazo del comprobante de pago:', 'Comprobante no legible o datos no coincidentes');
      if (reason && reason.trim()) {
        showConfirmationModal({
          title: '¿Rechazar comprobante de pago?',
          message: `El comprobante será marcado como rechazado: "${reason.trim()}".`,
          onConfirm: async () => {
            try {
              await reviewPayment(pid, 'rejected', reason.trim());
              detailState.order = await getOrderById(detailState.orderId);
              renderOrderDetail(detailState.order);
              showToastNotification('Pago rechazado y registrado en el sistema.');
            } catch (err) {
              console.error(err);
              alert('Error al rechazar el pago: ' + (err.message || err));
            }
          }
        });
      }
    });
  });

  container.querySelectorAll('.btn-upload-receipt').forEach(btn => {
    btn.addEventListener('click', () => {
      const stage = btn.getAttribute('data-stage') || 'final';
      openUploadPaymentModal(stage);
    });
  });

  container.querySelectorAll('.btn-edit-payment').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-payment-id');
      const pay = list.find(p => String(p.id) === String(pid)) || list[0];
      openEditPaymentModal(pay);
    });
  });
}

/**
 * Renderiza el stepper vertical con la fecha debajo de cada etapa y soporte para navegación interactiva
 */
function renderTimelineStepper(steps, currentStatus) {
  const container = document.getElementById('order-timeline-container');
  if (!container) return;

  const FLOW = [
    { id: "pending_initial_payment", label: "Pendiente de pago" },
    { id: "initial_payment_review", label: "Pago inicial en revisión" },
    { id: "manufacturing", label: "En fabricación" },
    { id: "waiting_final_payment", label: "Esperando pago final" },
    { id: "final_payment_review", label: "Pago final en revisión" },
    { id: "shipped", label: "Enviado" },
    { id: "finalized", label: "Finalizado" }
  ];

  let timeline = steps;
  if (!timeline || timeline.length === 0) {
    const currentIdx = FLOW.findIndex(f => f.id === currentStatus);
    timeline = FLOW.map((f, idx) => ({
      id: f.id,
      label: f.label,
      status: currentIdx === -1 ? 'pending' : (idx < currentIdx ? 'completed' : (idx === currentIdx ? 'current' : 'pending')),
      date: idx < currentIdx ? 'Completado' : (idx === currentIdx ? 'En curso' : 'Pendiente')
    }));
  }

  container.innerHTML = timeline.map(step => {
    const isCompleted = step.status === 'completed';
    const isCurrent = step.status === 'current';
    const itemClass = isCompleted ? 'is-completed' : isCurrent ? 'is-current' : 'is-pending';

    return `
      <div class="timeline-step-item ${itemClass}" data-status="${escapeHtml(step.id)}" data-label="${escapeHtml(step.label)}" title="Haga clic para cambiar a este estado">
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

  // Permitir interacción directa al hacer clic sobre un paso del stepper
  container.querySelectorAll('.timeline-step-item').forEach(item => {
    item.addEventListener('click', () => {
      const targetStatus = item.getAttribute('data-status');
      const targetLabel = item.getAttribute('data-label');
      if (!targetStatus || targetStatus === detailState.order?.status) return;

      const validation = validateStatusTransition(targetStatus, detailState.order);
      if (!validation.valid) {
        if (validation.needsApproval && validation.payment) {
          showConfirmationModal({
            title: 'Pago pendiente de verificación',
            message: `${validation.message}\n\n¿Deseas abrir el comprobante de este pago para revisarlo y aprobarlo ahora?`,
            onConfirm: () => {
              openReceiptModal(validation.payment);
            }
          });
          return;
        }
        alert(`⚠️ Acción Bloqueada:\n${validation.message}`);
        return;
      }

      showConfirmationModal({
        title: `¿Cambiar estado a "${targetLabel}"?`,
        message: `¿Está seguro de que desea cambiar el estado del pedido a "${targetLabel}"?`,
        onConfirm: async () => {
          await applyStatusChange(targetStatus, targetLabel);
        }
      });
    });
  });
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
  const initialPayment = payments.find(p => p.payment_stage === 'initial' || (p.title && p.title.toLowerCase().includes('inicial')));
  const finalPayment = payments.find(p => p.payment_stage === 'final' || (p.title && p.title.toLowerCase().includes('final')));

  // 1. Regla: Para pasar a "En fabricación" (manufacturing), el pago inicial debe estar aprobado
  if (targetStatus === 'manufacturing') {
    if (initialPayment && initialPayment.status !== 'approved') {
      return {
        valid: false,
        needsApproval: true,
        payment: initialPayment,
        message: 'No se puede avanzar a "En fabricación" porque el Pago Inicial aún no ha sido verificado y aprobado.'
      };
    }
  }

  // 2. Regla: Para pasar a "Enviado" (shipped) o "Finalizado" (finalized), el pago final debe estar aprobado
  if (targetStatus === 'shipped' || targetStatus === 'finalized' || targetStatus === 'completed') {
    if (finalPayment && finalPayment.status !== 'approved') {
      return {
        valid: false,
        needsApproval: true,
        payment: finalPayment,
        message: 'No se puede marcar como "' + getStatusLabel(targetStatus) + '" porque el Pago Final aún se encuentra pendiente de verificación o registro.'
      };
    }
  }

  // 3. Regla: Si ya está devuelto o cancelado, advertir
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return {
      valid: false,
      message: 'Este pedido ya fue cancelado. No se pueden reabrir etapas directamente.'
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
/**
 * Procesa la edición del pago con confirmación previa y guardado en backend
 */
function handleSavePaymentEdit(e) {
  e.preventDefault();

  const payment = detailState.activePaymentForModal;
  if (!payment) return;

  const usdVal = parseFloat(document.getElementById('edit-payment-amount-usd').value || 0);
  const bsVal = parseFloat(document.getElementById('edit-payment-amount-bs').value || 0);
  const refVal = document.getElementById('edit-payment-ref').value.trim();
  const methodVal = document.getElementById('edit-payment-method').value.trim();
  const statusVal = document.getElementById('edit-payment-status').value;

  showConfirmationModal({
    title: '¿Confirmar edición del pago?',
    message: `Se actualizará el monto a ${formatUsd(usdVal)} (${formatBs(bsVal)}) y se guardará el cambio en el servidor.`,
    onConfirm: async () => {
      try {
        if (payment.id) {
          const payload = {
            amount: usdVal,
            reference_number: refVal,
            payment_method: methodVal
          };
          await updatePayment(payment.id, payload);

          if (statusVal && statusVal !== payment.status) {
            if (statusVal === 'approved' || statusVal === 'rejected') {
              await reviewPayment(payment.id, statusVal);
            }
          }
        }

        detailState.order = await getOrderById(detailState.orderId);
        renderOrderDetail(detailState.order);
        closeEditPaymentModal();
        showToastNotification('¡Pago editado y actualizado con éxito en el servidor!');
      } catch (err) {
        console.error(err);
        alert('Error al actualizar el pago en el servidor: ' + (err.message || err));
      }
    }
  });
}

/**
 * ==========================================================================
 * MODAL: VER COMPROBANTE CON LIGHTBOX FLOTANTE Y ACCIONES DIRECTAS
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
  if (refEl) refEl.textContent = (payment.reference && payment.reference !== '-') ? payment.reference : 'Sin referencia';
  if (bankEl) bankEl.textContent = (payment.payment_method && payment.payment_method !== '-') ? payment.payment_method : 'No especificado';
  if (dateEl) dateEl.textContent = (payment.date && payment.date !== '-') ? payment.date : 'Pendiente';
  if (rateEl) rateEl.textContent = `${(payment.rate_applied || detailState.exchangeRate || 849.56).toLocaleString('es-VE')} Bs/$`;
  if (usdAmountEl) usdAmountEl.textContent = formatUsd(usdVal);
  if (bsAmountEl) bsAmountEl.textContent = formatBs(bsVal);

  const imgSrc = payment.receipt_url || "../../assets/images/logo.jpeg";
  if (imgEl) imgEl.src = imgSrc;

  // Descarga del comprobante
  const btnDownload = document.getElementById('btn-download-receipt');
  if (btnDownload) {
    btnDownload.onclick = () => {
      if (payment.receipt_url) {
        window.open(payment.receipt_url, '_blank');
      } else {
        alert('No hay archivo de comprobante disponible para descargar.');
      }
    };
  }

  // Acciones directas de aprobación / rechazo dentro del modal de comprobante
  const btnApprove = document.getElementById('btn-approve-receipt-modal');
  const btnReject = document.getElementById('btn-reject-receipt-modal');
  const isPending = payment.status === 'pending';

  if (btnApprove) {
    btnApprove.style.display = isPending ? 'inline-flex' : 'none';
    btnApprove.onclick = () => {
      showConfirmationModal({
        title: '¿Aprobar comprobante de pago?',
        message: `¿Confirmar la aprobación de ${payment.title || 'este pago'} por ${formatUsd(usdVal)} (${formatBs(bsVal)})? El estado del pedido se actualizará automáticamente.`,
        onConfirm: async () => {
          try {
            await reviewPayment(payment.id, 'approved');
            detailState.order = await getOrderById(detailState.orderId);
            renderOrderDetail(detailState.order);
            closeReceiptModal();
            showToastNotification('¡Pago aprobado con éxito! El pedido avanzó automáticamente.');
          } catch (err) {
            console.error(err);
            alert('Error al aprobar el pago: ' + (err.message || err));
          }
        }
      });
    };
  }

  if (btnReject) {
    btnReject.style.display = isPending ? 'inline-flex' : 'none';
    btnReject.onclick = () => {
      const reason = prompt('Indique el motivo del rechazo del pago:', 'Comprobante no válido o datos ilegibles');
      if (reason && reason.trim()) {
        showConfirmationModal({
          title: '¿Rechazar comprobante?',
          message: `El pago será rechazado con motivo: "${reason.trim()}".`,
          onConfirm: async () => {
            try {
              await reviewPayment(payment.id, 'rejected', reason.trim());
              detailState.order = await getOrderById(detailState.orderId);
              renderOrderDetail(detailState.order);
              closeReceiptModal();
              showToastNotification('Pago rechazado y notificado.');
            } catch (err) {
              console.error(err);
              alert('Error al rechazar el pago: ' + (err.message || err));
            }
          }
        });
      }
    };
  }

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

function openUploadPaymentModal(stage = 'final') {
  const modal = document.getElementById('upload-payment-modal-backdrop');
  if (!modal) return;

  const stageSelect = document.getElementById('payment-stage-select');
  const amountInput = document.getElementById('payment-amount-input');
  const subTitle = document.getElementById('upload-modal-subtitle');

  if (stageSelect) stageSelect.value = stage;

  const total = Number(detailState.order?.total_amount || 0);
  const paid = Number(detailState.order?.paid_amount || 0);
  const targetAmount = stage === 'initial' 
    ? (total / 2) 
    : (detailState.order?.pending_balance ? Number(detailState.order.pending_balance) : (total - paid || total / 2));

  if (amountInput) amountInput.value = targetAmount.toFixed(2);
  if (subTitle) subTitle.textContent = `${stage === 'final' ? 'Pago final' : 'Pago inicial'} - ${formatUsd(targetAmount)}`;

  modal.classList.add('is-open');
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
  if (!modal) return;

  const addrInput = document.getElementById('edit-shipping-address');
  const clientNotes = document.getElementById('edit-client-notes');
  const internalNotes = document.getElementById('edit-internal-notes');
  const titleEl = document.getElementById('edit-order-modal-title');

  if (titleEl) {
    titleEl.textContent = `Editar Pedido ${detailState.order?.order_code || ('#' + detailState.orderId)}`;
  }

  if (addrInput) {
    addrInput.value = detailState.order?.shipping_address?.address || detailState.order?.shipping_address?.line1 || '';
  }
  if (clientNotes) {
    clientNotes.value = detailState.order?.client_notes || detailState.order?.notes || '';
  }
  if (internalNotes) {
    internalNotes.value = detailState.order?.internal_notes || '';
  }

  modal.classList.add('is-open');
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
          if (validation.needsApproval && validation.payment) {
            showConfirmationModal({
              title: 'Pago pendiente de aprobación',
              message: `${validation.message}\n\n¿Deseas abrir el comprobante de este pago para revisarlo y aprobarlo ahora?`,
              onConfirm: () => {
                openReceiptModal(validation.payment);
              }
            });
            return;
          }
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
        if (validation.needsApproval && validation.payment) {
          showConfirmationModal({
            title: 'Pago pendiente de verificación',
            message: `${validation.message}\n\n¿Deseas abrir el comprobante de este pago para revisarlo y aprobarlo ahora?`,
            onConfirm: () => {
              openReceiptModal(validation.payment);
            }
          });
          return;
        }
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
      detailState.order = await getOrderById(detailState.orderId);
      renderOrderDetail(detailState.order);
      showToastNotification(`Estado del pedido actualizado a "${statusLabel}"`);
    } catch (err) {
      console.error(err);
      alert(`Error al actualizar estado del pedido: ${err.message || err}`);
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
        message: 'El pedido pasará a estado Cancelado y se detendrán todas las actividades de fabricación.',
        onConfirm: async () => {
          await updateOrderStatus(detailState.orderId, 'cancelled', 'Cancelado por el administrador');
          detailState.order = await getOrderById(detailState.orderId);
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

      const stageVal = document.getElementById('payment-stage-select')?.value || 'final';
      const amountVal = parseFloat(document.getElementById('payment-amount-input')?.value || 0);
      const methodVal = document.getElementById('payment-method-select')?.value || 'mobile_payment';
      const refVal = document.getElementById('payment-ref-input')?.value.trim() || '';
      const fileInput = document.getElementById('payment-receipt-file');
      const notesVal = document.getElementById('payment-notes-input')?.value.trim() || '';

      if (!fileInput || !fileInput.files[0]) {
        alert('Por favor, adjunte el archivo de comprobante de pago.');
        return;
      }

      showConfirmationModal({
        title: '¿Guardar comprobante de pago?',
        message: `Se enviará el comprobante de ${stageVal === 'initial' ? 'pago inicial' : 'pago final'} por ${formatUsd(amountVal)} para revisión.`,
        onConfirm: async () => {
          try {
            const formData = new FormData();
            formData.append('order', detailState.orderId);
            formData.append('payment_stage', stageVal);
            formData.append('amount', amountVal);
            formData.append('payment_method', methodVal);
            formData.append('reference_number', refVal);
            formData.append('receipt_file', fileInput.files[0]);
            if (notesVal) {
              formData.append('notes', notesVal);
            }

            await createPayment(formData);
            detailState.order = await getOrderById(detailState.orderId);
            renderOrderDetail(detailState.order);
            closeUploadPaymentModal();
            showToastNotification('¡Comprobante de pago guardado y enviado a revisión con éxito!');
          } catch (err) {
            console.error(err);
            alert('Error al registrar el comprobante: ' + (err.message || err));
          }
        }
      });
    });
  }

  // 10. Modal Editar Pedido (con confirmación y guardado en backend)
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
        message: 'Se actualizarán las direcciones de entrega y observaciones del pedido en el servidor.',
        onConfirm: async () => {
          try {
            const addrInput = document.getElementById('edit-shipping-address');
            const clientNotes = document.getElementById('edit-client-notes');

            await updateOrderDetails(detailState.orderId, {
              address: addrInput ? addrInput.value.trim() : '',
              notes: clientNotes ? clientNotes.value.trim() : ''
            });

            detailState.order = await getOrderById(detailState.orderId);
            renderOrderDetail(detailState.order);
            closeEditOrderModal();
            showToastNotification('Datos del pedido actualizados con éxito en el servidor');
          } catch (err) {
            console.error(err);
            alert('Error al actualizar datos del pedido: ' + (err.message || err));
          }
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
    // 1. Inicializar componentes compartidos (Navbar, Drawer y Footer)
    await loadAdminComponents({ title: 'Detalle de Pedido' });

    // 2. Cargar datos del pedido
    detailState.orderId = getOrderIdFromUrl();
    detailState.order = await getOrderById(detailState.orderId);

    // 3. Determinar tasa oficial del BCV (priorizando tasa congelada del pedido)
    if (detailState.order && detailState.order.bcv_rate && Number(detailState.order.bcv_rate) > 0) {
      detailState.exchangeRate = Number(detailState.order.bcv_rate);
    } else {
      try {
        const dailyRate = await getDailyExchangeRate();
        if (dailyRate && dailyRate.rate) {
          detailState.exchangeRate = Number(dailyRate.rate);
        } else {
          detailState.exchangeRate = await getOfficialRate();
        }
      } catch (err) {
        console.warn('Usando tasa de contingencia:', err);
        detailState.exchangeRate = await getOfficialRate().catch(() => 849.56);
      }
    }

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
