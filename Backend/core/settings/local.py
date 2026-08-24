import os
from .base import *
import pymysql

pymysql.install_as_MySQLdb()

# Permitir peticiones desde cualquier origen y con credenciales (inseguro para producción)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

ALLOWED_HOSTS = ['*']

# Database
# https://docs.djangoproject.com/en/3.1/ref/settings/#databases

bd_local= 'mysql_nube2'

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
elif bd_local == 'mysql_nube':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': '84b053e2-26e3-4c36-bb99-577ae658f414',
            'USER': 'root',
            'PASSWORD': 'sk_753f0637dbeafe23392690f82c4683a95fe944542a85bdcd8a7917e70b216cfb',
            'HOST': 'cloud.layerbase.dev',
            'PORT': '20414',
        }
    }
elif bd_local == 'mysql_nube2':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': 'tuestantedb',
            'USER': 'root',
            'PASSWORD': 'S3QPkL9wjjiboE7EYXG5iwPa',
            'HOST': 'cloud.layerbase.dev',
            'PORT': '20415',
        }
    }
else:
    DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(os.path.join(BASE_DIR, "db.sqlite3")),
    }
}


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.1/howto/static-files/

STATIC_URL = '/static/'
STATICFILES_DIRS = (BASE_DIR, 'static')
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
