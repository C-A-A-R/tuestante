/**
 * ==========================================================================
 * TUESTANTE - CONTROLADOR VISTA DE DETALLE DE PRODUCTO
 * ==========================================================================
 */

import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { createProductCard, formatProductImageUrl } from '../../components/product-card/product-card.js';
import { showToast, showAlertModal, openImageLightbox } from '../../components/dialog/dialog.js';
import { addToCart } from '../cart/cart-service.js';
import { obtenerProductoPorId, obtenerProductosRelacionados } from './product.api.js';

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

let currentProduct = null;
let selectedQuantity = 1;

/**
 * Carga los detalles del producto por ID
 */
async function loadProductDetail() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  if (!productId) {
    await showAlertModal({
      title: 'Producto No Especificado',
      message: 'No se especificó un código de producto válido para visualizar.',
      type: 'warning'
    });
    window.location.href = '../../index.html';
    return;
  }

  try {
    currentProduct = await obtenerProductoPorId(productId);
    if (!currentProduct || !currentProduct.id) {
      throw new Error('Producto no encontrado.');
    }

    renderProductDetail(currentProduct);
    loadRelatedProducts(currentProduct);
  } catch (err) {
    console.error('[ProductDetail] Error cargando producto:', err);
    document.getElementById('product-hero').innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; width: 100%;">
        <h3>Artículo no encontrado</h3>
        <p>El producto solicitado no existe o fue retirado del catálogo de colaboradores.</p>
        <a href="../../index.html" class="btn btn-primary">Volver al Catálogo</a>
      </div>
    `;
  }
}

/**
 * Renderiza los campos del producto en el DOM
 */
function renderProductDetail(product) {
  const stock = parseInt(product.stock, 10) || 0;
  const weeklyLimit = parseInt(product.weekly_limit_per_employee, 10) || 0;
  const isOutOfStock = stock <= 0;

  // Actualizar Título y Migas de Pan
  document.title = `${product.name} | TuEstante Colaboradores`;
  document.getElementById('breadcrumb-product-name').textContent = product.name;
  document.getElementById('product-name').textContent = product.name;
  document.getElementById('product-description').textContent = product.description || 'Artículo disponible para adquisición interna por nómina.';
  document.getElementById('product-price').textContent = `$${parseFloat(product.price || 0).toFixed(2)}`;

  // Previsualización de Imagen y Lightbox
  const previewContainer = document.getElementById('product-large-preview');
  const imageUrl = formatProductImageUrl(product.image);
  const subcatName = product.subcategory_name || product.category_name || 'General';

  if (previewContainer) {
    if (imageUrl) {
      previewContainer.innerHTML = `
        <span class="product-detail-badge" id="product-category-tag">${subcatName}</span>
        <button type="button" class="large-preview-zoom-btn" id="btn-zoom-image" title="Ver imagen en pantalla completa" aria-label="Ampliar imagen">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
        <img 
          src="${imageUrl}" 
          alt="${product.name}" 
          class="product-detail-img" 
          id="product-detail-main-img"
          title="Clic para ampliar imagen"
          onerror="this.style.display='none'; const el = document.getElementById('large-fallback-illustration'); if(el) el.style.display='flex';" 
        />
        <div class="large-preview-illustration" id="large-fallback-illustration" style="display: none;">
          <svg viewBox="0 0 24 24" width="120" height="120" fill="none" stroke="currentColor" stroke-width="1.2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span class="large-preview-barcode" id="product-barcode-display">CÓDIGO: ${product.barcode || 'N/A'}</span>
        </div>
        <span class="large-preview-barcode-badge">CÓD: ${product.barcode || 'N/A'}</span>
      `;

      // Clic para abrir el visor flotante (Lightbox)
      previewContainer.addEventListener('click', (e) => {
        if (!e.target.closest('.product-detail-badge')) {
          openImageLightbox(imageUrl, product.name);
        }
      });
    } else {
      previewContainer.innerHTML = `
        <span class="product-detail-badge" id="product-category-tag">${subcatName}</span>
        <div class="large-preview-illustration">
          <svg viewBox="0 0 24 24" width="120" height="120" fill="none" stroke="currentColor" stroke-width="1.2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span class="large-preview-barcode" id="product-barcode-display">CÓDIGO: ${product.barcode || 'N/A'}</span>
        </div>
      `;
    }
  }

  // Badges de Stock y Cupo (sin exponer números exactos de existencias)
  const stockBadge = document.getElementById('product-stock-badge');
  const exactStockEl = document.getElementById('warehouse-exact-stock');
  if (isOutOfStock) {
    stockBadge.className = 'badge badge-danger';
    stockBadge.textContent = 'Agotado en Bodega';
    exactStockEl.innerHTML = `<span style="color: var(--color-danger); font-weight: 700;">Sin existencias en este momento</span>`;
  } else if (stock <= 3) {
    stockBadge.className = 'badge badge-warning';
    stockBadge.textContent = '¡Pocas unidades!';
    exactStockEl.textContent = 'Unidades limitadas en estantería para retiro presencial';
  } else {
    stockBadge.className = 'badge badge-success';
    stockBadge.textContent = 'Stock Disponible';
    exactStockEl.textContent = 'Artículo disponible en bodega para retiro inmediato';
  }

  const quotaBadge = document.getElementById('product-quota-badge');
  if (quotaBadge) {
    quotaBadge.textContent = weeklyLimit > 0
      ? `Máx. ${weeklyLimit} por semana`
      : 'Sin límite semanal';
  }

  // Configurar Selector de Cantidad con validaciones y subtotal en vivo
  setupQuantitySelector(product, stock, weeklyLimit);

  // Botón Agregar al Carrito
  const addBtn = document.getElementById('btn-add-to-cart-detail');
  if (addBtn) {
    if (isOutOfStock) {
      addBtn.disabled = true;
      addBtn.innerHTML = `<span>Agotado</span>`;
    } else {
      addBtn.addEventListener('click', () => {
        const result = addToCart(product, selectedQuantity);
        if (result.success) {
          addBtn.style.backgroundColor = 'var(--color-success)';
          addBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>¡${selectedQuantity} ${selectedQuantity === 1 ? 'unidad agregada' : 'unidades agregadas'}!</span>
          `;
          showToast(`Se agregaron ${selectedQuantity} ${selectedQuantity === 1 ? 'unidad' : 'unidades'} de "${product.name}" al carrito.`, 'success');
          setTimeout(() => {
            addBtn.style.backgroundColor = '';
            addBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Agregar al Carrito</span>
            `;
          }, 1500);
        } else {
          showToast(result.message || 'No se pudo agregar al carrito.', 'warning');
        }
      });
    }
  }
}

/**
 * Configura los controles + y - con validación DOM y cálculo de subtotal en vivo
 */
function setupQuantitySelector(product, stock, weeklyLimit) {
  const minusBtn = document.getElementById('btn-qty-minus');
  const plusBtn = document.getElementById('btn-qty-plus');
  const input = document.getElementById('detail-qty-input');
  const hint = document.getElementById('qty-validation-hint');
  const subtotalEl = document.getElementById('detail-live-subtotal');

  const unitPrice = parseFloat(product.price || 0);
  const maxAllowed = weeklyLimit > 0 ? Math.min(stock, weeklyLimit) : stock;

  function updateControlState() {
    input.value = selectedQuantity;
    minusBtn.disabled = selectedQuantity <= 1;
    plusBtn.disabled = selectedQuantity >= maxAllowed || stock <= 0;

    if (subtotalEl) {
      subtotalEl.textContent = `$${(unitPrice * selectedQuantity).toFixed(2)}`;
    }

    if (stock <= 0) {
      hint.textContent = 'Sin existencias en bodega.';
    } else if (selectedQuantity >= maxAllowed) {
      if (weeklyLimit > 0 && selectedQuantity === weeklyLimit) {
        hint.textContent = `Has alcanzado el límite semanal (${weeklyLimit} por trabajador).`;
      } else {
        hint.textContent = `Has alcanzado la cantidad máxima disponible.`;
      }
    } else {
      hint.textContent = '';
    }
  }

  minusBtn.addEventListener('click', () => {
    if (selectedQuantity > 1) {
      selectedQuantity--;
      updateControlState();
    }
  });

  plusBtn.addEventListener('click', () => {
    if (selectedQuantity < maxAllowed) {
      selectedQuantity++;
      updateControlState();
    }
  });

  updateControlState();
}

/**
 * Carga el carrusel de artículos relacionados por subcategoría
 */
async function loadRelatedProducts(product) {
  const container = document.getElementById('related-products-container');
  const emptyPanel = document.getElementById('related-empty-panel');
  if (!container || !emptyPanel) return;

  const subcategoryId = product.subcategory || product.subcategory_id;
  if (!subcategoryId) {
    container.style.display = 'none';
    emptyPanel.style.display = 'flex';
    return;
  }

  try {
    const related = await obtenerProductosRelacionados(subcategoryId, product.id);

    if (related.length === 0) {
      container.style.display = 'none';
      emptyPanel.style.display = 'flex';
      return;
    }

    container.style.display = 'grid';
    emptyPanel.style.display = 'none';
    container.innerHTML = '';

    related.slice(0, 4).forEach((item) => {
      const card = createProductCard(item);
      container.appendChild(card);
    });
  } catch (err) {
    console.warn('[ProductDetail] Error cargando relacionados:', err);
    container.style.display = 'none';
    emptyPanel.style.display = 'flex';
  }
}

// Inicialización de la pantalla
async function initProductDetailPage() {
  initNavbar('navbar-placeholder');
  initFooter('footer-placeholder');

  loadProductDetail();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductDetailPage);
} else {
  initProductDetailPage();
}
