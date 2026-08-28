import { initNavbar } from './components/navbar/navbar.js';
import { initFooter } from './components/footer/footer.js';
import { obtenerCategorias, obtenerTiposProducto, obtenerProductosDestacados, obtenerProductos } from './modules/product/product.api.js';
import { backendOrigin } from './js/config.js';

/**
 * Extrae un arreglo uniforme de resultados de la API (maneja listas simples y respuestas paginadas).
 */
function extractList(apiResult) {
  if (!apiResult) return [];
  if (Array.isArray(apiResult)) return apiResult;
  if (Array.isArray(apiResult.results)) return apiResult.results;
  return [];
}

/**
 * Resuelve la URL completa de una imagen proveniente del backend.
 */
function resolveImageUrl(path, fallback = '') {
  if (!path) return fallback;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = backendOrigin.startsWith('http://') || backendOrigin.startsWith('https://') ? backendOrigin : `http://${backendOrigin}`;
  if (path.startsWith('/')) return `${origin}${path}`;
  return `${origin}/${path}`;
}

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
 * Carga dinámicamente las Categorías desde la API de Django.
 */
async function loadHomeCategories() {
  const container = document.getElementById('home-categories-container');
  if (!container) return;

  try {
    const response = await obtenerCategorias();
    const categories = extractList(response);
    if (categories.length === 0) return;

    container.innerHTML = categories.map(cat => {
      const name = cat.category_name || cat.name || 'Categoría';
      const desc = cat.description || 'Mobiliario metálico seguro y resistente para tus espacios.';
      const img = resolveImageUrl(cat.category_image || cat.image, 'assets/images/categoria/estante.png');
      return `
        <a href="modules/product/products.html?cat=${cat.id}" class="category-card">
          <div class="category-bg" style="background-image: url('${img}');"></div>
          <div class="category-overlay"></div>
          <div class="category-content">
            <h3 class="category-title">${name}</h3>
            <p class="category-desc">${desc}</p>
            <span class="category-btn">Ver Catálogo</span>
          </div>
        </a>
      `;
    }).join('');
  } catch (error) {
    console.error('Error al cargar categorías en el home:', error);
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

    const fallbackTypes = [
      { id: 1, name: 'Lockers', description: 'Lockers metálicos de alta seguridad.', image: 'assets/images/carrusel-index/LocekrL4Gris.jpg' },
      { id: 2, name: 'Estantes', description: 'Estanterías metálicas de gran resistencia.', image: 'assets/images/carrusel-index/Carrousel.png' },
      { id: 3, name: 'Archivadores', description: 'Archivadores metálicos para oficinas.', image: 'assets/images/productos/estante-blanco.jpeg' },
      { id: 4, name: 'Gabinetes', description: 'Gabinetes metálicos para almacenamiento seguro.', image: 'assets/images/productos/locker-verde.jpeg' }
    ];

    if (!types || types.length === 0) {
      types = fallbackTypes;
    } else {
      types = types.map(t => {
        let name = t.product_type_name || t.name || 'Tipo de Producto';
        if (name.trim().toLowerCase() === 'estante') name = 'Estantes';
        return { ...t, name };
      });

      const hasGabinetes = types.some(t => t.name.toLowerCase().includes('gabinete'));
      if (!hasGabinetes) {
        types.push({ id: 4, name: 'Gabinetes', description: 'Gabinetes metálicos para almacenamiento seguro.', image: 'assets/images/productos/locker-verde.jpeg' });
      }

      for (const fb of fallbackTypes) {
        if (types.length >= 4) break;
        if (!types.some(t => t.name.toLowerCase() === fb.name.toLowerCase())) {
          types.push(fb);
        }
      }
      types = types.slice(0, 4);
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
      response = await obtenerProductosDestacados();
    } catch {
      response = await obtenerProductos();
    }
    const products = extractList(response);
    if (products.length === 0) return;

    // Mostrar 6 productos destacados (2 filas de 3 productos)
    let displayProducts = [...products];
    if (displayProducts.length < 6) {
      const initialLen = displayProducts.length;
      let i = 0;
      while (displayProducts.length < 6) {
        displayProducts.push(products[i % initialLen]);
        i++;
      }
    }
    displayProducts = displayProducts.slice(0, 6);

    container.innerHTML = displayProducts.map(prod => {
      const name = prod.product_name || prod.name || 'Producto Destacado';
      const catName = prod.category_detail?.category_name || prod.categoryName || 'General';
      const desc = prod.description || '';
      const price = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price) || 0;
      const img = resolveImageUrl(prod.product_image || prod.image, 'assets/images/productos/estante-blanco.jpeg');

      return `
        <a href="modules/product/product-details.html?id=${prod.id}" class="catalog-product-card" style="text-decoration: none; color: inherit;">
          <div class="catalog-product-img-wrapper">
            <div class="badge-destacado-star" title="Producto Destacado">
              <svg class="star-icon" viewBox="0 0 24 24" fill="#94A3B8" stroke="#64748B" stroke-width="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <span class="star-label">Producto Destacado</span>
            </div>
            <img src="${img}" alt="${name}" class="catalog-product-img">
          </div>
          <div class="catalog-product-body">
            <div>
              <div class="catalog-product-meta">
                <span class="catalog-product-category">${catName}</span>
              </div>
              <h3 class="catalog-product-name">${name}</h3>
              <p class="catalog-product-desc">${desc}</p>
            </div>
            <div class="catalog-product-footer">
              <span class="catalog-product-price">$${price.toFixed(2)}</span>
              <span class="catalog-product-btn">Ver Detalle</span>
            </div>
          </div>
        </a>
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
  loadHomeCategories();
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

