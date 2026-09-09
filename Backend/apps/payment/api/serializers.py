from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers
from apps.payment.models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer para la gestión de Pagos."""

    reviewed_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'order',
            'payment_stage',
            'amount',
            'payment_method',
            'status',
            'reference_number',
            'receipt_file',
            'notes',
            'reviewed_by',
            'reviewed_at',
            'rejection_reason',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'status', 'reviewed_by', 'reviewed_at', 'rejection_reason', 'created_at', 'updated_at']

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

        # 3. Validar monto positivo
        if amount is not None:
            if amount <= Decimal('0'):
                raise serializers.ValidationError(
                    {"amount": "El monto del pago debe ser mayor a cero."}
                )

            total_order = order.total_price or Decimal('0.00')

            # Calcular pagos ya aprobados para este pedido (excluyendo la instancia actual si es edición)
            approved_query = Payment.objects.filter(order=order, status='approved', is_deleted=False)
            if self.instance:
                approved_query = approved_query.exclude(pk=self.instance.pk)
            approved_paid = approved_query.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            # 4. Validaciones específicas por etapa de pago
            if payment_stage == 'total':
                if approved_paid >= total_order and total_order > 0:
                    raise serializers.ValidationError(
                        {"payment_stage": "Este pedido ya ha sido pagado en su totalidad."}
                    )
                if amount < total_order:
                    raise serializers.ValidationError(
                        {"amount": f"Para un pago único o total, el monto debe cubrir el 100% del pedido (${total_order}). Monto recibido: ${amount}."}
                    )

            elif payment_stage == 'initial':
                min_initial = (total_order * Decimal('0.50')).quantize(Decimal('0.01'))
                if amount < min_initial:
                    raise serializers.ValidationError(
                        {"amount": f"El pago inicial debe ser de al menos el 50% del total (${min_initial}). Monto recibido: ${amount}."}
                    )
                if amount > total_order:
                    raise serializers.ValidationError(
                        {"amount": f"El monto del pago inicial no puede exceder el total del pedido (${total_order})."}
                    )

            elif payment_stage == 'final':
                remaining = max(Decimal('0.00'), total_order - approved_paid)
                if remaining <= 0:
                    raise serializers.ValidationError(
                        {"payment_stage": "Este pedido ya no tiene saldo pendiente por pagar."}
                    )
                if amount < remaining:
                    raise serializers.ValidationError(
                        {"amount": f"El pago final debe cubrir el saldo pendiente restante (${remaining}). Monto recibido: ${amount}."}
                    )

        return attrs
