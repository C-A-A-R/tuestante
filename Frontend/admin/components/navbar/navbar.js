/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR MODULAR DEL COMPONENTE NAVBAR (BARRA SUPERIOR)
 * ==========================================================================
 * Incluye auto-importación y orquestación del Drawer, inyección automática
 * de Favicon con el logo, título dinámico de pantalla, buscador y menú de usuario.
 */

import { initDrawer, getBasePathPrefix } from '../drawer/drawer.js';
import { getCurrentUser, clearTokens, clearCurrentUser } from '../../js/storage.js';

/**
 * Inyecta automáticamente el logotipo como icono de pestaña (Favicon) en el <head>
 */
export function setAutoFavicon() {
  const prefix = getBasePathPrefix();
  const logoUrl = `${prefix}assets/images/logo.jpeg`;

  try {
    // 1. Favicon principal
    let linkIcon = document.querySelector("link[rel='icon']");
    if (!linkIcon) {
      linkIcon = document.createElement('link');
      linkIcon.rel = 'icon';
      document.head.appendChild(linkIcon);
    }
    linkIcon.type = 'image/jpeg';
    linkIcon.href = logoUrl;

    // 2. Apple Touch Icon
    let linkApple = document.querySelector("link[rel='apple-touch-icon']");
    if (!linkApple) {
      linkApple = document.createElement('link');
      linkApple.rel = 'apple-touch-icon';
      document.head.appendChild(linkApple);
    }
    linkApple.href = logoUrl;

    // 3. Shortcut Icon
    let linkShortcut = document.querySelector("link[rel='shortcut icon']");
    if (!linkShortcut) {
      linkShortcut = document.createElement('link');
      linkShortcut.rel = 'shortcut icon';
      document.head.appendChild(linkShortcut);
    }
    linkShortcut.href = logoUrl;
  } catch (err) {
    console.warn('[TuEstante Navbar] Error al inyectar favicon:', err);
  }
}

/**
 * Inyecta dinámicamente las hojas de estilo del Navbar y Drawer si no están en el DOM
 */
function ensureStylesheetsExist() {
  const prefix = getBasePathPrefix();

  // 1. Estilos del Drawer
  if (!document.querySelector('link[href*="drawer.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${prefix}components/drawer/drawer.css`;
    document.head.appendChild(link);
  }

  // 2. Estilos del Navbar
  if (!document.querySelector('link[href*="navbar.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${prefix}components/navbar/navbar.css`;
    document.head.appendChild(link);
  }
}

/**
 * Inyecta el marcado HTML del Drawer en el documento si no se encuentra en el DOM
 */
function ensureDrawerExists() {
  if (document.getElementById('admin-drawer')) {
    return;
  }

  const prefix = getBasePathPrefix();
  const drawerMarkup = `
  <aside id="admin-drawer" class="admin-drawer" aria-label="Menú lateral de administración">
    <div class="drawer-header">
      <a href="${prefix}index.html" class="drawer-brand" data-nav-link="inicio" title="TuEstante Admin">
        <div class="drawer-brand-icon">
          <img src="${prefix}assets/images/logo.jpeg" alt="TuEstante Logo" class="brand-logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <span class="brand-fallback-icon" style="display: none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </span>
        </div>
        <div class="drawer-brand-info">
          <span class="drawer-brand-title">TuEstante</span>
          <span class="drawer-brand-badge">ADMIN</span>
        </div>
      </a>
      <button type="button" class="drawer-action-btn" id="drawer-toggle-btn" aria-label="Colapsar o expandir barra lateral" title="Colapsar / Expandir">
        <svg class="icon-collapse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <nav class="drawer-nav-container" aria-label="Navegación principal">
      <ul class="drawer-menu" role="menu">
        <li class="drawer-item" role="none">
          <a href="${prefix}index.html" class="drawer-link active" data-nav-id="inicio" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </span>
            <span class="drawer-link-text">Inicio</span>
          </a>
        </li>
        <li class="drawer-item" role="none">
          <a href="${prefix}modules/order/orders.html" class="drawer-link" data-nav-id="pedidos" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </span>
            <span class="drawer-link-text">Pedidos</span>
          </a>
        </li>
        <li class="drawer-item" role="none">
          <a href="${prefix}modules/manufacturing/manufacturing.html" class="drawer-link" data-nav-id="fabricacion" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 20h20"></path>
                <path d="M5 20V8l5 4V4l6 5v11"></path>
                <path d="M18 14v6"></path>
                <circle cx="18" cy="11" r="1"></circle>
              </svg>
            </span>
            <span class="drawer-link-text">Fabricación</span>
          </a>
        </li>
        <li class="drawer-item" role="none">
          <a href="${prefix}modules/payment/payments.html" class="drawer-link" data-nav-id="pagos" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
                <line x1="6" y1="15" x2="10" y2="15"></line>
              </svg>
            </span>
            <span class="drawer-link-text">Pagos</span>
          </a>
        </li>
        <li class="drawer-item" role="none">
          <a href="${prefix}modules/shipping/shipping.html" class="drawer-link" data-nav-id="envios" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </span>
            <span class="drawer-link-text">Envíos</span>
          </a>
        </li>
        <li class="drawer-item drawer-item-has-submenu" role="none">
          <button type="button" class="drawer-link drawer-submenu-toggle" aria-expanded="false" aria-controls="submenu-productos" data-nav-id="productos-parent" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </span>
            <span class="drawer-link-text">Productos</span>
            <span class="drawer-arrow-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </button>
          <ul id="submenu-productos" class="drawer-submenu" role="menu" aria-label="Submenú de Productos">
            <li class="drawer-submenu-item" role="none">
              <a href="${prefix}modules/product/products.html" class="drawer-submenu-link" data-nav-id="productos" role="menuitem">
                <span class="drawer-submenu-dot"></span>
                <span class="drawer-submenu-text">Productos</span>
              </a>
            </li>
            <li class="drawer-submenu-item" role="none">
              <a href="${prefix}modules/product/categories.html" class="drawer-submenu-link" data-nav-id="categorias" role="menuitem">
                <span class="drawer-submenu-dot"></span>
                <span class="drawer-submenu-text">Categorías</span>
              </a>
            </li>
            <li class="drawer-submenu-item" role="none">
              <a href="${prefix}modules/product/types.html" class="drawer-submenu-link" data-nav-id="tipos-productos" role="menuitem">
                <span class="drawer-submenu-dot"></span>
                <span class="drawer-submenu-text">Tipos de productos</span>
              </a>
            </li>
          </ul>
        </li>
        <li class="drawer-item" role="none">
          <a href="${prefix}modules/user/clients.html" class="drawer-link" data-nav-id="clientes" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <span class="drawer-link-text">Clientes</span>
          </a>
        </li>
        <li class="drawer-item" role="none">
          <a href="${prefix}modules/notifications/notifications.html" class="drawer-link" data-nav-id="notificaciones" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </span>
            <span class="drawer-link-text">Notificaciones</span>
            <span class="drawer-badge" id="drawer-notif-badge" aria-label="5 notificaciones pendientes">5</span>
          </a>
        </li>
        <li class="drawer-item" role="none">
          <a href="${prefix}modules/settings/settings.html" class="drawer-link" data-nav-id="configuracion" role="menuitem">
            <span class="drawer-link-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </span>
            <span class="drawer-link-text">Configuración</span>
          </a>
        </li>
      </ul>
    </nav>
    <div class="drawer-footer">
      <button type="button" class="drawer-link drawer-logout-btn" id="drawer-logout-btn" role="button" aria-label="Cerrar sesión">
        <span class="drawer-link-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </span>
        <span class="drawer-link-text">Cerrar sesión</span>
      </button>
    </div>
  </aside>
  <div id="drawer-backdrop" class="drawer-backdrop" aria-hidden="true"></div>
  `;

  document.body.insertAdjacentHTML('afterbegin', drawerMarkup);
}

/**
 * Determina automáticamente el título de la pantalla según la ruta o elemento DOM
 * @returns {string} Nombre/Título de la pantalla actual
 */
export function getAutoPageTitle() {
  // 1. Revisar si hay un elemento explícito con data-page-title
  const explicitEl = document.querySelector('[data-page-title]');
  if (explicitEl) {
    const title = explicitEl.getAttribute('data-page-title') || explicitEl.textContent;
    if (title.trim()) return title.trim();
  }

  // 2. Mapeo inteligente por URL
  const path = (window.location.pathname || '').toLowerCase();
  
  if (path.endsWith('index.html') || path.endsWith('/') || path === '') {
    return 'Dashboard';
  }
  if (path.includes('/order/') || path.includes('orders.html')) {
    return 'Pedidos';
  }
  if (path.includes('/manufacturing/') || path.includes('manufacturing.html')) {
    return 'Fabricación';
  }
  if (path.includes('/payment/') || path.includes('payments.html')) {
    return 'Pagos';
  }
  if (path.includes('/shipping/') || path.includes('shipping.html')) {
    return 'Envíos';
  }
  if (path.includes('categories.html')) {
    return 'Categorías';
  }
  if (path.includes('types.html')) {
    return 'Tipos de productos';
  }
  if (path.includes('/product/') || path.includes('products.html')) {
    return 'Productos';
  }
  if (path.includes('/user/') || path.includes('clients.html') || path.includes('users.html')) {
    return 'Clientes';
  }
  if (path.includes('/notification') || path.includes('notifications.html')) {
    return 'Notificaciones';
  }
  if (path.includes('/settings/') || path.includes('settings.html')) {
    return 'Configuración';
  }
  if (path.includes('profile.html')) {
    return 'Mi Perfil';
  }

  // 3. Fallback al título del documento
  if (document.title) {
    const cleanTitle = document.title.split('|')[0].split('-')[0].trim();
    if (cleanTitle && !cleanTitle.toLowerCase().includes('tuestante')) {
      return cleanTitle;
    }
  }

  return 'Dashboard';
}

/**
 * Actualiza el título que se muestra en la barra de navegación
 * @param {string} title Título a mostrar
 */
export function setNavbarTitle(title) {
  const titleEl = document.getElementById('navbar-screen-title');
  if (titleEl && title) {
    titleEl.textContent = title;
  }
}

/**
 * Clase controladora del Navbar
 */
export class AdminNavbar {
  constructor(options = {}) {
    this.options = {
      navbarSelector: '#admin-navbar',
      title: null,
      autoFavicon: true,
      autoDrawer: true,
      ...options
    };

    this.navbar = null;
    this.drawer = null;
    this.init();
  }

  /**
   * Inicializa el Navbar y sus dependencias
   */
  init() {
    // 1. Inyectar favicon automáticamente
    if (this.options.autoFavicon) {
      setAutoFavicon();
    }

    // 2. Inyectar hojas de estilo
    ensureStylesheetsExist();

    // 3. Auto-importar e inicializar el Drawer
    if (this.options.autoDrawer) {
      ensureDrawerExists();
      this.drawer = initDrawer();
    }

    // 4. Conectar elementos del Navbar
    this.navbar = document.querySelector(this.options.navbarSelector);
    if (!this.navbar) {
      console.warn('[TuEstante Navbar] Elemento navbar no encontrado en el DOM:', this.options.navbarSelector);
      return;
    }

    // 5. Configurar título dinámico
    const pageTitle = this.options.title || getAutoPageTitle();
    setNavbarTitle(pageTitle);

    // 6. Configurar datos de usuario y eventos
    this.setupUserData();
    this.setupSearch();
    this.setupUserDropdown();
    this.setupRelativeLinks();
  }

  /**
   * Ajusta las rutas relativas de enlaces en el navbar
   */
  setupRelativeLinks() {
    const prefix = getBasePathPrefix();
    if (!prefix) return;

    const links = this.navbar.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('../')) {
        link.setAttribute('href', prefix + href);
      }
    });
  }

  /**
   * Carga los datos del usuario logueado en la barra superior
   */
  setupUserData() {
    const user = getCurrentUser();
    const nameEl = document.getElementById('navbar-user-name');
    const emailEl = document.getElementById('navbar-user-email');
    const dropNameEl = document.getElementById('dropdown-user-name');
    const dropEmailEl = document.getElementById('dropdown-user-email');
    const avatarEl = document.getElementById('navbar-user-avatar');

    if (user) {
      const fullName = (user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username || 'Administrador').trim();
      const email = user.email || 'admin@tienda.com';

      if (nameEl) nameEl.textContent = fullName;
      if (emailEl) emailEl.textContent = email;
      if (dropNameEl) dropNameEl.textContent = fullName;
      if (dropEmailEl) dropEmailEl.textContent = email;

      if (avatarEl && fullName) {
        const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        if (initials) {
          avatarEl.textContent = initials;
        }
      }
    }
  }

  /**
   * Configura la barra de búsqueda expandible
   */
  setupSearch() {
    const toggleBtn = document.getElementById('navbar-search-toggle');
    const searchExpand = document.getElementById('navbar-search-expand');
    const closeBtn = document.getElementById('navbar-search-close');
    const searchInput = document.getElementById('navbar-search-input');

    if (!toggleBtn || !searchExpand) return;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchExpand.classList.toggle('is-open');
      if (searchExpand.classList.contains('is-open') && searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchExpand.classList.remove('is-open');
      });
    }

    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchExpand.classList.remove('is-open');
        } else if (e.key === 'Enter') {
          const query = searchInput.value.trim();
          if (query) {
            const prefix = getBasePathPrefix();
            window.location.href = `${prefix}modules/product/products.html?search=${encodeURIComponent(query)}`;
          }
        }
      });
    }

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#navbar-search-wrapper')) {
        searchExpand.classList.remove('is-open');
      }
    });
  }

  /**
   * Configura el menú desplegable del perfil de usuario
   */
  setupUserDropdown() {
    const userBtn = document.getElementById('navbar-user-btn');
    const dropdownMenu = document.getElementById('navbar-dropdown-menu');
    const logoutBtn = document.getElementById('navbar-logout-btn');

    if (userBtn && dropdownMenu) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownMenu.classList.contains('is-open');
        if (isOpen) {
          dropdownMenu.classList.remove('is-open');
          userBtn.setAttribute('aria-expanded', 'false');
        } else {
          dropdownMenu.classList.add('is-open');
          userBtn.setAttribute('aria-expanded', 'true');
        }
      });

      // Cerrar al hacer clic afuera
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#navbar-user-dropdown')) {
          dropdownMenu.classList.remove('is-open');
          userBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Cerrar con Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdownMenu.classList.contains('is-open')) {
          dropdownMenu.classList.remove('is-open');
          userBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Botón de Cerrar Sesión
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const confirmLogout = window.confirm('¿Estás seguro de que deseas cerrar sesión?');
        if (!confirmLogout) return;

        try {
          clearTokens();
          clearCurrentUser();
        } catch (err) {
          console.warn('[TuEstante Navbar] Error al limpiar sesión:', err);
        }

        const prefix = getBasePathPrefix();
        window.location.href = `${prefix}index.html`;
      });
    }
  }

  /**
   * Actualiza el badge contador de notificaciones del Navbar
   * @param {number|string} count Cantidad de notificaciones
   */
  setNotificationCount(count) {
    const badge = document.getElementById('navbar-notif-badge');
    if (!badge) return;

    const num = parseInt(count, 10);
    if (isNaN(num) || num <= 0) {
      badge.style.display = 'none';
      badge.textContent = '0';
    } else {
      badge.style.display = 'flex';
      badge.textContent = num > 99 ? '99+' : num.toString();
      badge.setAttribute('aria-label', `${num} notificaciones`);
    }

    // Sincronizar también con el Drawer si está presente
    if (this.drawer && typeof this.drawer.setNotificationCount === 'function') {
      this.drawer.setNotificationCount(count);
    }
  }
}

/**
 * Inicializador global del componente Navbar
 * @param {Object} options Opciones de configuración
 * @returns {AdminNavbar} Instancia creada
 */
export function initNavbar(options = {}) {
  const instance = new AdminNavbar(options);
  window.TuEstanteNavbar = instance;
  return instance;
}

// Ejecución automática al cargar si el elemento está presente
if (typeof window !== 'undefined') {
  window.initNavbar = initNavbar;
  window.setNavbarTitle = setNavbarTitle;
  window.setAutoFavicon = setAutoFavicon;
}
