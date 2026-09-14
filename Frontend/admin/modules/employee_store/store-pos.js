/**
 * ==========================================================================
 * PUNTO DE VENTA EN MOSTRADOR (BODEGA POS) - TUESTANTE OMS
 * ==========================================================================
 * Manejo de identificación de trabajador con saldo/salario en vivo, búsqueda
 * rápida de productos con input select, grilla de despacho reactiva,
 * verificación de límites semanales y confirmación de entrega inmediata.
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { getOfficialRate } from '../../js/service/exchange-rate.service.js';
import {
  fetchEmployees,
  fetchProducts,
  fetchProductByBarcode,
  fetchEmployeeStatement,
  createInternalOrder
} from './employee-store.api.js';
import { resolveImageUrl } from '../../js/api.js';
import { showLoadingOverlay, hideLoadingOverlay } from '../../components/modal/modal.js';

// Estado local reactivo del POS
const state = {
  employees: [],
  selectedEmployee: null,
  products: [],
  cart: [], // [{ product, quantity, subtotal, isLimitExceeded, alreadyConsumed }]
  exchangeRate: 80.00,
  isProcessing: false
};

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadAdminComponents({ title: 'Punto de Venta (POS)' });

  // 1. Cargar Tasa Oficial BCV
  try {
    const rate = await getOfficialRate();
    if (rate > 0) {
      state.exchangeRate = rate;
      const rateEl = document.getElementById('exchange-rate-display');
      if (rateEl) {
        rateEl.textContent = `Bs. ${rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }
  } catch (e) {
    console.warn('[POS] Usando tasa fallback:', e);
  }

  // 2. Cargar datos iniciales
  await Promise.all([
    loadEmployees(),
    loadProducts()
  ]);

  // 3. Configurar escuchadores de eventos
  setupEventListeners();
  focusBarcodeInput();
});

function focusBarcodeInput() {
  const input = document.getElementById('barcode-input');
  if (input) input.focus();
}

// ============================================================================
// CARGA DE DATOS: EMPLEADOS Y PRODUCTOS
// ============================================================================
async function loadEmployees() {
  try {
    state.employees = await fetchEmployees();
  } catch (error) {
    console.error('Error al cargar empleados:', error);
    showToast('error', 'Error al cargar empleados', error.message || 'Verifica la conexión.');
  }
}

async function loadProducts() {
  try {
    state.products = await fetchProducts({ is_active: true });
    renderProductSuggestions();
    renderProductChips();
  } catch (error) {
    console.error('Error al cargar catálogo de productos:', error);
    showToast('error', 'Error al cargar productos', error.message || 'Verifica la conexión.');
  }
}

/**
 * Renderiza la lista desplegable integrada de productos (Combobox Select)
 */
function renderProductSuggestions(filterText = '') {
  const dropdown = document.getElementById('product-suggestions-list');
  if (!dropdown) return;

  const term = filterText.toLowerCase().trim();
  const filtered = state.products.filter(p => 
    !term || 
    p.name.toLowerCase().includes(term) || 
    (p.barcode && p.barcode.toLowerCase().includes(term)) ||
    (p.category_name && p.category_name.toLowerCase().includes(term)) ||
    (p.subcategory_name && p.subcategory_name.toLowerCase().includes(term))
  );

  if (filtered.length === 0) {
    dropdown.innerHTML = `
      <div class="empty-suggest-box">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">No se encontraron coincidencias locales</p>
        <span style="font-size: 0.8rem; color: #64748b;">Buscando automáticamente en catálogo para "<strong>${escapeHtml(filterText)}</strong>"...</span>
      </div>
    `;
    return;
  }

  const consumedMap = (state.selectedEmployee && state.selectedEmployee.weekly_consumed_by_product) || {};

  const itemsHtml = filtered.map((p, index) => {
    const isOutOfStock = p.stock <= 0;
    const priceUsd = parseFloat(p.price || 0);
    const priceVes = priceUsd * state.exchangeRate;
    const imgUrl = p.image ? resolveImageUrl(p.image) : null;
    const thumbMarkup = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}" class="suggest-product-thumb" onerror="this.onerror=null;this.parentElement.innerHTML='📦';">`
      : `<div class="suggest-product-no-thumb">📦</div>`;

    // Badge de límite semanal reactivo
    let limitBadgeHtml = '';
    if (p.weekly_limit_per_employee > 0) {
      if (state.selectedEmployee) {
        const consumed = consumedMap[p.id] || 0;
        const limit = p.weekly_limit_per_employee;
        if (consumed >= limit) {
          limitBadgeHtml = `<span class="badge-limit" style="background:#fee2e2; color:#dc2626; font-weight:700;">⛔ Cupo agotado (${consumed}/${limit}/sem)</span>`;
        } else {
          limitBadgeHtml = `<span class="badge-limit" style="background:#fef3c7; color:#b45309;">📊 Cupo: ${consumed}/${limit}/sem</span>`;
        }
      } else {
        limitBadgeHtml = `<span class="badge-limit">Máx: ${p.weekly_limit_per_employee}/sem</span>`;
      }
    }

    return `
      <div class="product-suggest-item ${index === 0 && term ? 'is-selected' : ''}" data-product-id="${p.id}" role="option" tabindex="-1">
        <div class="suggest-item-left">
          <div class="suggest-product-thumb-box">
            ${thumbMarkup}
          </div>
          <div class="suggest-product-info">
            <div class="suggest-product-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
            <div class="suggest-product-badges">
              <span class="badge-barcode">🏷️ ${escapeHtml(p.barcode || 'S/C')}</span>
              ${p.category_name ? `<span class="badge-category">${escapeHtml(p.category_name)}</span>` : ''}
              ${limitBadgeHtml}
            </div>
          </div>
        </div>
        <div class="suggest-item-right">
          <div class="suggest-prices">
            <span class="suggest-price-usd">$${priceUsd.toFixed(2)}</span>
            <span class="suggest-price-ves">Bs. ${priceVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="suggest-stock ${isOutOfStock ? 'out-stock' : 'in-stock'}">
            ${isOutOfStock ? '⚠️ Agotado' : `✓ ${p.stock} disponibles`}
          </div>
        </div>
      </div>
    `;
  }).join('');

  dropdown.innerHTML = `
    <div class="suggest-dropdown-header">
      <span>📦 Catálogo de Productos (${filtered.length} disponibles)</span>
      <span style="font-size: 0.72rem; color: #64748b;">Selecciona o pulsa Enter</span>
    </div>
    <div class="suggest-items-scroller">
      ${itemsHtml}
    </div>
  `;

  // Asignar listeners de click a cada ítem
  dropdown.querySelectorAll('.product-suggest-item[data-product-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const prodId = parseInt(el.getAttribute('data-product-id'), 10);
      const product = state.products.find(p => p.id === prodId);
      if (product) {
        addProductToCart(product);
        const barcodeInput = document.getElementById('barcode-input');
        const btnClear = document.getElementById('btn-clear-barcode');
        const toggleBtn = document.getElementById('btn-toggle-product-dropdown');
        if (barcodeInput) barcodeInput.value = '';
        if (btnClear) btnClear.classList.add('hidden');
        if (toggleBtn) toggleBtn.classList.remove('is-open');
        dropdown.classList.add('hidden');
        focusBarcodeInput();
      }
    });
  });
}

/**
 * Renderiza los botones de un clic para productos frecuentes
 */
function renderProductChips(filterText = '') {
  const container = document.getElementById('product-chips-grid');
  if (!container) return;

  container.innerHTML = '';
  const term = filterText.toLowerCase().trim();
  const filtered = state.products.filter(p => 
    !term || p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.toLowerCase().includes(term))
  );

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-desc" style="grid-column: 1/-1; text-align: center; padding: 16px;">No hay productos que coincidan.</div>';
    return;
  }

  const consumedMap = (state.selectedEmployee && state.selectedEmployee.weekly_consumed_by_product) || {};

  filtered.forEach(prod => {
    const chip = document.createElement('div');
    chip.className = 'product-quick-chip';

    let chipLimitBadge = '';
    if (prod.weekly_limit_per_employee > 0 && state.selectedEmployee) {
      const consumed = consumedMap[prod.id] || 0;
      const limit = prod.weekly_limit_per_employee;
      if (consumed >= limit) {
        chipLimitBadge = `<span style="font-size: 0.68rem; background: #fee2e2; color: #dc2626; padding: 1px 5px; border-radius: 4px; font-weight: 700;">Cupo agotado (${consumed}/${limit})</span>`;
      } else {
        chipLimitBadge = `<span style="font-size: 0.68rem; background: #fef3c7; color: #b45309; padding: 1px 5px; border-radius: 4px;">Cupo: ${consumed}/${limit}</span>`;
      }
    }

    chip.innerHTML = `
      <div class="chip-title" title="${escapeHtml(prod.name)}">${escapeHtml(prod.name)}</div>
      <div class="chip-barcode">🏷️ ${escapeHtml(prod.barcode)} ${chipLimitBadge}</div>
      <div class="chip-footer">
        <span class="chip-price">$${parseFloat(prod.price).toFixed(2)}</span>
        <span class="chip-stock">${prod.stock > 0 ? `${prod.stock} disp.` : 'Agotado'}</span>
      </div>
    `;
    chip.addEventListener('click', () => {
      addProductToCart(prod);
    });
    container.appendChild(chip);
  });
}

// ============================================================================
// BÚSQUEDA Y AUTOCOMPLETADO DE TRABAJADOR
// ============================================================================
function setupWorkerSearch() {
  const input = document.getElementById('worker-search-input');
  const dropdown = document.getElementById('worker-autocomplete-list');
  const btnClear = document.getElementById('btn-clear-worker');

  if (!input || !dropdown) return;

  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim().toLowerCase();

    if (btnClear) btnClear.classList.toggle('hidden', !query);

    if (!query || query.length < 1) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(() => {
      const cleanQuery = query.replace(/[^0-9a-z]/gi, '');
      const matches = state.employees.filter(emp => {
        const full = (emp.full_name || emp.username || '').toLowerCase();
        const num = (emp.employee_number || '').toLowerCase();
        const cleanNum = num.replace(/[^0-9a-z]/gi, '');
        const doc = (emp.id_number || emp.identity_document || (emp.user && emp.user.identity_document) || (emp.user && emp.user.username ? emp.user.username : '')).toLowerCase();
        const cleanDoc = doc.replace(/[^0-9a-z]/gi, '');
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();

        return full.includes(query) ||
               num.includes(query) ||
               (cleanQuery && cleanNum.includes(cleanQuery)) ||
               doc.includes(query) ||
               (cleanQuery && cleanDoc.includes(cleanQuery)) ||
               dept.includes(query) ||
               pos.includes(query);
      });

      if (matches.length === 0) {
        dropdown.innerHTML = '<div class="worker-suggest-item" style="color: #64748b; cursor: default;">No se encontraron trabajadores</div>';
      } else {
        dropdown.innerHTML = matches.slice(0, 8).map(emp => {
          const docStr = emp.id_number || emp.identity_document || (emp.user && emp.user.identity_document) || 'S/D';
          return `
            <div class="worker-suggest-item" data-employee-id="${emp.id}">
              <div>
                <div class="item-title">${escapeHtml(emp.full_name || emp.username)}</div>
                <div class="item-sub">Ficha: <strong>${escapeHtml(emp.employee_number || 'S/N')}</strong> • C.I: <strong>${escapeHtml(docStr)}</strong> • ${escapeHtml(emp.department || 'General')}</div>
              </div>
              <div class="item-debt" title="Deuda actual">
                $${parseFloat(emp.current_debt || 0).toFixed(2)}
              </div>
            </div>
          `;
        }).join('');

        dropdown.querySelectorAll('.worker-suggest-item[data-employee-id]').forEach(el => {
          el.addEventListener('click', () => {
            const id = el.getAttribute('data-employee-id');
            selectWorker(id);
            dropdown.classList.add('hidden');
          });
        });
      }

      dropdown.classList.remove('hidden');
    }, 180);
  });

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      input.value = '';
      btnClear.classList.add('hidden');
      dropdown.classList.add('hidden');
      clearSelectedWorker();
    });
  }

  // Cerrar dropdown al hacer clic afuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.worker-search-box')) {
      dropdown.classList.add('hidden');
    }
  });
}

async function selectWorker(employeeId) {
  const liveCard = document.getElementById('employee-live-card');
  const badge = document.getElementById('employee-status-badge');
  const searchInput = document.getElementById('worker-search-input');

  if (!employeeId) {
    clearSelectedWorker();
    return;
  }

  try {
    badge.textContent = 'Consultando saldo...';
    badge.className = 'badge badge-info';

    const statement = await fetchEmployeeStatement(employeeId);
    state.selectedEmployee = {
      ...statement.employee,
      current_debt: statement.current_debt,
      has_overdue_debt: statement.has_overdue_debt,
      overdue_debt_amount: statement.overdue_debt_amount,
      cutoff_date: statement.cutoff_date,
      weekly_consumed_by_product: statement.weekly_consumed_by_product || {}
    };

    // Renderizar datos en tarjeta viva
    const emp = state.selectedEmployee;
    if (searchInput) searchInput.value = `${emp.employee_number} - ${emp.full_name}`;

    document.getElementById('emp-name').textContent = emp.full_name || emp.username;
    document.getElementById('emp-number').textContent = emp.employee_number || 'S/N';
    
    const docEl = document.getElementById('emp-doc');
    if (docEl) docEl.textContent = emp.id_number || emp.identity_document || (emp.user && emp.user.identity_document) || 'S/D';

    const birthEl = document.getElementById('emp-birth');
    if (birthEl) {
      if (emp.birth_date) {
        const [by, bm, bd] = emp.birth_date.split('-');
        const today = new Date();
        let age = today.getFullYear() - Number(by);
        const mDiff = today.getMonth() - (Number(bm) - 1);
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < Number(bd))) age--;
        birthEl.textContent = `${bd}/${bm}/${by} (${age}a)`;
      } else {
        birthEl.textContent = 'No reg.';
      }
    }

    document.getElementById('emp-position-dept').textContent = `${emp.position || 'Empleado'} / ${emp.department || 'General'}`;
    document.getElementById('emp-salary').textContent = `$${parseFloat(emp.salary || 0).toFixed(2)}`;

    const debtUsd = parseFloat(emp.current_debt || 0);
    const debtVes = debtUsd * state.exchangeRate;
    document.getElementById('emp-debt').textContent = `$${debtUsd.toFixed(2)}`;
    document.getElementById('emp-debt-ves').textContent = `Bs. ${debtVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Foto / Iniciales
    const initials = (emp.full_name || emp.username || 'TR')
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    
    const avatarBox = document.querySelector('.worker-avatar-box');
    if (avatarBox) {
      if (emp.photo) {
        avatarBox.innerHTML = `<img src="${escapeHtml(resolveImageUrl(emp.photo))}" alt="${escapeHtml(emp.full_name)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      } else {
        avatarBox.innerHTML = `<span id="worker-initials">${initials}</span>`;
      }
    }

    // Alerta de mora/deuda atrasada
    const overdueAlert = document.getElementById('emp-overdue-alert');
    const overdueDesc = document.getElementById('overdue-desc');
    if (emp.has_overdue_debt) {
      overdueAlert.classList.remove('hidden');
      overdueDesc.textContent = `Posee $${parseFloat(emp.overdue_debt_amount).toFixed(2)} acumulados de semanas anteriores al corte del ${emp.cutoff_date}.`;
      badge.textContent = '⚠️ Deuda Previa Detectada';
      badge.className = 'badge badge-warning';
    } else {
      overdueAlert.classList.add('hidden');
      badge.textContent = '✅ Al Día';
      badge.className = 'badge badge-success';
    }

    liveCard.classList.remove('hidden');

    // Recalcular límites y actualizar vistas reactivas
    checkWeeklyLimits();
    renderCart();
    renderProductSuggestions(document.getElementById('barcode-input')?.value || '');
    renderProductChips(document.getElementById('quick-filter-chips')?.value || '');

    updateCheckoutButtonState();
    focusBarcodeInput();

  } catch (err) {
    console.error('Error al obtener estado del trabajador:', err);
    showToast('error', 'Error al consultar empleado', err.message || 'No se pudo cargar la información financiera.');
  }
}

function clearSelectedWorker() {
  state.selectedEmployee = null;
  const liveCard = document.getElementById('employee-live-card');
  const badge = document.getElementById('employee-status-badge');
  const avatarBox = document.querySelector('.worker-avatar-box');
  if (avatarBox) {
    avatarBox.innerHTML = '<span id="worker-initials">--</span>';
  }
  if (liveCard) liveCard.classList.add('hidden');
  if (badge) {
    badge.textContent = 'Selecciona un trabajador';
    badge.className = 'badge badge-info';
  }

  // Recalcular límites y actualizar vistas reactivas
  checkWeeklyLimits();
  renderCart();
  renderProductSuggestions(document.getElementById('barcode-input')?.value || '');
  renderProductChips(document.getElementById('quick-filter-chips')?.value || '');

  updateCheckoutButtonState();
}

// ============================================================================
// CAPTURA RÁPIDA DE PRODUCTOS (INPUT SELECT INTEGRADO & SCANNER)
// ============================================================================
function setupProductCapture() {
  const barcodeInput = document.getElementById('barcode-input');
  const btnAdd = document.getElementById('btn-add-by-code');
  const btnClear = document.getElementById('btn-clear-barcode');
  const btnToggle = document.getElementById('btn-toggle-product-dropdown');
  const dropdown = document.getElementById('product-suggestions-list');
  const chipsFilter = document.getElementById('quick-filter-chips');

  let activeIndex = -1;

  function openDropdown() {
    if (!dropdown) return;
    renderProductSuggestions(barcodeInput ? barcodeInput.value : '');
    dropdown.classList.remove('hidden');
    if (btnToggle) btnToggle.classList.add('is-open');
    if (barcodeInput) barcodeInput.setAttribute('aria-expanded', 'true');
    activeIndex = -1;
  }

  function closeDropdown() {
    if (!dropdown) return;
    dropdown.classList.add('hidden');
    if (btnToggle) btnToggle.classList.remove('is-open');
    if (barcodeInput) barcodeInput.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  }

  function toggleDropdown() {
    if (dropdown && !dropdown.classList.contains('hidden')) {
      closeDropdown();
    } else {
      openDropdown();
      if (barcodeInput) barcodeInput.focus();
    }
  }

  // 1. Botón flecha para alternar el catálogo desplegable
  if (btnToggle) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  // 2. Abrir al hacer focus o clic en el input de búsqueda
  if (barcodeInput) {
    barcodeInput.addEventListener('focus', () => {
      openDropdown();
    });

    barcodeInput.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown && dropdown.classList.contains('hidden')) {
        openDropdown();
      }
    });

    // Filtrado reactivo en tiempo real al escribir código o nombre
    let remoteSearchDebounce = null;

    barcodeInput.addEventListener('input', () => {
      const val = barcodeInput.value;
      if (btnClear) {
        if (val.length > 0) btnClear.classList.remove('hidden');
        else btnClear.classList.add('hidden');
      }

      renderProductSuggestions(val);
      renderProductChips(val);
      openDropdown();

      clearTimeout(remoteSearchDebounce);
      const term = val.toLowerCase().trim();
      if (term.length >= 2) {
        const hasLocalMatches = state.products.some(p => 
          p.name.toLowerCase().includes(term) || 
          (p.barcode && p.barcode.toLowerCase().includes(term))
        );
        if (!hasLocalMatches) {
          remoteSearchDebounce = setTimeout(async () => {
            try {
              const remoteResults = await fetchProducts({ search: term });
              if (Array.isArray(remoteResults) && remoteResults.length > 0) {
                remoteResults.forEach(rp => {
                  if (!state.products.some(p => p.id === rp.id)) {
                    state.products.push(rp);
                  }
                });
                renderProductSuggestions(barcodeInput.value);
                renderProductChips(barcodeInput.value);
              } else {
                const emptyBox = dropdown.querySelector('.empty-suggest-box span');
                if (emptyBox) {
                  emptyBox.innerHTML = `No existe ningún artículo registrado con "<strong>${escapeHtml(term)}</strong>".`;
                }
              }
            } catch (err) {
              console.warn('Búsqueda remota automática falló:', err);
            }
          }, 250);
        }
      }
    });

    // Navegación por teclado
    barcodeInput.addEventListener('keydown', async (e) => {
      if (!dropdown) return;

      const items = dropdown.querySelectorAll('.product-suggest-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (dropdown.classList.contains('hidden')) {
          openDropdown();
          return;
        }
        if (items.length > 0) {
          activeIndex = (activeIndex + 1) % items.length;
          updateActiveItem(items, activeIndex);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (dropdown.classList.contains('hidden')) {
          openDropdown();
          return;
        }
        if (items.length > 0) {
          activeIndex = (activeIndex - 1 + items.length) % items.length;
          updateActiveItem(items, activeIndex);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const code = barcodeInput.value.trim();

        if (activeIndex >= 0 && items[activeIndex]) {
          const prodId = parseInt(items[activeIndex].getAttribute('data-product-id'), 10);
          const product = state.products.find(p => p.id === prodId);
          if (product) {
            addProductToCart(product);
            barcodeInput.value = '';
            if (btnClear) btnClear.classList.add('hidden');
            closeDropdown();
            focusBarcodeInput();
            return;
          }
        }

        if (code) {
          await handleBarcodeEntry(code);
          closeDropdown();
        }
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });
  }

  function updateActiveItem(items, index) {
    items.forEach((it, i) => {
      if (i === index) {
        it.classList.add('is-selected');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('is-selected');
      }
    });
  }

  // 3. Botón de limpiar input
  if (btnClear) {
    btnClear.addEventListener('click', (e) => {
      e.stopPropagation();
      if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
      }
      btnClear.classList.add('hidden');
      openDropdown();
    });
  }

  // 4. Botón "Añadir"
  if (btnAdd) {
    btnAdd.addEventListener('click', async () => {
      const code = barcodeInput?.value.trim();
      if (code) {
        await handleBarcodeEntry(code);
        closeDropdown();
      } else {
        openDropdown();
      }
    });
  }

  // 5. Cerrar al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#product-combobox-container')) {
      closeDropdown();
    }
  });

  // 6. Filtrar botones de productos frecuentes
  if (chipsFilter) {
    chipsFilter.addEventListener('input', () => {
      renderProductChips(chipsFilter.value);
    });
  }
}

async function handleBarcodeEntry(query) {
  const barcodeInput = document.getElementById('barcode-input');
  const btnClear = document.getElementById('btn-clear-barcode');

  const term = query.toLowerCase().trim();

  // 1. Buscar coincidencia exacta por barcode o nombre en memoria local
  let found = state.products.find(p => 
    (p.barcode && p.barcode.toLowerCase() === term) ||
    p.name.toLowerCase() === term
  );

  // 2. Si no es exacto, buscar por inclusión de texto
  if (!found) {
    found = state.products.find(p => 
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      p.name.toLowerCase().includes(term)
    );
  }

  // 3. Si no se encuentra localmente, consultar API backend
  if (!found) {
    try {
      found = await fetchProductByBarcode(query);
    } catch (err) {
      console.warn('Búsqueda remota falló:', err);
    }
  }

  if (found) {
    addProductToCart(found);
    if (barcodeInput) barcodeInput.value = '';
    if (btnClear) btnClear.classList.add('hidden');
  } else {
    showToast('warning', 'Producto no encontrado', `No se encontró ningún artículo con código o nombre "${query}".`);
  }

  focusBarcodeInput();
}

// ============================================================================
// GRILLA DE DESPACHO EN VIVO (CARRITO)
// ============================================================================
function addProductToCart(product) {
  if (product.stock <= 0) {
    showToast('error', 'Sin existencias', `El producto "${product.name}" no tiene stock físico disponible.`);
    return;
  }

  const existing = state.cart.find(item => item.product.id === product.id);
  const currentInCart = existing ? existing.quantity : 0;
  const weeklyLimit = product.weekly_limit_per_employee || 0;
  const consumedMap = (state.selectedEmployee && state.selectedEmployee.weekly_consumed_by_product) || {};
  const alreadyConsumed = consumedMap[product.id] || 0;

  // Validación y bloqueo estricto de límite semanal por empleado en mostrador POS
  if (state.selectedEmployee && weeklyLimit > 0) {
    if (alreadyConsumed >= weeklyLimit) {
      showToast(
        'error',
        'Límite Semanal Agotado',
        `El trabajador ya consumió todo su cupo de "${product.name}" (${alreadyConsumed}/${weeklyLimit} unidades en los últimos 7 días). No se permite despachar más en punto de venta.`
      );
      return;
    } else if (currentInCart + 1 > (weeklyLimit - alreadyConsumed)) {
      const remaining = Math.max(0, weeklyLimit - alreadyConsumed);
      showToast(
        'error',
        'Límite Semanal Excedido',
        `El trabajador ya adquirió ${alreadyConsumed} unidades esta semana. Solo puede agregar ${remaining} más (Límite: ${weeklyLimit}/sem).`
      );
      return;
    }
  }

  if (existing) {
    if (existing.quantity + 1 > product.stock) {
      showToast('warning', 'Stock máximo', `Solo hay ${product.stock} unidades disponibles en almacén.`);
      return;
    }
    existing.quantity += 1;
    existing.subtotal = existing.quantity * parseFloat(product.price);
  } else {
    state.cart.push({
      product,
      quantity: 1,
      subtotal: parseFloat(product.price),
      isLimitExceeded: false,
      alreadyConsumed: 0
    });
  }

  // Validar límites semanales y actualizar vista
  checkWeeklyLimits();
  renderCart();
  showToast('info', 'Producto añadido', `${product.name} añadido a la orden.`);
}

function updateCartQuantity(productId, delta) {
  const item = state.cart.find(i => i.product.id === productId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeCartItem(productId);
    return;
  }

  if (newQty > item.product.stock) {
    showToast('warning', 'Stock insuficiente', `Solo hay ${item.product.stock} unidades en existencia.`);
    return;
  }

  // Bloqueo estricto si se supera el límite semanal al incrementar cantidad en mostrador POS
  if (delta > 0 && state.selectedEmployee) {
    const weeklyLimit = item.product.weekly_limit_per_employee || 0;
    const consumedMap = state.selectedEmployee.weekly_consumed_by_product || {};
    const alreadyConsumed = consumedMap[item.product.id] || 0;
    if (weeklyLimit > 0 && (newQty + alreadyConsumed) > weeklyLimit) {
      const remaining = Math.max(0, weeklyLimit - alreadyConsumed);
      showToast(
        'error',
        'Límite Semanal Excedido',
        `No es posible aumentar la cantidad: el límite semanal para "${item.product.name}" es de ${weeklyLimit} unidades (ya consumió ${alreadyConsumed}, cupo restante: ${remaining}).`
      );
      return;
    }
  }

  item.quantity = newQty;
  item.subtotal = item.quantity * parseFloat(item.product.price);
  checkWeeklyLimits();
  renderCart();
}

function removeCartItem(productId) {
  state.cart = state.cart.filter(i => i.product.id !== productId);
  checkWeeklyLimits();
  renderCart();
}

function clearCart() {
  state.cart = [];
  renderCart();
}

/**
 * Comprueba el límite semanal por empleado para cada ítem en la canasta,
 * tomando en cuenta el consumo registrado en los últimos 7 días.
 */
function checkWeeklyLimits() {
  const consumedMap = (state.selectedEmployee && state.selectedEmployee.weekly_consumed_by_product) || {};

  state.cart.forEach(item => {
    const limit = item.product.weekly_limit_per_employee || 0;
    const alreadyConsumed = consumedMap[item.product.id] || 0;
    item.alreadyConsumed = alreadyConsumed;
    item.isLimitExceeded = (state.selectedEmployee && limit > 0 && (item.quantity + alreadyConsumed) > limit);
  });
}

function renderCart() {
  const table = document.getElementById('dispatch-table');
  const tbody = document.getElementById('dispatch-table-body');
  const emptyState = document.getElementById('empty-cart-state');
  const totalItemsEl = document.getElementById('cart-total-items');
  const totalUsdEl = document.getElementById('cart-total-usd');
  const totalVesEl = document.getElementById('cart-total-ves');

  if (state.cart.length === 0) {
    if (table) table.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (totalItemsEl) totalItemsEl.textContent = '0 unidades';
    if (totalUsdEl) totalUsdEl.textContent = '$0.00';
    if (totalVesEl) totalVesEl.textContent = 'Bs. 0.00';
    updateCheckoutButtonState();
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (table) table.classList.remove('hidden');
  tbody.innerHTML = '';

  let totalItems = 0;
  let totalUsd = 0;

  state.cart.forEach(item => {
    totalItems += item.quantity;
    totalUsd += item.subtotal;

    const rowClass = item.isLimitExceeded ? 'dispatch-row quota-exceeded-row' : 'dispatch-row';
    const limitBadge = item.isLimitExceeded ? `
      <div class="quota-warning-badge" title="Límite semanal por trabajador excedido" style="margin-top: 4px; font-size: 0.73rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px;">
        ⚠️ Límite semanal excedido: Lleva ${item.quantity} en orden + ${item.alreadyConsumed} consumidas en 7 días (Límite: ${item.product.weekly_limit_per_employee}/sem)
      </div>
    ` : '';

    const imgUrl = item.product.image ? resolveImageUrl(item.product.image) : null;
    const thumbMarkup = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.product.name)}" class="dispatch-product-thumb" onerror="this.onerror=null;this.parentElement.innerHTML='📦';">`
      : `<div class="product-mini-thumb" style="display: flex; align-items: center; justify-content: center; font-size: 1.1rem; background: #e0f2fe; color: #0284c7;">📦</div>`;

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.innerHTML = `
      <td>
        <div class="table-product-cell">
          <div class="dispatch-thumb-box">
            ${thumbMarkup}
          </div>
          <div class="product-table-info">
            <span class="product-table-name">${escapeHtml(item.product.name)}</span>
            <span class="product-table-code">Código: ${escapeHtml(item.product.barcode || 'S/C')}</span>
            ${limitBadge}
          </div>
        </div>
      </td>
      <td>
        <strong>$${parseFloat(item.product.price).toFixed(2)}</strong>
      </td>
      <td style="text-align: center;">
        <div class="qty-stepper-box">
          <button type="button" class="btn-stepper btn-minus" data-id="${item.product.id}">-</button>
          <span class="stepper-value">${item.quantity}</span>
          <button type="button" class="btn-stepper btn-plus" data-id="${item.product.id}">+</button>
        </div>
      </td>
      <td style="text-align: right;">
        <strong style="color: var(--primary); font-size: 0.95rem;">$${item.subtotal.toFixed(2)}</strong>
      </td>
      <td style="text-align: center;">
        <button type="button" class="btn-remove-line" data-id="${item.product.id}" title="Remover de la orden">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Vincular eventos a los controles de cantidad
  tbody.querySelectorAll('.btn-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      updateCartQuantity(id, -1);
    });
  });

  tbody.querySelectorAll('.btn-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      updateCartQuantity(id, 1);
    });
  });

  tbody.querySelectorAll('.btn-remove-line').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      removeCartItem(id);
    });
  });

  // Totales
  const totalVes = totalUsd * state.exchangeRate;
  if (totalItemsEl) totalItemsEl.textContent = `${totalItems} ${totalItems === 1 ? 'unidad' : 'unidades'}`;
  if (totalUsdEl) totalUsdEl.textContent = `$${totalUsd.toFixed(2)}`;
  if (totalVesEl) totalVesEl.textContent = `Bs. ${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  updateCheckoutButtonState();
}

function updateCheckoutButtonState() {
  const btn = document.getElementById('btn-checkout');
  if (!btn) return;

  const hasItems = state.cart.length > 0;
  const hasWorker = !!state.selectedEmployee;
  const hasLimitExceeded = state.cart.some(item => item.isLimitExceeded);

  btn.disabled = (!hasItems || !hasWorker || state.isProcessing || hasLimitExceeded);

  if (hasLimitExceeded) {
    btn.title = 'No se puede procesar: Uno o más productos superan el límite semanal permitido.';
  } else {
    btn.title = '';
  }
}

// ============================================================================
// PROCESAMIENTO DE ENTREGA INMEDIATA (CHECKOUT ATÓMICO)
// ============================================================================
async function processImmediateDelivery() {
  if (state.isProcessing) return;
  if (!state.selectedEmployee) {
    showToast('warning', 'Selecciona trabajador', 'Debes identificar al trabajador antes de procesar la entrega.');
    return;
  }

  if (state.cart.length === 0) {
    showToast('warning', 'Canasta vacía', 'Agrega al menos un producto a la lista de despacho.');
    return;
  }

  // Pre-validación de stock suficiente en frontend antes de enviar
  for (const item of state.cart) {
    if (item.quantity > item.product.stock) {
      showToast('error', 'Stock insuficiente', `No hay suficiente existencia de "${item.product.name}" (solicitado: ${item.quantity}, disponible: ${item.product.stock}).`);
      return;
    }
  }

  // Validación estricta de límites semanales: NO PERMITIR enviar la petición si se excede el límite
  checkWeeklyLimits();
  const exceededItem = state.cart.find(item => item.isLimitExceeded);
  if (exceededItem) {
    const limit = exceededItem.product.weekly_limit_per_employee;
    const consumed = exceededItem.alreadyConsumed || 0;
    showToast(
      'error',
      'Límite Semanal Excedido',
      `No se puede procesar la entrega: "${exceededItem.product.name}" excede el límite semanal permitido (${exceededItem.quantity} en orden + ${consumed} consumidas en 7 días, límite: ${limit}/sem).`
    );
    updateCheckoutButtonState();
    return;
  }

  const btn = document.getElementById('btn-checkout');
  const overrideCheck = document.getElementById('admin-override-check');
  const notesInput = document.getElementById('order-notes');

  state.isProcessing = true;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Procesando entrega en almacén...</span>';
  }

  const payload = {
    employee_id: state.selectedEmployee.id,
    items: state.cart.map(item => ({
      barcode: item.product.barcode,
      product_id: item.product.id,
      quantity: item.quantity
    })),
    status: 'DELIVERED',
    notes: notesInput?.value.trim() || 'Despacho presencial en bodega',
    is_admin_override: false // En Punto de Venta POS de mostrador no se omite el límite semanal
  };

  showLoadingOverlay({
    title: 'Procesando Entrega Inmediata...',
    message: 'Generando orden de consumo, actualizando saldo y rebajando stock...',
    estimatedDuration: 1300
  });

  try {
    const createdOrder = await createInternalOrder(payload);
    await hideLoadingOverlay(true);

    showToast('success', '¡Entrega Procesada!', `Orden #${createdOrder.order_number} registrada y cargada a nómina.`);

    // Desplegar modal con ticket para imprimir
    showReceiptModal(createdOrder);

    // Limpiar carrito
    state.cart = [];
    if (notesInput) notesInput.value = '';
    renderCart();

    // Actualizar catálogo y productos en memoria para refrescar stock en tiempo real
    await loadProducts();

    // Actualizar estado del trabajador (saldo y consumos)
    if (state.selectedEmployee) {
      await selectWorker(state.selectedEmployee.id);
    }

  } catch (err) {
    await hideLoadingOverlay(false);
    console.error('Error al procesar orden:', err);
    let msg = 'Error al conectar con la proveeduría.';
    if (err.data) {
      if (typeof err.data === 'string') {
        msg = err.data;
      } else if (err.data.detail) {
        msg = err.data.detail;
      } else if (err.data.error) {
        msg = err.data.error;
      } else if (err.data.non_field_errors) {
        msg = Array.isArray(err.data.non_field_errors) ? err.data.non_field_errors.join(' ') : err.data.non_field_errors;
      } else if (err.data.items) {
        const itemErrors = Array.isArray(err.data.items) 
          ? err.data.items.map(it => typeof it === 'string' ? it : Object.values(it).flat().join(' ')).filter(Boolean).join('; ') 
          : JSON.stringify(err.data.items);
        msg = `Error de stock o artículo: ${itemErrors}`;
      } else {
        msg = Object.entries(err.data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
      }
    } else if (err.message) {
      msg = err.message;
    }
    showToast('error', 'No se pudo despachar', msg);
  } finally {
    state.isProcessing = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Procesar Entrega Inmediata</span>
      `;
      updateCheckoutButtonState();
    }
  }
}

// ============================================================================
// MODAL DE COMPROBANTE / TICKET
// ============================================================================
function showReceiptModal(order) {
  const modal = document.getElementById('receipt-modal');
  const content = document.getElementById('receipt-content');
  if (!modal || !content) return;

  const totalUsd = parseFloat(order.total_amount || 0);
  const totalVes = totalUsd * state.exchangeRate;

  content.innerHTML = `
    <div class="receipt-paper" id="printable-receipt">
      <div class="receipt-paper-header">
        <h4>TUESTANTE - PROVEEDURÍA INTERNA</h4>
        <p style="margin: 2px 0;">COMPROBANTE DE CONSUMO A NÓMINA</p>
        <p style="font-size: 0.75rem; color: #475569;">Orden: #${escapeHtml(order.order_number)} • ${new Date().toLocaleString('es-VE')}</p>
      </div>

      <div style="margin-bottom: 10px; font-size: 0.8rem;">
        <div><strong>Trabajador:</strong> ${escapeHtml(order.employee_name || state.selectedEmployee?.full_name)}</div>
        <div><strong>Ficha:</strong> ${escapeHtml(order.employee_number || state.selectedEmployee?.employee_number)}</div>
      </div>

      <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px;">
        ${(order.items || []).map(it => `
          <div class="receipt-item-row">
            <span>${it.quantity}x ${escapeHtml(it.product_name)}</span>
            <strong>$${parseFloat(it.subtotal).toFixed(2)}</strong>
          </div>
        `).join('')}
      </div>

      <div class="receipt-total-bar">
        <span>TOTAL CARGADO A NÓMINA:</span>
        <span style="color: #005187;">$${totalUsd.toFixed(2)}</span>
      </div>
      <div style="text-align: right; font-size: 0.78rem; color: #64748b;">
        Equivalente: Bs. ${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>

      <div style="margin-top: 25px; border-top: 1px solid #94a3b8; padding-top: 4px; text-align: center; font-size: 0.75rem;">
        Firma del Trabajador (Conforme Entrega)
      </div>
    </div>
  `;

  modal.classList.add('is-open');
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  if (modal) modal.classList.remove('is-open');
  focusBarcodeInput();
}

// ============================================================================
// CONFIGURACIÓN DE EVENTOS GENERALES
// ============================================================================
function setupEventListeners() {
  setupWorkerSearch();
  setupProductCapture();

  // Vaciar carrito
  const btnClearCart = document.getElementById('btn-clear-cart');
  if (btnClearCart) {
    btnClearCart.addEventListener('click', async () => {
      if (state.cart.length > 0) {
        const confirmed = typeof window.showConfirmModal === 'function'
          ? await window.showConfirmModal({
              title: 'Vaciar Canasta',
              message: '¿Deseas vaciar la canasta de despacho actual?',
              confirmText: 'Vaciar',
              cancelText: 'Cancelar',
              type: 'warning'
            })
          : confirm('¿Deseas vaciar la canasta de despacho actual?');
        if (confirmed) {
          clearCart();
        }
      }
    });
  }

  // Botón Procesar Entrega Inmediata
  const btnCheckout = document.getElementById('btn-checkout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', processImmediateDelivery);
  }

  // Modal de Comprobante
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnNewSale = document.getElementById('btn-new-sale');
  const btnPrintReceipt = document.getElementById('btn-print-receipt');

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeReceiptModal);
  if (btnNewSale) btnNewSale.addEventListener('click', closeReceiptModal);

  if (btnPrintReceipt) {
    btnPrintReceipt.addEventListener('click', () => {
      window.print();
    });
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================
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
      <div class="toast-title" style="font-weight: 700; margin-bottom: 2px;">${escapeHtml(title)}</div>
      <div class="toast-message" style="font-size: 0.82rem;">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}
