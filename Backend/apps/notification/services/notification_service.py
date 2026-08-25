"""
Servicio de notificaciones.

Centraliza la lógica de creación y envío de notificaciones,
desacoplando el resto de la aplicación de los detalles de implementación
(base de datos + WebSocket).
"""

import json
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def send_notification(user, title, message, notification_type='general', order=None):
    """
    Crea una notificación en base de datos y la envía en tiempo real al usuario
    a través de WebSocket usando Django Channels.

    Args:
        user: Instancia de User destinatario.
        title (str): Título de la notificación.
        message (str): Cuerpo del mensaje.
        notification_type (str): 'order' (vinculada a una orden) o 'general'.
        order: Instancia de Order relacionada (requerida cuando notification_type='order').

    Returns:
        Notification: Instancia creada.
    """
    from apps.notification.models import Notification

    # 1. Persistir la notificación en base de datos
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        order=order,
    )

    # 2. Enviar en tiempo real vía WebSocket al canal del usuario
    _push_to_websocket(notification)

    return notification


def _push_to_websocket(notification):
    """
    Envía la notificación al grupo WebSocket del usuario usando Channel Layers.
    El canal del usuario es `notifications_user_{id}`.
    """
    channel_layer = get_channel_layer()
    group_name = _user_group_name(notification.user_id)

    payload = {
        'type': 'notify',
        'data': {
            'id': notification.id,
            'title': notification.title,
            'message': notification.message,
            'notification_type': notification.notification_type,
            'order_id': notification.order_id,
            'is_read': notification.is_read,
            'created_at': str(notification.created_at),
        }
    }

    async_to_sync(channel_layer.group_send)(group_name, payload)


def _user_group_name(user_id):
    """Retorna el nombre del grupo de canal para un usuario."""
    return f"notifications_user_{user_id}"
