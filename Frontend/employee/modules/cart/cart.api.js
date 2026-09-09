/**
 * ==========================================================================
 * TUESTANTE - SERVICIO API DE CARRITO Y CHECKOUT (EMPLOYEE STORE)
 * ==========================================================================
 * Centraliza las conexiones al backend para la verificación de perfil
 * y despacho atómico de órdenes con cargo a nómina.
 */

import { getRequest, postRequest } from '../../../cliente/js/api.js';

/**
 * Consulta el perfil y estado de cuenta consolidado del colaborador en sesión.
 * @returns {Promise<Object>}
 */
export async function obtenerMiPerfilEmpleado() {
  return await getRequest('/employee-store/employees/me/');
}

/**
 * Registra y despacha una orden atómica de consumo interno.
 * @param {Object} payload { employee_id, items: [{ product_id, barcode, quantity }], notes, is_admin_override }
 * @returns {Promise<Object>}
 */
export async function crearOrdenInterna(payload) {
  return await postRequest('/employee-store/orders/', payload);
}
