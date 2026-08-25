from rest_framework import serializers
from apps.gallery.models import Gallery


class GallerySerializer(serializers.ModelSerializer):
    """Serializer para la gestión de la Galería de imágenes."""

    class Meta:
        model = Gallery
        fields = [
            'id',
            'image',
            'caption',
            'is_active',
            'social_network',
            'social_media_handle',
            'social_media_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
