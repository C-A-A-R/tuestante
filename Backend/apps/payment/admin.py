from django.contrib import admin
from django.utils import timezone

from apps.base.admin import BaseAdmin
from apps.payment.models import Payment
from apps.invoice.services import create_invoice_for_order


@admin.register(Payment)
class PaymentAdmin(BaseAdmin):
    """Panel de administración para la revisión y aprobación de Pagos."""

    list_display = [
        'id',
        'order',
        'payment_stage',
        'amount',
        'payment_method',
        'status',
        'reference_number',
        'reviewed_by',
        'reviewed_at',
        'created_at',
    ]
    list_filter = ['payment_stage', 'status', 'payment_method', 'created_at', 'is_deleted']
    search_fields = [
        'id',
        'order__id',
        'reference_number',
        'order__user__username',
        'order__user__email',
        'notes',
    ]
    autocomplete_fields = ['order', 'reviewed_by']
    readonly_fields = ['created_at', 'updated_at', 'reviewed_at', 'reviewed_by']
    ordering = ['-created_at']
    actions = ['approve_payments', 'reject_payments']

    @admin.action(description="Aprobar pago(s) seleccionado(s)")
    def approve_payments(self, request, queryset):
        for payment in queryset:
            payment.status = 'approved'
            payment.reviewed_by = request.user
            payment.reviewed_at = timezone.now()
            payment.save()

            # Avanzar automáticamente el estado del pedido y registrar en fabricación
            order = payment.order

            try:
                from apps.production.models import ProductionOrder
                if not ProductionOrder.objects.filter(order=order, is_deleted=False).exists():
                    stage_label = payment.get_payment_stage_display() if hasattr(payment, 'get_payment_stage_display') else payment.payment_stage
                    ProductionOrder.objects.create(
                        order=order,
                        status='queued',
                        technical_notes=order.notes or f'Iniciada por aprobación de pago en admin ({stage_label})'
                    )
            except Exception as ex:
                print(f"[Admin Payment Review] Error al registrar orden de fabricación: {ex}")

            if payment.payment_stage == 'total':
                order.status = 'manufacturing'
                order.save()
                create_invoice_for_order(order)
            elif payment.payment_stage == 'initial':
                order.status = 'manufacturing'
                order.save()
            elif payment.payment_stage == 'final' and order.status in ['waiting_final_payment', 'final_payment_review']:
                order.status = 'shipped'
                order.save()
                create_invoice_for_order(order)
            else:
                order.status = 'manufacturing'
                order.save()

        self.message_user(request, f"{queryset.count()} pago(s) aprobado(s) exitosamente.")

    @admin.action(description="Rechazar pago(s) seleccionado(s)")
    def reject_payments(self, request, queryset):
        for payment in queryset:
            payment.status = 'rejected'
            payment.reviewed_by = request.user
            payment.reviewed_at = timezone.now()
            if not payment.rejection_reason:
                payment.rejection_reason = f"Rechazado por {request.user.username} desde el Admin"
            payment.save()

        self.message_user(request, f"{queryset.count()} pago(s) rechazado(s).")
