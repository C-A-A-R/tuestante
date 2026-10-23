from rest_framework import serializers
from apps.production.models import ProductionOrder, ProductionProduct
from apps.orders.models import Order


class ProductionProductSerializer(serializers.ModelSerializer):
    """Serializador para cada producto físico individual en taller."""

    order_id = serializers.IntegerField(source='production_order.order_id', read_only=True)
    order_number = serializers.CharField(source='production_order.order.order_number', read_only=True)
    client_name = serializers.SerializerMethodField()
    client_phone = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    stage_dates = serializers.SerializerMethodField()

    class Meta:
        model = ProductionProduct
        fields = [
            'id',
            'production_order',
            'order_id',
            'order_number',
            'client_name',
            'client_phone',
            'order_detail',
            'product',
            'product_name',
            'product_image',
            'product_number',
            'unit_index',
            'status',
            'status_display',
            'queued_at',
            'assembling_at',
            'painting_at',
            'quality_check_at',
            'completed_at',
            'stage_dates',
            'stage_history',
            'notes',
            'technical_design',
            'is_deleted',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'order_id',
            'order_number',
            'client_name',
            'client_phone',
            'product_name',
            'product_image',
            'status_display',
            'stage_dates',
            'stage_history',
            'queued_at',
            'assembling_at',
            'painting_at',
            'quality_check_at',
            'completed_at',
            'is_deleted',
            'created_at',
            'updated_at',
        ]

    def get_client_name(self, obj):
        order = getattr(obj.production_order, 'order', None)
        if order and order.user:
            return order.user.get_full_name() or order.user.username or order.user.email
        return None

    def get_client_phone(self, obj):
        order = getattr(obj.production_order, 'order', None)
        if order and order.user and hasattr(order.user, 'phone'):
            return order.user.phone or ''
        return ''

    def get_product_name(self, obj):
        if obj.product:
            return obj.product.product_name
        return "Producto"

    def get_product_image(self, obj):
        prod = obj.product
        if not prod:
            return None

        img_url = None
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

        request = self.context.get('request')
        if img_url and request:
            try:
                img_url = request.build_absolute_uri(img_url)
            except Exception:
                pass
        return img_url

    def get_stage_dates(self, obj):
        """Retorna un diccionario estructurado con las fechas de cada fase."""
        return {
            'queued': obj.queued_at.isoformat() if obj.queued_at else None,
            'assembling': obj.assembling_at.isoformat() if obj.assembling_at else None,
            'painting': obj.painting_at.isoformat() if obj.painting_at else None,
            'quality_check': obj.quality_check_at.isoformat() if obj.quality_check_at else None,
            'completed': obj.completed_at.isoformat() if obj.completed_at else None,
        }


class ProductionProductStatusUpdateSerializer(serializers.Serializer):
    """Serializador para actualizar la fase y notas de un producto individual."""

    status = serializers.ChoiceField(choices=ProductionOrder.STATUS_CHOICES, required=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ProductionProductBulkItemSerializer(serializers.Serializer):
    """Elemento individual para actualizaciones heterogéneas por lote."""

    id = serializers.IntegerField(required=True)
    status = serializers.ChoiceField(choices=ProductionOrder.STATUS_CHOICES, required=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ProductionProductBulkUpdateSerializer(serializers.Serializer):
    """
    Serializador flexible para actualizar estados de múltiples productos simultáneamente o por lote.
    Soporta dos modalidades:
    1. Homogénea: product_ids: [1, 2, 3] + status: "painting" + notes (opcional)
    2. Heterogénea: items: [{id: 1, status: "painting"}, {id: 2, status: "completed"}]
    """

    product_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=False
    )
    status = serializers.ChoiceField(
        choices=ProductionOrder.STATUS_CHOICES,
        required=False
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )
    items = ProductionProductBulkItemSerializer(
        many=True,
        required=False
    )

    def validate(self, attrs):
        product_ids = attrs.get('product_ids')
        status = attrs.get('status')
        items = attrs.get('items')

        if not product_ids and not items:
            raise serializers.ValidationError(
                "Debe proporcionar 'product_ids' junto a 'status', o una lista de 'items'."
            )

        if product_ids and not status:
            raise serializers.ValidationError(
                "Al especificar 'product_ids', el campo 'status' es obligatorio."
            )

        return attrs


class ProductionOrderSerializer(serializers.ModelSerializer):
    """Serializador principal para las Órdenes de Fabricación."""

    order_number = serializers.CharField(source='order.order_number', read_only=True)
    order_notes = serializers.CharField(source='order.notes', read_only=True)
    client_name = serializers.SerializerMethodField()
    client_phone = serializers.SerializerMethodField()
    order_status = serializers.CharField(source='order.status', read_only=True)
    order_status_display = serializers.CharField(source='order.get_status_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_items_summary = serializers.SerializerMethodField()
    products = ProductionProductSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionOrder
        fields = [
            'id',
            'order',
            'order_number',
            'order_notes',
            'client_name',
            'client_phone',
            'order_status',
            'order_status_display',
            'order_items_summary',
            'products',
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
            'order_notes',
            'status_display',
            'order_number',
            'client_name',
            'client_phone',
            'order_status',
            'order_status_display',
            'order_items_summary',
            'products',
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
        """Retorna un resumen de las líneas de producto del pedido para la hoja técnica de taller."""
        if not obj.order:
            return []

        # Asegurar que existan los productos de producción individuales
        obj.ensure_production_products()

        items_data = []
        request = self.context.get('request')

        for detail in obj.order.details.filter(is_deleted=False):
            first_op = detail.order_products.filter(is_deleted=False).first()
            prod = first_op.product if first_op else None
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
                'status': obj.status,
                'status_display': obj.get_status_display(),
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
