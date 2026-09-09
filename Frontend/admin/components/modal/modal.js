/**
 * ==========================================================================
 * TUESTANTE ADMIN - COMPONENTE MODAL REUTILIZABLE (ALERTAS Y CONFIRMACIÓN)
 * ==========================================================================
 * Proporciona modales visuales asíncronos para confirmaciones y alertas,
 * reemplazando las ventanas emergentes nativas (confirm() y alert()).
 */

/**
 * Retorna el marcado SVG para el icono correspondiente al tipo de modal.
 * @param {'danger'|'warning'|'success'|'info'} type
 * @returns {string} SVG HTML
 */
function getModalIconSvg(type) {
  switch (type) {
    case 'danger':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      `;
    case 'warning':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      `;
    case 'success':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;
    case 'info':
    default:
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      `;
  }
}

/**
 * Crea o recupera el contenedor base del modal en el DOM.
 * @returns {HTMLElement}
 */
function getOrCreateModalContainer() {
  let container = document.getElementById('system-modal-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'system-modal-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Muestra un modal de confirmación con dos botones (Confirmar y Cancelar).
 * @param {Object} options Opciones de configuración
 * @param {string} [options.title='Confirmación'] Título del modal
 * @param {string} [options.message='¿Estás seguro de realizar esta acción?'] Mensaje o descripción
 * @param {string} [options.confirmText='Confirmar'] Texto del botón afirmativo
 * @param {string} [options.cancelText='Cancelar'] Texto del botón cancelar
 * @param {'danger'|'warning'|'success'|'info'} [options.type='danger'] Estilo visual
 * @returns {Promise<boolean>} Resuelve true si se confirmó, false si se canceló
 */
export function showConfirmModal({
  title = 'Confirmación',
  message = '¿Estás seguro de realizar esta acción?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger'
} = {}) {
  return new Promise((resolve) => {
    const container = getOrCreateModalContainer();

    const backdrop = document.createElement('div');
    backdrop.className = 'system-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'system-modal-title');

    backdrop.innerHTML = `
      <div class="system-modal-card type-${type}">
        <button type="button" class="system-modal-close-x" aria-label="Cerrar modal" title="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="18" x2="18" y2="6"></line>
          </svg>
        </button>

        <div class="system-modal-icon-wrap" aria-hidden="true">
          ${getModalIconSvg(type)}
        </div>

        <h3 class="system-modal-title" id="system-modal-title">${title}</h3>
        <p class="system-modal-message">${message}</p>

        <div class="system-modal-actions">
          <button type="button" class="system-modal-btn system-modal-btn-cancel">${cancelText}</button>
          <button type="button" class="system-modal-btn system-modal-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    container.appendChild(backdrop);

    // Animación de entrada
    requestAnimationFrame(() => {
      backdrop.classList.add('is-visible');
    });

    const close = (result) => {
      backdrop.classList.remove('is-visible');
      cleanupEvents();
      setTimeout(() => {
        backdrop.remove();
        resolve(result);
      }, 250);
    };

    const confirmBtn = backdrop.querySelector('.system-modal-btn-confirm');
    const cancelBtn = backdrop.querySelector('.system-modal-btn-cancel');
    const closeXBtn = backdrop.querySelector('.system-modal-close-x');

    confirmBtn.focus();

    const handleConfirm = () => close(true);
    const handleCancel = () => close(false);

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
    };

    const handleBackdropClick = (e) => {
      if (e.target === backdrop) {
        close(false);
      }
    };

    function cleanupEvents() {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      closeXBtn.removeEventListener('click', handleCancel);
      backdrop.removeEventListener('click', handleBackdropClick);
      document.removeEventListener('keydown', handleKeydown);
    }

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeXBtn.addEventListener('click', handleCancel);
    backdrop.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeydown);
  });
}

/**
 * Muestra un modal informativo de alerta con un solo botón de aceptación.
 * @param {Object} options Opciones de configuración
 * @param {string} [options.title='Aviso'] Título del modal
 * @param {string} [options.message=''] Mensaje informativo
 * @param {string} [options.buttonText='Entendido'] Texto del botón
 * @param {'danger'|'warning'|'success'|'info'} [options.type='info'] Estilo visual
 * @returns {Promise<void>}
 */
export function showAlertModal({
  title = 'Aviso',
  message = '',
  buttonText = 'Entendido',
  type = 'info'
} = {}) {
  return new Promise((resolve) => {
    const container = getOrCreateModalContainer();

    const backdrop = document.createElement('div');
    backdrop.className = 'system-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'system-modal-title');

    backdrop.innerHTML = `
      <div class="system-modal-card type-${type}">
        <button type="button" class="system-modal-close-x" aria-label="Cerrar modal" title="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="18" x2="18" y2="6"></line>
          </svg>
        </button>

        <div class="system-modal-icon-wrap" aria-hidden="true">
          ${getModalIconSvg(type)}
        </div>

        <h3 class="system-modal-title" id="system-modal-title">${title}</h3>
        <p class="system-modal-message">${message}</p>

        <div class="system-modal-actions">
          <button type="button" class="system-modal-btn system-modal-btn-confirm" style="min-width: 140px;">${buttonText}</button>
        </div>
      </div>
    `;

    container.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.add('is-visible');
    });

    const close = () => {
      backdrop.classList.remove('is-visible');
      cleanupEvents();
      setTimeout(() => {
        backdrop.remove();
        resolve();
      }, 250);
    };

    const confirmBtn = backdrop.querySelector('.system-modal-btn-confirm');
    const closeXBtn = backdrop.querySelector('.system-modal-close-x');

    confirmBtn.focus();

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    const handleBackdropClick = (e) => {
      if (e.target === backdrop) {
        close();
      }
    };

    function cleanupEvents() {
      confirmBtn.removeEventListener('click', close);
      closeXBtn.removeEventListener('click', close);
      backdrop.removeEventListener('click', handleBackdropClick);
      document.removeEventListener('keydown', handleKeydown);
    }

    confirmBtn.addEventListener('click', close);
    closeXBtn.addEventListener('click', close);
    backdrop.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKeydown);
  });
}

// Registro global en window para uso directo desde cualquier script
if (typeof window !== 'undefined') {
  window.showConfirmModal = showConfirmModal;
  window.showAlertModal = showAlertModal;
}
