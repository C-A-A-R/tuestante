/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE PAGOS (TUESTANTE)
 * Maneja las peticiones HTTP hacia los endpoints de pagos (/api/payments/).
 * ==========================================================================
 */

import { getRequest, postRequest, patchRequest } from '../../js/api.js';

/**
 * Obtiene la lista de pagos del usuario autenticado (o todos si es admin).
 * @param {Object} [params] Parámetros opcionales de búsqueda/filtro (ej. { order: orderId }).
 * @returns {Promise<Object>} Listado de pagos.
 */
export async function obtenerPagos(params = {}) {
    return getRequest('/payments/', params, { auth: true });
}

/**
 * Obtiene el detalle de un pago específico por su ID.
 * @param {number|string} paymentId ID del pago.
 * @returns {Promise<Object>} Información detallada del pago.
 */
export async function obtenerPagoPorId(paymentId) {
    return getRequest(`/payments/${paymentId}/`, {}, { auth: true });
}

/**
 * Registra un nuevo comprobante de pago para un pedido (Multipart Form-Data o JSON).
 * @param {FormData|Object} paymentData Datos del pago (order, payment_stage, amount, payment_method, reference_number, receipt_file, notes).
 * @returns {Promise<Object>} Pago registrado.
 */
export async function registrarPago(paymentData) {
    return postRequest('/payments/', paymentData, { auth: true });
}

/**
 * (Admin) Revisa y aprueba o rechaza un pago registrado.
 * @param {number|string} paymentId ID del pago.
 * @param {'approved'|'rejected'} status Estado de la revisión.
 * @param {string} [rejectionReason] Motivo del rechazo en caso de no ser aprobado.
 * @returns {Promise<Object>} Pago actualizado.
 */
export async function revisarPago(paymentId, status, rejectionReason = '') {
    return postRequest(`/payments/${paymentId}/review/`, {
        status,
        rejection_reason: rejectionReason
    }, { auth: true });
}
