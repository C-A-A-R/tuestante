from rest_framework import serializers
from apps.shipment.models import Distributor, Shipment


class DistributorSerializer(serializers.ModelSerializer):
    """Serializer para Distribuidores."""

    class Meta:
        model = Distributor
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'rif',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ShipmentSerializer(serializers.ModelSerializer):
    """Serializer para Envíos."""

    class Meta:
        model = Shipment
        fields = [
            'id',
            'order',
            'distributor',
            'address',
            'phone',
            'status',
            'estimated_date',
            'price',
            'notes',
            'delivered_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'status', 'delivered_at', 'created_at', 'updated_at']

    def validate(self, attrs):
        """Validar permisos sobre el pedido si no es administrador."""
        order = attrs.get('order')
        request = self.context.get('request')

        if request and request.user and not request.user.is_staff:
            if order.user != request.user:
                raise serializers.ValidationError(
                    {"order": "No tienes permisos para ver o modificar el envío de este pedido."}
                )
        return attrs
