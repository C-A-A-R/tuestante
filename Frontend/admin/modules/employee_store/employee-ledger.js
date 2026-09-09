/**
 * employee-ledger.js
 * Directorio de Trabajadores y Control de Cartera - TuEstante Admin
 */

import {
  fetchEmployees,
  fetchPayments,
  createDebtPayment,
  createEmployee
} from './employee-store.api.js';

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { getBcvRate } from '../../js/service/exchange-rate.service.js';
import { showConfirmModal } from '../../components/modal/modal.js';
import { resolveImageUrl } from '../../js/api.js';

// ============================================================================
// ESTADO
// ============================================================================
let currentExchangeRate = 80.00;
let employeesList = [];
let paymentsList = [];
let selectedEmployeeForPay = null;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminComponents({ title: 'Trabajadores' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load warning:', err);
  }

  await loadExchangeRate();
  setupEventListeners();
  await loadData();
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
    const docNumber = emp.id_number ? `CI: ${emp.id_number}` : 'Sin C.I.';

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
      <tr data-id="${emp.id}">
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
          <div class="table-actions" style="display: flex; gap: 8px; justify-content: flex-end;">
            <!-- Botón Resumen / Detalle Individual -->
            <a href="employee-statement.html?id=${emp.id}" class="btn btn-outline btn-sm" title="Consultar Resumen y Kardex" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>Resumen</span>
            </a>
            <!-- Botón Registrar Abono -->
            <button 
              type="button" 
              class="btn btn-primary btn-sm btn-open-payment" 
              data-id="${emp.id}" 
              title="Registrar Abono o Pago Inmediato"
              style="display: inline-flex; align-items: center; gap: 6px;"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
              <span>Abonar</span>
            </button>
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

  tableBody.querySelectorAll('.btn-open-payment').forEach(btn => {
    btn.addEventListener('click', () => {
      openPaymentModal(btn.dataset.id);
    });
  });

  tableBody.querySelectorAll('.emp-table-photo').forEach(img => {
    img.addEventListener('click', () => {
      openLightbox(img.dataset.photo, img.dataset.name);
    });
  });
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
  selectedEmployeeForPay = null;
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

  // Modal Pago
  document.getElementById('btn-close-payment')?.addEventListener('click', closePaymentModal);
  document.getElementById('btn-cancel-payment')?.addEventListener('click', closePaymentModal);
  document.getElementById('pay-amount')?.addEventListener('input', updatePayVesPreview);

  // Modal Lightbox Foto
  document.getElementById('btn-close-lightbox')?.addEventListener('click', closeLightbox);
  const modalLightbox = document.getElementById('modal-image-lightbox');
  if (modalLightbox) {
    modalLightbox.addEventListener('click', (e) => {
      if (e.target === modalLightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  // Modal Registrar Empleado
  const modalRegister = document.getElementById('modal-register-employee');
  const openRegisterBtn = document.getElementById('btn-open-register-employee');
  const closeRegisterBtn = document.getElementById('btn-close-register-modal');
  const cancelRegisterBtn = document.getElementById('btn-cancel-register');
  const formRegister = document.getElementById('form-register-employee');

  const openRegisterModal = () => {
    formRegister?.reset();
    if (modalRegister) modalRegister.classList.add('is-active');
  };

  const closeRegisterModal = () => {
    if (modalRegister) modalRegister.classList.remove('is-active');
  };

  openRegisterBtn?.addEventListener('click', openRegisterModal);
  closeRegisterBtn?.addEventListener('click', closeRegisterModal);
  cancelRegisterBtn?.addEventListener('click', closeRegisterModal);

  // Envío Formulario Registro de Empleado
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('reg-first-name').value.trim();
    const lastName = document.getElementById('reg-last-name').value.trim();
    const doc = document.getElementById('reg-doc').value.trim();
    const empNum = document.getElementById('reg-emp-number').value.trim();
    const dept = document.getElementById('reg-dept').value.trim();
    const pos = document.getElementById('reg-pos').value.trim();
    const salary = parseFloat(document.getElementById('reg-salary').value);
    const email = document.getElementById('reg-email').value.trim();

    if (!firstName || !lastName || !doc || !empNum || !dept || !pos || isNaN(salary)) {
      showToast('Por favor completa todos los campos obligatorios (*)', 'warning');
      return;
    }

    const confirmed = await showConfirmModal({
      title: 'Registrar Nuevo Trabajador',
      message: `¿Deseas registrar a ${firstName} ${lastName} (Ficha: ${empNum}) en la nómina de trabajadores?`,
      confirmText: 'Registrar Trabajador',
      cancelText: 'Cancelar',
      type: 'info'
    });
    if (!confirmed) return;

    const payload = {
      first_name: firstName,
      last_name: lastName,
      identity_document: doc,
      employee_number: empNum,
      department: dept,
      position: pos,
      salary: salary,
      email: email || undefined,
      is_active: true
    };

    try {
      const newEmp = await createEmployee(payload);
      employeesList.unshift(newEmp);
      updateMetrics();
      renderTable();
      closeRegisterModal();
      showToast(`Trabajador ${firstName} ${lastName} registrado con éxito`, 'success');
    } catch (err) {
      console.error('Error registrando empleado:', err);
      const errMsg = err?.message || 'Error al registrar el trabajador en el servidor';
      showToast(errMsg, 'error');
    }
  });

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

    const payload = {
      employee: empId,
      amount,
      payment_type,
      reference,
      notes
    };

    try {
      const res = await createDebtPayment(payload);
      
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
