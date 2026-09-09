from django_settings_env import Env
from datetime import timedelta
from pathlib import Path
import os


# Objeto para acceder a las variables globales
env = Env()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool('DEBUG')

# Application definition

BASE_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

LOCAL_APPS = [
    'apps.base',
    'apps.user',
    'apps.product',
    'apps.project',
    'apps.orders',
    'apps.production',
    'apps.payment',
    'apps.shipment',
    'apps.notification',
    'apps.gallery',
    'apps.invoice',
    'apps.employee_store',
]


THIRD_APPS = [
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'simple_history',
    'drf_yasg',
    'storages',
    'channels',
    # 'import_export',
]

INSTALLED_APPS = BASE_APPS + THIRD_APPS + LOCAL_APPS

ASGI_APPLICATION = 'core.asgi.application'



X_FRAME_OPTIONS = "SAMEORIGIN"
SILENCED_SYSTEM_CHECKS = ["security.W019"]


SWAGGER_SETTINGS = {
    'DOC_EXPANSION': 'none'
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    )
}

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'


# Password validation
# https://docs.djangoproject.com/en/3.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
# https://docs.djangoproject.com/en/3.1/topics/i18n/

LANGUAGE_CODE = 'es'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True

AUTH_USER_MODEL = 'user.User'


DATE_INPUT_FORMATS = [
    '%d-%m-%Y', 
    '%Y-%m-%d',
]

CORS_ALLOWED_ORIGINS = env.list(
    'CORS_ALLOWED_ORIGINS',
    default=[
        "http://localhost:8000",
        "http://localhost:3000",
        "http://localhost:5500",
        "https://tuestante.com",
        "https://www.tuestante.com",
    ]
)

CORS_ALLOW_ALL_ORIGINS = env.bool('CORS_ALLOW_ALL_ORIGINS', default=False)
CORS_ALLOW_CREDENTIALS = env.bool('CORS_ALLOW_CREDENTIALS', default=True)

SIMPLE_JWT = {
    # Access token corto para reducir la ventana de exposición si se filtra
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    # Refresh token más largo para buena UX, pero rotado y blacklistado
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    # Puedes ajustar ALGORITHM o SIGNING_KEY si usas claves rotativas
}

CORS_EXPOSE_HEADERS = [
    "Content-Disposition",
]

# Configuración del correo
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('DJANGO_EMAIL_HOST')  # Servidor SMTP
EMAIL_PORT = env.int('DJANGO_EMAIL_PORT')  # Puerto SMTP
EMAIL_HOST_USER = env('DJANGO_EMAIL_HOST_USER')  # Cuenta de correo
EMAIL_HOST_PASSWORD = env('DJANGO_EMAIL_HOST_PASSWORD')  # Contraseña de la cuenta de correo
EMAIL_USE_SSL = env.bool('DJANGO_EMAIL_USE_SSL', default=True)  # Activar SSL
EMAIL_USE_TLS = env.bool('DJANGO_EMAIL_USE_TLS', default=False)  # Desactivar TLS (solo uno debe estar activo)
DEFAULT_FROM_EMAIL = env('DJANGO_EMAIL_HOST_USER')  # Email por defecto

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.1/howto/static-files/

STATIC_URL = '/static/'
# Ruta donde collectstatic reunirá los archivos estáticos para producción
# Nota: BASE_DIR apunta a "Backend/core" en esta estructura de proyecto
# por lo que los archivos se recopilarán en "Backend/core/staticfiles"
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = '/media/'
# Usamos la carpeta existente "Backend/core/media" para archivos subidos
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
