/**
 * ==========================================================================
 * INTEGRACIÓN DE GOOGLE IDENTITY SERVICES & MODAL DE ÉXITO - TUESTANTE
 * ==========================================================================
 */

import { GOOGLE_CLIENT_ID } from "../../js/config.js";
import { loginWithGoogle } from "./auth.js";

/**
 * Inicializa el flujo de Google Identity Services en la página actual.
 * @param {Object} options Opciones de configuración y callbacks
 */
export function initGoogleAuth(options = {}) {
    const {
        btnContainerId = "googleBtn",
        customBtnId = "customGoogleBtnVisual",
        onSuccess = null,
        onError = null,
    } = options;

    const clientId = GOOGLE_CLIENT_ID || window.__GOOGLE_CLIENT_ID__ || "";
    const hasValidClientId = clientId.endsWith(".apps.googleusercontent.com");
    const isRegisterPage = window.location.pathname.includes("register");

    // Asignar listener al botón custom de respaldo (por si falla o tarda en cargar la red)
    const fallbackBtn = document.getElementById(customBtnId) || document.getElementById("customGoogleBtn");
    if (fallbackBtn) {
        fallbackBtn.addEventListener("click", () => {
            if (!hasValidClientId) {
                const msg = "Para habilitar el inicio de sesión con Google, configura la variable GOOGLE_CLIENT_ID en Frontend/js/config.js";
                if (typeof onError === "function") onError(msg);
                else alert(msg);
                return;
            }
            if (window.google?.accounts?.id?.prompt) {
                window.google.accounts.id.prompt();
            }
        });
    }

    // Cargar SDK de Google si aún no existe
    loadGoogleScript(() => {
        if (!hasValidClientId) {
            setupDemoFallback([customBtnId, "customGoogleBtn", "topGoogleRegisterBtn"], onError);
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
                    itp_support: true,
                    use_fedcm_for_prompt: false,
                });

                // Renderizar botón oficial de Google de forma visible y nativa
                const container = document.getElementById(btnContainerId);
                const customBtn = document.getElementById(customBtnId) || document.getElementById("customGoogleBtn");

                if (container) {
                    container.innerHTML = "";
                    const parentWidth = container.parentElement?.offsetWidth || container.offsetWidth || 380;
                    const targetWidth = Math.min(Math.max(parentWidth, 240), 400);

                    window.google.accounts.id.renderButton(container, {
                        theme: "outline",
                        size: "large",
                        type: "standard",
                        shape: "rectangular",
                        text: isRegisterPage ? "signup_with" : "signin_with",
                        logo_alignment: "left",
                        width: targetWidth,
                    });

                    // Permitir interacción directa con el botón oficial de Google
                    container.classList.remove("google-btn-hidden-overlay");
                    container.style.display = "flex";

                    // Ocultar botón visual de fallback para dejar el botón oficial de Google activo
                    if (customBtn) {
                        customBtn.style.display = "none";
                    }
                }
            }
        } catch (err) {
            console.error("Error al inicializar Google Identity Services:", err);
            setupDemoFallback([customBtnId, "customGoogleBtn", "topGoogleRegisterBtn"], onError);
        }
    });

    // Enlace de registro rápido en register.html
    const topRegisterBtn = document.getElementById("topGoogleRegisterBtn");
    if (topRegisterBtn) {
        topRegisterBtn.addEventListener("click", () => {
            if (window.google?.accounts?.id?.prompt) {
                window.google.accounts.id.prompt();
            }
            const googleContainer = document.getElementById(btnContainerId) || document.querySelector(".google-auth-container");
            if (googleContainer) {
                googleContainer.scrollIntoView({ behavior: "smooth", block: "center" });
                googleContainer.classList.add("btn-pulse-highlight");
                setTimeout(() => googleContainer.classList.remove("btn-pulse-highlight"), 1400);
            }
        });
    }

    // Configurar listener del botón Continuar en el modal de éxito
    setupGoogleModalContinue();
}

/**
 * Carga dinámicamente el script de Google Identity Services con verificación activa.
 */
function loadGoogleScript(callback) {
    if (window.google?.accounts?.id) {
        callback();
        return;
    }

    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (window.google?.accounts?.id) {
                clearInterval(checkInterval);
                callback();
            } else if (attempts > 30) {
                clearInterval(checkInterval);
            }
        }, 100);

        existingScript.addEventListener("load", () => {
            clearInterval(checkInterval);
            callback();
        });
        return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
        if (window.google?.accounts?.id) {
            callback();
        } else {
            setTimeout(callback, 100);
        }
    };
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
        document.getElementById("customGoogleBtnVisual"),
        document.getElementById("customGoogleBtn"),
        document.getElementById("topGoogleRegisterBtn"),
        document.getElementById("googleBtn"),
    ];
    customBtns.forEach((btn) => {
        if (btn) {
            btn.style.pointerEvents = isLoading ? "none" : "auto";
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
