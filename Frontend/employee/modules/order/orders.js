/**
 * ==========================================================================
 * TUESTANTE - CONTROLADOR HISTORIAL DE PEDIDOS Y COMPROBANTES
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { obtenerMisOrdenes, obtenerOrdenPorId } from './order.api.js';

async function loadComponent(placeholderId, filePath) {
  try {
    const res = await fetch(`${filePath}?_t=${Date.now()}`);
    if (res.ok) {
      document.getElementById(placeholderId).innerHTML = await res.text();
    }
  } catch (err) {
    console.error(`Error cargando componente ${filePath}:`, err);
  }
}

let allOrders = [];

/**
 * Carga el historial de órdenes del colaborador
 */
async function loadOrders() {
  const tbody = document.getElementById('orders-table-tbody');
  const emptyState = document.getElementById('orders-empty-state');
  const tableContainer = document.getElementById('orders-table-container');

  try {
    allOrders = await obtenerMisOrdenes();

    if (!allOrders || allOrders.length === 0) {
      tableContainer.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    tableContainer.style.display = 'block';
    emptyState.style.display = 'none';

    tbody.innerHTML = allOrders.map((order) => {
      const itemsCount = Array.isArray(order.items)
        ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
        : (order.items_count || 1);

      const total = parseFloat(order.total_amount || 0).toFixed(2);
      const dateFormatted = order.created_at ? new Date(order.created_at).toLocaleString('es-VE', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }) : 'Reciente';

      const statusBadge = getEmployeeStatusBadge(order.status);

      return `
        <tr data-order-id="${order.id}">
          <td>
            <span class="order-code-badge">#${order.order_number || order.id}</span>
          </td>
          <td>${dateFormatted}</td>
          <td>${itemsCount} ${itemsCount === 1 ? 'ítem' : 'ítems'}</td>
          <td>
            <strong class="text-primary">$${total}</strong>
          </td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-outline btn-view-order" data-id="${order.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Ver Desglose
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos para abrir modal
    tbody.querySelectorAll('.btn-view-order').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const order = allOrders.find((o) => o.id === id);
        if (order) openOrderDetailModal(order);
      });
    });

    // Si viene de una compra confirmada, buscar la orden y abrir modal
    checkUrlConfirmation();

  } catch (err) {
    console.error('[Orders] Error cargando órdenes:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-danger);">
          No se pudieron cargar tus pedidos. Por favor intenta recargar la página.
        </td>
      </tr>
    `;
  }
}

/**
 * Despliega el modal con desglose de productos y snapshot de precio unitario
 */
function openOrderDetailModal(order) {
  const modal = document.getElementById('order-detail-modal');
  if (!modal) return;

  document.getElementById('modal-order-title').textContent = `Orden #${order.order_number || order.id}`;
  document.getElementById('modal-order-date').textContent = order.created_at
    ? new Date(order.created_at).toLocaleDateString('es-VE', { dateStyle: 'long' })
    : 'N/A';
  document.getElementById('modal-order-employee').textContent = order.employee_name || 'Colaborador';
  document.getElementById('modal-order-code').textContent = order.employee_number || 'N/A';
  document.getElementById('modal-order-total').textContent = `$${parseFloat(order.total_amount || 0).toFixed(2)}`;

  const statusWrap = document.getElementById('modal-order-status');
  if (statusWrap) {
    statusWrap.outerHTML = getEmployeeStatusBadge(order.status).replace('<span ', '<span id="modal-order-status" ');
  }

  const itemsTbody = document.getElementById('modal-order-items-tbody');
  const items = Array.isArray(order.items) ? order.items : [];

  if (items.length === 0) {
    itemsTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--color-text-muted);">
          Sin detalles de ítems registrados.
        </td>
      </tr>
    `;
  } else {
    itemsTbody.innerHTML = items.map((item) => {
      const unitPrice = parseFloat(item.unit_price || 0).toFixed(2);
      const subtotal = parseFloat(item.subtotal || (item.quantity * item.unit_price) || 0).toFixed(2);

      return `
        <tr>
          <td>
            <strong>${item.product_name || 'Artículo'}</strong>
          </td>
          <td style="font-family: monospace; font-size: 0.8rem;">${item.product_barcode || '---'}</td>
          <td>${item.quantity}</td>
          <td>$${unitPrice}</td>
          <td style="text-align: right; font-weight: 700;">$${subtotal}</td>
        </tr>
      `;
    }).join('');
  }

  modal.showModal();
}

/**
 * Configuración de eventos del modal
 */
function setupModal() {
  const modal = document.getElementById('order-detail-modal');
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  const closeBtn = document.getElementById('btn-close-modal');
  const closeActionBtn = document.getElementById('btn-modal-close-action');
  const printBtn = document.getElementById('btn-print-receipt');

  const closeModal = () => modal.close();
  closeBtn?.addEventListener('click', closeModal);
  closeActionBtn?.addEventListener('click', closeModal);

  printBtn?.addEventListener('click', () => {
    window.print();
  });
}

/**
 * Verifica si viene de checkout exitoso
 */
function checkUrlConfirmation() {
  const params = new URLSearchParams(window.location.search);
  const confirmed = params.get('order_confirmed');
  const orderNumber = params.get('order_number');

  if (confirmed === '1') {
    const banner = document.getElementById('order-success-banner');
    const orderNumEl = document.getElementById('confirmed-order-number');
    const closeBannerBtn = document.getElementById('btn-close-success-banner');

    if (banner) {
      if (orderNumEl) orderNumEl.textContent = orderNumber || 'Confirmada';
      banner.style.display = 'flex';
      closeBannerBtn?.addEventListener('click', () => {
        banner.style.display = 'none';
      });
    }

    // Si encontramos la orden específica en la lista, abrir su modal
    if (orderNumber && allOrders.length > 0) {
      const order = allOrders.find((o) => String(o.order_number) === String(orderNumber));
      if (order) {
        openOrderDetailModal(order);
      }
    }
  }
}

// Inicialización de la pantalla
async function initOrdersPage() {
  initNavbar('navbar-placeholder');
  initFooter('footer-placeholder');
  setupModal();

  loadOrders();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrdersPage);
} else {
  initOrdersPage();
}

/**
 * Retorna el badge HTML para los estados de orden del empleado
 */
function getEmployeeStatusBadge(status) {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'UNDELIVERED':
      return '<span class="badge badge-warning">Sin entregar</span>';
    case 'DELIVERED':
    case 'COMPLETED':
      return '<span class="badge badge-info">Entregado</span>';
    case 'PAID':
      return '<span class="badge badge-success">Pagado</span>';
    case 'CANCELLED':
      return '<span class="badge badge-danger">Cancelado</span>';
    default:
      return `<span class="badge badge-primary">${status || 'Desconocido'}</span>`;
  }
}

