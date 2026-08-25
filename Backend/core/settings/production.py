from .base import *
import pymysql

pymysql.install_as_MySQLdb()

# Channel Layers — Redis para producción (escala con múltiples workers)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("REDIS_URL", default="redis://127.0.0.1:6379")],
        },
    }
}

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS_DEPLOY', default=[])


CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS',default=[])
CORS_ALLOW_ALL_ORIGINS = env.bool('CORS_ALLOW_ALL_ORIGINS', default=False)
CORS_ALLOW_CREDENTIALS = True


# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': env('MYSQL_DATABASE', default='nombre_base'),
        'USER': env('MYSQL_USER', default='usuario'),
        'PASSWORD': env('MYSQL_PASSWORD', default='contraseña'),
        'HOST': env('MYSQL_HOST', default='localhost'),
        'PORT': env('MYSQL_PORT', default='3306'),
    }
}           

# --- Configuración de almacenamiento Multimedia vía FTP ---
# =========================================================
# FTPS
# =========================================================

FTP_USER = env("FTP_USER").strip()
FTP_PASSWORD = env("FTP_PASSWORD")
FTP_HOST = env("FTP_HOST").strip()
FTP_PORT = env("FTP_PORT", default="21").strip()


FTP_LOCATION = (
    f"ftps://"
    f"{FTP_USER}:"
    f"{FTP_PASSWORD}@"
    f"{FTP_HOST}:"
    f"{FTP_PORT}/"
)


# =========================================================
# MEDIA
# =========================================================

MEDIA_URL = env(
    "MEDIA_BASE_URL",
    default="https://imagenes-tu-estante.tuestante.com/"
)


# =========================================================
# STORAGE
# =========================================================

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.ftp.FTPStorage",
        "OPTIONS": {
            "location": FTP_LOCATION,
            "base_url": MEDIA_URL,
        },
    },

    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage."
            "StaticFilesStorage"
        ),
    },
}