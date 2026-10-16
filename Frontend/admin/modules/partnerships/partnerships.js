/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DEL MÓDULO DE EMPRESAS ALIADAS (PARTNERSHIPS.JS)
 * ==========================================================================
 * Controla el listado reactivo de empresas aliadas, búsqueda y filtros,
 * ordenamiento, paginación y todos los modales (Registrar, Editar, Ver detalles,
 * Alternar estado, Eliminar y Lightbox de logo).
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import {
  getPartnerships,
  createPartnership,
  updatePartnership,
  updatePartnershipStatus,
  deletePartnership,
  resolveImageUrl
} from './partnership.api.js';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showWarningToast
} from '../../components/toast/toast.js';

/**
 * ESTADO REACTIVO DEL MÓDULO
 */
const state = {
  partnerships: [],
  filters: {
    search: '',
    status: 'all',
    sort: 'newest'
  },
  currentPage: 1,
  pageSize: 8,
  activeViewPartner: null,
  activeEditPartner: null,
  activeStatusPartner: null,
  activeDeletePartner: null,
  createLogoFile: null,
  editLogoFile: null
};

/**
 * Escapa cadenas para prevenir ataques de inyección HTML.
 */
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
 * Genera iniciales de la empresa para avatar de respaldo.
 */
function getInitials(name) {
  if (!name) return 'EA';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Formatea el tamaño de un archivo en formato legible (KB / MB).
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  if (bytes < k * k) {
    return `${(bytes / k).toFixed(1)} KB`;
  }
  return `${(bytes / (k * k)).toFixed(1)} MB`;
}

/**
 * ==========================================================================
 * FILTRADO, ORDENAMIENTO Y PAGINACIÓN
 * ==========================================================================
 */
function getFilteredAndSortedPartners() {
  let list = [...state.partnerships];

  // 1. Filtro por término de búsqueda (nombre, sitio web o descripción)
  const q = state.filters.search.trim().toLowerCase();
  if (q) {
    list = list.filter(item => {
      const name = (item.name || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const web = (item.website || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || web.includes(q);
    });
  }

  // 2. Filtro por Estado (Activo / Inactivo)
  if (state.filters.status !== 'all') {
    const isActReq = state.filters.status === 'Activo';
    list = list.filter(item => item.is_active === isActReq);
  }

  // 3. Ordenamiento
  switch (state.filters.sort) {
    case 'newest':
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      break;
    case 'oldest':
      list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
      break;
    case 'name-asc':
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
      break;
    case 'name-desc':
      list.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'es'));
      break;
    default:
      break;
  }

  return list;
}

/**
 * ==========================================================================
 * RENDERIZADO DE LA TABLA DE EMPRESAS ALIADAS
 * ==========================================================================
 */
function renderPartnershipsTable() {
  const tbody = document.getElementById('partnerships-table-body');
  const countTag = document.getElementById('partnerships-count-tag');
  const infoText = document.getElementById('partnerships-pagination-info');
  const controlsBox = document.getElementById('partnerships-pagination-controls');

  if (!tbody) return;

  const filtered = getFilteredAndSortedPartners();
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  if (state.currentPage < 1) {
    state.currentPage = 1;
  }

  // Actualizar etiqueta contadora
  if (countTag) {
    countTag.textContent = `${totalItems} ${totalItems === 1 ? 'empresa' : 'empresas'}`;
  }

  // Estado vacío si no hay registros
  if (totalItems === 0) {
    tbody.innerHTML = `
      <tr class="table-empty-row">
        <td colspan="6">
          <div class="table-empty-state">
            <svg class="table-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="17" y1="8" x2="23" y2="14"></line>
              <line x1="23" y1="8" x2="17" y2="14"></line>
            </svg>
            <strong class="table-empty-title">No se encontraron empresas aliadas</strong>
            <p class="table-empty-desc">
              ${state.filters.search || state.filters.status !== 'all' 
                ? 'No hay empresas que coincidan con los filtros aplicados. Prueba restableciendo los criterios.' 
                : 'Aún no se han registrado empresas aliadas. Haz clic en "+ Registrar empresa" para añadir la primera.'}
            </p>
          </div>
        </td>
      </tr>
    `;

    if (infoText) infoText.textContent = 'Mostrando 0 a 0 de 0 empresas';
    if (controlsBox) controlsBox.innerHTML = '';
    return;
  }

  // Segmentación paginada
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, totalItems);
  const pagedItems = filtered.slice(startIndex, endIndex);

  // Renderizado de filas
  tbody.innerHTML = pagedItems.map(partner => {
    const hasLogo = Boolean(partner.logo);
    const resolvedLogo = hasLogo ? resolveImageUrl(partner.logo) : '';
    const isActive = partner.is_active !== false;

    return `
      <tr data-partner-id="${partner.id}">
        <!-- 1. Logo -->
        <td style="text-align: center;">
          <div class="partner-table-logo-box" data-action="lightbox" data-partner-id="${partner.id}" title="Click para ampliar logo">
            ${hasLogo ? `
              <img src="${resolvedLogo}" alt="${escapeHtml(partner.name)}" class="partner-table-logo-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="partner-table-fallback-avatar" style="display: none;">
                <span>${getInitials(partner.name)}</span>
              </div>
            ` : `
              <div class="partner-table-fallback-avatar">
                <span>${getInitials(partner.name)}</span>
              </div>
            `}
          </div>
        </td>

        <!-- 2. Nombre de la empresa -->
        <td>
          <div class="partner-table-name-box">
            <span class="partner-table-name">${escapeHtml(partner.name)}</span>
            <span class="partner-table-id">ID #${partner.id}</span>
          </div>
        </td>

        <!-- 3. Descripción -->
        <td>
          <span class="partner-table-desc" title="${escapeHtml(partner.description || '')}">
            ${escapeHtml(partner.description || 'Sin descripción')}
          </span>
        </td>

        <!-- 5. Fecha de registro -->
        <td style="white-space: nowrap; color: #64748b; font-size: 0.825rem;">
          ${partner.formatted_date || '-'}
        </td>

        <!-- 6. Estado -->
        <td style="text-align: center;">
          <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">
            ${isActive ? 'Activo' : 'Inactivo'}
          </span>
        </td>

        <!-- 7. Acciones -->
        <td style="text-align: right;">
          <div class="table-actions-group">
            <!-- Ver detalles -->
            <button type="button" class="table-action-btn" data-action="view" data-partner-id="${partner.id}" title="Ver detalles completos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>

            <!-- Editar -->
            <button type="button" class="table-action-btn" data-action="edit" data-partner-id="${partner.id}" title="Editar empresa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>

            <!-- Cambiar estado -->
            <button type="button" class="table-action-btn btn-action-status" data-action="status" data-partner-id="${partner.id}" title="${isActive ? 'Desactivar empresa' : 'Activar empresa'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                <line x1="12" y1="2" x2="12" y2="12"></line>
              </svg>
            </button>

            <!-- Eliminar -->
            <button type="button" class="table-action-btn btn-action-delete" data-action="delete" data-partner-id="${partner.id}" title="Eliminar empresa">
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

  // Actualizar barra de paginación
  if (infoText) {
    infoText.textContent = `Mostrando ${startIndex + 1} a ${endIndex} de ${totalItems} ${totalItems === 1 ? 'empresa' : 'empresas'}`;
  }

  if (controlsBox) {
    let paginationHtml = '';

    // Botón Anterior
    paginationHtml += `
      <button type="button" class="pagination-btn" id="pagination-prev" ${state.currentPage === 1 ? 'disabled' : ''} aria-label="Página anterior">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
    `;

    // Botones numéricos
    for (let p = 1; p <= totalPages; p++) {
      paginationHtml += `
        <button type="button" class="pagination-btn ${p === state.currentPage ? 'active' : ''}" data-page="${p}">
          ${p}
        </button>
      `;
    }

    // Botón Siguiente
    paginationHtml += `
      <button type="button" class="pagination-btn" id="pagination-next" ${state.currentPage === totalPages ? 'disabled' : ''} aria-label="Página siguiente">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `;

    controlsBox.innerHTML = paginationHtml;
  }
}

/**
 * ==========================================================================
 * GESTIÓN DE MODALES (ABRIR / CERRAR)
 * ==========================================================================
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('is-open');
    // Si no quedan modales abiertos, restaurar scroll de la ventana
    if (!document.querySelector('.modal-backdrop.is-open, .lightbox-backdrop.is-open')) {
      document.body.style.overflow = '';
    }
  }
}

/**
 * ==========================================================================
 * MODAL 1: REGISTRAR EMPRESA ALIADA
 * ==========================================================================
 */
function setupCreateModal() {
  const openBtn = document.getElementById('btn-open-create-modal');
  const closeBtn = document.getElementById('btn-close-create');
  const cancelBtn = document.getElementById('btn-cancel-create');
  const form = document.getElementById('form-create-partnership');
  const fileInput = document.getElementById('create-logo-input');
  const triggerBtn = document.getElementById('btn-trigger-create-logo');
  const removeBtn = document.getElementById('btn-remove-create-logo');
  const uploadBox = document.getElementById('create-logo-upload-box');
  const placeholder = document.getElementById('create-logo-placeholder');
  const preview = document.getElementById('create-logo-preview');
  const previewImg = document.getElementById('create-logo-preview-img');
  const previewName = document.getElementById('create-logo-preview-name');
  const previewSize = document.getElementById('create-logo-preview-size');
  const submitBtn = document.getElementById('btn-submit-create');

  function resetCreateForm() {
    form.reset();
    state.createLogoFile = null;
    fileInput.value = '';
    placeholder.style.display = 'flex';
    preview.style.display = 'none';
    previewImg.src = '';
    document.getElementById('create-name').closest('.form-group').classList.remove('has-error');
  }

  function handleFileSelected(file) {
    if (!file) return;

    // Validación de tipo de archivo
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      showErrorToast('Formato no válido', 'Solo se permiten imágenes en formato PNG, JPG, WEBP o SVG.');
      return;
    }

    // Validación de tamaño (máximo 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      showErrorToast('Archivo demasiado pesado', 'El logo no debe superar los 5 MB de tamaño.');
      return;
    }

    state.createLogoFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src = e.target.result;
      previewName.textContent = file.name;
      previewSize.textContent = formatFileSize(file.size);
      placeholder.style.display = 'none';
      preview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      resetCreateForm();
      openModal('modal-create');
      setTimeout(() => {
        document.getElementById('create-name')?.focus();
      }, 100);
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modal-create'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('modal-create'));

  // Trigger para selección de archivo
  if (triggerBtn && fileInput) {
    triggerBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelected(e.target.files[0]);
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      state.createLogoFile = null;
      fileInput.value = '';
      placeholder.style.display = 'flex';
      preview.style.display = 'none';
      previewImg.src = '';
    });
  }

  // Drag & drop en dropzone
  if (uploadBox) {
    ['dragenter', 'dragover'].forEach(evt => {
      uploadBox.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      uploadBox.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.remove('is-dragover');
      });
    });

    uploadBox.addEventListener('drop', e => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  // Envío del formulario
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nameInput = document.getElementById('create-name');
      const nameGroup = nameInput.closest('.form-group');
      const nameVal = nameInput.value.trim();

      if (!nameVal) {
        nameGroup.classList.add('has-error');
        nameInput.focus();
        return;
      }
      nameGroup.classList.remove('has-error');

      const descVal = document.getElementById('create-description').value.trim();
      const isActiveVal = document.getElementById('create-is-active').checked;

      // Estado de carga en botón
      const spinner = submitBtn.querySelector('.btn-spinner');
      const textSpan = submitBtn.querySelector('span');
      submitBtn.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (textSpan) textSpan.textContent = 'Guardando...';

      try {
        const formData = new FormData();
        formData.append('name', nameVal);
        if (descVal) formData.append('description', descVal);
        formData.append('is_active', String(isActiveVal));

        if (state.createLogoFile) {
          formData.append('logo', state.createLogoFile);
        }

        const created = await createPartnership(formData);
        showSuccessToast('Empresa registrada', `La empresa "${created.name}" fue agregada exitosamente.`);

        // Actualizar lista en pantalla
        state.partnerships = await getPartnerships();
        renderPartnershipsTable();

        closeModal('modal-create');
        resetCreateForm();
      } catch (err) {
        console.error('Error creando empresa aliada:', err);
        const msg = err && err.message ? err.message : 'No se pudo registrar la empresa aliada.';
        showErrorToast('Error al registrar', msg);
      } finally {
        submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (textSpan) textSpan.textContent = 'Guardar empresa';
      }
    });
  }
}

/**
 * ==========================================================================
 * MODAL 2: EDITAR EMPRESA ALIADA
 * ==========================================================================
 */
function setupEditModal() {
  const closeBtn = document.getElementById('btn-close-edit');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  const form = document.getElementById('form-edit-partnership');
  const fileInput = document.getElementById('edit-logo-input');
  const triggerBtn = document.getElementById('btn-trigger-edit-logo');
  const removeBtn = document.getElementById('btn-remove-edit-logo');
  const uploadBox = document.getElementById('edit-logo-upload-box');
  const placeholder = document.getElementById('edit-logo-placeholder');
  const preview = document.getElementById('edit-logo-preview');
  const previewImg = document.getElementById('edit-logo-preview-img');
  const previewName = document.getElementById('edit-logo-preview-name');
  const previewSize = document.getElementById('edit-logo-preview-size');
  const submitBtn = document.getElementById('btn-submit-edit');

  function openEditForPartner(partner) {
    state.activeEditPartner = partner;
    state.editLogoFile = null;
    fileInput.value = '';

    document.getElementById('edit-partnership-id').value = partner.id;
    document.getElementById('edit-name').value = partner.name || '';
    document.getElementById('edit-description').value = partner.description || '';
    document.getElementById('edit-is-active').checked = partner.is_active !== false;

    // Logo actual
    if (partner.logo) {
      previewImg.src = resolveImageUrl(partner.logo);
      previewName.textContent = partner.logo_raw ? partner.logo_raw.split('/').pop() : 'logo_empresa.png';
      previewSize.textContent = 'Logo actual';
      placeholder.style.display = 'none';
      preview.style.display = 'flex';
    } else {
      placeholder.style.display = 'flex';
      preview.style.display = 'none';
      previewImg.src = '';
    }

    openModal('modal-edit');
  }

  function handleFileSelected(file) {
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      showErrorToast('Formato no válido', 'Solo se permiten imágenes en formato PNG, JPG, WEBP o SVG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showErrorToast('Archivo demasiado pesado', 'El logo no debe superar los 5 MB de tamaño.');
      return;
    }

    state.editLogoFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src = e.target.result;
      previewName.textContent = file.name;
      previewSize.textContent = `${formatFileSize(file.size)} (Nuevo logo)`;
      placeholder.style.display = 'none';
      preview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modal-edit'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('modal-edit'));

  if (triggerBtn && fileInput) {
    triggerBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelected(e.target.files[0]);
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      state.editLogoFile = null;
      fileInput.value = '';
      placeholder.style.display = 'flex';
      preview.style.display = 'none';
      previewImg.src = '';
    });
  }

  if (uploadBox) {
    ['dragenter', 'dragover'].forEach(evt => {
      uploadBox.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      uploadBox.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.remove('is-dragover');
      });
    });

    uploadBox.addEventListener('drop', e => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const id = document.getElementById('edit-partnership-id').value;
      const nameInput = document.getElementById('edit-name');
      const nameGroup = nameInput.closest('.form-group');
      const nameVal = nameInput.value.trim();

      if (!nameVal) {
        nameGroup.classList.add('has-error');
        nameInput.focus();
        return;
      }
      nameGroup.classList.remove('has-error');

      const descVal = document.getElementById('edit-description').value.trim();
      const isActiveVal = document.getElementById('edit-is-active').checked;

      const spinner = submitBtn.querySelector('.btn-spinner');
      const textSpan = submitBtn.querySelector('span');
      submitBtn.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (textSpan) textSpan.textContent = 'Guardando...';

      try {
        const formData = new FormData();
        formData.append('name', nameVal);
        formData.append('description', descVal);
        formData.append('is_active', String(isActiveVal));

        if (state.editLogoFile) {
          formData.append('logo', state.editLogoFile);
        }

        await updatePartnership(id, formData);
        showSuccessToast('Empresa actualizada', `Los datos de "${nameVal}" se actualizaron con éxito.`);

        state.partnerships = await getPartnerships();
        renderPartnershipsTable();

        closeModal('modal-edit');
      } catch (err) {
        console.error('Error actualizando empresa aliada:', err);
        const msg = err && err.message ? err.message : 'No se pudieron guardar los cambios.';
        showErrorToast('Error al actualizar', msg);
      } finally {
        submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (textSpan) textSpan.textContent = 'Guardar cambios';
      }
    });
  }

  return { openEditForPartner };
}

/**
 * ==========================================================================
 * MODAL 3: VER DETALLES DE LA EMPRESA
 * ==========================================================================
 */
function setupViewModal(editModalController) {
  const closeBtn = document.getElementById('btn-close-view');
  const closeFooterBtn = document.getElementById('btn-close-view-footer');
  const editBtn = document.getElementById('btn-view-to-edit');

  function openViewForPartner(partner) {
    state.activeViewPartner = partner;

    const nameEl = document.getElementById('view-name');
    const badgeEl = document.getElementById('view-status-badge');
    const dateEl = document.getElementById('view-date-tag');
    const imgEl = document.getElementById('view-logo-img');
    const fallbackEl = document.getElementById('view-logo-fallback');
    const descEl = document.getElementById('view-description');

    if (nameEl) nameEl.textContent = partner.name || 'Sin nombre';

    const isActive = partner.is_active !== false;
    if (badgeEl) {
      badgeEl.className = `status-badge ${isActive ? 'status-active' : 'status-inactive'}`;
      badgeEl.textContent = isActive ? 'Activo' : 'Inactivo';
    }

    if (dateEl) {
      dateEl.textContent = partner.formatted_date ? `Registrado: ${partner.formatted_date}` : 'Fecha no registrada';
    }

    if (partner.logo) {
      imgEl.src = resolveImageUrl(partner.logo);
      imgEl.style.display = 'block';
      fallbackEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      fallbackEl.style.display = 'flex';
    }

    if (descEl) {
      descEl.textContent = partner.description || 'Esta empresa no tiene una descripción detallada registrada.';
    }

    openModal('modal-view');
  }

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modal-view'));
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', () => closeModal('modal-view'));

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const partner = state.activeViewPartner;
      closeModal('modal-view');
      if (partner && editModalController) {
        editModalController.openEditForPartner(partner);
      }
    });
  }

  // Permitir click en el logo para ver lightbox
  const logoWrapper = document.getElementById('view-logo-container');
  if (logoWrapper) {
    logoWrapper.addEventListener('click', () => {
      if (state.activeViewPartner && state.activeViewPartner.logo) {
        openLightbox(state.activeViewPartner.logo, state.activeViewPartner.name);
      }
    });
  }

  return { openViewForPartner };
}

/**
 * ==========================================================================
 * MODAL 4: CAMBIAR ESTADO (ACTIVO / INACTIVO)
 * ==========================================================================
 */
function setupStatusModal() {
  const closeBtn = document.getElementById('btn-close-status');
  const cancelBtn = document.getElementById('btn-cancel-status');
  const confirmBtn = document.getElementById('btn-confirm-status');
  const msgEl = document.getElementById('status-change-message');
  const nameEl = document.getElementById('status-preview-name');
  const badgeEl = document.getElementById('status-preview-next-badge');

  function openStatusForPartner(partner) {
    state.activeStatusPartner = partner;
    const currentIsActive = partner.is_active !== false;
    const nextIsActive = !currentIsActive;

    if (nameEl) nameEl.textContent = partner.name;
    if (msgEl) {
      msgEl.textContent = `¿Deseas cambiar el estado de la empresa de "${currentIsActive ? 'Activo' : 'Inactivo'}" a "${nextIsActive ? 'Activo' : 'Inactivo'}"?`;
    }

    if (badgeEl) {
      badgeEl.className = `status-badge ${nextIsActive ? 'status-active' : 'status-inactive'}`;
      badgeEl.textContent = nextIsActive ? 'Activo' : 'Inactivo';
    }

    openModal('modal-status');
  }

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modal-status'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('modal-status'));

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!state.activeStatusPartner) return;
      const partner = state.activeStatusPartner;
      const nextIsActive = !(partner.is_active !== false);

      confirmBtn.disabled = true;
      try {
        await updatePartnershipStatus(partner.id, nextIsActive);
        showSuccessToast('Estado actualizado', `"${partner.name}" ahora está en estado ${nextIsActive ? 'Activo' : 'Inactivo'}.`);

        state.partnerships = await getPartnerships();
        renderPartnershipsTable();
        closeModal('modal-status');
      } catch (err) {
        console.error('Error al cambiar estado:', err);
        showErrorToast('Error', 'No se pudo modificar el estado de la empresa.');
      } finally {
        confirmBtn.disabled = false;
      }
    });
  }

  return { openStatusForPartner };
}

/**
 * ==========================================================================
 * MODAL 5: CONFIRMAR ELIMINACIÓN
 * ==========================================================================
 */
function setupDeleteModal() {
  const closeBtn = document.getElementById('btn-close-delete');
  const cancelBtn = document.getElementById('btn-cancel-delete');
  const confirmBtn = document.getElementById('btn-confirm-delete');
  const nameEl = document.getElementById('delete-preview-name');
  const thumbEl = document.getElementById('delete-preview-thumb');

  function openDeleteForPartner(partner) {
    state.activeDeletePartner = partner;
    if (nameEl) nameEl.textContent = partner.name;
    if (thumbEl) {
      if (partner.logo) {
        thumbEl.src = resolveImageUrl(partner.logo);
        thumbEl.style.display = 'block';
      } else {
        thumbEl.style.display = 'none';
      }
    }

    openModal('modal-delete');
  }

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modal-delete'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('modal-delete'));

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!state.activeDeletePartner) return;
      const partner = state.activeDeletePartner;

      confirmBtn.disabled = true;
      try {
        await deletePartnership(partner.id);
        showSuccessToast('Empresa eliminada', `Se eliminó "${partner.name}" correctamente.`);

        state.partnerships = await getPartnerships();
        renderPartnershipsTable();
        closeModal('modal-delete');
      } catch (err) {
        console.error('Error al eliminar empresa:', err);
        showErrorToast('Error', 'No se pudo eliminar la empresa aliada.');
      } finally {
        confirmBtn.disabled = false;
      }
    });
  }

  return { openDeleteForPartner };
}

/**
 * ==========================================================================
 * MODAL 6: LIGHTBOX (AMPLIAR LOGO)
 * ==========================================================================
 */
function openLightbox(imageUrl, title) {
  const modal = document.getElementById('lightbox-modal');
  const imgEl = document.getElementById('lightbox-img');
  const captionEl = document.getElementById('lightbox-caption');

  if (!modal || !imgEl) return;

  imgEl.src = resolveImageUrl(imageUrl);
  if (captionEl) captionEl.textContent = title || 'Logo de la empresa';

  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function setupLightbox() {
  const modal = document.getElementById('lightbox-modal');
  const closeBtn = document.getElementById('btn-close-lightbox');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal('lightbox-modal'));
  }

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        closeModal('lightbox-modal');
      }
    });
  }
}

/**
 * ==========================================================================
 * DELEGACIÓN DE ACCIONES EN LA TABLA
 * ==========================================================================
 */
function setupTableActions(controllers) {
  const table = document.getElementById('partnerships-table');
  if (!table) return;

  table.addEventListener('click', e => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.dataset.action;
    const partnerId = trigger.dataset.partnerId;
    if (!partnerId) return;

    const partner = state.partnerships.find(p => String(p.id) === String(partnerId));
    if (!partner) return;

    switch (action) {
      case 'view':
        controllers.view.openViewForPartner(partner);
        break;
      case 'edit':
        controllers.edit.openEditForPartner(partner);
        break;
      case 'status':
        controllers.status.openStatusForPartner(partner);
        break;
      case 'delete':
        controllers.delete.openDeleteForPartner(partner);
        break;
      case 'lightbox':
        if (partner.logo) {
          openLightbox(partner.logo, partner.name);
        } else {
          controllers.view.openViewForPartner(partner);
        }
        break;
      default:
        break;
    }
  });

  // Delegación de paginación
  const paginationControls = document.getElementById('partnerships-pagination-controls');
  if (paginationControls) {
    paginationControls.addEventListener('click', e => {
      const btn = e.target.closest('.pagination-btn');
      if (!btn || btn.disabled) return;

      if (btn.id === 'pagination-prev') {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderPartnershipsTable();
        }
      } else if (btn.id === 'pagination-next') {
        const filtered = getFilteredAndSortedPartners();
        const totalPages = Math.ceil(filtered.length / state.pageSize);
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderPartnershipsTable();
        }
      } else if (btn.dataset.page) {
        state.currentPage = parseInt(btn.dataset.page, 10);
        renderPartnershipsTable();
      }
    });
  }
}

/**
 * ==========================================================================
 * LISTENERS DE BÚSQUEDA Y FILTROS
 * ==========================================================================
 */
function setupFilterListeners() {
  const searchInput = document.getElementById('filter-search');
  const statusSelect = document.getElementById('filter-status');
  const sortSelect = document.getElementById('filter-sort');
  const clearBtn = document.getElementById('btn-clear-filters');

  let debounceTimer = null;

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.filters.search = e.target.value;
        state.currentPage = 1;
        renderPartnershipsTable();
      }, 250);
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', e => {
      state.filters.status = e.target.value;
      state.currentPage = 1;
      renderPartnershipsTable();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      state.filters.sort = e.target.value;
      renderPartnershipsTable();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (statusSelect) statusSelect.value = 'all';
      if (sortSelect) sortSelect.value = 'newest';

      state.filters.search = '';
      state.filters.status = 'all';
      state.filters.sort = 'newest';
      state.currentPage = 1;

      renderPartnershipsTable();
      showInfoToast('Filtros restablecidos', 'Se muestran todas las empresas aliadas.');
    });
  }
}

/**
 * Cierra modales al presionar la tecla Escape o al hacer clic en el backdrop
 */
function setupGlobalModalDismiss() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal-backdrop.is-open, .lightbox-backdrop.is-open');
      openModals.forEach(m => closeModal(m.id));
    }
  });

  const backdrops = document.querySelectorAll('.modal-backdrop');
  backdrops.forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) {
        closeModal(backdrop.id);
      }
    });
  });
}

/**
 * ==========================================================================
 * INICIALIZACIÓN PRINCIPAL DEL MÓDULO
 * ==========================================================================
 */
async function initPartnershipsModule() {
  try {
    // 1. Cargar componentes globales del panel (Drawer, Navbar, Footer)
    await loadAdminComponents({ title: 'Empresas Aliadas' });

    // 2. Configurar controladores de modales
    setupCreateModal();
    const editCtrl = setupEditModal();
    const viewCtrl = setupViewModal(editCtrl);
    const statusCtrl = setupStatusModal();
    const deleteCtrl = setupDeleteModal();
    setupLightbox();

    // 3. Configurar delegación de eventos y filtros
    setupTableActions({
      view: viewCtrl,
      edit: editCtrl,
      status: statusCtrl,
      delete: deleteCtrl
    });
    setupFilterListeners();
    setupGlobalModalDismiss();

    // 4. Cargar datos desde la API del backend
    state.partnerships = await getPartnerships();

    // 5. Renderizar vista inicial
    renderPartnershipsTable();

    console.log('%c[TuEstante Admin] Módulo de Empresas Aliadas inicializado con éxito.', 'background: #005187; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  } catch (error) {
    console.error('[TuEstante Admin] Error al inicializar módulo de Empresas Aliadas:', error);
  }
}

// Inicialización al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPartnershipsModule);
} else {
  initPartnershipsModule();
}
