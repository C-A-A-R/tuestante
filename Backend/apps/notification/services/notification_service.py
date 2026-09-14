"""
Servicio de notificaciones.

Centraliza la lógica de creación y envío de notificaciones,
desacoplando el resto de la aplicación de los detalles de implementación
(base de datos + WebSocket).
"""

import json
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def send_notification(user, title, message, notification_type='general', order=None, internal_order=None):
    """
    Crea una notificación en base de datos y la envía en tiempo real al usuario
    a través de WebSocket usando Django Channels.

    Args:
        user: Instancia de User destinatario.
        title (str): Título de la notificación.
        message (str): Cuerpo del mensaje.
        notification_type (str): 'order', 'employee_order', 'payroll' o 'general'.
        order: Instancia de Order relacionada (tienda cliente).
        internal_order: Instancia de InternalOrder relacionada (tienda empleados).

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
        internal_order=internal_order,
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
            'internal_order_id': notification.internal_order_id,
            'is_read': notification.is_read,
            'created_at': str(notification.created_at),
        }
    }

    async_to_sync(channel_layer.group_send)(group_name, payload)


def _user_group_name(user_id):
    """Retorna el nombre del grupo de canal para un usuario."""
    return f"notifications_user_{user_id}"


def send_notification_to_admins(title, message, notification_type='general', order=None, internal_order=None):
    """
    Envía una notificación a todos los usuarios administradores activos (is_staff=True).
    Registra la notificación en la base de datos para cada administrador y la despacha
    en tiempo real vía WebSocket.

    Args:
        title (str): Título de la alerta.
        message (str): Cuerpo del mensaje.
        notification_type (str): 'order', 'employee_order', 'payroll' o 'general'.
        order: Instancia de Order relacionada (opcional).
        internal_order: Instancia de InternalOrder relacionada (opcional).

    Returns:
        list[Notification]: Lista de notificaciones creadas.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    admins = User.objects.filter(is_staff=True, is_active=True, is_deleted=False)
    created_notifications = []
    for admin in admins:
        notif = send_notification(
            user=admin,
            title=title,
            message=message,
            notification_type=notification_type,
            order=order,
            internal_order=internal_order
        )
        created_notifications.append(notif)
    return created_notifications
