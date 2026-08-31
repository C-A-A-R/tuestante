/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE FACTURACIÓN (TUESTANTE OMS)
 * Maneja las peticiones HTTP hacia los endpoints de facturas generadas.
 * ==========================================================================
 */

import { getRequest, postRequest } from '../../js/api.js';

/**
 * Obtiene la lista de facturas del usuario autenticado (o todas si es admin).
 * @param {Object} [params] Parámetros opcionales de búsqueda y filtrado.
 * @returns {Promise<Object>} Listado de facturas.
 */
export async function obtenerFacturas(params = {}) {
    return getRequest('/invoices/', params, { auth: true });
}

/**
 * Obtiene la factura correspondiente a un pedido específico por su ID de orden.
 * @param {number|string} orderId ID de la orden.
 * @returns {Promise<Object>} Factura asociada.
 */
export async function obtenerFacturaPorOrden(orderId) {
    return getRequest('/invoices/', { order: orderId }, { auth: true });
}

/**
 * Obtiene el detalle de una factura específica por su ID.
 * @param {number|string} invoiceId ID de la factura.
 * @returns {Promise<Object>} Detalle de la factura.
 */
export async function obtenerFacturaPorId(invoiceId) {
    return getRequest(`/invoices/${invoiceId}/`, {}, { auth: true });
}

// Alias en inglés
export const getInvoices = obtenerFacturas;
export const getInvoiceByOrderId = obtenerFacturaPorOrden;
export const getInvoiceById = obtenerFacturaPorId;
