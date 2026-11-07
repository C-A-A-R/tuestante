import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * ==========================================================================
 * CONTROLADOR - MÓDULO DE ENVÍOS Y DESPACHO (SHIPPING) - TUESTANTE
 * Manejo de listados de envíos, transportadores en texto, filtros reactivos,
 * modales de seguimiento, registro de envíos y emisión de guías de despacho.
 * ==========================================================================
 */

import { 
  getShipments, 
  getShipment, 
  createShipment, 
  updateShipmentStatus, 
  getShipmentMetrics, 
  getDistributors, 
  createDistributor, 
  getOrdersForShipmentSelect, 
  getShipmentStatusConfig,
  SHIPMENT_STATUSES 
} from './shipping.api.js';

// Estado local del módulo
const state = {
  shipments: [],
  metrics: null,
  distributors: [],
  availableOrders: [],
  filters: {
    search: '',
    status: 'all',
    distributor: 'all',
    date_from: '',
    date_to: ''
  },
  pagination: {
    currentPage: 1,
    itemsPerPage: 8,
    totalItems: 0
  },
  activeShipment: null
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar Drawer y Navbar con título "Envíos"
  await loadAdminComponents({ title: 'Envíos' });
  // 2. Resaltar enlace en el menú lateral
  highlightDrawerLink();

  // 3. Vincular eventos de filtros, pestañas y modales
  setupMainViewTabs();
  setupFilterEvents();
  setupTabsEvents();
  setupModalEvents();
  setupOrderAutocomplete();
  setupDistributorSearchFilter();

  // 4. Cargar datos iniciales
  await Promise.all([
    loadShipmentMetrics(),
    loadShipmentsData(),
    loadDistributorsData()
  ]);
});

/**
 * Resalta la pestaña de Envíos en el Drawer lateral
 */
function highlightDrawerLink() {
  setTimeout(() => {
    document.querySelectorAll('.drawer-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-nav-id') === 'envios') {
        link.classList.add('active');
      }
    });
  }, 200);
}

function setupMainViewTabs() {
  const tabShipments = document.getElementById('tab-nav-shipments');
  const tabDistributors = document.getElementById('tab-nav-distributors');
  const shipmentsPane = document.getElementById('view-shipments-pane');
  const distributorsPane = document.getElementById('view-distributors-pane');

  if (!tabShipments || !tabDistributors || !shipmentsPane || !distributorsPane) return;

  const activateView = (activeTab, inactiveTab, activePane, inactivePane) => {
    activeTab.classList.add('active');
    activeTab.setAttribute('aria-selected', 'true');
    inactiveTab.classList.remove('active');
    inactiveTab.setAttribute('aria-selected', 'false');
    activePane.classList.remove('hidden');
    inactivePane.classList.add('hidden');
  };

  tabShipments.addEventListener('click', () => {
    activateView(tabShipments, tabDistributors, shipmentsPane, distributorsPane);
  });

  tabDistributors.addEventListener('click', () => {
    activateView(tabDistributors, tabShipments, distributorsPane, shipmentsPane);
  });
}

// ==========================================================================
// CARGA DE DATOS Y MÉTRICAS
// ==========================================================================

async function loadShipmentMetrics() {
  try {
    const m = await getShipmentMetrics();
    state.metrics = m;

    const elPendingCount = document.getElementById('kpi-pending-count');
    const elTransitCount = document.getElementById('kpi-transit-count');
    const elDeliveredTodayCount = document.getElementById('kpi-delivered-today-count');
    const elDeliveredMonthCount = document.getElementById('kpi-delivered-month-count');
    const elReturnedCount = document.getElementById('kpi-returned-count');

    // Badges en pestañas
    const tabBadgePending = document.getElementById('tab-badge-pending');
    const tabBadgeTransit = document.getElementById('tab-badge-transit');

    if (m && m.pending) {
      if (elPendingCount) elPendingCount.textContent = m.pending.count;
      if (tabBadgePending) tabBadgePending.textContent = m.pending.count;
    }

    if (m && m.in_transit) {
      if (elTransitCount) elTransitCount.textContent = m.in_transit.count;
      if (tabBadgeTransit) tabBadgeTransit.textContent = m.in_transit.count;
    }

    if (m && m.delivered_today && elDeliveredTodayCount) {
      elDeliveredTodayCount.textContent = m.delivered_today.count;
    }
    if (m && m.delivered_month && elDeliveredMonthCount) {
      elDeliveredMonthCount.textContent = m.delivered_month.count;
    }
    if (m && m.returned && elReturnedCount) {
      elReturnedCount.textContent = m.returned.count;
    }

    // Submontos opcionales
    const elPendingSub = document.getElementById('kpi-pending-sub');
    const elTransitSub = document.getElementById('kpi-transit-sub');
    const elDeliveredTodaySub = document.getElementById('kpi-delivered-today-sub');
    const elDeliveredMonthSub = document.getElementById('kpi-delivered-month-sub');
    const elReturnedSub = document.getElementById('kpi-returned-sub');

    if (elPendingSub && m?.pending?.amount_usd !== undefined) elPendingSub.textContent = `$${Number(m.pending.amount_usd).toFixed(2)}`;
    if (elTransitSub && m?.in_transit?.amount_usd !== undefined) elTransitSub.textContent = `$${Number(m.in_transit.amount_usd).toFixed(2)}`;
    if (elDeliveredTodaySub && m?.delivered_today?.amount_usd !== undefined) elDeliveredTodaySub.textContent = `$${Number(m.delivered_today.amount_usd).toFixed(2)}`;
    if (elDeliveredMonthSub && m?.delivered_month?.amount_usd !== undefined) elDeliveredMonthSub.textContent = `$${Number(m.delivered_month.amount_usd).toFixed(2)}`;
    if (elReturnedSub && m?.returned?.amount_usd !== undefined) elReturnedSub.textContent = `$${Number(m.returned.amount_usd).toFixed(2)}`;

  } catch (err) {
    console.error('Error al cargar métricas de envíos:', err);
  }
}

async function loadShipmentsData() {
  try {
    const data = await getShipments(state.filters);
    state.shipments = data;
    renderShipmentsTable();
    renderPagination();
  } catch (err) {
    console.error('Error al cargar envíos:', err);
  }
}

async function loadDistributorsData() {
  try {
    const dists = await getDistributors();
    state.distributors = dists;
    populateDistributorSelects(dists);
    renderDistributorsMainTable(dists);
    updateDistributorsTableInfo(dists.length);
  } catch (err) {
    console.error('Error al cargar distribuidores:', err);
  }
}

function populateDistributorSelects(dists = []) {
  const filterSelect = document.getElementById('filter-distributor');
  const modalSelect = document.getElementById('new-ship-distributor-select');

  if (filterSelect) {
    const currentVal = filterSelect.value || 'all';
    filterSelect.innerHTML = '<option value="all">Todos los transportadores</option>' +
      dists.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join('');
    filterSelect.value = currentVal;
  }

  if (modalSelect) {
    modalSelect.innerHTML = dists.map(d => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.rif || 'Aliado')})</option>`).join('');
  }
}

// ==========================================================================
// RENDERIZADO DE TABLA DE ENVÍOS
// ==========================================================================

function renderShipmentsTable() {
  const tbody = document.getElementById('shipping-table-body');
  if (!tbody) return;

  const total = state.shipments.length;
  state.pagination.totalItems = total;

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No se encontraron envíos con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  const startIdx = (state.pagination.currentPage - 1) * state.pagination.itemsPerPage;
  const endIdx = startIdx + state.pagination.itemsPerPage;
  const pagedShipments = state.shipments.slice(startIdx, endIdx);

  tbody.innerHTML = pagedShipments.map(s => {
    const statusCfg = getShipmentStatusConfig(s.status);
    const carrierClass = getCarrierBadgeClass(s.distributor?.name);
    const shippedDateFormatted = s.shipped_at ? formatDateTime(s.shipped_at) : '—';
    const estDateFormatted = formatDate(s.estimated_date);

    return `
      <tr>
        <!-- Código de Envío -->
        <td>
          <span class="shipping-code-cell">${escapeHtml(s.shipment_code)}</span>
        </td>

        <!-- Pedido Asociado -->
        <td>
          <a href="../order/order-detail.html?id=${s.order_id}" class="order-link-pill" title="Ver pedido">
            ${escapeHtml(s.order_number)}
          </a>
        </td>

        <!-- Cliente -->
        <td>
          <span class="client-cell-name">${escapeHtml(s.client_name)}</span>
        </td>

        <!-- Transportador (En Texto como en el Backend) -->
        <td>
          <span class="carrier-badge ${carrierClass}">
            ${escapeHtml(s.distributor?.name || 'Flete Propio')}
          </span>
        </td>

        <!-- Costo de Envío -->
        <td>
          <div style="display: flex; flex-direction: column;">
            <strong style="font-size: 0.86rem; color: var(--primary);">$${(s.price || 0).toFixed(2)}</strong>
            <small style="font-size: 0.72rem; color: var(--text-muted);">Bs. ${formatVES(s.price_ves || (s.price || 0) * 36.5)}</small>
          </div>
        </td>

        <!-- Estado -->
        <td>
          <span class="status-pill ${statusCfg.badgeClass}">
            <span class="status-dot"></span>
            <span>${statusCfg.label}</span>
          </span>
        </td>

        <!-- Fecha de Envío -->
        <td>
          <span class="date-text-cell">${shippedDateFormatted}</span>
        </td>

        <!-- Fecha Estimada de Entrega -->
        <td>
          <span class="date-text-cell">${estDateFormatted}</span>
        </td>

        <!-- Acciones -->
        <td style="text-align: right;">
          <div class="table-actions-cell">
            <button 
              type="button" 
              class="btn-icon-only btn-view-shipment" 
              data-shipment-id="${s.id}" 
              title="Ver detalle y seguimiento de entrega" 
              aria-label="Ver detalle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button 
              type="button" 
              class="btn-icon-only btn-quick-status" 
              data-shipment-id="${s.id}" 
              title="Actualizar estado del envío" 
              aria-label="Actualizar estado">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Vincular eventos de botones
  tbody.querySelectorAll('.btn-view-shipment').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-shipment-id'), 10);
      window.location.href = `shipping-detail.html?id=${id}`;
    });
  });

  tbody.querySelectorAll('.btn-quick-status').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-shipment-id'), 10);
      openUpdateStatusModal(id);
    });
  });
}

function getCarrierBadgeClass(name = '') {
  const n = (name || '').toLowerCase();
  if (n.includes('mrw')) return 'carrier-mrw';
  if (n.includes('zoom')) return 'carrier-zoom';
  if (n.includes('dhl')) return 'carrier-dhl';
  if (n.includes('tealca')) return 'carrier-tealca';
  if (n.includes('domesa')) return 'carrier-domesa';
  return 'carrier-flete';
}

// ==========================================================================
// PAGINACIÓN
// ==========================================================================

function renderPagination() {
  const infoEl = document.getElementById('pagination-info');
  const controlsEl = document.getElementById('pagination-controls');
  if (!infoEl || !controlsEl) return;

  const total = state.pagination.totalItems;
  const itemsPerPage = state.pagination.itemsPerPage;
  const totalPages = Math.ceil(total / itemsPerPage) || 1;
  const current = state.pagination.currentPage;

  const start = total === 0 ? 0 : (current - 1) * itemsPerPage + 1;
  const end = Math.min(current * itemsPerPage, total);

  infoEl.innerHTML = `Mostrando <strong>${start}</strong> a <strong>${end}</strong> de <strong>${total}</strong> envíos`;

  let buttonsHtml = `
    <button type="button" class="btn-pag" id="btn-pag-prev" ${current <= 1 ? 'disabled' : ''}>
      &lt; Anterior
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    buttonsHtml += `
      <button type="button" class="btn-pag ${i === current ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  buttonsHtml += `
    <button type="button" class="btn-pag" id="btn-pag-next" ${current >= totalPages ? 'disabled' : ''}>
      Siguiente &gt;
    </button>
  `;

  controlsEl.innerHTML = buttonsHtml;

  controlsEl.querySelectorAll('.btn-pag[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pagination.currentPage = parseInt(btn.getAttribute('data-page'), 10);
      renderShipmentsTable();
      renderPagination();
    });
  });

  const prevBtn = document.getElementById('btn-pag-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage--;
        renderShipmentsTable();
        renderPagination();
      }
    });
  }

  const nextBtn = document.getElementById('btn-pag-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.pagination.currentPage < totalPages) {
        state.pagination.currentPage++;
        renderShipmentsTable();
        renderPagination();
      }
    });
  }
}

// ==========================================================================
// EVENTOS DE FILTRADO Y PESTAÑAS
// ==========================================================================

function setupFilterEvents() {
  const searchInput = document.getElementById('filter-search');
  const statusSelect = document.getElementById('filter-status');
  const distSelect = document.getElementById('filter-distributor');
  const dateFrom = document.getElementById('filter-date-from');
  const dateTo = document.getElementById('filter-date-to');
  const clearBtn = document.getElementById('btn-clear-filters');

  let debounce = null;

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.filters.search = searchInput.value.trim();
        state.pagination.currentPage = 1;
        loadShipmentsData();
      }, 250);
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      state.filters.status = statusSelect.value;
      state.pagination.currentPage = 1;
      // Sincronizar pestaña activa
      syncActiveTab(statusSelect.value);
      loadShipmentsData();
    });
  }

  if (distSelect) {
    distSelect.addEventListener('change', () => {
      state.filters.distributor = distSelect.value;
      state.pagination.currentPage = 1;
      loadShipmentsData();
    });
  }

  if (dateFrom) {
    dateFrom.addEventListener('change', () => {
      state.filters.date_from = dateFrom.value;
      state.pagination.currentPage = 1;
      loadShipmentsData();
    });
  }

  if (dateTo) {
    dateTo.addEventListener('change', () => {
      state.filters.date_to = dateTo.value;
      state.pagination.currentPage = 1;
      loadShipmentsData();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.filters.search = '';
      state.filters.status = 'all';
      state.filters.distributor = 'all';
      state.filters.date_from = '';
      state.filters.date_to = '';

      if (searchInput) searchInput.value = '';
      if (statusSelect) statusSelect.value = 'all';
      if (distSelect) distSelect.value = 'all';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';

      syncActiveTab('all');
      state.pagination.currentPage = 1;
      loadShipmentsData();
    });
  }
}

function setupTabsEvents() {
  const tabBtns = document.querySelectorAll('.status-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const targetStatus = btn.getAttribute('data-tab-status');
      state.filters.status = targetStatus;
      state.pagination.currentPage = 1;

      // Sincronizar selector de estado
      const statusSelect = document.getElementById('filter-status');
      if (statusSelect) statusSelect.value = targetStatus;

      loadShipmentsData();
    });
  });
}

function syncActiveTab(statusKey) {
  const tabBtns = document.querySelectorAll('.status-tab-btn');
  tabBtns.forEach(btn => {
    if (btn.getAttribute('data-tab-status') === statusKey) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    }
  });
}

// ==========================================================================
// GESTIÓN DE MODALES
// ==========================================================================

function setupModalEvents() {
  // Modal 1: Detalle de Envío
  const btnCloseDetail = document.getElementById('btn-close-detail-modal');
  const btnCancelDetail = document.getElementById('btn-cancel-detail-modal');
  const modalDetail = document.getElementById('modal-shipment-detail');
  const btnPrintGuide = document.getElementById('btn-print-dispatch-guide');
  const btnOpenQuickStatus = document.getElementById('btn-open-quick-status');

  if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => closeModal(modalDetail));
  if (btnCancelDetail) btnCancelDetail.addEventListener('click', () => closeModal(modalDetail));
  if (modalDetail) {
    modalDetail.addEventListener('click', (e) => {
      if (e.target === modalDetail) closeModal(modalDetail);
    });
  }

  if (btnPrintGuide) {
    btnPrintGuide.addEventListener('click', () => {
      if (state.activeShipment) printDispatchSlip(state.activeShipment);
    });
  }

  if (btnOpenQuickStatus) {
    btnOpenQuickStatus.addEventListener('click', () => {
      if (state.activeShipment) {
        closeModal(modalDetail);
        openUpdateStatusModal(state.activeShipment.id);
      }
    });
  }

  // Modal 2: Registrar Nuevo Envío
  const btnOpenNew = document.getElementById('btn-open-new-shipment-modal');
  const modalNew = document.getElementById('modal-new-shipment');
  const btnCloseNew = document.getElementById('btn-close-new-modal');
  const btnCancelNew = document.getElementById('btn-cancel-new-shipment');
  const formNew = document.getElementById('form-create-shipment');

  if (btnOpenNew) {
    btnOpenNew.addEventListener('click', async () => {
      await loadAvailableOrdersForSelect();
      openModal(modalNew);
    });
  }

  if (btnCloseNew) btnCloseNew.addEventListener('click', () => closeModal(modalNew));
  if (btnCancelNew) btnCancelNew.addEventListener('click', () => closeModal(modalNew));
  if (modalNew) {
    modalNew.addEventListener('click', (e) => {
      if (e.target === modalNew) closeModal(modalNew);
    });
  }

  if (formNew) {
    formNew.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = parseInt(document.getElementById('new-ship-order-id').value, 10);
      if (!orderId) {
        showToast('error', 'Pedido requerido', 'Por favor busca y selecciona un pedido listo para despacho.');
        return;
      }
      const distId = parseInt(document.getElementById('new-ship-distributor-select').value, 10);
      const estDate = document.getElementById('new-ship-est-date').value;
      const priceVal = parseFloat(document.getElementById('new-ship-price').value) || 15.00;
      const statusVal = document.getElementById('new-ship-status-initial').value;
      const notesVal = document.getElementById('new-ship-notes').value;

      const orderObj = state.availableOrders.find(o => o.id === orderId) || {};
      const distObj = state.distributors.find(d => d.id === distId) || {};

      try {
        const created = await createShipment({
          order: orderId,
          order_number: orderObj.order_code || `#00${orderId}`,
          client_name: orderObj.client_name || 'Cliente TuEstante',
          client_phone: orderObj.client_phone,
          client_email: orderObj.client_email,
          distributor: distId,
          distributor_name: distObj.name,
          state: orderObj.state || 'Distrito Capital',
          municipality: orderObj.municipality || 'Libertador',
          city: orderObj.city || 'Caracas',
          address: orderObj.address || 'Dirección registrada en pedido',
          price: priceVal,
          status: statusVal,
          estimated_date: estDate,
          notes: notesVal,
          order_items: orderObj.items || []
        });

        closeModal(modalNew);
        if (typeof window.resetOrderAutocomplete === 'function') {
          window.resetOrderAutocomplete();
        }
        formNew.reset();
        showToast('success', 'Envío Registrado', `Se registró el envío ${created.shipment_code} con éxito.`);
        await Promise.all([loadShipmentMetrics(), loadShipmentsData()]);
      } catch (err) {
        showToast('error', 'Error al registrar', err.message);
      }
    });
  }

  // Modal 3: Transportadores (crear / editar)
  const btnOpenDist     = document.getElementById('btn-open-distributors-modal');
  const btnOpenDistTab  = document.getElementById('btn-open-dist-from-tab');    // botón en pestaña directorio
  const modalDist       = document.getElementById('modal-distributors');
  const btnCloseDist    = document.getElementById('btn-close-dist-modal');
  const btnCloseDistFooter = document.getElementById('btn-close-dist-footer');
  const formNewDist     = document.getElementById('form-new-distributor');

  function openDistModal() {
    window.location.href = 'distributor-create.html';
    return;
    // Resetear a modo creación
    if (formNewDist) {
      formNewDist.reset();
      delete formNewDist.dataset.editId;
    }
    const titleEl = document.getElementById('modal-dist-title');
    if (titleEl) titleEl.textContent = 'Registrar Nuevo Transportador';
    openModal(modalDist);
  }

  if (btnOpenDist)    btnOpenDist.addEventListener('click', openDistModal);
  if (btnOpenDistTab) btnOpenDistTab.addEventListener('click', openDistModal);

  if (btnCloseDist)      btnCloseDist.addEventListener('click', () => closeModal(modalDist));
  if (btnCloseDistFooter) btnCloseDistFooter.addEventListener('click', () => closeModal(modalDist));
  if (modalDist) {
    modalDist.addEventListener('click', (e) => {
      if (e.target === modalDist) closeModal(modalDist);
    });
  }

  if (formNewDist) {
    formNewDist.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = formNewDist.dataset.editId;
      const name   = document.getElementById('new-dist-name').value.trim();
      const rif    = document.getElementById('new-dist-rif').value.trim();
      const phone  = document.getElementById('new-dist-phone').value.trim();
      const email  = document.getElementById('new-dist-email').value.trim();
      const coverageType = document.getElementById('new-dist-coverage-type')?.value || 'regional';

      try {
        if (editId) {
          // Actualizar en mock/backend
          const dist = state.distributors.find(d => String(d.id) === String(editId));
          if (dist) {
            dist.name = name;
            dist.rif = rif;
            dist.phone = phone;
            dist.email = email;
            dist.coverage_type = coverageType;
          }
          showToast('success', 'Transportador Actualizado', `${name} actualizado correctamente.`);
        } else {
          await createDistributor({ name, rif, phone, email, coverage_type: coverageType });
          showToast('success', 'Transportador Registrado', `${name} ha sido registrado exitosamente.`);
        }
        formNewDist.reset();
        delete formNewDist.dataset.editId;
        closeModal(modalDist);
        await loadDistributorsData();
      } catch (err) {
        showToast('error', 'Error al guardar transportador', err.message);
      }
    });
  }

  // Modal 4: Actualizar Estado Rápido
  const modalUpdate = document.getElementById('modal-update-shipment-status');
  const btnCloseUpdate = document.getElementById('btn-close-update-status-modal');
  const btnCancelUpdate = document.getElementById('btn-cancel-update-status');
  const formUpdate = document.getElementById('form-update-shipment-status');

  if (btnCloseUpdate) btnCloseUpdate.addEventListener('click', () => closeModal(modalUpdate));
  if (btnCancelUpdate) btnCancelUpdate.addEventListener('click', () => closeModal(modalUpdate));
  if (modalUpdate) {
    modalUpdate.addEventListener('click', (e) => {
      if (e.target === modalUpdate) closeModal(modalUpdate);
    });
  }

  if (formUpdate) {
    formUpdate.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = parseInt(document.getElementById('update-shipment-id').value, 10);
      const newStatus = document.getElementById('update-ship-status-select').value;
      const notes = document.getElementById('update-ship-notes').value;

      try {
        const updated = await updateShipmentStatus(id, { status: newStatus, notes });
        closeModal(modalUpdate);
        showToast('success', 'Estado Actualizado', `El envío ${updated.shipment_code} ahora está: "${updated.status_display}".`);
        await Promise.all([loadShipmentMetrics(), loadShipmentsData()]);
      } catch (err) {
        showToast('error', 'Error al actualizar', err.message);
      }
    });
  }
}

function openModal(modalEl) {
  if (modalEl) modalEl.classList.add('is-open');
}

function closeModal(modalEl) {
  if (modalEl) modalEl.classList.remove('is-open');
}

// ==========================================================================
// MODAL DE DETALLE Y SEGUIMIENTO
// ==========================================================================

async function openShipmentDetailModal(id) {
  try {
    const shipment = await getShipment(id);
    state.activeShipment = shipment;

    const modal = document.getElementById('modal-shipment-detail');
    const titleEl = document.getElementById('modal-ship-title');
    const orderLink = document.getElementById('modal-detail-order-link');
    const clientEl = document.getElementById('modal-detail-client');
    const phoneEl = document.getElementById('modal-detail-phone');
    const carrierEl = document.getElementById('modal-detail-carrier');
    const locationEl = document.getElementById('modal-detail-location');
    const estDateEl = document.getElementById('modal-detail-est-date');
    const addressEl = document.getElementById('modal-detail-address');
    const productsTbody = document.getElementById('modal-detail-products-tbody');

    if (titleEl) titleEl.textContent = `Seguimiento de Envío ${shipment.shipment_code}`;
    if (orderLink) {
      orderLink.textContent = shipment.order_number;
      orderLink.href = `../order/order-detail.html?id=${shipment.order_id}`;
    }
    if (clientEl) clientEl.textContent = shipment.client_name;
    if (phoneEl) phoneEl.textContent = shipment.client_phone || '+58 412 876 5432';

    if (carrierEl) {
      carrierEl.textContent = shipment.distributor?.name || 'Flete Propio';
      carrierEl.className = `carrier-badge ${getCarrierBadgeClass(shipment.distributor?.name)}`;
    }

    if (locationEl) locationEl.textContent = `${shipment.city}, ${shipment.state} (${shipment.municipality || 'Municipio'})`;
    if (estDateEl) estDateEl.textContent = formatDate(shipment.estimated_date);
    if (addressEl) addressEl.textContent = shipment.address;

    // Stepper
    updateTrackingStepper(shipment.status);

    // Productos
    if (productsTbody) {
      const items = shipment.order_items || [];
      productsTbody.innerHTML = items.map(p => `
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: var(--text-main);">${escapeHtml(p.product_name)}</td>
          <td style="padding: 8px 12px; color: var(--text-muted);">${escapeHtml(p.specs || 'Estándar')}</td>
          <td style="padding: 8px 12px; text-align: center; font-weight: 700;">${p.quantity || 1}</td>
        </tr>
      `).join('');
    }

    openModal(modal);
  } catch (err) {
    showToast('error', 'Error al abrir envío', err.message);
  }
}

function updateTrackingStepper(status) {
  const stepTransit = document.getElementById('step-transit');
  const stepDelivered = document.getElementById('step-delivered');

  if (!stepTransit || !stepDelivered) return;

  stepTransit.className = 'tracking-step';
  stepDelivered.className = 'tracking-step';

  if (status === 'pending') {
    stepTransit.classList.remove('is-done', 'is-active');
    stepDelivered.classList.remove('is-done', 'is-active');
  } else if (status === 'in_transit') {
    stepTransit.classList.add('is-active');
    stepDelivered.classList.remove('is-done', 'is-active');
  } else if (status === 'delivered') {
    stepTransit.classList.add('is-done');
    stepDelivered.classList.add('is-done');
  } else if (status === 'returned') {
    stepTransit.classList.add('is-done');
    stepDelivered.classList.add('is-active');
  }
}

function openUpdateStatusModal(id) {
  const shipment = state.shipments.find(s => s.id === id);
  if (!shipment) return;

  const modal = document.getElementById('modal-update-shipment-status');
  const titleEl = document.getElementById('modal-update-ship-title');
  const hiddenId = document.getElementById('update-shipment-id');
  const selectStatus = document.getElementById('update-ship-status-select');
  const notesInput = document.getElementById('update-ship-notes');

  if (titleEl) titleEl.textContent = `Actualizar Estado - ${shipment.shipment_code}`;
  if (hiddenId) hiddenId.value = shipment.id;
  if (selectStatus) selectStatus.value = shipment.status;
  if (notesInput) notesInput.value = shipment.notes || '';

  openModal(modal);
}

// ==========================================================================
// GESTIÓN DE TRANSPORTADORES - TABLA PRINCIPAL
// ==========================================================================

/**
 * Renderiza la tabla principal del directorio de transportadores.
 * @param {Array} dists - Lista de distribuidores/transportadores a mostrar
 */
function renderDistributorsMainTable(dists = []) {
  const tbody = document.getElementById('tbody-distributors-main');
  if (!tbody) return;

  if (!dists || dists.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <span style="font-weight: 600; font-size: 0.9rem;">No hay transportadores registrados</span>
            <span style="font-size: 0.8rem;">Haz clic en "Registrar Transportador" para agregar uno nuevo.</span>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = dists.map(d => {
    const enviosCount = d.shipments_count ?? d.total_shipments ?? '-';
    const isActive = d.is_active !== false;
    const statusBadge = isActive
      ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:700;color:#16a34a;background:#dcfce7;padding:3px 9px;border-radius:20px;"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span>Activo</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:700;color:#64748b;background:#f1f5f9;padding:3px 9px;border-radius:20px;"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span>Inactivo</span>`;

    const coverageType = d.coverage_type || 'regional';
    const coverageBadge = coverageType === 'national'
      ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:700;color:#0284c7;background:#e0f2fe;padding:3px 9px;border-radius:20px;">Nacional</span>`
      : coverageType === 'local'
      ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:700;color:#e11d48;background:#ffe4e6;padding:3px 9px;border-radius:20px;">Local</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:700;color:#0d9488;background:#ccfbf1;padding:3px 9px;border-radius:20px;">Regional</span>`;

    const coverageSummary = d.cobertura_resumen || (coverageType === 'national' ? 'Todo el territorio nacional' : 'Sin zonas configuradas');

    return `
    <tr data-dist-id="${escapeHtml(d.id)}">
      <td style="padding: 11px 14px;">
        <span class="carrier-badge ${getCarrierBadgeClass(d.name)}">${escapeHtml(d.name)}</span>
      </td>
      <td style="padding: 11px 14px;">${coverageBadge}</td>
      <td style="padding: 11px 14px; font-size: 0.82rem; color: var(--text-muted); max-width: 240px; white-space: normal; line-height: 1.35;">
        ${escapeHtml(coverageSummary)}
      </td>
      <td style="padding: 11px 14px; font-family: monospace; font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(d.rif || '-')}</td>
      <td style="padding: 11px 14px; font-size: 0.875rem;">${escapeHtml(d.phone || '-')}</td>
      <td style="padding: 11px 14px; font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(d.email || '-')}</td>
      <td style="padding: 11px 14px; text-align: center; font-size: 0.875rem; font-weight: 600;">${escapeHtml(String(enviosCount))}</td>
      <td style="padding: 11px 14px;">${statusBadge}</td>
      <td style="padding: 11px 14px; text-align: right;">
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
          <button type="button"
            style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;border:1.5px solid var(--border-color,#e2e8f0);background:transparent;color:var(--text-muted,#64748b);cursor:pointer;transition:all .15s;"
            onmouseenter="this.style.borderColor='#005187';this.style.color='#005187';this.style.background='#e0f2fe';"
            onmouseleave="this.style.borderColor='';this.style.color='';this.style.background='';"
            data-action="view-dist" data-id="${escapeHtml(d.id)}" title="Ver distribuidor" aria-label="Ver distribuidor">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button type="button"
            style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;border:1.5px solid var(--border-color,#e2e8f0);background:transparent;color:var(--text-muted,#64748b);cursor:pointer;transition:all .15s;"
            onmouseenter="this.style.borderColor='#005187';this.style.color='#005187';this.style.background='#e0f2fe';"
            onmouseleave="this.style.borderColor='';this.style.color='';this.style.background='';" 
            data-action="edit-dist" data-id="${escapeHtml(d.id)}" title="Editar transportador">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button type="button"
            style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;border:1.5px solid var(--border-color,#e2e8f0);background:transparent;color:var(--text-muted,#64748b);cursor:pointer;transition:all .15s;"
            onmouseenter="this.style.borderColor='#dc2626';this.style.color='#dc2626';this.style.background='#fee2e2';"
            onmouseleave="this.style.borderColor='';this.style.color='';this.style.background='';" 
            data-action="delete-dist" data-id="${escapeHtml(d.id)}" data-name="${escapeHtml(d.name)}" title="Eliminar transportador">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Eventos de acciones en la tabla
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'view-dist')   window.location.href = `distributor-detail.html?id=${encodeURIComponent(id)}`;
      if (action === 'edit-dist')   handleEditDistributor(id);
      if (action === 'delete-dist') handleDeleteDistributor(id, btn.dataset.name);
    });
  });
}

function updateDistributorsTableInfo(count) {
  const infoEl = document.getElementById('distributors-table-info');
  if (infoEl) infoEl.innerHTML = `Total: <strong>${count}</strong> transportador${count !== 1 ? 'es' : ''} registrado${count !== 1 ? 's' : ''}`;
}

function handleEditDistributor(id) {
  window.location.href = `distributor-detail.html?id=${encodeURIComponent(id)}`;
  return;
  const dist = state.distributors.find(d => String(d.id) === String(id));
  if (!dist) return;

  // Reusar el modal de nuevo transportador como edición
  const modal = document.getElementById('modal-distributors');
  const titleEl = document.getElementById('modal-dist-title');
  if (titleEl) titleEl.textContent = 'Editar Transportador';

  const form = document.getElementById('form-new-distributor');
  if (form) {
    form.dataset.editId = id;
    const nameEl = document.getElementById('new-dist-name');
    const rifEl  = document.getElementById('new-dist-rif');
    const phoneEl = document.getElementById('new-dist-phone');
    const emailEl = document.getElementById('new-dist-email');
    const covEl   = document.getElementById('new-dist-coverage-type');
    if (nameEl)  nameEl.value  = dist.name  || '';
    if (rifEl)   rifEl.value   = dist.rif   || '';
    if (phoneEl) phoneEl.value = dist.phone || '';
    if (emailEl) emailEl.value = dist.email || '';
    if (covEl)   covEl.value   = dist.coverage_type || 'regional';
  }

  openModal(modal);
}

async function handleDeleteDistributor(id, name) {
  const confirmed = window.confirm(`¿Eliminar el transportador "${name}"? Esta acción no se puede deshacer.`);
  if (!confirmed) return;

  try {
    // Intentar eliminar en backend
    const { deleteRequest } = await import('../../js/api.js').catch(() => ({ deleteRequest: null }));
    if (deleteRequest) await deleteRequest(`/distributors/${id}/`);

    // Eliminar localmente
    const idx = state.distributors.findIndex(d => String(d.id) === String(id));
    if (idx !== -1) state.distributors.splice(idx, 1);

    renderDistributorsMainTable(state.distributors);
    updateDistributorsTableInfo(state.distributors.length);
    populateDistributorSelects(state.distributors);
    showToast('success', 'Transportador Eliminado', `"${name}" fue eliminado correctamente.`);
  } catch (err) {
    showToast('error', 'Error al eliminar', err?.message || 'No se pudo eliminar el transportador.');
  }
}

function setupDistributorSearchFilter() {
  const searchInput = document.getElementById('search-distributor-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      renderDistributorsMainTable(state.distributors);
      updateDistributorsTableInfo(state.distributors.length);
      return;
    }
    const filtered = state.distributors.filter(d =>
      (d.name  || '').toLowerCase().includes(query) ||
      (d.rif   || '').toLowerCase().includes(query) ||
      (d.phone || '').toLowerCase().includes(query) ||
      (d.email || '').toLowerCase().includes(query)
    );
    renderDistributorsMainTable(filtered);
    updateDistributorsTableInfo(filtered.length);
  });
}

async function loadAvailableOrdersForSelect() {
  try {
    const orders = await getOrdersForShipmentSelect();
    state.availableOrders = orders;
  } catch (err) {
    console.error('Error al cargar pedidos listos para despacho:', err);
  }
}

/**
 * Configura el input select buscador y autocompletado de pedidos
 * Permite buscar por cliente, número de pedido y nombres de productos
 */
function setupOrderAutocomplete() {
  const inputSearch = document.getElementById('new-ship-order-search');
  const hiddenId = document.getElementById('new-ship-order-id');
  const btnClear = document.getElementById('btn-clear-order-search');
  const dropdown = document.getElementById('order-search-dropdown');
  const previewCard = document.getElementById('selected-order-card');

  if (!inputSearch || !dropdown) return;

  function renderDropdownItems(filtered) {
    if (!filtered || filtered.length === 0) {
      dropdown.innerHTML = `
        <div class="order-search-empty">
          No se encontraron pedidos que coincidan con la búsqueda.
        </div>
      `;
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = filtered.map(o => {
      const itemsList = (o.items || []).map(i => `${i.product_name} (x${i.quantity})`).join(', ') || `${o.items_count || 1} producto(s)`;
      return `
        <div class="order-search-item" data-order-id="${o.id}">
          <div class="order-search-item-header">
            <span class="order-search-code">${escapeHtml(o.order_code)}</span>
            <span class="order-search-client">${escapeHtml(o.client_name)}</span>
          </div>
          <div class="order-search-products" title="${escapeHtml(itemsList)}">
            📦 ${escapeHtml(itemsList)}
          </div>
          <div class="order-search-location">
            📍 ${escapeHtml(o.city || '')}, ${escapeHtml(o.state || '')}
          </div>
        </div>
      `;
    }).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.order-search-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(item.getAttribute('data-order-id'), 10);
        selectOrder(id);
      });
    });
  }

  function selectOrder(orderId) {
    const order = state.availableOrders.find(o => o.id === orderId);
    if (!order) return;

    hiddenId.value = order.id;
    inputSearch.value = `${order.order_code} — ${order.client_name}`;
    dropdown.style.display = 'none';
    if (btnClear) btnClear.style.display = 'flex';

    // Mostrar tarjeta resumen con dirección asociada
    if (previewCard) {
      const productsHtml = (order.items || []).map(i => `<strong>${escapeHtml(i.product_name)}</strong> (x${i.quantity})`).join(', ') || 'Productos del pedido';
      previewCard.innerHTML = `
        <div class="selected-order-title-row">
          <span style="font-weight: 700; color: var(--primary); font-size: 0.88rem;">Pedido ${escapeHtml(order.order_code)}</span>
          <span class="selected-order-badge">Listo para Despacho</span>
        </div>
        <div class="selected-order-meta">
          <div class="selected-order-meta-item">
            <strong>Cliente:</strong>
            <span>${escapeHtml(order.client_name)}</span>
          </div>
          <div class="selected-order-meta-item">
            <strong>Teléfono:</strong>
            <span>${escapeHtml(order.client_phone || 'No registrado')}</span>
          </div>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          <strong style="color: #64748b; font-size: 0.72rem; text-transform: uppercase;">Contenido:</strong> ${productsHtml}
        </div>
        <div class="selected-order-address-box">
          <strong>📍 Dirección de Entrega Asociada al Pedido:</strong>
          <span>${escapeHtml(order.address || 'Dirección no especificada')}, ${escapeHtml(order.city || '')} (${escapeHtml(order.municipality || '')}), ${escapeHtml(order.state || '')}</span>
        </div>
      `;
      previewCard.style.display = 'flex';
    }
  }

  window.resetOrderAutocomplete = function() {
    if (hiddenId) hiddenId.value = '';
    if (inputSearch) inputSearch.value = '';
    if (dropdown) dropdown.style.display = 'none';
    if (btnClear) btnClear.style.display = 'none';
    if (previewCard) {
      previewCard.innerHTML = '';
      previewCard.style.display = 'none';
    }
  };

  if (btnClear) {
    btnClear.addEventListener('click', (e) => {
      e.stopPropagation();
      resetOrderAutocomplete();
      inputSearch.focus();
    });
  }

  function filterOrders(term) {
    const t = term.toLowerCase().trim();
    if (!t) return state.availableOrders;

    return state.availableOrders.filter(o => {
      const matchClient = (o.client_name || '').toLowerCase().includes(t);
      const matchCode = (o.order_code || '').toLowerCase().replace('#', '').includes(t.replace('#', ''));
      const matchId = String(o.id).includes(t);
      const matchCity = (o.city || '').toLowerCase().includes(t);
      const matchProducts = (o.items || []).some(it => 
        (it.product_name || '').toLowerCase().includes(t) ||
        (it.specs || '').toLowerCase().includes(t)
      );
      return matchClient || matchCode || matchId || matchCity || matchProducts;
    });
  }

  inputSearch.addEventListener('input', () => {
    const term = inputSearch.value;
    if (!term) {
      if (hiddenId) hiddenId.value = '';
      if (previewCard) previewCard.style.display = 'none';
      if (btnClear) btnClear.style.display = 'none';
    }
    const filtered = filterOrders(term);
    renderDropdownItems(filtered);
  });

  inputSearch.addEventListener('focus', () => {
    if (!hiddenId.value) {
      const filtered = filterOrders(inputSearch.value);
      renderDropdownItems(filtered);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.order-autocomplete-group')) {
      if (dropdown) dropdown.style.display = 'none';
    }
  });
}

// ==========================================================================
// IMPRESIÓN DE GUÍA DE DESPACHO / REMISIÓN
// ==========================================================================

function printDispatchSlip(shipment) {
  const printWindow = window.open('', '_blank', 'width=850,height=700');
  if (!printWindow) {
    showToast('info', 'Permitir Ventanas Emergentes', 'Por favor permite ventanas emergentes para imprimir la guía de despacho.');
    return;
  }

  const itemsHtml = (shipment.order_items || []).map((it, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${escapeHtml(it.product_name)}</strong></td>
      <td>${escapeHtml(it.specs || 'Estándar')}</td>
      <td style="text-align: center; font-weight: bold;">${it.quantity || 1}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Guía de Despacho - ${shipment.shipment_code}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 28px; color: #0f172a; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #005187; padding-bottom: 12px; margin-bottom: 18px; }
        .logo { font-size: 20px; font-weight: 800; color: #005187; }
        .code { font-size: 22px; font-weight: 800; color: #005187; text-align: right; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 18px; font-size: 13px; }
        .grid-2 strong { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th { background: #005187; color: #fff; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        .signatures { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; }
        .sig-box { width: 220px; border-top: 1px solid #000; text-align: center; padding-top: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">TuEstante OMS</div>
          <div style="font-size: 12px; color: #64748b;">Guía Oficial de Despacho y Entrega</div>
        </div>
        <div>
          <div class="code">${escapeHtml(shipment.shipment_code)}</div>
          <div style="font-size: 12px; color: #64748b;">Pedido: <strong>${escapeHtml(shipment.order_number)}</strong></div>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <strong>Destinatario / Cliente:</strong>
          ${escapeHtml(shipment.client_name)} (${escapeHtml(shipment.client_phone || 'S/N')})
        </div>
        <div>
          <strong>Transportador Asignado:</strong>
          ${escapeHtml(shipment.distributor?.name || 'Flete Propio')}
        </div>
        <div>
          <strong>Dirección de Entrega:</strong>
          ${escapeHtml(shipment.address)}, ${escapeHtml(shipment.city)}, Edo. ${escapeHtml(shipment.state)}
        </div>
        <div>
          <strong>Fecha Estimada:</strong>
          ${formatDate(shipment.estimated_date)}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th>Producto</th>
            <th>Especificaciones</th>
            <th style="width: 60px; text-align: center;">Cant.</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      ${shipment.notes ? `<p style="font-size: 12px; background: #fffbeb; padding: 8px; border-radius: 4px; border: 1px solid #fde68a; margin-bottom: 20px;"><strong>Notas:</strong> ${escapeHtml(shipment.notes)}</p>` : ''}

      <div class="signatures">
        <div class="sig-box">Despachado por (Taller TuEstante)</div>
        <div class="sig-box">Transportador (${escapeHtml(shipment.distributor?.name || 'Flete')})</div>
        <div class="sig-box">Recibido Conforme (Cliente)</div>
      </div>

      <script>
        window.onload = function() { setTimeout(function() { window.print(); }, 300); };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ==========================================================================
// UTILIDADES Y TOAST
// ==========================================================================

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${dateFormatted} ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

function formatVES(val) {
  if (!val && val !== 0) return '0,00';
  return Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}
