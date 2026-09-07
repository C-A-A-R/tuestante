from rest_framework import serializers
from apps.production.models import ProductionOrder
from apps.orders.models import Order


class ProductionOrderSerializer(serializers.ModelSerializer):
    """Serializador principal para las Órdenes de Fabricación."""

    order_number = serializers.CharField(source='order.order_number', read_only=True)
    client_name = serializers.SerializerMethodField()
    order_status = serializers.CharField(source='order.status', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_items_summary = serializers.SerializerMethodField()

    class Meta:
        model = ProductionOrder
        fields = [
            'id',
            'order',
            'order_number',
            'client_name',
            'order_status',
            'order_items_summary',
            'iteration',
            'status',
            'status_display',
            'start_date',
            'estimated_completion_date',
            'actual_completion_date',
            'technical_notes',
            'is_deleted',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'iteration',
            'status_display',
            'order_number',
            'client_name',
            'order_status',
            'order_items_summary',
            'is_deleted',
            'created_at',
            'updated_at',
        ]

    def get_client_name(self, obj):
        if obj.order and obj.order.user:
            return obj.order.user.get_full_name() or obj.order.user.username or obj.order.user.email
        return None

    def get_order_items_summary(self, obj):
        """Retorna un resumen de los productos incluidos en el pedido para la hoja de taller."""
        if not obj.order:
            return []
        items_data = []
        for detail in obj.order.details.filter(is_deleted=False):
            for op in detail.order_products.filter(is_deleted=False):
                items_data.append({
                    'product_id': op.product.id,
                    'product_name': op.product.product_name,
                    'quantity': detail.quantity,
                    'notes': detail.notes or '',
                })
        return items_data

    def validate(self, attrs):
        request = self.context.get('request')
        order = attrs.get('order') or (self.instance.order if self.instance else None)

        if request and request.user and not request.user.is_staff:
            if order and order.user != request.user:
                raise serializers.ValidationError(
                    {"order": "No tienes permisos para gestionar la orden de fabricación de este pedido."}
                )
        return attrs


class ProductionOrderStatusUpdateSerializer(serializers.Serializer):
    """Serializador para actualizar la fase de una orden de producción."""

    status = serializers.ChoiceField(choices=ProductionOrder.STATUS_CHOICES, required=True)
    technical_notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    actual_completion_date = serializers.DateTimeField(required=False, allow_null=True)
