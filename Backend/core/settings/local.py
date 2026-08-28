import os
from .base import *
import pymysql

pymysql.install_as_MySQLdb()

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

media = 'local'
bd_local= 'local'

if bd_local == 'mysql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': 'tuestantelocalbd',
            'USER': 'admin',
            'PASSWORD': 'admin',
            'HOST': '127.0.0.1',
            'PORT': '3306',
        }
    }

elif bd_local == 'mysql_cpanel':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': 'tuestante',
            'USER': 'tuestante',
            'PASSWORD': 'fwRwL3GqRmAHrBy',
            'HOST': 'bectronix.net',
            'PORT': '3306',
        }
    }

else:
    DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(os.path.join(BASE_DIR, "db.sqlite3")),
    }
}


if media == "local":
    STATIC_URL = '/static/'
    STATICFILES_DIRS = (BASE_DIR, 'static')
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
    
else:
    # --- Configuración de almacenamiento Multimedia vía FTP ---
    # =========================================================
    # FTPS
    # =========================================================

    FTP_USER = env("FTP_USER", default="").strip()
    FTP_PASSWORD = env("FTP_PASSWORD", default="")
    FTP_HOST = env("FTP_HOST", default="").strip()
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
