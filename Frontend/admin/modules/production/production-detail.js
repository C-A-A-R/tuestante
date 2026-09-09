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

// ==========================================================================
// GENERACIÓN DE HOJA DE ORDEN DE FABRICACIÓN (IMPRESIÓN / EXPORTACIÓN)
// ==========================================================================

function exportProductionWorksheet(order) {
  const printWindow = window.open('', '_blank', 'width=900,height=750');
  if (!printWindow) {
    showToast('info', 'Permitir Ventanas Emergentes', 'Por favor permite ventanas emergentes para generar e imprimir la orden de fabricación.');
    return;
  }

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
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
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

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>Producto & SKU</th>
            <th>Especificaciones / Dimensiones / Acabados</th>
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
