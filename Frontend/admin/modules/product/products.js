/**
 * ==========================================================================
 * CONTROLADOR - MÓDULO DE PRODUCTOS (PRODUCTS.JS) - TUESTANTE OMS
 * Manejo de listado, filtros reactivos, acordeón de variantes (Ángulos y Colores),
 * vista previa de medios, métricas superiores y menú contextual de 3 puntos.
 * ==========================================================================
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { 
  getProducts, 
  getProduct, 
  deleteProduct, 
  toggleProductActive, 
  toggleProductOutlet,
  getProductTypes, 
  getProductMetrics 
} from './product.api.js';

// Estado local del módulo
const state = {
  products: [],
  metrics: null,
  productTypes: [],
  filters: {
    search: '',
    type: 'all',
    featured: 'all',
    outlet: 'all',
    status: 'all'
  },
  pagination: {
    currentPage: 1,
    itemsPerPage: 6,
    totalItems: 0
  },
  activePopoverId: null
};

const COLOR_NAME_MAP = {
  'blanco': '#ffffff', 'white': '#ffffff', 'negro': '#111827', 'black': '#111827',
  'gris': '#9ca3af', 'gris claro': '#d1d5db', 'gris oscuro': '#4b5563', 'gray': '#9ca3af',
  'roble': '#b48a56', 'roble nórdico': '#c29b68', 'madera': '#a0714f', 'marron': '#78350f',
  'café': '#652d0d', 'azul': '#0272bc', 'azul rey': '#0272bc', 'azul oscuro': '#3d5ead',
  'morado': '#702c91', 'fuccia': '#b6217f', 'fucsia': '#b6217f', 'rojo': '#ef1c25',
  'naranja': '#f15a21', 'amarillo': '#fff300', 'turqueza': '#00a28a', 'turquesa': '#00a28a',
  'verde pasto': '#4eb043', 'verde': '#9ec536', 'mostaza': '#ffc20f', 'rosado': '#f472b6',
  'rosa': '#f472b6'
};

function resolveColorHex(name, variants = []) {
  if (!name) return '#ffffff';
  const clean = String(name).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean;
  if (/^#[0-9a-f]{3}$/i.test(clean)) {
    return '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
  }
  if (COLOR_NAME_MAP[clean]) return COLOR_NAME_MAP[clean];
  if (Array.isArray(variants)) {
    const matched = variants.find(v => (v.color_name || '').toLowerCase() === clean);
    if (matched && matched.color_hex) return matched.color_hex;
  }
  return '#cbd5e1';
}

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar componentes (Navbar + Drawer + Footer)
  await loadAdminComponents({ title: 'Productos' });
  highlightDrawerLink();

  // 2. Vincular eventos de filtros y modales
  setupFilterEvents();
  setupModalEvents();
  setupGlobalClickEvents();

  // 3. Cargar datos iniciales
  await Promise.all([
    loadProductMetrics(),
    loadProductTypesData(),
    loadProductsData()
  ]);
});

/**
 * Resalta la pestaña de Productos en el Drawer lateral
 */
function highlightDrawerLink() {
  setTimeout(() => {
    document.querySelectorAll('.drawer-link, .drawer-submenu-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-nav-id') === 'productos') {
        link.classList.add('active');
      }
    });

    // Abrir submenú de productos si existe
    const submenu = document.getElementById('submenu-productos');
    const toggle = document.querySelector('[aria-controls="submenu-productos"]');
    if (submenu && toggle) {
      submenu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  }, 200);
}

// ==========================================================================
// CARGA DE DATOS Y MÉTRICAS
// ==========================================================================

async function loadProductMetrics() {
  try {
    const m = await getProductMetrics();
    state.metrics = m;

    const elTotal = document.getElementById('kpi-total-products');
    const elFeatured = document.getElementById('kpi-featured-products');
    const elFavorites = document.getElementById('kpi-favorites-products');
    const elActive = document.getElementById('kpi-active-products');
    const elInactive = document.getElementById('kpi-inactive-products');
    const elOutlet = document.getElementById('kpi-outlet-products');

    if (elTotal) elTotal.textContent = m.total;
    if (elFeatured) elFeatured.textContent = m.featured;
    if (elFavorites) elFavorites.textContent = m.favorites;
    if (elActive) elActive.textContent = m.active;
    if (elInactive) elInactive.textContent = m.inactive;
    if (elOutlet) elOutlet.textContent = m.outlet;
  } catch (err) {
    console.error('Error al cargar métricas de productos:', err);
  }
}

async function loadProductTypesData() {
  try {
    const types = await getProductTypes();
    state.productTypes = types;

    // Poblar select de filtro de tipo
    const filterSelect = document.getElementById('filter-type');
    if (filterSelect && types.length > 0) {
      const currentVal = filterSelect.value;
      filterSelect.innerHTML = `
        <option value="all">Todos los tipos</option>
        ${types.map(t => `<option value="${escapeHtml(t.product_type_name)}">${escapeHtml(t.product_type_name)}</option>`).join('')}
      `;
      filterSelect.value = currentVal || 'all';
    }

    // Modal tipos
    const typeContainer = document.getElementById('types-list-container');
    if (typeContainer) {
      typeContainer.innerHTML = types.map(t => `
        <div class="type-item-card">
          <div>
            <strong>${escapeHtml(t.product_type_name)}</strong>
            <small style="display: block;">${escapeHtml(t.description || 'Sin descripción')}</small>
          </div>
          <span class="category-badge">${t.count || 0} productos</span>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error al cargar tipos de productos:', err);
  }
}

async function loadProductsData() {
  try {
    const data = await getProducts(state.filters);
    state.products = data;
    renderProductsTable();
    renderPagination();
  } catch (err) {
    console.error('Error al cargar productos:', err);
  }
}

// ==========================================================================
// RENDERIZADO DE TABLA (SIN SKU, SIN STOCK, CON OUTLET Y ACORDEÓN)
// ==========================================================================

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  closeActivePopover();

  const total = state.products.length;
  state.pagination.totalItems = total;

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No se encontraron productos que coincidan con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  const startIdx = (state.pagination.currentPage - 1) * state.pagination.itemsPerPage;
  const endIdx = startIdx + state.pagination.itemsPerPage;
  const pagedProducts = state.products.slice(startIdx, endIdx);

  tbody.innerHTML = pagedProducts.map(p => {
    const anglesCount = (p.angle_images || []).length;
    const hasVideo = !!p.product_video;
    const statusClass = p.is_active ? 'status-active' : 'status-inactive';
    const statusLabel = p.is_active ? 'Activo' : 'Inactivo';

    // Sub-tabla de Ángulos (Click para Pantalla Completa)
    const anglesRows = (p.angle_images || []).map(a => `
      <tr>
        <td style="width: 54px;">
          <button 
            type="button" 
            class="media-preview-btn btn-preview-image variant-thumb-btn" 
            data-img-src="${escapeHtml(a.image)}" 
            data-title="${escapeHtml(p.product_name)} — ${escapeHtml(a.angle)}" 
            title="Ver imagen en pantalla completa">
            <img class="variant-img-thumb" src="${escapeHtml(a.image)}" alt="${escapeHtml(a.angle)}" onerror="this.src='../../assets/images/logo.jpeg'">
          </button>
        </td>
        <td>
          <strong style="color: var(--text-main); font-size: 0.82rem;">${escapeHtml(a.angle)}</strong>
        </td>
      </tr>
    `).join('');

    // Sub-tabla de Colores (Color Principal de Portada + Variantes)
    const baseColorName = (p.main_color || p.color_principal || '').trim();
    const allColorsList = [];
    if (baseColorName) {
      allColorsList.push({
        color_name: baseColorName,
        color_hex: resolveColorHex(baseColorName, p.color_images),
        color_image: p.product_image,
        isBase: true
      });
    }
    (p.color_images || []).forEach(c => {
      const vName = (c.color_name || 'Variante').trim();
      const vImg = c.color_image || c.image;
      const isDuplicate = baseColorName && vImg === p.product_image && vName.toLowerCase() === baseColorName.toLowerCase();
      if (!isDuplicate) {
        allColorsList.push({
          color_name: vName,
          color_hex: c.color_hex || '#0272bc',
          color_image: vImg,
          isBase: false
        });
      }
    });

    const colorsCount = allColorsList.length;

    const colorsRows = allColorsList.map(c => `
      <tr>
        <td style="width: 54px;">
          <button 
            type="button" 
            class="media-preview-btn btn-preview-image variant-thumb-btn" 
            data-img-src="${escapeHtml(c.color_image)}" 
            data-title="${escapeHtml(p.product_name)} — ${c.isBase ? 'Color Base: ' : 'Color: '}${escapeHtml(c.color_name)}" 
            title="Ver imagen en pantalla completa">
            <img class="variant-img-thumb" src="${escapeHtml(c.color_image)}" alt="${escapeHtml(c.color_name)}" onerror="this.src='../../assets/images/logo.jpeg'">
          </button>
        </td>
        <td style="width: 40px; text-align: center;">
          <span class="color-swatch-box" style="background-color: ${escapeHtml(c.color_hex)};" title="${escapeHtml(c.color_name)}"></span>
        </td>
        <td>
          <strong style="color: var(--text-main); font-size: 0.82rem;">${escapeHtml(c.color_name)}</strong>
          ${c.isBase ? '<span style="font-size: 0.68rem; color: #0284c7; background: #e0f2fe; padding: 1px 6px; border-radius: 10px; margin-left: 6px; font-weight: 700;">Base Portada</span>' : ''}
        </td>
        <td>
          <span class="hex-code-badge">${escapeHtml(c.color_hex)}</span>
        </td>
      </tr>
    `).join('');

    return `
      <!-- Fila Principal del Producto -->
      <tr class="product-row" id="product-row-${p.id}">
        <!-- 1. Producto (Miniatura con Pantalla Completa + Nombre + Descripción) -->
        <td>
          <div class="product-cell">
            <button 
              type="button" 
              class="product-thumb-btn btn-preview-image" 
              data-img-src="${escapeHtml(p.product_image)}" 
              data-title="${escapeHtml(p.product_name)}" 
              title="Ampliar imagen a pantalla completa">
              <img class="product-thumb" src="${escapeHtml(p.product_image)}" alt="${escapeHtml(p.product_name)}" onerror="this.src='../../assets/images/logo.jpeg'">
              <span class="thumb-zoom-overlay" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <polyline points="9 21 3 21 3 15"></polyline>
                  <line x1="21" y1="3" x2="14" y2="10"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
              </span>
            </button>
            <div class="product-meta">
              <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                <span class="product-name">${escapeHtml(p.product_name)}</span>
                ${p.is_feature_product ? `<span class="badge-featured" title="Producto Destacado">⭐ Destacado</span>` : ''}
                ${(p.favorites_count && p.favorites_count > 0) ? `<span class="badge-favorites" title="${p.favorites_count} personas lo tienen en favoritos/deseados">❤️ ${p.favorites_count}</span>` : ''}
              </div>
              <span class="product-desc" title="${escapeHtml(p.description)}">${escapeHtml(p.description || 'Mobiliario modular')}</span>
            </div>
          </div>
        </td>

        <!-- 2. Tipo de Producto -->
        <td>
          <span class="category-badge">${escapeHtml(p.product_type)}</span>
        </td>

        <!-- 3. Precio -->
        <td class="product-price-cell">
          $${p.price.toFixed(2)}
        </td>

        <!-- 4. Cantidad (Stock disponible) -->
        <td style="text-align: center;">
          <span class="stock-badge ${p.quantity > 10 ? 'stock-ok' : (p.quantity > 0 ? 'stock-low' : 'stock-zero')}" 
                title="${p.quantity > 0 ? `${p.quantity} unidades en inventario` : 'Sin unidades en inventario'}">
            ${p.quantity > 0 ? `${p.quantity} unid.` : '0 unid.'}
          </span>
        </td>

        <!-- 5. Outlet -->
        <td style="text-align: center;">
          ${p.is_outlet ? `
            <span class="outlet-badge-tag" style="display: inline-block; padding: 3px 8px; font-size: 0.72rem; font-weight: 700; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 9999px;">
              OUTLET
            </span>
          ` : `
            <span style="color: var(--text-muted); font-size: 0.85rem;">—</span>
          `}
        </td>

        <!-- 6. Ángulos (Botón con Contador y Desplegable) -->
        <td style="text-align: center;">
          <button 
            type="button" 
            class="btn-variant-badge btn-toggle-angles" 
            data-product-id="${p.id}"
            title="Ver perspectivas y ángulos">
            <span>${anglesCount}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </td>

        <!-- 7. Colores (Botón con Contador y Desplegable) -->
        <td style="text-align: center;">
          <button 
            type="button" 
            class="btn-variant-badge btn-toggle-colors" 
            data-product-id="${p.id}"
            title="Ver acabados y variantes de color">
            <span>${colorsCount}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </td>

        <!-- 8. Video (Click para Reproducir) -->
        <td style="text-align: center;">
          ${hasVideo ? `
            <button 
              type="button" 
              class="media-preview-btn btn-preview-video" 
              data-video-src="${escapeHtml(p.product_video)}" 
              data-title="${escapeHtml(p.product_name)}" 
              title="Reproducir video de muestra">
              <svg class="media-video-icon" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          ` : `
            <span class="media-empty-badge">—</span>
          `}
        </td>

        <!-- 9. Estado -->
        <td style="text-align: center;">
          <button type="button" class="status-pill status-toggle-btn btn-toggle-active ${statusClass}" data-product-id="${p.id}" title="Click para ${p.is_active ? 'desactivar' : 'activar'} este producto">
            <span class="status-dot"></span>
            <span>${statusLabel}</span>
          </button>
        </td>

        <!-- 10. Acciones (Ojo, Lápiz, 3 Puntos) -->
        <td style="text-align: right;">
          <div class="table-actions-cell">
            <!-- Botón Ojo (Ver Detalle en nueva pestaña o modal) -->
            <a 
              href="./product-detail.html?id=${encodeURIComponent(p.id)}" 
              class="btn-table-action" 
              title="Ver especificaciones" 
              aria-label="Ver especificaciones de ${escapeHtml(p.product_name)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </a>

            <!-- Botón Lápiz (Editar Producto) -->
            <a 
              href="./product-detail.html?id=${encodeURIComponent(p.id)}&edit=true" 
              class="btn-table-action" 
              title="Editar producto" 
              aria-label="Editar ${escapeHtml(p.product_name)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </a>

            <!-- Botón 3 Puntos (Más Opciones) -->
            <button 
              type="button" 
              class="btn-table-action btn-product-menu" 
              data-product-id="${p.id}" 
              title="Más opciones">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>

            <!-- Popover flotante del menú de 3 puntos -->
            <div class="action-popover" id="popover-${p.id}">
              <!-- Opción: Poner Inactivo / Activo -->
              <button type="button" class="popover-item btn-toggle-active" data-product-id="${p.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  ${p.is_active ? `
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  ` : `
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="9 12 11 14 15 10"></polyline>
                  `}
                </svg>
                <span>${p.is_active ? 'Poner inactivo' : 'Poner activo'}</span>
              </button>

              <!-- Opción: Alternar Outlet -->
              <button type="button" class="popover-item btn-toggle-outlet" data-product-id="${p.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span>${p.is_outlet ? 'Quitar de Outlet' : 'Marcar como Outlet'}</span>
              </button>

              <!-- Opción: Eliminar Producto -->
              <button type="button" class="popover-item popover-item-danger btn-delete-product" data-product-id="${p.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Eliminar producto</span>
              </button>
            </div>
          </div>
        </td>
      </tr>

      <!-- Fila Acordeón Expandible para Variantes -->
      <tr class="product-accordion-row" id="accordion-row-${p.id}">
        <td colspan="10" style="padding: 0;">
          <div class="accordion-container">
            <!-- Sub-tabla 1: Ángulos (Perspectivas) -->
            <div class="accordion-box">
              <div class="accordion-box-title">
                <span>Ángulos de Vista (${anglesCount})</span>
                <small style="color: var(--text-muted); font-weight: normal;">Perspectivas fotográficas</small>
              </div>
              <table class="variant-subtable">
                <thead>
                  <tr>
                    <th>Imagen</th>
                    <th>Ángulo / Vista</th>
                  </tr>
                </thead>
                <tbody>
                  ${anglesRows || '<tr><td colspan="2" style="color: var(--text-muted); text-align: center;">Sin ángulos registrados</td></tr>'}
                </tbody>
              </table>
            </div>

            <!-- Sub-tabla 2: Colores (Foto Real + Muestra Visual + Nombre + Hex) -->
            <div class="accordion-box">
              <div class="accordion-box-title">
                <span>Variantes de Color (${colorsCount})</span>
                <small style="color: var(--text-muted); font-weight: normal;">Foto real y muestra de color</small>
              </div>
              <table class="variant-subtable">
                <thead>
                  <tr>
                    <th>Imagen</th>
                    <th style="text-align: center;">Color</th>
                    <th>Nombre del color</th>
                    <th>Hexadecimal</th>
                  </tr>
                </thead>
                <tbody>
                  ${colorsRows || '<tr><td colspan="4" style="color: var(--text-muted); text-align: center;">Sin colores registrados</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Vincular eventos interactivos de las filas
  attachTableEventListeners();
}

/**
 * Asigna eventos a los botones de la tabla
 */
function attachTableEventListeners() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  // 1. Toggle Acordeón Ángulos y Colores
  tbody.querySelectorAll('.btn-toggle-angles, .btn-toggle-colors').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-product-id');
      toggleAccordionRow(id, btn);
    });
  });

  // 2. Previsualizar Imagen Principal
  tbody.querySelectorAll('.btn-preview-image').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const src = btn.getAttribute('data-img-src');
      const title = btn.getAttribute('data-title') || 'Vista previa';
      openImagePreviewModal(src, title);
    });
  });

  // 3. Previsualizar Video de Muestra
  tbody.querySelectorAll('.btn-preview-video').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const src = btn.getAttribute('data-video-src');
      const title = btn.getAttribute('data-title') || 'Video de muestra';
      openVideoPreviewModal(src, title);
    });
  });

  // 4. Menú Contextual 3 Puntos
  tbody.querySelectorAll('.btn-product-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-product-id');
      togglePopover(id);
    });
  });

  // 5. Acción: Poner Activo / Inactivo (desde menú 3 puntos o píldora de estado)
  tbody.querySelectorAll('.btn-toggle-active').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-product-id');
      if (!id) return;

      closeActivePopover();

      // Feedback visual inmediato
      btn.disabled = true;
      btn.style.opacity = '0.6';

      try {
        const updated = await toggleProductActive(id);
        const newStatus = updated && typeof updated.is_active === 'boolean' ? updated.is_active : null;
        const name = updated?.product_name || 'Producto';

        // Actualización optimista local
        const pIndex = state.products.findIndex(p => String(p.id) === String(id));
        if (pIndex !== -1 && newStatus !== null) {
          state.products[pIndex].is_active = newStatus;
        }

        showToast('success', 'Estado Actualizado', `El producto "${name}" ahora está ${newStatus ? 'Activo' : 'Inactivo'}.`);
        await Promise.all([loadProductMetrics(), loadProductsData()]);
      } catch (err) {
        console.error('Error al cambiar estado activo/inactivo:', err);
        showToast('error', 'Error al cambiar estado', err.message || 'No se pudo cambiar el estado del producto.');
      } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  });

  // 6. Acción: Alternar Outlet
  tbody.querySelectorAll('.btn-toggle-outlet').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.getAttribute('data-product-id'), 10);
      closeActivePopover();
      try {
        const updated = await toggleProductOutlet(id);
        showToast('success', 'Estado Outlet Actualizado', `"${updated.product_name}" ${updated.is_outlet ? 'fue marcado como Outlet.' : 'fue removido de Outlet.'}`);
        await Promise.all([loadProductMetrics(), loadProductsData()]);
      } catch (err) {
        showToast('error', 'Error al cambiar estado de outlet', err.message);
      }
    });
  });

  // 7. Acción: Eliminar Producto
  tbody.querySelectorAll('.btn-delete-product').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.getAttribute('data-product-id'), 10);
      closeActivePopover();
      if (confirm('¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.')) {
        try {
          await deleteProduct(id);
          showToast('success', 'Producto Eliminado', 'El producto ha sido eliminado del catálogo.');
          await Promise.all([loadProductMetrics(), loadProductsData()]);
        } catch (err) {
          showToast('error', 'Error al eliminar', err.message);
        }
      }
    });
  });
}

function toggleAccordionRow(id, clickedBtn) {
  const row = document.getElementById(`accordion-row-${id}`);
  const mainRow = document.getElementById(`product-row-${id}`);
  if (!row) return;

  const isOpen = row.classList.contains('is-open');

  if (isOpen) {
    row.classList.remove('is-open');
    if (mainRow) mainRow.classList.remove('is-expanded');
    if (clickedBtn) clickedBtn.classList.remove('is-active');
  } else {
    row.classList.add('is-open');
    if (mainRow) mainRow.classList.add('is-expanded');
    if (clickedBtn) clickedBtn.classList.add('is-active');
  }
}

function togglePopover(id) {
  const popover = document.getElementById(`popover-${id}`);
  if (!popover) return;

  if (state.activePopoverId && state.activePopoverId !== id) {
    closeActivePopover();
  }

  const isOpen = popover.classList.contains('is-open');
  if (isOpen) {
    popover.classList.remove('is-open');
    state.activePopoverId = null;
  } else {
    popover.classList.add('is-open');
    state.activePopoverId = id;
  }
}

function closeActivePopover() {
  if (state.activePopoverId) {
    const active = document.getElementById(`popover-${state.activePopoverId}`);
    if (active) active.classList.remove('is-open');
    state.activePopoverId = null;
  }
}

// ==========================================================================
// FILTROS Y EVENTOS GLOBALES
// ==========================================================================

function setupFilterEvents() {
  const inputSearch = document.getElementById('filter-search');
  const selectType = document.getElementById('filter-type');
  const selectFeatured = document.getElementById('filter-featured');
  const selectOutlet = document.getElementById('filter-outlet');
  const selectStatus = document.getElementById('filter-status');
  const btnClear = document.getElementById('btn-clear-filters');

  let debounceTimer = null;

  if (inputSearch) {
    inputSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.filters.search = inputSearch.value;
        state.pagination.currentPage = 1;
        loadProductsData();
      }, 250);
    });
  }

  if (selectType) {
    selectType.addEventListener('change', () => {
      state.filters.type = selectType.value;
      state.pagination.currentPage = 1;
      loadProductsData();
    });
  }

  if (selectFeatured) {
    selectFeatured.addEventListener('change', () => {
      state.filters.featured = selectFeatured.value;
      state.pagination.currentPage = 1;
      loadProductsData();
    });
  }

  if (selectOutlet) {
    selectOutlet.addEventListener('change', () => {
      state.filters.outlet = selectOutlet.value;
      state.pagination.currentPage = 1;
      loadProductsData();
    });
  }

  if (selectStatus) {
    selectStatus.addEventListener('change', () => {
      state.filters.status = selectStatus.value;
      state.pagination.currentPage = 1;
      loadProductsData();
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (inputSearch) inputSearch.value = '';
      if (selectType) selectType.value = 'all';
      if (selectFeatured) selectFeatured.value = 'all';
      if (selectOutlet) selectOutlet.value = 'all';
      if (selectStatus) selectStatus.value = 'all';

      state.filters.search = '';
      state.filters.type = 'all';
      state.filters.featured = 'all';
      state.filters.outlet = 'all';
      state.filters.status = 'all';
      state.pagination.currentPage = 1;

      loadProductsData();
      showToast('info', 'Filtros Restablecidos', 'Mostrando todos los productos.');
    });
  }
}

function setupGlobalClickEvents() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.table-actions-cell')) {
      closeActivePopover();
    }
  });
}

// ==========================================================================
// MODALES Y ACCIONES DE CABECERA
// ==========================================================================

function setupModalEvents() {
  // Modal Tipos
  const btnTypes = document.getElementById('btn-view-types');
  const modalTypes = document.getElementById('modal-types');
  const btnCloseTypes = document.getElementById('btn-close-types-modal');
  const btnCloseTypesFooter = document.getElementById('btn-close-types-footer');

  // btn-view-types is now a direct link to types.html
  if (btnCloseTypes) btnCloseTypes.addEventListener('click', () => closeModal(modalTypes));
  if (btnCloseTypesFooter) btnCloseTypesFooter.addEventListener('click', () => closeModal(modalTypes));
  if (modalTypes) modalTypes.addEventListener('click', (e) => { if (e.target === modalTypes) closeModal(modalTypes); });

  // Modal Vista Previa Multimedia
  const modalMedia = document.getElementById('modal-media-preview');
  const btnCloseMedia = document.getElementById('btn-close-media-modal');
  if (btnCloseMedia) btnCloseMedia.addEventListener('click', () => closeModal(modalMedia));
  if (modalMedia) modalMedia.addEventListener('click', (e) => { if (e.target === modalMedia) closeModal(modalMedia); });

  // Botón Importar Productos
  const btnImport = document.getElementById('btn-import-products');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      showToast('info', 'Importación de Productos', 'Selecciona un archivo CSV o Excel para cargar productos de forma masiva.');
    });
  }

  // Botón Exportar Productos
  const btnExport = document.getElementById('btn-export-products');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportProductsCSV();
    });
  }
}

function openImagePreviewModal(src, title) {
  const modal = document.getElementById('modal-media-preview');
  const titleEl = document.getElementById('modal-media-title');
  const contentEl = document.getElementById('modal-media-content');

  if (titleEl) titleEl.textContent = `Imagen: ${title}`;
  if (contentEl) {
    contentEl.innerHTML = `
      <img src="${escapeHtml(src)}" alt="${escapeHtml(title)}" onerror="this.src='../../assets/images/logo.jpeg'">
    `;
  }
  openModal(modal);
}

function openVideoPreviewModal(src, title) {
  const modal = document.getElementById('modal-media-preview');
  const titleEl = document.getElementById('modal-media-title');
  const contentEl = document.getElementById('modal-media-content');

  if (titleEl) titleEl.textContent = `Video de Muestra: ${title}`;
  if (contentEl) {
    contentEl.innerHTML = `
      <video controls autoplay style="width: 100%; max-height: 70vh;">
        <source src="${escapeHtml(src)}" type="video/mp4">
        Tu navegador no soporta reproducción de video.
      </video>
    `;
  }
  openModal(modal);
}

function openModal(modalEl) {
  if (modalEl) modalEl.classList.add('is-open');
}

function closeModal(modalEl) {
  if (modalEl) {
    modalEl.classList.remove('is-open');
    const video = modalEl.querySelector('video');
    if (video) video.pause();
  }
}

// ==========================================================================
// EXPORTACIÓN A CSV
// ==========================================================================

function exportProductsCSV() {
  const items = state.products;
  if (!items || items.length === 0) {
    showToast('error', 'Sin Datos', 'No hay productos disponibles para exportar.');
    return;
  }

  const headers = ['ID', 'Nombre', 'Tipo_Producto', 'Precio_USD', 'Outlet', 'Estado', 'Variantes_Color', 'Angulos'];
  const rows = items.map(p => [
    p.id,
    `"${(p.product_name || '').replace(/"/g, '""')}"`,
    `"${(p.product_type || '').replace(/"/g, '""')}"`,
    p.price.toFixed(2),
    p.is_outlet ? 'SI' : 'NO',
    p.is_active ? 'Activo' : 'Inactivo',
    (p.color_images || []).length,
    (p.angle_images || []).length
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
    [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `catalogo_productos_tuestante_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();

  showToast('success', 'Catálogo Exportado', 'Se descargó el archivo CSV de productos.');
}

// ==========================================================================
// PAGINACIÓN
// ==========================================================================

function renderPagination() {
  const infoEl = document.getElementById('pagination-info');
  const controlsEl = document.getElementById('pagination-controls');
  if (!infoEl || !controlsEl) return;

  const total = state.pagination.totalItems;
  const itemsPerPage = state.pagination.itemsPerPage;
  const totalPages = Math.ceil(total / itemsPerPage) || 1;
  const current = state.pagination.currentPage;

  const start = total === 0 ? 0 : (current - 1) * itemsPerPage + 1;
  const end = Math.min(current * itemsPerPage, total);

  infoEl.innerHTML = `Mostrando <strong>${start}</strong> a <strong>${end}</strong> de <strong>${total}</strong> productos`;

  let buttonsHtml = `
    <button type="button" class="btn-pag btn-pag-prev" id="btn-prev-page" ${current === 1 ? 'disabled' : ''} aria-label="Página anterior" title="Página anterior">
      <span class="btn-pag-arrow">&lsaquo;</span><span class="btn-pag-text"> Anterior</span>
    </button>
  `;

  // Ventana de páginas para que no desborde en móvil
  let startPage = 1;
  let endPage = totalPages;

  if (totalPages > 5) {
    if (current <= 3) {
      startPage = 1;
      endPage = 4;
    } else if (current >= totalPages - 2) {
      startPage = totalPages - 3;
      endPage = totalPages;
    } else {
      startPage = current - 1;
      endPage = current + 1;
    }
  }

  if (startPage > 1) {
    buttonsHtml += `
      <button type="button" class="btn-pag" data-page="1">1</button>
    `;
    if (startPage > 2) {
      buttonsHtml += `<span class="pagination-ellipsis">&hellip;</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    buttonsHtml += `
      <button type="button" class="btn-pag ${i === current ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      buttonsHtml += `<span class="pagination-ellipsis">&hellip;</span>`;
    }
    buttonsHtml += `
      <button type="button" class="btn-pag" data-page="${totalPages}">${totalPages}</button>
    `;
  }

  buttonsHtml += `
    <button type="button" class="btn-pag btn-pag-next" id="btn-next-page" ${current === totalPages || totalPages === 0 ? 'disabled' : ''} aria-label="Página siguiente" title="Página siguiente">
      <span class="btn-pag-text">Siguiente </span><span class="btn-pag-arrow">&rsaquo;</span>
    </button>
  `;

  controlsEl.innerHTML = buttonsHtml;

  controlsEl.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pagination.currentPage = parseInt(btn.getAttribute('data-page'), 10);
      renderProductsTable();
      renderPagination();
    });
  });

  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage--;
        renderProductsTable();
        renderPagination();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.pagination.currentPage < totalPages) {
        state.pagination.currentPage++;
        renderProductsTable();
        renderPagination();
      }
    });
  }
}

// ==========================================================================
// UTILIDADES
// ==========================================================================

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}
