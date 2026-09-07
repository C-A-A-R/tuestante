from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.production.models import ProductionOrder


@admin.register(ProductionOrder)
class ProductionOrderAdmin(BaseAdmin):
    list_display = [
        'id',
        'order_number_display',
        'client_display',
        'iteration',
        'status',
        'start_date',
        'estimated_completion_date',
        'actual_completion_date',
        'created_at',
    ]
    list_filter = ['status', 'iteration', 'is_deleted', 'created_at']
    search_fields = [
        'order__order_number',
        'order__user__username',
        'order__user__first_name',
        'order__user__first_last_name',
        'order__user__email',
        'technical_notes',
    ]
    date_hierarchy = 'created_at'
    ordering = ['-created_at', '-id']
    actions = ['mark_as_assembling', 'mark_as_painting', 'mark_as_quality_check', 'mark_as_completed']

    @admin.display(description='Número de Pedido', ordering='order__order_number')
    def order_number_display(self, obj):
        return obj.order.order_number or f"Pedido #{obj.order.id}"

    @admin.display(description='Cliente', ordering='order__user')
    def client_display(self, obj):
        if obj.order and obj.order.user:
            return obj.order.user.get_full_name() or obj.order.user.username
        return "-"

    @admin.action(description='Marcar seleccionados: En Corte y Ensamblaje')
    def mark_as_assembling(self, request, queryset):
        for po in queryset:
            po.status = 'assembling'
            po.save()
        self.message_user(request, f"{queryset.count()} orden(es) actualizadas a 'En Corte y Ensamblaje'.")

    @admin.action(description='Marcar seleccionados: En Pintura y Acabado')
    def mark_as_painting(self, request, queryset):
        for po in queryset:
            po.status = 'painting'
            po.save()
        self.message_user(request, f"{queryset.count()} orden(es) actualizadas a 'En Pintura y Acabado'.")

    @admin.action(description='Marcar seleccionados: En Control de Calidad')
    def mark_as_quality_check(self, request, queryset):
        for po in queryset:
            po.status = 'quality_check'
            po.save()
        self.message_user(request, f"{queryset.count()} orden(es) actualizadas a 'En Control de Calidad'.")

    @admin.action(description='Marcar seleccionados: Fabricación Completada')
    def mark_as_completed(self, request, queryset):
        for po in queryset:
            po.status = 'completed'
            po.save()
        self.message_user(request, f"{queryset.count()} orden(es) completadas y pedidos sincronizados a 'Esperando pago final'.")

