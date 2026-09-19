/**
 * employee-ledger.js
 * Directorio de Trabajadores y Control de Cartera - TuEstante Admin
 */

import {
  fetchEmployees,
  fetchPayments,
  createDebtPayment,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus
} from './employee-store.api.js';

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { getBcvRate } from '../../js/service/exchange-rate.service.js';
import { showConfirmModal, showLoadingOverlay, hideLoadingOverlay } from '../../components/modal/modal.js';
import { resolveImageUrl } from '../../js/api.js';

// ============================================================================
// ESTADO
// ============================================================================
let currentExchangeRate = 80.00;
let employeesList = [];
let paymentsList = [];
let selectedEmployeeForPay = null;
let activePopoverEl = null;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminComponents({ title: 'Trabajadores' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load warning:', err);
  }

  // Verificar si hay una notificación flash guardada (ej. post-registro o edición)
  checkFlashToast();

  await loadExchangeRate();
  setupEventListeners();
  await loadData();
});

function checkFlashToast() {
  try {
    const flash = sessionStorage.getItem('flash_toast');
    if (flash) {
      sessionStorage.removeItem('flash_toast');
      const parsed = JSON.parse(flash);
      if (parsed && parsed.message) {
        showToast(parsed.message, parsed.type || 'success');
      }
    }
  } catch (e) {
    console.warn('Error reading flash toast:', e);
  }
}

async function loadExchangeRate() {
  try {
    const rate = await getBcvRate();
    if (rate && !isNaN(rate) && rate > 0) {
      currentExchangeRate = parseFloat(rate);
      const badgeVal = document.getElementById('navbar-exchange-val');
      if (badgeVal) badgeVal.textContent = `Bs. ${currentExchangeRate.toFixed(2)}`;
    }
  } catch (err) {
    console.warn('Fallback BCV rate active');
  }
}

async function loadData() {
  const tableBody = document.getElementById('employees-table-body');
  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">Cargando registros de nómina...</td></tr>';
  }

  try {
    const [emps, pays] = await Promise.all([
      fetchEmployees(),
      fetchPayments().catch(() => [])
    ]);

    employeesList = Array.isArray(emps) ? emps : (emps.results || []);
    paymentsList = Array.isArray(pays) ? pays : (pays.results || []);

    updateMetrics();
    renderTable();
  } catch (error) {
    console.error('Error al cargar datos:', error);
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #dc2626;">Error al cargar datos del servidor.</td></tr>';
    }
    showToast('Error al consultar lista de trabajadores', 'error');
  }
}

function updateMetrics() {
  const total = employeesList.length;
  let totalDebtUSD = 0;
  let withDebtCount = 0;

  employeesList.forEach(emp => {
    const debt = parseFloat(emp.current_debt || 0);
    totalDebtUSD += debt;
    if (debt > 0.01) withDebtCount++;
  });

  const totalDebtVES = totalDebtUSD * currentExchangeRate;

  let totalPaidUSD = 0;
  paymentsList.forEach(p => {
    totalPaidUSD += parseFloat(p.amount || 0);
  });

  // KPI 1: Cartera total
  const metricTotalDebt = document.getElementById('metric-total-debt');
  const metricTotalDebtVes = document.getElementById('metric-total-debt-ves');
  if (metricTotalDebt) metricTotalDebt.textContent = `$${totalDebtUSD.toFixed(2)}`;
  if (metricTotalDebtVes) metricTotalDebtVes.textContent = `Bs. ${totalDebtVES.toFixed(2)}`;

  // KPI 2: Trabajadores con deuda
  const metricWithDebt = document.getElementById('metric-emp-with-debt');
  const metricTotalSub = document.getElementById('metric-total-emp-sub');
  if (metricWithDebt) metricWithDebt.textContent = withDebtCount;
  if (metricTotalSub) metricTotalSub.textContent = `De ${total} colaboradores registrados`;

  // KPI 3: Total pagado / amortizado
  const metricTotalPaid = document.getElementById('metric-total-paid');
  if (metricTotalPaid) metricTotalPaid.textContent = `$${totalPaidUSD.toFixed(2)}`;
}

// ============================================================================
// RENDERIZADO DE TABLA
// ============================================================================
function renderTable() {
  const tableBody = document.getElementById('employees-table-body');
  if (!tableBody) return;

  const searchVal = (document.getElementById('input-search')?.value || '').toLowerCase().trim();
  const filterStatus = document.getElementById('select-filter-status')?.value || 'all';

  const filtered = employeesList.filter(emp => {
    const debt = parseFloat(emp.current_debt || 0);

    // Filtro estado
    if (filterStatus === 'with-debt' && debt <= 0.01) return false;
    if (filterStatus === 'overdue' && !emp.has_overdue_debt) return false;
    if (filterStatus === 'clean' && debt > 0.01) return false;

    // Filtro búsqueda
    if (searchVal) {
      const name = (emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`).toLowerCase();
      const num = (emp.employee_number || '').toLowerCase();
      const doc = (emp.id_number || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      const pos = (emp.position || '').toLowerCase();

      if (!name.includes(searchVal) && !num.includes(searchVal) && !doc.includes(searchVal) && !dept.includes(searchVal) && !pos.includes(searchVal)) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
          No se encontraron trabajadores con los filtros aplicados.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(emp => {
    const debtUSD = parseFloat(emp.current_debt || 0);
    const debtVES = debtUSD * currentExchangeRate;
    const salary = parseFloat(emp.salary || 0);
    const fullName = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`;
    let docNumber = emp.id_number ? `CI: ${emp.id_number}` : 'Sin C.I.';
    if (emp.birth_date) {
      const [by, bm, bd] = emp.birth_date.split('-');
      docNumber += ` - ${bd}/${bm}/${by}`;
    }

    // Foto o Avatar fallback SVG
    const photoUrl = emp.photo ? resolveImageUrl(emp.photo) : null;
    const photoMarkup = photoUrl
      ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(fullName)}" class="emp-table-photo" data-photo="${escapeHtml(photoUrl)}" data-name="${escapeHtml(fullName)}" title="Ver foto ampliada">`
      : `<div class="emp-table-no-photo" title="Sin foto de perfil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>`;

    // Estado Badge
    let statusBadge = '';
    if (emp.has_overdue_debt) {
      statusBadge = `<span class="badge-status badge-overdue" title="Deuda vencida de cortes anteriores">⚠️ Atrasado</span>`;
    } else if (debtUSD > 0.01) {
      statusBadge = `<span class="badge-status badge-current-debt">Consumo Activo</span>`;
    } else {
      statusBadge = `<span class="badge-status badge-clean">Al Día</span>`;
    }

    // Celda de deuda destacada (#e0f2fe, #cbd5e1, #0f172a)
    const debtCell = debtUSD > 0.01
      ? `
        <div class="debt-highlight-cell">
          <span class="debt-highlight-val">$${debtUSD.toFixed(2)}</span>
          <span class="debt-highlight-ves">Bs. ${debtVES.toFixed(2)}</span>
        </div>
      `
      : `<span class="debt-clean-pill">$0.00</span>`;

    return `
      <tr data-id="${emp.id}" class="${!emp.is_active ? 'row-inactive' : ''}">
        <td style="text-align: center; vertical-align: middle;">
          ${photoMarkup}
        </td>
        <td>
          <span class="emp-code-pill">${escapeHtml(emp.employee_number || 'S/N')}</span>
        </td>
        <td>
          <div class="emp-name-cell">${escapeHtml(fullName)}</div>
          <span class="emp-doc-sub">${escapeHtml(docNumber)}</span>
        </td>
        <td>
          <div class="emp-dept-cell">${escapeHtml(emp.department || 'General')}</div>
          <span class="emp-pos-sub">${escapeHtml(emp.position || 'Colaborador')}</span>
        </td>
        <td>
          <strong>$${salary.toFixed(2)}</strong>
        </td>
        <td>
          ${debtCell}
        </td>
        <td style="text-align: center;">
          ${statusBadge}
        </td>
        <td>
          <div class="table-actions" style="position: relative; display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
            <!-- Icono Ver / Resumen -->
            <a href="employee-statement.html?id=${emp.id}" class="btn-icon-action btn-view" title="Ver estado de cuenta" aria-label="Ver estado de cuenta de ${escapeHtml(fullName)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </a>

            <!-- Botón Editar -->
            <button type="button" class="btn-icon-action btn-edit btn-open-edit" data-id="${emp.id}" title="Editar datos del trabajador" aria-label="Editar datos de ${escapeHtml(fullName)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>

            <!-- Botón 3 Puntos (Menú Contextual) -->
            <button 
              type="button" 
              class="btn-icon-action btn-more btn-emp-menu" 
              data-emp-id="${emp.id}" 
              title="Más opciones" 
              aria-expanded="false" 
              aria-haspopup="true" 
              aria-label="Más opciones para ${escapeHtml(fullName)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px">
                <circle cx="12" cy="5" r="1.2"></circle>
                <circle cx="12" cy="12" r="1.2"></circle>
                <circle cx="12" cy="19" r="1.2"></circle>
              </svg>
            </button>

            <!-- Menú Flotante de Acciones -->
            <div class="action-popover" id="popover-${emp.id}" role="menu">
              <button type="button" class="action-popover-item btn-open-payment" data-id="${emp.id}" role="menuitem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
                <span>Registrar Abono</span>
              </button>
              <button type="button" class="action-popover-item btn-toggle-status" data-id="${emp.id}" data-active="${emp.is_active}" role="menuitem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  ${emp.is_active
                    ? '<path d="M18.36 6.64A9 9 0 0 1 20.77 15"></path><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
                    : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
                  }
                </svg>
                <span>${emp.is_active ? 'Desactivar Trabajador' : 'Activar Trabajador'}</span>
              </button>
              <button type="button" class="action-popover-item text-danger btn-open-delete" data-id="${emp.id}" data-name="${escapeHtml(fullName)}" role="menuitem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M9 6V4h6v2"></path>
                </svg>
                <span>Eliminar Trabajador</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachTableEvents();
}

function attachTableEvents() {
  const tableBody = document.getElementById('employees-table-body');
  if (!tableBody) return;

  // Botón 3 puntos menú contextual
  tableBody.querySelectorAll('.btn-emp-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const empId = btn.getAttribute('data-emp-id');
      const popover = document.getElementById(`popover-${empId}`);

      if (activePopoverEl && activePopoverEl !== popover) {
        activePopoverEl.classList.remove('is-active');
      }

      if (popover) {
        popover.classList.toggle('is-active');
        activePopoverEl = popover.classList.contains('is-active') ? popover : null;
      }
    });
  });

  tableBody.querySelectorAll('.btn-open-payment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeActivePopover();
      openPaymentModal(btn.dataset.id);
    });
  });

  tableBody.querySelectorAll('.emp-table-photo').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.dataset.photo, img.dataset.name));
  });

  tableBody.querySelectorAll('.btn-open-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeActivePopover();
      openEditModal(btn.dataset.id);
    });
  });

  tableBody.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeActivePopover();
      handleToggleStatus(btn.dataset.id);
    });
  });

  tableBody.querySelectorAll('.btn-open-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeActivePopover();
      handleDeleteEmployee(btn.dataset.id, btn.dataset.name);
    });
  });
}

function closeActivePopover() {
  if (activePopoverEl) {
    activePopoverEl.classList.remove('is-active');
    activePopoverEl = null;
  }
}

// ============================================================================
// MODAL DE REGISTRO DE ABONO (DebtPayment)
// ============================================================================
function openPaymentModal(employeeId) {
  const emp = employeesList.find(e => String(e.id) === String(employeeId));
  if (!emp) return;

  selectedEmployeeForPay = emp;
  const fullName = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`;
  const debtUSD = parseFloat(emp.current_debt || 0);
  const debtVES = debtUSD * currentExchangeRate;

  document.getElementById('pay-emp-id').value = emp.id;
  document.getElementById('pay-emp-name').textContent = fullName;
  document.getElementById('pay-emp-doc').textContent = `Ficha: ${emp.employee_number || 'S/F'} | ${emp.id_number ? `CI: ${emp.id_number}` : ''}`;
  document.getElementById('pay-emp-debt').textContent = `$${debtUSD.toFixed(2)}`;
  document.getElementById('pay-emp-debt-ves').textContent = `Bs. ${debtVES.toFixed(2)}`;

  const payAmountInput = document.getElementById('pay-amount');
  payAmountInput.value = debtUSD > 0 ? debtUSD.toFixed(2) : '0.00';
  updatePayVesPreview();

  document.getElementById('pay-ref').value = '';
  document.getElementById('pay-notes').value = '';

  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.add('is-active');
  payAmountInput.focus();
}

function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.remove('is-active');
  document.getElementById('payment-form')?.reset();
  resetPayVoucherPreview();
  selectedEmployeeForPay = null;
}

function resetPayVoucherPreview() {
  const inpFile = document.getElementById('pay-voucher');
  if (inpFile) inpFile.value = '';
  const dropzone = document.getElementById('pay-voucher-dropzone');
  const preview = document.getElementById('pay-voucher-preview');
  if (dropzone) dropzone.classList.remove('hidden');
  if (preview) preview.classList.add('hidden');
}

function setupPayVoucherEvents() {
  const inpFile = document.getElementById('pay-voucher');
  const dropzone = document.getElementById('pay-voucher-dropzone');
  const preview = document.getElementById('pay-voucher-preview');
  const imgThumb = document.getElementById('pay-voucher-img');
  const nameLabel = document.getElementById('pay-voucher-name');
  const sizeLabel = document.getElementById('pay-voucher-size');
  const btnRemove = document.getElementById('btn-remove-pay-voucher');

  inpFile?.addEventListener('change', () => {
    const file = inpFile.files?.[0];
    if (!file) {
      resetPayVoucherPreview();
      return;
    }

    if (nameLabel) nameLabel.textContent = file.name;
    if (sizeLabel) sizeLabel.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (imgThumb) imgThumb.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      if (imgThumb) imgThumb.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="%23005187" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }

    if (dropzone) dropzone.classList.add('hidden');
    if (preview) preview.classList.remove('hidden');
  });

  btnRemove?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetPayVoucherPreview();
  });
}

function updatePayVesPreview() {
  const amountUSD = parseFloat(document.getElementById('pay-amount')?.value || 0);
  const liveVES = document.getElementById('pay-live-ves');
  if (liveVES) {
    const ves = amountUSD * currentExchangeRate;
    liveVES.textContent = `Equivalente: Bs. ${ves.toFixed(2)} (Tasa BCV: ${currentExchangeRate.toFixed(2)})`;
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Filtros
  document.getElementById('input-search')?.addEventListener('input', renderTable);
  document.getElementById('select-filter-status')?.addEventListener('change', renderTable);
  document.getElementById('btn-reload-data')?.addEventListener('click', loadData);

  // Limpiar Filtros
  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    const searchInput = document.getElementById('input-search');
    const statusSelect = document.getElementById('select-filter-status');
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    renderTable();
  });

  // Modal Pago
  setupPayVoucherEvents();
  document.getElementById('btn-close-payment')?.addEventListener('click', closePaymentModal);
  document.getElementById('btn-cancel-payment')?.addEventListener('click', closePaymentModal);
  document.getElementById('pay-amount')?.addEventListener('input', updatePayVesPreview);

  // Cerrar popovers contextuales de 3 puntos y modales con Escape o clic fuera
  document.addEventListener('click', () => {
    closeActivePopover();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeActivePopover();
      closeLightbox();
      closePaymentModal();
    }
  });

  // Modal Lightbox Foto
  document.getElementById('btn-close-lightbox')?.addEventListener('click', closeLightbox);
  const modalLightbox = document.getElementById('modal-image-lightbox');
  if (modalLightbox) {
    modalLightbox.addEventListener('click', (e) => {
      if (e.target === modalLightbox) closeLightbox();
    });
  }

  // Envío Formulario de Pago
  document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedEmployeeForPay) return;

    const empId = document.getElementById('pay-emp-id').value;
    const amount = parseFloat(document.getElementById('pay-amount').value);
    const payment_type = document.getElementById('pay-type').value;
    const reference = document.getElementById('pay-ref').value.trim();
    const notes = document.getElementById('pay-notes').value.trim();

    if (isNaN(amount) || amount <= 0) {
      showToast('Ingresa un monto de abono válido mayor a 0', 'warning');
      return;
    }

    const currentDebt = parseFloat(selectedEmployeeForPay.current_debt || 0);
    if (amount > currentDebt && currentDebt > 0) {
      const confirmedExcess = await showConfirmModal({
        title: 'Monto en Exceso',
        message: `El monto ingresado ($${amount.toFixed(2)}) excede la deuda actual ($${currentDebt.toFixed(2)}).\n\n¿Deseas registrar un pago en exceso que generará saldo a favor del trabajador?`,
        confirmText: 'Continuar con Exceso',
        cancelText: 'Corregir Monto',
        type: 'warning'
      });
      if (!confirmedExcess) return;
    } else {
      const confirmedPay = await showConfirmModal({
        title: 'Confirmar Abono',
        message: `¿Confirmas el registro de este abono por $${amount.toFixed(2)} USD a la cuenta del trabajador?`,
        confirmText: 'Confirmar Abono',
        cancelText: 'Cancelar',
        type: 'info'
      });
      if (!confirmedPay) return;
    }

    const voucherFile = document.getElementById('pay-voucher')?.files?.[0];

    const formData = new FormData();
    formData.append('employee', empId);
    formData.append('amount', amount);
    formData.append('payment_type', payment_type);
    if (reference) formData.append('reference', reference);
    if (notes) formData.append('notes', notes);
    if (voucherFile) formData.append('voucher', voucherFile);

    showLoadingOverlay({
      title: 'Registrando Abono...',
      message: 'Aplicando abono y recalculando balance...',
      estimatedDuration: 1200
    });

    try {
      const res = await createDebtPayment(formData);
      await hideLoadingOverlay(true);

      // Actualizar deuda en memoria
      const idx = employeesList.findIndex(e => String(e.id) === String(empId));
      if (idx !== -1) {
        const newDebt = Math.max(0, currentDebt - amount);
        employeesList[idx].current_debt = newDebt;
      }

      paymentsList.unshift(res);
      updateMetrics();
      renderTable();
      closePaymentModal();
      showToast('Abono registrado y saldo actualizado con éxito', 'success');
    } catch (err) {
      await hideLoadingOverlay(false);
      console.error('Error al registrar abono:', err);
      showToast('Error al registrar el abono en el servidor', 'error');
    }
  });
}

// ============================================================================
// LIGHTBOX MODAL FOTO TRABAJADOR
// ============================================================================
function openLightbox(src, name) {
  const modal = document.getElementById('modal-image-lightbox');
  const fullImg = document.getElementById('lightbox-full-img');
  const caption = document.getElementById('lightbox-caption');
  if (!modal || !fullImg) return;

  fullImg.src = src;
  if (caption) caption.textContent = name || 'Foto del Trabajador';
  modal.classList.add('is-active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const modal = document.getElementById('modal-image-lightbox');
  if (!modal) return;
  modal.classList.remove('is-active');
  document.body.style.overflow = '';
}

// ============================================================================
// ELIMINAR TRABAJADOR
// ============================================================================
async function handleDeleteEmployee(employeeId, employeeName) {
  const confirmed = typeof showConfirmModal === 'function'
    ? await showConfirmModal({
        title: 'Eliminar Trabajador',
        message: `¿Confirmas la eliminación de "${employeeName}"?\n\nEsta acción es un borrado lógico. El historial de órdenes y abonos se conservará.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      })
    : confirm(`¿Eliminar trabajador "${employeeName}"?`);

  if (!confirmed) return;

  try {
    await deleteEmployee(employeeId);
    employeesList = employeesList.filter(e => String(e.id) !== String(employeeId));
    updateMetrics();
    renderTable();
    showToast(`Trabajador "${employeeName}" eliminado correctamente.`, 'success');
  } catch (err) {
    console.error('Error al eliminar trabajador:', err);
    const msg = err?.data?.detail || err?.message || 'Error al eliminar el trabajador.';
    showToast(msg, 'error');
  }
}

// ============================================================================
// ACTIVAR / DESACTIVAR TRABAJADOR
// ============================================================================
async function handleToggleStatus(employeeId) {
  const emp = employeesList.find(e => String(e.id) === String(employeeId));
  if (!emp) return;

  const action = emp.is_active ? 'desactivar' : 'activar';
  const fullName = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim();

  const confirmed = typeof showConfirmModal === 'function'
    ? await showConfirmModal({
        title: emp.is_active ? 'Desactivar Trabajador' : 'Activar Trabajador',
        message: `¿Confirmas ${action} a "${fullName}"?\n\n${emp.is_active ? 'El trabajador no podrá realizar compras en tienda.' : 'El trabajador podrá volver a realizar compras en tienda.'}`,
        confirmText: emp.is_active ? 'Desactivar' : 'Activar',
        cancelText: 'Cancelar',
        type: emp.is_active ? 'warning' : 'info'
      })
    : confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} a "${fullName}"?`);

  if (!confirmed) return;

  try {
    const res = await toggleEmployeeStatus(employeeId);
    const idx = employeesList.findIndex(e => String(e.id) === String(employeeId));
    if (idx !== -1) employeesList[idx].is_active = res.is_active;
    renderTable();
    showToast(res.detail || `Trabajador ${res.is_active ? 'activado' : 'desactivado'} correctamente.`, 'success');
  } catch (err) {
    console.error('Error al cambiar estado:', err);
    showToast('Error al cambiar el estado del trabajador.', 'error');
  }
}

// ============================================================================
// EDITAR TRABAJADOR (redirige a página de edición)
// ============================================================================
function openEditModal(employeeId) {
  window.location.href = `employee-edit.html?id=${employeeId}`;
}

// ============================================================================
// TOASTS
// ============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, match => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}
