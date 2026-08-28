import { getRequest, apiRequest } from '../../js/api.js';

/**
 * Obtiene la lista de proyectos del servidor.
 * @param {Object} [params] Parámetros de consulta opcionales.
 * @returns {Promise<Object>} Lista o respuesta paginada de proyectos.
 */
export async function obtenerProyectos(params = {}) {
  return getRequest('/projects/projects/', params, { auth: false });
}

/**
 * Obtiene el detalle de un proyecto específico por su ID.
 * @param {number|string} id ID del proyecto.
 * @param {Object} [params] Parámetros opcionales.
 * @returns {Promise<Object>} Detalle del proyecto.
 */
export async function obtenerProyectoPorId(id, params = {}) {
  return getRequest(`/projects/projects/${id}/`, params, { auth: false });
}
