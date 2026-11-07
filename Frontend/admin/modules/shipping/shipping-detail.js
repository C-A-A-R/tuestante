import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * ==========================================================================
 * CONTROLADOR - PANTALLA DETALLE DE ENVÍO (SHIPPING-DETAIL.JS) - TUESTANTE
 * Manejo de vista completa, trazabilidad, impresión de guía y edición condicional
 * (Bloqueo estricto de dirección si el paquete ya ha sido despachado).
 * ==========================================================================
 */

import { 
  getShipment, 
  updateShipment, 
  getDistributors, 
  getShipmentStatusConfig,
  SHIPMENT_STATUSES 
} from './shipping.api.js';

// Estado local de la pantalla
const state = {
  shipmentId: null,
  shipment: null,
  distributors: [],
  isEditMode: false
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Iniciar Componentes de Navegación
  await loadAdminComponents({ title: 'Detalle de Envío' });

  // 2. Extraer ID del envío de la URL (?id=45)
  const urlParams = new URLSearchParams(window.location.search);
  const rawId = urlParams.get('id');
  state.shipmentId = rawId ? parseInt(rawId, 10) : 45; // ID por defecto si se ingresa directo

  // 3. Cargar Distribuidores y Datos del Envío
  await loadDistributors();
  await loadShipmentData();

  // 4. Vincular Eventos de Interacción
  setupEventListeners();
});

/**
 * Resalta la pestaña de Envíos en el Drawer lateral
 */
function highlightDrawerLink() {
  setTimeout(() => {
    document.querySelectorAll('.drawer-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-nav-id') === 'envios') {
        link.classList.add('active');
      }
    });
  }, 200);
}

// ==========================================================================
// CARGA DE DATOS
// ==========================================================================

async function loadDistributors() {
  try {
    const list = await getDistributors();
    state.distributors = list;

    const selectEl = document.getElementById('detail-ship-distributor');
    if (selectEl && list.length > 0) {
      selectEl.innerHTML = list.map(d => `
        <option value="${d.id}">${escapeHtml(d.name)}</option>
      `).join('');
    }
  } catch (err) {
    console.warn('Error al cargar distribuidores:', err);
  }
}

async function loadShipmentData() {
  try {
    const s = await getShipment(state.shipmentId);
    state.shipment = s;
    renderShipmentDetails();
  } catch (err) {
    console.error('Error al cargar detalle del envío:', err);
    showToast('error', 'Error', `No se encontró el envío #${state.shipmentId}. Mostrando último registrado.`);
    // Fallback al primero de mock
    state.shipmentId = 45;
    const fallback = await getShipment(45);
    state.shipment = fallback;
    renderShipmentDetails();
  }
}

// ==========================================================================
// RENDERIZADO DE LA PANTALLA
// ==========================================================================

function renderShipmentDetails() {
  const s = state.shipment;
  if (!s) return;

  const statusCfg = getShipmentStatusConfig(s.status);
  const isSent = s.status !== 'pending';

  // 1. Breadcrumb y Encabezado
  const breadcrumbCode = document.getElementById('navbar-breadcrumb-code');
  const titleCode = document.getElementById('ship-title-code');
  const statusBadge = document.getElementById('ship-status-badge');
  const statusText = document.getElementById('ship-status-text');
  const carrierBadge = document.getElementById('ship-carrier-badge');
  const subtitleOrder = document.getElementById('ship-subtitle-order');
  const createdDate = document.getElementById('ship-created-date');

  if (breadcrumbCode) breadcrumbCode.textContent = s.shipment_code;
  if (titleCode) titleCode.textContent = s.shipment_code;
  if (statusBadge) {
    statusBadge.className = `status-pill ${statusCfg.badgeClass}`;
  }
  if (statusText) statusText.textContent = statusCfg.label;

  const carrierName = s.distributor?.name || 'Flete Propio';
  if (carrierBadge) {
    carrierBadge.textContent = carrierName;
    carrierBadge.className = `carrier-badge ${getCarrierBadgeClass(carrierName)}`;
  }

  if (subtitleOrder) subtitleOrder.textContent = s.order_number;
  if (createdDate) {
    createdDate.innerHTML = `Registrado el <strong>${formatDateTime(s.created_at)}</strong> • Asignado a Pedido <strong id="ship-subtitle-order">${escapeHtml(s.order_number)}</strong>`;
  }

  // 2. Stepper de Trazabilidad
  updateTrackingStepper(s.status);

  // 3. Campos del Estado y Fechas
  const statusSelect = document.getElementById('detail-ship-status-select');
  const estDateInput = document.getElementById('detail-ship-est-date');
  const valCreatedAt = document.getElementById('val-created-at');
  const valShippedAt = document.getElementById('val-shipped-at');
  const valDeliveredAt = document.getElementById('val-delivered-at');

  if (statusSelect) statusSelect.value = s.status;
  if (estDateInput) estDateInput.value = s.estimated_date ? s.estimated_date.split('T')[0] : '';
  if (valCreatedAt) valCreatedAt.textContent = formatDateTime(s.created_at);
  if (valShippedAt) valShippedAt.textContent = s.shipped_at ? formatDateTime(s.shipped_at) : 'Pendiente de salida de taller';
  if (valDeliveredAt) valDeliveredAt.textContent = s.delivered_at ? formatDateTime(s.delivered_at) : 'Aún no entregado';

  // 4. SECCIÓN DIRECCIÓN DE ENTREGA (CONDICIONAL ESTRICTA)
  renderAddressSection(isSent);

  // 5. Productos en el Despacho
  renderProductsTable(s.order_items || []);

  // 6. Columna Derecha: Pedido y Cliente
  const orderLink = document.getElementById('detail-order-link');
  const clientName = document.getElementById('detail-client-name');
  const clientPhone = document.getElementById('detail-client-phone');
  const clientEmail = document.getElementById('detail-client-email');

  if (orderLink) {
    orderLink.textContent = s.order_number;
    orderLink.href = `../order/order-detail.html?id=${s.order_id}`;
  }
  if (clientName) clientName.textContent = s.client_name;
  if (clientPhone) clientPhone.textContent = s.client_phone || '+58 412 000 0000';
  if (clientEmail) clientEmail.textContent = s.client_email || 'cliente@tuestante.com';

  // 7. Columna Derecha: Logística y Transporte
  const distSelect = document.getElementById('detail-ship-distributor');
  const priceInput = document.getElementById('detail-ship-price');
  const priceVesHint = document.getElementById('detail-price-ves');
  const notesTextarea = document.getElementById('detail-ship-notes');

  if (distSelect) {
    distSelect.value = s.distributor?.id || 1;
  }
  if (priceInput) {
    priceInput.value = (s.price || 0).toFixed(2);
  }
  if (priceVesHint) {
    const ves = (s.price || 0) * 36.50;
    priceVesHint.textContent = `Equivalente estimado: Bs. ${formatVES(ves)}`;
  }
  if (notesTextarea) {
    notesTextarea.value = s.notes || '';
  }
}

/**
 * Renderiza la sección de dirección aplicando la regla condicional:
 * Si ya fue enviado, bloquear de forma estricta y advertir al administrador.
 */
function renderAddressSection(isSent) {
  const s = state.shipment;
  const addressCard = document.getElementById('card-address-section');
  const statusIndicator = document.getElementById('address-lock-indicator');
  const alertBox = document.getElementById('address-alert-box');
  const alertText = document.getElementById('address-alert-text');

  const stateInput = document.getElementById('detail-ship-state');
  const munInput = document.getElementById('detail-ship-municipality');
  const cityInput = document.getElementById('detail-ship-city');
  const addressInput = document.getElementById('detail-ship-address');

  if (stateInput) stateInput.value = s.state || '';
  if (munInput) munInput.value = s.municipality || '';
  if (cityInput) cityInput.value = s.city || '';
  if (addressInput) addressInput.value = s.address || '';

  if (isSent) {
    // YA HA SIDO ENVIADO / EN TRÁNSITO / ENTREGADO
    if (addressCard) addressCard.classList.add('address-locked-mode');
    
    if (statusIndicator) {
      statusIndicator.innerHTML = `
        <span class="address-status-badge badge-locked" title="Dirección inmutable porque el paquete ya salió">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Dirección Bloqueada (Despachado)</span>
        </span>
      `;
    }

    if (alertBox) {
      alertBox.className = 'address-alert-box alert-warning';
    }
    if (alertText) {
      alertText.innerHTML = `
        <strong>🔒 Dirección bloqueada:</strong> El producto ya ha sido despachado o entregado (${s.status_display}). Por normativas de logística y seguridad de entrega, la dirección de destino no puede ser modificada.
      `;
    }
  } else {
    // AÚN NO ENVIADO (PENDIENTE)
    if (addressCard) addressCard.classList.remove('address-locked-mode');

    if (statusIndicator) {
      statusIndicator.innerHTML = `
        <span class="address-status-badge badge-unlocked" title="Puedes modificar la dirección habilitando la edición">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
          </svg>
          <span>Modificable (No enviado)</span>
        </span>
      `;
    }

    if (alertBox) {
      alertBox.className = 'address-alert-box alert-info';
    }
    if (alertText) {
      alertText.innerHTML = `
        <strong>ℹ️ Envío aún en taller:</strong> El paquete aún no ha salido a ruta. Si el cliente solicitó un cambio de destino, puedes habilitar la edición y actualizar la dirección antes de despacharlo.
      `;
    }
  }
}

function renderProductsTable(items) {
  const tbody = document.getElementById('detail-products-tbody');
  const countBadge = document.getElementById('badge-products-count');
  if (!tbody) return;

  if (countBadge) {
    const totalQty = items.reduce((sum, it) => sum + (it.quantity || 1), 0);
    countBadge.textContent = `${totalQty} artículo${totalQty !== 1 ? 's' : ''}`;
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No hay productos desglosados en este despacho.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr>
      <td style="font-weight: 600; color: var(--text-main);">${escapeHtml(item.product_name)}</td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(item.specs || 'Acabado estándar')}</td>
      <td style="text-align: center; font-weight: 700; color: var(--primary);">${item.quantity || 1}</td>
    </tr>
  `).join('');
}

function updateTrackingStepper(status) {
  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');
  if (!step1 || !step2 || !step3) return;

  step1.className = 'tracking-step';
  step2.className = 'tracking-step';
  step3.className = 'tracking-step';

  if (status === 'pending') {
    step1.classList.add('is-done');
  } else if (status === 'in_transit') {
    step1.classList.add('is-done');
    step2.classList.add('is-active');
  } else if (status === 'delivered') {
    step1.classList.add('is-done');
    step2.classList.add('is-done');
    step3.classList.add('is-done');
  } else if (status === 'returned' || status === 'failed') {
    step1.classList.add('is-done');
    step2.classList.add('is-done');
    step3.classList.add('is-active');
  }
}

// ==========================================================================
// MODO EDICIÓN Y REGLAS CONDICIONALES
// ==========================================================================

function setupEventListeners() {
  const btnToggleEdit = document.getElementById('btn-toggle-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  const btnPrint = document.getElementById('btn-print-dispatch');

  if (btnToggleEdit) {
    btnToggleEdit.addEventListener('click', () => {
      enableEditMode(true);
    });
  }

  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', () => {
      enableEditMode(false);
      renderShipmentDetails(); // Restaurar valores originales
      showToast('info', 'Edición Cancelada', 'Se restauraron los valores originales del envío.');
    });
  }

  if (btnSaveEdit) {
    btnSaveEdit.addEventListener('click', async () => {
      await saveShipmentChanges();
    });
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      if (state.shipment) {
        printDispatchSlip(state.shipment);
      }
    });
  }

  // Recalcular Bs. cuando cambia el precio en USD
  const priceInput = document.getElementById('detail-ship-price');
  if (priceInput) {
    priceInput.addEventListener('input', () => {
      const val = parseFloat(priceInput.value) || 0;
      const ves = val * 36.50;
      const hint = document.getElementById('detail-price-ves');
      if (hint) hint.textContent = `Equivalente estimado: Bs. ${formatVES(ves)}`;
    });
  }
}

function enableEditMode(active) {
  state.isEditMode = active;

  const btnToggle = document.getElementById('btn-toggle-edit');
  const editButtons = document.getElementById('edit-action-buttons');
  const modeBadge = document.getElementById('mode-badge');

  if (btnToggle) btnToggle.style.display = active ? 'none' : 'inline-flex';
  if (editButtons) editButtons.style.display = active ? 'flex' : 'none';

  if (modeBadge) {
    if (active) {
      modeBadge.textContent = 'Modo Edición Activo';
      modeBadge.className = 'mode-badge mode-editing';
    } else {
      modeBadge.textContent = 'Modo solo lectura';
      modeBadge.className = 'mode-badge mode-readonly';
    }
  }

  // Campos generales de logística (siempre editables en modo edición)
  const statusSelect = document.getElementById('detail-ship-status-select');
  const estDateInput = document.getElementById('detail-ship-est-date');
  const distSelect = document.getElementById('detail-ship-distributor');
  const priceInput = document.getElementById('detail-ship-price');
  const notesTextarea = document.getElementById('detail-ship-notes');

  if (statusSelect) statusSelect.disabled = !active;
  if (estDateInput) estDateInput.disabled = !active;
  if (distSelect) distSelect.disabled = !active;
  if (priceInput) priceInput.disabled = !active;
  if (notesTextarea) notesTextarea.disabled = !active;

  // REGLA CONDICIONAL ESTRICTA PARA LA DIRECCIÓN:
  // Solo se habilitan si el producto NO se ha enviado (status === 'pending')
  const isSent = state.shipment ? state.shipment.status !== 'pending' : true;
  const addressInputs = document.querySelectorAll('.address-input');

  addressInputs.forEach(input => {
    if (active && !isSent) {
      input.disabled = false;
    } else {
      input.disabled = true;
    }
  });
}

async function saveShipmentChanges() {
  if (!state.shipment) return;

  const isSent = state.shipment.status !== 'pending';

  const newStatus = document.getElementById('detail-ship-status-select').value;
  const newEstDate = document.getElementById('detail-ship-est-date').value;
  const newDistId = parseInt(document.getElementById('detail-ship-distributor').value, 10);
  const newPrice = parseFloat(document.getElementById('detail-ship-price').value) || 0;
  const newNotes = document.getElementById('detail-ship-notes').value;

  const dataToUpdate = {
    status: newStatus,
    estimated_date: newEstDate,
    distributor: newDistId,
    price: newPrice,
    notes: newNotes
  };

  // Solo permitir modificar la dirección si NO se ha enviado
  if (!isSent) {
    dataToUpdate.state = document.getElementById('detail-ship-state').value.trim();
    dataToUpdate.municipality = document.getElementById('detail-ship-municipality').value.trim();
    dataToUpdate.city = document.getElementById('detail-ship-city').value.trim();
    dataToUpdate.address = document.getElementById('detail-ship-address').value.trim();
  }

  try {
    const updated = await updateShipment(state.shipment.id, dataToUpdate);
    state.shipment = updated;
    enableEditMode(false);
    renderShipmentDetails();

    showToast('success', 'Cambios Guardados', `El envío ${updated.shipment_code} fue actualizado correctamente.`);
  } catch (err) {
    showToast('error', 'Error al Guardar', err.message);
  }
}

// ==========================================================================
// IMPRESIÓN DE GUÍA DE DESPACHO
// ==========================================================================

function printDispatchSlip(shipment) {
  const printWindow = window.open('', '_blank', 'width=850,height=700');
  if (!printWindow) {
    showToast('info', 'Ventana Emergente', 'Por favor permite ventanas emergentes para imprimir la guía de despacho.');
    return;
  }

  const itemsHtml = (shipment.order_items || []).map((it, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${escapeHtml(it.product_name)}</strong></td>
      <td>${escapeHtml(it.specs || 'Estándar')}</td>
      <td style="text-align: center; font-weight: bold;">${it.quantity || 1}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Guía de Despacho - ${shipment.shipment_code}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 28px; color: #0f172a; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #005187; padding-bottom: 12px; margin-bottom: 18px; }
        .logo { font-size: 20px; font-weight: 800; color: #005187; }
        .code { font-size: 22px; font-weight: 800; color: #005187; text-align: right; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 18px; font-size: 13px; }
        .grid-2 strong { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th { background: #005187; color: #fff; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        .signatures { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; }
        .sig-box { width: 220px; border-top: 1px solid #000; text-align: center; padding-top: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">TuEstante OMS</div>
          <div style="font-size: 12px; color: #64748b;">Guía Oficial de Despacho y Entrega</div>
        </div>
        <div>
          <div class="code">${escapeHtml(shipment.shipment_code)}</div>
          <div style="font-size: 12px; color: #64748b;">Pedido: <strong>${escapeHtml(shipment.order_number)}</strong></div>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <strong>Destinatario:</strong>
          <div>${escapeHtml(shipment.client_name)}</div>
          <div style="color: #64748b;">${escapeHtml(shipment.client_phone || '')}</div>
        </div>
        <div>
          <strong>Transportador:</strong>
          <div>${escapeHtml(shipment.distributor?.name || 'Flete Propio')}</div>
          <div style="color: #64748b;">RIF: ${escapeHtml(shipment.distributor?.rif || 'N/A')}</div>
        </div>
      </div>

      <div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 18px; font-size: 13px;">
        <strong style="display: block; font-size: 11px; text-transform: uppercase; color: #64748b;">Dirección de Entrega:</strong>
        <div>${escapeHtml(shipment.address)}, ${escapeHtml(shipment.city)} (${escapeHtml(shipment.municipality || '')}), ${escapeHtml(shipment.state)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>Producto</th>
            <th>Detalle</th>
            <th style="width: 60px; text-align: center;">Cant.</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      ${shipment.notes ? `
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 4px; font-size: 12px; margin-bottom: 20px;">
          <strong>Instrucciones Especiales:</strong> ${escapeHtml(shipment.notes)}
        </div>
      ` : ''}

      <div class="signatures">
        <div class="sig-box">Firma Responsable Despacho</div>
        <div class="sig-box">Firma Transportador</div>
        <div class="sig-box">Firma Destinatario a Conformidad</div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}

// ==========================================================================
// UTILIDADES
// ==========================================================================

function getCarrierBadgeClass(name = '') {
  const n = (name || '').toLowerCase();
  if (n.includes('mrw')) return 'carrier-mrw';
  if (n.includes('zoom')) return 'carrier-zoom';
  if (n.includes('dhl')) return 'carrier-dhl';
  if (n.includes('tealca')) return 'carrier-tealca';
  if (n.includes('domesa')) return 'carrier-domesa';
  return 'carrier-flete';
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('es-ES')} - ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return dateStr;
  }
}

function formatVES(val) {
  return Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str = '') {
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
  }, 3500);
}
