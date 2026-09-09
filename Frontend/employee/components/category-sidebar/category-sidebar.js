/**
 * ==========================================================================
 * TUESTANTE - COMPONENTE CATEGORY SIDEBAR
 * ==========================================================================
 * Acordeón dinámico de categorías y subcategorías con checkboxes,
 * interruptor de stock y botón para resetear filtros.
 */

import { obtenerCategorias } from '../../modules/product/product.api.js';

/**
 * Inicializa la barra lateral de categorías.
 * @param {HTMLElement} container Contenedor donde se montará el sidebar
 * @param {Function} onFilterChange Callback al cambiar filtros (recibe { subcategoryIds, inStockOnly })
 */
export async function initCategorySidebar(container, onFilterChange) {
  if (!container) return;

  container.innerHTML = `
    <aside class="category-sidebar" id="category-sidebar-aside" aria-label="Filtros de Catálogo">
      <div class="sidebar-header">
        <h2>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          Filtros
        </h2>
        <button type="button" class="btn-clear-filters" id="btn-clear-all-filters" title="Restablecer todos los filtros">
          Limpiar
        </button>
      </div>

      <!-- Interruptor Solo Stock Disponible -->
      <div class="sidebar-stock-filter">
        <label class="switch-label" for="filter-only-in-stock">
          <span>Solo con stock</span>
          <div class="switch-toggle">
            <input type="checkbox" id="filter-only-in-stock" />
            <span class="switch-slider"></span>
          </div>
        </label>
      </div>

      <!-- Acordeón de Categorías -->
      <div class="accordion-group" id="categories-accordion-container">
        <div style="padding: 1rem; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
          Cargando categorías...
        </div>
      </div>
    </aside>
  `;

  const accordionContainer = container.querySelector('#categories-accordion-container');
  const inStockCheckbox = container.querySelector('#filter-only-in-stock');
  const clearBtn = container.querySelector('#btn-clear-all-filters');

  let selectedSubcategories = new Set();
  let inStockOnly = false;

  function notifyChange() {
    if (typeof onFilterChange === 'function') {
      onFilterChange({
        subcategoryIds: Array.from(selectedSubcategories),
        inStockOnly: inStockOnly
      });
    }
  }

  // Evento Stock
  inStockCheckbox.addEventListener('change', (e) => {
    inStockOnly = e.target.checked;
    notifyChange();
  });

  // Evento Limpiar
  clearBtn.addEventListener('click', () => {
    selectedSubcategories.clear();
    inStockOnly = false;
    inStockCheckbox.checked = false;
    container.querySelectorAll('.subcategory-checkbox').forEach((cb) => {
      cb.checked = false;
    });
    notifyChange();
  });

  // Cargar categorías y subcategorías desde el backend
  try {
    const categories = await obtenerCategorias();

    if (!categories || categories.length === 0) {
      accordionContainer.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
          No hay categorías registradas.
        </div>
      `;
      return;
    }

    accordionContainer.innerHTML = '';

    categories.forEach((cat, index) => {
      const subcats = Array.isArray(cat.subcategories) ? cat.subcategories : [];
      const itemEl = document.createElement('div');
      itemEl.className = `category-accordion-item ${index === 0 ? 'open' : ''}`;

      const subcatsHtml = subcats.map((sub) => `
        <li>
          <label class="subcategory-checkbox-label">
            <input type="checkbox" class="subcategory-checkbox" value="${sub.id}" data-category="${cat.id}" />
            <span>${sub.name}</span>
          </label>
        </li>
      `).join('');

      itemEl.innerHTML = `
        <button type="button" class="accordion-trigger" aria-expanded="${index === 0 ? 'true' : 'false'}">
          <span>${cat.name}</span>
          <svg class="icon-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="accordion-content">
          <ul class="subcategories-list">
            ${subcatsHtml || '<li style="font-size: 0.78rem; color: var(--color-text-muted);">Sin subcategorías</li>'}
          </ul>
        </div>
      `;

      // Toggle Acordeón
      const trigger = itemEl.querySelector('.accordion-trigger');
      trigger.addEventListener('click', () => {
        const isOpen = itemEl.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(isOpen));
      });

      // Checkboxes de subcategoría
      itemEl.querySelectorAll('.subcategory-checkbox').forEach((cb) => {
        cb.addEventListener('change', (e) => {
          const subId = parseInt(e.target.value, 10);
          if (e.target.checked) {
            selectedSubcategories.add(subId);
          } else {
            selectedSubcategories.delete(subId);
          }
          notifyChange();
        });
      });

      accordionContainer.appendChild(itemEl);
    });
  } catch (err) {
    console.error('[CategorySidebar] Error cargando categorías:', err);
    accordionContainer.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: var(--color-danger); font-size: 0.82rem;">
        Error al cargar categorías.
      </div>
    `;
  }
}
