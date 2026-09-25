from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers
from apps.payment.models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer para la gestión de Pagos."""

    reviewed_by = serializers.StringRelatedField(read_only=True)
    payment_code = serializers.SerializerMethodField(read_only=True)
    order_code = serializers.SerializerMethodField(read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    order_total = serializers.DecimalField(source='order.total_price', max_digits=12, decimal_places=2, read_only=True)
    client = serializers.SerializerMethodField(read_only=True)
    payment_method_label = serializers.CharField(source='get_payment_method_display', read_only=True)
    payment_stage_label = serializers.CharField(source='get_payment_stage_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    receipt_file_url = serializers.SerializerMethodField(read_only=True)
    order_summary = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'order',
            'order_id',
            'order_code',
            'payment_code',
            'payment_stage',
            'payment_stage_label',
            'amount',
            'amount_ves',
            'exchange_rate',
            'currency',
            'payment_method',
            'payment_method_label',
            'status',
            'status_label',
            'reference_number',
            'receipt_file',
            'receipt_file_url',
            'client',
            'order_total',
            'order_summary',
            'notes',
            'reviewed_by',
            'reviewed_at',
            'rejection_reason',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'reviewed_by', 'reviewed_at', 'rejection_reason',
            'created_at', 'updated_at', 'payment_code', 'order_code', 'order_id',
            'order_total', 'client', 'payment_method_label', 'payment_stage_label',
            'status_label', 'receipt_file_url', 'order_summary'
        ]

    def get_payment_code(self, obj):
        return f"#PAG-{obj.id:03d}"

    def get_order_code(self, obj):
        if obj.order:
            return obj.order.order_number or f"#00{obj.order.id}"
        return ""

    def get_client(self, obj):
        if obj.order and obj.order.user:
            u = obj.order.user
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

    def get_receipt_file_url(self, obj):
        if obj.receipt_file:
            try:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.receipt_file.url)
                return obj.receipt_file.url
            except Exception:
                return str(obj.receipt_file)
        return None

    def get_order_summary(self, obj):
        if not obj.order:
            return None
        order = obj.order
        items = []
        try:
            for detail in order.details.prefetch_related('order_products__product').all():
                order_prods = detail.order_products.all()
                if order_prods.exists():
                    for op in order_prods:
                        p_name = op.product.product_name if op.product else "Producto"
                        items.append({
                            "id": op.id,
                            "product_name": p_name,
                            "quantity": detail.quantity,
                            "unit_price_usd": float(detail.unit_price or 0),
                            "total_price_usd": float(detail.final_price or (detail.unit_price * detail.quantity if detail.unit_price else 0)),
                            "notes": detail.notes or ""
                        })
                else:
                    items.append({
                        "id": detail.id,
                        "product_name": f"Producto (Detalle #{detail.id})",
                        "quantity": detail.quantity,
                        "unit_price_usd": float(detail.unit_price or 0),
                        "total_price_usd": float(detail.final_price or 0),
                        "notes": detail.notes or ""
                    })
        except Exception:
            pass

        return {
            "id": order.id,
            "order_code": order.order_number or f"#00{order.id}",
            "status": order.status,
            "status_label": order.get_status_display() if hasattr(order, 'get_status_display') else order.status,
            "total_amount": float(order.total_price or 0),
            "items_count": len(items) if items else 1,
            "items": items,
            "created_at": order.created_at.isoformat() if order.created_at else None
        }

    def validate(self, attrs):
        """Validar permisos, montos y coherencia según la etapa del pago."""
        order = attrs.get('order') or (self.instance.order if self.instance else None)
        payment_stage = attrs.get('payment_stage') or (self.instance.payment_stage if self.instance else None)
        amount = attrs.get('amount') if 'amount' in attrs else (self.instance.amount if self.instance else None)
        request = self.context.get('request')

        if not order:
            raise serializers.ValidationError({"order": "El pedido es obligatorio."})

        # 1. Validar permisos si el usuario no es staff
        if request and request.user and not request.user.is_staff:
            if order.user != request.user:
                raise serializers.ValidationError(
                    {"order": "No tienes permisos para registrar un pago sobre este pedido."}
                )

        # 2. Validar que la orden no esté cancelada o finalizada
        if order.status == 'cancelled':
            raise serializers.ValidationError(
                {"order": "No se pueden registrar pagos en un pedido cancelado."}
            )

        # 3. Validar y normalizar montos según moneda (USD vs VES / Bolívares)
        if amount is not None:
            if amount <= Decimal('0'):
                raise serializers.ValidationError(
                    {"amount": "El monto del pago debe ser mayor a cero."}
                )

            total_order = order.total_price or Decimal('0.00')

            from apps.base.services.exchange_rate import get_bcv_rate
            official_bcv_rate = get_bcv_rate()

            currency_sent = (
                attrs.get('currency')
                or (request.data.get('currency') if request else None)
                or ('VES' if (attrs.get('payment_method') in ['mobile_payment', 'transfer'] and amount > (total_order * Decimal('5'))) else 'USD')
            )

            # Detección inteligente: Si el monto recibido supera 5 veces el total del pedido, es en Bolívares (VES)
            is_ves = (currency_sent == 'VES') or (amount > (total_order * Decimal('5')) and total_order > 0)

            if is_ves:
                raw_ves = amount
                client_rate = request.data.get('exchange_rate') if request else None
                rate_to_use = official_bcv_rate
                if client_rate:
                    try:
                        c_rate = Decimal(str(client_rate))
                        if (official_bcv_rate * Decimal('0.95')) <= c_rate <= (official_bcv_rate * Decimal('1.05')):
                            rate_to_use = c_rate
                    except Exception:
                        pass

                amount_usd = (raw_ves / rate_to_use).quantize(Decimal('0.01'))
                attrs['amount'] = amount_usd
                attrs['amount_ves'] = raw_ves
                attrs['exchange_rate'] = rate_to_use
                attrs['currency'] = 'VES'
            else:
                amount_usd = amount
                rate_to_use = official_bcv_rate
                attrs['amount'] = amount_usd
                attrs['amount_ves'] = (amount_usd * rate_to_use).quantize(Decimal('0.01'))
                attrs['exchange_rate'] = rate_to_use
                attrs['currency'] = 'USD'

            # Tolerancia de redondeo y pequeñas diferencias de tasa intradía (1.50 USD o 1.5%)
            tolerance = max(Decimal('1.50'), total_order * Decimal('0.015'))

            # Calcular pagos ya aprobados para este pedido (excluyendo la instancia actual si es edición)
            approved_query = Payment.objects.filter(order=order, status='approved', is_deleted=False)
            if self.instance:
                approved_query = approved_query.exclude(pk=self.instance.pk)
            approved_paid = approved_query.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            # 4. Validaciones específicas por etapa de pago (en USD normalizado con tolerancia)
            if payment_stage == 'total':
                if approved_paid >= total_order and total_order > 0:
                    raise serializers.ValidationError(
                        {"payment_stage": "Este pedido ya ha sido pagado en su totalidad."}
                    )
                if amount_usd < (total_order - tolerance):
                    ves_msg = f" (~Bs. {(total_order * rate_to_use):,.2f})" if is_ves else ""
                    raise serializers.ValidationError(
                        {"amount": f"Para un pago total, el monto debe cubrir el 100% del pedido (${total_order}{ves_msg}). Monto recibido: ${amount_usd}."}
                    )

            elif payment_stage == 'initial':
                min_initial = (total_order * Decimal('0.50')).quantize(Decimal('0.01'))
                if amount_usd < (min_initial - tolerance):
                    ves_msg = f" (~Bs. {(min_initial * rate_to_use):,.2f})" if is_ves else ""
                    raise serializers.ValidationError(
                        {"amount": f"El pago inicial debe ser de al menos el 50% del total (${min_initial}{ves_msg}). Monto recibido: ${amount_usd}."}
                    )
                if amount_usd > (total_order + tolerance):
                    ves_msg = f" (~Bs. {(total_order * rate_to_use):,.2f})" if is_ves else ""
                    raise serializers.ValidationError(
                        {"amount": f"El monto del pago inicial no puede exceder el total del pedido (${total_order}{ves_msg})."}
                    )

            elif payment_stage == 'final':
                remaining = max(Decimal('0.00'), total_order - approved_paid)
                if remaining <= 0:
                    raise serializers.ValidationError(
                        {"payment_stage": "Este pedido ya no tiene saldo pendiente por pagar."}
                    )
                if amount_usd < (remaining - tolerance):
                    ves_msg = f" (~Bs. {(remaining * rate_to_use):,.2f})" if is_ves else ""
                    raise serializers.ValidationError(
                        {"amount": f"El pago final debe cubrir el saldo pendiente restante (${remaining}{ves_msg}). Monto recibido: ${amount_usd}."}
                    )

        return attrs
