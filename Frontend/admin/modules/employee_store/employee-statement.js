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
import { showConfirmModal } from '../../components/modal/modal.js';

// ============================================================================
// ESTADO
// ============================================================================
let currentExchangeRate = 80.00;
let employeesList = [];
let selectedEmployeeId = null;
let currentStatementData = null;
let isEditMode = false;

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

  document.getElementById('worker-name').textContent = fullName;
  document.getElementById('worker-code').textContent = `Ficha: ${emp.employee_number || 'S/F'}`;
  document.getElementById('worker-doc').textContent = `C.I: ${emp.id_number || 'S/D'}`;
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
  const empCode = document.getElementById('input-edit-code').value.trim();
  const dept = document.getElementById('input-edit-dept').value.trim();
  const pos = document.getElementById('input-edit-pos').value.trim();
  const salary = parseFloat(document.getElementById('input-edit-salary').value);
  const isActive = document.getElementById('select-edit-active').value === 'true';

  if (!empCode || !dept || !pos || isNaN(salary)) {
    showToast('Ficha, departamento, cargo y salario son requeridos', 'warning');
    return;
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
    employee_number: empCode,
    department: dept,
    position: pos,
    salary: salary,
    is_active: isActive
  };

  try {
    const updated = await updateEmployee(selectedEmployeeId, payload);
    currentStatementData.employee = { ...currentStatementData.employee, ...updated };
    renderWorkerProfile(currentStatementData.employee);
    toggleWorkerEditMode(false);
    showToast('Datos del trabajador actualizados con éxito', 'success');
  } catch (err) {
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

    const payload = {
      employee: empId,
      amount,
      payment_type,
      reference,
      notes
    };

    try {
      await createDebtPayment(payload);
      showToast('Abono registrado exitosamente', 'success');
      closePaymentModal();
      // Recargar Kardex actualizado
      await loadEmployeeStatement(empId);
    } catch (err) {
      console.error('Error guardando abono:', err);
      showToast('Error al registrar el abono', 'error');
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
