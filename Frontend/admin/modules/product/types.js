/**
 * ==========================================================================
 * CONTROLADOR - TIPOS DE PRODUCTO (TYPES.JS) - TUESTANTE
 * Manejo de listado, filtros, creación, edición, visualización y eliminación
 * de tipos/líneas de producto en el panel administrativo.
 * ==========================================================================
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { 
  getProductTypes, 
  getProductType, 
  createProductType, 
  updateProductType, 
  deleteProductType 
} from './product.api.js';

// Estado local del módulo
const state = {
  typesList: [],
  filteredList: [],
  currentPage: 1,
  pageSize: 10,
  searchQuery: '',
  statusFilter: 'all',
  
  // Estado modal formulario
  editingTypeId: null,
  selectedImageFile: null,
  existingImageUrl: null,

  // Estado modal eliminación
  deletingTypeId: null
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar Drawer, Navbar y Footer
  await loadAdminComponents({ title: 'Tipos de producto' });

  // 2. Vincular listeners de la interfaz
  setupFilterListeners();
  setupModalListeners();
  setupLightbox();
  setupDropzone();
  setupCharCounter();

  // 3. Cargar datos iniciales
  await loadTypes();
});

// ==========================================================================
// CARGA Y FILTRADO DE DATOS
// ==========================================================================
async function loadTypes() {
  const tbody = document.getElementById('types-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
          Cargando tipos de producto...
        </td>
      </tr>
    `;
  }

  try {
    const data = await getProductTypes();
    state.typesList = Array.isArray(data) ? data : [];
    applyFilters();
  } catch (err) {
    console.error('Error al cargar tipos de producto:', err);
    showToast('error', 'Error', 'No se pudieron cargar los tipos de producto.');
    state.typesList = [];
    applyFilters();
  }
}

function applyFilters() {
  const query = (state.searchQuery || '').toLowerCase().trim();
  const status = state.statusFilter;

  state.filteredList = state.typesList.filter(t => {
    // Filtro por texto (Nombre o Descripción)
    const nameMatch = (t.product_type_name || '').toLowerCase().includes(query);
    const descMatch = (t.description || '').toLowerCase().includes(query);
    const matchesSearch = !query || nameMatch || descMatch;

    // Filtro por Estado
    const isActive = t.is_active !== false;
    let matchesStatus = true;
    if (status === 'active') matchesStatus = isActive;
    if (status === 'inactive') matchesStatus = !isActive;

    return matchesSearch && matchesStatus;
  });

  state.currentPage = 1;
  renderTypesTable();
}

// ==========================================================================
// RENDERIZADO DE LA TABLA Y ACCIONES
// ==========================================================================
function renderTypesTable() {
  const tbody = document.getElementById('types-table-body');
  if (!tbody) return;

  const total = state.filteredList.length;

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="types-empty-state">
            <div class="empty-icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
            <h4 class="empty-title">No se encontraron tipos de producto</h4>
            <p class="empty-desc">
              ${state.searchQuery || state.statusFilter !== 'all' 
                ? 'No hay resultados que coincidan con los filtros aplicados.' 
                : 'Aún no hay tipos de producto registrados. Crea uno nuevo para comenzar a organizar tu catálogo.'}
            </p>
            ${state.searchQuery || state.statusFilter !== 'all'
              ? `<button type="button" class="btn btn-outline" id="btn-empty-clear">Limpiar filtros</button>`
              : `<button type="button" class="btn btn-primary" id="btn-empty-create">+ Crear tipo de producto</button>`
            }
          </div>
        </td>
      </tr>
    `;

    document.getElementById('btn-empty-clear')?.addEventListener('click', clearFilters);
    document.getElementById('btn-empty-create')?.addEventListener('click', openCreateModal);

    updatePagination(0, 0, 0);
    return;
  }

  // Paginación
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, total);
  const currentItems = state.filteredList.slice(startIndex, endIndex);

  tbody.innerHTML = currentItems.map(t => {
    const isActive = t.is_active !== false;
    const statusText = isActive ? 'Activa' : 'Inactiva';
    const statusClass = isActive ? 'status-active' : 'status-inactive';
    const count = Number(t.count !== undefined ? t.count : (t.products_count !== undefined ? t.products_count : 0));
    const imgUrl = t.product_type_image || '../../assets/images/logo.jpeg';

    return `
      <tr data-id="${t.id}">
        <!-- 1. Imagen Flotante / Zoom Lightbox -->
        <td style="text-align: center;">
          <div 
            class="type-thumb-wrapper js-lightbox-trigger" 
            data-full-img="${escapeHtml(imgUrl)}" 
            data-title="${escapeHtml(t.product_type_name)}" 
            title="Haz clic para ver imagen en grande"
          >
            <img 
              src="${escapeHtml(imgUrl)}" 
              alt="${escapeHtml(t.product_type_name)}" 
              class="type-thumb-img"
              onerror="this.src='../../assets/images/logo.jpeg'"
            >
            <div class="thumb-zoom-overlay">
              <svg class="zoom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </div>
          </div>
        </td>

        <!-- 2. Nombre -->
        <td>
          <span class="type-name-cell">${escapeHtml(t.product_type_name)}</span>
        </td>

        <!-- 3. Descripción -->
        <td>
          <span class="type-desc-cell">${escapeHtml(t.description || 'Sin descripción')}</span>
        </td>

        <!-- 4. Productos Asociados -->
        <td class="type-count-cell">
          ${count}
        </td>

        <!-- 5. Estado (Con ancho y nowrap garantizado para evitar "Act a") -->
        <td class="type-status-cell">
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </td>

        <!-- 6. Acciones: VER, EDITAR, ELIMINAR (En lugar de 3 puntos) -->
        <td class="type-actions-cell">
          <div class="actions-group">
            <!-- Botón 1: VER -->
            <button 
              type="button" 
              class="btn-action btn-action-view" 
              data-id="${t.id}" 
              title="Ver detalle del tipo de producto"
              aria-label="Ver detalle"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>

            <!-- Botón 2: EDITAR -->
            <button 
              type="button" 
              class="btn-action btn-action-edit" 
              data-id="${t.id}" 
              title="Editar tipo de producto"
              aria-label="Editar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>

            <!-- Botón 3: ELIMINAR -->
            <button 
              type="button" 
              class="btn-action btn-action-delete" 
              data-id="${t.id}" 
              title="Eliminar tipo de producto"
              aria-label="Eliminar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachTableRowEvents(tbody);
  updatePagination(startIndex + 1, endIndex, total);
}

function attachTableRowEvents(tbody) {
  // 0. Lightbox en imágenes de la tabla
  tbody.querySelectorAll('.js-lightbox-trigger').forEach(wrap => {
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      const imgUrl = wrap.dataset.fullImg;
      const title = wrap.dataset.title || 'Tipo de producto';
      if (imgUrl) openLightbox(imgUrl, title);
    });
  });

  // 1. Ver
  tbody.querySelectorAll('.btn-action-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openViewModal(btn.dataset.id);
    });
  });

  // 2. Editar
  tbody.querySelectorAll('.btn-action-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.id);
    });
  });

  // 3. Eliminar
  tbody.querySelectorAll('.btn-action-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteModal(btn.dataset.id);
    });
  });
}

function updatePagination(from, to, total) {
  const infoEl = document.getElementById('pagination-info');
  if (infoEl) {
    if (total === 0) {
      infoEl.textContent = 'Mostrando 0 a 0 de 0 tipos de producto';
    } else {
      infoEl.textContent = `Mostrando ${from} a ${to} de ${total} tipos de producto`;
    }
  }

  const totalPages = Math.ceil(total / state.pageSize) || 1;
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');
  const pageNumbersEl = document.getElementById('page-numbers');

  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages;

  if (pageNumbersEl) {
    let pagesHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      pagesHtml += `
        <button type="button" class="page-number-btn ${p === state.currentPage ? 'active' : ''}" data-page="${p}">
          ${p}
        </button>
      `;
    }
    pageNumbersEl.innerHTML = pagesHtml;

    pageNumbersEl.querySelectorAll('.page-number-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentPage = parseInt(btn.dataset.page, 10);
        renderTypesTable();
      });
    });
  }
}

// ==========================================================================
// LISTENERS DE BÚSQUEDA Y FILTROS
// ==========================================================================
function setupFilterListeners() {
  const searchInput = document.getElementById('filter-search');
  const statusSelect = document.getElementById('filter-status');
  const btnClear = document.getElementById('btn-clear-filters');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  searchInput?.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    applyFilters();
  });

  statusSelect?.addEventListener('change', () => {
    state.statusFilter = statusSelect.value;
    applyFilters();
  });

  btnClear?.addEventListener('click', clearFilters);

  btnPrev?.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTypesTable();
    }
  });

  btnNext?.addEventListener('click', () => {
    const totalPages = Math.ceil(state.filteredList.length / state.pageSize) || 1;
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderTypesTable();
    }
  });
}

function clearFilters() {
  const searchInput = document.getElementById('filter-search');
  const statusSelect = document.getElementById('filter-status');

  if (searchInput) searchInput.value = '';
  if (statusSelect) statusSelect.value = 'all';

  state.searchQuery = '';
  state.statusFilter = 'all';
  applyFilters();
}

// ==========================================================================
// CONTADOR DE CARACTERES (MÁXIMO 100 CARACTERES)
// ==========================================================================
function setupCharCounter() {
  const textarea = document.getElementById('input-type-desc');
  const countSpan = document.getElementById('desc-count');
  const counterBox = document.getElementById('char-counter-desc');

  if (!textarea || !countSpan) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    countSpan.textContent = len;

    if (len >= 100) {
      counterBox?.classList.add('is-limit');
    } else {
      counterBox?.classList.remove('is-limit');
    }
  });
}

function updateCharCounter(text = '') {
  const countSpan = document.getElementById('desc-count');
  const counterBox = document.getElementById('char-counter-desc');
  if (countSpan) {
    const len = (text || '').length;
    countSpan.textContent = len;
    if (len >= 100) {
      counterBox?.classList.add('is-limit');
    } else {
      counterBox?.classList.remove('is-limit');
    }
  }
}

// ==========================================================================
// DROPZONE DE IMAGEN CON VALIDACIÓN Y PREVIEW
// ==========================================================================
function setupDropzone() {
  const dropzone = document.getElementById('type-dropzone');
  const fileInput = document.getElementById('input-type-file');
  const btnRemove = document.getElementById('btn-remove-image');

  if (!dropzone || !fileInput) return;

  // Drag & drop visuales
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('is-dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  btnRemove?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetDropzone();
  });
}

function handleFileSelected(file) {
  // Validación de tipo
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast('warning', 'Formato no permitido', 'Por favor selecciona una imagen JPG, PNG o WEBP.');
    return;
  }

  // Validación de tamaño (Máximo 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('warning', 'Imagen muy pesada', 'El tamaño máximo permitido es de 2MB.');
    return;
  }

  state.selectedImageFile = file;

  const dropzone = document.getElementById('type-dropzone');
  const previewImg = document.getElementById('preview-image');
  const removeBtn = document.getElementById('btn-remove-image');

  if (previewImg) {
    previewImg.src = URL.createObjectURL(file);
    previewImg.classList.remove('hidden');
  }
  if (removeBtn) removeBtn.classList.remove('hidden');
  if (dropzone) dropzone.classList.add('has-image');
}

function setExistingImagePreview(imageUrl) {
  state.existingImageUrl = imageUrl;
  state.selectedImageFile = null;

  const dropzone = document.getElementById('type-dropzone');
  const previewImg = document.getElementById('preview-image');
  const removeBtn = document.getElementById('btn-remove-image');

  if (imageUrl) {
    if (previewImg) { previewImg.src = imageUrl; previewImg.classList.remove('hidden'); }
    if (removeBtn) removeBtn.classList.remove('hidden');
    if (dropzone) dropzone.classList.add('has-image');
  } else {
    resetDropzone();
  }
}

function resetDropzone() {
  state.selectedImageFile = null;
  state.existingImageUrl = null;

  const fileInput = document.getElementById('input-type-file');
  if (fileInput) fileInput.value = '';

  const dropzone = document.getElementById('type-dropzone');
  const previewImg = document.getElementById('preview-image');
  const removeBtn = document.getElementById('btn-remove-image');
  const hiddenExisting = document.getElementById('input-type-existing-image');

  if (hiddenExisting) hiddenExisting.value = '';
  if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
  if (removeBtn) removeBtn.classList.add('hidden');
  if (dropzone) dropzone.classList.remove('has-image');
}

// ==========================================================================
// MODALES: EVENTOS Y CONTROLADORES
// ==========================================================================
function setupModalListeners() {
  // Botón Abrir Crear Modal
  document.getElementById('btn-open-create-modal')?.addEventListener('click', openCreateModal);

  // Cerrar Modal Formulario
  document.getElementById('btn-close-form-modal')?.addEventListener('click', closeFormModal);
  document.getElementById('btn-cancel-type-form')?.addEventListener('click', closeFormModal);

  // Cerrar Modal Ver
  document.getElementById('btn-close-view-modal')?.addEventListener('click', closeViewModal);
  document.getElementById('btn-close-view-footer')?.addEventListener('click', closeViewModal);

  // Botón Editar desde Ver
  document.getElementById('btn-edit-from-view')?.addEventListener('click', () => {
    const id = state.selectedTypeId;
    closeViewModal();
    if (id) openEditModal(id);
  });

  // Cerrar Modal Eliminar
  document.getElementById('btn-cancel-delete')?.addEventListener('click', closeDeleteModal);
  document.getElementById('btn-confirm-delete')?.addEventListener('click', handleConfirmDelete);

  // Cerrar al hacer clic en el backdrop oscuro
  ['modal-type-form-backdrop', 'modal-view-type-backdrop', 'modal-delete-backdrop'].forEach(id => {
    const backdrop = document.getElementById(id);
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('is-active');
      }
    });
  });

  // Envío del Formulario (Crear o Editar)
  document.getElementById('form-product-type')?.addEventListener('submit', handleFormSubmit);
}

// ==========================================================================
// CREACIÓN Y EDICIÓN (MODAL 1)
// ==========================================================================
function openCreateModal() {
  state.editingTypeId = null;
  resetDropzone();

  const titleEl = document.getElementById('modal-type-title');
  const btnSubmitText = document.getElementById('btn-submit-text');
  const inputId = document.getElementById('input-type-id');
  const inputName = document.getElementById('input-type-name');
  const inputDesc = document.getElementById('input-type-desc');
  const inputStatus = document.getElementById('input-type-status');

  if (titleEl) titleEl.textContent = 'Crear tipo de producto';
  if (btnSubmitText) btnSubmitText.textContent = 'Crear tipo de producto';
  if (inputId) inputId.value = '';
  if (inputName) inputName.value = '';
  if (inputDesc) inputDesc.value = '';
  if (inputStatus) inputStatus.checked = true;

  updateCharCounter('');

  const modal = document.getElementById('modal-type-form-backdrop');
  if (modal) modal.classList.add('is-active');
  inputName?.focus();
}

function openEditModal(id) {
  const type = state.typesList.find(t => String(t.id) === String(id));
  if (!type) {
    showToast('error', 'Error', 'No se encontró el tipo de producto seleccionado.');
    return;
  }

  state.editingTypeId = id;

  const titleEl = document.getElementById('modal-type-title');
  const btnSubmitText = document.getElementById('btn-submit-text');
  const inputId = document.getElementById('input-type-id');
  const inputName = document.getElementById('input-type-name');
  const inputDesc = document.getElementById('input-type-desc');
  const inputStatus = document.getElementById('input-type-status');

  if (titleEl) titleEl.textContent = 'Editar tipo de producto';
  if (btnSubmitText) btnSubmitText.textContent = 'Guardar cambios';
  if (inputId) inputId.value = type.id;
  if (inputName) inputName.value = type.product_type_name || '';
  if (inputDesc) inputDesc.value = type.description || '';
  if (inputStatus) inputStatus.checked = type.is_active !== false;

  updateCharCounter(type.description || '');

  // Previsualización de imagen existente
  if (type.product_type_image) {
    setExistingImagePreview(type.product_type_image);
  } else {
    resetDropzone();
  }

  const modal = document.getElementById('modal-type-form-backdrop');
  if (modal) modal.classList.add('is-active');
}

function closeFormModal() {
  const modal = document.getElementById('modal-type-form-backdrop');
  if (modal) modal.classList.remove('is-active');
  resetDropzone();
  state.editingTypeId = null;
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById('input-type-name');
  const descInput = document.getElementById('input-type-desc');
  const statusInput = document.getElementById('input-type-status');

  const name = (nameInput?.value || '').trim();
  const description = (descInput?.value || '').trim();
  const isActive = statusInput ? statusInput.checked : true;

  if (!name) {
    showToast('warning', 'Campo Requerido', 'Por favor ingresa el nombre del tipo de producto.');
    nameInput?.focus();
    return;
  }

  if (!description) {
    showToast('warning', 'Campo Requerido', 'Por favor ingresa una breve descripción.');
    descInput?.focus();
    return;
  }

  if (description.length > 100) {
    showToast('warning', 'Límite Superado', 'La descripción no puede exceder los 100 caracteres.');
    descInput?.focus();
    return;
  }

  // Verificar si hay imagen
  if (!state.editingTypeId && !state.selectedImageFile) {
    showToast('warning', 'Imagen Requerida', 'Por favor sube o selecciona una imagen representativa para este tipo de producto.');
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-type');
  if (btnSubmit) btnSubmit.disabled = true;

  try {
    let payload;
    // Si se seleccionó archivo físico de imagen, usamos FormData
    if (state.selectedImageFile) {
      const fd = new FormData();
      fd.append('product_type_name', name);
      fd.append('description', description);
      fd.append('product_type_image', state.selectedImageFile);
      fd.append('is_active', isActive);
      // Para persistencia en mock si falla el backend
      fd.append('product_type_image_url', URL.createObjectURL(state.selectedImageFile));
      payload = fd;
    } else {
      payload = {
        product_type_name: name,
        description: description,
        is_active: isActive,
        product_type_image: state.existingImageUrl || '../../assets/images/logo.jpeg'
      };
    }

    if (state.editingTypeId) {
      await updateProductType(state.editingTypeId, payload);
      showToast('success', 'Actualizado', `Tipo de producto "${name}" actualizado con éxito.`);
    } else {
      await createProductType(payload);
      showToast('success', 'Creado', `Tipo de producto "${name}" creado exitosamente.`);
    }

    closeFormModal();
    await loadTypes();
  } catch (err) {
    console.error('Error guardando tipo de producto:', err);
    const msg = err.data?.product_type_name?.[0] || err.data?.detail || err.message || 'Error al guardar el tipo de producto.';
    showToast('error', 'Error al Guardar', msg);
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

// ==========================================================================
// VISTA DETALLE (MODAL 2)
// ==========================================================================
function openViewModal(id) {
  const type = state.typesList.find(t => String(t.id) === String(id));
  if (!type) {
    showToast('error', 'Error', 'No se encontró la información del tipo de producto.');
    return;
  }

  state.selectedTypeId = id;

  const imgEl = document.getElementById('view-type-image');
  const titleEl = document.getElementById('view-type-title');
  const statusEl = document.getElementById('view-type-status');
  const countEl = document.getElementById('view-type-count');
  const idEl = document.getElementById('view-type-id');
  const descEl = document.getElementById('view-type-desc');

  const isActive = type.is_active !== false;
  const count = Number(type.count !== undefined ? type.count : (type.products_count !== undefined ? type.products_count : 0));

  if (imgEl) {
    const fullImg = type.product_type_image || '../../assets/images/logo.jpeg';
    imgEl.src = fullImg;
    imgEl.dataset.fullImg = fullImg;
    imgEl.dataset.title = type.product_type_name || 'Tipo de producto';
  }
  if (titleEl) titleEl.textContent = type.product_type_name;
  if (statusEl) {
    statusEl.className = `status-badge ${isActive ? 'status-active' : 'status-inactive'}`;
    statusEl.textContent = isActive ? 'Activa' : 'Inactiva';
  }
  if (countEl) countEl.textContent = `${count} ${count === 1 ? 'producto' : 'productos'}`;
  if (idEl) idEl.textContent = `#${type.id}`;
  if (descEl) descEl.textContent = type.description || 'Sin descripción registrada para este tipo de producto.';

  const modal = document.getElementById('modal-view-type-backdrop');
  if (modal) modal.classList.add('is-active');
}

function closeViewModal() {
  const modal = document.getElementById('modal-view-type-backdrop');
  if (modal) modal.classList.remove('is-active');
  state.selectedTypeId = null;
}

// ==========================================================================
// ELIMINACIÓN (MODAL 3)
// ==========================================================================
function openDeleteModal(id) {
  const type = state.typesList.find(t => String(t.id) === String(id));
  if (!type) {
    showToast('error', 'Error', 'No se encontró el tipo de producto.');
    return;
  }

  state.deletingTypeId = id;

  const msgEl = document.getElementById('confirm-delete-message');
  const warningBox = document.getElementById('confirm-delete-warning');
  const warningText = document.getElementById('confirm-warning-text');

  if (msgEl) {
    msgEl.innerHTML = `¿Estás seguro de que deseas eliminar la línea <strong>"${escapeHtml(type.product_type_name)}"</strong>? Esta acción no se puede deshacer.`;
  }

  const count = Number(type.count !== undefined ? type.count : (type.products_count !== undefined ? type.products_count : 0));
  if (count > 0) {
    if (warningBox) warningBox.style.display = 'flex';
    if (warningText) {
      warningText.textContent = `Atención: Este tipo tiene ${count} ${count === 1 ? 'producto asociado' : 'productos asociados'}.`;
    }
  } else {
    if (warningBox) warningBox.style.display = 'none';
  }

  const modal = document.getElementById('modal-delete-backdrop');
  if (modal) modal.classList.add('is-active');
}

function closeDeleteModal() {
  const modal = document.getElementById('modal-delete-backdrop');
  if (modal) modal.classList.remove('is-active');
  state.deletingTypeId = null;
}

async function handleConfirmDelete() {
  if (!state.deletingTypeId) return;

  const btnConfirm = document.getElementById('btn-confirm-delete');
  if (btnConfirm) btnConfirm.disabled = true;

  try {
    const success = await deleteProductType(state.deletingTypeId);
    if (success !== false) {
      showToast('success', 'Eliminado', 'El tipo de producto fue eliminado correctamente.');
      closeDeleteModal();
      await loadTypes();
    } else {
      showToast('error', 'Error', 'No se pudo eliminar el tipo de producto.');
    }
  } catch (err) {
    console.error('Error al eliminar tipo de producto:', err);
    const msg = err.data?.detail || err.message || 'Error al eliminar tipo de producto.';
    showToast('error', 'No se pudo eliminar', msg);
  } finally {
    if (btnConfirm) btnConfirm.disabled = false;
  }
}

// ==========================================================================
// UTILIDADES (TOAST, ESCAPADO, FORMATOS)
// ==========================================================================
function escapeHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div>
      <strong style="display: block; color: var(--text-main); margin-bottom: 2px;">${escapeHtml(title)}</strong>
      <span style="color: var(--text-muted);">${escapeHtml(message)}</span>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ==========================================================================
// VISUALIZADOR FLOTANTE DE IMÁGENES (LIGHTBOX)
// ==========================================================================
function setupLightbox() {
  const modal = document.getElementById('modal-image-lightbox');
  const closeBtn = document.getElementById('btn-close-lightbox');
  const viewTypeImg = document.getElementById('view-type-image');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeLightbox);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLightbox();
    });
  }

  // Tecla Escape para cerrar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const isLbActive = modal && modal.classList.contains('is-active');
      if (isLbActive) {
        closeLightbox();
      }
    }
  });

  // Al hacer clic en la imagen del modal detalle
  if (viewTypeImg) {
    viewTypeImg.addEventListener('click', () => {
      const fullImg = viewTypeImg.dataset.fullImg || viewTypeImg.src;
      const title = viewTypeImg.dataset.title || document.getElementById('view-type-title')?.textContent || 'Tipo de producto';
      if (fullImg) {
        openLightbox(fullImg, title);
      }
    });
  }
}

function openLightbox(imageUrl, title = 'Tipo de producto') {
  const modal = document.getElementById('modal-image-lightbox');
  const img = document.getElementById('lightbox-full-img');
  const caption = document.getElementById('lightbox-caption');

  if (!modal || !img) return;

  img.src = imageUrl;
  if (caption) caption.textContent = title;
  modal.classList.add('is-active');
}

function closeLightbox() {
  const modal = document.getElementById('modal-image-lightbox');
  if (modal) modal.classList.remove('is-active');
}

