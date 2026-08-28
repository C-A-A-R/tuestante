import { requestPasswordReset } from "./password-reset.api.js";

const screenEmail = document.getElementById("screen-email");
const screenSent  = document.getElementById("screen-sent");
const form        = document.getElementById("recoveryForm");
const correoInput = document.getElementById("correo");
const correoError = document.getElementById("correoError");
const submitBtn   = document.getElementById("submit-btn");
const correoEnviado = document.getElementById("correo-enviado");

/* ---------- helpers ---------- */
function showError(input, errorEl, message) {
    errorEl.textContent = message || "";
    if (message) {
        errorEl.classList.add("show");
        input.closest(".form-group")?.classList.add("error");
    } else {
        errorEl.classList.remove("show");
        input.closest(".form-group")?.classList.remove("error");
    }
    input.setAttribute("aria-invalid", message ? "true" : "false");
}

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    const btnText = submitBtn.querySelector(".btn-text");
    const spinner = submitBtn.querySelector(".btn-spinner");
    if (btnText) btnText.textContent = isLoading ? "Enviando Enlace..." : "Enviar Enlace";
    if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
}

function showScreen(screenEl) {
    if (screenEmail) screenEmail.style.display = "none";
    if (screenSent) screenSent.style.display = "none";
    if (screenEl) screenEl.style.display = "block";
}

/* ---------- validación ---------- */
function validateEmail(value) {
    if (!value.trim()) return "El correo electrónico es obligatorio.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
        return "Ingresa un correo electrónico válido.";
    return "";
}

/* ---------- eventos ---------- */
correoInput.addEventListener("input", () => showError(correoInput, correoError, ""));

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const correo = correoInput.value.trim();
    const err = validateEmail(correo);
    if (err) {
        showError(correoInput, correoError, err);
        return;
    }

    setLoading(true);
    try {
        await requestPasswordReset(correo);
    } catch (_) {
        // Por seguridad, mostramos la pantalla de "correo enviado" incluso si el correo no existe
    } finally {
        setLoading(false);
    }

    correoEnviado.textContent = correo;
    showScreen(screenSent);
});

/* ---------- init ---------- */
showScreen(screenEmail);
