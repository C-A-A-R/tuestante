/**
 * ==========================================================================
 * TUESTANTE ADMIN - CONTROLADOR DEL PORTAL DE LOGIN ADMINISTRATIVO
 * ==========================================================================
 * Valida credenciales contra la API Django (/api/user/login/) y restringe
 * estrictamente el acceso a cuentas que posean rol administrativo (is_staff / is_superuser).
 */

import { postRequest } from './js/api.js';
import { 
  setAccessToken, 
  setRefreshToken, 
  setCurrentUser, 
  setCurrentUserGroups, 
  clearTokens, 
  clearCurrentUser,
  getAccessToken,
  getCurrentUser
} from './js/storage.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Si ya tiene sesión activa y es administrador, redirigir automáticamente
  checkExistingAdminSession();

  // 2. Configurar interactividad de formulario y botones
  setupLoginForm();
  setupPasswordToggle();
});

/**
 * Verifica si ya existe una sesión con permisos administrativos
 */
function checkExistingAdminSession() {
  const token = getAccessToken();
  const user = getCurrentUser();

  if (token && user) {
    const isAdmin = Boolean(user.is_superuser || user.is_staff);
    if (isAdmin) {
      window.location.href = 'index.html';
    }
  }
}

/**
 * Configura el envío del formulario de inicio de sesión
 */
function setupLoginForm() {
  const form = document.getElementById('admin-login-form');
  const submitBtn = document.getElementById('btn-login-submit');
  const spinner = document.getElementById('login-spinner');
  const btnText = submitBtn?.querySelector('.btn-text');

  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');

  const errorUsername = document.getElementById('error-username');
  const errorPassword = document.getElementById('error-password');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Limpiar alertas previas
    hideNotifications();
    clearFieldErrors();

    const username = (usernameInput?.value || '').trim();
    const password = (passwordInput?.value || '');
    let hasError = false;

    // Validación de campos requeridos
    if (!username) {
      setFieldError(usernameInput, errorUsername, 'El usuario o correo es obligatorio.');
      hasError = true;
    }

    if (!password) {
      setFieldError(passwordInput, errorPassword, 'La contraseña es obligatoria.');
      hasError = true;
    }

    if (hasError) return;

    // Estado de carga
    setLoadingState(true);

    try {
      const response = await postRequest('/user/login/', {
        username,
        nombre_usuario: username,
        email: username,
        password,
        contrasena: password
      }, { auth: false });

      // Verificación Estricta de Rol de Administrador
      const isStaff = Boolean(response?.is_staff ?? response?.user?.is_staff);
      const isSuperuser = Boolean(response?.is_superuser ?? response?.user?.is_superuser);
      const isAdmin = isStaff || isSuperuser;

      if (!isAdmin) {
        // Purgar inmediatamente cualquier token recibido para un usuario no administrativo
        clearTokens();
        clearCurrentUser();

        showErrorNotification(
          'Acceso denegado: Esta cuenta no posee privilegios administrativos para ingresar a este panel.'
        );
        setLoadingState(false);
        return;
      }

      // Guardar tokens y usuario en LocalStorage
      const accessToken = response.tokens?.access || response.access;
      const refreshToken = response.tokens?.refresh || response.refresh;

      if (accessToken) setAccessToken(accessToken);
      if (refreshToken) setRefreshToken(refreshToken);

      const userObject = response.user || {
        username,
        is_staff: isStaff,
        is_superuser: isSuperuser
      };
      setCurrentUser(userObject);

      const groups = response.grupos || response.groups || (userObject.groups ? userObject.groups : ['Administrador']);
      setCurrentUserGroups(groups);

      showSuccessNotification('¡Acceso autorizado! Redirigiendo al panel...');
      
      setTimeout(() => {
        const redirectParam = new URLSearchParams(window.location.search).get('redirect');
        window.location.href = redirectParam || 'index.html';
      }, 700);

    } catch (err) {
      console.error('[Admin Login] Error de autenticación:', err);

      let message = 'Credenciales inválidas o error en el servidor.';
      if (err && typeof err === 'object') {
        if (err.error) message = err.error;
        else if (err.detail) message = err.detail;
        else if (err.message) message = err.message;
      }

      showErrorNotification(message);
      setLoadingState(false);
    }
  });

  function setLoadingState(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    if (spinner) spinner.classList.toggle('hidden', !loading);
    if (btnText) btnText.style.opacity = loading ? '0' : '1';
  }
}

/**
 * Muestra u oculta la contraseña
 */
function setupPasswordToggle() {
  const toggleBtn = document.getElementById('btn-toggle-password');
  const passwordInput = document.getElementById('admin-password');
  if (!toggleBtn || !passwordInput) return;

  const eyeOpen = toggleBtn.querySelector('.icon-eye-open');
  const eyeClosed = toggleBtn.querySelector('.icon-eye-closed');

  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    if (eyeOpen && eyeClosed) {
      eyeOpen.classList.toggle('hidden', isPassword);
      eyeClosed.classList.toggle('hidden', !isPassword);
    }
  });
}

function setFieldError(inputEl, errorEl, message) {
  if (inputEl) {
    const group = inputEl.closest('.form-group');
    if (group) group.classList.add('has-error');
  }
  if (errorEl) {
    errorEl.textContent = message;
  }
}

function clearFieldErrors() {
  document.querySelectorAll('.form-group.has-error').forEach(g => g.classList.remove('has-error'));
  document.querySelectorAll('.field-error-text').forEach(e => e.textContent = '');
}

function showErrorNotification(message) {
  const banner = document.getElementById('admin-login-error');
  const text = document.getElementById('admin-login-error-text');
  if (banner && text) {
    text.textContent = message;
    banner.classList.remove('hidden');
  }
}

function showSuccessNotification(message) {
  const banner = document.getElementById('admin-login-success');
  const text = document.getElementById('admin-login-success-text');
  if (banner && text) {
    text.textContent = message;
    banner.classList.remove('hidden');
  }
}

function hideNotifications() {
  document.getElementById('admin-login-error')?.classList.add('hidden');
  document.getElementById('admin-login-success')?.classList.add('hidden');
}
