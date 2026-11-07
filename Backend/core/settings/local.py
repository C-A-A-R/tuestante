import os
from .base import *


# Channel Layers — InMemory para desarrollo local (no requiere Redis)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}

# Permitir peticiones desde cualquier origen y con credenciales (inseguro para producción)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

ALLOWED_HOSTS = ['*']

DATABASES = {
'default': {
    'ENGINE': 'django.db.backends.sqlite3',
    'NAME': str(os.path.join(BASE_DIR, "db.sqlite3")),
    }
}



STATIC_URL = '/static/'
STATICFILES_DIRS = (BASE_DIR, 'static')
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')