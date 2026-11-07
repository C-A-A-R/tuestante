/**
 * ==========================================================================
 * TUESTANTE - SERVICIO API DE PEDIDOS Y CONSUMOS (EMPLOYEE STORE)
 * ==========================================================================
 * Centraliza las conexiones al backend para la consulta de órdenes
 * realizadas por el colaborador, detalle de ítems y comprobantes.
 */

import { getRequest, postRequest, extractList } from '../../../js/api.js';

/**
 * Consulta el historial de órdenes del colaborador autenticado.
 * @param {number|string} [employeeId] ID del empleado (opcional para fallback)
 * @returns {Promise<Array>} Lista de órdenes con sus ítems
 */
export async function obtenerMisOrdenes(employeeId = null) {
  try {
    const statement = await getRequest('/employee-store/employees/me/');
    if (statement && Array.isArray(statement.orders) && statement.orders.length > 0) {
      return statement.orders;
    }

    // Fallback: si no vinieron en statement y tenemos employeeId
    const targetId = employeeId || statement?.employee?.id;
    if (targetId) {
      const response = await getRequest('/employee-store/orders/', { employee: targetId });
      return extractList(response);
    }
  } catch (err) {
    console.warn('[OrderAPI] Error consultando órdenes:', err);
  }
  return [];
}

/**
 * Obtiene el detalle completo de una orden por su ID.
 * @param {number|string} orderId 
 * @returns {Promise<Object>}
 */
export async function obtenerOrdenPorId(orderId) {
  return await getRequest(`/employee-store/orders/${orderId}/`);
}

/**
 * Registra una nueva orden de compra interna.
 * @param {Object} payload 
 * @returns {Promise<Object>}
 */
export async function registrarOrden(payload) {
  return await postRequest('/employee-store/orders/', payload);
}
