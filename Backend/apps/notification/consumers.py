"""
WebSocket Consumer para notificaciones en tiempo real.

Cada usuario autenticado se conecta a su canal personal:
  ws://<host>/ws/notifications/

El consumer añade la conexión al grupo `notifications_user_{id}`,
de forma que el servicio de notificaciones puede enviar mensajes
a ese grupo y el usuario los recibirá en tiempo real.
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    """Consumer WebSocket para notificaciones de usuario."""

    async def connect(self):
        """
        Acepta la conexión solo si el usuario está autenticado.
        Lo une al grupo personal de notificaciones.
        """
        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_id = user.id
        self.group_name = f"notifications_user_{self.user_id}"

        # Unirse al grupo personal del usuario
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        # Si el usuario es administrador/staff, unirse también al grupo general de admins
        if user.is_staff:
            self.admin_group_name = "notifications_admins"
            await self.channel_layer.group_add(
                self.admin_group_name,
                self.channel_name
            )

        await self.accept()

    async def disconnect(self, close_code):
        """Elimina el canal del grupo al desconectarse."""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        if hasattr(self, 'admin_group_name'):
            await self.channel_layer.group_discard(
                self.admin_group_name,
                self.channel_name
            )

    async def receive(self, text_data=None, bytes_data=None):
        """
        Recibe mensajes del cliente (p.ej. marcar notificación como leída).
        Formato esperado: {"action": "mark_read", "notification_id": 5}
        """
        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        action = data.get('action')

        if action == 'mark_read':
            notification_id = data.get('notification_id')
            if notification_id:
                await self._mark_notification_read(notification_id)

    async def notify(self, event):
        """
        Manejador para mensajes del tipo 'notify' enviados desde el channel layer.
        Reenvía el payload al cliente WebSocket.
        """
        await self.send(text_data=json.dumps(event.get('data', {})))

    async def _mark_notification_read(self, notification_id):
        """Marca una notificación como leída de forma asíncrona."""
        from channels.db import database_sync_to_async
        from apps.notification.models import Notification

        @database_sync_to_async
        def _do_mark(nid, uid):
            try:
                notif = Notification.objects.get(id=nid, user_id=uid, is_deleted=False)
                notif.mark_as_read()
            except Notification.DoesNotExist:
                pass

        await _do_mark(notification_id, self.user_id)

