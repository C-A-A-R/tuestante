from rest_framework import serializers
from apps.gallery.models import Gallery


class GallerySerializer(serializers.ModelSerializer):
    """Serializer para la gestión de la Galería de imágenes."""

    user_detail = serializers.SerializerMethodField(read_only=True)
    estado = serializers.CharField(source='get_status_display', read_only=True)

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

