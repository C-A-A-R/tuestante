"""
WSGI config for core project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

import importlib.util
from django.core.wsgi import get_wsgi_application
from django_settings_env import Env

env = Env()

# Obtener DEBUG como booleano de forma correcta usando django_settings_env
is_debug = env.bool('DEBUG', default=True)

if not is_debug:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.production')
else:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.local')

application = get_wsgi_application()
