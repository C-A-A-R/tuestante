import { confirmPasswordReset } from "./password-reset.api.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("set-new-password-form");
    const newPassword = document.getElementById("new_password");
    const confirmPassword = document.getElementById("confirm_password");
    const submitButton = document.getElementById("submit-new-password");
    const params = new URLSearchParams(window.location.search);
    const uidb64 = params.get("uidb64");
    const token = params.get("token");

    if (!form || !newPassword || !confirmPassword) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearNotifications();
        clearFieldError(newPassword);
        clearFieldError(confirmPassword);

        let hasError = false;
        if (newPassword.value.length < 6 || !/[A-Z]/.test(newPassword.value)) {
            setFieldError(newPassword, "Usa al menos 6 caracteres y una letra mayúscula.");
            hasError = true;
        }
        if (newPassword.value !== confirmPassword.value) {
            setFieldError(confirmPassword, "Las contraseñas no coinciden.");
            hasError = true;
        }
        if (hasError) return;
        if (!uidb64 || !token) {
            showError("El enlace de recuperación no es válido o está incompleto.");
            return;
        }

        setLoading(true);
        try {
            await confirmPasswordReset(uidb64, token, newPassword.value, confirmPassword.value);
            showSuccess("Contraseña actualizada. Redirigiendo al inicio de sesión...");
            setTimeout(() => { window.location.href = "login.html"; }, 1500);
        } catch (error) {
            showError(getBackendErrorMessage(error));
        } finally {
            setLoading(false);
        }
    });
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

function setLoading(isLoading) {
    const button = document.getElementById("submit-new-password");
    button.disabled = isLoading;
    button.querySelector(".btn-text").style.display = isLoading ? "none" : "inline";
    button.querySelector(".btn-spinner").style.display = isLoading ? "inline" : "none";
}

function clearNotifications() {
    document.getElementById("authErrorNotification").style.display = "none";
    document.getElementById("authSuccessNotification").style.display = "none";
}

function showError(message) {
    document.getElementById("authErrorText").textContent = message;
    document.getElementById("authErrorNotification").style.display = "flex";
}

function showSuccess(message) {
    document.getElementById("authSuccessText").textContent = message;
    document.getElementById("authSuccessNotification").style.display = "flex";
}

function getBackendErrorMessage(error) {
    const data = error?.data;
    if (!data) return error?.message || "No se pudo actualizar la contraseña.";
    if (typeof data === "string") return data;
    if (data.error || data.detail || data.message) return data.error || data.detail || data.message;
    return "El enlace no es válido o ha expirado.";
}
