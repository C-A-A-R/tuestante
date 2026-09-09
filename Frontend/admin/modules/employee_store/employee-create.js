/**
 * employee-create.js
 * Controlador de Registro de Nuevos Trabajadores - TuEstante Admin
 */

import { loadAdminComponents } from '../../components/navbar/navbar.js';
import { createEmployee } from './employee-store.api.js';
import { showConfirmModal } from '../../components/modal/modal.js';

let selectedPhotoFile = null;
let isSubmitting = false;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAdminComponents({ title: 'Registrar Trabajador' });
  } catch (err) {
    console.warn('Navbar/Drawer/Footer load warning:', err);
  }

  setupPhotoDropzone();
  setupAutoCodeButton();
  setupFormSubmit();
});

/**
 * Configuración del Drag & Drop y selección de foto de perfil
 */
function setupPhotoDropzone() {
  const dropzone = document.getElementById('photo-dropzone');
  const fileInput = document.getElementById('input-employee-photo');
  const emptyState = document.getElementById('dropzone-empty');
  const previewState = document.getElementById('dropzone-preview');
  const previewImg = document.getElementById('img-photo-preview');
  const btnChange = document.getElementById('btn-change-photo');
  const btnRemove = document.getElementById('btn-remove-photo');

  if (!dropzone || !fileInput) return;

  // Abrir selector al hacer clic en el dropzone (si está en estado vacío)
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-change-photo') || e.target.closest('#btn-remove-photo')) {
      return;
    }
    if (!selectedPhotoFile) {
      fileInput.click();
    }
  });

  btnChange?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  btnRemove?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPhoto();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  // Drag & Drop
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
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).', 'error');
      return;
    }

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen supera el límite permitido de 5MB.', 'error');
      return;
    }

    selectedPhotoFile = file;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (previewImg) previewImg.src = ev.target.result;
      if (emptyState) emptyState.classList.add('hidden');
      if (previewState) previewState.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    selectedPhotoFile = null;
    fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewState) previewState.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
  }
}

/**
 * Generador automático de número de ficha o código
 */
function setupAutoCodeButton() {
  const btnAuto = document.getElementById('btn-auto-code');
  const inputCode = document.getElementById('input-employee-number');
  if (!btnAuto || !inputCode) return;

  btnAuto.addEventListener('click', () => {
    const year = new Date().getFullYear();
    const seq = Math.floor(1 + Math.random() * 9998);
    const code = `TRA-${String(seq).padStart(4, '0')}-${year}`;
    inputCode.value = code;
    showToast(`Código generado: ${code}`, 'info');
  });
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
    const lastName = document.getElementById('input-last-name')?.value.trim();
    const identityDoc = document.getElementById('input-identity-doc')?.value.trim();
    const employeeNumber = document.getElementById('input-employee-number')?.value.trim();
    const department = document.getElementById('input-department')?.value.trim();
    const position = document.getElementById('input-position')?.value.trim();
    const salary = document.getElementById('input-salary')?.value || '0.00';
    const email = document.getElementById('input-email')?.value.trim();
    const isActive = document.getElementById('input-is-active')?.checked ?? true;

    // Validaciones
    if (!firstName || !lastName) {
      showToast('Ingresa el nombre y apellido del trabajador.', 'warning');
      document.getElementById('input-first-name')?.focus();
      return;
    }

    if (!identityDoc) {
      showToast('Ingresa la cédula o documento de identidad.', 'warning');
      document.getElementById('input-identity-doc')?.focus();
      return;
    }

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

    // Modal de confirmación
    const confirmed = typeof showConfirmModal === 'function'
      ? await showConfirmModal({
          title: 'Registrar Colaborador',
          message: `¿Confirmas el registro del trabajador "${firstName} ${lastName}" con ficha ${employeeNumber}?`,
          confirmText: 'Registrar',
          cancelText: 'Revisar',
          type: 'info'
        })
      : confirm(`¿Confirmas el registro de "${firstName} ${lastName}"?`);

    if (!confirmed) return;

    isSubmitting = true;
    setButtonsLoading(true);

    try {
      const formData = new FormData();
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('identity_document', identityDoc);
      formData.append('id_number', identityDoc);
      formData.append('employee_number', employeeNumber);
      formData.append('department', department);
      formData.append('position', position);
      formData.append('salary', parseFloat(salary || 0).toFixed(2));
      formData.append('is_active', isActive ? 'true' : 'false');
      if (email) formData.append('email', email);

      if (selectedPhotoFile) {
        formData.append('photo', selectedPhotoFile);
      }

      await createEmployee(formData);

      showToast(`¡Trabajador "${firstName} ${lastName}" registrado con éxito!`, 'success');

      setTimeout(() => {
        window.location.href = 'employee-ledger.html';
      }, 700);

    } catch (err) {
      console.error('Error registrando empleado:', err);
      let errorMsg = 'Error al registrar trabajador.';
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
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span>Guardar Trabajador</span>
        `;
      }
    });
  }
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
