import { initNavbar } from '../../components/navbar/navbar.js';
import { resolveImageUrl } from '../../js/api.js';
import { obtenerProductoPorId, obtenerProductos, alternarFavoritoProducto } from './product.api.js';
import { getAccessToken } from '../../js/storage.js';
import { showCartModal } from '../../components/cart-modal/cart-modal.js';
import { showSuccessToast, showInfoToast, showErrorToast } from '../../components/toast/toast.js';

/* ==========================================================================
   CARGA DE COMPONENTES ESTRUCTURALES
   ========================================================================== */

async function loadComponent(placeholderId, filePath) {
    try {
        const response = await fetch(filePath);
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
    if (descEl) descEl.textContent = product.description || '';

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

function renderProductColors(product, mainImageUrl) {
    const swatchListEl = document.getElementById('colors-swatch-list');
    const selectedNameEl = document.getElementById('selected-color-name');
    if (!swatchListEl) return;

    let colors = [];
    if (Array.isArray(product.color_images) && product.color_images.length > 0) {
        colors = product.color_images.map(c => ({
            name: c.color_name || 'Color',
            hex: c.color_hex || '#005187',
            image: resolveImageUrl(c.color_image, mainImageUrl)
        }));
    } else if (product.main_color) {
        colors = [
            { name: product.main_color, hex: '#005187', image: mainImageUrl }
        ];
    } else {
        // Si no tiene variantes de color registradas en el backend, dejar estándar
        colors = [
            { name: 'Estándar', hex: '#64748b', image: mainImageUrl }
        ];
    }

    if (selectedNameEl) selectedNameEl.textContent = colors[0].name;

    let html = '';
    colors.forEach((c, idx) => {
        html += `
            <button type="button" 
                    class="color-swatch-btn ${idx === 0 ? 'active' : ''}" 
                    style="background-color: ${c.hex};" 
                    data-color-name="${c.name}" 
                    data-color-image="${c.image}" 
                    title="${c.name}" 
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

            if (selectedNameEl) selectedNameEl.textContent = name;

            const sidebarEl = document.getElementById('product-thumbnails-sidebar');
            if (sidebarEl) {
                sidebarEl.querySelectorAll('.thumbnail-btn').forEach(b => b.classList.remove('active'));
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

    if (mainImgContainer && mainImg && lensBox && mirrorPanel && mirrorImg) {
        mainImgContainer.addEventListener('mouseenter', () => {
            const isVideoVisible = mainVideo && mainVideo.style.display !== 'none';
            if (isLupaActive && !isVideoVisible) {
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
        const starBadgeHTML = p.is_feature_product ? `
            <div class="badge-destacado-star" title="Producto Destacado">
                <svg class="star-icon" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span class="star-label">Producto Destacado</span>
            </div>
        ` : '';

        const outletBadgeHTML = p.is_outlet ? `
            <div class="badge-outlet-flag" style="position: absolute; top: 12px; left: 12px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35); z-index: 3; display: flex; align-items: center; gap: 4px;">
                <span>⚡ OUTLET</span>
                ${p.quantity > 0 ? `<span style="background: rgba(0,0,0,0.25); padding: 1px 6px; border-radius: 10px; font-size: 0.68rem;">${p.quantity} disp.</span>` : ''}
            </div>
        ` : '';

        const prodImg = resolveImageUrl(p.product_image, '../../assets/images/productos/estante-blanco.jpeg');
        const formattedPrice = parseFloat(p.price || 0).toFixed(2);

        let swatchesHTML = '';
        if (Array.isArray(p.color_images) && p.color_images.length > 0) {
            const visibleColors = p.color_images.slice(0, 4);
            const remaining = p.color_images.length - 4;
            const dots = visibleColors.map(c => `
                <span class="swatch-dot" style="background-color: ${c.color_hex || '#cbd5e1'};" title="${c.color_name || 'Color'}"></span>
            `).join('');
            const more = remaining > 0 ? `<span class="swatch-more">+${remaining}</span>` : '';
            swatchesHTML = `<div class="unified-card-swatches">${dots}${more}</div>`;
        }

        return `
            <div class="unified-product-card" style="grid-row: 1; grid-column: ${col}; height: 100%;">
                <div class="unified-card-media" style="position: relative;">
                    <a href="product-details.html?id=${p.id}" class="unified-card-img-link">
                        <img src="${prodImg}" alt="${p.product_name}" class="unified-card-img" loading="lazy">
                    </a>
                    
                    ${outletBadgeHTML}
                    ${starBadgeHTML}
                    
                    <button class="unified-wishlist-btn ${p.is_favorite ? 'active' : ''}" data-id="${p.id}" title="${p.is_favorite ? 'Quitar de lista de deseos' : 'Añadir a lista de deseos'}" aria-label="Añadir a favoritos">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                </div>

                <div class="unified-card-body">
                    <div>
                        <div class="unified-card-header">
                            <h3 class="unified-card-title">
                                <a href="product-details.html?id=${p.id}">${p.product_name}</a>
                            </h3>
                            <span class="unified-card-price">$${formattedPrice}</span>
                        </div>

                        <p class="unified-card-desc">${p.description || ''}</p>

                        ${swatchesHTML}
                    </div>

                    <div class="unified-card-actions">
                        <a href="product-details.html?id=${p.id}" class="unified-btn btn-details">Ver Detalle</a>
                        <button class="unified-btn btn-card-add-cart" data-id="${p.id}" data-name="${p.product_name}" data-price="${p.price}" data-image="${prodImg}">
                            + Carrito
                        </button>
                    </div>
                </div>
            </div>
        `;
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
