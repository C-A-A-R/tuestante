from rest_framework import serializers
from apps.notification.models import Notification, NotificationMedia


class NotificationMediaSerializer(serializers.ModelSerializer):
    """Serializer para Archivos Multimedia adjuntos a una notificación."""

    file_name = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = NotificationMedia
        fields = ['id', 'file', 'file_name', 'file_size', 'file_url', 'media_type', 'created_at']

    def get_file_name(self, obj):
        if obj.file and hasattr(obj.file, 'name'):
            return obj.file.name.split('/')[-1]
        return 'archivo'

    def get_file_size(self, obj):
        try:
            if obj.file and hasattr(obj.file, 'size'):
                bytes_val = obj.file.size
                if bytes_val >= 1024 * 1024:
                    return f"{bytes_val / (1024 * 1024):.1f} MB"
                elif bytes_val >= 1024:
                    return f"{bytes_val / 1024:.0f} KB"
                return f"{bytes_val} B"
        except Exception:
            pass
        return '-'

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return ''


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer para Notificaciones con soporte completo para panel administrativo."""

    media_files = NotificationMediaSerializer(many=True, read_only=True)
    user = serializers.StringRelatedField(read_only=True)
    user_id = serializers.ReadOnlyField(source='user.id')
    user_name = serializers.SerializerMethodField()
    user_email = serializers.ReadOnlyField(source='user.email')
    order_id = serializers.ReadOnlyField(source='order.id')
    order_number = serializers.SerializerMethodField()
    order_total = serializers.SerializerMethodField()
    order_status = serializers.ReadOnlyField(source='order.status')
    order_status_display = serializers.SerializerMethodField()
    internal_order_number = serializers.ReadOnlyField(source='internal_order.order_number')
    images_count = serializers.SerializerMethodField()
    videos_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'user',
            'user_id',
            'user_name',
            'user_email',
            'title',
            'message',
            'notification_type',
            'is_read',
            'is_manual',
            'status',
            'status_display',
            'order',
            'order_id',
            'order_number',
            'order_total',
            'order_status',
            'order_status_display',
            'internal_order',
            'internal_order_number',
            'media_files',
            'images_count',
            'videos_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username or 'Cliente'
        return 'Cliente'

    def get_order_number(self, obj):
        if obj.order:
            if obj.order.order_number:
                return obj.order.order_number
            return f"#{obj.order.id:05d}"
        return None

    def get_order_total(self, obj):
        if obj.order:
            return float(getattr(obj.order, 'total_price', 0) or 0)
        return None

    def get_order_status_display(self, obj):
        if obj.order:
            return obj.order.get_status_display()
        return None

    def get_images_count(self, obj):
        if hasattr(obj, 'media_files'):
            return sum(1 for m in obj.media_files.all() if m.media_type == 'image')
        return 0

    def get_videos_count(self, obj):
        if hasattr(obj, 'media_files'):
            return sum(1 for m in obj.media_files.all() if m.media_type == 'video')
        return 0
