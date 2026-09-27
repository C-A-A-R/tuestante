/**
 * ==========================================================================
 * CONTROLADOR - DETALLE Y EDICIÓN DE PRODUCTO (PRODUCT-DETAIL.JS) - TUESTANTE
 * Permite visualizar toda la multimedia (foto de portada, video demostrativo,
 * variantes de color y ángulos de perspectiva) tanto en Modo Consulta como en
 * Modo Edición completa con persistencia en el backend Django.
 * ==========================================================================
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { getProductTypes, getProduct, updateProduct } from './product.api.js';
import { resolveImageUrl } from '../../js/api.js';
import { getOfficialRate } from '../../js/service/exchange-rate.service.js';
import { formatUSD, formatVES } from '../../js/service/currency-converter.service.js';

// Estado global de la pantalla
const state = {
  productId: null,
  isEditMode: false,
  productTypes: [],
  exchangeRate: 791.32,
  product: null,

  // Campos multimedia
  mainImage: '',
  mainImageFile: null,
  mainColor: '',
  mainColorHex: '#0272bc',
  videoUrl: '',
  videoFile: null,

  // Listas de variantes
  colors: [], // { id, color_name, color_hex, image, file }
  angles: [], // { id, angle, image, file }

  isSubmitting: false
};

const COLOR_NAME_MAP = {
  'blanco': '#ffffff',
  'white': '#ffffff',
  'negro': '#111827',
  'black': '#111827',
  'gris': '#9ca3af',
  'gris claro': '#d1d5db',
  'gris oscuro': '#4b5563',
  'gray': '#9ca3af',
  'roble': '#b48a56',
  'roble nórdico': '#c29b68',
  'madera': '#a0714f',
  'marron': '#78350f',
  'café': '#652d0d',
  'azul': '#0272bc',
  'azul rey': '#0272bc',
  'azul oscuro': '#3d5ead',
  'morado': '#702c91',
  'fuccia': '#b6217f',
  'fucsia': '#b6217f',
  'rojo': '#ef1c25',
  'naranja': '#f15a21',
  'amarillo': '#fff300',
  'turqueza': '#00a28a',
  'turquesa': '#00a28a',
  'verde pasto': '#4eb043',
  'verde': '#9ec536',
  'mostaza': '#ffc20f',
  'rosado': '#f472b6',
  'rosa': '#f472b6'
};

function resolveColorHex(name, variants = []) {
  if (!name) return '#ffffff';
  const clean = String(name).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean;
  if (/^#[0-9a-f]{3}$/i.test(clean)) {
    return '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
  }
  if (COLOR_NAME_MAP[clean]) return COLOR_NAME_MAP[clean];
  if (Array.isArray(variants)) {
    const matched = variants.find(v => (v.color_name || '').toLowerCase() === clean);
    if (matched && matched.color_hex) return matched.color_hex;
  }
  return '#cbd5e1';
}

// ==========================================================================
// INICIALIZACIÓN DE LA PANTALLA
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar componentes de navegación (Drawer + Navbar + Footer)
  await loadAdminComponents({ title: 'Detalle de Producto' });
  highlightDrawerLink();

  // 2. Extraer ID del producto desde la URL (?id=...)
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');

  if (!idParam) {
    showFatalError('ID de producto no especificado', 'Por favor selecciona un producto desde el catálogo general.');
    return;
  }

  state.productId = idParam;

  // 3. Cargar Tasa BCV oficial
  try {
    const rate = await getOfficialRate();
    if (rate > 0) {
      state.exchangeRate = rate;
    }
  } catch (e) {
    console.warn('[Detalle Producto] Usando tasa fallback:', e);
  }

  // 4. Cargar tipos de productos y datos del producto en paralelo
  try {
    const [types, product] = await Promise.all([
      getProductTypes(),
      getProduct(state.productId)
    ]);

    state.productTypes = types || [];
    state.product = product;

    // Poblar selector de tipos de productos
    populateProductTypesSelect(state.productTypes);

    // Poblar formulario y multimedia
    populateProductData(product);

    // Inicializar eventos de formulario y multimedia
    setupModeToggle();
    setupLightboxModal();
    setupMainImageControls();
    setupMainColorControls();
    setupVideoControls();
    setupColorPresetButtons();
    setupAngleControls();
    setupPriceCalculation();
    setupFormSubmit();
    setupOutletHint();

    // 5. Activar automáticamente modo edición si la URL incluye ?edit=true
    const editParam = params.get('edit');
    if (editParam === 'true' || editParam === '1') {
      setEditMode(true);
    }

  } catch (err) {
    console.error('Error al inicializar detalle de producto:', err);
    showFatalError(
      'Error al cargar producto',
      err.message || 'No se pudo obtener la información del producto desde el servidor.'
    );
  }
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
// POBLADO DE DATOS Y FORMULARIO
// ==========================================================================

function populateProductTypesSelect(types) {
  const select = document.getElementById('select-product-type');
  if (!select) return;

  select.innerHTML = '<option value="" disabled>Selecciona un tipo de producto...</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.product_type_name;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const selectedId = parseInt(select.value, 10);
    const matched = state.productTypes.find(t => t.id === selectedId);
    if (matched) {
      const badgeType = document.getElementById('badge-product-type');
      if (badgeType) badgeType.textContent = matched.product_type_name;
      if (state.isEditMode && typeof matched.default_has_doors === 'boolean') {
        const hasDoorsSwitch = document.getElementById('switch-has-doors');
        if (hasDoorsSwitch) {
          hasDoorsSwitch.checked = matched.default_has_doors;
        }
      }
    }
  });
}

function populateProductData(p) {
  // Breadcrumb y Títulos
  const breadcrumbName = document.getElementById('breadcrumb-product-name');
  if (breadcrumbName) breadcrumbName.textContent = p.product_name || `Producto #${p.id}`;

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = p.product_name || 'Detalle del Producto';

  // Badges informativos
  const badgeId = document.getElementById('badge-product-id');
  if (badgeId) badgeId.textContent = `ID: #${p.id}`;

  const badgeType = document.getElementById('badge-product-type');
  if (badgeType) badgeType.textContent = p.product_type || 'Mobiliario';

  const badgeStatus = document.getElementById('badge-product-status');
  if (badgeStatus) {
    badgeStatus.textContent = p.is_active ? 'Activo en Catálogo' : 'Oculto / Inactivo';
    badgeStatus.classList.toggle('is-inactive', !p.is_active);
  }

  const badgeOutlet = document.getElementById('badge-product-outlet');
  if (badgeOutlet) badgeOutlet.classList.toggle('hidden', !p.is_outlet);

  const badgeFeatured = document.getElementById('badge-product-featured');
  if (badgeFeatured) badgeFeatured.classList.toggle('hidden', !p.is_feature_product);

  const badgeStock = document.getElementById('badge-product-stock');
  if (badgeStock) {
    const qty = parseInt(p.quantity, 10) || 0;
    badgeStock.textContent = qty > 0 ? `Stock: ${qty} uds.` : (p.is_outlet ? 'Agotado (Outlet)' : 'Bajo Pedido (0 stock)');
  }

  // Campos de texto e inputs
  setInputValue('input-product-name', p.product_name);
  setInputValue('select-product-type', p.product_type_id);
  setInputValue('input-product-price', p.price ? parseFloat(p.price).toFixed(2) : '0.00');
  setInputValue('input-product-quantity', p.quantity !== undefined ? p.quantity : 0);
  setInputValue('textarea-product-desc', p.description);

  setInputValue('input-product-height', p.height_cm ? parseFloat(p.height_cm) : '');
  setInputValue('input-product-width', p.width_cm ? parseFloat(p.width_cm) : '');
  setInputValue('input-product-depth', p.depth_cm ? parseFloat(p.depth_cm) : '');
  setInputValue('input-product-columns', p.columns_count !== undefined ? p.columns_count : (p.columns !== undefined ? p.columns : 1));
  setInputValue('input-product-rows', p.rows_count !== undefined ? p.rows_count : (p.rows !== undefined ? p.rows : 1));
  setInputValue('input-product-security', p.security);

  setCheckboxValue('switch-is-active', p.is_active);
  setCheckboxValue('switch-is-outlet', p.is_outlet);
  setCheckboxValue('switch-is-featured', p.is_feature_product);
  setCheckboxValue('switch-has-doors', p.has_doors ?? false);

  // Actualizar badges técnicos en el header
  const badgeGrid = document.getElementById('badge-product-grid');
  if (badgeGrid) {
    const cols = p.columns_count !== undefined ? p.columns_count : (p.columns || 1);
    const rows = p.rows_count !== undefined ? p.rows_count : (p.rows || 1);
    badgeGrid.textContent = `${cols} ${cols === 1 ? 'col' : 'cols'} × ${rows} ${rows === 1 ? 'nivel' : 'niveles'}`;
  }

  const badgeDoors = document.getElementById('badge-product-doors');
  if (badgeDoors) {
    badgeDoors.textContent = p.has_doors ? 'Con Puertas' : 'Sin Puertas (Abierto)';
  }

  // Conversión de precio a Bolívares
  updatePriceVes(parseFloat(p.price) || 0);

  // Multimedia Principal: Imagen de portada
  state.mainImage = p.product_image ? resolveImageUrl(p.product_image) : '';
  state.mainImageFile = null;
  renderMainImage();

  // Multimedia Principal: Color principal (ligado a la portada)
  const mainColorName = p.main_color || p.color_principal || '';
  const mainColorHexRaw = p.main_color_hex || '';
  state.mainColor = mainColorName;
  state.mainColorHex = mainColorHexRaw || resolveColorHex(mainColorName, p.color_images);
  renderMainColor();

  // Multimedia Principal: Video demostrativo
  state.videoUrl = p.product_video ? resolveImageUrl(p.product_video) : '';
  state.videoFile = null;
  renderVideo();

  // Variantes de color
  state.colors = Array.isArray(p.color_images) ? p.color_images.map(c => ({
    id: c.id || null,
    color_name: c.color_name || 'Color',
    color_hex: c.color_hex || '#0272bc',
    image: c.color_image ? resolveImageUrl(c.color_image) : '',
    file: null
  })) : [];
  renderColorVariants();

  // Variantes de ángulos
  state.angles = Array.isArray(p.angle_images) ? p.angle_images.map(a => ({
    id: a.id || null,
    angle: a.angle || 'Vista',
    image: a.image ? resolveImageUrl(a.image) : '',
    file: null
  })) : [];
  renderAngleVariants();
}

function setInputValue(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.value = value !== undefined && value !== null ? value : '';
}

function setCheckboxValue(elementId, checked) {
  const el = document.getElementById(elementId);
  if (el) el.checked = Boolean(checked);
}

function updatePriceVes(priceUsd) {
  const vesPreview = document.getElementById('price-ves-converted');
  if (!vesPreview) return;
  const converted = (parseFloat(priceUsd) || 0) * state.exchangeRate;
  vesPreview.innerHTML = `Equivalente: <strong>${formatVES(converted)}</strong> <span class="bcv-rate-hint">(Tasa BCV del día)</span>`;
}

// ==========================================================================
// ALTERNAR ENTRE MODO LECTURA Y MODO EDICIÓN
// ==========================================================================

function setupModeToggle() {
  const btnToggle = document.getElementById('btn-toggle-edit');
  if (!btnToggle) return;

  btnToggle.addEventListener('click', () => {
    setEditMode(!state.isEditMode);
  });
}

function setEditMode(isEdit) {
  state.isEditMode = isEdit;

  const form = document.getElementById('form-product-detail');
  const badgeMode = document.getElementById('badge-page-mode');
  const btnToggleText = document.getElementById('btn-toggle-edit-text');
  const btnSaveTop = document.getElementById('btn-save-top');
  const btnSubmitMain = document.getElementById('btn-submit-main');
  const footerHint = document.getElementById('detail-footer-hint');

  if (form) {
    form.classList.toggle('is-view-mode', !isEdit);
    form.classList.toggle('is-edit-mode', isEdit);
  }

  if (badgeMode) {
    badgeMode.textContent = isEdit ? 'Modo Edición Activo' : 'Modo Lectura';
    badgeMode.classList.toggle('is-edit', isEdit);
    badgeMode.classList.toggle('is-view', !isEdit);
  }

  if (btnToggleText) {
    btnToggleText.textContent = isEdit ? 'Cancelar Edición' : 'Habilitar Edición';
  }

  if (btnSaveTop) btnSaveTop.disabled = !isEdit;
  if (btnSubmitMain) btnSubmitMain.disabled = !isEdit;

  if (footerHint) {
    footerHint.textContent = isEdit
      ? 'Modo edición activo. Realiza los cambios necesarios y presiona "Guardar Cambios".'
      : 'Visualizando producto en modo consulta. Haz clic en "Habilitar Edición" para modificar especificaciones o fotos.';
  }

  // Habilitar / deshabilitar inputs
  const inputs = form?.querySelectorAll('input:not(#input-main-image):not(#input-product-video-file):not(.file-input-hidden), select, textarea') || [];
  inputs.forEach(input => {
    input.disabled = !isEdit;
  });

  const fileInputs = form?.querySelectorAll('#input-main-image, #input-product-video-file') || [];
  fileInputs.forEach(fi => {
    fi.disabled = !isEdit;
  });

  // Mostrar / ocultar controles multimedia de edición
  const editMainImgActions = document.getElementById('edit-main-img-actions');
  if (editMainImgActions) {
    editMainImgActions.classList.toggle('hidden', !isEdit);
  }

  const mainColorDisplay = document.getElementById('main-color-display');
  const mainColorEditRow = document.getElementById('main-color-edit-row');
  const mainColorNameInput = document.getElementById('input-main-color-name');
  const mainColorPickerInput = document.getElementById('input-main-color-picker');

  if (mainColorDisplay) mainColorDisplay.classList.toggle('hidden', isEdit);
  if (mainColorEditRow) mainColorEditRow.classList.toggle('hidden', !isEdit);
  if (mainColorNameInput) mainColorNameInput.disabled = !isEdit;
  if (mainColorPickerInput) mainColorPickerInput.disabled = !isEdit;

  const videoEditActions = document.getElementById('video-edit-actions');
  if (videoEditActions) {
    videoEditActions.classList.toggle('hidden', !isEdit);
  }

  const btnAddColor = document.getElementById('btn-add-color-variant');
  if (btnAddColor) btnAddColor.classList.toggle('hidden', !isEdit);

  const colorPresetsBar = document.getElementById('color-presets-bar');
  if (colorPresetsBar) colorPresetsBar.classList.toggle('hidden', !isEdit);

  const btnAddAngle = document.getElementById('btn-add-angle-variant');
  if (btnAddAngle) btnAddAngle.classList.toggle('hidden', !isEdit);

  // Re-renderizar listas de variantes para cambiar entre modo galería y modo filas de edición
  renderColorVariants();
  renderAngleVariants();

  if (isEdit) {
    showToast('info', 'Modo Edición Activado', 'Ahora puedes modificar datos, reemplazar fotos, agregar colores y ángulos.');
  } else if (state.product) {
    populateProductData(state.product);
  }
}

// ==========================================================================
// RENDERIZADO Y CONTROL DE IMAGEN PRINCIPAL (PORTADA)
// ==========================================================================

function renderMainImage() {
  const dropzone = document.getElementById('dropzone-main-image');
  const previewImg = document.getElementById('img-main-preview');
  const placeholder = document.getElementById('dropzone-main-placeholder');
  const zoomOverlay = document.getElementById('overlay-main-zoom');

  if (!dropzone || !previewImg) return;

  if (state.mainImage) {
    previewImg.src = state.mainImage;
    previewImg.classList.remove('hidden');
    placeholder?.classList.add('hidden');
    dropzone.classList.add('has-image');
    if (zoomOverlay) zoomOverlay.classList.remove('hidden');
  } else {
    previewImg.src = '';
    previewImg.classList.add('hidden');
    placeholder?.classList.remove('hidden');
    dropzone.classList.remove('has-image');
    if (zoomOverlay) zoomOverlay.classList.add('hidden');
  }
}

function setupMainImageControls() {
  const dropzone = document.getElementById('dropzone-main-image');
  const fileInput = document.getElementById('input-main-image');
  const previewImg = document.getElementById('img-main-preview');
  const zoomOverlay = document.getElementById('overlay-main-zoom');
  const btnChange = document.getElementById('btn-change-main-img');
  const btnRemove = document.getElementById('btn-remove-main-img');

  if (!dropzone || !fileInput) return;

  // Zoom / Lightbox al hacer clic en la imagen (Modo Lectura o Modo Edición)
  zoomOverlay?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.mainImage) {
      openLightbox(state.mainImage, 'Foto de Portada del Producto', state.product?.product_name || '');
    }
  });

  // En modo edición, click en la zona para subir si no hay imagen
  dropzone.addEventListener('click', (e) => {
    if (!state.isEditMode) {
      if (state.mainImage) {
        openLightbox(state.mainImage, 'Foto de Portada del Producto', state.product?.product_name || '');
      }
      return;
    }
    if (e.target.closest('#edit-main-img-actions') || e.target.closest('#overlay-main-zoom')) return;
    if (e.target === fileInput) return;
    fileInput.click();
  });

  btnChange?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  btnRemove?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.mainImage = '';
    state.mainImageFile = null;
    fileInput.value = '';
    renderMainImage();
    showToast('info', 'Foto removida', 'Se ha quitado la imagen de portada.');
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleMainImageFile(fileInput.files[0]);
    }
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      if (!state.isEditMode) return;
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      if (!state.isEditMode) return;
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (!state.isEditMode) return;
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleMainImageFile(files[0]);
    }
  });

  function handleMainImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('warning', 'Archivo no válido', 'Por favor selecciona un archivo de imagen (PNG, JPG, WEBP).');
      return;
    }
    state.mainImageFile = file;
    state.mainImage = URL.createObjectURL(file);
    renderMainImage();
    showToast('success', 'Portada cargada', 'Se ha preparado la nueva imagen de portada.');
  }
}

// ==========================================================================
// RENDERIZADO Y CONTROL DE COLOR PRINCIPAL (BASE DE PORTADA)
// ==========================================================================

function renderMainColor() {
  const swatchEl = document.getElementById('main-color-view-swatch');
  const nameEl = document.getElementById('main-color-view-name');
  const hexEl = document.getElementById('main-color-view-hex');
  const nameInput = document.getElementById('input-main-color-name');
  const pickerInput = document.getElementById('input-main-color-picker');
  const hexHiddenInput = document.getElementById('input-main-color-hex');

  const displayName = state.mainColor || 'Blanco';
  const displayHex = state.mainColorHex || '#ffffff';

  if (swatchEl) swatchEl.style.backgroundColor = displayHex;
  if (nameEl) nameEl.textContent = displayName;
  if (hexEl) hexEl.textContent = displayHex;

  if (nameInput && !nameInput.matches(':focus')) {
    nameInput.value = state.mainColor || '';
  }
  if (pickerInput) {
    pickerInput.value = displayHex.startsWith('#') && displayHex.length === 7 ? displayHex : '#0272bc';
  }
  // Mantener el hidden input sincronizado para que FormData lo capture
  if (hexHiddenInput) {
    hexHiddenInput.value = displayHex;
  }
}

function setupMainColorControls() {
  const nameInput = document.getElementById('input-main-color-name');
  const pickerInput = document.getElementById('input-main-color-picker');
  if (!nameInput || !pickerInput) return;

  pickerInput.addEventListener('input', (e) => {
    state.mainColorHex = e.target.value;
    if (!nameInput.value.trim()) {
      nameInput.value = e.target.value;
      state.mainColor = e.target.value;
    }
    renderMainColor();
  });

  nameInput.addEventListener('input', (e) => {
    state.mainColor = e.target.value.trim();
    const guessedHex = resolveColorHex(state.mainColor);
    if (guessedHex && guessedHex.startsWith('#') && guessedHex.length === 7) {
      state.mainColorHex = guessedHex;
      pickerInput.value = guessedHex;
    }
    renderMainColor();
  });
}

// ==========================================================================
// RENDERIZADO Y CONTROL DE VIDEO DEMOSTRATIVO
// ==========================================================================

function renderVideo() {
  const emptyBox = document.getElementById('video-dropzone-empty');
  const previewBox = document.getElementById('video-dropzone-preview');
  const player = document.getElementById('video-preview-player');
  const filesizeEl = document.getElementById('video-filesize');
  const openLink = document.getElementById('btn-open-video-link');
  const fallbackLink = document.getElementById('btn-open-fallback-video');
  const errorOverlay = document.getElementById('video-error-overlay');

  if (!emptyBox || !previewBox || !player) return;

  if (state.videoUrl) {
    if (errorOverlay) errorOverlay.classList.add('hidden');
    if (openLink) {
      openLink.href = state.videoUrl;
      openLink.style.display = 'inline-flex';
    }
    if (fallbackLink) {
      fallbackLink.href = state.videoUrl;
    }

    if (player.getAttribute('data-active-src') !== state.videoUrl) {
      player.setAttribute('data-active-src', state.videoUrl);
      player.innerHTML = `
        <source src="${state.videoUrl}" type="video/mp4">
        <source src="${state.videoUrl}" type="video/webm">
        Tu navegador no soporta la reproducción directa de este video.
      `;
      player.load();
    }
    emptyBox.classList.add('hidden');
    previewBox.classList.remove('hidden');

    if (filesizeEl) {
      filesizeEl.textContent = state.videoFile 
        ? `Video cargado (${formatBytes(state.videoFile.size)})` 
        : 'Video Demostrativo del Producto';
    }
  } else {
    player.innerHTML = '';
    player.removeAttribute('src');
    player.removeAttribute('data-active-src');
    if (errorOverlay) errorOverlay.classList.add('hidden');
    if (openLink) openLink.style.display = 'none';
    emptyBox.classList.remove('hidden');
    previewBox.classList.add('hidden');
  }
}

function setupVideoControls() {
  const dropzone = document.getElementById('video-dropzone');
  const player = document.getElementById('video-preview-player');
  const playerContainer = document.querySelector('.video-player-container');
  const fileInput = document.getElementById('input-product-video-file');
  const btnChange = document.getElementById('btn-change-video');
  const btnRemove = document.getElementById('btn-remove-video');

  if (!dropzone || !fileInput) return;

  // Clic interactivo en el reproductor de video para alternar play / pause
  if (player) {
    player.addEventListener('click', (e) => {
      e.stopPropagation();
      if (player.paused) {
        player.play().catch(err => console.warn('Error al reproducir video:', err));
      } else {
        player.pause();
      }
    });

    player.addEventListener('error', () => {
      const err = player.error;
      console.warn('[Video Player] Error de carga o formato no compatible:', err ? `Código ${err.code}: ${err.message}` : 'Error desconocido', player.currentSrc || state.videoUrl);
      const errorOverlay = document.getElementById('video-error-overlay');
      if (errorOverlay && state.videoUrl) {
        errorOverlay.classList.remove('hidden');
      }
    });

    player.addEventListener('loadeddata', () => {
      const errorOverlay = document.getElementById('video-error-overlay');
      if (errorOverlay) {
        errorOverlay.classList.add('hidden');
      }
    });

    player.addEventListener('canplay', () => {
      const errorOverlay = document.getElementById('video-error-overlay');
      if (errorOverlay) {
        errorOverlay.classList.add('hidden');
      }
    });
  }

  if (playerContainer) {
    playerContainer.addEventListener('click', (e) => {
      if (e.target === player) return;
      if (player && player.src) {
        if (player.paused) {
          player.play().catch(err => console.warn('Error al reproducir video:', err));
        } else {
          player.pause();
        }
      }
    });
  }

  dropzone.addEventListener('click', (e) => {
    if (!state.isEditMode) return;
    if (e.target.closest('#btn-change-video') || e.target.closest('#btn-remove-video') || e.target.closest('video') || e.target.closest('.video-player-container')) return;
    if (e.target === fileInput) return;
    if (!state.videoUrl) {
      fileInput.click();
    }
  });

  btnChange?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  btnRemove?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.videoUrl = '';
    state.videoFile = null;
    fileInput.value = '';
    renderVideo();
    showToast('info', 'Video removido', 'Se ha quitado el video demostrativo.');
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleVideoFile(fileInput.files[0]);
    }
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      if (!state.isEditMode) return;
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      if (!state.isEditMode) return;
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (!state.isEditMode) return;
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleVideoFile(files[0]);
    }
  });

  function handleVideoFile(file) {
    if (!file.type.startsWith('video/')) {
      showToast('warning', 'Archivo no válido', 'Por favor selecciona un archivo de video (MP4, WEBM, MOV).');
      return;
    }
    state.videoFile = file;
    state.videoUrl = URL.createObjectURL(file);
    renderVideo();
    showToast('success', 'Video cargado', 'Se ha preparado el nuevo video demostrativo.');
  }
}

// ==========================================================================
// VARIANTES DE COLOR (PRODUCTCOLORIMAGE)
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
      <div class="empty-state-notice">
        No hay acabados de color registrados. ${state.isEditMode ? 'Presiona <strong>+ Agregar Color</strong> o haz clic en la <strong>Paleta rápida</strong> para añadir acabados.' : ''}
      </div>
    `;
    return;
  }

  // 1. MODO CONSULTA / LECTURA: Mostrar Tarjetas Visuales de Galería de Color
  if (!state.isEditMode) {
    container.innerHTML = `
      <div class="variants-view-grid">
        ${state.colors.map((c, index) => `
          <div class="variant-view-card" data-index="${index}">
            <div class="variant-view-header">
              <span class="variant-color-swatch-circle" style="background-color: ${escapeHtml(c.color_hex)};"></span>
              <div class="variant-color-info">
                <span class="variant-color-title">${escapeHtml(c.color_name || 'Color Estándar')}</span>
                <span class="variant-color-hex">${escapeHtml(c.color_hex || '#000000')}</span>
              </div>
            </div>

            <div class="variant-view-thumb-box" data-index="${index}" title="Clic para ampliar en HD">
              ${c.image ? `
                <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.color_name)}" onerror="this.src='../../assets/images/products/tipo-producto-estante.png'">
                <div class="variant-thumb-zoom-pill">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <span>Ampliar</span>
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.76rem; text-align: center; padding: 10px;">
                  <span style="font-size: 1.4rem; margin-bottom: 4px;">🎨</span>
                  <span>Muestra sin foto específica</span>
                </div>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Asignar eventos de lightbox en modo lectura
    container.querySelectorAll('.variant-view-thumb-box').forEach(box => {
      box.addEventListener('click', () => {
        const idx = parseInt(box.getAttribute('data-index'), 10);
        const col = state.colors[idx];
        if (col && col.image) {
          openLightbox(col.image, `Variante: ${col.color_name}`, `Muestra de color: ${col.color_hex}`);
        }
      });
    });

    return;
  }

  // 2. MODO EDICIÓN: Mostrar Filas Interactivas con Inputs y File Dropzone
  container.innerHTML = state.colors.map((color, index) => `
    <div class="variant-row-card" data-color-index="${index}">
      <!-- Muestra y selector de color nativo -->
      <div class="color-picker-box" style="background-color: ${escapeHtml(color.color_hex)};">
        <input 
          type="color" 
          class="native-color-picker input-color-picker" 
          value="${escapeHtml(color.color_hex)}" 
          data-index="${index}"
          title="Seleccionar color">
      </div>

      <!-- Código Hexadecimal -->
      <input 
        type="text" 
        class="form-input color-hex-input input-color-hex" 
        value="${escapeHtml(color.color_hex)}" 
        data-index="${index}"
        maxlength="7"
        placeholder="#000000">

      <!-- Nombre del Color -->
      <input 
        type="text" 
        class="form-input input-color-name" 
        value="${escapeHtml(color.color_name)}" 
        data-index="${index}"
        placeholder="Ej: Azul rey, Roble claro..." 
        required>

      <!-- Subida de Foto para este color -->
      <div class="variant-thumb-dropzone btn-upload-color-thumb" data-index="${index}" title="Subir foto de este color">
        <input type="file" accept="image/*" class="file-input-hidden input-file-color" data-index="${index}">
        ${color.image ? `
          <img src="${escapeHtml(color.image)}" alt="${escapeHtml(color.color_name)}" class="variant-thumb-img">
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

      <!-- Botón Eliminar Fila -->
      <button type="button" class="btn-remove-row btn-delete-color" data-index="${index}" title="Eliminar color">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `).join('');

  setupColorRowListeners();
}

function setupColorRowListeners() {
  const container = document.getElementById('colors-list-container');
  if (!container) return;

  // 1. Color Picker
  container.querySelectorAll('.input-color-picker').forEach(picker => {
    picker.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      const hex = e.target.value;
      if (state.colors[idx]) {
        state.colors[idx].color_hex = hex;
        const hexInput = container.querySelector(`.input-color-hex[data-index="${idx}"]`);
        if (hexInput) hexInput.value = hex;
        e.target.closest('.color-picker-box').style.backgroundColor = hex;
      }
    });
  });

  // 2. Input Hex manual
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
      }
    });
  });

  // 3. Input Nombre del Color
  container.querySelectorAll('.input-color-name').forEach(nameInput => {
    nameInput.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      if (state.colors[idx]) {
        state.colors[idx].color_name = e.target.value;
      }
    });
  });

  // 4. Click en dropzone de foto de color
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
      if (!state.isEditMode) return;
      const hex = chip.getAttribute('data-hex');
      const name = chip.getAttribute('data-name');

      state.colors.push({
        id: null,
        color_name: name,
        color_hex: hex,
        image: '',
        file: null
      });

      renderColorVariants();
      showToast('info', 'Color agregado', `Se añadió la variante ${name} (${hex})`);
    });
  });

  const btnAddColor = document.getElementById('btn-add-color-variant');
  if (btnAddColor) {
    btnAddColor.addEventListener('click', () => {
      state.colors.push({
        id: null,
        color_name: `Color ${state.colors.length + 1}`,
        color_hex: '#0272bc',
        image: '',
        file: null
      });
      renderColorVariants();
    });
  }
}

// ==========================================================================
// VARIANTES DE ÁNGULOS Y PERSPECTIVAS (PRODUCTANGLEIMAGE)
// ==========================================================================

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

function renderAngleVariants() {
  const container = document.getElementById('angles-list-container');
  const countBadge = document.getElementById('badge-angle-count');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${state.angles.length} ${state.angles.length === 1 ? 'ángulo' : 'ángulos'}`;
  }

  if (state.angles.length === 0) {
    container.innerHTML = `
      <div class="empty-state-notice">
        No hay ángulos fotográficos registrados. ${state.isEditMode ? 'Presiona <strong>+ Agregar Ángulo</strong> para añadir perspectivas fotográficas.' : ''}
      </div>
    `;
    return;
  }

  // 1. MODO CONSULTA / LECTURA: Galería de Ángulos
  if (!state.isEditMode) {
    container.innerHTML = `
      <div class="variants-view-grid">
        ${state.angles.map((a, index) => `
          <div class="angle-view-card" data-index="${index}">
            <div class="angle-view-header">
              <span class="angle-badge-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                <span>${escapeHtml(a.angle || 'Vista')}</span>
              </span>
            </div>

            <div class="variant-view-thumb-box" data-index="${index}" title="Clic para ampliar perspectiva en HD">
              ${a.image ? `
                <img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.angle)}" onerror="this.src='../../assets/images/products/tipo-producto-estante.png'">
                <div class="variant-thumb-zoom-pill">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <span>Ampliar</span>
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.76rem; text-align: center; padding: 10px;">
                  <span style="font-size: 1.4rem; margin-bottom: 4px;">📷</span>
                  <span>Sin foto de esta perspectiva</span>
                </div>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Lightbox para ángulos
    container.querySelectorAll('.variant-view-thumb-box').forEach(box => {
      box.addEventListener('click', () => {
        const idx = parseInt(box.getAttribute('data-index'), 10);
        const ang = state.angles[idx];
        if (ang && ang.image) {
          openLightbox(ang.image, `Ángulo: ${ang.angle}`, state.product?.product_name || '');
        }
      });
    });

    return;
  }

  // 2. MODO EDICIÓN: Filas de Edición con Dropdown y Subida
  container.innerHTML = state.angles.map((angleObj, index) => `
    <div class="angle-row-card" data-angle-index="${index}">
      
      <!-- Selector de Tipo de Ángulo -->
      <select class="form-select select-angle-type" data-index="${index}">
        ${suggestedAngles.map(ang => `
          <option value="${ang}" ${angleObj.angle === ang ? 'selected' : ''}>${ang}</option>
        `).join('')}
        ${!suggestedAngles.includes(angleObj.angle) && angleObj.angle ? `
          <option value="${escapeHtml(angleObj.angle)}" selected>${escapeHtml(angleObj.angle)}</option>
        ` : ''}
      </select>

      <!-- Nombre personalizado opcional -->
      <input 
        type="text" 
        class="form-input input-angle-custom" 
        value="${escapeHtml(angleObj.angle)}" 
        data-index="${index}"
        placeholder="Nombre o descripción del ángulo...">

      <!-- Subida de Imagen del Ángulo -->
      <div class="variant-thumb-dropzone btn-upload-angle-thumb" data-index="${index}" title="Subir foto para este ángulo">
        <input type="file" accept="image/*" class="file-input-hidden input-file-angle" data-index="${index}">
        ${angleObj.image ? `
          <img src="${escapeHtml(angleObj.image)}" alt="${escapeHtml(angleObj.angle)}" class="variant-thumb-img">
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

      <!-- Botón Eliminar Fila -->
      <button type="button" class="btn-remove-row btn-delete-angle" data-index="${index}" title="Eliminar ángulo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>

    </div>
  `).join('');

  setupAngleRowListeners();
}

function setupAngleRowListeners() {
  const container = document.getElementById('angles-list-container');
  if (!container) return;

  container.querySelectorAll('.select-angle-type').forEach(select => {
    select.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      const val = e.target.value;
      if (state.angles[idx]) {
        state.angles[idx].angle = val;
        const customInput = container.querySelector(`.input-angle-custom[data-index="${idx}"]`);
        if (customInput) customInput.value = val;
      }
    });
  });

  container.querySelectorAll('.input-angle-custom').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      if (state.angles[idx]) {
        state.angles[idx].angle = e.target.value;
      }
    });
  });

  container.querySelectorAll('.btn-upload-angle-thumb').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const fileInput = thumb.querySelector('.input-file-angle');
      if (fileInput) fileInput.click();
    });
  });

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

  container.querySelectorAll('.btn-delete-angle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      state.angles.splice(idx, 1);
      renderAngleVariants();
    });
  });
}

function setupAngleControls() {
  const btnAddAngle = document.getElementById('btn-add-angle-variant');
  if (btnAddAngle) {
    btnAddAngle.addEventListener('click', () => {
      const nextAngle = suggestedAngles[state.angles.length % suggestedAngles.length] || `Ángulo ${state.angles.length + 1}`;
      state.angles.push({
        id: null,
        angle: nextAngle,
        image: '',
        file: null
      });
      renderAngleVariants();
    });
  }
}

// ==========================================================================
// CÁLCULO DE PRECIO BCV EN TIEMPO REAL
// ==========================================================================

function setupPriceCalculation() {
  const priceInput = document.getElementById('input-product-price');
  if (priceInput) {
    priceInput.addEventListener('input', () => {
      updatePriceVes(parseFloat(priceInput.value) || 0);
    });
  }
}

function setupOutletHint() {
  const outletSwitch = document.getElementById('switch-is-outlet');
  const outletHint = document.getElementById('quantity-outlet-hint');

  if (!outletSwitch || !outletHint) return;

  const syncHint = () => {
    if (outletSwitch.checked) {
      outletHint.classList.remove('hidden');
    } else {
      outletHint.classList.add('hidden');
    }
  };

  outletSwitch.addEventListener('change', syncHint);
  syncHint();
}

// ==========================================================================
// MODAL LIGHTBOX / VISUALIZADOR HD
// ==========================================================================

function setupLightboxModal() {
  const modal = document.getElementById('media-lightbox-modal');
  const btnClose = document.getElementById('btn-close-lightbox');

  if (!modal) return;

  btnClose?.addEventListener('click', closeLightbox);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('lightbox-dialog')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeLightbox();
    }
  });
}

function openLightbox(imageUrl, title = '', subtitle = '') {
  const modal = document.getElementById('media-lightbox-modal');
  const img = document.getElementById('lightbox-img');
  const titleEl = document.getElementById('lightbox-title');
  const subEl = document.getElementById('lightbox-subtitle');

  if (!modal || !img) return;

  img.src = imageUrl;
  if (titleEl) titleEl.textContent = title || 'Visualización de Producto';
  if (subEl) subEl.textContent = subtitle || 'Presiona Esc o haz clic afuera para salir';

  modal.classList.remove('hidden');
}

function closeLightbox() {
  const modal = document.getElementById('media-lightbox-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================================================
// ENVÍO Y ACTUALIZACIÓN DEL PRODUCTO (UPDATE PRODUCT)
// ==========================================================================

function setupFormSubmit() {
  const form = document.getElementById('form-product-detail');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.isSubmitting || !state.isEditMode) return;

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

    // 2. Construir FormData
    const quantity = parseInt(document.getElementById('input-product-quantity')?.value, 10) || 0;
    const height_cm = parseFloat(document.getElementById('input-product-height')?.value) || 0;
    const width_cm = parseFloat(document.getElementById('input-product-width')?.value) || 0;
    const depth_cm = parseFloat(document.getElementById('input-product-depth')?.value) || 0;
    const columns_count = parseInt(document.getElementById('input-product-columns')?.value, 10) || 1;
    const rows_count = parseInt(document.getElementById('input-product-rows')?.value, 10) || 1;
    const has_doors = document.getElementById('switch-has-doors')?.checked ?? false;
    const security = document.getElementById('input-product-security')?.value.trim() || '';
    const description = document.getElementById('textarea-product-desc')?.value.trim() || '';

    if (columns_count < 1) {
      showToast('error', 'Campo inválido', 'La cantidad de columnas debe ser al menos 1.');
      document.getElementById('input-product-columns')?.focus();
      return;
    }

    if (rows_count < 1) {
      showToast('error', 'Campo inválido', 'La cantidad de filas o niveles debe ser al menos 1.');
      document.getElementById('input-product-rows')?.focus();
      return;
    }

    const is_active = document.getElementById('switch-is-active')?.checked ?? true;
    const is_outlet = document.getElementById('switch-is-outlet')?.checked ?? false;
    const is_feature_product = document.getElementById('switch-is-featured')?.checked ?? false;

    const formData = new FormData();
    formData.append('product_name', name);
    formData.append('product_type', typeId);
    formData.append('price', price.toFixed(2));
    formData.append('description', description);
    formData.append('quantity', quantity);
    formData.append('height_cm', height_cm);
    formData.append('width_cm', width_cm);
    formData.append('depth_cm', depth_cm);
    formData.append('columns_count', columns_count);
    formData.append('rows_count', rows_count);
    formData.append('has_doors', has_doors);
    formData.append('security', security);
    formData.append('is_active', is_active);
    formData.append('is_outlet', is_outlet);
    formData.append('is_feature_product', is_feature_product);

    // Color principal
    const mainColorInput = document.getElementById('input-main-color-name')?.value.trim();
    const mainColor = mainColorInput || state.mainColor || (state.colors.length > 0 ? (state.colors[0].color_name || state.colors[0].color_hex) : 'Blanco');
    const mainColorHex = document.getElementById('input-main-color-hex')?.value || state.mainColorHex || '#ffffff';
    formData.append('main_color', mainColor);
    formData.append('main_color_hex', mainColorHex);

    // Imagen de Portada (solo si se seleccionó un nuevo archivo File)
    if (state.mainImageFile instanceof File) {
      formData.append('product_image', state.mainImageFile);
    }

    // Video Demostrativo (solo si se seleccionó un nuevo archivo File)
    if (state.videoFile instanceof File) {
      formData.append('product_video', state.videoFile);
    }

    // Variantes de color
    const colorsMeta = [];
    state.colors.forEach((c, idx) => {
      colorsMeta.push({
        id: typeof c.id === 'number' ? c.id : undefined,
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
        id: typeof a.id === 'number' ? a.id : undefined,
        angle: a.angle || 'Vista'
      });
      if (a.file instanceof File) {
        formData.append(`angle_file_${idx}`, a.file);
      }
    });
    formData.append('angles_data', JSON.stringify(anglesMeta));

    // 3. Ejecutar Actualización con Pantalla de Progreso
    setSubmittingState(true);

    try {
      showUploadProgress(20, 'Validando datos del producto...');
      await new Promise(r => setTimeout(r, 200));

      showUploadProgress(45, 'Procesando imágenes y variantes...');
      await new Promise(r => setTimeout(r, 250));

      if (state.videoFile) {
        showUploadProgress(70, 'Subiendo nuevo video demostrativo...');
        await new Promise(r => setTimeout(r, 350));
      } else {
        showUploadProgress(75, 'Actualizando catálogo y registros...');
        await new Promise(r => setTimeout(r, 200));
      }

      showUploadProgress(90, 'Guardando cambios en el servidor...');
      const updatedProduct = await updateProduct(state.productId, formData);

      showUploadProgress(100, '¡Cambios guardados exitosamente!');
      await new Promise(r => setTimeout(r, 450));
      hideUploadProgress();

      showToast(
        'success',
        '¡Producto Actualizado!',
        `Se han guardado todos los cambios de "${updatedProduct.product_name || name}".`
      );

      // Actualizar datos locales y regresar a Modo Lectura
      state.product = updatedProduct;
      populateProductData(updatedProduct);
      setEditMode(false);
      setSubmittingState(false);

    } catch (err) {
      console.error('Error al actualizar producto:', err);
      hideUploadProgress();
      setSubmittingState(false);

      let errorMsg = err.message || 'No se pudo guardar la información del producto.';
      if (err.data && typeof err.data === 'object') {
        const errorDetails = Object.entries(err.data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('\n');
        if (errorDetails) {
          errorMsg = errorDetails;
        }
      }
      showToast('error', 'Error al guardar', errorMsg);
    }
  });
}

function setSubmittingState(isSubmitting) {
  state.isSubmitting = isSubmitting;
  const btnMain = document.getElementById('btn-submit-main');
  const btnTop = document.getElementById('btn-save-top');

  [btnMain, btnTop].forEach(btn => {
    if (!btn) return;
    btn.disabled = isSubmitting || !state.isEditMode;
    const spinner = btn.querySelector('.btn-spinner');
    const textSpan = btn.querySelector('.btn-text') || btn.querySelector('span');
    if (spinner) spinner.style.display = isSubmitting ? 'inline-block' : 'none';
    if (textSpan) textSpan.textContent = isSubmitting ? 'Guardando...' : 'Guardar Cambios';
  });
}

// ==========================================================================
// PANTALLA DE CARGA Y PROGRESO DE SUBIDA
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
// NOTIFICACIONES TOAST Y UTILIDADES
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

function showFatalError(title, desc) {
  const container = document.querySelector('.create-product-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; margin: 40px auto; max-width: 600px;">
      <div style="font-size: 3rem; margin-bottom: 12px;">⚠️</div>
      <h2 style="font-size: 1.4rem; font-weight: 700; color: #0f172a; margin-bottom: 8px;">${escapeHtml(title)}</h2>
      <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 24px;">${escapeHtml(desc)}</p>
      <a href="./products.html" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none;">
        ← Volver al Catálogo de Productos
      </a>
    </div>
  `;
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

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
