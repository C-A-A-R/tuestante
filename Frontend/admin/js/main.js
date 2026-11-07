/**
 * ==========================================================================
 * TUESTANTE ADMIN - ENTRY POINT PRINCIPAL (MAIN.JS)
 * ==========================================================================
 * Inicializa el Navbar, el cual trae y orquesta automáticamente el Drawer,
 * el Favicon de pestaña y el título dinámico de pantalla.
 */

import { initNavbar, setNavbarTitle, setAutoFavicon } from '../components/navbar/navbar.js';
import { initDrawer } from '../components/drawer/drawer.js';

document.addEventListener('DOMContentLoaded', () => {
  // Inicialización del Navbar (trae automáticamente el Drawer y Favicon)
  const navbar = initNavbar();
  window.TuEstanteNavbar = navbar;

  console.log('%c[TuEstante Admin] Navbar & Drawer inicializados con éxito.', 'background: #005187; color: #fff; padding: 4px 8px; border-radius: 4px;');
});

export { initNavbar, initDrawer, setNavbarTitle, setAutoFavicon };
