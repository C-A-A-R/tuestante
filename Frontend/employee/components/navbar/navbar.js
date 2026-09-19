/**
 * ==========================================================================
 * TUESTANTE - COMPONENTE NAVBAR TRABAJADOR
 * ==========================================================================
 * Integra:
 * 1. Protección de ruta automática (Auth Guard): Redirige a Login si no hay sesión activa.
 * 2. Buscador con debounce de 300ms integrado con el catálogo.
 * 3. Alertas de nómina y cortes de consumo quincenal.
 * 4. Burbuja de carrito flotante reactiva a CustomEvents de cart-service.
 * 5. Navegación activa para Catálogo, Mis Pedidos y Mi Perfil.
 */

import { getAccessToken, clearTokens, clearCurrentUser, getCurrentUser } from '../../../js/storage.js';
import { obtenerEstadoDeCuenta, obtenerPerfilEmpleado } from '../../modules/profile/profile.api.js';
import { showConfirmModal } from '../dialog/dialog.js';
import { obtenerNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from '../../js/service/notification.api.js';

/**
 * DETERMINA LA RUTA AL LOGIN USANDO import.meta.url
 * Garantiza que la redirección funcione tanto desde la raíz como desde /modules/...
 */
export function getLoginUrl() {
  const loginUrl = new URL('../../../modules/auth/login.html', import.meta.url);
  loginUrl.searchParams.set('redirect', window.location.href);
  return loginUrl.href;
}

/**
 * AUTH GUARD: Valida si existe un token de sesión válido en localStorage.
 * Si no está logueado, redirige de inmediato a la pantalla de login.
 */
export function checkEmployeeAuth() {
  const token = getAccessToken();
  if (!token || token === 'null' || token === 'undefined' || String(token).trim() === '') {
    window.location.replace(getLoginUrl());
    return false;
  }
  return true;
}

// 🚀 EJECUCIÓN INMEDIATA AL IMPORTAR EL MÓDULO:
// Toda pantalla que importe navbar.js queda automáticamente protegida.
checkEmployeeAuth();

let searchDebounceTimer = null;

/**
 * Determina el prefijo relativo a la raíz de employee.
 */
export function getEmployeeRootPrefix() {
  const path = window.location.pathname || '';
  if (path.includes('/modules/')) {
    return '../../';
  }
  return './';
}

/**
 * Renderiza de forma síncrona el HTML completo del NavbarTrabajador.
 * Previene cortes causados por inyecciones externas de servidores locales.
 */
export function renderNavbar(placeholderId = 'navbar-placeholder') {
  const container = document.getElementById(placeholderId);
  if (!container) return;
  const prefix = getEmployeeRootPrefix();
  container.innerHTML = `
    <header class="navbar-trabajador" id="navbar-trabajador" role="banner">
      <div class="navbar-container">
        <!-- Brand / Logotipo -->
        <div class="navbar-brand-group">
          <a href="${prefix}index.html" class="navbar-brand" id="nav-brand-link" title="Ir al Catálogo de Empleados">
            <div class="navbar-logo-icon">
              <img id="nav-brand-img" src="${prefix}../assets/images/logo.jpeg" alt="Logo TuEstante">
            </div>
            <div class="navbar-brand-text">
              <span class="brand-title">TuEstante</span>
              <span class="brand-badge">TRABAJADORES</span>
            </div>
          </a>
        </div>

        <!-- Buscador Central -->
        <div class="navbar-search-wrapper" role="search">
          <div class="search-input-group">
            <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="search" 
              id="navbar-search-input" 
              class="navbar-search-input" 
              placeholder="Buscar por nombre, código de barras o categoría..." 
              aria-label="Buscar en la tienda de empleados"
              autocomplete="off"
            />
            <button type="button" id="navbar-search-clear" class="search-clear-btn" aria-label="Limpiar búsqueda" style="display: none;">
              &times;
            </button>
          </div>
        </div>

        <!-- Enlaces Directos de Navegación -->
        <nav class="navbar-nav-links" aria-label="Navegación principal">
          <a href="${prefix}index.html" class="nav-link" data-nav="catalogo" id="nav-link-catalogo">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Catálogo</span>
          </a>
          <a href="${prefix}modules/order/orders.html" class="nav-link" data-nav="pedidos" id="nav-link-pedidos">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Mis Pedidos</span>
          </a>
        </nav>

        <!-- Acciones Derecha: Notificaciones, Carrito, Perfil de Usuario & Salir -->
        <div class="navbar-actions">
          <!-- Icono de Notificaciones -->
          <div class="notification-dropdown-wrapper">
            <button type="button" class="btn-notification-icon" id="btn-notifications" aria-label="Notificaciones de nómina y consumos" title="Notificaciones" aria-expanded="false">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span class="notification-badge" id="notification-badge" style="display: none;">0</span>
            </button>

            <!-- Popover de Notificaciones -->
            <div class="notification-popover" id="notification-popover" style="display: none;" role="region" aria-label="Notificaciones de pedidos y nómina">
              <div class="popover-header">
                <div class="popover-title-wrapper">
                  <h4>Notificaciones</h4>
                  <span class="notification-unread-count" id="notification-unread-count" style="display: none;">0</span>
                </div>
                <button type="button" class="btn-mark-all-read" id="btn-mark-all-read" title="Marcar todas como leídas">
                  Marcar leídas
                </button>
              </div>
              <div class="popover-tabs" role="tablist">
                <button type="button" class="popover-tab active" data-tab="all" id="tab-notif-all" role="tab" aria-selected="true">Todas</button>
                <button type="button" class="popover-tab" data-tab="unread" id="tab-notif-unread" role="tab" aria-selected="false">No leídas</button>
              </div>
              <div class="popover-body" id="notification-list" role="list">
                <div class="notification-empty" id="notification-empty">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  <p>No tienes notificaciones</p>
                </div>
              </div>
              <div class="popover-footer">
                <a href="${prefix}modules/order/orders.html" id="link-notif-orders" class="popover-footer-link">
                  <span>Ver Mis Pedidos</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <!-- Burbuja Flotante de Carrito -->
          <a href="${prefix}modules/cart/cart.html" class="cart-bubble-btn" id="btn-cart-bubble" title="Ver Carrito de Compras" aria-label="Carrito de compras">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span class="cart-count-badge" id="cart-count-badge" style="display: none;"></span>
          </a>

          <!-- Perfil de Usuario con Icono de Usuario -->
          <a href="${prefix}modules/profile/profile.html" class="navbar-user-btn" id="nav-link-perfil" data-nav="perfil" title="Mi Perfil y Estado de Cuenta" aria-label="Perfil del colaborador">
            <div class="navbar-user-avatar">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span class="navbar-user-text" id="navbar-user-name">Mi Perfil</span>
          </a>

          <!-- Botón Salir / Logout -->
          <button type="button" class="btn-logout" id="btn-logout-trabajador" title="Cerrar Sesión" aria-label="Cerrar sesión">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </header>
  `;
}

/**
 * Inicializa los eventos e interactividad del NavbarTrabajador
 */
export function initNavbar(placeholderId = 'navbar-placeholder') {
  if (!checkEmployeeAuth()) return;

  const placeholder = document.getElementById(placeholderId);
  const cartBtnCheck = document.getElementById('btn-cart-bubble');
  if (placeholder && !cartBtnCheck) {
    renderNavbar(placeholderId);
  }

  const prefix = getEmployeeRootPrefix();
  setupNavLinks(prefix);
  setupSearch(prefix);
  setupNotifications();
  setupCartBadge();
  setupLogout();
}

/**
 * Configura los enlaces de navegación y marca el enlace activo.
 */
function setupNavLinks(prefix) {
  const path = window.location.pathname;

  const linkCatalogo = document.getElementById('nav-link-catalogo');
  const linkPedidos = document.getElementById('nav-link-pedidos');
  const linkPerfil = document.getElementById('nav-link-perfil');
  const brandLink = document.getElementById('nav-brand-link');
  const brandImg = document.getElementById('nav-brand-img');
  const cartBtn = document.getElementById('btn-cart-bubble');
  const userNameEl = document.getElementById('navbar-user-name');

  if (brandLink) brandLink.href = `${prefix}index.html`;
  if (brandImg) brandImg.src = `${prefix}../assets/images/logo.jpeg`;
  if (linkCatalogo) linkCatalogo.href = `${prefix}index.html`;
  if (linkPedidos) linkPedidos.href = `${prefix}modules/order/orders.html`;
  if (linkPerfil) linkPerfil.href = `${prefix}modules/profile/profile.html`;
  if (cartBtn) cartBtn.href = `${prefix}modules/cart/cart.html`;

  if (userNameEl) {
    const user = getCurrentUser();
    if (user && (user.first_name || user.username)) {
      userNameEl.textContent = user.first_name || user.username;
    } else {
      obtenerPerfilEmpleado().then((profile) => {
        if (profile && profile.user && (profile.user.first_name || profile.user.username)) {
          userNameEl.textContent = profile.user.first_name || profile.user.username;
        }
      }).catch(() => {});
    }
  }

  if (path.endsWith('index.html') || path.endsWith('/employee/') || path.endsWith('/employee')) {
    linkCatalogo?.classList.add('active');
  } else if (path.includes('/order/')) {
    linkPedidos?.classList.add('active');
  } else if (path.includes('/profile/')) {
    linkPerfil?.classList.add('active');
  }
}

/**
 * Buscador con debounce de 300ms
 */
function setupSearch(prefix) {
  const input = document.getElementById('navbar-search-input');
  const clearBtn = document.getElementById('navbar-search-clear');
  if (!input) return;

  // Restaurar valor de query param si existe
  const urlParams = new URLSearchParams(window.location.search);
  const currentQuery = urlParams.get('search') || '';
  if (currentQuery) {
    input.value = currentQuery;
    if (clearBtn) clearBtn.style.display = 'block';
  }

  input.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    if (clearBtn) {
      clearBtn.style.display = value ? 'block' : 'none';
    }

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      // Si estamos en la página del catálogo (index.html), emitir evento local
      const path = window.location.pathname;
      const isCatalog = path.endsWith('index.html') || path.endsWith('/employee/') || path.endsWith('/employee');

      if (isCatalog) {
        window.dispatchEvent(new CustomEvent('catalog:search', { detail: { query: value } }));
      } else {
        // Redirigir al catálogo con el parámetro de búsqueda
        const target = `${prefix}index.html?search=${encodeURIComponent(value)}`;
        window.location.href = target;
      }
    }, 300);
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    input.focus();
    window.dispatchEvent(new CustomEvent('catalog:search', { detail: { query: '' } }));
  });
}

/**
 * Función utilitaria para escapar caracteres HTML en textos inseguros
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Campana de Notificaciones, Pestañas y Alertas de Nómina / Pedidos
 */
async function setupNotifications() {
  const btn = document.getElementById('btn-notifications');
  const popover = document.getElementById('notification-popover');
  const badge = document.getElementById('notification-badge');
  const unreadCountPill = document.getElementById('notification-unread-count');
  const list = document.getElementById('notification-list');
  const btnMarkAll = document.getElementById('btn-mark-all-read');
  const tabAll = document.getElementById('tab-notif-all');
  const tabUnread = document.getElementById('tab-notif-unread');
  const footerLinkOrders = document.getElementById('link-notif-orders');

  if (!btn || !popover || !list) return;

  const prefix = getEmployeeRootPrefix();
  if (footerLinkOrders) {
    footerLinkOrders.href = `${prefix}modules/order/orders.html`;
  }

  let activeTab = 'all'; // 'all' | 'unread'
  let cachedNotifications = [];
  let statementAlerts = [];

  // Función para formatear fechas relativas en español
  function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 45) return 'Hace un momento';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Renderizar la lista de notificaciones según pestaña activa
  function renderList() {
    list.innerHTML = '';

    const filtered = activeTab === 'unread'
      ? cachedNotifications.filter((n) => !n.is_read)
      : cachedNotifications;

    const totalToDisplay = filtered.length + statementAlerts.length;

    if (totalToDisplay === 0) {
      list.innerHTML = `
        <div class="notification-empty" id="notification-empty">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <p>${activeTab === 'unread' ? 'No tienes notificaciones sin leer' : 'No tienes notificaciones'}</p>
        </div>
      `;
      return;
    }

    // Avisos de estado de cuenta / nómina (fijados al inicio si aplican)
    statementAlerts.forEach((alert) => {
      const alertEl = document.createElement('div');
      alertEl.className = 'notification-item';
      alertEl.style.borderLeft = '3.5px solid var(--color-danger)';
      alertEl.innerHTML = `
        <div class="notification-item-icon icon-alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div class="notification-item-content">
          <p class="notification-item-title" style="color: var(--color-danger);">${alert.title}</p>
          <p class="notification-item-desc">${alert.desc}</p>
          <div class="notification-item-meta">
            <span class="notification-type-tag tag-alert">Aviso Nómina</span>
          </div>
        </div>
      `;
      alertEl.addEventListener('click', () => {
        openNotificationDetailModal(null, alert);
      });
      list.appendChild(alertEl);
    });

    // Notificaciones de API
    filtered.forEach((notif) => {
      const itemEl = document.createElement('div');
      itemEl.className = `notification-item ${!notif.is_read ? 'unread' : ''}`;

      // Configurar icono y tag según tipo
      let iconClass = 'icon-general';
      let tagClass = 'tag-general';
      let tagLabel = 'General';
      let iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      `;

      if (notif.notification_type === 'employee_order' || notif.notification_type === 'order' || notif.internal_order) {
        iconClass = 'icon-order';
        tagClass = 'tag-order';
        tagLabel = notif.internal_order_number ? `Pedido #${notif.internal_order_number}` : 'Pedido';
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        `;
      } else if (notif.notification_type === 'payroll') {
        iconClass = 'icon-payroll';
        tagClass = 'tag-payroll';
        tagLabel = 'Nómina';
        iconSvg = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        `;
      }

      itemEl.innerHTML = `
        <div class="notification-item-icon ${iconClass}">
          ${iconSvg}
        </div>
        <div class="notification-item-content">
          <p class="notification-item-title">${escapeHtml(notif.title || 'Notificación')}</p>
          <p class="notification-item-desc">${escapeHtml(notif.message || '')}</p>
          <div class="notification-item-meta">
            <span class="notification-type-tag ${tagClass}">${tagLabel}</span>
            <span class="notification-item-time">${formatRelativeTime(notif.created_at)}</span>
          </div>
        </div>
        ${!notif.is_read ? `
          <button type="button" class="btn-item-check" title="Marcar como leída" aria-label="Marcar como leída">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        ` : ''}
      `;

      // Click en el botón de check (marcar leída sin abrir modal)
      const btnCheck = itemEl.querySelector('.btn-item-check');
      if (btnCheck) {
        btnCheck.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await marcarNotificacionLeida(notif.id);
            notif.is_read = true;
            updateBadges();
            renderList();
          } catch (err) {
            console.error('[Notifications] Error al marcar leída:', err);
          }
        });
      }

      // Click en el elemento (marcar leída y abrir modal de lectura)
      itemEl.addEventListener('click', async () => {
        if (!notif.is_read) {
          try {
            await marcarNotificacionLeida(notif.id);
            notif.is_read = true;
            updateBadges();
            renderList();
          } catch (err) {
            console.warn('[Notifications] No se pudo marcar como leída:', err);
          }
        }
        openNotificationDetailModal(notif);
      });

      list.appendChild(itemEl);
    });
  }

  // Modal de Detalle de Notificación (Lectura Completa)
  const notifModal = document.getElementById('modal-notification-detail');
  const btnCloseNotifModal = document.getElementById('btn-close-notif-modal');
  const btnNotifModalClose = document.getElementById('btn-notif-modal-close');
  const btnNotifModalAction = document.getElementById('btn-notif-modal-action');

  function closeNotifDetailModal() {
    if (notifModal) notifModal.style.display = 'none';
  }

  btnCloseNotifModal?.addEventListener('click', closeNotifDetailModal);
  btnNotifModalClose?.addEventListener('click', closeNotifDetailModal);
  notifModal?.addEventListener('click', (e) => {
    if (e.target === notifModal) closeNotifDetailModal();
  });

  function openNotificationDetailModal(notif, alertData = null) {
    if (!notifModal) return;

    const modalTitle = document.getElementById('notif-modal-title');
    const modalTime = document.getElementById('notif-modal-time');
    const modalTypeTag = document.getElementById('notif-modal-type-tag');
    const modalMsg = document.getElementById('notif-modal-message');

    if (alertData) {
      if (modalTitle) modalTitle.textContent = alertData.title || 'Aviso de Nómina';
      if (modalTime) modalTime.textContent = 'Aviso Pendiente';
      if (modalMsg) modalMsg.textContent = alertData.desc || '';
      if (modalTypeTag) {
        modalTypeTag.className = 'notification-type-tag tag-alert';
        modalTypeTag.textContent = 'Aviso Nómina';
        modalTypeTag.style.background = '#fef2f2';
        modalTypeTag.style.color = '#dc2626';
      }
      if (btnNotifModalAction) {
        btnNotifModalAction.style.display = 'inline-block';
        btnNotifModalAction.textContent = 'Ver Estado de Cuenta';
        btnNotifModalAction.onclick = () => {
          closeNotifDetailModal();
          window.location.href = `${prefix}modules/profile/profile.html`;
        };
      }
    } else if (notif) {
      if (modalTitle) modalTitle.textContent = notif.title || 'Notificación';
      if (modalTime) modalTime.textContent = formatRelativeTime(notif.created_at);
      if (modalMsg) modalMsg.textContent = notif.message || 'Sin contenido adicional.';

      if (modalTypeTag) {
        if (notif.notification_type === 'employee_order' || notif.notification_type === 'order' || notif.internal_order) {
          modalTypeTag.className = 'notification-type-tag tag-order';
          modalTypeTag.textContent = notif.internal_order_number ? `Pedido #${notif.internal_order_number}` : 'Pedido';
          modalTypeTag.style.background = '#eff6ff';
          modalTypeTag.style.color = '#2563eb';
        } else if (notif.notification_type === 'payroll') {
          modalTypeTag.className = 'notification-type-tag tag-payroll';
          modalTypeTag.textContent = 'Nómina';
          modalTypeTag.style.background = '#f0fdf4';
          modalTypeTag.style.color = '#16a34a';
        } else {
          modalTypeTag.className = 'notification-type-tag tag-general';
          modalTypeTag.textContent = 'General';
          modalTypeTag.style.background = '#f1f5f9';
          modalTypeTag.style.color = '#475569';
        }
      }

      if (btnNotifModalAction) {
        if (notif.internal_order || notif.notification_type === 'employee_order' || notif.notification_type === 'order') {
          btnNotifModalAction.style.display = 'inline-block';
          btnNotifModalAction.textContent = 'Ir a Mis Pedidos';
          btnNotifModalAction.onclick = () => {
            closeNotifDetailModal();
            const orderTarget = notif.internal_order
              ? `${prefix}modules/order/orders.html?orderId=${notif.internal_order}`
              : `${prefix}modules/order/orders.html`;
            window.location.href = orderTarget;
          };
        } else if (notif.notification_type === 'payroll') {
          btnNotifModalAction.style.display = 'inline-block';
          btnNotifModalAction.textContent = 'Ver Estado de Cuenta';
          btnNotifModalAction.onclick = () => {
            closeNotifDetailModal();
            window.location.href = `${prefix}modules/profile/profile.html`;
          };
        } else {
          btnNotifModalAction.style.display = 'none';
        }
      }
    }

    notifModal.style.display = 'flex';
  }

  // Actualizar indicadores numéricos de no leídas
  function updateBadges() {
    const unreadCount = cachedNotifications.filter((n) => !n.is_read).length + statementAlerts.length;
    if (badge) {
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    if (unreadCountPill) {
      unreadCountPill.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      unreadCountPill.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
  }

  // Carga las notificaciones desde el backend
  async function loadNotifications() {
    try {
      const data = await obtenerNotificaciones();
      cachedNotifications = Array.isArray(data) ? data : [];
      updateBadges();
      renderList();
    } catch (err) {
      console.error('[Notifications] Error cargando notificaciones:', err);
    }
  }

  // Consultar estado de cuenta del empleado para alertas de nómina quincenal
  try {
    const statement = await obtenerEstadoDeCuenta();
    if (statement && statement.has_overdue_debt) {
      statementAlerts = [{
        title: 'Saldo en Revisión de Nómina',
        desc: `Tienes un saldo acumulado de $${parseFloat(statement.overdue_debt_amount || statement.current_debt || 0).toFixed(2)} programado para descuento.`
      }];
    }
  } catch (err) {
    console.debug('[NavbarTrabajador] Estado de cuenta no disponible:', err);
  }

  // Eventos de Pestañas (Todas / No leídas)
  tabAll?.addEventListener('click', () => {
    activeTab = 'all';
    tabAll.classList.add('active');
    tabUnread?.classList.remove('active');
    tabAll.setAttribute('aria-selected', 'true');
    tabUnread?.setAttribute('aria-selected', 'false');
    renderList();
  });

  tabUnread?.addEventListener('click', () => {
    activeTab = 'unread';
    tabUnread.classList.add('active');
    tabAll?.classList.remove('active');
    tabUnread.setAttribute('aria-selected', 'true');
    tabAll?.setAttribute('aria-selected', 'false');
    renderList();
  });

  // Evento botón "Marcar todas como leídas"
  btnMarkAll?.addEventListener('click', async () => {
    const unreadCount = cachedNotifications.filter((n) => !n.is_read).length;
    if (unreadCount === 0) return;

    try {
      await marcarTodasLeidas();
      cachedNotifications.forEach((n) => { n.is_read = true; });
      updateBadges();
      renderList();
    } catch (err) {
      console.error('[Notifications] Error al marcar todas como leídas:', err);
    }
  });

  // Toggle del Popover al hacer click en la campana
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = popover.style.display === 'block';
    popover.style.display = isVisible ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!isVisible));

    if (!isVisible) {
      loadNotifications();
    }
  });

  // Cerrar al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && e.target !== btn) {
      popover.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Cargar inmediatamente
  await loadNotifications();

  // Polling automático cada 60 segundos
  setInterval(() => {
    loadNotifications();
  }, 60000);
}

/**
 * Burbuja de Carrito con Contador Reactivo
 */
function setupCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  if (!badge) return;

  function updateBadge(count) {
    const num = parseInt(count, 10) || 0;
    if (num > 0) {
      badge.textContent = num > 99 ? '99+' : String(num);
      badge.style.display = 'inline-flex';
      badge.style.transform = 'scale(1.25)';
      setTimeout(() => {
        badge.style.transform = 'scale(1)';
      }, 180);
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }

  // Leer estado actual desde localStorage
  try {
    const rawCart = localStorage.getItem('te_employee_cart');
    if (rawCart) {
      const parsed = JSON.parse(rawCart);
      const totalUnits = Array.isArray(parsed)
        ? parsed.reduce((acc, item) => acc + (item.quantity || 1), 0)
        : 0;
      updateBadge(totalUnits);
    }
  } catch (e) {
    updateBadge(0);
  }

  // Escuchar eventos globales de actualización de carrito
  window.addEventListener('cart:updated', (e) => {
    const count = e.detail?.totalUnits ?? e.detail?.count ?? 0;
    updateBadge(count);
  });
}

/**
 * Logout
 */
function setupLogout() {
  const btn = document.getElementById('btn-logout-trabajador');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const confirmed = await showConfirmModal({
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas cerrar tu sesión de colaborador?',
      confirmText: 'Cerrar Sesión',
      cancelText: 'Cancelar',
      type: 'warning'
    });
    if (confirmed) {
      clearTokens();
      clearCurrentUser();
      localStorage.removeItem('te_employee_cart');
      window.location.replace(getLoginUrl());
    }
  });
}
