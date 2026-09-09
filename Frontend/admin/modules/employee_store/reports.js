import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * reports.js
 * Generador de Cortes de Nómina y Conciliación RRHH - TuEstante Admin
 */

import {
  fetchSettlementReport,
  createDebtPayment
} from './employee-store.api.js';

import { getBcvRate } from '../../js/service/exchange-rate.service.js';

// ============================================================================
// ESTADO
// ============================================================================
let currentExchangeRate = 80.00;
let currentReportData = null;
let currentReportList = [];

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminComponents({ title: 'Cortes de Nómina y Conciliación' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load error:', err);
  }

  await loadExchangeRate();
  setupEventListeners();
  setFortnightRange();
  await loadReport();
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

// ============================================================================
// RANGOS DE FECHAS AUTOMÁTICOS
// ============================================================================
function setFortnightRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();

  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');

  if (day <= 15) {
    startInput.value = `${year}-${month}-01`;
    endInput.value = `${year}-${month}-15`;
  } else {
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    startInput.value = `${year}-${month}-16`;
    endInput.value = `${year}-${month}-${lastDay}`;
  }
}

function setMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

  document.getElementById('start-date').value = `${year}-${month}-01`;
  document.getElementById('end-date').value = `${year}-${month}-${lastDay}`;
}

// ============================================================================
// CARGA Y CONSULTA DE CORTE
// ============================================================================
async function loadReport() {
  const start_date = document.getElementById('start-date')?.value;
  const end_date = document.getElementById('end-date')?.value;
  const tableBody = document.getElementById('report-table-body');
  const periodText = document.getElementById('report-period-text');

  if (!start_date || !end_date) {
    showToast('Selecciona un rango de fechas válido', 'warning');
    return;
  }

  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #64748b;">Generando pre-liquidación del corte...</td></tr>';
  }

  if (periodText) {
    periodText.textContent = `Período comprendido desde el ${start_date} hasta el ${end_date}`;
  }

  try {
    const report = await fetchSettlementReport({ start_date, end_date });
    currentReportData = report;
    currentReportList = report.data || [];

    populateDepartmentFilter();
    updateSummaryKpis();
    renderReportTable();
  } catch (err) {
    console.error('Error al generar reporte:', err);
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #dc2626;">Error al consultar datos de liquidación del servidor.</td></tr>';
    }
    showToast('Error al consultar corte de nómina', 'error');
  }
}

function populateDepartmentFilter() {
  const deptSelect = document.getElementById('filter-department');
  if (!deptSelect) return;

  const currentVal = deptSelect.value;
  const departments = [...new Set(currentReportList.map(item => item.department || 'General'))].sort();

  deptSelect.innerHTML = '<option value="all">Todos los departamentos</option>';
  departments.forEach(dept => {
    const opt = document.createElement('option');
    opt.value = dept;
    opt.textContent = dept;
    deptSelect.appendChild(opt);
  });

  if (currentVal && departments.includes(currentVal)) {
    deptSelect.value = currentVal;
  }
}

function updateSummaryKpis() {
  if (!currentReportData) return;

  const deptFilter = document.getElementById('filter-department')?.value || 'all';
  const onlyWithBalance = document.getElementById('filter-only-with-balance')?.checked ?? true;

  const filtered = currentReportList.filter(item => {
    if (deptFilter !== 'all' && item.department !== deptFilter) return false;
    const net = parseFloat(item.period_net_balance || 0);
    if (onlyWithBalance && net <= 0.01) return false;
    return true;
  });

  let ordersTotal = 0;
  let paymentsTotal = 0;
  let netTotal = 0;
  let ordersCount = 0;

  filtered.forEach(item => {
    ordersTotal += parseFloat(item.period_orders_total || 0);
    paymentsTotal += parseFloat(item.period_payments_total || 0);
    netTotal += parseFloat(item.period_net_balance || 0);
    ordersCount += parseInt(item.period_orders_count || 0, 10);
  });

  const netTotalVES = netTotal * currentExchangeRate;

  document.getElementById('kpi-total-employees').textContent = filtered.length;
  document.getElementById('kpi-orders-total').textContent = `$${ordersTotal.toFixed(2)}`;
  document.getElementById('kpi-orders-count').textContent = `${ordersCount} órdenes emitidas`;
  document.getElementById('kpi-payments-total').textContent = `$${paymentsTotal.toFixed(2)}`;
  document.getElementById('kpi-net-total').textContent = `$${netTotal.toFixed(2)}`;
  document.getElementById('kpi-net-total-ves').textContent = `Bs. ${netTotalVES.toFixed(2)} (Tasa BCV: ${currentExchangeRate.toFixed(2)})`;
}

// ============================================================================
// RENDERIZADO DE TABLA DE PRE-LIQUIDACIÓN
// ============================================================================
function renderReportTable() {
  const tableBody = document.getElementById('report-table-body');
  if (!tableBody) return;

  const deptFilter = document.getElementById('filter-department')?.value || 'all';
  const onlyWithBalance = document.getElementById('filter-only-with-balance')?.checked ?? true;

  const filtered = currentReportList.filter(item => {
    if (deptFilter !== 'all' && item.department !== deptFilter) return false;
    const net = parseFloat(item.period_net_balance || 0);
    if (onlyWithBalance && net <= 0.01) return false;
    return true;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: #64748b;">
          No se encontraron deducciones para los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(item => {
    const salary = parseFloat(item.salary || 0);
    const ordersTotal = parseFloat(item.period_orders_total || 0);
    const paymentsTotal = parseFloat(item.period_payments_total || 0);
    const netPeriod = parseFloat(item.period_net_balance || 0);
    const netVES = netPeriod * currentExchangeRate;
    const totalDebt = parseFloat(item.current_total_debt || 0);

    // Calcular porcentaje de retención sobre salario
    let pctSalary = 0;
    if (salary > 0) {
      pctSalary = (netPeriod / salary) * 100;
    }

    let pctBadge = '';
    if (pctSalary > 30) {
      pctBadge = `<span class="salary-pct-badge pct-danger" title="Atención: Supera el 30% del salario base">⚠️ ${pctSalary.toFixed(1)}%</span>`;
    } else if (pctSalary > 0) {
      pctBadge = `<span class="salary-pct-badge pct-safe">${pctSalary.toFixed(1)}%</span>`;
    } else {
      pctBadge = `<span style="color: #94a3b8; font-size: 0.78rem;">0%</span>`;
    }

    return `
      <tr>
        <td>
          <span class="worker-code-pill">${escapeHtml(item.employee_number || 'S/F')}</span>
        </td>
        <td>
          <strong>${escapeHtml(item.full_name)}</strong>
        </td>
        <td>
          <span>${escapeHtml(item.department || 'General')}</span>
          <br><small style="color: #64748b;">${escapeHtml(item.position || '')}</small>
        </td>
        <td>
          <strong>$${salary.toFixed(2)}</strong>
        </td>
        <td style="text-align: center; font-weight: 600;">
          ${item.period_orders_count || 0}
        </td>
        <td>
          $${ordersTotal.toFixed(2)}
        </td>
        <td style="color: #16a34a; font-weight: 600;">
          $${paymentsTotal.toFixed(2)}
        </td>
        <td>
          <div class="net-deduction-cell">
            <span class="net-usd">$${netPeriod.toFixed(2)}</span>
            <span class="net-ves">Bs. ${netVES.toFixed(2)}</span>
          </div>
        </td>
        <td style="text-align: center;">
          ${pctBadge}
        </td>
        <td>
          <strong class="${totalDebt > 0 ? 'text-danger' : ''}">$${totalDebt.toFixed(2)}</strong>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// EXPORTAR ARCHIVO DE DEDUCCIONES (CSV / EXCEL)
// ============================================================================
function exportCsv() {
  if (!currentReportData || currentReportList.length === 0) {
    showToast('No hay datos disponibles para exportar', 'warning');
    return;
  }

  const deptFilter = document.getElementById('filter-department')?.value || 'all';
  const onlyWithBalance = document.getElementById('filter-only-with-balance')?.checked ?? true;

  const filtered = currentReportList.filter(item => {
    if (deptFilter !== 'all' && item.department !== deptFilter) return false;
    const net = parseFloat(item.period_net_balance || 0);
    if (onlyWithBalance && net <= 0.01) return false;
    return true;
  });

  if (filtered.length === 0) {
    showToast('No hay registros coincidentes con los filtros para exportar', 'warning');
    return;
  }

  const headers = [
    'Ficha Empleado',
    'Nombre Completo',
    'Departamento',
    'Cargo',
    'Salario Base ($)',
    'Cant. Ordenes',
    'Consumo Periodo ($)',
    'Abonos Periodo ($)',
    'Neto a Deducir ($)',
    'Neto a Deducir (Bs. BCV)',
    'Porcentaje Salario (%)',
    'Deuda Total Acumulada ($)'
  ];

  const rows = filtered.map(item => {
    const salary = parseFloat(item.salary || 0);
    const netPeriod = parseFloat(item.period_net_balance || 0);
    const netVES = netPeriod * currentExchangeRate;
    const pct = salary > 0 ? ((netPeriod / salary) * 100).toFixed(2) : '0.00';

    return [
      `"${item.employee_number || ''}"`,
      `"${item.full_name || ''}"`,
      `"${item.department || ''}"`,
      `"${item.position || ''}"`,
      salary.toFixed(2),
      item.period_orders_count || 0,
      parseFloat(item.period_orders_total || 0).toFixed(2),
      parseFloat(item.period_payments_total || 0).toFixed(2),
      netPeriod.toFixed(2),
      netVES.toFixed(2),
      pct,
      parseFloat(item.current_total_debt || 0).toFixed(2)
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const start_date = document.getElementById('start-date')?.value || 'inicio';
  const end_date = document.getElementById('end-date')?.value || 'fin';

  link.setAttribute('href', url);
  link.setAttribute('download', `deducciones_nomina_${start_date}_al_${end_date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Archivo CSV generado y descargado exitosamente', 'success');
}

// ============================================================================
// CORTE MASIVO DE NÓMINA (LIQUIDACIÓN BATCH)
// ============================================================================
function openBulkDeductionModal() {
  if (!currentReportList || currentReportList.length === 0) {
    showToast('Genera un corte de nómina primero', 'warning');
    return;
  }

  // Filtrar solo trabajadores con saldo neto a retener > 0
  const workersWithDebt = currentReportList.filter(item => parseFloat(item.period_net_balance || 0) > 0.01);

  if (workersWithDebt.length === 0) {
    showToast('No hay trabajadores con saldo pendiente en este corte', 'info');
    return;
  }

  const totalUSD = workersWithDebt.reduce((acc, item) => acc + parseFloat(item.period_net_balance || 0), 0);
  const totalVES = totalUSD * currentExchangeRate;

  document.getElementById('bulk-workers-count').textContent = `${workersWithDebt.length} colaboradores`;
  document.getElementById('bulk-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
  document.getElementById('bulk-total-ves').textContent = `Bs. ${totalVES.toFixed(2)}`;

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  document.getElementById('bulk-payroll-ref').value = `CORTE-NOMINA-${y}${m}${d}`;

  // Reset progreso
  const progressWrap = document.getElementById('bulk-progress-wrap');
  if (progressWrap) progressWrap.classList.add('is-hidden');
  document.getElementById('btn-confirm-bulk-deduction').disabled = false;

  const modal = document.getElementById('modal-bulk-deduction');
  if (modal) modal.classList.add('is-active');
}

function closeBulkDeductionModal() {
  const modal = document.getElementById('modal-bulk-deduction');
  if (modal) modal.classList.remove('is-active');
}

async function executeBulkDeduction() {
  const workersWithDebt = currentReportList.filter(item => parseFloat(item.period_net_balance || 0) > 0.01);
  if (workersWithDebt.length === 0) return;

  const payrollRef = document.getElementById('bulk-payroll-ref').value.trim() || 'CORTE-NOMINA-AUTOMATICO';
  const confirmBtn = document.getElementById('btn-confirm-bulk-deduction');
  const cancelBtn = document.getElementById('btn-cancel-bulk');
  const progressWrap = document.getElementById('bulk-progress-wrap');
  const progressFill = document.getElementById('bulk-progress-fill');
  const progressText = document.getElementById('bulk-progress-text');

  confirmBtn.disabled = true;
  cancelBtn.disabled = true;
  progressWrap.classList.remove('is-hidden');

  let processed = 0;
  const total = workersWithDebt.length;

  for (const worker of workersWithDebt) {
    try {
      const amount = parseFloat(worker.period_net_balance || 0);
      await createDebtPayment({
        employee: worker.employee_id,
        amount,
        payment_type: 'PAYROLL_DEDUCTION',
        reference: payrollRef,
        notes: `Corte de nómina aplicado automáticamente para el período`
      });
    } catch (err) {
      console.warn(`Error al aplicar deducción a ${worker.full_name}:`, err);
    }
    processed++;
    const pct = Math.round((processed / total) * 100);
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `Procesando ${processed} de ${total} (${pct}%)...`;
  }

  showToast(`Corte de nómina completado para ${total} colaboradores`, 'success');
  setTimeout(async () => {
    closeBulkDeductionModal();
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
    await loadReport();
  }, 1000);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Formulario de corte
  document.getElementById('report-filter-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    loadReport();
  });

  // Botones de fechas rápidas
  document.getElementById('btn-current-fortnight')?.addEventListener('click', () => {
    setFortnightRange();
    loadReport();
  });

  document.getElementById('btn-current-month')?.addEventListener('click', () => {
    setMonthRange();
    loadReport();
  });

  // Filtros de departamento y solo con saldo
  document.getElementById('filter-department')?.addEventListener('change', () => {
    updateSummaryKpis();
    renderReportTable();
  });

  document.getElementById('filter-only-with-balance')?.addEventListener('change', () => {
    updateSummaryKpis();
    renderReportTable();
  });

  // Exportar y corte masivo
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCsv);
  document.getElementById('btn-print-report')?.addEventListener('click', () => window.print());

  document.getElementById('btn-open-bulk-deduction')?.addEventListener('click', openBulkDeductionModal);
  document.getElementById('btn-close-bulk-modal')?.addEventListener('click', closeBulkDeductionModal);
  document.getElementById('btn-cancel-bulk')?.addEventListener('click', closeBulkDeductionModal);
  document.getElementById('btn-confirm-bulk-deduction')?.addEventListener('click', executeBulkDeduction);
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
