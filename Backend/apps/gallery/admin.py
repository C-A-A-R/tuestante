from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.gallery.models import Gallery


@admin.register(Gallery)
class GalleryAdmin(BaseAdmin):
    """Panel de administración para la Galería de Imágenes."""

    list_display = [
        'id',
        'caption',
        'social_network',
        'social_media_handle',
        'is_active',
        'created_at',
    ]
    list_filter = ['is_active', 'social_network', 'created_at', 'is_deleted']
    search_fields = ['caption', 'social_network', 'social_media_handle', 'social_media_url']
    ordering = ['-created_at']
    actions = ['activate_images', 'deactivate_images']

    @admin.action(description="Activar imagen(es) seleccionada(s)")
    def activate_images(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"{count} imagen(es) activada(s).")

    @admin.action(description="Desactivar imagen(es) seleccionada(s)")
    def deactivate_images(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f"{count} imagen(es) desactivada(s).")
