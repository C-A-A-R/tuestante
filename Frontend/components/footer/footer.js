/**
 * Ajusta dinámicamente las rutas de enlaces en el footer
 * dependiendo de si la página actual está en el directorio raíz o dentro de un módulo.
 * @param {HTMLElement} footer Elemento principal del footer
 */
function fixFooterPaths(footer) {
  const isModulePath = window.location.pathname.includes('/modules/');
  const prefix = isModulePath ? '../../' : '';

  // 1. Enlace Inicio
  const inicioLink = footer.querySelector('[data-link="inicio"]') || footer.querySelector('a[href*="inicio"]');
  if (inicioLink) {
    const target = `${prefix}index.html#inicio`;
    inicioLink.setAttribute('href', target);
    inicioLink.addEventListener('click', (e) => {
      e.preventDefault();
      const isIndexPage = !window.location.pathname.includes('/modules/') && 
                          (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '');
      if (isIndexPage) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (history.pushState) {
          history.pushState(null, null, window.location.pathname);
        }
        return;
      }
      window.location.href = target;
    });
  }

  // 2. Enlace Productos
  const productosLink = footer.querySelector('[data-link="productos"]') || footer.querySelector('a[href*="product"]');
  if (productosLink) {
    const target = `${prefix}modules/product/products.html`;
    productosLink.setAttribute('href', target);
    productosLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = target;
    });
  }

  // 3. Enlace Galería
  const galeriaLink = footer.querySelector('[data-link="galeria"]') || footer.querySelector('a[href*="gallery"]');
  if (galeriaLink) {
    const target = `${prefix}modules/gallery/gallery.html`;
    galeriaLink.setAttribute('href', target);
    galeriaLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = target;
    });
  }

  // 4. Enlace Nosotros
  const nosotrosLink = footer.querySelector('[data-link="nosotros"]') || footer.querySelector('a[href*="us"]');
  if (nosotrosLink) {
    const target = `${prefix}modules/us/us.html`;
    nosotrosLink.setAttribute('href', target);
    nosotrosLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = target;
    });
  }

  // 4. Enlace Contacto
  const contactoLinks = footer.querySelectorAll('[data-link="contacto"], a[href*="contacto"]');
  contactoLinks.forEach(link => {
    const target = `${prefix}index.html#contacto`;
    link.setAttribute('href', target);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const isIndexPage = !window.location.pathname.includes('/modules/') && 
                          (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '');
      if (isIndexPage) {
        const contactSection = document.getElementById('contacto') || document.getElementById('contactos');
        if (contactSection) {
          contactSection.scrollIntoView({ behavior: 'smooth' });
          if (history.pushState) {
            history.pushState(null, null, '#contacto');
          }
          return;
        }
      }
      window.location.href = target;
    });
  });
}

/**
 * Inicializa el comportamiento del footer.
 */
export function initFooter() {
  const footer = document.querySelector('.app-footer');
  if (!footer) return;
  fixFooterPaths(footer);
}
