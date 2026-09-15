/**
 * ==========================================================================
 * TUESTANTE - SERVICIO API DE NOTIFICACIONES (EMPLOYEE STORE)
 * ==========================================================================
 * Permite listar, filtrar y marcar como leídas las notificaciones
 * de pedidos y nómina para el colaborador autenticado.
 */

import { getRequest, postRequest, extractList } from '../../../js/api.js';

/**
 * Consulta la lista de notificaciones del colaborador autenticado.
 * @param {Object} [params] Filtros opcionales: { is_read, notification_type, internal_order_id }
 * @returns {Promise<Array>} Lista de notificaciones
 */
export async function obtenerNotificaciones(params = {}) {
  try {
    const response = await getRequest('/notifications/', params, { auth: true });
    return extractList(response);
  } catch (error) {
    console.error('[NotificationAPI] Error al obtener notificaciones:', error);
    return [];
  }
}

/**
 * Marca una notificación individual como leída.
 * @param {number|string} id ID de la notificación
 * @returns {Promise<Object>}
 */
export async function marcarNotificacionLeida(id) {
  try {
    return await postRequest(`/notifications/${id}/mark_as_read/`, {}, { auth: true });
  } catch (error) {
    console.error(`[NotificationAPI] Error al marcar notificación ${id} como leída:`, error);
    throw error;
  }
}

/**
 * Marca todas las notificaciones pendientes del colaborador como leídas.
 * @returns {Promise<Object>}
 */
export async function marcarTodasLeidas() {
  try {
    return await postRequest('/notifications/mark_all_as_read/', {}, { auth: true });
  } catch (error) {
    console.error('[NotificationAPI] Error al marcar todas como leídas:', error);
    throw error;
  }
}
