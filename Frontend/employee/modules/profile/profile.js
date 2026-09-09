/**
 * ==========================================================================
 * TUESTANTE - CONTROLADOR MI PERFIL Y ESTADO DE CUENTA
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { showAlertModal } from '../../components/dialog/dialog.js';
import { obtenerEstadoDeCuenta } from './profile.api.js';

async function loadComponent(placeholderId, filePath) {
  try {
    const res = await fetch(`${filePath}?_t=${Date.now()}`);
    if (res.ok) {
      document.getElementById(placeholderId).innerHTML = await res.text();
    }
  } catch (err) {
    console.error(`Error cargando componente ${filePath}:`, err);
  }
}

/**
 * Carga el estado de cuenta y perfil del empleado autenticado
 */
async function loadEmployeeStatement() {
  try {
    const data = await obtenerEstadoDeCuenta();
    if (!data) throw new Error('No se recibieron datos de estado de cuenta.');

    renderProfileHeader(data.employee);
    renderDebtKpi(data);
    renderConsumos(data.orders || []);
    renderPagos(data.payments || []);
  } catch (err) {
    console.error('[Profile] Error cargando perfil:', err);
    document.getElementById('employee-full-name').textContent = 'Perfil no disponible';
    document.getElementById('kpi-current-debt').textContent = '$0.00';
  }
}

/**
 * Renderiza la cabecera del perfil
 */
function renderProfileHeader(employee) {
  if (!employee) return;

  const nameEl = document.getElementById('employee-full-name');
  const codeEl = document.getElementById('employee-number-display');
  const posEl = document.getElementById('employee-position');
  const salaryEl = document.getElementById('employee-salary');
  const statusBadge = document.getElementById('employee-badge-status');

  if (nameEl) nameEl.textContent = employee.full_name || employee.username || 'Colaborador';
  if (codeEl) codeEl.textContent = employee.employee_number || 'N/A';
  if (posEl) posEl.textContent = employee.position || 'No especificado';
  if (salaryEl) salaryEl.textContent = `$${parseFloat(employee.salary || 0).toFixed(2)}`;

  if (statusBadge) {
    if (employee.is_active) {
      statusBadge.className = 'badge badge-primary';
      statusBadge.textContent = 'Activo en Tienda';
    } else {
      statusBadge.className = 'badge badge-danger';
      statusBadge.textContent = 'Inactivo';
    }
  }
}

/**
 * Renderiza la tarjeta KPI de Deuda Acumulada
 */
function renderDebtKpi(data) {
  const debtAmountEl = document.getElementById('kpi-current-debt');
  const statusBadge = document.getElementById('kpi-debt-status');

  const currentDebt = parseFloat(data.current_debt || 0);
  if (debtAmountEl) {
    debtAmountEl.textContent = `$${currentDebt.toFixed(2)}`;
  }

  if (statusBadge) {
    if (data.has_overdue_debt) {
      statusBadge.className = 'badge badge-danger';
      statusBadge.textContent = 'Saldo en Revisión';
    } else if (currentDebt > 0) {
      statusBadge.className = 'badge badge-warning';
      statusBadge.textContent = 'Pendiente de Corte';
    } else {
      statusBadge.className = 'badge badge-success';
      statusBadge.textContent = 'Al Día';
    }
  }
}

/**
 * Renderiza la tabla de Consumos
 */
function renderConsumos(orders) {
  const tbody = document.getElementById('table-consumos-tbody');
  const countEl = document.getElementById('consumos-count');
  if (countEl) countEl.textContent = String(orders.length);

  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
          No posees consumos ni órdenes cargadas a tu cuenta.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map((order) => {
    const itemsCount = Array.isArray(order.items)
      ? order.items.reduce((s, i) => s + (i.quantity || 1), 0)
      : 1;

    const dateFormatted = order.created_at
      ? new Date(order.created_at).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })
      : 'Reciente';

    let statusBadge = '<span class="badge badge-warning">Sin entregar</span>';
    const normStatus = (order.status || '').toUpperCase();
    if (normStatus === 'DELIVERED' || normStatus === 'COMPLETED') {
      statusBadge = '<span class="badge badge-info">Entregado</span>';
    } else if (normStatus === 'PAID') {
      statusBadge = '<span class="badge badge-success">Pagado</span>';
    } else if (normStatus === 'CANCELLED') {
      statusBadge = '<span class="badge badge-danger">Cancelado</span>';
    }

    return `
      <tr>
        <td>
          <span class="order-code-badge">#${order.order_number || order.id}</span>
        </td>
        <td>${dateFormatted}</td>
        <td>${itemsCount} ${itemsCount === 1 ? 'artículo' : 'artículos'}</td>
        <td>
          <strong class="text-primary">$${parseFloat(order.total_amount || 0).toFixed(2)}</strong>
        </td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Renderiza la tabla de Pagos y Descuentos
 */
function renderPagos(payments) {
  const tbody = document.getElementById('table-pagos-tbody');
  const countEl = document.getElementById('pagos-count');
  if (countEl) countEl.textContent = String(payments.length);

  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
          No se han registrado amortizaciones o deducciones de nómina aún.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = payments.map((pay) => {
    const dateFormatted = pay.created_at
      ? new Date(pay.created_at).toLocaleDateString('es-VE', { dateStyle: 'medium' })
      : 'N/A';

    // Mapeo amigable de tipo de pago
    let typeName = 'Descuento por Nómina';
    if (pay.payment_type === 'CASH') typeName = 'Abono Directo (Efectivo)';
    else if (pay.payment_type === 'TRANSFER') typeName = 'Transferencia Bancaria';
    else if (pay.payment_type_display) typeName = pay.payment_type_display;

    const ref = pay.reference || 'Deducción Quincenal';
    const regBy = pay.registered_by_name || 'Sistema Nómina';

    const voucherBtn = pay.reference
      ? `<button type="button" class="btn btn-outline btn-voucher" data-ref="${pay.reference}" data-date="${dateFormatted}" data-amount="${pay.amount}">Ver Ref</button>`
      : `<span style="font-size: 0.75rem; color: var(--color-text-muted);">Sin soporte</span>`;

    return `
      <tr>
        <td>${dateFormatted}</td>
        <td>
          <span class="badge badge-primary">${typeName}</span>
        </td>
        <td style="font-family: monospace;">${ref}</td>
        <td>${regBy}</td>
        <td style="text-align: right; color: var(--color-success); font-weight: 700;">
          -$${parseFloat(pay.amount || 0).toFixed(2)}
        </td>
        <td style="text-align: center;">${voucherBtn}</td>
      </tr>
    `;
  }).join('');

  tbody.onclick = (e) => {
    const btn = e.target.closest('.btn-voucher');
    if (btn) {
      const { ref, date, amount } = btn.dataset;
      showAlertModal({
        title: 'Comprobante de Retención',
        message: `Referencia: ${ref}\nFecha: ${date}\nMonto: $${parseFloat(amount || 0).toFixed(2)}`,
        type: 'info'
      });
    }
  };
}

/**
 * Conmutador interactivo de pestañas
 */
function setupTabs() {
  const btnConsumos = document.getElementById('tab-btn-consumos');
  const btnPagos = document.getElementById('tab-btn-pagos');
  const paneConsumos = document.getElementById('tab-pane-consumos');
  const panePagos = document.getElementById('tab-pane-pagos');

  btnConsumos?.addEventListener('click', () => {
    btnConsumos.classList.add('active');
    btnConsumos.setAttribute('aria-selected', 'true');
    btnPagos.classList.remove('active');
    btnPagos.setAttribute('aria-selected', 'false');

    paneConsumos.style.display = 'block';
    panePagos.style.display = 'none';
  });

  btnPagos?.addEventListener('click', () => {
    btnPagos.classList.add('active');
    btnPagos.setAttribute('aria-selected', 'true');
    btnConsumos.classList.remove('active');
    btnConsumos.setAttribute('aria-selected', 'false');

    panePagos.style.display = 'block';
    paneConsumos.style.display = 'none';
  });
}

// Inicialización de la pantalla
async function initProfilePage() {
  initNavbar('navbar-placeholder');
  initFooter('footer-placeholder');
  setupTabs();

  loadEmployeeStatement();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}
