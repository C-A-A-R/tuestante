import { getBasePathPrefix } from '../drawer/drawer.js';
import { loadComponent } from '../utils/component-loader.js';

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
export async function initFooter() {
  ensureFooterStylesExist();

  const currentYear = new Date().getFullYear();

  // 1. Si no existe el footer en el DOM, cargarlo en su placeholder o inyectarlo
  if (!document.getElementById('admin-footer')) {
    if (document.getElementById('footer-placeholder')) {
      await loadComponent('footer-placeholder', 'components/footer/footer.html');
    } else {
      const appLayout = document.getElementById('app-layout') || document.querySelector('.app-layout') || document.body;
      const placeholder = document.createElement('div');
      placeholder.id = 'footer-placeholder';
      appLayout.appendChild(placeholder);
      await loadComponent('footer-placeholder', 'components/footer/footer.html');
    }
  }

  // 2. Actualizar año actual
  const existingYear = document.getElementById('footer-current-year');
  if (existingYear) {
    existingYear.textContent = currentYear;
  }
}

// Auto-inicialización global si se importa directamente
if (typeof window !== 'undefined') {
  window.initFooter = initFooter;
}

