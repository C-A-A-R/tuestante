import { getRequest, postRequest } from '../../js/api.js';

/**
 * Obtiene el listado de imágenes de la galería desde el backend Django.
 * Permite filtrar opcionalmente por red social o parámetros de búsqueda.
 * @param {Object} [params] Parámetros opcionales (ej: { social_network: 'instagram' }).
 * @returns {Promise<Object|Array>} Lista de imágenes de la galería o respuesta paginada.
 */
export async function obtenerGaleria(params = {}) {
  return getRequest('/gallery/', params, { auth: false });
}

/**
 * Obtiene el detalle de un elemento de la galería por su ID.
 * @param {number|string} id ID del elemento de la galería.
 * @param {Object} [params] Parámetros opcionales.
 * @returns {Promise<Object>} Detalle del elemento de la galería.
 */
export async function obtenerElementoGaleriaPorId(id, params = {}) {
  return getRequest(`/gallery/${id}/`, params, { auth: false });
}

/**
 * Envía una nueva imagen a la galería para moderación y publicación.
 * Requiere autenticación JWT.
 * @param {FormData} formData Datos del formulario con la imagen y metadatos.
 * @returns {Promise<Object>} Registro de galería creado.
 */
export async function subirFotoGaleria(formData) {
  return postRequest('/gallery/', formData, { auth: true });
}
