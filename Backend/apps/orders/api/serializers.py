from rest_framework import serializers
from decimal import Decimal

from apps.orders.models import (
    Order, 
    OrderDetail, 
    OrderProduct, 
    ManufacturingOrder,
    ExchangeRate
)
from apps.product.api.serializers import ProductSerializer
from apps.shipment.api.serializers import ShipmentSerializer
from apps.production.api.serializers import ProductionOrderSerializer
from apps.payment.api.serializers import PaymentSerializer


class ExchangeRateSerializer(serializers.ModelSerializer):
    """Serializer para la consulta de Tasas de Cambio Oficiales (BCV)."""

    formatted_rate = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ExchangeRate
        fields = [
            'id',
            'date',
            'rate',
            'formatted_rate',
            'source',
            'is_manual',
            'notes',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'formatted_rate']

    def get_formatted_rate(self, obj):
        return f"{obj.rate:,.2f} Bs/$"



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
    client = serializers.SerializerMethodField(read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    
    # --- Nuevos campos para la vista OMS ---
    total_price_bs = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    pending_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    exchange_rate_date = serializers.DateField(source='exchange_rate.date', read_only=True)
    payment_method_label = serializers.SerializerMethodField(read_only=True)
    shipping_address = serializers.SerializerMethodField(read_only=True)
    payment_summary = serializers.SerializerMethodField(read_only=True)
    timeline = serializers.SerializerMethodField(read_only=True)

    details = OrderDetailSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    manufacturing_orders = ManufacturingOrderSerializer(many=True, read_only=True)
    production_orders = ProductionOrderSerializer(many=True, read_only=True)
    shipments = ShipmentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'user',
            'client',
            'status',
            'status_label',
            'total_price',
            'paid_amount',
            'pending_balance',
            'bcv_rate',
            'total_price_bs',
            'exchange_rate',
            'exchange_rate_date',
            'payment_method_label',
            'shipping_address',
            'payment_summary',
            'timeline',
            'notes',
            'reception_notes',
            'reception_date',
            'details',
            'payments',
            'manufacturing_orders',
            'production_orders',
            'shipments',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'order_number', 'user', 'client', 'status_label', 'total_price',
            'paid_amount', 'pending_balance', 'total_price_bs', 'exchange_rate', 
            'exchange_rate_date', 'shipping_address', 'reception_date', 
            'details', 'payments', 'manufacturing_orders', 'production_orders', 
            'shipments', 'created_at', 'updated_at'
        ]

    def get_client(self, obj):
        if obj.user:
            u = obj.user
            first_name = u.first_name or ""
            last_name = getattr(u, 'first_last_name', '') or u.last_name or ""
            full_name = f"{first_name} {last_name}".strip()
            name = full_name or u.get_full_name() or u.username or "Cliente"
            return {
                "id": u.id,
                "name": name,
                "email": u.email or "",
                "phone": getattr(u, 'phone', '') or ""
            }
        return {"id": None, "name": "Cliente", "email": "", "phone": ""}

    def get_payment_method_label(self, obj):
        """Extrae el método de pago del primer pago registrado para la tarjeta superior."""
        first_payment = obj.payments.filter(is_deleted=False).first()
        return first_payment.get_payment_method_display() if first_payment else "No especificado"

    def get_shipping_address(self, obj):
        """Retorna la dirección de entrega estructurada a partir del envío."""
        shipment = obj.shipments.filter(is_deleted=False).first()
        if shipment:
            city_state = ", ".join(filter(None, [shipment.city, shipment.municipality, shipment.state]))
            return {
                "address": shipment.address or "No registrada",
                "line1": shipment.address or "No registrada",
                "city": shipment.city or "",
                "municipality": shipment.municipality or "",
                "state": shipment.state or "",
                "city_state": city_state or shipment.state or "Venezuela",
                "country": "Venezuela",
                "distributor_name": shipment.distributor.name if shipment.distributor else None
            }
        return {
            "address": "No registrada",
            "line1": "No registrada",
            "city": "",
            "municipality": "",
            "state": "",
            "city_state": "No registrada",
            "country": "Venezuela",
            "distributor_name": None
        }

    def get_payment_summary(self, obj):
        """Desglose automático para las dos tarjetas de pagos (Inicial y Final)."""
        rate = obj.bcv_rate or Decimal('1.00')
        initial_target = (obj.total_price / Decimal('2')).quantize(Decimal('0.01'))
        
        initial_payment = obj.payments.filter(payment_stage='initial', is_deleted=False).first()
        final_payment = obj.payments.filter(payment_stage='final', is_deleted=False).first()

        init_receipt_url = None
        if initial_payment and initial_payment.receipt_file:
            try:
                init_receipt_url = initial_payment.receipt_file.url
            except Exception:
                init_receipt_url = None

        final_receipt_url = None
        if final_payment and final_payment.receipt_file:
            try:
                final_receipt_url = final_payment.receipt_file.url
            except Exception:
                final_receipt_url = None

        return {
            "initial": {
                "id": initial_payment.id if initial_payment else None,
                "amount_usd": initial_payment.amount if initial_payment else initial_target,
                "amount_bs": ((initial_payment.amount if initial_payment else initial_target) * rate).quantize(Decimal('0.01')),
                "status": initial_payment.status if initial_payment else "unregistered",
                "status_label": initial_payment.get_status_display() if initial_payment else "Pendiente por registrar",
                "reference": initial_payment.reference_number if initial_payment else None,
                "receipt_url": init_receipt_url,
                "payment_method": initial_payment.get_payment_method_display() if initial_payment else None,
                "created_at": initial_payment.created_at if initial_payment else None,
            },
            "final": {
                "id": final_payment.id if final_payment else None,
                "amount_usd": final_payment.amount if final_payment else (obj.total_price - initial_target),
                "amount_bs": ((final_payment.amount if final_payment else (obj.total_price - initial_target)) * rate).quantize(Decimal('0.01')),
                "status": final_payment.status if final_payment else "unregistered",
                "status_label": final_payment.get_status_display() if final_payment else "Pendiente por registrar",
                "reference": final_payment.reference_number if final_payment else None,
                "receipt_url": final_receipt_url,
                "payment_method": final_payment.get_payment_method_display() if final_payment else None,
                "created_at": final_payment.created_at if final_payment else None,
            }
        }

    def get_timeline(self, obj):
        """
        Construye el stepper lateral consultando HistoricalRecords de simple-history.
        Detecta la fecha y hora exacta en que la orden entró a cada estado.
        """
        # 1. Mapeo de fechas reales a partir del historial del modelo
        status_timestamps = {}
        history_records = obj.historical.all().order_by('history_date')
        for h in history_records:
            if h.status not in status_timestamps:
                status_timestamps[h.status] = h.history_date.strftime("%d/%m/%Y - %I:%M %p")

        # 2. Flujo ordenado según la interfaz visual
        flow_order = [
            ('pending_initial_payment', 'Pendiente de pago'),
            ('initial_payment_review', 'Pago inicial en revisión'),
            ('manufacturing', 'En fabricación'),
            ('waiting_final_payment', 'Esperando pago final'),
            ('final_payment_review', 'Pago final en revisión'),
            ('shipped', 'Enviado'),
            ('finalized', 'Finalizado'),
        ]

        # Encontrar en qué punto del flujo estamos
        current_status_keys = [k for k, _ in flow_order]
        current_index = current_status_keys.index(obj.status) if obj.status in current_status_keys else -1

        timeline_data = []
        for idx, (status_key, label) in enumerate(flow_order):
            if idx < current_index:
                state = "completed"
                date_str = status_timestamps.get(status_key, "Completado")
            elif idx == current_index:
                state = "current"
                date_str = status_timestamps.get(status_key, "En curso")
            else:
                state = "pending"
                date_str = "Pendiente"

            timeline_data.append({
                "status_key": status_key,
                "label": label,
                "state": state,          # completed | current | pending
                "date_display": date_str
            })

        return timeline_data