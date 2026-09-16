import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { getDistributor, updateDistributor, createDistributorCoverage, updateDistributorCoverage, deleteDistributorCoverage } from './shipping.api.js';

const id = new URLSearchParams(location.search).get('id');
const list = document.getElementById('coverage-list');
const status = document.getElementById('status');
const phoneInput = document.getElementById('phone');
let distributor;
let isEditing = false;

/**
 * Sanitiza números de teléfono permitiendo únicamente dígitos y el signo +
 * @param {string} val
 * @returns {string}
 */
function sanitizePhone(val) {
  let clean = val.replace(/[^\d+]/g, '');
  if (clean.includes('+')) {
    clean = (clean.startsWith('+') ? '+' : '') + clean.replace(/\+/g, '');
  }
  return clean;
}

/**
 * Sanitiza campos de texto permitiendo únicamente letras y espacios (sin números ni caracteres especiales)
 * @param {string} val
 * @returns {string}
 */
function sanitizeLettersAndSpaces(val) {
  return val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function coverageRow(coverage = {}) {
  return `
    <tr data-id="${coverage.id || ''}">
      <td>
        <input data-field="state" value="${esc(coverage.state || '')}" placeholder="Ej. Miranda" required maxlength="100">
      </td>
      <td>
        <input data-field="municipality" value="${esc(coverage.municipality || '')}" placeholder="Ej. Sucre" maxlength="100">
      </td>
      <td>
        <input data-field="city" value="${esc(coverage.city || '')}" placeholder="Ej. Caracas" maxlength="100">
      </td>
      <td>
        <input data-field="days" value="${coverage.estimated_days_min || 1}-${coverage.estimated_days_max || 3}" placeholder="1-3" maxlength="10">
      </td>
      <td>
        <input data-field="base_shipping_cost" type="number" min="0" step="0.01" value="${coverage.base_shipping_cost || 0}">
      </td>
      <td>
        <select data-field="is_active">
          <option value="true" ${coverage.is_active !== false ? 'selected' : ''}>Activa</option>
          <option value="false" ${coverage.is_active === false ? 'selected' : ''}>Inactiva</option>
        </select>
      </td>
      <td>
        <div class="table-action-btns">
          <button type="button" class="btn-table-action btn-table-save" data-save title="Guardar cobertura">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span>Guardar</span>
          </button>
          <button type="button" class="btn-table-action btn-table-delete" data-delete title="Eliminar cobertura">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Eliminar</span>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function rowData(row) {
  const data = {};
  row.querySelectorAll('[data-field]').forEach((input) => {
    data[input.dataset.field] = input.value.trim();
  });
  const rawDays = data.days || '1-3';
  const days = rawDays.split('-').map((d) => parseInt(d.trim(), 10));

  return {
    state: sanitizeLettersAndSpaces(data.state || ''),
    municipality: sanitizeLettersAndSpaces(data.municipality || ''),
    city: sanitizeLettersAndSpaces(data.city || ''),
    estimated_days_min: !isNaN(days[0]) && days[0] > 0 ? days[0] : 1,
    estimated_days_max: !isNaN(days[1]) && days[1] > 0 ? days[1] : (!isNaN(days[0]) && days[0] > 0 ? days[0] : 3),
    base_shipping_cost: parseFloat(data.base_shipping_cost) || 0,
    is_active: data.is_active === 'true',
    distributor: id
  };
}

function bindRow(row) {
  // Validación de solo letras y espacios en tiempo real para ubicación
  row.querySelectorAll('input[data-field="state"], input[data-field="municipality"], input[data-field="city"]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const cleanVal = sanitizeLettersAndSpaces(e.target.value);
      if (cleanVal !== e.target.value) {
        e.target.value = cleanVal;
      }
    });
  });

  const saveBtn = row.querySelector('[data-save]');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        status.textContent = 'Guardando zona de cobertura...';
        status.style.color = 'var(--dist-muted)';
        const data = rowData(row);
        if (!data.state) {
          status.textContent = 'El estado es obligatorio en la cobertura.';
          status.style.color = '#dc2626';
          return;
        }

        const coverageId = row.dataset.id;
        const saved = coverageId
          ? await updateDistributorCoverage(coverageId, data)
          : await createDistributorCoverage(data);

        const newRow = rowFrom(saved);
        row.replaceWith(newRow);
        setEditing(isEditing);

        status.textContent = 'Zona de cobertura guardada con éxito.';
        status.style.color = '#16a34a';
      } catch (error) {
        status.textContent = error?.message || 'No se pudo guardar la cobertura.';
        status.style.color = '#dc2626';
      }
    };
  }

  const deleteBtn = row.querySelector('[data-delete]');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!row.dataset.id) {
        return row.remove();
      }
      if (!confirm('¿Estás seguro de eliminar esta zona de cobertura?')) {
        return;
      }

      try {
        status.textContent = 'Eliminando zona...';
        status.style.color = 'var(--dist-muted)';
        await deleteDistributorCoverage(row.dataset.id);
        row.remove();
        status.textContent = 'Zona eliminada correctamente.';
        status.style.color = '#16a34a';
      } catch (error) {
        status.textContent = error?.message || 'No se pudo eliminar la zona.';
        status.style.color = '#dc2626';
      }
    };
  }
}

function rowFrom(data) {
  const temp = document.createElement('tbody');
  temp.innerHTML = coverageRow(data);
  const row = temp.firstElementChild;
  bindRow(row);
  return row;
}

function addCoverage() {
  const row = rowFrom({
    state: '',
    municipality: '',
    city: '',
    estimated_days_min: 1,
    estimated_days_max: 3,
    base_shipping_cost: 0,
    is_active: true
  });
  list.appendChild(row);
  if (isEditing) {
    row.querySelectorAll('input, select, button').forEach((el) => {
      el.disabled = false;
    });
  }
}

function setEditing(enabled) {
  isEditing = enabled;

  document.querySelectorAll('#name, #rif, #phone, #email, #coverage_type, #is_active').forEach((field) => {
    field.disabled = !enabled;
  });

  document.querySelectorAll('#coverage-list input, #coverage-list select, #coverage-list button').forEach((field) => {
    field.disabled = !enabled;
  });

  const addCoverageBtn = document.getElementById('add-coverage');
  if (addCoverageBtn) {
    addCoverageBtn.disabled = !enabled;
  }

  const saveDistributorBtn = document.getElementById('save-distributor');
  if (saveDistributorBtn) {
    saveDistributorBtn.disabled = !enabled;
  }

  const toggle = document.getElementById('toggle-edit');
  if (toggle) {
    toggle.innerHTML = enabled
      ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><span>Bloquear edición</span>`
      : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>Habilitar edición</span>`;
  }
}

// Validación de teléfono en tiempo real
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    const cleanVal = sanitizePhone(e.target.value);
    if (cleanVal !== e.target.value) {
      e.target.value = cleanVal;
    }
  });
}

await loadAdminComponents({ title: 'Detalle de Distribuidor' });

if (!id) {
  location.href = 'shipping.html';
}

try {
  distributor = await getDistributor(id);
  document.getElementById('page-title').textContent = distributor.name;
  document.getElementById('page-subtitle').textContent = distributor.cobertura_resumen || 'Información y cobertura registrada.';

  ['name', 'rif', 'phone', 'email', 'coverage_type'].forEach((field) => {
    const el = document.getElementById(field);
    if (el) el.value = distributor[field] || '';
  });

  const isActiveEl = document.getElementById('is_active');
  if (isActiveEl) {
    isActiveEl.value = String(distributor.is_active !== false);
  }

  (distributor.coverages || []).forEach((coverage) => {
    list.appendChild(rowFrom(coverage));
  });
} catch (error) {
  status.textContent = error?.message || 'No se pudo cargar el distribuidor.';
  status.style.color = '#dc2626';
}

const addCovBtn = document.getElementById('add-coverage');
if (addCovBtn) {
  addCovBtn.onclick = addCoverage;
}

const toggleEditBtn = document.getElementById('toggle-edit');
if (toggleEditBtn) {
  toggleEditBtn.onclick = () => setEditing(!isEditing);
}

const saveDistBtn = document.getElementById('save-distributor');
if (saveDistBtn) {
  saveDistBtn.onclick = async () => {
    try {
      status.textContent = 'Guardando cambios...';
      status.style.color = 'var(--dist-muted)';

      distributor = await updateDistributor(id, {
        name: document.getElementById('name').value.trim(),
        rif: document.getElementById('rif').value.trim(),
        phone: sanitizePhone(document.getElementById('phone').value.trim()),
        email: document.getElementById('email').value.trim(),
        coverage_type: document.getElementById('coverage_type').value,
        is_active: document.getElementById('is_active').value === 'true'
      });

      status.textContent = 'Cambios guardados correctamente.';
      status.style.color = '#16a34a';
    } catch (error) {
      status.textContent = error?.message || 'No se pudieron guardar los cambios.';
      status.style.color = '#dc2626';
    }
  };
}

setEditing(false);
