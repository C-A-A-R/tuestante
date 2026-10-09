/**
 * ==========================================================================
 * TUESTANTE - COMPONENTE REUTILIZABLE NAVBAR, MINI-CATÁLOGO & DRAWER
 * ==========================================================================
 * Controlador integral y modular conectado al backend de Django.
 */

import { getRequest, postRequest, resolveImageUrl, extractList } from '../../js/api.js';
import { getAccessToken, getRefreshToken, getCurrentUser, clearTokens, clearCurrentUser } from '../../js/storage.js';

// Prefijo y estilos para logs de depuración en consola
const LOG_TAG = '%c[TuEstante Navbar]';
const LOG_STYLE = 'background: #005187; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;';
const WARN_STYLE = 'background: #f59e0b; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 4px;';
const ERR_STYLE = 'background: #ef4444; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;';

/**
 * Determina el prefijo de ruta relativa hacia la raíz del proyecto.
 * @returns {string} '' si está en la raíz, '../../' si está dentro de /modules/
 */
export function getBasePathPrefix() {
  const path = window.location.pathname || '';
  if (path.includes('/modules/')) {
    return '../../';
  }
  return '';
}

/**
 * Inyecta dinámicamente en el DOM los elementos faltantes del Navbar si el fragmento HTML
 * fue cargado incompleto o desde una versión antigua en caché.
 */
function ensureNavbarElementsExist() {
  const prefix = getBasePathPrefix();
  const header = document.querySelector('.site-header');

  // 1. Asegurar contenedor de sub-barra de categorías dentro de .site-header
  if (header && !document.getElementById('nav-categories-container')) {
    let catNav = header.querySelector('.navbar-categories');
    if (!catNav) {
      catNav = document.createElement('nav');
      catNav.className = 'navbar-categories';
      catNav.setAttribute('aria-label', 'Tipos de productos');
      catNav.innerHTML = `
        <div class="header-container">
          <ul class="categories-container" id="nav-categories-container"></ul>
        </div>
      `;
      header.appendChild(catNav);
    }
  }

  // 2. Asegurar overlay / backdrop del drawer en document.body (sin duplicados)
  if (!document.getElementById('drawer-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'drawer-backdrop';
    backdrop.className = 'drawer-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
  }

  // 3. Asegurar aside #mobile-drawer en document.body (sin duplicados)
  if (!document.getElementById('mobile-drawer')) {
    const drawer = document.createElement('aside');
    drawer.id = 'mobile-drawer';
    drawer.className = 'mobile-drawer';
    drawer.setAttribute('aria-label', 'Menú lateral móvil');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('tabindex', '-1');
    drawer.innerHTML = `
      <div class="drawer-top-bar" aria-hidden="true"></div>
      <div class="drawer-header">
        <a href="${prefix}index.html" class="brand-logo" data-nav-link="home">
          <img src="${prefix}assets/images/logo.svg" alt="TuEstante Logo" class="brand-logo-img" width="36" height="36">
          <span class="brand-name">TuEstante</span>
        </a>
        <button type="button" id="drawer-close-btn" class="drawer-close-btn" aria-label="Cerrar menú">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="drawer-user-card" id="drawer-user-card">
        <div class="drawer-user-avatar" id="drawer-user-avatar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="drawer-user-info" id="drawer-user-info">
          <div class="drawer-user-greeting" id="drawer-user-greeting">¡Bienvenido!</div>
          <a href="${prefix}modules/auth/login.html" class="drawer-user-name" id="drawer-user-name" data-nav-link="login">Iniciar Sesión / Mi Cuenta</a>
        </div>
      </div>
      <div class="drawer-quick-actions">
        <a href="${prefix}modules/notifications/notifications.html" class="drawer-quick-btn" data-nav-link="notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Notificaciones</span>
          <span class="badge-count nav-notifications-count" style="display: none;">0</span>
        </a>
        <a href="${prefix}modules/cart/cart.html" class="drawer-quick-btn" data-nav-link="cart">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span>Carrito</span>
          <span class="badge-count nav-cart-count" style="display: none;">0</span>
        </a>
        <a href="https://wa.me/584266272286?text=Hola%20TuEstante%2C%20deseo%20m%C3%A1s%20informaci%C3%B3n" target="_blank" rel="noopener noreferrer" class="drawer-quick-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>Contacto</span>
        </a>
      </div>
      <div class="drawer-body">
        <div class="drawer-section-title">Menú Principal</div>
        <ul class="drawer-nav-list">
          <li class="drawer-nav-item">
            <a href="${prefix}index.html" class="drawer-nav-link" data-nav-link="home">
              <span class="drawer-link-left">
                <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Inicio
              </span>
            </a>
          </li>
          <li class="drawer-nav-item">
            <a href="${prefix}modules/product/products.html" class="drawer-nav-link" data-nav-link="products">
              <span class="drawer-link-left">
                <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                Productos
              </span>
            </a>
          </li>
          <li class="drawer-nav-item">
            <button type="button" class="drawer-nav-link drawer-accordion-btn" aria-expanded="false">
              <span class="drawer-link-left">
                <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Conócenos
              </span>
              <svg class="drawer-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <ul class="drawer-submenu">
              <li><a href="${prefix}modules/us/us.html" class="drawer-sub-link" data-nav-link="us-about">Sobre Nosotros</a></li>
              <li><a href="${prefix}modules/gallery/gallery.html" class="drawer-sub-link" data-nav-link="gallery">Galería de Trabajos</a></li>
              <li><a href="${prefix}modules/project/projects.html" class="drawer-sub-link" data-nav-link="projects">Proyectos Realizados</a></li>
              <li><a href="${prefix}modules/us/us.html#faq" class="drawer-sub-link" data-nav-link="faq">Preguntas Frecuentes</a></li>
              <li><a href="${prefix}modules/us/us.html#terminos" class="drawer-sub-link" data-nav-link="terms">Términos y Condiciones</a></li>
            </ul>
          </li>
          <li class="drawer-nav-item">
            <a href="${prefix}index.html#contacto" class="drawer-nav-link" data-nav-link="contact">
              <span class="drawer-link-left">
                <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Ayuda y Contacto
              </span>
            </a>
          </li>
        </ul>
        <div class="drawer-section-title">Mi Cuenta</div>
        <ul class="drawer-nav-list" id="drawer-user-links-list"></ul>
      </div>
      <div class="drawer-footer">
        <a href="https://wa.me/584266272286?text=Hola%20TuEstante%2C%20deseo%20asesor%C3%ADa%20personalizada" target="_blank" rel="noopener noreferrer" class="drawer-help-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          Línea de Atención WhatsApp
        </a>
      </div>
    `;
    document.body.appendChild(drawer);
  }

  // 4. Asegurar botón de carrito en .desktop-actions (desktop)
  const desktopActions = header ? header.querySelector('.desktop-actions') : document.querySelector('.desktop-actions');
  if (desktopActions && !desktopActions.querySelector('.nav-cart-btn, .desktop-cart-btn')) {
    const cartBtn = document.createElement('a');
    cartBtn.href = `${prefix}modules/cart/cart.html`;
    cartBtn.className = 'action-btn desktop-cart-btn nav-cart-btn';
    cartBtn.id = 'nav-desktop-cart-btn';
    cartBtn.setAttribute('aria-label', 'Carrito de compras');
    cartBtn.setAttribute('title', 'Ver Carrito de Compras');
    cartBtn.setAttribute('data-nav-link', 'cart');
    cartBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      <span class="badge-count nav-cart-count" style="display: none;" aria-hidden="true"></span>
    `;
    const authBox = desktopActions.querySelector('#nav-auth-buttons, #nav-user-dropdown-wrapper');
    if (authBox) {
      desktopActions.insertBefore(cartBtn, authBox);
    } else {
      desktopActions.appendChild(cartBtn);
    }
  }

  // 5. Asegurar botón de carrito móvil en .navbar-main
  const navbarMain = header ? header.querySelector('.navbar-main') : document.querySelector('.navbar-main');
  if (navbarMain && !navbarMain.querySelector('.mobile-cart-btn')) {
    const mobileCartBtn = document.createElement('a');
    mobileCartBtn.href = `${prefix}modules/cart/cart.html`;
    mobileCartBtn.className = 'mobile-cart-btn nav-cart-btn';
    mobileCartBtn.setAttribute('aria-label', 'Carrito de compras');
    mobileCartBtn.setAttribute('title', 'Ver Carrito de Compras');
    mobileCartBtn.setAttribute('data-nav-link', 'cart');
    mobileCartBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      <span class="badge-count nav-cart-count" style="display: none;" aria-hidden="true"></span>
    `;
    const deskActions = navbarMain.querySelector('.desktop-actions');
    if (deskActions) {
      navbarMain.insertBefore(mobileCartBtn, deskActions);
    } else {
      navbarMain.appendChild(mobileCartBtn);
    }
  }
}

/**
 * Inyecta o actualiza automáticamente el logotipo como icono de pestaña (favicon)
 * en el <head> del documento.
 */
export function setAutoFavicon() {
  const prefix = getBasePathPrefix();
  const logoUrl = `${prefix}assets/images/logo.svg`;

  try {
    let linkIcon = document.querySelector("link[rel='icon']");
    if (!linkIcon) {
      linkIcon = document.createElement('link');
      linkIcon.rel = 'icon';
      document.head.appendChild(linkIcon);
    }
    linkIcon.type = 'image/svg+xml';
    linkIcon.href = logoUrl;

    let linkApple = document.querySelector("link[rel='apple-touch-icon']");
    if (!linkApple) {
      linkApple = document.createElement('link');
      linkApple.rel = 'apple-touch-icon';
      document.head.appendChild(linkApple);
    }
    linkApple.href = logoUrl;

    let linkShortcut = document.querySelector("link[rel='shortcut icon']");
    if (!linkShortcut) {
      linkShortcut = document.createElement('link');
      linkShortcut.rel = 'shortcut icon';
      document.head.appendChild(linkShortcut);
    }
    linkShortcut.href = logoUrl;
  } catch (err) {
    console.warn(LOG_TAG, 'Error al inyectar favicon:', err);
  }
}

/**
 * Actualiza el contador de artículos del carrito en todos los badges del navbar.
 * @param {number} [explicitCount] Cantidad opcional especificada directamente.
 */
export function updateCartBadge(explicitCount) {
  let totalCount = 0;
  if (typeof explicitCount === 'number') {
    totalCount = explicitCount;
  } else {
    try {
      const raw = localStorage.getItem('tuestante_cart');
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          totalCount = items.reduce((sum, it) => sum + (parseInt(it.qty, 10) || parseInt(it.cantidad, 10) || 1), 0);
        }
      }
    } catch (e) {
      console.warn(LOG_TAG, 'Error leyendo el carrito de localStorage:', e);
    }
  }

  const badgeElements = document.querySelectorAll('.nav-cart-count');
  badgeElements.forEach((badge) => {
    if (totalCount > 0) {
      badge.textContent = totalCount > 99 ? '99+' : String(totalCount);
      badge.setAttribute('aria-label', `${totalCount} artículos en el carrito`);
      badge.style.display = 'inline-flex';
      badge.classList.remove('badge-bump');
      void badge.offsetWidth;
      badge.classList.add('badge-bump');
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
      badge.removeAttribute('aria-label');
    }
  });
}

/**
 * Consulta y actualiza el badge de notificaciones para usuarios autenticados.
 * @param {number} [explicitCount] Cantidad opcional de notificaciones no leídas.
 */
export async function updateNotificationsBadge(explicitCount) {
  const badgeElements = document.querySelectorAll('.nav-notifications-count');
  if (!badgeElements.length) return;

  if (typeof explicitCount === 'number') {
    badgeElements.forEach((b) => {
      b.textContent = explicitCount > 99 ? '99+' : String(explicitCount);
      b.style.display = explicitCount > 0 ? 'flex' : 'none';
    });
    return;
  }

  const token = getAccessToken();
  if (!token) {
    badgeElements.forEach((b) => (b.style.display = 'none'));
    return;
  }

  try {
    const data = await getRequest('/notifications/', {}, { auth: true });
    const list = extractList(data);
    const unread = list.filter((item) => item.is_read === false).length;

    badgeElements.forEach((b) => {
      b.textContent = unread > 99 ? '99+' : String(unread);
      b.style.display = unread > 0 ? 'flex' : 'none';
    });

    // Pre-cargar la lista de notificaciones en el dropdown para que esté lista de inmediato al pasar el ratón
    const container = document.getElementById('navbar-notifications-list');
    if (container && !container.querySelector('.notif-dropdown-item')) {
      renderNavbarNotificationsList(list.slice(0, 6));
      lastNotifFetchTime = Date.now();
    }
  } catch (error) {
    if (error?.status === 401) {
      clearTokens();
      clearCurrentUser();
      syncUserAuthState();
    }
    badgeElements.forEach((b) => (b.style.display = 'none'));
  }
}

/**
 * Normaliza y enlaza todas las rutas relativas en la barra de navegación.
 */
function normalizeNavbarRoutes() {
  const prefix = getBasePathPrefix();

  document.querySelectorAll('.brand-logo').forEach((el) => {
    el.setAttribute('href', `${prefix}index.html`);
  });

  document.querySelectorAll('.brand-logo-img').forEach((img) => {
    img.setAttribute('src', `${prefix}assets/images/logo.svg`);
  });

  const routeMap = {
    'home': `${prefix}index.html`,
    'products': `${prefix}modules/product/products.html`,
    'us': `${prefix}modules/us/us.html`,
    'us-about': `${prefix}modules/us/us.html`,
    'gallery': `${prefix}modules/gallery/gallery.html`,
    'projects': `${prefix}modules/project/projects.html`,
    'faq': `${prefix}modules/us/us.html#faq`,
    'terms': `${prefix}modules/us/us.html#terminos`,
    'contact': `${prefix}index.html#contacto`,
    'cart': `${prefix}modules/cart/cart.html`,
    'profile': `${prefix}modules/profile/profile.html`,
    'orders': `${prefix}modules/order/my-orders.html`,
    'notifications': `${prefix}modules/notifications/notifications.html`,
    'wishlist': `${prefix}modules/product/wishlist.html`,
    'login': `${prefix}modules/auth/login.html`,
    'register': `${prefix}modules/auth/register.html`,
    'employee-store': `${prefix}employee/index.html`
  };

  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const key = link.getAttribute('data-nav-link');
    if (routeMap[key]) {
      link.setAttribute('href', routeMap[key]);
    }
  });

  const contactLinks = document.querySelectorAll('[data-nav-link="contact"], a[href*="#contacto"]');
  contactLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const isIndex = !window.location.pathname.includes('/modules/') &&
        (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '');

      if (isIndex) {
        const contactSection = document.getElementById('contacto') || document.getElementById('contactos');
        if (contactSection) {
          e.preventDefault();
          contactSection.scrollIntoView({ behavior: 'smooth' });
          if (history.pushState) {
            history.pushState(null, null, '#contacto');
          }
        }
      }
    });
  });
}

/**
 * Detecta y resalta visualmente la ruta activa en los menús.
 */
function updateActiveRouteState() {
  const currentPath = window.location.pathname || '';
  const currentHash = window.location.hash || '';

  document.querySelectorAll('.desktop-nav-links .nav-link, .drawer-nav-link').forEach((l) => l.classList.remove('active'));

  const isHome = !currentPath.includes('/modules/') && (currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '');
  const isProducts = currentPath.includes('/product/') || currentPath.includes('products.html') || currentPath.includes('product-details.html') || currentPath.includes('wishlist.html');
  const isUs = currentPath.includes('/us/') || currentPath.includes('/gallery/') || currentPath.includes('/project/');
  const isContact = currentHash === '#contacto' || currentHash === '#contactos';

  if (isContact) {
    document.querySelectorAll('[data-nav-link="contact"]').forEach((l) => l.classList.add('active'));
  } else if (isHome) {
    document.querySelectorAll('[data-nav-link="home"]').forEach((l) => l.classList.add('active'));
  } else if (isProducts) {
    document.querySelectorAll('[data-nav-link="products"]').forEach((l) => l.classList.add('active'));
  } else if (isUs) {
    document.querySelectorAll('[data-nav-link="us"]').forEach((l) => l.classList.add('active'));
    if (currentPath.includes('/gallery/')) {
      document.querySelectorAll('[data-nav-link="gallery"]').forEach((l) => l.classList.add('active'));
    } else if (currentPath.includes('/project/')) {
      document.querySelectorAll('[data-nav-link="projects"]').forEach((l) => l.classList.add('active'));
    } else {
      document.querySelectorAll('[data-nav-link="us-about"]').forEach((l) => l.classList.add('active'));
    }
  }
}

/**
 * Configura las opciones del menú de usuario y del drawer según el estado de autenticación.
 */
function syncUserAuthState() {
  const prefix = getBasePathPrefix();
  const token = getAccessToken();
  const user = getCurrentUser();
  const isAuth = Boolean(token && token !== 'null' && token !== 'undefined' && String(token).trim() !== '');
  const isEmployee = Boolean(isAuth && (user?.is_employee === true || user?.is_employee === 'true' || user?.is_employee === 1));

  // Si está autenticado pero is_employee aún no fue cacheado en el usuario, consultar al backend
  if (isAuth && user && user.is_employee === undefined && !window._checkingEmployeeStatus) {
    window._checkingEmployeeStatus = true;
    getRequest('/user/profile/')
      .then((profileData) => {
        if (profileData && profileData.is_employee !== undefined) {
          user.is_employee = Boolean(profileData.is_employee);
          setCurrentUser(user);
          if (user.is_employee) {
            syncUserAuthState();
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        window._checkingEmployeeStatus = false;
      });
  }

  const desktopActions = document.querySelector('.desktop-actions');
  if (desktopActions) {
    // 1. Asegurar nav-auth-buttons si no existe en el DOM
    if (!document.getElementById('nav-auth-buttons')) {
      const authDiv = document.createElement('div');
      authDiv.className = 'nav-auth-buttons';
      authDiv.id = 'nav-auth-buttons';
      authDiv.innerHTML = `
        <a href="${prefix}modules/auth/login.html" class="nav-btn-login" data-nav-link="login">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          <span>Iniciar Sesión</span>
        </a>
        <a href="${prefix}modules/auth/register.html" class="nav-btn-register" data-nav-link="register">
          <span>Registrarse</span>
        </a>
      `;
      desktopActions.appendChild(authDiv);
    }

    // 2. Asegurar nav-employee-switch-wrapper si no existe en el DOM
    if (!document.getElementById('nav-employee-switch-wrapper')) {
      const switchDiv = document.createElement('div');
      switchDiv.className = 'nav-employee-switch-wrapper';
      switchDiv.id = 'nav-employee-switch-wrapper';
      switchDiv.style.display = 'none';
      switchDiv.innerHTML = `
        <a href="${prefix}employee/index.html" class="btn-employee-store-switch" id="nav-btn-employee-store" title="Cambiar a la Tienda de Empleados" data-nav-link="employee-store">
          <span class="employee-switch-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </span>
          <span class="employee-switch-label">Tienda Empleados</span>
          <span class="employee-switch-badge">Empleado</span>
        </a>
      `;
      const userDrop = document.getElementById('nav-user-dropdown-wrapper');
      if (userDrop) {
        desktopActions.insertBefore(switchDiv, userDrop);
      } else {
        desktopActions.appendChild(switchDiv);
      }
    }

    // 3. Asegurar nav-user-dropdown-wrapper si no existe en el DOM
    if (!document.getElementById('nav-user-dropdown-wrapper')) {
      const userDrop = document.createElement('div');
      userDrop.className = 'action-dropdown-wrapper';
      userDrop.id = 'nav-user-dropdown-wrapper';
      userDrop.innerHTML = `
        <button type="button" class="action-btn nav-profile-btn" id="nav-profile-btn" aria-label="Perfil de usuario" aria-haspopup="true" aria-expanded="false" title="Mi Cuenta">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </button>
        <div class="action-dropdown-menu profile-dropdown-menu" id="nav-profile-menu" role="menu" aria-label="Opciones de usuario">
          <div class="profile-menu-header" id="nav-profile-header">
            <div class="profile-menu-avatar" id="nav-profile-avatar">US</div>
            <div class="profile-menu-user-meta">
              <strong id="nav-profile-name">Mi Cuenta</strong>
              <span id="nav-profile-email">Bienvenido a TuEstante</span>
            </div>
          </div>
          <div class="profile-menu-items" id="nav-profile-links"></div>
        </div>
      `;
      desktopActions.appendChild(userDrop);
    }
  }

  const navAuthButtons = document.getElementById('nav-auth-buttons');
  const navUserDropdownWrapper = document.getElementById('nav-user-dropdown-wrapper');
  const navEmployeeSwitchWrapper = document.getElementById('nav-employee-switch-wrapper');

  if (navAuthButtons) {
    navAuthButtons.style.display = isAuth ? 'none' : 'inline-flex';
  }
  if (navUserDropdownWrapper) {
    navUserDropdownWrapper.style.display = isAuth ? 'inline-flex' : 'none';
  }
  if (navEmployeeSwitchWrapper) {
    navEmployeeSwitchWrapper.style.display = isEmployee ? 'inline-flex' : 'none';
    const switchLink = navEmployeeSwitchWrapper.querySelector('a');
    if (switchLink) {
      switchLink.href = `${prefix}employee/index.html`;
    }
  }

  const profileAvatarEl = document.getElementById('nav-profile-avatar');
  const profileNameEl = document.getElementById('nav-profile-name');
  const profileEmailEl = document.getElementById('nav-profile-email');
  const profileLinksContainer = document.getElementById('nav-profile-links');

  const drawerGreetingEl = document.getElementById('drawer-user-greeting');
  const drawerNameEl = document.getElementById('drawer-user-name');
  const drawerAvatarEl = document.getElementById('drawer-user-avatar');
  const drawerUserLinksList = document.getElementById('drawer-user-links-list');

  let initials = 'US';
  let displayName = 'Mi Cuenta';
  let emailText = 'Inicia sesión para ver tus compras';

  if (isAuth) {
    const firstName = user?.first_name || '';
    const lastName = user?.last_name || '';
    const username = user?.username || 'Usuario';
    const email = user?.email || '';

    displayName = firstName ? `${firstName} ${lastName}`.trim() : username;
    emailText = email || username;

    if (firstName) {
      initials = (firstName[0] + (lastName ? lastName[0] : '')).toUpperCase();
    } else if (username) {
      initials = username.slice(0, 2).toUpperCase();
    }
  }

  if (profileAvatarEl) profileAvatarEl.textContent = isAuth ? initials : '--';
  if (profileNameEl) profileNameEl.textContent = displayName;
  if (profileEmailEl) profileEmailEl.textContent = emailText;

  if (drawerGreetingEl) drawerGreetingEl.textContent = isAuth ? `¡Hola, ${displayName.split(' ')[0]}!` : '¡Bienvenido!';
  if (drawerNameEl) {
    drawerNameEl.textContent = isAuth ? displayName : 'Iniciar Sesión / Mi Cuenta';
    drawerNameEl.setAttribute('href', isAuth ? `${prefix}modules/profile/profile.html` : `${prefix}modules/auth/login.html`);
  }
  if (drawerAvatarEl && isAuth) {
    drawerAvatarEl.innerHTML = `<span style="font-weight:700;font-size:0.95rem;color:var(--color-brand-blue);">${initials}</span>`;
  }

  if (profileLinksContainer) {
    if (isAuth) {
      const employeeItemHtml = isEmployee ? `
        <a href="${prefix}employee/index.html" class="action-menu-item employee-store-menu-item" role="menuitem" data-nav-link="employee-store">
          <span class="action-item-icon employee-store-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </span>
          <span class="action-item-text">
            <strong>Tienda de Empleados</strong>
            <span class="action-item-sub">Precios y crédito de nómina</span>
          </span>
          <span class="badge-employee-pill">Empleado</span>
        </a>
      ` : '';

      profileLinksContainer.innerHTML = `
        ${employeeItemHtml}
        <a href="${prefix}modules/profile/profile.html" class="action-menu-item" role="menuitem">
          <span class="action-item-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </span>
          <span class="action-item-text">Mi Perfil</span>
        </a>

        <a href="${prefix}modules/order/my-orders.html" class="action-menu-item" role="menuitem">
          <span class="action-item-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </span>
          <span class="action-item-text">Mis compras / Pedidos</span>
        </a>

        <a href="${prefix}modules/notifications/notifications.html" class="action-menu-item" role="menuitem">
          <span class="action-item-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </span>
          <span class="action-item-text">Notificaciones</span>
        </a>

        <a href="${prefix}modules/product/wishlist.html" class="action-menu-item" role="menuitem">
          <span class="action-item-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </span>
          <span class="action-item-text">Productos deseados</span>
        </a>

        <button type="button" id="btn-navbar-logout" class="action-menu-item logout-item" role="menuitem" style="width: 100%; text-align: left; background: none; border: none; font-family: inherit;">
          <span class="action-item-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </span>
          <span class="action-item-text">Cerrar sesión</span>
        </button>
      `;
    } else {
      profileLinksContainer.innerHTML = `
        <a href="${prefix}modules/auth/login.html" class="action-menu-item" role="menuitem">
          <span class="action-item-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
          </span>
          <span class="action-item-text">Iniciar Sesión</span>
        </a>

        <a href="${prefix}modules/auth/register.html" class="action-menu-item" role="menuitem">
          <span class="action-item-icon">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </span>
          <span class="action-item-text">Crear Cuenta</span>
        </a>
      `;
    }
  }

  if (drawerUserLinksList) {
    if (isAuth) {
      const drawerEmployeeItemHtml = isEmployee ? `
        <li class="drawer-nav-item drawer-item-employee-switch">
          <a href="${prefix}employee/index.html" class="drawer-nav-link drawer-employee-switch-link" data-nav-link="employee-store">
            <span class="drawer-link-left">
              <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
              Tienda de Empleados
            </span>
            <span class="drawer-employee-badge">Empleado</span>
          </a>
        </li>
      ` : '';

      drawerUserLinksList.innerHTML = `
        ${drawerEmployeeItemHtml}
        <li class="drawer-nav-item">
          <a href="${prefix}modules/profile/profile.html" class="drawer-nav-link">
            <span class="drawer-link-left">
              <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Mi Perfil
            </span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="${prefix}modules/order/my-orders.html" class="drawer-nav-link">
            <span class="drawer-link-left">
              <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              Mis Compras y Pedidos
            </span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="${prefix}modules/notifications/notifications.html" class="drawer-nav-link">
            <span class="drawer-link-left">
              <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              Notificaciones
            </span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="${prefix}modules/product/wishlist.html" class="drawer-nav-link">
            <span class="drawer-link-left">
              <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              Productos Deseados
            </span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <button type="button" id="btn-drawer-logout" class="drawer-nav-link" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;color:#ef4444;">
            <span class="drawer-link-left" style="color:#ef4444;">
              <svg class="drawer-icon" style="color:#ef4444;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Cerrar Sesión
            </span>
          </button>
        </li>
      `;
    } else {
      drawerUserLinksList.innerHTML = `
        <li class="drawer-nav-item">
          <a href="${prefix}modules/auth/register.html" class="drawer-nav-link">
            <span class="drawer-link-left">
              <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              Iniciar Sesión
            </span>
          </a>
        </li>
        <li class="drawer-nav-item">
          <a href="${prefix}modules/auth/register.html" class="drawer-nav-link">
            <span class="drawer-link-left">
              <svg class="drawer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              Registrarse
            </span>
          </a>
        </li>
      `;
    }
  }

/**
 * Muestra un modal estilizado y moderno para confirmar el cierre de sesión en TuEstante.
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
function showLogoutConfirmModal({
  title = '¿Cerrar Sesión?',
  message = '¿Estás seguro de que deseas salir de tu cuenta? Tendrás que iniciar sesión nuevamente para acceder a tus compras y carrito.',
  confirmText = 'Sí, Cerrar Sesión',
  cancelText = 'Permanecer conectado'
} = {}) {
  return new Promise((resolve) => {
    let container = document.getElementById('tuestante-logout-modal-root');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tuestante-logout-modal-root';
      document.body.appendChild(container);
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'tu-logout-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    backdrop.innerHTML = `
      <div class="tu-logout-modal-card">
        <button type="button" class="tu-logout-modal-close" aria-label="Cerrar modal">&times;</button>
        <div class="tu-logout-icon-wrap" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </div>
        <h3 class="tu-logout-title">${title}</h3>
        <p class="tu-logout-desc">${message}</p>
        <div class="tu-logout-actions">
          <button type="button" class="tu-logout-btn tu-logout-btn-cancel">${cancelText}</button>
          <button type="button" class="tu-logout-btn tu-logout-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    container.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.add('is-visible');
    });

    const close = (confirmed) => {
      backdrop.classList.remove('is-visible');
      setTimeout(() => {
        backdrop.remove();
        resolve(confirmed);
      }, 220);
    };

    const confirmBtn = backdrop.querySelector('.tu-logout-btn-confirm');
    const cancelBtn = backdrop.querySelector('.tu-logout-btn-cancel');
    const closeBtn = backdrop.querySelector('.tu-logout-modal-close');

    confirmBtn?.addEventListener('click', () => close(true));
    cancelBtn?.addEventListener('click', () => close(false));
    closeBtn?.addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handleKey);
        close(false);
      }
    };
    document.addEventListener('keydown', handleKey);
  });
}

if (typeof window !== 'undefined') {
  window.showLogoutConfirmModal = showLogoutConfirmModal;
}

  const handleLogout = async () => {
    const confirmed = await showLogoutConfirmModal();
    if (!confirmed) return;
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await fetch(`${prefix.replace('../../', '') || ''}api/user/logout/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        }).catch(() => {});
      }
    } finally {
      clearTokens();
      clearCurrentUser();
      syncUserAuthState();
      updateNotificationsBadge(0);
      window.location.reload();
    }
  };

  const btnNavLogout = document.getElementById('btn-navbar-logout');
  if (btnNavLogout) btnNavLogout.onclick = handleLogout;

  const btnDrawerLogout = document.getElementById('btn-drawer-logout');
  if (btnDrawerLogout) btnDrawerLogout.onclick = handleLogout;
}

/**
 * Evalúa si un producto pertenece a una categoría dada considerando
 * todas las variantes de serialización de Django.
 */
function isProductInCategory(prod, cat) {
  if (!prod || !cat) return false;
  const catId = String(cat.id ?? '');
  const catName = String(cat.category_name || cat.name || '').toLowerCase().trim();

  // 1. Coincidencia directa por category (ID, objeto o string)
  if (prod.category !== undefined && prod.category !== null) {
    if (typeof prod.category === 'object') {
      if (String(prod.category.id ?? '') === catId) return true;
      if (String(prod.category.name || prod.category.category_name || '').toLowerCase().trim() === catName) return true;
    } else if (String(prod.category) === catId) {
      return true;
    }
  }

  // 2. Coincidencia por category_id o categoryId
  if (prod.category_id !== undefined && prod.category_id !== null && String(prod.category_id) === catId) return true;
  if (prod.categoryId !== undefined && prod.categoryId !== null && String(prod.categoryId) === catId) return true;

  // 3. Coincidencia en array de categories / categories_detail
  if (Array.isArray(prod.categories)) {
    for (const c of prod.categories) {
      if (typeof c === 'object' && c !== null) {
        if (String(c.id ?? '') === catId || String(c.category_name || c.name || '').toLowerCase().trim() === catName) return true;
      } else if (String(c) === catId) {
        return true;
      }
    }
  }

  if (Array.isArray(prod.categories_detail)) {
    for (const c of prod.categories_detail) {
      if (String(c.id ?? '') === catId || String(c.category_name || c.name || '').toLowerCase().trim() === catName) return true;
    }
  }

  // 4. Coincidencia por category_detail
  if (prod.category_detail && typeof prod.category_detail === 'object') {
    if (String(prod.category_detail.id ?? '') === catId) return true;
    if (String(prod.category_detail.category_name || prod.category_detail.name || '').toLowerCase().trim() === catName) return true;
  }

  // 5. Coincidencia por nombre de categoría
  if (prod.category_name && String(prod.category_name).toLowerCase().trim() === catName) return true;
  if (prod.categoryName && String(prod.categoryName).toLowerCase().trim() === catName) return true;

  return false;
}

/**
 * Renderiza la barra secundaria de categorías y los mega-menús de mini catálogo
 * con los datos reales traídos del backend.
 * @param {Array} categoriesData Lista de categorías del backend
 */
function renderCategoriesNavbar(categoriesData) {
  ensureNavbarElementsExist();

  const prefix = getBasePathPrefix();
  const desktopContainer = document.getElementById('nav-categories-container');

  if (!desktopContainer || !Array.isArray(categoriesData) || !categoriesData.length) {
    return;
  }

  // Renderizado Desktop: Categorías con Mega-Menús desplegables al hover
  desktopContainer.innerHTML = categoriesData.map((cat) => {
    const typeId = cat.id;
    const typeName = cat.name || cat.product_type_name || 'Tipo de producto';
    const typeLink = `${prefix}modules/product/products.html?type=${typeId}`;
    const items = Array.isArray(cat.items) ? cat.items : [];

    let productsContentHtml = '';

    if (items.length > 0) {
      const featuredProduct = items.find((product) => product.is_featured) || items[items.length - 1];
      const regularProducts = items.filter((product) => product !== featuredProduct).slice(0, 4);
      const productsCards = regularProducts.map((prod) => {
        const prodId = prod.id;
        const prodName = prod.name || prod.product_name || 'Producto TuEstante';
        const rawImg = prod.image || prod.product_image || `${prefix}assets/images/categoria/estante.png`;
        const prodImg = (rawImg.startsWith('http') || rawImg.startsWith('/') || rawImg.startsWith('.')) ? rawImg : `${prefix}${rawImg}`;
        const prodLink = `${prefix}modules/product/product-details.html?id=${prodId}`;
        const prodPrice = (prod.price !== undefined && prod.price !== null)
          ? `$${Number(prod.price).toFixed(2)}`
          : '';

        return `
          <a href="${prodLink}" class="catalog-card">
            <div class="catalog-img-wrapper">
              <img src="${prodImg}" alt="${prodName}" class="catalog-img" loading="lazy" onerror="this.src='${prefix}assets/images/categoria/estante.png'">
            </div>
            <div class="catalog-card-info">
              <span class="catalog-title">${prodName}</span>
              ${prodPrice ? `<strong class="catalog-price">${prodPrice}</strong>` : ''}
            </div>
          </a>
        `;
      }).join('');

      const featuredImg = featuredProduct.image || featuredProduct.product_image || `${prefix}assets/images/categoria/estante.png`;
      const featuredImgUrl = (featuredImg.startsWith('http') || featuredImg.startsWith('/') || featuredImg.startsWith('.')) ? featuredImg : `${prefix}${featuredImg}`;
      const featuredLink = `${prefix}modules/product/product-details.html?id=${featuredProduct.id}`;
      const featuredName = featuredProduct.name || featuredProduct.product_name || 'Producto destacado';
      const featuredPrice = featuredProduct.price !== undefined && featuredProduct.price !== null
        ? `$${Number(featuredProduct.price).toFixed(2)}`
        : 'Consultar precio';

      productsContentHtml = `
        <div class="catalog-products-row">
          <div class="catalog-grid">
            ${productsCards}
          </div>
          <a href="${featuredLink}" class="catalog-featured-product">
            <div class="catalog-featured-heading">Destacado</div>
            <div class="catalog-featured-body">
              <div class="catalog-featured-img-wrapper">
                <img src="${featuredImgUrl}" alt="${featuredName}" class="catalog-featured-img" loading="lazy" onerror="this.src='${prefix}assets/images/categoria/estante.png'">
              </div>
              <div class="catalog-featured-info">
                <div class="catalog-featured-name">${featuredName}</div>
                <strong class="catalog-featured-price">${featuredPrice}</strong>
              </div>
            </div>
          </a>
        </div>
        <div class="catalog-bottom-row">
          <a href="${typeLink}" class="catalog-shop-all-btn">VER TODO EN ${typeName.toUpperCase()}</a>
        </div>
      `;
    } else {
      productsContentHtml = `
        <div class="catalog-empty-category" style="text-align: left; padding: 1.5rem 0;">
          <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 1rem;">Explora todos los modelos y opciones disponibles en este tipo de producto.</p>
          <a href="${typeLink}" class="catalog-shop-all-btn" style="display: inline-block;">VER CATÁLOGO DE ${typeName.toUpperCase()}</a>
        </div>
      `;
    }

    return `
      <li class="category-item">
        <a href="${typeLink}" class="category-link">${typeName}</a>
        
        <div class="category-catalog-menu" role="region" aria-label="Productos de ${typeName}">
          <div class="catalog-inner">
            ${productsContentHtml}
          </div>
        </div>
      </li>
    `;
  }).join('');

}

/**
 * Carga las categorías y productos reales desde la base de datos del Backend Django
 * y actualiza los mega-menús de navegación en tiempo real.
 */
async function loadDynamicCategoriesFromApi() {
  const prefix = getBasePathPrefix();
  try {    
    const [catResponse, prodResponse] = await Promise.allSettled([
      getRequest('/products/product-types/', {}, { auth: false }),
      getRequest('/products/products/', {}, { auth: false })
    ]);

    let categories = [];
    if (catResponse.status === 'fulfilled' && catResponse.value) {
      categories = extractList(catResponse.value);
    }

    let products = [];
    if (prodResponse.status === 'fulfilled' && prodResponse.value) {
      products = extractList(prodResponse.value);
    }


    if (categories && categories.length > 0) {
      // Mapear cada tipo real con sus productos correspondientes
      const realCategoriesWithProducts = categories.map((type) => {
        const typeId = type.id;
        const typeName = type.product_type_name || type.name || 'Tipo de producto';

        const matchingProducts = products.filter((product) => {
          const productTypeId = product.product_type_detail?.id ?? product.product_type_id ?? product.product_type;
          return String(productTypeId) === String(typeId);
        });

        const items = matchingProducts.slice(0, 6).map((prod) => {
          const rawImg = prod.product_image || prod.image || (Array.isArray(prod.images) && prod.images[0]?.image) || '';
          return {
            id: prod.id,
            name: prod.product_name || prod.name || 'Producto',
            description: prod.description || '',
            image: resolveImageUrl(rawImg, `${prefix}assets/images/categoria/estante.png`),
            is_featured: Boolean(prod.is_featured || prod.is_feature_product || prod.is_featured_product || prod.badge === 'Destacado'),
            price: prod.price || prod.base_price
          };
        });

        return {
          id: typeId,
          name: typeName,
          slug: type.slug || 'tipo-producto',
          items: items
        };
      });

      renderCategoriesNavbar(realCategoriesWithProducts);
    }
  } catch (err) {
    console.warn(LOG_TAG, 'Aviso al sincronizar catálogo con backend:', err);
  }
}

/**
 * Configura los eventos del buscador (desktop y móvil) para redirigir al catálogo con el término buscado.
 */
function setupSearchHandler() {
  const prefix = getBasePathPrefix();
  const searchForm = document.getElementById('nav-search-form');
  const searchInput = document.getElementById('nav-search-input');

  if (searchForm && searchInput) {
    // Si ya hay un parámetro de búsqueda en la URL, reflejarlo en el input
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const initialQuery = urlParams.get('search') || urlParams.get('buscar') || urlParams.get('q') || '';
      if (initialQuery && !searchInput.value) {
        searchInput.value = initialQuery;
      }
    } catch (_) {}

    searchForm.onsubmit = (e) => {
      e.preventDefault();
      const term = searchInput.value.trim();
      const isProductsPage = window.location.pathname.includes('/product/products.html') || window.location.pathname.endsWith('products.html');

      if (isProductsPage) {
        const pageSearchInput = document.getElementById('search-input');
        if (pageSearchInput) {
          pageSearchInput.value = term;
          pageSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
          const newUrl = new URL(window.location);
          if (term) {
            newUrl.searchParams.set('search', term);
          } else {
            newUrl.searchParams.delete('search');
          }
          history.pushState(null, '', newUrl);
          return;
        }
      }

      if (term) {
        window.location.href = `${prefix}modules/product/products.html?search=${encodeURIComponent(term)}`;
      } else {
        window.location.href = `${prefix}modules/product/products.html`;
      }
    };
  }
}

/**
 * Configura las interacciones del cajón lateral móvil (Mobile Drawer).
 */
function setupMobileDrawer() {
  ensureNavbarElementsExist();

  if (window.__tuestanteDrawerListenersAttached) return;
  window.__tuestanteDrawerListenersAttached = true;

  function getDrawerElements() {
    let hamburgerBtn = document.getElementById('hamburger-btn');
    let drawerCloseBtn = document.getElementById('drawer-close-btn');
    let mobileDrawer = document.getElementById('mobile-drawer');
    let drawerBackdrop = document.getElementById('drawer-backdrop');

    if (!mobileDrawer || !drawerBackdrop) {
      ensureNavbarElementsExist();
      hamburgerBtn = document.getElementById('hamburger-btn');
      drawerCloseBtn = document.getElementById('drawer-close-btn');
      mobileDrawer = document.getElementById('mobile-drawer');
      drawerBackdrop = document.getElementById('drawer-backdrop');
    }

    return { hamburgerBtn, drawerCloseBtn, mobileDrawer, drawerBackdrop };
  }

  function openDrawer() {
    const { hamburgerBtn, drawerCloseBtn, mobileDrawer, drawerBackdrop } = getDrawerElements();
    if (!mobileDrawer || !drawerBackdrop) return;

    mobileDrawer.classList.add('is-open');
    drawerBackdrop.classList.add('is-active');

    mobileDrawer.style.transform = 'translateX(0)';
    mobileDrawer.style.visibility = 'visible';
    mobileDrawer.style.display = 'flex';
    drawerBackdrop.style.visibility = 'visible';
    drawerBackdrop.style.opacity = '1';
    drawerBackdrop.style.pointerEvents = 'auto';

    if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'true');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (drawerCloseBtn) setTimeout(() => drawerCloseBtn.focus(), 150);
  }

  function closeDrawer() {
    const { hamburgerBtn, mobileDrawer, drawerBackdrop } = getDrawerElements();
    if (!mobileDrawer || !drawerBackdrop) return;

    mobileDrawer.classList.remove('is-open');
    drawerBackdrop.classList.remove('is-active');

    mobileDrawer.style.transform = 'translateX(-100%)';
    mobileDrawer.style.visibility = 'hidden';
    drawerBackdrop.style.visibility = 'hidden';
    drawerBackdrop.style.opacity = '0';
    drawerBackdrop.style.pointerEvents = 'none';

    if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (hamburgerBtn) hamburgerBtn.focus();
  }

  // Delegación de eventos global para apertura y cierre inmediato
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;

    // 1. Apertura y cierre del drawer
    if (target.closest('#hamburger-btn') || target.closest('.hamburger-btn')) {
      e.preventDefault();
      e.stopPropagation();
      openDrawer();
      return;
    }
    
    if (target.closest('#drawer-close-btn') || target.closest('.drawer-close-btn') || target.closest('#drawer-backdrop')) {
      e.preventDefault();
      e.stopPropagation();
      closeDrawer();
      return;
    }

    // 2. Acordeones en el drawer (ej. "Conócenos")
    const accordionBtn = target.closest('.drawer-accordion-btn, [aria-controls="drawer-submenu-conocenos"]');
    if (accordionBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const controlsId = accordionBtn.getAttribute('aria-controls');
      const submenu = (controlsId ? document.getElementById(controlsId) : null) ||
        (accordionBtn.parentElement ? accordionBtn.parentElement.querySelector('.drawer-submenu') : null) ||
        accordionBtn.nextElementSibling;
      const chevron = accordionBtn.querySelector('.drawer-chevron');

      const isExpanded = accordionBtn.getAttribute('aria-expanded') === 'true' ||
        (submenu && (submenu.classList.contains('is-open') || submenu.style.display === 'block'));

      const willExpand = !isExpanded;
      accordionBtn.setAttribute('aria-expanded', String(willExpand));

      if (submenu) {
        if (willExpand) {
          submenu.classList.add('is-open');
          submenu.style.display = 'block';
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        } else {
          submenu.classList.remove('is-open');
          submenu.style.display = 'none';
          if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
      }
      return;
    }

    // 3. Cerrar drawer al hacer clic en enlaces normales del drawer
    const normalLink = target.closest('.drawer-nav-link:not(.drawer-accordion-btn), .drawer-sub-link');
    if (normalLink && !normalLink.classList.contains('drawer-accordion-btn')) {
      setTimeout(closeDrawer, 180);
    }
  });

  // Cerrar al presionar Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const { mobileDrawer } = getDrawerElements();
      if (mobileDrawer && (mobileDrawer.classList.contains('is-open') || mobileDrawer.style.visibility === 'visible')) {
        closeDrawer();
      }
    }
  });
}

/**
 * Configura los menús desplegables de Contacto y Perfil en escritorio.
 */
function setupActionDropdowns() {
  if (window.__tuestanteDropdownListenersAttached) return;
  window.__tuestanteDropdownListenersAttached = true;

  document.addEventListener('click', (e) => {
    // Si se presiona el botón o icono de notificaciones, redirigir a la pantalla de notificaciones
    const notifBtn = e.target.closest('.nav-notifications-btn');
    if (notifBtn) {
      const prefix = getBasePathPrefix();
      window.location.href = `${prefix}modules/notifications/notifications.html`;
      return;
    }

    const btn = e.target.closest('.action-dropdown-wrapper .action-btn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = btn.closest('.action-dropdown-wrapper');
      const menu = wrapper ? wrapper.querySelector('.action-dropdown-menu') : null;
      if (!menu) return;

      const isOpen = menu.classList.contains('is-open');

      // Cerrar otros menús abiertos
      document.querySelectorAll('.action-dropdown-menu').forEach((m) => {
        if (m !== menu) {
          m.classList.remove('is-open');
          m.parentElement?.querySelector('.action-btn')?.setAttribute('aria-expanded', 'false');
        }
      });

      if (!isOpen) {
        menu.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        if (wrapper && wrapper.classList.contains('notifications-dropdown-wrapper')) {
          loadNavbarNotifications(true);
        }
      } else {
        menu.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      }
      return;
    }

    // Cerrar menús al hacer clic fuera
    if (!e.target.closest('.action-dropdown-wrapper')) {
      document.querySelectorAll('.action-dropdown-menu').forEach((m) => {
        m.classList.remove('is-open');
        m.parentElement?.querySelector('.action-btn')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.action-dropdown-menu').forEach((m) => {
        m.classList.remove('is-open');
        m.parentElement?.querySelector('.action-btn')?.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

/**
 * Configura la carga automática de notificaciones al pasar el ratón (hover) sobre el botón/menú.
 */
function setupNavbarNotificationHover() {
  if (window.__tuestanteHoverListenersAttached) return;
  window.__tuestanteHoverListenersAttached = true;

  document.addEventListener('mouseover', (e) => {
    const wrapper = e.target.closest('.notifications-dropdown-wrapper');
    if (wrapper) {
      loadNavbarNotifications();
    }
  });
}

let isNotifLoading = false;
let lastNotifFetchTime = 0;
const NOTIF_CACHE_TTL = 20000; // 20 segundos

/**
 * Renderiza la lista de elementos en el contenedor del dropdown de notificaciones.
 */
function renderNavbarNotificationsList(list) {
  const container = document.getElementById('navbar-notifications-list');
  if (!container) return;

  const prefix = getBasePathPrefix();

  if (!list || !list.length) {
    container.innerHTML = `<div class="notif-dropdown-empty">No tienes notificaciones recientes.</div>`;
    return;
  }

  container.innerHTML = list.map((item) => {
    const isUnread = !item.is_read;
    const isOrder = item.notification_type === 'order' || item.notification_type === 'employee_order';
    const timeAgo = formatRelativeTimeShort(item.created_at);

    return `
      <a href="${prefix}modules/notifications/notifications.html?id=${item.id}" 
         class="notif-dropdown-item ${isUnread ? 'is-unread' : ''}" 
         data-id="${item.id}"
         role="menuitem">
        <div class="notif-dropdown-icon">
          ${isOrder ? `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          ` : `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          `}
        </div>
        <div class="notif-dropdown-content">
          <h4 class="notif-dropdown-item-title">${escapeHtmlNav(item.title || 'Notificación')}</h4>
          <p class="notif-dropdown-item-preview">${escapeHtmlNav(item.message || '')}</p>
          <span class="notif-dropdown-item-time">${timeAgo}</span>
        </div>
        ${isUnread ? '<span class="notif-dropdown-dot"></span>' : ''}
      </a>
    `;
  }).join('');

  // Eventos de clic en items del dropdown
  container.querySelectorAll('.notif-dropdown-item').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = parseInt(link.getAttribute('data-id'), 10);
      postRequest(`/notifications/${id}/mark_as_read/`, {}, { auth: true }).catch(() => {});

      // Si ya nos encontramos en la pantalla de notificaciones, seleccionar directamente sin recargar
      if (window.location.pathname.includes('/notifications/notifications.html') && typeof window.selectNotification === 'function') {
        e.preventDefault();
        document.querySelectorAll('.action-dropdown-menu').forEach((m) => m.classList.remove('is-open'));
        window.selectNotification(id);
      }
    });
  });
}

/**
 * Carga y renderiza la lista de notificaciones recientes en el dropdown del navbar.
 */
async function loadNavbarNotifications(force = false) {
  const container = document.getElementById('navbar-notifications-list');
  if (!container) return;

  const token = getAccessToken();
  const prefix = getBasePathPrefix();

  if (!token) {
    container.innerHTML = `
      <div class="notif-dropdown-empty">
        <p style="margin: 0 0 10px; font-weight: 500;">Inicia sesión para ver tus notificaciones.</p>
        <a href="${prefix}modules/auth/login.html" class="btn-dropdown-mark-all" style="display: inline-block; background: #e0f2fe; padding: 6px 12px;">Iniciar Sesión</a>
      </div>
    `;
    return;
  }

  // Si ya se consultó recientemente y el contenedor tiene elementos, evitar peticiones duplicadas
  const now = Date.now();
  if (!force && now - lastNotifFetchTime < NOTIF_CACHE_TTL && (container.querySelector('.notif-dropdown-item') || container.querySelector('.notif-dropdown-empty'))) {
    return;
  }
  if (isNotifLoading) return;
  isNotifLoading = true;

  // Solo mostrar el mensaje de carga si el contenedor aún no tiene elementos renderizados
  if (!container.querySelector('.notif-dropdown-item')) {
    container.innerHTML = `<div class="notif-dropdown-loading">Cargando notificaciones...</div>`;
  }

  try {
    const data = await getRequest('/notifications/', { page_size: 6 }, { auth: true });
    lastNotifFetchTime = Date.now();
    const list = extractList(data);
    renderNavbarNotificationsList(list);
  } catch (err) {
    console.warn('[Navbar] Error al cargar notificaciones en dropdown:', err);
    if (!container.querySelector('.notif-dropdown-item')) {
      container.innerHTML = `<div class="notif-dropdown-empty">No se pudieron cargar las notificaciones.</div>`;
    }
  } finally {
    isNotifLoading = false;
  }
}

/**
 * Eventos para botones dentro del dropdown de notificaciones
 */
function setupNavbarNotificationActions() {
  const btnMarkRead = document.getElementById('btn-navbar-mark-read');
  if (btnMarkRead) {
    btnMarkRead.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await postRequest('/notifications/mark_all_as_read/', {}, { auth: true });
        updateNotificationsBadge(0);
        const container = document.getElementById('navbar-notifications-list');
        if (container) {
          container.querySelectorAll('.notif-dropdown-item.is-unread').forEach((el) => {
            el.classList.remove('is-unread');
            const dot = el.querySelector('.notif-dropdown-dot');
            if (dot) dot.remove();
          });
        }
      } catch (err) {
        console.warn('Error al marcar todas como leídas desde dropdown:', err);
      }
    });
  }
}

function formatRelativeTimeShort(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diffSec = Math.floor((new Date() - date) / 1000);
  if (diffSec < 60) return 'Ahora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function escapeHtmlNav(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/**
 * Agrega sombra dinámica al header al hacer scroll.
 */
function setupHeaderScrollShadow() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  if (window.__tuestanteScrollListenersAttached) return;
  window.__tuestanteScrollListenersAttached = true;

  function onScroll() {
    if (window.scrollY > 10) {
      header.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.09)';
    } else {
      header.style.boxShadow = 'var(--shadow-sm)';
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/**
 * Escucha cambios en el carrito y almacenamiento para sincronizar en tiempo real.
 */
function setupGlobalSyncListeners() {
  if (window.__tuestanteSyncListenersAttached) return;
  window.__tuestanteSyncListenersAttached = true;

  window.addEventListener('cart-updated', () => updateCartBadge());
  window.addEventListener('storage', (e) => {
    if (e.key === 'tuestante_cart') updateCartBadge();
    if (e.key === 'cc_access_token' || e.key === 'cc_current_user') {
      syncUserAuthState();
      updateNotificationsBadge();
    }
  });
}

/**
 * Inicialización integral y modular de la barra de navegación de TuEstante.
 * Con reintentos automáticos y auto-inyección si el DOM aún no está listo.
 */
export function initNavbar() {
  const header = document.querySelector('.site-header');
  if (!header) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (document.querySelector('.site-header')) {
        clearInterval(interval);
        initNavbar();
      } else if (attempts >= 15) {
        clearInterval(interval);
      }
    }, 80);
    return;
  }

  // 0. Auto-inyección garantizada de contenedores faltantes
  ensureNavbarElementsExist();

  // 1. Inyección automática del logo como icono de pestaña (favicon)
  setAutoFavicon();

  // 2. Normalización de rutas relativas según la jerarquía de directorios
  normalizeNavbarRoutes();

  // 3. Sincronización de estado de usuario / auth
  syncUserAuthState();

  // 4. Sincronización en tiempo real de contadores de Carrito y Notificaciones
  updateCartBadge();
  updateNotificationsBadge();

  // 5. Configuración de interactividad (Buscador, Menú móvil, Dropdowns, Scroll)
  setupSearchHandler();
  setupMobileDrawer();
  setupActionDropdowns();
  setupNavbarNotificationHover();
  setupNavbarNotificationActions();
  setupHeaderScrollShadow();
  setupGlobalSyncListeners();

  // 6. Resaltado de la ruta activa actual
  updateActiveRouteState();

  // 7. Carga de datos reales desde la API del backend de Django
  loadDynamicCategoriesFromApi();
}

// Auto-inicialización resiliente si el componente ya se encuentra incrustado en el DOM
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initNavbar();
    });
  } else {
    initNavbar();
  }
}