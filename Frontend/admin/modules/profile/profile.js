/**
 * ==========================================================================
 * CONTROLADOR - PERFIL DE ADMINISTRADOR (PROFILE.JS) - TUESTANTE
 * Manejo de vista de perfil, edición en vivo de información personal,
 * carga de avatar personalizado y persistencia de preferencias de cuenta.
 * ==========================================================================
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { 
  getAdminProfile, 
  updateAdminProfile, 
  getSavedAvatar, 
  saveAvatar 
} from './profile.api.js';

// Estado local de la vista
const profileState = {
  isEditing: false,
  userData: null,
  cachedValues: {}
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar componentes corporativos (Drawer, Navbar con título 'Perfil de usuario', Footer)
  await loadAdminComponents({ title: 'Perfil de usuario' });

  // 2. Vincular eventos de la interfaz
  setupEditToggle();
  setupAvatarUpload();

  // 3. Cargar datos del usuario
  await loadProfile();

  // 4. Si se invoca con ?edit=1, activar modo edición
  if (new URLSearchParams(window.location.search).get('edit') === '1') {
    enterEditMode();
  }
});

// ==========================================================================
// CARGA Y RENDERIZADO DE DATOS
// ==========================================================================
async function loadProfile() {
  try {
    const data = await getAdminProfile();
    profileState.userData = data;
    renderProfileData(data);
    loadSavedAvatar();
  } catch (err) {
    console.error('Error al cargar perfil:', err);
    showToast('error', 'Error', 'No se pudieron cargar los datos del perfil.');
  }
}

function renderProfileData(user) {
  if (!user) return;

  const fullName = user.full_name || [user.first_name, user.first_last_name].filter(Boolean).join(' ') || user.username || 'Administrador';
  const roleText = user.is_superuser ? 'Superadministrador' : (user.is_staff ? 'Administrador' : 'Colaborador');
  const isActive = user.is_active !== false;

  // 1. Tarjeta Lateral Izquierda
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarEmail = document.getElementById('sidebar-user-email');
  const sidebarRole = document.getElementById('sidebar-role-badge');
  const sidebarStatus = document.getElementById('sidebar-status-badge');

  if (sidebarName) sidebarName.textContent = fullName;
  if (sidebarEmail) sidebarEmail.textContent = user.email || 'Sin correo registrado';
  if (sidebarRole) sidebarRole.textContent = roleText;
  if (sidebarStatus) {
    sidebarStatus.textContent = isActive ? 'Activo' : 'Inactivo';
    sidebarStatus.className = isActive ? 'status-badge-active' : 'status-badge-inactive';
  }

  // 2. Tarjeta Información Personal
  const inputFullName = document.getElementById('input-full-name');
  const inputUsername = document.getElementById('input-username');
  const inputEmail = document.getElementById('input-email');
  const inputRole = document.getElementById('input-role');
  const inputPhone = document.getElementById('input-phone');

  if (inputFullName) inputFullName.value = fullName;
  if (inputUsername) inputUsername.value = user.username || '';
  if (inputEmail) inputEmail.value = user.email || '';
  if (inputRole) inputRole.value = roleText;
  if (inputPhone) inputPhone.value = user.phone || '';

  // 3. Tarjeta Información Adicional
  const inputDateJoined = document.getElementById('input-date-joined');
  const inputLastLogin = document.getElementById('input-last-login');
  const inputAddress = document.getElementById('input-address');

  if (inputDateJoined) inputDateJoined.value = formatDateTime(user.date_joined);
  if (inputLastLogin) inputLastLogin.value = formatDateTime(user.last_login);
  if (inputAddress) inputAddress.value = user.address || '';
}

// ==========================================================================
// MODO EDICIÓN Y GUARDADO
// ==========================================================================
function setupEditToggle() {
  const btnToggle = document.getElementById('btn-toggle-edit');
  const btnCancel = document.getElementById('btn-cancel-edit');
  const form = document.getElementById('form-personal-info');

  btnToggle?.addEventListener('click', () => {
    if (!profileState.isEditing) {
      enterEditMode();
    } else {
      handleSaveProfile();
    }
  });

  btnCancel?.addEventListener('click', () => {
    cancelEditMode();
  });

  // Prevenir submit estándar del formulario
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSaveProfile();
  });
}

function enterEditMode() {
  profileState.isEditing = true;
  document.body.classList.add('is-editing-profile');

  // Guardar en caché los valores previos por si el usuario cancela
  profileState.cachedValues = {
    full_name: document.getElementById('input-full-name')?.value || '',
    username: document.getElementById('input-username')?.value || '',
    email: document.getElementById('input-email')?.value || '',
    phone: document.getElementById('input-phone')?.value || '',
    address: document.getElementById('input-address')?.value || ''
  };

  // Habilitar campos editables
  const editableInputs = [
    document.getElementById('input-full-name'),
    document.getElementById('input-username'),
    document.getElementById('input-email'),
    document.getElementById('input-phone'),
    document.getElementById('input-address')
  ];

  editableInputs.forEach(input => {
    if (input) input.disabled = false;
  });

  // Actualizar botones
  const btnCancel = document.getElementById('btn-cancel-edit');
  const labelEdit = document.getElementById('label-edit-btn');
  const iconEdit = document.getElementById('icon-edit-btn');

  if (btnCancel) btnCancel.style.display = 'inline-flex';
  if (labelEdit) labelEdit.textContent = 'Guardar Cambios';
  if (iconEdit) {
    iconEdit.innerHTML = `
      <polyline points="20 6 9 17 4 12"></polyline>
    `;
  }

  // Foco en el primer campo
  document.getElementById('input-full-name')?.focus();
}

function cancelEditMode() {
  profileState.isEditing = false;
  document.body.classList.remove('is-editing-profile');

  // Restaurar valores en inputs
  const cached = profileState.cachedValues;
  if (cached) {
    const inputFullName = document.getElementById('input-full-name');
    const inputUsername = document.getElementById('input-username');
    const inputEmail = document.getElementById('input-email');
    const inputPhone = document.getElementById('input-phone');
    const inputAddress = document.getElementById('input-address');

    if (inputFullName) inputFullName.value = cached.full_name;
    if (inputUsername) inputUsername.value = cached.username;
    if (inputEmail) inputEmail.value = cached.email;
    if (inputPhone) inputPhone.value = cached.phone;
    if (inputAddress) inputAddress.value = cached.address;
  }

  // Deshabilitar campos
  const editableInputs = [
    document.getElementById('input-full-name'),
    document.getElementById('input-username'),
    document.getElementById('input-email'),
    document.getElementById('input-phone'),
    document.getElementById('input-address')
  ];

  editableInputs.forEach(input => {
    if (input) input.disabled = true;
  });

  // Restaurar botones
  const btnCancel = document.getElementById('btn-cancel-edit');
  const labelEdit = document.getElementById('label-edit-btn');
  const iconEdit = document.getElementById('icon-edit-btn');

  if (btnCancel) btnCancel.style.display = 'none';
  if (labelEdit) labelEdit.textContent = 'Editar';
  if (iconEdit) {
    iconEdit.innerHTML = `
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    `;
  }
}

async function handleSaveProfile() {
  const inputFullName = document.getElementById('input-full-name');
  const inputUsername = document.getElementById('input-username');
  const inputEmail = document.getElementById('input-email');
  const inputPhone = document.getElementById('input-phone');
  const inputAddress = document.getElementById('input-address');

  const fullName = (inputFullName?.value || '').trim();
  const username = (inputUsername?.value || '').trim();
  const email = (inputEmail?.value || '').trim();
  const phone = (inputPhone?.value || '').trim();
  const address = (inputAddress?.value || '').trim();

  // Validaciones
  if (!fullName) {
    showToast('error', 'Campo requerido', 'Por favor ingresa tu nombre completo.');
    inputFullName?.focus();
    return;
  }

  if (!username) {
    showToast('error', 'Campo requerido', 'Por favor ingresa tu nombre de usuario.');
    inputUsername?.focus();
    return;
  }

  if (!email || !email.includes('@')) {
    showToast('error', 'Correo inválido', 'Por favor ingresa un correo electrónico válido.');
    inputEmail?.focus();
    return;
  }

  const btnToggle = document.getElementById('btn-toggle-edit');
  const labelEdit = document.getElementById('label-edit-btn');

  if (btnToggle) btnToggle.disabled = true;
  if (labelEdit) labelEdit.textContent = 'Guardando...';

  try {
    const payload = {
      full_name: fullName,
      username: username,
      email: email,
      phone: phone,
      address: address
    };

    const updated = await updateAdminProfile(payload);
    profileState.userData = { ...profileState.userData, ...updated };

    // Actualizar sidebar inmediatamente
    document.getElementById('sidebar-user-name').textContent = fullName;
    document.getElementById('sidebar-user-email').textContent = email;

    // Actualizar nombre en navbar si los elementos existen
    const navDropdownName = document.getElementById('dropdown-user-name');
    const navDropdownEmail = document.getElementById('dropdown-user-email');
    if (navDropdownName) navDropdownName.textContent = fullName;
    if (navDropdownEmail) navDropdownEmail.textContent = email;

    // Salir del modo edición
    cancelEditMode();

    showToast('success', 'Perfil actualizado', 'Tu información personal ha sido guardada correctamente.');
  } catch (err) {
    console.error('Error al guardar perfil:', err);
    showToast('error', 'Error al guardar', 'No se pudieron actualizar los datos. Intenta nuevamente.');
  } finally {
    if (btnToggle) btnToggle.disabled = false;
  }
}

// ==========================================================================
// CAMBIO Y PERSISTENCIA DE FOTO DE PERFIL (AVATAR)
// ==========================================================================
function setupAvatarUpload() {
  const btnTrigger = document.getElementById('btn-trigger-avatar');
  const avatarContainer = document.getElementById('profile-avatar-container');
  const fileInput = document.getElementById('input-avatar-file');

  btnTrigger?.addEventListener('click', () => fileInput?.click());
  avatarContainer?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Archivo inválido', 'Por favor selecciona una imagen válida (PNG, JPG o WebP).');
      fileInput.value = '';
      return;
    }

    // Validar tamaño máximo (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('error', 'Imagen muy grande', 'La imagen no debe superar los 5 MB.');
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      saveAvatar(dataUrl);
      displayAvatar(dataUrl);
      showToast('success', 'Foto actualizada', 'La nueva foto de perfil se aplicó correctamente.');
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });
}

function loadSavedAvatar() {
  const saved = getSavedAvatar();
  if (saved) {
    displayAvatar(saved);
  }
}

function displayAvatar(url) {
  const imgEl = document.getElementById('profile-avatar-img');
  const placeholderEl = document.getElementById('profile-avatar-placeholder');

  if (imgEl && placeholderEl) {
    imgEl.src = url;
    imgEl.style.display = 'block';
    placeholderEl.style.display = 'none';
  }

  // Actualizar también el avatar de la barra de navegación si existe
  const navAvatar = document.querySelector('.navbar-user-avatar');
  if (navAvatar) {
    navAvatar.style.backgroundImage = `url("${url}")`;
    navAvatar.style.backgroundSize = 'cover';
  }
}

// ==========================================================================
// FORMATEO DE FECHAS Y HORAS
// ==========================================================================
function formatDateTime(dateString) {
  if (!dateString) return 'No registrado';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Hora '0' como '12'
    const strHours = String(hours).padStart(2, '0');

    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
  } catch {
    return dateString;
  }
}

// ==========================================================================
// UTILIDADES (TOAST NOTIFICATIONS)
// ==========================================================================
function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div>
      <strong style="display: block; color: var(--text-main); margin-bottom: 2px;">${escapeHtml(title)}</strong>
      <span style="color: var(--text-muted);">${escapeHtml(message)}</span>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
