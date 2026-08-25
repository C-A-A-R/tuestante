"""
ASGI config for core project.

Soporta tanto HTTP (Django) como WebSocket (Django Channels).
"""

import os
from django.core.asgi import get_asgi_application
from django_settings_env import Env

env = Env()

if not bool(os.getenv('DEBUG', 'True')):
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.production')
else:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.local')

# Inicializar Django antes de importar módulos que usen modelos
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from apps.notification.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    # Peticiones HTTP estándar — manejadas por Django
    "http": django_asgi_app,

    # Conexiones WebSocket — manejadas por Channels con autenticación JWT
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})

