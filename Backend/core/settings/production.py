from .base import *
import pymysql

pymysql.install_as_MySQLdb()

print("---------------- Production settings loaded ----------------")
# Channel Layers — Redis para producción (escala con múltiples workers)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("REDIS_URL", default="redis://127.0.0.1:6379")],
        },
    }
}

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS_DEPLOY', default=['backend.tuestante.com', 'tuestante.com', 'localhost', '127.0.0.1'])


CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOW_ALL_ORIGINS = env.bool('CORS_ALLOW_ALL_ORIGINS', default=False)
CORS_ALLOW_CREDENTIALS = True


# Configuración de Proxy Reverso (Apache / cPanel -> Uvicorn ASGI)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Database - Optimización de pool de conexiones para evitar cuellos de botella
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': env('MYSQL_DATABASE', default='nombre_base'),
        'USER': env('MYSQL_USER', default='usuario'),
        'PASSWORD': env('MYSQL_PASSWORD', default='contrasena'),
        'HOST': env('MYSQL_HOST', default='localhost'),
        'PORT': env('MYSQL_PORT', default='3306'),
        'CONN_MAX_AGE': env.int('DB_CONN_MAX_AGE', default=60),  # Reutilizar conexiones activas
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        }
    }
}           

# =========================================================
# RUTAS DE ARCHIVOS ESTÁTICOS Y MULTIMEDIA (cPanel)
# =========================================================
STATIC_ROOT = env(
    'STATIC_ROOT',
    default='/home/bectronix/backend.tuestante.com/public/static'
)
STATIC_URL = env('STATIC_URL', default='/public/static/')

MEDIA_ROOT = env(
    'MEDIA_ROOT',
    default='/home/bectronix/backend.tuestante.com/public/media'
)
MEDIA_URL = env('MEDIA_URL', default=env('MEDIA_BASE_URL', default='/public/media/'))


# =========================================================
# STORAGE (Almacenamiento Local en el mismo servidor)
# =========================================================
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}