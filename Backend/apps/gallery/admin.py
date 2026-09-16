from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.gallery.models import Gallery


@admin.register(Gallery)
class GalleryAdmin(BaseAdmin):
    """Panel de administración para la Galería de Imágenes."""

    list_display = [
        'id',
        'caption',
        'user',
        'status',
        'social_network',
        'social_media_handle',
        'is_active',
        'created_at',
    ]
    list_filter = ['status', 'is_active', 'social_network', 'created_at', 'is_deleted']
    search_fields = ['caption', 'user__username', 'user__email', 'social_network', 'social_media_handle', 'social_media_url']
    raw_id_fields = ['user']
    ordering = ['-created_at']
    actions = ['activate_images', 'deactivate_images', 'approve_images', 'reject_images']

    def save_model(self, request, obj, form, change):
        if not obj.user:
            obj.user = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description="Aprobar multimedia seleccionada(s)")
    def approve_images(self, request, queryset):
        count = queryset.update(status=Gallery.STATUS_APPROVED)
        self.message_user(request, f"{count} imagen(es) aprobada(s).")

    @admin.action(description="Rechazar multimedia seleccionada(s)")
    def reject_images(self, request, queryset):
        count = queryset.update(status=Gallery.STATUS_REJECTED)
        self.message_user(request, f"{count} imagen(es) rechazada(s).")

    @admin.action(description="Activar imagen(es) seleccionada(s)")
    def activate_images(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"{count} imagen(es) activada(s).")

    @admin.action(description="Desactivar imagen(es) seleccionada(s)")
    def deactivate_images(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f"{count} imagen(es) desactivada(s).")

