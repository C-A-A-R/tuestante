/**
 * ==========================================================================
 * TUESTANTE ADMIN - GESTIÓN Y LIQUIDACIÓN DE CORTE DE NÓMINA
 * ==========================================================================
 * Manejo de cortes masivos en pantalla completa, filtros de deudores / al día,
 * personalización de montos con validación de deuda máxima, comprobantes (vouchers),
 * guardado continuo de borrador en localStorage y liquidación atómica.
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import {
  fetchSettlementReport,
  executeBulkPayrollCut
} from './employee-store.api.js';
import { getBcvRate } from '../../js/service/exchange-rate.service.js';
import { resolveImageUrl } from '../../js/api.js';

// Clave única para el borrador local
const DRAFT_STORAGE_KEY = 'tuestante_payroll_cut_draft';

// ============================================================================
// ESTADO GLOBAL DE LA PANTALLA
// ============================================================================
const state = {
  exchangeRate: 80.00,
  rawReportData: null,
  workers: [],
  filterTab: 'all',          // 'all' | 'debtors' | 'non-debtors' | 'selected'
  filterDept: 'all',
  searchQuery: '',
  // Mapeo por ID de trabajador:
  // { [empId]: { selected: boolean, amount: number, reference: string, file: File|null, isInvalid: boolean } }
  workerState: {},
  globalPayrollRef: '',
  globalNotes: '',
  globalVoucherFile: null,
  isDraftLoaded: false,
  autoSaveTimer: null,
};

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminComponents({ title: 'Corte de Nómina' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load warning:', err);
  }

  await loadExchangeRate();
  setupEventListeners();
  setDefaultDates();
  await loadPayrollReport();
});

// ============================================================================
// CARGA DE TASA BCV
// ============================================================================
async function loadExchangeRate() {
  try {
    const rate = await getBcvRate();
    if (rate && !isNaN(rate) && rate > 0) {
      state.exchangeRate = parseFloat(rate);
      const badgeVal = document.getElementById('navbar-exchange-val');
      if (badgeVal) badgeVal.textContent = `Bs. ${state.exchangeRate.toFixed(2)}`;
    }
  } catch (err) {
    console.warn('Usando tasa BCV por defecto');
  }
}

// ============================================================================
// GESTIÓN DE FECHAS
// ============================================================================
/**
 * Calcula el rango desde el último lunes hasta hoy (fecha del día)
 */
function getLastMondayToTodayRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - diffToMonday);

  const fmt = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: fmt(lastMonday),
    endDate: fmt(today)
  };
}

function setDefaultDates(forceReset = false) {
  const range = getLastMondayToTodayRange();
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');

  // Por defecto: desde el último lunes hasta la fecha de hoy
  if (startInput && endInput) {
    if (forceReset || !startInput.value || !endInput.value) {
      startInput.value = range.startDate;
      endInput.value = range.endDate;
    }
  }

  // Sugerir referencia de lote por defecto
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const q = now.getDate() <= 15 ? 'Q1' : 'Q2';
  const defaultRef = `NOM-${y}-${m}-${q}`;

  const refInput = document.getElementById('bulk-payroll-ref');
  if (refInput && !refInput.value) {
    refInput.value = defaultRef;
    state.globalPayrollRef = defaultRef;
  }
}

function setCurrentWeekRange() {
  const range = getLastMondayToTodayRange();
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');

  if (startInput) startInput.value = range.startDate;
  if (endInput) endInput.value = range.endDate;

  triggerAutoSave();
  loadPayrollReport();
}

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
  triggerAutoSave();
  loadPayrollReport();
}

function setMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

  document.getElementById('start-date').value = `${year}-${month}-01`;
  document.getElementById('end-date').value = `${year}-${month}-${lastDay}`;
  triggerAutoSave();
  loadPayrollReport();
}

// ============================================================================
// CARGA Y CONSULTA DE CORTE DE NÓMINA (BACKEND)
// ============================================================================
async function loadPayrollReport() {
  const startDate = document.getElementById('start-date')?.value;
  const endDate = document.getElementById('end-date')?.value;
  const tableBody = document.getElementById('payroll-table-body');
  const tablePeriod = document.getElementById('table-period-legend');

  if (!startDate || !endDate) {
    showToast('Selecciona un rango de fechas válido', 'warning');
    return;
  }

  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="table-empty-cell">
          <div class="loading-spinner-wrap">
            <div class="spinner"></div>
            <p>Consultando colaboradores y consolidando consumos...</p>
          </div>
        </td>
      </tr>
    `;
  }

  if (tablePeriod) {
    tablePeriod.textContent = `Consumos y amortizaciones evaluados del ${startDate} al ${endDate}`;
  }

  try {
    const response = await fetchSettlementReport({ start_date: startDate, end_date: endDate });
    state.rawReportData = response;
    state.workers = response.data || [];

    // Inicializar estado por trabajador si es la primera vez
    initializeWorkerStates();

    // Intentar restaurar borrador guardado en localStorage
    restoreDraftIfAvailable();

    populateDepartmentFilter();
    updateLiveKpis();
    renderWorkersTable();
    updateTabBadges();
    triggerAutoSave();
  } catch (err) {
    console.error('Error al cargar reporte de corte:', err);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="table-empty-cell">
            <p style="color: #dc2626; font-weight: 600;">⚠️ Error al consultar datos del servidor. Por favor intenta de nuevo.</p>
          </td>
        </tr>
      `;
    }
    showToast('Error al consultar datos de nómina', 'error');
  }
}

// Inicializa valores base para cada trabajador
function initializeWorkerStates() {
  state.workers.forEach(w => {
    const debt = parseFloat(w.current_total_debt || 0);
    const hasDebt = debt > 0.001;

    // Si ya existe estado preservado en memoria, no sobreescribir
    if (!state.workerState[w.employee_id]) {
      state.workerState[w.employee_id] = {
        selected: hasDebt, // Por defecto, si tiene deuda está seleccionado; si no, desmarcado
        amount: hasDebt ? debt : 0.00,
        reference: '',
        file: null,
        isInvalid: false
      };
    }
  });
}

// Llena el selector de departamentos
function populateDepartmentFilter() {
  const deptSelect = document.getElementById('filter-department');
  if (!deptSelect) return;

  const currentVal = deptSelect.value;
  const departments = [...new Set(state.workers.map(w => w.department || 'General'))].filter(Boolean).sort();

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

// ============================================================================
// GUARDADO Y RESTAURACIÓN DE BORRADOR (localStorage)
// ============================================================================
function triggerAutoSave() {
  updateDraftStatus('saving');
  clearTimeout(state.autoSaveTimer);

  state.autoSaveTimer = setTimeout(() => {
    saveDraftToStorage();
  }, 400);
}

function saveDraftToStorage() {
  try {
    const serializableWorkerState = {};
    Object.keys(state.workerState).forEach(empId => {
      const item = state.workerState[empId];
      serializableWorkerState[empId] = {
        selected: item.selected,
        amount: item.amount,
        reference: item.reference || ''
      };
    });

    const draftData = {
      startDate: document.getElementById('start-date')?.value || '',
      endDate: document.getElementById('end-date')?.value || '',
      globalPayrollRef: document.getElementById('bulk-payroll-ref')?.value || '',
      globalNotes: document.getElementById('bulk-payroll-notes')?.value || '',
      workerState: serializableWorkerState,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    updateDraftStatus('saved');
  } catch (err) {
    console.warn('No se pudo guardar el borrador en localStorage:', err);
    updateDraftStatus('error');
  }
}

function restoreDraftIfAvailable() {
  if (state.isDraftLoaded) return;

  try {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) {
      updateDraftStatus('ready');
      return;
    }

    const draft = JSON.parse(rawDraft);
    if (!draft || typeof draft !== 'object') return;

    // Restaurar campos globales
    if (draft.globalPayrollRef) {
      const refInput = document.getElementById('bulk-payroll-ref');
      if (refInput) refInput.value = draft.globalPayrollRef;
      state.globalPayrollRef = draft.globalPayrollRef;
    }

    if (draft.globalNotes) {
      const notesInput = document.getElementById('bulk-payroll-notes');
      if (notesInput) notesInput.value = draft.globalNotes;
      state.globalNotes = draft.globalNotes;
    }

    // Restaurar estado de trabajadores
    if (draft.workerState && typeof draft.workerState === 'object') {
      Object.keys(draft.workerState).forEach(empId => {
        const saved = draft.workerState[empId];
        const currentWorker = state.workers.find(w => String(w.employee_id) === String(empId));
        if (currentWorker) {
          const maxDebt = parseFloat(currentWorker.current_total_debt || 0);
          const restoredAmount = Math.min(parseFloat(saved.amount || 0), maxDebt);

          state.workerState[empId] = {
            selected: Boolean(saved.selected),
            amount: restoredAmount,
            reference: saved.reference || '',
            file: null,
            isInvalid: saved.amount > maxDebt
          };
        }
      });
    }

    state.isDraftLoaded = true;
    updateDraftStatus('restored');
    showToast('⚡ Borrador restaurado automáticamente de tu sesión previa', 'info');
  } catch (err) {
    console.warn('Error al restaurar borrador:', err);
  }
}

function clearDraft() {
  if (!confirm('¿Deseas descartar el borrador guardado y restablecer las selecciones a los valores iniciales?')) {
    return;
  }

  localStorage.removeItem(DRAFT_STORAGE_KEY);
  state.workerState = {};
  initializeWorkerStates();

  const refInput = document.getElementById('bulk-payroll-ref');
  const notesInput = document.getElementById('bulk-payroll-notes');
  if (refInput) refInput.value = '';
  if (notesInput) notesInput.value = '';
  setDefaultDates(true);

  removeGlobalVoucher();
  updateLiveKpis();
  renderWorkersTable();
  updateTabBadges();
  updateDraftStatus('ready');
  showToast('Borrador descartado. Valores restablecidos.', 'info');
}

function updateDraftStatus(status) {
  const pill = document.getElementById('draft-status-pill');
  const text = document.getElementById('draft-status-text');
  const tableSaved = document.getElementById('table-draft-saved-time');
  if (!pill || !text) return;

  pill.className = 'draft-indicator-pill';

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  switch (status) {
    case 'saving':
      pill.classList.add('is-saving');
      text.textContent = 'Guardando cambios...';
      break;
    case 'saved':
      pill.classList.add('is-saved');
      text.textContent = `Borrador guardado (${timeStr})`;
      if (tableSaved) tableSaved.textContent = `💾 Autoguardado: ${timeStr}`;
      break;
    case 'restored':
      pill.classList.add('is-restored');
      text.textContent = 'Borrador restaurado';
      if (tableSaved) tableSaved.textContent = `⚡ Borrador recuperado`;
      break;
    case 'ready':
      text.textContent = 'Borrador listo';
      if (tableSaved) tableSaved.textContent = `💾 Autoguardado activo`;
      break;
    default:
      text.textContent = 'Autoguardado activo';
  }
}

// ============================================================================
// KPIS Y RESÚMENES EN VIVO
// ============================================================================
function updateLiveKpis() {
  const totalWorkers = state.workers.length;
  const debtors = state.workers.filter(w => parseFloat(w.current_total_debt || 0) > 0.001);
  const debtorsCount = debtors.length;

  let selectedCount = 0;
  let totalCutUSD = 0;

  state.workers.forEach(w => {
    const ws = state.workerState[w.employee_id];
    if (ws && ws.selected) {
      selectedCount++;
      const amt = parseFloat(ws.amount || 0);
      if (!isNaN(amt) && amt > 0) {
        totalCutUSD += amt;
      }
    }
  });

  const totalCutVES = totalCutUSD * state.exchangeRate;

  // Actualizar tarjetas principales
  const elTotalWorkers = document.getElementById('kpi-total-workers');
  const elDebtorsCount = document.getElementById('kpi-debtors-count');
  const elSelectedCount = document.getElementById('kpi-selected-count');
  const elTotalCutUsd = document.getElementById('kpi-total-cut-usd');
  const elTotalCutVes = document.getElementById('kpi-total-cut-ves');

  if (elTotalWorkers) elTotalWorkers.textContent = totalWorkers;
  if (elDebtorsCount) elDebtorsCount.textContent = debtorsCount;
  if (elSelectedCount) elSelectedCount.textContent = selectedCount;
  if (elTotalCutUsd) elTotalCutUsd.textContent = `$${totalCutUSD.toFixed(2)}`;
  if (elTotalCutVes) elTotalCutVes.textContent = `Bs. ${totalCutVES.toFixed(2)} (Tasa: ${state.exchangeRate.toFixed(2)})`;

  // Actualizar resumen al pie de la tabla
  const footerTotalUSD = document.getElementById('table-footer-total-usd');
  const footerTotalVES = document.getElementById('table-footer-total-ves');
  const footerSelected = document.getElementById('selected-workers-count');
  if (footerTotalUSD) footerTotalUSD.textContent = `$${totalCutUSD.toFixed(2)}`;
  if (footerTotalVES) footerTotalVES.textContent = `Bs. ${totalCutVES.toFixed(2)}`;
  if (footerSelected) footerSelected.textContent = selectedCount;
}

function updateTabBadges() {
  const total = state.workers.length;
  const debtors = state.workers.filter(w => parseFloat(w.current_total_debt || 0) > 0.001).length;
  const nonDebtors = total - debtors;
  const selected = state.workers.filter(w => state.workerState[w.employee_id]?.selected).length;

  const bAll = document.getElementById('badge-all');
  const bDebtors = document.getElementById('badge-debtors');
  const bNonDebtors = document.getElementById('badge-non-debtors');
  const bSelected = document.getElementById('badge-selected');

  if (bAll) bAll.textContent = total;
  if (bDebtors) bDebtors.textContent = debtors;
  if (bNonDebtors) bNonDebtors.textContent = nonDebtors;
  if (bSelected) bSelected.textContent = selected;
}

// ============================================================================
// FILTRADO Y RENDERIZADO DE TABLA DE TRABAJADORES
// ============================================================================
function getFilteredWorkers() {
  return state.workers.filter(w => {
    const debt = parseFloat(w.current_total_debt || 0);
    const hasDebt = debt > 0.001;
    const isSelected = Boolean(state.workerState[w.employee_id]?.selected);

    // 1. Filtro por pestaña (Tab)
    if (state.filterTab === 'debtors' && !hasDebt) return false;
    if (state.filterTab === 'non-debtors' && hasDebt) return false;
    if (state.filterTab === 'selected' && !isSelected) return false;

    // 2. Filtro por Departamento
    if (state.filterDept !== 'all' && (w.department || 'General') !== state.filterDept) return false;

    // 3. Filtro por Búsqueda (Texto)
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const nameMatch = (w.full_name || '').toLowerCase().includes(q);
      const codeMatch = (w.employee_number || '').toLowerCase().includes(q);
      const docMatch = (w.identity_document || '').toLowerCase().includes(q);
      if (!nameMatch && !codeMatch && !docMatch) return false;
    }

    return true;
  });
}

function renderWorkersTable() {
  const tableBody = document.getElementById('payroll-table-body');
  if (!tableBody) return;

  const filtered = getFilteredWorkers();

  const visibleCountEl = document.getElementById('visible-workers-count');
  if (visibleCountEl) visibleCountEl.textContent = filtered.length;

  // Actualizar master checkbox
  updateMasterCheckboxState(filtered);

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="table-empty-cell">
          <p>No se encontraron trabajadores con los filtros aplicados.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(w => {
    const empId = w.employee_id;
    const debt = parseFloat(w.current_total_debt || 0);
    const hasDebt = debt > 0.001;
    const ws = state.workerState[empId] || {
      selected: hasDebt,
      amount: debt,
      reference: '',
      file: null,
      isInvalid: false
    };

    const salary = parseFloat(w.salary || 0);
    const periodOrders = parseFloat(w.period_orders_total || 0);
    const ordersCount = w.period_orders_count || 0;
    const cutAmount = parseFloat(ws.amount || 0);

    // Saldo restante proyectado
    const remainingBalance = Math.max(0, debt - (ws.selected ? cutAmount : 0));
    const isSolvent = remainingBalance <= 0.001;

    // Conversión a VES del monto a descontar
    const cutVES = cutAmount * state.exchangeRate;

    // Avatar o iniciales
    const initials = (w.full_name || 'NN')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');

    const photoUrl = w.photo ? resolveImageUrl(w.photo) : null;
    const avatarHtml = photoUrl
      ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(w.full_name)}" class="worker-avatar-img" onerror="this.onerror=null; this.parentElement.innerHTML='<span>${escapeHtml(initials)}</span>';">`
      : `<span>${escapeHtml(initials)}</span>`;

    const rowClass = [
      ws.selected ? 'is-selected' : '',
      !hasDebt ? 'is-debt-free' : ''
    ].filter(Boolean).join(' ');

    return `
      <tr class="${rowClass}" data-worker-id="${empId}">
        <!-- 1. Checkbox de Selección -->
        <td class="col-checkbox">
          <label class="custom-checkbox" title="${hasDebt ? 'Marcar / Desmarcar para corte de nómina' : 'Colaborador sin deuda acumulada'}">
            <input type="checkbox" 
                   class="worker-checkbox" 
                   data-worker-id="${empId}" 
                   ${ws.selected ? 'checked' : ''} 
                   ${!hasDebt ? 'disabled' : ''}>
            <span class="checkbox-box"></span>
          </label>
        </td>

        <!-- 2. Colaborador -->
        <td class="col-worker">
          <div class="worker-cell">
            <div class="worker-avatar-wrap">
              ${avatarHtml}
            </div>
            <div class="worker-info">
              <span class="worker-name">${escapeHtml(w.full_name)}</span>
              <div class="worker-meta-row">
                <span class="worker-code-pill">${escapeHtml(w.employee_number || 'S/F')}</span>
                <span>•</span>
                <span>${escapeHtml(w.identity_document || 'C.I. No reg.')}</span>
              </div>
            </div>
          </div>
        </td>

        <!-- 3. Departamento & Cargo -->
        <td class="col-dept">
          <span class="dept-badge">${escapeHtml(w.department || 'General')}</span>
          <div class="position-sub">${escapeHtml(w.position || 'Colaborador')}</div>
        </td>

        <!-- 4. Salario Base -->
        <td class="col-salary">
          <strong>$${salary.toFixed(2)}</strong>
        </td>

        <!-- 5. Consumo Período -->
        <td class="col-consumptions">
          <strong>$${periodOrders.toFixed(2)}</strong>
          <div style="font-size: 0.72rem; color: #64748b;">${ordersCount} órdenes</div>
        </td>

        <!-- 6. Deuda Total Acumulada -->
        <td class="col-debt">
          ${hasDebt
            ? `<span class="debt-badge has-debt">$${debt.toFixed(2)}</span>`
            : `<span class="debt-badge debt-free">Al Día ($0.00)</span>`}
        </td>

        <!-- 7. Monto a Descontar ($) -->
        <td class="col-cut-amount">
          <div class="cut-input-wrap">
            <div class="cut-input-box">
              <span class="cut-symbol">$</span>
              <input type="number" 
                     class="cut-amount-input ${ws.isInvalid ? 'is-invalid' : ''}" 
                     data-worker-id="${empId}"
                     step="0.01" 
                     min="0.00" 
                     max="${debt.toFixed(2)}"
                     value="${cutAmount.toFixed(2)}"
                     ${!ws.selected || !hasDebt ? 'disabled' : ''}>
            </div>
            ${ws.isInvalid ? `<span class="cut-error-text">⚠️ Supera deuda máxima ($${debt.toFixed(2)})</span>` : ''}
            <span class="cut-ves-preview">Bs. ${cutVES.toFixed(2)}</span>
          </div>
        </td>

        <!-- 8. Referencia Individual -->
        <td class="col-individual-ref">
          <input type="text" 
                 class="individual-ref-input" 
                 data-worker-id="${empId}"
                 placeholder="Heredar global" 
                 value="${escapeHtml(ws.reference || '')}"
                 ${!ws.selected ? 'disabled' : ''}>
        </td>

        <!-- 9. Voucher Individual -->
        <td class="col-individual-voucher">
          <label class="voucher-btn-label ${ws.file ? 'has-file' : ''}" title="${ws.file ? ws.file.name : 'Subir bauche individual'}">
            <span>${ws.file ? '📎 ' + escapeHtml(ws.file.name.slice(0, 10)) + '...' : '📎 Adjuntar'}</span>
            <input type="file" 
                   class="file-input-inline individual-voucher-input" 
                   data-worker-id="${empId}" 
                   accept="image/*,application/pdf"
                   ${!ws.selected ? 'disabled' : ''}>
          </label>
        </td>

        <!-- 10. Saldo Restante Proyectado -->
        <td class="col-balance">
          <div class="remaining-balance-cell">
            <span class="remaining-balance-val ${isSolvent ? 'is-zero' : 'text-danger'}">
              $${remainingBalance.toFixed(2)}
            </span>
            ${isSolvent 
              ? `<span class="solvent-badge">✓ Quedará solvente</span>` 
              : `<span style="font-size: 0.72rem; color: #94a3b8;">Saldo pendiente</span>`}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindTableInteractiveEvents();
}

// Vincula los eventos interactivos de las filas de la tabla
function bindTableInteractiveEvents() {
  // 1. Toggle de Checkbox por fila
  document.querySelectorAll('.worker-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const empId = e.target.getAttribute('data-worker-id');
      const checked = e.target.checked;
      handleWorkerSelectionToggle(empId, checked);
    });
  });

  // 2. Input de Monto a Descontar
  document.querySelectorAll('.cut-amount-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const empId = e.target.getAttribute('data-worker-id');
      const val = parseFloat(e.target.value) || 0;
      handleWorkerAmountChange(empId, val, e.target);
    });
  });

  // 3. Input de Referencia Individual
  document.querySelectorAll('.individual-ref-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const empId = e.target.getAttribute('data-worker-id');
      if (state.workerState[empId]) {
        state.workerState[empId].reference = e.target.value.trim();
        triggerAutoSave();
      }
    });
  });

  // 4. File input de Voucher Individual
  document.querySelectorAll('.individual-voucher-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const empId = e.target.getAttribute('data-worker-id');
      const file = e.target.files?.[0] || null;
      if (state.workerState[empId]) {
        state.workerState[empId].file = file;
        const label = e.target.closest('.voucher-btn-label');
        if (label) {
          if (file) {
            label.classList.add('has-file');
            label.querySelector('span').textContent = `📎 ${file.name.slice(0, 10)}...`;
          } else {
            label.classList.remove('has-file');
            label.querySelector('span').textContent = '📎 Adjuntar';
          }
        }
        triggerAutoSave();
      }
    });
  });
}

// Maneja la selección o deselección de un trabajador
function handleWorkerSelectionToggle(empId, isSelected) {
  const ws = state.workerState[empId];
  if (!ws) return;

  ws.selected = isSelected;

  const worker = state.workers.find(w => String(w.employee_id) === String(empId));
  const debt = worker ? parseFloat(worker.current_total_debt || 0) : 0;

  // Si se selecciona y su monto era 0, sugerir su deuda total
  if (isSelected && ws.amount <= 0 && debt > 0) {
    ws.amount = debt;
  }

  updateLiveKpis();
  updateTabBadges();
  renderWorkersTable();
  triggerAutoSave();
}

// Maneja el cambio de monto personalizado y valida contra la deuda máxima
function handleWorkerAmountChange(empId, newAmount, inputElement) {
  const ws = state.workerState[empId];
  const worker = state.workers.find(w => String(w.employee_id) === String(empId));
  if (!ws || !worker) return;

  const maxDebt = parseFloat(worker.current_total_debt || 0);

  // Validación: el monto no puede superar la deuda máxima
  if (newAmount > maxDebt + 0.001) {
    ws.isInvalid = true;
    inputElement.classList.add('is-invalid');
  } else {
    ws.isInvalid = false;
    inputElement.classList.remove('is-invalid');
  }

  ws.amount = newAmount;

  // Actualizar texto de bolívares en la celda
  const row = inputElement.closest('tr');
  if (row) {
    const cutVesEl = row.querySelector('.cut-ves-preview');
    if (cutVesEl) cutVesEl.textContent = `Bs. ${(newAmount * state.exchangeRate).toFixed(2)}`;

    // Actualizar saldo restante proyectado
    const remainingBalance = Math.max(0, maxDebt - (ws.selected ? newAmount : 0));
    const isSolvent = remainingBalance <= 0.001;
    const balanceValEl = row.querySelector('.remaining-balance-val');
    const solventBadge = row.querySelector('.solvent-badge');

    if (balanceValEl) {
      balanceValEl.textContent = `$${remainingBalance.toFixed(2)}`;
      balanceValEl.className = `remaining-balance-val ${isSolvent ? 'is-zero' : 'text-danger'}`;
    }

    if (isSolvent && !solventBadge) {
      const parent = balanceValEl?.parentElement;
      if (parent) {
        parent.innerHTML = `
          <span class="remaining-balance-val is-zero">$${remainingBalance.toFixed(2)}</span>
          <span class="solvent-badge">✓ Quedará solvente</span>
        `;
      }
    }
  }

  updateLiveKpis();
  triggerAutoSave();
}

// Actualiza el checkbox maestro del encabezado de la tabla
function updateMasterCheckboxState(visibleWorkers) {
  const master = document.getElementById('master-checkbox');
  if (!master) return;

  const visibleDebtors = visibleWorkers.filter(w => parseFloat(w.current_total_debt || 0) > 0.001);
  if (visibleDebtors.length === 0) {
    master.checked = false;
    master.disabled = true;
    return;
  }

  master.disabled = false;
  const allSelected = visibleDebtors.every(w => state.workerState[w.employee_id]?.selected);
  master.checked = allSelected;
}

// ============================================================================
// ACCIONES MASIVAS DE SELECCIÓN (SELECT ALL / DESELECT ALL)
// ============================================================================
function selectAllDebtors() {
  state.workers.forEach(w => {
    const debt = parseFloat(w.current_total_debt || 0);
    if (debt > 0.001) {
      if (!state.workerState[w.employee_id]) {
        state.workerState[w.employee_id] = { selected: true, amount: debt, reference: '', file: null };
      } else {
        state.workerState[w.employee_id].selected = true;
        if (state.workerState[w.employee_id].amount <= 0) {
          state.workerState[w.employee_id].amount = debt;
        }
      }
    }
  });

  updateLiveKpis();
  updateTabBadges();
  renderWorkersTable();
  triggerAutoSave();
  showToast('Se han seleccionado todos los colaboradores con deuda', 'info');
}

function deselectAllWorkers() {
  state.workers.forEach(w => {
    if (state.workerState[w.employee_id]) {
      state.workerState[w.employee_id].selected = false;
    }
  });

  updateLiveKpis();
  updateTabBadges();
  renderWorkersTable();
  triggerAutoSave();
  showToast('Se han desmarcado todos los colaboradores', 'info');
}

function resetAmountsToTotalDebt() {
  state.workers.forEach(w => {
    const debt = parseFloat(w.current_total_debt || 0);
    if (state.workerState[w.employee_id]) {
      state.workerState[w.employee_id].amount = debt;
      state.workerState[w.employee_id].isInvalid = false;
    }
  });

  updateLiveKpis();
  renderWorkersTable();
  triggerAutoSave();
  showToast('Montos restablecidos a la deuda total pendiente', 'info');
}

// ============================================================================
// COMPROBANTE / VOUCHER GLOBAL
// ============================================================================
function handleGlobalVoucherSelection(file) {
  if (!file) return;

  state.globalVoucherFile = file;

  const dropzone = document.getElementById('voucher-dropzone');
  const fileNameEl = document.getElementById('voucher-file-name');
  const removeBtn = document.getElementById('btn-remove-voucher');

  if (dropzone) dropzone.classList.add('has-file');
  if (fileNameEl) fileNameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  if (removeBtn) removeBtn.classList.remove('is-hidden');

  triggerAutoSave();
  showToast(`Comprobante adjuntado: ${file.name}`, 'success');
}

function removeGlobalVoucher() {
  state.globalVoucherFile = null;

  const dropzone = document.getElementById('voucher-dropzone');
  const fileNameEl = document.getElementById('voucher-file-name');
  const removeBtn = document.getElementById('btn-remove-voucher');
  const fileInput = document.getElementById('bulk-payroll-voucher');

  if (dropzone) dropzone.classList.remove('has-file');
  if (fileNameEl) fileNameEl.textContent = 'Subir comprobante general (PDF o Imagen)';
  if (removeBtn) removeBtn.classList.add('is-hidden');
  if (fileInput) fileInput.value = '';

  triggerAutoSave();
}

// ============================================================================
// PROCESAMIENTO Y LIQUIDACIÓN DE CORTE DE NÓMINA (MODAL CONFIRM & EXECUTE)
// ============================================================================
function openPayrollCutConfirmModal() {
  const selectedCuts = getValidSelectedCuts();

  if (selectedCuts.length === 0) {
    showToast('Selecciona al menos un colaborador con monto a descontar mayor a $0.00', 'warning');
    return;
  }

  // Verificar si hay montos que superen la deuda
  const invalidWorker = selectedCuts.find(item => item.isInvalid);
  if (invalidWorker) {
    showToast(`El monto ingresado para ${invalidWorker.worker.full_name} supera su deuda actual. Corrige el valor antes de continuar.`, 'error');
    return;
  }

  const totalUSD = selectedCuts.reduce((acc, item) => acc + item.amount, 0);
  const totalVES = totalUSD * state.exchangeRate;
  const globalRef = document.getElementById('bulk-payroll-ref')?.value.trim() || 'CORTE-NOMINA';

  // Llenar datos en el modal de confirmación
  document.getElementById('confirm-workers-count').textContent = `${selectedCuts.length} colaboradores`;
  document.getElementById('confirm-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
  document.getElementById('confirm-total-ves').textContent = `Bs. ${totalVES.toFixed(2)}`;
  document.getElementById('confirm-ref-preview').textContent = globalRef;

  const voucherNameEl = document.getElementById('confirm-voucher-name');
  if (voucherNameEl) {
    voucherNameEl.textContent = state.globalVoucherFile ? state.globalVoucherFile.name : 'Ninguno (sin bauche)';
  }

  // Reset de barra de progreso
  const progressWrap = document.getElementById('confirm-progress-wrap');
  if (progressWrap) progressWrap.classList.add('is-hidden');
  document.getElementById('btn-execute-cut').disabled = false;

  const modal = document.getElementById('modal-confirm-cut');
  if (modal) modal.classList.add('is-active');
}

function closePayrollCutConfirmModal() {
  const modal = document.getElementById('modal-confirm-cut');
  if (modal) modal.classList.remove('is-active');
}

function getValidSelectedCuts() {
  const cuts = [];
  state.workers.forEach(w => {
    const ws = state.workerState[w.employee_id];
    if (ws && ws.selected) {
      const amt = parseFloat(ws.amount || 0);
      const debt = parseFloat(w.current_total_debt || 0);
      if (amt > 0) {
        cuts.push({
          worker: w,
          employee_id: w.employee_id,
          amount: amt,
          reference: ws.reference || '',
          file: ws.file || null,
          isInvalid: amt > debt + 0.001
        });
      }
    }
  });
  return cuts;
}

async function executePayrollCutBatch() {
  const selectedCuts = getValidSelectedCuts();
  if (selectedCuts.length === 0) return;

  const globalRef = document.getElementById('bulk-payroll-ref')?.value.trim() || 'CORTE-NOMINA-AUTOMATICO';
  const globalNotes = document.getElementById('bulk-payroll-notes')?.value.trim() || 'Corte masivo de nómina aplicado';

  const confirmBtn = document.getElementById('btn-execute-cut');
  const cancelBtn = document.getElementById('btn-cancel-confirm');
  const progressWrap = document.getElementById('confirm-progress-wrap');
  const progressFill = document.getElementById('confirm-progress-fill');
  const progressText = document.getElementById('confirm-progress-text');

  confirmBtn.disabled = true;
  cancelBtn.disabled = true;
  progressWrap.classList.remove('is-hidden');
  progressFill.style.width = '30%';
  progressText.textContent = 'Preparando paquete de deducciones...';

  try {
    const formData = new FormData();
    formData.append('payroll_reference', globalRef);
    formData.append('notes', globalNotes);

    if (state.globalVoucherFile) {
      formData.append('voucher', state.globalVoucherFile);
    }

    // Estructurar lista de deducciones para el endpoint backend
    const cutsPayload = selectedCuts.map(c => ({
      employee_id: c.employee_id,
      amount: c.amount,
      reference: c.reference || globalRef,
      notes: globalNotes
    }));

    formData.append('cuts', JSON.stringify(cutsPayload));

    // Adjuntar comprobantes individuales si existen
    selectedCuts.forEach(c => {
      if (c.file) {
        formData.append(`voucher_${c.employee_id}`, c.file);
      }
    });

    progressFill.style.width = '65%';
    progressText.textContent = 'Enviando transacción atómica al servidor...';

    const result = await executeBulkPayrollCut(formData);

    progressFill.style.width = '100%';
    progressText.textContent = '¡Corte de nómina aplicado con éxito!';

    // Eliminar borrador de localStorage
    localStorage.removeItem(DRAFT_STORAGE_KEY);

    // Mostrar modal de recibo / éxito
    setTimeout(() => {
      closePayrollCutConfirmModal();
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      openReceiptModal(result, selectedCuts, globalRef, globalNotes);
    }, 600);

  } catch (err) {
    console.error('Error al ejecutar corte de nómina:', err);
    progressWrap.classList.add('is-hidden');
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
    const msg = err.response?.data?.error || err.message || 'Error al procesar el corte de nómina';
    showToast(msg, 'error');
  }
}

// ============================================================================
// RECIBO DE LIQUIDACIÓN Y MODAL DE ÉXITO
// ============================================================================
function openReceiptModal(apiResponse, cuts, globalRef, notes) {
  const totalUSD = cuts.reduce((acc, c) => acc + c.amount, 0);
  const totalVES = totalUSD * state.exchangeRate;

  const now = new Date();
  const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  document.getElementById('receipt-date-time').textContent = `Fecha: ${dateStr}`;
  document.getElementById('receipt-batch-ref').textContent = `Lote: ${globalRef}`;
  document.getElementById('receipt-count').textContent = `${cuts.length} colaboradores`;
  document.getElementById('receipt-total-usd').textContent = `$${totalUSD.toFixed(2)}`;
  document.getElementById('receipt-total-ves').textContent = `Bs. ${totalVES.toFixed(2)}`;
  document.getElementById('receipt-rate').textContent = `Bs. ${state.exchangeRate.toFixed(2)} / USD`;

  const notesText = document.getElementById('receipt-notes-text');
  if (notesText) notesText.textContent = notes || 'Sin observaciones adicionales.';

  const modal = document.getElementById('modal-success-receipt');
  if (modal) modal.classList.add('is-active');
}

function closeReceiptModal() {
  const modal = document.getElementById('modal-success-receipt');
  if (modal) modal.classList.remove('is-active');
}

// ============================================================================
// EXPORTACIÓN A CSV Y COMPROBANTES
// ============================================================================
function exportCsv() {
  const filtered = getFilteredWorkers();
  if (filtered.length === 0) {
    showToast('No hay datos visibles para exportar', 'warning');
    return;
  }

  const headers = [
    'Ficha Empleado',
    'C.I. / Documento',
    'Nombre Completo',
    'Departamento',
    'Cargo',
    'Salario Base ($)',
    'Consumo Periodo ($)',
    'Deuda Total ($)',
    'Seleccionado para Corte',
    'Monto a Descontar ($)',
    'Monto a Descontar (Bs. BCV)',
    'Referencia Asignada',
    'Saldo Restante Proyectado ($)'
  ];

  const globalRef = document.getElementById('bulk-payroll-ref')?.value.trim() || '';

  const rows = filtered.map(w => {
    const ws = state.workerState[w.employee_id] || { selected: false, amount: 0, reference: '' };
    const debt = parseFloat(w.current_total_debt || 0);
    const cutUSD = ws.selected ? parseFloat(ws.amount || 0) : 0;
    const cutVES = cutUSD * state.exchangeRate;
    const remaining = Math.max(0, debt - cutUSD);
    const assignedRef = ws.reference || globalRef;

    return [
      `"${w.employee_number || ''}"`,
      `"${w.identity_document || ''}"`,
      `"${w.full_name || ''}"`,
      `"${w.department || ''}"`,
      `"${w.position || ''}"`,
      parseFloat(w.salary || 0).toFixed(2),
      parseFloat(w.period_orders_total || 0).toFixed(2),
      debt.toFixed(2),
      ws.selected ? 'SI' : 'NO',
      cutUSD.toFixed(2),
      cutVES.toFixed(2),
      `"${assignedRef}"`,
      remaining.toFixed(2)
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const startDate = document.getElementById('start-date')?.value || 'inicio';
  const endDate = document.getElementById('end-date')?.value || 'fin';

  link.setAttribute('href', url);
  link.setAttribute('download', `corte_nomina_${startDate}_al_${endDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Archivo CSV generado y descargado exitosamente', 'success');
}

// ============================================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // 1. Colapsar / Expandir Configuración del Lote
  document.getElementById('btn-toggle-config')?.addEventListener('click', (e) => {
    const body = document.getElementById('batch-card-body');
    const btn = e.currentTarget;
    const icon = btn.querySelector('.toggle-icon');
    if (body) {
      body.classList.toggle('is-collapsed');
      if (body.classList.contains('is-collapsed')) {
        if (icon) icon.textContent = '▼';
        btn.setAttribute('aria-expanded', 'false');
      } else {
        if (icon) icon.textContent = '▲';
        btn.setAttribute('aria-expanded', 'true');
      }
    }
  });

  // 2. Comprobante / Bauche Global
  const voucherDropzone = document.getElementById('voucher-dropzone');
  const voucherInput = document.getElementById('bulk-payroll-voucher');
  const removeVoucherBtn = document.getElementById('btn-remove-voucher');

  voucherInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleGlobalVoucherSelection(file);
  });

  removeVoucherBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeGlobalVoucher();
  });

  // Drag & drop para comprobante global
  if (voucherDropzone) {
    voucherDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      voucherDropzone.style.borderColor = 'var(--primary)';
    });
    voucherDropzone.addEventListener('dragleave', () => {
      voucherDropzone.style.borderColor = '';
    });
    voucherDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      voucherDropzone.style.borderColor = '';
      const file = e.dataTransfer.files?.[0];
      if (file) handleGlobalVoucherSelection(file);
    });
  }

  // 3. Inputs de Referencia y Notas Globales (Auto-save)
  document.getElementById('bulk-payroll-ref')?.addEventListener('input', (e) => {
    state.globalPayrollRef = e.target.value.trim();
    triggerAutoSave();
  });

  document.getElementById('bulk-payroll-notes')?.addEventListener('input', (e) => {
    state.globalNotes = e.target.value.trim();
    triggerAutoSave();
  });

  // 4. Fechas y Actualización
  document.getElementById('btn-refresh-period')?.addEventListener('click', loadPayrollReport);
  document.getElementById('btn-current-week')?.addEventListener('click', setCurrentWeekRange);
  document.getElementById('btn-current-fortnight')?.addEventListener('click', setFortnightRange);
  document.getElementById('btn-current-month')?.addEventListener('click', setMonthRange);

  // 5. Botones de Cabecera
  document.getElementById('btn-clear-draft')?.addEventListener('click', clearDraft);
  document.getElementById('btn-print-report')?.addEventListener('click', () => window.print());
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCsv);
  document.getElementById('btn-apply-payroll-cut')?.addEventListener('click', openPayrollCutConfirmModal);

  // 6. Tabs de Filtros (Todos, Deudores, Al Día, Seleccionados)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('is-active'));
      const target = e.currentTarget;
      target.classList.add('is-active');
      state.filterTab = target.getAttribute('data-filter') || 'all';
      renderWorkersTable();
    });
  });

  // 7. Búsqueda y Departamento
  const searchInput = document.getElementById('filter-search');
  const clearSearchBtn = document.getElementById('btn-clear-search');

  searchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    if (clearSearchBtn) {
      if (state.searchQuery) clearSearchBtn.classList.remove('is-hidden');
      else clearSearchBtn.classList.add('is-hidden');
    }
    renderWorkersTable();
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('is-hidden');
    renderWorkersTable();
  });

  document.getElementById('filter-department')?.addEventListener('change', (e) => {
    state.filterDept = e.target.value;
    renderWorkersTable();
  });

  // 8. Acciones Masivas
  document.getElementById('btn-select-all-debtors')?.addEventListener('click', selectAllDebtors);
  document.getElementById('btn-deselect-all')?.addEventListener('click', deselectAllWorkers);
  document.getElementById('btn-reset-amounts')?.addEventListener('click', resetAmountsToTotalDebt);

  // Checkbox maestro en el encabezado
  document.getElementById('master-checkbox')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const visible = getFilteredWorkers();
    visible.forEach(w => {
      const debt = parseFloat(w.current_total_debt || 0);
      if (debt > 0.001) {
        if (!state.workerState[w.employee_id]) {
          state.workerState[w.employee_id] = { selected: checked, amount: debt, reference: '', file: null };
        } else {
          state.workerState[w.employee_id].selected = checked;
        }
      }
    });

    updateLiveKpis();
    updateTabBadges();
    renderWorkersTable();
    triggerAutoSave();
  });

  // 9. Modales
  document.getElementById('btn-close-confirm-modal')?.addEventListener('click', closePayrollCutConfirmModal);
  document.getElementById('btn-cancel-confirm')?.addEventListener('click', closePayrollCutConfirmModal);
  document.getElementById('btn-execute-cut')?.addEventListener('click', executePayrollCutBatch);

  document.getElementById('btn-close-receipt-modal')?.addEventListener('click', () => {
    closeReceiptModal();
    loadPayrollReport();
  });
  document.getElementById('btn-finish-cut')?.addEventListener('click', () => {
    closeReceiptModal();
    loadPayrollReport();
  });
  document.getElementById('btn-print-receipt')?.addEventListener('click', () => {
    window.print();
  });
}

// ============================================================================
// SISTEMA DE NOTIFICACIONES TOAST Y UTILIDADES
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
  if (typeof str !== 'string') return str ?? '';
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
