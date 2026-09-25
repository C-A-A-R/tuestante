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
 * Traduce y condiciona los errores del backend o de red en mensajes claros y amigables para el usuario final.
 * @param {Error|Object} err Error capturado durante la petición de login
 * @returns {string} Mensaje entendible para usuarios finales
 */
function getFriendlyLoginErrorMessage(err) {
  // 1. Error de conexión o modo offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No tienes conexión a internet. Por favor, verifica tu red e intenta nuevamente.';
  }

  const rawMessage = (err?.message || '').toLowerCase();
  if (
    rawMessage.includes('failed to fetch') ||
    rawMessage.includes('networkerror') ||
    rawMessage.includes('network request failed') ||
    rawMessage.includes('conexion') ||
    rawMessage.includes('connection refused')
  ) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet o intenta nuevamente en unos momentos.';
  }

  const status = err?.status;
  const data = err?.data;

  // Extraer texto devuelto por el backend si existe
  let backendText = '';
  if (typeof data === 'string') {
    backendText = data;
  } else if (data && typeof data === 'object') {
    if (typeof data.error === 'string') {
      backendText = data.error;
    } else if (typeof data.detail === 'string') {
      backendText = data.detail;
    } else if (typeof data.message === 'string') {
      backendText = data.message;
    } else if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
      backendText = String(data.non_field_errors[0]);
    } else {
      // Buscar en cualquier campo del objeto de error
      const firstVal = Object.values(data).find(v => v);
      if (Array.isArray(firstVal) && firstVal[0]) {
        backendText = String(firstVal[0]);
      } else if (typeof firstVal === 'string') {
        backendText = firstVal;
      }
    }
  }

  const lowerBackendText = backendText.toLowerCase();

  // 2. Cuenta desactivada / inactiva
  if (
    lowerBackendText.includes('desactivada') ||
    lowerBackendText.includes('inactiva') ||
    lowerBackendText.includes('disabled') ||
    lowerBackendText.includes('bloqueada')
  ) {
    return 'Esta cuenta se encuentra desactivada. Por favor, contacta al administrador del sistema.';
  }

  // 3. Credenciales incorrectas (Status 401 o texto coincidente)
  if (
    status === 401 ||
    lowerBackendText.includes('credencial') ||
    lowerBackendText.includes('invalid') ||
    lowerBackendText.includes('inválid') ||
    lowerBackendText.includes('incorrect') ||
    lowerBackendText.includes('no active account') ||
    lowerBackendText.includes('contraseña') ||
    lowerBackendText.includes('password') ||
    lowerBackendText.includes('usuario no encontrado')
  ) {
    return 'Credenciales incorrectas. El usuario o la contraseña no coinciden con los registros del sistema.';
  }

  // 4. Permisos insuficientes (Status 403)
  if (
    status === 403 ||
    lowerBackendText.includes('permiso') ||
    lowerBackendText.includes('privilegio') ||
    lowerBackendText.includes('permission') ||
    lowerBackendText.includes('forbidden')
  ) {
    return 'Acceso denegado: Esta cuenta no posee permisos de administrador para ingresar al panel.';
  }

  // 5. Demasiados intentos fallidos (Status 429 - Throttling)
  if (
    status === 429 ||
    lowerBackendText.includes('too many') ||
    lowerBackendText.includes('demasiados intentos') ||
    lowerBackendText.includes('throttled')
  ) {
    return 'Demasiados intentos fallidos. Por seguridad, espera unos minutos antes de volver a intentar.';
  }

  // 6. Solicitud incompleta o incorrecta (Status 400)
  if (status === 400) {
    if (
      lowerBackendText.includes('proporcionar') ||
      lowerBackendText.includes('requerido') ||
      lowerBackendText.includes('required')
    ) {
      return 'Por favor, ingresa tanto tu usuario o correo como tu contraseña.';
    }
    if (backendText && !backendText.toLowerCase().includes('failed')) {
      return backendText;
    }
    return 'Los datos ingresados son inválidos. Por favor, verifica la información.';
  }

  // 7. Error en el servidor (Status 500 o superior)
  if (status >= 500) {
    return 'El servidor de autenticación está experimentando problemas. Por favor, intenta de nuevo más tarde.';
  }

  // 8. Mensaje amigable del backend si es limpio
  if (backendText && !backendText.toLowerCase().includes('failed') && !backendText.includes('{')) {
    return backendText;
  }

  // 9. Fallback general amigable
  return 'Credenciales incorrectas o no fue posible iniciar sesión. Verifica tus datos e intenta nuevamente.';
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

  // Limpiar estados de error al escribir en los inputs
  [usernameInput, passwordInput].forEach((input) => {
    if (!input) return;
    input.addEventListener('input', () => {
      input.closest('.form-group')?.classList.remove('has-error');
      const errSpan = input.closest('.form-group')?.querySelector('.field-error-text');
      if (errSpan) errSpan.textContent = '';
      hideNotifications();
    });
  });

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
      setFieldError(usernameInput, errorUsername, 'El usuario o correo electrónico es obligatorio.');
      hasError = true;
    }

    if (!password) {
      setFieldError(passwordInput, errorPassword, 'La contraseña es obligatoria.');
      hasError = true;
    }

    if (hasError) {
      showErrorNotification('Por favor, completa todos los campos requeridos.');
      return;
    }

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
          'Acceso denegado: Esta cuenta no posee permisos de administrador para ingresar al panel.'
        );
        usernameInput?.closest('.form-group')?.classList.add('has-error');
        passwordInput?.closest('.form-group')?.classList.add('has-error');
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

      const friendlyMessage = getFriendlyLoginErrorMessage(err);
      showErrorNotification(friendlyMessage);

      // Si el error es de credenciales incorrectas, destacar los campos para guiar al usuario
      if (
        err?.status === 401 ||
        friendlyMessage.toLowerCase().includes('credenciales incorrectas')
      ) {
        usernameInput?.closest('.form-group')?.classList.add('has-error');
        passwordInput?.closest('.form-group')?.classList.add('has-error');
        if (passwordInput) {
          passwordInput.focus();
          passwordInput.select();
        }
      }
    } finally {
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
