from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.gallery.models import Gallery

User = get_user_model()


class GallerySerializer(serializers.ModelSerializer):
    """Serializer para la gestión de la Galería de imágenes."""

    user_detail = serializers.SerializerMethodField(read_only=True)
    estado = serializers.CharField(source='get_status_display', read_only=True)
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
        default=None
    )

    class Meta:
        model = Gallery
        fields = [
            'id',
            'user',
            'user_detail',
            'image',
            'caption',
            'status',
            'estado',
            'is_active',
            'social_network',
            'social_media_handle',
            'social_media_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user_detail', 'estado', 'created_at', 'updated_at']
        extra_kwargs = {
            'user': {'required': False, 'allow_null': True}
        }

    def to_internal_value(self, data):
        # Manejar datos enviados como multipart/form-data donde campos vacíos puedan ser '' o 'null'
        if hasattr(data, '_mutable'):
            data = data.copy()
            if 'user' in data and data['user'] in ['', 'null', 'undefined', 'None', None]:
                data['user'] = None
            if 'social_media_url' in data and data['social_media_url'] in ['#', '', 'null']:
                data['social_media_url'] = None
        elif isinstance(data, dict):
            data = dict(data)
            if data.get('user') in ['', 'null', 'undefined', 'None', None]:
                data['user'] = None
            if data.get('social_media_url') in ['#', '', 'null']:
                data['social_media_url'] = None
        return super().to_internal_value(data)

    def validate_social_media_url(self, value):
        if value in ['#', '']:
            return None
        return value

    def validate_caption(self, value):
        if value and len(value) > 255:
            raise serializers.ValidationError("La descripción no puede superar los 255 caracteres.")
        return value

    def get_user_detail(self, obj):
        if obj.user:
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'email': obj.user.email,
                'full_name': f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username,
                'is_staff': obj.user.is_staff
            }
        return None

