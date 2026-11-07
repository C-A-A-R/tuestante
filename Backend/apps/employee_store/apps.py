from django.apps import AppConfig


class EmployeeStoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.employee_store'
    verbose_name = 'Tienda de Empleados'

    def ready(self):
        import apps.employee_store.signals  # noqa: F401
