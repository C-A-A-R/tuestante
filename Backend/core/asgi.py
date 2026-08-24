"""
ASGI config for core project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

from django_settings_env import Env

env = Env()

def main():
    if not bool(os.getenv('DEBUG', 'True')):
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.production')
    else:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.local')

application = get_asgi_application()
