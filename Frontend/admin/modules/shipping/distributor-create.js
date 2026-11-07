import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { createDistributor, createDistributorCoverage } from './shipping.api.js';

const list = document.getElementById('coverage-list');
const status = document.getElementById('form-status');
const phoneInput = document.getElementById('phone');

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

/**
 * Enlaza la validación de solo letras y espacios en los campos de ubicación
 * @param {HTMLElement} container
 */
function bindLocationFields(container) {
  container.querySelectorAll('input[data-field="state"], input[data-field="municipality"], input[data-field="city"]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const cleanVal = sanitizeLettersAndSpaces(e.target.value);
      if (cleanVal !== e.target.value) {
        e.target.value = cleanVal;
      }
    });
  });
}

function addCoverage() {
  const row = document.createElement('div');
  row.className = 'coverage-row';
  row.innerHTML = `
    <div class="coverage-field-state">
      <label>Estado <span class="required-star">*</span></label>
      <input data-field="state" placeholder="Ej. Miranda" required maxlength="100">
    </div>
    <div class="coverage-field-municipality">
      <label>Municipio</label>
      <input data-field="municipality" placeholder="Ej. Sucre" maxlength="100">
    </div>
    <div class="coverage-field-city">
      <label>Ciudad</label>
      <input data-field="city" placeholder="Ej. Caracas" maxlength="100">
    </div>
    <div class="coverage-field-min-days">
      <label>Días mín.</label>
      <input data-field="estimated_days_min" type="number" min="1" max="90" value="1">
    </div>
    <div class="coverage-field-max-days">
      <label>Días máx.</label>
      <input data-field="estimated_days_max" type="number" min="1" max="90" value="3">
    </div>
    <div class="coverage-field-cost">
      <label>Flete base ($)</label>
      <input data-field="base_shipping_cost" type="number" min="0" step="0.01" value="0.00">
    </div>
    <div class="coverage-field-action">
      <button type="button" class="coverage-btn-remove" data-remove aria-label="Eliminar zona">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>Eliminar</span>
      </button>
    </div>
  `;

  bindLocationFields(row);
  row.querySelector('[data-remove]').onclick = () => row.remove();
  list.appendChild(row);
}

function value(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function rowData(row) {
  const data = {};
  row.querySelectorAll('[data-field]').forEach((input) => {
    data[input.dataset.field] = input.value.trim();
  });
  return data;
}

// Configuración de validación de teléfono en tiempo real
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    const cleanVal = sanitizePhone(e.target.value);
    if (cleanVal !== e.target.value) {
      e.target.value = cleanVal;
    }
  });
}

await loadAdminComponents({ title: 'Registrar Distribuidor' });
addCoverage();
document.getElementById('add-coverage').onclick = addCoverage;

document.getElementById('distributor-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = 'Guardando distribuidor y coberturas...';
  status.style.color = 'var(--dist-muted)';

  try {
    const distributor = await createDistributor({
      name: value('name'),
      rif: value('rif'),
      phone: sanitizePhone(value('phone')),
      email: value('email'),
      coverage_type: value('coverage_type'),
      is_active: value('is_active') === 'true'
    });

    const rows = [...list.querySelectorAll('.coverage-row')];
    for (const row of rows) {
      const data = rowData(row);
      if (data.state) {
        await createDistributorCoverage({
          ...data,
          state: sanitizeLettersAndSpaces(data.state),
          municipality: sanitizeLettersAndSpaces(data.municipality || ''),
          city: sanitizeLettersAndSpaces(data.city || ''),
          estimated_days_min: parseInt(data.estimated_days_min, 10) || 1,
          estimated_days_max: parseInt(data.estimated_days_max, 10) || 3,
          base_shipping_cost: parseFloat(data.base_shipping_cost) || 0,
          distributor: distributor.id
        });
      }
    }

    window.location.href = `distributor-detail.html?id=${distributor.id}`;
  } catch (error) {
    status.textContent = error?.message || 'No se pudo guardar el distribuidor.';
    status.style.color = '#dc2626';
  }
});
