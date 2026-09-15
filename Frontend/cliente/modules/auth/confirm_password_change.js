document.addEventListener('DOMContentLoaded', () => {
  const newPassword = document.getElementById('new_password');
  const confirmPassword = document.getElementById('confirm_password');
  const toggleNew = document.getElementById('toggle-new-password');
  const toggleConfirm = document.getElementById('toggle-confirm-password');
  const form = document.getElementById('set-new-password-form');
  const bottomMessage = document.getElementById('form-bottom-message');

  // Reuse validation rules from registro.js
  function validatePasswordField(field) {
    const password = field.value;
    if (password === '') { clearFieldError(field); return false; }
    let errors = [];
    if (password.length < 8) errors.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(password)) errors.push('Una letra mayúscula');
    if (!/[a-z]/.test(password)) errors.push('Una letra minúscula');
    if (!/\d/.test(password)) errors.push('Un número');
    if (!/[^a-zA-Z\d\s]/.test(password)) errors.push('Un carácter especial');
    if (errors.length) { showFieldError(field, 'Faltan: ' + errors.join(', ')); return false; }
    clearFieldError(field); return true;
  }

  function showFieldError(field, message) {
    field.classList.add('error');
    let container = field.parentElement;
    if (container.classList.contains('password-container')) container = container.parentElement;
    const existing = container.querySelector('.error-message');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'error-message';
    div.textContent = message;
    container.appendChild(div);
  }

  function clearFieldError(field) {
    field.classList.remove('error');
    let container = field.parentElement;
    if (container.classList.contains('password-container')) container = container.parentElement;
    const existing = container.querySelector('.error-message');
    if (existing) existing.remove();
  }

  function validateConfirmMatch() {
    if (!confirmPassword.value) { clearFieldError(confirmPassword); return false; }
    if (confirmPassword.value !== newPassword.value) {
      showFieldError(confirmPassword, 'Las contraseñas no coinciden');
      return false;
    }
    clearFieldError(confirmPassword); return true;
  }

  function updateSubmitState() {
    const validMain = validatePasswordField(newPassword);
    const validConfirm = validateConfirmMatch();
    const submitBtn = document.getElementById('submit-new-password');
    const allValid = validMain && validConfirm;
    if (submitBtn) {
      submitBtn.disabled = !allValid;
      submitBtn.style.opacity = allValid ? '1' : '0.55';
      submitBtn.style.cursor = allValid ? 'pointer' : 'not-allowed';
    }
    return allValid;
  }

  if (toggleNew && newPassword) {
    toggleNew.addEventListener('click', () => {
      const type = newPassword.getAttribute('type') === 'password' ? 'text' : 'password';
      newPassword.setAttribute('type', type);
      const icon = toggleNew.querySelector('.password-icon');
      if (icon) icon.src = type === 'password' ? '../images/open.png' : '../images/closed.png';
    });
  }

  if (toggleConfirm && confirmPassword) {
    toggleConfirm.addEventListener('click', () => {
      const type = confirmPassword.getAttribute('type') === 'password' ? 'text' : 'password';
      confirmPassword.setAttribute('type', type);
      const icon = toggleConfirm.querySelector('.password-icon');
      if (icon) icon.src = type === 'password' ? '../images/open.png' : '../images/closed.png';
    });
  }

  if (newPassword) newPassword.addEventListener('input', () => { validatePasswordField(newPassword); validateConfirmMatch(); updateSubmitState(); });
  if (confirmPassword) confirmPassword.addEventListener('input', () => { validateConfirmMatch(); updateSubmitState(); });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      bottomMessage.textContent = '';
      if (!updateSubmitState()) {
        bottomMessage.textContent = 'Revisa los errores antes de continuar.';
        return;
      }
      // Placeholder de envío al backend - implementar luego
      const payload = { password: newPassword.value };
      console.log('Enviando nueva contraseña al backend', payload);
      // Simular éxito y redirigir a login
      bottomMessage.style.color = '#16a34a';
      bottomMessage.textContent = 'Contraseña actualizada correctamente. Redirigiendo...';
      setTimeout(() => {
        window.location.href = '../inicio_de_sesion/inicio_de_sesion.html';
      }, 1200);
    });
  }

  updateSubmitState();
});
