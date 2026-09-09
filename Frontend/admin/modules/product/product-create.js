/**
 * ==========================================================================
 * CONTROLADOR - CREACIÓN DE PRODUCTOS (PRODUCT-CREATE.JS) - TUESTANTE OMS
 * Gestiona el formulario completo con soporte para:
 * - Variantes de color personalizadas (ProductColorImage)
 * - Múltiples ángulos y perspectivas del mueble (ProductAngleImage)
 * - Nuevo campo: Producto Outlet / Liquidación (is_outlet)
 * - Cálculo automático a Bolívares según tasa oficial BCV
 * - Previsualización reactiva en vivo estilo tarjeta de catálogo
 * - Notificaciones Toast (sin window.alert)
 * ==========================================================================
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { getProductTypes, createProduct } from './product.api.js';
import { getOfficialRate } from '../../js/service/exchange-rate.service.js';
import { formatUSD, formatVES, convertUsdToVes } from '../../js/service/currency-converter.service.js';

// Estado local del formulario reactivo
const state = {
  productTypes: [],
  exchangeRate: 791.32,
  mainImage: '../../assets/images/products/tipo-producto-estante.png',
  mainImageFile: null,
  videoUrl: '',
  colors: [
    {
      id: 1,
      color_name: 'Roble Natural',
      color_hex: '#A67C52',
      image: '../../assets/images/products/tipo-producto-estante.png',
      file: null
    },
    {
      id: 2,
      color_name: 'Negro Mate',
      color_hex: '#101010',
      image: '../../assets/images/products/armario-blanco.png',
      file: null
    }
  ],
  angles: [
    {
      id: 1,
      angle: 'Vista Frontal',
      image: '../../assets/images/products/tipo-producto-estante.png',
      file: null
    },
    {
      id: 2,
      angle: 'Perspectiva 3/4',
      image: '../../assets/images/products/armario-blanco.png',
      file: null
    }
  ],
  isSubmitting: false
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar componentes (Navbar + Drawer + Footer)
  await loadAdminComponents({ title: 'Crear Producto' });
  highlightDrawerLink();

  // 2. Obtener Tasa de Cambio BCV
  try {
    const rate = await getOfficialRate();
    if (rate > 0) {
      state.exchangeRate = rate;
    }
  } catch (e) {
    console.warn('[Crear Producto] Usando tasa fallback:', e);
  }

  // 3. Cargar Tipos de Productos
  await loadProductTypesSelect();

  // 4. Renderizar listas iniciales de Colores y Ángulos
  renderColorVariants();
  renderAngleVariants();

  // 5. Vincular Eventos de Interacción
  setupFormEvents();
  setupMainImageEvents();
  setupColorPresetButtons();
  setupLivePreviewSync();

  // 6. Actualizar Vista Previa inicial
  updateLivePreview();
});

/**
 * Resalta la pestaña de Productos en el menú lateral
 */
function highlightDrawerLink() {
  setTimeout(() => {
    document.querySelectorAll('.drawer-link, .drawer-submenu-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-nav-id') === 'productos') {
        link.classList.add('active');
      }
    });

    const submenu = document.getElementById('submenu-productos');
    const toggle = document.querySelector('[aria-controls="submenu-productos"]');
    if (submenu && toggle) {
      submenu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  }, 200);
}

// ==========================================================================
// CARGA DE TIPOS DE PRODUCTO
// ==========================================================================

async function loadProductTypesSelect() {
  const select = document.getElementById('select-product-type');
  if (!select) return;

  try {
    const types = await getProductTypes();
    state.productTypes = types;

    select.innerHTML = '<option value="" disabled selected>Selecciona un tipo de producto...</option>';
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.product_type_name;
      select.appendChild(opt);
    });

    // Seleccionar el primero por defecto si existe
    if (types.length > 0) {
      select.value = types[0].id;
      const previewType = document.getElementById('preview-mockup-type');
      if (previewType) previewType.textContent = types[0].product_type_name;
    }
  } catch (err) {
    console.error('Error al cargar tipos de producto:', err);
  }
}

// ==========================================================================
// MANEJO DE IMAGEN PRINCIPAL (PORTADA)
// ==========================================================================

function setupMainImageEvents() {
  const dropzone = document.getElementById('dropzone-main-image');
  const fileInput = document.getElementById('input-main-image');
  const placeholder = document.getElementById('dropzone-main-placeholder');
  const previewBox = document.getElementById('dropzone-main-preview');
  const previewImg = document.getElementById('img-main-preview');
  const btnRemove = document.getElementById('btn-remove-main-img');

  if (!dropzone || !fileInput) return;

  // Clic en dropzone -> trigger file input
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-remove-main-img')) return;
    fileInput.click();
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleMainImageFile(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleMainImageFile(fileInput.files[0]);
    }
  });

  if (btnRemove) {
    btnRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      state.mainImage = '';
      state.mainImageFile = null;
      fileInput.value = '';
      placeholder.style.display = 'flex';
      previewBox.style.display = 'none';
      updateLivePreview();
    });
  }

  function handleMainImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('warning', 'Archivo no válido', 'Por favor selecciona un archivo de imagen (PNG, JPG, WEBP).');
      return;
    }

    state.mainImageFile = file;
    const objectUrl = URL.createObjectURL(file);
    state.mainImage = objectUrl;

    if (previewImg) previewImg.src = objectUrl;
    if (placeholder) placeholder.style.display = 'none';
    if (previewBox) previewBox.style.display = 'flex';

    updateLivePreview();
  }
}

// ==========================================================================
// GESTIÓN DINÁMICA DE VARIANTES DE COLOR (PRODUCTCOLORIMAGE)
// ==========================================================================

function renderColorVariants() {
  const container = document.getElementById('colors-list-container');
  const countBadge = document.getElementById('badge-color-count');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${state.colors.length} ${state.colors.length === 1 ? 'color' : 'colores'}`;
  }

  if (state.colors.length === 0) {
    container.innerHTML = `
      <div class="empty-state-notice" style="text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem; border: 1px dashed #cbd5e1; border-radius: 8px;">
        No hay colores registrados. Presiona <strong>+ Agregar Color</strong> para añadir variantes cromáticas.
      </div>
    `;
    updateLivePreview();
    return;
  }

  container.innerHTML = state.colors.map((color, index) => `
    <div class="variant-row-card" data-color-id="${color.id}">
      <!-- 1. Muestra y Picker de Color -->
      <div class="color-picker-box" style="background-color: ${escapeHtml(color.color_hex)};">
        <input 
          type="color" 
          class="native-color-picker input-color-picker" 
          value="${escapeHtml(color.color_hex)}" 
          data-index="${index}"
          title="Seleccionar color">
      </div>

      <!-- 2. Código Hexadecimal -->
      <input 
        type="text" 
        class="form-input color-hex-input input-color-hex" 
        value="${escapeHtml(color.color_hex)}" 
        data-index="${index}"
        maxlength="7"
        placeholder="#000000">

      <!-- 3. Nombre del Color -->
      <input 
        type="text" 
        class="form-input input-color-name" 
        value="${escapeHtml(color.color_name)}" 
        data-index="${index}"
        placeholder="Ej: Roble Nórdico, Blanco Polar..." 
        required>

      <!-- 4. Subida de Foto para este color -->
      <div class="variant-thumb-dropzone btn-upload-color-thumb" data-index="${index}" title="Subir foto de este color">
        <input type="file" accept="image/*" class="file-input-hidden input-file-color" data-index="${index}">
        ${color.image ? `
          <img src="${color.image}" alt="${escapeHtml(color.color_name)}" class="variant-thumb-img">
        ` : `
          <span>📷 Foto Color</span>
        `}
      </div>

      <!-- 5. Botón Eliminar Fila -->
      <button type="button" class="btn-remove-row btn-delete-color" data-index="${index}" title="Eliminar color">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `).join('');

  setupColorRowListeners();
  updateLivePreview();
}

function setupColorRowListeners() {
  const container = document.getElementById('colors-list-container');
  if (!container) return;

  // 1. Sincronización Color Picker Nativo
  container.querySelectorAll('.input-color-picker').forEach(picker => {
    picker.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      const hex = e.target.value;
      if (state.colors[idx]) {
        state.colors[idx].color_hex = hex;
        const hexInput = container.querySelector(`.input-color-hex[data-index="${idx}"]`);
        if (hexInput) hexInput.value = hex;
        e.target.closest('.color-picker-box').style.backgroundColor = hex;
        updateLivePreview();
      }
    });
  });

  // 2. Input Hexadecimal manual
  container.querySelectorAll('.input-color-hex').forEach(hexInput => {
    hexInput.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      let val = e.target.value.trim();
      if (!val.startsWith('#') && val.length > 0) val = '#' + val;
      if (state.colors[idx]) {
        state.colors[idx].color_hex = val;
        const picker = container.querySelector(`.input-color-picker[data-index="${idx}"]`);
        if (picker && /^#[0-9A-Fa-f]{6}$/.test(val)) {
          picker.value = val;
          picker.closest('.color-picker-box').style.backgroundColor = val;
        }
        updateLivePreview();
      }
    });
  });

  // 3. Input Nombre del Color
  container.querySelectorAll('.input-color-name').forEach(nameInput => {
    nameInput.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      if (state.colors[idx]) {
        state.colors[idx].color_name = e.target.value;
        updateLivePreview();
      }
    });
  });

  // 4. Carga de archivo para foto de color
  container.querySelectorAll('.input-file-color').forEach(fileInput => {
    fileInput.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      if (e.target.files && e.target.files[0] && state.colors[idx]) {
        const file = e.target.files[0];
        state.colors[idx].file = file;
        state.colors[idx].image = URL.createObjectURL(file);
        renderColorVariants();
      }
    });
  });

  // 5. Eliminar color
  container.querySelectorAll('.btn-delete-color').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      state.colors.splice(idx, 1);
      renderColorVariants();
    });
  });
}

function setupColorPresetButtons() {
  document.querySelectorAll('.chip-preset-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const hex = chip.getAttribute('data-hex');
      const name = chip.getAttribute('data-name');

      // Si ya existe una fila vacía o genérica, la actualizamos; si no, añadimos una nueva variante
      const lastColor = state.colors[state.colors.length - 1];
      if (lastColor && (!lastColor.color_name || lastColor.color_name.startsWith('Color'))) {
        lastColor.color_hex = hex;
        lastColor.color_name = name;
      } else {
        state.colors.push({
          id: Date.now(),
          color_name: name,
          color_hex: hex,
          image: state.mainImage || '../../assets/images/products/tipo-producto-estante.png',
          file: null
        });
      }

      renderColorVariants();
      showToast('info', 'Color aplicado', `Se asignó ${name} (${hex})`);
    });
  });

  // Botón "+ Agregar Color"
  const btnAddColor = document.getElementById('btn-add-color-variant');
  if (btnAddColor) {
    btnAddColor.addEventListener('click', () => {
      state.colors.push({
        id: Date.now(),
        color_name: `Color ${state.colors.length + 1}`,
        color_hex: '#005187',
        image: state.mainImage || '',
        file: null
      });
      renderColorVariants();
    });
  }
}

// ==========================================================================
// GESTIÓN DINÁMICA DE ÁNGULOS Y VISTAS (PRODUCTANGLEIMAGE)
// ==========================================================================

function renderAngleVariants() {
  const container = document.getElementById('angles-list-container');
  const countBadge = document.getElementById('badge-angle-count');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${state.angles.length} ${state.angles.length === 1 ? 'ángulo' : 'ángulos'}`;
  }

  if (state.angles.length === 0) {
    container.innerHTML = `
      <div class="empty-state-notice" style="text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem; border: 1px dashed #cbd5e1; border-radius: 8px;">
        No hay ángulos registrados. Presiona <strong>+ Agregar Ángulo</strong> para añadir perspectivas fotográficas.
      </div>
    `;
    updateLivePreview();
    return;
  }

  const suggestedAngles = [
    'Vista Frontal',
    'Vista Lateral Izquierda',
    'Vista Lateral Derecha',
    'Perspectiva 3/4',
    'Vista Superior',
    'Vista Posterior',
    'Detalle de Ensamblaje',
    'Foto Ambiental / Decorativa'
  ];

  container.innerHTML = state.angles.map((angleObj, index) => `
    <div class="angle-row-card" data-angle-id="${angleObj.id}">
      
      <!-- 1. Selector de Tipo de Ángulo -->
      <select class="form-select select-angle-type" data-index="${index}">
        ${suggestedAngles.map(ang => `
          <option value="${ang}" ${angleObj.angle === ang ? 'selected' : ''}>${ang}</option>
        `).join('')}
        ${!suggestedAngles.includes(angleObj.angle) && angleObj.angle ? `
          <option value="${escapeHtml(angleObj.angle)}" selected>${escapeHtml(angleObj.angle)}</option>
        ` : ''}
      </select>

      <!-- 2. Nombre personalizado opcional -->
      <input 
        type="text" 
        class="form-input input-angle-custom" 
        value="${escapeHtml(angleObj.angle)}" 
        data-index="${index}"
        placeholder="Nombre del ángulo o descripción...">

      <!-- 3. Subida de Imagen del Ángulo -->
      <div class="variant-thumb-dropzone btn-upload-angle-thumb" data-index="${index}" title="Subir foto para este ángulo">
        <input type="file" accept="image/*" class="file-input-hidden input-file-angle" data-index="${index}">
        ${angleObj.image ? `
          <img src="${angleObj.image}" alt="${escapeHtml(angleObj.angle)}" class="variant-thumb-img">
        ` : `
          <span>📷 Foto Ángulo</span>
        `}
      </div>

      <!-- 4. Botón Eliminar Fila -->
      <button type="button" class="btn-remove-row btn-delete-angle" data-index="${index}" title="Eliminar ángulo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>

    </div>
  `).join('');

  setupAngleRowListeners();
  updateLivePreview();
}

function setupAngleRowListeners() {
  const container = document.getElementById('angles-list-container');
  if (!container) return;

  // 1. Selector de Ángulo
  container.querySelectorAll('.select-angle-type').forEach(select => {
    select.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      const val = e.target.value;
      if (state.angles[idx]) {
        state.angles[idx].angle = val;
        const customInput = container.querySelector(`.input-angle-custom[data-index="${idx}"]`);
        if (customInput) customInput.value = val;
        updateLivePreview();
      }
    });
  });

  // 2. Input Texto personalizado de Ángulo
  container.querySelectorAll('.input-angle-custom').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      if (state.angles[idx]) {
        state.angles[idx].angle = e.target.value;
        updateLivePreview();
      }
    });
  });

  // 3. Subida de Archivo para Ángulo
  container.querySelectorAll('.input-file-angle').forEach(fileInput => {
    fileInput.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      if (e.target.files && e.target.files[0] && state.angles[idx]) {
        const file = e.target.files[0];
        state.angles[idx].file = file;
        state.angles[idx].image = URL.createObjectURL(file);
        renderAngleVariants();
      }
    });
  });

  // 4. Eliminar Ángulo
  container.querySelectorAll('.btn-delete-angle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      state.angles.splice(idx, 1);
      renderAngleVariants();
    });
  });

  // Botón "+ Agregar Ángulo"
  const btnAddAngle = document.getElementById('btn-add-angle-variant');
  if (btnAddAngle) {
    btnAddAngle.onclick = () => {
      const defaultOptions = ['Perspectiva 3/4', 'Vista Lateral', 'Vista Superior', 'Detalle de Ensamblaje'];
      const nextAngle = defaultOptions[state.angles.length % defaultOptions.length] || `Ángulo ${state.angles.length + 1}`;
      state.angles.push({
        id: Date.now(),
        angle: nextAngle,
        image: state.mainImage || '',
        file: null
      });
      renderAngleVariants();
    };
  }
}

// ==========================================================================
// PREVISUALIZACIÓN EN VIVO REACTIVA (LIVE STORE MOCKUP)
// ==========================================================================

function setupLivePreviewSync() {
  const nameInput = document.getElementById('input-product-name');
  const typeSelect = document.getElementById('select-product-type');
  const priceInput = document.getElementById('input-product-price');
  const heightInput = document.getElementById('input-product-height');
  const widthInput = document.getElementById('input-product-width');
  const depthInput = document.getElementById('input-product-depth');
  const switchActive = document.getElementById('switch-is-active');
  const switchOutlet = document.getElementById('switch-is-outlet');
  const switchFeatured = document.getElementById('switch-is-featured');
  const videoInput = document.getElementById('input-product-video');

  // Eventos de entrada
  [nameInput, typeSelect, priceInput, heightInput, widthInput, depthInput].forEach(el => {
    if (el) el.addEventListener('input', updateLivePreview);
  });

  [switchActive, switchOutlet, switchFeatured, typeSelect].forEach(el => {
    if (el) el.addEventListener('change', updateLivePreview);
  });

  if (videoInput) {
    videoInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      state.videoUrl = val;
      const playerFrame = document.getElementById('video-preview-container');
      const player = document.getElementById('video-preview-player');
      if (playerFrame && player) {
        if (val && (val.endsWith('.mp4') || val.includes('video'))) {
          player.src = val;
          playerFrame.style.display = 'block';
        } else {
          playerFrame.style.display = 'none';
        }
      }
    });
  }
}

function updateLivePreview() {
  const nameVal = document.getElementById('input-product-name')?.value.trim() || 'Nombre del Producto';
  const priceVal = parseFloat(document.getElementById('input-product-price')?.value) || 0;
  const typeSelect = document.getElementById('select-product-type');
  const selectedType = typeSelect && typeSelect.selectedIndex >= 0 && typeSelect.options[typeSelect.selectedIndex] 
    ? typeSelect.options[typeSelect.selectedIndex].textContent 
    : 'Mobiliario Modular';

  const h = document.getElementById('input-product-height')?.value.trim() || '—';
  const w = document.getElementById('input-product-width')?.value.trim() || '—';
  const d = document.getElementById('input-product-depth')?.value.trim() || '—';

  const isActive = document.getElementById('switch-is-active')?.checked ?? true;
  const isOutlet = document.getElementById('switch-is-outlet')?.checked ?? false;
  const isFeatured = document.getElementById('switch-is-featured')?.checked ?? false;

  // 1. Textos principales
  const elTitle = document.getElementById('preview-mockup-title');
  const elType = document.getElementById('preview-mockup-type');
  const elUsd = document.getElementById('preview-mockup-usd');
  const elVes = document.getElementById('preview-mockup-ves');
  const elVesConverted = document.getElementById('price-ves-converted');
  const elSpecs = document.getElementById('preview-specs-text');
  const elImg = document.getElementById('preview-mockup-img');

  if (elTitle) elTitle.textContent = nameVal;
  if (elType) elType.textContent = selectedType;
  if (elSpecs) elSpecs.textContent = `${h} x ${w} x ${d} cm`;

  // Precios
  const priceVesNum = priceVal * state.exchangeRate;
  if (elUsd) elUsd.textContent = `$${priceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (elVes) elVes.textContent = `${priceVesNum.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
  if (elVesConverted) {
    elVesConverted.innerHTML = `Equivalente: <strong>${priceVesNum.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.</strong> <span class="bcv-rate-hint">(${state.exchangeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs/$)</span>`;
  }

  // 2. Imagen en Mockup
  if (elImg && state.mainImage) {
    elImg.src = state.mainImage;
  }

  // 3. Badges de Estado
  const badgeOutlet = document.getElementById('preview-badge-outlet');
  const badgeFeatured = document.getElementById('preview-badge-featured');
  const statusTag = document.getElementById('preview-status-tag');

  if (badgeOutlet) badgeOutlet.style.display = isOutlet ? 'inline-block' : 'none';
  if (badgeFeatured) badgeFeatured.style.display = isFeatured ? 'inline-block' : 'none';

  if (statusTag) {
    if (isActive) {
      statusTag.textContent = 'Activo';
      statusTag.classList.remove('is-inactive');
    } else {
      statusTag.textContent = 'Inactivo';
      statusTag.classList.add('is-inactive');
    }
  }

  // 4. Muestras de Colores
  const colorsContainer = document.getElementById('preview-mockup-colors');
  if (colorsContainer) {
    if (state.colors.length > 0) {
      colorsContainer.innerHTML = state.colors.map(c => `
        <span 
          class="mockup-color-dot" 
          style="background-color: ${escapeHtml(c.color_hex)};" 
          title="${escapeHtml(c.color_name)}"
          data-image="${c.image || state.mainImage}">
        </span>
      `).join('');

      colorsContainer.querySelectorAll('.mockup-color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const imgUrl = dot.getAttribute('data-image');
          if (elImg && imgUrl) elImg.src = imgUrl;
          colorsContainer.querySelectorAll('.mockup-color-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
        });
      });
    } else {
      colorsContainer.innerHTML = '';
    }
  }

  // 5. Miniaturas de Ángulos
  const anglesContainer = document.getElementById('preview-mockup-angles');
  if (anglesContainer) {
    if (state.angles.length > 0 && state.angles.some(a => a.image)) {
      anglesContainer.innerHTML = state.angles.filter(a => a.image).map(a => `
        <img 
          src="${a.image}" 
          alt="${escapeHtml(a.angle)}" 
          class="mockup-angle-thumb" 
          title="${escapeHtml(a.angle)}">
      `).join('');

      anglesContainer.querySelectorAll('.mockup-angle-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          if (elImg) elImg.src = thumb.src;
          anglesContainer.querySelectorAll('.mockup-angle-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        });
      });
    } else {
      anglesContainer.innerHTML = '';
    }
  }

  // 6. Checklist de Publicación
  const checkName = document.getElementById('check-name');
  const checkPrice = document.getElementById('check-price');
  const checkType = document.getElementById('check-type');
  const checkMedia = document.getElementById('check-media');

  if (checkName) checkName.classList.toggle('is-valid', nameVal.length >= 3 && nameVal !== 'Nombre del Producto');
  if (checkPrice) checkPrice.classList.toggle('is-valid', priceVal > 0);
  if (checkType) checkType.classList.toggle('is-valid', !!typeSelect?.value);
  if (checkMedia) checkMedia.classList.toggle('is-valid', Boolean(state.mainImage || state.colors.some(c => c.image)));
}

// ==========================================================================
// ENVÍO DEL FORMULARIO Y VALIDACIÓN
// ==========================================================================

function setupFormEvents() {
  const form = document.getElementById('form-create-product');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.isSubmitting) return;

    // 1. Validaciones
    const name = document.getElementById('input-product-name')?.value.trim();
    const typeId = document.getElementById('select-product-type')?.value;
    const price = parseFloat(document.getElementById('input-product-price')?.value);

    if (!name || name.length < 2) {
      showToast('error', 'Campo requerido', 'Por favor ingresa un nombre válido para el producto.');
      document.getElementById('input-product-name')?.focus();
      return;
    }

    if (!typeId) {
      showToast('error', 'Campo requerido', 'Por favor selecciona el tipo de producto.');
      document.getElementById('select-product-type')?.focus();
      return;
    }

    if (isNaN(price) || price <= 0) {
      showToast('error', 'Precio inválido', 'El precio en USD debe ser mayor a $0.00.');
      document.getElementById('input-product-price')?.focus();
      return;
    }

    // 2. Armar Payload
    const height_cm = parseFloat(document.getElementById('input-product-height')?.value) || 0;
    const width_cm = parseFloat(document.getElementById('input-product-width')?.value) || 0;
    const depth_cm = parseFloat(document.getElementById('input-product-depth')?.value) || 0;
    const security = document.getElementById('input-product-security')?.value.trim() || '';
    const description = document.getElementById('textarea-product-desc')?.value.trim() || '';
    
    const is_active = document.getElementById('switch-is-active')?.checked ?? true;
    const is_outlet = document.getElementById('switch-is-outlet')?.checked ?? false;
    const is_feature_product = document.getElementById('switch-is-featured')?.checked ?? false;
    const product_video = document.getElementById('input-product-video')?.value.trim() || '';

    // Portada principal
    let product_image = state.mainImage || '../../assets/images/products/tipo-producto-estante.png';
    if (state.colors.length > 0 && state.colors[0].image && (!state.mainImage || state.mainImage.includes('logo.jpeg'))) {
      product_image = state.colors[0].image;
    }

    // Variantes de color preparadas
    const color_images = state.colors.map(c => ({
      color_name: c.color_name || 'Color Estándar',
      color_hex: c.color_hex || '#101010',
      image: c.image || product_image,
      color_image: c.image || product_image
    }));

    // Variantes de ángulos preparadas
    const angle_images = state.angles.map(a => ({
      angle: a.angle || 'Vista',
      image: a.image || product_image
    }));

    const payload = {
      product_name: name,
      product_type: parseInt(typeId, 10),
      product_type_id: parseInt(typeId, 10),
      price: price,
      description: description,
      height_cm: height_cm,
      width_cm: width_cm,
      depth_cm: depth_cm,
      security: security,
      is_active: is_active,
      is_outlet: is_outlet,
      is_feature_product: is_feature_product,
      product_image: product_image,
      product_video: product_video,
      color_images: color_images,
      angle_images: angle_images
    };

    // 3. Ejecutar Creación con Spinner
    setSubmittingState(true);

    try {
      const created = await createProduct(payload);
      showToast(
        'success', 
        '¡Producto Creado con Éxito!', 
        `"${created.product_name}" ha sido registrado correctamente en el catálogo.${is_outlet ? ' (Marcado como Outlet)' : ''}`
      );

      // Redirigir al listado tras 1.2 segundos
      setTimeout(() => {
        window.location.href = './products.html';
      }, 1200);

    } catch (err) {
      console.error('Error al registrar producto:', err);
      showToast('error', 'Error al guardar', err.message || 'No se pudo registrar el producto en el servidor.');
      setSubmittingState(false);
    }
  });
}

function setSubmittingState(isSubmitting) {
  state.isSubmitting = isSubmitting;
  const btnMain = document.getElementById('btn-submit-main');
  const btnTop = document.getElementById('btn-save-top');

  [btnMain, btnTop].forEach(btn => {
    if (!btn) return;
    btn.disabled = isSubmitting;
    const spinner = btn.querySelector('.btn-spinner');
    const textSpan = btn.querySelector('.btn-text') || btn.querySelector('span');
    if (spinner) spinner.style.display = isSubmitting ? 'inline-block' : 'none';
    if (textSpan) textSpan.textContent = isSubmitting ? 'Guardando...' : 'Guardar Producto';
  });
}

// ==========================================================================
// NOTIFICACIONES TOAST (SIN WINDOW.ALERT)
// ==========================================================================

function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
