from django.apps import AppConfig


class BaseConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.base'

    def ready(self):
        # Import signals so they are registered when Django starts
        try:
            from . import signals  # noqa: F401
        except Exception:
            # Avoid crashing on import errors during manage.py commands; errors
            # will surface in normal runtime and should be handled there.
            pass
