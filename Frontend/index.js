import { initNavbar } from './components/navbar/navbar.js';
import { initFooter } from './components/footer/footer.js';
import { obtenerTiposProducto, obtenerProductosDestacados, obtenerProductos, obtenerProductosOutlet, alternarFavoritoProducto } from './modules/product/product.api.js';
import { obtenerProyectos } from './modules/project/project.api.js';
import { extractList, resolveImageUrl } from './js/api.js';
import { getAccessToken } from './js/storage.js';
import { showCartModal } from './components/cart-modal/cart-modal.js';
import { showSuccessToast, showInfoToast, showErrorToast } from './components/toast/toast.js';

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
    const container = document.getElementById(placeholderId);
    if (container) {
      container.innerHTML = html;
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

    container.innerHTML = outletProducts.slice(0, 4).map((prod, idx) => {
      const id = prod.id;
      const name = prod.product_name || prod.name || 'Producto Outlet';
      const desc = prod.description || 'Oportunidad única en mobiliario metálico con entrega inmediata.';
      const price = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price) || 0;
      const img = resolveImageUrl(prod.product_image || prod.image, 'assets/images/productos/estante-blanco.jpeg');
      const qty = prod.quantity !== undefined ? prod.quantity : 1;
      const link = `modules/product/product-details.html?id=${id}`;

      return `
        <div class="unified-product-card" data-index="${idx}">
          <div class="unified-card-media">
            <a href="${link}" class="unified-card-img-link">
              <img src="${img}" alt="${name}" class="unified-card-img" loading="lazy">
            </a>
            
            <div class="badge-outlet-tag" title="Stock disponible para entrega inmediata">
              <span>⚡ OUTLET (${qty} disp.)</span>
            </div>
            
            <button class="unified-wishlist-btn ${prod.is_favorite ? 'active' : ''}" data-id="${id}" title="${prod.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos'}" aria-label="Añadir a favoritos">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>

          <div class="unified-card-body">
            <div>
              <div class="unified-card-header">
                <h3 class="unified-card-title">
                  <a href="${link}">${name}</a>
                </h3>
                <span class="unified-card-price">$${price.toFixed(2)}</span>
              </div>

              <p class="unified-card-desc">${desc}</p>
            </div>

            <div class="unified-card-actions">
              <a href="${link}" class="unified-btn btn-details">Ver Detalle</a>
              <button class="unified-btn btn-card-add-cart" data-id="${id}" data-name="${name}" data-price="${price}" data-image="${img}">
                + Carrito
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.warn('Error al consultar productos outlet o no disponibles:', error);
    outletSection.style.display = 'none';
    container.innerHTML = '';
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
 * Carga dinámicamente el Carrusel de Productos Destacados desde la API de Django con Scroll Táctil.
 */
async function loadHomeFeaturedProducts() {
  const track = document.getElementById('home-featured-products-container');
  const viewport = document.getElementById('home-featured-carousel-viewport');

  if (!track || !viewport) return;

  try {
    let response;
    try {
      response = await obtenerProductosDestacados();
    } catch {
      response = await obtenerProductos();
    }
    const products = extractList(response);
    if (!products || products.length === 0) {
      track.innerHTML = createApiEmptyFeedback('No hay productos destacados registrados en este momento.', 'Consulta nuestro catálogo completo para ver todas las opciones.');
      return;
    }

    track.innerHTML = products.map((prod, idx) => {
      const id = prod.id;
      const name = prod.product_name || prod.name || 'Producto Destacado';
      const desc = prod.description || 'Estructura metálica de alta durabilidad y resistencia para optimizar tus espacios.';
      const price = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price) || 0;
      const img = resolveImageUrl(prod.product_image || prod.image, 'assets/images/productos/estante-blanco.jpeg');
      const isFeatured = !!(prod.rating === 5.0 || prod.badge === 'Destacado' || prod.is_feature_product !== false);
      const link = `modules/product/product-details.html?id=${id}`;

      const starBadgeHTML = isFeatured ? `
        <div class="badge-destacado-star" title="Producto Destacado">
          <svg class="star-icon" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span class="star-label">Producto Destacado</span>
        </div>
      ` : '';

      return `
        <div class="unified-product-card" data-index="${idx}">
          <div class="unified-card-media">
            <a href="${link}" class="unified-card-img-link">
              <img src="${img}" alt="${name}" class="unified-card-img" loading="lazy">
            </a>
            
            ${starBadgeHTML}
            
            <button class="unified-wishlist-btn ${prod.is_favorite ? 'active' : ''}" data-id="${id}" title="${prod.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos'}" aria-label="Añadir a favoritos">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>

          <div class="unified-card-body">
            <div>
              <div class="unified-card-header">
                <h3 class="unified-card-title">
                  <a href="${link}">${name}</a>
                </h3>
                <span class="unified-card-price">$${price.toFixed(2)}</span>
              </div>

              <p class="unified-card-desc">${desc}</p>

              <div class="unified-card-swatches">
                <span class="swatch-dot" style="background-color: #ea580c;" title="Naranja"></span>
                <span class="swatch-dot" style="background-color: #0f172a;" title="Gris Oscuro"></span>
                <span class="swatch-dot" style="background-color: #15803d;" title="Verde Sabana"></span>
                <span class="swatch-dot" style="background-color: #005187;" title="Azul"></span>
                <span class="swatch-more">+4</span>
              </div>
            </div>

            <div class="unified-card-actions">
              <a href="${link}" class="unified-btn btn-details">Ver Detalle</a>
              <button class="unified-btn btn-card-add-cart" data-id="${id}" data-name="${name}" data-price="${price}" data-image="${img}">
                + Carrito
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Soporte para arrastrar con el ratón en escritorio (Mouse Drag Scroll)
    let isMouseDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let isDragging = false;

    viewport.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      isDragging = false;
      startX = e.pageX - viewport.offsetLeft;
      scrollLeft = viewport.scrollLeft;
      viewport.classList.add('is-dragging');
    });

    viewport.addEventListener('mouseleave', () => {
      isMouseDown = false;
      viewport.classList.remove('is-dragging');
    });

    viewport.addEventListener('mouseup', () => {
      isMouseDown = false;
      setTimeout(() => {
        isDragging = false;
        viewport.classList.remove('is-dragging');
      }, 50);
    });

    viewport.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      e.preventDefault();
      const x = e.pageX - viewport.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 5) {
        isDragging = true;
      }
      viewport.scrollLeft = scrollLeft - walk;
    });

    // Prevenir clic accidental si el usuario estaba arrastrando
    viewport.addEventListener('click', (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

  } catch (error) {
    console.error('Error al cargar carrusel de productos destacados en el home:', error);
    track.innerHTML = createApiErrorFeedback('No se pudieron cargar los productos destacados.', 'Por favor, intenta de nuevo más tarde.');
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
 * Carga dinámicamente 8 imágenes desde la API del backend Django para el carrusel de Espacios Reales en la portada.
 */
async function loadHomeRealSpacesGallery() {
  const track = document.getElementById('real-spaces-track');
  if (!track) return;

  try {
    let rawItems = [];
    // 1. Intentar obtener la lista de proyectos desde el backend
    try {
      const projResp = await obtenerProyectos();
      rawItems = extractList(projResp);
    } catch (e) {
      console.warn('Advertencia al consultar proyectos backend para el carrusel:', e);
    }

    // 2. Si hay menos de 8 elementos, complementar con productos del backend
    if (rawItems.length < 8) {
      try {
        const prodResp = await obtenerProductos();
        const prodItems = extractList(prodResp);
        rawItems = [...rawItems, ...prodItems];
      } catch (e) {
        console.warn('Advertencia al consultar productos backend para el carrusel:', e);
      }
    }

    // 3. Mapear los datos traídos del backend resolviendo las URLs completas de las imágenes
    let galleryItems = rawItems.map((item, idx) => {
      const title = item.project_name || item.product_name || item.name || `Espacio Real ${idx + 1}`;
      const imgPath = item.project_images || item.product_image || item.image || item.category_image;
      const imgUrl = resolveImageUrl(imgPath, `assets/images/gallery/real_space_${(idx % 6) + 1}.jpg`);
      return { title, imgUrl };
    });

    // 4. Respaldos visuales del sistema en caso de que la base de datos backend no tenga suficientes fotos cargadas
    const fallbackImages = [
      'assets/images/gallery/real_space_1.jpg',
      'assets/images/gallery/real_space_2.jpg',
      'assets/images/gallery/real_space_3.jpg',
      'assets/images/gallery/real_space_4.jpg',
      'assets/images/gallery/real_space_5.jpg',
      'assets/images/gallery/real_space_6.jpg',
      'assets/images/gallery/real_space_7.jpg',
      'assets/images/gallery/real_space_8.jpg',
      'assets/images/gallery/real_space_9.jpg',
      'assets/images/gallery/real_space_10.jpg',
      'assets/images/gallery/real_space_11.jpg',
      'assets/images/carrusel-index/LocekrL4Gris.jpg'
    ];

    let fallbackIdx = 0;
    while (galleryItems.length < 8) {
      galleryItems.push({
        title: `Espacio Real TuEstante ${galleryItems.length + 1}`,
        imgUrl: fallbackImages[fallbackIdx % fallbackImages.length]
      });
      fallbackIdx++;
    }

    // Asegurar exactamente 8 imágenes mostrándose 3 a la vez
    galleryItems = galleryItems.slice(0, 8);

    // Inyectar las 8 tarjetas en el DOM de la pista del carrusel
    track.innerHTML = galleryItems.map(item => `
      <div class="real-spaces-card">
        <img src="${item.imgUrl}" alt="${item.title}" class="real-spaces-img" loading="lazy">
      </div>
    `).join('');

    // Re-inicializar controles de navegación del carrusel de 8 imágenes
    initRealSpacesSlider();
  } catch (error) {
    console.error('Error al cargar la galería de 8 imágenes en portada:', error);
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
