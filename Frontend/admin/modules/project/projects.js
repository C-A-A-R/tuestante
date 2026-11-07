/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DEL MÓDULO DE PROYECTOS (PROJECTS.JS)
 * ==========================================================================
 * Controla la visualización del listado de proyectos, filtros reactivos,
 * ordenamiento, paginación, descarga de PDFs y los 5 modales interactivos
 * (Registrar, Ver, Editar, Cambiar estado y Eliminar).
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import {
  getProjects,
  createProject,
  updateProject,
  updateProjectStatus,
  deleteProject
} from './project.api.js';

/**
 * ESTADO GLOBAL DEL MÓDULO DE PROYECTOS
 */
const state = {
  projects: [],
  filters: {
    search: '',
    status: 'all',
    sort: 'newest'
  },
  currentPage: 1,
  pageSize: 5,
  activeViewProject: null,
  activeEditProject: null,
  activeStatusProject: null,
  activeDeleteProject: null,
  activePopoverMenu: null,
  createDocFile: null,
  createImgFile: null,
  editDocFile: null,
  editImgFile: null
};

/**
 * ==========================================================================
 * RENDERIZADO DE LA TABLA DE PROYECTOS
 * ==========================================================================
 */

/**
 * Escapa strings para prevenir inyecciones XSS.
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
 * Aplica filtros y ordenamiento a la lista de proyectos.
 */
function getFilteredAndSortedProjects() {
  const { search, status, sort } = state.filters;
  const searchLower = search.trim().toLowerCase();

  let filtered = state.projects.filter(p => {
    // 1. Búsqueda por nombre o descripción
    if (searchLower) {
      const matchName = (p.project_name || '').toLowerCase().includes(searchLower);
      const matchDesc = (p.description || '').toLowerCase().includes(searchLower);
      if (!matchName && !matchDesc) return false;
    }

    // 2. Filtro Estado
    if (status !== 'all') {
      const itemStatus = p.is_active ? 'Activo' : 'Inactivo';
      if (itemStatus.toLowerCase() !== status.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  // 3. Ordenamiento
  filtered.sort((a, b) => {
    if (sort === 'newest') {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }
    if (sort === 'oldest') {
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    }
    if (sort === 'name-asc') {
      return (a.project_name || '').localeCompare(b.project_name || '');
    }
    if (sort === 'name-desc') {
      return (b.project_name || '').localeCompare(a.project_name || '');
    }
    return 0;
  });

  return filtered;
}

/**
 * Renderiza el listado de proyectos en el <tbody>.
 */
function renderProjectsTable() {
  const tbody = document.getElementById('projects-table-body');
  const countTag = document.getElementById('projects-count-tag');
  const infoText = document.getElementById('projects-pagination-info');
  const controls = document.getElementById('projects-pagination-controls');

  if (!tbody) return;

  const filtered = getFilteredAndSortedProjects();
  const totalItems = filtered.length;

  if (countTag) {
    countTag.textContent = `${totalItems} ${totalItems === 1 ? 'proyecto' : 'proyectos'}`;
  }

  if (totalItems === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="table-empty-state">
            <div class="table-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </div>
            <h4 class="table-empty-title">No se encontraron proyectos</h4>
            <p class="table-empty-desc">No hay proyectos que coincidan con los criterios de búsqueda o aún no se han registrado proyectos en el sistema.</p>
          </div>
        </td>
      </tr>
    `;
    if (infoText) infoText.textContent = 'Mostrando 0 proyectos';
    if (controls) controls.innerHTML = '';
    return;
  }

  // Paginación
  const totalPages = Math.ceil(totalItems / state.pageSize);
  if (state.currentPage > totalPages) state.currentPage = totalPages || 1;
  const startIdx = (state.currentPage - 1) * state.pageSize;
  const endIdx = Math.min(startIdx + state.pageSize, totalItems);
  const pagedItems = filtered.slice(startIdx, endIdx);

  if (infoText) {
    infoText.textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${totalItems} proyectos`;
  }

  tbody.innerHTML = pagedItems.map(p => `
    <tr data-project-id="${p.id}">
      <!-- 1. Miniatura Multimedia (Al hacer clic se amplía a pantalla completa) -->
      <td>
        <div class="media-thumbnail-wrapper btn-open-lightbox" 
             data-img-src="${escapeHtml(p.project_images)}" 
             data-caption="${escapeHtml(p.project_name)}" 
             title="Clic para ampliar imagen a pantalla completa">
          <img src="${escapeHtml(p.project_images)}" alt="Miniatura" class="media-thumbnail-img" onerror="this.src='../../assets/images/logo.jpeg'">
          <div class="media-thumbnail-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </div>
        </div>
      </td>

      <!-- 2. Nombre del Proyecto -->
      <td>
        <span class="project-name-cell">${escapeHtml(p.project_name)}</span>
      </td>

      <!-- 3. Descripción -->
      <td>
        <div class="project-desc-cell" title="${escapeHtml(p.description || '')}">
          ${escapeHtml(p.description || '-')}
        </div>
      </td>

      <!-- 4. Documento PDF Descargable -->
      <td>
        ${p.project_document ? `
          <a href="${escapeHtml(p.project_document)}" target="_blank" download="${escapeHtml(p.doc_name || 'proyecto.pdf')}" class="doc-pdf-pill" title="Descargar o ver documento PDF">
            <svg class="doc-pdf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>${escapeHtml(p.doc_name || 'Documento.pdf')}</span>
            <span class="doc-pdf-size">(${escapeHtml(p.doc_size || 'PDF')})</span>
          </a>
        ` : `<span style="color: #94a3b8; font-size: 0.82rem;">Sin documento</span>`}
      </td>

      <!-- 5. Fecha de Creación -->
      <td style="font-size: 0.835rem; color: #475569; white-space: nowrap;">
        ${escapeHtml(p.formatted_date || '-')}
      </td>

      <!-- 6. Estado -->
      <td style="text-align: center;">
        <span class="badge-status ${p.is_active ? 'badge-status-active' : 'badge-status-inactive'}">
          ${p.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </td>

      <!-- 7. Acciones -->
      <td style="text-align: right;">
        <div class="actions-cell-wrapper">
          <!-- Ver Proyecto (Ojo) -->
          <button type="button" class="btn-action-icon btn-action-view" data-project-id="${p.id}" title="Ver proyecto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>

          <!-- Editar Proyecto (Lápiz) -->
          <button type="button" class="btn-action-icon btn-action-edit" data-project-id="${p.id}" title="Editar proyecto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>

          <!-- Menú de 3 Puntos -->
          <button type="button" class="btn-action-icon btn-toggle-popover" data-project-id="${p.id}" aria-label="Más opciones" title="Más opciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>

          <!-- Popover Desplegable -->
          <div class="action-popover-menu" id="popover-project-${p.id}">
            <button type="button" class="popover-item-btn btn-action-status" data-project-id="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Cambiar estado</span>
            </button>
            ${p.project_document ? `
              <a href="${escapeHtml(p.project_document)}" download="${escapeHtml(p.doc_name || 'proyecto.pdf')}" class="popover-item-btn" style="text-decoration: none;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Descargar doc</span>
              </a>
            ` : ''}
            <button type="button" class="popover-item-btn btn-delete-danger btn-action-delete" data-project-id="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  // Controles de Paginación
  if (controls) {
    let paginationHtml = `
      <button type="button" class="pagination-page-btn" id="btn-proj-prev" ${state.currentPage <= 1 ? 'disabled' : ''}>
        &lt;
      </button>
    `;
    for (let p = 1; p <= totalPages; p++) {
      paginationHtml += `
        <button type="button" class="pagination-page-btn ${p === state.currentPage ? 'active' : ''}" data-page="${p}">
          ${p}
        </button>
      `;
    }
    paginationHtml += `
      <button type="button" class="pagination-page-btn" id="btn-proj-next" ${state.currentPage >= totalPages ? 'disabled' : ''}>
        &gt;
      </button>
    `;
    controls.innerHTML = paginationHtml;

    // Listeners de paginación
    controls.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentPage = Number(btn.getAttribute('data-page'));
        renderProjectsTable();
      });
    });
    const prevBtn = controls.querySelector('#btn-proj-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderProjectsTable();
        }
      });
    }
    const nextBtn = controls.querySelector('#btn-proj-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderProjectsTable();
        }
      });
    }
  }
}

/**
 * ==========================================================================
 * GESTIÓN DE MODALES
 * ==========================================================================
 */

/**
 * Abre el Lightbox a pantalla completa al presionar cualquier miniatura multimedia.
 */
function openLightbox(imgSrc, caption = '') {
  const modal = document.getElementById('lightbox-modal');
  const imgEl = document.getElementById('lightbox-img');
  const capEl = document.getElementById('lightbox-caption');

  if (!modal || !imgEl) return;

  imgEl.src = imgSrc || '../../assets/images/logo.jpeg';
  if (capEl) {
    capEl.textContent = caption || 'Imagen del Proyecto';
    capEl.style.display = caption ? 'block' : 'none';
  }

  modal.classList.add('is-open');
}

function closeLightbox() {
  const modal = document.getElementById('lightbox-modal');
  if (modal) modal.classList.remove('is-open');
}

/**
 * Modal 1: Registrar Proyecto
 */
function openCreateModal() {
  const modal = document.getElementById('modal-create');
  const form = document.getElementById('form-create-project');
  if (!modal) return;

  if (form) form.reset();

  state.createDocFile = null;
  state.createImgFile = null;

  const docPreview = document.getElementById('create-doc-preview');
  const imgPreview = document.getElementById('create-img-preview');
  if (docPreview) docPreview.classList.remove('has-file');
  if (imgPreview) imgPreview.classList.remove('has-file');

  modal.classList.add('is-open');
}

function closeCreateModal() {
  const modal = document.getElementById('modal-create');
  if (modal) modal.classList.remove('is-open');
}

/**
 * Modal 2: Ver Proyecto
 */
function openViewModal(project) {
  state.activeViewProject = project;

  const modal = document.getElementById('modal-view');
  if (!modal) return;

  document.getElementById('view-img').src = project.project_images || '../../assets/images/logo.jpeg';
  document.getElementById('view-name').textContent = project.project_name || 'Sin título';
  document.getElementById('view-description').textContent = project.description || 'Sin descripción disponible.';
  document.getElementById('view-date').textContent = project.formatted_date || '-';

  const statusBadge = document.getElementById('view-status-badge');
  if (statusBadge) {
    statusBadge.className = `badge-status ${project.is_active ? 'badge-status-active' : 'badge-status-inactive'}`;
    statusBadge.textContent = project.is_active ? 'Activo' : 'Inactivo';
  }

  const docContainer = document.getElementById('view-doc-container');
  if (docContainer) {
    if (project.project_document) {
      docContainer.innerHTML = `
        <a href="${escapeHtml(project.project_document)}" target="_blank" download="${escapeHtml(project.doc_name || 'proyecto.pdf')}" class="doc-pdf-pill">
          <svg class="doc-pdf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span>${escapeHtml(project.doc_name || 'Proyecto.pdf')}</span>
          <span class="doc-pdf-size">(${escapeHtml(project.doc_size || 'PDF')})</span>
        </a>
      `;
    } else {
      docContainer.innerHTML = `<span style="color: #94a3b8; font-size: 0.84rem;">Sin documento adjunto</span>`;
    }
  }

  modal.classList.add('is-open');
}

function closeViewModal() {
  const modal = document.getElementById('modal-view');
  if (modal) modal.classList.remove('is-open');
  state.activeViewProject = null;
}

/**
 * Modal 3: Editar Proyecto
 */
function openEditModal(project) {
  state.activeEditProject = project;
  state.editDocFile = null;
  state.editImgFile = null;

  const modal = document.getElementById('modal-edit');
  if (!modal) return;

  document.getElementById('edit-project-id').value = project.id;
  document.getElementById('edit-name').value = project.project_name || '';
  document.getElementById('edit-description').value = project.description || '';

  // Documento actual
  const docBox = document.getElementById('edit-doc-current-box');
  if (docBox) {
    document.getElementById('edit-doc-name').textContent = project.doc_name || 'Documento.pdf';
    document.getElementById('edit-doc-size').textContent = project.doc_size || '';
    docBox.classList.add('has-file');
  }

  // Imagen actual
  const imgBox = document.getElementById('edit-img-current-box');
  if (imgBox) {
    document.getElementById('edit-img-thumb').src = project.project_images || '../../assets/images/logo.jpeg';
    document.getElementById('edit-img-name').textContent = project.image_name || 'imagen.jpg';
    document.getElementById('edit-img-size').textContent = project.image_size || '';
    imgBox.classList.add('has-file');
  }

  modal.classList.add('is-open');
}

function closeEditModal() {
  const modal = document.getElementById('modal-edit');
  if (modal) modal.classList.remove('is-open');
  state.activeEditProject = null;
}

/**
 * Modal 4: Confirmar Cambio de Estado (Activo / Inactivo)
 */
function openStatusModal(project) {
  state.activeStatusProject = project;

  const modal = document.getElementById('modal-status');
  if (!modal) return;

  const isCurrentlyActive = Boolean(project.is_active);
  const targetStatus = isCurrentlyActive ? 'Inactivo' : 'Activo';

  document.getElementById('status-project-id').value = project.id;
  const targetInput = document.getElementById('status-target-value');
  if (targetInput) targetInput.value = targetStatus;

  const banner = document.getElementById('status-confirm-banner');
  const title = document.getElementById('status-confirm-title');
  const desc = document.getElementById('status-confirm-desc');
  const submitBtn = document.getElementById('btn-submit-status');
  const icon = document.getElementById('status-confirm-icon');
  const modalTitle = document.getElementById('status-modal-title');

  if (isCurrentlyActive) {
    // Si está activo -> Confirmar ponerlo Inactivo
    if (modalTitle) modalTitle.textContent = 'Desactivar proyecto';
    if (banner) banner.className = 'status-confirm-banner to-inactive';
    if (title) title.textContent = '¿Estás seguro de poner inactivo este proyecto?';
    if (desc) desc.textContent = 'El proyecto pasará a estado Inactivo y dejará de ser visible públicamente.';
    if (icon) {
      icon.innerHTML = `
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      `;
    }
    if (submitBtn) {
      submitBtn.textContent = 'Poner Inactivo';
      submitBtn.className = 'btn btn-warning';
    }
  } else {
    // Si está inactivo -> Confirmar ponerlo Activo
    if (modalTitle) modalTitle.textContent = 'Activar proyecto';
    if (banner) banner.className = 'status-confirm-banner to-active';
    if (title) title.textContent = '¿Estás seguro de poner activo este proyecto?';
    if (desc) desc.textContent = 'El proyecto pasará a estado Activo y volverá a ser visible públicamente.';
    if (icon) {
      icon.innerHTML = `
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      `;
    }
    if (submitBtn) {
      submitBtn.textContent = 'Poner Activo';
      submitBtn.className = 'btn btn-primary';
    }
  }

  // Previsualización del Proyecto
  const previewThumb = document.getElementById('status-preview-thumb');
  if (previewThumb) {
    previewThumb.src = project.project_images || '../../assets/images/logo.jpeg';
  }
  const previewName = document.getElementById('status-preview-name');
  if (previewName) {
    previewName.textContent = project.project_name || 'Proyecto';
  }
  const currentBadge = document.getElementById('status-current-badge');
  if (currentBadge) {
    currentBadge.className = `badge-status ${isCurrentlyActive ? 'badge-status-active' : 'badge-status-inactive'}`;
    currentBadge.textContent = isCurrentlyActive ? 'Activo' : 'Inactivo';
  }

  modal.classList.add('is-open');
}

function closeStatusModal() {
  const modal = document.getElementById('modal-status');
  if (modal) modal.classList.remove('is-open');
  state.activeStatusProject = null;
}

/**
 * Modal 5: Eliminar Proyecto
 */
function openDeleteModal(project) {
  state.activeDeleteProject = project;

  const modal = document.getElementById('modal-delete');
  if (!modal) return;

  document.getElementById('delete-project-id').value = project.id;
  document.getElementById('delete-preview-thumb').src = project.project_images || '../../assets/images/logo.jpeg';
  document.getElementById('delete-preview-name').textContent = project.project_name || 'Proyecto';

  modal.classList.add('is-open');
}

function closeDeleteModal() {
  const modal = document.getElementById('modal-delete');
  if (modal) modal.classList.remove('is-open');
  state.activeDeleteProject = null;
}

/**
 * Cierra popovers activos.
 */
function closeActivePopover() {
  if (state.activePopoverMenu) {
    state.activePopoverMenu.classList.remove('is-open');
    state.activePopoverMenu = null;
  }
}

/**
 * Muestra notificación Toast.
 */
function showNotificationToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `custom-toast toast-${type}`;
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    border-radius: 10px;
    background: ${type === 'success' ? '#005187' : type === 'danger' ? '#dc2626' : '#0f172a'};
    color: #ffffff;
    font-size: 0.865rem;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    margin-bottom: 10px;
    animation: fadeInDown 0.25s ease;
  `;

  const iconSvg = type === 'success' 
    ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * ==========================================================================
 * LISTENERS DE INTERACCIÓN Y EVENTOS
 * ==========================================================================
 */
function setupEventListeners() {
  // 1. Buscador en tiempo real
  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.filters.search = e.target.value;
        state.currentPage = 1;
        renderProjectsTable();
      }, 200);
    });
  }

  // 2. Filtro de Estado
  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      state.currentPage = 1;
      renderProjectsTable();
    });
  }

  // 3. Ordenamiento
  const sortSelect = document.getElementById('filter-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      renderProjectsTable();
    });
  }

  // 4. Limpiar Filtros
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.filters.search = '';
      state.filters.status = 'all';
      state.filters.sort = 'newest';
      if (searchInput) searchInput.value = '';
      if (statusSelect) statusSelect.value = 'all';
      if (sortSelect) sortSelect.value = 'newest';
      state.currentPage = 1;
      renderProjectsTable();
      showNotificationToast('Filtros restablecidos', 'info');
    });
  }

  // 5. Botón Abrir Modal Registrar Proyecto
  const openCreateBtn = document.getElementById('btn-open-create-modal');
  if (openCreateBtn) {
    openCreateBtn.addEventListener('click', openCreateModal);
  }

  // 6. Cierres de Modales
  document.getElementById('btn-close-create')?.addEventListener('click', closeCreateModal);
  document.getElementById('btn-cancel-create')?.addEventListener('click', closeCreateModal);

  document.getElementById('btn-close-view')?.addEventListener('click', closeViewModal);
  document.getElementById('btn-close-view-footer')?.addEventListener('click', closeViewModal);

  document.getElementById('btn-close-edit')?.addEventListener('click', closeEditModal);
  document.getElementById('btn-cancel-edit')?.addEventListener('click', closeEditModal);

  document.getElementById('btn-close-status')?.addEventListener('click', closeStatusModal);
  document.getElementById('btn-cancel-status')?.addEventListener('click', closeStatusModal);

  document.getElementById('btn-close-delete')?.addEventListener('click', closeDeleteModal);
  document.getElementById('btn-cancel-delete')?.addEventListener('click', closeDeleteModal);

  document.getElementById('btn-close-lightbox')?.addEventListener('click', closeLightbox);

  // 7. Clic en la imagen del modal Ver Proyecto para ampliar a pantalla completa
  const viewCarouselBox = document.getElementById('view-carousel-container');
  if (viewCarouselBox) {
    viewCarouselBox.addEventListener('click', () => {
      if (state.activeViewProject) {
        openLightbox(state.activeViewProject.project_images, state.activeViewProject.project_name);
      }
    });
  }

  // 8. Delegación de Eventos en la Tabla
  document.addEventListener('click', (e) => {
    // A) Clic en miniatura de la tabla -> Lightbox a pantalla completa
    const thumbWrapper = e.target.closest('.btn-open-lightbox');
    if (thumbWrapper) {
      e.stopPropagation();
      const imgSrc = thumbWrapper.getAttribute('data-img-src');
      const caption = thumbWrapper.getAttribute('data-caption');
      openLightbox(imgSrc, caption);
      return;
    }

    // B) Botón Ver Proyecto (Ojo)
    const viewBtn = e.target.closest('.btn-action-view');
    if (viewBtn) {
      e.stopPropagation();
      closeActivePopover();
      const projId = viewBtn.getAttribute('data-project-id');
      const project = state.projects.find(p => p.id == projId);
      if (project) openViewModal(project);
      return;
    }

    // C) Botón Editar Proyecto (Lápiz)
    const editBtn = e.target.closest('.btn-action-edit');
    if (editBtn) {
      e.stopPropagation();
      closeActivePopover();
      const projId = editBtn.getAttribute('data-project-id');
      const project = state.projects.find(p => p.id == projId);
      if (project) openEditModal(project);
      return;
    }

    // D) Botón Toggle Popover (3 puntos)
    const popoverBtn = e.target.closest('.btn-toggle-popover');
    if (popoverBtn) {
      e.stopPropagation();
      const popover = popoverBtn.nextElementSibling;
      if (popover) {
        if (state.activePopoverMenu && state.activePopoverMenu !== popover) {
          closeActivePopover();
        }
        popover.classList.toggle('is-open');
        state.activePopoverMenu = popover.classList.contains('is-open') ? popover : null;
      }
      return;
    }

    // Si se hace clic fuera del popover, cerrarlo
    if (state.activePopoverMenu && !e.target.closest('.action-popover-menu')) {
      closeActivePopover();
    }

    // E) Popover: Cambiar Estado
    const statusBtn = e.target.closest('.btn-action-status');
    if (statusBtn) {
      e.stopPropagation();
      closeActivePopover();
      const projId = statusBtn.getAttribute('data-project-id');
      const project = state.projects.find(p => p.id == projId);
      if (project) openStatusModal(project);
      return;
    }

    // F) Popover: Eliminar
    const deleteBtn = e.target.closest('.btn-action-delete');
    if (deleteBtn) {
      e.stopPropagation();
      closeActivePopover();
      const projId = deleteBtn.getAttribute('data-project-id');
      const project = state.projects.find(p => p.id == projId);
      if (project) openDeleteModal(project);
      return;
    }
  });

  // 9. Carga de Archivos en Modal Registrar Proyecto
  setupCreateFileUploads();

  // 10. Carga de Archivos en Modal Editar Proyecto
  setupEditFileUploads();

  // 11. Envío de Formulario: Registrar Proyecto
  const createForm = document.getElementById('form-create-project');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCreateSubmit();
    });
  }

  // 12. Envío de Formulario: Editar Proyecto
  const editForm = document.getElementById('form-edit-project');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleEditSubmit();
    });
  }

  // 13. Envío de Formulario: Cambiar Estado
  const statusForm = document.getElementById('form-change-status');
  if (statusForm) {
    statusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleStatusSubmit();
    });
  }

  // 14. Envío de Formulario: Eliminar Proyecto
  const deleteForm = document.getElementById('form-delete-project');
  if (deleteForm) {
    deleteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleDeleteSubmit();
    });
  }

  // 15. Tecla Escape para cerrar modales
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCreateModal();
      closeViewModal();
      closeEditModal();
      closeStatusModal();
      closeDeleteModal();
      closeLightbox();
      closeActivePopover();
    }
  });

  // 16. Clic en fondo (backdrop) para cerrar modales
  ['modal-create', 'modal-view', 'modal-edit', 'modal-status', 'modal-delete', 'lightbox-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          if (id === 'modal-create') closeCreateModal();
          else if (id === 'modal-view') closeViewModal();
          else if (id === 'modal-edit') closeEditModal();
          else if (id === 'modal-status') closeStatusModal();
          else if (id === 'modal-delete') closeDeleteModal();
          else if (id === 'lightbox-modal') closeLightbox();
        }
      });
    }
  });
}

/**
 * Configura los inputs de archivo para el Modal de Crear.
 */
function setupCreateFileUploads() {
  // Documento PDF
  const triggerDocBtn = document.getElementById('btn-trigger-create-doc');
  const docInput = document.getElementById('create-doc-input');
  const docPreview = document.getElementById('create-doc-preview');
  const removeDocBtn = document.getElementById('btn-remove-create-doc');

  if (triggerDocBtn && docInput) {
    triggerDocBtn.addEventListener('click', () => docInput.click());
    docInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
          showNotificationToast('El archivo debe ser en formato PDF', 'danger');
          docInput.value = '';
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          showNotificationToast('El archivo supera los 10 MB permitidos', 'danger');
          docInput.value = '';
          return;
        }
        state.createDocFile = file;
        document.getElementById('create-doc-name-text').textContent = file.name;
        document.getElementById('create-doc-size-text').textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        if (docPreview) docPreview.classList.add('has-file');
      }
    });
  }

  if (removeDocBtn) {
    removeDocBtn.addEventListener('click', () => {
      state.createDocFile = null;
      if (docInput) docInput.value = '';
      if (docPreview) docPreview.classList.remove('has-file');
    });
  }

  // Imagen del Proyecto
  const triggerImgBtn = document.getElementById('btn-trigger-create-img');
  const imgInput = document.getElementById('create-img-input');
  const imgPreview = document.getElementById('create-img-preview');
  const removeImgBtn = document.getElementById('btn-remove-create-img');

  if (triggerImgBtn && imgInput) {
    triggerImgBtn.addEventListener('click', () => imgInput.click());
    imgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          showNotificationToast('Formato de imagen inválido. Usa JPG, PNG o WEBP', 'danger');
          imgInput.value = '';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          showNotificationToast('La imagen supera los 5 MB permitidos', 'danger');
          imgInput.value = '';
          return;
        }
        state.createImgFile = file;
        document.getElementById('create-img-thumb').src = URL.createObjectURL(file);
        document.getElementById('create-img-name-text').textContent = file.name;
        document.getElementById('create-img-size-text').textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        if (imgPreview) imgPreview.classList.add('has-file');
      }
    });
  }

  if (removeImgBtn) {
    removeImgBtn.addEventListener('click', () => {
      state.createImgFile = null;
      if (imgInput) imgInput.value = '';
      if (imgPreview) imgPreview.classList.remove('has-file');
    });
  }
}

/**
 * Configura los inputs de archivo para el Modal de Editar.
 */
function setupEditFileUploads() {
  // Documento PDF
  const triggerDocBtn = document.getElementById('btn-trigger-edit-doc');
  const docInput = document.getElementById('edit-doc-input');
  const removeDocBtn = document.getElementById('btn-remove-edit-doc');

  if (triggerDocBtn && docInput) {
    triggerDocBtn.addEventListener('click', () => docInput.click());
    docInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
          showNotificationToast('El archivo debe ser en formato PDF', 'danger');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          showNotificationToast('El archivo supera los 10 MB permitidos', 'danger');
          return;
        }
        state.editDocFile = file;
        document.getElementById('edit-doc-name').textContent = file.name;
        document.getElementById('edit-doc-size').textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        showNotificationToast('Nuevo documento seleccionado', 'success');
      }
    });
  }

  if (removeDocBtn) {
    removeDocBtn.addEventListener('click', () => {
      state.editDocFile = 'remove';
      document.getElementById('edit-doc-name').textContent = 'Sin documento';
      document.getElementById('edit-doc-size').textContent = '';
      showNotificationToast('Documento marcado para desvincular', 'info');
    });
  }

  // Imagen
  const triggerImgBtn = document.getElementById('btn-trigger-edit-img');
  const imgInput = document.getElementById('edit-img-input');
  const removeImgBtn = document.getElementById('btn-remove-edit-img');

  if (triggerImgBtn && imgInput) {
    triggerImgBtn.addEventListener('click', () => imgInput.click());
    imgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          showNotificationToast('Formato de imagen inválido', 'danger');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          showNotificationToast('La imagen supera los 5 MB permitidos', 'danger');
          return;
        }
        state.editImgFile = file;
        document.getElementById('edit-img-thumb').src = URL.createObjectURL(file);
        document.getElementById('edit-img-name').textContent = file.name;
        document.getElementById('edit-img-size').textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        showNotificationToast('Nueva imagen seleccionada', 'success');
      }
    });
  }

  if (removeImgBtn) {
    removeImgBtn.addEventListener('click', () => {
      state.editImgFile = 'remove';
      document.getElementById('edit-img-thumb').src = '../../assets/images/logo.jpeg';
      document.getElementById('edit-img-name').textContent = 'logo.jpeg';
      showNotificationToast('Imagen restablecida a predeterminada', 'info');
    });
  }
}

/**
 * Procesa el registro de un nuevo proyecto.
 */
async function handleCreateSubmit() {
  const name = document.getElementById('create-name').value.trim();
  const description = document.getElementById('create-description').value.trim();

  if (!name) {
    showNotificationToast('El nombre del proyecto es obligatorio', 'danger');
    return;
  }

  const formData = new FormData();
  formData.append('project_name', name);
  formData.append('description', description);

  if (state.createDocFile) {
    formData.append('project_document', state.createDocFile);
  }
  if (state.createImgFile) {
    formData.append('project_images', state.createImgFile);
  }

  try {
    const newProject = await createProject(formData);
    state.projects.unshift(newProject);
    renderProjectsTable();
    closeCreateModal();
    showNotificationToast('Proyecto registrado exitosamente', 'success');
  } catch (error) {
    console.error('[TuEstante Project] Error al registrar proyecto:', error);
    showNotificationToast('Error al registrar el proyecto', 'danger');
  }
}

/**
 * Procesa la edición de un proyecto.
 */
async function handleEditSubmit() {
  const projId = document.getElementById('edit-project-id').value;
  if (!projId) return;

  const name = document.getElementById('edit-name').value.trim();
  const description = document.getElementById('edit-description').value.trim();

  if (!name) {
    showNotificationToast('El nombre del proyecto es obligatorio', 'danger');
    return;
  }

  const formData = new FormData();
  formData.append('project_name', name);
  formData.append('description', description);

  if (state.editDocFile && state.editDocFile instanceof File) {
    formData.append('project_document', state.editDocFile);
  }
  if (state.editImgFile && state.editImgFile instanceof File) {
    formData.append('project_images', state.editImgFile);
  }

  try {
    const updated = await updateProject(projId, formData);
    if (updated) {
      const idx = state.projects.findIndex(p => p.id == projId);
      if (idx !== -1) {
        state.projects[idx] = updated;
      }
      renderProjectsTable();
      closeEditModal();
      showNotificationToast('Proyecto actualizado con éxito', 'success');
    }
  } catch (error) {
    console.error('[TuEstante Project] Error al actualizar proyecto:', error);
    showNotificationToast('Error al guardar cambios', 'danger');
  }
}

/**
 * Procesa el cambio de estado de un proyecto.
 */
async function handleStatusSubmit() {
  const projId = document.getElementById('status-project-id').value;
  const targetStatus = document.getElementById('status-target-value')?.value || (state.activeStatusProject?.is_active ? 'Inactivo' : 'Activo');
  if (!projId) return;

  try {
    const updated = await updateProjectStatus(projId, targetStatus);
    if (updated) {
      const idx = state.projects.findIndex(p => p.id == projId);
      if (idx !== -1) {
        state.projects[idx] = updated;
      }
      renderProjectsTable();
      closeStatusModal();
      showNotificationToast(
        targetStatus === 'Activo' ? 'Proyecto activado con éxito' : 'Proyecto puesto en inactivo',
        'success'
      );
    }
  } catch (err) {
    console.error('[TuEstante Project] Error al cambiar estado:', err);
    showNotificationToast('Error al cambiar el estado del proyecto', 'danger');
  }
}

/**
 * Procesa la eliminación de un proyecto.
 */
async function handleDeleteSubmit() {
  const projId = document.getElementById('delete-project-id').value;
  if (!projId) return;

  try {
    await deleteProject(projId);
    state.projects = state.projects.filter(p => p.id != projId);
    renderProjectsTable();
    closeDeleteModal();
    showNotificationToast('Proyecto eliminado correctamente', 'success');
  } catch (err) {
    showNotificationToast('Error al eliminar el proyecto', 'danger');
  }
}

/**
 * ==========================================================================
 * INICIALIZACIÓN DEL MÓDULO DE PROYECTOS
 * ==========================================================================
 */
async function initProjectsModule() {
  try {
    // 1. Cargar componentes compartidos del panel (Navbar, Drawer y Footer)
    await loadAdminComponents({ title: 'Proyectos' });

    // 2. Configurar listeners de interacción
    setupEventListeners();

    // 3. Obtener proyectos desde el backend o almacén local
    state.projects = await getProjects();

    // 4. Renderizar tabla
    renderProjectsTable();

    console.log('%c[TuEstante Admin] Módulo de Proyectos inicializado con éxito.', 'background: #005187; color: #fcffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  } catch (error) {
    console.error('[TuEstante Admin] Error al inicializar módulo de proyectos:', error);
  }
}

// Ejecución al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProjectsModule);
} else {
  initProjectsModule();
}
