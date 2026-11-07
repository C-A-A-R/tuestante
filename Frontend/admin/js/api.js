/**
 * ==========================================================================
 * SERVICIO CLIENTE HTTP DE API (FETCH API WRAPPER) - TUESTANTE
 * Proporciona métodos para peticiones HTTP (GET, POST, PUT, PATCH, DELETE),
 * autenticación JWT mediante tokens Bearer y renovación automática de tokens.
 * ==========================================================================
 */

import { API_BASE_URL } from "./config.js";
import { clearCurrentUser, clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "./storage.js";

let refreshInFlight = null;

function buildUrl(path, params) {
  let base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  if (!base.startsWith("http://") && !base.startsWith("https://") && !base.startsWith("/")) {
    base = `http://${base}`;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const isAbsolute = base.startsWith("http://") || base.startsWith("https://");
  const url = isAbsolute
    ? new URL(base + normalizedPath)
    : new URL(base + normalizedPath, window.location.origin);

  if (params && typeof params === "object") {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null) {
            search.append(key, String(item));
          }
        });
        return;
      }
      search.append(key, String(value));
    });
    const searchString = search.toString();
    if (searchString) {
      url.search = searchString;
    }
  }

  return url.toString();
}

export async function apiRequest({
  path,
  method = "GET",
  body,
  params,
  auth = true,
  headers = {},
  _retryOnUnauthorized = true,
} = {}) {
  const finalHeaders = { ...headers };
  const token = auth ? getAccessToken() : null;

  if (token && token !== "null" && token !== "undefined" && String(token).trim() !== "") {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (networkError) {
    const error = new Error("Error de conexión: No se pudo contactar con el servidor. Verifica tu conexión a internet.");
    error.status = 0;
    error.data = null;
    error.isNetworkError = true;
    error.originalError = networkError;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  let data;

  // 🚀 SOLUCIÓN CRÍTICA: Detectar si es un archivo binario (Reportes) para usar .blob()
  if (
    contentType.includes("application/vnd.openxmlformats-officedocument") ||
    contentType.includes("application/pdf") ||
    contentType.includes("text/csv")
  ) {
    data = {
      blob: await response.blob(),
      headers: response.headers,
    };
  } else if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  
  if (response.status === 401 && auth && _retryOnUnauthorized) {
    const refreshed = await refreshAccessTokenIfNeeded();
    if (refreshed) {
      return apiRequest({
        path,
        method,
        body,
        params,
        auth,
        headers,
        _retryOnUnauthorized: false,
      });
    }

    clearTokens();
    clearCurrentUser();
  }

  // ==========================================
  // Captura y formateo de errores del Backend (DRF / HTTP)
  // ==========================================
  if (!response.ok) {
    const errorMessage = formatBackendErrorMessage(data, response.status);
    const apiError = new Error(errorMessage);
    apiError.status = response.status;
    apiError.data = data; // Inyectamos el JSON con los errores completos
    throw apiError;
  }

  // Si todo salió bien (status 200, 201, etc.), retornamos los datos normales
  return data;
}

export function getRequest(path, params, options = {}) {
  return apiRequest({ path, params, ...options, method: "GET" });
}

export function postRequest(path, body, options = {}) {
  return apiRequest({ path, body, ...options, method: "POST" });
}

export function putRequest(path, body, options = {}) {
  return apiRequest({ path, body, ...options, method: "PUT" });
}

export function patchRequest(path, body, options = {}) {
  return apiRequest({ path, body, ...options, method: "PATCH" });
}

export function deleteRequest(path, options = {}) {
  return apiRequest({ path, ...options, method: "DELETE" });
}

async function refreshAccessTokenIfNeeded() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(buildUrl("/user/token/refresh/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      const newAccessToken = data?.access ?? data?.access_token ?? data?.token ?? data?.data?.access ?? null;
      const newRefreshToken = data?.refresh ?? data?.refresh_token ?? data?.data?.refresh ?? null;

      if (newAccessToken) {
        setAccessToken(newAccessToken);
      }

      if (newRefreshToken) {
        setRefreshToken(newRefreshToken);
      }

      return Boolean(newAccessToken);
    })()
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export { backendOrigin, API_BASE_URL } from "./config.js";

/**
 * Extrae un arreglo uniforme de resultados de la API (maneja listas simples y respuestas paginadas con results/data).
 * @param {*} apiResult 
 * @returns {Array}
 */
export function extractList(apiResult) {
  if (!apiResult) return [];
  if (Array.isArray(apiResult)) return apiResult;
  if (Array.isArray(apiResult.results)) return apiResult.results;
  if (Array.isArray(apiResult.data)) return apiResult.data;
  return [];
}

/**
 * Resuelve la URL completa de una imagen proveniente del backend o de assets locales.
 * @param {string} path Ruta de la imagen o URL completa
 * @param {string} fallback Imagen por defecto en caso de no existir ruta
 * @returns {string}
 */
export function resolveImageUrl(path, fallback = '') {
  if (!path) return fallback;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  // Si es una ruta local de frontend (assets/ o rutas relativas ../), retornarla directamente
  if (path.startsWith('assets/') || path.startsWith('../') || path.startsWith('./')) {
    return path;
  }
  
  let baseOrigin = (typeof window !== 'undefined' && window.__API_BASE_ORIGIN__) ? window.__API_BASE_ORIGIN__ : 'http://localhost:8000';
  let origin = baseOrigin.endsWith('/') ? baseOrigin.slice(0, -1) : baseOrigin;
  if (!origin.startsWith('http://') && !origin.startsWith('https://') && !origin.startsWith('/')) {
    origin = `http://${origin}`;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${cleanPath}`;
}

/**
 * Extrae y formatea mensajes de error claros provenientes de DRF o respuestas HTTP.
 * @param {*} data Objeto, arreglo o texto con el error retornado por el backend
 * @param {number} status Código de estado HTTP
 * @returns {string}
 */
export function formatBackendErrorMessage(data, status = 0) {
  if (!data) {
    if (status === 404) return "El recurso solicitado no fue encontrado (404).";
    if (status === 403) return "No tienes permisos para realizar esta acción (403).";
    if (status === 401) return "Tu sesión ha expirado o no estás autenticado (401).";
    if (status >= 500) return `Error interno del servidor (${status}). Intente más tarde.`;
    return "Ocurrió un error al procesar la solicitud.";
  }

  if (typeof data === "string") {
    if (data.includes("<html") || data.includes("<!DOCTYPE") || data.includes("<body")) {
      return `Error del servidor (${status || 500}). Por favor intente más tarde.`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data
      .map(item => (typeof item === "object" ? formatBackendErrorMessage(item, status) : String(item)))
      .filter(Boolean)
      .join(" ");
  }

  if (typeof data === "object") {
    if (data.detail && typeof data.detail === "string") return data.detail;
    if (data.error && typeof data.error === "string") return data.error;
    if (data.message && typeof data.message === "string") return data.message;

    // Diccionario de nombres legibles en español para campos comunes de DRF
    const FIELD_LABELS = {
      amount: "Monto",
      amount_ves: "Monto en Bolívares",
      exchange_rate: "Tasa de cambio",
      currency: "Moneda",
      payment_stage: "Etapa de pago",
      payment_method: "Método de pago",
      reference_number: "N° de Referencia",
      receipt_file: "Comprobante",
      order: "Pedido",
      status: "Estado",
      notes: "Notas",
      username: "Usuario",
      email: "Correo electrónico",
      password: "Contraseña",
      phone: "Teléfono",
      non_field_errors: ""
    };

    const messages = [];
    for (const [key, val] of Object.entries(data)) {
      const label = FIELD_LABELS[key] !== undefined ? FIELD_LABELS[key] : key;
      let text = "";
      if (Array.isArray(val)) {
        text = val.map(v => typeof v === 'object' ? formatBackendErrorMessage(v, status) : String(v)).join(", ");
      } else if (typeof val === "object" && val !== null) {
        text = formatBackendErrorMessage(val, status);
      } else {
        text = String(val);
      }
      if (text) {
        messages.push(label ? `${label}: ${text}` : text);
      }
    }

    if (messages.length > 0) {
      return messages.join(" | ");
    }
  }

  return "Ocurrió un error inesperado al procesar los datos.";
}

