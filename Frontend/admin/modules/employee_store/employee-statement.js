import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * employee-statement.js
 * Detalle y Resumen de Trabajador (Kardex y Estado de Cuenta) - TuEstante Admin
 */

import {
  fetchEmployees,
  fetchEmployeeStatement,
  createDebtPayment,
  updateEmployee
} from './employee-store.api.js';

import { getBcvRate } from '../../js/service/exchange-rate.service.js';
import { showConfirmModal, showLoadingOverlay, hideLoadingOverlay } from '../../components/modal/modal.js';
import { resolveImageUrl } from '../../js/api.js';

// ============================================================================
// ESTADO
// ============================================================================
let currentExchangeRate = 80.00;
let employeesList = [];
let selectedEmployeeId = null;
let currentStatementData = null;
let isEditMode = false;
let currentWorkerPhoto = null;
let currentWorkerName = '';

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminComponents({ title: 'Resumen del Trabajador' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load error:', err);
  }

  await loadExchangeRate();
  setupEventListeners();
  await initializeWorkerSelection();
});

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

async function initializeWorkerSelection() {
  try {
    const res = await fetchEmployees();
    employeesList = Array.isArray(res) ? res : (res.results || []);

    const select = document.getElementById('select-worker-switch');
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleccionar Trabajador --</option>';
    employeesList.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      const debt = parseFloat(emp.current_debt || 0);
      const debtNotice = debt > 0 ? ` [Deuda: $${debt.toFixed(2)}]` : ' [Al Día]';
      opt.textContent = `${emp.employee_number || 'S/N'} - ${emp.full_name || emp.name}${debtNotice}`;
      select.appendChild(opt);
    });

    // Revisar si viene ?id=X en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get('id');

    if (paramId && employeesList.some(e => String(e.id) === String(paramId))) {
      selectedEmployeeId = paramId;
      select.value = paramId;
    } else if (employeesList.length > 0) {
      // Priorizar el primer empleado con deuda o el primero de la lista
      const withDebt = employeesList.find(e => parseFloat(e.current_debt || 0) > 0);
      const defaultEmp = withDebt || employeesList[0];
      selectedEmployeeId = defaultEmp.id;
      select.value = defaultEmp.id;
    }

    if (selectedEmployeeId) {
      await loadEmployeeStatement(selectedEmployeeId);
    }
  } catch (err) {
    console.error('Error cargando empleados:', err);
    showToast('Error al obtener lista de trabajadores', 'error');
  }
}

// ============================================================================
// CARGA Y GENERACIÓN DEL KARDEX
// ============================================================================
async function loadEmployeeStatement(employeeId) {
  const tbody = document.getElementById('tbody-kardex');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">
          Consultando registros contables y despachos...
        </td>
      </tr>
    `;
  }

  try {
    const data = await fetchEmployeeStatement(employeeId);
    currentStatementData = data;
    renderWorkerProfile(data.employee);
    renderKardexLedger(data);
  } catch (err) {
    console.error('Error cargando estado de cuenta:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: #dc2626;">
            Error al consultar el estado de cuenta del trabajador.
          </td>
        </tr>
      `;
    }
    showToast('No se pudo cargar el Kardex del trabajador', 'error');
  }
}

function renderWorkerProfile(emp) {
  if (!emp) return;

  const fullName = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`;
  const debtUSD = parseFloat(emp.current_debt || 0);
  const debtVES = debtUSD * currentExchangeRate;
  const salary = parseFloat(emp.salary || 0);

  currentWorkerName = fullName;
  const avatarIcon = document.getElementById('worker-avatar-icon');
  if (emp.photo) {
    currentWorkerPhoto = resolveImageUrl(emp.photo);
    if (avatarIcon) {
      avatarIcon.innerHTML = `<img src="${escapeHtml(currentWorkerPhoto)}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }
  } else {
    currentWorkerPhoto = null;
    if (avatarIcon) {
      avatarIcon.innerHTML = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    }
  }

  // Actualizar enlaces directos a la edición completa
  const linkEdit = document.getElementById('link-full-employee-edit');
  if (linkEdit && emp.id) {
    linkEdit.href = `employee-edit.html?id=${emp.id}`;
  }
  const btnLightboxEdit = document.getElementById('btn-statement-lightbox-edit');
  if (btnLightboxEdit && emp.id) {
    btnLightboxEdit.href = `employee-edit.html?id=${emp.id}`;
  }

  document.getElementById('worker-name').textContent = fullName;
  document.getElementById('worker-code').textContent = `Ficha: ${emp.employee_number || 'S/F'}`;
  document.getElementById('worker-doc').textContent = `C.I: ${emp.id_number || 'S/D'}`;

  const birthPill = document.getElementById('worker-birth');
  if (birthPill) {
    if (emp.birth_date) {
      const [by, bm, bd] = emp.birth_date.split('-');
      const today = new Date();
      let age = today.getFullYear() - Number(by);
      const mDiff = today.getMonth() - (Number(bm) - 1);
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < Number(bd))) age--;
      birthPill.textContent = `🎂 F. Nac: ${bd}/${bm}/${by} (${age} años)`;
      birthPill.style.display = 'inline-flex';
    } else {
      birthPill.textContent = `🎂 F. Nac: No registrada`;
      birthPill.style.display = 'inline-flex';
    }
  }

  document.getElementById('worker-dept').textContent = `Depto: ${emp.department || 'General'}`;
  document.getElementById('worker-pos').textContent = `Cargo: ${emp.position || 'Colaborador'}`;
  document.getElementById('worker-salary').textContent = `$${salary.toFixed(2)}`;

  document.getElementById('worker-current-debt').textContent = `$${debtUSD.toFixed(2)}`;
  document.getElementById('worker-current-debt-ves').textContent = `Bs. ${debtVES.toFixed(2)}`;

  const statusTag = document.getElementById('worker-debt-status');
  if (statusTag) {
    if (debtUSD > 0.01) {
      statusTag.textContent = 'SALDO PENDIENTE';
      statusTag.className = 'debt-status-tag status-debt';
    } else {
      statusTag.textContent = 'AL DÍA';
      statusTag.className = 'debt-status-tag';
    }
  }

  // Sincronizar datos de la hoja de impresión oficial
  document.getElementById('print-worker-name').textContent = fullName;
  document.getElementById('print-worker-code').textContent = emp.employee_number || 'S/F';
  document.getElementById('print-worker-doc').textContent = emp.id_number || 'S/D';
  document.getElementById('print-worker-dept').textContent = emp.department || 'General';
  document.getElementById('print-worker-pos').textContent = emp.position || 'Colaborador';
  document.getElementById('print-worker-debt').textContent = `$${debtUSD.toFixed(2)} (Bs. ${debtVES.toFixed(2)})`;
  document.getElementById('print-sign-worker-name').textContent = fullName;
}

function openStatementLightbox() {
  const modal = document.getElementById('modal-statement-photo-lightbox');
  const img = document.getElementById('img-statement-lightbox-full');
  const caption = document.getElementById('statement-lightbox-caption');

  if (!currentWorkerPhoto) {
    // Si no tiene foto, redirigir a editar trabajador para cargar una
    if (selectedEmployeeId) {
      window.location.href = `employee-edit.html?id=${selectedEmployeeId}`;
    }
    return;
  }

  if (img) img.src = currentWorkerPhoto;
  if (caption) caption.textContent = currentWorkerName ? `Fotografía: ${currentWorkerName}` : 'Fotografía del Trabajador';
  if (modal) {
    modal.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }
}

function closeStatementLightbox() {
  const modal = document.getElementById('modal-statement-photo-lightbox');
  if (modal) {
    modal.classList.remove('is-active');
    document.body.style.overflow = '';
  }
}

function renderKardexLedger(statementData) {
  const tbody = document.getElementById('tbody-kardex');
  const printTbody = document.getElementById('print-kardex-tbody');
  if (!tbody) return;

  const orders = statementData.orders || [];
  const payments = statementData.payments || [];

  // Construir lista unificada de transacciones
  const transactions = [];

  // 1. Despachos / Órdenes (Cargos +)
  orders.forEach(o => {
    const isCancelled = o.status === 'CANCELLED';
    const itemsSummary = (o.items || []).map(it => `${it.quantity}x ${it.product_name || 'Item'}`).join(', ') || 'Consumo en proveeduría';
    
    let badgeLabel = '🛒 Despacho Entregado';
    if (isCancelled) {
      badgeLabel = 'Orden Anulada';
    } else if (o.status === 'UNDELIVERED') {
      badgeLabel = '⏳ Pedido (Sin entregar)';
    } else if (o.status === 'PAID') {
      badgeLabel = '✅ Despacho Pagado';
    }

    const stmtOrderNum = o.order_number || `ORD-INT${String(o.id).padStart(4, '0')}-${new Date(o.created_at).getFullYear()}`;
    transactions.push({
      date: new Date(o.created_at),
      dateStr: o.created_at,
      type: isCancelled ? 'CANCELLED' : 'ORDER',
      badgeLabel: badgeLabel,
      badgeClass: isCancelled ? 'type-cancelled' : 'type-order',
      refNumber: stmtOrderNum,
      concept: itemsSummary,
      cargo: isCancelled ? 0 : parseFloat(o.total_amount || 0),
      abono: 0
    });
  });

  // 2. Abonos / Pagos (Abonos -)
  payments.forEach(p => {
    let method = 'Abono a Cuenta';
    if (p.payment_type === 'PAYROLL_DEDUCTION') method = 'Deducción de Nómina';
    else if (p.payment_type === 'CASH') method = 'Efectivo en Almacén';
    else if (p.payment_type === 'TRANSFER') method = 'Transferencia Bancaria';

    transactions.push({
      date: new Date(p.created_at),
      dateStr: p.created_at,
      type: 'PAYMENT',
      badgeLabel: '💵 Abono / Pago',
      badgeClass: 'type-payment',
      refNumber: p.reference || `#PAY-${String(p.id).padStart(4, '0')}`,
      concept: `${method}${p.notes ? ` (${p.notes})` : ''}`,
      cargo: 0,
      abono: parseFloat(p.amount || 0)
    });
  });

  // Ordenar cronológicamente ascendente para calcular el saldo acumulado progresivo
  transactions.sort((a, b) => a.date - b.date);

  if (transactions.length === 0) {
    const emptyRow = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">
          El colaborador no registra consumos ni pagos en su historial.
        </td>
      </tr>
    `;
    tbody.innerHTML = emptyRow;
    if (printTbody) printTbody.innerHTML = emptyRow;
    return;
  }

  let runningBalance = 0;
  let rowsHtml = '';
  let printRowsHtml = '';

  transactions.forEach(tx => {
    if (tx.type === 'ORDER') {
      runningBalance += tx.cargo;
    } else if (tx.type === 'PAYMENT') {
      runningBalance = Math.max(0, runningBalance - tx.abono);
    }

    const formattedDate = formatDate(tx.dateStr);

    rowsHtml += `
      <tr>
        <td><span style="font-size: 0.82rem; color: #64748b;">${formattedDate}</span></td>
        <td><span class="badge-kardex-type ${tx.badgeClass}">${tx.badgeLabel}</span></td>
        <td><span style="font-family: monospace; font-weight: 700; color: #005187;">${escapeHtml(tx.refNumber)}</span></td>
        <td><div style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(tx.concept)}">${escapeHtml(tx.concept)}</div></td>
        <td style="text-align: right;">${tx.cargo > 0 ? `<span class="cell-cargo">+$${tx.cargo.toFixed(2)}</span>` : '-'}</td>
        <td style="text-align: right;">${tx.abono > 0 ? `<span class="cell-abono">-$${tx.abono.toFixed(2)}</span>` : '-'}</td>
        <td style="text-align: right;"><span class="cell-balance">$${runningBalance.toFixed(2)}</span></td>
      </tr>
    `;

    printRowsHtml += `
      <tr>
        <td>${formattedDate}</td>
        <td>${tx.type === 'ORDER' ? 'CARGO' : (tx.type === 'PAYMENT' ? 'ABONO' : 'ANULACIÓN')}</td>
        <td>${escapeHtml(tx.refNumber)}</td>
        <td>${escapeHtml(tx.concept.substring(0, 45))}</td>
        <td style="text-align: right;">${tx.cargo > 0 ? `$${tx.cargo.toFixed(2)}` : '-'}</td>
        <td style="text-align: right;">${tx.abono > 0 ? `$${tx.abono.toFixed(2)}` : '-'}</td>
        <td style="text-align: right;"><strong>$${runningBalance.toFixed(2)}</strong></td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;
  if (printTbody) printTbody.innerHTML = printRowsHtml;
}

// ============================================================================
// MODAL DE REGISTRO DE ABONO (DebtPayment)
// ============================================================================
function openPaymentModal() {
  if (!currentStatementData || !currentStatementData.employee) {
    showToast('Selecciona un trabajador primero', 'warning');
    return;
  }

  const emp = currentStatementData.employee;
  const fullName = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`;
  const debtUSD = parseFloat(emp.current_debt || 0);

  document.getElementById('pay-emp-id').value = emp.id;
  document.getElementById('pay-emp-name').textContent = fullName;
  document.getElementById('pay-emp-doc').textContent = `Ficha: ${emp.employee_number || 'S/F'}`;
  document.getElementById('pay-emp-debt').textContent = `$${debtUSD.toFixed(2)}`;

  const amountInput = document.getElementById('pay-amount');
  amountInput.value = debtUSD > 0 ? debtUSD.toFixed(2) : '0.00';
  updatePayVesPreview();

  document.getElementById('pay-ref').value = '';
  document.getElementById('pay-notes').value = '';

  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.add('is-active');
  amountInput.focus();
}

function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.remove('is-active');
  document.getElementById('payment-form')?.reset();
  resetPayVoucherPreview();
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
  const vesPreview = document.getElementById('pay-live-ves');
  if (vesPreview) {
    const ves = amountUSD * currentExchangeRate;
    vesPreview.textContent = `Equivalente: Bs. ${ves.toFixed(2)} (Tasa: ${currentExchangeRate.toFixed(2)})`;
  }
}

// ============================================================================
// EDICIÓN DE DATOS DEL TRABAJADOR
// ============================================================================
function toggleWorkerEditMode(forceState) {
  isEditMode = typeof forceState === 'boolean' ? forceState : !isEditMode;
  const viewModeEl = document.getElementById('worker-view-mode');
  const editModeEl = document.getElementById('worker-edit-mode');
  const toggleBtnText = document.getElementById('toggle-edit-btn-text');

  if (!viewModeEl || !editModeEl) return;

  if (isEditMode) {
    const emp = currentStatementData?.employee;
    if (!emp) {
      showToast('Selecciona un trabajador primero', 'warning');
      return;
    }

    document.getElementById('input-edit-first-name').value = emp.first_name || '';
    document.getElementById('input-edit-last-name').value = emp.last_name || '';
    document.getElementById('input-edit-doc').value = emp.id_number || emp.identity_document || '';
    const inputEditBirth = document.getElementById('input-edit-birth-date');
    if (inputEditBirth) inputEditBirth.value = emp.birth_date || '';
    document.getElementById('input-edit-code').value = emp.employee_number || '';
    document.getElementById('input-edit-dept').value = emp.department || '';
    document.getElementById('input-edit-pos').value = emp.position || '';
    document.getElementById('input-edit-salary').value = emp.salary || '0.00';
    document.getElementById('select-edit-active').value = emp.is_active !== false ? 'true' : 'false';

    viewModeEl.style.display = 'none';
    editModeEl.style.display = 'block';
    if (toggleBtnText) toggleBtnText.textContent = 'Cancelar Edición';
  } else {
    viewModeEl.style.display = 'flex';
    editModeEl.style.display = 'none';
    if (toggleBtnText) toggleBtnText.textContent = 'Editar Datos';
  }
}

async function saveWorkerEdits() {
  if (!currentStatementData?.employee || !selectedEmployeeId) return;

  const firstName = document.getElementById('input-edit-first-name').value.trim();
  const lastName = document.getElementById('input-edit-last-name').value.trim();
  const doc = document.getElementById('input-edit-doc').value.trim();
  const birthDateInput = document.getElementById('input-edit-birth-date');
  const birthDate = birthDateInput?.value || '';
  const empCode = document.getElementById('input-edit-code').value.trim();
  const dept = document.getElementById('input-edit-dept').value.trim();
  const pos = document.getElementById('input-edit-pos').value.trim();
  const salary = parseFloat(document.getElementById('input-edit-salary').value);
  const isActive = document.getElementById('select-edit-active').value === 'true';

  if (!empCode || !dept || !pos || isNaN(salary)) {
    showToast('Ficha, departamento, cargo y salario son requeridos', 'warning');
    return;
  }

  // Validación de fecha de nacimiento si se indica
  if (birthDate) {
    const parts = birthDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0])) {
      const [y, m, d] = parts;
      const bDate = new Date(y, m - 1, d);
      const today = new Date();
      if (bDate > today) {
        showToast('La fecha de nacimiento no puede ser una fecha futura.', 'warning');
        birthDateInput?.focus();
        return;
      }
      let age = today.getFullYear() - y;
      const mDiff = today.getMonth() - (m - 1);
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) age--;
      if (age < 15) {
        showToast('El trabajador debe tener al menos 15 años cumplidos.', 'warning');
        birthDateInput?.focus();
        return;
      }
      if (age > 100) {
        showToast('Fecha de nacimiento no válida (edad superior a 100 años).', 'warning');
        birthDateInput?.focus();
        return;
      }
    }
  }

  const confirmed = await showConfirmModal({
    title: 'Guardar Cambios del Trabajador',
    message: `¿Confirmas la actualización de los datos del trabajador ${firstName} ${lastName}?`,
    confirmText: 'Guardar Cambios',
    cancelText: 'Cancelar',
    type: 'info'
  });
  if (!confirmed) return;

  const payload = {
    first_name: firstName,
    last_name: lastName,
    identity_document: doc,
    birth_date: birthDate || null,
    employee_number: empCode,
    department: dept,
    position: pos,
    salary: salary,
    is_active: isActive
  };

  showLoadingOverlay({
    title: 'Actualizando Colaborador...',
    message: 'Guardando modificaciones del perfil en el sistema...',
    estimatedDuration: 1200
  });

  try {
    const updated = await updateEmployee(selectedEmployeeId, payload);
    await hideLoadingOverlay(true);
    currentStatementData.employee = { ...currentStatementData.employee, ...updated };
    renderWorkerProfile(currentStatementData.employee);
    toggleWorkerEditMode(false);
    showToast('Datos del trabajador actualizados con éxito', 'success');
  } catch (err) {
    await hideLoadingOverlay(false);
    console.error('Error actualizando trabajador:', err);
    showToast('Error al actualizar datos del trabajador', 'error');
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Selector de trabajador
  document.getElementById('select-worker-switch')?.addEventListener('change', async (e) => {
    const newId = e.target.value;
    if (newId) {
      selectedEmployeeId = newId;
      toggleWorkerEditMode(false);
      // Actualizar query param sin recargar
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('id', newId);
      window.history.pushState({}, '', newUrl);

      await loadEmployeeStatement(newId);
    }
  });

  // Toggle y Guardado de Edición de Trabajador
  document.getElementById('btn-toggle-edit-mode')?.addEventListener('click', () => toggleWorkerEditMode());
  document.getElementById('btn-cancel-edit-worker')?.addEventListener('click', () => toggleWorkerEditMode(false));
  document.getElementById('btn-save-edit-worker')?.addEventListener('click', saveWorkerEdits);

  // Botón Imprimir
  document.getElementById('btn-print-statement')?.addEventListener('click', () => {
    const printDate = document.getElementById('print-sheet-date');
    const printRate = document.getElementById('print-sheet-rate');
    if (printDate) printDate.textContent = formatDate(new Date().toISOString());
    if (printRate) printRate.textContent = `Bs. ${currentExchangeRate.toFixed(2)} / USD`;
    window.print();
  });

  // Modal Pago
  setupPayVoucherEvents();
  document.getElementById('btn-open-payment-modal')?.addEventListener('click', openPaymentModal);
  document.getElementById('btn-close-payment')?.addEventListener('click', closePaymentModal);
  document.getElementById('btn-cancel-payment')?.addEventListener('click', closePaymentModal);
  document.getElementById('pay-amount')?.addEventListener('input', updatePayVesPreview);

  // Formulario Pago Submit
  document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const empId = document.getElementById('pay-emp-id').value;
    const amount = parseFloat(document.getElementById('pay-amount').value);
    const payment_type = document.getElementById('pay-type').value;
    const reference = document.getElementById('pay-ref').value.trim();
    const notes = document.getElementById('pay-notes').value.trim();
    const voucherFile = document.getElementById('pay-voucher')?.files?.[0];

    if (isNaN(amount) || amount <= 0) {
      showToast('Ingresa un monto de abono válido mayor a 0', 'warning');
      return;
    }

    const confirmed = await showConfirmModal({
      title: 'Confirmar Abono',
      message: `¿Confirmas el registro de este abono por $${amount.toFixed(2)} USD a la cuenta de este trabajador?`,
      confirmText: 'Registrar Abono',
      cancelText: 'Cancelar',
      type: 'info'
    });
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('employee', empId);
    formData.append('amount', amount);
    formData.append('payment_type', payment_type);
    if (reference) formData.append('reference', reference);
    if (notes) formData.append('notes', notes);
    if (voucherFile) formData.append('voucher', voucherFile);

    try {
      showLoadingOverlay({
        title: 'Procesando Abono',
        message: 'Registrando abono y actualizando estado de cuenta...',
        estimatedDuration: 1500
      });
      await createDebtPayment(formData);
      hideLoadingOverlay(true);
      showToast('Abono registrado exitosamente', 'success');
      closePaymentModal();
      // Recargar Kardex actualizado
      await loadEmployeeStatement(empId);
    } catch (err) {
      hideLoadingOverlay(false);
      console.error('Error guardando abono:', err);
      showToast('Error al registrar el abono', 'error');
    }
  });

  // Lightbox de Fotografía de Perfil
  document.getElementById('btn-worker-avatar')?.addEventListener('click', openStatementLightbox);
  document.getElementById('btn-close-statement-lightbox')?.addEventListener('click', closeStatementLightbox);
  
  const modalLightbox = document.getElementById('modal-statement-photo-lightbox');
  if (modalLightbox) {
    modalLightbox.addEventListener('click', (e) => {
      if (e.target === modalLightbox) closeStatementLightbox();
    });
  }

  // Cerrar lightbox con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeStatementLightbox();
    }
  });
}

// ============================================================================
// HELPERS
// ============================================================================
function formatDate(isoStr) {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

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
