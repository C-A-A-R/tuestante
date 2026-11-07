/**
 * ==========================================================================
 * TUESTANTE - CONTROLADOR PRINCIPAL DEL CATÁLOGO DE EMPLEADOS
 * ==========================================================================
 */

import { initNavbar } from './components/navbar/navbar.js';
import { initFooter } from './components/footer/footer.js';
import { initCategorySidebar } from './components/category-sidebar/category-sidebar.js';
import { createProductCard } from './components/product-card/product-card.js';
import { obtenerProductos } from './modules/product/product.api.js';

async function loadComponent(placeholderId, filePath) {
  try {
    const res = await fetch(`${filePath}?_t=${Date.now()}`);
    if (res.ok) {
      document.getElementById(placeholderId).innerHTML = await res.text();
    }
  } catch (err) {
    console.error(`Error cargando componente ${filePath}:`, err);
  }
}

// Filtros Activos del Catálogo
let currentFilters = {
  search: '',
  subcategoryIds: [],
  inStockOnly: false
};

/**
 * Renderiza los esqueletos de carga con fondo --color-bg-soft
 */
function showSkeletonLoaders() {
  const grid = document.getElementById('products-grid');
  const emptyState = document.getElementById('catalog-empty-state');
  if (!grid) return;

  if (emptyState) emptyState.style.display = 'none';
  grid.style.display = 'grid';

  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text-short"></div>
      <div class="skeleton skeleton-button"></div>
    </div>
  `).join('');
}

/**
 * Carga los productos desde el endpoint de Django admitiendo query params:
 * search, subcategory_id, in_stock.
 */
async function fetchAndRenderProducts() {
  showSkeletonLoaders();

  const grid = document.getElementById('products-grid');
  const emptyState = document.getElementById('catalog-empty-state');
  const subtitle = document.getElementById('catalog-subtitle');

  const params = { is_active: true };

  if (currentFilters.search) {
    params.search = currentFilters.search;
  }

  if (currentFilters.inStockOnly) {
    params.in_stock = true;
  }

  // Si hay una sola subcategoría seleccionada, pasarla por query param
  if (currentFilters.subcategoryIds.length === 1) {
    params.subcategory_id = currentFilters.subcategoryIds[0];
  }

  try {
    let products = await obtenerProductos(params);

    // Filtrado en memoria si hay múltiples subcategorías seleccionadas
    if (currentFilters.subcategoryIds.length > 1) {
      products = products.filter((p) => {
        const subId = p.subcategory || p.subcategory_id;
        return currentFilters.subcategoryIds.includes(subId);
      });
    }

    if (currentFilters.inStockOnly) {
      products = products.filter((p) => (parseInt(p.stock, 10) || 0) > 0);
    }

    if (products.length === 0) {
      grid.style.display = 'none';
      emptyState.style.display = 'flex';
      if (subtitle) subtitle.textContent = '0 artículos encontrados.';
      return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = '';

    products.forEach((prod) => {
      const card = createProductCard(prod);
      grid.appendChild(card);
    });

    if (subtitle) {
      subtitle.textContent = `Mostrando ${products.length} ${products.length === 1 ? 'artículo disponible' : 'artículos disponibles'} para consumo interno.`;
    }

  } catch (err) {
    console.error('[Catalog] Error cargando productos:', err);
    grid.style.display = 'none';
    emptyState.style.display = 'flex';
    emptyState.querySelector('h3').textContent = 'Error al consultar catálogo';
    emptyState.querySelector('p').textContent = 'No se pudo conectar con el servidor de la tienda. Intenta nuevamente.';
  }
}

/**
 * Escucha y vincula eventos de búsqueda y filtros
 */
function setupEvents() {
  // Búsqueda desde el Navbar (evento personalizado con debounce de 300ms)
  window.addEventListener('catalog:search', (e) => {
    currentFilters.search = e.detail?.query || '';
    fetchAndRenderProducts();
  });

  // Botón Restablecer Filtros
  const btnReset = document.getElementById('btn-reset-catalog-filters');
  btnReset?.addEventListener('click', () => {
    currentFilters.search = '';
    currentFilters.subcategoryIds = [];
    currentFilters.inStockOnly = false;

    // Resetear input de navbar
    const searchInput = document.getElementById('navbar-search-input');
    if (searchInput) searchInput.value = '';

    // Disparar click en limpiar filtros del sidebar
    document.getElementById('btn-clear-all-filters')?.click();

    fetchAndRenderProducts();
  });

  // Botón toggle filtros en móvil
  const mobileToggleBtn = document.getElementById('btn-toggle-mobile-filters');
  mobileToggleBtn?.addEventListener('click', () => {
    const sidebar = document.getElementById('category-sidebar-aside');
    sidebar?.classList.toggle('mobile-open');
    const isOpen = sidebar?.classList.contains('mobile-open');
    mobileToggleBtn.querySelector('span').textContent = isOpen ? 'Ocultar Filtros' : 'Mostrar Filtros';
  });
}

// Inicialización global
async function initApp() {
  // Renderizar Navbar y Footer directamente sin bloqueos de red
  initNavbar('navbar-placeholder');
  initFooter('footer-placeholder');

  // Inicializar CategorySidebar
  const sidebarContainer = document.getElementById('sidebar-container');
  await initCategorySidebar(sidebarContainer, (filterState) => {
    currentFilters.subcategoryIds = filterState.subcategoryIds || [];
    currentFilters.inStockOnly = Boolean(filterState.inStockOnly);
    fetchAndRenderProducts();
  });

  setupEvents();

  // Si la URL traía un parámetro ?search=... inicial
  const urlParams = new URLSearchParams(window.location.search);
  const initialSearch = urlParams.get('search');
  if (initialSearch) {
    currentFilters.search = initialSearch;
  }

  fetchAndRenderProducts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
