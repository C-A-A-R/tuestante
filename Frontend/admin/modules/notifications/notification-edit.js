/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DE EDICIÓN DE NOTIFICACIÓN
 * ==========================================================================
 */

import { loadAdminComponents, showToast } from '../../components/navbar/navbar.js';
import { obtenerDetalleNotificacion, actualizarNotificacion } from './notifications.api.js';

// Estado local de la pantalla
const state = {
  notifId: null,
  notification: null,
  existingMedia: [],   // Archivos ya existentes en el backend
  deletedMediaIds: [], // IDs de archivos existentes a eliminar
  newAttachments: [],  // Archivos recién agregados por el usuario
  isSubmitting: false
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Cargar componentes compartidos del panel
    await loadAdminComponents();

    // 2. Extraer el ID de la notificación desde la URL
    const params = new URLSearchParams(window.location.search);
    state.notifId = params.get('id');

    if (!state.notifId) {
      showToast('error', 'ID requerido', 'No se proporcionó el identificador de la notificación.');
      setTimeout(() => {
        window.location.href = 'notifications.html';
      }, 1500);
      return;
    }

    // 3. Inicializar manejadores de eventos
    initCharCounter();
    initMediaUploaders();
    initFormSubmission();

    // 4. Cargar datos de la notificación
    await loadNotificationData(state.notifId);

  } catch (error) {
    console.error('[Notification Edit] Error durante la inicialización:', error);
    showToast('error', 'Error', 'Ocurrió un problema al cargar la notificación.');
  }
});

/**
 * Carga los datos completos de la notificación y puebla la pantalla
 */
async function loadNotificationData(id) {
  try {
    const notif = await obtenerDetalleNotificacion(id);
    state.notification = notif;
    state.existingMedia = notif.media_files || [];
    state.deletedMediaIds = [];
    state.newAttachments = [];

    // 1. Información de la Orden Asociada
    const ordNum = notif.order_number || (notif.order_id ? `#${String(notif.order_id).padStart(5, '0')}` : (notif.order ? `#${String(notif.order).padStart(5, '0')}` : 'Sin Pedido'));
    const clientName = notif.user_name || notif.user || 'Cliente';
    const ordDate = formatDate(notif.created_at);
    const ordStatus = notif.order_status_display || 'En fabricación';

    document.getElementById('edit-order-num').textContent = ordNum.startsWith('Pedido') ? ordNum : `Pedido ${ordNum}`;
    document.getElementById('edit-order-client').textContent = clientName;
    document.getElementById('edit-order-date').textContent = ordDate;
    document.getElementById('edit-order-status').textContent = ordStatus;

    // 2. Asunto y Mensaje
    const inputSubject = document.getElementById('input-edit-subject');
    const inputMessage = document.getElementById('input-edit-message');

    inputSubject.value = notif.title || '';
    inputMessage.value = notif.message || '';

    // Actualizar contador de caracteres
    updateCharCounter();

    // 3. Renderizar Adjuntos
    renderAttachmentsGrid();

    // 4. Estado de Visualización (Solo Lectura)
    renderStatusSection(notif);

  } catch (err) {
    console.error('[Notification Edit] Error al obtener detalle:', err);
    showToast('error', 'Error al cargar', 'No se pudo cargar la información de la notificación.');
  }
}

/**
 * Renderiza la sección de estado de la notificación (Solo Lectura)
 */
function renderStatusSection(notif) {
  const badgeContainer = document.getElementById('badge-view-status');
  const textSentDate = document.getElementById('text-sent-date');

  // Estado de visualización
  if (notif.is_read || notif.status === 'read') {
    badgeContainer.className = 'status-indicator-badge status-badge-read';
    badgeContainer.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      <span>Vista por el cliente (Leída)</span>
    `;
  } else {
    badgeContainer.className = 'status-indicator-badge status-badge-unread';
    badgeContainer.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span>Enviada (Aún no vista)</span>
    `;
  }

  // Fecha y hora de envío
  textSentDate.textContent = formatDateTime(notif.created_at);
}

/**
 * Contador de caracteres para el mensaje
 */
function initCharCounter() {
  const textarea = document.getElementById('input-edit-message');
  if (!textarea) return;

  textarea.addEventListener('input', updateCharCounter);
}

function updateCharCounter() {
  const textarea = document.getElementById('input-edit-message');
  const counter = document.getElementById('edit-char-counter');
  if (!textarea || !counter) return;

  const len = textarea.value.length;
  counter.textContent = `${len}/2000`;
  if (len > 1900) {
    counter.style.color = '#ef4444';
    counter.style.fontWeight = '600';
  } else {
    counter.style.color = 'var(--text-muted)';
    counter.style.fontWeight = 'normal';
  }
}

/**
 * Inicializa los selectores de archivos adjuntos
 */
function initMediaUploaders() {
  const btnAddImg = document.getElementById('btn-add-image');
  const btnAddVid = document.getElementById('btn-add-video');
  const fileImgInput = document.getElementById('input-file-image');
  const fileVidInput = document.getElementById('input-file-video');

  btnAddImg.addEventListener('click', () => fileImgInput.click());
  btnAddVid.addEventListener('click', () => fileVidInput.click());

  fileImgInput.addEventListener('change', (e) => handleNewFilesSelected(e.target.files, 'image'));
  fileVidInput.addEventListener('change', (e) => handleNewFilesSelected(e.target.files, 'video'));
}

/**
 * Agrega archivos nuevos a la lista de adjuntos
 */
function handleNewFilesSelected(fileList, type) {
  if (!fileList || fileList.length === 0) return;

  Array.from(fileList).forEach(file => {
    const isVid = type === 'video' || file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);
    const id = 'new_' + Math.random().toString(36).substr(2, 9);

    state.newAttachments.push({
      id,
      file,
      type: isVid ? 'video' : 'image',
      url: previewUrl,
      name: file.name,
      size: formatFileSize(file.size)
    });
  });

  renderAttachmentsGrid();
}

/**
 * Renderiza la cuadrícula completa de archivos adjuntos (existentes y nuevos)
 */
function renderAttachmentsGrid() {
  const grid = document.getElementById('attachments-cards-grid');
  grid.innerHTML = '';

  // 1. Adjuntos ya guardados en el backend
  state.existingMedia.forEach(media => {
    const card = document.createElement('div');
    card.className = 'attachment-item-card';
    card.id = `existing-media-${media.id}`;

    const isVideo = media.media_type === 'video';
    const fileUrl = resolveMediaUrl(media.file_url || media.file);
    const fileName = media.file_name || (isVideo ? 'video_adjunto.mp4' : 'imagen_adjunta.webp');
    const fileSize = media.file_size || '-';

    card.innerHTML = `
      <div class="drag-grip-icon" title="Archivo guardado">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <circle cx="8" cy="5" r="1.5"></circle>
          <circle cx="16" cy="5" r="1.5"></circle>
          <circle cx="8" cy="12" r="1.5"></circle>
          <circle cx="16" cy="12" r="1.5"></circle>
          <circle cx="8" cy="19" r="1.5"></circle>
          <circle cx="16" cy="19" r="1.5"></circle>
        </svg>
      </div>
      <button type="button" class="btn-remove-attachment" title="Eliminar archivo">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="attachment-thumbnail-box">
        ${isVideo ? `
          <video src="${fileUrl}" preload="metadata" style="width: 100%; height: 100%; object-fit: cover;"></video>
          <div class="attachment-video-overlay">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <polygon points="6 4 20 12 6 20"></polygon>
            </svg>
          </div>
        ` : `
          <img src="${fileUrl}" alt="${escapeHtml(fileName)}" class="attachment-img-preview" loading="lazy">
        `}
      </div>
      <div class="attachment-details-box">
        <span class="attachment-filename" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
        <span class="attachment-filesize">${escapeHtml(fileSize)}</span>
      </div>
    `;

    // Marcar para eliminación
    card.querySelector('.btn-remove-attachment').addEventListener('click', (e) => {
      e.stopPropagation();
      state.deletedMediaIds.push(media.id);
      state.existingMedia = state.existingMedia.filter(m => m.id !== media.id);
      renderAttachmentsGrid();
    });

    grid.appendChild(card);
  });

  // 2. Adjuntos nuevos recién seleccionados
  state.newAttachments.forEach(att => {
    const card = document.createElement('div');
    card.className = 'attachment-item-card';
    card.id = `new-att-${att.id}`;

    card.innerHTML = `
      <div class="drag-grip-icon" title="Nuevo archivo">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <circle cx="8" cy="5" r="1.5"></circle>
          <circle cx="16" cy="5" r="1.5"></circle>
          <circle cx="8" cy="12" r="1.5"></circle>
          <circle cx="16" cy="12" r="1.5"></circle>
          <circle cx="8" cy="19" r="1.5"></circle>
          <circle cx="16" cy="19" r="1.5"></circle>
        </svg>
      </div>
      <button type="button" class="btn-remove-attachment" title="Eliminar archivo">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="attachment-thumbnail-box">
        ${att.type === 'video' ? `
          <video src="${att.url}" preload="metadata" style="width: 100%; height: 100%; object-fit: cover;"></video>
          <div class="attachment-video-overlay">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <polygon points="6 4 20 12 6 20"></polygon>
            </svg>
          </div>
        ` : `
          <img src="${att.url}" alt="${escapeHtml(att.name)}" class="attachment-img-preview">
        `}
      </div>
      <div class="attachment-details-box">
        <span class="attachment-filename" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
        <span class="attachment-filesize">${escapeHtml(att.size)}</span>
      </div>
    `;

    // Eliminar archivo nuevo
    card.querySelector('.btn-remove-attachment').addEventListener('click', (e) => {
      e.stopPropagation();
      state.newAttachments = state.newAttachments.filter(a => a.id !== att.id);
      URL.revokeObjectURL(att.url);
      renderAttachmentsGrid();
    });

    grid.appendChild(card);
  });
}

/**
 * Manejo del envío y guardado de cambios
 */
function initFormSubmission() {
  const form = document.getElementById('form-edit-notification');
  const btnSubmit = document.getElementById('btn-save-notification');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (state.isSubmitting) return;

    const title = document.getElementById('input-edit-subject').value.trim();
    const message = document.getElementById('input-edit-message').value.trim();

    if (!title) {
      showToast('error', 'Asunto requerido', 'Por favor ingresa el asunto de la notificación.');
      document.getElementById('input-edit-subject').focus();
      return;
    }

    if (!message) {
      showToast('error', 'Mensaje requerido', 'Por favor ingresa el contenido del mensaje.');
      document.getElementById('input-edit-message').focus();
      return;
    }

    state.isSubmitting = true;
    btnSubmit.disabled = true;
    const originalBtnHTML = btnSubmit.innerHTML;
    btnSubmit.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="animate-spin" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      <span>Guardando cambios...</span>
    `;

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('message', message);

      // Adjuntos marcados para eliminación
      if (state.deletedMediaIds.length > 0) {
        state.deletedMediaIds.forEach(delId => {
          formData.append('deleted_media_ids', delId);
        });
      }

      // Nuevos archivos adjuntos
      state.newAttachments.forEach(att => {
        formData.append('files', att.file);
      });

      await actualizarNotificacion(state.notifId, formData);

      showToast('success', 'Cambios guardados', 'La notificación se actualizó correctamente.');

      setTimeout(() => {
        window.location.href = 'notifications.html';
      }, 1000);

    } catch (err) {
      console.error('[Notification Edit] Error al actualizar notificación:', err);
      const errMsg = err?.message || 'No se pudieron guardar los cambios. Intenta nuevamente.';
      showToast('error', 'Error al guardar', errMsg);
      state.isSubmitting = false;
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalBtnHTML;
    }
  });
}

// Helpers
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return dateStr;
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `http://127.0.0.1:8000${url}`;
  return `http://127.0.0.1:8000/${url}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
