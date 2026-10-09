/**
 * ==========================================================================
 * COMPONENTE REUTILIZABLE DE NOTIFICACIONES TOAST - TUESTANTE
 * Muestra notificaciones emergentes elegantes en la esquina superior de la pantalla
 * para casos de éxito, errores de validación, alertas informativas o advertencias.
 * ==========================================================================
 */

let toastContainer = null;

function ensureToastStyles() {
    if (!document.getElementById('tuestante-toast-css')) {
        const link = document.createElement('link');
        link.id = 'tuestante-toast-css';
        link.rel = 'stylesheet';
        const isModulePage = window.location.pathname.includes('/modules/');
        link.href = isModulePage ? '../../components/toast/toast.css' : 'components/toast/toast.css';
        document.head.appendChild(link);
    }
}

function ensureToastContainer() {
    ensureToastStyles();
    if (!toastContainer || !document.body.contains(toastContainer)) {
        toastContainer = document.getElementById('tuestante-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'tuestante-toast-container';
            toastContainer.className = 'tuestante-toast-container';
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

const TOAST_ICONS = {
    success: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    `,
    error: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
    `,
    warning: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
    `,
    info: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    `
};

/**
 * Muestra una notificación emergente Toast en pantalla.
 * @param {Object} options Opciones de configuración
 * @param {'success'|'error'|'warning'|'info'} [options.type='info'] Tipo de notificación
 * @param {string} options.title Título principal del mensaje
 * @param {string} options.message Descripción o cuerpo del mensaje
 * @param {number} [options.duration=5000] Tiempo en milisegundos antes de auto-cerrarse (0 para no auto-cerrar)
 * @returns {HTMLElement} Elemento DOM del Toast
 */
export function showToast({ type = 'info', title = '', message = '', duration = 5000 } = {}) {
    const container = ensureToastContainer();
    const validTypes = ['success', 'error', 'warning', 'info'];
    const finalType = validTypes.includes(type) ? type : 'info';

    const toast = document.createElement('div');
    toast.className = `tuestante-toast tuestante-toast-${finalType}`;
    toast.setAttribute('role', 'alert');

    const iconSvg = TOAST_ICONS[finalType];

    toast.innerHTML = `
        <div class="tuestante-toast-icon-wrapper">
            ${iconSvg}
        </div>
        <div class="tuestante-toast-content">
            ${title ? `<h4 class="tuestante-toast-title">${title}</h4>` : ''}
            ${message ? `<p class="tuestante-toast-message">${message}</p>` : ''}
        </div>
        <button class="tuestante-toast-close" aria-label="Cerrar notificación">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
        ${duration > 0 ? `<div class="tuestante-toast-progress" style="animation-duration: ${duration}ms;"></div>` : ''}
    `;

    container.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    let dismissTimer = null;

    const dismiss = () => {
        if (dismissTimer) clearTimeout(dismissTimer);
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 320);
    };

    const closeBtn = toast.querySelector('.tuestante-toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', dismiss);
    }

    if (duration > 0) {
        dismissTimer = setTimeout(dismiss, duration);

        // Pausar auto-cierre al pasar el mouse por encima
        toast.addEventListener('mouseenter', () => {
            if (dismissTimer) clearTimeout(dismissTimer);
            const progress = toast.querySelector('.tuestante-toast-progress');
            if (progress) progress.style.animationPlayState = 'paused';
        });

        toast.addEventListener('mouseleave', () => {
            dismissTimer = setTimeout(dismiss, 2000);
            const progress = toast.querySelector('.tuestante-toast-progress');
            if (progress) {
                progress.style.animationPlayState = 'running';
            }
        });
    }

    return toast;
}

/**
 * Atajo para mostrar Toast de Éxito.
 */
export function showSuccessToast(title, message, duration = 5000) {
    return showToast({ type: 'success', title, message, duration });
}

/**
 * Atajo para mostrar Toast de Error.
 */
export function showErrorToast(title, message, duration = 6000) {
    return showToast({ type: 'error', title, message, duration });
}

/**
 * Atajo para mostrar Toast de Advertencia.
 */
export function showWarningToast(title, message, duration = 5000) {
    return showToast({ type: 'warning', title, message, duration });
}

/**
 * Atajo para mostrar Toast Informativo.
 */
export function showInfoToast(title, message, duration = 5000) {
    return showToast({ type: 'info', title, message, duration });
}
