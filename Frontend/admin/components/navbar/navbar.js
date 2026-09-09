/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR MODULAR DEL COMPONENTE NAVBAR (BARRA SUPERIOR)
 * ==========================================================================
 * Incluye auto-importación y orquestación del Drawer, inyección automática
 * de Favicon con el logo, título dinámico de pantalla, buscador y menú de usuario.
 */

import { initDrawer, getBasePathPrefix } from '../drawer/drawer.js';
import { getCurrentUser, clearTokens, clearCurrentUser } from '../../js/storage.js';
import { getOfficialRate } from '../../js/service/exchange-rate.service.js';
import { loadComponent } from '../utils/component-loader.js';
import { initFooter } from '../footer/footer.js';
import { showConfirmModal } from '../modal/modal.js';

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

  // 3. Estilos del Modal
  if (!document.querySelector('link[href*="modal.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${prefix}components/modal/modal.css`;
    document.head.appendChild(link);
  }
}

/**
 * Inyecta el marcado HTML del Drawer en el documento si no se encuentra en el DOM
 */
async function ensureDrawerExists() {
  if (document.getElementById('admin-drawer')) {
    return;
  }
  if (document.getElementById('drawer-placeholder')) {
    await loadComponent('drawer-placeholder', 'components/drawer/drawer.html');
  } else {
    const placeholder = document.createElement('div');
    placeholder.id = 'drawer-placeholder';
    const layout = document.getElementById('app-layout') || document.body;
    layout.insertBefore(placeholder, layout.firstChild);
    await loadComponent('drawer-placeholder', 'components/drawer/drawer.html');
  }
}

/**
 * Inyecta el marcado HTML del Navbar en el documento si no se encuentra en el DOM
 */
async function ensureNavbarExists() {
  if (document.getElementById('admin-navbar')) {
    return;
  }
  if (document.getElementById('navbar-placeholder')) {
    await loadComponent('navbar-placeholder', 'components/navbar/navbar.html');
  }
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
  if (path.includes('product-create.html') || path.includes('product_create.html')) {
    return 'Crear Producto';
  }
  if (path.includes('types.html')) {
    return 'Tipos de productos';
  }
  if (path.includes('/product/') || path.includes('products.html') || path.includes('product.html')) {
    return 'Productos';
  }
  if (path.includes('store-pos.html')) {
    return 'Punto de Venta (POS)';
  }
  if (path.includes('internal-products.html')) {
    return 'Inventario Tienda Empleados';
  }
  if (path.includes('categories.html') && path.includes('employee_store')) {
    return 'Categorías y Subcategorías';
  }
  if (path.includes('orders-history.html')) {
    return 'Historial de Consumos';
  }
  if (path.includes('employee-ledger.html')) {
    return 'Control de Cartera y Deudas';
  }
  if (path.includes('employee-statement.html')) {
    return 'Estado de Cuenta / Kardex';
  }
  if (path.includes('reports.html') && path.includes('employee_store')) {
    return 'Cortes de Nómina y Conciliación';
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

    // 6. Configurar datos de usuario, tasa de cambio y eventos
    this.setupUserData();
    this.setupExchangeRate();
    this.setupSearch();
    this.setupUserDropdown();
    this.setupRelativeLinks();
  }

  /**
   * Carga la tasa oficial BCV del día con caché optimizado y actualiza el badge en la barra
   */
  async setupExchangeRate() {
    let badgeContainer = document.getElementById('navbar-exchange-badge');
    let badgeVal = document.getElementById('navbar-exchange-val');

    // Si no está en el DOM pero existe .navbar-right, lo inyectamos automáticamente
    if (!badgeContainer) {
      const navbarRight = this.navbar?.querySelector('.navbar-right') || document.querySelector('.navbar-right');
      if (navbarRight) {
        badgeContainer = document.createElement('div');
        badgeContainer.className = 'navbar-exchange-badge';
        badgeContainer.id = 'navbar-exchange-badge';
        badgeContainer.title = 'Tasa oficial BCV del día (Guardada en caché)';
        badgeContainer.innerHTML = `
          <span class="exchange-dot"></span>
          <span class="exchange-text">BCV: <strong id="navbar-exchange-val">791,32 Bs/$</strong></span>
        `;
        const firstChild = navbarRight.firstChild;
        navbarRight.insertBefore(badgeContainer, firstChild);
        badgeVal = badgeContainer.querySelector('#navbar-exchange-val');
      }
    }

    try {
      const rate = await getOfficialRate();
      if (badgeVal && rate > 0) {
        badgeVal.textContent = `${rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs/$`;
      }
    } catch (err) {
      console.warn('[TuEstante Navbar] Error al cargar tasa oficial:', err);
    }
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
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const confirmed = await showConfirmModal({
          title: 'Cerrar Sesión',
          message: '¿Estás seguro de que deseas cerrar sesión en el panel de administración?',
          confirmText: 'Cerrar Sesión',
          cancelText: 'Cancelar',
          type: 'danger'
        });
        if (!confirmed) return;

        try {
          clearTokens();
          clearCurrentUser();
        } catch (err) {
          console.warn('[TuEstante Navbar] Error al limpiar sesión:', err);
        }

        const prefix = getBasePathPrefix();
        window.location.href = `${prefix}login.html`;
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

/**
 * Carga de componentes unificada para el panel de administración
 * (Carga en paralelo Navbar, Drawer y Footer si existen sus placeholders en el HTML)
 * @param {Object} options Opciones de inicialización
 * @returns {Promise<AdminNavbar>} Instancia del Navbar
 */
export async function loadAdminComponents(options = {}) {
  const tasks = [];
  if (!document.getElementById('admin-drawer') && document.getElementById('drawer-placeholder')) {
    tasks.push(loadComponent('drawer-placeholder', 'components/drawer/drawer.html'));
  }
  if (!document.getElementById('admin-navbar') && document.getElementById('navbar-placeholder')) {
    tasks.push(loadComponent('navbar-placeholder', 'components/navbar/navbar.html'));
  }
  if (!document.getElementById('admin-footer') && document.getElementById('footer-placeholder')) {
    tasks.push(loadComponent('footer-placeholder', 'components/footer/footer.html'));
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }

  const navInstance = initNavbar(options);
  initDrawer();
  await initFooter();
  return navInstance;
}

// Ejecución automática al cargar si el elemento está presente
if (typeof window !== 'undefined') {
  window.initNavbar = initNavbar;
  window.loadAdminComponents = loadAdminComponents;
  window.setNavbarTitle = setNavbarTitle;
  window.setAutoFavicon = setAutoFavicon;
}

