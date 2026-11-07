"""Rutas WebSocket para la app de notificaciones."""

from django.urls import path
from apps.notification.consumers import NotificationConsumer

websocket_urlpatterns = [
    path('ws/notifications/', NotificationConsumer.as_asgi()),
]
