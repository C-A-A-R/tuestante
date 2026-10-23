import { initNavbar } from './components/navbar/navbar.js';
import { initFooter } from './components/footer/footer.js';
import { obtenerTiposProducto, obtenerProductosDestacados, obtenerProductos, obtenerProductosOutlet, alternarFavoritoProducto } from './modules/product/product.api.js';
import { obtenerProyectos } from './modules/project/project.api.js';
import { obtenerAlianzas } from './modules/partnership/partnership.api.js';
import { extractList, resolveImageUrl } from './js/api.js';
import { getAccessToken } from './js/storage.js';
import { showCartModal } from './components/cart-modal/cart-modal.js';
import { showSuccessToast, showInfoToast, showErrorToast } from './components/toast/toast.js';
import { createProductCartHTML } from './components/product-cart/product-cart.js';

/**
 * Genera el HTML para un mensaje de error amigable cuando la API no responde.
 */
function createApiErrorFeedback(message = 'No se pudo conectar con el servidor', hint = 'Por favor, verifica tu conexión o intenta recargar la página.') {
  return `
    <div class="api-feedback-card error-feedback" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 2.5rem 1.5rem; background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 16px; margin: 12px 0;">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px; display: inline-block;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p style="color: #334155; font-family: 'Outfit', 'Inter', sans-serif; font-weight: 700; font-size: 1rem; margin: 0 0 4px 0;">${message}</p>
      <p style="color: #64748b; font-family: 'Inter', sans-serif; font-size: 0.88rem; margin: 0;">${hint}</p>
    </div>
  `;
}

/**
 * Genera el HTML para un mensaje amigable cuando la API responde con 0 registros.
 */
function createApiEmptyFeedback(message = 'No hay registros disponibles', hint = 'Pronto agregaremos nuevo contenido en esta sección.') {
  return `
    <div class="api-feedback-card empty-feedback" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 2.5rem 1.5rem; background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 16px; margin: 12px 0;">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#005187" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px; display: inline-block;">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
      </svg>
      <p style="color: #334155; font-family: 'Outfit', 'Inter', sans-serif; font-weight: 700; font-size: 1rem; margin: 0 0 4px 0;">${message}</p>
      <p style="color: #64748b; font-family: 'Inter', sans-serif; font-size: 0.88rem; margin: 0;">${hint}</p>
    </div>
  `;
}

/**
 * Carga un componente HTML dinámicamente y lo inserta en un contenedor placeholder.
 * @param {string} placeholderId ID del elemento contenedor en el DOM
 * @param {string} filePath Ruta del archivo HTML a cargar
 */
async function loadComponent(placeholderId, filePath) {
  try {
    const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Error al cargar el componente: ${response.statusText}`);
    }
    const html = await response.text();
    // Limpiar posibles etiquetas inyectadas por servidores de desarrollo o cierre
    const cleanHtml = html
      .replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, '')
      .replace(/<\/body>/gi, '');
    const container = document.getElementById(placeholderId);
    if (container) {
      container.innerHTML = cleanHtml;
    }
  } catch (error) {
    console.error(`Error cargando el componente desde ${filePath}:`, error);
  }
}

/**
 * Carga dinámicamente los productos en Zona Outlet desde la API de Django.
 * Solo muestra la sección si existen productos outlet con stock disponible.
 * Renderiza tarjetas de producto unificadas con las mismas acciones y diseño que los productos corrientes.
 */
async function loadHomeOutlet() {
  const container = document.getElementById('home-outlet-container');
  const outletSection = document.getElementById('outlet');
  if (!container || !outletSection) return;

  try {
    const response = await obtenerProductosOutlet();
    const rawProducts = extractList(response);

    // Filtrar estrictamente productos que sean outlet, activos y con cantidad mayor a 0
    const outletProducts = (rawProducts || []).filter(p => {
      const isOutlet = !!(p.is_outlet === true || p.outlet === true);
      const isActive = p.is_active !== false;
      const hasStock = p.quantity === undefined || p.quantity > 0;
      return isOutlet && isActive && hasStock;
    });

    if (!outletProducts || outletProducts.length === 0) {
      outletSection.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    // Mostrar sección ya que hay disponibilidad
    outletSection.style.display = 'block';

    container.innerHTML = outletProducts.slice(0, 5).map(prod => {
      // Normalizar campos para que el componente los reconozca
      const normalized = {
        ...prod,
        is_outlet: true,
        quantity: prod.quantity !== undefined ? prod.quantity : 1,
      };
      return createProductCartHTML(normalized, {
        detailBaseUrl: 'modules/product/product-details.html',
        fallbackImage: 'assets/images/gallery/real_space_1.jpg',
      });
    }).join('');

  } catch (error) {
    console.warn('Error al consultar productos outlet o no disponibles:', error);
    outletSection.style.display = 'none';
    container.innerHTML = '';
  }
}

function getMonogramInitials(name) {
  if (!name) return 'TE';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Retorna el marcado HTML del logotipo correspondiente (SOLO LOGO real de la empresa).
 * Si la empresa no posee imagen de logotipo subida, muestra un monograma limpio con sus iniciales.
 */
function renderOnlyPartnerLogo(partner) {
  if (partner.logo && partner.logo.trim() !== '') {
    const logoUrl = resolveImageUrl(partner.logo);
    return `<img src="${logoUrl}" alt="${partner.name}" class="partner-logo-img" loading="lazy">`;
  }

  const initials = getMonogramInitials(partner.name);
  return `
    <div class="partner-monogram-badge" aria-label="${partner.name}">
      <span>${initials}</span>
    </div>
  `;
}


/**
 * Carga dinámicamente las Empresas Aliadas (Partnerships) desde la API de Django.
 * Si hay menos de 5 socios, no los duplica: centra y muestra exactamente los registrados.
 * Si hay 5 o más socios, activa el carrusel marquee continuo con duplicación única.
 */
async function loadHomePartnerships() {
  const section = document.getElementById('empresas-confian');
  if (!section) return;

  const carousel = document.getElementById('partnerships-carousel');
  const track = document.getElementById('partnerships-track');
  let partners = [];

  try {
    const response = await obtenerAlianzas();
    const rawList = extractList(response);
    if (Array.isArray(rawList) && rawList.length > 0) {
      partners = rawList.filter(p => p.is_active !== false);
    }
  } catch (err) {
    console.warn('No se pudieron obtener las alianzas desde la API:', err);
  }

  // Si no hay socios registrados y activos en el backend, ocultar la sección por completo
  if (!partners || partners.length === 0) {
    section.style.setProperty('display', 'none', 'important');
    section.hidden = true;
    if (track) track.innerHTML = '';
    return;
  }

  // Mostrar la sección si hay al menos una empresa registrada
  section.style.removeProperty('display');
  section.style.display = 'block';
  section.hidden = false;

  if (!track) return;

  // Umbral mínimo de socios para justificar un carrusel en movimiento continuo
  const MIN_CAROUSEL_PARTNERS = 5;

  if (partners.length < MIN_CAROUSEL_PARTNERS) {
    // Si no hay suficientes socios, NO duplicar: solo centrar y mostrar los registrados
    if (carousel) carousel.classList.add('is-static');
    track.classList.add('is-centered');

    track.innerHTML = partners.map(partner => {
      const logoMarkup = renderOnlyPartnerLogo(partner);
      return `
        <div class="partner-logo-card" title="${partner.name}" aria-label="${partner.name}">
          ${logoMarkup}
        </div>
      `;
    }).join('');
  } else {
    // Si hay suficientes socios, activar el carrusel marquee continuo
    if (carousel) carousel.classList.remove('is-static');
    track.classList.remove('is-centered');

    // Duplicar exactamente una vez para el loop infinito continuo de 50%
    const infiniteList = [...partners, ...partners];

    track.innerHTML = infiniteList.map((partner, index) => {
      const logoMarkup = renderOnlyPartnerLogo(partner);
      return `
        <div class="partner-logo-card" title="${partner.name}" aria-label="${partner.name}" aria-hidden="${index >= partners.length ? 'true' : 'false'}">
          ${logoMarkup}
        </div>
      `;
    }).join('');
  }
}


/**
 * Carga dinámicamente los Tipos de Producto desde la API de Django.
 */
async function loadHomeProductTypes() {
  const container = document.getElementById('home-product-types-container');
  if (!container) return;

  try {
    const response = await obtenerTiposProducto();
    const types = extractList(response);

    if (!types || types.length === 0) {
      container.innerHTML = createApiEmptyFeedback('No hay tipos de productos registrados actualmente.', 'Visita nuestra tienda para descubrir todos los modelos.');
      return;
    }

    container.innerHTML = types.map(type => {
      let name = type.product_type_name || type.name || 'Tipo de Producto';
      if (name.trim().toLowerCase() === 'estante') name = 'Estantes';
      const desc = type.description || 'Soluciones profesionales diseñadas para optimizar tus espacios.';
      const img = resolveImageUrl(type.product_type_image || type.image, 'assets/images/categoria/estante.png');

      return `
        <a href="modules/product/products.html?type=${type.id}" class="product-type-card">
          <div class="product-type-bg" style="background-image: url('${img}');"></div>
          <div class="product-type-overlay"></div>
          <div class="product-type-content">
            <h3 class="product-type-title">${name}</h3>
            <p class="product-type-desc">${desc}</p>
            <span class="product-type-btn">Ver Catálogo</span>
          </div>
        </a>
      `;
    }).join('');
  } catch (error) {
    console.error('Error al cargar tipos de producto en el home:', error);
    container.innerHTML = createApiErrorFeedback('No se pudieron cargar los tipos de producto.', 'Verifica la conexión con el servidor backend.');
  }
}

/**
 * Carga dinámicamente los Productos Destacados desde la API de Django en la cuadrícula de portada.
 */
async function loadHomeFeaturedProducts() {
  const container = document.getElementById('home-featured-products-container');
  if (!container) return;

  try {
    let response;
    try {
      response = await obtenerProductosDestacados({ sort_by_favorites: 'true' });
    } catch {
      response = await obtenerProductos({ sort_by_favorites: 'true' });
    }
    const products = extractList(response);
    if (!products || products.length === 0) {
      container.innerHTML = createApiEmptyFeedback('No hay productos destacados registrados en este momento.', 'Consulta nuestro catálogo completo para ver todas las opciones.');
      return;
    }

    let displayProducts = products.filter(p => p.rating === 5.0 || p.badge === 'Destacado' || p.is_feature_product !== false);
    if (displayProducts.length === 0) {
      displayProducts = [...products];
    }

    // Prioridad de orden: los más amados / más favoritos primero
    displayProducts.sort((a, b) => {
      const favA = Number(a.favorites_count ?? a.favorite_count ?? 0);
      const favB = Number(b.favorites_count ?? b.favorite_count ?? 0);
      if (favB !== favA) {
        return favB - favA; // Mayor número de favoritos primero
      }
      const ratingA = Number(a.rating ?? 0);
      const ratingB = Number(b.rating ?? 0);
      if (ratingB !== ratingA) {
        return ratingB - ratingA;
      }
      return (b.id ?? 0) - (a.id ?? 0);
    });

    // Permitir hasta 2 filas de productos (5 por fila = 10 productos).
    // Si no hay suficientes para llenar ambas filas, se deja el espacio vacío naturalmente sin repetir productos.
    displayProducts = displayProducts.slice(0, 10);

    container.innerHTML = displayProducts.map(prod =>
      createProductCartHTML(prod, {
        detailBaseUrl: 'modules/product/product-details.html',
        fallbackImage: 'assets/images/gallery/real_space_1.jpg',
      })
    ).join('');

  } catch (error) {
    console.error('Error al cargar productos destacados en el home:', error);
    container.innerHTML = createApiErrorFeedback('No se pudieron cargar los productos destacados.', 'Por favor, intenta de nuevo más tarde.');
  }
}

/**
 * Inicializa el carrusel de imágenes interactivo.
 */
function initCarousel() {
  const container = document.querySelector('.carousel-container');
  if (!container) return;

  const slides = container.querySelectorAll('.carousel-slide');
  const dotsContainer = container.querySelector('#carousel-dots');
  const prevBtn = container.querySelector('#carousel-prev');
  const nextBtn = container.querySelector('#carousel-next');

  if (slides.length <= 1) return;

  // Generar dinámicamente los puntos según la cantidad real de imágenes/slides
  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from(slides).map((_, i) =>
      `<span class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`
    ).join('');
  }

  const dots = container.querySelectorAll('.carousel-dot');

  let currentSlide = 0;
  let timer = null;
  const slideDuration = 5000; // Cambio automático cada 5 segundos

  function showSlide(index) {
    let targetIndex = index;
    if (index >= slides.length) targetIndex = 0;
    if (index < 0) targetIndex = slides.length - 1;

    slides[currentSlide].classList.remove('active');
    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');

    slides[targetIndex].classList.add('active');
    if (dots[targetIndex]) dots[targetIndex].classList.add('active');

    currentSlide = targetIndex;
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    showSlide(currentSlide - 1);
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(nextSlide, slideDuration);
  }

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      startAutoplay();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      startAutoplay();
    });
  }

  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      if (!isNaN(index) && index !== currentSlide) {
        showSlide(index);
        startAutoplay();
      }
    });
  });

  startAutoplay();
}

/**
 * Carga dinámicamente proyectos desde la API para la sección de Espacios Reales / Galería en la portada.
 * Si no hay proyectos registrados en el backend, la sección se oculta completamente.
 */
async function loadHomeRealSpacesGallery() {
  const gallerySection = document.getElementById('espacios-reales');
  const track = document.getElementById('real-spaces-track');
  if (!gallerySection || !track) return;

  try {
    const projResp = await obtenerProyectos();
    const rawItems = extractList(projResp);
    const realProjects = (rawItems || []).filter(p => p && p.is_active !== false);

    if (!realProjects || realProjects.length === 0) {
      gallerySection.style.display = 'none';
      track.innerHTML = '';
      return;
    }

    // Si existen proyectos reales en el backend, mostrar la sección
    gallerySection.style.display = 'block';

    track.innerHTML = realProjects.map((item, idx) => {
      const title = item.project_name || item.name || `Proyecto ${idx + 1}`;
      const imgPath = item.project_images || item.image;
      const imgUrl = resolveImageUrl(imgPath, 'assets/images/carrusel-index/Carrousel.png');
      const link = `modules/project/projects.html`;
      return `
        <div class="real-spaces-card">
          <a href="${link}">
            <img src="${imgUrl}" alt="${title}" class="real-spaces-img" loading="lazy">
          </a>
        </div>
      `;
    }).join('');

    // Re-inicializar controles de navegación del carrusel si hay proyectos
    initRealSpacesSlider();
  } catch (error) {
    console.warn('No se pudo consultar proyectos backend para la galería de portada:', error);
    gallerySection.style.display = 'none';
    track.innerHTML = '';
  }
}

/**
 * Inicializa los controles de navegación del carrusel horizontal de Espacios Reales en la portada.
 */
function initRealSpacesSlider() {
  const track = document.getElementById('real-spaces-track');
  const prevBtn = document.getElementById('real-spaces-prev');
  const nextBtn = document.getElementById('real-spaces-next');

  if (!track || !prevBtn || !nextBtn) return;

  let currentIndex = 0;

  function getVisibleCards() {
    const width = window.innerWidth;
    if (width <= 480) return 1;
    if (width <= 768) return 2;
    return 3;
  }

  function updateSliderPosition() {
    const cards = track.querySelectorAll('.real-spaces-card');
    if (cards.length === 0) return;

    const visibleCards = getVisibleCards();
    const maxIndex = Math.max(0, cards.length - visibleCards);

    if (currentIndex > maxIndex) currentIndex = maxIndex;
    if (currentIndex < 0) currentIndex = 0;

    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = 20;
    const moveAmount = (cardWidth + gap) * currentIndex;

    track.style.transform = `translateX(-${moveAmount}px)`;
  }

  // Evitar duplicar listeners de navegación
  if (!prevBtn.dataset.bound) {
    prevBtn.dataset.bound = 'true';
    prevBtn.addEventListener('click', () => {
      const cards = track.querySelectorAll('.real-spaces-card');
      const visibleCards = getVisibleCards();
      const maxIndex = Math.max(0, cards.length - visibleCards);
      if (currentIndex > 0) {
        currentIndex--;
      } else {
        currentIndex = maxIndex;
      }
      updateSliderPosition();
    });
  }

  if (!nextBtn.dataset.bound) {
    nextBtn.dataset.bound = 'true';
    nextBtn.addEventListener('click', () => {
      const cards = track.querySelectorAll('.real-spaces-card');
      const visibleCards = getVisibleCards();
      const maxIndex = Math.max(0, cards.length - visibleCards);
      if (currentIndex < maxIndex) {
        currentIndex++;
      } else {
        currentIndex = 0;
      }
      updateSliderPosition();
    });
  }

  window.addEventListener('resize', updateSliderPosition);
  updateSliderPosition();
}

// Inicialización global al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar Navbar y Footer en paralelo
  await Promise.all([
    loadComponent('navbar-placeholder', 'components/navbar/navbar.html'),
    loadComponent('footer-placeholder', 'components/footer/footer.html')
  ]);

  // Inicializar componentes interactivos
  initNavbar();
  initFooter();
  initCarousel();
  loadHomeRealSpacesGallery();

  // Cargar datos dinámicos desde el backend Django
  loadHomeFeaturedProducts();
  loadHomeOutlet();
  loadHomeProductTypes();
  loadHomePartnerships();

  // Añadir por defecto la clase de drawer cerrado para ajustar el layout del footer
  document.body.classList.add('drawer-collapsed');

  // Delegación de eventos para botones de productos destacados (+ Carrito y Lista de Deseos)
  document.addEventListener('click', async (e) => {
    const wishlistBtn = e.target.closest('.unified-wishlist-btn');
    if (wishlistBtn) {
      const id = wishlistBtn.getAttribute('data-id') || wishlistBtn.closest('.unified-product-card')?.querySelector('.btn-card-add-cart')?.getAttribute('data-id');
      if (!id) return;

      const token = getAccessToken();
      if (!token) {
        showInfoToast('Inicia Sesión', 'Debes iniciar sesión para guardar productos en tu lista de deseos.');
        return;
      }

      wishlistBtn.disabled = true;
      try {
        const res = await alternarFavoritoProducto(id);
        if (res && typeof res.is_favorite === 'boolean') {
          wishlistBtn.classList.toggle('active', res.is_favorite);
          const heartSvg = wishlistBtn.querySelector('svg');
          if (heartSvg) {
            heartSvg.setAttribute('fill', res.is_favorite ? '#ef4444' : 'none');
          }
          wishlistBtn.setAttribute('title', res.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos');
          if (res.is_favorite) {
            showSuccessToast('Lista de Deseos', res.message || 'Producto agregado a tus favoritos.');
          } else {
            showInfoToast('Lista de Deseos', res.message || 'Producto eliminado de tus favoritos.');
          }
        }
      } catch (err) {
        console.error('Error al alternar favorito en home:', err);
        showErrorToast('Error', 'No se pudo actualizar la lista de deseos.');
      } finally {
        wishlistBtn.disabled = false;
      }
      return;
    }

    const btn = e.target.closest('.btn-card-add-cart');
    if (btn) {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      const name = btn.getAttribute('data-name');
      const price = parseFloat(btn.getAttribute('data-price')) || 0;
      const image = btn.getAttribute('data-image');

      const CART_STORAGE_KEY = 'tuestante_cart';
      let items = [];
      try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (raw) items = JSON.parse(raw);
      } catch (err) {
        items = [];
      }

      const existingIndex = items.findIndex(i => String(i.id) === String(id));
      if (existingIndex > -1) {
        items[existingIndex].qty += 1;
      } else {
        items.push({ id, name, price, image, color: 'Estándar', qty: 1 });
      }
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new Event('cart-updated'));
      showCartModal({ id, name, price, image });
    }
  });
});
