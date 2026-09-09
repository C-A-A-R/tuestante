/**
 * categories.js
 * Gestión Unificada de Categorías y Subcategorías - TuEstante Admin
 */

import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory
} from './employee-store.api.js';

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { getBcvRate } from '../../js/service/exchange-rate.service.js';
import { showConfirmModal } from '../../components/modal/modal.js';

// ============================================================================
// ESTADO
// ============================================================================
let activeTab = 'categories'; // 'categories' | 'subcategories'
let categoriesList = [];
let subcategoriesList = [];

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminComponents({ title: 'Gestión de Categorías' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load warning:', err);
  }

  await loadExchangeRate();
  setupEventListeners();
  await loadData();
});

async function loadExchangeRate() {
  try {
    const rate = await getBcvRate();
    if (rate && !isNaN(rate) && rate > 0) {
      const badgeVal = document.getElementById('navbar-exchange-val');
      if (badgeVal) badgeVal.textContent = `Bs. ${parseFloat(rate).toFixed(2)}`;
    }
  } catch (err) {
    console.warn('Fallback rate active');
  }
}

async function loadData() {
  try {
    const [cats, subcats] = await Promise.all([
      fetchCategories(),
      fetchSubCategories()
    ]);
    categoriesList = Array.isArray(cats) ? cats : (cats.results || []);
    subcategoriesList = Array.isArray(subcats) ? subcats : (subcats.results || []);

    updateBadges();
    populateParentCategoryDropdown();
    renderActiveTab();
  } catch (err) {
    console.error('Error cargando datos de categorías:', err);
    showToast('Error al obtener categorías del servidor', 'error');
  }
}

function updateBadges() {
  const badgeCats = document.getElementById('badge-count-cats');
  const badgeSubcats = document.getElementById('badge-count-subcats');
  if (badgeCats) badgeCats.textContent = categoriesList.length;
  if (badgeSubcats) badgeSubcats.textContent = subcategoriesList.length;
}

function populateParentCategoryDropdown() {
  const select = document.getElementById('input-parent-cat');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Seleccionar Categoría Padre --</option>';
  categoriesList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  if (currentVal) select.value = currentVal;
}

// ============================================================================
// TABS & RENDERING
// ============================================================================
function switchTab(newTab) {
  activeTab = newTab;

  const btnCats = document.getElementById('tab-btn-categories');
  const btnSubcats = document.getElementById('tab-btn-subcategories');
  const viewCats = document.getElementById('view-categories');
  const viewSubcats = document.getElementById('view-subcategories');

  if (activeTab === 'categories') {
    btnCats.classList.add('is-active');
    btnCats.setAttribute('aria-selected', 'true');
    btnSubcats.classList.remove('is-active');
    btnSubcats.setAttribute('aria-selected', 'false');

    viewCats.classList.remove('is-hidden');
    viewSubcats.classList.add('is-hidden');
  } else {
    btnSubcats.classList.add('is-active');
    btnSubcats.setAttribute('aria-selected', 'true');
    btnCats.classList.remove('is-active');
    btnCats.setAttribute('aria-selected', 'false');

    viewSubcats.classList.remove('is-hidden');
    viewCats.classList.add('is-hidden');
  }

  renderActiveTab();
}

function renderActiveTab() {
  const query = (document.getElementById('filter-categories-search')?.value || '').toLowerCase().trim();
  if (activeTab === 'categories') {
    renderCategoriesTable(query);
  } else {
    renderSubcategoriesTable(query);
  }
}

function renderCategoriesTable(query = '') {
  const tbody = document.getElementById('tbody-categories');
  if (!tbody) return;

  const filtered = categoriesList.filter(c => {
    if (!query) return true;
    const name = (c.name || '').toLowerCase();
    const desc = (c.description || '').toLowerCase();
    return name.includes(query) || desc.includes(query);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 36px; color: #64748b;">
          No se encontraron categorías principales.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((c, idx) => {
    // Contar subcategorías hijas
    const subCount = subcategoriesList.filter(s => String(s.category) === String(c.id) || String(s.category_id) === String(c.id) || (s.category && String(s.category.id) === String(c.id))).length;

    const hasImage = Boolean(c.image);
    const imgCell = hasImage
      ? `
        <td style="text-align: center;">
          <div class="cat-img-thumbnail-wrap" data-img-url="${escapeHtml(c.image)}" data-img-name="${escapeHtml(c.name)}" title="Clic para ver en pantalla completa">
            <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" class="cat-table-thumb" loading="lazy">
            <div class="thumb-zoom-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="zoom-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </div>
          </div>
        </td>
      `
      : `
        <td style="text-align: center;">
          <div class="cat-img-thumbnail-wrap placeholder-wrap" title="Sin imagen asignada">
            <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
        </td>
      `;

    return `
      <tr data-id="${c.id}">
        <td style="font-weight: 600; color: #94a3b8;">${idx + 1}</td>
        ${imgCell}
        <td>
          <div class="cat-title-cell">${escapeHtml(c.name)}</div>
        </td>
        <td>
          <div class="cat-desc-cell">${escapeHtml(c.description || 'Sin descripción')}</div>
        </td>
        <td style="text-align: center;">
          <span class="subcat-count-badge">${subCount} subcategorías</span>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn-icon-action btn-edit-cat" data-id="${c.id}" title="Editar Categoría">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="btn-icon-action btn-delete-action btn-del-cat" data-id="${c.id}" data-name="${escapeHtml(c.name)}" title="Eliminar Categoría">
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

  // Eventos de fila
  tbody.querySelectorAll('.cat-img-thumbnail-wrap[data-img-url]').forEach(wrap => {
    wrap.addEventListener('click', () => {
      openLightbox(wrap.dataset.imgUrl, wrap.dataset.imgName);
    });
  });
  tbody.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.addEventListener('click', () => openCategoryModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-del-cat').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteCategory(btn.dataset.id, btn.dataset.name));
  });
}

function renderSubcategoriesTable(query = '') {
  const tbody = document.getElementById('tbody-subcategories');
  if (!tbody) return;

  const filtered = subcategoriesList.filter(s => {
    if (!query) return true;
    const name = (s.name || '').toLowerCase();
    const desc = (s.description || '').toLowerCase();
    return name.includes(query) || desc.includes(query);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px; color: #64748b;">
          No se encontraron subcategorías.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    // Buscar categoría padre
    let parentName = 'Sin Asignar';
    if (s.category_name) parentName = s.category_name;
    else if (s.category?.name) parentName = s.category.name;
    else {
      const parent = categoriesList.find(c => String(c.id) === String(s.category) || String(c.id) === String(s.category_id));
      if (parent) parentName = parent.name;
    }

    const hasImage = Boolean(s.image);
    const imgCell = hasImage
      ? `
        <td style="text-align: center;">
          <div class="cat-img-thumbnail-wrap" data-img-url="${escapeHtml(s.image)}" data-img-name="${escapeHtml(s.name)}" title="Clic para ver en pantalla completa">
            <img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.name)}" class="cat-table-thumb" loading="lazy">
            <div class="thumb-zoom-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="zoom-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </div>
          </div>
        </td>
      `
      : `
        <td style="text-align: center;">
          <div class="cat-img-thumbnail-wrap placeholder-wrap" title="Sin imagen asignada">
            <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
        </td>
      `;

    return `
      <tr data-id="${s.id}">
        <td style="font-weight: 600; color: #94a3b8;">${idx + 1}</td>
        ${imgCell}
        <td>
          <span class="parent-cat-pill">${escapeHtml(parentName)}</span>
        </td>
        <td>
          <div class="cat-title-cell">${escapeHtml(s.name)}</div>
        </td>
        <td>
          <div class="cat-desc-cell">${escapeHtml(s.description || 'Sin descripción')}</div>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn-icon-action btn-edit-sub" data-id="${s.id}" title="Editar Subcategoría">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="btn-icon-action btn-delete-action btn-del-sub" data-id="${s.id}" data-name="${escapeHtml(s.name)}" title="Eliminar Subcategoría">
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

  // Eventos de fila
  tbody.querySelectorAll('.cat-img-thumbnail-wrap[data-img-url]').forEach(wrap => {
    wrap.addEventListener('click', () => {
      openLightbox(wrap.dataset.imgUrl, wrap.dataset.imgName);
    });
  });
  tbody.querySelectorAll('.btn-edit-sub').forEach(btn => {
    btn.addEventListener('click', () => openSubcategoryModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-del-sub').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteSubcategory(btn.dataset.id, btn.dataset.name));
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
  if (caption) caption.textContent = name || 'Categoría';
  modal.classList.add('is-active');
}

// ============================================================================
// MODAL POLIMÓRFICO
// ============================================================================
function openCategoryModal(catId = null) {
  const modal = document.getElementById('modal-category-subcat');
  const title = document.getElementById('modal-form-title');
  const typeInput = document.getElementById('entity-type');
  const idInput = document.getElementById('entity-id');
  const parentGroup = document.getElementById('group-parent-category');
  const nameLabel = document.getElementById('label-entity-name');
  const nameInput = document.getElementById('input-entity-name');
  const descInput = document.getElementById('input-entity-desc');

  typeInput.value = 'category';
  parentGroup.classList.add('is-hidden');
  nameLabel.innerHTML = 'Nombre de la Categoría <span class="req">*</span>';
  nameInput.placeholder = 'Ej: Víveres, Enlatados, Lácteos...';

  if (catId) {
    const cat = categoriesList.find(c => String(c.id) === String(catId));
    if (!cat) return;
    title.textContent = 'Editar Categoría Principal';
    idInput.value = cat.id;
    nameInput.value = cat.name || '';
    descInput.value = cat.description || '';

    if (cat.image) {
      setEntityDropzonePreview(cat.image, cat.name || 'categoria.jpg');
    } else {
      setEntityDropzonePreview(null);
    }
  } else {
    title.textContent = 'Nueva Categoría Principal';
    idInput.value = '';
    nameInput.value = '';
    descInput.value = '';
    setEntityDropzonePreview(null);
  }

  modal.classList.add('is-active');
  nameInput.focus();
}

function openSubcategoryModal(subId = null) {
  const modal = document.getElementById('modal-category-subcat');
  const title = document.getElementById('modal-form-title');
  const typeInput = document.getElementById('entity-type');
  const idInput = document.getElementById('entity-id');
  const parentGroup = document.getElementById('group-parent-category');
  const parentSelect = document.getElementById('input-parent-cat');
  const nameLabel = document.getElementById('label-entity-name');
  const nameInput = document.getElementById('input-entity-name');
  const descInput = document.getElementById('input-entity-desc');

  typeInput.value = 'subcategory';
  parentGroup.classList.remove('is-hidden');
  nameLabel.innerHTML = 'Nombre de la Subcategoría <span class="req">*</span>';
  nameInput.placeholder = 'Ej: Arroz, Pastas, Harinas...';

  populateParentCategoryDropdown();

  if (subId) {
    const sub = subcategoriesList.find(s => String(s.id) === String(subId));
    if (!sub) return;
    title.textContent = 'Editar Subcategoría';
    idInput.value = sub.id;
    parentSelect.value = sub.category?.id || sub.category_id || sub.category || '';
    nameInput.value = sub.name || '';
    descInput.value = sub.description || '';

    if (sub.image) {
      setEntityDropzonePreview(sub.image, sub.name || 'subcategoria.jpg');
    } else {
      setEntityDropzonePreview(null);
    }
  } else {
    title.textContent = 'Nueva Subcategoría';
    idInput.value = '';
    parentSelect.value = '';
    nameInput.value = '';
    descInput.value = '';
    setEntityDropzonePreview(null);
  }

  modal.classList.add('is-active');
  nameInput.focus();
}

function setEntityDropzonePreview(imageUrl, fileName = 'imagen.jpg') {
  const idleView = document.getElementById('entity-dropzone-idle');
  const previewView = document.getElementById('entity-dropzone-preview');
  const previewImg = document.getElementById('entity-image-preview');
  const nameLabel = document.getElementById('entity-image-preview-name');
  const fileInput = document.getElementById('input-entity-image');

  if (imageUrl) {
    if (previewImg) previewImg.src = imageUrl;
    if (nameLabel) nameLabel.textContent = fileName;
    if (idleView) idleView.classList.add('hidden');
    if (previewView) previewView.classList.remove('hidden');
  } else {
    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewView) previewView.classList.add('hidden');
    if (idleView) idleView.classList.remove('hidden');
  }
}

function closeModal() {
  const modal = document.getElementById('modal-category-subcat');
  if (modal) modal.classList.remove('is-active');
  document.getElementById('form-category-subcat')?.reset();
  setEntityDropzonePreview(null);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Tabs
  document.getElementById('tab-btn-categories')?.addEventListener('click', () => switchTab('categories'));
  document.getElementById('tab-btn-subcategories')?.addEventListener('click', () => switchTab('subcategories'));

  // Buscador
  document.getElementById('filter-categories-search')?.addEventListener('input', renderActiveTab);

  // Inicializar Lightbox y Dropzone de Imagen
  setupLightboxEvents();
  setupEntityDropzone();

  // Botones de Creación Directa
  document.getElementById('btn-create-category')?.addEventListener('click', () => {
    openCategoryModal();
  });

  document.getElementById('btn-create-subcategory')?.addEventListener('click', () => {
    openSubcategoryModal();
  });

  // Cerrar Modal
  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeModal);

  // Guardar Entidad (Categoría o Subcategoría)
  document.getElementById('form-category-subcat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('entity-type').value;
    const id = document.getElementById('entity-id').value;
    const name = document.getElementById('input-entity-name').value.trim();
    const description = document.getElementById('input-entity-desc').value.trim();
    const imageInput = document.getElementById('input-entity-image');
    const imageFile = imageInput?.files?.[0];

    if (!name) {
      showToast('El nombre es obligatorio', 'warning');
      return;
    }

    if (id) {
      const typeLabel = type === 'category' ? 'Categoría' : 'Subcategoría';
      const confirmed = await showConfirmModal({
        title: `Actualizar ${typeLabel}`,
        message: `¿Deseas guardar las modificaciones realizadas en "${name}"?`,
        confirmText: 'Guardar Cambios',
        cancelText: 'Cancelar',
        type: 'info'
      });
      if (!confirmed) return;
    }

    let payload;
    if (imageFile) {
      const formData = new FormData();
      formData.append('name', name);
      if (description) formData.append('description', description);
      formData.append('image', imageFile);
      if (type === 'subcategory') {
        const category = document.getElementById('input-parent-cat').value;
        if (!category) {
          showToast('Debes seleccionar una categoría padre', 'warning');
          return;
        }
        formData.append('category', category);
      }
      payload = formData;
    } else {
      if (type === 'category') {
        payload = { name, description };
      } else {
        const category = document.getElementById('input-parent-cat').value;
        if (!category) {
          showToast('Debes seleccionar una categoría padre', 'warning');
          return;
        }
        payload = { category, name, description };
      }
    }

    if (type === 'category') {
      await saveCategory(id, payload);
    } else {
      await saveSubcategory(id, payload);
    }
  });
}

function setupEntityDropzone() {
  const dropzone = document.getElementById('entity-image-dropzone');
  const fileInput = document.getElementById('input-entity-image');
  const removeBtn = document.getElementById('btn-remove-entity-image');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-remove-entity-image')) return;
    fileInput.click();
  });

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
      setEntityDropzonePreview(null);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setEntityDropzonePreview(null);
    });
  }

  function handleSelectedImage(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP)', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEntityDropzonePreview(ev.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }
}

// ============================================================================
// OPERACIONES CRUD
// ============================================================================
async function saveCategory(id, payload) {
  try {
    if (id) {
      const updated = await updateCategory(id, payload);
      const idx = categoriesList.findIndex(c => String(c.id) === String(id));
      if (idx !== -1) categoriesList[idx] = { ...categoriesList[idx], ...updated };
      showToast('Categoría actualizada con éxito', 'success');
    } else {
      const created = await createCategory(payload);
      categoriesList.push(created);
      showToast('Categoría creada exitosamente', 'success');
    }
    updateBadges();
    populateParentCategoryDropdown();
    renderActiveTab();
    closeModal();
  } catch (err) {
    console.error('Error guardando categoría:', err);
    showToast('No se pudo guardar la categoría', 'error');
  }
}

async function saveSubcategory(id, payload) {
  try {
    if (id) {
      const updated = await updateSubCategory(id, payload);
      const idx = subcategoriesList.findIndex(s => String(s.id) === String(id));
      if (idx !== -1) subcategoriesList[idx] = { ...subcategoriesList[idx], ...updated };
      showToast('Subcategoría actualizada con éxito', 'success');
    } else {
      const created = await createSubCategory(payload);
      subcategoriesList.push(created);
      showToast('Subcategoría creada exitosamente', 'success');
    }
    updateBadges();
    renderActiveTab();
    closeModal();
  } catch (err) {
    console.error('Error guardando subcategoría:', err);
    showToast('No se pudo guardar la subcategoría', 'error');
  }
}

async function confirmDeleteCategory(id, name) {
  const confirmed = await showConfirmModal({
    title: 'Eliminar Categoría',
    message: `¿Estás seguro de que deseas eliminar la categoría "${name}"? Las subcategorías y productos asociados podrían quedar sin clasificar.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!confirmed) return;

  try {
    await deleteCategory(id);
    categoriesList = categoriesList.filter(c => String(c.id) !== String(id));
    updateBadges();
    populateParentCategoryDropdown();
    renderActiveTab();
    showToast('Categoría eliminada', 'success');
  } catch (err) {
    console.error('Error eliminando categoría:', err);
    showToast('Error al eliminar categoría', 'error');
  }
}

async function confirmDeleteSubcategory(id, name) {
  const confirmed = await showConfirmModal({
    title: 'Eliminar Subcategoría',
    message: `¿Estás seguro de que deseas eliminar la subcategoría "${name}"?`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!confirmed) return;

  try {
    await deleteSubCategory(id);
    subcategoriesList = subcategoriesList.filter(s => String(s.id) !== String(id));
    updateBadges();
    renderActiveTab();
    showToast('Subcategoría eliminada', 'success');
  } catch (err) {
    console.error('Error eliminando subcategoría:', err);
    showToast('Error al eliminar subcategoría', 'error');
  }
}

// ============================================================================
// TOASTS
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
