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
  getProductionBlueprint,
  getStageConfig,
  PRODUCTION_STAGES 
} from './production.api.js';

// Estado local de la pantalla
const state = {
  orderId: null,
  order: null
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

  // 3. Lista de Productos
  renderProductsList(order.items || []);

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
 * Renderiza las tarjetas de productos sin SKU ni especificaciones inferiores
 */
function renderProductsList(items) {
  const listEl = document.getElementById('detail-products-list');
  const countEl = document.getElementById('detail-products-count');
  if (!listEl) return;

  if (countEl) {
    countEl.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;
  }

  if (items.length === 0) {
    listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No hay productos registrados en esta orden.</p>`;
    return;
  }

  listEl.innerHTML = items.map(p => `
    <div class="product-detail-card">
      <img 
        src="${escapeHtml(p.image)}" 
        alt="${escapeHtml(p.product_name)}" 
        class="product-thumb-large"
        onerror="this.src='../../assets/images/logo.jpeg'">
      <div class="product-detail-info" style="justify-content: center;">
        <div class="product-detail-top">
          <h4 class="product-name-large">${escapeHtml(p.product_name)}</h4>
          <span class="qty-pill" style="font-size: 0.85rem; padding: 4px 10px;">
            ${p.quantity} ${p.quantity === 1 ? 'producto' : 'productos'}
          </span>
        </div>
      </div>
    </div>
  `).join('');
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
        exportProductionWorksheet(state.order);
      }
    });
  }

  // Botón Avanzar a Siguiente Fase
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

  // Formulario de Actualización de Fase
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
async function renderBlueprintCard(order) {
  const section = document.getElementById('detail-blueprint-section');
  if (!section) return;

  const spinner = document.getElementById('blueprint-loading-spinner');
  const svgContainer = document.getElementById('blueprint-svg-container');
  const pillsContainer = document.getElementById('parametric-specs-pills');
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

  // Renderizar píldoras paramétricas de especificaciones
  if (pillsContainer) {
    const dims = technicalDesign?.dimensions_mm || { height: 1800, width: 900, depth: 400 };
    const grid = technicalDesign?.grid || { rows: 3, columns: 1 };
    const color = technicalDesign?.main_color || '#005187';
    const compartmentsCount = technicalDesign?.compartments?.length || (grid.rows * grid.columns);

    pillsContainer.innerHTML = `
      <div class="param-pill" title="Altura total acotada">
        <span>Altura:</span> <strong>${dims.height || 1800} mm</strong>
      </div>
      <div class="param-pill-divider"></div>
      <div class="param-pill" title="Ancho frontal acotado">
        <span>Ancho:</span> <strong>${dims.width || 900} mm</strong>
      </div>
      <div class="param-pill-divider"></div>
      <div class="param-pill" title="Profundidad acotada">
        <span>Fondo:</span> <strong>${dims.depth || 400} mm</strong>
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

  // Ocultar spinner y mostrar SVG
  if (spinner) spinner.style.display = 'none';

  if (blueprintSvg && svgContainer) {
    svgContainer.style.display = 'flex';
    svgContainer.innerHTML = blueprintSvg;

    if (btnDownloadSvg) {
      btnDownloadSvg.onclick = () => {
        downloadSvgFile(blueprintSvg, `${order.production_code || 'orden'}-plano-taller.svg`);
      };
    }

    if (btnOpenTab) {
      btnOpenTab.onclick = () => {
        openBlueprintInNewTab(order, blueprintSvg, technicalDesign);
      };
    }
  } else if (svgContainer) {
    svgContainer.style.display = 'flex';
    svgContainer.innerHTML = `
      <div class="blueprint-empty-notice">
        <p style="font-weight: 600; margin-bottom: 6px; color: #f1f5f9;">Plano técnico en cola de procesamiento</p>
        <p style="font-size: 0.8rem; color: #94a3b8;">El plano vectorial se generará en cuanto se confirmen las cotas exactas en taller.</p>
      </div>
    `;
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
// GENERACIÓN DE HOJA DE ORDEN DE FABRICACIÓN (IMPRESIÓN / EXPORTACIÓN)
// ==========================================================================

function exportProductionWorksheet(order) {
  const printWindow = window.open('', '_blank', 'width=950,height=800');
  if (!printWindow) {
    showToast('info', 'Permitir Ventanas Emergentes', 'Por favor permite ventanas emergentes para generar e imprimir la orden de fabricación.');
    return;
  }

  const design = order.technical_design;
  const dims = design?.dimensions_mm || { height: 1800, width: 900, depth: 400 };
  const grid = design?.grid || { rows: 3, columns: 1 };
  const color = design?.main_color || '#005187';

  const blueprintSectionHtml = order.blueprint_svg ? `
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

      <div style="border: 1px solid #334155; border-radius: 6px; overflow: hidden; background: #0f172a; text-align: center; padding: 12px;">
        <div style="max-height: 480px; display: flex; justify-content: center; align-items: center;">
          ${order.blueprint_svg}
        </div>
      </div>
    </div>
  ` : '';

  const itemsHtml = (order.items || []).map((item, idx) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
      <td>
        <strong>${escapeHtml(item.product_name)}</strong><br>
        <small style="color: #64748b;">SKU: ${escapeHtml(item.sku)}</small>
      </td>
      <td>${escapeHtml(item.specs || 'Estándar')}</td>
      <td style="text-align: center; font-weight: bold; font-size: 1.1rem;">${item.quantity}</td>
      <td style="text-align: center; color: #64748b;">[ &nbsp; ] Listo</td>
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
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; padding: 30px; background: #fff; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #005187; padding-bottom: 16px; margin-bottom: 20px; }
        .logo-text { font-size: 22px; font-weight: 800; color: #005187; }
        .logo-sub { font-size: 12px; color: #64748b; }
        .order-code-box { text-align: right; }
        .order-code { font-size: 24px; font-weight: 800; color: #005187; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f8fafc; padding: 14px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; }
        .meta-item strong { display: block; color: #475569; font-size: 11px; text-transform: uppercase; }
        .tech-notes-box { background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #92400e; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th { background: #005187; color: #fff; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }
        .checklist-section { margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 16px; }
        .checklist-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px; }
        .checklist-box { border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; text-align: center; }
        .signature-section { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; }
        .sig-line { width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 6px; }
        svg { max-width: 100%; max-height: 460px; height: auto; display: block; margin: 0 auto; }
        @media print {
          body { padding: 10px; }
          .no-print { display: none; }
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
          <strong>Fecha Estimada de Entrega:</strong>
          <span style="font-weight: bold; color: #005187;">${formatDate(order.estimated_completion_date)}</span>
        </div>
      </div>

      ${order.technical_notes ? `
        <div class="tech-notes-box">
          <strong>Instrucciones y Observaciones Técnicas de Taller:</strong>
          <p style="margin-top: 4px;">${escapeHtml(order.technical_notes)}</p>
        </div>
      ` : ''}

      ${blueprintSectionHtml}

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>Producto & SKU</th>
            <th>Especificaciones / Acabados</th>
            <th style="width: 70px; text-align: center;">Cant.</th>
            <th style="width: 150px; text-align: center;">Control Taller</th>
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

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

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
