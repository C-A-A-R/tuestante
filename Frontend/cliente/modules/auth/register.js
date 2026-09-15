/**
 * ==========================================================================
 * LÓGICA DE REGISTRO DE USUARIO - TUESTANTE
 * Conexión a la API (/api/user/register/), validaciones en tiempo real,
 * formateo de teléfono y cédula, verificación de contraseña y manejo de errores.
 * ==========================================================================
 */

import { registerUser } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    if (!form) return;

    setupPasswordToggles();
    setupLivePasswordValidation();
    setupNumericInputs();
    setupFormSubmission(form);
});

/**
 * Alternar visibilidad de contraseña
 */
function setupPasswordToggles() {
    const pairs = [
        { btnId: "passwordToggle", inputId: "password" },
        { btnId: "confirmPasswordToggle", inputId: "confirm_password" }
    ];

    pairs.forEach(({ btnId, inputId }) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;

        const eyeOpen = btn.querySelector(".eye-open");
        const eyeClosed = btn.querySelector(".eye-closed");

        btn.addEventListener("click", () => {
            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";

            if (eyeOpen) eyeOpen.style.display = isPassword ? "none" : "block";
            if (eyeClosed) eyeClosed.style.display = isPassword ? "block" : "none";
        });
    });
}

/**
 * Validaciones en vivo para la contraseña
 */
function setupLivePasswordValidation() {
    const passwordInput = document.getElementById("password");
    const confirmInput = document.getElementById("confirm_password");
    const ruleLen = document.getElementById("rule-len");
    const ruleUpper = document.getElementById("rule-upper");
    const ruleMatch = document.getElementById("rule-match");

    function evaluateRules() {
        const val = passwordInput?.value || "";
        const confirmVal = confirmInput?.value || "";

        // Regla 1: Longitud >= 6
        if (ruleLen) {
            const hasLen = val.length >= 6;
            ruleLen.classList.toggle("valid", hasLen);
            ruleLen.querySelector(".rule-bullet").textContent = hasLen ? "✓" : "•";
        }

        // Regla 2: Mayúscula
        if (ruleUpper) {
            const hasUpper = /[A-Z]/.test(val);
            ruleUpper.classList.toggle("valid", hasUpper);
            ruleUpper.querySelector(".rule-bullet").textContent = hasUpper ? "✓" : "•";
        }

        // Regla 3: Coincidencia
        if (ruleMatch) {
            const matches = val.length > 0 && val === confirmVal;
            ruleMatch.classList.toggle("valid", matches);
            ruleMatch.querySelector(".rule-bullet").textContent = matches ? "✓" : "•";
        }
    }

    if (passwordInput) passwordInput.addEventListener("input", evaluateRules);
    if (confirmInput) confirmInput.addEventListener("input", evaluateRules);
}

/**
 * Restringir a sólo dígitos campos numéricos (cédula y teléfono)
 */
function setupNumericInputs() {
    const numericIds = ["identity_document", "phone_number"];

    numericIds.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        input.addEventListener("input", function () {
            this.value = this.value.replace(/\D/g, "");
            clearFieldError(this);
        });
    });
}

/**
 * Envío y procesamiento del formulario
 */
function setupFormSubmission(form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Ocultar notificaciones previas
        hideNotifications();

        // Obtener campos
        const usuarioInput = document.getElementById("usuario");
        const emailInput = document.getElementById("email");
        const firstNameInput = document.getElementById("first_name");
        const secondNameInput = document.getElementById("second_name");
        const firstLastNameInput = document.getElementById("first_last_name");
        const secondLastNameInput = document.getElementById("second_last_name");
        const documentTypeSelect = document.getElementById("document_type");
        const identityDocInput = document.getElementById("identity_document");
        const phoneCodeSelect = document.getElementById("phone_code");
        const phoneNumberInput = document.getElementById("phone_number");
        const birthDateInput = document.getElementById("birth_date");
        const cityInput = document.getElementById("city");
        const passwordInput = document.getElementById("password");
        const confirmPasswordInput = document.getElementById("confirm_password");

        // Limpiar errores previos
        form.querySelectorAll(".form-input").forEach(clearFieldError);

        let hasError = false;

        // 1. Validar Usuario
        const usuario = (usuarioInput?.value || "").trim();
        if (!usuario) {
            setFieldError(usuarioInput, "El nombre de usuario es obligatorio.");
            hasError = true;
        } else if (usuario.length < 3) {
            setFieldError(usuarioInput, "El usuario debe tener al menos 3 caracteres.");
            hasError = true;
        }

        // 2. Validar Correo
        const email = (emailInput?.value || "").trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            setFieldError(emailInput, "El correo electrónico es obligatorio.");
            hasError = true;
        } else if (!emailRegex.test(email)) {
            setFieldError(emailInput, "Ingresa un correo electrónico válido.");
            hasError = true;
        }

        // 3. Validar Nombres y Apellidos
        const firstName = (firstNameInput?.value || "").trim();
        if (!firstName) {
            setFieldError(firstNameInput, "El primer nombre es obligatorio.");
            hasError = true;
        }

        const firstLastName = (firstLastNameInput?.value || "").trim();
        if (!firstLastName) {
            setFieldError(firstLastNameInput, "El primer apellido es obligatorio.");
            hasError = true;
        }

        // 4. Validar Documento de Identidad
        const identityDoc = (identityDocInput?.value || "").trim();
        if (!identityDoc) {
            setFieldError(identityDocInput, "El número de documento es obligatorio.");
            hasError = true;
        } else if (identityDoc.length < 5 || identityDoc.length > 12) {
            setFieldError(identityDocInput, "Ingresa un número de documento válido.");
            hasError = true;
        }

        // 5. Validar Teléfono
        const phoneNumber = (phoneNumberInput?.value || "").trim();
        if (!phoneNumber) {
            setFieldError(phoneNumberInput, "El número de teléfono es obligatorio.");
            hasError = true;
        } else if (phoneNumber.length !== 7) {
            setFieldError(phoneNumberInput, "El número debe tener exactamente 7 dígitos.");
            hasError = true;
        }

        // 6. Validar Contraseña
        const password = passwordInput?.value || "";
        const confirmPassword = confirmPasswordInput?.value || "";

        if (!password) {
            setFieldError(passwordInput, "La contraseña es obligatoria.");
            hasError = true;
        } else if (password.length < 6) {
            setFieldError(passwordInput, "La contraseña debe tener al menos 6 caracteres.");
            hasError = true;
        } else if (!/[A-Z]/.test(password)) {
            setFieldError(passwordInput, "La contraseña debe contener al menos una mayúscula.");
            hasError = true;
        }

        if (password !== confirmPassword) {
            setFieldError(confirmPasswordInput, "Las contraseñas no coinciden.");
            hasError = true;
        }

        if (hasError) return;

        // Construcción del payload
        const docType = documentTypeSelect?.value || "V";
        const phoneCode = phoneCodeSelect?.value || "0412";
        const formattedPhone = `${phoneCode}${phoneNumber}`;
        const formattedDoc = `${docType}-${identityDoc}`;

        const payload = {
            username: usuario,
            email: email,
            first_name: firstName,
            second_name: (secondNameInput?.value || "").trim() || undefined,
            first_last_name: firstLastName,
            second_last_name: (secondLastNameInput?.value || "").trim() || undefined,
            document_type: docType,
            identity_document: formattedDoc,
            phone: formattedPhone,
            birth_date: birthDateInput?.value || undefined,
            city: (cityInput?.value || "").trim() || undefined,
            password: password,
            confirm_password: confirmPassword,
            is_registered: true
        };

        // Estado de carga
        setLoadingState(form, true);

        try {
            const response = await registerUser(payload);

            showSuccessNotification("¡Cuenta creada exitosamente! Redirigiendo al inicio de sesión...");

            setTimeout(() => {
                window.location.href = "login.html";
            }, 1800);

        } catch (err) {
            console.error("[Register Error]", err);
            const errMsg = getBackendErrorMessage(err);
            showErrorNotification(errMsg);

            // Mapear errores de campos específicos devueltos por el backend
            mapBackendFieldErrors(err?.data);
        } finally {
            setLoadingState(form, false);
        }
    });
}

function setFieldError(field, message) {
    if (!field) return;
    const errorElement = document.getElementById(`${field.id}Error`);
    const formGroup = field.closest(".form-group");

    if (errorElement) {
        errorElement.textContent = message || "";
        errorElement.classList.toggle("show", Boolean(message));
    }

    if (formGroup) {
        formGroup.classList.toggle("error", Boolean(message));
    }

    field.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearFieldError(field) {
    setFieldError(field, "");
}

function showErrorNotification(message) {
    const notif = document.getElementById("authErrorNotification");
    const text = document.getElementById("authErrorText");
    if (notif && text) {
        text.textContent = message;
        notif.style.display = "flex";
        notif.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function showSuccessNotification(message) {
    const notif = document.getElementById("authSuccessNotification");
    const text = document.getElementById("authSuccessText");
    if (notif && text) {
        text.textContent = message;
        notif.style.display = "flex";
        notif.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function hideNotifications() {
    const errNotif = document.getElementById("authErrorNotification");
    const succNotif = document.getElementById("authSuccessNotification");
    if (errNotif) errNotif.style.display = "none";
    if (succNotif) succNotif.style.display = "none";
}

function setLoadingState(form, isLoading) {
    const btn = form.querySelector("#registerSubmitBtn");
    if (!btn) return;

    btn.disabled = isLoading;
    const btnText = btn.querySelector(".btn-text");
    const spinner = btn.querySelector(".btn-spinner");

    if (btnText) btnText.style.display = isLoading ? "none" : "inline";
    if (spinner) spinner.style.display = isLoading ? "inline-flex" : "none";
}

function getBackendErrorMessage(error) {
    const data = error?.data;
    if (!data) {
        return error?.message || "No se pudo procesar el registro. Intenta nuevamente.";
    }

    if (typeof data === "string") return data;

    if (data.detail) return data.detail;
    if (data.error) return data.error;
    if (data.message && typeof data.message === "string") return data.message;

    // Buscar primer error en campos
    for (const key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val) && val.length > 0) {
            return `${key}: ${val[0]}`;
        }
        if (typeof val === "string") {
            return `${key}: ${val}`;
        }
    }

    return "Verifica los datos del formulario.";
}

function mapBackendFieldErrors(data) {
    if (!data || typeof data !== "object") return;

    const fieldMap = {
        username: "usuario",
        email: "email",
        first_name: "first_name",
        first_last_name: "first_last_name",
        identity_document: "identity_document",
        phone: "phone_number",
        password: "password",
        confirm_password: "confirm_password"
    };

    Object.entries(data).forEach(([backendKey, errVal]) => {
        const inputId = fieldMap[backendKey];
        if (inputId) {
            const input = document.getElementById(inputId);
            const msg = Array.isArray(errVal) ? errVal[0] : String(errVal);
            if (input) setFieldError(input, msg);
        }
    });
}
