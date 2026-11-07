/**
 * internal-products.js
 * Catálogo e Inventario de Productos Internos - TuEstante Admin
 * Incluye:
 * - Tabla reactiva con filtros de categoría, subcategoría y búsqueda
 * - Modal de Edición Rápida (Quick Edit) con stepper de stock y precio
 * - Formulario Completo de Producto con modales anidados de Categoría y Subcategoría
 * - Conversión de moneda dinámica con tasa oficial BCV
 */

import {
  fetchProducts,
  fetchProduct,
  createProduct,
  updateProduct,
  quickUpdateProduct,
  deleteProduct,
  fetchCategories,
  createCategory,
  fetchSubCategories,
  createSubCategory
} from './employee-store.api.js';

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { getBcvRate } from '../../js/service/exchange-rate.service.js';
import { showConfirmModal } from '../../components/modal/modal.js';

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
let currentExchangeRate = 80.00; // Tasa por defecto
let productsList = [];
let categoriesList = [];
let subcategoriesList = [];

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminComponents({ title: 'Inventario Tienda Empleados' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load warning:', err);
  }

  await loadExchangeRate();
  setupEventListeners();
  await loadCategoriesAndSubcategories();
  await loadProducts();
});

// ============================================================================
// TASA DE CAMBIO BCV
// ============================================================================
async function loadExchangeRate() {
  try {
    const rate = await getBcvRate();
    if (rate && !isNaN(rate) && rate > 0) {
      currentExchangeRate = parseFloat(rate);
    }
  } catch (err) {
    console.warn('No se pudo obtener tasa BCV, usando fallback:', currentExchangeRate, err);
  }
  const badgeVal = document.getElementById('navbar-exchange-val');
  if (badgeVal) {
    badgeVal.textContent = `Bs. ${currentExchangeRate.toFixed(2)}`;
  }
}

// ============================================================================
// CARGA DE CATEGORÍAS Y SUBCATEGORÍAS
// ============================================================================
async function loadCategoriesAndSubcategories() {
  try {
    const [cats, subcats] = await Promise.all([
      fetchCategories(),
      fetchSubCategories()
    ]);
    categoriesList = Array.isArray(cats) ? cats : (cats.results || []);
    subcategoriesList = Array.isArray(subcats) ? subcats : (subcats.results || []);

    populateCategorySelectors();
  } catch (err) {
    console.error('Error cargando categorías:', err);
    showToast('Error al sincronizar categorías', 'error');
  }
}

function populateCategorySelectors() {
  // 1. Selector de filtro
  const filterCat = document.getElementById('filter-category');
  if (filterCat) {
    const currentVal = filterCat.value;
    filterCat.innerHTML = '<option value="all">Todas las categorías</option>';
    categoriesList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      filterCat.appendChild(opt);
    });
    filterCat.value = currentVal || 'all';
  }

  // 2. Selector en formulario de producto
  const formCat = document.getElementById('product-category-select');
  if (formCat) {
    const currentVal = formCat.value;
    formCat.innerHTML = '<option value="">-- Seleccionar Categoría --</option>';
    categoriesList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      formCat.appendChild(opt);
    });
    if (currentVal) formCat.value = currentVal;
  }

  // 3. Selector de categoría padre en modal anidado de subcategoría
  const nestedParent = document.getElementById('nested-subcat-parent');
  if (nestedParent) {
    nestedParent.innerHTML = '<option value="">-- Seleccionar Categoría --</option>';
    categoriesList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      nestedParent.appendChild(opt);
    });
  }

  updateSubcategorySelects();
}

function updateSubcategorySelects() {
  // 1. Filtro superior
  const filterSubcat = document.getElementById('filter-subcategory');
  const filterCat = document.getElementById('filter-category');
  const selectedCatId = filterCat ? filterCat.value : 'all';

  if (filterSubcat) {
    const currentSubVal = filterSubcat.value;
    filterSubcat.innerHTML = '<option value="all">Todas las subcategorías</option>';
    const filteredSubs = selectedCatId === 'all'
      ? subcategoriesList
      : subcategoriesList.filter(s => String(s.category) === String(selectedCatId) || String(s.category_id) === String(selectedCatId) || (s.category && String(s.category.id) === String(selectedCatId)));

    filteredSubs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      filterSubcat.appendChild(opt);
    });
    filterSubcat.value = currentSubVal || 'all';
  }

  // 2. En formulario de producto
  const formCat = document.getElementById('product-category-select');
  const formSubcat = document.getElementById('product-subcategory-select');
  if (formSubcat && formCat) {
    const currentFormSub = formSubcat.value;
    const catVal = formCat.value;
    formSubcat.innerHTML = '<option value="">-- Seleccionar Subcategoría --</option>';

    const filtered = !catVal
      ? subcategoriesList
      : subcategoriesList.filter(s => String(s.category) === String(catVal) || String(s.category_id) === String(catVal) || (s.category && String(s.category.id) === String(catVal)));

    filtered.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      formSubcat.appendChild(opt);
    });
    if (currentFormSub) formSubcat.value = currentFormSub;
  }
}

// ============================================================================
// CARGA Y RENDER DE PRODUCTOS
// ============================================================================
async function loadProducts() {
  const tbody = document.getElementById('inventory-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: #64748b;">
          Cargando inventario de la proveeduría...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetchProducts();
    productsList = Array.isArray(res) ? res : (res.results || []);
    renderProductsTable();
  } catch (err) {
    console.error('Error cargando productos:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: #dc2626;">
            Error al cargar inventario. Por favor reintenta.
          </td>
        </tr>
      `;
    }
    showToast('No se pudo cargar la lista de productos', 'error');
  }
}

function updateKpiCards() {
  const totalProds = productsList.length;
  const totalStock = productsList.reduce((acc, p) => acc + (parseInt(p.stock, 10) || 0), 0);
  const lowStock = productsList.filter(p => (parseInt(p.stock, 10) || 0) <= 5).length;

  const kpiProdsEl = document.getElementById('kpi-total-products');
  const kpiStockEl = document.getElementById('kpi-total-stock');
  const kpiLowEl = document.getElementById('kpi-low-stock');
  if (kpiProdsEl) kpiProdsEl.textContent = totalProds;
  if (kpiStockEl) kpiStockEl.textContent = `${totalStock} unids`;
  if (kpiLowEl) kpiLowEl.textContent = lowStock;
}

function renderProductsTable() {
  updateKpiCards();

  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const searchVal = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const filterCat = document.getElementById('filter-category')?.value || 'all';
  const filterSubcat = document.getElementById('filter-subcategory')?.value || 'all';
  const onlyActive = document.getElementById('filter-only-active')?.checked ?? true;

  const filtered = productsList.filter(p => {
    // Filtro activo
    if (onlyActive && !p.is_active) return false;

    // Filtro búsqueda
    if (searchVal) {
      const name = (p.name || '').toLowerCase();
      const code = (p.barcode || '').toLowerCase();
      if (!name.includes(searchVal) && !code.includes(searchVal)) return false;
    }

    // Filtro categoría
    if (filterCat !== 'all') {
      const pCatId = p.category?.id || p.category_id || p.category;
      if (String(pCatId) !== String(filterCat)) return false;
    }

    // Filtro subcategoría
    if (filterSubcat !== 'all') {
      const pSubcatId = p.subcategory?.id || p.subcategory_id || p.subcategory;
      if (String(pSubcatId) !== String(filterSubcat)) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: #64748b;">
          No se encontraron productos con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(product => {
    const priceUSD = parseFloat(product.price || 0);
    const priceVES = priceUSD * currentExchangeRate;

    // Categoría y subcategoría nombres
    let catName = 'Sin Categoría';
    if (product.category_name) catName = product.category_name;
    else if (product.category?.name) catName = product.category.name;
    else {
      const found = categoriesList.find(c => c.id === product.category || c.id === product.category_id);
      if (found) catName = found.name;
    }

    let subcatName = '';
    if (product.subcategory_name) subcatName = product.subcategory_name;
    else if (product.subcategory?.name) subcatName = product.subcategory.name;
    else {
      const found = subcategoriesList.find(s => s.id === product.subcategory || s.id === product.subcategory_id);
      if (found) subcatName = found.name;
    }

    // Stock Badge
    let stockClass = 'stock-in';
    if (product.stock <= 0) stockClass = 'stock-out';
    else if (product.stock <= 5) stockClass = 'stock-low';

    // Status Badge
    const statusPill = product.is_active
      ? '<span class="status-pill status-active">Activo</span>'
      : '<span class="status-pill status-inactive">Inactivo</span>';

    // Límite semanal
    const limitDisplay = product.weekly_limit_per_employee > 0
      ? `<span style="font-weight: 600; color: #005187;">${product.weekly_limit_per_employee} unid/sem</span>`
      : `<span style="color: #94a3b8;">Sin límite</span>`;

    // Imagen o Placeholder
    const hasImage = Boolean(product.image);
    const imageCell = hasImage
      ? `
        <div class="product-img-thumbnail-wrap" title="Clic para ver en pantalla completa" data-img-url="${escapeHtml(product.image)}" data-img-name="${escapeHtml(product.name)}">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="product-table-thumb" loading="lazy">
          <div class="thumb-zoom-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="zoom-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </div>
        </div>
      `
      : `
        <div class="product-img-thumbnail-wrap placeholder-wrap" title="Sin imagen asignada">
          <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
      `;

    return `
      <tr data-id="${product.id}">
        <td>
          ${imageCell}
        </td>
        <td>
          <span class="product-barcode-pill">${escapeHtml(product.barcode || 'S/C')}</span>
        </td>
        <td>
          <div class="product-title-cell">${escapeHtml(product.name)}</div>
          ${product.description ? `<div class="product-desc-sub" title="${escapeHtml(product.description)}">${escapeHtml(product.description)}</div>` : ''}
        </td>
        <td>
          <span class="cat-badge">${escapeHtml(catName)}</span>
          ${subcatName ? `<span class="subcat-badge">${escapeHtml(subcatName)}</span>` : ''}
        </td>
        <td>
          <div class="price-box">
            <span class="price-usd">$${priceUSD.toFixed(2)}</span>
            <span class="price-ves">Bs. ${priceVES.toFixed(2)}</span>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="stock-badge ${stockClass}">${product.stock} unids</span>
        </td>
        <td style="text-align: center;">
          ${limitDisplay}
        </td>
        <td style="text-align: center;">
          ${statusPill}
        </td>
        <td>
          <div class="row-actions">
            <!-- Botón Ajuste Rápido (Rayo SVG) -->
            <button 
              type="button" 
              class="btn-icon-action btn-quick-trigger" 
              data-id="${product.id}" 
              title="Ajuste rápido de Stock y Precio"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px;">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </button>
            <!-- Botón Editar Completo -->
            <button 
              type="button" 
              class="btn-icon-action btn-edit-trigger" 
              data-id="${product.id}" 
              title="Editar formulario completo"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <!-- Botón Eliminar -->
            <button 
              type="button" 
              class="btn-icon-action btn-delete-action" 
              data-id="${product.id}" 
              data-name="${escapeHtml(product.name)}"
              title="Eliminar producto"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachTableRowListeners();
}

function attachTableRowListeners() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  // 1. Lightbox de imágenes
  tbody.querySelectorAll('.product-img-thumbnail-wrap[data-img-url]').forEach(wrap => {
    wrap.addEventListener('click', () => {
      openLightbox(wrap.dataset.imgUrl, wrap.dataset.imgName);
    });
  });

  // 2. Botones de ajuste rápido (⚡)
  tbody.querySelectorAll('.btn-quick-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.id;
      openQuickEditModal(pid);
    });
  });

  // 3. Botones de edición completa
  tbody.querySelectorAll('.btn-edit-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.id;
      openFullProductModal(pid);
    });
  });

  // 4. Botones de eliminación con Modal de Confirmación
  tbody.querySelectorAll('.btn-delete-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.id;
      const pname = btn.dataset.name;
      const confirmed = await showConfirmModal({
        title: 'Eliminar Producto',
        message: `¿Estás seguro de que deseas eliminar el producto "${pname}"? Esta acción afectará el inventario del sistema.`,
        confirmText: 'Eliminar Producto',
        cancelText: 'Cancelar',
        type: 'danger'
      });
      if (confirmed) {
        await executeDeleteProduct(pid);
      }
    });
  });
}

function setupLightboxEvents() {
  const modal = document.getElementById('modal-image-lightbox');
  const closeBtn = document.getElementById('btn-close-lightbox');

  const closeLightbox = () => {
    if (modal) modal.classList.remove('is-active');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('lightbox-container') || e.target.classList.contains('lightbox-image-wrap')) {
        closeLightbox();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('is-active')) {
      closeLightbox();
    }
  });
}

function openLightbox(url, name) {
  const modal = document.getElementById('modal-image-lightbox');
  const fullImg = document.getElementById('lightbox-full-img');
  const caption = document.getElementById('lightbox-caption');
  if (!modal || !fullImg) return;

  fullImg.src = url;
  if (caption) caption.textContent = name || 'Producto';
  modal.classList.add('is-active');
}

// ============================================================================
// MODAL 1: EDICIÓN RÁPIDA (QUICK EDIT)
// ============================================================================
function openQuickEditModal(productId) {
  const product = productsList.find(p => String(p.id) === String(productId));
  if (!product) return;

  document.getElementById('quick-product-id').value = product.id;
  document.getElementById('quick-edit-product-name').textContent = product.name;
  document.getElementById('quick-barcode').value = product.barcode || '';
  document.getElementById('quick-stock').value = product.stock || 0;
  
  const priceInput = document.getElementById('quick-price');
  priceInput.value = parseFloat(product.price || 0).toFixed(2);
  updateQuickVesPreview();

  const modal = document.getElementById('modal-quick-edit');
  if (modal) modal.classList.add('is-active');
}

function closeQuickEditModal() {
  const modal = document.getElementById('modal-quick-edit');
  if (modal) modal.classList.remove('is-active');
  document.getElementById('form-quick-edit')?.reset();
}

function updateQuickVesPreview() {
  const price = parseFloat(document.getElementById('quick-price')?.value || 0);
  const vesPreview = document.getElementById('quick-ves-converted');
  if (vesPreview) {
    const ves = price * currentExchangeRate;
    vesPreview.textContent = `Equivalente: Bs. ${ves.toFixed(2)} (Tasa: ${currentExchangeRate.toFixed(2)})`;
  }
}

// ============================================================================
// MODAL 2: FORMULARIO COMPLETO DE PRODUCTO
// ============================================================================
function openFullProductModal(productId = null) {
  const title = document.getElementById('modal-product-title');
  const form = document.getElementById('form-full-product');
  form.reset();

  if (productId) {
    const product = productsList.find(p => String(p.id) === String(productId));
    if (!product) return;

    if (title) title.textContent = 'Editar Producto Interno';
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-barcode').value = product.barcode || '';
    document.getElementById('product-name').value = product.name || '';
    document.getElementById('product-price').value = parseFloat(product.price || 0).toFixed(2);
    document.getElementById('product-stock').value = product.stock || 0;
    document.getElementById('product-weekly-limit').value = product.weekly_limit_per_employee || 0;
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-is-active').checked = !!product.is_active;

    const catId = product.category?.id || product.category_id || product.category || '';
    document.getElementById('product-category-select').value = catId;
    updateSubcategorySelects();

    const subcatId = product.subcategory?.id || product.subcategory_id || product.subcategory || '';
    document.getElementById('product-subcategory-select').value = subcatId;

    // Previsualización de imagen si ya existe
    if (product.image) {
      setProductDropzonePreview(product.image, product.name || 'imagen_producto.jpg');
    } else {
      setProductDropzonePreview(null);
    }
  } else {
    if (title) title.textContent = 'Registrar Producto Interno';
    document.getElementById('product-id').value = '';
    document.getElementById('product-is-active').checked = true;
    document.getElementById('product-weekly-limit').value = '0';
    updateSubcategorySelects();
    setProductDropzonePreview(null);
  }

  const modal = document.getElementById('modal-full-product');
  if (modal) modal.classList.add('is-active');
}

function setProductDropzonePreview(imageUrl, fileName = 'imagen_producto.jpg') {
  const dropzone = document.getElementById('product-image-dropzone');
  const previewImg = document.getElementById('product-image-preview');
  const removeBtn = document.getElementById('btn-remove-product-image');
  const fileInput = document.getElementById('product-image');

  if (imageUrl) {
    if (previewImg) { previewImg.src = imageUrl; previewImg.classList.remove('hidden'); }
    if (removeBtn) removeBtn.classList.remove('hidden');
    if (dropzone) dropzone.classList.add('has-image');
  } else {
    if (fileInput) fileInput.value = '';
    if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
    if (removeBtn) removeBtn.classList.add('hidden');
    if (dropzone) dropzone.classList.remove('has-image');
  }
}

function closeFullProductModal() {
  const modal = document.getElementById('modal-full-product');
  if (modal) modal.classList.remove('is-active');
  document.getElementById('form-full-product')?.reset();
  setProductDropzonePreview(null);
}

// ============================================================================
// MODALES ANIDADOS (CATEGORÍA & SUBCATEGORÍA)
// ============================================================================
function openNestedCategoryModal() {
  const modal = document.getElementById('modal-nested-category');
  if (modal) modal.classList.add('is-active');
  document.getElementById('nested-cat-name')?.focus();
}

function closeNestedCategoryModal() {
  const modal = document.getElementById('modal-nested-category');
  if (modal) modal.classList.remove('is-active');
  document.getElementById('form-nested-category')?.reset();

  // Asegurar que el modal principal de producto permanezca visible
  const productModal = document.getElementById('modal-full-product');
  if (productModal && !productModal.classList.contains('is-active')) {
    productModal.classList.add('is-active');
  }
}

function openNestedSubcategoryModal() {
  const modal = document.getElementById('modal-nested-subcategory');
  if (modal) {
    // Si ya hay una categoría seleccionada en el form principal, preseleccionarla
    const selectedCat = document.getElementById('product-category-select')?.value;
    if (selectedCat) {
      document.getElementById('nested-subcat-parent').value = selectedCat;
    }
    modal.classList.add('is-active');
    document.getElementById('nested-subcat-name')?.focus();
  }
}

function closeNestedSubcategoryModal() {
  const modal = document.getElementById('modal-nested-subcategory');
  if (modal) modal.classList.remove('is-active');
  document.getElementById('form-nested-subcategory')?.reset();

  // Asegurar que el modal principal de producto permanezca visible
  const productModal = document.getElementById('modal-full-product');
  if (productModal && !productModal.classList.contains('is-active')) {
    productModal.classList.add('is-active');
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Filtros superiores
  document.getElementById('filter-search')?.addEventListener('input', renderProductsTable);
  document.getElementById('filter-category')?.addEventListener('change', () => {
    updateSubcategorySelects();
    renderProductsTable();
  });
  document.getElementById('filter-subcategory')?.addEventListener('change', renderProductsTable);
  document.getElementById('filter-only-active')?.addEventListener('change', renderProductsTable);

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-category').value = 'all';
    updateSubcategorySelects();
    document.getElementById('filter-subcategory').value = 'all';
    document.getElementById('filter-only-active').checked = true;
    renderProductsTable();
  });

  // Botón "+ Nuevo Producto"
  document.getElementById('btn-open-new-product-modal')?.addEventListener('click', () => {
    openFullProductModal(null);
  });

  // Cambio de categoría en formulario de producto
  document.getElementById('product-category-select')?.addEventListener('change', updateSubcategorySelects);

  // Botones para abrir modales anidados (+)
  document.getElementById('btn-add-nested-category')?.addEventListener('click', openNestedCategoryModal);
  document.getElementById('btn-add-nested-subcategory')?.addEventListener('click', openNestedSubcategoryModal);

  // Cierre de modales
  document.getElementById('btn-close-quick-modal')?.addEventListener('click', closeQuickEditModal);
  document.getElementById('btn-cancel-quick-modal')?.addEventListener('click', closeQuickEditModal);

  document.getElementById('btn-close-product-modal')?.addEventListener('click', closeFullProductModal);
  document.getElementById('btn-cancel-product-modal')?.addEventListener('click', closeFullProductModal);

  document.getElementById('btn-close-nested-cat')?.addEventListener('click', closeNestedCategoryModal);
  document.getElementById('btn-cancel-nested-cat')?.addEventListener('click', closeNestedCategoryModal);

  document.getElementById('btn-close-nested-subcat')?.addEventListener('click', closeNestedSubcategoryModal);
  document.getElementById('btn-cancel-nested-subcat')?.addEventListener('click', closeNestedSubcategoryModal);

  // Stepper de Stock en Quick Edit
  document.querySelectorAll('.btn-stock-delta').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.delta, 10) || 0;
      const stockInput = document.getElementById('quick-stock');
      if (stockInput) {
        let current = parseInt(stockInput.value, 10) || 0;
        current = Math.max(0, current + delta);
        stockInput.value = current;
      }
    });
  });

  // Inicializar Lightbox y Dropzone de Imagen
  setupLightboxEvents();
  setupProductDropzone();

  // Conversión dinámica de precio en Quick Edit
  document.getElementById('quick-price')?.addEventListener('input', updateQuickVesPreview);

  // Envío Formulario Quick Edit con Confirmación
  document.getElementById('form-quick-edit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pid = document.getElementById('quick-product-id').value;
    const stock = parseInt(document.getElementById('quick-stock').value, 10);
    const price = parseFloat(document.getElementById('quick-price').value);

    if (isNaN(stock) || stock < 0 || isNaN(price) || price <= 0) {
      showToast('Ingresa valores válidos de stock y precio', 'warning');
      return;
    }

    const confirmed = await showConfirmModal({
      title: 'Confirmar Ajuste Rápido',
      message: `¿Deseas guardar los cambios de stock (${stock} unids) y precio ($${price.toFixed(2)}) para este producto?`,
      confirmText: 'Guardar Ajuste',
      cancelText: 'Cancelar',
      type: 'info'
    });
    if (!confirmed) return;

    try {
      const updated = await quickUpdateProduct(pid, { stock, price });
      // Actualizar en memoria
      const idx = productsList.findIndex(p => String(p.id) === String(pid));
      if (idx !== -1) {
        productsList[idx] = { ...productsList[idx], ...updated };
      }
      renderProductsTable();
      closeQuickEditModal();
      showToast('Existencias y precio actualizados con éxito', 'success');
    } catch (err) {
      console.error('Error en ajuste rápido:', err);
      showToast('Error al guardar ajuste rápido', 'error');
    }
  });

  // Envío Formulario Completo de Producto con Confirmación
  document.getElementById('form-full-product')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pid = document.getElementById('product-id').value;
    const barcode = document.getElementById('product-barcode').value.trim();
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category-select').value || null;
    const subcategory = document.getElementById('product-subcategory-select').value || null;
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value, 10);
    const weekly_limit_per_employee = parseInt(document.getElementById('product-weekly-limit').value, 10) || 0;
    const description = document.getElementById('product-description').value.trim();
    const is_active = document.getElementById('product-is-active').checked;

    if (!barcode || !name || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) {
      showToast('Por favor completa todos los campos requeridos correctamente', 'warning');
      return;
    }

    if (pid) {
      const confirmed = await showConfirmModal({
        title: 'Actualizar Producto',
        message: `¿Deseas guardar los cambios realizados en "${name}"?`,
        confirmText: 'Guardar Cambios',
        cancelText: 'Cancelar',
        type: 'info'
      });
      if (!confirmed) return;
    }

    const imageFileInput = document.getElementById('product-image');
    const imageFile = imageFileInput?.files?.[0];

    let payload;
    if (imageFile) {
      const formData = new FormData();
      formData.append('barcode', barcode);
      formData.append('name', name);
      if (category) formData.append('category', category);
      if (subcategory) formData.append('subcategory', subcategory);
      formData.append('price', price);
      formData.append('stock', stock);
      formData.append('weekly_limit_per_employee', weekly_limit_per_employee);
      formData.append('description', description);
      formData.append('is_active', is_active);
      formData.append('image', imageFile);
      payload = formData;
    } else {
      payload = {
        barcode,
        name,
        category,
        subcategory,
        price,
        stock,
        weekly_limit_per_employee,
        description,
        is_active
      };
    }

    try {
      if (pid) {
        const res = await updateProduct(pid, payload);
        const idx = productsList.findIndex(p => String(p.id) === String(pid));
        if (idx !== -1) productsList[idx] = { ...productsList[idx], ...res };
        showToast('Producto actualizado exitosamente', 'success');
      } else {
        const res = await createProduct(payload);
        productsList.unshift(res);
        showToast('Producto registrado exitosamente', 'success');
      }
      closeFullProductModal();
      renderProductsTable();
    } catch (err) {
      console.error('Error guardando producto:', err);
      showToast('Error al guardar producto en el servidor', 'error');
    }
  });

  // Envío Formulario Modal Anidado de Categoría
  document.getElementById('form-nested-category')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const btnSave = document.getElementById('btn-save-nested-cat');
    if (btnSave) btnSave.disabled = true;

    const nameInput = document.getElementById('nested-cat-name');
    const descInput = document.getElementById('nested-cat-desc');
    const name = nameInput ? nameInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';

    if (!name) {
      showToast('El nombre de la categoría es requerido', 'warning');
      if (btnSave) btnSave.disabled = false;
      return;
    }

    try {
      const newCat = await createCategory({ name, description });
      if (!newCat || !newCat.id) {
        throw new Error('No se recibió la confirmación de la categoría creada');
      }

      // Actualizar lista local de categorías
      const exists = categoriesList.some(c => String(c.id) === String(newCat.id));
      if (!exists) {
        categoriesList.push(newCat);
      }

      // Repoblar selectores de categoría
      populateCategorySelectors();

      // Seleccionar inmediatamente en el formulario del producto y disparar change
      const catSelect = document.getElementById('product-category-select');
      if (catSelect) {
        catSelect.value = String(newCat.id);
        catSelect.dispatchEvent(new Event('change'));
      }

      // Cerrar solo el modal anidado y garantizar que el modal de producto siga activo
      closeNestedCategoryModal();
      const productModal = document.getElementById('modal-full-product');
      if (productModal && !productModal.classList.contains('is-active')) {
        productModal.classList.add('is-active');
      }

      showToast(`Categoría "${newCat.name}" creada y seleccionada`, 'success');
    } catch (err) {
      console.error('Error creando categoría anidada:', err);
      let errorMsg = 'No se pudo crear la categoría';
      if (typeof err?.data === 'string') {
        errorMsg = err.data;
      } else if (err?.data?.name) {
        errorMsg = `Nombre de categoría: ${Array.isArray(err.data.name) ? err.data.name.join(', ') : err.data.name}`;
      } else if (err?.data?.detail) {
        errorMsg = err.data.detail;
      } else if (err?.message) {
        errorMsg = err.message;
      }
      showToast(errorMsg, 'error');
    } finally {
      if (btnSave) btnSave.disabled = false;
    }
  });

  // Envío Formulario Modal Anidado de Subcategoría
  document.getElementById('form-nested-subcategory')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const btnSave = document.getElementById('btn-save-nested-subcat');
    if (btnSave) btnSave.disabled = true;

    const parentSelect = document.getElementById('nested-subcat-parent');
    const nameInput = document.getElementById('nested-subcat-name');
    const descInput = document.getElementById('nested-subcat-desc');

    const category = parentSelect ? parentSelect.value : '';
    const name = nameInput ? nameInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';

    if (!category || !name) {
      showToast('Selecciona una categoría padre e ingresa el nombre de la subcategoría', 'warning');
      if (btnSave) btnSave.disabled = false;
      return;
    }

    try {
      const parsedCatId = parseInt(category, 10) || category;
      const newSub = await createSubCategory({ category: parsedCatId, name, description });
      if (!newSub || !newSub.id) {
        throw new Error('No se recibió la confirmación de la subcategoría creada');
      }

      // Actualizar lista local de subcategorías
      const exists = subcategoriesList.some(s => String(s.id) === String(newSub.id));
      if (!exists) {
        subcategoriesList.push(newSub);
      }

      // Si la categoría del producto no es la padre, sincronizarla
      const prodCatSelect = document.getElementById('product-category-select');
      if (prodCatSelect && String(prodCatSelect.value) !== String(category)) {
        prodCatSelect.value = String(category);
      }
      updateSubcategorySelects();

      // Seleccionar la nueva subcategoría en el formulario de producto
      const prodSubSelect = document.getElementById('product-subcategory-select');
      if (prodSubSelect) {
        prodSubSelect.value = String(newSub.id);
        prodSubSelect.dispatchEvent(new Event('change'));
      }

      // Cerrar solo el modal anidado y garantizar que el modal de producto siga activo
      closeNestedSubcategoryModal();
      const productModal = document.getElementById('modal-full-product');
      if (productModal && !productModal.classList.contains('is-active')) {
        productModal.classList.add('is-active');
      }

      showToast(`Subcategoría "${newSub.name}" creada y seleccionada`, 'success');
    } catch (err) {
      console.error('Error creando subcategoría anidada:', err);
      let errorMsg = 'No se pudo crear la subcategoría';
      if (typeof err?.data === 'string') {
        errorMsg = err.data;
      } else if (err?.data?.name) {
        errorMsg = `Nombre de subcategoría: ${Array.isArray(err.data.name) ? err.data.name.join(', ') : err.data.name}`;
      } else if (err?.data?.detail) {
        errorMsg = err.data.detail;
      } else if (err?.message) {
        errorMsg = err.message;
      }
      showToast(errorMsg, 'error');
    } finally {
      if (btnSave) btnSave.disabled = false;
    }
  });
}

// ============================================================================
// SOPORTE DE DRAG & DROP PARA CARGA DE IMAGEN
// ============================================================================
function setupProductDropzone() {
  const dropzone = document.getElementById('product-image-dropzone');
  const fileInput = document.getElementById('product-image');
  const removeBtn = document.getElementById('btn-remove-product-image');

  if (!dropzone || !fileInput) return;

  // Clic en dropzone abre file picker
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-remove-product-image')) return;
    fileInput.click();
  });

  // Eventos de arrastre
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('is-dragging');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      fileInput.files = files;
      handleSelectedImage(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSelectedImage(file);
    } else {
      setProductDropzonePreview(null);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setProductDropzonePreview(null);
    });
  }

  function handleSelectedImage(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP)', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProductDropzonePreview(ev.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }
}

// ============================================================================
// ELIMINACIÓN DE PRODUCTO
// ============================================================================
async function executeDeleteProduct(productId) {
  try {
    await deleteProduct(productId);
    productsList = productsList.filter(p => String(p.id) !== String(productId));
    renderProductsTable();
    showToast('Producto eliminado exitosamente', 'success');
  } catch (err) {
    console.error('Error eliminando producto:', err);
    showToast('No se pudo eliminar el producto', 'error');
  }
}

// ============================================================================
// TOAST NOTIFICATIONS
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
  if (typeof str !== 'string') return str;
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
