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

/**
 * Carga los datos del empleado activo
 */
async function loadEmployeeProfile() {
  try {
    const statement = await obtenerMiPerfilEmpleado();
    if (statement && statement.employee) {
      currentEmployeeProfile = statement.employee;
    }
  } catch (err) {
    console.warn('[Cart] No se pudo obtener el perfil del empleado:', err);
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
      <tr data-product-id="${item.id}">
        <td>
          <div class="cart-product-cell">
            <div class="cart-product-thumb">
              ${thumbHtml}
            </div>
            <div class="cart-product-info">
              <h4>${item.name}</h4>
              <span class="cart-product-barcode">CÓD: ${item.barcode || 'N/A'}</span>
              ${weeklyLimitText ? `<span class="cart-product-quota">${weeklyLimitText}</span>` : ''}
            </div>
          </div>
        </td>
        <td>
          <strong>$${unitPrice.toFixed(2)}</strong>
        </td>
        <td>
          <div class="quantity-control">
            <button type="button" class="btn-qty btn-decrease" data-id="${item.id}" aria-label="Disminuir cantidad">&minus;</button>
            <input type="text" class="qty-input" value="${item.quantity}" readonly aria-label="Cantidad de ${item.name}" />
            <button type="button" class="btn-qty btn-increase" data-id="${item.id}" aria-label="Aumentar cantidad">&plus;</button>
          </div>
        </td>
        <td>
          <strong class="text-primary">$${itemSubtotal}</strong>
        </td>
        <td style="text-align: right;">
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

    let msg = 'Ocurrió un error al procesar tu pedido. Verifica tu cupo disponible o intenta nuevamente.';
    if (err?.data) {
      if (typeof err.data === 'string') {
        msg = err.data;
      } else if (err.data.detail) {
        msg = err.data.detail;
      } else if (err.data.error) {
        msg = err.data.error;
      } else if (err.data.items) {
        const itemErrors = Array.isArray(err.data.items)
          ? err.data.items.map(it => typeof it === 'string' ? it : Object.values(it).flat().join(' ')).filter(Boolean).join('; ')
          : JSON.stringify(err.data.items);
        msg = `Problema con artículos en inventario: ${itemErrors}`;
      } else if (err.data.non_field_errors) {
        msg = Array.isArray(err.data.non_field_errors) ? err.data.non_field_errors.join(' ') : err.data.non_field_errors;
      }
    } else if (err?.message) {
      msg = err.message;
    }

    showAlertModal({
      title: 'Error al Registrar Pedido',
      message: msg,
      type: 'danger'
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
