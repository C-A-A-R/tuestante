/**
 * ==========================================================================
 * CONTROLADOR: CREACIÓN Y DESPACHO DE ENVÍOS - TUESTANTE ADMIN
 * Maneja la selección de pedidos, autocompletado de estados/municipios venezolanos,
 * consulta dinámica de transportistas según cobertura geográfica, cálculo de fechas y creación de envíos.
 * ==========================================================================
 */

import { initDrawer } from '../../components/drawer/drawer.js';
import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { showSuccessToast, showErrorToast, showInfoToast } from '../../components/toast/toast.js';
import { 
  getOrdersForShipmentSelect, 
  getAvailableDistributors, 
  createShipment,
  VENEZUELA_GEO_DATA 
} from './shipping.api.js';

// Estado local de la vista
let ordersList = [];
let selectedOrder = null;
let availableDistributors = [];
let selectedDistributor = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar componentes visuales estructurales
  await Promise.all([
    initDrawer('shipping'),
    initNavbar(),
    initFooter()
  ]);

  // 2. Inicializar selects y catálogos
  initGeoSelects();

  // 3. Cargar listado de órdenes pendientes
  await loadPendingOrders();

  // 4. Vincular listeners de eventos
  setupEventListeners();
});

/**
 * Llena el select de Estados a partir del catálogo geográfico
 */
function initGeoSelects() {
  const stateSelect = document.getElementById('shipping-state');
  if (!stateSelect) return;

  stateSelect.innerHTML = '<option value="">-- Seleccionar Estado --</option>';
  const states = Object.keys(VENEZUELA_GEO_DATA).sort();
  states.forEach(state => {
    const opt = document.createElement('option');
    opt.value = state;
    opt.textContent = state;
    stateSelect.appendChild(opt);
  });
}

/**
 * Actualiza el select de Municipios según el estado seleccionado
 */
function updateMunicipalitySelect(stateName, preselectedMuni = '') {
  const muniSelect = document.getElementById('shipping-municipality');
  if (!muniSelect) return;

  muniSelect.innerHTML = '<option value="">-- Seleccionar Municipio --</option>';
  if (!stateName || !VENEZUELA_GEO_DATA[stateName]) {
    muniSelect.disabled = true;
    return;
  }

  muniSelect.disabled = false;
  const munis = VENEZUELA_GEO_DATA[stateName];
  munis.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    if (preselectedMuni && preselectedMuni.toLowerCase() === m.toLowerCase()) {
      opt.selected = true;
    }
    muniSelect.appendChild(opt);
  });
}

/**
 * Consulta las órdenes pendientes y llena el selector
 */
async function loadPendingOrders() {
  const selectOrder = document.getElementById('select-order');
  if (!selectOrder) return;

  try {
    ordersList = await getOrdersForShipmentSelect();
    selectOrder.innerHTML = '<option value="">-- Seleccione un pedido --</option>';
    
    ordersList.forEach(order => {
      const opt = document.createElement('option');
      opt.value = order.id;
      opt.textContent = `${order.order_code} — ${order.client_name} (${order.items_count} prod. | $${Number(order.total_amount).toFixed(2)})`;
      selectOrder.appendChild(opt);
    });

    // Si viene un order_id por URL (ej. ?order_id=125), preseleccionarlo
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdParam = urlParams.get('order_id') || urlParams.get('order');
    if (orderIdParam) {
      selectOrder.value = orderIdParam;
      handleOrderSelection(orderIdParam);
    }
  } catch (err) {
    console.error('Error al cargar órdenes:', err);
    showErrorToast('No se pudieron cargar los pedidos pendientes.');
  }
}

/**
 * Configura los escuchadores de eventos interactivos
 */
function setupEventListeners() {
  const selectOrder = document.getElementById('select-order');
  const stateSelect = document.getElementById('shipping-state');
  const muniSelect = document.getElementById('shipping-municipality');
  const cityInput = document.getElementById('shipping-city');
  const priceInput = document.getElementById('shipping-price');
  const btnSubmitTop = document.getElementById('btn-submit-shipment-top');
  const btnSubmitBottom = document.getElementById('btn-submit-shipment-bottom');

  // Selección de pedido
  if (selectOrder) {
    selectOrder.addEventListener('change', (e) => {
      handleOrderSelection(e.target.value);
    });
  }

  // Cambio de Estado
  if (stateSelect) {
    stateSelect.addEventListener('change', (e) => {
      const state = e.target.value;
      updateMunicipalitySelect(state);
      updateDestinationSummary();
      queryCoverageDistributors();
    });
  }

  // Cambio de Municipio
  if (muniSelect) {
    muniSelect.addEventListener('change', () => {
      updateDestinationSummary();
      queryCoverageDistributors();
    });
  }

  // Cambio de Ciudad
  if (cityInput) {
    cityInput.addEventListener('input', updateDestinationSummary);
  }

  // Cambio manual de precio
  if (priceInput) {
    priceInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      const summaryCost = document.getElementById('summary-shipping-cost');
      if (summaryCost) summaryCost.textContent = `$${val.toFixed(2)}`;
    });
  }

  // Botones de Guardar
  if (btnSubmitTop) btnSubmitTop.addEventListener('click', handleSubmitShipment);
  if (btnSubmitBottom) btnSubmitBottom.addEventListener('click', handleSubmitShipment);
}

/**
 * Maneja la selección de un pedido para autocompletar datos del cliente y dirección
 */
function handleOrderSelection(orderId) {
  selectedOrder = ordersList.find(o => String(o.id) === String(orderId)) || null;
  const previewBox = document.getElementById('order-preview-box');
  const summaryOrderCode = document.getElementById('summary-order-code');
  const summaryClientName = document.getElementById('summary-client-name');

  if (!selectedOrder) {
    if (previewBox) previewBox.style.display = 'none';
    if (summaryOrderCode) summaryOrderCode.textContent = 'No seleccionado';
    if (summaryClientName) summaryClientName.textContent = '-';
    return;
  }

  // Actualizar vista previa
  if (previewBox) previewBox.style.display = 'block';
  document.getElementById('order-preview-code').textContent = selectedOrder.order_code;
  document.getElementById('order-preview-client-name').textContent = selectedOrder.client_name;
  document.getElementById('order-preview-client-phone').textContent = selectedOrder.client_phone || 'No registrado';
  document.getElementById('order-preview-client-email').textContent = selectedOrder.client_email || 'No registrado';

  // Renderizar productos
  const itemsContainer = document.getElementById('order-preview-items-list');
  if (itemsContainer && selectedOrder.items) {
    itemsContainer.innerHTML = selectedOrder.items.map(it => `
      <div class="order-preview-item">
        <span><strong>${it.quantity}x</strong> ${it.product_name}</span>
        <span style="color: #64748b; font-size: 0.8rem;">${it.specs || ''}</span>
      </div>
    `).join('');
  }

  // Actualizar Resumen lateral
  if (summaryOrderCode) summaryOrderCode.textContent = selectedOrder.order_code;
  if (summaryClientName) summaryClientName.textContent = selectedOrder.client_name;

  // Autocompletar dirección si viene en la orden
  if (selectedOrder.state) {
    const stateSelect = document.getElementById('shipping-state');
    if (stateSelect) {
      stateSelect.value = selectedOrder.state;
      updateMunicipalitySelect(selectedOrder.state, selectedOrder.municipality);
    }
  }

  if (selectedOrder.city) {
    const cityInput = document.getElementById('shipping-city');
    if (cityInput) cityInput.value = selectedOrder.city;
  }

  if (selectedOrder.address) {
    const addressInput = document.getElementById('shipping-address');
    if (addressInput) addressInput.value = selectedOrder.address;
  }

  updateDestinationSummary();
  queryCoverageDistributors();
}

/**
 * Actualiza el destino en el resumen lateral
 */
function updateDestinationSummary() {
  const state = document.getElementById('shipping-state')?.value || '';
  const muni = document.getElementById('shipping-municipality')?.value || '';
  const city = document.getElementById('shipping-city')?.value || '';
  const summaryDest = document.getElementById('summary-destination');

  if (!summaryDest) return;

  const parts = [city, muni, state].filter(Boolean);
  summaryDest.textContent = parts.length > 0 ? parts.join(', ') : 'No especificado';
}

/**
 * Consulta y renderiza los distribuidores que cubren la ubicación elegida
 */
async function queryCoverageDistributors() {
  const state = document.getElementById('shipping-state')?.value || '';
  const municipality = document.getElementById('shipping-municipality')?.value || '';
  const statusElem = document.getElementById('coverage-filter-status');
  const gridElem = document.getElementById('distributors-selection-grid');

  if (!state) {
    if (statusElem) statusElem.innerHTML = '<span>Seleccione un estado y municipio para filtrar los transportistas con cobertura.</span>';
    if (gridElem) gridElem.innerHTML = '';
    selectDistributor(null);
    return;
  }

  if (statusElem) {
    statusElem.innerHTML = `<span>Buscando transportistas habilitados para <strong>${municipality ? municipality + ', ' : ''}${state}</strong>...</span>`;
  }

  try {
    availableDistributors = await getAvailableDistributors({ state, municipality });

    if (!availableDistributors || availableDistributors.length === 0) {
      if (statusElem) {
        statusElem.innerHTML = `<span style="color: #dc2626;">⚠️ No se encontraron transportistas con cobertura para ${state}.</span>`;
      }
      if (gridElem) {
        gridElem.innerHTML = `
          <div class="empty-state-coverage" style="grid-column: 1 / -1;">
            No disponemos de empresas de transporte asignadas para esta zona geográfica.
          </div>
        `;
      }
      selectDistributor(null);
      return;
    }

    if (statusElem) {
      statusElem.innerHTML = `<span>Se encontraron <strong>${availableDistributors.length}</strong> transportista(s) habilitado(s) para esta zona.</span>`;
    }

    renderDistributorCards(availableDistributors);

    // Si había un distribuidor seleccionado que sigue disponible, mantenerlo; sino, seleccionar el primero
    const currentId = document.getElementById('selected-distributor-id')?.value;
    const stillAvailable = availableDistributors.find(d => String(d.id) === String(currentId));
    if (stillAvailable) {
      selectDistributor(stillAvailable);
    } else {
      selectDistributor(availableDistributors[0]);
    }
  } catch (err) {
    console.error('Error al consultar transportistas disponibles:', err);
    if (statusElem) statusElem.innerHTML = '<span style="color: #dc2626;">Error al consultar cobertura de distribuidores.</span>';
  }
}

/**
 * Renderiza las tarjetas de opción de distribuidor
 */
function renderDistributorCards(distributors) {
  const gridElem = document.getElementById('distributors-selection-grid');
  if (!gridElem) return;

  gridElem.innerHTML = distributors.map(dist => {
    const isNational = dist.coverage_type === 'national';
    const badgeClass = isNational ? 'national' : 'regional';
    const cost = Number(dist.base_shipping_cost || 0).toFixed(2);
    const minDays = dist.estimated_days_min || 1;
    const maxDays = dist.estimated_days_max || 3;

    return `
      <div class="distributor-card-choice" data-distributor-id="${dist.id}" id="dist-card-${dist.id}">
        <div class="distributor-card-header">
          <div>
            <h4 class="distributor-card-name">${dist.name}</h4>
            <div class="distributor-card-rif">${dist.rif || ''}</div>
          </div>
          <span class="badge-coverage ${badgeClass}">${dist.coverage_type_display || 'Cobertura'}</span>
        </div>

        <div style="font-size: 0.8rem; color: #64748b;">
          📍 ${dist.matched_coverage || 'Zona asignada'}
        </div>

        <div class="distributor-card-details">
          <span>⏱️ ${minDays} a ${maxDays} días hábiles</span>
          <span class="distributor-card-price">$${cost}</span>
        </div>
      </div>
    `;
  }).join('');

  // Eventos de click en cada tarjeta
  distributors.forEach(dist => {
    const card = document.getElementById(`dist-card-${dist.id}`);
    if (card) {
      card.addEventListener('click', () => selectDistributor(dist));
    }
  });
}

/**
 * Marca un distribuidor como seleccionado y actualiza precios y fechas
 */
function selectDistributor(dist) {
  selectedDistributor = dist;
  const hiddenInput = document.getElementById('selected-distributor-id');
  if (hiddenInput) hiddenInput.value = dist ? dist.id : '';

  // Actualizar clases visuales
  document.querySelectorAll('.distributor-card-choice').forEach(card => {
    card.classList.remove('selected');
  });

  if (dist) {
    const card = document.getElementById(`dist-card-${dist.id}`);
    if (card) card.classList.add('selected');

    // Autocompletar costo de envío
    const priceInput = document.getElementById('shipping-price');
    const baseCost = Number(dist.base_shipping_cost || 0);
    if (priceInput && (!priceInput.value || parseFloat(priceInput.value) === 0)) {
      priceInput.value = baseCost.toFixed(2);
    }

    // Calcular fecha estimada
    const maxDays = dist.estimated_days_max || 3;
    const dateInput = document.getElementById('shipping-estimated-date');
    if (dateInput && !dateInput.value) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + maxDays);
      dateInput.value = targetDate.toISOString().split('T')[0];
    }

    // Actualizar sidebar
    document.getElementById('summary-distributor-name').textContent = dist.name;
    document.getElementById('summary-distributor-coverage').textContent = dist.matched_coverage || dist.coverage_type_display;
    document.getElementById('summary-estimated-days').textContent = `${dist.estimated_days_min || 1} a ${maxDays} días hábiles`;
    document.getElementById('summary-shipping-cost').textContent = `$${(priceInput ? parseFloat(priceInput.value) || baseCost : baseCost).toFixed(2)}`;
  } else {
    document.getElementById('summary-distributor-name').textContent = 'No asignado';
    document.getElementById('summary-distributor-coverage').textContent = '-';
    document.getElementById('summary-estimated-days').textContent = '-';
    document.getElementById('summary-shipping-cost').textContent = '$0.00';
  }
}

/**
 * Procesa la creación del envío
 */
async function handleSubmitShipment() {
  const orderId = document.getElementById('select-order')?.value;
  const state = document.getElementById('shipping-state')?.value;
  const municipality = document.getElementById('shipping-municipality')?.value;
  const city = document.getElementById('shipping-city')?.value || '';
  const address = document.getElementById('shipping-address')?.value?.trim();
  const distributorId = document.getElementById('selected-distributor-id')?.value;
  const price = parseFloat(document.getElementById('shipping-price')?.value) || 0;
  const estimatedDate = document.getElementById('shipping-estimated-date')?.value || null;
  const notes = document.getElementById('shipping-notes')?.value?.trim() || '';

  // Validaciones obligatorias
  if (!orderId) {
    showErrorToast('Debe seleccionar un pedido para despachar.');
    document.getElementById('select-order')?.focus();
    return;
  }

  if (!state) {
    showErrorToast('Debe seleccionar el estado de entrega.');
    document.getElementById('shipping-state')?.focus();
    return;
  }

  if (!municipality) {
    showErrorToast('Debe seleccionar el municipio de entrega.');
    document.getElementById('shipping-municipality')?.focus();
    return;
  }

  if (!address) {
    showErrorToast('Debe indicar la dirección exacta o punto de referencia.');
    document.getElementById('shipping-address')?.focus();
    return;
  }

  if (!distributorId) {
    showErrorToast('Debe seleccionar una empresa transportadora con cobertura.');
    return;
  }

  const payload = {
    order: parseInt(orderId, 10),
    distributor: parseInt(distributorId, 10),
    state: state,
    municipality: municipality,
    city: city,
    address: address,
    price: price,
    estimated_date: estimatedDate,
    notes: notes,
    status: 'pending'
  };

  const btnSubmit = document.getElementById('btn-submit-shipment-top');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Procesando...</span>';
  }

  try {
    const result = await createShipment(payload);
    showSuccessToast('¡Envío registrado y asignado con éxito!');

    setTimeout(() => {
      window.location.href = 'shipping.html';
    }, 1200);
  } catch (err) {
    console.error('Error al registrar envío:', err);
    showErrorToast('Ocurrió un error al guardar el envío. Verifique los datos.');
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>Crear y Despachar Envío</span>';
    }
  }
}
