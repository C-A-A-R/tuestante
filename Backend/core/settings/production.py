from .base import *
import pymysql

pymysql.install_as_MySQLdb()

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS_DEPLOY', default=['localhost', '127.0.0.1'])

# Database
# https://docs.djangoproject.com/en/3.1/ref/settings/#databases

if env.str('SERVICION_BD', default='layerbase') == 'layerbase':
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
            'ENGINE': 'django.db.backends.mysql',
            'NAME': env('MYSQL_DATABASE', default='nombre_base'),
            'USER': env('MYSQL_USER', default='usuario'),
        'PASSWORD': env('MYSQL_PASSWORD', default='contraseña'),
        'HOST': env('MYSQL_HOST', default='localhost'),
        'PORT': env('MYSQL_PORT', default='3306'),
    }
}

STATIC_ROOT='/home/dominio/public_html/static'
MEDIA_ROOT='/home/dominio/public_html/media'