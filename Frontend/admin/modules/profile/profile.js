/**
 * ==========================================================================
 * CONTROLADOR - PERFIL DE ADMINISTRADOR (PROFILE.JS) - TUESTANTE
 * Manejo de vista de perfil, edición en vivo de información personal,
 * 4 campos de nombre/apellido, carga de avatar personalizado y modal
 * con validaciones en tiempo real para actualización de contraseña.
 * ==========================================================================
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { 
  getAdminProfile, 
  updateAdminProfile, 
  changeAdminPassword,
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
  setupPasswordModal();

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

  // Separación inteligente de nombres y apellidos si no vienen explícitos
  let firstName = user.first_name || '';
  let secondName = user.second_name || '';
  let lastName = user.first_last_name || '';
  let secondLastName = user.second_last_name || '';

  if (!firstName && user.full_name) {
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
    } else if (parts.length === 3) {
      firstName = parts[0];
      lastName = parts[1];
      secondLastName = parts[2];
    } else if (parts.length >= 4) {
      firstName = parts[0];
      secondName = parts[1];
      lastName = parts[2];
      secondLastName = parts.slice(3).join(' ');
    }
  }

  const fullName = [firstName, secondName, lastName, secondLastName].filter(Boolean).join(' ') 
    || user.full_name 
    || user.username 
    || 'Administrador';

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

  // 2. Tarjeta Información Personal (4 Campos de Nombre + Usuario + Correo + Rol + Teléfono)
  const inputFirstName = document.getElementById('input-first-name');
  const inputSecondName = document.getElementById('input-second-name');
  const inputLastName = document.getElementById('input-last-name');
  const inputSecondLastName = document.getElementById('input-second-last-name');
  const inputUsername = document.getElementById('input-username');
  const inputEmail = document.getElementById('input-email');
  const inputRole = document.getElementById('input-role');
  const inputPhone = document.getElementById('input-phone');

  if (inputFirstName) inputFirstName.value = firstName;
  if (inputSecondName) inputSecondName.value = secondName;
  if (inputLastName) inputLastName.value = lastName;
  if (inputSecondLastName) inputSecondLastName.value = secondLastName;
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
    first_name: document.getElementById('input-first-name')?.value || '',
    second_name: document.getElementById('input-second-name')?.value || '',
    last_name: document.getElementById('input-last-name')?.value || '',
    second_last_name: document.getElementById('input-second-last-name')?.value || '',
    username: document.getElementById('input-username')?.value || '',
    email: document.getElementById('input-email')?.value || '',
    phone: document.getElementById('input-phone')?.value || '',
    address: document.getElementById('input-address')?.value || ''
  };

  // Habilitar campos editables
  const editableInputs = [
    document.getElementById('input-first-name'),
    document.getElementById('input-second-name'),
    document.getElementById('input-last-name'),
    document.getElementById('input-second-last-name'),
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
  document.getElementById('input-first-name')?.focus();
}

function cancelEditMode() {
  profileState.isEditing = false;
  document.body.classList.remove('is-editing-profile');

  // Restaurar valores en inputs
  const cached = profileState.cachedValues;
  if (cached) {
    const inputFirstName = document.getElementById('input-first-name');
    const inputSecondName = document.getElementById('input-second-name');
    const inputLastName = document.getElementById('input-last-name');
    const inputSecondLastName = document.getElementById('input-second-last-name');
    const inputUsername = document.getElementById('input-username');
    const inputEmail = document.getElementById('input-email');
    const inputPhone = document.getElementById('input-phone');
    const inputAddress = document.getElementById('input-address');

    if (inputFirstName) inputFirstName.value = cached.first_name;
    if (inputSecondName) inputSecondName.value = cached.second_name;
    if (inputLastName) inputLastName.value = cached.last_name;
    if (inputSecondLastName) inputSecondLastName.value = cached.second_last_name;
    if (inputUsername) inputUsername.value = cached.username;
    if (inputEmail) inputEmail.value = cached.email;
    if (inputPhone) inputPhone.value = cached.phone;
    if (inputAddress) inputAddress.value = cached.address;
  }

  // Deshabilitar campos
  const editableInputs = [
    document.getElementById('input-first-name'),
    document.getElementById('input-second-name'),
    document.getElementById('input-last-name'),
    document.getElementById('input-second-last-name'),
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
  const inputFirstName = document.getElementById('input-first-name');
  const inputSecondName = document.getElementById('input-second-name');
  const inputLastName = document.getElementById('input-last-name');
  const inputSecondLastName = document.getElementById('input-second-last-name');
  const inputUsername = document.getElementById('input-username');
  const inputEmail = document.getElementById('input-email');
  const inputPhone = document.getElementById('input-phone');
  const inputAddress = document.getElementById('input-address');

  const firstName = (inputFirstName?.value || '').trim();
  const secondName = (inputSecondName?.value || '').trim();
  const lastName = (inputLastName?.value || '').trim();
  const secondLastName = (inputSecondLastName?.value || '').trim();
  const username = (inputUsername?.value || '').trim();
  const email = (inputEmail?.value || '').trim();
  const phone = (inputPhone?.value || '').trim();
  const address = (inputAddress?.value || '').trim();

  // Validaciones
  if (!firstName) {
    showToast('error', 'Campo requerido', 'Por favor ingresa el primer nombre.');
    inputFirstName?.focus();
    return;
  }

  if (!lastName) {
    showToast('error', 'Campo requerido', 'Por favor ingresa el primer apellido.');
    inputLastName?.focus();
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
    const fullName = [firstName, secondName, lastName, secondLastName].filter(Boolean).join(' ');

    const payload = {
      first_name: firstName,
      second_name: secondName,
      first_last_name: lastName,
      second_last_name: secondLastName,
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
// MODAL DE CAMBIO DE CONTRASEÑA CON VALIDACIONES EN VIVO
// ==========================================================================
function setupPasswordModal() {
  const modal = document.getElementById('modal-change-password-backdrop');
  const btnOpen = document.getElementById('btn-open-password-modal');
  const btnClose = document.getElementById('btn-close-password-modal');
  const btnCancel = document.getElementById('btn-cancel-password');
  const form = document.getElementById('form-change-password');

  const inputCurrent = document.getElementById('input-current-password');
  const inputNew = document.getElementById('input-new-password');
  const inputConfirm = document.getElementById('input-confirm-password');

  // Abrir y cerrar modal
  btnOpen?.addEventListener('click', openPasswordModal);
  btnClose?.addEventListener('click', closePasswordModal);
  btnCancel?.addEventListener('click', closePasswordModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closePasswordModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('is-active')) {
      closePasswordModal();
    }
  });

  // Ojitos para alternar visibilidad de contraseñas
  document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;

      const isPassword = targetInput.type === 'password';
      targetInput.type = isPassword ? 'text' : 'password';

      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isPassword ? 'none' : 'block';
        eyeClosed.style.display = isPassword ? 'block' : 'none';
      }
    });
  });

  // Validaciones en vivo al escribir nueva contraseña
  inputNew?.addEventListener('input', () => {
    validatePasswordRules();
    checkPasswordMatch();
  });

  // Validación en vivo de coincidencia al escribir confirmación
  inputConfirm?.addEventListener('input', () => {
    checkPasswordMatch();
  });

  // Envío del formulario
  form?.addEventListener('submit', handlePasswordSubmit);
}

function openPasswordModal() {
  const modal = document.getElementById('modal-change-password-backdrop');
  const form = document.getElementById('form-change-password');
  if (!modal) return;

  form?.reset();
  resetPasswordValidationUI();
  modal.classList.add('is-active');

  setTimeout(() => {
    document.getElementById('input-current-password')?.focus();
  }, 100);
}

function closePasswordModal() {
  const modal = document.getElementById('modal-change-password-backdrop');
  if (modal) modal.classList.remove('is-active');
  resetPasswordValidationUI();
}

function resetPasswordValidationUI() {
  ['rule-len', 'rule-upper', 'rule-num'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.className = 'rule-item invalid';
      const bullet = el.querySelector('.rule-bullet');
      if (bullet) bullet.textContent = '✕';
    }
  });

  const matchMsg = document.getElementById('match-status-msg');
  if (matchMsg) {
    matchMsg.textContent = '';
    matchMsg.className = 'field-match-status';
  }

  const errorCurrent = document.getElementById('error-current-password');
  if (errorCurrent) errorCurrent.textContent = '';

  // Restaurar visibilidad como password
  document.querySelectorAll('#form-change-password input[type="text"]').forEach(input => {
    if (input.id.includes('password')) input.type = 'password';
  });
  document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');
    if (eyeOpen && eyeClosed) {
      eyeOpen.style.display = 'block';
      eyeClosed.style.display = 'none';
    }
  });
}

function validatePasswordRules() {
  const val = document.getElementById('input-new-password')?.value || '';

  const isLenValid = val.length >= 6;
  const isUpperValid = /[A-Z]/.test(val);
  const isNumValid = /[0-9]/.test(val);

  updateRuleStatus('rule-len', isLenValid);
  updateRuleStatus('rule-upper', isUpperValid);
  updateRuleStatus('rule-num', isNumValid);

  return isLenValid && isUpperValid && isNumValid;
}

function updateRuleStatus(elementId, isValid) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.className = `rule-item ${isValid ? 'valid' : 'invalid'}`;
  const bullet = el.querySelector('.rule-bullet');
  if (bullet) {
    bullet.textContent = isValid ? '✓' : '✕';
  }
}

function checkPasswordMatch() {
  const newPass = document.getElementById('input-new-password')?.value || '';
  const confirmPass = document.getElementById('input-confirm-password')?.value || '';
  const matchMsg = document.getElementById('match-status-msg');
  if (!matchMsg) return false;

  if (!confirmPass) {
    matchMsg.textContent = '';
    matchMsg.className = 'field-match-status';
    return false;
  }

  if (newPass === confirmPass) {
    matchMsg.textContent = '✓ Las contraseñas coinciden';
    matchMsg.className = 'field-match-status text-success';
    matchMsg.style.color = '#16a34a';
    return true;
  } else {
    matchMsg.textContent = '✕ Las contraseñas no coinciden';
    matchMsg.className = 'field-match-status text-danger';
    matchMsg.style.color = '#dc2626';
    return false;
  }
}

async function handlePasswordSubmit(e) {
  e.preventDefault();

  const inputCurrent = document.getElementById('input-current-password');
  const inputNew = document.getElementById('input-new-password');
  const inputConfirm = document.getElementById('input-confirm-password');
  const errorCurrent = document.getElementById('error-current-password');
  const btnSubmit = document.getElementById('btn-submit-password');
  const btnText = document.getElementById('btn-submit-password-text');

  if (errorCurrent) errorCurrent.textContent = '';

  const currentPassword = inputCurrent?.value || '';
  const newPassword = inputNew?.value || '';
  const confirmPassword = inputConfirm?.value || '';

  // 1. Validar contraseña actual
  if (!currentPassword) {
    showToast('error', 'Campo requerido', 'Por favor ingresa tu contraseña actual.');
    inputCurrent?.focus();
    return;
  }

  // 2. Validar reglas de seguridad de nueva contraseña
  const rulesOk = validatePasswordRules();
  if (!rulesOk) {
    showToast('error', 'Contraseña insegura', 'La nueva contraseña debe tener al menos 6 caracteres, 1 mayúscula y 1 número.');
    inputNew?.focus();
    return;
  }

  // 3. Validar coincidencia
  if (newPassword !== confirmPassword) {
    showToast('error', 'Discrepancia', 'Las nuevas contraseñas no coinciden.');
    inputConfirm?.focus();
    return;
  }

  // 4. Validar que la nueva no sea igual a la actual
  if (currentPassword === newPassword) {
    showToast('warning', 'Contraseña idéntica', 'La nueva contraseña debe ser diferente de la contraseña actual.');
    inputNew?.focus();
    return;
  }

  // Iniciar envío
  if (btnSubmit) btnSubmit.disabled = true;
  if (btnText) btnText.textContent = 'Actualizando...';

  try {
    const payload = {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_new_password: confirmPassword
    };

    const res = await changeAdminPassword(payload);

    closePasswordModal();
    showToast('success', 'Contraseña actualizada', res?.message?.mensaje || 'Tu contraseña ha sido cambiada exitosamente.');
  } catch (err) {
    console.error('Error al cambiar contraseña:', err);
    let errorMsg = 'No se pudo actualizar la contraseña. Revisa los datos ingresados.';

    if (err.data) {
      if (err.data.current_password) {
        errorMsg = Array.isArray(err.data.current_password) ? err.data.current_password[0] : err.data.current_password;
        if (errorCurrent) errorCurrent.textContent = errorMsg;
      } else if (err.data.new_password) {
        errorMsg = Array.isArray(err.data.new_password) ? err.data.new_password[0] : err.data.new_password;
      } else if (err.data.detail) {
        errorMsg = err.data.detail;
      } else if (err.data.error) {
        errorMsg = err.data.error;
      }
    } else if (err.message) {
      errorMsg = err.message;
    }

    showToast('error', 'Error al actualizar', errorMsg);
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnText) btnText.textContent = 'Actualizar Contraseña';
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
    hours = hours ? hours : 12;
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
