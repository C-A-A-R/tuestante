/**
 * ==========================================================================
 * LÓGICA DE CULMINACIÓN DE REGISTRO - TUESTANTE
 * Pantalla intermedia tras el registro con Google para recolectar
 * cédula, teléfono (solo números y +) y fecha de nacimiento obligatoria.
 * ==========================================================================
 */

import { completeUserProfile, getCurrentUserProfile } from "./auth.js";
import { getAccessToken, getCurrentUser, setCurrentUser } from "../../js/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verificar si hay sesión activa; si no, volver a login
    if (!getAccessToken()) {
        const redirectParam = new URLSearchParams(window.location.search).get("redirect");
        const loginUrl = redirectParam
            ? `login.html?redirect=${encodeURIComponent(redirectParam)}`
            : "login.html";
        window.location.href = loginUrl;
        return;
    }

    // 2. Establecer fecha máxima permitida para nacimiento (hoy)
    setupBirthDateConstraints();

    // 3. Configurar validación estricta de teléfono (+ y números) y cédula (números)
    setupStrictInputs();

    // 4. Cargar y precargar datos del usuario
    await loadAndPrepopulateUserData();

    // 5. Configurar envío del formulario
    const form = document.getElementById("completeProfileForm");
    if (form) {
        form.addEventListener("submit", handleCompleteProfileSubmit);
    }
});

/**
 * Restringe la fecha de nacimiento a no ser una fecha futura.
 */
function setupBirthDateConstraints() {
    const birthDateInput = document.getElementById("birth_date");
    if (birthDateInput) {
        const today = new Date().toISOString().split("T")[0];
        birthDateInput.setAttribute("max", today);
    }
}

/**
 * Validación estricta en tiempo real:
 * - Teléfono: Solo permite números y el signo '+' (bloquea letras y caracteres especiales).
 * - Cédula: Solo permite números.
 */
function setupStrictInputs() {
    const phoneInput = document.getElementById("phone");
    if (phoneInput) {
        // Bloquear en keydown cualquier tecla que no sea dígito, '+', o teclas de control
        phoneInput.addEventListener("keydown", (e) => {
            const allowedControlKeys = [
                "Backspace", "Tab", "Enter", "Delete", "ArrowLeft", "ArrowRight",
                "ArrowUp", "ArrowDown", "Home", "End"
            ];
            if (allowedControlKeys.includes(e.key)) return;
            if (e.ctrlKey || e.metaKey) return;
            if (e.key === "+" && !phoneInput.value.includes("+")) return;
            if (/^[0-9]$/.test(e.key)) return;

            e.preventDefault();
        });

        // Sanitizar en evento input ante cualquier caso (ej. autocompletado del navegador)
        phoneInput.addEventListener("input", () => {
            let val = phoneInput.value;
            val = val.replace(/[^0-9+]/g, "");

            if (val.indexOf("+") > 0) {
                const hasPlusAtStart = val.startsWith("+");
                val = (hasPlusAtStart ? "+" : "") + val.replace(/\+/g, "");
            } else if ((val.match(/\+/g) || []).length > 1) {
                val = "+" + val.replace(/\+/g, "");
            }

            phoneInput.value = val;
            clearFieldError("phone");
        });

        // Filtrar pegado desde portapapeles
        phoneInput.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData("text");
            let sanitized = pasteData.replace(/[^0-9+]/g, "");
            if (sanitized.indexOf("+") > 0) {
                sanitized = (sanitized.startsWith("+") ? "+" : "") + sanitized.replace(/\+/g, "");
            }
            phoneInput.value = sanitized;
            clearFieldError("phone");
        });
    }

    const identityInput = document.getElementById("identity_document");
    if (identityInput) {
        identityInput.addEventListener("keydown", (e) => {
            const allowedControlKeys = [
                "Backspace", "Tab", "Enter", "Delete", "ArrowLeft", "ArrowRight",
                "ArrowUp", "ArrowDown", "Home", "End"
            ];
            if (allowedControlKeys.includes(e.key)) return;
            if (e.ctrlKey || e.metaKey) return;
            if (/^[0-9]$/.test(e.key)) return;
            e.preventDefault();
        });

        identityInput.addEventListener("input", () => {
            identityInput.value = identityInput.value.replace(/[^0-9]/g, "");
            clearFieldError("identity_document");
        });

        identityInput.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData("text");
            identityInput.value = pasteData.replace(/[^0-9]/g, "");
            clearFieldError("identity_document");
        });
    }

    // Limpiar errores en inputs de texto estándar
    ["first_name", "first_last_name", "birth_date"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", () => clearFieldError(id));
            el.addEventListener("change", () => clearFieldError(id));
        }
    });
}

/**
 * Carga los datos del usuario en sesión o consulta al backend y precarga el formulario.
 */
async function loadAndPrepopulateUserData() {
    let user = getCurrentUser();

    try {
        const freshUser = await getCurrentUserProfile();
        if (freshUser && typeof freshUser === "object") {
            user = freshUser;
            setCurrentUser(freshUser);
        }
    } catch (err) {
        console.warn("No se pudo refrescar perfil del backend, usando datos locales:", err);
    }

    if (!user) return;

    // Actualizar encabezado / tarjeta resumen de Google
    const nameEl = document.getElementById("summaryUserName");
    const emailEl = document.getElementById("summaryUserEmail");
    const avatarImg = document.getElementById("summaryAvatarImg");
    const avatarInitials = document.getElementById("summaryAvatarInitials");

    const fullName = user.full_name || `${user.first_name || ''} ${user.first_last_name || ''}`.trim() || user.username || "Usuario";
    if (nameEl) nameEl.textContent = fullName;
    if (emailEl) emailEl.textContent = user.email || "";

    if (user.avatar_url && avatarImg && avatarInitials) {
        avatarImg.src = user.avatar_url;
        avatarImg.style.display = "block";
        avatarInitials.style.display = "none";
    } else if (avatarInitials) {
        const initial = (user.first_name?.[0] || user.username?.[0] || "U").toUpperCase();
        avatarInitials.textContent = initial;
    }

    // Precargar campos editables en el formulario
    setInputValue("first_name", user.first_name);
    setInputValue("second_name", user.second_name);
    setInputValue("first_last_name", user.first_last_name);
    setInputValue("second_last_name", user.second_last_name);
    setInputValue("identity_document", user.identity_document);
    setInputValue("phone", user.phone);
    setInputValue("birth_date", user.birth_date);
    setInputValue("city", user.city);

    if (user.document_type) {
        const docTypeSelect = document.getElementById("document_type");
        if (docTypeSelect) {
            docTypeSelect.value = user.document_type;
        }
    }
}

function setInputValue(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) {
        el.value = val;
    }
}

/**
 * Valida y procesa el envío del formulario de culminación de registro.
 */
async function handleCompleteProfileSubmit(e) {
    e.preventDefault();
    hideNotifications();

    const form = e.target;
    let isValid = true;

    const documentType = document.getElementById("document_type")?.value || "V";
    const identityDoc = document.getElementById("identity_document")?.value.trim();
    const phone = document.getElementById("phone")?.value.trim();
    const birthDate = document.getElementById("birth_date")?.value;
    const firstName = document.getElementById("first_name")?.value.trim();
    const secondName = document.getElementById("second_name")?.value.trim() || "";
    const firstLastName = document.getElementById("first_last_name")?.value.trim();
    const secondLastName = document.getElementById("second_last_name")?.value.trim() || "";
    const city = document.getElementById("city")?.value.trim() || "";
    const address = document.getElementById("address")?.value.trim() || "";

    // Validación de Cédula (Obligatoria, al menos 5 dígitos)
    if (!identityDoc) {
        setFieldError("identity_document", "El documento de identidad es obligatorio.");
        isValid = false;
    } else if (identityDoc.length < 5) {
        setFieldError("identity_document", "Ingresa un número de documento válido (mínimo 5 dígitos).");
        isValid = false;
    }

    // Validación de Teléfono (Obligatorio, solo números y +, mín 7 caracteres)
    if (!phone) {
        setFieldError("phone", "El teléfono principal es obligatorio.");
        isValid = false;
    } else if (!/^\+?[0-9]{7,18}$/.test(phone)) {
        setFieldError("phone", "El teléfono solo debe contener números y opcionalmente el signo + (ej. +584121234567 o 04121234567).");
        isValid = false;
    }

    // Validación de Fecha de Nacimiento (OBLIGATORIA)
    if (!birthDate) {
        setFieldError("birth_date", "La fecha de nacimiento es obligatoria.");
        isValid = false;
    } else {
        const selectedDate = new Date(birthDate);
        const today = new Date();
        if (selectedDate > today) {
            setFieldError("birth_date", "La fecha de nacimiento no puede ser futura.");
            isValid = false;
        }
    }

    // Validación de Primer Nombre
    if (!firstName) {
        setFieldError("first_name", "El primer nombre es obligatorio.");
        isValid = false;
    }

    // Validación de Primer Apellido
    if (!firstLastName) {
        setFieldError("first_last_name", "El primer apellido es obligatorio.");
        isValid = false;
    }

    if (!isValid) {
        showErrorNotification("Por favor completa los campos obligatorios señalados en rojo.");
        return;
    }

    setLoadingState(form, true);

    const payload = {
        document_type: documentType,
        identity_document: identityDoc,
        phone: phone,
        birth_date: birthDate,
        first_name: firstName,
        second_name: secondName,
        first_last_name: firstLastName,
        second_last_name: secondLastName,
        city: city,
        address: address,
    };

    try {
        const result = await completeUserProfile(payload);

        showSuccessNotification("¡Excelente! Tus datos han sido guardados. Redirigiendo...");

        // Redirigir al inicio o a la ruta que estaba visitando
        setTimeout(() => {
            const redirectParam = new URLSearchParams(window.location.search).get("redirect");
            window.location.href = redirectParam || "../../index.html";
        }, 1200);

    } catch (err) {
        setLoadingState(form, false);
        console.error("Error al completar el perfil:", err);

        const data = err?.data;
        let mainMessage = err?.message || "Ocurrió un error al actualizar tus datos. Verifica la información ingresada.";

        if (data && typeof data === "object") {
            Object.keys(data).forEach((key) => {
                const msg = Array.isArray(data[key]) ? data[key][0] : data[key];
                if (key === "identity_document") setFieldError("identity_document", msg);
                else if (key === "phone") setFieldError("phone", msg);
                else if (key === "birth_date") setFieldError("birth_date", msg);
                else if (key === "first_name") setFieldError("first_name", msg);
                else if (key === "first_last_name") setFieldError("first_last_name", msg);
                else if (key === "document_type") setFieldError("identity_document", msg);
            });

            if (data.detail) mainMessage = data.detail;
            else if (data.error) mainMessage = data.error;
        }

        showErrorNotification(mainMessage);
    }
}

function setFieldError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    const inputEl = document.getElementById(fieldId);
    const formGroup = inputEl?.closest(".form-group");

    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add("show");
    }
    if (formGroup) {
        formGroup.classList.add("error");
    }
    if (inputEl) {
        inputEl.setAttribute("aria-invalid", "true");
    }
}

function clearFieldError(fieldId) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    const inputEl = document.getElementById(fieldId);
    const formGroup = inputEl?.closest(".form-group");

    if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.remove("show");
    }
    if (formGroup) {
        formGroup.classList.remove("error");
    }
    if (inputEl) {
        inputEl.removeAttribute("aria-invalid");
    }
}

function showErrorNotification(msg) {
    const notif = document.getElementById("authErrorNotification");
    const text = document.getElementById("authErrorText");
    if (notif && text) {
        text.textContent = msg;
        notif.style.display = "flex";
        notif.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function showSuccessNotification(msg) {
    const notif = document.getElementById("authSuccessNotification");
    const text = document.getElementById("authSuccessText");
    if (notif && text) {
        text.textContent = msg;
        notif.style.display = "flex";
        notif.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function hideNotifications() {
    const err = document.getElementById("authErrorNotification");
    const succ = document.getElementById("authSuccessNotification");
    if (err) err.style.display = "none";
    if (succ) succ.style.display = "none";
}

function setLoadingState(form, isLoading) {
    const btn = document.getElementById("completeSubmitBtn");
    if (!btn) return;

    btn.disabled = isLoading;
    const btnText = btn.querySelector(".btn-text");
    const spinner = btn.querySelector(".btn-spinner");

    if (btnText) btnText.style.display = isLoading ? "none" : "inline";
    if (spinner) spinner.style.display = isLoading ? "inline-flex" : "none";
}
