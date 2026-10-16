from rest_framework import serializers
from apps.partnerships.models import Partnership


class PartnershipSerializer(serializers.ModelSerializer):
    """Serializador para el modelo Partnership."""

    class Meta:
        model = Partnership
        fields = [
            'id',
            'name',
            'logo',
            'description',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
