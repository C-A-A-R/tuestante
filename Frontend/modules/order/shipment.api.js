/**
 * ==========================================================================
 * SERVICIO API - MÓDULO DE ENVÍOS Y DISTRIBUIDORES (TUESTANTE OMS)
 * Maneja las peticiones HTTP hacia los endpoints de distribuidores y envíos.
 * ==========================================================================
 */

import { getRequest, postRequest, putRequest, patchRequest, deleteRequest } from '../../js/api.js';

/**
 * Obtiene la lista de distribuidores / empresas de transporte disponibles.
 * @param {Object} [params] Parámetros opcionales de búsqueda y filtrado.
 * @returns {Promise<Object>} Listado de distribuidores.
 */
export async function obtenerDistribuidores(params = {}) {
    return getRequest('/distributors/', params, { auth: true });
}

/**
 * Obtiene los transportistas con cobertura confirmada para un estado y municipio determinados.
 * @param {Object} params { state: string, municipality?: string }
 * @returns {Promise<Object>} Lista de transportistas con cobertura en la zona.
 */
export async function obtenerDistribuidoresDisponibles(params = {}) {
    return getRequest('/distributors/available/', params, { auth: true });
}

/**
 * Registra un nuevo envío asociado a un pedido.
 * @param {Object} shipmentData Datos del envío (order, address, phone, notes, price, distributor, status).
 * @returns {Promise<Object>} Envío creado.
 */
export async function crearEnvio(shipmentData) {
    return postRequest('/shipments/', shipmentData, { auth: true });
}

/**
 * Obtiene la lista de envíos del usuario actual o de todos si es administrador.
 * @param {Object} [params] Parámetros opcionales de búsqueda y paginación.
 * @returns {Promise<Object>} Listado de envíos.
 */
export async function obtenerEnvios(params = {}) {
    return getRequest('/shipments/', params, { auth: true });
}

/**
 * Obtiene la información detallada de un envío por su ID.
 * @param {number|string} shipmentId ID del envío.
 * @returns {Promise<Object>} Información del envío.
 */
export async function obtenerEnvioPorId(shipmentId) {
    return getRequest(`/shipments/${shipmentId}/`, {}, { auth: true });
}

/**
 * (Admin) Actualiza el estado de un envío (in_transit, delivered, returned, failed).
 * @param {number|string} shipmentId ID del envío.
 * @param {string} status Nuevo estado del envío.
 * @returns {Promise<Object>} Envío actualizado.
 */
export async function actualizarEstadoEnvio(shipmentId, status) {
    return postRequest(`/shipments/${shipmentId}/update_status/`, { status }, { auth: true });
}

// Alias en inglés para mayor versatilidad
export const getDistributors = obtenerDistribuidores;
export const createShipment = crearEnvio;
export const getShipments = obtenerEnvios;
export const getShipmentById = obtenerEnvioPorId;
export const updateShipmentStatus = actualizarEstadoEnvio;
