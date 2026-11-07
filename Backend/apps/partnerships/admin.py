from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.partnerships.models import Partnership


@admin.register(Partnership)
class PartnershipAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo Partnership."""

    list_display = (
        'id',
        'name',
        'logo',
        'is_active',
        'created_at',
        'updated_at'
    )
    search_fields = ('name', 'description')
    list_filter = ('is_active', 'is_deleted', 'created_at')
    ordering = ('id',)
