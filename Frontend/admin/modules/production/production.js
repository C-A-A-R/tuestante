import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * ==========================================================================
 * CONTROLADOR PRINCIPAL - MÓDULO DE FABRICACIÓN (TALLER) - TUESTANTE
 * Manejo de estado, listado de productos y órdenes, modal de detalles de productos,
 * exportación de órdenes de trabajo y navegación hacia pantalla de detalle.
 * ==========================================================================
 */

import { 
  getProductionOrders, 
  getProductionProducts, 
  getProductionMetrics, 
  getProductionOrder, 
  getProductionBlueprint,
  createProductionOrder,
  getStageConfig,
  getProductImageUrl,
  updateProductionProductStatus,
  bulkUpdateProductionProductsStatus,
  advanceProductionProductStage,
  PRODUCTION_STAGES
} from './production.api.js';
import { getRequest } from '../../js/api.js';

// Estado local de la pantalla
const state = {
  activeView: 'products', // 'products' | 'orders'
  orders: [],
  products: [],
  selectedProductIds: new Set(),
  metrics: null,
  filters: {
    search: '',
    status: 'all',
    date_from: '',
    date_to: ''
  },
  pagination: {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: 0
  },
  activeModalOrder: null,
  pendingExportOrderId: null
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar componentes compartidos (Navbar, Drawer y Footer)
  await loadAdminComponents({ title: 'Fabricación' });

  // 2. Resaltar enlace activo en el Drawer
  highlightDrawerLink();

  // 3. Vincular eventos de la interfaz
  setupViewTabs();
  setupFilters();
  setupModals();
  setupMainBatchControls();

  // 4. Cargar datos iniciales y métricas KPI
  await Promise.all([
    loadProductionMetrics(),
    loadProductionData()
  ]);
});

/**
 * Resalta la pestaña de Fabricación en el Drawer lateral
 */
function highlightDrawerLink() {
  setTimeout(() => {
    document.querySelectorAll('.drawer-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-nav-id') === 'fabricacion') {
        link.classList.add('active');
      }
    });
  }, 200);
}

// ==========================================================================
// ALTERNANCIA ENTRE VISTAS (PRODUCTOS VS ÓRDENES)
// ==========================================================================

function setupViewTabs() {
  const btnProducts = document.getElementById('tab-btn-products');
  const btnOrders = document.getElementById('tab-btn-orders');
  const secProducts = document.getElementById('section-products-view');
  const secOrders = document.getElementById('section-orders-view');

  if (btnProducts) {
    btnProducts.addEventListener('click', () => {
      if (state.activeView === 'products') return;
      state.activeView = 'products';
      state.pagination.currentPage = 1;
      btnProducts.classList.add('active');
      btnOrders?.classList.remove('active');
      secProducts?.classList.add('active-view');
      secOrders?.classList.remove('active-view');
      renderCurrentView();
    });
  }

  if (btnOrders) {
    btnOrders.addEventListener('click', () => {
      if (state.activeView === 'orders') return;
      state.activeView = 'orders';
      state.pagination.currentPage = 1;
      btnOrders.classList.add('active');
      btnProducts?.classList.remove('active');
      secOrders?.classList.add('active-view');
      secProducts?.classList.remove('active-view');
      renderCurrentView();
    });
  }
}

// ==========================================================================
// FILTROS REACTIVOS
// ==========================================================================

function setupFilters() {
  const searchInput = document.getElementById('filter-search');
  const statusSelect = document.getElementById('filter-status');
  const dateFromInput = document.getElementById('filter-date-from');
  const dateToInput = document.getElementById('filter-date-to');
  const clearBtn = document.getElementById('btn-clear-filters');

  let debounceTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        state.filters.search = searchInput.value.trim();
        state.pagination.currentPage = 1;
        loadProductionData();
      }, 300);
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      state.filters.status = statusSelect.value;
      state.pagination.currentPage = 1;
      loadProductionData();
    });
  }

  if (dateFromInput) {
    dateFromInput.addEventListener('change', () => {
      state.filters.date_from = dateFromInput.value;
      state.pagination.currentPage = 1;
      loadProductionData();
    });
  }

  if (dateToInput) {
    dateToInput.addEventListener('change', () => {
      state.filters.date_to = dateToInput.value;
      state.pagination.currentPage = 1;
      loadProductionData();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.filters.search = '';
      state.filters.status = 'all';
      state.filters.date_from = '';
      state.filters.date_to = '';

      if (searchInput) searchInput.value = '';
      if (statusSelect) statusSelect.value = 'all';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';

      state.pagination.currentPage = 1;
      loadProductionData();
    });
  }
}

// ==========================================================================
// CARGA DE DATOS Y MÉTRICAS
// ==========================================================================

async function loadProductionMetrics() {
  try {
    const metrics = await getProductionMetrics();
    state.metrics = metrics || {};

    const elQueued = document.getElementById('kpi-queued');
    const elProgress = document.getElementById('kpi-in-progress');
    const elCompleted = document.getElementById('kpi-completed');
    const elUnits = document.getElementById('kpi-total-units');

    if (elQueued) elQueued.textContent = metrics?.queued ?? 0;
    if (elProgress) elProgress.textContent = metrics?.in_progress_total ?? 0;
    if (elCompleted) elCompleted.textContent = metrics?.completed ?? 0;
    if (elUnits) elUnits.textContent = metrics?.total_units_in_production ?? 0;
  } catch (err) {
    console.error('Error al cargar métricas de fabricación:', err);
  }
}

async function loadProductionData() {
  const prodTbody = document.getElementById('products-table-body') || document.getElementById('tbody-production');
  const ordTbody = document.getElementById('orders-table-body');
  
  if (prodTbody && state.products.length === 0) {
    prodTbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Cargando productos en fabricación...
        </td>
      </tr>
    `;
  }
  if (ordTbody && state.orders.length === 0) {
    ordTbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Cargando órdenes de fabricación...
        </td>
      </tr>
    `;
  }

  try {
    const [orders, products] = await Promise.all([
      getProductionOrders(state.filters),
      getProductionProducts(state.filters)
    ]);

    state.orders = orders || [];
    state.products = products || [];
    renderCurrentView();
  } catch (err) {
    console.error('Error al cargar datos de producción:', err);
    state.orders = [];
    state.products = [];
    renderCurrentView();
  }
}

// ==========================================================================
// RENDERIZADO DE TABLAS
// ==========================================================================

function renderCurrentView() {
  if (state.activeView === 'products') {
    renderProductsTable();
  } else {
    renderOrdersTable();
  }
  renderPagination();
}

/**
 * Renderiza la Tabla 1: Productos en fabricación (Vista a nivel de ítem)
 */
function renderProductsTable() {
  const tbody = document.getElementById('products-table-body') || document.getElementById('tbody-production');
  if (!tbody) return;

  const total = state.products.length;
  state.pagination.totalItems = total;

  const isFiltered = !!(state.filters.search || (state.filters.status && state.filters.status !== 'all') || state.filters.date_from || state.filters.date_to);

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 0; border: none;">
          <div class="production-empty-state">
            <div class="empty-state-icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <h3 class="empty-state-title">${isFiltered ? 'No se encontraron productos' : 'No hay productos en fabricación'}</h3>
            <p class="empty-state-desc">
              ${isFiltered 
                ? 'No existen productos en taller que coincidan con los filtros de búsqueda o fechas seleccionados.' 
                : 'Actualmente no hay artículos en proceso de corte, ensamblaje o acabado. Cuando se apruebe la fabricación de un pedido, aparecerá listado aquí.'}
            </p>
          </div>
        </td>
      </tr>
    `;
    setupEmptyStateListeners();
    return;
  }

  const startIdx = (state.pagination.currentPage - 1) * state.pagination.itemsPerPage;
  const endIdx = startIdx + state.pagination.itemsPerPage;
  const pagedItems = state.products.slice(startIdx, endIdx);

  tbody.innerHTML = pagedItems.map(item => {
    const stage = getStageConfig(item.status);
    const prodOrderId = item.production_order_id || item.order_id || 1;
    const isChecked = state.selectedProductIds.has(item.id);
    const prodNumber = item.product_number || item.sku || `PRD-${item.id}`;

    const dates = item.stage_dates || {};
    const dQueued = item.queued_at || dates.queued;
    const dAssembling = item.assembling_at || dates.assembling;
    const dPainting = item.painting_at || dates.painting;
    const dQuality = item.quality_check_at || dates.quality_check;
    const dCompleted = item.completed_at || dates.completed;

    return `
      <tr>
        <!-- Checkbox de Selección -->
        <td style="text-align: center;">
          <input type="checkbox" class="main-product-check product-select-check" data-id="${item.id}" ${isChecked ? 'checked' : ''} title="Seleccionar para lote">
        </td>

        <!-- Número de Producto -->
        <td>
          <span class="product-number-badge">🏷️ ${escapeHtml(prodNumber)}</span>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
            Unidad ${item.unit_index || 1}
          </div>
        </td>

        <!-- Producto -->
        <td>
          <div class="product-cell-meta">
            <img 
              src="${escapeHtml(getProductImageUrl(item.image))}" 
              alt="${escapeHtml(item.product_name)}" 
              class="product-cell-thumb" 
              onerror="this.src='../../assets/images/logo.jpeg'">
            <div class="product-cell-text">
              <span class="product-cell-name" title="${escapeHtml(item.product_name)}">
                ${escapeHtml(item.product_name)}
              </span>
            </div>
          </div>
        </td>

        <!-- Pedido Vinculado -->
        <td>
          <a href="../order/order-detail.html?id=${item.order_id}" class="order-link-badge" title="Ver pedido completo">
            ${escapeHtml(item.order_number)}
          </a>
        </td>

        <!-- Cliente -->
        <td>
          <span class="client-name-text">${escapeHtml(item.client_name)}</span>
        </td>

        <!-- Estado de Fabricación -->
        <td>
          <span class="status-stage-badge ${stage.badgeClass}">
            <span class="stage-dot"></span>
            <span>${stage.label}</span>
          </span>
        </td>

        <!-- Fechas por Fase de Fabricación -->
        <td>
          <div style="display: flex; flex-direction: column; gap: 2px; font-size: 0.74rem; color: #475569;">
            ${dQueued ? `<span><strong>Cola:</strong> ${formatDate(dQueued)}</span>` : ''}
            ${dAssembling ? `<span><strong>Corte:</strong> ${formatDate(dAssembling)}</span>` : ''}
            ${dPainting ? `<span><strong>Pintura:</strong> ${formatDate(dPainting)}</span>` : ''}
            ${dQuality ? `<span><strong>Calidad:</strong> ${formatDate(dQuality)}</span>` : ''}
            ${dCompleted ? `<span style="color:#16a34a; font-weight:700;"><strong>Fin:</strong> ${formatDate(dCompleted)}</span>` : ''}
            ${!dQueued && !dAssembling && !dPainting && !dQuality && !dCompleted ? '<span style="color:#94a3b8;">En espera</span>' : ''}
          </div>
        </td>

        <!-- Acciones con Cambio Rápido de Fase y Ver Detalle -->
        <td style="text-align: center;">
          <div class="table-actions-cell" style="gap: 6px;">
            <select class="select-main-product-stage" data-id="${item.id}" title="Cambiar fase de este producto" style="font-size: 0.76rem; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); background: #ffffff;">
              <option value="queued" ${item.status === 'queued' ? 'selected' : ''}>Cola</option>
              <option value="assembling" ${item.status === 'assembling' ? 'selected' : ''}>Corte/Ensamble</option>
              <option value="painting" ${item.status === 'painting' ? 'selected' : ''}>Pintura</option>
              <option value="quality_check" ${item.status === 'quality_check' ? 'selected' : ''}>Calidad</option>
              <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completado</option>
            </select>
            <button 
              type="button" 
              class="btn-action-icon btn-advance-main-product" 
              data-id="${item.id}" 
              ${item.status === 'completed' ? 'disabled' : ''}
              title="Avanzar a siguiente fase" 
              aria-label="Avanzar etapa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
              </svg>
            </button>
            <a 
              href="production-detail.html?id=${prodOrderId}" 
              class="btn-action-icon" 
              title="Ver orden en taller" 
              aria-label="Ver orden en taller">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindMainProductEvents(tbody);
}

/**
 * Vincula los eventos interactivos de la tabla principal de productos
 */
function bindMainProductEvents(tbody) {
  // Checkboxes de producto
  tbody.querySelectorAll('.main-product-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = parseInt(e.target.getAttribute('data-id'), 10);
      if (e.target.checked) {
        state.selectedProductIds.add(id);
      } else {
        state.selectedProductIds.delete(id);
      }
      updateMainBatchBar();
    });
  });

  // Select de cambio rápido de estado
  tbody.querySelectorAll('.select-main-product-stage').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = parseInt(e.target.getAttribute('data-id'), 10);
      const newStatus = e.target.value;
      try {
        await updateProductionProductStatus(id, newStatus);
        showToast('success', 'Fase Actualizada', 'El estado del producto se actualizó con éxito.');
        await loadProductionData();
        await loadProductionMetrics();
      } catch (err) {
        showToast('error', 'Error', err.message);
      }
    });
  });

  // Botón de avance rápido de etapa
  tbody.querySelectorAll('.btn-advance-main-product').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      try {
        await advanceProductionProductStage(id);
        showToast('success', 'Fase Avanzada', 'El producto avanzó a su siguiente fase.');
        await loadProductionData();
        await loadProductionMetrics();
      } catch (err) {
        showToast('error', 'Error al avanzar', err.message);
      }
    });
  });

  updateMainBatchBar();
}

/**
 * Actualiza la barra flotante de lote en la vista principal
 */
function updateMainBatchBar() {
  const batchBar = document.getElementById('main-batch-bar');
  const countBadge = document.getElementById('main-batch-count');
  const headerCheck = document.getElementById('check-all-main-products');

  const count = state.selectedProductIds.size;
  if (countBadge) countBadge.textContent = count;
  if (batchBar) batchBar.style.display = count > 0 ? 'flex' : 'none';

  if (headerCheck) {
    const currentPageIds = state.products.slice(
      (state.pagination.currentPage - 1) * state.pagination.itemsPerPage,
      state.pagination.currentPage * state.pagination.itemsPerPage
    ).map(p => p.id);

    headerCheck.checked = currentPageIds.length > 0 && currentPageIds.every(id => state.selectedProductIds.has(id));
  }
}

/**
 * Configura los eventos de acciones por lote de la vista principal
 */
function setupMainBatchControls() {
  const headerCheck = document.getElementById('check-all-main-products');
  if (headerCheck) {
    headerCheck.addEventListener('change', (e) => {
      const currentPageItems = state.products.slice(
        (state.pagination.currentPage - 1) * state.pagination.itemsPerPage,
        state.pagination.currentPage * state.pagination.itemsPerPage
      );
      if (e.target.checked) {
        currentPageItems.forEach(p => state.selectedProductIds.add(p.id));
      } else {
        currentPageItems.forEach(p => state.selectedProductIds.delete(p.id));
      }
      renderProductsTable();
    });
  }

  const btnApply = document.getElementById('btn-main-apply-batch');
  if (btnApply) {
    btnApply.addEventListener('click', async () => {
      const selectStage = document.getElementById('main-batch-select-stage');
      const targetStatus = selectStage?.value;

      if (!targetStatus) {
        showToast('warning', 'Seleccione una fase', 'Debe elegir la fase a aplicar al lote seleccionado.');
        return;
      }

      if (state.selectedProductIds.size === 0) {
        showToast('warning', 'Sin productos', 'Seleccione al menos un producto.');
        return;
      }

      try {
        const ids = Array.from(state.selectedProductIds);
        await bulkUpdateProductionProductsStatus({
          productIds: ids,
          status: targetStatus,
          notes: `Actualización en lote a '${getStageConfig(targetStatus).label}'`
        });

        showToast('success', 'Lote Actualizado', `Se actualizaron ${ids.length} producto(s) a '${getStageConfig(targetStatus).label}'.`);
        state.selectedProductIds.clear();
        await loadProductionData();
        await loadProductionMetrics();
      } catch (err) {
        showToast('error', 'Error por lote', err.message);
      }
    });
  }

  const btnCancel = document.getElementById('btn-main-cancel-batch');
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      state.selectedProductIds.clear();
      renderProductsTable();
    });
  }
}


/**
 * Renderiza la Tabla 2: Órdenes de fabricación (Con botón interactivo de productos)
 */
function renderOrdersTable() {
  const tbody = document.getElementById('orders-table-body') || document.getElementById('tbody-production');
  if (!tbody) return;

  const total = state.orders.length;
  state.pagination.totalItems = total;

  const isFiltered = !!(state.filters.search || (state.filters.status && state.filters.status !== 'all') || state.filters.date_from || state.filters.date_to);

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 0; border: none;">
          <div class="production-empty-state">
            <div class="empty-state-icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <h3 class="empty-state-title">${isFiltered ? 'No se encontraron órdenes' : 'No hay órdenes de fabricación registradas'}</h3>
            <p class="empty-state-desc">
              ${isFiltered 
                ? 'No existen órdenes de trabajo en taller que coincidan con los criterios de búsqueda actuales.' 
                : 'El registro de órdenes de fabricación se encuentra vacío en este momento. Puedes emitir una nueva orden vinculando un pedido de cliente.'}
            </p>
            <div class="empty-state-actions">
              ${isFiltered 
                ? '<button type="button" class="btn btn-outline" id="btn-empty-clear-filters-ord">Limpiar Filtros</button>' 
                : '<button type="button" class="btn btn-primary" id="btn-empty-new-order-ord"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>Crear Nueva Orden de Fabricación</span></button>'
              }
            </div>
          </div>
        </td>
      </tr>
    `;
    setupEmptyStateListeners();
    return;
  }

  const startIdx = (state.pagination.currentPage - 1) * state.pagination.itemsPerPage;
  const endIdx = startIdx + state.pagination.itemsPerPage;
  const pagedOrders = state.orders.slice(startIdx, endIdx);

  tbody.innerHTML = pagedOrders.map(order => {
    const stage = getStageConfig(order.status);
    const createdDate = formatDate(order.created_at || order.start_date);
    const estDate = formatDate(order.estimated_completion_date);
    const prodCount = (order.items || []).length;

    return `
      <!-- Fila Principal de la Orden -->
      <tr class="order-row-main" data-row-order-id="${order.id}">
        <!-- Orden de Fabricación -->
        <td>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="production-code-badge">${escapeHtml(order.production_code)}</span>
            ${order.iteration > 1 ? `<span class="iteration-pill" title="Orden de refabricación">Iteración #${order.iteration}</span>` : ''}
            ${(order.blueprint_svg || order.technical_design) ? `<span class="blueprint-mini-tag" title="Plano técnico acotado en mm disponible">📐 Plano</span>` : ''}
          </div>
        </td>

        <!-- Pedido Vinculado -->
        <td>
          <a href="../order/order-detail.html?id=${order.order_id}" class="order-link-badge" title="Ver pedido completo" onclick="event.stopPropagation();">
            ${escapeHtml(order.order_number)}
          </a>
        </td>

        <!-- Cliente -->
        <td>
          <span class="client-name-text">${escapeHtml(order.client_name)}</span>
        </td>

        <!-- Estado -->
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
            <span class="status-stage-badge ${stage.badgeClass}">
              <span class="stage-dot"></span>
              <span>${stage.label}</span>
            </span>
            ${order.order_status && ['delivered', 'completed', 'shipped'].includes(order.order_status) ? `
              <span class="delivery-status-tag ${order.order_status === 'shipped' ? 'tag-shipped' : 'tag-delivered'}" title="Estado del pedido: ${escapeHtml(order.order_status)}">
                ✓ ${order.order_status === 'shipped' ? 'Enviado' : 'Entregado'}
              </span>
            ` : ''}
          </div>
        </td>

        <!-- Campo de Productos con Botón a Modal (Solo cantidad de productos) -->
        <td>
          <button 
            type="button" 
            class="btn-view-production-products" 
            data-order-id="${order.id}" 
            title="Ver productos de esta orden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>${prodCount} ${prodCount === 1 ? 'producto' : 'productos'}</span>
          </button>
        </td>

        <!-- Fecha Creación -->
        <td>
          <span class="date-cell-text">${createdDate}</span>
        </td>

        <!-- Fecha Estimada -->
        <td>
          <span class="date-cell-text">${estDate}</span>
        </td>

        <!-- Acciones con Exportar y Detalle -->
        <td style="text-align: center;">
          <div class="table-actions-cell" onclick="event.stopPropagation();">
            <!-- 1. Ver detalle de fabricación (Ojo) -->
            <a 
              href="production-detail.html?id=${order.id}" 
              class="btn-action-icon" 
              title="Ver detalle de fabricación" 
              aria-label="Ver detalle de fabricación">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </a>
            <!-- 2. Ver detalle del pedido (Enlace exterior) -->
            <a 
              href="../order/order-detail.html?id=${order.order_id}" 
              class="btn-action-icon" 
              title="Ver detalle del pedido" 
              aria-label="Ver detalle pedido">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
            <!-- 3. Exportar / Imprimir orden de fabricación (Impresora) -->
            <button 
              type="button" 
              class="btn-action-icon btn-action-export" 
              data-order-id="${order.id}" 
              title="Exportar / Imprimir Orden de Fabricación" 
              aria-label="Exportar orden">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Vincular clics a los botones de modal de productos
  tbody.querySelectorAll('.btn-view-production-products').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = parseInt(btn.getAttribute('data-order-id'), 10);
      openProductionProductsModal(orderId);
    });
  });

  // Vincular eventos de exportación (Abre modal de selección de formato)
  tbody.querySelectorAll('.btn-action-export').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pId = parseInt(btn.getAttribute('data-order-id'), 10);
      openExportFormatModal(pId);
    });
  });
}

// ==========================================================================
// PAGINACIÓN TRUNCADA INTELIGENTE
// ==========================================================================

/**
 * Calcula el rango de páginas a mostrar con elipsis (...)
 * para evitar desbordar la pantalla cuando existen muchas páginas.
 * Garantiza mostrar siempre los primeros números, el rango de la página actual,
 * y los últimos números.
 */
function getPaginationRange(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pagesSet = new Set();
  pagesSet.add(1);
  pagesSet.add(totalPages);

  if (current <= 4) {
    // Cerca del inicio: mostrar los primeros 5 y los últimos 2
    for (let i = 1; i <= Math.min(5, totalPages); i++) {
      pagesSet.add(i);
    }
    pagesSet.add(totalPages - 1);
    pagesSet.add(totalPages);
  } else if (current >= totalPages - 3) {
    // Cerca del final: mostrar los primeros 2 y los últimos 5
    pagesSet.add(1);
    pagesSet.add(2);
    for (let i = Math.max(1, totalPages - 4); i <= totalPages; i++) {
      pagesSet.add(i);
    }
  } else {
    // En el centro: mostrar los primeros 2, la página actual con +-1, y los últimos 2
    pagesSet.add(1);
    pagesSet.add(2);
    pagesSet.add(current - 1);
    pagesSet.add(current);
    pagesSet.add(current + 1);
    pagesSet.add(totalPages - 1);
    pagesSet.add(totalPages);
  }

  const sorted = Array.from(pagesSet).sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1) {
      const diff = sorted[i + 1] - sorted[i];
      if (diff === 2) {
        // Si solo falta un número para completar el salto, es más claro mostrar el número en vez de '...'
        result.push(sorted[i] + 1);
      } else if (diff > 2) {
        result.push('...');
      }
    }
  }

  return result;
}

function renderPagination() {
  const infoEl = document.getElementById('pagination-info');
  const controlsEl = document.getElementById('pagination-controls');
  if (!infoEl || !controlsEl) return;

  const total = state.pagination.totalItems;
  const itemsPerPage = state.pagination.itemsPerPage;
  const totalPages = Math.ceil(total / itemsPerPage) || 1;
  const current = state.pagination.currentPage;

  const start = total === 0 ? 0 : (current - 1) * itemsPerPage + 1;
  const end = Math.min(current * itemsPerPage, total);

  infoEl.innerHTML = `Mostrando <strong>${start}</strong> a <strong>${end}</strong> de <strong>${total}</strong> elementos`;

  let buttonsHtml = `
    <button type="button" class="btn-pag btn-pag-prev" id="btn-pag-prev" ${current <= 1 ? 'disabled' : ''} aria-label="Página anterior" title="Página anterior">
      &lt; Anterior
    </button>
  `;

  const pageRange = getPaginationRange(current, totalPages);

  for (const pageItem of pageRange) {
    if (pageItem === '...') {
      buttonsHtml += `<span class="pagination-ellipsis" aria-hidden="true">&hellip;</span>`;
    } else {
      buttonsHtml += `
        <button type="button" class="btn-pag ${pageItem === current ? 'active' : ''}" data-page="${pageItem}" aria-label="Página ${pageItem}">
          ${pageItem}
        </button>
      `;
    }
  }

  buttonsHtml += `
    <button type="button" class="btn-pag btn-pag-next" id="btn-pag-next" ${current >= totalPages ? 'disabled' : ''} aria-label="Página siguiente" title="Página siguiente">
      Siguiente &gt;
    </button>
  `;

  controlsEl.innerHTML = buttonsHtml;

  // Eventos de paginación
  controlsEl.querySelectorAll('.btn-pag[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pagination.currentPage = parseInt(btn.getAttribute('data-page'), 10);
      renderCurrentView();
    });
  });

  const prevBtn = document.getElementById('btn-pag-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage--;
        renderCurrentView();
      }
    });
  }

  const nextBtn = document.getElementById('btn-pag-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.pagination.currentPage < totalPages) {
        state.pagination.currentPage++;
        renderCurrentView();
      }
    });
  }
}

// ==========================================================================
// MODAL DE DETALLES DE PRODUCTOS
// ==========================================================================

async function openProductionProductsModal(orderId) {
  const modal = document.getElementById('production-products-modal-backdrop');
  if (!modal) return;

  try {
    const order = await getProductionOrder(orderId);
    state.activeModalOrder = order;

    const stage = getStageConfig(order.status);
    const estDateFormatted = formatDate(order.estimated_completion_date);

    // Título y Subtítulo
    const titleEl = document.getElementById('modal-prod-title');
    const subtitleEl = document.getElementById('modal-prod-subtitle');
    const clientEl = document.getElementById('modal-prod-client');
    const badgeEl = document.getElementById('modal-prod-status-badge');
    const dateEl = document.getElementById('modal-prod-est-date');
    const notesContainer = document.getElementById('modal-prod-notes-container');
    const notesText = document.getElementById('modal-prod-notes-text');
    const tbody = document.getElementById('modal-prod-tbody');
    const goDetailBtn = document.getElementById('btn-modal-go-detail');

    if (titleEl) titleEl.textContent = `Productos de la Orden ${order.production_code}`;
    if (subtitleEl) subtitleEl.textContent = `Orden: ${order.production_code} • Pedido ${order.order_number}`;
    if (clientEl) clientEl.textContent = order.client_name || 'Cliente Registrado';
    
    if (badgeEl) {
      badgeEl.className = `status-stage-badge ${stage.badgeClass}`;
      badgeEl.textContent = stage.label;
    }

    if (dateEl) dateEl.textContent = estDateFormatted;

    if (notesContainer && notesText) {
      if (order.technical_notes) {
        notesContainer.style.display = 'flex';
        notesText.textContent = order.technical_notes;
      } else {
        notesContainer.style.display = 'none';
      }
    }

    if (goDetailBtn) {
      goDetailBtn.href = `production-detail.html?id=${order.id}`;
    }

    // Renderizar productos
    if (tbody) {
      const items = order.items || [];
      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted); padding: 20px;">No hay productos asignados a esta orden.</td></tr>`;
      } else {
        tbody.innerHTML = items.map(p => `
          <tr>
            <td>
              <div class="product-cell-meta">
                <img 
                  src="${escapeHtml(getProductImageUrl(p.image))}" 
                  alt="${escapeHtml(p.product_name)}" 
                  class="product-cell-thumb" 
                  style="width: 38px; height: 38px;" 
                  onerror="this.src='../../assets/images/logo.jpeg'">
                <div>
                  <strong style="display: block; font-size: 0.86rem; color: var(--text-main);">${escapeHtml(p.product_name)}</strong>
                </div>
              </div>
            </td>
            <td style="text-align: center;">
              <span class="qty-pill">${p.quantity}</span>
            </td>
          </tr>
        `).join('');
      }
    }

    modal.classList.add('is-open');
  } catch (err) {
    showToast('error', 'Error al abrir orden', err.message);
  }
}

function closeProductionProductsModal() {
  const modal = document.getElementById('production-products-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  state.activeModalOrder = null;
}

// ==========================================================================
// MODAL DE SELECCIÓN DE FORMATO (CON DISEÑO VS SOLO TEXTO)
// ==========================================================================

export function openExportFormatModal(orderId) {
  state.pendingExportOrderId = orderId;
  const modal = document.getElementById('modal-export-options-backdrop');
  if (modal) {
    modal.classList.add('is-open');
  } else {
    // Fallback directo con diseño
    exportProductionWorksheet(orderId, 'with_design');
  }
}

export function closeExportFormatModal() {
  state.pendingExportOrderId = null;
  const modal = document.getElementById('modal-export-options-backdrop');
  if (modal) modal.classList.remove('is-open');
}

// ==========================================================================
// EXPORTAR / IMPRIMIR ORDEN DE FABRICACIÓN (HOJA DE TRABAJO TALLER)
// ==========================================================================

export async function exportProductionWorksheet(orderId, mode = 'with_design') {
  try {
    const order = await getProductionOrder(orderId);
    if (!order) throw new Error('No se encontró la orden de fabricación solicitada.');

    // Si no trae blueprint_svg, intentar consultar el endpoint de blueprint
    if (!order.blueprint_svg && mode === 'with_design') {
      try {
        const bpData = await getProductionBlueprint(orderId);
        if (bpData && bpData.blueprint_svg) {
          order.blueprint_svg = bpData.blueprint_svg;
          if (bpData.technical_design) order.technical_design = bpData.technical_design;
        }
      } catch (e) {
        // Fallback silencioso
      }
    }

    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) {
      showToast('info', 'Permitir Ventanas Emergentes', 'Por favor permite ventanas emergentes para generar e imprimir la orden de fabricación.');
      return;
    }

    const design = order.technical_design;
    const dims = design?.dimensions_mm || { height: 1800, width: 900, depth: 400 };
    const grid = design?.grid || { rows: 3, columns: 1 };
    const color = design?.main_color || '#005187';

    const isMulti = Boolean(design?.is_multi_product && Array.isArray(design.items) && design.items.length > 1);

    let blueprintSectionHtml = '';
    if (isMulti) {
      if (mode === 'text_only') {
        // DOSSIER TÉCNICO MULTI-PRODUCTO EN SOLO TEXTO
        blueprintSectionHtml = `
          <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #005187; padding-bottom: 6px;">
              <h4 style="font-size: 13px; text-transform: uppercase; color: #005187; font-weight: 800; letter-spacing: 0.5px;">
                📋 Especificación Técnica de Fabricación (${design.items.length} Modelos Distintos - Solo Texto)
              </h4>
              <span style="font-size: 11px; background: #f1f5f9; color: #334155; padding: 3px 8px; border-radius: 4px; font-weight: 700; border: 1px solid #cbd5e1;">
                Tolerancia: ±1.5 mm | Norma ISO
              </span>
            </div>
            ${design.items.map((item, idx) => {
              const itDesign = item.technical_design || {};
              const itDims = itDesign.dimensions_total_mm || itDesign.dimensions_mm || { height: 1800, width: 900, depth: 400 };
              const itGrid = itDesign.grid || { rows: 1, columns: 1 };
              const itColor = itDesign.main_color || '#334155';
              const itArchetype = (itDesign.archetype || 'caja_cerrada').toUpperCase();
              const comps = itDesign.compartments || [];
              const hasDoors = comps.length > 0 ? comps.some(c => c.has_door) : true;
              const hasVent = comps.length > 0 ? comps.some(c => c.has_ventilation) : true;
              const handleType = comps[0]?.handle_type || 'Tirador con cerradura';

              return `
                <div style="margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
                  <div style="background: #0f172a; color: #ffffff; padding: 9px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="font-weight: 800; font-size: 12px; letter-spacing: 0.5px;">
                      [MODELO ${idx + 1} DE ${design.items.length}] ${escapeHtml(item.product_name.toUpperCase())}
                    </div>
                    <div style="background: #0284c7; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                      CANTIDAD: ${item.quantity} UDS.
                    </div>
                  </div>
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 12px;">
                    <tbody>
                      <tr style="background: #f8fafc;">
                        <td style="width: 25%; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Dimensiones:</td>
                        <td style="width: 25%; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;"><strong>Alto:</strong> ${itDims.height || 1800} mm &nbsp;|&nbsp; <strong>Ancho:</strong> ${itDims.width || 900} mm &nbsp;|&nbsp; <strong>Fondo:</strong> ${itDims.max_depth || itDims.depth || 400} mm</td>
                        <td style="width: 25%; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Distribución:</td>
                        <td style="width: 25%; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">${itGrid.rows || 1} Filas × ${itGrid.columns || 1} Columnas (${(itGrid.rows || 1) * (itGrid.columns || 1)} Casillas)</td>
                      </tr>
                      <tr>
                        <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Arquetipo:</td>
                        <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">${itArchetype}</td>
                        <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Acabado Pintura:</td>
                        <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">
                          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background: ${escapeHtml(itColor)}; vertical-align: middle; margin-right: 4px; border: 1px solid #94a3b8;"></span>
                          <strong>${escapeHtml(itColor)}</strong>
                        </td>
                      </tr>
                      <tr style="background: #f8fafc;">
                        <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Puertas y Ventilación:</td>
                        <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Puertas: ${hasDoors ? 'Sí (bisel 3D)' : 'Sin puerta'} &nbsp;|&nbsp; Ventilación: ${hasVent ? 'Troquelada' : 'Sin ranuras'}</td>
                        <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Herrajes:</td>
                        <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">${escapeHtml(handleType)}</td>
                      </tr>
                      ${item.notes ? `
                      <tr>
                        <td style="font-weight: 700; color: #92400e; background: #fffbeb; padding: 8px 12px;" colspan="4">
                          <strong>Notas Técnicas del Producto:</strong> ${escapeHtml(item.notes)}
                        </td>
                      </tr>` : ''}
                    </tbody>
                  </table>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        // DOSSIER CON DISEÑO VECTORIAL (SVG)
        blueprintSectionHtml = `
          <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #005187; padding-bottom: 6px;">
              <h4 style="font-size: 13px; text-transform: uppercase; color: #005187; font-weight: 800; letter-spacing: 0.5px;">
                📐 Dossier Técnico de Fabricación Multi-Producto (${design.items.length} Modelos Distintos)
              </h4>
              <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: 700; border: 1px solid #bae6fd;">
                Tolerancia: ±1.5 mm | Norma ISO
              </span>
            </div>
            ${design.items.map((item, idx) => {
              const itDesign = item.technical_design || {};
              const itDims = itDesign.dimensions_total_mm || itDesign.dimensions_mm || { height: 1800, width: 900, depth: 400 };
              const itGrid = itDesign.grid || { rows: 1, columns: 1 };
              const itColor = itDesign.main_color || '#334155';
              const itSvg = item.blueprint_svg || '';

              return `
                <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
                  <div style="background: #f1f5f9; padding: 8px 14px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="font-weight: 800; font-size: 12px; color: #0f172a;">
                      [MODELO ${idx + 1} DE ${design.items.length}] ${escapeHtml(item.product_name.toUpperCase())}
                    </div>
                    <div style="background: #0284c7; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                      CANTIDAD: ${item.quantity} UDS.
                    </div>
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 14px; background: #f8fafc; padding: 8px 14px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">
                    <span><strong>Alto:</strong> ${itDims.height || 1800} mm</span>
                    <span style="color: #cbd5e1;">|</span>
                    <span><strong>Ancho:</strong> ${itDims.width || 900} mm</span>
                    <span style="color: #cbd5e1;">|</span>
                    <span><strong>Fondo:</strong> ${itDims.max_depth || itDims.depth || 400} mm</span>
                    <span style="color: #cbd5e1;">|</span>
                    <span><strong>Distribución:</strong> ${itGrid.rows || 1}F × ${itGrid.columns || 1}C</span>
                    <span style="color: #cbd5e1;">|</span>
                    <span><strong>Color:</strong> ${escapeHtml(itColor)}</span>
                  </div>
                  ${(item.notes || itDesign.original_notes || item.customization_summary) ? `
                    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 8px 14px; font-size: 11px; color: #92400e; border-bottom: 1px solid #fef3c7;">
                      <strong>📝 Especificaciones / Notas de Fabricación:</strong> ${escapeHtml(item.notes || itDesign.original_notes)}
                      ${item.customization_summary ? `<div style="font-size: 10px; color: #b45309; margin-top: 3px;"><em>⚙️ ${escapeHtml(item.customization_summary)}</em></div>` : ''}
                    </div>
                  ` : ''}
                  ${itSvg ? `
                    <div style="background: #0b1120; padding: 12px; text-align: center;">
                      <div style="max-height: 440px; display: flex; justify-content: center; align-items: center;">
                        ${itSvg}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    } else {
      if (mode === 'text_only') {
        // FICHA TÉCNICA PRODUCTO ÚNICO EN SOLO TEXTO
        const archetype = (design?.archetype || 'caja_cerrada').toUpperCase();
        blueprintSectionHtml = `
          <div style="margin-bottom: 24px; border: 1.5px solid #005187; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
            <div style="background: #005187; color: #ffffff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="font-weight: 800; font-size: 13px; letter-spacing: 0.5px;">
                📋 ESPECIFICACIONES TÉCNICAS Y DIMENSIONALES DE FABRICACIÓN (SOLO TEXTO)
              </div>
              <div style="background: #ffffff; color: #005187; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">
                Tolerancia: ±1.5 mm | Norma ISO
              </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 12px;">
              <tbody>
                <tr style="background: #f8fafc;">
                  <td style="width: 25%; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Dimensiones Exteriores:</td>
                  <td style="width: 25%; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;"><strong>Alto:</strong> ${dims.height || 1800} mm &nbsp;|&nbsp; <strong>Ancho:</strong> ${dims.width || 900} mm &nbsp;|&nbsp; <strong>Fondo:</strong> ${dims.depth || 400} mm</td>
                  <td style="width: 25%; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Distribución Modular:</td>
                  <td style="width: 25%; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">${grid.rows || 1} Filas × ${grid.columns || 1} Columnas (${(grid.rows || 1) * (grid.columns || 1)} Casillas)</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Arquetipo Constructivo:</td>
                  <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">${escapeHtml(archetype)}</td>
                  <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Acabado Pintura:</td>
                  <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background: ${escapeHtml(color)}; vertical-align: middle; margin-right: 4px; border: 1px solid #94a3b8;"></span>
                    <strong>${escapeHtml(color)}</strong> (Pintura Electrostática)
                  </td>
                </tr>
                <tr style="background: #f8fafc;">
                  <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Detalle de Puertas:</td>
                  <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">${(design?.archetype === 'estante_abierto') ? 'Sin puertas (Estructura abierta)' : 'Puertas metálicas con bisel 3D perimetral'}</td>
                  <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Ventilación y Cerradura:</td>
                  <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Ranuras troqueladas (louvers) &nbsp;|&nbsp; Placa empotrada con bombín</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      } else if (order.blueprint_svg) {
        // PRODUCTO ÚNICO CON DISEÑO VECTORIAL (SVG)
        blueprintSectionHtml = `
          <div style="margin-bottom: 24px; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1.5px solid #005187; padding-bottom: 6px;">
              <h4 style="font-size: 13px; text-transform: uppercase; color: #005187; font-weight: 800; letter-spacing: 0.5px;">
                📐 Especificaciones Paramétricas y Plano Vectorial de Taller (Cotas en mm)
              </h4>
              <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: 700; border: 1px solid #bae6fd;">
                Tolerancia: ±1.5 mm
              </span>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 14px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
              <span><strong>Alto:</strong> ${dims.height || 1800} mm</span>
              <span style="color: #cbd5e1;">|</span>
              <span><strong>Ancho:</strong> ${dims.width || 900} mm</span>
              <span style="color: #cbd5e1;">|</span>
              <span><strong>Fondo:</strong> ${dims.depth || 400} mm</span>
              <span style="color: #cbd5e1;">|</span>
              <span><strong>Distribución:</strong> ${grid.rows || 1} Filas × ${grid.columns || 1} Columnas</span>
              <span style="color: #cbd5e1;">|</span>
              <span><strong>Color / Acabado:</strong> ${escapeHtml(color)}</span>
            </div>

            ${(order.items?.[0]?.notes || design?.original_notes) ? `
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; font-size: 12px; color: #92400e; border-radius: 4px; margin-bottom: 12px; border: 1px solid #fde68a;">
                <strong>📝 Especificaciones / Notas de Fabricación del Producto:</strong>
                <div style="margin-top: 3px;">${escapeHtml(order.items?.[0]?.notes || design?.original_notes)}</div>
              </div>
            ` : ''}

            <div style="border: 1px solid #334155; border-radius: 6px; overflow: hidden; background: #0f172a; text-align: center; padding: 12px;">
              <div style="max-height: 480px; display: flex; justify-content: center; align-items: center;">
                ${order.blueprint_svg}
              </div>
            </div>
          </div>
        `;
      }
    }

    const now = new Date();
    const exportDate = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const exportTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const exportTimestamp = `${exportDate} ${exportTime}`;

    const itemsHtml = (order.items || []).map((item, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
        <td>
          <strong style="color: #0f172a; font-size: 13px;">${escapeHtml(item.product_name)}</strong>
          ${item.notes ? `<div style="margin-top: 4px; font-size: 11px; color: #92400e; background: #fffbeb; padding: 4px 8px; border-radius: 4px; border: 1px solid #fde68a;"><strong>Nota de Fabricación:</strong> ${escapeHtml(item.notes)}</div>` : ''}
        </td>
        <td style="color: #334155;">${escapeHtml(item.specs || item.notes || 'Estándar')}</td>
        <td style="text-align: center; font-weight: bold; font-size: 1.1rem; color: #0f172a;">${item.quantity}</td>
        <td style="text-align: center; color: #334155; white-space: nowrap;">
          <span style="display: inline-block; white-space: nowrap; margin-right: 14px;">[ &nbsp; ] Pendiente</span>
          <span style="display: inline-block; white-space: nowrap;">[ &nbsp; ] Listo</span>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Orden de Fabricación - ${order.production_code}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @page {
            size: auto;
            margin: 8mm 12mm 10mm 12mm;
          }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; padding: 24px; background: #fff; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #005187; padding-bottom: 14px; margin-bottom: 18px; }
          .logo-text { font-size: 22px; font-weight: 800; color: #005187; }
          .logo-sub { font-size: 12px; color: #64748b; }
          .order-code-box { text-align: right; }
          .order-code { font-size: 24px; font-weight: 800; color: #005187; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; padding: 12px 14px; border-radius: 6px; margin-bottom: 18px; font-size: 12px; }
          .meta-item strong { display: block; color: #475569; font-size: 11px; text-transform: uppercase; margin-bottom: 2px; }
          .tech-notes-box { background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; margin-bottom: 18px; font-size: 13px; color: #92400e; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #005187; color: #fff; padding: 9px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
          td { padding: 9px 8px; border-bottom: 1px solid #e2e8f0; }
          .checklist-section { margin-top: 24px; border-top: 1px dashed #cbd5e1; padding-top: 14px; }
          .checklist-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px; }
          .checklist-box { border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; text-align: center; }
          .signature-section { margin-top: 36px; display: flex; justify-content: space-between; font-size: 12px; }
          .sig-line { width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 6px; }
          svg { max-width: 100%; max-height: 460px; height: auto; display: block; margin: 0 auto; }
          @media print {
            body { padding: 0 !important; margin: 0 !important; }
            .no-print { display: none !important; }
            svg { max-height: 430px !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo-text">TuEstante OMS</div>
            <div class="logo-sub">Hoja de Ruta de Taller / Orden de Fabricación</div>
          </div>
          <div class="order-code-box">
            <div class="order-code">${escapeHtml(order.production_code)}</div>
            <div style="font-size: 12px; color: #475569;">Pedido Asociado: <strong>${escapeHtml(order.order_number)}</strong></div>
            <div style="font-size: 11px; color: #005187; margin-top: 4px; font-weight: 700;">
              🕒 Emitida: ${exportTimestamp}
            </div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <strong>Cliente:</strong>
            ${escapeHtml(order.client_name)}
          </div>
          <div class="meta-item">
            <strong>Fecha de Inicio:</strong>
            ${formatDate(order.start_date || order.created_at)}
          </div>
          <div class="meta-item">
            <strong>Fecha Estimada Entrega:</strong>
            <span style="font-weight: bold; color: #005187;">${formatDate(order.estimated_completion_date)}</span>
          </div>
          <div class="meta-item">
            <strong>Fecha/Hora Emisión:</strong>
            <span style="font-weight: 700; color: #0f172a;">${exportTimestamp}</span>
          </div>
        </div>

        ${(order.technical_notes || order.order_notes) ? `
          <div class="tech-notes-box">
            <strong>Instrucciones y Observaciones Técnicas de Taller:</strong>
            ${order.technical_notes ? `<p style="margin-top: 4px;"><strong>Taller:</strong> ${escapeHtml(order.technical_notes)}</p>` : ''}
            ${order.order_notes ? `<p style="margin-top: 4px;"><strong>Pedido / Cliente:</strong> ${escapeHtml(order.order_notes)}</p>` : ''}
          </div>
        ` : ''}

        ${blueprintSectionHtml}

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Producto</th>
              <th>Especificaciones / Acabados</th>
              <th style="width: 70px; text-align: center;">Cant.</th>
              <th style="width: 210px; text-align: center; white-space: nowrap;">Control Taller</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="checklist-section">
          <h4 style="font-size: 12px; text-transform: uppercase; margin-bottom: 8px; color: #475569;">Control de Fases de Taller:</h4>
          <div class="checklist-grid">
            <div class="checklist-box">1. Corte y Dimensionado<br><br>[ &nbsp; ] Firma: _________</div>
            <div class="checklist-box">2. Ensamblaje / Estructura<br><br>[ &nbsp; ] Firma: _________</div>
            <div class="checklist-box">3. Pintura / Acabado<br><br>[ &nbsp; ] Firma: _________</div>
            <div class="checklist-box">4. Control de Calidad<br><br>[ &nbsp; ] Firma: _________</div>
          </div>
        </div>

        <!-- Notas y Resultados de Taller antes de las firmas -->
        <div style="margin-top: 20px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;">
            <thead>
              <tr>
                <th style="background: #0f172a; color: #ffffff; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                  📋 Notas y Resultados de Taller / Control de Calidad y Tolerancias
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="height: 85px; vertical-align: top; padding: 12px; font-size: 11px; color: #94a3b8; background: #ffffff;">
                  <em>(Espacio en blanco para anotaciones manuales del operario/inspector: tolerancias reales verificadas, incidencias de pintura/ensamble, observaciones de piezas adicionales o visto bueno de taller):</em>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="signature-section">
          <div class="sig-line">Responsable de Taller</div>
          <div class="sig-line">Inspector de Calidad</div>
          <div class="sig-line">Despacho y Embalaje</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        <\/script>
      </body>
      </html>
    `;

    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      printWindow.location.href = blobUrl;
      setTimeout(() => {
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
      }, 60000);
    } catch (e) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }

    showToast('success', 'Orden Generada', `Se abrió la hoja de fabricación para la orden ${order.production_code}.`);
  } catch (err) {
    showToast('error', 'Error al exportar', err.message);
  }
}

// ==========================================================================
// ESTADO VACÍO Y POBLADO DE SELECTS
// ==========================================================================

function setupEmptyStateListeners() {
  document.querySelectorAll('#btn-empty-new-order, #btn-empty-new-order-ord').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalNew = document.getElementById('modal-new-order-backdrop');
      if (modalNew) {
        modalNew.classList.add('is-open');
        populateNewOrderSelect();
      }
    });
  });

  document.querySelectorAll('#btn-empty-clear-filters, #btn-empty-clear-filters-ord').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('btn-clear-filters')?.click();
    });
  });
}

async function populateNewOrderSelect() {
  const select = document.getElementById('new-order-select');
  const dateInput = document.getElementById('new-estimated-date');
  if (!select) return;

  if (dateInput && !dateInput.value) {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    dateInput.value = nextWeek.toISOString().split('T')[0];
  }

  select.innerHTML = '<option value="" disabled selected>Consultando pedidos disponibles...</option>';

  try {
    const ordersRes = await getRequest('/orders/', { limit: 50 }, { auth: true }).catch(() => null);
    const orders = ordersRes && Array.isArray(ordersRes) ? ordersRes : (ordersRes && Array.isArray(ordersRes.results) ? ordersRes.results : []);

    if (orders.length === 0) {
      select.innerHTML = `
        <option value="" disabled selected>No hay pedidos pendientes en base de datos</option>
        <option value="1">Pedido #00101 — Cliente Mostrador</option>
        <option value="2">Pedido #00102 — Cliente Corporativo</option>
      `;
    } else {
      select.innerHTML = '<option value="" disabled selected>Selecciona un pedido de cliente...</option>' + orders.map(o => {
        const clientName = o.user?.first_name 
          ? `${o.user.first_name} ${o.user.first_last_name || ''}`.trim() 
          : (o.user?.username || o.customer_name || 'Cliente');
        return `<option value="${o.id}">Pedido ${o.order_number || ('#' + o.id)} — ${escapeHtml(clientName)}</option>`;
      }).join('');
    }
  } catch (err) {
    select.innerHTML = `
      <option value="" disabled selected>Selecciona un pedido...</option>
      <option value="1">Pedido #00101 — Cliente Mostrador</option>
    `;
  }
}

// ==========================================================================
// CONFIGURACIÓN DE EVENTOS DE MODALES
// ==========================================================================

function setupModals() {
  // Modal de productos
  const btnCloseProdModal = document.getElementById('btn-close-products-modal');
  const btnCancelProdModal = document.getElementById('btn-cancel-products-modal');
  const backdropProdModal = document.getElementById('production-products-modal-backdrop');
  const btnModalExport = document.getElementById('btn-modal-export-worksheet');

  if (btnCloseProdModal) btnCloseProdModal.addEventListener('click', closeProductionProductsModal);
  if (btnCancelProdModal) btnCancelProdModal.addEventListener('click', closeProductionProductsModal);
  if (backdropProdModal) {
    backdropProdModal.addEventListener('click', (e) => {
      if (e.target === backdropProdModal) closeProductionProductsModal();
    });
  }

  if (btnModalExport) {
    btnModalExport.addEventListener('click', () => {
      if (state.activeModalOrder && state.activeModalOrder.id) {
        openExportFormatModal(state.activeModalOrder.id);
      }
    });
  }

  // Modal de Selección de Formato de Orden (Con Diseño vs De Solo Texto)
  const btnOptExportDesign = document.getElementById('btn-opt-export-design');
  const btnOptExportText = document.getElementById('btn-opt-export-text');
  const btnCloseExportModal = document.getElementById('btn-close-export-modal');
  const btnCancelExportModal = document.getElementById('btn-cancel-export-modal');
  const backdropExportModal = document.getElementById('modal-export-options-backdrop');

  if (btnOptExportDesign) {
    btnOptExportDesign.addEventListener('click', () => {
      const orderId = state.pendingExportOrderId;
      closeExportFormatModal();
      if (orderId) {
        exportProductionWorksheet(orderId, 'with_design');
      }
    });
  }

  if (btnOptExportText) {
    btnOptExportText.addEventListener('click', () => {
      const orderId = state.pendingExportOrderId;
      closeExportFormatModal();
      if (orderId) {
        exportProductionWorksheet(orderId, 'text_only');
      }
    });
  }

  if (btnCloseExportModal) btnCloseExportModal.addEventListener('click', closeExportFormatModal);
  if (btnCancelExportModal) btnCancelExportModal.addEventListener('click', closeExportFormatModal);
  if (backdropExportModal) {
    backdropExportModal.addEventListener('click', (e) => {
      if (e.target === backdropExportModal) closeExportFormatModal();
    });
  }

  // Modal de Nueva Orden de Fabricación
  const btnOpenNew = document.getElementById('btn-new-production-order');
  const modalNew = document.getElementById('modal-new-order-backdrop');
  const btnCloseNew = document.getElementById('btn-close-new-modal');
  const btnCancelNew = document.getElementById('btn-cancel-new-modal');
  const formNew = document.getElementById('form-create-production-order');

  const openNewModal = () => {
    if (modalNew) {
      modalNew.classList.add('is-open');
      populateNewOrderSelect();
    }
  };

  if (btnOpenNew) {
    btnOpenNew.addEventListener('click', openNewModal);
  }

  if (btnCloseNew && modalNew) {
    btnCloseNew.addEventListener('click', () => {
      modalNew.classList.remove('is-open');
    });
  }

  if (btnCancelNew && modalNew) {
    btnCancelNew.addEventListener('click', () => {
      modalNew.classList.remove('is-open');
    });
  }

  if (modalNew) {
    modalNew.addEventListener('click', (e) => {
      if (e.target === modalNew) modalNew.classList.remove('is-open');
    });
  }

  if (formNew) {
    formNew.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderSelect = document.getElementById('new-order-select');
      const estDate = document.getElementById('new-estimated-date').value;
      const techNotes = document.getElementById('new-technical-notes').value;

      const orderId = parseInt(orderSelect.value, 10);
      const selectedOption = orderSelect.options[orderSelect.selectedIndex]?.text || `#00${orderId}`;

      try {
        const created = await createProductionOrder({
          order: orderId,
          order_number: `#00${orderId}`,
          client_name: selectedOption.split('-')[1]?.trim() || 'Cliente TuEstante',
          estimated_completion_date: estDate,
          technical_notes: techNotes
        });

        modalNew.classList.remove('is-open');
        formNew.reset();
        showToast('success', 'Orden Creada', `Orden de fabricación creada exitosamente.`);
        await Promise.all([loadProductionMetrics(), loadProductionData()]);

        // Al solicitar/crear una orden, abrir modal preguntando si se desea con diseño o solo texto
        const newOrderId = created?.id || orderId;
        if (newOrderId) {
          openExportFormatModal(newOrderId);
        }
      } catch (err) {
        showToast('error', 'Error al crear orden', err.message);
      }
    });
  }
}

// ==========================================================================
// UTILIDADES Y TOAST
// ==========================================================================

function formatDate(dateStr) {
  if (!dateStr || dateStr === 'En espera') return 'En espera';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
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

function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}
