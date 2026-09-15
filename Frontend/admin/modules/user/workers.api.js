/**
 * ==========================================================================
 * TUESTANTE ADMIN - SERVICIOS API DE GESTIÓN DE TRABAJADORES (workers.api.js)
 * ==========================================================================
 * Conexión con los endpoints del backend para el módulo de trabajadores.
 * Usa el EmployeeProfileViewSet: /api/employee-store/employees/
 */

import {
  getRequest,
  postRequest,
  patchRequest,
  deleteRequest,
  extractList
} from '../../js/api.js';

/**
 * Obtiene la lista de trabajadores con soporte para búsqueda, filtros y paginación.
 * @param {Object} params { search, is_active, department, page, page_size, ordering }
 * @returns {Promise<Object>} { count, results }
 */
export async function obtenerTrabajadores(params = {}) {
  const query = { ...params };

  // Limpiar parámetros vacíos
  Object.keys(query).forEach((key) => {
    if (
      query[key] === '' ||
      query[key] === null ||
      query[key] === undefined ||
      query[key] === 'all' ||
      query[key] === 'todas' ||
      query[key] === 'todos'
    ) {
      delete query[key];
    }
  });

  return await getRequest('/employee-store/employees/', query);
}

/**
 * Obtiene un trabajador por su ID de perfil de empleado.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function obtenerTrabajador(id) {
  return await getRequest(`/employee-store/employees/${id}/`);
}

/**
 * Crea un nuevo trabajador (usuario + perfil de empleado).
 * El backend espera datos del usuario (first_name, last_name, etc.)
 * y datos del perfil (employee_number, department, position, salary).
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function crearTrabajador(payload) {
  return await postRequest('/employee-store/employees/', payload);
}

/**
 * Actualiza un trabajador existente.
 * @param {number|string} id
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function actualizarTrabajador(id, payload) {
  return await patchRequest(`/employee-store/employees/${id}/`, payload);
}

/**
 * Elimina (lógico) un trabajador.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function eliminarTrabajador(id) {
  return await deleteRequest(`/employee-store/employees/${id}/`);
}

/**
 * Alterna el estado activo/inactivo del trabajador en la tienda.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function toggleEstadoTrabajador(id) {
  return await patchRequest(`/employee-store/employees/${id}/toggle-active/`, {});
}
