// Funcionalidad de registro y validaciones
document.addEventListener('DOMContentLoaded', function() {
    const togglePassword = document.getElementById('toggle-password');
    const passwordField = document.getElementById('password');
    const passwordIcon = togglePassword ? togglePassword.querySelector('.password-icon') : null;
    const registerButton = document.querySelector('.btn-save');

    // Campos de teléfono nuevo
    const phoneCode = document.getElementById('phone-code');
    const phoneSmall = document.getElementById('phone-small');
    const telefonoHidden = document.getElementById('telefono');
    // Contenedor de mensaje inferior global y mensaje específico para teléfono
    const formBottomMessage = document.getElementById('form-bottom-message');
    const phoneMessage = document.getElementById('phone-message');

    // Funcionalidad de mostrar/ocultar contraseña
    if (togglePassword && passwordField && passwordIcon) {
        togglePassword.addEventListener('click', function() {
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            
            // Cambiar el ícono usando las imágenes correctas
            passwordIcon.src = type === 'password' ? '../images/open.png' : '../images/closed.png';
        });
    }

    // Campos que NO permiten espacios
    const noSpacesFields = ['usuario', 'password', 'email', 'fecha_nacimiento', 'cedula'];
    
    // Campos que SÍ permiten espacios
    const spacesAllowedFields = ['nombre', 'apellido', 'direccion'];

    // Validación de espacios en tiempo real
    noSpacesFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (field) {
            field.addEventListener('input', function() {
                // Remover espacios del campo
                if (this.value.includes(' ')) {
                    this.value = this.value.replace(/\s/g, '');
                    showFieldError(this, 'No se permiten espacios en este campo');
                }
                validateField(this);
                checkFormValidity();
            });
        }
    });

    // Sincronizar teléfono visible (phoneCode + phoneSmall) en el input hidden 'telefono'
    function syncTelefonoHidden() {
        if (!telefonoHidden) return;
        const code = phoneCode ? phoneCode.value : '';
        const small = phoneSmall ? phoneSmall.value.replace(/\s/g, '') : '';
        // Formato: +<code><small> o code+small dependiendo del formato esperado. Se guardará como code+small sin espacios.
        telefonoHidden.value = code + small;
    }

    // Sincronizar al cambiar select o input pequeño
    if (phoneCode) {
        phoneCode.addEventListener('change', function() {
            syncTelefonoHidden();
            checkFormValidity();
            // Verificar longitud del phone-small al cambiar código
            checkPhoneLength();
        });
    }

    if (phoneSmall) {
        phoneSmall.addEventListener('input', function() {
            // Remover espacios en tiempo real como con otros campos no permitidos
                if (this.value.includes(' ')) {
                this.value = this.value.replace(/\s/g, '');
                // Mostrar mensaje localizado debajo del campo teléfono
                if (phoneMessage) phoneMessage.textContent = 'No se permiten espacios en el campo teléfono';
            }
            syncTelefonoHidden();
            validateField(this);
            checkFormValidity();
            // Verificar longitud en tiempo real (sin ser intrusivo)
            checkPhoneLength();
        });
    }

    // Evitar que se ingresen caracteres no numéricos en phoneSmall (teclado)

    if (phoneSmall) {
        phoneSmall.addEventListener('keydown', function(e) {
            // permitir teclas de control: backspace(8), tab(9), enter(13), escape(27), delete(46), arrow keys (37-40)
            const allowedKeys = [8,9,13,27,46,37,38,39,40];
            if (allowedKeys.indexOf(e.keyCode) !== -1) return;

            // permitir Ctrl/Cmd + A/C/V/X
            if ((e.ctrlKey || e.metaKey) && ['a','c','v','x'].indexOf(e.key.toLowerCase()) !== -1) return;

            // permitir sólo dígitos 0-9
            const isNumberKey = /\d/.test(e.key);
            if (!isNumberKey) {
                e.preventDefault();
                // Mostrar mensaje localizado debajo del campo teléfono
                if (phoneMessage) phoneMessage.textContent = 'Solo se permiten números en el campo teléfono';
            } else {
                // Limpiar mensaje localizado si está presente
                if (phoneMessage) phoneMessage.textContent = '';
            }
        });

        // Filtrar texto pegado: permitir sólo dígitos
        phoneSmall.addEventListener('paste', function(e) {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            const digits = paste.replace(/\D/g, '');
            // Insertar sólo hasta el maxlength
            const max = this.getAttribute('maxlength') ? parseInt(this.getAttribute('maxlength')) : null;
            const current = this.value || '';
            let allowed = digits;
            if (max !== null) {
                const spaceLeft = max - current.length;
                allowed = digits.substring(0, spaceLeft);
            }
            if (allowed.length > 0) {
                this.value = current + allowed;
                // Limpiar mensaje localizado al pegar correctamente
                if (phoneMessage) phoneMessage.textContent = '';
                clearFieldError(this);
                syncTelefonoHidden();
                validateField(this);
                checkFormValidity();
                checkPhoneLength();
            } else {
                // Si no hay dígitos válidos en el contenido pegado, mostrar mensaje localizado
                if (phoneMessage) phoneMessage.textContent = 'Solo se permiten números en el campo teléfono';
            }
        });
    }

    // Función para comprobar longitud de phone-small
    function checkPhoneLength() {
        if (!phoneSmall) return;
        const digitsOnly = (phoneSmall.value || '').replace(/\D/g, '');
        if (digitsOnly.length > 0 && digitsOnly.length < 7) {
            if (phoneMessage) phoneMessage.textContent = 'Verifica el número: parece estar incompleto';
            phoneSmall.classList.add('error');
        } else {
            // limpiar mensaje localizado si está completo o vacío
            if (phoneMessage) phoneMessage.textContent = '';
            phoneSmall.classList.remove('error');
        }
    }

    // Verificar al salir del campo
    if (phoneSmall) {
        phoneSmall.addEventListener('blur', function() {
            checkPhoneLength();
        });
    }

    // Inicializar el valor hidden al cargar
    syncTelefonoHidden();

    // Validación especial para contraseña en tiempo real
    if (passwordField) {
        passwordField.addEventListener('input', function() {
            validatePasswordField(this);
            checkFormValidity();
        });
    }

    // Validación de mayoría de edad en tiempo real
    const fechaNacimientoField = document.getElementById('fecha_nacimiento');
    if (fechaNacimientoField) {
        fechaNacimientoField.addEventListener('change', function() {
            validateAge(this);
            checkFormValidity();
        });
    }

    // Validación general para otros campos
    // Nota: usamos 'phone-small' para validaciones en tiempo real y 'telefono' (hidden) se usa para envío.
    const allFields = ['usuario', 'email', 'phone-small', 'cedula', 'nombre', 'apellido', 'direccion'];
    allFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (field) {
            field.addEventListener('input', function() {
                validateField(this);
                checkFormValidity();
            });
        }
    });

    // Validación del formulario
    const form = document.querySelector('.form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validaciones básicas
            const requiredFields = [
                'usuario', 'password', 'nombre', 'apellido', 
                'email', 'telefono', 'fecha_nacimiento', 'cedula', 'direccion'
            ];
            
            let isValid = true;
            let errorMessages = [];
            
            // Validar campos requeridos
            requiredFields.forEach(fieldName => {
                const field = document.getElementById(fieldName);
                if (!field.value.trim()) {
                    field.classList.add('error');
                    isValid = false;
                    errorMessages.push(`${getFieldLabel(fieldName)} es requerido`);
                } else {
                    field.classList.remove('error');
                }
            });

            // Validación de email
            const emailField = document.getElementById('email');
            if (emailField && emailField.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailField.value)) {
                    emailField.classList.add('error');
                    isValid = false;
                    errorMessages.push('El formato del email no es válido');
                }
            }

            // Validación de contraseña
            const passwordField = document.getElementById('password');
            if (passwordField && passwordField.value) {
                if (!validatePassword(passwordField.value)) {
                    passwordField.classList.add('error');
                    isValid = false;
                    errorMessages.push('La contraseña debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y símbolos');
                }
            }

            // Validación de teléfono: sólo comprobar que exista valor (el input visible bloquea caracteres no numéricos)
            const telefonoField = document.getElementById('telefono');
            if (telefonoField && !telefonoField.value.trim()) {
                // marcar error en el campo visible (phone-small) si existe
                if (phoneSmall) phoneSmall.classList.add('error');
                if (phoneCode) phoneCode.classList.add('error');
                isValid = false;
                errorMessages.push('El teléfono es requerido');
                if (formBottomMessage) formBottomMessage.textContent = 'El teléfono es requerido';
            }

            // Validación de cédula
            const cedulaField = document.getElementById('cedula');
            if (cedulaField && cedulaField.value) {
                const cedulaRegex = /^\d{7,10}$/;
                if (!cedulaRegex.test(cedulaField.value)) {
                    cedulaField.classList.add('error');
                    isValid = false;
                    errorMessages.push('La cédula debe tener entre 7 y 10 dígitos');
                }
            }

            // Validación de fecha de nacimiento
            const fechaField = document.getElementById('fecha_nacimiento');
            if (fechaField && fechaField.value) {
                const fechaNacimiento = new Date(fechaField.value);
                const hoy = new Date();
                const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
                
                if (edad < 13) {
                    fechaField.classList.add('error');
                    isValid = false;
                    errorMessages.push('Debes tener al menos 13 años para registrarte');
                }
            }

            if (isValid) {
                // Mostrar datos del formulario
                const formData = new FormData(form);
                const userData = {};
                for (let [key, value] of formData.entries()) {
                    userData[key] = value;
                }
                
                console.log('Datos del usuario:', userData);
                alert('¡Registro exitoso! Revisa la consola para ver los datos.');
                
                // Aquí podrías enviar los datos al servidor
                // sendDataToServer(userData);
                
            } else {
                alert('Por favor corrige los siguientes errores:\n\n' + errorMessages.join('\n'));
            }
        });
    }

    // Limpiar errores al escribir
    const inputs = document.querySelectorAll('.input-field');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('error');
        });
    });

    // Funcionalidad del botón cancelar
    const cancelButton = document.querySelector('.btn-cancel');
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            if (confirm('¿Estás seguro de que quieres cancelar el registro?')) {
                form.reset();
                // Remover todas las clases de error
                inputs.forEach(input => input.classList.remove('error'));
            }
        });
    }
});

// Validación de contraseña fuerte en tiempo real
function validatePasswordField(field) {
    const password = field.value;
    
    if (password === '') {
        clearFieldError(field);
        return false;
    }

    let errors = [];
    
    // Verificar longitud mínima
    if (password.length < 8) {
        errors.push('Mínimo 8 caracteres');
    }
    
    // Verificar mayúscula
    if (!/[A-Z]/.test(password)) {
        errors.push('Una letra mayúscula');
    }
    
    // Verificar minúscula
    if (!/[a-z]/.test(password)) {
        errors.push('Una letra minúscula');
    }
    
    // Verificar número
    if (!/\d/.test(password)) {
        errors.push('Un número');
    }
    
    // Verificar carácter especial
    if (!/[^a-zA-Z\d\s]/.test(password)) {
        errors.push('Un carácter especial');
    }

    if (errors.length > 0) {
        showFieldError(field, 'Faltan: ' + errors.join(', '));
        return false;
    } else {
        clearFieldError(field);
        return true;
    }
}

// Validación de mayoría de edad
function validateAge(field) {
    const fechaNacimiento = new Date(field.value);
    const hoy = new Date();
    
    if (isNaN(fechaNacimiento.getTime())) {
        clearFieldError(field);
        return false;
    }
    
    const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mesActual = hoy.getMonth();
    const mesNacimiento = fechaNacimiento.getMonth();
    
    // Ajustar edad si aún no ha cumplido años
    let edadReal = edad;
    if (mesActual < mesNacimiento || (mesActual === mesNacimiento && hoy.getDate() < fechaNacimiento.getDate())) {
        edadReal = edad - 1;
    }
    
    if (edadReal < 18) {
        showFieldError(field, 'Debes ser mayor de edad (18 años) para registrarte');
        return false;
    } else {
        clearFieldError(field);
        return true;
    }
}

// Validación general de campos
function validateField(field) {
    const fieldName = field.id;
    const value = field.value.trim();
    
    // Validar campo vacío
    if (value === '') {
        clearFieldError(field);
        return false;
    }
    
    // Validaciones específicas por campo
    switch (fieldName) {
        case 'usuario':
            if (value.length < 3) {
                showFieldError(field, 'El usuario debe tener al menos 3 caracteres');
                return false;
            }
            break;
            
        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                showFieldError(field, 'El formato del email no es válido');
                return false;
            }
            break;
            
        // El campo de teléfono ahora usa un input visible 'phone-small' y un hidden 'telefono'.
        // Dado que el input visible bloquea cualquier carácter no numérico, no necesitamos validar formato aquí.
            
        case 'cedula':
            const cedulaRegex = /^\d{7,10}$/;
            if (!cedulaRegex.test(value)) {
                showFieldError(field, 'La cédula debe tener entre 7 y 10 dígitos');
                return false;
            }
            break;
            
        case 'nombre':
        case 'apellido':
            if (value.length < 2) {
                showFieldError(field, 'Debe tener al menos 2 caracteres');
                return false;
            }
            break;
            
        case 'direccion':
            if (value.length < 10) {
                showFieldError(field, 'La dirección debe tener al menos 10 caracteres');
                return false;
            }
            break;
    }
    
    clearFieldError(field);
    return true;
}

// Mostrar error en campo
function showFieldError(field, message) {
    field.classList.add('error');
    
    // Para el campo de contraseña, buscar en el contenedor padre del password-container
    let container = field.parentElement;
    if (container.classList.contains('password-container')) {
        container = container.parentElement; // Ir al input-group
    }
    
    // Remover mensaje de error existente
    let existingError = container.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Crear nuevo mensaje de error
    const errorMessage = document.createElement('div');
    errorMessage.classList.add('error-message');
    errorMessage.textContent = message;
    
    // Insertar después del contenedor del input
    container.appendChild(errorMessage);
}

// Limpiar error de campo
function clearFieldError(field) {
    field.classList.remove('error');
    
    // Para el campo de contraseña, buscar en el contenedor padre del password-container
    let container = field.parentElement;
    if (container.classList.contains('password-container')) {
        container = container.parentElement; // Ir al input-group
    }
    
    // Remover mensaje de error
    let existingError = container.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
}

// Verificar validez del formulario completo
function checkFormValidity() {
    const requiredFields = [
        'usuario', 'password', 'nombre', 'apellido', 
        'email', 'telefono', 'fecha_nacimiento', 'cedula', 'direccion'
    ];
    
    let isValid = true;
    
    requiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (!field || field.value.trim() === '') {
            isValid = false;
            return;
        }
        
        // Validaciones específicas
        if (fieldName === 'password') {
            if (!validatePasswordField(field)) {
                isValid = false;
            }
        } else if (fieldName === 'fecha_nacimiento') {
            if (!validateAge(field)) {
                isValid = false;
            }
        } else {
            if (!validateField(field)) {
                isValid = false;
            }
        }
    });
    
    // Habilitar/deshabilitar botón de registro
    const registerButton = document.querySelector('.btn-save');
    if (registerButton) {
        registerButton.disabled = !isValid;
        registerButton.style.opacity = isValid ? '1' : '0.5';
        registerButton.style.cursor = isValid ? 'pointer' : 'not-allowed';
    }
    
    return isValid;
}

// Función auxiliar para obtener etiquetas de campos
function getFieldLabel(fieldName) {
    const labels = {
        'usuario': 'Usuario',
        'password': 'Contraseña',
        'nombre': 'Nombre',
        'apellido': 'Apellido',
        'email': 'Correo electrónico',
        'telefono': 'Teléfono',
        'fecha_nacimiento': 'Fecha de nacimiento',
        'cedula': 'Cédula',
        'direccion': 'Dirección'
    };
    return labels[fieldName] || fieldName;
}

// Función para enviar datos al servidor (placeholder)
function sendDataToServer(userData) {
    // Aquí implementarías la lógica para enviar datos al backend
    console.log('Enviando datos al servidor:', userData);
    
    // Ejemplo de implementación con fetch
    /*
    fetch('/api/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Respuesta del servidor:', data);
        // Manejar respuesta exitosa
    })
    .catch(error => {
        console.error('Error:', error);
        // Manejar error
    });
    */
}
