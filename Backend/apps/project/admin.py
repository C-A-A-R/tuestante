from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.project.models import Project


@admin.register(Project)
class ProjectAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo Project."""

    list_display = (
        'id',
        'project_name',
        'project_document',
        'project_images',
        'is_deleted',
        'created_at',
        'updated_at'
    )
    search_fields = ('project_name', 'description')
    list_filter = ('is_deleted', 'created_at')
    ordering = ('id',)
