/**
 * ==========================================================================
 * TUESTANTE - COMPONENTE REUTILIZABLE PRODUCT CARD
 * ==========================================================================
 */

import { addToCart } from '../../modules/cart/cart-service.js';
import { showQuantityModal, showToast } from '../dialog/dialog.js';

/**
 * Retorna el prefijo para la navegación hacia modules/
 */
function getModulePrefix() {
  const path = window.location.pathname || '';
  if (path.includes('/modules/')) {
    return '../';
  }
  return 'modules/';
}

/**
 * Normaliza la URL de la imagen del producto para asegurar que apunte al backend
 */
export function formatProductImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return '';
  const trimmed = imagePath.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const backendOrigin = (window.CONFIG && window.CONFIG.BACKEND_URL)
    || (window.CONFIG && window.CONFIG.API_BASE_URL ? window.CONFIG.API_BASE_URL.replace(/\/api\/?$/, '') : '')
    || 'http://localhost:8000';
  
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${backendOrigin}${cleanPath}`;
}

/**
 * Renderiza el elemento HTML de una tarjeta de producto interno.
 * @param {Object} product Objeto InternalProduct
 * @returns {HTMLElement}
 */
export function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.setAttribute('data-id', product.id);

  const stock = parseInt(product.stock, 10) || 0;
  const weeklyLimit = parseInt(product.weekly_limit_per_employee, 10) || 0;
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= 3;

  // Formato de badge de disponibilidad (sin exponer número exacto de bodega)
  let availabilityHtml = '';
  if (isOutOfStock) {
    availabilityHtml = `<span class="product-availability-badge availability-out-of-stock">Agotado</span>`;
  } else if (isLowStock) {
    availabilityHtml = `<span class="product-availability-badge availability-low-stock">¡Pocas unidades!</span>`;
  } else {
    availabilityHtml = `<span class="product-availability-badge availability-in-stock">&#10003; Disponible en bodega</span>`;
  }

  // Formato de cupo semanal
  const quotaText = weeklyLimit > 0
    ? `Máx. ${weeklyLimit} por semana`
    : `Sin límite semanal`;

  const subcatName = product.subcategory_name || product.category_name || 'General';
  const prefix = getModulePrefix();
  const detailUrl = `${prefix}product/product-detail.html?id=${product.id}`;
  const priceFormatted = parseFloat(product.price || 0).toFixed(2);
  const imageUrl = formatProductImageUrl(product.image);

  card.innerHTML = `
    <div class="product-card-media" role="button" tabindex="0" title="Ver detalle de ${product.name}">
      <span class="product-card-tag">${subcatName}</span>
      ${imageUrl 
        ? `<img 
             src="${imageUrl}" 
             alt="${product.name}" 
             class="product-card-img" 
             loading="lazy" 
             onerror="this.style.display='none'; const el = this.nextElementSibling; if(el) el.style.display='flex';" 
           />
           <div class="product-card-illustration" style="display: none;">
             <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor">
               <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
               <line x1="8" y1="21" x2="16" y2="21"></line>
               <line x1="12" y1="17" x2="12" y2="21"></line>
             </svg>
           </div>`
        : `<div class="product-card-illustration">
             <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor">
               <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
               <line x1="8" y1="21" x2="16" y2="21"></line>
               <line x1="12" y1="17" x2="12" y2="21"></line>
             </svg>
           </div>`
      }
      <span class="product-card-barcode-badge">CÓD: ${product.barcode || 'N/A'}</span>
    </div>

    <div class="product-card-body">
      <div class="product-card-meta">
        ${availabilityHtml}
        <span class="product-quota-badge" title="Política de cupo por empleado">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ${quotaText}
        </span>
      </div>

      <h3 class="product-card-title" role="button" tabindex="0" title="${product.name}">${product.name}</h3>
      <p class="product-card-desc">${product.description || 'Producto disponible para consumo interno con cargo a nómina.'}</p>

      <div class="product-card-footer">
        <div class="product-card-price-wrap">
          <span class="product-price-label">Precio Nómina</span>
          <span class="product-card-price"><span class="currency">$</span>${priceFormatted}</span>
        </div>

        <button 
          type="button" 
          class="btn-add-product" 
          ${isOutOfStock ? 'disabled' : ''}
          aria-label="${isOutOfStock ? 'Producto agotado' : 'Agregar ' + product.name + ' al carrito'}"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            ${isOutOfStock 
              ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' 
              : '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'
            }
          </svg>
          <span>${isOutOfStock ? 'Agotado' : 'Agregar'}</span>
        </button>
      </div>
    </div>
  `;

  // Eventos de navegación al detalle
  const mediaEl = card.querySelector('.product-card-media');
  const titleEl = card.querySelector('.product-card-title');
  const navigateToDetail = () => { window.location.href = detailUrl; };

  mediaEl.addEventListener('click', navigateToDetail);
  mediaEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigateToDetail(); });
  titleEl.addEventListener('click', navigateToDetail);
  titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigateToDetail(); });

  // Botón Agregar al carrito (pregunta cantidad deseada)
  const addBtn = card.querySelector('.btn-add-product');
  if (addBtn && !isOutOfStock) {
    addBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chosenQty = await showQuantityModal({ product });
      if (chosenQty && chosenQty > 0) {
        const result = addToCart(product, chosenQty);
        if (result.success) {
          addBtn.style.backgroundColor = 'var(--color-success)';
          addBtn.querySelector('span').textContent = `¡Agregado (${chosenQty})!`;
          showToast(`Se agregaron ${chosenQty} ${chosenQty === 1 ? 'unidad' : 'unidades'} de "${product.name}" al carrito.`, 'success');
          setTimeout(() => {
            addBtn.style.backgroundColor = '';
            addBtn.querySelector('span').textContent = 'Agregar';
          }, 1400);
        } else {
          showToast(result.message || 'No es posible agregar las unidades solicitadas.', 'warning');
        }
      }
    });
  }

  return card;
}
