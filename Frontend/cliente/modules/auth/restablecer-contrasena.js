/**
 * ==========================================================================
 * LÓGICA DE RESTABLECIMIENTO DE CONTRASEÑA - TUESTANTE
 * Valida uidb64 y token de la URL, aplica reglas de contraseña segura
 * y envía la nueva clave al backend (/api/user/password/reset/confirm/).
 * ==========================================================================
 */

import { confirmPasswordReset } from "./password-reset.api.js";

/* ---------- Leer uid y token de la URL ---------- */
const params  = new URLSearchParams(window.location.search);
const uid     = params.get("uid") || params.get("uidb64");
const token   = params.get("token");

/* ---------- Elementos del DOM ---------- */
const screenInvalid = document.getElementById("screen-invalid");
const screenForm    = document.getElementById("screen-form");
const screenSuccess = document.getElementById("screen-success");
const form          = document.getElementById("resetForm");
const nuevaInput    = document.getElementById("nueva_contrasena");
const confirmarInput= document.getElementById("confirmar_contrasena");
const nuevaError    = document.getElementById("nuevaError");
const confirmarError= document.getElementById("confirmarError");
const submitBtn     = document.getElementById("submit-btn");
const toggleNueva   = document.getElementById("toggleNueva");
const toggleConfirmar = document.getElementById("toggleConfirmar");

/* ---------- Helpers de Pantallas y Errores ---------- */
function showScreen(screenEl) {
    [screenInvalid, screenForm, screenSuccess].forEach(s => {
        if (s) s.style.display = "none";
    });
    if (screenEl) screenEl.style.display = "block";
}

function showError(input, errorEl, message) {
    if (errorEl) {
        errorEl.textContent = message || "";
        if (message) {
            errorEl.classList.add("show");
        } else {
            errorEl.classList.remove("show");
        }
    }
    const formGroup = input.closest(".form-group");
    if (formGroup) {
        if (message) {
            formGroup.classList.add("error");
        } else {
            formGroup.classList.remove("error");
        }
    }
    input.setAttribute("aria-invalid", message ? "true" : "false");
}

function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    const btnText = submitBtn.querySelector(".btn-text");
    const spinner = submitBtn.querySelector(".btn-spinner");
    if (btnText) btnText.textContent = isLoading ? "Guardando Contraseña..." : "Guardar Contraseña";
    if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
}

function setupToggle(btn, input) {
    if (!btn || !input) return;
    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');

    btn.addEventListener("click", () => {
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        if (eyeOpen && eyeClosed) {
            eyeOpen.style.display = isPassword ? "none" : "block";
            eyeClosed.style.display = isPassword ? "block" : "none";
        }
    });
}

/* ---------- Validaciones ---------- */
function validatePassword(value) {
    if (!value) return "La contraseña es obligatoria.";
    if (value.length < 8) {
        return "La contraseña debe tener al menos 8 caracteres.";
    }
    return "";
}

function getBackendMessage(error) {
    const data = error?.data;
    if (!data) return error?.message || "Ocurrió un error. Inténtalo de nuevo.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
    const first = Object.values(data).find(Boolean);
    return Array.isArray(first) ? first[0] : (first || "Ocurrió un error.");
}

/* ---------- Inicialización ---------- */
if (!uid || !token) {
    showScreen(screenInvalid);
} else {
    showScreen(screenForm);
}

setupToggle(toggleNueva, nuevaInput);
setupToggle(toggleConfirmar, confirmarInput);

[nuevaInput, confirmarInput].forEach(inp => {
    if (!inp) return;
    inp.addEventListener("input", () => {
        showError(inp, inp === nuevaInput ? nuevaError : confirmarError, "");
    });
});

/* ---------- Envío del Formulario ---------- */
form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nueva     = nuevaInput.value;
    const confirmar = confirmarInput.value;
    let hasError    = false;

    const errNueva = validatePassword(nueva);
    if (errNueva) {
        showError(nuevaInput, nuevaError, errNueva);
        hasError = true;
    }

    if (!confirmar) {
        showError(confirmarInput, confirmarError, "Debes confirmar la contraseña.");
        hasError = true;
    } else if (nueva !== confirmar) {
        showError(confirmarInput, confirmarError, "Las contraseñas no coinciden.");
        hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    try {
        await confirmPasswordReset(uid, token, nueva, confirmar);
        showScreen(screenSuccess);
    } catch (error) {
        const msg = getBackendMessage(error);
        if (
            msg.toLowerCase().includes("enlace") ||
            msg.toLowerCase().includes("expirado") ||
            msg.toLowerCase().includes("token") ||
            msg.toLowerCase().includes("inválido")
        ) {
            showScreen(screenInvalid);
        } else {
            showError(nuevaInput, nuevaError, msg);
        }
    } finally {
        setLoading(false);
    }
});
