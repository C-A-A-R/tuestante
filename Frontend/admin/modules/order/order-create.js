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
  createClient,
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
  onConfirmCallback: null,
  isFormSubmitted: false
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
 * SISTEMA DE NOTIFICACIONES TOAST PROFESIONAL
 * ==========================================================================
 */
function showToast(type, title, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'danger' || type === 'error') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else if (type === 'warning') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-desc">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="toast-close-btn" aria-label="Cerrar notificación">✕</button>
  `;

  container.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close-btn');
  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  };

  if (closeBtn) closeBtn.addEventListener('click', removeToast);
  setTimeout(removeToast, 4500);
}

function showToastNotification(message) {
  showToast('success', 'Información', message);
}

/**
 * ==========================================================================
 * VALIDACIONES EN TIEMPO REAL & BLOQUEO DE BOTÓN
 * ==========================================================================
 */
function setFieldError(errorElId, inputEl, message, isInvalid) {
  const errSpan = document.getElementById(errorElId);
  if (errSpan) {
    if (isInvalid && message) {
      errSpan.textContent = message;
      errSpan.style.display = 'block';
    } else {
      errSpan.textContent = '';
      errSpan.style.display = 'none';
    }
  }
  if (inputEl) {
    if (isInvalid) {
      inputEl.classList.add('is-invalid');
    } else {
      inputEl.classList.remove('is-invalid');
    }
  }
}

function validateOrderForm({ highlight = false } = {}) {
  let isValid = true;
  let firstInvalidEl = null;

  // 1. Cliente
  const searchInput = document.getElementById('client-search-input');
  if (!createState.selectedClient) {
    isValid = false;
    if (highlight) {
      setFieldError('error-order-client', searchInput, 'Debe seleccionar o registrar un cliente para este pedido.', true);
      if (!firstInvalidEl) firstInvalidEl = searchInput;
    }
  } else {
    setFieldError('error-order-client', searchInput, '', false);
  }

  // 2. Estado
  const stateSelect = document.getElementById('shipping-state');
  if (!stateSelect?.value?.trim()) {
    isValid = false;
    if (highlight) {
      setFieldError('error-shipping-state', stateSelect, 'Seleccione el estado de entrega.', true);
      if (!firstInvalidEl) firstInvalidEl = stateSelect;
    }
  } else {
    setFieldError('error-shipping-state', stateSelect, '', false);
  }

  // 3. Municipio
  const muniSelect = document.getElementById('shipping-municipality');
  if (!muniSelect?.value?.trim()) {
    isValid = false;
    if (highlight) {
      setFieldError('error-shipping-municipality', muniSelect, 'Seleccione el municipio de entrega.', true);
      if (!firstInvalidEl) firstInvalidEl = muniSelect;
    }
  } else {
    setFieldError('error-shipping-municipality', muniSelect, '', false);
  }

  // 4. Ciudad
  const citySelect = document.getElementById('shipping-city');
  if (!citySelect?.value?.trim()) {
    isValid = false;
    if (highlight) {
      setFieldError('error-shipping-city', citySelect, 'Seleccione o indique la ciudad o localidad.', true);
      if (!firstInvalidEl) firstInvalidEl = citySelect;
    }
  } else {
    setFieldError('error-shipping-city', citySelect, '', false);
  }

  // 5. Dirección exacta
  const addrText = document.getElementById('shipping-address');
  if (!addrText?.value?.trim()) {
    isValid = false;
    if (highlight) {
      setFieldError('error-shipping-address', addrText, 'Ingrese la dirección exacta o punto de referencia para el envío.', true);
      if (!firstInvalidEl) firstInvalidEl = addrText;
    }
  } else {
    setFieldError('error-shipping-address', addrText, '', false);
  }

  // 6. Productos
  const productsErrorEl = document.getElementById('error-order-products');
  let productsValid = true;
  let productsMessage = '';

  if (createState.orderItems.length === 0) {
    productsValid = false;
    productsMessage = 'Debe agregar al menos un producto al pedido.';
  } else {
    const unselectedRows = createState.orderItems.filter(it => !it.product_id);
    if (unselectedRows.length > 0) {
      productsValid = false;
      productsMessage = 'Debe seleccionar un producto del catálogo para cada línea agregada.';
      if (highlight) {
        unselectedRows.forEach(it => {
          const control = document.getElementById(`combobox-control-${it.rowId}`);
          if (control) control.classList.add('is-invalid');
          if (!firstInvalidEl) firstInvalidEl = document.getElementById(`combobox-input-${it.rowId}`);
        });
      }
    } else if (createState.orderItems.some(it => it.quantity < 1 || isNaN(it.quantity))) {
      productsValid = false;
      productsMessage = 'La cantidad de cada producto debe ser mayor o igual a 1.';
    } else if (createState.orderItems.some(it => it.unit_price < 0 || isNaN(it.unit_price))) {
      productsValid = false;
      productsMessage = 'El precio unitario no puede ser menor a 0.';
    }
  }

  if (!productsValid) {
    isValid = false;
    if (highlight && productsErrorEl) {
      productsErrorEl.textContent = productsMessage;
      productsErrorEl.style.display = 'block';
    }
  } else {
    if (productsErrorEl) {
      productsErrorEl.textContent = '';
      productsErrorEl.style.display = 'none';
    }
    createState.orderItems.forEach(it => {
      const control = document.getElementById(`combobox-control-${it.rowId}`);
      if (control) control.classList.remove('is-invalid');
    });
  }

  // Bloquear / Desbloquear botones de guardar
  const btnSubmit = document.getElementById('btn-submit-order');
  const btnSubmitTop = document.getElementById('btn-submit-order-top');

  if (btnSubmit) {
    btnSubmit.disabled = !isValid;
    if (!isValid) {
      btnSubmit.setAttribute('title', 'Complete todos los campos requeridos para habilitar');
    } else {
      btnSubmit.removeAttribute('title');
    }
  }
  if (btnSubmitTop) {
    btnSubmitTop.disabled = !isValid;
    if (!isValid) {
      btnSubmitTop.setAttribute('title', 'Complete todos los campos requeridos para habilitar');
    } else {
      btnSubmitTop.removeAttribute('title');
    }
  }

  return { isValid, firstInvalidEl };
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

    const filtered = createState.clients.filter(c => {
      const name = (c.name || `${c.first_name || ''} ${c.first_last_name || ''}`).toLowerCase();
      const username = (c.username || '').toLowerCase();
      const doc = (c.identity_document || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      return name.includes(query) || username.includes(query) || doc.includes(query) || email.includes(query) || phone.includes(query);
    });

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
      dropdown.innerHTML = filtered.map(c => {
        const displayName = c.name || `${c.first_name || ''} ${c.first_last_name || ''}`.trim() || c.username;
        return `
          <div class="client-result-item" data-client-id="${c.id}" role="option">
            <div class="client-result-meta">
              <div class="client-result-avatar">${getInitials(displayName)}</div>
              <div class="client-result-text">
                <span class="client-result-name">
                  ${escapeHtml(displayName)}
                  ${c.identity_document ? `<span class="client-badge-doc" style="display: inline-block; font-size: 0.72rem; padding: 2px 7px; background: #e0f2fe; color: #0284c7; border-radius: 4px; font-weight: 700; margin-left: 6px;">${escapeHtml(c.identity_document)}</span>` : ''}
                </span>
                <span class="client-result-sub">
                  ${c.email ? escapeHtml(c.email) : ''} ${c.phone ? `• ${escapeHtml(c.phone)}` : ''}
                </span>
              </div>
            </div>
            <span class="client-result-action">Seleccionar →</span>
          </div>
        `;
      }).join('');

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

    const displayName = client.name || `${client.first_name || ''} ${client.first_last_name || ''}`.trim() || client.username;

    if (avatarEl) avatarEl.textContent = getInitials(displayName);
    if (nameEl) nameEl.textContent = displayName;
    if (userEl) userEl.textContent = `@${client.username || 'cliente'}`;
    if (docEl) docEl.textContent = client.identity_document || 'Sin documento';
    if (emailEl) emailEl.textContent = client.email || 'No registrado';
    if (phoneEl) phoneEl.textContent = client.phone || 'No registrado';

    card.style.display = 'flex';
  }

  // Si el cliente tiene dirección registrada y el campo está vacío, prellenar
  if (client.address) {
    const addrInput = document.getElementById('shipping-address');
    if (addrInput && !addrInput.value.trim()) {
      addrInput.value = client.address;
    }
  }

  validateOrderForm({ highlight: createState.isFormSubmitted });
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

  validateOrderForm({ highlight: createState.isFormSubmitted });
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
      validateOrderForm({ highlight: createState.isFormSubmitted });
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
      validateOrderForm({ highlight: createState.isFormSubmitted });
      return;
    }

    const currentCity = preferredCity && cities.includes(preferredCity) ? preferredCity : cities[0];
    citySelect.innerHTML = cities.map(c => `
      <option value="${escapeHtml(c)}" ${c === currentCity ? 'selected' : ''}>${escapeHtml(c)}</option>
    `).join('');

    validateOrderForm({ highlight: createState.isFormSubmitted });
  };

  // 4. Event Listeners
  stateSelect.addEventListener('change', () => {
    updateMunicipalities(stateSelect.value);
    validateOrderForm({ highlight: createState.isFormSubmitted });
  });

  muniSelect.addEventListener('change', () => {
    updateCities(stateSelect.value, muniSelect.value);
    validateOrderForm({ highlight: createState.isFormSubmitted });
  });

  citySelect.addEventListener('change', () => {
    validateOrderForm({ highlight: createState.isFormSubmitted });
  });

  // 5. Inicializar cascada con valores por defecto
  updateMunicipalities(defaultState, defaultMuni);
  if (defaultCity) {
    updateCities(defaultState, defaultMuni, defaultCity);
  }
}

/**
 * ==========================================================================
 * PRODUCTOS CON SELECT BUSCADOR (COMBOBOX) Y PRECIO AUTOACTUALIZADO
 * ==========================================================================
 */

/**
 * Agrega una nueva fila de producto al pedido
 * @param {Object} [initialData] Datos iniciales opcionales
 */
function addOrderItem(initialData = null) {
  createState.itemCounter++;

  const selectedProd = initialData?.product_id
    ? createState.products.find(p => p.id === parseInt(initialData.product_id, 10))
    : (initialData?.product || null);

  const unitPrice = selectedProd 
    ? (initialData?.unit_price !== undefined ? parseFloat(initialData.unit_price) : parseFloat(selectedProd.price || 0))
    : 0;

  const newItem = {
    rowId: createState.itemCounter,
    product_id: selectedProd ? selectedProd.id : null,
    product_name: selectedProd ? (selectedProd.product_name || selectedProd.name) : '',
    sku: selectedProd ? (selectedProd.sku || 'EST-00') : '',
    category: selectedProd ? (selectedProd.category || 'Mobiliario') : '',
    image: selectedProd ? (selectedProd.image || '../../assets/images/logo.jpeg') : '../../assets/images/logo.jpeg',
    quantity: initialData?.quantity || 1,
    unit_price: unitPrice,
    specs: initialData?.specs || ''
  };

  createState.orderItems.push(newItem);
  renderOrderItems();
  updateFinancialSummary();
  validateOrderForm({ highlight: createState.isFormSubmitted });
}

/**
 * Remueve una fila de producto
 */
function removeOrderItem(rowId) {
  if (createState.orderItems.length <= 1) {
    showToast('warning', 'Mínimo de Productos', 'El pedido debe contener al menos un producto.');
    return;
  }
  createState.orderItems = createState.orderItems.filter(it => it.rowId !== rowId);
  renderOrderItems();
  updateFinancialSummary();
  validateOrderForm({ highlight: createState.isFormSubmitted });
}

/**
 * Renderiza todas las filas de productos con Input-Select Buscador
 */
function renderOrderItems() {
  const container = document.getElementById('order-items-list-container');
  if (!container) return;

  container.innerHTML = createState.orderItems.map((item, index) => {
    const subtotal = item.product_id ? (item.quantity * item.unit_price) : 0;

    return `
      <div class="order-item-row-card" data-row-id="${item.rowId}">
        <!-- Fila Superior: Buscador de Producto a Ancho Completo (No comparte fila con precio y cantidad) -->
        <div class="item-product-section">
          <div class="item-product-header">
            <label class="form-label font-bold" for="combobox-input-${item.rowId}">
              Producto #${index + 1} <span class="required-mark">*</span>
            </label>
            ${createState.orderItems.length > 1 ? `
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
                <span class="btn-remove-text">Eliminar</span>
              </button>
            ` : `
              <button 
                type="button" 
                class="btn-remove-item-row" 
                data-row-id="${item.rowId}" 
                title="Limpiar este producto" 
                aria-label="Limpiar producto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span class="btn-remove-text">Limpiar</span>
              </button>
            `}
          </div>

          <!-- Selector con Buscador de Producto (Searchable Combobox) a ancho completo -->
          <div class="product-searchable-select" data-row-id="${item.rowId}">
            <div class="combobox-control ${item.product_id ? 'has-value' : ''}" id="combobox-control-${item.rowId}">
              <img 
                src="${escapeHtml(item.image)}" 
                alt="${escapeHtml(item.product_name || 'Producto')}" 
                class="combobox-thumb" 
                id="combobox-thumb-${item.rowId}" 
                onerror="this.src='../../assets/images/logo.jpeg'">
              <input 
                type="text" 
                class="combobox-input font-bold" 
                id="combobox-input-${item.rowId}"
                data-row-id="${item.rowId}" 
                placeholder="Buscar producto por nombre, SKU o categoría..." 
                value="${escapeHtml(item.product_name || '')}" 
                autocomplete="off">
              <button type="button" class="combobox-toggle-btn" id="combobox-toggle-${item.rowId}" data-row-id="${item.rowId}" tabindex="-1" title="Mostrar catálogo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
            <div class="combobox-dropdown" id="combobox-dropdown-${item.rowId}" style="display: none;" role="listbox"></div>
          </div>
        </div>

        <!-- Fila Inferior: Cantidad, Precio Unitario y Subtotal (Fila propia separada) -->
        <div class="item-financials-grid">
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

          <!-- Precio Unitario ($) - Autoactualizado al escoger producto -->
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

          <!-- Subtotal Línea ($) -->
          <div class="item-subtotal-col">
            <label class="form-label">Subtotal ($)</label>
            <div class="item-subtotal-box" id="subtotal-${item.rowId}">
              ${formatUsd(subtotal)}
            </div>
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

  // Vincular eventos a cada fila del combobox
  createState.orderItems.forEach(item => {
    bindComboboxEvents(item.rowId);
  });

  // Event Listeners para cantidad
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
        validateOrderForm({ highlight: createState.isFormSubmitted });
      }
    });
  });

  // Event Listeners para precio manual (si el admin desea modificarlo)
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
        validateOrderForm({ highlight: createState.isFormSubmitted });
      }
    });
  });

  // Event Listeners para especificaciones
  container.querySelectorAll('.item-specs-input').forEach(textarea => {
    textarea.addEventListener('input', () => {
      const rowId = parseInt(textarea.getAttribute('data-row-id'), 10);
      const item = createState.orderItems.find(it => it.rowId === rowId);
      if (item) {
        item.specs = textarea.value;
      }
    });
  });

  // Event Listeners para eliminar fila
  container.querySelectorAll('.btn-remove-item-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowId = parseInt(btn.getAttribute('data-row-id'), 10);
      removeOrderItem(rowId);
    });
  });
}

/**
 * Vincula la interactividad del combobox con buscador
 */
function bindComboboxEvents(rowId) {
  const input = document.getElementById(`combobox-input-${rowId}`);
  const toggleBtn = document.getElementById(`combobox-toggle-${rowId}`);
  const dropdown = document.getElementById(`combobox-dropdown-${rowId}`);

  if (!input || !dropdown) return;

  // Abrir al interactuar
  input.addEventListener('focus', () => {
    openProductCombobox(rowId, input.value);
  });

  input.addEventListener('click', () => {
    openProductCombobox(rowId, input.value);
  });

  // Filtrado en vivo al escribir
  input.addEventListener('input', () => {
    openProductCombobox(rowId, input.value);
  });

  // Al perder foco, restaurar nombre o limpiar si no se seleccionó
  input.addEventListener('blur', () => {
    setTimeout(() => {
      const item = createState.orderItems.find(it => it.rowId === rowId);
      if (item && item.product_id) {
        input.value = item.product_name;
      } else {
        input.value = '';
      }
      closeProductCombobox(rowId);
    }, 200);
  });

  // Botón flecha
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'block';
      if (isOpen) {
        closeProductCombobox(rowId);
      } else {
        input.focus();
        openProductCombobox(rowId, '');
      }
    });
  }
}

/**
 * Abre el combobox y filtra productos
 */
function openProductCombobox(rowId, filterQuery = '') {
  // Cierra otros dropdowns abiertos
  document.querySelectorAll('.combobox-dropdown').forEach(d => {
    if (d.id !== `combobox-dropdown-${rowId}`) {
      d.style.display = 'none';
    }
  });
  document.querySelectorAll('.combobox-toggle-btn').forEach(btn => {
    if (btn.getAttribute('data-row-id') !== String(rowId)) {
      btn.classList.remove('is-open');
    }
  });

  const dropdown = document.getElementById(`combobox-dropdown-${rowId}`);
  const toggleBtn = document.getElementById(`combobox-toggle-${rowId}`);
  if (!dropdown) return;

  const query = (filterQuery || '').trim().toLowerCase();
  const item = createState.orderItems.find(it => it.rowId === rowId);

  const filtered = createState.products.filter(p => {
    if (!query) return true;
    const name = (p.product_name || p.name || '').toLowerCase();
    const sku = (p.sku || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    return name.includes(query) || sku.includes(query) || cat.includes(query);
  });

  if (filtered.length === 0) {
    dropdown.innerHTML = `
      <div class="combobox-no-results">
        No se encontraron productos coincidentes con "<strong>${escapeHtml(filterQuery)}</strong>"
      </div>
    `;
  } else {
    dropdown.innerHTML = filtered.map(p => {
      const isSelected = item && item.product_id === p.id;
      const pName = p.product_name || p.name || 'Producto';
      const pImg = p.image || '../../assets/images/logo.jpeg';
      const pPrice = parseFloat(p.price) || 0;
      const pSku = p.sku ? `SKU: ${p.sku}` : '';
      const pCat = p.category ? `• ${p.category}` : '';

      return `
        <div class="combobox-item ${isSelected ? 'is-selected' : ''}" data-product-id="${p.id}" role="option" aria-selected="${isSelected}">
          <img src="${escapeHtml(pImg)}" alt="${escapeHtml(pName)}" class="combobox-item-thumb" onerror="this.src='../../assets/images/logo.jpeg'">
          <div class="combobox-item-info">
            <div class="combobox-item-name">${escapeHtml(pName)}</div>
            <div class="combobox-item-sub">${escapeHtml(pSku)} ${escapeHtml(pCat)}</div>
          </div>
          <div class="combobox-item-price">${formatUsd(pPrice)}</div>
        </div>
      `;
    }).join('');

    dropdown.querySelectorAll('.combobox-item').forEach(elem => {
      elem.addEventListener('mousedown', (e) => {
        // Prevenir blur del input antes de seleccionar
        e.preventDefault();
      });
      elem.addEventListener('click', () => {
        const prodId = parseInt(elem.getAttribute('data-product-id'), 10);
        selectProductForRow(rowId, prodId);
        closeProductCombobox(rowId);
      });
    });
  }

  dropdown.style.display = 'block';
  if (toggleBtn) toggleBtn.classList.add('is-open');
}

/**
 * Cierra el combobox
 */
function closeProductCombobox(rowId) {
  const dropdown = document.getElementById(`combobox-dropdown-${rowId}`);
  const toggleBtn = document.getElementById(`combobox-toggle-${rowId}`);
  if (dropdown) dropdown.style.display = 'none';
  if (toggleBtn) toggleBtn.classList.remove('is-open');
}

/**
 * Selecciona un producto para la fila especificada y autoactualiza el precio
 */
function selectProductForRow(rowId, prodId) {
  const prod = createState.products.find(p => p.id === prodId);
  const item = createState.orderItems.find(it => it.rowId === rowId);

  if (!prod || !item) return;

  item.product_id = prod.id;
  item.product_name = prod.product_name || prod.name;
  item.sku = prod.sku || 'EST-00';
  item.category = prod.category || 'Mobiliario';
  item.image = prod.image || '../../assets/images/logo.jpeg';
  
  // AL ESCOGER EL PRODUCTO EL PRECIO DEBE DE ACTUALIZARSE DE FORMA AUTOMÁTICA
  item.unit_price = parseFloat(prod.price) || 0;

  // Actualizar input text del combobox
  const input = document.getElementById(`combobox-input-${rowId}`);
  if (input) input.value = item.product_name;

  // Actualizar miniatura
  const thumb = document.getElementById(`combobox-thumb-${rowId}`);
  if (thumb) {
    thumb.src = item.image;
    thumb.alt = item.product_name;
  }

  // Actualizar input de precio unitario en el DOM con el precio del catálogo
  const priceInput = document.querySelector(`.item-price-input[data-row-id="${rowId}"]`);
  if (priceInput) {
    priceInput.value = item.unit_price.toFixed(2);
  }

  // Actualizar subtotal de la línea en el DOM
  const subtotalBox = document.getElementById(`subtotal-${rowId}`);
  if (subtotalBox) {
    subtotalBox.textContent = formatUsd(item.quantity * item.unit_price);
  }

  // Quitar estado de inválido si lo tenía y marcar como completado
  const control = document.getElementById(`combobox-control-${rowId}`);
  if (control) {
    control.classList.remove('is-invalid');
    control.classList.add('has-value');
  }

  // Actualizar totales financieros
  updateFinancialSummary();

  // Re-validar formulario para desbloquear botón de guardar
  validateOrderForm({ highlight: createState.isFormSubmitted });
}

// Cerrar comboboxes al hacer click fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.product-searchable-select')) {
    document.querySelectorAll('.combobox-dropdown').forEach(d => {
      d.style.display = 'none';
    });
    document.querySelectorAll('.combobox-toggle-btn').forEach(btn => {
      btn.classList.remove('is-open');
    });
  }
});

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
 * MODAL: REGISTRO RÁPIDO DE CLIENTE COMPLETO (MODELO USER)
 * ==========================================================================
 */
function openQuickClientModal(initialQuery = '') {
  const modal = document.getElementById('quick-client-modal-backdrop');
  const firstNameInput = document.getElementById('quick-client-first-name');
  const docInput = document.getElementById('quick-client-doc');
  const emailInput = document.getElementById('quick-client-email');

  clearQuickClientErrors();

  if (initialQuery) {
    if (/^[0-9]+$/.test(initialQuery)) {
      if (docInput) docInput.value = initialQuery;
    } else if (initialQuery.includes('@')) {
      if (emailInput) emailInput.value = initialQuery;
    } else {
      const parts = initialQuery.trim().split(' ');
      if (firstNameInput) firstNameInput.value = parts[0] || '';
      const lastNameInput = document.getElementById('quick-client-first-last-name');
      if (lastNameInput && parts.length > 1) {
        lastNameInput.value = parts.slice(1).join(' ');
      }
    }
  }

  validateQuickClientForm({ highlight: false });

  if (modal) modal.classList.add('is-open');
  if (firstNameInput) firstNameInput.focus();
}

function closeQuickClientModal() {
  const modal = document.getElementById('quick-client-modal-backdrop');
  if (modal) modal.classList.remove('is-open');
  const form = document.getElementById('quick-client-form');
  if (form) form.reset();
  clearQuickClientErrors();

  const spinner = document.getElementById('quick-client-spinner');
  const btnSave = document.getElementById('btn-save-quick-client');
  const btnText = btnSave?.querySelector('.btn-text');

  if (spinner) spinner.style.display = 'none';
  if (btnText) btnText.textContent = 'Guardar y Seleccionar Cliente';
  if (btnSave) btnSave.disabled = false;
}

function updateQuickRuleStatus(elemId, isValid) {
  const elem = document.getElementById(elemId);
  if (!elem) return;
  const icon = elem.querySelector('.rule-icon');
  const text = elem.querySelector('.rule-text');
  if (isValid) {
    elem.style.color = '#16a34a';
    if (text) text.style.fontWeight = '600';
    if (icon) {
      icon.textContent = '✔';
      icon.style.color = '#16a34a';
    }
  } else {
    elem.style.color = '#64748b';
    if (text) text.style.fontWeight = 'normal';
    if (icon) {
      icon.textContent = '○';
      icon.style.color = '#94a3b8';
    }
  }
}

function setupQuickPasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const isPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPassword ? 'text' : 'password');
    btn.innerHTML = isPassword
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  });
}

function clearQuickClientErrors() {
  const errorIds = [
    'error-quick-first-name',
    'error-quick-first-last-name',
    'error-quick-doc',
    'error-quick-birth-date',
    'error-quick-email',
    'error-quick-phone',
    'error-quick-password',
    'error-quick-confirm-password'
  ];
  errorIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  });

  const modal = document.getElementById('quick-client-modal-backdrop');
  if (modal) {
    modal.querySelectorAll('.is-invalid').forEach(inp => inp.classList.remove('is-invalid'));
  }

  ['quick-rule-len', 'quick-rule-upper', 'quick-rule-num', 'quick-rule-match'].forEach(id => {
    updateQuickRuleStatus(id, false);
  });
}

function validateQuickClientForm({ highlight = false } = {}) {
  let isValid = true;
  let firstInvalid = null;

  const firstName = document.getElementById('quick-client-first-name');
  const firstLastName = document.getElementById('quick-client-first-last-name');
  const doc = document.getElementById('quick-client-doc');
  const birthDate = document.getElementById('quick-client-birth-date');
  const email = document.getElementById('quick-client-email');
  const phone = document.getElementById('quick-client-phone');

  // Primer Nombre
  if (!firstName?.value?.trim()) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-first-name', firstName, 'El primer nombre es obligatorio.', true);
      if (!firstInvalid) firstInvalid = firstName;
    }
  } else {
    setFieldError('error-quick-first-name', firstName, '', false);
  }

  // Primer Apellido
  if (!firstLastName?.value?.trim()) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-first-last-name', firstLastName, 'El primer apellido es obligatorio.', true);
      if (!firstInvalid) firstInvalid = firstLastName;
    }
  } else {
    setFieldError('error-quick-first-last-name', firstLastName, '', false);
  }

  // Documento de Identidad (números)
  const docVal = doc?.value?.trim();
  if (!docVal) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-doc', doc, 'El número de documento es obligatorio.', true);
      if (!firstInvalid) firstInvalid = doc;
    }
  } else if (!/^[0-9]{5,12}$/.test(docVal)) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-doc', doc, 'Ingrese un documento numérico válido (5 a 12 dígitos).', true);
      if (!firstInvalid) firstInvalid = doc;
    }
  } else {
    setFieldError('error-quick-doc', doc, '', false);
  }

  // Fecha de Nacimiento
  if (!birthDate?.value) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-birth-date', birthDate, 'La fecha de nacimiento es obligatoria.', true);
      if (!firstInvalid) firstInvalid = birthDate;
    }
  } else {
    setFieldError('error-quick-birth-date', birthDate, '', false);
  }

  // Correo Electrónico
  const emailVal = email?.value?.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailVal) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-email', email, 'El correo electrónico es obligatorio.', true);
      if (!firstInvalid) firstInvalid = email;
    }
  } else if (!emailRegex.test(emailVal)) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-email', email, 'Ingrese un correo electrónico válido.', true);
      if (!firstInvalid) firstInvalid = email;
    }
  } else {
    setFieldError('error-quick-email', email, '', false);
  }

  // Teléfono
  const phoneVal = phone?.value?.trim();
  if (!phoneVal) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-phone', phone, 'El teléfono de contacto es obligatorio.', true);
      if (!firstInvalid) firstInvalid = phone;
    }
  } else {
    setFieldError('error-quick-phone', phone, '', false);
  }

  // Contraseña de Acceso
  const passwordInput = document.getElementById('quick-client-password');
  const confirmPasswordInput = document.getElementById('quick-client-confirm-password');

  const pwdVal = passwordInput?.value || '';
  const confirmPwdVal = confirmPasswordInput?.value || '';

  const hasLen = pwdVal.length >= 6;
  const hasUpper = /[A-Z]/.test(pwdVal);
  const hasNum = /[0-9]/.test(pwdVal);
  const hasMatch = confirmPwdVal.length > 0 && pwdVal === confirmPwdVal;

  updateQuickRuleStatus('quick-rule-len', hasLen);
  updateQuickRuleStatus('quick-rule-upper', hasUpper);
  updateQuickRuleStatus('quick-rule-num', hasNum);
  updateQuickRuleStatus('quick-rule-match', hasMatch);

  if (!pwdVal) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-password', passwordInput, 'La contraseña es obligatoria.', true);
      if (!firstInvalid) firstInvalid = passwordInput;
    }
  } else if (!hasLen) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-password', passwordInput, 'La contraseña debe tener al menos 6 caracteres.', true);
      if (!firstInvalid) firstInvalid = passwordInput;
    }
  } else if (!hasUpper) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-password', passwordInput, 'La contraseña debe incluir al menos una letra mayúscula (A-Z).', true);
      if (!firstInvalid) firstInvalid = passwordInput;
    }
  } else if (!hasNum) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-password', passwordInput, 'La contraseña debe incluir al menos un número (0-9).', true);
      if (!firstInvalid) firstInvalid = passwordInput;
    }
  } else {
    setFieldError('error-quick-password', passwordInput, '', false);
  }

  // Confirmación de Contraseña
  if (!confirmPwdVal) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-confirm-password', confirmPasswordInput, 'Confirme la contraseña.', true);
      if (!firstInvalid) firstInvalid = confirmPasswordInput;
    }
  } else if (pwdVal !== confirmPwdVal) {
    isValid = false;
    if (highlight) {
      setFieldError('error-quick-confirm-password', confirmPasswordInput, 'Las contraseñas no coinciden.', true);
      if (!firstInvalid) firstInvalid = confirmPasswordInput;
    }
  } else {
    setFieldError('error-quick-confirm-password', confirmPasswordInput, '', false);
  }

  const btnSave = document.getElementById('btn-save-quick-client');
  if (btnSave) {
    btnSave.disabled = !isValid;
  }

  return { isValid, firstInvalid };
}

async function handleSaveQuickClient(e) {
  if (e) e.preventDefault();

  const { isValid, firstInvalid } = validateQuickClientForm({ highlight: true });
  if (!isValid) {
    if (firstInvalid) firstInvalid.focus();
    showToast('warning', 'Datos Incompletos', 'Por favor complete todos los campos obligatorios del cliente marcados en rojo.');
    return;
  }

  const btnSave = document.getElementById('btn-save-quick-client');
  const spinner = document.getElementById('quick-client-spinner');
  const btnText = btnSave?.querySelector('.btn-text');

  if (btnSave) btnSave.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  if (btnText) btnText.textContent = 'Registrando cliente...';

  try {
    const docType = document.getElementById('quick-client-doc-type')?.value || 'V';
    const docNum = document.getElementById('quick-client-doc')?.value.trim();
    const fullDoc = `${docType}-${docNum}`;

    const firstName = document.getElementById('quick-client-first-name')?.value.trim();
    const secondName = document.getElementById('quick-client-second-name')?.value.trim() || '';
    const firstLastName = document.getElementById('quick-client-first-last-name')?.value.trim();
    const secondLastName = document.getElementById('quick-client-second-last-name')?.value.trim() || '';
    const birthDate = document.getElementById('quick-client-birth-date')?.value;
    const email = document.getElementById('quick-client-email')?.value.trim();
    const phone = document.getElementById('quick-client-phone')?.value.trim();
    const password = document.getElementById('quick-client-password')?.value || '';
    const confirmPassword = document.getElementById('quick-client-confirm-password')?.value || '';
    const city = document.getElementById('quick-client-city')?.value.trim() || '';
    const state = document.getElementById('quick-client-state')?.value.trim() || '';
    const address = document.getElementById('quick-client-address')?.value.trim() || '';

    const cleanUser = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${docNum}`.slice(0, 30);

    const clientPayload = {
      username: cleanUser,
      first_name: firstName,
      second_name: secondName,
      first_last_name: firstLastName,
      second_last_name: secondLastName,
      document_type: docType,
      identity_document: fullDoc,
      birth_date: birthDate,
      email: email,
      phone: phone,
      password: password,
      confirm_password: confirmPassword,
      city: city,
      state: state,
      address: address
    };

    let createdClient;
    try {
      createdClient = await createClient(clientPayload);
    } catch (apiErr) {
      console.warn('API error creating client, checking field details:', apiErr);
      if (apiErr?.data) {
        if (apiErr.data.email) {
          const emailInput = document.getElementById('quick-client-email');
          setFieldError('error-quick-email', emailInput, Array.isArray(apiErr.data.email) ? apiErr.data.email[0] : String(apiErr.data.email), true);
        }
        if (apiErr.data.identity_document) {
          const docInput = document.getElementById('quick-client-doc');
          setFieldError('error-quick-doc', docInput, Array.isArray(apiErr.data.identity_document) ? apiErr.data.identity_document[0] : String(apiErr.data.identity_document), true);
        }
        if (apiErr.data.phone) {
          const phoneInput = document.getElementById('quick-client-phone');
          setFieldError('error-quick-phone', phoneInput, Array.isArray(apiErr.data.phone) ? apiErr.data.phone[0] : String(apiErr.data.phone), true);
        }
        if (apiErr.data.password) {
          const pwdInput = document.getElementById('quick-client-password');
          setFieldError('error-quick-password', pwdInput, Array.isArray(apiErr.data.password) ? apiErr.data.password[0] : String(apiErr.data.password), true);
        }
      }
      throw apiErr;
    }

    const clientObj = {
      id: createdClient.id || Date.now(),
      name: `${firstName} ${firstLastName}`.trim(),
      first_name: firstName,
      second_name: secondName,
      first_last_name: firstLastName,
      second_last_name: secondLastName,
      username: createdClient.username || cleanUser,
      identity_document: fullDoc,
      email: email,
      phone: phone,
      city: city,
      state: state,
      address: address
    };

    createState.clients.unshift(clientObj);
    selectClient(clientObj);
    closeQuickClientModal();

    showToast('success', 'Cliente Registrado', `Cliente "${clientObj.name}" registrado y asociado al pedido con éxito.`);
  } catch (err) {
    console.error('Error al registrar cliente:', err);
    const msg = err.message || (typeof err === 'string' ? err : 'No se pudo registrar el cliente. Revise los datos ingresados.');
    showToast('danger', 'Error al Guardar Cliente', msg);
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (btnText) btnText.textContent = 'Guardar y Seleccionar Cliente';
    validateQuickClientForm({ highlight: false });
  }
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

  createState.isFormSubmitted = true;
  const { isValid, firstInvalidEl } = validateOrderForm({ highlight: true });

  if (!isValid) {
    showToast('warning', 'Campos Incompletos', 'Por favor complete todos los datos requeridos señalados en rojo antes de registrar el pedido.');
    if (firstInvalidEl) {
      firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalidEl.focus?.();
    }
    return;
  }

  const shippingState = document.getElementById('shipping-state')?.value.trim();
  const shippingMunicipality = document.getElementById('shipping-municipality')?.value.trim();
  const shippingCity = document.getElementById('shipping-city')?.value.trim();
  const shippingAddress = document.getElementById('shipping-address')?.value.trim();

  const clientNotes = document.getElementById('order-client-notes')?.value.trim() || '';
  const internalNotes = document.getElementById('order-internal-notes')?.value.trim() || '';
  const initialStatus = document.getElementById('order-initial-status')?.value || 'pending_initial_payment';

  let totalPriceUsd = 0;
  const detailsPayload = createState.orderItems.map(it => {
    const finalPrice = it.quantity * it.unit_price;
    totalPriceUsd += finalPrice;
    return {
      product_id: it.product_id,
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

  const totalPriceBs = totalPriceUsd * createState.exchangeRate;
  showConfirmationModal({
    title: '¿Confirmar y Registrar Pedido?',
    message: `Se creará el pedido para "${createState.selectedClient.name}" con entrega en ${shippingCity}, Edo. ${shippingState} por un total de ${formatUsd(totalPriceUsd)} (${formatBs(totalPriceBs)}).`,
    onConfirm: async () => {
      const btnAccept = document.getElementById('btn-confirm-accept');
      if (btnAccept) {
        btnAccept.disabled = true;
        btnAccept.textContent = 'Procesando...';
      }

      try {
        const createdOrder = await createOrder(orderPayload);
        showToast('success', '¡Pedido Creado con Éxito!', `El pedido ${createdOrder.order_number || '#00' + (createdOrder.id || '')} se ha registrado correctamente.`);
        
        setTimeout(() => {
          window.location.href = `order-detail.html?id=${createdOrder.id}`;
        }, 1200);
      } catch (err) {
        console.error('Error al crear pedido:', err);
        showToast('danger', 'Error al Guardar Pedido', err.message || 'Ocurrió un error al registrar el pedido. Intente nuevamente.');
      } finally {
        if (btnAccept) {
          btnAccept.disabled = false;
          btnAccept.textContent = 'Confirmar y Crear';
        }
      }
    }
  });
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

    // Eventos en inputs de dirección para validación en tiempo real
    ['shipping-state', 'shipping-municipality', 'shipping-city', 'shipping-address'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => validateOrderForm({ highlight: createState.isFormSubmitted }));
        el.addEventListener('change', () => validateOrderForm({ highlight: createState.isFormSubmitted }));
        el.addEventListener('blur', () => {
          if (createState.isFormSubmitted || el.value.trim() === '') {
            validateOrderForm({ highlight: true });
          }
        });
      }
    });

    // Eventos en inputs del modal de cliente rápido para validación en vivo
    [
      'quick-client-first-name',
      'quick-client-first-last-name',
      'quick-client-doc',
      'quick-client-birth-date',
      'quick-client-email',
      'quick-client-phone',
      'quick-client-password',
      'quick-client-confirm-password'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => validateQuickClientForm({ highlight: false }));
        el.addEventListener('blur', () => {
          if (el.value.trim() === '') {
            validateQuickClientForm({ highlight: true });
          }
        });
      }
    });

    // Toggle de visibilidad para contraseñas en modal de cliente
    setupQuickPasswordToggle('btn-toggle-quick-password', 'quick-client-password');
    setupQuickPasswordToggle('btn-toggle-quick-confirm-password', 'quick-client-confirm-password');

    // Cierre con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeQuickClientModal();
        closeConfirmationModal();
      }
    });

    // Ejecutar validación inicial para asegurar estado bloqueado hasta que los campos estén completos
    validateOrderForm({ highlight: false });

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
