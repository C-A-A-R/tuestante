/**
 * ==========================================================================
 * TUESTANTE - CONTROLADOR VISTA DE CARRITO Y CHECKOUT A CRÉDITO
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { formatProductImageUrl } from '../../components/product-card/product-card.js';
import { showToast, showAlertModal, showConfirmModal } from '../../components/dialog/dialog.js';
import {
  getCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartSubtotal,
  getCartUnitsCount
} from './cart-service.js';
import { obtenerMiPerfilEmpleado, crearOrdenInterna } from './cart.api.js';
import { formatBackendErrorMessage } from '../../../js/api.js';

/**
 * Carga un componente HTML dinámicamente e inserta su contenido en un placeholder.
 */
async function loadComponent(placeholderId, filePath) {
  try {
    const res = await fetch(`${filePath}?_t=${Date.now()}`);
    if (res.ok) {
      document.getElementById(placeholderId).innerHTML = await res.text();
    }
  } catch (err) {
    console.error(`Error al cargar componente ${filePath}:`, err);
  }
}

let currentEmployeeProfile = null;
let currentStatement = null;

/**
 * Carga los datos del empleado activo y su estado de cuenta consolidado
 */
async function loadEmployeeProfile() {
  try {
    const statement = await obtenerMiPerfilEmpleado();
    if (statement && statement.employee) {
      currentEmployeeProfile = statement.employee;
      currentStatement = statement;
      updateEmployeeDebtWarningUI(statement);
    }
  } catch (err) {
    console.warn('[Cart] No se pudo obtener el perfil del empleado:', err);
  }
}

/**
 * Sincroniza la alerta de deuda pendiente de semanas anteriores en la interfaz del carrito
 * @param {Object} statement
 */
function updateEmployeeDebtWarningUI(statement) {
  const debtCard = document.getElementById('cart-debt-warning');
  const debtText = document.getElementById('cart-debt-warning-text');
  const payrollNotice = document.getElementById('cart-payroll-notice');

  if (!debtCard) return;

  if (statement?.has_overdue_debt) {
    const amount = parseFloat(statement.overdue_debt_amount || 0).toFixed(2);
    const cutoffDate = statement.cutoff_date || 'corte previo';
    if (debtText) {
      debtText.textContent = `El colaborador tiene una deuda pendiente de semanas anteriores ($${amount}) correspondiente al corte del ${cutoffDate}. Debe liquidar su saldo anterior antes de realizar nuevas compras a crédito.`;
    }
    debtCard.style.display = 'flex';
    if (payrollNotice) {
      payrollNotice.style.display = 'none';
    }
  } else {
    debtCard.style.display = 'none';
    if (payrollNotice) {
      payrollNotice.style.display = 'flex';
    }
  }
}

/**
 * Renderiza la tabla de artículos del carrito
 */
function renderCart() {
  const cart = getCart();
  const tbody = document.getElementById('cart-items-tbody');
  const emptyState = document.getElementById('cart-empty-state');
  const tableContainer = document.getElementById('cart-table-container');
  const summaryAside = document.getElementById('cart-summary-aside');
  const totalItemsEl = document.getElementById('summary-total-items');
  const totalAmountEl = document.getElementById('summary-total-amount');

  if (!tbody) return;

  if (cart.length === 0) {
    tableContainer.style.display = 'none';
    summaryAside.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  tableContainer.style.display = 'block';
  summaryAside.style.display = 'block';
  emptyState.style.display = 'none';

  tbody.innerHTML = cart.map((item) => {
    const unitPrice = parseFloat(item.price || 0);
    const itemSubtotal = (unitPrice * (item.quantity || 1)).toFixed(2);
    const weeklyLimitText = item.weekly_limit_per_employee > 0
      ? `Máx. ${item.weekly_limit_per_employee} por semana`
      : '';
    const imageUrl = formatProductImageUrl(item.image);
    const thumbHtml = imageUrl
      ? `<img src="${imageUrl}" alt="${item.name}" class="cart-product-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
         <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" style="display:none;">
           <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
           <line x1="8" y1="21" x2="16" y2="21"></line>
           <line x1="12" y1="17" x2="12" y2="21"></line>
         </svg>`
      : `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor">
           <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
           <line x1="8" y1="21" x2="16" y2="21"></line>
           <line x1="12" y1="17" x2="12" y2="21"></line>
         </svg>`;

    return `
      <tr data-product-id="${item.id}" class="cart-item-row">
        <td class="cart-col-product">
          <div class="cart-product-cell">
            <div class="cart-product-thumb">
              ${thumbHtml}
            </div>
            <div class="cart-product-info">
              <h4>${item.name}</h4>
              <div class="cart-product-meta">
                <span class="cart-product-barcode">CÓD: ${item.barcode || 'N/A'}</span>
                <span class="cart-product-unit-price-mobile">$${unitPrice.toFixed(2)} c/u</span>
              </div>
              ${weeklyLimitText ? `<span class="cart-product-quota">${weeklyLimitText}</span>` : ''}
            </div>
          </div>
        </td>
        <td class="cart-col-price">
          <span class="cart-mobile-label">Precio Unitario:</span>
          <strong>$${unitPrice.toFixed(2)}</strong>
        </td>
        <td class="cart-col-qty">
          <span class="cart-mobile-label">Cantidad:</span>
          <div class="quantity-control">
            <button type="button" class="btn-qty btn-decrease" data-id="${item.id}" aria-label="Disminuir cantidad">&minus;</button>
            <input type="text" class="qty-input" value="${item.quantity}" readonly aria-label="Cantidad de ${item.name}" />
            <button type="button" class="btn-qty btn-increase" data-id="${item.id}" aria-label="Aumentar cantidad">&plus;</button>
          </div>
        </td>
        <td class="cart-col-subtotal">
          <span class="cart-mobile-label">Subtotal:</span>
          <strong class="text-primary cart-subtotal-val">$${itemSubtotal}</strong>
        </td>
        <td class="cart-col-actions">
          <button type="button" class="btn-remove-item" data-id="${item.id}" title="Eliminar artículo" aria-label="Eliminar ${item.name}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Actualizar totales en el resumen
  const subtotal = getCartSubtotal();
  const totalUnits = getCartUnitsCount();

  if (totalItemsEl) totalItemsEl.textContent = `${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'}`;
  if (totalAmountEl) totalAmountEl.textContent = `$${subtotal.toFixed(2)}`;

  attachRowEvents();
}

/**
 * Eventos para modificar cantidad o eliminar ítems
 */
function attachRowEvents() {
  // Botones Disminuir
  document.querySelectorAll('.btn-decrease').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const cart = getCart();
      const item = cart.find((i) => i.id === id);
      if (item) {
        if (item.quantity > 1) {
          updateCartQuantity(id, item.quantity - 1);
          renderCart();
        } else {
          const confirmed = await showConfirmModal({
            title: 'Eliminar del Carrito',
            message: `¿Deseas eliminar "${item.name}" del carrito?`,
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            type: 'danger'
          });
          if (confirmed) {
            removeFromCart(id);
            showToast(`Se eliminó "${item.name}" del carrito.`, 'info');
            renderCart();
          }
        }
      }
    });
  });

  // Botones Aumentar
  document.querySelectorAll('.btn-increase').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const cart = getCart();
      const item = cart.find((i) => i.id === id);
      if (item) {
        const result = updateCartQuantity(id, item.quantity + 1);
        if (!result.success) {
          showToast(result.message, 'warning');
        }
        renderCart();
      }
    });
  });

  // Botones Eliminar
  document.querySelectorAll('.btn-remove-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const cart = getCart();
      const item = cart.find((i) => i.id === id);
      const confirmed = await showConfirmModal({
        title: 'Eliminar Artículo',
        message: `¿Deseas eliminar "${item?.name || 'este producto'}" del carrito?`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      });
      if (confirmed) {
        removeFromCart(id);
        showToast(`Se eliminó "${item?.name || 'el producto'}" del carrito.`, 'info');
        renderCart();
      }
    });
  });
}

/**
 * Extrae de forma exhaustiva y limpia el mensaje retornado por el backend (DRF).
 * Maneja arreglos nativos de validación, objetos con items/errores y cadenas directas.
 * @param {Error|Object} err 
 * @returns {string}
 */
function extractCheckoutErrorMessage(err) {
  if (!err) {
    return 'Ocurrió un error inesperado al procesar la solicitud.';
  }

  // 1. Arreglo directo de errores (típico de DRF ValidationError(message))
  if (Array.isArray(err.data) && err.data.length > 0) {
    const list = err.data.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) return formatBackendErrorMessage(item, err.status);
      return String(item);
    }).filter(Boolean);
    if (list.length > 0) return list.join('\n\n');
  }

  // 2. Cadena de texto directa
  if (typeof err.data === 'string' && err.data.trim()) {
    return err.data;
  }

  // 3. Objeto estructurado de errores (DRF serializer / validation errors)
  if (err.data && typeof err.data === 'object') {
    // Errores en lista de artículos
    if (err.data.items) {
      if (Array.isArray(err.data.items)) {
        const itemMessages = err.data.items.map((it) => {
          if (typeof it === 'string') return it;
          if (typeof it === 'object' && it !== null) {
            return Object.entries(it)
              .map(([k, v]) => (Array.isArray(v) ? v.join(', ') : String(v)))
              .join(' - ');
          }
          return String(it);
        }).filter(Boolean);
        if (itemMessages.length > 0) return itemMessages.join('\n\n');
      } else if (typeof err.data.items === 'string') {
        return err.data.items;
      }
    }

    if (err.data.detail && typeof err.data.detail === 'string') {
      return err.data.detail;
    }
    if (err.data.error && typeof err.data.error === 'string') {
      return err.data.error;
    }
    if (err.data.message && typeof err.data.message === 'string') {
      return err.data.message;
    }
    if (err.data.non_field_errors) {
      return Array.isArray(err.data.non_field_errors)
        ? err.data.non_field_errors.join('\n\n')
        : String(err.data.non_field_errors);
    }

    const formatted = formatBackendErrorMessage(err.data, err.status);
    if (formatted && !formatted.includes('Ocurrió un error inesperado')) {
      return formatted;
    }
  }

  // 4. Mensaje formateado previamente por apiRequest (Error.message)
  if (err.message && typeof err.message === 'string' && err.message.trim()) {
    return err.message;
  }

  return 'Ocurrió un error al procesar tu pedido. Verifica tu cupo disponible o intenta nuevamente.';
}

/**
 * Analiza el mensaje del backend y construye la metadata y recomendaciones visuales.
 * @param {string} rawMessage
 * @returns {{ title: string, type: 'warning'|'danger'|'info', htmlMessage: string, actionText?: string, actionUrl?: string }}
 */
function getCheckoutErrorInfo(rawMessage) {
  const msgLower = (rawMessage || '').toLowerCase();

  // 1. Deuda de semanas anteriores
  if (
    msgLower.includes('deuda pendiente') ||
    msgLower.includes('liquidar su saldo') ||
    msgLower.includes('semanas anteriores') ||
    msgLower.includes('corte del')
  ) {
    return {
      title: 'Deuda Pendiente de Semanas Anteriores',
      type: 'warning',
      actionText: 'Ver Mi Estado de Cuenta',
      actionUrl: '../profile/profile.html',
      htmlMessage: `
        <div style="display: flex; flex-direction: column; gap: 0.85rem; text-align: left;">
          <div style="background-color: #fffbeb; border: 1.5px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 0.85rem 1rem;">
            <p style="margin: 0; font-size: 0.92rem; font-weight: 700; color: #92400e; line-height: 1.45;">
              ${rawMessage}
            </p>
          </div>
          <div style="font-size: 0.85rem; color: #475569; line-height: 1.5;">
            <strong>¿Por qué no puedes comprar en este momento?</strong><br/>
            Para mantener activo el beneficio de compras a crédito con cargo a nómina, el sistema exige que las deudas de cortes de nómina anteriores estén completamente saldadas antes de autorizar nuevos consumos.
          </div>
          <div style="font-size: 0.82rem; color: #64748b; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem 0.85rem;">
            💡 <em>Puedes consultar el desglose de tus consumos pasados y retenciones en la sección <strong>Estado de Cuenta</strong> de tu perfil, o acudir a Administración / Recursos Humanos.</em>
          </div>
        </div>
      `
    };
  }

  // 2. Límite semanal de compra por producto
  if (
    msgLower.includes('límite semanal') ||
    msgLower.includes('limite semanal') ||
    (msgLower.includes('consumido') && msgLower.includes('últimos 7 días'))
  ) {
    return {
      title: 'Límite Semanal de Compra Excedido',
      type: 'warning',
      htmlMessage: `
        <div style="display: flex; flex-direction: column; gap: 0.85rem; text-align: left;">
          <div style="background-color: #fffbeb; border: 1.5px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 0.85rem 1rem;">
            <p style="margin: 0; font-size: 0.92rem; font-weight: 700; color: #92400e; line-height: 1.45;">
              ${rawMessage}
            </p>
          </div>
          <div style="font-size: 0.85rem; color: #475569; line-height: 1.5;">
            <strong>Regla de compra interna:</strong><br/>
            Ciertos productos cuentan con un tope de unidades por colaborador cada 7 días para garantizar el abastecimiento justo entre todo el personal.
          </div>
          <div style="font-size: 0.82rem; color: #64748b;">
            👉 <em>Por favor reduce la cantidad del producto en tu carrito para continuar.</em>
          </div>
        </div>
      `
    };
  }

  // 3. Stock insuficiente
  if (
    msgLower.includes('stock insuficiente') ||
    msgLower.includes('disponible:') ||
    msgLower.includes('solicitado:')
  ) {
    return {
      title: 'Stock Insuficiente en Almacén',
      type: 'warning',
      htmlMessage: `
        <div style="display: flex; flex-direction: column; gap: 0.85rem; text-align: left;">
          <div style="background-color: #fef2f2; border: 1.5px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 0.85rem 1rem;">
            <p style="margin: 0; font-size: 0.92rem; font-weight: 700; color: #991b1b; line-height: 1.45;">
              ${rawMessage}
            </p>
          </div>
          <div style="font-size: 0.85rem; color: #475569; line-height: 1.5;">
            La cantidad solicitada supera las existencias físicas disponibles en bodega.
          </div>
          <div style="font-size: 0.82rem; color: #64748b;">
            👉 <em>Ajusta las cantidades en tu carrito según las existencias disponibles para proceder.</em>
          </div>
        </div>
      `
    };
  }

  // 4. Empleado no activo
  if (
    msgLower.includes('no se encuentra activo') ||
    msgLower.includes('inactivo para compras')
  ) {
    return {
      title: 'Colaborador No Habilitado',
      type: 'danger',
      htmlMessage: `
        <div style="display: flex; flex-direction: column; gap: 0.85rem; text-align: left;">
          <div style="background-color: #fef2f2; border: 1.5px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 0.85rem 1rem;">
            <p style="margin: 0; font-size: 0.92rem; font-weight: 700; color: #991b1b; line-height: 1.45;">
              ${rawMessage}
            </p>
          </div>
          <div style="font-size: 0.85rem; color: #475569; line-height: 1.5;">
            Tu perfil de colaborador no se encuentra habilitado para registrar compras a crédito.
          </div>
          <div style="font-size: 0.82rem; color: #64748b;">
            👉 <em>Comunícate con el departamento de Recursos Humanos o Administración para activar tu cuenta.</em>
          </div>
        </div>
      `
    };
  }

  // 5. Fallback general
  return {
    title: 'No se Pudo Procesar el Pedido',
    type: 'danger',
    htmlMessage: `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <div style="background-color: #fef2f2; border: 1.5px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 0.85rem 1rem;">
          <p style="margin: 0; font-size: 0.92rem; font-weight: 600; color: #991b1b; line-height: 1.45;">
            ${rawMessage}
          </p>
        </div>
        <p style="margin: 0; font-size: 0.84rem; color: #64748b;">
          Revisa la información de tu carrito o intenta nuevamente más tarde. Si el problema persiste, contacta al supervisor de tienda.
        </p>
      </div>
    `
  };
}

/**
 * Procesa la orden de compra atómica POST /api/employee-store/orders/
 */
async function handleCheckout() {
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Tu carrito está vacío.', 'warning');
    return;
  }

  const btnConfirm = document.getElementById('btn-confirm-order');

  if (!currentEmployeeProfile || !currentEmployeeProfile.id) {
    await loadEmployeeProfile();
  }

  if (!currentEmployeeProfile || !currentEmployeeProfile.id) {
    showAlertModal({
      title: 'Verificación de Colaborador',
      message: 'No se pudo verificar tu ficha de empleado. Por favor contacta a Recursos Humanos o vuelve a iniciar sesión.',
      type: 'danger'
    });
    return;
  }

  // Pre-validar si el colaborador tiene deuda pendiente de semanas anteriores
  if (currentStatement?.has_overdue_debt) {
    const debtAmount = parseFloat(currentStatement.overdue_debt_amount || 0).toFixed(2);
    const cutoffDate = currentStatement.cutoff_date || 'corte previo';
    const debtMsg = `El trabajador tiene una deuda pendiente de semanas anteriores ($${debtAmount}) correspondiente al corte del ${cutoffDate}. Debe liquidar su saldo anterior antes de realizar nuevas compras.`;
    const errorInfo = getCheckoutErrorInfo(debtMsg);

    showAlertModal({
      title: errorInfo.title,
      message: errorInfo.htmlMessage,
      type: errorInfo.type,
      confirmText: 'Entendido',
      actionText: errorInfo.actionText || '',
      actionUrl: errorInfo.actionUrl || ''
    });
    return;
  }

  // Pre-validar stock en el carrito antes de enviar
  for (const item of cart) {
    if (typeof item.stock === 'number' && item.quantity > item.stock) {
      showAlertModal({
        title: 'Stock Insuficiente',
        message: `El producto "${item.name}" solo tiene ${item.stock} unidades disponibles en almacén (tienes ${item.quantity} en tu carrito). Por favor ajusta la cantidad para continuar.`,
        type: 'warning'
      });
      return;
    }
  }

  const payload = {
    employee_id: currentEmployeeProfile.id,
    items: cart.map((item) => ({
      product_id: item.id,
      barcode: item.barcode || '',
      quantity: item.quantity
    })),
    status: 'UNDELIVERED',
    notes: '',
    is_admin_override: false
  };

  try {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = `
      <span class="spinner" style="display:inline-block; width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 6px;"></span>
      Registrando pedido...
    `;

    const result = await crearOrdenInterna(payload);

    // Limpiar carrito tras éxito
    clearCart();

    // Redirigir a la vista de pedidos con confirmación
    const orderNumber = result?.order_number || '';
    window.location.href = `../order/orders.html?order_confirmed=1&order_number=${encodeURIComponent(orderNumber)}`;
  } catch (err) {
    console.error('[Cart] Error al confirmar orden:', err);
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Confirmar Pedido</span>
    `;

    const rawMessage = extractCheckoutErrorMessage(err);
    const errorInfo = getCheckoutErrorInfo(rawMessage);

    showAlertModal({
      title: errorInfo.title,
      message: errorInfo.htmlMessage,
      type: errorInfo.type,
      confirmText: 'Entendido',
      actionText: errorInfo.actionText || '',
      actionUrl: errorInfo.actionUrl || ''
    });
  }
}

// Inicialización de la pantalla
async function initCartPage() {
  initNavbar('navbar-placeholder');
  initFooter('footer-placeholder');

  await loadEmployeeProfile();
  renderCart();

  const btnConfirm = document.getElementById('btn-confirm-order');
  if (btnConfirm) {
    btnConfirm.addEventListener('click', handleCheckout);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCartPage);
} else {
  initCartPage();
}
