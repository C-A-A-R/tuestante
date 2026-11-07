from rest_framework import serializers
from apps.shipment.models import Distributor, DistributorCoverage, Shipment


class DistributorCoverageSerializer(serializers.ModelSerializer):
    """Serializer para Coberturas de Distribuidores."""

    class Meta:
        model = DistributorCoverage
        fields = [
            'id',
            'distributor',
            'state',
            'municipality',
            'city',
            'estimated_days_min',
            'estimated_days_max',
            'base_shipping_cost',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DistributorSerializer(serializers.ModelSerializer):
    """Serializer para Distribuidores con información de coberturas."""

    coverage_type_display = serializers.CharField(source='get_coverage_type_display', read_only=True)
    cobertura_resumen = serializers.CharField(read_only=True)
    coverages = DistributorCoverageSerializer(many=True, read_only=True)

    class Meta:
        model = Distributor
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'rif',
            'coverage_type',
            'coverage_type_display',
            'cobertura_resumen',
            'coverages',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ShipmentSerializer(serializers.ModelSerializer):
    """Serializer para Envíos."""

    distributor_name = serializers.CharField(source='distributor.name', read_only=True, default='Flete Propio')
    distributor_rif = serializers.CharField(source='distributor.rif', read_only=True, default='')
    distributor_coverage_type = serializers.CharField(source='distributor.get_coverage_type_display', read_only=True, default='')
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    client_name = serializers.SerializerMethodField()
    client_phone = serializers.SerializerMethodField()
    client_email = serializers.SerializerMethodField()
    order_items = serializers.SerializerMethodField()

    class Meta:
        model = Shipment
        fields = [
            'id',
            'order',
            'order_number',
            'client_name',
            'client_phone',
            'client_email',
            'distributor',
            'distributor_name',
            'distributor_rif',
            'distributor_coverage_type',
            'state',
            'municipality',
            'city',
            'address',
            'status',
            'status_display',
            'estimated_date',
            'price',
            'notes',
            'delivered_at',
            'created_at',
            'updated_at',
            'order_items',
        ]
        read_only_fields = ['id', 'status', 'delivered_at', 'created_at', 'updated_at']

    def get_client_name(self, obj):
        if obj.order and obj.order.user:
            user = obj.order.user
            first_name = getattr(user, 'first_name', '') or ''
            first_last_name = getattr(user, 'first_last_name', '') or ''
            full_name = f"{first_name} {first_last_name}".strip()
            return full_name or user.username or "Cliente TuEstante"
        return "Cliente TuEstante"

    def get_client_phone(self, obj):
        if obj.order and obj.order.user:
            return getattr(obj.order.user, 'phone', '') or ''
        return ''

    def get_client_email(self, obj):
        if obj.order and obj.order.user:
            return getattr(obj.order.user, 'email', '') or ''
        return ''

    def get_order_items(self, obj):
        if not obj.order:
            return []
        items = []
        try:
            for detail in obj.order.details.all():
                for order_prod in detail.order_products.all():
                    prod_name = getattr(order_prod.product, 'product_name', None) or getattr(order_prod.product, 'name', 'Producto')
                    items.append({
                        "product_name": prod_name,
                        "quantity": detail.quantity,
                        "specs": detail.notes or "Estándar"
                    })
        except Exception:
            pass
        return items

    def to_internal_value(self, data):
        if isinstance(data, dict):
            mutable_data = data.copy()
            # Descartar coverage si viene de clientes antiguos para evitar errores
            mutable_data.pop('coverage', None)
            mutable_data.pop('cobertura', None)

            address_val = mutable_data.get('address') or mutable_data.get('direccion')
            if address_val and not isinstance(address_val, str):
                from apps.shipment.services import AddressNormalizationService
                norm = AddressNormalizationService.normalize(address_val)
                mutable_data['address'] = norm['address']
                if norm.get('state') and not mutable_data.get('state'):
                    mutable_data['state'] = norm['state']
                if norm.get('municipality') and not mutable_data.get('municipality'):
                    mutable_data['municipality'] = norm['municipality']
                if norm.get('city') and not mutable_data.get('city'):
                    mutable_data['city'] = norm['city']
            return super().to_internal_value(mutable_data)
        return super().to_internal_value(data)

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
