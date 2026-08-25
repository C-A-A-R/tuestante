from django.contrib import admin
from django.utils import timezone

from apps.base.admin import BaseAdmin
from apps.orders.models import (
    Order,
    OrderDetail,
    OrderProduct,
    ManufacturingOrder
)


class OrderDetailInline(admin.TabularInline):
    model = OrderDetail
    extra = 0
    readonly_fields = ['final_price']
    fields = ['quantity', 'unit_price', 'final_price', 'notes']


class ManufacturingOrderInline(admin.StackedInline):
    model = ManufacturingOrder
    extra = 0
    readonly_fields = ['issued_at', 'issued_by']
    fields = ['status', 'iteration', 'issued_by', 'issued_at', 'completed_at', 'notes']


@admin.register(Order)
class OrderAdmin(BaseAdmin):
    """Panel de administración para la gestión de Pedidos."""

    list_display = [
        'id',
        'user',
        'status',
        'total_price',
        'created_at',
        'updated_at',
    ]
    list_filter = ['status', 'created_at', 'updated_at', 'is_deleted']
    search_fields = [
        'id',
        'user__username',
        'user__email',
        'user__identity_document',
        'user__first_name',
        'user__first_last_name',
        'notes',
    ]
    autocomplete_fields = ['user']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [OrderDetailInline, ManufacturingOrderInline]
    ordering = ['-created_at']
    actions = [
        'mark_as_manufacturing',
        'mark_as_waiting_final_payment',
        'mark_as_shipped',
        'mark_as_finalized',
        'mark_as_cancelled',
    ]

    @admin.action(description="Marcar seleccionados como 'En fabricación' (Crea Orden de Fabricación)")
    def mark_as_manufacturing(self, request, queryset):
        for order in queryset:
            order.status = 'manufacturing'
            order.save()
            # Auto-crear Orden de Fabricación si no existe una pendiente/en progreso
            existing_mo = ManufacturingOrder.objects.filter(order=order, status__in=['pending', 'in_progress']).first()
            if not existing_mo:
                last_iteration = ManufacturingOrder.objects.filter(order=order).count()
                ManufacturingOrder.objects.create(
                    order=order,
                    status='in_progress',
                    iteration=last_iteration + 1,
                    issued_by=request.user,
                    notes=f"Generada automáticamente por {request.user.username} desde el Admin"
                )
        self.message_user(request, f"{queryset.count()} pedido(s) actualizados a 'En fabricación'.")

    @admin.action(description="Marcar seleccionados como 'Esperando pago final'")
    def mark_as_waiting_final_payment(self, request, queryset):
        count = queryset.update(status='waiting_final_payment')
        self.message_user(request, f"{count} pedido(s) actualizados a 'Esperando pago final'.")

    @admin.action(description="Marcar seleccionados como 'Enviado'")
    def mark_as_shipped(self, request, queryset):
        count = queryset.update(status='shipped')
        self.message_user(request, f"{count} pedido(s) actualizados a 'Enviado'.")

    @admin.action(description="Marcar seleccionados como 'Finalizado'")
    def mark_as_finalized(self, request, queryset):
        count = queryset.update(status='finalized')
        self.message_user(request, f"{count} pedido(s) actualizados a 'Finalizado'.")

    @admin.action(description="Marcar seleccionados como 'Cancelado'")
    def mark_as_cancelled(self, request, queryset):
        count = queryset.update(status='cancelled')
        self.message_user(request, f"{count} pedido(s) actualizados a 'Cancelado'.")


@admin.register(OrderDetail)
class OrderDetailAdmin(BaseAdmin):
    """Panel de administración para Detalles de Pedido."""

    list_display = ['id', 'order', 'quantity', 'unit_price', 'final_price', 'created_at']
    list_filter = ['created_at']
    search_fields = ['order__id', 'notes']
    readonly_fields = ['final_price', 'created_at', 'updated_at']
    autocomplete_fields = ['order']
    ordering = ['-created_at']


@admin.register(OrderProduct)
class OrderProductAdmin(BaseAdmin):
    """Panel de administración para Productos de un Pedido."""

    list_display = ['id', 'order_detail', 'product', 'price_at_order', 'created_at']
    list_filter = ['created_at']
    search_fields = ['product__product_name', 'order_detail__order__id']
    autocomplete_fields = ['order_detail', 'product']
    ordering = ['-created_at']


@admin.register(ManufacturingOrder)
class ManufacturingOrderAdmin(BaseAdmin):
    """Panel de administración para Órdenes de Fabricación."""

    list_display = ['id', 'order', 'status', 'iteration', 'issued_by', 'issued_at', 'completed_at']
    list_filter = ['status', 'iteration', 'issued_at', 'completed_at']
    search_fields = ['id', 'order__id', 'notes', 'issued_by__username']
    autocomplete_fields = ['order', 'issued_by']
    readonly_fields = ['issued_at']
    ordering = ['-issued_at']
    actions = ['mark_as_completed']

    @admin.action(description="Marcar como Completada")
    def mark_as_completed(self, request, queryset):
        count = queryset.update(status='completed', completed_at=timezone.now())
        self.message_user(request, f"{count} orden(es) de fabricación completadas.")
