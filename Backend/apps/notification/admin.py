from django.contrib import admin

from apps.base.admin import BaseAdmin
from apps.notification.models import Notification, NotificationMedia
from apps.notification.services.notification_service import _push_to_websocket


class NotificationMediaInline(admin.TabularInline):
    model = NotificationMedia
    extra = 0
    fields = ['file', 'media_type']


@admin.register(Notification)
class NotificationAdmin(BaseAdmin):
    """Panel de administración para la gestión y re-envío de Notificaciones."""

    list_display = [
        'id',
        'user',
        'title',
        'notification_type',
        'order',
        'is_read',
        'created_at',
    ]
    list_filter = ['notification_type', 'is_read', 'created_at', 'is_deleted']
    search_fields = [
        'id',
        'user__username',
        'user__email',
        'title',
        'message',
        'order__id',
    ]
    autocomplete_fields = ['user', 'order']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [NotificationMediaInline]
    ordering = ['-created_at']
    actions = ['mark_as_read', 'resend_websocket_notification']

    @admin.action(description="Marcar seleccionadas como leídas")
    def mark_as_read(self, request, queryset):
        count = queryset.update(is_read=True)
        self.message_user(request, f"{count} notificación(es) marcada(s) como leída(s).")

    @admin.action(description="Re-enviar notificación por WebSocket en tiempo real")
    def resend_websocket_notification(self, request, queryset):
        for notif in queryset:
            _push_to_websocket(notif)
        self.message_user(request, f"{queryset.count()} notificación(es) re-enviada(s) vía WebSocket.")


@admin.register(NotificationMedia)
class NotificationMediaAdmin(BaseAdmin):
    """Panel de administración para Archivos Multimedia de Notificaciones."""

    list_display = ['id', 'notification', 'media_type', 'file', 'created_at']
    list_filter = ['media_type', 'created_at']
    search_fields = ['notification__title', 'notification__user__username']
    autocomplete_fields = ['notification']
    ordering = ['-created_at']
