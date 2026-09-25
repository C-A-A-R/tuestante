/**
 * ==========================================================================
 * INTEGRACIÓN DE GOOGLE IDENTITY SERVICES & MODAL DE ÉXITO - TUESTANTE
 * ==========================================================================
 */

import { GOOGLE_CLIENT_ID } from "../../js/config.js";
import { loginWithGoogle } from "./auth.js";

let originErrorLogged = false;

/**
 * Intercepta mensajes de error del SDK de Google Identity Services para advertir
 * claramente en pantalla si el origen actual (ej. http://localhost:5500) no fue
 * añadido a los "Orígenes de JavaScript autorizados" en Google Cloud Console.
 */
function setupOriginErrorDetection(onError) {
    if (window.__gsiOriginMonitored__) return;
    window.__gsiOriginMonitored__ = true;

    const checkText = (args) => {
        try {
            const fullText = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a || ""))).join(" ");
            if (fullText.toLowerCase().includes("origin is not allowed for the given client id")) {
                originErrorLogged = true;
                const currentOrigin = window.location.origin;
                const msg = `El origen actual (${currentOrigin}) no está registrado en los "Orígenes de JavaScript autorizados" en Google Cloud Console para este Client ID. Agrégalo en Google Cloud Console para permitir el inicio de sesión.`;
                if (typeof onError === "function") {
                    onError(msg);
                }
            }
        } catch (_) {}
    };

    const originalConsoleError = console.error;
    console.error = function (...args) {
        originalConsoleError.apply(console, args);
        checkText(args);
    };

    const originalConsoleWarn = console.warn;
    console.warn = function (...args) {
        originalConsoleWarn.apply(console, args);
        checkText(args);
    };
}

/**
 * Inicializa el flujo de Google Identity Services en la página actual.
 * @param {Object} options Opciones de configuración y callbacks
 */
export function initGoogleAuth(options = {}) {
    const {
        btnContainerId = "googleBtn",
        customBtnId = "customGoogleBtn",
        onSuccess = null,
        onError = null,
    } = options;

    setupOriginErrorDetection(onError);

    const clientId = GOOGLE_CLIENT_ID || window.__GOOGLE_CLIENT_ID__ || "";
    const hasValidClientId = clientId.endsWith(".apps.googleusercontent.com");

    // Cargar SDK de Google si aún no existe
    loadGoogleScript(() => {
        if (!hasValidClientId) {
            setupDemoFallback([customBtnId, "topGoogleRegisterBtn", "customGoogleBtnFallback"], onError);
            return;
        }

        try {
            if (window.google?.accounts?.id) {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: async (response) => {
                        await processGoogleCredential(response.credential, { onSuccess, onError });
                    },
                    auto_select: false,
                    cancel_on_tap_outside: true,
                });

                // Renderizar botón oficial de Google en el overlay interactivo
                const container = document.getElementById(btnContainerId);
                if (container) {
                    window.google.accounts.id.renderButton(container, {
                        theme: "outline",
                        size: "large",
                        type: "standard",
                        shape: "rectangular",
                        text: "continue_with",
                        logo_alignment: "left",
                        width: 380,
                    });
                }
            }
        } catch (err) {
            console.error("Error al inicializar Google Identity Services:", err);
            setupDemoFallback(["topGoogleRegisterBtn"], onError);
        }
    });

    // Enlace de registro rápido en register.html: desplaza suavemente hacia el botón de Google
    const topRegisterBtn = document.getElementById("topGoogleRegisterBtn");
    if (topRegisterBtn) {
        topRegisterBtn.addEventListener("click", () => {
            const googleWrapper = document.querySelector(".google-auth-container");
            if (googleWrapper) {
                googleWrapper.scrollIntoView({ behavior: "smooth", block: "center" });
                const btnBox = googleWrapper.querySelector(".google-auth-btn-wrapper") || googleWrapper;
                btnBox.classList.add("btn-pulse-highlight");
                setTimeout(() => btnBox.classList.remove("btn-pulse-highlight"), 1400);
            }
        });
    }

    // Configurar listener del botón Continuar en el modal de éxito
    setupGoogleModalContinue();
}

/**
 * Carga dinámicamente el script de Google Identity Services.
 */
function loadGoogleScript(callback) {
    if (window.google?.accounts?.id) {
        callback();
        return;
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
        existingScript.addEventListener("load", callback);
        return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = callback;
    script.onerror = () => {
        console.warn("No se pudo cargar el SDK de Google Identity Services.");
    };
    document.head.appendChild(script);
}

/**
 * Procesa la credencial JWT devuelta por Google y autentica contra el backend de TuEstante.
 */
export async function processGoogleCredential(credential, { onSuccess, onError } = {}) {
    showGoogleLoading(true);

    try {
        const result = await loginWithGoogle(credential);

        showGoogleLoading(false);

        const user = result?.user;
        const profileCompleted = Boolean(result?.profile_completed);
        const isNewUser = Boolean(result?.is_new_user);
        const isEmployee = Boolean(result?.is_employee || user?.is_employee);

        if (onSuccess && typeof onSuccess === "function") {
            onSuccess(result);
        }

        // Si es un usuario nuevo o aún no ha completado cédula/teléfono/fecha
        if (isNewUser || !profileCompleted) {
            showGoogleSuccessModal(user);
        } else if (isEmployee) {
            // Empleado con perfil completo
            const redirectParam = new URLSearchParams(window.location.search).get("redirect");
            if (redirectParam && redirectParam.includes("/employee/")) {
                window.location.href = redirectParam;
            } else {
                window.location.href = "../../employee/index.html";
            }
        } else {
            // Cliente recurrente con perfil completo
            const redirectParam = new URLSearchParams(window.location.search).get("redirect");
            window.location.href = redirectParam || "../../index.html";
        }
    } catch (err) {
        showGoogleLoading(false);
        console.error("Error en autenticación con Google:", err);

        const msg = err?.data?.error || err?.data?.credential || err?.message || "No se pudo autenticar con Google. Intenta nuevamente.";
        if (onError && typeof onError === "function") {
            onError(msg);
        } else {
            alert(msg);
        }
    }
}

/**
 * Muestra el modal de felicitación y aviso de paso intermedio.
 */
export function showGoogleSuccessModal(user) {
    const modal = document.getElementById("googleSuccessModal");
    if (!modal) {
        // Si no existe el modal en el DOM, redirigir directamente a complete-profile.html
        redirectToCompleteProfile();
        return;
    }

    // Actualizar datos del usuario en la vista previa del modal
    const nameEl = modal.querySelector(".modal-user-name");
    const emailEl = modal.querySelector(".modal-user-email");
    const avatarEl = modal.querySelector(".modal-avatar-img");

    if (nameEl && user) {
        nameEl.textContent = user.full_name || `${user.first_name || ""} ${user.first_last_name || ""}`.trim() || user.username || "Usuario";
    }
    if (emailEl && user) {
        emailEl.textContent = user.email || "";
    }
    if (avatarEl) {
        if (user?.avatar_url) {
            avatarEl.src = user.avatar_url;
            avatarEl.style.display = "block";
        } else {
            avatarEl.style.display = "none";
        }
    }

    modal.style.display = "flex";
}

/**
 * Configura el botón Continuar del modal.
 */
function setupGoogleModalContinue() {
    const continueBtn = document.getElementById("btnGoogleModalContinue");
    if (continueBtn) {
        continueBtn.addEventListener("click", () => {
            redirectToCompleteProfile();
        });
    }
}

/**
 * Redirige a la pantalla intermedia de completar registro.
 */
function redirectToCompleteProfile() {
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");
    const targetUrl = redirectParam
        ? `complete-profile.html?redirect=${encodeURIComponent(redirectParam)}`
        : "complete-profile.html";
    window.location.href = targetUrl;
}

/**
 * Indicador de carga durante la llamada a la API.
 */
function showGoogleLoading(isLoading) {
    const customBtns = [
        document.getElementById("customGoogleBtn"),
        document.getElementById("topGoogleRegisterBtn"),
    ];
    customBtns.forEach((btn) => {
        if (btn) {
            btn.disabled = isLoading;
            btn.style.opacity = isLoading ? "0.6" : "1";
        }
    });
}

/**
 * Fallback informativo cuando GOOGLE_CLIENT_ID no está configurado aún.
 */
function setupDemoFallback(btnIds, onError) {
    const ids = Array.isArray(btnIds) ? btnIds : [btnIds];
    ids.forEach((id) => {
        const customBtn = document.getElementById(id);
        if (customBtn) {
            customBtn.addEventListener("click", () => {
                const msg = "Para habilitar el inicio de sesión con Google, por favor configura la variable GOOGLE_CLIENT_ID en el archivo .env del backend o en Frontend/js/config.js";
                if (onError && typeof onError === "function") {
                    onError(msg);
                } else {
                    alert(msg);
                }
            });
        }
    });
}
