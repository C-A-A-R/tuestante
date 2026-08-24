/**
 * ==========================================================================
 * SERVICIO CLIENTE HTTP DE API (FETCH API WRAPPER) - TUESTANTE
 * Proporciona métodos para peticiones HTTP (GET, POST, PUT, PATCH, DELETE),
 * autenticación JWT mediante tokens Bearer y renovación automática de tokens.
 * ==========================================================================
 */

import { API_BASE_URL, backendOrigin } from "./config.js";
import { clearCurrentUser, clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "./storage.js";

let refreshInFlight = null;

function buildUrl(path, params) {
  let base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

  // Prevenir bloqueo por Contenido Mixto (Mixed Content) en produccion (HTTPS -> HTTP)
  if (typeof window !== "undefined" && window.location.protocol === "https:" && base.startsWith("http://")) {
    if (!base.includes("localhost") && !base.includes("127.0.0.1")) {
      base = base.replace("http://", "https://");
    }
  }

  if (!base.startsWith("http://") && !base.startsWith("https://") && !base.startsWith("/")) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    base = `${protocol}//${base}`;
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

  const targetUrl = buildUrl(path, params);
  let response;

  try {
    response = await fetch(targetUrl, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (networkError) {
    console.error(`[API Network Error] No se pudo conectar con ${targetUrl}:`, networkError);
    const apiError = new Error(`Error de red o conexión al servidor (${networkError.message})`);
    apiError.status = 0;
    apiError.isNetworkError = true;
    throw apiError;
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
  // NUEVO CAMBIO: Captura de errores del Backend
  // ==========================================
  if (!response.ok) {
    const apiError = new Error("API request failed");
    apiError.status = response.status;
    apiError.data = data; // <--- Aquí inyectamos el JSON con los errores ("Este campo ya existe", etc.)
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
      const response = await fetch(buildUrl("/usuarios/renovar-token/"), {
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

/**
 * Extrae un arreglo uniforme de resultados de la API (maneja listas simples y respuestas paginadas).
 * @param {any} apiResult - Respuesta cruda devuelta por la API.
 * @returns {Array} Arreglo de datos extraído.
 */
export function extractList(apiResult) {
  if (!apiResult) return [];
  if (Array.isArray(apiResult)) return apiResult;
  if (Array.isArray(apiResult.results)) return apiResult.results;
  return [];
}

/**
 * Resuelve la URL completa de una imagen o recurso proveniente del backend.
 * Procesa rutas relativas, absolutas, estáticas (assets) y entornos de producción/desarrollo.
 * @param {string} imagePath - Ruta o URL recibida de la API o assets.
 * @param {string} fallback - Ruta por defecto si imagePath es vacío.
 * @returns {string} URL resuelta para mostrar en la interfaz.
 */
export function resolveImageUrl(imagePath, fallback = "") {
  if (!imagePath) return fallback;

  if (imagePath.includes("assets/")) {
    return imagePath;
  }

  let origin = backendOrigin || "";
  if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    origin = `${protocol}//${origin}`;
  }

  let finalUrl = imagePath;

  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    if (imagePath.includes("/media/")) {
      const mediaPath = imagePath.substring(imagePath.indexOf("/media/"));
      finalUrl = `${origin.endsWith("/") ? origin.slice(0, -1) : origin}${mediaPath}`;
    } else {
      finalUrl = imagePath;
    }
  } else if (imagePath.startsWith("/media/") || imagePath.startsWith("media/")) {
    const cleanPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
    const cleanOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    finalUrl = `${cleanOrigin}${cleanPath}`;
  } else if (imagePath.startsWith("/")) {
    const cleanOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    finalUrl = `${cleanOrigin}${imagePath}`;
  } else {
    const cleanOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    finalUrl = `${cleanOrigin}/${imagePath}`;
  }

  if (typeof window !== "undefined" && window.location.protocol === "https:" && finalUrl.startsWith("http://")) {
    if (!finalUrl.includes("localhost") && !finalUrl.includes("127.0.0.1")) {
      finalUrl = finalUrl.replace("http://", "https://");
    }
  }

  return finalUrl;
}

