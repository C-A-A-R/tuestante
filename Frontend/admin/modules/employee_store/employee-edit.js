/**
 * employee-edit.js
 * Controlador de Actualización de Trabajadores - TuEstante Admin
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { fetchEmployee, updateEmployee } from './employee-store.api.js';
import { showConfirmModal, showLoadingOverlay, hideLoadingOverlay } from '../../components/modal/modal.js';
import { resolveImageUrl } from '../../js/api.js';

let selectedPhotoFile = null;
let isSubmitting = false;
let editEmployeeId = null;
let currentPhotoUrl = '';
let currentEmployeeData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  editEmployeeId = urlParams.get('id') || urlParams.get('edit');

  if (!editEmployeeId) {
    showToast('No se especificó el identificador del trabajador a editar.', 'error');
    setTimeout(() => {
      window.location.href = 'employee-ledger.html';
    }, 1500);
    return;
  }

  try {
    await loadAdminComponents({ title: 'Actualizar Trabajador' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load warning:', err);
  }

  setupPhotoDropzone();
  setupLiveBirthDateValidation();
  setupPasswordModal();
  setupDocumentTypeSync();
  setupFormSubmit();

  await loadEmployeeData(editEmployeeId);
});

/**
 * Carga los datos existentes del colaborador para edición
 */
async function loadEmployeeData(employeeId) {
  try {
    showLoadingOverlay({
      title: 'Cargando Datos',
      message: 'Obteniendo información del colaborador...',
      estimatedDuration: 800
    });

    const emp = await fetchEmployee(employeeId);
    await hideLoadingOverlay(false);

    if (!emp) {
      showToast('No se encontró el trabajador solicitado.', 'error');
      setTimeout(() => {
        window.location.href = 'employee-ledger.html';
      }, 1500);
      return;
    }

    currentEmployeeData = emp;

    // Actualizar badges y títulos
    const empCode = emp.employee_number || `EMP-${emp.id}`;
    const badgeEl = document.getElementById('header-emp-badge');
    if (badgeEl) {
      badgeEl.textContent = empCode;
      badgeEl.style.display = 'inline-flex';
    }

    const fullName = emp.user?.get_full_name || 
      `${emp.user?.first_name || emp.first_name || ''} ${emp.user?.last_name || emp.last_name || ''}`.trim() ||
      emp.user?.username || 'Colaborador';

    const modalEmpInfo = document.getElementById('pwd-modal-emp-info');
    if (modalEmpInfo) {
      modalEmpInfo.textContent = `Para: ${fullName} (Ficha: ${empCode})`;
    }

    // Campos de texto
    const firstName = emp.user?.first_name || emp.first_name || '';
    const lastName = emp.user?.last_name || emp.last_name || '';
    const secondName = emp.second_name || '';
    const secondLastName = emp.second_last_name || '';

    setInputValue('input-first-name', firstName);
    setInputValue('input-second-name', secondName);
    setInputValue('input-last-name', lastName);
    setInputValue('input-second-last-name', secondLastName);

    const rawDoc = emp.id_number || emp.identity_document || emp.user?.identity_document || emp.user?.username || '';
    let docType = emp.document_type || emp.user?.document_type || 'V';
    let docNum = rawDoc;
    if (rawDoc && rawDoc.includes('-')) {
      const parts = rawDoc.split('-');
      docType = parts[0].toUpperCase();
      docNum = parts.slice(1).join('-');
    } else if (rawDoc && /^[A-Za-z]/.test(rawDoc)) {
      docType = rawDoc.charAt(0).toUpperCase();
      docNum = rawDoc.slice(1);
    }
    setInputValue('select-document-type', docType);
    setInputValue('input-identity-doc', docNum);
    setInputValue('input-phone', emp.phone || emp.user?.phone || '');
    setInputValue('input-email', emp.user?.email || emp.email || '');
    setInputValue('input-employee-number', emp.employee_number || '');
    setInputValue('input-department', emp.department || '');
    setInputValue('input-position', emp.position || '');
    setInputValue('input-salary', parseFloat(emp.salary || 0).toFixed(2));

    const inputActive = document.getElementById('input-is-active');
    if (inputActive) {
      inputActive.checked = emp.is_active !== false;
    }

    // Fecha de nacimiento
    const birthDateVal = emp.birth_date || emp.user?.birth_date || '';
    const inputBirth = document.getElementById('input-birth-date');
    if (inputBirth && birthDateVal) {
      inputBirth.value = birthDateVal;
      inputBirth.dispatchEvent(new Event('input'));
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

  } catch (err) {
    console.error('Error cargando trabajador:', err);
    await hideLoadingOverlay(false);
    showToast('Error al conectar con el servidor para cargar el trabajador.', 'error');
  }
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/**
 * Validación reactiva de fecha de nacimiento y cálculo de edad
 */
function setupLiveBirthDateValidation() {
  const inputBirth = document.getElementById('input-birth-date');
  const errorMsg = document.getElementById('birth-date-error');
  const hintMsg = document.getElementById('birth-date-hint');

  if (!inputBirth) return;

  const validate = () => {
    const val = inputBirth.value;
    if (!val) {
      if (errorMsg) errorMsg.style.display = 'none';
      if (hintMsg) {
        hintMsg.textContent = 'Mínimo 15 años cumplidos (edad válida hasta 100 años).';
        hintMsg.style.color = '';
      }
      inputBirth.setCustomValidity('');
      return true;
    }

    const birthDate = new Date(val + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (birthDate > today) {
      const err = 'La fecha de nacimiento no puede ser una fecha futura.';
      if (errorMsg) {
        errorMsg.textContent = err;
        errorMsg.style.display = 'block';
      }
      if (hintMsg) hintMsg.textContent = '';
      inputBirth.setCustomValidity(err);
      return false;
    }

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 15) {
      const err = `El trabajador debe tener al menos 15 años de edad cumplidos (tiene ${age} años).`;
      if (errorMsg) {
        errorMsg.textContent = err;
        errorMsg.style.display = 'block';
      }
      if (hintMsg) hintMsg.textContent = '';
      inputBirth.setCustomValidity(err);
      return false;
    }

    if (age > 100) {
      const err = 'Por favor ingresa una fecha de nacimiento válida (edad superior a 100 años no permitida).';
      if (errorMsg) {
        errorMsg.textContent = err;
        errorMsg.style.display = 'block';
      }
      if (hintMsg) hintMsg.textContent = '';
      inputBirth.setCustomValidity(err);
      return false;
    }

    if (errorMsg) errorMsg.style.display = 'none';
    if (hintMsg) {
      hintMsg.textContent = `✓ Edad calculada: ${age} años (Válido para contratación).`;
      hintMsg.style.color = '#16a34a';
    }
    inputBirth.setCustomValidity('');
    return true;
  };

  inputBirth.addEventListener('input', validate);
  inputBirth.addEventListener('change', validate);
}

/**
 * Gestión del Modal de Actualización de Contraseña
 */
function setupPasswordModal() {
  const btnOpenModal = document.getElementById('btn-open-password-modal');
  const modalBackdrop = document.getElementById('modal-change-password');
  const btnCloseModal = document.getElementById('btn-close-pwd-modal');
  const btnCancelModal = document.getElementById('btn-cancel-pwd-modal');
  const formPassword = document.getElementById('form-change-password');

  const inputPwd = document.getElementById('modal-input-password');
  const inputConfirmPwd = document.getElementById('modal-input-confirm-password');
  const matchError = document.getElementById('modal-pwd-match-error');

  const ruleLen = document.getElementById('modal-rule-len');
  const ruleUpper = document.getElementById('modal-rule-upper');
  const ruleNum = document.getElementById('modal-rule-num');
  const ruleMatch = document.getElementById('modal-rule-match');

  const btnTogglePwd = document.getElementById('btn-toggle-modal-pwd');
  const btnToggleConfirm = document.getElementById('btn-toggle-modal-confirm-pwd');

  if (!btnOpenModal || !modalBackdrop) return;

  const openModal = () => {
    modalBackdrop.classList.add('is-visible');
    if (inputPwd) {
      inputPwd.value = '';
      inputPwd.focus();
    }
    if (inputConfirmPwd) inputConfirmPwd.value = '';
    if (matchError) matchError.style.display = 'none';
    validatePasswordRules();
  };

  const closeModal = () => {
    modalBackdrop.classList.remove('is-visible');
  };

  btnOpenModal.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('is-visible')) {
      closeModal();
    }
  });

  // Toggles de visibilidad
  const toggleVisibility = (btn, input) => {
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.innerHTML = isPwd
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
             <line x1="1" y1="23" x2="23" y2="23"></line>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
             <circle cx="12" cy="12" r="3"></circle>
           </svg>`;
    });
  };

  toggleVisibility(btnTogglePwd, inputPwd);
  toggleVisibility(btnToggleConfirm, inputConfirmPwd);

  // Validación reactiva de reglas
  function validatePasswordRules() {
    const pwd = inputPwd ? inputPwd.value : '';
    const confirmPwd = inputConfirmPwd ? inputConfirmPwd.value : '';

    const hasLen = pwd.length >= 6;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNum = /[0-9]/.test(pwd);
    const hasMatch = Boolean(pwd && confirmPwd && pwd === confirmPwd);

    updateRuleState(ruleLen, hasLen, 'Mínimo 6 caracteres');
    updateRuleState(ruleUpper, hasUpper, 'Al menos una letra mayúscula (A-Z)');
    updateRuleState(ruleNum, hasNum, 'Al menos un número (0-9)');
    updateRuleState(ruleMatch, hasMatch, 'Las contraseñas coinciden');

    if (confirmPwd && pwd && pwd !== confirmPwd) {
      if (matchError) matchError.style.display = 'block';
    } else {
      if (matchError) matchError.style.display = 'none';
    }

    return hasLen && hasUpper && hasNum && hasMatch;
  }

  function updateRuleState(el, isValid, text) {
    if (!el) return;
    const icon = el.querySelector('.modal-rule-icon');
    const label = el.querySelector('.modal-rule-text');
    if (label) label.textContent = text;

    if (isValid) {
      el.classList.add('is-valid');
      el.classList.remove('is-invalid');
      if (icon) icon.textContent = '✓';
    } else {
      el.classList.remove('is-valid');
      if (icon) icon.textContent = '○';
    }
  }

  if (inputPwd) {
    inputPwd.addEventListener('input', validatePasswordRules);
  }
  if (inputConfirmPwd) {
    inputConfirmPwd.addEventListener('input', validatePasswordRules);
  }

  // Envío del formulario de contraseña
  if (formPassword) {
    formPassword.addEventListener('submit', async (e) => {
      e.preventDefault();

      const isValid = validatePasswordRules();
      if (!isValid) {
        showToast('La contraseña debe cumplir todos los requisitos de seguridad obligatorios.', 'error');
        return;
      }

      const newPassword = inputPwd.value;
      const empName = currentEmployeeData?.user?.get_full_name || 
        `${currentEmployeeData?.user?.first_name || ''} ${currentEmployeeData?.user?.last_name || ''}`.trim() ||
        'este trabajador';

      // 1. Confirmar este paso antes de actualizarla
      const confirmed = await showConfirmModal({
        title: '¿Confirmar Cambio de Contraseña?',
        message: `¿Estás seguro de que deseas actualizar la contraseña de acceso para ${empName}? El colaborador deberá ingresar con su nueva clave.`,
        confirmText: 'Sí, Cambiar Contraseña',
        cancelText: 'Cancelar',
        type: 'warning'
      });

      if (!confirmed) return;

      // 2. Ejecutar con overlay de carga 0-100%
      try {
        showLoadingOverlay({
          title: 'Actualizando Contraseña',
          message: 'Guardando nuevas credenciales de acceso...',
          estimatedDuration: 1000
        });

        await updateEmployee(editEmployeeId, { password: newPassword });

        await hideLoadingOverlay(true);

        closeModal();
        showToast('¡Contraseña de acceso actualizada exitosamente!', 'success');

      } catch (err) {
        console.error('Error al actualizar contraseña:', err);
        await hideLoadingOverlay(false);
        const errMsg = err?.message || 'Error al actualizar la contraseña del colaborador.';
        showToast(errMsg, 'error');
      }
    });
  }
}

/**
 * Dropzone de Foto de Perfil
 */
function setupPhotoDropzone() {
  const dropzone = document.getElementById('photo-dropzone');
  const fileInput = document.getElementById('input-photo-file');
  const previewImg = document.getElementById('img-photo-preview');
  const emptyState = document.getElementById('dropzone-empty');
  const previewState = document.getElementById('dropzone-preview');

  const btnChange = document.getElementById('btn-change-photo');
  const btnRemove = document.getElementById('btn-remove-photo');
  const btnZoom = document.getElementById('btn-zoom-photo');
  const avatarWrapper = document.getElementById('avatar-preview-wrapper');

  const modalLightbox = document.getElementById('modal-photo-lightbox');
  const lightboxImg = document.getElementById('img-lightbox-full');
  const btnCloseLightbox = document.getElementById('btn-close-photo-lightbox');
  const btnLightboxChange = document.getElementById('btn-lightbox-change-photo');

  if (!dropzone || !fileInput) return;

  const handleFile = (file) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Formato de imagen no soportado. Usa JPG, PNG o WEBP.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('La foto supera el tamaño máximo permitido de 5MB.', 'error');
      return;
    }

    selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) previewImg.src = e.target.result;
      if (emptyState) emptyState.classList.add('hidden');
      if (previewState) previewState.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  };

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-change-photo') || e.target.closest('#btn-remove-photo') || e.target.closest('#btn-zoom-photo') || e.target.closest('#avatar-preview-wrapper')) {
      return;
    }
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFile(fileInput.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  if (btnChange) {
    btnChange.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (btnRemove) {
    btnRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedPhotoFile = 'DELETE';
      fileInput.value = '';
      if (previewImg) previewImg.src = '';
      if (previewState) previewState.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
    });
  }

  const openLightbox = (e) => {
    if (e) e.stopPropagation();
    const src = previewImg ? previewImg.src : currentPhotoUrl;
    if (src && lightboxImg && modalLightbox) {
      lightboxImg.src = src;
      modalLightbox.classList.add('is-open');
    }
  };

  if (btnZoom) btnZoom.addEventListener('click', openLightbox);
  if (avatarWrapper) avatarWrapper.addEventListener('click', openLightbox);

  const closeLightbox = () => {
    if (modalLightbox) modalLightbox.classList.remove('is-open');
  };

  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closeLightbox);
  if (modalLightbox) {
    modalLightbox.addEventListener('click', (e) => {
      if (e.target === modalLightbox) closeLightbox();
    });
  }

  if (btnLightboxChange) {
    btnLightboxChange.addEventListener('click', () => {
      closeLightbox();
      fileInput.click();
    });
  }
}

/**
 * Sincronización del tipo de documento y el número de cédula
 */
function setupDocumentTypeSync() {
  const selectDocType = document.getElementById('select-document-type');
  const inputIdentityDoc = document.getElementById('input-identity-doc');
  if (!selectDocType || !inputIdentityDoc) return;

  inputIdentityDoc.addEventListener('input', () => {
    const val = inputIdentityDoc.value.trim();
    const match = val.match(/^([VEJGPRvejgpr])[-_ ]?(.*)$/);
    if (match) {
      const detectedType = match[1].toUpperCase();
      const rest = match[2];
      if (val.includes('-') || (rest && /^\d+$/.test(rest))) {
        selectDocType.value = detectedType;
        inputIdentityDoc.value = rest;
      }
    }
  });
}

/**
 * Guardado del Formulario de Edición Principal
 */
function setupFormSubmit() {
  const form = document.getElementById('form-edit-employee');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Validación de campos obligatorios
    const requiredInputs = [
      { id: 'input-first-name', label: 'Primer Nombre' },
      { id: 'input-last-name', label: 'Primer Apellido' },
      { id: 'input-identity-doc', label: 'Cédula de Identidad' },
      { id: 'input-birth-date', label: 'Fecha de Nacimiento' },
      { id: 'input-employee-number', label: 'Ficha o Código de Empleado' },
      { id: 'input-department', label: 'Departamento / Área' },
      { id: 'input-position', label: 'Cargo o Puesto' }
    ];

    for (const f of requiredInputs) {
      const el = document.getElementById(f.id);
      if (!el || !el.value.trim()) {
        showToast(`El campo "${f.label}" es obligatorio.`, 'error');
        if (el) el.focus();
        return;
      }
    }

    // Validación de fecha de nacimiento
    const inputBirth = document.getElementById('input-birth-date');
    if (inputBirth && inputBirth.value) {
      const birthDate = new Date(inputBirth.value + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (birthDate > today) {
        showToast('La fecha de nacimiento no puede ser una fecha futura.', 'error');
        inputBirth.focus();
        return;
      }

      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 15) {
        showToast(`El colaborador debe tener al menos 15 años cumplidos (tiene ${age} años).`, 'error');
        inputBirth.focus();
        return;
      }

      if (age > 100) {
        showToast('Ingresa una fecha de nacimiento válida (edad superior a 100 años no permitida).', 'error');
        inputBirth.focus();
        return;
      }
    }

    const docType = document.getElementById('select-document-type')?.value || 'V';
    const rawDocNum = document.getElementById('input-identity-doc')?.value.trim() || '';
    let cleanDocNum = rawDocNum.replace(/^[A-Za-z]-?/, '').replace(/\s+/g, '');
    if (!cleanDocNum && rawDocNum) cleanDocNum = rawDocNum;
    const fullIdentityDoc = cleanDocNum ? `${docType}-${cleanDocNum}` : '';

    if (!cleanDocNum) {
      showToast('Ingresa el número de cédula o documento de identidad.', 'error');
      document.getElementById('input-identity-doc')?.focus();
      return;
    }

    isSubmitting = true;

    // Armar FormData para enviar datos y posible foto
    const formData = new FormData();
    formData.append('first_name', document.getElementById('input-first-name').value.trim());
    formData.append('second_name', document.getElementById('input-second-name').value.trim());
    formData.append('last_name', document.getElementById('input-last-name').value.trim());
    formData.append('second_last_name', document.getElementById('input-second-last-name').value.trim());
    formData.append('document_type', docType);
    formData.append('identity_document', fullIdentityDoc);
    formData.append('id_number', fullIdentityDoc);
    formData.append('phone', document.getElementById('input-phone').value.trim());
    formData.append('email', document.getElementById('input-email').value.trim());
    formData.append('employee_number', document.getElementById('input-employee-number').value.trim());
    formData.append('department', document.getElementById('input-department').value.trim());
    formData.append('position', document.getElementById('input-position').value.trim());
    formData.append('salary', document.getElementById('input-salary').value || '0.00');

    if (inputBirth && inputBirth.value) {
      formData.append('birth_date', inputBirth.value);
    }

    const inputActive = document.getElementById('input-is-active');
    formData.append('is_active', inputActive ? inputActive.checked : true);

    if (selectedPhotoFile instanceof File) {
      formData.append('photo', selectedPhotoFile);
    } else if (selectedPhotoFile === 'DELETE') {
      formData.append('photo', '');
    }

    try {
      showLoadingOverlay({
        title: 'Actualizando Trabajador',
        message: 'Guardando modificaciones del colaborador...',
        estimatedDuration: 1200
      });

      await updateEmployee(editEmployeeId, formData);

      await hideLoadingOverlay(true);

      showToast('Trabajador actualizado exitosamente.', 'success');

      setTimeout(() => {
        window.location.href = `employee-statement.html?id=${editEmployeeId}`;
      }, 700);

    } catch (err) {
      console.error('Error al actualizar trabajador:', err);
      await hideLoadingOverlay(false);
      const msg = err?.message || 'Error al guardar los cambios del trabajador.';
      showToast(msg, 'error');
    } finally {
      isSubmitting = false;
    }
  });
}

/**
 * Notificaciones Toast
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.padding = '12px 18px';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '0.875rem';
  toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.15)';
  toast.style.marginBottom = '10px';
  toast.style.transition = 'all 0.3s ease';
  toast.style.zIndex = '99999';

  let icon = 'ℹ️';
  let borderLeft = '#0284c7';
  let bg = '#0f172a';
  let color = '#ffffff';

  if (type === 'success') {
    icon = '✓';
    borderLeft = '#10b981';
  } else if (type === 'error') {
    icon = '✕';
    borderLeft = '#ef4444';
  } else if (type === 'warning') {
    icon = '⚠️';
    borderLeft = '#f59e0b';
  }

  toast.style.background = bg;
  toast.style.color = color;
  toast.style.borderLeft = `4px solid ${borderLeft}`;

  toast.innerHTML = `<span style="font-weight:700;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
