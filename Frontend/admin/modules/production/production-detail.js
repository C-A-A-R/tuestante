import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * ==========================================================================
 * CONTROLADOR - DETALLE DE ORDEN DE FABRICACIÓN - TUESTANTE
 * Manejo de la pantalla individual de producción, avance de fases,
 * especificaciones de taller y generación de la orden de fabricación.
 * ==========================================================================
 */

import { 
  getProductionOrder, 
  updateProductionOrderStatus, 
  advanceProductionOrderStage,
  updateProductionProductStatus,
  bulkUpdateProductionProductsStatus,
  advanceProductionProductStage,
  getProductionBlueprint,
  getStageConfig,
  getProductImageUrl,
  PRODUCTION_STAGES 
} from './production.api.js';

// Estado local de la pantalla
const state = {
  orderId: null,
  order: null,
  selectedProductIds: new Set(),
  pendingExportOrder: null
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar Drawer y Navbar
  await loadAdminComponents({ title: 'Detalle de Fabricación' });// 2. Obtener ID de la orden desde los parámetros de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('id') || urlParams.get('order_id') || '1';
  state.orderId = parseInt(paramId, 10);

  // 3. Vincular eventos de la interfaz
  setupDetailEvents();

  // 4. Cargar datos de la orden
  await loadOrderDetail();
});

// ==========================================================================
// CARGA Y RENDERIZADO DE LA ORDEN
// ==========================================================================

async function loadOrderDetail() {
  try {
    const order = await getProductionOrder(state.orderId);
    state.order = order;
    renderAllOrderDetails(order);
  } catch (err) {
    showToast('error', 'Error al cargar orden', err.message);
    const container = document.getElementById('production-detail-container');
    if (container) {
      container.innerHTML = `
        <div class="production-empty-state" style="padding: 60px 20px; text-align: center; background: var(--bg-primary); border-radius: var(--radius-lg); border: 1px solid var(--border-color); margin-top: 20px;">
          <div class="empty-state-icon-circle" style="width: 72px; height: 72px; margin: 0 auto 16px; background: #fee2e2; color: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">Orden de Fabricación No Encontrada</h3>
          <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 20px;">No se pudo encontrar la orden solicitada (${state.orderId ? 'ID: ' + state.orderId : 'sin ID especificado'}). Es posible que aún no existan órdenes registradas o que haya sido eliminada.</p>
          <a href="production.html" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>Volver a Fabricación</span>
          </a>
        </div>
      `;
    }
  }
}

function renderAllOrderDetails(order) {
  const stage = getStageConfig(order.status);
  const startDateFormatted = formatDate(order.start_date || order.created_at);
  const estDateFormatted = formatDate(order.estimated_completion_date);

  // 1. Encabezado y Breadcrumbs
  const breadcrumbCode = document.getElementById('navbar-breadcrumb-code');
  if (breadcrumbCode) breadcrumbCode.textContent = order.production_code;

  const codeEl = document.getElementById('detail-production-code');
  if (codeEl) codeEl.textContent = order.production_code;

  const stageBadge = document.getElementById('detail-stage-badge');
  const stageLabel = document.getElementById('detail-stage-label');
  if (stageBadge && stageLabel) {
    stageBadge.className = `status-stage-badge ${stage.badgeClass}`;
    stageLabel.textContent = stage.label;
  }

  const iterationPill = document.getElementById('detail-iteration-pill');
  if (iterationPill) {
    if (order.iteration > 1) {
      iterationPill.style.display = 'inline-block';
      iterationPill.textContent = `Iteración #${order.iteration}`;
    } else {
      iterationPill.style.display = 'none';
    }
  }

  const clientNameEl = document.getElementById('detail-client-name');
  if (clientNameEl) clientNameEl.textContent = order.client_name;

  const startDateEl = document.getElementById('detail-start-date');
  if (startDateEl) startDateEl.textContent = startDateFormatted;

  const orderLink = document.getElementById('detail-order-link');
  if (orderLink) {
    orderLink.textContent = order.order_number;
    orderLink.href = `../order/order-detail.html?id=${order.order_id}`;
  }

  // 2. Stepper / Pipeline de Fases
  renderPipelineStepper(order.status);

  // 3. Lista de Productos Físicos con Estado Independiente
  renderProductsList(order.products && order.products.length > 0 ? order.products : (order.items || []));

  // 4. Metadatos de Entrega
  const metaOrderLink = document.getElementById('meta-linked-order-link');
  if (metaOrderLink) {
    metaOrderLink.textContent = order.order_number;
    metaOrderLink.href = `../order/order-detail.html?id=${order.order_id}`;
  }

  const metaClient = document.getElementById('meta-client-name');
  if (metaClient) metaClient.textContent = order.client_name;

  const metaPhone = document.getElementById('meta-client-phone');
  if (metaPhone) metaPhone.textContent = order.client_phone || '+58 412 876 5432';

  const metaCreated = document.getElementById('meta-created-at');
  if (metaCreated) metaCreated.textContent = formatDate(order.created_at);

  const metaEstDate = document.getElementById('meta-est-date');
  if (metaEstDate) metaEstDate.textContent = estDateFormatted;

  // 5. Formulario de Actualización de Fase
  const selectStage = document.getElementById('detail-select-stage');
  if (selectStage) selectStage.value = order.status;

  const notesInput = document.getElementById('detail-input-notes');
  if (notesInput && order.technical_notes) notesInput.value = order.technical_notes;

  // 6. Notas del Pedido
  const orderNotesText = document.getElementById('detail-order-notes-text');
  if (orderNotesText) {
    orderNotesText.textContent = order.order_notes || order.technical_notes || 'Sin notas especiales registradas para este pedido.';
  }

  // 7. Plano Técnico Vectorial y Diseño Paramétrico
  renderBlueprintCard(order);
}

/**
 * Formato compacto para fechas y horas en chips de estado
 */
function formatDateShort(dateStr) {
  if (!dateStr) return 'Pendiente';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Pendiente';
    return d.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Pendiente';
  }
}

/**
 * Renderiza el pipeline visual con las 5 fases oficiales
 */
function renderPipelineStepper(currentStatus) {
  const container = document.getElementById('production-pipeline-stepper');
  if (!container) return;

  const currentConfig = getStageConfig(currentStatus);
  const currentOrder = currentConfig.order || 1;

  container.innerHTML = PRODUCTION_STAGES.map((st) => {
    const isDone = st.order < currentOrder;
    const isCurrent = st.order === currentOrder;
    const stepClass = isDone ? 'is-done' : (isCurrent ? 'is-current' : '');

    return `
      <div class="pipeline-step ${stepClass}">
        <div class="pipeline-circle">
          ${isDone ? '✓' : st.order}
        </div>
        <span class="pipeline-title">${escapeHtml(st.label)}</span>
        <span class="pipeline-sub">
          ${isDone ? 'Completado' : (isCurrent ? 'En curso' : 'Pendiente')}
        </span>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza las tarjetas de productos con número de producto, estado independiente y cronología de fases
 */
function renderProductsList(items) {
  const listEl = document.getElementById('detail-products-list');
  const countEl = document.getElementById('detail-products-count');
  if (!listEl) return;

  if (countEl) {
    countEl.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;
  }

  if (items.length === 0) {
    listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay productos registrados en esta orden.</p>`;
    return;
  }

  listEl.innerHTML = items.map((p, idx) => {
    const prodId = p.id;
    const prodStatus = p.status || state.order.status;
    const stage = getStageConfig(prodStatus);
    const prodNumber = p.product_number || `PRD-${state.order?.order_number || state.order?.id}-${p.unit_index || (idx + 1)}`;
    const isChecked = state.selectedProductIds.has(prodId);

    const dates = p.stage_dates || {};
    const dQueued = p.queued_at || dates.queued;
    const dAssembling = p.assembling_at || dates.assembling;
    const dPainting = p.painting_at || dates.painting;
    const dQuality = p.quality_check_at || dates.quality_check;
    const dCompleted = p.completed_at || dates.completed;

    return `
      <div class="product-detail-card" data-product-id="${prodId}">
        <div class="product-select-wrapper">
          <input type="checkbox" class="product-select-check" data-id="${prodId}" ${isChecked ? 'checked' : ''} title="Seleccionar para acción por lote">
        </div>
        <img 
          src="${escapeHtml(getProductImageUrl(p.image))}" 
          alt="${escapeHtml(p.product_name)}" 
          class="product-thumb-large"
          onerror="this.src='../../assets/images/logo.jpeg'">
        <div class="product-detail-info">
          <div class="product-detail-top">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="product-number-badge">🏷️ ${escapeHtml(prodNumber)}</span>
              <h4 class="product-name-large">${escapeHtml(p.product_name)}</h4>
              <span class="qty-pill" style="font-size: 0.78rem; padding: 2px 8px;">
                Unidad ${p.unit_index || (idx + 1)}
              </span>
            </div>
            <span class="status-stage-badge ${stage.badgeClass}">
              ${stage.label}
            </span>
          </div>

          <!-- Trazabilidad cronológica de fechas de cada estado de fabricación -->
          <div class="product-stage-timeline">
            <div class="timeline-chip ${dQueued ? 'is-active' : ''}" title="Fecha en que ingresó a Cola de Espera">
              <span class="timeline-chip-label">1. Cola:</span>
              <span class="timeline-chip-date">${formatDateShort(dQueued)}</span>
            </div>
            <div class="timeline-chip ${dAssembling ? 'is-active' : ''}" title="Fecha en que pasó a Corte y Ensamblaje">
              <span class="timeline-chip-label">2. Corte/Ensamble:</span>
              <span class="timeline-chip-date">${formatDateShort(dAssembling)}</span>
            </div>
            <div class="timeline-chip ${dPainting ? 'is-active' : ''}" title="Fecha en que pasó a Pintura y Acabado">
              <span class="timeline-chip-label">3. Pintura:</span>
              <span class="timeline-chip-date">${formatDateShort(dPainting)}</span>
            </div>
            <div class="timeline-chip ${dQuality ? 'is-active' : ''}" title="Fecha en que pasó a Control de Calidad">
              <span class="timeline-chip-label">4. Calidad:</span>
              <span class="timeline-chip-date">${formatDateShort(dQuality)}</span>
            </div>
            <div class="timeline-chip ${dCompleted ? 'is-active' : ''}" title="Fecha en que se completó su fabricación">
              <span class="timeline-chip-label">5. Fin:</span>
              <span class="timeline-chip-date">${formatDateShort(dCompleted)}</span>
            </div>
          </div>

          <!-- Controles de acción por producto individual -->
          <div class="product-card-footer">
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              ${p.notes ? `📝 ${escapeHtml(p.notes)}` : 'Sin notas técnicas específicas'}
            </span>
            <div class="product-card-actions">
              <select class="select-product-stage" data-id="${prodId}" title="Cambiar fase de este producto">
                <option value="queued" ${prodStatus === 'queued' ? 'selected' : ''}>En cola de espera</option>
                <option value="assembling" ${prodStatus === 'assembling' ? 'selected' : ''}>En corte y ensamblaje</option>
                <option value="painting" ${prodStatus === 'painting' ? 'selected' : ''}>En pintura y acabado</option>
                <option value="quality_check" ${prodStatus === 'quality_check' ? 'selected' : ''}>En control de calidad</option>
                <option value="completed" ${prodStatus === 'completed' ? 'selected' : ''}>Fabricación completada</option>
              </select>
              <button type="button" class="btn btn-sm btn-outline btn-advance-product" data-id="${prodId}" ${prodStatus === 'completed' ? 'disabled' : ''} style="height: 32px; padding: 4px 10px; font-size: 0.78rem;">
                Avanzar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  bindProductListEvents();
}

/**
 * Vincula los eventos para cada producto individual y selección por lote
 */
function bindProductListEvents() {
  // 1. Checkboxes individuales
  document.querySelectorAll('.product-select-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = parseInt(e.target.getAttribute('data-id'), 10);
      if (e.target.checked) {
        state.selectedProductIds.add(id);
      } else {
        state.selectedProductIds.delete(id);
      }
      updateBatchBarState();
    });
  });

  // 2. Select de cambio de estado individual
  document.querySelectorAll('.select-product-stage').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const prodId = parseInt(e.target.getAttribute('data-id'), 10);
      const newStatus = e.target.value;
      try {
        await updateProductionProductStatus(prodId, newStatus);
        showToast('success', 'Producto Actualizado', 'La fase del producto ha sido actualizada.');
        await loadOrderDetail();
      } catch (err) {
        showToast('error', 'Error al actualizar producto', err.message);
      }
    });
  });

  // 3. Botón de avance individual
  document.querySelectorAll('.btn-advance-product').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const prodId = parseInt(btn.getAttribute('data-id'), 10);
      try {
        await advanceProductionProductStage(prodId);
        showToast('success', 'Fase Avanzada', 'El producto avanzó a su siguiente fase.');
        await loadOrderDetail();
      } catch (err) {
        showToast('error', 'No se pudo avanzar producto', err.message);
      }
    });
  });

  updateBatchBarState();
}

/**
 * Actualiza el contador y visibilidad de la barra flotante de lote
 */
function updateBatchBarState() {
  const batchBar = document.getElementById('batch-product-actions-bar');
  const countBadge = document.getElementById('batch-selected-count');
  const selectAllBtn = document.getElementById('btn-select-all-products');

  const count = state.selectedProductIds.size;
  if (countBadge) countBadge.textContent = count;

  if (batchBar) {
    batchBar.style.display = count > 0 ? 'flex' : 'none';
  }

  if (selectAllBtn) {
    const total = (state.order?.products || state.order?.items || []).length;
    selectAllBtn.textContent = (count > 0 && count === total) ? 'Deseleccionar Todos' : 'Seleccionar Todos';
  }
}

// ==========================================================================
// EVENTOS Y ACCIONES
// ==========================================================================

function setupDetailEvents() {
  // Botón Generar / Exportar Orden de Fabricación
  const btnGenerate = document.getElementById('btn-generate-worksheet');
  if (btnGenerate) {
    btnGenerate.addEventListener('click', () => {
      if (state.order && state.order.id) {
        openExportFormatModal(state.order);
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
      const order = state.pendingExportOrder || state.order;
      closeExportFormatModal();
      if (order) exportProductionWorksheet(order, 'with_design');
    });
  }

  if (btnOptExportText) {
    btnOptExportText.addEventListener('click', () => {
      const order = state.pendingExportOrder || state.order;
      closeExportFormatModal();
      if (order) exportProductionWorksheet(order, 'text_only');
    });
  }

  if (btnCloseExportModal) btnCloseExportModal.addEventListener('click', closeExportFormatModal);
  if (btnCancelExportModal) btnCancelExportModal.addEventListener('click', closeExportFormatModal);
  if (backdropExportModal) {
    backdropExportModal.addEventListener('click', (e) => {
      if (e.target === backdropExportModal) closeExportFormatModal();
    });
  }

  // Botón Seleccionar / Deseleccionar Todos
  const btnSelectAll = document.getElementById('btn-select-all-products');
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      const prods = (state.order?.products || state.order?.items || []);
      if (state.selectedProductIds.size === prods.length) {
        state.selectedProductIds.clear();
      } else {
        prods.forEach(p => state.selectedProductIds.add(p.id));
      }
      renderProductsList(prods);
    });
  }

  // Botón Cancelar Selección por Lote
  const btnCancelBatch = document.getElementById('btn-cancel-batch-selection');
  if (btnCancelBatch) {
    btnCancelBatch.addEventListener('click', () => {
      state.selectedProductIds.clear();
      const prods = (state.order?.products || state.order?.items || []);
      renderProductsList(prods);
    });
  }

  // Botón Aplicar Fase a Lote de Productos
  const btnApplyBatch = document.getElementById('btn-apply-batch-stage');
  if (btnApplyBatch) {
    btnApplyBatch.addEventListener('click', async () => {
      const selectStage = document.getElementById('batch-select-stage');
      const targetStatus = selectStage?.value;

      if (!targetStatus) {
        showToast('warning', 'Seleccione una fase', 'Debe elegir la fase a aplicar al lote seleccionado.');
        return;
      }

      if (state.selectedProductIds.size === 0) {
        showToast('warning', 'Sin productos seleccionados', 'Seleccione al menos un producto.');
        return;
      }

      try {
        const productIdsArray = Array.from(state.selectedProductIds);
        await bulkUpdateProductionProductsStatus({
          productIds: productIdsArray,
          status: targetStatus,
          notes: `Actualización por lote en taller a '${getStageConfig(targetStatus).label}'`
        });

        showToast('success', 'Lote Actualizado', `Se actualizaron ${productIdsArray.length} producto(s) a '${getStageConfig(targetStatus).label}'.`);
        state.selectedProductIds.clear();
        await loadOrderDetail();
      } catch (err) {
        showToast('error', 'Error en actualización por lote', err.message);
      }
    });
  }

  // Botón Avanzar a Siguiente Fase (Orden Madre)
  const btnQuickAdvance = document.getElementById('btn-quick-advance');
  if (btnQuickAdvance) {
    btnQuickAdvance.addEventListener('click', async () => {
      try {
        const updated = await advanceProductionOrderStage(state.orderId);
        state.order = updated;
        renderAllOrderDetails(updated);
        showToast('success', 'Fase Avanzada', `La orden avanzó a: "${updated.status_display}".`);
      } catch (err) {
        showToast('error', 'No se pudo avanzar', err.message);
      }
    });
  }

  // Formulario de Actualización de Fase de Orden Madre
  const formStatus = document.getElementById('form-update-detail-status');
  if (formStatus) {
    formStatus.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectStage = document.getElementById('detail-select-stage').value;
      const notes = document.getElementById('detail-input-notes').value;

      try {
        const updated = await updateProductionOrderStatus(state.orderId, {
          status: selectStage,
          technical_notes: notes
        });
        state.order = updated;
        renderAllOrderDetails(updated);
        showToast('success', 'Cambios Guardados', 'El estado y las notas de taller se han actualizado.');
      } catch (err) {
        showToast('error', 'Error al guardar', err.message);
      }
    });
  }
}

/**
 * Renderiza la sección de plano técnico SVG vectorial y parámetros de taller
 */
function renderParametricPills(pillsContainer, design, quantity = null) {
  if (!pillsContainer) return;
  const dims = design?.dimensions_total_mm || design?.dimensions_mm || { height: 1800, width: 900, depth: 400 };
  const grid = design?.grid || { rows: 3, columns: 1 };
  const color = design?.main_color || '#005187';
  const compartmentsCount = design?.compartments?.length || (grid.rows * grid.columns);

  let qtyHtml = '';
  if (quantity !== null && quantity !== undefined) {
    qtyHtml = `
      <div class="param-pill" style="border-color: #10b981; background: rgba(16, 185, 129, 0.08);" title="Cantidad requerida en la orden">
        <span style="color: #10b981;">Cantidad:</span> <strong style="color: #10b981;">${quantity} Uds.</strong>
      </div>
      <div class="param-pill-divider"></div>
    `;
  }

  pillsContainer.innerHTML = `
    ${qtyHtml}
    <div class="param-pill" title="Altura total acotada">
      <span>Altura:</span> <strong>${dims.height || 1800} mm</strong>
    </div>
    <div class="param-pill-divider"></div>
    <div class="param-pill" title="Ancho frontal acotado">
      <span>Ancho:</span> <strong>${dims.width || 900} mm</strong>
    </div>
    <div class="param-pill-divider"></div>
    <div class="param-pill" title="Profundidad acotada">
      <span>Fondo:</span> <strong>${dims.max_depth || dims.depth || 400} mm</strong>
    </div>
    <div class="param-pill-divider"></div>
    <div class="param-pill" title="Distribución de cuadrícula">
      <span>Cuadrícula:</span> <strong>${grid.rows || 1} filas × ${grid.columns || 1} col</strong>
    </div>
    <div class="param-pill-divider"></div>
    <div class="param-pill" title="Compartimentos y divisiones">
      <span>Módulos:</span> <strong>${compartmentsCount}</strong>
    </div>
    <div class="param-pill-divider"></div>
    <div class="param-pill" title="Color y acabado electrostático">
      <span>Acabado:</span>
      <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${escapeHtml(color)}; border:1px solid #94a3b8; vertical-align:middle; margin: 0 2px;"></span>
      <strong>${escapeHtml(color)}</strong>
    </div>
    <div class="param-pill-divider"></div>
    <div class="param-pill" title="Tolerancia de corte y ensamblaje">
      <span>Tolerancia:</span> <strong>±1.5 mm</strong>
    </div>
  `;
}

/**
 * Renderiza la sección de plano técnico SVG vectorial y parámetros de taller
 * con soporte para órdenes individuales o compuestas multi-producto.
 */
async function renderBlueprintCard(order) {
  const section = document.getElementById('detail-blueprint-section');
  if (!section) return;

  const spinner = document.getElementById('blueprint-loading-spinner');
  const svgContainer = document.getElementById('blueprint-svg-container');
  const pillsContainer = document.getElementById('parametric-specs-pills');
  const tabsBar = document.getElementById('blueprint-product-tabs-bar');
  const btnDownloadSvg = document.getElementById('btn-download-svg');
  const btnOpenTab = document.getElementById('btn-open-blueprint-tab');

  let blueprintSvg = order.blueprint_svg;
  let technicalDesign = order.technical_design;

  // Si no viene en el payload inicial, consultar endpoint específico
  if (!blueprintSvg && order.id) {
    if (spinner) spinner.style.display = 'flex';
    if (svgContainer) svgContainer.style.display = 'none';

    try {
      const bpData = await getProductionBlueprint(order.id);
      if (bpData && bpData.blueprint_svg) {
        blueprintSvg = bpData.blueprint_svg;
        order.blueprint_svg = bpData.blueprint_svg;
        if (bpData.technical_design) {
          technicalDesign = bpData.technical_design;
          order.technical_design = bpData.technical_design;
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar el plano vectorial:', e);
    }
  }

  // Configurar badge de personalización con IA
  const aiBadge = document.getElementById('blueprint-ai-badge');
  if (aiBadge) {
    const isCustom = technicalDesign?.is_custom || order.iteration > 1 || (technicalDesign?.furniture_type && technicalDesign.furniture_type.toLowerCase().includes('personaliz'));
    aiBadge.style.display = isCustom ? 'inline-block' : 'none';
  }

  // Ocultar spinner
  if (spinner) spinner.style.display = 'none';

  const isMulti = Boolean(technicalDesign?.is_multi_product && Array.isArray(technicalDesign.items) && technicalDesign.items.length > 1);

  let activeSvg = blueprintSvg;
  let activeDesign = technicalDesign;
  let activeLabel = 'plano-taller';

  function updateActiveView(svgToShow, designToShow, labelName) {
    activeSvg = svgToShow;
    activeDesign = designToShow;
    activeLabel = labelName;

    if (svgContainer) {
      if (svgToShow) {
        svgContainer.style.display = 'flex';
        svgContainer.innerHTML = svgToShow;
        svgContainer.scrollTop = 0;
      } else {
        svgContainer.style.display = 'flex';
        svgContainer.innerHTML = `
          <div class="blueprint-empty-notice">
            <p style="font-weight: 600; margin-bottom: 6px; color: #f1f5f9;">Plano técnico en cola de procesamiento</p>
            <p style="font-size: 0.8rem; color: #94a3b8;">El plano vectorial se generará en cuanto se confirmen las cotas exactas en taller.</p>
          </div>
        `;
      }
    }

    const btnToggleFit = document.getElementById('btn-toggle-fit');
    const btnToggleFitText = document.getElementById('btn-toggle-fit-text');
    if (btnToggleFit) {
      btnToggleFit.onclick = () => {
        if (!svgContainer) return;
        const isFit = svgContainer.classList.toggle('fit-to-view');
        if (btnToggleFitText) {
          btnToggleFitText.textContent = isFit ? 'Ver Tamaño Real' : 'Ajustar al Marco';
        }
      };
    }

    if (btnDownloadSvg) {
      btnDownloadSvg.onclick = () => {
        if (activeSvg) {
          downloadSvgFile(activeSvg, `${order.production_code || 'orden'}-${activeLabel}.svg`);
        } else {
          showToast('info', 'Plano no disponible', 'No hay plano vectorial para descargar.');
        }
      };
    }

    if (btnOpenTab) {
      btnOpenTab.onclick = () => {
        if (activeSvg) {
          openBlueprintInNewTab(order, activeSvg, activeDesign);
        } else {
          showToast('info', 'Plano no disponible', 'No hay plano vectorial para visualizar.');
        }
      };
    }
  }

  if (isMulti && tabsBar) {
    tabsBar.style.display = 'flex';
    const items = technicalDesign.items;
    const totalUnits = technicalDesign.total_units || items.reduce((acc, it) => acc + (it.quantity || 1), 0);

    tabsBar.innerHTML = `
      <button type="button" class="blueprint-tab-btn active" data-idx="-1">
        <span>📋 Todos los Modelos</span>
        <span class="blueprint-tab-badge">${items.length} modelos (${totalUnits} uds)</span>
      </button>
      ${items.map((it, idx) => `
        <button type="button" class="blueprint-tab-btn" data-idx="${idx}">
          <span>[${idx + 1}] ${escapeHtml(it.product_name)}</span>
          <span class="blueprint-tab-badge">${it.quantity || 1} uds</span>
        </button>
      `).join('')}
    `;

    // Renderizar resumen consolidado en las píldoras
    if (pillsContainer) {
      pillsContainer.innerHTML = `
        <div class="param-pill" style="border-color: #38bdf8; background: rgba(56, 189, 248, 0.08);" title="Total de modelos distintos">
          <span style="color: #38bdf8;">Dossier:</span> <strong style="color: #38bdf8;">${items.length} Modelos</strong>
        </div>
        <div class="param-pill-divider"></div>
        <div class="param-pill" style="border-color: #10b981; background: rgba(16, 185, 129, 0.08);" title="Volumen total de fabricación">
          <span style="color: #10b981;">Total Fabricar:</span> <strong style="color: #10b981;">${totalUnits} Unidades</strong>
        </div>
        <div class="param-pill-divider"></div>
        <div class="param-pill" title="Tolerancia normalizada">
          <span>Tolerancia:</span> <strong>±1.5 mm (ISO)</strong>
        </div>
        <div class="param-pill-divider"></div>
        <div class="param-pill" title="Formato técnico">
          <span>Lámina:</span> <strong>Multi-Producto Consolidada</strong>
        </div>
      `;
    }

    updateActiveView(blueprintSvg, technicalDesign, 'dossier-consolidado');

    // Event listeners para las pestañas de producto
    tabsBar.querySelectorAll('.blueprint-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsBar.querySelectorAll('.blueprint-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx === -1) {
          // Vista Consolidada
          if (pillsContainer) {
            pillsContainer.innerHTML = `
              <div class="param-pill" style="border-color: #38bdf8; background: rgba(56, 189, 248, 0.08);" title="Total de modelos distintos">
                <span style="color: #38bdf8;">Dossier:</span> <strong style="color: #38bdf8;">${items.length} Modelos</strong>
              </div>
              <div class="param-pill-divider"></div>
              <div class="param-pill" style="border-color: #10b981; background: rgba(16, 185, 129, 0.08);" title="Volumen total de fabricación">
                <span style="color: #10b981;">Total Fabricar:</span> <strong style="color: #10b981;">${totalUnits} Unidades</strong>
              </div>
              <div class="param-pill-divider"></div>
              <div class="param-pill" title="Tolerancia normalizada">
                <span>Tolerancia:</span> <strong>±1.5 mm (ISO)</strong>
              </div>
              <div class="param-pill-divider"></div>
              <div class="param-pill" title="Formato técnico">
                <span>Lámina:</span> <strong>Multi-Producto Consolidada</strong>
              </div>
            `;
          }
          updateActiveView(blueprintSvg, technicalDesign, 'dossier-consolidado');
        } else {
          // Vista de Ítem Individual
          const selectedItem = items[idx];
          if (selectedItem) {
            const itemDesign = selectedItem.technical_design || {};
            const itemSvg = selectedItem.blueprint_svg || blueprintSvg;
            renderParametricPills(pillsContainer, itemDesign, selectedItem.quantity);
            const safeName = (selectedItem.product_name || `item-${idx+1}`).toLowerCase().replace(/[^a-z0-9]/g, '-');
            updateActiveView(itemSvg, itemDesign, `item-${idx + 1}-${safeName}`);
          }
        }
      });
    });

  } else {
    // Orden de un solo producto
    if (tabsBar) tabsBar.style.display = 'none';
    renderParametricPills(pillsContainer, technicalDesign, order.items?.[0]?.quantity);
    updateActiveView(blueprintSvg, technicalDesign, 'plano-taller');
  }
}

function downloadSvgFile(svgContent, filename) {
  try {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('success', 'Descarga Iniciada', `Archivo vectorial guardado como ${filename}`);
  } catch (err) {
    showToast('error', 'Error de Descarga', err.message);
  }
}

function openBlueprintInNewTab(order, svgContent, technicalDesign) {
  const viewerWindow = window.open('', '_blank');
  if (!viewerWindow) {
    showToast('info', 'Ventana Bloqueada', 'Por favor habilita las ventanas emergentes para abrir el plano a pantalla completa.');
    return;
  }

  const dims = technicalDesign?.dimensions_mm || { height: 1800, width: 900, depth: 400 };

  viewerWindow.document.open();
  viewerWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Plano Técnico - ${escapeHtml(order.production_code || 'TuEstante')}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #0b1120;
          color: #f8fafc;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .header {
          background-color: #0f172a;
          border-bottom: 1px solid #1e293b;
          padding: 14px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .header h1 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .header .meta {
          font-size: 0.85rem;
          color: #94a3b8;
          display: flex;
          gap: 16px;
        }
        .header .meta strong {
          color: #f1f5f9;
        }
        .actions {
          display: flex;
          gap: 10px;
        }
        .btn-action {
          background-color: #1e293b;
          color: #f8fafc;
          border: 1px solid #334155;
          padding: 8px 16px;
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-action:hover {
          background-color: #0284c7;
          border-color: #0284c7;
        }
        .blueprint-canvas {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 30px;
          overflow: auto;
        }
        .blueprint-canvas svg {
          max-width: 90vw;
          max-height: 84vh;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>📐 Plano Técnico Oficial de Fabricación — ${escapeHtml(order.production_code || '')}</h1>
          <div class="meta" style="margin-top: 4px;">
            <span>Pedido: <strong>${escapeHtml(order.order_number || '')}</strong></span>
            <span>Cliente: <strong>${escapeHtml(order.client_name || '')}</strong></span>
            <span>Dimensiones: <strong>${dims.height} × ${dims.width} × ${dims.depth} mm</strong></span>
          </div>
        </div>
        <div class="actions">
          <button class="btn-action" onclick="window.print()">🖨️ Imprimir</button>
          <button class="btn-action" onclick="window.close()">✕ Cerrar</button>
        </div>
      </div>
      <div class="blueprint-canvas">
        ${svgContent}
      </div>
    </body>
    </html>
  `);
  viewerWindow.document.close();
}

// ==========================================================================
// MODAL DE SELECCIÓN DE FORMATO (CON DISEÑO VS SOLO TEXTO)
// ==========================================================================

function openExportFormatModal(order) {
  state.pendingExportOrder = order;
  const modal = document.getElementById('modal-export-options-backdrop');
  if (modal) {
    modal.classList.add('is-open');
  } else {
    exportProductionWorksheet(order, 'with_design');
  }
}

function closeExportFormatModal() {
  state.pendingExportOrder = null;
  const modal = document.getElementById('modal-export-options-backdrop');
  if (modal) modal.classList.remove('is-open');
}

// ==========================================================================
// GENERACIÓN DE HOJA DE ORDEN DE FABRICACIÓN (IMPRESIÓN / EXPORTACIÓN)
// ==========================================================================

async function exportProductionWorksheet(order, mode = 'with_design') {
  if (!order) return;

  // Si no trae blueprint_svg, intentar consultar el endpoint de blueprint
  if (!order.blueprint_svg && mode === 'with_design' && order.id) {
    try {
      const bpData = await getProductionBlueprint(order.id);
      if (bpData && bpData.blueprint_svg) {
        order.blueprint_svg = bpData.blueprint_svg;
        if (bpData.technical_design) order.technical_design = bpData.technical_design;
      }
    } catch (e) {
      // Fallback
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
