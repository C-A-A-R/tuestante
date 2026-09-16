from rest_framework import serializers
from apps.orders.models import Order, OrderDetail, OrderProduct, ManufacturingOrder
from apps.product.api.serializers import ProductSerializer
from apps.shipment.api.serializers import ShipmentSerializer
from apps.production.api.serializers import ProductionOrderSerializer


class OrderProductSerializer(serializers.ModelSerializer):
    """Serializer para Productos asociados a un detalle de pedido."""

    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=ProductSerializer.Meta.model.objects.filter(is_deleted=False),
        source='product',
        write_only=True
    )

    class Meta:
        model = OrderProduct
        fields = [
            'id',
            'order_detail',
            'product',
            'product_id',
            'price_at_order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'order_detail', 'price_at_order', 'created_at', 'updated_at']


class OrderDetailSerializer(serializers.ModelSerializer):
    """Serializer para Detalles del pedido."""

    order_products = OrderProductSerializer(many=True, read_only=True)

    class Meta:
        model = OrderDetail
        fields = [
            'id',
            'order',
            'quantity',
            'unit_price',
            'final_price',
            'notes',
            'order_products',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'order', 'final_price', 'order_products', 'created_at', 'updated_at']


class ManufacturingOrderSerializer(serializers.ModelSerializer):
    """Serializer para Órdenes de fabricación."""

    issued_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = ManufacturingOrder
        fields = [
            'id',
            'order',
            'status',
            'iteration',
            'issued_by',
            'issued_at',
            'completed_at',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'order', 'iteration', 'issued_by', 'issued_at', 'created_at', 'updated_at']


class OrderSerializer(serializers.ModelSerializer):
    """Serializer para la cabecera y el detalle completo de un Pedido."""

    user = serializers.StringRelatedField(read_only=True)
    details = OrderDetailSerializer(many=True, read_only=True)
    manufacturing_orders = ManufacturingOrderSerializer(many=True, read_only=True)
    production_orders = ProductionOrderSerializer(many=True, read_only=True)
    shipments = ShipmentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'user',
            'status',
            'total_price',
            'notes',
            'reception_notes',
            'reception_date',
            'details',
            'manufacturing_orders',
            'production_orders',
            'shipments',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'order_number', 'user', 'total_price', 'reception_date', 'details', 'manufacturing_orders', 'production_orders', 'shipments', 'created_at', 'updated_at']
