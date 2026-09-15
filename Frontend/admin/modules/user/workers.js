/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DEL MÓDULO DE TRABAJADORES (workers.js)
 * ==========================================================================
 * Gestiona el ciclo de vida de la pantalla de trabajadores:
 * - Integración con Drawer, Navbar y Footer mediante loadAdminComponents().
 * - Tarjetas KPI estadísticas dinámicas.
 * - Barra de búsqueda en vivo con debounce y filtros avanzados.
 * - Tabla de trabajadores con paginación y sanitización XSS.
 * - Modal de creación y edición simplificado (solo formulario de alta).
 * - Confirmación de eliminación y toggle de estado.
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { showConfirmModal } from '../../components/modal/modal.js';
import {
  obtenerTrabajadores,
  obtenerTrabajador,
  crearTrabajador,
  actualizarTrabajador,
  eliminarTrabajador,
  toggleEstadoTrabajador
} from './workers.api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Estado global del módulo
// ─────────────────────────────────────────────────────────────────────────────
const state = {
  workers: [],
  allWorkers: [],       // copia sin filtrar para KPIs locales
  totalCount: 0,
  currentPage: 1,
  pageSize: 15,
  totalPages: 1,
  filters: {
    search: '',
    status: 'all',
    department: 'all'
  },
  debounceTimer: null,
  isLoading: false
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getInitials(name) {
  if (!name || typeof name !== 'string') return 'TW';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const colors = {
    success: { bg: '#dcfce7', border: '#16a34a', color: '#15803d', icon: '✓' },
    error:   { bg: '#fee2e2', border: '#dc2626', color: '#b91c1c', icon: '✕' },
    warning: { bg: '#fef3c7', border: '#f59e0b', color: '#d97706', icon: '⚠' },
    info:    { bg: '#e0f2fe', border: '#0284c7', color: '#0369a1', icon: 'ℹ' }
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px;
    background: ${c.bg}; border: 1.5px solid ${c.border}; border-radius: 10px;
    box-shadow: 0 4px 14px rgba(0,0,0,.08); font-size: .875rem; font-weight: 500;
    color: ${c.color}; min-width: 260px; max-width: 380px;
    animation: toastIn .25s ease; position: relative;
  `;
  toast.innerHTML = `<span style="font-size:1rem;flex-shrink:0">${c.icon}</span><span>${escapeHtml(message)}</span>`;

  if (!document.querySelector('#toast-keyframes')) {
    const s = document.createElement('style');
    s.id = 'toast-keyframes';
    s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}';
    document.head.appendChild(s);
  }

  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ─────────────────────────────────────────────────────────────────────────────
// Carga de Datos
// ─────────────────────────────────────────────────────────────────────────────

async function cargarTrabajadores(resetPage = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  if (resetPage) state.currentPage = 1;

  const tbody = document.getElementById('workers-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="table-spinner-wrap">
          <div class="table-spinner"></div>
          <span>Cargando trabajadores...</span>
        </div>
      </td></tr>`;
  }

  try {
    const params = {
      page: state.currentPage,
      page_size: state.pageSize
    };

    if (state.filters.search) params.search = state.filters.search;
    if (state.filters.status === 'active')   params.is_active = true;
    if (state.filters.status === 'inactive') params.is_active = false;

    const res = await obtenerTrabajadores(params);

    // Soporta paginación DRF { count, results } o array simple
    if (res && Array.isArray(res.results)) {
      state.workers = res.results;
      state.totalCount = res.count || res.results.length;
    } else if (Array.isArray(res)) {
      state.workers = res;
      state.totalCount = res.length;
    } else {
      state.workers = [];
      state.totalCount = 0;
    }

    state.totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));

    // Filtro de departamento (client-side si no hay soporte en API)
    let filtered = state.workers;
    if (state.filters.department !== 'all') {
      filtered = state.workers.filter(w =>
        (w.department || '').toLowerCase() === state.filters.department.toLowerCase()
      );
    }

    actualizarKPIs();
    renderizarTabla(filtered);
    renderizarPaginacion();
    actualizarFiltroDepartamentos();
  } catch (err) {
    console.error('[Workers] Error al cargar trabajadores:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr><td colspan="9">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p>Error al cargar trabajadores</p>
            <small>${escapeHtml(err?.message || 'Verifica la conexión con el servidor.')}</small>
          </div>
        </td></tr>`;
    }
    showToast('No se pudo cargar el directorio de trabajadores.', 'error');
  } finally {
    state.isLoading = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────────────────────

function actualizarKPIs() {
  const workers = state.workers;
  const total = state.totalCount;
  const active = workers.filter(w => w.is_active).length;
  const inactive = workers.filter(w => !w.is_active).length;
  const depts = new Set(workers.map(w => w.department).filter(Boolean));

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('kpi-total-workers', total);
  set('kpi-active-workers', active);
  set('kpi-inactive-workers', inactive);
  set('kpi-departments', depts.size);
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderizado de Tabla
// ─────────────────────────────────────────────────────────────────────────────

function renderizarTabla(workers) {
  const tbody = document.getElementById('workers-table-body');
  if (!tbody) return;

  const countEl = document.getElementById('footer-count-text');

  if (!workers || workers.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>No se encontraron trabajadores</p>
          <small>Prueba ajustando los filtros de búsqueda o registra un nuevo trabajador.</small>
        </div>
      </td></tr>`;
    if (countEl) countEl.textContent = 'Sin resultados';
    return;
  }

  if (countEl) {
    const from = (state.currentPage - 1) * state.pageSize + 1;
    const to = Math.min(state.currentPage * state.pageSize, state.totalCount);
    countEl.textContent = `Mostrando ${from}–${to} de ${state.totalCount} trabajadores`;
  }

  tbody.innerHTML = workers.map(w => renderizarFila(w)).join('');

  // Evento delegado para botones de acción
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit')    abrirModalEditar(id);
      if (action === 'delete')  confirmarEliminar(id);
      if (action === 'profile') verPerfilCompleto(id);
    });
  });
}

function renderizarFila(w) {
  const fullName = escapeHtml(w.full_name || `${w.first_name || ''} ${w.last_name || ''}`.trim() || 'Sin nombre');
  const doc = escapeHtml(w.identity_document || w.id_number || '-');
  const ficha = escapeHtml(w.employee_number || '-');
  const dept = escapeHtml(w.department || '-');
  const pos = escapeHtml(w.position || '-');
  const salary = formatCurrency(w.salary || 0);
  const isActive = w.is_active !== false;
  const statusClass = isActive ? 'status-active' : 'status-inactive';
  const statusText  = isActive ? 'Activo' : 'Inactivo';
  const initials = getInitials(fullName);

  let photoHtml;
  if (w.photo) {
    photoHtml = `<img src="${escapeHtml(w.photo)}" alt="Foto de ${fullName}" class="worker-avatar">`;
  } else {
    photoHtml = `<span class="worker-avatar-initials">${escapeHtml(initials)}</span>`;
  }

  return `
    <tr data-worker-id="${escapeHtml(w.id)}">
      <td class="worker-avatar-cell">${photoHtml}</td>
      <td>
        <span class="worker-name-primary">${fullName}</span>
        ${w.email ? `<span class="worker-name-secondary">${escapeHtml(w.email)}</span>` : ''}
      </td>
      <td>${doc}</td>
      <td>${ficha}</td>
      <td>${dept}</td>
      <td>${pos}</td>
      <td>${salary}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <div class="actions-cell">
          <button type="button" class="btn-action btn-profile" data-action="profile" data-id="${escapeHtml(w.id)}"
            title="Ver cuenta en tienda de empleados">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button type="button" class="btn-action btn-edit" data-action="edit" data-id="${escapeHtml(w.id)}"
            title="Editar trabajador">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button type="button" class="btn-action btn-delete" data-action="delete" data-id="${escapeHtml(w.id)}"
            title="Eliminar trabajador">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paginación
// ─────────────────────────────────────────────────────────────────────────────

function renderizarPaginacion() {
  const container = document.getElementById('table-pagination');
  if (!container || state.totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  const buttons = [];

  // Anterior
  buttons.push(`
    <button class="page-btn" ${state.currentPage === 1 ? 'disabled' : ''} data-page="${state.currentPage - 1}">
      ‹
    </button>`);

  // Páginas
  let start = Math.max(1, state.currentPage - 2);
  let end   = Math.min(state.totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);

  for (let p = start; p <= end; p++) {
    buttons.push(`
      <button class="page-btn ${p === state.currentPage ? 'active' : ''}" data-page="${p}">
        ${p}
      </button>`);
  }

  // Siguiente
  buttons.push(`
    <button class="page-btn" ${state.currentPage === state.totalPages ? 'disabled' : ''} data-page="${state.currentPage + 1}">
      ›
    </button>`);

  container.innerHTML = buttons.join('');
  container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPage = parseInt(btn.dataset.page, 10);
      cargarTrabajadores();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtro de Departamentos
// ─────────────────────────────────────────────────────────────────────────────

function actualizarFiltroDepartamentos() {
  const select = document.getElementById('filter-dept');
  if (!select) return;

  const depts = [...new Set(state.workers.map(w => w.department).filter(Boolean))].sort();
  const currentVal = state.filters.department;

  select.innerHTML = `<option value="all">Todos</option>` +
    depts.map(d => `<option value="${escapeHtml(d)}" ${currentVal === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Crear / Editar
// ─────────────────────────────────────────────────────────────────────────────

function abrirModalCrear() {
  resetFormulario();
  document.getElementById('modal-worker-form-title').textContent = 'Nuevo Trabajador';
  document.getElementById('modal-worker-subtitle').textContent = 'Registra un nuevo colaborador en el sistema.';
  document.getElementById('btn-submit-worker-text').textContent = 'Registrar Trabajador';
  document.getElementById('form-worker-id').value = '';
  abrirModal('modal-worker-form-backdrop');
}

async function abrirModalEditar(id) {
  resetFormulario();
  document.getElementById('modal-worker-form-title').textContent = 'Editar Trabajador';
  document.getElementById('modal-worker-subtitle').textContent = 'Modifica los datos del colaborador.';
  document.getElementById('btn-submit-worker-text').textContent = 'Guardar Cambios';
  document.getElementById('form-worker-id').value = id;

  try {
    const w = await obtenerTrabajador(id);
    if (!w) { showToast('No se encontró el trabajador.', 'error'); return; }

    // Llenar campos usuario
    const doc = w.identity_document || w.id_number || '';
    const docPrefix = doc.includes('-') ? doc.split('-')[0] : 'V';
    const docNum    = doc.includes('-') ? doc.split('-').slice(1).join('-') : doc;

    setVal('wk-first-name', w.first_name || '');
    setVal('wk-second-name', w.second_name || '');
    setVal('wk-last-name', w.last_name || '');
    setVal('wk-second-last-name', w.second_last_name || '');
    setVal('wk-doc-number', docNum);
    setVal('wk-birth-date', w.birth_date || '');
    setVal('wk-email', w.email || '');
    setVal('wk-phone', w.phone || '');

    const docTypeSelect = document.getElementById('wk-doc-type');
    if (docTypeSelect) {
      [...docTypeSelect.options].forEach(o => { o.selected = o.value === docPrefix; });
    }

    // Llenar campos perfil
    setVal('wk-emp-number', w.employee_number || '');
    setVal('wk-dept', w.department || '');
    setVal('wk-pos', w.position || '');
    setVal('wk-salary', w.salary || '');

    const toggle = document.getElementById('wk-toggle-status');
    const toggleText = document.getElementById('wk-toggle-status-text');
    if (toggle) toggle.checked = w.is_active !== false;
    if (toggleText) toggleText.textContent = w.is_active !== false ? 'Trabajador Activo' : 'Trabajador Inactivo';

    abrirModal('modal-worker-form-backdrop');
  } catch (err) {
    console.error('[Workers] Error al cargar datos del trabajador:', err);
    showToast('Error al cargar los datos del trabajador.', 'error');
  }
}

function cerrarModal(backdropId) {
  const el = document.getElementById(backdropId);
  if (el) {
    el.classList.remove('modal-open');
    el.setAttribute('aria-hidden', 'true');
  }
}

function abrirModal(backdropId) {
  const el = document.getElementById(backdropId);
  if (el) {
    el.classList.add('modal-open');
    el.setAttribute('aria-hidden', 'false');
  }
}

function resetFormulario() {
  const form = document.getElementById('form-worker');
  if (form) form.reset();
  // Limpiar errores
  document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
  document.querySelectorAll('.form-input.error').forEach(e => e.classList.remove('error'));

  // Toggle default
  const toggle = document.getElementById('wk-toggle-status');
  const toggleText = document.getElementById('wk-toggle-status-text');
  if (toggle) toggle.checked = true;
  if (toggleText) toggleText.textContent = 'Trabajador Activo';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== null && val !== undefined ? val : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Submit del Formulario
// ─────────────────────────────────────────────────────────────────────────────

async function handleSubmitFormulario(e) {
  e.preventDefault();

  const id = document.getElementById('form-worker-id').value.trim();
  const isEdit = Boolean(id);

  // Limpiar errores previos
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));

  // Recopilar valores
  const firstName    = document.getElementById('wk-first-name').value.trim();
  const secondName   = document.getElementById('wk-second-name').value.trim();
  const lastName     = document.getElementById('wk-last-name').value.trim();
  const secondLastName = document.getElementById('wk-second-last-name').value.trim();
  const docType      = document.getElementById('wk-doc-type').value;
  const docNumber    = document.getElementById('wk-doc-number').value.trim();
  const birthDate    = document.getElementById('wk-birth-date').value;
  const email        = document.getElementById('wk-email').value.trim();
  const phone        = document.getElementById('wk-phone').value.trim();
  const empNumber    = document.getElementById('wk-emp-number').value.trim();
  const dept         = document.getElementById('wk-dept').value.trim();
  const pos          = document.getElementById('wk-pos').value.trim();
  const salary       = document.getElementById('wk-salary').value;
  const isActive     = document.getElementById('wk-toggle-status').checked;

  // Validaciones básicas
  let hasErrors = false;
  const setError = (errId, msg, inputId) => {
    const errEl = document.getElementById(errId);
    if (errEl) errEl.textContent = msg;
    if (inputId) {
      const inputEl = document.getElementById(inputId);
      if (inputEl) inputEl.classList.add('error');
    }
    hasErrors = true;
  };

  if (!firstName) setError('error-wk-first-name', 'El primer nombre es obligatorio.', 'wk-first-name');
  if (!lastName)  setError('error-wk-last-name', 'El primer apellido es obligatorio.', 'wk-last-name');
  if (!docNumber) setError('error-wk-doc', 'El número de documento es obligatorio.', 'wk-doc-number');
  if (!birthDate) setError('error-wk-birth-date', 'La fecha de nacimiento es obligatoria.', 'wk-birth-date');
  if (!empNumber) setError('error-wk-emp-number', 'La ficha/número de empleado es obligatorio.', 'wk-emp-number');
  if (!dept)      setError('error-wk-dept', 'El departamento es obligatorio.', 'wk-dept');
  if (!pos)       setError('error-wk-pos', 'El cargo es obligatorio.', 'wk-pos');

  if (hasErrors) return;

  // Construir payload
  const payload = {
    first_name: firstName,
    second_name: secondName,
    last_name: lastName,
    second_last_name: secondLastName,
    identity_document: `${docType}-${docNumber}`,
    birth_date: birthDate,
    email: email || null,
    phone: phone || '',
    employee_number: empNumber,
    department: dept,
    position: pos,
    salary: parseFloat(salary) || 0,
    is_active: isActive
  };

  // Solo se requiere password en creación
  if (!isEdit) {
    // Generar contraseña temporal basada en cédula + nombre
    payload.password = `Tw${docNumber.replace(/\D/g, '').slice(-4)}!24`;
  }

  // Mostrar spinner
  const spinner = document.getElementById('worker-form-spinner');
  const btnText = document.getElementById('btn-submit-worker-text');
  const btnSubmit = document.getElementById('btn-submit-worker');
  if (spinner) spinner.style.display = 'inline-block';
  if (btnText) btnText.textContent = isEdit ? 'Guardando...' : 'Registrando...';
  if (btnSubmit) btnSubmit.disabled = true;

  try {
    if (isEdit) {
      await actualizarTrabajador(id, payload);
      showToast('Trabajador actualizado exitosamente.', 'success');
    } else {
      await crearTrabajador(payload);
      showToast('Trabajador registrado exitosamente.', 'success');
    }
    cerrarModal('modal-worker-form-backdrop');
    await cargarTrabajadores(true);
  } catch (err) {
    console.error('[Workers] Error al guardar trabajador:', err);
    const errMsg = extraerMensajeError(err);
    showToast(errMsg, 'error', 5000);
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (btnText) btnText.textContent = isEdit ? 'Guardar Cambios' : 'Registrar Trabajador';
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

function extraerMensajeError(err) {
  if (!err) return 'Error desconocido.';
  if (err.data && typeof err.data === 'object') {
    const msgs = Object.entries(err.data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' | ');
    if (msgs) return msgs;
  }
  return err.message || 'Error al conectar con el servidor.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Eliminar
// ─────────────────────────────────────────────────────────────────────────────

async function confirmarEliminar(id) {
  const worker = state.workers.find(w => String(w.id) === String(id));
  const nombre = worker?.full_name || `${worker?.first_name || ''} ${worker?.last_name || ''}`.trim() || 'este trabajador';

  const confirmed = await showConfirmModal({
    title: 'Eliminar Trabajador',
    message: `¿Estás seguro de que deseas eliminar a <strong>${escapeHtml(nombre)}</strong>? Esta acción no se puede deshacer.`,
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });

  if (!confirmed) return;

  try {
    await eliminarTrabajador(id);
    showToast(`Trabajador eliminado correctamente.`, 'success');
    await cargarTrabajadores();
  } catch (err) {
    console.error('[Workers] Error al eliminar trabajador:', err);
    showToast('No se pudo eliminar el trabajador.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ver perfil completo (redirige a employee-ledger)
// ─────────────────────────────────────────────────────────────────────────────

function verPerfilCompleto(id) {
  window.location.href = `../employee_store/employee-statement.html?id=${encodeURIComponent(id)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inicialización
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  // Cargar navbar, drawer, footer
  await loadAdminComponents({ title: 'Directorio de Trabajadores' });

  // Cargar datos iniciales
  await cargarTrabajadores();

  // ── Botones de encabezado ──
  const btnNuevo = document.getElementById('btn-new-worker');
  if (btnNuevo) btnNuevo.addEventListener('click', abrirModalCrear);

  const btnReload = document.getElementById('btn-reload-workers');
  if (btnReload) btnReload.addEventListener('click', () => cargarTrabajadores(true));

  // ── Búsqueda con debounce ──
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => {
        state.filters.search = searchInput.value.trim();
        cargarTrabajadores(true);
      }, 380);
    });
  }

  // ── Filtro Estado ──
  const filterStatus = document.getElementById('filter-status');
  if (filterStatus) {
    filterStatus.addEventListener('change', () => {
      state.filters.status = filterStatus.value;
      cargarTrabajadores(true);
    });
  }

  // ── Filtro Departamento ──
  const filterDept = document.getElementById('filter-dept');
  if (filterDept) {
    filterDept.addEventListener('change', () => {
      state.filters.department = filterDept.value;
      // Filtrado client-side sobre los datos ya cargados
      let filtered = state.workers;
      if (state.filters.department !== 'all') {
        filtered = state.workers.filter(w =>
          (w.department || '').toLowerCase() === state.filters.department.toLowerCase()
        );
      }
      renderizarTabla(filtered);
    });
  }

  // ── Limpiar filtros ──
  const btnClear = document.getElementById('btn-clear-filters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      state.filters = { search: '', status: 'all', department: 'all' };
      if (searchInput) searchInput.value = '';
      if (filterStatus) filterStatus.value = 'all';
      if (filterDept) filterDept.value = 'all';
      cargarTrabajadores(true);
    });
  }

  // ── Cerrar modal formulario ──
  ['btn-close-worker-form', 'btn-cancel-worker-form'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => cerrarModal('modal-worker-form-backdrop'));
  });

  // Clic en backdrop cierra el modal
  const backdrop = document.getElementById('modal-worker-form-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cerrarModal('modal-worker-form-backdrop');
    });
  }

  // ── Submit del formulario ──
  const form = document.getElementById('form-worker');
  if (form) form.addEventListener('submit', handleSubmitFormulario);

  // Toggle label update
  const toggleStatus = document.getElementById('wk-toggle-status');
  const toggleText   = document.getElementById('wk-toggle-status-text');
  if (toggleStatus && toggleText) {
    toggleStatus.addEventListener('change', () => {
      toggleText.textContent = toggleStatus.checked ? 'Trabajador Activo' : 'Trabajador Inactivo';
    });
  }

  // ── Escape key cierra modales ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarModal('modal-worker-form-backdrop');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
