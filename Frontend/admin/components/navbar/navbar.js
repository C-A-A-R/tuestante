/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR MODULAR DEL COMPONENTE NAVBAR (BARRA SUPERIOR)
 * ==========================================================================
 * Incluye auto-importación y orquestación del Drawer, inyección automática
 * de Favicon con el logo, título dinámico de pantalla, buscador y menú de usuario.
 */

import { initDrawer, getBasePathPrefix } from '../drawer/drawer.js';
import { getCurrentUser, getAccessToken, clearTokens, clearCurrentUser } from '../../js/storage.js';
import { getOfficialRate } from '../../js/service/exchange-rate.service.js';
import { loadComponent } from '../utils/component-loader.js';
import { initFooter } from '../footer/footer.js';
import { showConfirmModal } from '../modal/modal.js';
import { apiRequest, resolveImageUrl } from '../../js/api.js';
import { backendOrigin } from '../../js/config.js';

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
  if (path.includes('order-pos.html')) {
    return 'Toma de Pedidos (POS)';
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
    this.setupNotifications();
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
   * Configura la barra de búsqueda expandible con resultados dinámicos en vivo,
   * búsqueda de rutas del sistema y navegación con Enter a la primera opción.
   */
  setupSearch() {
    const toggleBtn = document.getElementById('navbar-search-toggle');
    const searchExpand = document.getElementById('navbar-search-expand');
    const closeBtn = document.getElementById('navbar-search-close');
    const searchInput = document.getElementById('navbar-search-input');
    const resultsContainer = document.getElementById('navbar-search-results');

    if (!toggleBtn || !searchExpand) return;

    let debounceTimer = null;
    const prefix = getBasePathPrefix();

    // Catálogo de rutas y pantallas disponibles dentro del sistema admin
    const ADMIN_SYSTEM_ROUTES = [
      {
        title: 'Punto de Venta (POS)',
        desc: 'Mostrador de ventas a crédito de nómina y contado',
        category: 'Tienda de Empleados',
        path: 'modules/employee_store/store-pos.html',
        icon: '🛒',
        keywords: ['pos', 'punto de venta', 'caja', 'vender', 'tienda', 'despacho', 'cobrar', 'ventas']
      },
      {
        title: 'Crear Orden de Consumo',
        desc: 'Registro rápido de órdenes para trabajadores',
        category: 'Tienda de Empleados',
        path: 'modules/employee_store/order-pos.html',
        icon: '📝',
        keywords: ['orden', 'ordenes', 'crear orden', 'pedido empleado', 'nueva orden', 'consumo', 'registrar orden']
      },
      {
        title: 'Directorio de Trabajadores',
        desc: 'Libro mayor de colaboradores y cuentas corrientes',
        category: 'Gestión Laboral',
        path: 'modules/employee_store/employee-ledger.html',
        icon: '👥',
        keywords: ['trabajadores', 'empleados', 'colaboradores', 'nomina', 'personal', 'libro mayor', 'cuentas', 'kardex']
      },
      {
        title: 'Registrar Nuevo Trabajador',
        desc: 'Formulario de alta de nuevo colaborador',
        category: 'Gestión Laboral',
        path: 'modules/employee_store/employee-create.html',
        icon: '➕',
        keywords: ['registrar trabajador', 'nuevo trabajador', 'crear empleado', 'alta colaborador', 'agregar empleado', 'nuevo empleado']
      },
      {
        title: 'Historial de Órdenes',
        desc: 'Listado, entregas y estados de pedidos internos',
        category: 'Tienda de Empleados',
        path: 'modules/employee_store/orders-history.html',
        icon: '📋',
        keywords: ['historial', 'ordenes', 'pedidos', 'compras', 'entregas', 'pedidos internos']
      },
      {
        title: 'Cortes y Liquidación de Nómina',
        desc: 'Cierre semanal, comprobantes y reportes contables',
        category: 'Finanzas y Reportes',
        path: 'modules/employee_store/reports.html',
        icon: '💰',
        keywords: ['cortes', 'nomina', 'liquidacion', 'reportes', 'cierre', 'deducciones', 'cuentas por cobrar']
      },
      {
        title: 'Inventario de Productos (Tienda)',
        desc: 'Catálogo interno, existencias y precios para colaboradores',
        category: 'Catálogo e Inventario',
        path: 'modules/employee_store/internal-products.html',
        icon: '📦',
        keywords: ['inventario', 'productos internos', 'stock', 'tienda empleados', 'existencias', 'articulos internos']
      },
      {
        title: 'Categorías y Subcategorías',
        desc: 'Clasificación de productos y rubros',
        category: 'Catálogo e Inventario',
        path: 'modules/employee_store/categories.html',
        icon: '🏷️',
        keywords: ['categorias', 'subcategorias', 'clasificacion', 'departamentos', 'rubros']
      },
      {
        title: 'Catálogo General de Productos',
        desc: 'Lista general de productos de la tienda',
        category: 'Catálogo e Inventario',
        path: 'modules/product/products.html',
        icon: '🛍️',
        keywords: ['productos', 'catalogo', 'articulos', 'ecommerce', 'tienda virtual']
      },
      {
        title: 'Registrar Nuevo Producto',
        desc: 'Formulario de creación de productos',
        category: 'Catálogo e Inventario',
        path: 'modules/product/product-create.html',
        icon: '✨',
        keywords: ['crear producto', 'nuevo producto', 'agregar producto', 'publicar producto']
      },
      {
        title: 'Tipos de Productos',
        desc: 'Configuración de tipos y atributos de catálogo',
        category: 'Catálogo e Inventario',
        path: 'modules/product/types.html',
        icon: '⚙️',
        keywords: ['tipos de productos', 'variantes', 'atributos', 'caracteristicas']
      },
      {
        title: 'Fabricación y Manufactura',
        desc: 'Órdenes de producción, ensamble y taller',
        category: 'Operaciones',
        path: 'modules/production/production.html',
        icon: '🏭',
        keywords: ['fabricacion', 'produccion', 'manufactura', 'taller', 'ensamble', 'ordenes de fabricacion']
      },
      {
        title: 'Pedidos de Clientes',
        desc: 'Gestión de compras del portal en línea',
        category: 'Ventas Online',
        path: 'modules/order/orders.html',
        icon: '📑',
        keywords: ['pedidos clientes', 'ventas online', 'ordenes clientes', 'carritos']
      },
      {
        title: 'Pagos y Cobranzas',
        desc: 'Verificación de transferencias y pagos',
        category: 'Finanzas',
        path: 'modules/payment/payments.html',
        icon: '💳',
        keywords: ['pagos', 'cobranzas', 'transferencias', 'bcv', 'recibos', 'facturas']
      },
      {
        title: 'Envíos y Despachos',
        desc: 'Logística de entregas y guías de transporte',
        category: 'Operaciones',
        path: 'modules/shipping/shipping.html',
        icon: '🚚',
        keywords: ['envios', 'despachos', 'entregas', 'transporte', 'guias']
      },
      {
        title: 'Clientes y Usuarios',
        desc: 'Directorio de compradores registrados',
        category: 'Usuarios',
        path: 'modules/user/clients.html',
        icon: '👤',
        keywords: ['clientes', 'usuarios', 'compradores', 'cuentas clientes']
      },
      {
        title: 'Notificaciones del Sistema',
        desc: 'Centro de avisos, alertas y stock',
        category: 'Sistema',
        path: 'modules/notifications/notifications.html',
        icon: '🔔',
        keywords: ['notificaciones', 'alertas', 'avisos', 'mensajes']
      },
      {
        title: 'Inicio / Dashboard',
        desc: 'Panel principal y métricas globales',
        category: 'General',
        path: 'index.html',
        icon: '📊',
        keywords: ['inicio', 'dashboard', 'metricas', 'resumen', 'home', 'panel principal']
      },
      {
        title: 'Perfil de Usuario',
        desc: 'Gestiona tu información personal y preferencias de cuenta',
        category: 'Cuenta',
        path: 'modules/profile/profile.html',
        icon: '👤',
        keywords: ['perfil', 'usuario', 'cuenta', 'admin', 'datos', 'foto', 'perfil de usuario', 'mi perfil']
      }
    ];

    const searchMatchingRoutes = (queryStr) => {
      const norm = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const cleanQ = norm(queryStr);
      if (!cleanQ || cleanQ.length < 2) return [];

      return ADMIN_SYSTEM_ROUTES.filter(route => {
        const title = norm(route.title);
        const desc = norm(route.desc);
        const cat = norm(route.category);
        if (title.includes(cleanQ) || desc.includes(cleanQ) || cat.includes(cleanQ)) {
          return true;
        }
        return route.keywords.some(k => norm(k).includes(cleanQ) || cleanQ.includes(norm(k)));
      });
    };

    const hideResults = () => {
      if (resultsContainer) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
      }
    };

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchExpand.classList.toggle('is-open');
      if (searchExpand.classList.contains('is-open') && searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      } else {
        hideResults();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchExpand.classList.remove('is-open');
        hideResults();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();

        if (query.length < 2) {
          hideResults();
          return;
        }

        const matchedRoutes = searchMatchingRoutes(query);

        if (resultsContainer) {
          resultsContainer.classList.remove('hidden');
          
          // Si hay rutas coincidentes, renderizarlas de inmediato mientras la API responde
          let initialHtml = '';
          if (matchedRoutes.length > 0) {
            initialHtml += `
              <div class="search-section-group">
                <div class="search-section-header">🧭 Rutas y Módulos del Sistema (${matchedRoutes.length})</div>
                ${matchedRoutes.slice(0, 4).map(r => `
                  <a href="${prefix}${r.path}" class="search-result-item" role="option" data-search-type="route">
                    <div class="search-result-thumb">${r.icon}</div>
                    <div class="search-result-info">
                      <div class="search-result-title">${r.title}</div>
                      <div class="search-result-meta">${r.category} • ${r.desc}</div>
                    </div>
                    <span class="search-result-badge" style="background:#e0f2fe;color:#005187;">Ir a módulo ↵</span>
                  </a>
                `).join('')}
              </div>
            `;
          }

          initialHtml += `
            <div class="search-loading-state">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10"></path>
              </svg>
              <span>Consultando registros en el sistema...</span>
            </div>
          `;
          resultsContainer.innerHTML = initialHtml;
        }

        debounceTimer = setTimeout(async () => {
          try {
            const data = await apiRequest({
              path: '/employee-store/global-search/',
              params: { q: query }
            });

            const workers = data?.workers || [];
            const products = data?.products || [];
            const orders = data?.orders || [];

            const totalCount = matchedRoutes.length + workers.length + products.length + orders.length;

            if (totalCount === 0) {
              if (resultsContainer) {
                resultsContainer.innerHTML = `
                  <div class="search-empty-state">
                    No se encontraron coincidencias para "<strong>${query}</strong>".
                  </div>
                `;
              }
              return;
            }

            let html = '';

            // 1. Rutas y Módulos del Sistema (Siempre de primero si coincide)
            if (matchedRoutes.length > 0) {
              html += `
                <div class="search-section-group">
                  <div class="search-section-header">🧭 Rutas y Módulos del Sistema (${matchedRoutes.length})</div>
                  ${matchedRoutes.slice(0, 4).map(r => `
                    <a href="${prefix}${r.path}" class="search-result-item" role="option" data-search-type="route">
                      <div class="search-result-thumb">${r.icon}</div>
                      <div class="search-result-info">
                        <div class="search-result-title">${r.title}</div>
                        <div class="search-result-meta">${r.category} • ${r.desc}</div>
                      </div>
                      <span class="search-result-badge" style="background:#e0f2fe;color:#005187;">Ir a módulo ↵</span>
                    </a>
                  `).join('')}
                </div>
              `;
            }

            // 2. Colaboradores
            if (workers.length > 0) {
              html += `
                <div class="search-section-group">
                  <div class="search-section-header">👤 Colaboradores (${workers.length})</div>
                  ${workers.map(w => {
                    const thumb = w.photo
                      ? `<img src="${resolveImageUrl(w.photo)}" alt="${w.name}">`
                      : '👤';
                    return `
                      <a href="${prefix}modules/employee_store/employee-statement.html?id=${w.id}" class="search-result-item" role="option" data-search-type="worker">
                        <div class="search-result-thumb">${thumb}</div>
                        <div class="search-result-info">
                          <div class="search-result-title">${w.name}</div>
                          <div class="search-result-meta">Ficha: ${w.employee_number || 'S/N'} • CI: ${w.doc || 'S/D'} • ${w.department || 'General'}</div>
                        </div>
                        <span class="search-result-badge">Ver Kardex</span>
                      </a>
                    `;
                  }).join('')}
                </div>
              `;
            }

            // 3. Productos
            if (products.length > 0) {
              html += `
                <div class="search-section-group">
                  <div class="search-section-header">📦 Productos en Catálogo (${products.length})</div>
                  ${products.map(p => {
                    const thumb = p.image
                      ? `<img src="${resolveImageUrl(p.image)}" alt="${p.name}">`
                      : '📦';
                    return `
                      <a href="${prefix}modules/product/products.html?search=${encodeURIComponent(p.barcode || p.name)}" class="search-result-item" role="option" data-search-type="product">
                        <div class="search-result-thumb">${thumb}</div>
                        <div class="search-result-info">
                          <div class="search-result-title">${p.name}</div>
                          <div class="search-result-meta">Código: ${p.barcode || 'S/B'} • Stock: ${p.stock} un.</div>
                        </div>
                        <span class="search-result-badge" style="background:#ecfdf5;color:#059669;">$${parseFloat(p.price || 0).toFixed(2)}</span>
                      </a>
                    `;
                  }).join('')}
                </div>
              `;
            }

            // 4. Órdenes
            if (orders.length > 0) {
              html += `
                <div class="search-section-group">
                  <div class="search-section-header">📋 Órdenes de Consumo (${orders.length})</div>
                  ${orders.map(o => {
                    const isDelivered = o.status === 'DELIVERED';
                    const badgeBg = isDelivered ? '#ecfdf5' : '#fef3c7';
                    const badgeColor = isDelivered ? '#059669' : '#b45309';
                    const statusText = isDelivered ? 'Entregada' : 'Sin entregar';
                    return `
                      <a href="${prefix}modules/employee_store/orders-history.html?search=${encodeURIComponent(o.order_number)}" class="search-result-item" role="option" data-search-type="order">
                        <div class="search-result-thumb">📋</div>
                        <div class="search-result-info">
                          <div class="search-result-title">Orden #${o.order_number}</div>
                          <div class="search-result-meta">${o.employee_name} • ${o.created_at}</div>
                        </div>
                        <span class="search-result-badge" style="background:${badgeBg};color:${badgeColor};">$${parseFloat(o.total_amount || 0).toFixed(2)} (${statusText})</span>
                      </a>
                    `;
                  }).join('')}
                </div>
              `;
            }

            if (resultsContainer) {
              resultsContainer.innerHTML = html;
            }

          } catch (err) {
            console.error('Error en búsqueda global:', err);
            if (resultsContainer) {
              resultsContainer.innerHTML = `
                <div class="search-empty-state" style="color: #dc2626;">
                  Ocurrió un error al buscar. Por favor intenta nuevamente.
                </div>
              `;
            }
          }
        }, 200);
      });

      // Navegación por teclado y Enter a la primera opción
      searchInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
          searchExpand.classList.remove('is-open');
          hideResults();
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (!resultsContainer || resultsContainer.classList.contains('hidden')) return;
          const items = Array.from(resultsContainer.querySelectorAll('.search-result-item'));
          if (items.length === 0) return;

          e.preventDefault();
          const currentIndex = items.findIndex(el => el.classList.contains('is-selected'));
          let nextIndex = 0;

          if (e.key === 'ArrowDown') {
            nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          }

          items.forEach(el => el.classList.remove('is-selected'));
          items[nextIndex].classList.add('is-selected');
          items[nextIndex].scrollIntoView({ block: 'nearest' });
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          const query = searchInput.value.trim();
          if (!query) return;

          // 1. Si hay un elemento seleccionado o un primer resultado visible, navegar a él inmediatamente
          const selectedItem = resultsContainer ? resultsContainer.querySelector('.search-result-item.is-selected') : null;
          const firstItem = selectedItem || (resultsContainer ? resultsContainer.querySelector('.search-result-item') : null);

          if (firstItem && firstItem.href) {
            hideResults();
            window.location.href = firstItem.href;
            return;
          }

          // 2. Si se presionó Enter de inmediato, buscar coincidencia en rutas del sistema
          const fastRoutes = searchMatchingRoutes(query);
          if (fastRoutes.length > 0) {
            hideResults();
            window.location.href = `${prefix}${fastRoutes[0].path}`;
            return;
          }

          // 3. Consultar rápidamente la API y tomar la primera opción devuelta
          try {
            const data = await apiRequest({
              path: '/employee-store/global-search/',
              params: { q: query }
            });
            if (data?.workers?.length > 0) {
              hideResults();
              window.location.href = `${prefix}modules/employee_store/employee-statement.html?id=${data.workers[0].id}`;
              return;
            }
            if (data?.products?.length > 0) {
              hideResults();
              window.location.href = `${prefix}modules/product/products.html?search=${encodeURIComponent(data.products[0].barcode || data.products[0].name)}`;
              return;
            }
            if (data?.orders?.length > 0) {
              hideResults();
              window.location.href = `${prefix}modules/employee_store/orders-history.html?search=${encodeURIComponent(data.orders[0].order_number)}`;
              return;
            }
          } catch (err) {
            console.warn('Error en búsqueda al presionar Enter:', err);
          }

          // 4. Redirección por defecto
          hideResults();
          window.location.href = `${prefix}modules/product/products.html?search=${encodeURIComponent(query)}`;
        }
      });
    }

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#navbar-search-wrapper')) {
        searchExpand.classList.remove('is-open');
        hideResults();
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
   * Configura el sistema de notificaciones en la barra del Admin:
   * - Consulta el conteo de no leídas
   * - Despliega el panel popover de notificaciones
   * - Permite marcar notificaciones como leídas
   * - Se conecta al canal WebSocket /ws/notifications/ para actualizaciones en vivo
   */
  setupNotifications() {
    const notifBtn = document.getElementById('navbar-notif-btn');
    const notifPopover = document.getElementById('navbar-notif-popover');
    const notifList = document.getElementById('notif-popover-list');
    const unreadTag = document.getElementById('notif-unread-count-tag');
    const btnMarkAll = document.getElementById('btn-mark-all-read');
    const btnRefresh = document.getElementById('btn-refresh-notif');

    if (!notifBtn || !notifPopover) return;

    // Helper para formatear tiempo relativo
    const formatTimeAgo = (isoString) => {
      if (!isoString) return '';
      try {
        const date = new Date(isoString);
        const now = new Date();
        const diffSec = Math.floor((now - date) / 1000);
        if (diffSec < 60) return 'Hace un momento';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `Hace ${diffMin} min`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `Hace ${diffDays} d`;
        return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
      } catch {
        return '';
      }
    };

    // Helper para obtener icono y estilo según tipo y contenido de notificación
    const getNotifIcon = (type, title = '', message = '') => {
      const t = (type || '').toLowerCase();
      const combined = `${title} ${message}`.toLowerCase();

      if (t === 'payment' || combined.includes('pago') || combined.includes('comprobante')) {
        return { icon: '💳', class: 'type-payment' };
      }
      if (t === 'payroll' || combined.includes('abono') || combined.includes('nómina')) {
        return { icon: '💵', class: 'type-payroll' };
      }
      if (t === 'employee_order' || combined.includes('pedido empleado') || combined.includes('tienda de empleados')) {
        return { icon: '👥', class: 'type-employee_order' };
      }
      if (t === 'shipping' || combined.includes('envío') || combined.includes('despacho') || combined.includes('entregado')) {
        return { icon: '🚚', class: 'type-shipping' };
      }
      if (t === 'production' || combined.includes('fabricación') || combined.includes('producción')) {
        return { icon: '🏭', class: 'type-production' };
      }
      if (t === 'order' || combined.includes('pedido') || combined.includes('orden')) {
        return { icon: '🛍️', class: 'type-order' };
      }
      return { icon: '🔔', class: 'type-general' };
    };

    /**
     * Determina la URL de destino y la etiqueta de acción contextual para una notificación
     * @param {Object} notif Objeto de notificación
     * @returns {{ url: string, actionLabel: string }}
     */
    const resolveNotificationDestination = (notif) => {
      const prefix = getBasePathPrefix();
      if (!notif) return { url: `${prefix}modules/order/orders.html`, actionLabel: 'Ver pedidos' };

      const type = (notif.notification_type || '').toLowerCase();
      const title = (notif.title || '').toLowerCase();
      const message = (notif.message || '').toLowerCase();
      const combined = `${title} ${message}`;

      // Extraer identificadores de orden
      const orderId = notif.order_id ?? (typeof notif.order === 'object' ? notif.order?.id : notif.order) ?? null;
      const internalOrderId = notif.internal_order_id ?? (typeof notif.internal_order === 'object' ? notif.internal_order?.id : notif.internal_order) ?? null;

      let parsedOrderId = orderId;
      if (!parsedOrderId) {
        const match = combined.match(/(?:pedido|orden)\s*#?0*(\d+)/i);
        if (match) {
          parsedOrderId = parseInt(match[1], 10);
        }
      }

      // 1. Pagos y Comprobantes
      const isPayment = type === 'payment' ||
                        title.includes('pago') ||
                        title.includes('comprobante') ||
                        (combined.includes('pago') && (combined.includes('verificar') || combined.includes('registrado') || combined.includes('revisión') || combined.includes('aprobado') || combined.includes('rechazado')));

      if (isPayment) {
        // Abono o deducción de empleado
        if (type === 'payroll' || combined.includes('abono') || combined.includes('nómina') || combined.includes('deducción')) {
          return {
            url: `${prefix}modules/employee_store/reports.html`,
            actionLabel: 'Ver nómina'
          };
        }
        // Pago registrado de cliente
        if (parsedOrderId) {
          if (title.includes('pago registrado')) {
            return {
              url: `${prefix}modules/payment/payments.html?search=${parsedOrderId}`,
              actionLabel: 'Ver pago'
            };
          }
          return {
            url: `${prefix}modules/order/order-detail.html?id=${parsedOrderId}`,
            actionLabel: 'Ver pedido'
          };
        }
        return {
          url: `${prefix}modules/payment/payments.html`,
          actionLabel: 'Ver pagos'
        };
      }

      // 2. Pedidos Internos de Empleados
      if (type === 'employee_order' || internalOrderId || combined.includes('pedido empleado') || combined.includes('tienda de empleados')) {
        return {
          url: `${prefix}modules/employee_store/orders-history.html`,
          actionLabel: 'Ver orden'
        };
      }

      // 3. Nómina / Cortes
      if (type === 'payroll' || combined.includes('nómina') || combined.includes('abono')) {
        return {
          url: `${prefix}modules/employee_store/reports.html`,
          actionLabel: 'Ver nómina'
        };
      }

      // 4. Envíos y Despachos
      if (type === 'shipping' || combined.includes('envío') || combined.includes('despacho') || combined.includes('en camino') || combined.includes('entregado')) {
        if (parsedOrderId) {
          return {
            url: `${prefix}modules/order/order-detail.html?id=${parsedOrderId}`,
            actionLabel: 'Ver pedido'
          };
        }
        return {
          url: `${prefix}modules/shipping/shipping.html`,
          actionLabel: 'Ver envíos'
        };
      }

      // 5. Fabricación y Producción
      if (type === 'production' || combined.includes('fabricación') || combined.includes('producción')) {
        if (parsedOrderId) {
          return {
            url: `${prefix}modules/order/order-detail.html?id=${parsedOrderId}`,
            actionLabel: 'Ver pedido'
          };
        }
        return {
          url: `${prefix}modules/production/production.html`,
          actionLabel: 'Ver fabricación'
        };
      }

      // 6. Directorio de Clientes
      if (type === 'client' || type === 'user' || (combined.includes('cliente') && !combined.includes('pedido'))) {
        return {
          url: `${prefix}modules/user/clients.html`,
          actionLabel: 'Ver clientes'
        };
      }

      // 7. Pedidos de Clientes
      if (type === 'order' || combined.includes('pedido') || parsedOrderId) {
        if (parsedOrderId) {
          return {
            url: `${prefix}modules/order/order-detail.html?id=${parsedOrderId}`,
            actionLabel: 'Ver pedido'
          };
        }
        return {
          url: `${prefix}modules/order/orders.html`,
          actionLabel: 'Ver pedidos'
        };
      }

      // Fallback
      if (parsedOrderId) {
        return {
          url: `${prefix}modules/order/order-detail.html?id=${parsedOrderId}`,
          actionLabel: 'Ver pedido'
        };
      }
      return {
        url: `${prefix}modules/order/orders.html`,
        actionLabel: 'Ver detalle'
      };
    };

    // 1. Cargar conteo de notificaciones no leídas
    const loadUnreadCount = async () => {
      try {
        const res = await apiRequest({ path: '/notifications/unread_count/' });
        const count = res?.unread_count ?? 0;
        this.setNotificationCount(count);
        if (unreadTag) {
          unreadTag.textContent = `${count} nueva${count === 1 ? '' : 's'}`;
        }
      } catch (err) {
        // Silencioso si no está logueado o endpoint temporalmente no disponible
      }
    };

    // 2. Cargar lista de notificaciones recientes
    const loadNotificationsList = async () => {
      if (!notifList) return;
      notifList.innerHTML = `
        <div class="notif-loading-state">
          <div class="notif-spinner"></div>
          <span>Cargando notificaciones...</span>
        </div>
      `;

      try {
        const res = await apiRequest({ path: '/notifications/', params: { limit: 15 } });
        const notifications = Array.isArray(res) ? res : (res?.results || []);

        if (!notifications.length) {
          notifList.innerHTML = `
            <div class="notif-empty-state">
              <span style="font-size: 1.8rem;">🎉</span>
              <strong>¡Estás al día!</strong>
              <span>No tienes notificaciones pendientes por revisar.</span>
            </div>
          `;
          return;
        }

        notifList.innerHTML = '';
        notifications.forEach((notif) => {
          const item = document.createElement('div');
          item.className = `notif-item ${!notif.is_read ? 'is-unread' : ''}`;
          item.setAttribute('role', 'button');
          item.setAttribute('tabindex', '0');

          const iconMeta = getNotifIcon(notif.notification_type, notif.title, notif.message);
          const dest = resolveNotificationDestination(notif);

          item.innerHTML = `
            <div class="notif-icon-circle ${iconMeta.class}">
              ${iconMeta.icon}
            </div>
            <div class="notif-content">
              <div class="notif-title">${notif.title || 'Notificación'}</div>
              <div class="notif-message">${notif.message || ''}</div>
              <div class="notif-meta">
                <span class="notif-time">${formatTimeAgo(notif.created_at)}</span>
                <span class="notif-action-hint">${dest.actionLabel} &rarr;</span>
                ${!notif.is_read ? '<span class="notif-unread-dot"></span>' : ''}
              </div>
            </div>
          `;

          // Clic en notificación individual con redirección contextual inmediata
          const triggerNavigation = async () => {
            if (!notif.is_read) {
              notif.is_read = true;
              item.classList.remove('is-unread');
              item.querySelector('.notif-unread-dot')?.remove();
              loadUnreadCount();

              apiRequest({
                path: `/notifications/${notif.id}/mark_as_read/`,
                method: 'POST'
              }).catch(e => console.warn('[TuEstante Navbar] Error marcando como leída:', e));
            }

            if (dest && dest.url) {
              togglePopover(false);
              window.location.href = dest.url;
            }
          };

          item.addEventListener('click', (e) => {
            e.preventDefault();
            triggerNavigation();
          });

          item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerNavigation();
            }
          });

          notifList.appendChild(item);
        });
      } catch (err) {
        notifList.innerHTML = `
          <div class="notif-empty-state">
            <span>Error al cargar notificaciones</span>
          </div>
        `;
      }
    };

    // 3. Abrir / Cerrar Popover
    const togglePopover = (forceState) => {
      const willOpen = forceState !== undefined ? forceState : notifPopover.classList.contains('hidden');
      
      // Cerrar otros dropdowns del navbar (como el menú de usuario)
      document.getElementById('navbar-dropdown-menu')?.classList.remove('is-open');
      document.getElementById('navbar-user-btn')?.setAttribute('aria-expanded', 'false');

      if (willOpen) {
        notifPopover.classList.remove('hidden');
        notifBtn.setAttribute('aria-expanded', 'true');
        loadNotificationsList();
      } else {
        notifPopover.classList.add('hidden');
        notifBtn.setAttribute('aria-expanded', 'false');
      }
    };

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover();
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!notifPopover.contains(e.target) && !notifBtn.contains(e.target)) {
        togglePopover(false);
      }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !notifPopover.classList.contains('hidden')) {
        togglePopover(false);
      }
    });

    // 4. Marcar todas como leídas
    btnMarkAll?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await apiRequest({ path: '/notifications/mark_all_as_read/', method: 'POST' });
        this.setNotificationCount(0);
        if (unreadTag) unreadTag.textContent = '0 nuevas';
        notifList.querySelectorAll('.notif-item.is-unread').forEach(el => {
          el.classList.remove('is-unread');
          el.querySelector('.notif-unread-dot')?.remove();
        });
      } catch (err) {
        console.error('[TuEstante Navbar] Error al marcar todas como leídas:', err);
      }
    });

    // 5. Botón Actualizar
    btnRefresh?.addEventListener('click', (e) => {
      e.stopPropagation();
      loadUnreadCount();
      loadNotificationsList();
    });

    // Cargar conteo al inicializar
    loadUnreadCount();

    // Polling de respaldo cada 40 segundos
    setInterval(loadUnreadCount, 40000);

    // 6. Conexión WebSocket para notificaciones en tiempo real
    try {
      const token = getAccessToken();
      if (token) {
        let wsBase = backendOrigin || window.location.origin;
        const originUrl = new URL(wsBase, window.location.href);
        const wsProtocol = originUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${originUrl.host}/ws/notifications/?token=${encodeURIComponent(token)}`;

        const socket = new WebSocket(wsUrl);

        socket.onmessage = () => {
          loadUnreadCount();
          if (!notifPopover.classList.contains('hidden')) {
            loadNotificationsList();
          }
        };

        socket.onerror = () => {
          // Si hay interrupción o caída de WebSocket, el polling de respaldo se encarga
        };
      }
    } catch (wsErr) {
      console.warn('[TuEstante Notif WS] WebSocket no disponible:', wsErr);
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

