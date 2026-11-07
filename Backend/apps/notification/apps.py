from django.apps import AppConfig


class NotificationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notification'
    verbose_name = 'Notificaciones'

    def ready(self):
        """Conecta los signals al arrancar el servidor."""
        import apps.notification.signals  # noqa: F401
