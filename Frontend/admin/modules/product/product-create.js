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
  mainImage: '',
  mainImageFile: null,
  videoFile: null,
  videoUrl: '',
  colors: [],
  angles: [],
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
  setupVideoDropzone();
  setupColorPresetButtons();
  setupAngleEvents();
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
    if (e.target === fileInput) return;
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
      if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
      if (btnRemove) btnRemove.classList.add('hidden');
      if (dropzone) dropzone.classList.remove('has-image');
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

    if (previewImg) { previewImg.src = objectUrl; previewImg.classList.remove('hidden'); }
    if (btnRemove) btnRemove.classList.remove('hidden');
    if (dropzone) dropzone.classList.add('has-image');

    updateLivePreview();
  }
}

// ==========================================================================
// GESTIÓN DE SUBIDA Y REPRODUCCIÓN DE VIDEO DEMOSTRATIVO
// ==========================================================================

function setupVideoDropzone() {
  const dropzone = document.getElementById('video-dropzone');
  const fileInput = document.getElementById('input-product-video-file');
  const emptyState = document.getElementById('video-dropzone-empty');
  const previewState = document.getElementById('video-dropzone-preview');
  const previewPlayer = document.getElementById('video-preview-player');
  const filenameEl = document.getElementById('video-filename');
  const filesizeEl = document.getElementById('video-filesize');
  const btnChange = document.getElementById('btn-change-video');
  const btnRemove = document.getElementById('btn-remove-video');

  if (!dropzone || !fileInput) return;

  // Clic en dropzone
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-change-video') || e.target.closest('#btn-remove-video') || e.target.closest('video')) {
      return;
    }
    if (e.target === fileInput) return;
    if (!state.videoFile && !state.videoUrl) {
      fileInput.click();
    }
  });

  btnChange?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  btnRemove?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearVideo();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleVideoFileSelected(fileInput.files[0]);
    }
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleVideoFileSelected(files[0]);
    }
  });

  function handleVideoFileSelected(file) {
    if (!file.type.startsWith('video/')) {
      showToast('warning', 'Archivo no válido', 'Por favor selecciona un archivo de video (MP4, WEBM, MOV).');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      showToast('warning', 'Video pesado', 'El video supera el tamaño recomendado de 100MB.');
    }

    state.videoFile = file;
    const objectUrl = URL.createObjectURL(file);
    state.videoUrl = objectUrl;

    if (previewPlayer) {
      previewPlayer.src = objectUrl;
    }
    if (filenameEl) filenameEl.textContent = file.name;
    if (filesizeEl) filesizeEl.textContent = formatBytes(file.size);

    emptyState?.classList.add('hidden');
    previewState?.classList.remove('hidden');
    updateLivePreview();
  }

  function clearVideo() {
    state.videoFile = null;
    state.videoUrl = '';
    fileInput.value = '';
    if (previewPlayer) previewPlayer.src = '';
    emptyState?.classList.remove('hidden');
    previewState?.classList.add('hidden');
    updateLivePreview();
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        No hay colores registrados. Presiona <strong>+ Agregar Color</strong> o haz clic en la <strong>Paleta rápida</strong> para añadir acabados.
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
        placeholder="Ej: Azul rey, Morado..." 
        required>

      <!-- 4. Subida de Foto para este color (Sin imagen por defecto) -->
      <div class="variant-thumb-dropzone btn-upload-color-thumb" data-index="${index}" title="Subir foto de este color">
        <input type="file" accept="image/*" class="file-input-hidden input-file-color" data-index="${index}">
        ${color.image ? `
          <img src="${color.image}" alt="${escapeHtml(color.color_name)}" class="variant-thumb-img">
        ` : `
          <div class="thumb-upload-prompt" style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.72rem; color: #64748b; padding: 4px; text-align: center;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 2px;">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span>Subir Foto</span>
          </div>
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

  // 4. Click en dropzone de color para abrir selector de archivo
  container.querySelectorAll('.btn-upload-color-thumb').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const fileInput = thumb.querySelector('.input-file-color');
      if (fileInput) fileInput.click();
    });
  });

  // 5. Carga de archivo para foto de color
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

  // 6. Eliminar color
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
          image: null,
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
        color_hex: '#0272bc',
        image: null,
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

      <!-- 3. Subida de Imagen del Ángulo (Sin imagen por defecto) -->
      <div class="variant-thumb-dropzone btn-upload-angle-thumb" data-index="${index}" title="Subir foto para este ángulo">
        <input type="file" accept="image/*" class="file-input-hidden input-file-angle" data-index="${index}">
        ${angleObj.image ? `
          <img src="${angleObj.image}" alt="${escapeHtml(angleObj.angle)}" class="variant-thumb-img">
        ` : `
          <div class="thumb-upload-prompt" style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.72rem; color: #64748b; padding: 4px; text-align: center;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 2px;">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span>Subir Ángulo</span>
          </div>
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

  // 3. Click en dropzone de ángulo para abrir selector de archivo
  container.querySelectorAll('.btn-upload-angle-thumb').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const fileInput = thumb.querySelector('.input-file-angle');
      if (fileInput) fileInput.click();
    });
  });

  // 4. Subida de Archivo para Ángulo
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

  // 5. Eliminar Ángulo
  container.querySelectorAll('.btn-delete-angle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      state.angles.splice(idx, 1);
      renderAngleVariants();
    });
  });
}

function setupAngleEvents() {
  const btnAddAngle = document.getElementById('btn-add-angle-variant');
  if (btnAddAngle) {
    btnAddAngle.addEventListener('click', () => {
      const defaultOptions = [
        'Vista Frontal',
        'Vista Lateral Izquierda',
        'Vista Lateral Derecha',
        'Perspectiva 3/4',
        'Vista Superior',
        'Vista Posterior',
        'Detalle de Ensamblaje',
        'Foto Ambiental / Decorativa'
      ];
      const nextAngle = defaultOptions[state.angles.length % defaultOptions.length] || `Ángulo ${state.angles.length + 1}`;
      state.angles.push({
        id: Date.now(),
        angle: nextAngle,
        image: null,
        file: null
      });
      renderAngleVariants();
    });
  }
}

// ==========================================================================
// PREVISUALIZACIÓN EN VIVO REACTIVA
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

  // Eventos de entrada
  [nameInput, typeSelect, priceInput, heightInput, widthInput, depthInput].forEach(el => {
    if (el) el.addEventListener('input', updateLivePreview);
  });

  [switchActive, switchOutlet, switchFeatured, typeSelect].forEach(el => {
    if (el) el.addEventListener('change', updateLivePreview);
  });
}

function updateLivePreview() {
  const nameVal = document.getElementById('input-product-name')?.value.trim() || 'Nombre del Producto';
  const priceVal = parseFloat(document.getElementById('input-product-price')?.value) || 0;
  const typeSelect = document.getElementById('select-product-type');
  const selectedType = typeSelect && typeSelect.selectedIndex >= 0 && typeSelect.options[typeSelect.selectedIndex] 
    ? typeSelect.options[typeSelect.selectedIndex].textContent 
    : 'Mobiliario Modular';

  // Checklist de validación
  const hasName = nameVal.length >= 2 && nameVal !== 'Nombre del Producto';
  const hasPrice = priceVal > 0;
  const hasType = !!typeSelect?.value;
  const hasMedia = !!state.mainImage || state.colors.some(c => !!c.image);

  updateChecklist('check-name', hasName);
  updateChecklist('check-price', hasPrice);
  updateChecklist('check-type', hasType);
  updateChecklist('check-media', hasMedia);

  // Conversión VES
  const vesConverted = priceVal * state.exchangeRate;
  const vesEl = document.getElementById('price-ves-converted');
  if (vesEl) {
    vesEl.textContent = `Equivalente: ${formatVES(vesConverted)} (Tasa BCV del día)`;
  }
}

function updateChecklist(itemId, isValid) {
  const el = document.getElementById(itemId);
  if (!el) return;
  if (isValid) {
    el.classList.add('is-valid');
  } else {
    el.classList.remove('is-valid');
  }
}


// ==========================================================================
// PANTALLA DE CARGA Y PROGRESO DE SUBIDA (0% - 100%)
// ==========================================================================

function showUploadProgress(percent, stepText) {
  const modal = document.getElementById('upload-progress-modal');
  const barFill = document.getElementById('progress-bar-fill');
  const percentText = document.getElementById('progress-percent-text');
  const stepTextEl = document.getElementById('progress-step-text');

  if (modal) modal.classList.add('is-active');
  if (barFill) barFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (percentText) percentText.textContent = `${Math.round(percent)}%`;
  if (stepText && stepTextEl) stepTextEl.textContent = stepText;
}

function hideUploadProgress() {
  const modal = document.getElementById('upload-progress-modal');
  if (modal) modal.classList.remove('is-active');
}

// ==========================================================================
// PROCESAMIENTO Y ENVÍO DEL FORMULARIO
// ==========================================================================

function setupFormEvents() {
  const form = document.getElementById('form-create-product');
  if (!form) return;

  // Botón superior sincronizado
  document.getElementById('btn-save-top')?.addEventListener('click', () => {
    form.requestSubmit();
  });

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

    // 2. Armar FormData para multipart/form-data
    const height_cm = parseFloat(document.getElementById('input-product-height')?.value) || 0;
    const width_cm = parseFloat(document.getElementById('input-product-width')?.value) || 0;
    const depth_cm = parseFloat(document.getElementById('input-product-depth')?.value) || 0;
    const security = document.getElementById('input-product-security')?.value.trim() || '';
    const description = document.getElementById('textarea-product-desc')?.value.trim() || '';
    
    const is_active = document.getElementById('switch-is-active')?.checked ?? true;
    const is_outlet = document.getElementById('switch-is-outlet')?.checked ?? false;
    const is_feature_product = document.getElementById('switch-is-featured')?.checked ?? false;

    const formData = new FormData();
    formData.append('product_name', name);
    formData.append('product_type', typeId);
    formData.append('price', price.toFixed(2));
    formData.append('description', description);
    formData.append('height_cm', height_cm);
    formData.append('width_cm', width_cm);
    formData.append('depth_cm', depth_cm);
    formData.append('security', security);
    formData.append('is_active', is_active);
    formData.append('is_outlet', is_outlet);
    formData.append('is_feature_product', is_feature_product);

    // Color principal
    const mainColor = state.colors.length > 0 ? (state.colors[0].color_name || state.colors[0].color_hex) : '';
    if (mainColor) {
      formData.append('main_color', mainColor);
    }

    // Imagen de portada: Enviar solo archivo File real si existe
    if (state.mainImageFile instanceof File) {
      formData.append('product_image', state.mainImageFile);
    } else if (state.colors.length > 0 && state.colors[0].file instanceof File) {
      formData.append('product_image', state.colors[0].file);
    }

    // Video demostrativo: Enviar solo archivo File real si existe
    if (state.videoFile instanceof File) {
      formData.append('product_video', state.videoFile);
    }

    // Variantes de color
    const colorsMeta = [];
    state.colors.forEach((c, idx) => {
      colorsMeta.push({
        color_name: c.color_name || 'Color Estándar',
        color_hex: c.color_hex || '#0272bc'
      });
      if (c.file instanceof File) {
        formData.append(`color_file_${idx}`, c.file);
      }
    });
    formData.append('colors_data', JSON.stringify(colorsMeta));

    // Variantes de ángulos
    const anglesMeta = [];
    state.angles.forEach((a, idx) => {
      anglesMeta.push({
        angle: a.angle || 'Vista'
      });
      if (a.file instanceof File) {
        formData.append(`angle_file_${idx}`, a.file);
      }
    });
    formData.append('angles_data', JSON.stringify(anglesMeta));

    // 3. Ejecutar Creación con Pantalla de Carga y Progreso
    setSubmittingState(true);

    try {
      showUploadProgress(15, 'Validando campos y estructura del producto...');
      await new Promise(r => setTimeout(r, 200));

      showUploadProgress(35, 'Procesando imágenes de portada y acabados de color...');
      await new Promise(r => setTimeout(r, 250));

      if (state.videoFile) {
        showUploadProgress(60, 'Subiendo video demostrativo y archivos multimedia...');
        await new Promise(r => setTimeout(r, 400));
      } else {
        showUploadProgress(65, 'Preparando galería de perspectivas fotográficas...');
        await new Promise(r => setTimeout(r, 250));
      }

      showUploadProgress(85, 'Registrando producto en la base de datos...');
      const created = await createProduct(formData);

      showUploadProgress(100, '¡Producto registrado y publicado exitosamente!');
      await new Promise(r => setTimeout(r, 500));
      hideUploadProgress();

      showToast(
        'success', 
        '¡Producto Creado con Éxito!', 
        `"${created.product_name}" ha sido registrado correctamente en el catálogo.${is_outlet ? ' (Marcado como Outlet)' : ''}`
      );

      // Redirigir al listado tras 1 segundo
      setTimeout(() => {
        window.location.href = './products.html';
      }, 1000);

    } catch (err) {
      console.error('Error al registrar producto:', err);
      hideUploadProgress();
      let errorMsg = err.message || 'No se pudo registrar el producto en el servidor.';
      if (err.data && typeof err.data === 'object') {
        const errorDetails = Object.entries(err.data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('\n');
        if (errorDetails) {
          errorMsg = errorDetails;
        }
      }
      showToast('error', 'Error al guardar', errorMsg);
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
    if (textSpan) textSpan.textContent = isSubmitting ? 'Guardando...' : 'Guardar y Publicar Producto';
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
