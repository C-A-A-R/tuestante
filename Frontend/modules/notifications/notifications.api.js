/**
 * ==========================================================================
 * TUESTANTE CLIENTE - SERVICIO API DE NOTIFICACIONES (NOTIFICATIONS.API.JS)
 * ==========================================================================
 * Proporciona métodos para consumir los endpoints de notificaciones de Django REST Framework
 * y gestionar la conexión en tiempo real vía WebSocket (Django Channels).
 */

import { apiRequest, backendOrigin, extractList } from '../../js/api.js';
import { getAccessToken } from '../../js/storage.js';

/**
 * Obtiene el listado de notificaciones del usuario autenticado
 * @param {Object} params - { search, is_read, notification_type, page, page_size }
 * @returns {Promise<Array>} Lista de notificaciones
 */
export async function fetchNotifications(params = {}) {
  const queryParams = {};

  if (params.search && params.search.trim()) {
    queryParams.search = params.search.trim();
  }

  if (params.is_read !== undefined && params.is_read !== null && params.is_read !== 'all') {
    queryParams.is_read = String(params.is_read);
  }

  if (params.notification_type && params.notification_type !== 'all') {
    queryParams.notification_type = params.notification_type;
  }

  if (params.page) {
    queryParams.page = params.page;
  }

  if (params.page_size) {
    queryParams.page_size = params.page_size;
  }

  const response = await apiRequest({
    path: '/notifications/',
    method: 'GET',
    params: queryParams,
    auth: true
  });

  return extractList(response);
}

/**
 * Obtiene el detalle completo de una notificación por su ID
 * @param {number|string} id 
 * @returns {Promise<Object>}
 */
export async function fetchNotificationDetail(id) {
  if (!id) throw new Error('Se requiere un ID de notificación.');

  return await apiRequest({
    path: `/notifications/${id}/`,
    method: 'GET',
    auth: true
  });
}

/**
 * Marca una notificación específica como leída
 * @param {number|string} id 
 * @returns {Promise<Object>}
 */
export async function markNotificationAsRead(id) {
  if (!id) return;

  return await apiRequest({
    path: `/notifications/${id}/mark_as_read/`,
    method: 'POST',
    auth: true
  });
}

/**
 * Marca todas las notificaciones no leídas del usuario como leídas
 * @returns {Promise<Object>}
 */
export async function markAllNotificationsAsRead() {
  return await apiRequest({
    path: '/notifications/mark_all_as_read/',
    method: 'POST',
    auth: true
  });
}

/**
 * Elimina lógicamente una notificación
 * @param {number|string} id 
 * @returns {Promise<void>}
 */
export async function deleteNotification(id) {
  if (!id) return;

  return await apiRequest({
    path: `/notifications/${id}/`,
    method: 'DELETE',
    auth: true
  });
}

/**
 * Obtiene el número de notificaciones no leídas
 * @returns {Promise<number>}
 */
export async function fetchUnreadCount() {
  try {
    const res = await apiRequest({
      path: '/notifications/unread_count/',
      method: 'GET',
      auth: true
    });
    return parseInt(res?.unread_count ?? 0, 10);
  } catch (error) {
    console.warn('[Notifications API] Error al obtener contador de no leídas:', error);
    return 0;
  }
}

/**
 * Establece una conexión WebSocket persistente para notificaciones en vivo
 * @param {Object} options - { onMessage, onStatusChange, reconnectDelay = 5000 }
 * @returns {WebSocket|null}
 */
export function connectNotificationsWebSocket({ onMessage, onStatusChange, reconnectDelay = 5000 } = {}) {
  const token = getAccessToken();
  if (!token) return null;

  try {
    let wsBase = backendOrigin;
    if (!wsBase || wsBase === '/') {
      wsBase = window.location.origin;
    }

    const urlObj = new URL(wsBase.startsWith('http') ? wsBase : `http://${wsBase}`, window.location.origin);
    const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${urlObj.host}/ws/notifications/?token=${encodeURIComponent(token)}`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      if (typeof onStatusChange === 'function') onStatusChange('connected');
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (typeof onMessage === 'function') onMessage(payload);
      } catch (err) {
        console.warn('[Notifications WS] Error al parsear mensaje:', err);
      }
    };

    socket.onerror = (err) => {
      console.warn('[Notifications WS] Error en socket:', err);
      if (typeof onStatusChange === 'function') onStatusChange('error');
    };

    socket.onclose = (event) => {
      if (typeof onStatusChange === 'function') onStatusChange('disconnected');
      // Reconectar si no fue cierre intencional
      if (event.code !== 1000) {
        setTimeout(() => {
          connectNotificationsWebSocket({ onMessage, onStatusChange, reconnectDelay });
        }, reconnectDelay);
      }
    };

    return socket;
  } catch (e) {
    console.warn('[Notifications WS] No se pudo inicializar WebSocket:', e);
    return null;
  }
}
