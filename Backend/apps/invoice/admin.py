from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.invoice.models import Invoice


@admin.register(Invoice)
class InvoiceAdmin(BaseAdmin):
    list_display = (
        'id',
        'invoice_number',
        'order',
        'customer_name',
        'customer_tax_id',
        'total',
        'created_at'
    )
    list_filter = ('created_at',)
    search_fields = (
        'invoice_number',
        'customer_name',
        'customer_tax_id',
        'customer_email',
        'order__order_number'
    )
    readonly_fields = ('invoice_number', 'created_at', 'updated_at', 'deleted_at')
