import { obtenerCategorias, obtenerProductos } from '../../modules/product/product.api.js';
import { backendOrigin } from '../../js/config.js';
import { getAccessToken, clearTokens, clearCurrentUser } from '../../js/storage.js';

/**
 * Comprueba si existe una sesión de usuario activa (JWT o storage).
 */
export function checkUserSession() {
  try {
    const token = getAccessToken() || 
                  localStorage.getItem('cc_access_token') || 
                  localStorage.getItem('tuestante_token') || 
                  localStorage.getItem('token') || 
                  localStorage.getItem('access_token');
    return Boolean(token && token !== 'null' && token !== 'undefined' && String(token).trim() !== '');
  } catch (e) {
    return false;
  }
}

/**
 * Actualiza la interfaz del Navbar según el estado de sesión (logueado o no logueado).
 */
export function updateAuthUI(navbar) {
  if (!navbar) return;
  const isLoggedIn = checkUserSession();

  if (isLoggedIn) {
    navbar.classList.add('user-logged-in');
    navbar.classList.remove('user-logged-out');
  } else {
    navbar.classList.remove('user-logged-in');
    navbar.classList.add('user-logged-out');
  }
}

/**
 * Extrae un arreglo de la respuesta de la API (maneja listas directas o paginadas).
 */
function extractList(apiResult) {
  if (!apiResult) return [];
  if (Array.isArray(apiResult)) return apiResult;
  if (Array.isArray(apiResult.results)) return apiResult.results;
  return [];
}

/**
 * Resuelve la URL completa para imágenes de productos/categorías.
 */
function resolveImageUrl(path, fallback = '') {
  if (!path) return fallback;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('assets/') || path.startsWith('./assets/') || path.startsWith('../')) return path;
  const origin = (backendOrigin && typeof backendOrigin === 'string') ? backendOrigin : 'http://localhost:8000';
  const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanOrigin}${cleanPath}`;
}

/**
 * Configura dinámicamente el favicon con el logo de la empresa y el título en la pestaña del navegador.
 * @param {string} prefix Ruta relativa del proyecto ('' o '../../')
 */
function setupGlobalFaviconAndTitle(prefix) {
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.type = 'image/jpeg';
  favicon.href = `${prefix}assets/images/logo.jpeg`;

  let shortcutFavicon = document.querySelector('link[rel="shortcut icon"]');
  if (!shortcutFavicon) {
    shortcutFavicon = document.createElement('link');
    shortcutFavicon.rel = 'shortcut icon';
    document.head.appendChild(shortcutFavicon);
  }
  shortcutFavicon.type = 'image/jpeg';
  shortcutFavicon.href = `${prefix}assets/images/logo.jpeg`;

  if (document.title && !document.title.toLowerCase().includes('tuestante')) {
    document.title = `TuEstante - ${document.title}`;
  }
}

/**
 * Ajusta dinámicamente las rutas de imágenes y enlaces en la barra de navegación.
 * @param {HTMLElement} navbar Elemento principal del navbar
 */
function fixNavbarPaths(navbar) {
  const isModulePath = window.location.pathname.includes('/modules/');
  const prefix = isModulePath ? '../../' : '';

  setupGlobalFaviconAndTitle(prefix);

  const logoLink = navbar.querySelector('.navbar-logo');
  if (logoLink) {
    logoLink.setAttribute('href', `${prefix}index.html`);
    const logoImg = logoLink.querySelector('.logo-img');
    if (logoImg) {
      logoImg.setAttribute('src', `${prefix}assets/images/logo.jpeg`);
    }
  }

  const inicioLinks = navbar.querySelectorAll('[data-link="inicio"]');
  inicioLinks.forEach(link => {
    link.setAttribute('href', `${prefix}index.html`);
  });

  const contactLinks = navbar.querySelectorAll('[data-link="contacto"]');
  contactLinks.forEach(link => {
    link.setAttribute('href', `${prefix}index.html#contacto`);
  });

  const cartLinks = navbar.querySelectorAll('[data-link="carrito"]');
  cartLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/cart/cart.html`);
  });

  const productLinks = navbar.querySelectorAll('[data-link="productos"]');
  productLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/product/products.html`);
  });

  const usLinks = navbar.querySelectorAll('[data-link="nosotros"]');
  usLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/us/us.html`);
  });

  const projectLinks = navbar.querySelectorAll('[data-link="proyectos"]');
  projectLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/project/projects.html`);
  });

  const galleryLinks = navbar.querySelectorAll('[data-link="galeria"]');
  galleryLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/gallery/gallery.html`);
  });

  const helpLinks = navbar.querySelectorAll('[data-link="ayuda"]');
  helpLinks.forEach(link => {
    link.setAttribute('href', `${prefix}index.html#ayuda`);
  });

  const distLinks = navbar.querySelectorAll('[data-link="distribuidores"]');
  distLinks.forEach(link => {
    link.setAttribute('href', `${prefix}index.html#distribuidores`);
  });

  const notifLinks = navbar.querySelectorAll('[data-link="notificaciones"]');
  notifLinks.forEach(link => {
    link.setAttribute('href', `${prefix}index.html#notificaciones`);
  });

  const profileLinks = navbar.querySelectorAll('[data-link="perfil"]');
  profileLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/profile/profile.html`);
  });

  const loginLinks = navbar.querySelectorAll('[data-link="login"], .navbar-btn-login');
  loginLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/auth/login.html`);
  });

  const registerLinks = navbar.querySelectorAll('[data-link="registro"], .navbar-btn-register');
  registerLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/auth/login.html`);
  });

  const comprasLinks = navbar.querySelectorAll('[data-link="compras"]');
  comprasLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/order/my-orders.html`);
  });

  const deseadosLinks = navbar.querySelectorAll('[data-link="deseados"]');
  deseadosLinks.forEach(link => {
    link.setAttribute('href', `${prefix}modules/product/wishlist.html`);
  });

  const catLinks = navbar.querySelectorAll('.navbar-cat-link');
  catLinks.forEach(link => {
    const catNum = link.getAttribute('data-category');
    if (catNum) {
      link.setAttribute('href', `${prefix}modules/product/products.html?cat=${catNum}`);
    }
  });

  const storeBtns = navbar.querySelectorAll('.dropdown-store-btn');
  storeBtns.forEach(btn => {
    const catNum = btn.getAttribute('data-category');
    if (catNum) {
      btn.setAttribute('href', `${prefix}modules/product/products.html?cat=${catNum}`);
    }
  });

  const prodCards = navbar.querySelectorAll('.dropdown-product-card');
  prodCards.forEach(card => {
    const rawHref = card.getAttribute('href');
    if (rawHref) {
      const cleanHref = rawHref.replace(/^(\.\.\/)+/, '').replace(/^modules\/product\//, '');
      card.setAttribute('href', `${prefix}modules/product/${cleanHref}`);
    }
  });

  const prodImgs = navbar.querySelectorAll('.product-img-beige img, .featured-img-beige img');
  prodImgs.forEach(img => {
    const rawSrc = img.getAttribute('src');
    if (rawSrc && !rawSrc.startsWith('http') && !rawSrc.startsWith('/')) {
      const cleanSrc = rawSrc.replace(/^(\.\.\/)+/, '');
      img.setAttribute('src', `${prefix}${cleanSrc}`);
    }
  });
}

/**
 * Configura los formularios de búsqueda del Navbar para redirigir al catálogo con ?search=...
 */
function setupSearchForms(navbar, isModulePath, prefix) {
  const searchForms = navbar.querySelectorAll('.navbar-search-form');
  const targetPage = `${prefix}modules/product/products.html`;

  const urlParams = new URLSearchParams(window.location.search);
  const currentSearch = urlParams.get('search') || urlParams.get('q') || '';

  searchForms.forEach(form => {
    form.setAttribute('action', targetPage);
    const input = form.querySelector('.navbar-search-input');
    if (input && currentSearch) {
      input.value = currentSearch;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = input ? input.value.trim() : '';
      if (query) {
        window.location.href = `${targetPage}?search=${encodeURIComponent(query)}`;
      } else {
        window.location.href = targetPage;
      }
    });
  });
}

const STORE_NAVBAR_CATEGORIES = [
  { id: 1, name: 'Lockers Metálicos' },
  { id: 2, name: 'Armarios Metálicos' },
  { id: 3, name: 'Estanterías Industriales' },
  { id: 4, name: 'Gabinetes de Oficina' },
  { id: 5, name: 'Archivadores y Cajoneras' }
];

/**
 * Carga dinámicamente las categorías y sus productos desde el backend en el menú del Navbar.
 */
async function loadNavbarCategories(navbar, isModulePath, prefix) {
  const menuContainer = navbar.querySelector('#navbar-menu');
  if (!menuContainer) return;

  try {
    const [catsRes, prodsRes] = await Promise.all([
      obtenerCategorias().catch(() => null),
      obtenerProductos().catch(() => null)
    ]);

    let categories = extractList(catsRes);
    const products = extractList(prodsRes);

    if (!categories || categories.length === 0) {
      categories = STORE_NAVBAR_CATEGORIES.map(c => ({
        id: c.id,
        category_name: c.name
      }));
    }

    menuContainer.innerHTML = categories.map(cat => {
      const catId = cat.id;
      const catName = cat.category_name || cat.name || 'Categoría';
      const catLink = `${prefix}modules/product/products.html?cat=${catId}`;

      const catProducts = products.filter(p => {
        const pCatIds = p.categoryIds || (Array.isArray(p.categories) ? p.categories.map(c => typeof c === 'object' && c !== null ? c.id : c) : (Array.isArray(p.categories_detail) ? p.categories_detail.map(c => c.id) : [p.category || p.category_detail?.id]));
        return pCatIds.some(id => id && id.toString() === catId.toString());
      }).slice(0, 5);

      const featuredProduct = products.find(p => {
        const pCatIds = p.categoryIds || (Array.isArray(p.categories) ? p.categories.map(c => typeof c === 'object' && c !== null ? c.id : c) : (Array.isArray(p.categories_detail) ? p.categories_detail.map(c => c.id) : [p.category || p.category_detail?.id]));
        return pCatIds.some(id => id && id.toString() === catId.toString()) && p.is_feature_product;
      }) || catProducts[0];

      const hasFeatured = Boolean(featuredProduct);
      const gridClass = hasFeatured ? 'category-products-grid has-featured' : 'category-products-grid';

      const productsHTML = (catProducts.length > 0 ? catProducts : [
        { id: 101, product_name: `${catName} Estándar`, product_image: 'assets/images/productos/estante-blanco.jpeg' },
        { id: 102, product_name: `${catName} Reforzado`, product_image: 'assets/images/productos/locker-verde.jpeg' }
      ]).map(p => {
        const pId = p.id;
        const pName = p.product_name || p.name || 'Producto';
        const pImg = resolveImageUrl(p.product_image || p.image, `${prefix}assets/images/productos/estante-blanco.jpeg`);
        const pLink = `${prefix}modules/product/product-details.html?id=${pId}`;

        return `
          <a href="${pLink}" class="dropdown-product-card">
            <div class="product-img-beige">
              <img src="${pImg}" alt="${pName}">
            </div>
            <span class="product-name">${pName}</span>
          </a>
        `;
      }).join('');

      const storeBtnHTML = `
        <a href="${catLink}" class="dropdown-store-btn" data-category="${catId}">
          <span>Ir a la tienda</span>
          <svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      `;

      let featuredHTML = '';
      if (featuredProduct) {
        const featId = featuredProduct.id;
        const featName = featuredProduct.product_name || featuredProduct.name || 'Producto Destacado';
        const featPrice = typeof featuredProduct.price === 'number' ? featuredProduct.price : parseFloat(featuredProduct.price) || 0;
        const featDesc = featuredProduct.description || 'Producto destacado de la categoría';
        const featImg = resolveImageUrl(featuredProduct.product_image || featuredProduct.image, `${prefix}assets/images/productos/locker-fondo.png`);
        const featLink = `${prefix}modules/product/product-details.html?id=${featId}`;

        featuredHTML = `
          <div class="featured-product-column">
            <span class="featured-header-title">Destacado</span>
            <a href="${featLink}" class="dropdown-product-card featured-card">
              <div class="product-img-beige featured-img-beige">
                <img src="${featImg}" alt="${featName}">
              </div>
              <div class="featured-info-row">
                <span class="product-name">${featName}</span>
                <span class="product-price">${featPrice.toFixed(2)}$</span>
              </div>
              <p class="featured-features-list">${featDesc}</p>
            </a>
          </div>
        `;
      }

      return `
        <li class="navbar-cat-item">
          <a href="${catLink}" class="navbar-cat-link" data-category="${catId}">${catName}</a>
          <div class="category-dropdown">
            <div class="${gridClass}">
              ${productsHTML}
              ${storeBtnHTML}
              ${featuredHTML}
            </div>
          </div>
        </li>
      `;
    }).join('');

    bindCategoryLinkEvents(navbar);
  } catch (err) {
    console.error('Error al cargar categorías en el navbar:', err);
    bindCategoryLinkEvents(navbar);
  }
}

function bindCategoryLinkEvents(navbar) {
  const catLinks = navbar.querySelectorAll('.navbar-cat-link');
  const toggleBtn = navbar.querySelector('#navbar-toggle');

  catLinks.forEach(link => {
    link.addEventListener('click', () => {
      navbar.classList.remove('menu-open');
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');
      }

      catLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  const urlParams = new URLSearchParams(window.location.search);
  const activeCat = urlParams.get('cat');
  if (activeCat) {
    catLinks.forEach(link => {
      if (link.getAttribute('data-category') === activeCat) {
        link.classList.add('active');
      }
    });
  }
}

/**
 * Inicializa el comportamiento interactivo de la barra de navegación.
 */
export function initNavbar() {
  const navbar = document.querySelector('.app-navbar');
  if (!navbar) return;

  const isModulePath = window.location.pathname.includes('/modules/');
  const prefix = isModulePath ? '../../' : '';

  fixNavbarPaths(navbar);
  setupSearchForms(navbar, isModulePath, prefix);
  loadNavbarCategories(navbar, isModulePath, prefix);

  const toggleBtn = navbar.querySelector('#navbar-toggle');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navbar.classList.contains('menu-open');
      if (isOpen) {
        navbar.classList.remove('menu-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      } else {
        navbar.classList.add('menu-open');
        toggleBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (navbar.classList.contains('menu-open') && !navbar.contains(e.target)) {
      navbar.classList.remove('menu-open');
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    }
  });

  bindCategoryLinkEvents(navbar);

  const mobileUtilityLinks = navbar.querySelectorAll('.mobile-utility-link');
  mobileUtilityLinks.forEach(link => {
    link.addEventListener('click', () => {
      navbar.classList.remove('menu-open');
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  const contactLinks = navbar.querySelectorAll('[data-link="contacto"]');
  contactLinks.forEach(link => {
    const target = `${prefix}index.html#contacto`;
    link.setAttribute('href', target);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const isIndexPage = !window.location.pathname.includes('/modules/') && 
                          (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '');
      if (isIndexPage) {
        const contactSection = document.getElementById('contacto') || document.getElementById('contactos');
        if (contactSection) {
          contactSection.scrollIntoView({ behavior: 'smooth' });
          if (history.pushState) {
            history.pushState(null, null, '#contacto');
          }
          return;
        }
      }
      window.location.href = target;
    });
  });

  const handleScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('navbar-scrolled');
    } else {
      navbar.classList.remove('navbar-scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // Configurar comportamiento interactivo de los submenús desplegables (Conócenos, Notificaciones, Contacto y Perfil)
  const dropdownContainers = navbar.querySelectorAll('.nav-dropdown-container');
  dropdownContainers.forEach(container => {
    const btn = container.querySelector('.nav-dropdown-btn, .navbar-profile-btn, .navbar-contact-btn, .navbar-notif-btn, button');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = container.classList.contains('open');
        dropdownContainers.forEach(c => {
          if (c !== container) c.classList.remove('open');
        });
        if (isOpen) {
          container.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        } else {
          container.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    }
  });

  document.addEventListener('click', (e) => {
    dropdownContainers.forEach(container => {
      if (!container.contains(e.target)) {
        container.classList.remove('open');
        const btn = container.querySelector('.nav-dropdown-btn, .navbar-profile-btn, .navbar-contact-btn, .navbar-notif-btn, button');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Actualizar estado visual de autenticación (login / perfil / notificaciones)
  updateAuthUI(navbar);

  // Manejador de Cerrar Sesión
  const logoutItems = navbar.querySelectorAll('[data-link="logout"]');
  logoutItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      clearTokens();
      clearCurrentUser();
      try {
        localStorage.removeItem('tuestante_token');
        localStorage.removeItem('tuestante_user');
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
      } catch (err) {}
      updateAuthUI(navbar);
      window.location.href = `${prefix}modules/auth/login.html`;
    });
  });

  // Actualizar e inicializar el contador del Carrito
  updateCartCount();
}

/**
 * Actualiza dinámicamente el badge de cantidad de productos en el icono del Carrito.
 */
export function updateCartCount() {
  const badgeElements = document.querySelectorAll('#cart-badge, .cart-badge');
  if (!badgeElements || badgeElements.length === 0) return;

  let count = 0;
  try {
    const rawData = localStorage.getItem('tuestante_cart');
    const cartItems = rawData ? JSON.parse(rawData) : [];
    count = cartItems.reduce((acc, item) => acc + (parseInt(item.qty, 10) || 1), 0);
  } catch (e) {
    count = 0;
  }

  badgeElements.forEach(badge => {
    const currentCount = parseInt(badge.textContent, 10) || 0;
    badge.textContent = count;
    badge.style.display = 'flex';
    if (count > 0 && currentCount !== count) {
      badge.classList.add('pop');
      setTimeout(() => badge.classList.remove('pop'), 250);
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    updateCartCount();
    const navbar = document.querySelector('.app-navbar');
    if (navbar) updateAuthUI(navbar);
  });
  window.addEventListener('cart-updated', updateCartCount);
  window.addEventListener('auth-changed', () => {
    const navbar = document.querySelector('.app-navbar');
    if (navbar) updateAuthUI(navbar);
  });
}
