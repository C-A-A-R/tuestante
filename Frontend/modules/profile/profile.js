/**
 * ==========================================================================
 * LÓGICA DE LA PANTALLA 'MI PERFIL' - TUESTANTE
 * Maneja la visualización de datos con bloqueo por defecto, alternador de
 * modo edición, solicitud de actualización de contraseña por correo, accesos
 * rápidos (Mis compras, productos deseados, carrito) y cierre de sesión.
 * ==========================================================================
 */

import { getProfileData, fetchProfileFromAPI, updateProfileData, sendPasswordResetEmail } from './profile.api.js';
import { logoutUser } from '../auth/auth.js';
import { getAccessToken, getRefreshToken } from '../../js/storage.js';
import { showToast, showSuccessToast, showErrorToast, showInfoToast } from '../../components/toast/toast.js';
import { initNavbar } from '../../components/navbar/navbar.js';
import { initFooter } from '../../components/footer/footer.js';
import { obtenerMisPedidos } from '../order/order.api.js';
import { resolveImageUrl, extractList } from '../../js/api.js';
import { getVenezuelaStates, getCitiesByState } from '../../js/locations.js';

// Estado Global de Edición
let isEditingMode = false;
let currentUser = null;

// Cargar Componentes Dinámicos
async function loadComponent(elementId, filePath) {
    try {
        const url = filePath.includes('?') ? `${filePath}&_t=${Date.now()}` : `${filePath}?_t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
            const html = await response.text();
            const el = document.getElementById(elementId);
            if (el) el.innerHTML = html;
        }
    } catch (err) {
        console.error(`Error al cargar componente ${filePath}:`, err);
    }
}

// Inicialización de la Pantalla
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validar Sesión Activa
    const token = getAccessToken();
    currentUser = getProfileData();

    if (!token || !currentUser) {
        window.location.href = `../../modules/auth/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
    }

    // 2. Cargar Navbar y Footer
    await loadComponent('navbar-container', '../../components/navbar/navbar.html');
    await loadComponent('footer-container', '../../components/footer/footer.html');
    initNavbar();
    initFooter();

    // 3. Inicializar Selects de Ubicación (Estados y Ciudades)
    setupLocationSelects();

    // 4. Renderizar Información en el Hero y en el Formulario (datos en caché)
    renderUserProfile(currentUser);

    // 4. Sincronizar en segundo plano con el Backend para traer los datos más recientes
    fetchProfileFromAPI().then(freshUser => {
        if (freshUser) {
            currentUser = freshUser;
            renderUserProfile(currentUser);
        }
    });

    // 5. Configurar Eventos
    setupTabEvents();
    setupEditModeToggle();
    setupProfileForm();
    setupPasswordResetModal();
    setupLogoutAction();

    // 6. Cargar miniatura de la última compra en 'Mis Compras'
    loadRecentOrderThumbnail();
});

/**
 * Configuración de selects de Estado y Ciudad para el perfil del cliente.
 */
function setupLocationSelects() {
    const stateSelect = document.getElementById('input-state');
    const citySelect = document.getElementById('input-city');
    if (!stateSelect || !citySelect) return;

    const states = getVenezuelaStates();
    stateSelect.innerHTML = '<option value="">Selecciona un estado</option>';
    states.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        stateSelect.appendChild(opt);
    });

    stateSelect.addEventListener('change', () => {
        const selectedState = stateSelect.value;
        citySelect.innerHTML = '<option value="">Selecciona una ciudad</option>';
        if (!selectedState) {
            citySelect.disabled = true;
            return;
        }

        const cities = getCitiesByState(selectedState);
        cities.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            citySelect.appendChild(opt);
        });

        // Habilitar según si estamos en modo edición
        citySelect.disabled = !isEditingMode;
    });
}

/**
 * Renderiza los datos del usuario en la tarjeta Hero y llena los inputs del formulario.
 */
function renderUserProfile(user) {
    if (!user) return;

    const firstName = user.first_name || '';
    const firstLastName = user.first_last_name || '';
    const fullName = `${firstName} ${firstLastName}`.trim() || user.username || 'Usuario TuEstante';
    const email = user.email || '';
    const username = user.username ? `@${user.username}` : '@usuario';
    const isStaff = Boolean(user.is_staff || user.is_superuser);

    // 1. Hero Avatar e Iniciales
    const initialsEl = document.getElementById('profile-avatar-initials');
    if (initialsEl) {
        const initial1 = firstName ? firstName[0].toUpperCase() : (user.username ? user.username[0].toUpperCase() : 'U');
        const initial2 = firstLastName ? firstLastName[0].toUpperCase() : '';
        initialsEl.textContent = `${initial1}${initial2}`;
    }

    // 2. Hero Info
    const nameEl = document.getElementById('hero-user-name');
    const emailEl = document.getElementById('hero-user-email');
    const memberSinceEl = document.getElementById('hero-member-since');

    if (nameEl) nameEl.textContent = fullName;
    if (emailEl) emailEl.textContent = email;

    if (memberSinceEl && user.date_joined) {
        try {
            const year = new Date(user.date_joined).getFullYear();
            memberSinceEl.textContent = `Miembro desde ${year}`;
        } catch {
            memberSinceEl.textContent = 'Miembro activo';
        }
    }

    // 3. Asignar valores a los inputs
    const setInputValue = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setInputValue('input-first-name', user.first_name);
    setInputValue('input-second-name', user.second_name);
    setInputValue('input-first-last-name', user.first_last_name);
    setInputValue('input-second-last-name', user.second_last_name);
    setInputValue('input-identity-document', user.identity_document);
    setInputValue('input-phone', user.phone);
    setInputValue('input-email', user.email);
    setInputValue('input-birth-date', user.birth_date);

    // Estado y Ciudad en cascada
    const stateSelect = document.getElementById('input-state');
    const citySelect = document.getElementById('input-city');
    if (stateSelect) {
        stateSelect.value = user.state || '';
        if (citySelect) {
            citySelect.innerHTML = '<option value="">Selecciona una ciudad</option>';
            if (user.state) {
                const cities = getCitiesByState(user.state);
                cities.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    citySelect.appendChild(opt);
                });
                citySelect.value = user.city || '';
            }
            citySelect.disabled = !isEditingMode || !user.state;
        }
    }

    setInputValue('input-address', user.address);
}

/**
 * Controla el alternador de modo de edición (bloqueado por defecto).
 */
function setupEditModeToggle() {
    const btnToggle = document.getElementById('btn-toggle-edit');
    const btnCancel = document.getElementById('btn-cancel-edit');

    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            setEditingMode(!isEditingMode);
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            // Restaurar valores originales del usuario y bloquear
            renderUserProfile(currentUser);
            setEditingMode(false);
            showInfoToast('Edición Cancelada', 'No se realizaron cambios en tu información.');
        });
    }
}

/**
 * Aplica el estado de bloqueo o edición a los inputs del formulario.
 */
function setEditingMode(enable) {
    isEditingMode = enable;

    const editableInputIds = [
        'input-first-name',
        'input-second-name',
        'input-first-last-name',
        'input-second-last-name',
        'input-identity-document',
        'input-phone',
        'input-birth-date',
        'input-state',
        'input-city',
        'input-address'
    ];

    editableInputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.disabled = !isEditingMode;
        }
    });

    const editActions = document.getElementById('profile-edit-actions');
    const btnToggle = document.getElementById('btn-toggle-edit');
    const toggleIcon = document.getElementById('toggle-edit-icon');
    const toggleText = document.getElementById('toggle-edit-text');

    if (editActions) {
        editActions.style.display = isEditingMode ? 'flex' : 'none';
    }

    if (btnToggle && toggleIcon && toggleText) {
        if (isEditingMode) {
            btnToggle.classList.add('editing-active');
            toggleIcon.textContent = '🔓';
            toggleText.textContent = 'Bloquear Edición';
            document.getElementById('input-first-name')?.focus();
        } else {
            btnToggle.classList.remove('editing-active');
            toggleIcon.textContent = '🔒';
            toggleText.textContent = 'Habilitar Edición';
        }
    }
}

/**
 * Configura el guardado del formulario de datos personales.
 */
function setupProfileForm() {
    const form = document.getElementById('profile-info-form');
    const btnSave = document.getElementById('btn-save-profile');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const firstName = document.getElementById('input-first-name')?.value.trim();
        const firstLastName = document.getElementById('input-first-last-name')?.value.trim();

        if (!firstName) {
            showErrorToast('Campo requerido', 'Por favor ingresa tu primer nombre.');
            return;
        }
        if (!firstLastName) {
            showErrorToast('Campo requerido', 'Por favor ingresa tu primer apellido.');
            return;
        }

        const updatedData = {
            first_name: firstName,
            second_name: document.getElementById('input-second-name')?.value.trim(),
            first_last_name: firstLastName,
            second_last_name: document.getElementById('input-second-last-name')?.value.trim(),
            identity_document: document.getElementById('input-identity-document')?.value.trim(),
            phone: document.getElementById('input-phone')?.value.trim(),
            birth_date: document.getElementById('input-birth-date')?.value || null,
            state: document.getElementById('input-state')?.value.trim() || '',
            city: document.getElementById('input-city')?.value.trim() || '',
            address: document.getElementById('input-address')?.value.trim() || '',
        };

        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = `<span>Guardando...</span>`;
        }

        try {
            currentUser = await updateProfileData(updatedData);
            renderUserProfile(currentUser);
            setEditingMode(false); // Volver al estado bloqueado seguro
            showSuccessToast('Perfil Actualizado', 'Tus datos personales y dirección se han guardado con éxito.');
        } catch (err) {
            console.error('Error al guardar datos del perfil:', err);
            showErrorToast('Error', err?.data?.error || err?.message || 'No se pudieron guardar los cambios.');
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Guardar Cambios</span>
                `;
            }
        }
    });
}

/**
 * Configura la confirmación y solicitud de actualización de contraseña por correo.
 */
function setupPasswordResetModal() {
    const btnOpenModal = document.getElementById('btn-request-password-reset');
    const modal = document.getElementById('reset-password-modal');
    const modalEmailEl = document.getElementById('modal-user-email');
    const btnCancel = document.getElementById('btn-modal-cancel-reset');
    const btnConfirm = document.getElementById('btn-modal-confirm-reset');

    if (!btnOpenModal || !modal) return;

    btnOpenModal.addEventListener('click', () => {
        if (modalEmailEl && currentUser?.email) {
            modalEmailEl.textContent = currentUser.email;
        }
        modal.style.display = 'flex';
    });

    const closeModal = () => {
        modal.style.display = 'none';
    };

    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            if (!currentUser?.email) {
                showErrorToast('Error', 'No se encontró un correo electrónico asociado a tu cuenta.');
                closeModal();
                return;
            }

            btnConfirm.disabled = true;
            btnConfirm.textContent = 'Enviando correo...';

            try {
                await sendPasswordResetEmail(currentUser.email);
                closeModal();

                showSuccessToast(
                    '¡Revisa tu Correo!',
                    `Hemos enviado un enlace seguro a ${currentUser.email}. Por favor revisa tu bandeja de entrada o carpeta de spam para actualizar tu contraseña.`
                );

            } catch (err) {
                console.error('Error al solicitar restablecimiento de contraseña:', err);
                closeModal();
                showErrorToast('Error', 'No se pudo enviar el correo de restablecimiento. Intenta más tarde.');
            } finally {
                btnConfirm.disabled = false;
                btnConfirm.textContent = 'Sí, enviar enlace';
            }
        });
    }
}

/**
 * Configura la navegación por pestañas (Datos Personales / Accesos Rápidos).
 */
function setupTabEvents() {
    const tabButtons = document.querySelectorAll('.profile-tab-btn');
    const tabPanes = document.querySelectorAll('.profile-tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            if (!targetId) return;

            tabButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            tabPanes.forEach(pane => pane.classList.remove('active'));

            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
}

/**
 * Configura la acción de cerrar sesión desde la pestaña de cuenta.
 */
function setupLogoutAction() {
    const btnLogout = document.getElementById('btn-profile-logout');
    if (!btnLogout) return;

    btnLogout.addEventListener('click', async () => {
        const confirmed = typeof window.showLogoutConfirmModal === 'function'
            ? await window.showLogoutConfirmModal()
            : confirm('¿Estás seguro de que deseas cerrar sesión en TuEstante?');
        if (!confirmed) return;

        try {
            const refreshToken = getRefreshToken();
            await logoutUser(refreshToken);
        } catch (err) {
            console.warn('Error al enviar revocación de token:', err);
        } finally {
            showInfoToast('Sesión Cerrada', 'Has cerrado sesión exitosamente.');
            setTimeout(() => {
                window.location.href = '../../modules/auth/login.html';
            }, 500);
        }
    });
}

/**
 * Consulta la orden más reciente del usuario y reemplaza el icono de "Mis Compras"
 * por la imagen real del primer producto comprado.
 */
async function loadRecentOrderThumbnail() {
    const ordersDescEl = document.getElementById('quick-orders-desc');

    try {
        const resp = await obtenerMisPedidos({ page_size: 5 });
        const orders = extractList(resp);

        if (Array.isArray(orders) && orders.length > 0) {
            const latestOrder = orders[0];
            const details = Array.isArray(latestOrder.details) ? latestOrder.details : [];
            let foundImage = '';
            let productName = '';

            for (const detail of details) {
                const prod = detail.order_products?.[0]?.product || detail.product || detail;
                const img = prod?.image || prod?.product_image || prod?.product?.image || detail.product_image || detail.image;
                if (img) {
                    foundImage = img;
                    productName = prod?.product_name || prod?.name || 'Mueble TuEstante';
                    break;
                }
                if (prod?.product_name || prod?.name) {
                    productName = prod.product_name || prod.name;
                }
            }

            if (!foundImage && latestOrder.image) {
                foundImage = latestOrder.image;
            }
            if (ordersDescEl && productName) {
                ordersDescEl.textContent = `Último pedido: ${productName}. Consulta su avance y fabricación.`;
            }
        }
    } catch (err) {
        console.warn('Aviso cargando miniatura de la última compra en el perfil:', err);
    }
}
