/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE PEDIDOS Y FABRICACIÓN (TUESTANTE OMS)
 * Maneja las peticiones HTTP hacia los endpoints de pedidos y órdenes de fabricación.
 * ==========================================================================
 */

import { getRequest, postRequest, putRequest, patchRequest, deleteRequest } from '../../js/api.js';

/**
 * Obtiene la lista de pedidos del usuario autenticado (o todos si es admin).
 * @param {Object} [params] Parámetros opcionales de búsqueda y paginación.
 * @returns {Promise<Object>} Listado de pedidos.
 */
export async function obtenerPedidos(params = {}) {
    return getRequest('/orders/', params, { auth: true });
}

/**
 * Obtiene directamente las compras y pedidos del cliente autenticado,
 * priorizando por defecto las órdenes no finalizadas en las primeras posiciones.
 * @param {Object} [params] Parámetros adicionales de filtrado o paginación.
 * @returns {Promise<Object>} Listado de pedidos propios ordenados.
 */
export async function obtenerMisPedidos(params = {}) {
    const queryParams = {
        prioritize_unfinished: true,
        ...params
    };
    return getRequest('/orders/my-orders/', queryParams, { auth: true });
}

/**
 * Obtiene el detalle de un pedido específico por su ID.
 * @param {number|string} orderId ID del pedido.
 * @returns {Promise<Object>} Información detallada del pedido.
 */
export async function obtenerPedidoPorId(orderId) {
    return getRequest(`/orders/${orderId}/`, {}, { auth: true });
}

/**
 * Registra un nuevo pedido en el sistema.
 * @param {Object} orderData Datos del pedido (notes, items: [{ product_id, quantity, notes }]).
 * @returns {Promise<Object>} Pedido creado con su ID y detalles.
 */
export async function crearPedido(orderData) {
    return postRequest('/orders/', orderData, { auth: true });
}

/**
 * Actualiza la información de un pedido existente.
 * @param {number|string} orderId ID del pedido.
 * @param {Object} orderData Datos a actualizar.
 * @returns {Promise<Object>} Pedido actualizado.
 */
export async function actualizarPedido(orderId, orderData) {
    return patchRequest(`/orders/${orderId}/`, orderData, { auth: true });
}

/**
 * Elimina lógicamente un pedido del sistema.
 * @param {number|string} orderId ID del pedido.
 * @returns {Promise<Object>} Respuesta de confirmación.
 */
export async function eliminarPedido(orderId) {
    return deleteRequest(`/orders/${orderId}/`, { auth: true });
}

/**
 * (Admin) Genera o emite una Orden de Fabricación para el pedido.
 * @param {number|string} orderId ID del pedido.
 * @returns {Promise<Object>} Resultado de la emisión.
 */
export async function emitirOrdenFabricacion(orderId) {
    return postRequest(`/orders/${orderId}/issue_manufacturing_order/`, {}, { auth: true });
}

/**
 * (Admin) Obtiene la lista de Órdenes de Fabricación.
 * @param {Object} [params] Filtros opcionales.
 * @returns {Promise<Object>} Listado de órdenes de fabricación.
 */
export async function obtenerOrdenesFabricacion(params = {}) {
    return getRequest('/manufacturing-orders/', params, { auth: true });
}

// Alias en inglés para mayor versatilidad
export const getOrders = obtenerPedidos;
export const getOrderById = obtenerPedidoPorId;
export const createOrder = crearPedido;
export const updateOrder = actualizarPedido;
export const deleteOrder = eliminarPedido;
