from rest_framework import serializers
from apps.invoice.models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer para la consulta de Facturas."""

    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'order',
            'order_number',
            'customer_name',
            'customer_tax_id',
            'customer_email',
            'billing_address',
            'subtotal',
            'discount_amount',
            'total',
            'items_snapshot',
            'pdf_file',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
