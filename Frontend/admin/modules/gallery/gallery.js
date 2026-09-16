/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DEL MÓDULO DE GALERÍA (GALLERY.JS)
 * ==========================================================================
 * Controla la visualización de la galería publicada y solicitudes,
 * filtros reactivos, paginación, modales de vista rápida, registro, edición,
 * y ampliación de multimedia (lightbox) al hacer clic en las miniaturas.
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { showConfirmModal } from '../../components/modal/modal.js';
import {
  getGalleryData,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  approveGalleryItem,
  rejectGalleryItem,
  getClientsList
} from './gallery.api.js';

/**
 * ESTADO GLOBAL DEL MÓDULO DE GALERÍA
 */
const state = {
  allItems: [],
  clients: [],
  filters: {
    search: '',
    social: 'all',
    status: 'all'
  },
  publishedPage: 1,
  publishedPageSize: 6,
  requestsPage: 1,
  requestsPageSize: 6,
  activeQuickViewItem: null,
  activeEditItem: null,
  activeStatusItem: null,
  activePopoverMenu: null,
  createSelectedFile: null,
  editSelectedFile: null
};

/**
 * ==========================================================================
 * RENDERIZADO DE TABLAS (PUBLICADA Y SOLICITUDES)
 * ==========================================================================
 */

/**
 * Genera el icono SVG oficial de la red social correspondiente.
 */
function getSocialIconSvg(social) {
  const norm = (social || '').toLowerCase();
  if (norm.includes('instagram')) {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    `;
  }
  if (norm.includes('facebook')) {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
      </svg>
    `;
  }
  if (norm.includes('tiktok')) {
    return `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-.88-.06A6.34 6.34 0 0 0 3 15.68a6.34 6.34 0 0 0 10.82 4.47 6.27 6.27 0 0 0 1.86-4.48V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-.87-.07z"/>
      </svg>
    `;
  }
  if (norm.includes('pinterest')) {
    return `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0a12 12 0 0 0-4.37 23.18c-.07-.98-.13-2.5.03-3.57.14-.97.94-6.43.94-6.43s-.24-.48-.24-1.2c0-1.12.65-1.96 1.46-1.96.69 0 1.02.52 1.02 1.14 0 .69-.44 1.73-.67 2.69-.19.81.41 1.47 1.2 1.47 1.44 0 2.55-1.52 2.55-3.71 0-1.94-1.39-3.3-3.39-3.3-2.31 0-3.66 1.73-3.66 3.52 0 .7.27 1.45.61 1.86.07.08.08.15.06.24l-.23.94c-.04.15-.13.18-.3.11-1.12-.52-1.82-2.15-1.82-3.46 0-2.82 2.05-5.41 5.91-5.41 3.1 0 5.51 2.21 5.51 5.17 0 3.08-1.94 5.56-4.64 5.56-.91 0-1.76-.47-2.05-1.03l-.56 2.13c-.2.78-.75 1.76-1.12 2.36A12 12 0 1 0 12 0z"/>
      </svg>
    `;
  }
  if (norm.includes('twitter') || norm.includes('x')) {
    return `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  `;
}

/**
 * Determina la clase CSS para el badge de red social.
 */
function getSocialPillClass(social) {
  const norm = (social || '').toLowerCase();
  if (norm.includes('instagram')) return 'social-pill-instagram';
  if (norm.includes('facebook')) return 'social-pill-facebook';
  if (norm.includes('tiktok')) return 'social-pill-tiktok';
  if (norm.includes('pinterest')) return 'social-pill-pinterest';
  if (norm.includes('twitter') || norm.includes('x')) return 'social-pill-twitter';
  return 'social-pill-other';
}

/**
 * Determina la clase CSS para el badge de estado.
 */
function getStatusBadgeClass(status) {
  const norm = (status || '').toLowerCase();
  if (norm.includes('activa') || norm.includes('aprobada')) return 'badge-status-active';
  if (norm.includes('pendiente')) return 'badge-status-pending';
  if (norm.includes('rechazada')) return 'badge-status-rejected';
  return 'badge-status-inactive';
}

/**
 * Escapa strings para prevenir inyección XSS.
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
 * Aplica los filtros actuales al arreglo de items.
 */
function filterItems(items) {
  const { search, social, status } = state.filters;
  const searchLower = search.trim().toLowerCase();

  return items.filter(item => {
    // 1. Filtro de Búsqueda (caption, nombre de usuario, documento, handle)
    if (searchLower) {
      const matchCaption = (item.caption || '').toLowerCase().includes(searchLower);
      const matchName = (item.client_name || '').toLowerCase().includes(searchLower);
      const matchDoc = (item.identity_document || '').toLowerCase().includes(searchLower);
      const matchHandle = (item.social_media_handle || '').toLowerCase().includes(searchLower);
      if (!matchCaption && !matchName && !matchDoc && !matchHandle) {
        return false;
      }
    }

    // 2. Filtro Red Social
    if (social !== 'all') {
      const itemSocial = (item.social_network || '').toLowerCase();
      if (!itemSocial.includes(social.toLowerCase())) {
        return false;
      }
    }

    // 3. Filtro Estado
    if (status !== 'all') {
      const itemStatus = (item.status || '').toLowerCase();
      const targetStatus = status.toLowerCase();
      if (targetStatus === 'activa') {
        if (!item.is_active) return false;
      } else if (!itemStatus.includes(targetStatus)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Renderiza la tabla de Galería Publicada.
 */
function renderPublishedTable() {
  const tbody = document.getElementById('table-published-body');
  const countTag = document.getElementById('count-published-tag');
  const badgeCount = document.getElementById('badge-count-published');
  const infoText = document.getElementById('published-pagination-info');
  const controls = document.getElementById('published-pagination-controls');

  if (!tbody) return;

  // Filtrar solo items publicados (o que estén activos y aprobados)
  const publishedList = state.allItems.filter(i => i.section === 'published' || (i.is_active && i.status === 'Aprobada'));
  const filtered = filterItems(publishedList);

  if (countTag) countTag.textContent = `${filtered.length} ${filtered.length === 1 ? 'imagen' : 'imágenes'}`;
  if (badgeCount) badgeCount.textContent = publishedList.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="table-empty-state">
            <div class="table-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <h4 class="table-empty-title">No hay imágenes en la galería publicada</h4>
            <p class="table-empty-desc">No se encontraron imágenes que coincidan con los filtros aplicados o aún no se han registrado imágenes activas.</p>
          </div>
        </td>
      </tr>
    `;
    if (infoText) infoText.textContent = 'Mostrando 0 imágenes';
    if (controls) controls.innerHTML = '';
    return;
  }

  // Paginación
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / state.publishedPageSize);
  if (state.publishedPage > totalPages) state.publishedPage = totalPages || 1;
  const startIdx = (state.publishedPage - 1) * state.publishedPageSize;
  const endIdx = Math.min(startIdx + state.publishedPageSize, totalItems);
  const pagedItems = filtered.slice(startIdx, endIdx);

  if (infoText) {
    infoText.textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${totalItems} imágenes`;
  }

  tbody.innerHTML = pagedItems.map(item => `
    <tr data-item-id="${item.id}">
      <!-- 1. Miniatura Multimedia (Al hacer clic se amplía a pantalla completa) -->
      <td>
        <div class="media-thumbnail-wrapper btn-open-lightbox" 
             data-img-src="${escapeHtml(item.image)}" 
             data-caption="${escapeHtml(item.caption)}" 
             title="Clic para ampliar en pantalla completa">
          <img src="${escapeHtml(item.image)}" alt="Miniatura" class="media-thumbnail-img" onerror="this.src='../../assets/images/logo.jpeg'">
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

      <!-- 2. Usuario (Nombre Completo y Documento de Identidad) -->
      <td>
        <div class="user-cell-box">
          <div class="user-avatar-circle">
            ${escapeHtml(item.client_name ? item.client_name.slice(0, 2).toUpperCase() : 'US')}
          </div>
          <div class="user-meta-info">
            <span class="user-full-name">${escapeHtml(item.client_name || 'Usuario')}</span>
            <span class="user-identity-doc" title="Documento de Identidad">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <line x1="7" y1="8" x2="17" y2="8"></line>
                <line x1="7" y1="12" x2="13" y2="12"></line>
              </svg>
              ${escapeHtml(item.identity_document || 'V-18.452.369')}
            </span>
          </div>
        </div>
      </td>

      <!-- 3. Descripción -->
      <td>
        <div class="caption-text-cell" title="${escapeHtml(item.caption)}">
          ${escapeHtml(item.caption)}
        </div>
      </td>

      <!-- 4. Red Social -->
      <td>
        <span class="social-pill ${getSocialPillClass(item.social_network)}">
          ${getSocialIconSvg(item.social_network)}
          <span>${escapeHtml(item.social_network || 'Red Social')}</span>
        </span>
      </td>

      <!-- 5. Usuario de Red Social -->
      <td>
        <span class="social-handle-text">${escapeHtml(item.social_media_handle || '-')}</span>
      </td>

      <!-- 6. Enlace -->
      <td>
        ${item.social_media_url && item.social_media_url !== '#' ? `
          <a href="${escapeHtml(item.social_media_url)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Abrir enlace en nueva pestaña">
            <span>Ver enlace</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        ` : `<span style="color: #94a3b8; font-size: 0.82rem;">-</span>`}
      </td>

      <!-- 7. Estado -->
      <td style="text-align: center;">
        <span class="badge-status ${item.is_active ? 'badge-status-active' : 'badge-status-inactive'}">
          ${item.is_active ? 'Activa' : 'Inactiva'}
        </span>
      </td>

      <!-- 8. Fecha de Publicación -->
      <td style="font-size: 0.835rem; color: #475569; white-space: nowrap;">
        ${escapeHtml(item.formatted_date || '-')}
      </td>

      <!-- 9. Acciones -->
      <td style="text-align: right;">
        <div class="actions-cell-wrapper">
          <!-- Vista Rápida -->
          <button type="button" class="btn-action-icon btn-action-quickview" data-item-id="${item.id}" title="Vista rápida de imagen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>

          <!-- Menú de 3 Puntos -->
          <button type="button" class="btn-action-icon btn-toggle-popover" data-item-id="${item.id}" aria-label="Más opciones" title="Más opciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>

          <!-- Popover Flotante -->
          <div class="action-popover-menu" id="popover-published-${item.id}">
            <button type="button" class="popover-item-btn btn-action-edit" data-item-id="${item.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <span>Editar</span>
            </button>
            <button type="button" class="popover-item-btn btn-action-toggle-active" data-item-id="${item.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Cambiar estado</span>
            </button>
            <button type="button" class="popover-item-btn btn-delete-danger btn-action-delete" data-item-id="${item.id}">
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

  // Render controles de paginación
  if (controls) {
    let paginationHtml = `
      <button type="button" class="pagination-page-btn" id="btn-pub-prev" ${state.publishedPage <= 1 ? 'disabled' : ''}>
        &lt;
      </button>
    `;
    for (let p = 1; p <= totalPages; p++) {
      paginationHtml += `
        <button type="button" class="pagination-page-btn ${p === state.publishedPage ? 'active' : ''}" data-page="${p}">
          ${p}
        </button>
      `;
    }
    paginationHtml += `
      <button type="button" class="pagination-page-btn" id="btn-pub-next" ${state.publishedPage >= totalPages ? 'disabled' : ''}>
        &gt;
      </button>
    `;
    controls.innerHTML = paginationHtml;

    // Listeners de paginación
    controls.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.publishedPage = Number(btn.getAttribute('data-page'));
        renderPublishedTable();
      });
    });
    const prevBtn = controls.querySelector('#btn-pub-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.publishedPage > 1) {
          state.publishedPage--;
          renderPublishedTable();
        }
      });
    }
    const nextBtn = controls.querySelector('#btn-pub-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.publishedPage < totalPages) {
          state.publishedPage++;
          renderPublishedTable();
        }
      });
    }
  }
}

/**
 * Renderiza la tabla de Solicitudes de Galería.
 */
function renderRequestsTable() {
  const tbody = document.getElementById('table-requests-body');
  const countTag = document.getElementById('count-requests-tag');
  const badgeCount = document.getElementById('badge-count-requests');
  const infoText = document.getElementById('requests-pagination-info');
  const controls = document.getElementById('requests-pagination-controls');

  if (!tbody) return;

  // Filtrar solicitudes (section === 'request' o status !== 'Aprobada' || !is_active)
  const requestsList = state.allItems.filter(i => i.section === 'request' || (!i.is_active && i.status !== 'Aprobada') || i.status === 'Pendiente');
  const filtered = filterItems(requestsList);

  if (countTag) countTag.textContent = `${filtered.length} ${filtered.length === 1 ? 'solicitud' : 'solicitudes'}`;
  if (badgeCount) {
    const pendingCount = requestsList.filter(r => r.status === 'Pendiente').length;
    badgeCount.textContent = pendingCount || requestsList.length;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="table-empty-state">
            <div class="table-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <h4 class="table-empty-title">No hay solicitudes pendientes</h4>
            <p class="table-empty-desc">Todas las solicitudes de galería han sido atendidas o no coinciden con los filtros actuales.</p>
          </div>
        </td>
      </tr>
    `;
    if (infoText) infoText.textContent = 'Mostrando 0 solicitudes';
    if (controls) controls.innerHTML = '';
    return;
  }

  // Paginación
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / state.requestsPageSize);
  if (state.requestsPage > totalPages) state.requestsPage = totalPages || 1;
  const startIdx = (state.requestsPage - 1) * state.requestsPageSize;
  const endIdx = Math.min(startIdx + state.requestsPageSize, totalItems);
  const pagedItems = filtered.slice(startIdx, endIdx);

  if (infoText) {
    infoText.textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${totalItems} solicitudes`;
  }

  tbody.innerHTML = pagedItems.map(item => `
    <tr data-item-id="${item.id}">
      <!-- 1. Miniatura Multimedia (Al hacer clic se amplía a pantalla completa) -->
      <td>
        <div class="media-thumbnail-wrapper btn-open-lightbox" 
             data-img-src="${escapeHtml(item.image)}" 
             data-caption="${escapeHtml(item.caption)}" 
             title="Clic para ampliar en pantalla completa">
          <img src="${escapeHtml(item.image)}" alt="Miniatura" class="media-thumbnail-img" onerror="this.src='../../assets/images/logo.jpeg'">
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

      <!-- 2. Usuario (Nombre Completo y Documento de Identidad) -->
      <td>
        <div class="user-cell-box">
          <div class="user-avatar-circle">
            ${escapeHtml(item.client_name ? item.client_name.slice(0, 2).toUpperCase() : 'US')}
          </div>
          <div class="user-meta-info">
            <span class="user-full-name">${escapeHtml(item.client_name || 'Usuario')}</span>
            <span class="user-identity-doc" title="Documento de Identidad">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <line x1="7" y1="8" x2="17" y2="8"></line>
                <line x1="7" y1="12" x2="13" y2="12"></line>
              </svg>
              ${escapeHtml(item.identity_document || 'V-18.452.369')}
            </span>
          </div>
        </div>
      </td>

      <!-- 3. Descripción -->
      <td>
        <div class="caption-text-cell" title="${escapeHtml(item.caption)}">
          ${escapeHtml(item.caption)}
        </div>
      </td>

      <!-- 4. Red Social -->
      <td>
        <span class="social-pill ${getSocialPillClass(item.social_network)}">
          ${getSocialIconSvg(item.social_network)}
          <span>${escapeHtml(item.social_network || 'Red Social')}</span>
        </span>
      </td>

      <!-- 5. Usuario de Red Social -->
      <td>
        <span class="social-handle-text">${escapeHtml(item.social_media_handle || '-')}</span>
      </td>

      <!-- 6. Fecha de Solicitud -->
      <td style="font-size: 0.835rem; color: #475569; white-space: nowrap;">
        ${escapeHtml(item.formatted_date || '-')}
      </td>

      <!-- 7. Estado -->
      <td style="text-align: center;">
        <span class="badge-status ${getStatusBadgeClass(item.status)}">
          ${escapeHtml(item.status || 'Pendiente')}
        </span>
      </td>

      <!-- 8. Acciones -->
      <td style="text-align: right;">
        <div class="actions-cell-wrapper">
          <!-- Vista Rápida -->
          <button type="button" class="btn-action-icon btn-action-quickview" data-item-id="${item.id}" title="Vista previa">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>

          <!-- Acción Aprobar -->
          <button type="button" class="btn-action-icon btn-approve btn-action-approve" data-item-id="${item.id}" title="Aprobar solicitud">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>

          <!-- Acción Rechazar -->
          <button type="button" class="btn-action-icon btn-reject btn-action-reject" data-item-id="${item.id}" title="Rechazar solicitud">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Menú de 3 Puntos -->
          <button type="button" class="btn-action-icon btn-toggle-popover" data-item-id="${item.id}" aria-label="Más opciones" title="Más opciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>

          <!-- Popover Flotante -->
          <div class="action-popover-menu" id="popover-requests-${item.id}">
            <button type="button" class="popover-item-btn btn-action-edit" data-item-id="${item.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <span>Editar</span>
            </button>
            <button type="button" class="popover-item-btn btn-delete-danger btn-action-delete" data-item-id="${item.id}">
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

  // Render controles de paginación
  if (controls) {
    let paginationHtml = `
      <button type="button" class="pagination-page-btn" id="btn-req-prev" ${state.requestsPage <= 1 ? 'disabled' : ''}>
        &lt;
      </button>
    `;
    for (let p = 1; p <= totalPages; p++) {
      paginationHtml += `
        <button type="button" class="pagination-page-btn ${p === state.requestsPage ? 'active' : ''}" data-page="${p}">
          ${p}
        </button>
      `;
    }
    paginationHtml += `
      <button type="button" class="pagination-page-btn" id="btn-req-next" ${state.requestsPage >= totalPages ? 'disabled' : ''}>
        &gt;
      </button>
    `;
    controls.innerHTML = paginationHtml;

    // Listeners de paginación
    controls.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.requestsPage = Number(btn.getAttribute('data-page'));
        renderRequestsTable();
      });
    });
    const prevBtn = controls.querySelector('#btn-req-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.requestsPage > 1) {
          state.requestsPage--;
          renderRequestsTable();
        }
      });
    }
    const nextBtn = controls.querySelector('#btn-req-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.requestsPage < totalPages) {
          state.requestsPage++;
          renderRequestsTable();
        }
      });
    }
  }
}

/**
 * Renderiza ambas tablas y actualiza contadores.
 */
function renderAllTables() {
  renderPublishedTable();
  renderRequestsTable();
}

/**
 * ==========================================================================
 * GESTIÓN DE MODALES
 * ==========================================================================
 */

/**
 * Abre el Lightbox a pantalla completa al presionar cualquier media.
 * Cumple con: "no olvides que debe mostrarse la media en las tablas y al presionarlo deben ponerse grande en la pantalla"
 */
function openLightbox(imgSrc, caption = '') {
  const modal = document.getElementById('lightbox-modal');
  const imgEl = document.getElementById('lightbox-img');
  const capEl = document.getElementById('lightbox-caption');

  if (!modal || !imgEl) return;

  imgEl.src = imgSrc;
  if (capEl) {
    capEl.textContent = caption || 'Imagen de Galería TuEstante';
    capEl.style.display = caption ? 'block' : 'none';
  }

  modal.classList.add('is-open');
}

function closeLightbox() {
  const modal = document.getElementById('lightbox-modal');
  if (modal) modal.classList.remove('is-open');
}

/**
 * Abre el modal de Vista Rápida de Imagen con información dividida en 2 columnas.
 */
function openQuickViewModal(item) {
  state.activeQuickViewItem = item;

  const modal = document.getElementById('modal-quickview');
  if (!modal) return;

  const imgEl = document.getElementById('quickview-img');
  const titleEl = document.getElementById('quickview-title');
  const descEl = document.getElementById('quickview-description');
  const userNameEl = document.getElementById('quickview-user-name');
  const userDocEl = document.getElementById('quickview-user-doc');
  const userAvatarEl = document.getElementById('quickview-user-avatar');
  const socialPillEl = document.getElementById('quickview-social-pill');
  const socialHandleEl = document.getElementById('quickview-social-handle');
  const socialLinkEl = document.getElementById('quickview-social-link');
  const statusBadgeEl = document.getElementById('quickview-status-badge');
  const dateValEl = document.getElementById('quickview-date-val');
  const dateLabelEl = document.getElementById('quickview-date-label');

  if (imgEl) imgEl.src = item.image || '../../assets/images/logo.jpeg';
  if (titleEl) titleEl.textContent = item.title || 'Detalle de imagen';
  if (descEl) descEl.textContent = item.caption || 'Sin descripción';
  if (userNameEl) userNameEl.textContent = item.client_name || 'Usuario';
  if (userDocEl) userDocEl.textContent = `CI: ${item.identity_document || 'V-18.452.369'}`;
  if (userAvatarEl) {
    userAvatarEl.textContent = item.client_name ? item.client_name.slice(0, 2).toUpperCase() : 'US';
  }

  if (socialPillEl) {
    socialPillEl.className = `social-pill ${getSocialPillClass(item.social_network)}`;
    socialPillEl.innerHTML = `${getSocialIconSvg(item.social_network)}<span>${escapeHtml(item.social_network || 'Red Social')}</span>`;
  }
  if (socialHandleEl) socialHandleEl.textContent = item.social_media_handle || '-';

  if (socialLinkEl) {
    if (item.social_media_url && item.social_media_url !== '#') {
      socialLinkEl.href = item.social_media_url;
      socialLinkEl.style.display = 'inline-flex';
    } else {
      socialLinkEl.style.display = 'none';
    }
  }

  if (statusBadgeEl) {
    const isAct = item.is_active;
    statusBadgeEl.className = `badge-status ${getStatusBadgeClass(item.status)}`;
    statusBadgeEl.textContent = item.status === 'Aprobada' ? (isAct ? 'Activa' : 'Inactiva') : item.status;
  }

  if (dateLabelEl) {
    dateLabelEl.textContent = item.section === 'request' ? 'Fecha de solicitud' : 'Fecha de publicación';
  }
  if (dateValEl) dateValEl.textContent = item.formatted_date || '-';

  modal.classList.add('is-open');
}

function closeQuickViewModal() {
  const modal = document.getElementById('modal-quickview');
  if (modal) modal.classList.remove('is-open');
  state.activeQuickViewItem = null;
}

/**
 * Abre el modal de Registro de Imagen en Galería.
 */
function openCreateModal() {
  const modal = document.getElementById('modal-create');
  const form = document.getElementById('form-create-gallery');
  if (!modal) return;

  if (form) form.reset();

  state.createSelectedFile = null;
  const previewBox = document.getElementById('create-preview-container');
  const dropzoneArea = document.getElementById('create-dropzone');
  const counter = document.getElementById('create-char-counter');

  if (previewBox) previewBox.classList.remove('has-image');
  if (dropzoneArea) dropzoneArea.style.display = 'flex';
  if (counter) counter.textContent = '0/255';

  // Inicializar combobox de usuario en el formulario de creación
  initCombobox({
    wrapperId: 'create-user-combobox',
    inputId: 'create-user-search',
    dropdownId: 'create-user-dropdown',
    hiddenId: 'create-user-id',
    clients: state.clients,
    selectedName: null
  });

  modal.classList.add('is-open');
}

function closeCreateModal() {
  const modal = document.getElementById('modal-create');
  if (modal) modal.classList.remove('is-open');
}

/**
 * Abre el modal de Edición de Imagen en Galería.
 */
function openEditModal(item) {
  state.activeEditItem = item;
  state.editSelectedFile = null;

  const modal = document.getElementById('modal-edit');
  if (!modal) return;

  // Inicializar combobox de usuario en el formulario de edición
  initCombobox({
    wrapperId: 'edit-user-combobox',
    inputId: 'edit-user-search',
    dropdownId: 'edit-user-dropdown',
    hiddenId: 'edit-user-id',
    clients: state.clients,
    selectedName: item.client_name || null
  });

  // Llenar campos
  document.getElementById('edit-item-id').value = item.id;
  document.getElementById('edit-current-thumb').src = item.image || '../../assets/images/logo.jpeg';
  document.getElementById('edit-caption').value = item.caption || '';
  document.getElementById('edit-social-network').value = item.social_network || 'Instagram';
  document.getElementById('edit-social-handle').value = item.social_media_handle || '';
  document.getElementById('edit-social-url').value = item.social_media_url || '';
  document.getElementById('edit-moderation-status').value = item.status || 'Aprobada';

  const activeToggle = document.getElementById('edit-is-active-toggle');
  const activeLabel = document.getElementById('edit-active-toggle-label');
  if (activeToggle) {
    activeToggle.checked = Boolean(item.is_active);
    if (activeLabel) activeLabel.textContent = item.is_active ? 'Sí' : 'No';
  }

  const counter = document.getElementById('edit-char-counter');
  if (counter) counter.textContent = `${(item.caption || '').length}/255`;

  modal.classList.add('is-open');
}

function closeEditModal() {
  const modal = document.getElementById('modal-edit');
  if (modal) modal.classList.remove('is-open');
  state.activeEditItem = null;
}

/**
 * Modal 5: Confirmar Cambio de Estado (Activa / Inactiva)
 */
function openStatusModal(item) {
  state.activeStatusItem = item;

  const modal = document.getElementById('modal-status');
  if (!modal) return;

  const isCurrentlyActive = Boolean(item.is_active);
  const targetActive = !isCurrentlyActive;

  document.getElementById('status-item-id').value = item.id;
  const targetInput = document.getElementById('status-target-value');
  if (targetInput) targetInput.value = String(targetActive);

  const banner = document.getElementById('status-confirm-banner');
  const title = document.getElementById('status-confirm-title');
  const desc = document.getElementById('status-confirm-desc');
  const submitBtn = document.getElementById('btn-submit-status');
  const icon = document.getElementById('status-confirm-icon');
  const modalTitle = document.getElementById('status-modal-title');

  if (isCurrentlyActive) {
    // Si está activa -> Confirmar ponerla Inactiva
    if (modalTitle) modalTitle.textContent = 'Desactivar imagen';
    if (banner) banner.className = 'status-confirm-banner to-inactive';
    if (title) title.textContent = '¿Estás seguro de poner inactiva esta imagen?';
    if (desc) desc.textContent = 'La imagen pasará a estado Inactivo y no se mostrará públicamente a los clientes.';
    if (icon) {
      icon.innerHTML = `
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      `;
    }
    if (submitBtn) {
      submitBtn.textContent = 'Poner Inactiva';
      submitBtn.className = 'btn btn-warning';
    }
  } else {
    // Si está inactiva -> Confirmar ponerla Activa
    if (modalTitle) modalTitle.textContent = 'Activar imagen';
    if (banner) banner.className = 'status-confirm-banner to-active';
    if (title) title.textContent = '¿Estás seguro de poner activa esta imagen?';
    if (desc) desc.textContent = 'La imagen pasará a estado Activo y volverá a ser visible públicamente en la galería.';
    if (icon) {
      icon.innerHTML = `
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      `;
    }
    if (submitBtn) {
      submitBtn.textContent = 'Poner Activa';
      submitBtn.className = 'btn btn-primary';
    }
  }

  // Previsualización de la Imagen
  const previewThumb = document.getElementById('status-preview-thumb');
  if (previewThumb) {
    previewThumb.src = item.image || '../../assets/images/logo.jpeg';
  }
  const previewName = document.getElementById('status-preview-name');
  if (previewName) {
    previewName.textContent = item.caption || item.title || item.client_name || 'Imagen de galería';
  }
  const currentBadge = document.getElementById('status-current-badge');
  if (currentBadge) {
    currentBadge.className = `badge-status ${isCurrentlyActive ? 'badge-status-active' : 'badge-status-inactive'}`;
    currentBadge.textContent = isCurrentlyActive ? 'Activa' : 'Inactiva';
  }

  modal.classList.add('is-open');
}

function closeStatusModal() {
  const modal = document.getElementById('modal-status');
  if (modal) modal.classList.remove('is-open');
  state.activeStatusItem = null;
}

/**
 * Inicializa un combobox buscable para selección de clientes.
 * @param {object} cfg - Configuración del combobox
 */
function initCombobox({ wrapperId, inputId, dropdownId, hiddenId, clients, selectedName }) {
  const wrapper  = document.getElementById(wrapperId);
  const input    = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const hidden   = document.getElementById(hiddenId);
  if (!wrapper || !input || !dropdown || !hidden) return;

  // Estado local del combobox
  const cb = { clients, selectedName: selectedName || null, selectedDoc: null };

  // Precarga: si hay un valor seleccionado, muéstralo en el input
  if (selectedName) {
    const match = clients.find(c => c.name === selectedName);
    input.value = match ? `${match.name}` : selectedName;
    hidden.value = selectedName;
    cb.selectedDoc = match?.identity_document || '';
  } else {
    input.value = '';
    hidden.value = '';
  }

  function renderOptions(filter) {
    const q = (filter || '').toLowerCase().trim();
    const filtered = q
      ? clients.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.identity_document || '').toLowerCase().includes(q)
        )
      : clients;

    if (!filtered.length) {
      dropdown.innerHTML = `<li class="combobox-no-results">Sin resultados para "${escapeHtml(q)}"</li>`;
      return;
    }

    dropdown.innerHTML = filtered.map(c => {
      const isSelected = c.name === cb.selectedName;
      return `<li class="combobox-option ${isSelected ? 'is-selected' : ''}"
                  data-name="${escapeHtml(c.name)}"
                  data-doc="${escapeHtml(c.identity_document || '')}"
                  role="option"
                  aria-selected="${isSelected}">
                <span class="combobox-option-name">${escapeHtml(c.name)}</span>
                <span class="combobox-option-doc">${escapeHtml(c.identity_document || '')}</span>
              </li>`;
    }).join('');

    // Listeners en cada opción
    dropdown.querySelectorAll('.combobox-option').forEach(li => {
      li.addEventListener('mousedown', (e) => {
        e.preventDefault(); // evita blur del input
        const name = li.dataset.name;
        const doc  = li.dataset.doc;
        cb.selectedName = name;
        cb.selectedDoc  = doc;
        hidden.value = name;
        input.value  = name;
        closeDropdown();
      });
    });
  }

  function openDropdown() {
    renderOptions(input.value);
    wrapper.classList.add('is-open');
    input.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown() {
    wrapper.classList.remove('is-open');
    input.setAttribute('aria-expanded', 'false');
    // Si el texto no corresponde a una selección válida, restaura el nombre seleccionado o limpia
    if (cb.selectedName && input.value !== cb.selectedName) {
      input.value = cb.selectedName;
    } else if (!cb.selectedName) {
      input.value = '';
      hidden.value = '';
    }
  }

  input.addEventListener('focus', () => openDropdown());
  input.addEventListener('input', () => {
    // Al escribir, limpia la selección previa si el texto cambia
    if (input.value !== cb.selectedName) {
      cb.selectedName = null;
      cb.selectedDoc  = null;
      hidden.value = '';
    }
    renderOptions(input.value);
    if (!wrapper.classList.contains('is-open')) {
      wrapper.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
    }
  });
  input.addEventListener('blur', () => {
    // Pequeño delay para que el mousedown de la opción se ejecute antes
    setTimeout(() => closeDropdown(), 150);
  });

  // Cierra al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeDropdown();
  }, { capture: true, passive: true });
}

/**
 * Cierra cualquier menú popover activo de 3 puntos.
 */
function closeActivePopover() {
  if (state.activePopoverMenu) {
    state.activePopoverMenu.classList.remove('is-open');
    state.activePopoverMenu = null;
  }
}

/**
 * Muestra notificación Toast en pantalla.
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
  // 1. Alternar Pestañas Superiores (Galería Publicada vs Solicitudes - Una tabla a la vez)
  const tabBtnPub = document.getElementById('tab-btn-published');
  const tabBtnReq = document.getElementById('tab-btn-requests');
  const secPub = document.getElementById('section-published');
  const secReq = document.getElementById('section-requests');

  if (tabBtnPub && tabBtnReq && secPub && secReq) {
    tabBtnPub.addEventListener('click', () => {
      tabBtnPub.classList.add('active');
      tabBtnPub.setAttribute('aria-selected', 'true');
      tabBtnReq.classList.remove('active');
      tabBtnReq.setAttribute('aria-selected', 'false');

      secPub.style.display = 'flex';
      secReq.style.display = 'none';
    });

    tabBtnReq.addEventListener('click', () => {
      tabBtnReq.classList.add('active');
      tabBtnReq.setAttribute('aria-selected', 'true');
      tabBtnPub.classList.remove('active');
      tabBtnPub.setAttribute('aria-selected', 'false');

      secReq.style.display = 'flex';
      secPub.style.display = 'none';
    });
  }

  // 2. Buscador en vivo
  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.filters.search = e.target.value;
        state.publishedPage = 1;
        state.requestsPage = 1;
        renderAllTables();
      }, 200);
    });
  }

  // 3. Filtro Red Social
  const socialSelect = document.getElementById('filter-social');
  if (socialSelect) {
    socialSelect.addEventListener('change', (e) => {
      state.filters.social = e.target.value;
      state.publishedPage = 1;
      state.requestsPage = 1;
      renderAllTables();
    });
  }

  // 4. Filtro Estado
  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      state.publishedPage = 1;
      state.requestsPage = 1;
      renderAllTables();
    });
  }

  // 5. Botón Limpiar Filtros
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.filters.search = '';
      state.filters.social = 'all';
      state.filters.status = 'all';
      if (searchInput) searchInput.value = '';
      if (socialSelect) socialSelect.value = 'all';
      if (statusSelect) statusSelect.value = 'all';
      state.publishedPage = 1;
      state.requestsPage = 1;
      renderAllTables();
      showNotificationToast('Filtros restablecidos', 'info');
    });
  }

  // 6. Botón Abrir Modal Registrar Imagen
  const openCreateBtn = document.getElementById('btn-open-create-modal');
  if (openCreateBtn) {
    openCreateBtn.addEventListener('click', openCreateModal);
  }

  // 7. Cierres de Modales
  document.getElementById('btn-close-create')?.addEventListener('click', closeCreateModal);
  document.getElementById('btn-cancel-create')?.addEventListener('click', closeCreateModal);

  document.getElementById('btn-close-edit')?.addEventListener('click', closeEditModal);
  document.getElementById('btn-cancel-edit')?.addEventListener('click', closeEditModal);

  document.getElementById('btn-close-status')?.addEventListener('click', closeStatusModal);
  document.getElementById('btn-cancel-status')?.addEventListener('click', closeStatusModal);

  document.getElementById('btn-close-quickview')?.addEventListener('click', closeQuickViewModal);
  document.getElementById('btn-close-quickview-footer')?.addEventListener('click', closeQuickViewModal);

  document.getElementById('btn-close-lightbox')?.addEventListener('click', closeLightbox);

  // 8. Clic en la imagen del modal de Vista Rápida para ampliar a pantalla completa
  const quickviewMediaBox = document.getElementById('quickview-media-container');
  if (quickviewMediaBox) {
    quickviewMediaBox.addEventListener('click', () => {
      if (state.activeQuickViewItem) {
        openLightbox(state.activeQuickViewItem.image, state.activeQuickViewItem.caption);
      }
    });
  }

  // 9. Delegación Global para Tablas (Miniaturas, Vista Rápida, Popover, Aprobar, Rechazar, Editar, Eliminar)
  document.addEventListener('click', async (e) => {
    // A) Clic en miniatura de tabla -> Abre imagen grande en pantalla completa
    const thumbWrapper = e.target.closest('.btn-open-lightbox');
    if (thumbWrapper) {
      e.stopPropagation();
      const imgSrc = thumbWrapper.getAttribute('data-img-src');
      const caption = thumbWrapper.getAttribute('data-caption');
      openLightbox(imgSrc, caption);
      return;
    }

    // B) Botón Vista Rápida
    const qvBtn = e.target.closest('.btn-action-quickview');
    if (qvBtn) {
      e.stopPropagation();
      closeActivePopover();
      const itemId = qvBtn.getAttribute('data-item-id');
      const item = state.allItems.find(i => i.id == itemId);
      if (item) openQuickViewModal(item);
      return;
    }

    // C) Toggle Popover de 3 puntos
    const popoverBtn = e.target.closest('.btn-toggle-popover');
    if (popoverBtn) {
      e.stopPropagation();
      const itemId = popoverBtn.getAttribute('data-item-id');
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

    // Si se hizo clic fuera de un popover activo, cerrarlo
    if (state.activePopoverMenu && !e.target.closest('.action-popover-menu')) {
      closeActivePopover();
    }

    // D) Acción Aprobar Solicitud
    const approveBtn = e.target.closest('.btn-action-approve');
    if (approveBtn) {
      e.stopPropagation();
      const itemId = approveBtn.getAttribute('data-item-id');
      await handleApprove(itemId);
      return;
    }

    // E) Acción Rechazar Solicitud
    const rejectBtn = e.target.closest('.btn-action-reject');
    if (rejectBtn) {
      e.stopPropagation();
      const itemId = rejectBtn.getAttribute('data-item-id');
      await handleReject(itemId);
      return;
    }

    // F) Acción Editar
    const editBtn = e.target.closest('.btn-action-edit');
    if (editBtn) {
      e.stopPropagation();
      closeActivePopover();
      const itemId = editBtn.getAttribute('data-item-id');
      const item = state.allItems.find(i => i.id == itemId);
      if (item) openEditModal(item);
      return;
    }

    // G) Acción Cambiar Estado (Abre modal de confirmación)
    const toggleActBtn = e.target.closest('.btn-action-toggle-active');
    if (toggleActBtn) {
      e.stopPropagation();
      closeActivePopover();
      const itemId = toggleActBtn.getAttribute('data-item-id');
      const item = state.allItems.find(i => i.id == itemId);
      if (item) openStatusModal(item);
      return;
    }

    // H) Acción Eliminar
    const deleteBtn = e.target.closest('.btn-action-delete');
    if (deleteBtn) {
      e.stopPropagation();
      closeActivePopover();
      const itemId = deleteBtn.getAttribute('data-item-id');
      await handleDelete(itemId);
      return;
    }
  });

  // 10. Drag & Drop y Subida de Archivos en Modal Registrar
  setupCreateDropzone();

  // 11. Contador de caracteres en descripción (Registrar)
  const createCaption = document.getElementById('create-caption');
  const createCounter = document.getElementById('create-char-counter');
  if (createCaption && createCounter) {
    createCaption.addEventListener('input', () => {
      createCounter.textContent = `${createCaption.value.length}/255`;
    });
  }

  // 12. Contador de caracteres en descripción (Editar)
  const editCaption = document.getElementById('edit-caption');
  const editCounter = document.getElementById('edit-char-counter');
  if (editCaption && editCounter) {
    editCaption.addEventListener('input', () => {
      editCounter.textContent = `${editCaption.value.length}/255`;
    });
  }

  // 13. Switch Activo en Modal Editar
  const editActiveToggle = document.getElementById('edit-is-active-toggle');
  const editActiveLabel = document.getElementById('edit-active-toggle-label');
  if (editActiveToggle && editActiveLabel) {
    editActiveToggle.addEventListener('change', () => {
      editActiveLabel.textContent = editActiveToggle.checked ? 'Sí' : 'No';
    });
  }

  // 14. Botón Cambiar Imagen en Modal Editar
  const triggerEditFileBtn = document.getElementById('btn-trigger-edit-file');
  const editFileInput = document.getElementById('edit-file-input');
  if (triggerEditFileBtn && editFileInput) {
    triggerEditFileBtn.addEventListener('click', () => editFileInput.click());
    editFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showNotificationToast('El archivo supera el límite de 5 MB', 'danger');
          return;
        }
        state.editSelectedFile = file;
        const url = URL.createObjectURL(file);
        document.getElementById('edit-current-thumb').src = url;
        showNotificationToast('Nueva imagen seleccionada', 'success');
      }
    });
  }

  // 15. Envío de Formulario: Registrar Imagen
  const createForm = document.getElementById('form-create-gallery');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCreateSubmit();
    });
  }

  // 16. Envío de Formulario: Editar Imagen
  const editForm = document.getElementById('form-edit-gallery');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleEditSubmit();
    });
  }

  // 17. Envío de Formulario: Cambiar Estado
  const statusForm = document.getElementById('form-change-status');
  if (statusForm) {
    statusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleStatusSubmit();
    });
  }

  // 18. Cerrar con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeQuickViewModal();
      closeCreateModal();
      closeEditModal();
      closeStatusModal();
      closeLightbox();
      closeActivePopover();
    }
  });

  // 19. Clic en fondo (backdrop) para cerrar modales
  ['modal-quickview', 'modal-create', 'modal-edit', 'modal-status', 'lightbox-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          if (id === 'modal-quickview') closeQuickViewModal();
          else if (id === 'modal-create') closeCreateModal();
          else if (id === 'modal-edit') closeEditModal();
          else if (id === 'modal-status') closeStatusModal();
          else if (id === 'lightbox-modal') closeLightbox();
        }
      });
    }
  });
}

/**
 * Configura el área de Drag & Drop para el modal de registrar imagen.
 */
function setupCreateDropzone() {
  const dropzone = document.getElementById('create-dropzone');
  const fileInput = document.getElementById('create-file-input');
  const previewBox = document.getElementById('create-preview-container');
  const previewImg = document.getElementById('create-preview-img');
  const previewName = document.getElementById('create-preview-name');
  const previewSize = document.getElementById('create-preview-size');
  const removeBtn = document.getElementById('btn-remove-create-img');

  if (!dropzone || !fileInput) return;

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
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    if (!file.type.startsWith('image/')) {
      showNotificationToast('Formato de archivo inválido. Usa JPG, PNG o WEBP', 'danger');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotificationToast('El archivo supera el tamaño máximo permitido de 5 MB', 'danger');
      return;
    }

    state.createSelectedFile = file;

    if (previewImg) previewImg.src = URL.createObjectURL(file);
    if (previewName) previewName.textContent = file.name;
    if (previewSize) previewSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    dropzone.style.display = 'none';
    if (previewBox) previewBox.classList.add('has-image');
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      state.createSelectedFile = null;
      fileInput.value = '';
      if (previewBox) previewBox.classList.remove('has-image');
      dropzone.style.display = 'flex';
    });
  }
}

/**
 * Procesa el envío del formulario de registro de imagen.
 */
async function handleCreateSubmit() {
  if (!state.createSelectedFile) {
    showNotificationToast('Por favor selecciona una imagen para continuar', 'danger');
    return;
  }

  const caption = document.getElementById('create-caption').value.trim();
  const clientName = document.getElementById('create-user-id')?.value || '';
  const selectedClient = state.clients.find(c => c.name === clientName);
  const clientDoc = selectedClient?.identity_document || 'V-18.452.369';
  const socialNetwork = document.getElementById('create-social-network').value;
  const socialHandle = document.getElementById('create-social-handle').value.trim() || '@usuario';
  const socialUrl = document.getElementById('create-social-url').value.trim() || '#';

  if (!caption || !clientName || !socialNetwork) {
    showNotificationToast('Por favor completa todos los campos obligatorios', 'danger');
    return;
  }

  const formData = new FormData();
  formData.append('image', state.createSelectedFile);
  formData.append('caption', caption);
  formData.append('client_name', clientName);
  formData.append('identity_document', clientDoc);
  formData.append('social_network', socialNetwork);
  formData.append('social_media_handle', socialHandle);
  formData.append('social_media_url', socialUrl);
  formData.append('is_active', 'true');

  try {
    const newItem = await createGalleryItem(formData);
    state.allItems.unshift(newItem);
    renderAllTables();
    closeCreateModal();
    showNotificationToast('Imagen registrada exitosamente en la galería', 'success');
  } catch (error) {
    console.error('[TuEstante Gallery] Error al registrar imagen:', error);
    showNotificationToast('Error al registrar la imagen', 'danger');
  }
}

/**
 * Procesa el envío del formulario de edición de imagen.
 */
async function handleEditSubmit() {
  const itemId = document.getElementById('edit-item-id').value;
  if (!itemId) return;

  const caption = document.getElementById('edit-caption').value.trim();
  const clientName = document.getElementById('edit-user-id')?.value || '';
  const selectedClient = state.clients.find(c => c.name === clientName);
  const clientDoc = selectedClient?.identity_document || 'V-18.452.369';
  const socialNetwork = document.getElementById('edit-social-network').value;
  const socialHandle = document.getElementById('edit-social-handle').value.trim();
  const socialUrl = document.getElementById('edit-social-url').value.trim();
  const moderationStatus = document.getElementById('edit-moderation-status').value;
  const isActive = document.getElementById('edit-is-active-toggle').checked;

  const formData = new FormData();
  if (state.editSelectedFile) {
    formData.append('image', state.editSelectedFile);
  }
  formData.append('caption', caption);
  formData.append('client_name', clientName);
  formData.append('identity_document', clientDoc);
  formData.append('social_network', socialNetwork);
  formData.append('social_media_handle', socialHandle);
  formData.append('social_media_url', socialUrl);
  formData.append('status', moderationStatus);
  formData.append('is_active', String(isActive));

  try {
    const updated = await updateGalleryItem(itemId, formData);
    if (updated) {
      const idx = state.allItems.findIndex(i => i.id == itemId);
      if (idx !== -1) {
        state.allItems[idx] = updated;
      }
      renderAllTables();
      closeEditModal();
      showNotificationToast('Cambios guardados correctamente', 'success');
    }
  } catch (error) {
    console.error('[TuEstante Gallery] Error al actualizar item:', error);
    showNotificationToast('Error al actualizar el registro', 'danger');
  }
}

/**
 * Aprueba una solicitud pendiente.
 */
async function handleApprove(itemId) {
  try {
    const updated = await approveGalleryItem(itemId);
    if (updated) {
      const idx = state.allItems.findIndex(i => i.id == itemId);
      if (idx !== -1) {
        state.allItems[idx] = updated;
      }
      renderAllTables();
      showNotificationToast('Solicitud aprobada e incorporada a la galería publicada', 'success');
    }
  } catch (err) {
    console.error(err);
    showNotificationToast('Error al aprobar la solicitud', 'danger');
  }
}

/**
 * Rechaza una solicitud.
 */
async function handleReject(itemId) {
  try {
    const updated = await rejectGalleryItem(itemId);
    if (updated) {
      const idx = state.allItems.findIndex(i => i.id == itemId);
      if (idx !== -1) {
        state.allItems[idx] = updated;
      }
      renderAllTables();
      showNotificationToast('Solicitud rechazada', 'info');
    }
  } catch (err) {
    console.error(err);
    showNotificationToast('Error al rechazar la solicitud', 'danger');
  }
}

/**
 * Procesa el cambio de estado de una imagen en la galería.
 */
async function handleStatusSubmit() {
  const itemId = document.getElementById('status-item-id').value;
  const targetActiveStr = document.getElementById('status-target-value')?.value;
  const targetActive = targetActiveStr !== undefined 
    ? (targetActiveStr === 'true') 
    : !state.activeStatusItem?.is_active;

  if (!itemId) return;

  try {
    const updated = await updateGalleryItem(itemId, { is_active: targetActive });
    if (updated) {
      const idx = state.allItems.findIndex(i => i.id == itemId);
      if (idx !== -1) {
        state.allItems[idx] = updated;
      }
      renderAllTables();
      closeStatusModal();
      showNotificationToast(
        targetActive ? 'Imagen activada en catálogo con éxito' : 'Imagen puesta en inactiva',
        'success'
      );
    }
  } catch (err) {
    console.error('[TuEstante Gallery] Error al cambiar estado:', err);
    showNotificationToast('Error al cambiar estado activo', 'danger');
  }
}

/**
 * Elimina un registro de la galería con confirmación.
 */
async function handleDelete(itemId) {
  const confirmed = await showConfirmModal({
    title: '¿Eliminar imagen de galería?',
    message: 'Esta acción removerá la imagen de la galería. ¿Deseas continuar?',
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });

  if (!confirmed) return;

  try {
    await deleteGalleryItem(itemId);
    state.allItems = state.allItems.filter(i => i.id != itemId);
    renderAllTables();
    showNotificationToast('Registro eliminado con éxito', 'success');
  } catch (err) {
    console.error(err);
    showNotificationToast('Error al eliminar registro', 'danger');
  }
}

/**
 * ==========================================================================
 * INICIALIZACIÓN DEL MÓDULO DE GALERÍA
 * ==========================================================================
 */
async function initGalleryModule() {
  try {
    // 1. Cargar componentes compartidos del panel (Navbar, Drawer con dropdown y Footer)
    await loadAdminComponents({ title: 'Galería' });

    // 2. Configurar listeners de interacción
    setupEventListeners();

    // 3. Obtener clientes disponibles y banco de datos de galería
    const [clientsData, galleryData] = await Promise.all([
      getClientsList(),
      getGalleryData()
    ]);

    state.clients = clientsData || [];
    state.allItems = galleryData || [];

    // 4. Renderizar tablas
    renderAllTables();

    console.log('%c[TuEstante Admin] Módulo de Galería inicializado con éxito.', 'background: #005187; color: #fcffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  } catch (error) {
    console.error('[TuEstante Admin] Error al inicializar módulo de galería:', error);
  }
}

// Ejecución al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGalleryModule);
} else {
  initGalleryModule();
}
