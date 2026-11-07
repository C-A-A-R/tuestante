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

let activeLoadingOverlay = null;
let loadingProgressTimer = null;

/**
 * Muestra una pantalla / overlay de carga global con progreso estimado del 0% al 100%.
 * @param {Object} options
 * @param {string} [options.title='Guardando información...'] Título de la operación
 * @param {string} [options.message='Por favor espera mientras se procesa la solicitud.'] Mensaje
 * @param {number} [options.estimatedDuration=1400] Duración estimada en ms
 */
export function showLoadingOverlay({
  title = 'Guardando información...',
  message = 'Por favor espera mientras se procesa la solicitud.',
  estimatedDuration = 1400
} = {}) {
  if (activeLoadingOverlay) {
    hideLoadingOverlay(false);
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'system-loading-overlay-root';
  backdrop.className = 'system-loading-backdrop';
  backdrop.setAttribute('role', 'status');
  backdrop.setAttribute('aria-live', 'polite');

  backdrop.innerHTML = `
    <div class="system-loading-card">
      <div class="system-loading-icon-wrap" aria-hidden="true">
        <svg class="system-loading-spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.2"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
        </svg>
        <svg class="system-loading-completed-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>

      <h3 class="system-loading-title">${title}</h3>
      <p class="system-loading-message">${message}</p>

      <div class="system-loading-progress-container">
        <div class="system-loading-progress-header">
          <span class="system-loading-status-text">Procesando...</span>
          <span class="system-loading-percent-label">0%</span>
        </div>
        <div class="system-loading-track">
          <div class="system-loading-bar-fill" style="width: 0%;"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  const barFill = backdrop.querySelector('.system-loading-bar-fill');
  const percentLabel = backdrop.querySelector('.system-loading-percent-label');
  const statusText = backdrop.querySelector('.system-loading-status-text');
  const card = backdrop.querySelector('.system-loading-card');

  let currentPercent = 0;
  const startTime = Date.now();

  loadingProgressTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const factor = Math.min(elapsed / estimatedDuration, 1);
    currentPercent = Math.min(Math.round(factor * 92), 95);
    if (barFill) barFill.style.width = `${currentPercent}%`;
    if (percentLabel) percentLabel.textContent = `${currentPercent}%`;
  }, 40);

  activeLoadingOverlay = {
    backdrop,
    card,
    barFill,
    percentLabel,
    statusText,
    setPercent(pct, msg) {
      currentPercent = Math.min(Math.max(pct, 0), 100);
      if (barFill) barFill.style.width = `${currentPercent}%`;
      if (percentLabel) percentLabel.textContent = `${currentPercent}%`;
      if (msg && statusText) statusText.textContent = msg;
    }
  };

  return activeLoadingOverlay;
}

/**
 * Oculta la pantalla de carga completando la barra al 100% y ejecutando animación de éxito.
 * @param {boolean} [animateComplete=true] Si debe mostrar el 100% y checkmark antes de desvanecer
 * @returns {Promise<void>}
 */
export function hideLoadingOverlay(animateComplete = true) {
  return new Promise((resolve) => {
    if (loadingProgressTimer) {
      clearInterval(loadingProgressTimer);
      loadingProgressTimer = null;
    }

    if (!activeLoadingOverlay) {
      resolve();
      return;
    }

    const { backdrop, card, barFill, percentLabel, statusText } = activeLoadingOverlay;
    activeLoadingOverlay = null;

    if (!animateComplete) {
      backdrop.classList.remove('is-visible');
      setTimeout(() => {
        backdrop.remove();
        resolve();
      }, 200);
      return;
    }

    // Llevar visualmente al 100%
    if (barFill) barFill.style.width = '100%';
    if (percentLabel) percentLabel.textContent = '100%';
    if (statusText) statusText.textContent = '¡Completado!';
    if (card) card.classList.add('is-completed');

    setTimeout(() => {
      backdrop.classList.remove('is-visible');
      setTimeout(() => {
        backdrop.remove();
        resolve();
      }, 250);
    }, 450);
  });
}

/**
 * Permite actualizar manualmente el progreso del overlay activo.
 */
export function updateLoadingProgress(percent, message) {
  if (activeLoadingOverlay) {
    activeLoadingOverlay.setPercent(percent, message);
  }
}

// Registro global en window para uso directo desde cualquier script
if (typeof window !== 'undefined') {
  window.showConfirmModal = showConfirmModal;
  window.showAlertModal = showAlertModal;
  window.showLoadingOverlay = showLoadingOverlay;
  window.hideLoadingOverlay = hideLoadingOverlay;
  window.updateLoadingProgress = updateLoadingProgress;
}
