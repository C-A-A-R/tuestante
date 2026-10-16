import { getRequest } from '../../js/api.js';

/**
 * Obtiene la lista de empresas aliadas registradas desde la API del backend.
 * @param {Object} [params] Parámetros opcionales de búsqueda o paginación.
 * @returns {Promise<Object>} Respuesta con el listado de empresas.
 */
export async function obtenerAlianzas(params = {}) {
  return getRequest('/partnerships/', params, { auth: false });
}
