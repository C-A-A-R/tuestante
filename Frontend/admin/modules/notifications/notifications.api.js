/**
 * ==========================================================================
 * TUESTANTE ADMIN - SERVICIO API DE NOTIFICACIONES (NOTIFICATIONS.API.JS)
 * ==========================================================================
 * Conecta con los endpoints de Django REST Framework para la gestión de:
 * - Listado de notificaciones globales (con paginación, filtros y búsqueda).
 * - Agrupación de pedidos con notificaciones (by_order).
 * - Creación de notificaciones manuales con archivos adjuntos.
 * - Marcado de estado (leído / no leído) y eliminación.
 */

import { apiRequest } from '../../js/api.js';

/**
 * Obtiene el listado de notificaciones con soporte para paginación y filtros
 * @param {Object} params - { page, page_size, search, is_manual, status, all: true }
 */
export async function obtenerNotificaciones(params = {}) {
  const queryParams = {
    all: 'true',
    page: params.page || 1,
    page_size: params.pageSize || 10,
    ...(params.search ? { search: params.search } : {}),
    ...(params.isManual !== undefined && params.isManual !== 'all' ? { is_manual: params.isManual } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {})
  };

  return await apiRequest({
    path: '/notifications/',
    method: 'GET',
    params: queryParams
  });
}

/**
 * Obtiene el listado de pedidos agrupados con sus respectivas notificaciones
 * @param {Object} params - { search, type, status }
 */
export async function obtenerNotificacionesPorPedido(params = {}) {
  const queryParams = {
    ...(params.search ? { search: params.search } : {}),
    ...(params.type && params.type !== 'all' ? { type: params.type } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {})
  };

  return await apiRequest({
    path: '/notifications/by_order/',
    method: 'GET',
    params: queryParams
  });
}

/**
 * Obtiene el detalle completo de una notificación por su ID
 * @param {number|string} id 
 */
export async function obtenerDetalleNotificacion(id) {
  return await apiRequest({
    path: `/notifications/${id}/`,
    method: 'GET'
  });
}

/**
 * Marca una notificación como leída
 * @param {number|string} id 
 */
export async function marcarNotificacionLeida(id) {
  return await apiRequest({
    path: `/notifications/${id}/mark_as_read/`,
    method: 'POST'
  });
}

/**
 * Marca todas las notificaciones pendientes como leídas
 */
export async function marcarTodasNotificacionesLeidas() {
  return await apiRequest({
    path: '/notifications/mark_all_as_read/',
    method: 'POST'
  });
}

/**
 * Elimina lógicamente una notificación
 * @param {number|string} id 
 */
export async function eliminarNotificacion(id) {
  return await apiRequest({
    path: `/notifications/${id}/`,
    method: 'DELETE'
  });
}

/**
 * Crea y envía una notificación manual con soporte para imágenes y videos
 * @param {FormData} formData 
 */
export async function crearNotificacionManual(formData) {
  return await apiRequest({
    path: '/notifications/create_manual/',
    method: 'POST',
    body: formData
  });
}

/**
 * Obtiene la lista de pedidos activos para el selector del modal
 */
export async function obtenerPedidosSelector() {
  try {
    const res = await apiRequest({
      path: '/orders/',
      method: 'GET',
      params: { limit: 100 }
    });
    return Array.isArray(res) ? res : (res?.results || []);
  } catch (e) {
    console.warn('[Notificaciones API] Error al obtener pedidos:', e);
    return [];
  }
}

/**
 * Obtiene la lista de clientes para el selector directo
 */
export async function obtenerClientesSelector() {
  try {
    const res = await apiRequest({
      path: '/users/',
      method: 'GET',
      params: { role: 'client', limit: 100 }
    });
    return Array.isArray(res) ? res : (res?.results || []);
  } catch (e) {
    console.warn('[Notificaciones API] Error al obtener clientes:', e);
    return [];
  }
}

/**
 * Actualiza una notificación existente (asunto, mensaje, adjuntos)
 * @param {number|string} id 
 * @param {FormData} formData 
 */
export async function actualizarNotificacion(id, formData) {
  return await apiRequest({
    path: `/notifications/${id}/`,
    method: 'PATCH',
    body: formData
  });
}
