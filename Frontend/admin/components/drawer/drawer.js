/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR MODULAR DEL COMPONENTE DRAWER / SIDEBAR
 * ==========================================================================
 * Controla estados (expandido, colapsado, oculto, móvil off-canvas),
 * submenús acordeón, badges, eventos globales e integración con la barra de navegación.
 */

import { clearTokens, clearCurrentUser } from '../../js/storage.js';

// Claves para persistencia de estado en LocalStorage
const STORAGE_KEY_COLLAPSED = 'tu_admin_drawer_collapsed';
const STORAGE_KEY_HIDDEN = 'tu_admin_drawer_hidden';

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
 * Clase controladora del Drawer
 */
export class AdminDrawer {
  constructor(options = {}) {
    this.options = {
      drawerSelector: '#admin-drawer',
      backdropSelector: '#drawer-backdrop',
      toggleBtnSelector: '#drawer-toggle-btn',
      logoutBtnSelector: '#drawer-logout-btn',
      badgeSelector: '#drawer-notif-badge',
      autoInit: true,
      persistState: true,
      ...options
    };

    this.drawer = null;
    this.backdrop = null;
    this.toggleBtn = null;
    this.logoutBtn = null;
    this.badge = null;
    this.isMobile = false;

    if (this.options.autoInit) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
        this.init();
      }
    }
  }

  /**
   * Inicializa elementos del DOM, eventos y estado inicial
   */
  init() {
    this.drawer = document.querySelector(this.options.drawerSelector);
    this.backdrop = document.querySelector(this.options.backdropSelector);

    if (!this.drawer) {
      console.warn('[TuEstante Drawer] No se encontró el elemento drawer en el DOM:', this.options.drawerSelector);
      return;
    }

    this.toggleBtn = this.drawer.querySelector(this.options.toggleBtnSelector);
    this.logoutBtn = this.drawer.querySelector(this.options.logoutBtnSelector);
    this.badge = this.drawer.querySelector(this.options.badgeSelector);

    this.updateScreenMode();
    this.setupTooltips();
    this.setupSubmenus();
    this.setupActiveRoute();
    this.setupEventListeners();
    this.restorePersistedState();
    this.fixRelativePaths();

    // Notificar que el drawer está listo
    this.dispatchStateChange('ready');
  }

  /**
   * Detecta si la pantalla es móvil / tablet (< 1024px)
   */
  updateScreenMode() {
    this.isMobile = window.innerWidth < 1024;
  }

  /**
   * Ajusta las rutas relativas de enlaces e imágenes si el componente está en una subcarpeta
   */
  fixRelativePaths() {
    const prefix = getBasePathPrefix();
    if (!prefix) return;

    // Actualizar Logo
    const logoImg = this.drawer.querySelector('.brand-logo-img');
    if (logoImg && !logoImg.getAttribute('src').startsWith('http')) {
      const currentSrc = logoImg.getAttribute('src');
      if (!currentSrc.startsWith('../')) {
        logoImg.src = prefix + currentSrc;
      }
    }

    // Actualizar enlaces
    const links = this.drawer.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('../')) {
        link.setAttribute('href', prefix + href);
      }
    });
  }

  /**
   * Configura atributos data-tooltip para el modo colapsado (iconos)
   */
  setupTooltips() {
    const mainLinks = this.drawer.querySelectorAll('.drawer-link');
    mainLinks.forEach(link => {
      const textSpan = link.querySelector('.drawer-link-text');
      if (textSpan && !link.getAttribute('data-tooltip')) {
        link.setAttribute('data-tooltip', textSpan.textContent.trim());
      }
    });
  }

  /**
   * Configura la lógica de acordeón para submenús desplegables (e.g. Productos)
   */
  setupSubmenus() {
    const submenuToggles = this.drawer.querySelectorAll('.drawer-submenu-toggle');
    
    submenuToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Si está en modo colapsado desktop, expandir el menú primero
        if (document.body.classList.contains('drawer-collapsed') && !this.isMobile) {
          this.expand();
        }

        const parent = toggle.closest('.drawer-item-has-submenu');
        const submenu = parent ? parent.querySelector('.drawer-submenu') : null;
        
        if (submenu) {
          const isOpen = submenu.classList.contains('is-open');
          if (isOpen) {
            submenu.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
          } else {
            submenu.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
          }
        }
      });
    });
  }

  /**
   * Resalta automáticamente el enlace correspondiente a la URL actual
   */
  setupActiveRoute() {
    const currentPath = window.location.pathname.toLowerCase();
    const allLinks = this.drawer.querySelectorAll('.drawer-link, .drawer-submenu-link');

    // Remover estado activo previo
    allLinks.forEach(l => l.classList.remove('active'));

    let matched = false;

    // 1. Coincidencia por submenús
    const submenuLinks = this.drawer.querySelectorAll('.drawer-submenu-link');
    submenuLinks.forEach(subLink => {
      const href = subLink.getAttribute('href') || '';
      const cleanHref = href.replace(/^(\.\.\/)+/, '').toLowerCase();
      if (cleanHref && currentPath.endsWith(cleanHref)) {
        subLink.classList.add('active');
        // Abrir submenú padre
        const parentItem = subLink.closest('.drawer-item-has-submenu');
        if (parentItem) {
          const toggle = parentItem.querySelector('.drawer-submenu-toggle');
          const submenu = parentItem.querySelector('.drawer-submenu');
          if (submenu && toggle) {
            submenu.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.classList.add('active');
          }
        }
        matched = true;
      }
    });

    if (matched) return;

    // 2. Coincidencia por enlaces principales
    const mainLinks = this.drawer.querySelectorAll('.drawer-link:not(.drawer-submenu-toggle)');
    mainLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      const cleanHref = href.replace(/^(\.\.\/)+/, '').toLowerCase();
      if (cleanHref && (currentPath.endsWith(cleanHref) || (cleanHref === 'index.html' && (currentPath.endsWith('/') || currentPath === '')))) {
        link.classList.add('active');
        matched = true;
      }
    });

    // 3. Si no hay coincidencia y estamos en index / raíz, marcar Inicio
    if (!matched && (currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '')) {
      const homeLink = this.drawer.querySelector('[data-nav-id="inicio"]');
      if (homeLink) homeLink.classList.add('active');
    }
  }

  /**
   * Configura listeners de eventos para interactividad
   */
  setupEventListeners() {
    // 1. Botón de toggle en el encabezado del drawer
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => {
        if (this.isMobile) {
          this.closeMobile();
        } else {
          this.toggleCollapse();
        }
      });
    }

    // 2. Backdrop para cerrar en móvil
    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => {
        this.closeMobile();
      });
    }

    // 3. Tecla Escape para cerrar en móvil
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('drawer-mobile-open')) {
        this.closeMobile();
      }
    });

    // 4. Delegación global para botones externos (ej. navbar con data-drawer-toggle)
    document.addEventListener('click', (e) => {
      const toggleTrigger = e.target.closest('[data-drawer-toggle]');
      if (toggleTrigger) {
        e.preventDefault();
        this.toggle();
        return;
      }

      const collapseTrigger = e.target.closest('[data-drawer-collapse]');
      if (collapseTrigger) {
        e.preventDefault();
        this.toggleCollapse();
        return;
      }

      const hideTrigger = e.target.closest('[data-drawer-hide]');
      if (hideTrigger) {
        e.preventDefault();
        this.toggleHidden();
        return;
      }
    });

    // 5. Cierre automático en móvil al hacer clic en un enlace de navegación
    const navLinks = this.drawer.querySelectorAll('.drawer-link:not(.drawer-submenu-toggle), .drawer-submenu-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (this.isMobile) {
          this.closeMobile();
        }
      });
    });

    // 6. Botón de Cerrar Sesión
    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLogout();
      });
    }

    // 7. Evento Resize de ventana
    window.addEventListener('resize', () => {
      const wasMobile = this.isMobile;
      this.updateScreenMode();

      // Si cambia de móvil a desktop, limpiar clase mobile open
      if (wasMobile && !this.isMobile) {
        document.body.classList.remove('drawer-mobile-open');
      }
    });
  }

  /**
   * Maneja el proceso de cierre de sesión
   */
  handleLogout() {
    const confirmLogout = window.confirm('¿Estás seguro de que deseas cerrar sesión?');
    if (!confirmLogout) return;

    try {
      clearTokens();
      clearCurrentUser();
    } catch (err) {
      console.warn('[TuEstante Drawer] No se pudieron limpiar credenciales:', err);
    }

    // Disparar evento personalizado por si la app tiene un listener de logout
    const logoutEvent = new CustomEvent('auth:logout', { bubbles: true });
    window.dispatchEvent(logoutEvent);

    // Redirigir a login o página principal
    const prefix = getBasePathPrefix();
    window.location.href = `${prefix}index.html`;
  }

  /* ========================================================================
     API DE CONTROL PÚBLICA (USADA POR NAVBAR Y OTRAS PÁGINAS)
     ======================================================================== */

  /**
   * Alterna el estado del drawer inteligentemente según la pantalla
   */
  toggle() {
    this.updateScreenMode();
    if (this.isMobile) {
      this.toggleMobile();
    } else {
      // En desktop, si está oculto se muestra; si está visible se colapsa/expande
      if (document.body.classList.contains('drawer-hidden')) {
        this.show();
      } else {
        this.toggleCollapse();
      }
    }
  }

  /**
   * Abre el drawer en modo móvil
   */
  openMobile() {
    document.body.classList.add('drawer-mobile-open');
    this.drawer.setAttribute('aria-hidden', 'false');
    this.dispatchStateChange('mobile-open');
  }

  /**
   * Cierra el drawer en modo móvil
   */
  closeMobile() {
    document.body.classList.remove('drawer-mobile-open');
    this.drawer.setAttribute('aria-hidden', 'true');
    this.dispatchStateChange('mobile-close');
  }

  /**
   * Alterna apertura en modo móvil
   */
  toggleMobile() {
    if (document.body.classList.contains('drawer-mobile-open')) {
      this.closeMobile();
    } else {
      this.openMobile();
    }
  }

  /**
   * Colapsa el drawer en desktop (modo 76px con iconos)
   */
  collapse() {
    document.body.classList.add('drawer-collapsed');
    if (this.options.persistState) {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, 'true');
    }
    this.dispatchStateChange('collapsed');
  }

  /**
   * Expande el drawer en desktop (modo completo 260px)
   */
  expand() {
    document.body.classList.remove('drawer-collapsed');
    if (this.options.persistState) {
      localStorage.removeItem(STORAGE_KEY_COLLAPSED);
    }
    this.dispatchStateChange('expanded');
  }

  /**
   * Alterna entre expandido y colapsado en desktop
   */
  toggleCollapse() {
    if (document.body.classList.contains('drawer-collapsed')) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Oculta totalmente el drawer en desktop (ancho 0px)
   */
  hide() {
    document.body.classList.add('drawer-hidden');
    if (this.options.persistState) {
      localStorage.setItem(STORAGE_KEY_HIDDEN, 'true');
    }
    this.dispatchStateChange('hidden');
  }

  /**
   * Muestra el drawer en desktop si estaba totalmente oculto
   */
  show() {
    document.body.classList.remove('drawer-hidden');
    if (this.options.persistState) {
      localStorage.removeItem(STORAGE_KEY_HIDDEN);
    }
    this.dispatchStateChange('shown');
  }

  /**
   * Alterna entre totalmente oculto y visible
   */
  toggleHidden() {
    if (document.body.classList.contains('drawer-hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Actualiza el valor del badge de notificaciones
   * @param {number|string} count Cantidad de notificaciones
   */
  setNotificationCount(count) {
    if (!this.badge) return;
    const num = parseInt(count, 10);
    if (isNaN(num) || num <= 0) {
      this.badge.style.display = 'none';
      this.badge.textContent = '0';
    } else {
      this.badge.style.display = 'inline-flex';
      this.badge.textContent = num > 99 ? '99+' : num.toString();
      this.badge.setAttribute('aria-label', `${num} notificaciones pendientes`);
    }
  }

  /**
   * Establece manualmente el item activo
   * @param {string} navId Identificador del item (data-nav-id)
   */
  setActive(navId) {
    const allLinks = this.drawer.querySelectorAll('.drawer-link, .drawer-submenu-link');
    allLinks.forEach(l => l.classList.remove('active'));

    const target = this.drawer.querySelector(`[data-nav-id="${navId}"]`);
    if (target) {
      target.classList.add('active');
      const parentSubmenu = target.closest('.drawer-submenu');
      if (parentSubmenu) {
        parentSubmenu.classList.add('is-open');
        const parentToggle = parentSubmenu.closest('.drawer-item-has-submenu')?.querySelector('.drawer-submenu-toggle');
        if (parentToggle) {
          parentToggle.classList.add('active');
          parentToggle.setAttribute('aria-expanded', 'true');
        }
      }
    }
  }

  /**
   * Restaura el estado previo guardado en LocalStorage
   */
  restorePersistedState() {
    if (!this.options.persistState || this.isMobile) return;

    if (localStorage.getItem(STORAGE_KEY_HIDDEN) === 'true') {
      this.hide();
    } else if (localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true') {
      this.collapse();
    }
  }

  /**
   * Emite un CustomEvent informando cambios de estado
   * @param {string} action Acción ejecutada
   */
  dispatchStateChange(action) {
    const detail = {
      action,
      isMobile: this.isMobile,
      isMobileOpen: document.body.classList.contains('drawer-mobile-open'),
      isCollapsed: document.body.classList.contains('drawer-collapsed'),
      isHidden: document.body.classList.contains('drawer-hidden')
    };

    const event = new CustomEvent('drawer:state-change', { detail, bubbles: true });
    window.dispatchEvent(event);
  }
}

/**
 * Función de inicialización automática o manual
 * @param {Object} options Opciones de configuración
 * @returns {AdminDrawer} Instancia del controlador
 */
export function initDrawer(options = {}) {
  const instance = new AdminDrawer(options);
  window.TuEstanteDrawer = instance;
  return instance;
}

// Auto-inicialización global si se importa directamente como script
if (typeof window !== 'undefined') {
  window.initDrawer = initDrawer;
}
