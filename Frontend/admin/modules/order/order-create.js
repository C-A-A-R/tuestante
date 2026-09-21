import { loadAdminComponents } from '../../components/navbar/navbar.js';
/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DE CREACIÓN DE PEDIDO (ORDER-CREATE.JS)
 * ==========================================================================
 * Conforme a los modelos Django:
 * - Order (user, order_number, status, total_price, notes)
 * - OrderDetail (order, quantity, unit_price, final_price, notes)
 * - OrderProduct (order_detail, product, price_at_order)
 * - ManufacturingOrder (generada según el flujo)
 */

import { getOfficialRate } from '../../js/service/exchange-rate.service.js';
import { 
  getClientsList, 
  getProductsList, 
  createOrder,
  getDailyExchangeRate 
} from './order.api.js';
import { 
  getVenezuelaStates, 
  getMunicipalitiesByState, 
  getCitiesByMunicipality 
} from '../../js/data/venezuela-locations.data.js';

/**
 * ESTADO LOCAL DEL FORMULARIO DE CREACIÓN
 */
const createState = {
  clients: [],
  products: [],
  selectedClient: null,
  orderItems: [],
  exchangeRate: 791.32,
  itemCounter: 0,
  onConfirmCallback: null
};

/**
 * Formateador de moneda en Bolívares (Bs.)
 */
function formatBs(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return 'Bs. ' + num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formateador de moneda en Dólares ($)
 */
function formatUsd(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return '$' + num.toFixed(2);
}

/**
 * ==========================================================================
 * CLIENTE: BÚSQUEDA, AUTOCOMPLETE Y SELECCIÓN
 * ==========================================================================
 */

function setupClientSearch() {
  const searchInput = document.getElementById('client-search-input');
  const dropdown = document.getElementById('client-results-dropdown');
  const clearBtn = document.getElementById('btn-clear-client-search');
  const removeBtn = document.getElementById('btn-remove-selected-client');

  if (!searchInput || !dropdown) return;

  // Búsqueda en tiempo real
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    
    if (clearBtn) {
      clearBtn.style.display = query.length > 0 ? 'block' : 'none';
    }

    if (query.length === 0) {
      dropdown.classList.remove('is-active');
      dropdown.innerHTML = '';
      return;
    }

    const filtered = createState.clients.filter(c => 
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.username && c.username.toLowerCase().includes(query)) ||
      (c.identity_document && c.identity_document.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      (c.phone && c.phone.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 12px 16px; font-size: 0.825rem; color: var(--text-muted); text-align: center;">
          No se encontraron clientes con "<strong>${escapeHtml(query)}</strong>".
          <br>
          <button type="button" class="btn btn-outline btn-sm" id="btn-dropdown-quick-create" style="margin-top: 8px;">
            + Registrar "${escapeHtml(query)}"
          </button>
        </div>
      `;
      const quickBtn = document.getElementById('btn-dropdown-quick-create');
      if (quickBtn) {
        quickBtn.addEventListener('click', () => {
          dropdown.classList.remove('is-active');
          openQuickClientModal(searchInput.value.trim());
        });
      }
    } else {
      dropdown.innerHTML = filtered.map(c => `
        <div class="client-result-item" data-client-id="${c.id}" role="option">
          <div class="client-result-meta">
            <div class="client-result-avatar">${getInitials(c.name || c.username)}</div>
            <div class="client-result-text">
              <span class="client-result-name">
                ${escapeHtml(c.name)}
                ${c.identity_document ? `<span class="client-badge-doc" style="display: inline-block; font-size: 0.72rem; padding: 2px 7px; background: #e0f2fe; color: #0284c7; border-radius: 4px; font-weight: 700; margin-left: 6px;">${escapeHtml(c.identity_document)}</span>` : ''}
              </span>
              <span class="client-result-sub">
                ${c.email ? escapeHtml(c.email) : ''} ${c.phone ? `• ${escapeHtml(c.phone)}` : ''}
              </span>
            </div>
          </div>
          <span class="client-result-action">Seleccionar →</span>
        </div>
      `).join('');

      dropdown.querySelectorAll('.client-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const cid = parseInt(item.getAttribute('data-client-id'), 10);
          const found = createState.clients.find(c => c.id === cid);
          if (found) {
            selectClient(found);
            dropdown.classList.remove('is-active');
          }
        });
      });
    }

    dropdown.classList.add('is-active');
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      dropdown.classList.remove('is-active');
      searchInput.focus();
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      clearSelectedClient();
    });
  }

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.client-search-wrapper')) {
      dropdown.classList.remove('is-active');
    }
  });
}

/**
 * Selecciona un cliente y actualiza la tarjeta informativa
 */
function selectClient(client) {
  createState.selectedClient = client;

  const searchWrapper = document.querySelector('.client-search-wrapper');
  const card = document.getElementById('selected-client-card');
  const hiddenId = document.getElementById('selected-client-id');

  if (hiddenId) hiddenId.value = client.id;
  if (searchWrapper) searchWrapper.style.display = 'none';

  if (card) {
    const avatarEl = document.getElementById('client-card-avatar');
    const nameEl = document.getElementById('client-card-name');
    const userEl = document.getElementById('client-card-username');
    const docEl = document.getElementById('client-card-doc');
    const emailEl = document.getElementById('client-card-email');
    const phoneEl = document.getElementById('client-card-phone');

    if (avatarEl) avatarEl.textContent = getInitials(client.name);
    if (nameEl) nameEl.textContent = client.name;
    if (userEl) userEl.textContent = `@${client.username || 'user'}`;
    if (docEl) docEl.textContent = client.identity_document || 'Sin documento';
    if (emailEl) emailEl.textContent = client.email || 'No registrado';
    if (phoneEl) phoneEl.textContent = client.phone || 'No registrado';

    card.style.display = 'flex';
  }
}

/**
 * Remueve la selección del cliente y vuelve al buscador
 */
function clearSelectedClient() {
  createState.selectedClient = null;

  const searchWrapper = document.querySelector('.client-search-wrapper');
  const card = document.getElementById('selected-client-card');
  const hiddenId = document.getElementById('selected-client-id');
  const searchInput = document.getElementById('client-search-input');

  if (hiddenId) hiddenId.value = '';
  if (card) card.style.display = 'none';
  if (searchWrapper) searchWrapper.style.display = 'block';
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
}

/**
 * Obtiene iniciales para avatar
 */
function getInitials(name) {
  if (!name) return 'CL';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * ==========================================================================
 * DIRECCIÓN DE ENTREGA: SELECTS EN CASCADA (ESTADO -> MUNICIPIO -> CIUDAD)
 * ==========================================================================
 */
function setupVenezuelaLocations(defaultState = 'Táchira', defaultMuni = 'San Cristóbal', defaultCity = 'San Cristóbal') {
  const stateSelect = document.getElementById('shipping-state');
  const muniSelect = document.getElementById('shipping-municipality');
  const citySelect = document.getElementById('shipping-city');

  if (!stateSelect || !muniSelect || !citySelect) return;

  // 1. Llenar Estados
  const states = getVenezuelaStates();
  stateSelect.innerHTML = `
    <option value="" disabled>Seleccionar estado...</option>
    ${states.map(st => `<option value="${escapeHtml(st)}" ${st === defaultState ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
  `;

  // 2. Función para actualizar Municipios
  const updateMunicipalities = (selectedState, preferredMuni = null) => {
    const munis = getMunicipalitiesByState(selectedState);
    if (munis.length === 0) {
      muniSelect.innerHTML = `<option value="" disabled selected>No hay municipios disponibles</option>`;
      citySelect.innerHTML = `<option value="" disabled selected>No hay ciudades disponibles</option>`;
      return;
    }

    const currentMuni = preferredMuni && munis.includes(preferredMuni) ? preferredMuni : munis[0];
    muniSelect.innerHTML = munis.map(m => `
      <option value="${escapeHtml(m)}" ${m === currentMuni ? 'selected' : ''}>${escapeHtml(m)}</option>
    `).join('');

    updateCities(selectedState, currentMuni);
  };

  // 3. Función para actualizar Ciudades / Localidades
  const updateCities = (selectedState, selectedMuni, preferredCity = null) => {
    const cities = getCitiesByMunicipality(selectedState, selectedMuni);
    if (cities.length === 0) {
      citySelect.innerHTML = `<option value="${escapeHtml(selectedMuni)}" selected>${escapeHtml(selectedMuni)}</option>`;
      return;
    }

    const currentCity = preferredCity && cities.includes(preferredCity) ? preferredCity : cities[0];
    citySelect.innerHTML = cities.map(c => `
      <option value="${escapeHtml(c)}" ${c === currentCity ? 'selected' : ''}>${escapeHtml(c)}</option>
    `).join('');
  };

  // 4. Event Listeners
  stateSelect.addEventListener('change', () => {
    updateMunicipalities(stateSelect.value);
  });

  muniSelect.addEventListener('change', () => {
    updateCities(stateSelect.value, muniSelect.value);
  });

  // 5. Inicializar cascada con valores por defecto
  updateMunicipalities(defaultState, defaultMuni);
  if (defaultCity) {
    updateCities(defaultState, defaultMuni, defaultCity);
  }
}

/**
 * ==========================================================================
 * PRODUCTOS Y DETALLES DEL PEDIDO (ORDERDETAIL & ORDERPRODUCT)
 * ==========================================================================
 */

/**
 * Agrega una nueva fila de producto al pedido (Inicia en cero por defecto)
 * @param {Object} [initialData] Datos iniciales opcionales
 */
function addOrderItem(initialData = null) {
  createState.itemCounter++;

  const selectedProd = initialData?.product_id
    ? createState.products.find(p => p.id === parseInt(initialData.product_id, 10))
    : (initialData?.product || null);

  const newItem = {
    rowId: createState.itemCounter,
    product_id: selectedProd ? selectedProd.id : null,
    product_name: selectedProd ? (selectedProd.product_name || selectedProd.name) : '',
    sku: selectedProd ? (selectedProd.sku || 'EST-00') : '',
    category: selectedProd ? (selectedProd.category || 'Mobiliario') : '',
    image: selectedProd ? (selectedProd.image || '../../assets/images/logo.jpeg') : '../../assets/images/logo.jpeg',
    quantity: initialData?.quantity || 1,
    unit_price: selectedProd ? (initialData?.unit_price !== undefined ? initialData.unit_price : selectedProd.price) : 0,
    specs: initialData?.specs || ''
  };

  createState.orderItems.push(newItem);
  renderOrderItems();
  updateFinancialSummary();
}

/**
 * Remueve una fila de producto
 */
function removeOrderItem(rowId) {
  if (createState.orderItems.length <= 1) {
    showToastNotification('El pedido debe contener al menos un producto.');
    return;
  }
  createState.orderItems = createState.orderItems.filter(it => it.rowId !== rowId);
  renderOrderItems();
  updateFinancialSummary();
}

/**
 * Renderiza todas las filas de productos en el contenedor
 */
function renderOrderItems() {
  const container = document.getElementById('order-items-list-container');
  if (!container) return;

  container.innerHTML = createState.orderItems.map((item, index) => {
    const subtotal = item.product_id ? (item.quantity * item.unit_price) : 0;
    const selectTooltip = item.product_id ? `${item.product_name} (${formatUsd(item.unit_price)})` : 'Seleccione un producto del catálogo';

    return `
      <div class="order-item-row-card" data-row-id="${item.rowId}">
        <div class="item-row-main-grid">
          
          <!-- Selector de Producto (OrderProduct) -->
          <div class="item-product-col">
            <label class="form-label">Producto #${index + 1} <span class="required-mark">*</span></label>
            <div class="item-product-select-wrapper">
              <img 
                src="${escapeHtml(item.image)}" 
                alt="${escapeHtml(item.product_name || 'Producto')}" 
                class="item-product-thumb" 
                id="thumb-${item.rowId}" 
                title="${escapeHtml(item.product_name || 'Seleccionar producto')}"
                onerror="this.src='../../assets/images/logo.jpeg'">
              <select class="form-select product-select font-bold" data-row-id="${item.rowId}" title="${escapeHtml(selectTooltip)}">
                <option value="" disabled ${!item.product_id ? 'selected' : ''}>-- Seleccione un producto del catálogo --</option>
                ${createState.products.map(p => `
                  <option value="${p.id}" title="${escapeHtml(p.product_name || p.name)} - Precio: ${formatUsd(p.price)}" ${p.id === item.product_id ? 'selected' : ''}>
                    ${escapeHtml(p.product_name || p.name)} (${formatUsd(p.price)})
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Cantidad (OrderDetail.quantity) -->
          <div class="item-qty-col">
            <label class="form-label">Cantidad <span class="required-mark">*</span></label>
            <input 
              type="number" 
              class="form-input text-center font-bold item-qty-input" 
              data-row-id="${item.rowId}" 
              value="${item.quantity}" 
              min="1" 
              step="1" 
              required>
          </div>

          <!-- Precio Unitario (OrderDetail.unit_price / snapshot price_at_order) -->
          <div class="item-price-col">
            <label class="form-label">Precio Unit. ($) <span class="required-mark">*</span></label>
            <input 
              type="number" 
              class="form-input text-right item-price-input" 
              data-row-id="${item.rowId}" 
              value="${item.product_id ? item.unit_price.toFixed(2) : '0.00'}" 
              min="0" 
              step="0.01" 
              required>
          </div>

          <!-- Subtotal Línea (OrderDetail.final_price) -->
          <div class="item-subtotal-col">
            <label class="form-label">Subtotal ($)</label>
            <div class="item-subtotal-box" id="subtotal-${item.rowId}">
              ${formatUsd(subtotal)}
            </div>
          </div>

          <!-- Botón Eliminar Fila -->
          <div>
            <button 
              type="button" 
              class="btn-remove-item-row" 
              data-row-id="${item.rowId}" 
              title="Eliminar este producto" 
              aria-label="Eliminar producto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Especificaciones Personalizadas (OrderDetail.notes) -->
        <div class="item-specs-row">
          <label class="form-label">Especificaciones Personalizadas del Producto (OrderDetail.notes)</label>
          <textarea 
            class="item-specs-textarea item-specs-input" 
            data-row-id="${item.rowId}" 
            placeholder="Color, acabado, medidas especiales (Ej: Acabado madera natural barnizada, 180x90cm)...">${escapeHtml(item.specs || '')}</textarea>
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners para filas de productos
  container.querySelectorAll('.product-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const rowId = parseInt(sel.getAttribute('data-row-id'), 10);
      const prodId = parseInt(sel.value, 10);
      const prod = createState.products.find(p => p.id === prodId);
      const item = createState.orderItems.find(it => it.rowId === rowId);

      if (prod && item) {
        item.product_id = prod.id;
        item.product_name = prod.product_name || prod.name;
        item.sku = prod.sku || 'EST-00';
        item.category = prod.category || 'Mobiliario';
        item.image = prod.image || '../../assets/images/logo.jpeg';
        item.unit_price = prod.price || 0;
        // El campo specs no se sobreescribe automáticamente, queda a criterio del administrador

        renderOrderItems();
        updateFinancialSummary();
      }
    });
  });

  container.querySelectorAll('.item-qty-input').forEach(input => {
    input.addEventListener('input', () => {
      const rowId = parseInt(input.getAttribute('data-row-id'), 10);
      const val = parseInt(input.value, 10);
      const item = createState.orderItems.find(it => it.rowId === rowId);
      if (item) {
        item.quantity = isNaN(val) || val < 1 ? 1 : val;
        const subtotalBox = document.getElementById(`subtotal-${rowId}`);
        if (subtotalBox) subtotalBox.textContent = formatUsd(item.product_id ? (item.quantity * item.unit_price) : 0);
        updateFinancialSummary();
      }
    });
  });

  container.querySelectorAll('.item-price-input').forEach(input => {
    input.addEventListener('input', () => {
      const rowId = parseInt(input.getAttribute('data-row-id'), 10);
      const val = parseFloat(input.value);
      const item = createState.orderItems.find(it => it.rowId === rowId);
      if (item) {
        item.unit_price = isNaN(val) || val < 0 ? 0 : val;
        const subtotalBox = document.getElementById(`subtotal-${rowId}`);
        if (subtotalBox) subtotalBox.textContent = formatUsd(item.product_id ? (item.quantity * item.unit_price) : 0);
        updateFinancialSummary();
      }
    });
  });

  container.querySelectorAll('.item-specs-input').forEach(textarea => {
    textarea.addEventListener('input', () => {
      const rowId = parseInt(textarea.getAttribute('data-row-id'), 10);
      const item = createState.orderItems.find(it => it.rowId === rowId);
      if (item) {
        item.specs = textarea.value;
      }
    });
  });

  container.querySelectorAll('.btn-remove-item-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowId = parseInt(btn.getAttribute('data-row-id'), 10);
      removeOrderItem(rowId);
    });
  });
}

/**
 * ==========================================================================
 * RESUMEN FINANCIERO EN VIVO (USD & BS)
 * ==========================================================================
 */

function updateFinancialSummary() {
  const totalItemsCountEl = document.getElementById('summary-total-items-count');
  const subtotalUsdEl = document.getElementById('summary-subtotal-usd');
  const totalPriceUsdEl = document.getElementById('summary-total-price-usd');
  const totalPriceBsEl = document.getElementById('summary-total-price-bs');
  const initialUsdEl = document.getElementById('summary-initial-usd');
  const initialBsEl = document.getElementById('summary-initial-bs');
  const finalUsdEl = document.getElementById('summary-final-usd');
  const finalBsEl = document.getElementById('summary-final-bs');

  let totalQty = 0;
  let totalPriceUsd = 0;
  let validProductsCount = 0;

  createState.orderItems.forEach(it => {
    if (it.product_id) {
      validProductsCount++;
      totalQty += it.quantity;
      totalPriceUsd += (it.quantity * it.unit_price);
    }
  });

  const totalPriceBs = totalPriceUsd * createState.exchangeRate;
  const halfUsd = totalPriceUsd * 0.5;
  const halfBs = totalPriceBs * 0.5;

  if (totalItemsCountEl) {
    totalItemsCountEl.textContent = validProductsCount > 0 
      ? `${validProductsCount} producto(s) (${totalQty} unidades)`
      : '0 productos (0 unidades)';
  }
  if (subtotalUsdEl) subtotalUsdEl.textContent = formatUsd(totalPriceUsd);
  if (totalPriceUsdEl) totalPriceUsdEl.textContent = formatUsd(totalPriceUsd);
  if (totalPriceBsEl) totalPriceBsEl.textContent = formatBs(totalPriceBs);

  if (initialUsdEl) initialUsdEl.textContent = formatUsd(halfUsd);
  if (initialBsEl) initialBsEl.textContent = formatBs(halfBs);
  if (finalUsdEl) finalUsdEl.textContent = formatUsd(halfUsd);
  if (finalBsEl) finalBsEl.textContent = formatBs(halfBs);
}

/**
 * ==========================================================================
 * MODAL: REGISTRO RÁPIDO DE CLIENTE
 * ==========================================================================
 */

function openQuickClientModal(initialQuery = '') {
  const modal = document.getElementById('quick-client-modal-backdrop');
  const nameInput = document.getElementById('quick-client-name');
  const docInput = document.getElementById('quick-client-doc');

  if (nameInput && initialQuery) {
    if (/^[vjepg0-9\-\s]+$/i.test(initialQuery)) {
      if (docInput) docInput.value = initialQuery.toUpperCase();
    } else {
      nameInput.value = initialQuery;
    }
  }

  if (modal) modal.classList.add('is-open');
}

function closeQuickClientModal() {
  const modal = document.getElementById('quick-client-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  const form = document.getElementById('quick-client-form');
  if (form) form.reset();
}

function handleSaveQuickClient(e) {
  e.preventDefault();

  const name = document.getElementById('quick-client-name')?.value.trim() || '';
  const doc = document.getElementById('quick-client-doc')?.value.trim() || '';
  const email = document.getElementById('quick-client-email')?.value.trim() || '';
  const phone = document.getElementById('quick-client-phone')?.value.trim() || '';

  if (!name || !email) {
    alert('Por favor complete el nombre y correo del cliente.');
    return;
  }

  const newClient = {
    id: Date.now(),
    name,
    username: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    identity_document: doc || 'V-00000000',
    email,
    phone
  };

  createState.clients.unshift(newClient);
  selectClient(newClient);
  closeQuickClientModal();
  showToastNotification(`Cliente "${name}" registrado y asociado al pedido`);
}

/**
 * ==========================================================================
 * MODAL DE CONFIRMACIÓN REUTILIZABLE
 * ==========================================================================
 */

function showConfirmationModal({ title, message, onConfirm }) {
  const modal = document.getElementById('confirmation-modal-backdrop');
  const titleEl = document.getElementById('confirm-dialog-title');
  const descEl = document.getElementById('confirm-dialog-desc');

  if (!modal) return;

  if (titleEl) titleEl.textContent = title || '¿Confirmar acción?';
  if (descEl) descEl.textContent = message || 'Se procesará la solicitud.';

  createState.onConfirmCallback = onConfirm;
  modal.classList.add('is-open');
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmation-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  createState.onConfirmCallback = null;
}

/**
 * ==========================================================================
 * ENVÍO Y CREACIÓN DEL PEDIDO (Order, OrderDetail & Shipment Address)
 * ==========================================================================
 */

async function handleCreateOrderSubmit(e) {
  if (e) e.preventDefault();

  // 1. Validar Cliente (Order.user)
  if (!createState.selectedClient) {
    alert('⚠️ Por favor seleccione o registre un cliente para este pedido.');
    document.getElementById('client-search-input')?.focus();
    return;
  }

  // 2. Validar Dirección de Entrega (Shipment Address: state, municipality, city, address)
  const shippingState = document.getElementById('shipping-state')?.value.trim();
  const shippingMunicipality = document.getElementById('shipping-municipality')?.value.trim();
  const shippingCity = document.getElementById('shipping-city')?.value.trim();
  const shippingAddress = document.getElementById('shipping-address')?.value.trim();

  if (!shippingState) {
    alert('⚠️ Por favor seleccione el Estado de entrega.');
    document.getElementById('shipping-state')?.focus();
    return;
  }

  if (!shippingMunicipality) {
    alert('⚠️ Por favor indique el Municipio de entrega.');
    document.getElementById('shipping-municipality')?.focus();
    return;
  }

  if (!shippingCity) {
    alert('⚠️ Por favor indique la Ciudad o Localidad de entrega.');
    document.getElementById('shipping-city')?.focus();
    return;
  }

  if (!shippingAddress) {
    alert('⚠️ Por favor ingrese la Dirección exacta o punto de referencia para el envío.');
    document.getElementById('shipping-address')?.focus();
    return;
  }

  // 3. Validar Productos (OrderDetail & OrderProduct)
  const validItems = createState.orderItems.filter(it => it.product_id !== null && it.product_id !== '');
  if (validItems.length === 0) {
    alert('⚠️ Por favor seleccione al menos un producto para registrar el pedido.');
    return;
  }

  if (createState.orderItems.some(it => !it.product_id)) {
    alert('⚠️ Hay filas de productos sin seleccionar. Por favor seleccione el producto correspondiente o elimine la fila vacía.');
    return;
  }

  const invalidItem = createState.orderItems.find(it => it.quantity < 1 || it.unit_price < 0);
  if (invalidItem) {
    alert('⚠️ Todos los productos deben tener cantidad mayor a 0 y precio válido.');
    return;
  }

  // 4. Construir Payload conforme a los modelos Django
  const clientNotes = document.getElementById('order-client-notes')?.value.trim() || '';
  const internalNotes = document.getElementById('order-internal-notes')?.value.trim() || '';
  const initialStatus = document.getElementById('order-initial-status')?.value || 'pending_initial_payment';

  let totalPriceUsd = 0;
  const detailsPayload = createState.orderItems.map(it => {
    const finalPrice = it.quantity * it.unit_price;
    totalPriceUsd += finalPrice;
    return {
      product: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      final_price: finalPrice,
      notes: it.specs || ''
    };
  });

  const orderPayload = {
    user: createState.selectedClient.id,
    client: createState.selectedClient,
    status: initialStatus,
    total_price: totalPriceUsd,
    total_amount: totalPriceUsd,
    notes: clientNotes,
    internal_notes: internalNotes,
    bcv_rate: createState.exchangeRate,
    items: detailsPayload,
    details: detailsPayload,
    shipping_address: {
      state: shippingState,
      municipality: shippingMunicipality,
      city: shippingCity,
      address: shippingAddress,
      line1: shippingAddress,
      city_state: `${shippingCity}, ${shippingMunicipality}, Edo. ${shippingState}`,
      country: "Venezuela"
    }
  };

  // 5. Confirmación Modal
  const totalPriceBs = totalPriceUsd * createState.exchangeRate;
  showConfirmationModal({
    title: '¿Confirmar y Registrar Pedido?',
    message: `Se creará el pedido para "${createState.selectedClient.name}" con entrega en ${shippingCity}, Edo. ${shippingState} por un total de ${formatUsd(totalPriceUsd)} (${formatBs(totalPriceBs)}).`,
    onConfirm: async () => {
      try {
        const createdOrder = await createOrder(orderPayload);
        showToastNotification(`¡Pedido ${createdOrder.order_number || '#00' + createdOrder.id} creado con éxito!`);
        
        setTimeout(() => {
          window.location.href = `order-detail.html?id=${createdOrder.id}`;
        }, 1200);
      } catch (err) {
        console.error('Error al crear pedido:', err);
        alert('Ocurrió un error al registrar el pedido. Intente nuevamente.');
      }
    }
  });
}

/**
 * Toast Notification
 */
function showToastNotification(message) {
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #005187;
    color: #fcffff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(0, 81, 135, 0.35);
    z-index: 9999;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  toast.innerHTML = `
    <svg style="width: 18px; height: 18px; color: #84b6f4;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${escapeHtml(message)}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
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

/**
 * ==========================================================================
 * INICIALIZACIÓN
 * ==========================================================================
 */
async function initOrderCreatePage() {
  try {
    // 1. Inicializar componentes compartidos (Navbar, Drawer y Footer)
    await loadAdminComponents({ title: 'Crear Pedido' });

    // 2. Obtener Tasa de Cambio BCV del día
    try {
      const daily = await getDailyExchangeRate();
      if (daily && daily.rate) {
        createState.exchangeRate = Number(daily.rate);
      } else {
        createState.exchangeRate = await getOfficialRate();
      }
    } catch (err) {
      console.warn('Usando tasa de contingencia:', err);
      createState.exchangeRate = await getOfficialRate().catch(() => 849.56);
    }

    const rateBadge = document.getElementById('live-exchange-rate-badge');
    if (rateBadge) {
      rateBadge.textContent = `BCV: ${createState.exchangeRate.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs/$`;
    }

    // 3. Cargar Clientes y Catálogo de Productos
    createState.clients = await getClientsList();
    createState.products = await getProductsList();

    // 4. Configurar Buscador de Clientes
    setupClientSearch();

    // 5. Configurar Selects en Cascada de Ubicación (Estado -> Municipio -> Ciudad)
    setupVenezuelaLocations('Táchira', 'San Cristóbal', 'San Cristóbal');

    // 6. Inicializar con 1 Fila de Producto por Defecto
    addOrderItem();

    // 7. Configurar Botones y Modales
    const btnAddProduct = document.getElementById('btn-add-product-item');
    if (btnAddProduct) {
      btnAddProduct.addEventListener('click', () => addOrderItem());
    }

    const btnQuickClient = document.getElementById('btn-quick-create-client');
    if (btnQuickClient) {
      btnQuickClient.addEventListener('click', () => openQuickClientModal());
    }

    const btnCloseQuick = document.getElementById('btn-close-quick-client-modal');
    const btnCancelQuick = document.getElementById('btn-cancel-quick-client');
    if (btnCloseQuick) btnCloseQuick.addEventListener('click', closeQuickClientModal);
    if (btnCancelQuick) btnCancelQuick.addEventListener('click', closeQuickClientModal);

    const quickForm = document.getElementById('quick-client-form');
    if (quickForm) quickForm.addEventListener('submit', handleSaveQuickClient);

    // Envíos del Formulario
    const createForm = document.getElementById('create-order-form');
    if (createForm) createForm.addEventListener('submit', handleCreateOrderSubmit);

    const btnSubmitTop = document.getElementById('btn-submit-order-top');
    if (btnSubmitTop) btnSubmitTop.addEventListener('click', handleCreateOrderSubmit);

    // Confirmación Modal
    const btnConfirmAccept = document.getElementById('btn-confirm-accept');
    const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
    if (btnConfirmAccept) {
      btnConfirmAccept.addEventListener('click', () => {
        if (createState.onConfirmCallback) createState.onConfirmCallback();
        closeConfirmationModal();
      });
    }
    if (btnConfirmCancel) {
      btnConfirmCancel.addEventListener('click', closeConfirmationModal);
    }

    // Cierre con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeQuickClientModal();
        closeConfirmationModal();
      }
    });

    console.log('[TuEstante Admin] Módulo de Crear Pedido inicializado correctamente.');
  } catch (error) {
    console.error('[TuEstante Admin] Error al inicializar creación de pedido:', error);
  }
}

// Ejecución al cargar DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrderCreatePage);
} else {
  initOrderCreatePage();
}
