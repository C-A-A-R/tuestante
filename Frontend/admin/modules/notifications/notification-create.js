/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DE CREACIÓN DE NOTIFICACIÓN
 * ==========================================================================
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { crearNotificacionManual, obtenerPedidosSelector } from './notifications.api.js';

// Estado local de la pantalla
const state = {
  orders: [],
  selectedOrder: null,
  attachments: [], // Array de { id, file, type, url, name, size }
  isSubmitting: false
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Cargar componentes globales del panel (Drawer, Navbar, Footer)
    await loadAdminComponents();

    // 2. Inicializar lógica de la pantalla
    initCharCounter();
    initMediaUploaders();
    initFormSubmission();
    await initOrdersSearch();

    // 3. Revisar si viene un pedido preseleccionado por parámetro URL
    checkPreselectedOrder();

  } catch (error) {
    console.error('[Notification Create] Error al inicializar la pantalla:', error);
  }
});

/**
 * Contador en vivo de caracteres para el mensaje
 */
function initCharCounter() {
  const textarea = document.getElementById('input-message');
  const counter = document.getElementById('char-counter');
  if (!textarea || !counter) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len}/2000`;
    if (len > 1900) {
      counter.style.color = '#ef4444';
      counter.style.fontWeight = '600';
    } else {
      counter.style.color = 'var(--text-muted)';
      counter.style.fontWeight = 'normal';
    }
  });
}

/**
 * Carga pedidos disponibles y gestiona el buscador interactivo
 */
async function initOrdersSearch() {
  const searchInput = document.getElementById('input-order-search');
  const dropdown = document.getElementById('order-search-dropdown');
  const orderIdInput = document.getElementById('selected-order-id');
  const cardSelected = document.getElementById('selected-order-card');
  const searchWrapper = document.getElementById('order-search-wrapper');
  const btnChange = document.getElementById('btn-change-order');

  try {
    state.orders = await obtenerPedidosSelector();
  } catch (e) {
    console.warn('[Notification Create] No se pudieron precargar los pedidos:', e);
    state.orders = [];
  }

  // Filtrar y renderizar opciones al escribir en el buscador
  const handleSearch = () => {
    const term = searchInput.value.trim().toLowerCase();
    dropdown.innerHTML = '';

    if (!term) {
      // Si no hay término, mostrar los primeros pedidos más recientes
      renderDropdownItems(state.orders.slice(0, 10));
      dropdown.classList.add('show');
      return;
    }

    const filtered = state.orders.filter(ord => {
      const ordNum = (ord.order_number || `#${String(ord.id).padStart(5, '0')}`).toLowerCase();
      const client = (ord.user_name || ord.user?.first_name || ord.client_name || '').toLowerCase();
      const idStr = String(ord.id);
      return ordNum.includes(term) || client.includes(term) || idStr.includes(term);
    });

    if (filtered.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No se encontraron pedidos que coincidan con "<strong>${escapeHtml(term)}</strong>"
        </div>
      `;
    } else {
      renderDropdownItems(filtered.slice(0, 15));
    }

    dropdown.classList.add('show');
  };

  searchInput.addEventListener('input', handleSearch);
  searchInput.addEventListener('focus', handleSearch);

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!searchWrapper.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });

  // Cambiar orden seleccionada
  btnChange.addEventListener('click', () => {
    state.selectedOrder = null;
    orderIdInput.value = '';
    cardSelected.style.display = 'none';
    searchWrapper.style.display = 'block';
    searchInput.value = '';
    searchInput.focus();
  });
}

/**
 * Renderiza los elementos de la lista desplegable de búsqueda de órdenes
 */
function renderDropdownItems(orders) {
  const dropdown = document.getElementById('order-search-dropdown');

  orders.forEach(ord => {
    const item = document.createElement('div');
    item.className = 'order-dropdown-item';

    const ordNum = ord.order_number || `#${String(ord.id).padStart(5, '0')}`;
    const clientName = ord.user_name || (ord.user ? `${ord.user.first_name || ''} ${ord.user.first_last_name || ''}`.trim() : '') || ord.client_name || 'Cliente';
    const ordDate = formatDate(ord.created_at);
    const ordStatus = ord.order_status_display || ord.status_display || ord.status || 'En proceso';

    item.innerHTML = `
      <div class="dropdown-item-left">
        <div class="dropdown-order-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div class="dropdown-order-text">
          <span class="dropdown-order-num">${escapeHtml(ordNum)}</span>
          <span class="dropdown-order-client">${escapeHtml(clientName)}</span>
        </div>
      </div>
      <div class="dropdown-item-right">
        <span class="order-badge-pill">${escapeHtml(ordStatus)}</span>
        <span class="dropdown-order-date">${escapeHtml(ordDate)}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      selectOrder(ord);
      dropdown.classList.remove('show');
    });

    dropdown.appendChild(item);
  });
}

/**
 * Selecciona una orden y muestra la tarjeta correspondiente
 */
function selectOrder(ord) {
  state.selectedOrder = ord;
  const orderIdInput = document.getElementById('selected-order-id');
  const cardSelected = document.getElementById('selected-order-card');
  const searchWrapper = document.getElementById('order-search-wrapper');

  const ordNum = ord.order_number || `#${String(ord.id).padStart(5, '0')}`;
  const clientName = ord.user_name || (ord.user ? `${ord.user.first_name || ''} ${ord.user.first_last_name || ''}`.trim() : '') || ord.client_name || 'Cliente';
  const ordDate = formatDate(ord.created_at);
  const ordStatus = ord.order_status_display || ord.status_display || ord.status || 'En fabricación';

  document.getElementById('selected-order-num').textContent = ordNum;
  document.getElementById('selected-order-client').textContent = clientName;
  document.getElementById('selected-order-date').textContent = ordDate;
  document.getElementById('selected-order-status').textContent = ordStatus;

  orderIdInput.value = ord.id;
  searchWrapper.style.display = 'none';
  cardSelected.style.display = 'flex';
}

/**
 * Revisa si existe un `order_id` en la URL para seleccionarlo de forma automática
 */
function checkPreselectedOrder() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id') || urlParams.get('id');

  if (orderId && state.orders.length > 0) {
    const found = state.orders.find(o => String(o.id) === String(orderId));
    if (found) {
      selectOrder(found);
    }
  }
}

/**
 * Gestión de carga de adjuntos (Imágenes y Videos)
 */
function initMediaUploaders() {
  const btnAddImg = document.getElementById('btn-add-image');
  const btnAddVid = document.getElementById('btn-add-video');
  const fileImgInput = document.getElementById('input-file-image');
  const fileVidInput = document.getElementById('input-file-video');

  btnAddImg.addEventListener('click', () => fileImgInput.click());
  btnAddVid.addEventListener('click', () => fileVidInput.click());

  fileImgInput.addEventListener('change', (e) => handleFilesSelected(e.target.files, 'image'));
  fileVidInput.addEventListener('change', (e) => handleFilesSelected(e.target.files, 'video'));
}

/**
 * Procesa los archivos agregados y los añade al estado
 */
function handleFilesSelected(fileList, type) {
  if (!fileList || fileList.length === 0) return;

  Array.from(fileList).forEach(file => {
    // Validar tipo básico
    const isVid = type === 'video' || file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);
    const id = 'att_' + Math.random().toString(36).substr(2, 9);

    state.attachments.push({
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
 * Renderiza la cuadrícula de archivos adjuntos
 */
function renderAttachmentsGrid() {
  const grid = document.getElementById('attachments-cards-grid');
  grid.innerHTML = '';

  state.attachments.forEach(att => {
    const card = document.createElement('div');
    card.className = 'attachment-item-card';
    card.id = `card-${att.id}`;

    card.innerHTML = `
      <div class="drag-grip-icon" title="Archivo adjunto">
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

    // Evento para eliminar adjunto
    card.querySelector('.btn-remove-attachment').addEventListener('click', (e) => {
      e.stopPropagation();
      state.attachments = state.attachments.filter(a => a.id !== att.id);
      URL.revokeObjectURL(att.url);
      renderAttachmentsGrid();
    });

    grid.appendChild(card);
  });
}

/**
 * Manejo del envío del formulario
 */
function initFormSubmission() {
  const form = document.getElementById('form-create-notification');
  const btnSubmit = document.getElementById('btn-submit-notification');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (state.isSubmitting) return;

    const orderId = document.getElementById('selected-order-id').value;
    const title = document.getElementById('input-subject').value.trim();
    const message = document.getElementById('input-message').value.trim();

    // 1. Validaciones
    if (!orderId) {
      showToast('error', 'Orden requerida', 'Por favor selecciona la orden a la que va dirigida la notificación.');
      document.getElementById('input-order-search').focus();
      return;
    }

    if (!title) {
      showToast('error', 'Asunto requerido', 'Por favor ingresa el asunto de la notificación.');
      document.getElementById('input-subject').focus();
      return;
    }

    if (!message) {
      showToast('error', 'Mensaje requerido', 'Por favor escribe el mensaje que deseas enviar al cliente.');
      document.getElementById('input-message').focus();
      return;
    }

    // 2. Preparar FormData
    state.isSubmitting = true;
    btnSubmit.disabled = true;
    const originalBtnHTML = btnSubmit.innerHTML;
    btnSubmit.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="animate-spin" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      <span>Enviando notificación...</span>
    `;

    try {
      const formData = new FormData();
      formData.append('order_id', orderId);
      formData.append('title', title);
      formData.append('message', message);
      formData.append('status', 'sent');

      // Adjuntar archivos seleccionados
      state.attachments.forEach(att => {
        formData.append('files', att.file);
      });

      await crearNotificacionManual(formData);

      showToast('success', 'Notificación enviada', 'La notificación se envió con éxito al cliente asociado.');

      // Redirigir a la lista de notificaciones tras 1 segundo
      setTimeout(() => {
        window.location.href = 'notifications.html';
      }, 1000);

    } catch (err) {
      console.error('[Notification Create] Error al enviar notificación:', err);
      const errMsg = err?.message || 'No se pudo enviar la notificación. Verifica la conexión con el servidor.';
      showToast('error', 'Error al enviar', errMsg);
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

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Muestra una alerta Toast temporal en pantalla
 */
function showToast(type = 'success', title = '', message = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const iconSvg = type === 'success'
    ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
    : type === 'error'
    ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
    : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';

  toast.innerHTML = `
    <div class="toast-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        ${iconSvg}
      </svg>
    </div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Cerrar notificación">&times;</button>
  `;

  container.appendChild(toast);

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

