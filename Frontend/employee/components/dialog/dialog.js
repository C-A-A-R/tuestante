/**
 * ==========================================================================
 * TUESTANTE - SERVICIO Y COMPONENTES REUTILIZABLES DE DIÁLOGOS, TOASTS Y MODALES
 * ==========================================================================
 */

import { formatProductImageUrl } from '../product-card/product-card.js';

/**
 * Asegura que los estilos dialog.css estén inyectados en la página actual.
 */
function ensureDialogStyles() {
  if (document.getElementById('te-dialog-styles')) return;
  const link = document.createElement('link');
  link.id = 'te-dialog-styles';
  link.rel = 'stylesheet';
  
  // Calcular ruta relativa adecuada según la profundidad del archivo
  const path = window.location.pathname || '';
  if (path.includes('/modules/')) {
    link.href = '../../components/dialog/dialog.css?v=2.2';
  } else {
    link.href = 'components/dialog/dialog.css?v=2.2';
  }
  document.head.appendChild(link);
}

ensureDialogStyles();

// Contenedor global de Toasts
let toastContainer = null;
function getToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Muestra una notificación flotante (Toast)
 * @param {string} message Texto del mensaje
 * @param {'info'|'success'|'warning'|'error'|'danger'} [type='info']
 * @param {string} [title='']
 * @param {number} [duration=3500] Duración en ms antes de auto-cerrarse (0 para permanente)
 */
export function showToast(message, type = 'info', title = '', duration = 3500) {
  ensureDialogStyles();
  const container = getToastContainer();

  const toast = document.createElement('div');
  const normalizedType = type === 'error' ? 'danger' : type;
  toast.className = `toast-item toast-${normalizedType}`;
  toast.setAttribute('role', 'status');

  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    danger: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
  };

  const defaultTitles = {
    success: 'Operación Exitosa',
    info: 'Aviso',
    warning: 'Atención',
    danger: 'Error'
  };

  const headerTitle = title || defaultTitles[normalizedType] || 'Aviso';

  toast.innerHTML = `
    ${icons[normalizedType] || icons.info}
    <div class="toast-content">
      <span class="toast-title">${headerTitle}</span>
      <span class="toast-message">${message}</span>
    </div>
    <button type="button" class="toast-close-btn" aria-label="Cerrar notificación">&times;</button>
  `;

  const closeToast = () => {
    toast.classList.add('toast-closing');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  };

  toast.querySelector('.toast-close-btn').addEventListener('click', closeToast);

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(closeToast, duration);
  }

  return toast;
}

/**
 * Muestra un modal de alerta estilizado en reemplazo de alert().
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {'info'|'warning'|'danger'|'success'} [options.type='info']
 * @param {string} [options.confirmText='Entendido']
 * @returns {Promise<void>}
 */
export function showAlertModal({
  title = 'Aviso',
  message = '',
  type = 'info',
  confirmText = 'Entendido'
} = {}) {
  ensureDialogStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const normalizedType = type === 'error' ? 'danger' : type;
    const icons = {
      info: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
      warning: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      danger: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      success: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    };

    overlay.innerHTML = `
      <div class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="dialog-modal-title">
        <div class="dialog-header">
          <div class="dialog-icon-circle icon-${normalizedType}">
            ${icons[normalizedType] || icons.info}
          </div>
          <h3 class="dialog-title" id="dialog-modal-title">${title}</h3>
        </div>
        <div class="dialog-body">
          <p style="margin: 0;">${message}</p>
        </div>
        <div class="dialog-footer">
          <button type="button" class="btn-dialog btn-dialog-confirm" id="btn-dialog-ok">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    const cleanup = () => {
      overlay.classList.add('dialog-closing');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', handleKey);
        resolve();
      }, 180);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        cleanup();
      }
    };

    overlay.querySelector('#btn-dialog-ok').addEventListener('click', cleanup);
    document.addEventListener('keydown', handleKey);

    document.body.appendChild(overlay);
    overlay.querySelector('#btn-dialog-ok').focus();
  });
}

/**
 * Muestra un modal de confirmación interactivo en reemplazo de confirm().
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmText='Confirmar']
 * @param {string} [options.cancelText='Cancelar']
 * @param {'warning'|'danger'|'info'} [options.type='warning']
 * @returns {Promise<boolean>} Resuelve a true si confirmó, false si canceló
 */
export function showConfirmModal({
  title = '¿Confirmar acción?',
  message = '¿Estás seguro de realizar esta acción?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
} = {}) {
  ensureDialogStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const normalizedType = type === 'error' ? 'danger' : type;
    const icons = {
      warning: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      danger: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      info: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    overlay.innerHTML = `
      <div class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="dialog-confirm-title">
        <div class="dialog-header">
          <div class="dialog-icon-circle icon-${normalizedType}">
            ${icons[normalizedType] || icons.warning}
          </div>
          <h3 class="dialog-title" id="dialog-confirm-title">${title}</h3>
        </div>
        <div class="dialog-body">
          <p style="margin: 0;">${message}</p>
        </div>
        <div class="dialog-footer">
          <button type="button" class="btn-dialog btn-dialog-cancel" id="btn-dialog-cancel">
            ${cancelText}
          </button>
          <button type="button" class="btn-dialog btn-dialog-confirm ${normalizedType === 'danger' ? 'btn-danger' : ''}" id="btn-dialog-confirm">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    const finish = (result) => {
      overlay.classList.add('dialog-closing');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', handleKey);
        resolve(result);
      }, 180);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };

    overlay.querySelector('#btn-dialog-cancel').addEventListener('click', () => finish(false));
    overlay.querySelector('#btn-dialog-confirm').addEventListener('click', () => finish(true));

    // Clic en backdrop fuera de la caja
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });

    document.addEventListener('keydown', handleKey);
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-dialog-confirm').focus();
  });
}

/**
 * Modal interactivo que pregunta cuántas unidades desea agregar de un producto.
 * @param {Object} product Objeto InternalProduct
 * @param {number} [initialQuantity=1]
 * @returns {Promise<number|null>} Cantidad seleccionada o null si canceló
 */
export function showQuantityModal({ product, initialQuantity = 1 } = {}) {
  ensureDialogStyles();

  return new Promise((resolve) => {
    const stock = parseInt(product.stock, 10) || 0;
    const weeklyLimit = parseInt(product.weekly_limit_per_employee, 10) || 0;
    const maxAllowed = weeklyLimit > 0 ? Math.min(stock, weeklyLimit) : stock;
    const unitPrice = parseFloat(product.price || 0);

    let currentQty = Math.max(1, Math.min(initialQuantity, maxAllowed));

    const imageUrl = formatProductImageUrl(product.image);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    overlay.innerHTML = `
      <div class="dialog-box modal-qty-box" role="dialog" aria-modal="true" aria-labelledby="modal-qty-title">
        <div class="dialog-header" style="padding-bottom: 0.25rem;">
          <h3 class="dialog-title" id="modal-qty-title">¿Cuántas unidades deseas agregar?</h3>
        </div>

        <div class="dialog-body" style="padding-top: 0.75rem;">
          <!-- Previsualización de Producto -->
          <div class="modal-qty-product-preview">
            <div class="modal-qty-thumb">
              ${imageUrl 
                ? `<img src="${imageUrl}" alt="${product.name}" onerror="this.style.display='none';" />`
                : `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`
              }
            </div>
            <div class="modal-qty-details">
              <h4>${product.name}</h4>
              <span class="modal-qty-price-pill">$${unitPrice.toFixed(2)} por unidad con nómina</span>
            </div>
          </div>

          <!-- Stepper de Cantidad -->
          <div class="modal-qty-stepper-wrap">
            <span class="modal-qty-label">Selecciona la cantidad:</span>
            <div class="modal-qty-stepper">
              <button type="button" class="btn-modal-step" id="btn-modal-qty-minus" aria-label="Disminuir">&minus;</button>
              <input type="number" class="modal-qty-input" id="modal-qty-num" value="${currentQty}" min="1" max="${maxAllowed}" readonly />
              <button type="button" class="btn-modal-step" id="btn-modal-qty-plus" aria-label="Aumentar">&plus;</button>
            </div>

            <div class="modal-qty-subtotal">
              Total estimado: <strong id="modal-qty-subtotal-val">$${(unitPrice * currentQty).toFixed(2)}</strong>
            </div>

            <div class="modal-qty-hint" id="modal-qty-hint-text"></div>
          </div>
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-dialog btn-dialog-cancel" id="btn-modal-qty-cancel">
            Cancelar
          </button>
          <button type="button" class="btn-dialog btn-dialog-confirm" id="btn-modal-qty-submit">
            Agregar al Carrito
          </button>
        </div>
      </div>
    `;

    const minusBtn = overlay.querySelector('#btn-modal-qty-minus');
    const plusBtn = overlay.querySelector('#btn-modal-qty-plus');
    const inputEl = overlay.querySelector('#modal-qty-num');
    const subtotalEl = overlay.querySelector('#modal-qty-subtotal-val');
    const hintEl = overlay.querySelector('#modal-qty-hint-text');

    const updateView = () => {
      inputEl.value = currentQty;
      subtotalEl.textContent = `$${(unitPrice * currentQty).toFixed(2)}`;
      minusBtn.disabled = currentQty <= 1;
      plusBtn.disabled = currentQty >= maxAllowed;

      if (weeklyLimit > 0 && currentQty >= weeklyLimit) {
        hintEl.textContent = `Límite semanal alcanzado (${weeklyLimit} uds. permitidas por colaborador).`;
      } else if (currentQty >= stock) {
        hintEl.textContent = `Límite máximo disponible alcanzado.`;
      } else {
        hintEl.textContent = '';
      }
    };

    minusBtn.addEventListener('click', () => {
      if (currentQty > 1) {
        currentQty--;
        updateView();
      }
    });

    plusBtn.addEventListener('click', () => {
      if (currentQty < maxAllowed) {
        currentQty++;
        updateView();
      }
    });

    updateView();

    const finish = (resultQty) => {
      overlay.classList.add('dialog-closing');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', handleKey);
        resolve(resultQty);
      }, 180);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') finish(null);
      if (e.key === 'Enter') finish(currentQty);
    };

    overlay.querySelector('#btn-modal-qty-cancel').addEventListener('click', () => finish(null));
    overlay.querySelector('#btn-modal-qty-submit').addEventListener('click', () => finish(currentQty));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });

    document.addEventListener('keydown', handleKey);
    document.body.appendChild(overlay);
    plusBtn.focus();
  });
}

/**
 * Abre el visor flotante de imagen completa (Lightbox)
 * @param {string} imageUrl URL de la imagen
 * @param {string} [title=''] Nombre del producto
 */
export function openImageLightbox(imageUrl, title = '') {
  if (!imageUrl) return;
  ensureDialogStyles();

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <button type="button" class="lightbox-close-btn" aria-label="Cerrar vista completa">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div class="lightbox-content-wrap">
      <img src="${imageUrl}" alt="${title}" class="lightbox-image" />
      ${title ? `<div class="lightbox-caption">${title}</div>` : ''}
    </div>
  `;

  const closeLightbox = () => {
    overlay.classList.add('lightbox-closing');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', handleKey);
    }, 180);
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') closeLightbox();
  };

  overlay.querySelector('.lightbox-close-btn').addEventListener('click', closeLightbox);
  overlay.addEventListener('click', (e) => {
    // Si hace clic en el fondo o en el overlay
    if (e.target === overlay || e.target.classList.contains('lightbox-content-wrap')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', handleKey);
  document.body.appendChild(overlay);
}
