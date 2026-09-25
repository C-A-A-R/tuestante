import { initNavbar } from '../../components/navbar/navbar.js';
import { resolveImageUrl } from '../../js/api.js';
import { obtenerProductoPorId, obtenerProductos, alternarFavoritoProducto } from './product.api.js';
import { getAccessToken } from '../../js/storage.js';
import { showCartModal } from '../../components/cart-modal/cart-modal.js';
import { showSuccessToast, showInfoToast, showErrorToast } from '../../components/toast/toast.js';
import { createProductCartHTML } from '../../components/product-cart/product-cart.js';

/* ==========================================================================
   CARGA DE COMPONENTES ESTRUCTURALES
   ========================================================================== */

async function loadComponent(placeholderId, filePath) {
    try {
        const url = filePath.includes('?') ? `${filePath}&_v=3.3` : `${filePath}?_v=3.3`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Error al cargar ${filePath}`);
        const html = await response.text();
        const container = document.getElementById(placeholderId);
        if (container) container.innerHTML = html;
    } catch (error) {
        console.error(`Error al cargar el componente ${filePath}:`, error);
    }
}

/* ==========================================================================
   INICIALIZACIÓN PRINCIPAL DE LA VISTA DE DETALLE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadComponent('navbar-placeholder', '../../components/navbar/navbar.html'),
        loadComponent('footer-placeholder', '../../components/footer/footer.html')
    ]);

    initNavbar();
    document.body.classList.add('drawer-collapsed');

    const urlParams = new URLSearchParams(window.location.search);
    let productId = urlParams.get('id');

    let product = null;

    try {
        if (!productId) {
            // Si no viene ID en URL, consultar el primer producto disponible
            const initialList = await obtenerProductos();
            if (Array.isArray(initialList) && initialList.length > 0) {
                productId = initialList[0].id;
            }
        }

        if (productId) {
            product = await obtenerProductoPorId(productId);
        }

        // Si es producto outlet sin stock para clientes públicos, tratar como no disponible
        if (product && product.is_outlet && (!product.quantity || product.quantity <= 0)) {
            product = null;
        }
    } catch (err) {
        console.error('Error al obtener detalle de producto del backend:', err);
        product = null;
    }

    if (product) {
        populateProductDetails(product);
        initImageInteractions(product);

        // Optimización: Cargar ÚNICAMENTE los productos relacionados del mismo tipo
        if (product.product_type) {
            try {
                const relatedList = await obtenerProductos({ type: product.product_type });
                const relatedProducts = (Array.isArray(relatedList) ? relatedList : []).filter(
                    p => p.id !== product.id && (!p.is_outlet || (p.quantity && p.quantity > 0))
                );
                renderRelatedProducts(product, relatedProducts);
            } catch (err) {
                console.error('Error al cargar productos relacionados:', err);
                renderRelatedProducts(product, []);
            }
        } else {
            renderRelatedProducts(product, []);
        }
    } else {
        const mainEl = document.querySelector('.product-details-container') || document.querySelector('main');
        if (mainEl) {
            mainEl.innerHTML = `
                <div class="empty-results-box" style="padding: 80px 20px; text-align: center; max-width: 600px; margin: 40px auto;">
                    <div class="empty-results-icon" style="font-size: 3.5rem; margin-bottom: 16px;">🔍</div>
                    <h2 class="empty-results-title" style="font-size: 1.5rem; font-weight: 700; color: #1e293b; margin-bottom: 10px;">Producto no disponible</h2>
                    <p class="empty-results-desc" style="color: #64748b; font-size: 1rem; line-height: 1.6; margin-bottom: 24px;">El producto solicitado no existe o no se encuentra disponible actualmente en nuestro catálogo.</p>
                    <a href="products.html" class="type-btn" style="display: inline-block; text-decoration: none; padding: 12px 28px; background: #005187; color: white; border-radius: 8px; font-weight: 600;">Volver al Catálogo</a>
                </div>
            `;
        }
    }
});

/* ==========================================================================
   POBLAR VISTA DE DETALLE CON DATOS DEL BACKEND
   ========================================================================== */

function populateProductDetails(product) {
    const starBadgeEl = document.getElementById('badge-destacado-star');
    if (starBadgeEl) {
        starBadgeEl.style.display = product.is_feature_product ? 'inline-flex' : 'none';
    }

    const mainImageUrl = resolveImageUrl(product.product_image, '../../assets/images/productos/estante-blanco.jpeg');

    const imgEl = document.getElementById('detail-product-img');
    if (imgEl) {
        imgEl.src = mainImageUrl;
        imgEl.alt = product.product_name;
    }

    const mirrorImgEl = document.getElementById('zoom-mirror-img');
    if (mirrorImgEl) {
        mirrorImgEl.src = mainImageUrl;
        mirrorImgEl.alt = product.product_name;
    }

    const typeName = product.product_type_detail?.product_type_name || 'General';

    const typeCornerEl = document.getElementById('detail-product-type');
    if (typeCornerEl) typeCornerEl.textContent = typeName.toUpperCase();

    const bcTypeLink = document.getElementById('breadcrumb-type-link');
    if (bcTypeLink) bcTypeLink.href = `products.html?type=${encodeURIComponent(product.product_type || '')}`;

    const bcTypeEl = document.getElementById('breadcrumb-type');
    if (bcTypeEl) bcTypeEl.textContent = typeName;

    const bcProdEl = document.getElementById('breadcrumb-product');
    if (bcProdEl) bcProdEl.textContent = product.product_name;

    const nameEl = document.getElementById('detail-product-name');
    if (nameEl) nameEl.textContent = product.product_name;

    const priceEl = document.getElementById('detail-product-price');
    if (priceEl) {
        const formattedPrice = parseFloat(product.price || 0).toFixed(2);
        let priceHTML = `$${formattedPrice}`;
        if (product.is_outlet) {
            priceHTML += ` <span style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 12px; margin-left: 8px; vertical-align: middle;">⚡ OUTLET (${product.quantity} disp.)</span>`;
        }
        priceEl.innerHTML = priceHTML;
    }

    const descEl = document.getElementById('detail-product-desc');
    const descTextEl = document.getElementById('detail-product-desc-text');
    const descToggleBtn = document.getElementById('description-toggle-btn');
    const fullDescription = String(product.description || '').trim();
    const descriptionLimit = 160;

    // Solo mostrar "Mostrar más" si el texto realmente no cabe en el espacio (supera ~160 caracteres o tiene múltiples párrafos)
    const isLongDescription = fullDescription.length > descriptionLimit;
    const hasMultipleLines = fullDescription.split('\n').filter(l => l.trim().length > 0).length > 2;
    const hasMoreDescription = isLongDescription || hasMultipleLines;

    function getTruncatedDescription(text, maxChars = 145) {
        if (text.length <= maxChars) return text;
        const sliced = text.slice(0, maxChars);
        const lastSpace = sliced.lastIndexOf(' ');
        const cleanSlice = lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced;
        return `${cleanSlice.trimEnd()}...`;
    }

    const shortenedDescription = hasMoreDescription ? getTruncatedDescription(fullDescription, 145) : fullDescription;

    if (descTextEl) {
        descTextEl.textContent = hasMoreDescription ? shortenedDescription : fullDescription;
    }

    if (descToggleBtn) {
        if (!hasMoreDescription) {
            descToggleBtn.hidden = true;
            descToggleBtn.style.display = 'none';
            descToggleBtn.classList.add('is-hidden');
            descToggleBtn.setAttribute('aria-expanded', 'false');
        } else {
            descToggleBtn.hidden = false;
            descToggleBtn.style.display = 'inline';
            descToggleBtn.classList.remove('is-hidden');
            descToggleBtn.textContent = 'Mostrar más';
            descToggleBtn.setAttribute('aria-expanded', 'false');
            descToggleBtn.onclick = () => {
                const isExpanded = descToggleBtn.getAttribute('aria-expanded') === 'true';
                if (isExpanded) {
                    descTextEl.textContent = shortenedDescription;
                    descToggleBtn.textContent = 'Mostrar más';
                    descToggleBtn.setAttribute('aria-expanded', 'false');
                } else {
                    descTextEl.textContent = fullDescription;
                    descToggleBtn.textContent = 'Mostrar menos';
                    descToggleBtn.setAttribute('aria-expanded', 'true');
                }
            };
        }
    }

    const heightEl = document.getElementById('detail-spec-height');
    if (heightEl) heightEl.textContent = `${parseFloat(product.height_cm || 180)} cm`;

    const lengthEl = document.getElementById('detail-spec-length');
    if (lengthEl) lengthEl.textContent = `${parseFloat(product.depth_cm || 90)} cm`;

    const widthEl = document.getElementById('detail-spec-width');
    if (widthEl) widthEl.textContent = `${parseFloat(product.width_cm || 45)} cm`;

    const secContainer = document.getElementById('detail-spec-security-container');
    const secEl = document.getElementById('detail-spec-security');
    if (secContainer) secContainer.style.display = 'flex';
    if (secEl) secEl.textContent = product.security || 'Porta candado / Llave individual';

    document.title = `${product.product_name} - TuEstante`;

    renderProductThumbnails(product, mainImageUrl);
    renderProductColors(product, mainImageUrl);

    const isAvailable = product.is_active && (!product.is_outlet || product.quantity > 0);
    const btnAddCart = document.getElementById('btn-add-to-cart');

    if (btnAddCart) {
        btnAddCart.setAttribute('data-id', product.id);
        btnAddCart.setAttribute('data-name', product.product_name);
        btnAddCart.setAttribute('data-price', product.price);
        btnAddCart.setAttribute('data-image', mainImageUrl);

        if (!isAvailable) {
            btnAddCart.disabled = true;
            btnAddCart.textContent = 'Agotado / No disponible';
            btnAddCart.style.opacity = '0.6';
            btnAddCart.style.cursor = 'not-allowed';
            btnAddCart.style.background = '#94a3b8';
        } else {
            btnAddCart.disabled = false;
            btnAddCart.textContent = '+ Carrito';
            btnAddCart.style.opacity = '1';
            btnAddCart.style.cursor = 'pointer';
            btnAddCart.style.background = '';
        }

        btnAddCart.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            if (!isAvailable) {
                showErrorToast('Producto no disponible', 'Este producto se encuentra agotado o inactivo.');
                return;
            }

            const id = parseInt(btnAddCart.getAttribute('data-id'), 10) || product.id;
            const name = btnAddCart.getAttribute('data-name') || product.product_name;
            const price = parseFloat(btnAddCart.getAttribute('data-price')) || parseFloat(product.price) || 0;
            const image = btnAddCart.getAttribute('data-image') || mainImageUrl;

            let selectedColor = product.main_color || 'Estándar';
            const activeSwatch = document.querySelector('.color-swatch-btn.active');
            if (activeSwatch) {
                const colorTitle = activeSwatch.getAttribute('title') || activeSwatch.getAttribute('data-color-name');
                if (colorTitle) selectedColor = colorTitle;
            }

            const qtyInput = document.getElementById('detail-qty-input');
            let addQty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
            if (product.is_outlet && addQty > product.quantity) {
                addQty = product.quantity;
                if (qtyInput) qtyInput.value = addQty;
                showInfoToast('Límite de stock', `Solo hay ${product.quantity} unidades disponibles en Outlet.`);
            }

            const CART_STORAGE_KEY = 'tuestante_cart';
            let items = [];
            try {
                const raw = localStorage.getItem(CART_STORAGE_KEY);
                if (raw) items = JSON.parse(raw);
            } catch (err) {
                items = [];
            }

            const existingIndex = items.findIndex(i => String(i.id) === String(id) && i.color === selectedColor);
            if (existingIndex > -1) {
                items[existingIndex].qty += addQty;
            } else {
                items.push({ id, name, price, image, color: selectedColor, qty: addQty });
            }
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
            window.dispatchEvent(new Event('cart-updated'));

            showCartModal({ id, name, price, image });
        };
    }

    const btnWishlist = document.getElementById('btn-detail-wishlist');
    if (btnWishlist) {
        btnWishlist.classList.toggle('active', Boolean(product.is_favorite));
        btnWishlist.setAttribute('title', product.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos');

        btnWishlist.onclick = async (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            if (!getAccessToken()) {
                showInfoToast('Inicia Sesión', 'Debes iniciar sesión para guardar productos en tu lista de deseos.');
                return;
            }

            btnWishlist.disabled = true;
            try {
                const res = await alternarFavoritoProducto(product.id);
                if (res && typeof res.is_favorite === 'boolean') {
                    product.is_favorite = res.is_favorite;
                    btnWishlist.classList.toggle('active', res.is_favorite);
                    btnWishlist.setAttribute('title', res.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos');

                    if (res.is_favorite) {
                        showSuccessToast('Lista de Deseos', res.message || 'Producto agregado a tus favoritos.');
                    } else {
                        showInfoToast('Lista de Deseos', res.message || 'Producto eliminado de tus favoritos.');
                    }
                }
            } catch (err) {
                console.error('Error al alternar favorito:', err);
                showErrorToast('Error', 'No se pudo actualizar la lista de deseos.');
            } finally {
                btnWishlist.disabled = false;
            }
        };
    }

    const qtyMinus = document.getElementById('qty-minus');
    const qtyPlus = document.getElementById('qty-plus');
    const qtyInput = document.getElementById('detail-qty-input');

    if (qtyInput) {
        qtyInput.addEventListener('keydown', (e) => {
            if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
        });

        qtyInput.addEventListener('input', () => {
            if (qtyInput.value.length > 4) qtyInput.value = qtyInput.value.slice(0, 4);
        });

        const normalizeQty = () => {
            let val = parseInt(qtyInput.value, 10);
            if (isNaN(val) || val < 1) qtyInput.value = 1;
            else if (val > 9999) qtyInput.value = 9999;
            else qtyInput.value = val;
        };

        qtyInput.addEventListener('blur', normalizeQty);
        qtyInput.addEventListener('change', normalizeQty);
    }

    if (qtyMinus && qtyInput) {
        qtyMinus.onclick = () => {
            let val = parseInt(qtyInput.value, 10) || 1;
            if (val > 1) qtyInput.value = val - 1;
        };
    }
    if (qtyPlus && qtyInput) {
        qtyPlus.onclick = () => {
            let val = parseInt(qtyInput.value, 10) || 1;
            if (val < 9999) qtyInput.value = val + 1;
        };
    }
}

/* ==========================================================================
   MINIATURAS Y GALERÍA DE COLORES
   ========================================================================== */

function renderProductThumbnails(product, mainImageUrl) {
    const sidebarEl = document.getElementById('product-thumbnails-sidebar');
    if (!sidebarEl) return;

    const hasVideo = Boolean(product.product_video);
    sidebarEl.style.display = 'flex';

    let thumbnailItems = [
        { url: mainImageUrl, title: `Vista Principal - ${product.product_name}` }
    ];

    if (Array.isArray(product.angle_images)) {
        product.angle_images.forEach((ang, idx) => {
            if (ang.image) {
                thumbnailItems.push({
                    url: resolveImageUrl(ang.image, mainImageUrl),
                    title: ang.angle || `Vista ${idx + 1} - ${product.product_name}`
                });
            }
        });
    }

    let html = '';
    thumbnailItems.forEach((item, idx) => {
        html += `
            <button type="button" 
                    class="thumbnail-btn ${idx === 0 ? 'active' : ''}" 
                    data-image-url="${item.url}" 
                    data-title="${item.title}" 
                    title="${item.title}" 
                    aria-label="${item.title}">
                <img src="${item.url}" alt="${item.title}">
            </button>
        `;
    });

    if (hasVideo) {
        const videoUrl = resolveImageUrl(product.product_video);
        html += `
            <button type="button" 
                    class="thumbnail-btn video-thumbnail-btn" 
                    data-video-url="${videoUrl}" 
                    title="Ver Video del Producto" 
                    aria-label="Ver Video del Producto">
                <img src="../../assets/icons/camara-de-video.png" alt="Video del Producto" class="video-thumb-icon">
            </button>
        `;
    }

    sidebarEl.innerHTML = html;

    const mainImgEl = document.getElementById('detail-product-img');
    const mainVideoEl = document.getElementById('detail-product-video');
    const mirrorImgEl = document.getElementById('zoom-mirror-img');
    const lightboxImgEl = document.getElementById('lightbox-img');
    const lightboxVideoEl = document.getElementById('lightbox-video');
    const selectedNameEl = document.getElementById('selected-color-name');

    sidebarEl.querySelectorAll('.thumbnail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sidebarEl.querySelectorAll('.thumbnail-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (btn.classList.contains('video-thumbnail-btn')) {
                const videoUrl = btn.getAttribute('data-video-url');
                if (selectedNameEl) selectedNameEl.textContent = 'Video del Producto';

                if (mainImgEl) mainImgEl.style.display = 'none';
                if (mainVideoEl) {
                    mainVideoEl.src = videoUrl;
                    mainVideoEl.style.display = 'block';
                    mainVideoEl.play().catch(() => {});
                }

                const lensBox = document.getElementById('zoom-lens-box');
                const mirrorPanel = document.getElementById('zoom-mirror-panel');
                if (lensBox) lensBox.classList.remove('active');
                if (mirrorPanel) mirrorPanel.classList.remove('active');

                if (lightboxImgEl) lightboxImgEl.style.display = 'none';
                if (lightboxVideoEl) {
                    lightboxVideoEl.src = videoUrl;
                    lightboxVideoEl.style.display = 'block';
                }
            } else {
                const newImgUrl = btn.getAttribute('data-image-url');
                const title = btn.getAttribute('data-title');

                if (mainVideoEl) {
                    mainVideoEl.pause();
                    mainVideoEl.style.display = 'none';
                }

                if (mainImgEl && newImgUrl) {
                    mainImgEl.src = newImgUrl;
                    mainImgEl.alt = title || product.product_name;
                    mainImgEl.style.display = 'block';
                }

                if (mirrorImgEl && newImgUrl) {
                    mirrorImgEl.src = newImgUrl;
                    mirrorImgEl.alt = title || product.product_name;
                }

                if (lightboxVideoEl) {
                    lightboxVideoEl.pause();
                    lightboxVideoEl.style.display = 'none';
                }
                if (lightboxImgEl && newImgUrl) {
                    lightboxImgEl.src = newImgUrl;
                    lightboxImgEl.style.display = 'block';
                }
            }
        });
    });
}

const CLIENT_COLOR_NAME_MAP = {
  'blanco': '#ffffff', 'white': '#ffffff', 'negro': '#111827', 'black': '#111827',
  'gris': '#9ca3af', 'gris claro': '#d1d5db', 'gris oscuro': '#4b5563', 'gray': '#9ca3af',
  'roble': '#b48a56', 'roble nórdico': '#c29b68', 'madera': '#a0714f', 'marron': '#78350f',
  'café': '#652d0d', 'azul': '#0272bc', 'azul rey': '#0272bc', 'azul oscuro': '#3d5ead',
  'morado': '#702c91', 'fuccia': '#b6217f', 'fucsia': '#b6217f', 'rojo': '#ef1c25',
  'naranja': '#f15a21', 'amarillo': '#fff300', 'turqueza': '#00a28a', 'turquesa': '#00a28a',
  'verde pasto': '#4eb043', 'verde': '#9ec536', 'mostaza': '#ffc20f', 'rosado': '#f472b6',
  'rosa': '#f472b6'
};

function resolveClientColorHex(name, variants = []) {
  if (!name) return '#ffffff';
  const clean = String(name).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean;
  if (/^#[0-9a-f]{3}$/i.test(clean)) {
    return '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
  }
  if (CLIENT_COLOR_NAME_MAP[clean]) return CLIENT_COLOR_NAME_MAP[clean];
  if (Array.isArray(variants)) {
    const matched = variants.find(v => (v.color_name || '').toLowerCase() === clean);
    if (matched && matched.color_hex) return matched.color_hex;
  }
  return '#cbd5e1';
}

function renderProductColors(product, mainImageUrl) {
    const swatchListEl = document.getElementById('colors-swatch-list');
    const selectedNameEl = document.getElementById('selected-color-name');
    if (!swatchListEl) return;

    const baseColorRaw = (product.main_color || product.color_principal || '').trim();
    const resolvedBaseName = baseColorRaw || 'Color Principal';
    const resolvedBaseHex = resolveClientColorHex(baseColorRaw, product.color_images);

    // 1. Color base / principal ligado obligatoriamente a la foto de portada (mainImageUrl)
    let colors = [
        {
            name: resolvedBaseName,
            hex: resolvedBaseHex,
            image: mainImageUrl,
            isBase: true
        }
    ];

    // 2. Variantes de color secundarias registradas en product.color_images
    if (Array.isArray(product.color_images) && product.color_images.length > 0) {
        product.color_images.forEach(c => {
            const vName = (c.color_name || 'Variante').trim();
            const vHex = c.color_hex || '#0272bc';
            const vImg = resolveImageUrl(c.color_image, mainImageUrl);
            // Evitar duplicar si es idéntico a la portada
            const isDuplicate = (vImg === mainImageUrl && vName.toLowerCase() === resolvedBaseName.toLowerCase());
            if (!isDuplicate) {
                colors.push({
                    name: vName,
                    hex: vHex,
                    image: vImg,
                    isBase: false
                });
            }
        });
    }

    if (selectedNameEl) selectedNameEl.textContent = colors[0].name;

    let html = '';
    colors.forEach((c, idx) => {
        html += `
            <button type="button" 
                    class="color-swatch-btn ${idx === 0 ? 'active' : ''} ${c.isBase ? 'is-base-color' : ''}" 
                    style="background-color: ${c.hex};" 
                    data-color-name="${c.name}" 
                    data-color-image="${c.image}" 
                    data-is-base="${c.isBase ? 'true' : 'false'}"
                    title="${c.name}${c.isBase ? ' (Color Principal / Portada)' : ''}" 
                    aria-label="${c.name}">
            </button>
        `;
    });

    swatchListEl.innerHTML = html;

    const mainImgEl = document.getElementById('detail-product-img');
    const mainVideoEl = document.getElementById('detail-product-video');
    const mirrorImgEl = document.getElementById('zoom-mirror-img');
    const lightboxImgEl = document.getElementById('lightbox-img');
    const lightboxVideoEl = document.getElementById('lightbox-video');

    swatchListEl.querySelectorAll('.color-swatch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            swatchListEl.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const name = btn.getAttribute('data-color-name');
            const newImage = btn.getAttribute('data-color-image');
            const isBase = btn.getAttribute('data-is-base') === 'true';

            if (selectedNameEl) selectedNameEl.textContent = name;

            const sidebarEl = document.getElementById('product-thumbnails-sidebar');
            if (sidebarEl) {
                sidebarEl.querySelectorAll('.thumbnail-btn').forEach(b => b.classList.remove('active'));
                if (isBase) {
                    const firstThumb = sidebarEl.querySelector('.thumbnail-btn:not(.video-thumbnail-btn)');
                    if (firstThumb) firstThumb.classList.add('active');
                }
            }

            if (mainVideoEl) {
                mainVideoEl.pause();
                mainVideoEl.style.display = 'none';
            }
            if (mainImgEl && newImage) {
                mainImgEl.src = newImage;
                mainImgEl.alt = `${product.product_name} - ${name}`;
                mainImgEl.style.display = 'block';
            }

            if (newImage && mirrorImgEl) {
                mirrorImgEl.src = newImage;
                mirrorImgEl.alt = `${product.product_name} - ${name}`;
            }


            if (lightboxVideoEl) {
                lightboxVideoEl.pause();
                lightboxVideoEl.style.display = 'none';
            }
            if (newImage && lightboxImgEl) {
                lightboxImgEl.src = newImage;
                lightboxImgEl.style.display = 'block';
            }
        });
    });
}

/* ==========================================================================
   LUPA DE PRECISIÓN Y LIGHTBOX
   ========================================================================== */

function initImageInteractions(product) {
    const mainImgContainer = document.getElementById('main-image-container');
    const mainImg = document.getElementById('detail-product-img');
    const mainVideo = document.getElementById('detail-product-video');
    const lensBox = document.getElementById('zoom-lens-box');
    const galleryCard = document.querySelector('.product-gallery-card');

    const mirrorPanel = document.getElementById('zoom-mirror-panel');
    const mirrorImg = document.getElementById('zoom-mirror-img');
    const toggleLupaBtn = document.getElementById('toggle-lupa-btn');
    const lupaBtnText = document.getElementById('lupa-btn-text');

    const modal = document.getElementById('image-lightbox-modal');
    const modalImg = document.getElementById('lightbox-img');
    const modalVideo = document.getElementById('lightbox-video');
    const closeBtn = document.getElementById('lightbox-close');
    const overlay = document.getElementById('lightbox-overlay');

    let isLupaActive = true;

    function updateLupaBtnUI() {
        if (!toggleLupaBtn) return;
        if (isLupaActive) {
            toggleLupaBtn.classList.add('active');
            if (lupaBtnText) lupaBtnText.textContent = 'Lupa: ACTIVADA';
        } else {
            toggleLupaBtn.classList.remove('active');
            if (lupaBtnText) lupaBtnText.textContent = 'Lupa: DESACTIVADA';
            if (lensBox) lensBox.classList.remove('active');
            if (mirrorPanel) mirrorPanel.classList.remove('active');
        }
    }

    if (toggleLupaBtn) {
        toggleLupaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isLupaActive = !isLupaActive;
            updateLupaBtnUI();
        });
    }

    function updateLupaPosition() {
        const headerBlock = document.getElementById('product-header-block') || document.querySelector('.product-price-container');
        const infoPanel = document.getElementById('product-info-panel');
        if (headerBlock && infoPanel && mirrorPanel) {
            const headerRect = headerBlock.getBoundingClientRect();
            const panelRect = infoPanel.getBoundingClientRect();
            const offset = Math.max(0, Math.round(headerRect.bottom - panelRect.top + 8));
            infoPanel.style.setProperty('--lupa-top-offset', `${offset}px`);
        }
    }

    window.addEventListener('resize', updateLupaPosition);
    updateLupaPosition();

    if (mainImgContainer && mainImg && lensBox && mirrorPanel && mirrorImg) {
        mainImgContainer.addEventListener('mouseenter', () => {
            const isVideoVisible = mainVideo && mainVideo.style.display !== 'none';
            if (isLupaActive && !isVideoVisible) {
                updateLupaPosition();
                lensBox.classList.add('active');
                mirrorPanel.classList.add('active');
            }
        });

        mainImgContainer.addEventListener('mousemove', (e) => {
            const isVideoVisible = mainVideo && mainVideo.style.display !== 'none';
            if (!isLupaActive || isVideoVisible) {
                if (lensBox) lensBox.classList.remove('active');
                if (mirrorPanel) mirrorPanel.classList.remove('active');
                return;
            }

            const containerRect = mainImgContainer.getBoundingClientRect();
            const imgRect = mainImg.getBoundingClientRect();

            const imgLeft = imgRect.left - containerRect.left;
            const imgTop = imgRect.top - containerRect.top;
            const imgW = imgRect.width || 1;
            const imgH = imgRect.height || 1;

            const lensW = lensBox.offsetWidth || 150;
            const lensH = lensBox.offsetHeight || 150;

            const containerX = e.clientX - containerRect.left;
            const containerY = e.clientY - containerRect.top;

            let lensX = containerX - lensW / 2;
            let lensY = containerY - lensH / 2;

            if (lensX < imgLeft) lensX = imgLeft;
            if (lensY < imgTop) lensY = imgTop;
            if (lensX > imgLeft + imgW - lensW) lensX = imgLeft + imgW - lensW;
            if (lensY > imgTop + imgH - lensH) lensY = imgTop + imgH - lensH;

            lensBox.style.left = `${lensX}px`;
            lensBox.style.top = `${lensY}px`;

            const lensCenterX = (lensX + lensW / 2) - imgLeft;
            const lensCenterY = (lensY + lensH / 2) - imgTop;

            const ratioX = Math.max(0, Math.min(1, lensCenterX / imgW));
            const ratioY = Math.max(0, Math.min(1, lensCenterY / imgH));

            const viewport = mirrorImg.parentElement;
            const viewW = viewport ? viewport.clientWidth : 500;
            const viewH = viewport ? viewport.clientHeight : 500;
            const scale = 2.5;

            mirrorImg.style.width = `${imgW}px`;
            mirrorImg.style.height = `${imgH}px`;

            const targetX = ratioX * imgW * scale;
            const targetY = ratioY * imgH * scale;
            const tx = (viewW / 2) - targetX;
            const ty = (viewH / 2) - targetY;

            mirrorImg.style.transformOrigin = '0 0';
            mirrorImg.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
        });

        mainImgContainer.addEventListener('mouseleave', () => {
            if (lensBox) lensBox.classList.remove('active');
            if (mirrorPanel) mirrorPanel.classList.remove('active');
        });
    }

    function openLightbox() {
        if (!modal) return;
        const isVideoVisible = mainVideo && mainVideo.style.display !== 'none';
        if (isVideoVisible && modalVideo && product.product_video) {
            if (modalImg) modalImg.style.display = 'none';
            modalVideo.src = resolveImageUrl(product.product_video);
            modalVideo.style.display = 'block';
            modalVideo.play().catch(() => {});
        } else if (modalImg) {
            if (modalVideo) {
                modalVideo.pause();
                modalVideo.style.display = 'none';
            }
            modalImg.src = mainImg ? mainImg.src : resolveImageUrl(product.product_image);
            modalImg.alt = product.product_name;
            modalImg.style.display = 'block';
        }
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        if (!modal) return;
        if (modalVideo) modalVideo.pause();
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    if (galleryCard) {
        galleryCard.addEventListener('click', (e) => {
            if (
                e.target.closest('#product-thumbnails-sidebar') ||
                e.target.closest('#colors-swatch-list') ||
                e.target.closest('.color-swatch-btn') ||
                e.target.closest('.thumbnail-btn') ||
                e.target.closest('#toggle-lupa-btn') ||
                e.target.closest('.badge-destacado-star') ||
                e.target.closest('video')
            ) return;
            openLightbox();
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (overlay) overlay.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeLightbox();
        }
    });

    updateLupaBtnUI();
}

/* ==========================================================================
   CARRUSEL DE PRODUCTOS RELACIONADOS (UN SOLO TIPO DE PRODUCTO)
   ========================================================================== */

function renderRelatedProducts(currentProduct, related = []) {
    const section = document.querySelector('.related-products-section');
    const track = document.getElementById('related-grid-track');
    const viewport = document.getElementById('related-carousel-viewport');
    const prevBtn = document.getElementById('related-prev-btn');
    const nextBtn = document.getElementById('related-next-btn');

    if (!track || !viewport) {
        if (section) section.style.display = 'none';
        return;
    }

    if (!related || related.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'block';

    const subtitleEl = document.getElementById('related-subtitle-text');
    if (subtitleEl) {
        const typeName = currentProduct.product_type_detail?.product_type_name || 'este tipo de mueble';
        subtitleEl.textContent = `Explora otros modelos y alternativas de ${typeName}`;
    }

    const totalCols = related.length;

    function getVisibleCols() {
        const width = window.innerWidth;
        if (width <= 480) return 1;
        if (width <= 768) return 2;
        if (width <= 1100) return 3;
        return 4;
    }

    function getGapPixels() {
        const width = window.innerWidth;
        if (width <= 480) return 12;
        if (width <= 768) return 16;
        return 20;
    }

    const visibleCols = getVisibleCols();
    const isInfinite = totalCols > visibleCols;

    function createCardHTML(p, col) {
        // El componente genera el HTML de la carta; luego se le inyecta el grid-column
        // necesario para el carrusel de scroll infinito.
        const cardHTML = createProductCartHTML(p, {
            detailBaseUrl: 'product-details.html',
            fallbackImage: '../../assets/images/productos/estante-blanco.jpeg',
        });
        // Insertar estilo de posicionamiento en la columna del grid del carrusel
        return cardHTML.replace(
            'class="unified-product-card"',
            `class="unified-product-card" style="grid-row: 1; grid-column: ${col}; height: 100%;"`
        );
    }

    const cloneCount = Math.max(visibleCols, 3);
    let htmlContent = '';

    if (isInfinite) {
        related.forEach((p, idx) => {
            const col = idx + 1;
            if (col > totalCols - cloneCount) {
                htmlContent += createCardHTML(p, col - totalCols);
            }
        });

        related.forEach((p, idx) => {
            htmlContent += createCardHTML(p, idx + 1);
        });

        related.forEach((p, idx) => {
            const col = idx + 1;
            if (col <= cloneCount) {
                htmlContent += createCardHTML(p, col + totalCols);
            }
        });
    } else {
        related.forEach((p, idx) => {
            htmlContent += createCardHTML(p, idx + 1);
        });
    }

    track.innerHTML = htmlContent;

    let currentCol = 0;
    let isTransitioning = false;
    let autoTimer = null;

    function getColOffsetPixels(colIndex) {
        const vCols = getVisibleCols();
        const gap = getGapPixels();
        const viewportWidth = viewport.clientWidth;
        const colWidth = (viewportWidth - (vCols - 1) * gap) / vCols;

        if (isInfinite) {
            return (colIndex + cloneCount) * (colWidth + gap);
        } else {
            return colIndex * (colWidth + gap);
        }
    }

    function updatePosition(animate = true) {
        const offset = getColOffsetPixels(currentCol);
        if (animate) {
            track.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
        } else {
            track.style.transition = 'none';
        }
        track.style.transform = `translateX(-${offset}px)`;

        if (!isInfinite) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        } else {
            if (prevBtn) prevBtn.style.display = 'flex';
            if (nextBtn) nextBtn.style.display = 'flex';
        }
    }

    function slideNext() {
        if (!isInfinite || isTransitioning) return;
        isTransitioning = true;
        currentCol++;
        updatePosition(true);

        setTimeout(() => {
            if (currentCol >= totalCols) {
                currentCol = 0;
                updatePosition(false);
            }
            isTransitioning = false;
        }, 500);
    }

    function slidePrev() {
        if (!isInfinite || isTransitioning) return;
        isTransitioning = true;
        currentCol--;
        updatePosition(true);

        setTimeout(() => {
            if (currentCol < 0) {
                currentCol = totalCols - 1;
                updatePosition(false);
            }
            isTransitioning = false;
        }, 500);
    }

    function startAutoSlide() {
        if (!isInfinite) return;
        stopAutoSlide();
        autoTimer = setInterval(slideNext, 4000);
    }

    function stopAutoSlide() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    if (prevBtn) {
        prevBtn.onclick = () => {
            slidePrev();
            startAutoSlide();
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            slideNext();
            startAutoSlide();
        };
    }

    viewport.addEventListener('mouseenter', stopAutoSlide);
    viewport.addEventListener('mouseleave', startAutoSlide);

    window.addEventListener('resize', () => {
        updatePosition(false);
    });

    updatePosition(false);
    startAutoSlide();

    track.addEventListener('click', async (e) => {
        const wishlistBtn = e.target.closest('.unified-wishlist-btn');
        if (wishlistBtn) {
            const id = wishlistBtn.getAttribute('data-id');
            if (!id) return;

            if (!getAccessToken()) {
                showInfoToast('Inicia Sesión', 'Debes iniciar sesión para guardar productos en tu lista de deseos.');
                return;
            }

            wishlistBtn.disabled = true;
            try {
                const res = await alternarFavoritoProducto(id);
                if (res && typeof res.is_favorite === 'boolean') {
                    wishlistBtn.classList.toggle('active', res.is_favorite);
                    wishlistBtn.setAttribute('title', res.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos');

                    if (res.is_favorite) {
                        showSuccessToast('Lista de Deseos', res.message || 'Producto agregado a tus favoritos.');
                    } else {
                        showInfoToast('Lista de Deseos', res.message || 'Producto eliminado de tus favoritos.');
                    }
                }
            } catch (err) {
                console.error('Error al alternar favorito:', err);
                showErrorToast('Error', 'No se pudo actualizar la lista de deseos.');
            } finally {
                wishlistBtn.disabled = false;
            }
            return;
        }

        const btn = e.target.closest('.btn-card-add-cart');
        if (btn) {
            const id = parseInt(btn.getAttribute('data-id'), 10);
            const name = btn.getAttribute('data-name');
            const price = parseFloat(btn.getAttribute('data-price')) || 0;
            const image = btn.getAttribute('data-image');

            const CART_STORAGE_KEY = 'tuestante_cart';
            let items = [];
            try {
                const raw = localStorage.getItem(CART_STORAGE_KEY);
                if (raw) items = JSON.parse(raw);
            } catch (err) {
                items = [];
            }

            const existingIndex = items.findIndex(i => String(i.id) === String(id));
            if (existingIndex > -1) {
                items[existingIndex].qty += 1;
            } else {
                items.push({ id, name, price, image, color: 'Estándar', qty: 1 });
            }
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
            window.dispatchEvent(new Event('cart-updated'));
            showCartModal({ id, name, price, image });
        }
    });
}
