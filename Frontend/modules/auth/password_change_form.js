import { requestPasswordReset } from "./password-reset.api.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("password-reset-request-form");
    const emailInput = document.getElementById("email");
    const submitButton = document.getElementById("passwordResetSubmitBtn");
    if (!form || !emailInput) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearFieldError(emailInput);
        hideError();

        const email = emailInput.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFieldError(emailInput, "Ingresa un correo electrónico válido.");
            return;
        }

        setLoading(true);
        try {
            await requestPasswordReset(email);
            window.location.href = "password_change_message.html";
        } catch (error) {
            showError(getBackendErrorMessage(error));
        } finally {
            setLoading(false);
        }
    });

    emailInput.addEventListener("input", () => {
        clearFieldError(emailInput);
        hideError();
    });

    function setLoading(isLoading) {
        submitButton.disabled = isLoading;
        submitButton.querySelector(".btn-text").style.display = isLoading ? "none" : "inline";
        submitButton.querySelector(".btn-spinner").style.display = isLoading ? "inline" : "none";
    }
});

function setFieldError(field, message) {
    const error = document.getElementById(`${field.id}Error`);
    error.textContent = message;
    error.classList.add("show");
    field.closest(".form-group")?.classList.add("error");
}

function clearFieldError(field) {
    const error = document.getElementById(`${field.id}Error`);
    error.textContent = "";
    error.classList.remove("show");
    field.closest(".form-group")?.classList.remove("error");
}

function showError(message) {
    document.getElementById("authErrorText").textContent = message;
    document.getElementById("authErrorNotification").style.display = "flex";
}

function hideError() {
    document.getElementById("authErrorNotification").style.display = "none";
}

function getBackendErrorMessage(error) {
    const data = error?.data;
    if (!data) return error?.message || "No se pudo enviar el enlace. Intenta nuevamente.";
    if (typeof data === "string") return data;
    if (data.error || data.detail || data.message) return data.error || data.detail || data.message;
    return "No se pudo enviar el enlace. Verifica el correo e intenta nuevamente.";
}
