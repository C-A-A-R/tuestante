/**
 * ==========================================================================
 * TUESTANTE - COMPONENTE FOOTER TRABAJADOR
 * ==========================================================================
 */

/**
 * Renderiza el HTML del footer en el contenedor especificado
 */
export function renderFooter(placeholderId = 'footer-placeholder') {
  const container = document.getElementById(placeholderId);
  if (!container) return;
  const year = new Date().getFullYear();
  container.innerHTML = `
    <footer class="footer-trabajador" id="footer-trabajador" role="contentinfo">
      <div class="footer-container">
        <div class="footer-grid">
          <!-- Columna 1: Identidad y Políticas de Consumo -->
          <div class="footer-col footer-about">
            <div class="footer-brand">
              <span class="footer-brand-title">TuEstante</span>
              <span class="footer-brand-badge">TIENDA INTERNA</span>
            </div>
            <p class="footer-text-policy">
              El consumo interno de productos y suministros se regula bajo el sistema de deducción y descuento directo de nómina, conforme al reglamento interno de trabajo y acuerdos de bienestar laboral.
            </p>
          </div>

          <!-- Columna 2: Canales de Atención RRHH -->
          <div class="footer-col footer-col-rrhh">
            <span class="footer-pretitle">Dirígete:</span>
            <h4 class="footer-heading">Recursos Humanos</h4>
            <p class="footer-contact-desc">Para consultas sobre límites de crédito, deducciones salariales y comprobantes:</p>
            <ul class="footer-contact-list">
              <li>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <a href="mailto:rrhh@tuestante.com">rrhh@tuestante.com</a>
              </li>
            </ul>
          </div>

          <!-- Columna 3: Canales de Bodega y Despacho -->
          <div class="footer-col footer-col-bodega">
            <h4 class="footer-heading">Bodega y Entrega</h4>
            <p class="footer-contact-desc">Para retiro físico de pedidos confirmados y verificación de inventario:</p>
            <ul class="footer-contact-list">
              <li>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Lunes a Viernes: 8:00 AM - 5:00 PM</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <p class="footer-copy">&copy; ${year} TuEstante C.A. Todos los derechos reservados. Portal exclusivo para personal activo.</p>
          <div class="footer-badges">
            <span class="badge badge-primary">Descuento de Nómina</span>
            <span class="badge badge-success">Sin Intereses</span>
          </div>
        </div>
      </div>
    </footer>
  `;
}

export function initFooter(placeholderId = 'footer-placeholder') {
  const placeholder = document.getElementById(placeholderId);
  const footerCheck = document.getElementById('footer-trabajador');
  if (placeholder && !footerCheck) {
    renderFooter(placeholderId);
  }

  const copyEl = document.querySelector('.footer-copy');
  if (copyEl) {
    const year = new Date().getFullYear();
    copyEl.innerHTML = `&copy; ${year} TuEstante C.A. Todos los derechos reservados. Portal exclusivo para personal activo.`;
  }
}
