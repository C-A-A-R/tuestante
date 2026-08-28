import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';

/**
 * Carga un componente HTML dinámicamente y lo inserta en un contenedor placeholder.
 * @param {string} placeholderId ID del elemento contenedor en el DOM
 * @param {string} filePath Ruta del archivo HTML a cargar
 */
async function loadComponent(placeholderId, filePath) {
  try {
    const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Error al cargar el componente: ${response.statusText}`);
    }
    const html = await response.text();
    const container = document.getElementById(placeholderId);
    if (container) {
      container.innerHTML = html;
    }
  } catch (error) {
    console.error(`Error cargando el componente desde ${filePath}:`, error);
  }
}

/**
 * Anima los números contadores de la sección de estadísticas al hacerse visibles.
 */
function initStatCounters() {
  const statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length === 0) return;

  let hasAnimated = false;

  const animateCounters = () => {
    statNumbers.forEach(counter => {
      const targetText = counter.getAttribute('data-target') || counter.textContent.trim();
      // Extraer el número base y cualquier prefijo/sufijo (ej: "15+", "5000+", "100%")
      const numericMatch = targetText.match(/\d+/);
      if (!numericMatch) return;

      const targetNum = parseInt(numericMatch[0], 10);
      const prefix = targetText.substring(0, targetText.indexOf(numericMatch[0]));
      const suffix = targetText.substring(targetText.indexOf(numericMatch[0]) + numericMatch[0].length);

      let current = 0;
      const stepTime = Math.max(15, Math.floor(2000 / targetNum));
      
      const timer = setInterval(() => {
        current += Math.ceil(targetNum / 50);
        if (current >= targetNum) {
          current = targetNum;
          clearInterval(timer);
        }
        counter.textContent = `${prefix}${current.toLocaleString()}${suffix}`;
      }, stepTime);
    });
  };

  // Intersection Observer para disparar la animación cuando sea visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        animateCounters();
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });

  const statsSection = document.querySelector('.us-stats-section');
  if (statsSection) {
    observer.observe(statsSection);
  }
}

/**
 * Ajusta los enlaces de navegación del navbar para navegar correctamente a la página de inicio si se encuentra en un módulo.
 */
function adjustNavbarLinks() {
  const navbar = document.querySelector('.app-navbar');
  if (!navbar) return;

  const navLinks = navbar.querySelectorAll('.navbar-link');
  const logoLink = navbar.querySelector('.navbar-logo');

  if (logoLink) {
    logoLink.setAttribute('href', '../../index.html');
  }

  navLinks.forEach(link => {
    const dataLink = link.getAttribute('data-link');
    if (dataLink === 'nosotros') {
      link.classList.add('active');
      link.setAttribute('href', 'us.html');
    } else if (dataLink) {
      link.classList.remove('active');
      link.setAttribute('href', `../../index.html#${dataLink}`);
    }
  });
}

// Inicialización global al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar Navbar y Footer desde sus rutas relativas
  await Promise.all([
    loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
    loadComponent('footer-placeholder', '../../components/footer/footer.html')
  ]);

  // Inicializar funciones interactivas
  initNavbar();
  initFooter();
  adjustNavbarLinks();
  initStatCounters();

  // Clase predeterminada para ajuste de drawer
  document.body.classList.add('drawer-collapsed');
});
