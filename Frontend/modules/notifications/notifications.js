/**
 * ==========================================================================
 * CONTROLADOR: CENTRO DE NOTIFICACIONES CLIENTE (MASTER-DETAIL SPLIT PANE)
 * TuEstante — Arquitectura de Vista Dividida sin Recargas de Página
 * ==========================================================================
 */

import {
  fetchNotifications,
  fetchNotificationDetail,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  fetchUnreadCount,
  connectNotificationsWebSocket
} from './notifications.api.js';

import { getAccessToken } from '../../js/storage.js';
import { resolveImageUrl } from '../../js/api.js';
import { showToast, showSuccessToast, showErrorToast } from '../../components/toast/toast.js';
import { initNavbar, updateNotificationsBadge } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';

// Estado local de la aplicación
const state = {
  notifications: [],
  filteredNotifications: [],
  selectedId: null,
  activeFilter: 'all', // 'all' | 'unread' | 'order' | 'general'
  searchQuery: '',
  isLoading: true,
  webSocket: null
};

/**
 * Carga dinámica de componentes HTML
 */
async function loadComponent(elementId, filePath) {
  try {
    const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) {
      const html = await response.text();
      const el = document.getElementById(elementId);
      if (el) el.innerHTML = html;
    }
  } catch (err) {
    console.error(`Error al cargar componente ${filePath}:`, err);
  }
}

/**
 * Inicialización al cargar el DOM
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Validar autenticación
  const token = getAccessToken();
  if (!token) {
    const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `../../modules/auth/login.html?redirect=${currentUrl}`;
    return;
  }

  // 2. Cargar Navbar y Footer
  await loadComponent('navbar-container', '../../components/navbar/navbar.html');
  await loadComponent('footer-container', '../../components/footer/footer.html');
  initNavbar();
  initFooter();

  // 3. Configurar eventos de la interfaz
  setupFilterEvents();
  setupSearchEvents();
  setupGlobalActionEvents();
  setupDetailActionEvents();
  setupLightboxEvents();

  // 4. Cargar notificaciones de la API
  await loadNotificationsFromApi();

  // 5. Detectar si viene un ID preseleccionado en la URL (?id=XYZ)
  checkUrlParamsForSelection();

  // 6. Conectar WebSocket para notificaciones en vivo
  initLiveWebSocket();
});

/**
 * Carga inicial de notificaciones desde el backend
 */
async function loadNotificationsFromApi() {
  const skeleton = document.getElementById('notifications-skeleton');
  const feedList = document.getElementById('notifications-feed-list');

  try {
    state.isLoading = true;
    if (skeleton) skeleton.style.display = 'block';
    if (feedList) feedList.innerHTML = '';

    const items = await fetchNotifications();
    state.notifications = items || [];
    applyFiltersAndSearch();
  } catch (error) {
    console.error('[Notificaciones] Error al cargar lista:', error);
    showErrorToast('Error de Conexión', 'No se pudieron cargar tus notificaciones. Intenta nuevamente.');
  } finally {
    state.isLoading = false;
    if (skeleton) skeleton.style.display = 'none';
  }
}

/**
 * Aplica los filtros de pestaña y la búsqueda por texto
 */
function applyFiltersAndSearch() {
  let list = [...state.notifications];

  // Filtro por categoría / estado
  if (state.activeFilter === 'unread') {
    list = list.filter(n => !n.is_read);
  } else if (state.activeFilter === 'order') {
    list = list.filter(n => n.notification_type === 'order' || n.notification_type === 'employee_order');
  } else if (state.activeFilter === 'general') {
    list = list.filter(n => n.notification_type === 'general' || n.notification_type === 'payroll');
  }

  // Filtro por búsqueda
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(n => {
      const title = (n.title || '').toLowerCase();
      const message = (n.message || '').toLowerCase();
      const orderNum = (n.order_number || '').toLowerCase();
      return title.includes(q) || message.includes(q) || orderNum.includes(q);
    });
  }

  state.filteredNotifications = list;
  updateCountersAndBadges();
  renderMasterFeed();
}

/**
 * Actualiza los números y badges de la interfaz
 */
function updateCountersAndBadges() {
  const allCount = state.notifications.length;
  const unreadCount = state.notifications.filter(n => !n.is_read).length;
  const orderCount = state.notifications.filter(n => n.notification_type === 'order' || n.notification_type === 'employee_order').length;
  const generalCount = state.notifications.filter(n => n.notification_type === 'general' || n.notification_type === 'payroll').length;

  const badgeAll = document.getElementById('badge-count-all');
  const badgeUnread = document.getElementById('badge-count-unread');
  const badgeOrder = document.getElementById('badge-count-order');
  const badgeGeneral = document.getElementById('badge-count-general');
  const unreadPill = document.getElementById('unread-count-badge');
  const masterCount = document.getElementById('master-items-count');

  if (badgeAll) badgeAll.textContent = allCount;
  if (badgeUnread) badgeUnread.textContent = unreadCount;
  if (badgeOrder) badgeOrder.textContent = orderCount;
  if (badgeGeneral) badgeGeneral.textContent = generalCount;

  if (unreadPill) {
    if (unreadCount > 0) {
      unreadPill.textContent = `${unreadCount} pendiente${unreadCount > 1 ? 's' : ''}`;
      unreadPill.classList.remove('is-hidden');
    } else {
      unreadPill.classList.add('is-hidden');
    }
  }

  if (masterCount) {
    masterCount.textContent = `${state.filteredNotifications.length} notificación${state.filteredNotifications.length !== 1 ? 'es' : ''}`;
  }

  // Actualizar también el badge global de la campana en la barra superior
  updateNotificationsBadge(unreadCount);
}

/**
 * Renderiza la lista de tarjetas en el panel izquierdo (Master Feed)
 */
function renderMasterFeed() {
  const feedList = document.getElementById('notifications-feed-list');
  const emptyState = document.getElementById('feed-empty-state');
  const emptyText = document.getElementById('feed-empty-text');
  if (!feedList) return;

  if (state.filteredNotifications.length === 0) {
    feedList.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'block';
      if (emptyText) {
        emptyText.textContent = state.searchQuery 
          ? `No se encontraron resultados para "${state.searchQuery}".` 
          : 'No tienes notificaciones en esta sección.';
      }
    }
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  feedList.innerHTML = state.filteredNotifications.map(item => {
    const isSelected = item.id === state.selectedId;
    const isUnread = !item.is_read;
    const iconMeta = getNotificationIcon(item.notification_type);
    const timeFormatted = formatRelativeTime(item.created_at);
    const mediaCount = (item.media_files || []).length;

    return `
      <div 
        class="notif-card ${isUnread ? 'is-unread' : ''} ${isSelected ? 'is-selected' : ''}" 
        data-id="${item.id}"
        role="button"
        tabindex="0"
        aria-label="${escapeHtml(item.title || 'Notificación')}">
        
        <div class="notif-card-icon-box ${iconMeta.cssClass}">
          ${iconMeta.svg}
        </div>

        <div class="notif-card-content">
          <div class="notif-card-header">
            <h3 class="notif-card-title">${escapeHtml(item.title || 'Sin Título')}</h3>
            ${isUnread ? '<span class="notif-unread-dot" title="No leída"></span>' : ''}
          </div>

          <p class="notif-card-preview">${escapeHtml(item.message || '')}</p>

          <div class="notif-card-meta">
            <span class="notif-type-tag ${item.notification_type === 'order' ? 'order' : 'general'}">
              ${escapeHtml(item.order_number || (item.notification_type === 'order' ? 'Pedido' : 'Aviso'))}
            </span>
            ${mediaCount > 0 ? `
              <span class="notif-media-indicator" title="${mediaCount} archivo(s) adjunto(s)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                ${mediaCount}
              </span>
            ` : ''}
            <span class="notif-card-time">${timeFormatted}</span>
          </div>
        </div>

      </div>
    `;
  }).join('');

  // Vincular eventos de clic a cada tarjeta
  feedList.querySelectorAll('.notif-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.getAttribute('data-id'), 10);
      selectNotification(id);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = parseInt(card.getAttribute('data-id'), 10);
        selectNotification(id);
      }
    });
  });
}

/**
 * Selecciona una notificación, la muestra en el panel lateral y la marca como leída
 * (Arquitectura Master-Detail sin recargar la pantalla)
 */
export async function selectNotification(id) {
  if (!id) return;
  state.selectedId = id;

  // Actualizar clase activa en las tarjetas de la lista
  document.querySelectorAll('.notif-card').forEach(card => {
    const cardId = parseInt(card.getAttribute('data-id'), 10);
    card.classList.toggle('is-selected', cardId === id);
  });

  // Localizar datos de la notificación
  let item = state.notifications.find(n => n.id === id);

  // Si no está en memoria, solicitarla al backend
  if (!item) {
    try {
      item = await fetchNotificationDetail(id);
      if (item) {
        state.notifications.unshift(item);
      }
    } catch (err) {
      console.error('[Notificaciones] Error al obtener detalle:', err);
      showErrorToast('Error', 'No se pudo cargar la notificación seleccionada.');
      return;
    }
  }

  // Renderizar los datos en el panel lateral
  renderDetailPane(item);

  // Marcar automáticamente como leída si no lo estaba
  if (item && !item.is_read) {
    item.is_read = true;
    try {
      markNotificationAsRead(id);
    } catch (e) {
      console.warn('Error silencioso al marcar como leída:', e);
    }
    // Remover punto rojo y estilo no leído de la tarjeta en el feed
    const currentCard = document.querySelector(`.notif-card[data-id="${id}"]`);
    if (currentCard) {
      currentCard.classList.remove('is-unread');
      const dot = currentCard.querySelector('.notif-unread-dot');
      if (dot) dot.remove();
    }
    updateCountersAndBadges();
  }

  // Actualizar URL sin recargar (?id=XYZ)
  const url = new URL(window.location);
  url.searchParams.set('id', id);
  window.history.replaceState({ id }, '', url);

  // Activar vista de detalle en dispositivos móviles
  const layout = document.getElementById('notifications-split-layout');
  if (layout) {
    layout.classList.add('is-detail-active');
  }
}

/**
 * Renderiza el panel lateral derecho con todos los datos de la notificación
 */
function renderDetailPane(notif) {
  const emptyState = document.getElementById('detail-empty-state');
  const contentWrapper = document.getElementById('detail-content-wrapper');
  if (!emptyState || !contentWrapper) return;

  if (!notif) {
    emptyState.style.display = 'flex';
    contentWrapper.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  contentWrapper.style.display = 'flex';

  // 1. Tipo y fecha
  const typePill = document.getElementById('detail-type-pill');
  const dateBadge = document.getElementById('detail-date-badge');
  if (typePill) {
    const isOrder = notif.notification_type === 'order' || notif.notification_type === 'employee_order';
    typePill.textContent = isOrder ? 'Pedido de Compra' : 'Aviso General';
    typePill.className = `detail-type-pill ${isOrder ? 'type-order' : 'type-general'}`;
  }
  if (dateBadge) {
    dateBadge.textContent = formatFullDateTime(notif.created_at);
  }

  // 2. Botón toggle leído / no leído
  const toggleBtnLabel = document.getElementById('label-toggle-read');
  if (toggleBtnLabel) {
    toggleBtnLabel.textContent = notif.is_read ? 'Marcar no leída' : 'Marcar como leída';
  }

  // 3. Título y Cuerpo del mensaje
  const titleEl = document.getElementById('detail-title');
  const bodyEl = document.getElementById('detail-body-text');
  if (titleEl) titleEl.textContent = notif.title || 'Sin Título';
  if (bodyEl) bodyEl.textContent = notif.message || '';

  // 4. Caja de Pedido Relacionado
  const orderBox = document.getElementById('detail-order-box');
  const orderNumberEl = document.getElementById('order-box-number');
  const orderStatusEl = document.getElementById('order-box-status');
  const orderTotalEl = document.getElementById('order-box-total');
  const orderLink = document.getElementById('btn-view-order-link');

  if (notif.order || notif.order_id || notif.order_number) {
    if (orderBox) orderBox.style.display = 'flex';
    const num = notif.order_number || `#${notif.order_id || notif.order}`;
    if (orderNumberEl) orderNumberEl.textContent = `Pedido ${num}`;
    if (orderStatusEl) {
      orderStatusEl.textContent = notif.order_status_display || notif.order_status || 'Registrado';
    }
    if (orderTotalEl) {
      orderTotalEl.textContent = notif.order_total ? `• Total: $${parseFloat(notif.order_total).toFixed(2)}` : '';
    }
    if (orderLink) {
      const targetId = notif.order_id || notif.order;
      orderLink.href = `../order/my-orders.html?id=${targetId}`;
    }
  } else {
    if (orderBox) orderBox.style.display = 'none';
  }

  // 5. Galería de Archivos Multimedia Adjuntos
  const mediaSection = document.getElementById('detail-media-section');
  const mediaGrid = document.getElementById('detail-media-grid');
  const mediaFiles = notif.media_files || [];

  if (mediaSection && mediaGrid) {
    if (mediaFiles.length > 0) {
      mediaSection.style.display = 'flex';
      mediaGrid.innerHTML = mediaFiles.map(file => {
        const fullUrl = resolveImageUrl(file.file_url || file.file);
        const isVideo = file.media_type === 'video' || (file.file && file.file.match(/\.(mp4|webm|mov)$/i));

        if (isVideo) {
          return `
            <div class="media-video-card">
              <video controls preload="metadata" src="${escapeHtml(fullUrl)}"></video>
            </div>
          `;
        }

        return `
          <div class="media-thumbnail-card" data-full-src="${escapeHtml(fullUrl)}" title="Clic para ampliar imagen">
            <img src="${escapeHtml(fullUrl)}" alt="Archivo adjunto" loading="lazy" onerror="this.src='../../assets/images/logo.jpeg'">
            <div class="zoom-overlay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </div>
          </div>
        `;
      }).join('');

      // Eventos de ampliación de imagen
      mediaGrid.querySelectorAll('.media-thumbnail-card').forEach(card => {
        card.addEventListener('click', () => {
          const src = card.getAttribute('data-full-src');
          openLightbox(src);
        });
      });
    } else {
      mediaSection.style.display = 'none';
      mediaGrid.innerHTML = '';
    }
  }
}

/**
 * Eventos para filtros por pestaña
 */
function setupFilterEvents() {
  document.querySelectorAll('.filter-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab-btn').forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });

      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      state.activeFilter = btn.getAttribute('data-filter') || 'all';

      applyFiltersAndSearch();
    });
  });
}

/**
 * Eventos para búsqueda en vivo
 */
function setupSearchEvents() {
  const searchInput = document.getElementById('toolbar-search-input');
  const clearBtn = document.getElementById('toolbar-search-clear');
  if (!searchInput) return;

  let debounceTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = searchInput.value.trim();
      if (clearBtn) {
        clearBtn.classList.toggle('is-visible', state.searchQuery.length > 0);
      }
      applyFiltersAndSearch();
    }, 200);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      clearBtn.classList.remove('is-visible');
      applyFiltersAndSearch();
      searchInput.focus();
    });
  }
}

/**
 * Eventos para acciones globales (Marcar todas como leídas)
 */
function setupGlobalActionEvents() {
  const btnMarkAll = document.getElementById('btn-mark-all-read');
  if (btnMarkAll) {
    btnMarkAll.addEventListener('click', async () => {
      const unreadCount = state.notifications.filter(n => !n.is_read).length;
      if (unreadCount === 0) {
        showToast('info', 'Notificaciones al día', 'No tienes notificaciones pendientes por leer.');
        return;
      }

      btnMarkAll.disabled = true;
      try {
        await markAllNotificationsAsRead();
        state.notifications.forEach(n => { n.is_read = true; });
        applyFiltersAndSearch();
        updateNotificationsBadge(0);
        showSuccessToast('Notificaciones actualizadas', 'Todas tus notificaciones se marcaron como leídas.');
      } catch (err) {
        console.error('Error al marcar todas como leídas:', err);
        showErrorToast('Error', 'No se pudo actualizar el estado de las notificaciones.');
      } finally {
        btnMarkAll.disabled = false;
      }
    });
  }
}

/**
 * Eventos para botones dentro del panel de detalle
 */
function setupDetailActionEvents() {
  // Botón Volver a la lista en versión móvil
  const btnBack = document.getElementById('btn-back-to-feed');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      const layout = document.getElementById('notifications-split-layout');
      if (layout) {
        layout.classList.remove('is-detail-active');
      }
    });
  }

  // Alternar leído / no leído
  const btnToggleRead = document.getElementById('btn-toggle-read-status');
  if (btnToggleRead) {
    btnToggleRead.addEventListener('click', async () => {
      if (!state.selectedId) return;
      const item = state.notifications.find(n => n.id === state.selectedId);
      if (!item) return;

      if (item.is_read) {
        // Marcar como no leída
        item.is_read = false;
        showToast('info', 'Notificación', 'Marcada como no leída.');
      } else {
        // Marcar como leída
        item.is_read = true;
        try {
          await markNotificationAsRead(item.id);
        } catch (e) {
          console.warn(e);
        }
        showSuccessToast('Notificación', 'Marcada como leída.');
      }

      updateCountersAndBadges();
      renderMasterFeed();
      renderDetailPane(item);
    });
  }

  // Eliminar notificación
  const btnDelete = document.getElementById('btn-delete-notification');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!state.selectedId) return;
      const targetId = state.selectedId;

      if (!confirm('¿Deseas eliminar esta notificación?')) return;

      try {
        await deleteNotification(targetId);
        state.notifications = state.notifications.filter(n => n.id !== targetId);
        state.selectedId = null;

        applyFiltersAndSearch();
        renderDetailPane(null);

        // En móvil, volver a la lista
        const layout = document.getElementById('notifications-split-layout');
        if (layout) layout.classList.remove('is-detail-active');

        // Limpiar parámetro de URL
        const url = new URL(window.location);
        url.searchParams.delete('id');
        window.history.replaceState({}, '', url);

        showSuccessToast('Eliminada', 'La notificación ha sido eliminada.');
      } catch (err) {
        console.error('Error al eliminar notificación:', err);
        showErrorToast('Error', 'No se pudo eliminar la notificación.');
      }
    });
  }
}

/**
 * Eventos para Lightbox modal de ampliación de fotos
 */
function setupLightboxEvents() {
  const modal = document.getElementById('notif-lightbox-modal');
  const closeBtn = document.getElementById('lightbox-close-btn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => closeLightbox());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLightbox();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) {
      closeLightbox();
    }
  });
}

function openLightbox(src) {
  const modal = document.getElementById('notif-lightbox-modal');
  const img = document.getElementById('lightbox-img');
  if (!modal || !img || !src) return;

  img.src = src;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  const modal = document.getElementById('notif-lightbox-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Comprueba si la URL contiene un parámetro de ID (?id=XYZ) para abrirlo automáticamente
 */
function checkUrlParamsForSelection() {
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  if (idParam) {
    const id = parseInt(idParam, 10);
    if (!isNaN(id)) {
      selectNotification(id);
    }
  }
}

/**
 * Conexión WebSocket en tiempo real
 */
function initLiveWebSocket() {
  const indicator = document.getElementById('live-indicator');
  const statusText = document.getElementById('live-status-text');

  state.webSocket = connectNotificationsWebSocket({
    onStatusChange: (status) => {
      if (statusText) {
        statusText.textContent = status === 'connected' ? 'En vivo' : 'Desconectado';
      }
      if (indicator) {
        indicator.style.opacity = status === 'connected' ? '1' : '0.5';
      }
    },
    onMessage: (data) => {
      // Si llega una nueva notificación
      if (data && data.notification) {
        const newNotif = data.notification;
        // Insertar al inicio de la lista
        state.notifications.unshift(newNotif);
        applyFiltersAndSearch();
        showToast('info', 'Nueva Notificación', newNotif.title || 'Has recibido una actualización.');
      }
    }
  });
}

/**
 * ==========================================================================
 * UTILIDADES DE FORMATEO
 * ==========================================================================
 */

function getNotificationIcon(type) {
  switch (type) {
    case 'order':
    case 'employee_order':
      return {
        cssClass: 'type-order',
        svg: `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        `
      };
    case 'payroll':
      return {
        cssClass: 'type-payroll',
        svg: `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
        `
      };
    default:
      return {
        cssClass: 'type-general',
        svg: `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        `
      };
  }
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs} h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function formatFullDateTime(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

if (typeof window !== 'undefined') {
  window.selectNotification = selectNotification;
}

