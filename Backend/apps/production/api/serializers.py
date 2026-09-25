from rest_framework import serializers
from apps.production.models import ProductionOrder
from apps.orders.models import Order


class ProductionOrderSerializer(serializers.ModelSerializer):
    """Serializador principal para las Órdenes de Fabricación."""

    order_number = serializers.CharField(source='order.order_number', read_only=True)
    client_name = serializers.SerializerMethodField()
    client_phone = serializers.SerializerMethodField()
    order_status = serializers.CharField(source='order.status', read_only=True)
    order_status_display = serializers.CharField(source='order.get_status_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_items_summary = serializers.SerializerMethodField()

    class Meta:
        model = ProductionOrder
        fields = [
            'id',
            'order',
            'order_number',
            'client_name',
            'client_phone',
            'order_status',
            'order_status_display',
            'order_items_summary',
            'iteration',
            'status',
            'status_display',
            'start_date',
            'estimated_completion_date',
            'actual_completion_date',
            'technical_notes',
            'technical_design',
            'blueprint_svg',
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
            'client_phone',
            'order_status',
            'order_status_display',
            'order_items_summary',
            'technical_design',
            'blueprint_svg',
            'is_deleted',
            'created_at',
            'updated_at',
        ]

    def get_client_name(self, obj):
        if obj.order and obj.order.user:
            return obj.order.user.get_full_name() or obj.order.user.username or obj.order.user.email
        return None

    def get_client_phone(self, obj):
        if obj.order and obj.order.user and hasattr(obj.order.user, 'phone'):
            return obj.order.user.phone or ''
        return ''

    def get_order_items_summary(self, obj):
        """Retorna un resumen de los productos incluidos en el pedido para la hoja de taller."""
        if not obj.order:
            return []
        items_data = []
        request = self.context.get('request')
        for detail in obj.order.details.filter(is_deleted=False):
            for op in detail.order_products.filter(is_deleted=False):
                prod = op.product
                img_url = None
                if prod:
                    if prod.product_image:
                        try:
                            img_url = prod.product_image.url
                        except Exception:
                            pass
                    if not img_url:
                        first_color = prod.color_images.filter(is_deleted=False).first()
                        if first_color and first_color.color_image:
                            try:
                                img_url = first_color.color_image.url
                            except Exception:
                                pass
                    if not img_url:
                        first_angle = prod.angle_images.filter(is_deleted=False).first()
                        if first_angle and first_angle.image:
                            try:
                                img_url = first_angle.image.url
                            except Exception:
                                pass
                    if not img_url and prod.product_type and prod.product_type.product_type_image:
                        try:
                            img_url = prod.product_type.product_type_image.url
                        except Exception:
                            pass

                if img_url and request:
                    try:
                        img_url = request.build_absolute_uri(img_url)
                    except Exception:
                        pass

                items_data.append({
                    'detail_id': detail.id,
                    'product_id': prod.id if prod else None,
                    'product_name': prod.product_name if prod else 'Producto',
                    'sku': f"PROD-{prod.id}" if prod else "",
                    'image': img_url,
                    'quantity': detail.quantity,
                    'notes': detail.notes or '',
                    'technical_design': detail.technical_design,
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
