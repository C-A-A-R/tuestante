/**
 * ==========================================================================
 * TUESTANTE ADMIN - UTILITY DE CARGA DINÁMICA DE COMPONENTES
 * ==========================================================================
 * Permite cargar fragmentos de componentes HTML (Navbar, Drawer, Footer)
 * e inyectarlos en placeholders dentro del DOM.
 */

import { getBasePathPrefix } from '../drawer/drawer.js';

/**
 * Carga un componente HTML dinámicamente y lo inserta en un contenedor placeholder.
 * @param {string} placeholderId ID del elemento contenedor en el DOM
 * @param {string} relativeComponentPath Ruta del componente desde /admin (ej. 'components/navbar/navbar.html')
 * @returns {Promise<string|void>} HTML cargado o void si falla
 */
export async function loadComponent(placeholderId, relativeComponentPath) {
  try {
    const prefix = getBasePathPrefix();
    let finalPath = relativeComponentPath;
    
    // Si la ruta no es absoluta ni empieza con relativa explícita (./ o ../), aplicar prefijo
    if (!relativeComponentPath.startsWith('/') && !relativeComponentPath.startsWith('.')) {
      finalPath = prefix + relativeComponentPath;
    }

    const url = finalPath.includes('?') ? `${finalPath}&_t=${Date.now()}` : `${finalPath}?_t=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`Error al cargar el componente desde ${finalPath}: ${response.statusText}`);
    }

    const html = await response.text();
    // Limpiar posibles etiquetas de cierre o scripts de live-server inyectados
    let cleanHtml = html
      .replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, '')
      .replace(/<\/body>/gi, '');

    // Si estamos en una subcarpeta (ej. /modules/...), ajustar rutas relativas (href y src)
    if (prefix) {
      cleanHtml = adjustRelativePaths(cleanHtml, prefix);
    }

    const container = document.getElementById(placeholderId);
    if (container) {
      container.innerHTML = cleanHtml;
    } else {
      console.warn(`[TuEstante ComponentLoader] No se encontró el contenedor placeholder con ID: #${placeholderId}`);
    }
    return cleanHtml;
  } catch (error) {
    console.error(`[TuEstante ComponentLoader] Error cargando componente desde ${relativeComponentPath}:`, error);
  }
}

/**
 * Ajusta rutas relativas de href y src en fragmentos HTML inyectados
 * @param {string} html Código HTML a transformar
 * @param {string} prefix Prefijo relativo a prepender (ej. '../../')
 * @returns {string} HTML con rutas actualizadas
 */
export function adjustRelativePaths(html, prefix) {
  if (!prefix) return html;

  // Reemplazar href y src que sean rutas relativas internas
  return html.replace(/\b(href|src)=([\"\'])([^\"\']+)\2/gi, (match, attr, quote, val) => {
    if (
      val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.startsWith('#') ||
      val.startsWith('/') ||
      val.startsWith('../') ||
      val.startsWith('javascript:') ||
      val.startsWith('mailto:') ||
      val.startsWith('tel:') ||
      val.startsWith('data:')
    ) {
      return match;
    }
    return `${attr}=${quote}${prefix}${val}${quote}`;
  });
}

