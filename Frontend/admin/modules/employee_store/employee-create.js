/**
 * employee-create.js
 * Controlador de Registro y Edición de Trabajadores - TuEstante Admin
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { createEmployee, fetchEmployee, updateEmployee } from './employee-store.api.js';
import { showConfirmModal, showLoadingOverlay, hideLoadingOverlay } from '../../components/modal/modal.js';
import { resolveImageUrl } from '../../js/api.js';

let selectedPhotoFile = null;
let isSubmitting = false;
let editEmployeeId = null;
let currentPhotoUrl = '';

document.addEventListener('DOMContentLoaded', async () => {
  // Si se accede con parámetro edit o id, redirigir a la pantalla dedicada de edición
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit') || urlParams.get('id');
  if (editId) {
    window.location.replace(`employee-edit.html?id=${editId}`);
    return;
  }

  try {
    await loadAdminComponents({ title: 'Registrar Trabajador' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load warning:', err);
  }

  setupPhotoDropzone();
  setupAutoCodeButton();
  setupPasswordToggle();
  setupLivePasswordValidation();
  setupLiveBirthDateValidation();
  setupFormSubmit();
});

/**
 * Configuración para mostrar / ocultar contraseña
 */
function setupPasswordToggle() {
  const btnToggle = document.getElementById('btn-toggle-password');
  const inputPassword = document.getElementById('input-password');

  if (!btnToggle || !inputPassword) return;

  btnToggle.addEventListener('click', () => {
    const isPassword = inputPassword.type === 'password';
    inputPassword.type = isPassword ? 'text' : 'password';

    btnToggle.innerHTML = isPassword
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
           <line x1="1" y1="1" x2="23" y2="23"></line>
         </svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
           <circle cx="12" cy="12" r="3"></circle>
         </svg>`;
  });
}

/**
 * Carga los datos de un empleado si se abrió en modo edición
 */
async function loadEmployeeForEdit(employeeId) {
  try {
    const headerTitle = document.querySelector('.page-header h1, .header-title h1, .screen-main-title');
    const headerSub = document.querySelector('.page-header p, .header-title p, .screen-main-desc');
    if (headerTitle) headerTitle.textContent = 'Editar Datos del Trabajador';
    if (headerSub) headerSub.textContent = 'Modifica la información personal, credenciales y parámetros de consumo.';

    const submitTexts = document.querySelectorAll('#btn-submit-top span, #btn-submit-bottom span');
    submitTexts.forEach(s => { s.textContent = 'Guardar Cambios'; });

    const emp = await fetchEmployee(employeeId);
    if (!emp) {
      showToast('No se encontró el trabajador a editar.', 'error');
      return;
    }

    // Nombre y apellidos
    const firstName = emp.user?.first_name || emp.first_name || '';
    const lastName = emp.user?.last_name || emp.last_name || '';
    const secondName = emp.second_name || '';
    const secondLastName = emp.second_last_name || '';

    const inputFirst = document.getElementById('input-first-name');
    const inputSecond = document.getElementById('input-second-name');
    const inputLast = document.getElementById('input-last-name');
    const inputSecondLast = document.getElementById('input-second-last-name');
    const inputDoc = document.getElementById('input-identity-doc');
    const inputPhone = document.getElementById('input-phone');
    const inputEmail = document.getElementById('input-email');
    const inputNum = document.getElementById('input-employee-number');
    const inputDept = document.getElementById('input-department');
    const inputPos = document.getElementById('input-position');
    const inputSal = document.getElementById('input-salary');
    const inputActive = document.getElementById('input-is-active');

    if (inputFirst) inputFirst.value = firstName;
    if (inputSecond) inputSecond.value = secondName;
    if (inputLast) inputLast.value = lastName;
    if (inputSecondLast) inputSecondLast.value = secondLastName;
    if (inputDoc) inputDoc.value = emp.id_number || emp.identity_document || emp.user?.username || '';
    if (inputPhone) inputPhone.value = emp.phone || '';
    if (inputEmail) inputEmail.value = emp.user?.email || emp.email || '';
    if (inputNum) inputNum.value = emp.employee_number || '';
    if (inputDept) inputDept.value = emp.department || '';
    if (inputPos) inputPos.value = emp.position || '';
    if (inputSal) inputSal.value = parseFloat(emp.salary || 0).toFixed(2);
    if (inputActive) inputActive.checked = emp.is_active !== false;

    const inputBirth = document.getElementById('input-birth-date');
    if (inputBirth && emp.birth_date) {
      inputBirth.value = emp.birth_date;
      inputBirth.required = false;
    }

    // Foto existente
    if (emp.photo) {
      currentPhotoUrl = resolveImageUrl(emp.photo);
      const previewImg = document.getElementById('img-photo-preview');
      const emptyState = document.getElementById('dropzone-empty');
      const previewState = document.getElementById('dropzone-preview');
      if (previewImg) previewImg.src = currentPhotoUrl;
      if (emptyState) emptyState.classList.add('hidden');
      if (previewState) previewState.classList.remove('hidden');
    }

    const rulesBox = document.getElementById('password-rules-box');
    if (rulesBox) {
      const headerSpan = rulesBox.querySelector('span');
      if (headerSpan) headerSpan.textContent = 'Requisitos si deseas modificar la contraseña (opcional en edición):';
    }

    const pwdStar = document.getElementById('password-required-star');
    if (pwdStar) pwdStar.style.display = 'none';

  } catch (err) {
    console.error('Error cargando empleado para edición:', err);
    showToast('Error al cargar datos del trabajador.', 'error');
  }
}

/**
 * Configuración del Drag & Drop, selección y visualización en Lightbox de foto
 */
function setupPhotoDropzone() {
  const dropzone = document.getElementById('photo-dropzone');
  const fileInput = document.getElementById('input-employee-photo');
  const emptyState = document.getElementById('dropzone-empty');
  const previewState = document.getElementById('dropzone-preview');
  const previewImg = document.getElementById('img-photo-preview');
  const previewWrapper = document.getElementById('avatar-preview-wrapper');
  const previewZoomHint = document.getElementById('preview-zoom-hint');
  const btnChange = document.getElementById('btn-change-photo');
  const btnZoom = document.getElementById('btn-zoom-photo');
  const btnRemove = document.getElementById('btn-remove-photo');

  // Lightbox Elements
  const lightboxModal = document.getElementById('modal-photo-lightbox');
  const lightboxImg = document.getElementById('img-lightbox-full');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const btnCloseLightbox = document.getElementById('btn-close-photo-lightbox');
  const btnLightboxChange = document.getElementById('btn-lightbox-change-photo');

  if (!dropzone || !fileInput) return;

  // 1. Abrir selector al hacer clic en el dropzone cuando esté vacío
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-change-photo') || e.target.closest('#btn-remove-photo') || e.target.closest('#btn-zoom-photo') || e.target.closest('#avatar-preview-wrapper') || e.target.closest('#preview-zoom-hint')) {
      return;
    }
    if (!selectedPhotoFile && !currentPhotoUrl) {
      fileInput.click();
    }
  });

  // 2. Botón Cambiar Foto
  btnChange?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // 3. Botón Quitar Foto
  btnRemove?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPhoto();
  });

  // 4. Ampliar Foto a Pantalla Completa (Clic en imagen, overlay, botón zoom o texto)
  const openLightboxHandler = (e) => {
    e.stopPropagation();
    const imgSrc = previewImg?.src || currentPhotoUrl;
    if (imgSrc) {
      openPhotoLightbox(imgSrc);
    }
  };

  previewWrapper?.addEventListener('click', openLightboxHandler);
  previewZoomHint?.addEventListener('click', openLightboxHandler);
  btnZoom?.addEventListener('click', openLightboxHandler);

  // 5. Cambio de archivo
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  // 6. Drag & Drop
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
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  function handleFileSelected(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen supera el límite permitido de 5MB.', 'error');
      return;
    }

    selectedPhotoFile = file;

    const reader = new FileReader();
    reader.onload = (ev) => {
      currentPhotoUrl = ev.target.result;
      if (previewImg) previewImg.src = currentPhotoUrl;
      if (emptyState) emptyState.classList.add('hidden');
      if (previewState) previewState.classList.remove('hidden');
      showToast('Fotografía cargada. Se guardará al actualizar el formulario.', 'info');
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    selectedPhotoFile = null;
    currentPhotoUrl = '';
    fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewState) previewState.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
  }

  // 7. Funciones del Lightbox
  function openPhotoLightbox(src) {
    if (!lightboxModal || !lightboxImg) return;
    lightboxImg.src = src;

    const firstName = document.getElementById('input-first-name')?.value.trim() || '';
    const lastName = document.getElementById('input-last-name')?.value.trim() || '';
    const num = document.getElementById('input-employee-number')?.value.trim() || '';
    
    if (lightboxCaption) {
      lightboxCaption.textContent = firstName || lastName 
        ? `Fotografía: ${firstName} ${lastName} ${num ? `(${num})` : ''}` 
        : 'Fotografía del Trabajador';
    }

    lightboxModal.classList.add('is-open');
  }

  function closePhotoLightbox() {
    if (lightboxModal) {
      lightboxModal.classList.remove('is-open');
    }
  }

  btnCloseLightbox?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePhotoLightbox();
  });

  lightboxModal?.addEventListener('click', (e) => {
    if (e.target === lightboxModal || e.target.classList.contains('lightbox-dialog') || e.target.classList.contains('lightbox-image-wrap')) {
      closePhotoLightbox();
    }
  });

  btnLightboxChange?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePhotoLightbox();
    fileInput.click();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxModal?.classList.contains('is-open')) {
      closePhotoLightbox();
    }
  });
}

/**
 * Generador automático de número de ficha o código
 */
function setupAutoCodeButton() {
  const btnAuto = document.getElementById('btn-auto-code');
  const inputCode = document.getElementById('input-employee-number');
  if (!btnAuto || !inputCode) return;

  btnAuto.addEventListener('click', () => {
    const seq = Math.floor(1 + Math.random() * 99998);
    const code = `TRA${String(seq).padStart(5, '0')}`;
    inputCode.value = code;
    showToast(`Código generado: ${code}`, 'info');
  });
}

/**
 * Validación interactiva en vivo de los requisitos de contraseña segura
 */
function setupLivePasswordValidation() {
  const pwdInput = document.getElementById('input-password');
  const ruleLen = document.getElementById('rule-len');
  const ruleUpper = document.getElementById('rule-upper');
  const ruleNum = document.getElementById('rule-num');

  if (!pwdInput) return;

  function updateRule(elem, isValid) {
    if (!elem) return;
    const icon = elem.querySelector('.rule-icon');
    const text = elem.querySelector('.rule-text');
    if (isValid) {
      elem.style.color = '#16a34a';
      if (text) text.style.fontWeight = '600';
      if (icon) {
        icon.textContent = '✔';
        icon.style.color = '#16a34a';
      }
    } else {
      elem.style.color = '#64748b';
      if (text) text.style.fontWeight = 'normal';
      if (icon) {
        icon.textContent = '○';
        icon.style.color = '#94a3b8';
      }
    }
  }

  const handleLiveCheck = () => {
    const val = pwdInput.value;
    const hasLen = val.length >= 6;
    const hasUpper = /[A-Z]/.test(val);
    const hasNum = /\d/.test(val);

    updateRule(ruleLen, hasLen);
    updateRule(ruleUpper, hasUpper);
    updateRule(ruleNum, hasNum);
  };

  pwdInput.addEventListener('input', handleLiveCheck);
  pwdInput.addEventListener('change', handleLiveCheck);
}

/**
 * Validación interactiva en vivo de fecha de nacimiento (mínimo 15 años y edad válida)
 */
function setupLiveBirthDateValidation() {
  const birthInput = document.getElementById('input-birth-date');
  const errorMsg = document.getElementById('birth-date-error');
  if (!birthInput) return;

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate()).toISOString().split('T')[0];
  const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()).toISOString().split('T')[0];

  birthInput.max = maxDate;
  birthInput.min = minDate;

  const validateLive = () => {
    const val = birthInput.value;
    if (!val) {
      if (errorMsg) errorMsg.style.display = 'none';
      birthInput.style.borderColor = '';
      return true;
    }

    const check = validateBirthDate(val, !editEmployeeId);
    if (!check.isValid) {
      if (errorMsg) {
        errorMsg.textContent = check.message;
        errorMsg.style.display = 'block';
      }
      birthInput.style.borderColor = '#dc2626';
      return false;
    } else {
      if (errorMsg) errorMsg.style.display = 'none';
      birthInput.style.borderColor = '#16a34a';
      return true;
    }
  };

  birthInput.addEventListener('input', validateLive);
  birthInput.addEventListener('change', validateLive);
}

/**
 * Validación y Envío del Formulario
 */
function setupFormSubmit() {
  const form = document.getElementById('form-create-employee');
  const btnSubmitTop = document.getElementById('btn-submit-top');
  const btnSubmitBottom = document.getElementById('btn-submit-bottom');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const firstName = document.getElementById('input-first-name')?.value.trim();
    const secondName = document.getElementById('input-second-name')?.value.trim() || '';
    const lastName = document.getElementById('input-last-name')?.value.trim();
    const secondLastName = document.getElementById('input-second-last-name')?.value.trim() || '';
    const identityDoc = document.getElementById('input-identity-doc')?.value.trim();
    const birthDateInput = document.getElementById('input-birth-date');
    const birthDate = birthDateInput?.value || '';
    const phone = document.getElementById('input-phone')?.value.trim() || '';
    const employeeNumber = document.getElementById('input-employee-number')?.value.trim();
    const department = document.getElementById('input-department')?.value.trim();
    const position = document.getElementById('input-position')?.value.trim();
    const salary = document.getElementById('input-salary')?.value || '0.00';
    const email = document.getElementById('input-email')?.value.trim();
    const password = document.getElementById('input-password')?.value.trim();
    const isActive = document.getElementById('input-is-active')?.checked ?? true;

    // 1. Validaciones de nombres
    if (!firstName || !lastName) {
      showToast('Ingresa el nombre y apellido del trabajador.', 'warning');
      document.getElementById('input-first-name')?.focus();
      return;
    }

    // 2. Cédula
    if (!identityDoc) {
      showToast('Ingresa la cédula o documento de identidad.', 'warning');
      document.getElementById('input-identity-doc')?.focus();
      return;
    }

    // 3. Fecha de nacimiento (Mínimo 15 años, no futura, menor a 100 años)
    const isNew = !editEmployeeId;
    const bValidation = validateBirthDate(birthDate, isNew);
    if (!bValidation.isValid) {
      showToast(bValidation.message, 'warning');
      birthDateInput?.focus();
      return;
    }

    // 4. Ficha, departamento y cargo
    if (!employeeNumber) {
      showToast('Ingresa o genera el número de ficha del empleado.', 'warning');
      document.getElementById('input-employee-number')?.focus();
      return;
    }

    if (!department) {
      showToast('Especifica el departamento asignado.', 'warning');
      document.getElementById('input-department')?.focus();
      return;
    }

    if (!position) {
      showToast('Especifica el cargo o puesto de trabajo.', 'warning');
      document.getElementById('input-position')?.focus();
      return;
    }

    // 5. Validación en vivo de contraseña segura
    const pwdValidation = validateSecurePassword(password, isNew);
    if (!pwdValidation.isValid) {
      showToast(pwdValidation.message, 'warning');
      document.getElementById('input-password')?.focus();
      return;
    }

    const actionText = editEmployeeId ? 'actualización' : 'registro';
    const actionBtn = editEmployeeId ? 'Actualizar' : 'Registrar';

    // Modal de confirmación
    const confirmed = typeof showConfirmModal === 'function'
      ? await showConfirmModal({
          title: editEmployeeId ? 'Guardar Cambios' : 'Registrar Colaborador',
          message: `¿Confirmas la ${actionText} del trabajador "${firstName} ${lastName}" con ficha ${employeeNumber}?`,
          confirmText: actionBtn,
          cancelText: 'Revisar',
          type: 'info'
        })
      : confirm(`¿Confirmas la ${actionText} de "${firstName} ${lastName}"?`);

    if (!confirmed) return;

    isSubmitting = true;
    setButtonsLoading(true);

    // Pantalla de carga con avance estimado del 0 al 100%
    showLoadingOverlay({
      title: editEmployeeId ? 'Actualizando Colaborador...' : 'Registrando Colaborador...',
      message: 'Por favor espera mientras se procesa y guarda la información en el sistema.',
      estimatedDuration: 1300
    });

    try {
      const formData = new FormData();
      formData.append('first_name', firstName);
      formData.append('second_name', secondName);
      formData.append('last_name', lastName);
      formData.append('second_last_name', secondLastName);
      formData.append('identity_document', identityDoc);
      formData.append('id_number', identityDoc);
      if (birthDate) formData.append('birth_date', birthDate);
      formData.append('phone', phone);
      formData.append('employee_number', employeeNumber);
      formData.append('department', department);
      formData.append('position', position);
      formData.append('salary', parseFloat(salary || 0).toFixed(2));
      formData.append('is_active', isActive ? 'true' : 'false');
      if (email) formData.append('email', email);
      if (password) formData.append('password', password);

      if (selectedPhotoFile) {
        formData.append('photo', selectedPhotoFile);
      }

      if (editEmployeeId) {
        await updateEmployee(editEmployeeId, formData);
      } else {
        await createEmployee(formData);
      }

      // Animación de éxito 100% en el overlay de carga
      await hideLoadingOverlay(true);

      const successMsg = editEmployeeId
        ? `Trabajador "${firstName} ${lastName}" actualizado exitosamente.`
        : `Trabajador "${firstName} ${lastName}" registrado exitosamente.`;

      try {
        sessionStorage.setItem('flash_toast', JSON.stringify({
          message: successMsg,
          type: 'success'
        }));
      } catch (e) {
        console.warn('Error guardando flash toast:', e);
      }

      // Redirigir a la tabla de trabajadores
      window.location.href = 'employee-ledger.html';

    } catch (err) {
      await hideLoadingOverlay(false);
      console.error('Error guardando empleado:', err);
      let errorMsg = 'Error al guardar trabajador.';
      if (typeof err?.data === 'string') {
        errorMsg = err.data;
      } else if (err?.data?.error) {
        errorMsg = err.data.error;
      } else if (err?.data?.detail) {
        errorMsg = err.data.detail;
      } else if (err?.data?.employee_number) {
        errorMsg = `El código de empleado ya está en uso: ${err.data.employee_number}`;
      } else if (err?.data && typeof err.data === 'object') {
        errorMsg = Object.entries(err.data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\n');
      } else if (err?.message) {
        errorMsg = err.message;
      }

      showToast(errorMsg, 'error');
      setButtonsLoading(false);
      isSubmitting = false;
    }
  });

  function setButtonsLoading(loading) {
    [btnSubmitTop, btnSubmitBottom].forEach(btn => {
      if (!btn) return;
      btn.disabled = loading;
      if (loading) {
        btn.innerHTML = '<span>Guardando...</span>';
      } else {
        const btnLabel = editEmployeeId ? 'Guardar Cambios' : 'Guardar Trabajador';
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span>${btnLabel}</span>
        `;
      }
    });
  }
}

/**
 * Valida la fecha de nacimiento (mínimo 15 años cumplidos, no futura y no mayor a 100 años)
 */
function validateBirthDate(val, isRequired = true) {
  if (!val) {
    if (isRequired) {
      return { isValid: false, message: 'La fecha de nacimiento es obligatoria para registrar al trabajador.' };
    }
    return { isValid: true };
  }

  const parts = val.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return { isValid: false, message: 'Formato de fecha de nacimiento inválido.' };
  }

  const [y, m, d] = parts;
  const birth = new Date(y, m - 1, d);
  const today = new Date();

  if (birth > today) {
    return { isValid: false, message: 'La fecha de nacimiento no puede ser una fecha futura.' };
  }

  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 15) {
    return { isValid: false, message: `El trabajador debe tener al menos 15 años cumplidos (edad actual calculada: ${age} años).` };
  }

  if (age > 100) {
    return { isValid: false, message: 'Por favor ingresa una fecha válida (edad superior a 100 años no permitida).' };
  }

  return { isValid: true, age };
}

/**
 * Valida que la contraseña cumpla los requisitos de seguridad:
 * Mínimo 6 caracteres, al menos una mayúscula y al menos un número.
 */
function validateSecurePassword(pwd, isRequired = true) {
  if (!pwd) {
    if (isRequired) {
      return { isValid: false, message: 'La contraseña de acceso es obligatoria para registrar al trabajador.' };
    }
    return { isValid: true };
  }
  if (pwd.length < 6) {
    return { isValid: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (!/[A-Z]/.test(pwd)) {
    return { isValid: false, message: 'La contraseña debe contener al menos una letra mayúscula (A-Z).' };
  }
  if (!/\d/.test(pwd)) {
    return { isValid: false, message: 'La contraseña debe contener al menos un número (0-9).' };
  }
  return { isValid: true };
}

/**
 * Muestra notificaciones Toast flotantes
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    margin-bottom: 10px;
    border-radius: 8px;
    background: #0f172a;
    color: #ffffff;
    font-size: 0.85rem;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
    animation: fadeIn 0.2s ease-out;
  `;

  if (type === 'success') toast.style.borderLeft = '4px solid #10b981';
  if (type === 'error') toast.style.borderLeft = '4px solid #ef4444';
  if (type === 'warning') toast.style.borderLeft = '4px solid #f59e0b';
  if (type === 'info') toast.style.borderLeft = '4px solid #0284c7';

  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
