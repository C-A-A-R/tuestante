/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR MODULAR DEL COMPONENTE FOOTER (FOOTER.JS)
 * ==========================================================================
 * Maneja la inyección automática de estilos, año dinámico y soporte de rutas.
 */

import { getBasePathPrefix } from '../drawer/drawer.js';

/**
 * Inyecta dinámicamente la hoja de estilo del Footer si no está presente en el <head>
 */
function ensureFooterStylesExist() {
  const prefix = getBasePathPrefix();
  if (!document.querySelector('link[href*="footer.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${prefix}components/footer/footer.css`;
    document.head.appendChild(link);
  }
}

/**
 * Inicializa e inyecta el Footer simple en el documento
 */
export function initFooter() {
  ensureFooterStylesExist();

  const currentYear = new Date().getFullYear();

  // 1. Si el elemento ya existe en el DOM, actualizar el año
  const existingYear = document.getElementById('footer-current-year');
  if (existingYear) {
    existingYear.textContent = currentYear;
  }

  // 2. Si no existe el footer en el DOM, insertarlo automáticamente al final de .app-layout o body
  if (!document.getElementById('admin-footer')) {
    const footerMarkup = `
      <footer id="admin-footer" class="admin-footer" role="contentinfo">
        <div class="footer-container">
          <div class="footer-left">
            <span class="footer-copyright">
              © <span id="footer-current-year">${currentYear}</span> <strong>TuEstante</strong>. Todos los derechos reservados.
            </span>
          </div>
          <div class="footer-right">
            <span class="footer-system-badge">
              <span class="status-indicator-dot"></span>
              Sistema Operativo TuEstante OMS
            </span>
            <span class="footer-divider" aria-hidden="true">•</span>
            <span class="footer-version">v1.0.0</span>
            <span class="footer-divider" aria-hidden="true">•</span>
            <a href="https://wa.me/584266272286" target="_blank" rel="noopener noreferrer" class="footer-link">Soporte Técnico</a>
          </div>
        </div>
      </footer>
    `;

    const appLayout = document.getElementById('app-layout') || document.querySelector('.app-layout');
    if (appLayout) {
      appLayout.insertAdjacentHTML('beforeend', footerMarkup);
    } else {
      document.body.insertAdjacentHTML('beforeend', footerMarkup);
    }
  }
}

// Auto-inicialización global si se importa directamente
if (typeof window !== 'undefined') {
  window.initFooter = initFooter;
}
