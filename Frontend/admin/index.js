/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR PRINCIPAL DEL DASHBOARD (INDEX.JS)
 * ==========================================================================
 * Inicializa el Navbar y Drawer, renderiza las 6 tarjetas KPI, el gráfico Donut
 * interactivo de pedidos por estado y la tabla adaptada de pedidos recientes.
 */

import { loadAdminComponents } from './components/navbar/navbar.js';
import { 
  getIndexKpiMetrics, 
  getOrderStatusDistribution, 
  getRecentOrders 
} from './js/service/index.service.js';

/**
 * Genera el SVG correspondiente al icono solicitado
 * @param {string} iconType Tipo de icono ('cart', 'clock', 'factory', 'credit-card', 'dollar', 'truck')
 * @returns {string} String HTML del SVG
 */
function getIconSvg(iconType) {
  switch (iconType) {
    case 'cart':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      `;
    case 'clock':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      `;
    case 'factory':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 20h20"></path>
          <path d="M5 20V8l5 4V4l6 5v11"></path>
          <path d="M18 14v6"></path>
          <circle cx="18" cy="11" r="1"></circle>
        </svg>
      `;
    case 'credit-card':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
          <line x1="2" y1="10" x2="22" y2="10"></line>
          <line x1="6" y1="15" x2="10" y2="15"></line>
        </svg>
      `;
    case 'dollar':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
          <line x1="12" y1="6" x2="12" y2="18"></line>
        </svg>
      `;
    case 'truck':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13"></rect>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
      `;
    default:
      return '';
  }
}

/**
 * 1. Renderiza las 6 Tarjetas de Métricas KPI en la cuadrícula superior
 * @param {Object} metrics Datos de métricas obtenidos de index.service.js
 */
function renderKpiMetrics(metrics) {
  const container = document.getElementById('kpi-metrics-container');
  if (!container) return;

  const cardOrder = [
    metrics.todayOrders,
    metrics.pendingPayment,
    metrics.inManufacturing,
    metrics.reviewPayment,
    metrics.totalOrdersYear,
    metrics.shippedOrders
  ];

  container.innerHTML = cardOrder.map(card => {
    const iconSvg = getIconSvg(card.iconType);
    const bottomAction = card.trend
      ? `<span class="kpi-trend">${card.trend}</span>`
      : `<a href="${card.actionUrl}" class="kpi-action-link" title="Ver lista filtrada">${card.actionText || 'Ver detalles'}</a>`;

    return `
      <div class="kpi-card" id="kpi-card-${card.id}">
        <div class="kpi-icon-wrapper kpi-icon-${card.colorScheme}">
          ${iconSvg}
        </div>
        <div class="kpi-info">
          <span class="kpi-title" title="${card.title}">${card.title}</span>
          <span class="kpi-value">${card.value}</span>
          ${bottomAction}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 2. Renderiza el Gráfico Donut SVG de Pedidos por Estado y su Leyenda
 * @param {{total: number, items: Array<Object>}} data Datos de distribución
 */
function renderDonutChart(data) {
  const svgEl = document.getElementById('donut-svg-element');
  const legendEl = document.getElementById('donut-legend-container');
  const centerCountEl = document.getElementById('donut-center-count');

  if (!svgEl || !legendEl) return;

  const visibleItems = (data.items || []).filter(item => Number(item.count || 0) > 0);
  const total = visibleItems.reduce((sum, item) => sum + Number(item.count || 0), 0);
  if (centerCountEl) {
    centerCountEl.textContent = total;
  }

  // Dimensiones del círculo SVG (radio 75px -> circunferencia ~471.24px)
  const radius = 75;
  const circumference = 2 * Math.PI * radius; // 471.23889803846896
  let cumulativeOffset = 0;

  // Generar segmentos del Donut SVG
  const segmentsHtml = visibleItems.map((item, index) => {
    const fraction = total > 0 ? item.count / total : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeOffset;
    cumulativeOffset += fraction * circumference;

    return `
      <circle
        class="donut-segment"
        id="donut-segment-${item.id}"
        data-index="${index}"
        data-status-id="${item.id}"
        data-label="${item.label}"
        data-count="${item.count}"
        data-percentage="${item.percentage || (total ? ((item.count / total) * 100).toFixed(1) : 0)}"
        cx="95"
        cy="95"
        r="${radius}"
        stroke="${item.color}"
        stroke-dasharray="${strokeDasharray}"
        stroke-dashoffset="${strokeDashoffset}"
      >
        <title>${item.label}: ${item.count} pedidos (${total ? ((item.count / total) * 100).toFixed(1) : 0}%)</title>
      </circle>
    `;
  }).join('');

  svgEl.innerHTML = segmentsHtml;

  // Generar la Leyenda Interactiva con los 8 estados
  const legendHtml = visibleItems.map((item, index) => `
    <li class="legend-item" id="legend-item-${item.id}" data-status-id="${item.id}" data-index="${index}">
      <div class="legend-item-left">
        <span class="legend-dot" style="background-color: ${item.color};"></span>
        <span class="legend-label" title="${item.label}">${item.label}</span>
      </div>
      <span class="legend-count">${item.count}</span>
    </li>
  `).join('');

  legendEl.innerHTML = legendHtml;

  // Conectar interactividad cruzada Hover entre Leyenda y Donut
  setupDonutInteractivity(visibleItems);
}

/**
 * Conecta eventos hover sincronizados entre el gráfico Donut y la leyenda
 * @param {Array<Object>} items 
 */
function setupDonutInteractivity(items) {
  items.forEach(item => {
    const segment = document.getElementById(`donut-segment-${item.id}`);
    const legendItem = document.getElementById(`legend-item-${item.id}`);

    if (segment && legendItem) {
      // Hover en sector Donut -> Resalta Leyenda
      segment.addEventListener('mouseenter', () => {
        segment.classList.add('is-hovered');
        legendItem.classList.add('is-highlighted');
      });
      segment.addEventListener('mouseleave', () => {
        segment.classList.remove('is-hovered');
        legendItem.classList.remove('is-highlighted');
      });

      // Hover en Leyenda -> Resalta sector Donut
      legendItem.addEventListener('mouseenter', () => {
        legendItem.classList.add('is-highlighted');
        segment.classList.add('is-hovered');
      });
      legendItem.addEventListener('mouseleave', () => {
        legendItem.classList.remove('is-highlighted');
        segment.classList.remove('is-hovered');
      });

      // Clic en la leyenda para filtrar pedidos (preparado para backend)
      legendItem.addEventListener('click', () => {
        window.location.href = `modules/order/orders.html?status=${item.id}`;
      });
    }
  });
}

/**
 * 3. Renderiza la Tabla de Pedidos Recientes
 * @param {Array<Object>} orders Lista de pedidos estructurados
 */
function renderRecentOrdersTable(orders) {
  const tbody = document.getElementById('recent-orders-tbody');
  if (!tbody) return;

  tbody.innerHTML = orders.map(order => `
    <tr id="order-row-${order.id}">
      <td>
        <span class="order-code-text">${order.orderCode}</span>
      </td>
      <td>
        <span class="client-name-text">${order.clientName}</span>
      </td>
      <td>
        <span class="order-total-text">${order.formattedTotal}</span>
      </td>
      <td>
        <span class="status-badge ${order.badgeVariant}">
          ${order.statusLabel}
        </span>
      </td>
      <td>
        <span class="order-date-text">${order.date}</span>
      </td>
      <td class="order-actions-col">
        <button 
          type="button" 
          class="action-menu-btn" 
          aria-label="Acciones para pedido ${order.orderCode}"
          title="Opciones"
          data-order-id="${order.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>

        <!-- Menú Popover Flotante de Acciones -->
        <div class="action-popover" id="action-popover-${order.id}">
          <button type="button" class="action-popover-item btn-view-order" data-order-id="${order.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Ver Detalle</span>
          </button>
          <a href="modules/order/orders.html?id=${order.id}" class="action-popover-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Gestionar Pedido</span>
          </a>
        </div>
      </td>
    </tr>
  `).join('');

  setupTableActions(orders);
}

/**
 * Configura los botones de 3 puntos y el modal de detalle rápido
 * @param {Array<Object>} orders 
 */
function setupTableActions(orders) {
  // Manejar apertura/cierre de popovers de acción
  const actionButtons = document.querySelectorAll('.action-menu-btn');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.getAttribute('data-order-id');
      const targetPopover = document.getElementById(`action-popover-${orderId}`);

      // Cerrar otros popovers abiertos
      document.querySelectorAll('.action-popover.is-active').forEach(pop => {
        if (pop !== targetPopover) pop.classList.remove('is-active');
      });

      if (targetPopover) {
        targetPopover.classList.toggle('is-active');
      }
    });
  });

  // Cerrar popovers al hacer clic afuera
  document.addEventListener('click', () => {
    document.querySelectorAll('.action-popover.is-active').forEach(pop => {
      pop.classList.remove('is-active');
    });
  });

  // Conectar botones "Ver Detalle" con el Modal
  const viewButtons = document.querySelectorAll('.btn-view-order');
  viewButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = parseInt(btn.getAttribute('data-order-id'), 10);
      const order = orders.find(o => o.id === orderId);
      if (order) {
        openQuickViewModal(order);
      }
    });
  });
}

/**
 * Abre el modal de vista rápida de pedido
 * @param {Object} order 
 */
function openQuickViewModal(order) {
  const modalBackdrop = document.getElementById('quick-view-modal-backdrop');
  if (!modalBackdrop) return;

  document.getElementById('modal-order-title').textContent = `Detalle del Pedido ${order.orderCode}`;
  document.getElementById('modal-order-code').textContent = order.orderCode;
  document.getElementById('modal-client-name').textContent = order.clientName;
  document.getElementById('modal-client-email').textContent = order.clientEmail || 'N/A';
  document.getElementById('modal-order-total').textContent = order.formattedTotal;
  document.getElementById('modal-order-status').textContent = order.statusLabel;
  document.getElementById('modal-order-date').textContent = order.date;

  const manageLink = document.getElementById('modal-manage-order-link');
  if (manageLink) {
    manageLink.href = `modules/order/orders.html?id=${order.id}`;
  }

  modalBackdrop.classList.add('is-open');
}

/**
 * Configura el cierre del modal de vista rápida
 */
function setupModalClose() {
  const modalBackdrop = document.getElementById('quick-view-modal-backdrop');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');

  if (!modalBackdrop) return;

  const closeModal = () => modalBackdrop.classList.remove('is-open');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('is-open')) {
      closeModal();
    }
  });
}

/**
 * ==========================================================================
 * INICIALIZACIÓN GENERAL DEL DASHBOARD
 * ==========================================================================
 */
async function initDashboard() {
  try {
    // 1. Cargar componentes (Navbar + Drawer + Footer)
    const navbar = await loadAdminComponents({ title: 'Dashboard' });
    window.TuEstanteNavbar = navbar;

    // 2. Cargar datos en paralelo desde el servicio centralizado
    const [metrics, distribution, recentOrders] = await Promise.all([
      getIndexKpiMetrics(),
      getOrderStatusDistribution(),
      getRecentOrders(5)
    ]);

    // 3. Renderizar componentes visuales
    renderKpiMetrics(metrics);
    renderDonutChart(distribution);
    renderRecentOrdersTable(recentOrders);

    // 4. Configurar eventos de modal
    setupModalClose();

    console.log('%c[TuEstante Admin] Dashboard principal cargado con éxito y paleta corporativa aplicada.', 'background: #005187; color: #fcffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  } catch (error) {
    console.error('[TuEstante Admin] Error al inicializar el Dashboard:', error);
  }
}

// Ejecución al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
