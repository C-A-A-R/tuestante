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
        """Validar que la orden pertenezca al usuario si es cliente y no sea un pago duplicado."""
        order = attrs.get('order')
        request = self.context.get('request')

        if request and request.user and not request.user.is_staff:
            if order.user != request.user:
                raise serializers.ValidationError(
                    {"order": "No tienes permisos para registrar un pago sobre este pedido."}
                )

        return attrs
