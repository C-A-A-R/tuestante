from rest_framework import serializers
from apps.notification.models import Notification, NotificationMedia


class NotificationMediaSerializer(serializers.ModelSerializer):
    """Serializer para Archivos Multimedia adjuntos a una notificación."""

    class Meta:
        model = NotificationMedia
        fields = ['id', 'file', 'media_type', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer para Notificaciones."""

    media_files = NotificationMediaSerializer(many=True, read_only=True)
    user = serializers.StringRelatedField(read_only=True)
    internal_order_number = serializers.ReadOnlyField(source='internal_order.order_number')

    class Meta:
        model = Notification
        fields = [
            'id',
            'user',
            'title',
            'message',
            'notification_type',
            'is_read',
            'order',
            'internal_order',
            'internal_order_number',
            'media_files',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'title',
            'message',
            'notification_type',
            'is_read',
            'order',
            'internal_order',
            'internal_order_number',
            'media_files',
            'created_at',
            'updated_at',
        ]
