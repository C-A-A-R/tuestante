/**
 * ==========================================================================
 * LÓGICA DE INICIO DE SESIÓN - TUESTANTE
 * Conexión a la API (/api/user/login/), validación de campos,
 * manejo de estados de carga, alertas y soporte para parámetro ?redirect=.
 * ==========================================================================
 */

import { loginUser } from "./auth.js";
import { initGoogleAuth } from "./google-auth.js";
import { getAccessToken, getRefreshToken, getCurrentUser } from "../../js/storage.js";

/**
 * Determina la ruta relativa al catálogo / portal del trabajador
 */
function getEmployeeIndexPath() {
	const pathname = window.location.pathname || "";
	if (pathname.includes("/cliente/")) {
		return "../../../employee/index.html";
	}
	return "../../employee/index.html";
}

function getFormField(form, name) {
	return form.elements.namedItem(name);
}

function setFieldError(field, message) {
	const errorElement = document.getElementById(`${field.id}Error`);
	const formGroup = field.closest('.form-group');

	if (errorElement) {
		errorElement.textContent = message || "";
		if (message) {
			errorElement.classList.add("show");
		} else {
			errorElement.classList.remove("show");
		}
	}

	if (formGroup) {
		if (message) {
			formGroup.classList.add("error");
		} else {
			formGroup.classList.remove("error");
		}
	}

	field.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearFieldError(field) {
	setFieldError(field, "");
}

function getBackendErrorMessage(error) {
	const data = error?.data;
	if (!data) {
		return error?.message || "No se pudo iniciar sesión. Verifica tus credenciales.";
	}

	if (typeof data === "string") {
		return data;
	}

	if (data.error) {
		return data.error;
	}

	if (data.detail) {
		return data.detail;
	}

	const firstMessage = Object.values(data).find((value) => {
		if (Array.isArray(value)) {
			return value.length > 0;
		}
		return Boolean(value);
	});

	if (Array.isArray(firstMessage)) {
		return firstMessage[0];
	}

	if (typeof firstMessage === "string") {
		return firstMessage;
	}

	return "Credenciales inválidas. Por favor intenta nuevamente.";
}

function setLoadingState(form, isLoading) {
	const submitButton = document.getElementById('loginSubmitBtn') || form.querySelector('button[type="submit"]');
	const buttonText = form.querySelector('.btn-text');
	const spinner = form.querySelector('.btn-spinner');

	if (submitButton) {
		submitButton.disabled = isLoading;
		submitButton.setAttribute("aria-busy", isLoading ? "true" : "false");
	}

	if (buttonText) {
		buttonText.textContent = isLoading ? "Iniciando Sesión..." : "Iniciar Sesión";
	}

	if (spinner) {
		spinner.style.display = isLoading ? "inline-block" : "none";
	}
}

function setupPasswordToggle(form) {
	const passwordInput = getFormField(form, "contrasena");
	const toggleButton = document.getElementById("passwordToggle");

	if (!passwordInput || !toggleButton) {
		return;
	}

	const eyeOpen = toggleButton.querySelector('.eye-open');
	const eyeClosed = toggleButton.querySelector('.eye-closed');

	toggleButton.addEventListener("click", () => {
		const isPassword = passwordInput.type === "password";
		passwordInput.type = isPassword ? "text" : "password";

		if (eyeOpen && eyeClosed) {
			eyeOpen.style.display = isPassword ? "none" : "block";
			eyeClosed.style.display = isPassword ? "block" : "none";
		}
	});
}

function showAuthErrorNotification(message) {
	const notification = document.getElementById("authErrorNotification");
	const errorText = document.getElementById("authErrorText");

	if (notification && errorText) {
		errorText.textContent = message;
		notification.style.display = "flex";
		return;
	}

	// Fallback dinámico si no existe en el DOM
	const existing = document.querySelector(".auth-notification");
	if (existing) existing.remove();

	const alertBox = document.createElement("div");
	alertBox.className = "auth-notification";
	alertBox.innerHTML = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="12" y1="8" x2="12" y2="12"></line>
			<line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
		<span>${message}</span>
	`;

	const card = document.querySelector(".auth-card");
	const form = document.getElementById("loginForm");
	if (card && form) {
		card.insertBefore(alertBox, form);
	}
}

async function handleLogin(event) {
	event.preventDefault();

	const form = event.target;
	const emailField = getFormField(form, "email");
	const passwordField = getFormField(form, "contrasena");

	const email = String(emailField.value || "").trim();
	const password = String(passwordField.value || "");
	let hasError = false;

	clearFieldError(emailField);
	clearFieldError(passwordField);

	const notification = document.getElementById("authErrorNotification");
	if (notification) notification.style.display = "none";

	if (!email) {
		setFieldError(emailField, "Ingresa tu correo electrónico o cédula.");
		hasError = true;
	} else if (email.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		setFieldError(emailField, "Ingresa un correo electrónico válido.");
		hasError = true;
	}

	if (!password) {
		setFieldError(passwordField, "La contraseña es obligatoria.");
		hasError = true;
	}

	if (hasError) {
		return;
	}

	setLoadingState(form, true);

	try {
		const result = await loginUser({
			username: email,
			email: email,
			identity_document: email,
			password: password,
			contrasena: password,
		});

		// Si es trabajador, redirigir al index de empleados
		const user = result?.user || getCurrentUser();
		const isEmployee = Boolean(result?.is_employee || user?.is_employee);

		if (isEmployee) {
			const redirectParam = new URLSearchParams(window.location.search).get("redirect");
			if (redirectParam && redirectParam.includes("/employee/")) {
				window.location.href = redirectParam;
			} else {
				window.location.href = getEmployeeIndexPath();
			}
			return;
		}

		const redirectParam = new URLSearchParams(window.location.search).get("redirect");
		window.location.href = redirectParam || "../../index.html";

	} catch (error) {
		const errorMessage = getBackendErrorMessage(error);
		showAuthErrorNotification(errorMessage);

		emailField.closest('.form-group')?.classList.add("error");
		passwordField.closest('.form-group')?.classList.add("error");
	} finally {
		setLoadingState(form, false);
	}
}

document.addEventListener("DOMContentLoaded", () => {
	// Si ya está autenticado, redirigir
	if (getAccessToken() || getRefreshToken()) {
		const user = getCurrentUser();
		if (user?.is_employee) {
			const redirectParam = new URLSearchParams(window.location.search).get("redirect");
			if (redirectParam && redirectParam.includes("/employee/")) {
				window.location.href = redirectParam;
			} else {
				window.location.href = getEmployeeIndexPath();
			}
			return;
		}

		const redirectParam = new URLSearchParams(window.location.search).get("redirect");
		window.location.href = redirectParam || "../../index.html";
		return;
	}

	const form = document.getElementById("loginForm");
	if (!form) {
		return;
	}

	setupPasswordToggle(form);
	form.addEventListener("submit", handleLogin);

	const emailField = getFormField(form, "email");
	const passwordField = getFormField(form, "contrasena");

	[emailField, passwordField].forEach((field) => {
		if (!field) return;
		field.addEventListener("input", () => {
			clearFieldError(field);
			const notif = document.getElementById("authErrorNotification");
			if (notif) notif.style.display = "none";
		});
	});

	// Inicializar autenticación con Google
	initGoogleAuth({
		btnContainerId: "googleBtn",
		customBtnId: "customGoogleBtnVisual",
		onError: (msg) => showAuthErrorNotification(msg),
	});
});
