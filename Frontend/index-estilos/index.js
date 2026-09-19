import { initNavbar } from './components/navbar/navbar.js';
import { initFooter } from './components/footer/footer.js';
import { obtenerTiposProducto, obtenerProductosDestacados, obtenerProductos } from './modules/product/product.api.js';
import { obtenerProyectos } from './modules/project/project.api.js';
import { extractList, resolveImageUrl } from './js/api.js';

/**
 * Carga un componente HTML dinámicamente y lo inserta en un contenedor placeholder.
 * @param {string} placeholderId ID del elemento contenedor en el DOM
 * @param {string} filePath Ruta del archivo HTML a cargar
 */
async function loadComponent(placeholderId, filePath) {
  try {
    const response = await fetch(filePath);
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
 * Carga dinámicamente los Tipos de Producto desde la API de Django.
 */
async function loadHomeProductTypes() {
  const container = document.getElementById('home-product-types-container');
  if (!container) return;

  try {
    let types = [];
    try {
      const response = await obtenerTiposProducto();
      types = extractList(response);
    } catch {
      types = [];
    }

    if (!types || types.length === 0) {
      container.innerHTML = `
        <div class="empty-product-types-message" style="grid-column: 1 / -1; text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 1rem;">
          <p>Actualmente no hay tipos de productos disponibles.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = types.map(type => {
      let name = type.product_type_name || type.name || 'Tipo de Producto';
      if (name.trim().toLowerCase() === 'estante') name = 'Estantes';
      const desc = type.description || 'Soluciones profesionales diseñadas para optimizar tus espacios.';
      const img = resolveImageUrl(type.product_type_image || type.image, 'assets/images/carrusel-index/Carrousel.png');

      const typeId = type.id !== undefined && type.id !== null ? type.id : (type.product_type_id || '');
      return `
        <a href="modules/product/products.html?type=${typeId}" class="product-type-card">
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
    container.innerHTML = `
      <div class="empty-product-types-message" style="grid-column: 1 / -1; text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 1rem;">
        <p>Actualmente no hay tipos de productos disponibles.</p>
      </div>
    `;
  }
}

/**
 * Carga dinámicamente los Productos Destacados desde la API de Django.
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
    if (!products || products.length === 0) return;

    // Mostrar hasta 10 productos destacados (2 filas de 5 productos), dejando espacios si hay menos
    let displayProducts = [...products];

    // Prioridad a los más amados / más favoritos primero
    displayProducts.sort((a, b) => {
      const favA = Number(a.favorites_count ?? a.favorite_count ?? 0);
      const favB = Number(b.favorites_count ?? b.favorite_count ?? 0);
      if (favB !== favA) return favB - favA;
      const ratingA = Number(a.rating ?? 0);
      const ratingB = Number(b.rating ?? 0);
      if (ratingB !== ratingA) return ratingB - ratingA;
      return (b.id ?? 0) - (a.id ?? 0);
    });

    displayProducts = displayProducts.slice(0, 10);

    container.innerHTML = displayProducts.map(prod => {
      const name = prod.product_name || prod.name || 'Producto Destacado';
      const price = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price) || 0;
      const img = resolveImageUrl(prod.product_image || prod.image, 'assets/images/gallery/real_space_1.jpg');

      return `
        <div class="catalog-product-card">
          <a href="modules/product/product-details.html?id=${prod.id}" class="catalog-product-img-wrapper">
            <div class="badge-destacado-star" title="Producto Destacado">
              <svg class="star-icon" viewBox="0 0 24 24" fill="#94A3B8" stroke="#64748B" stroke-width="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <span class="star-label">Producto Destacado</span>
            </div>
            <img src="${img}" alt="${name}" class="catalog-product-img">
          </a>
          <div class="catalog-product-body">
            <div>
              <h3 class="catalog-product-name">
                <a href="modules/product/product-details.html?id=${prod.id}" style="color: inherit; text-decoration: none;">${name}</a>
              </h3>
            </div>
            <div class="catalog-product-footer">
              <span class="catalog-product-price">$${price.toFixed(2)}</span>
              <a href="modules/product/product-details.html?id=${prod.id}" class="catalog-product-btn">Ver Detalle</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error al cargar productos destacados en el home:', error);
  }
}

/**
 * Inicializa el carrusel de imágenes interactivo.
 */
function initCarousel() {
  const container = document.querySelector('.carousel-container');
  if (!container) return;

  const dotsContainer = container.querySelector('#carousel-dots');
  const prevBtn = container.querySelector('#carousel-prev');
  const nextBtn = container.querySelector('#carousel-next');

  let currentSlide = 0;
  let timer = null;
  const slideDuration = 5000; // Cambio automático cada 5 segundos

  function getVisibleSlides() {
    const isMobile = window.innerWidth < 600;
    if (isMobile) {
      const mobSlides = Array.from(container.querySelectorAll('.carousel-slide.mobile-slide'));
      if (mobSlides.length > 0) {
        return mobSlides;
      }
    }
    return Array.from(container.querySelectorAll('.carousel-slide.desktop-slide'));
  }

  function renderDots(slides) {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = slides.map((_, i) =>
      `<span class="carousel-dot ${i === currentSlide ? 'active' : ''}" data-index="${i}"></span>`
    ).join('');

    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        if (!isNaN(index) && index !== currentSlide) {
          showSlide(index);
          startAutoplay();
        }
      });
    });
  }

  function updateCarouselState() {
    const slides = getVisibleSlides();
    if (slides.length === 0) return;

    if (currentSlide >= slides.length) {
      currentSlide = 0;
    }

    container.querySelectorAll('.carousel-slide').forEach(s => s.classList.remove('active'));
    if (slides[currentSlide]) {
      slides[currentSlide].classList.add('active');
    }

    renderDots(slides);
  }

  function showSlide(index) {
    const slides = getVisibleSlides();
    if (slides.length === 0) return;

    let targetIndex = index;
    if (index >= slides.length) targetIndex = 0;
    if (index < 0) targetIndex = slides.length - 1;

    currentSlide = targetIndex;
    updateCarouselState();
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

  // Soporte de gestos táctiles (Swipe) para teléfonos y tablets
  let touchStartX = 0;
  let touchEndX = 0;

  container.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const swipeThreshold = 40;
    if (touchEndX < touchStartX - swipeThreshold) {
      nextSlide();
      startAutoplay();
    } else if (touchEndX > touchStartX + swipeThreshold) {
      prevSlide();
      startAutoplay();
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    updateCarouselState();
  });

  updateCarouselState();
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
  loadHomeProductTypes();

  // Añadir por defecto la clase de drawer cerrado para ajustar el layout del footer
  document.body.classList.add('drawer-collapsed');

  // Desplazamiento suave si la URL contiene ancla (#contacto o #ayuda)
  if (window.location.hash) {
    const rawHash = window.location.hash.substring(1);
    const targetSection = document.getElementById(rawHash) || (rawHash === 'contacto' || rawHash === 'contactos' ? document.getElementById('contacto') : null);
    if (targetSection) {
      setTimeout(() => {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }, 350);
    }
  }
});

