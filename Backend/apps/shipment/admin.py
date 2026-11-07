from django.contrib import admin
from django.utils import timezone

from apps.base.admin import BaseAdmin
from apps.shipment.models import Distributor, DistributorCoverage, Shipment


class DistributorCoverageInline(admin.TabularInline):
    model = DistributorCoverage
    extra = 1
    fields = [
        'state',
        'municipality',
        'city',
        'estimated_days_min',
        'estimated_days_max',
        'base_shipping_cost',
        'is_active',
    ]


@admin.register(Distributor)
class DistributorAdmin(BaseAdmin):
    """Panel de administración para Distribuidores / Empresas de Transporte."""

    list_display = [
        'id',
        'name',
        'rif',
        'coverage_type',
        'cobertura_resumen',
        'phone',
        'email',
        'is_active',
        'created_at',
    ]
    list_filter = ['coverage_type', 'is_active', 'created_at', 'is_deleted']
    search_fields = ['name', 'rif', 'phone', 'email']
    ordering = ['name']
    inlines = [DistributorCoverageInline]
    actions = ['activate_distributors', 'deactivate_distributors']

    @admin.action(description="Activar distribuidor(es)")
    def activate_distributors(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"{count} distribuidor(es) activado(s).")

    @admin.action(description="Desactivar distribuidor(es)")
    def deactivate_distributors(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f"{count} distribuidor(es) desactivado(s).")


@admin.register(DistributorCoverage)
class DistributorCoverageAdmin(BaseAdmin):
    """Panel de administración individual para Coberturas de Distribuidores."""

    list_display = [
        'id',
        'distributor',
        'state',
        'municipality',
        'city',
        'estimated_days_min',
        'estimated_days_max',
        'base_shipping_cost',
        'is_active',
    ]
    list_filter = ['state', 'distributor', 'is_active', 'created_at']
    search_fields = ['distributor__name', 'state', 'municipality', 'city']
    autocomplete_fields = ['distributor']
    ordering = ['distributor', 'state', 'municipality']



@admin.register(Shipment)
class ShipmentAdmin(BaseAdmin):
    """Panel de administración para Envíos."""

    list_display = [
        'id',
        'order',
        'distributor',
        'state',
        'city',
        'status',
        'estimated_date',
        'delivered_at',
        'created_at',
    ]
    list_filter = ['status', 'state', 'distributor', 'created_at', 'is_deleted']
    search_fields = [
        'id',
        'order__id',
        'state',
        'municipality',
        'city',
        'address',
        'notes',
        'distributor__name',
    ]
    autocomplete_fields = ['order', 'distributor']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    actions = ['mark_as_in_transit', 'mark_as_delivered', 'mark_as_returned']

    @admin.action(description="Marcar envío(s) como 'En camino'")
    def mark_as_in_transit(self, request, queryset):
        for shipment in queryset:
            shipment.status = 'in_transit'
            shipment.save()
            order = shipment.order
            if order.status != 'shipped':
                order.status = 'shipped'
                order.save()
        self.message_user(request, f"{queryset.count()} envío(s) marcados como 'En camino'.")

    @admin.action(description="Marcar envío(s) como 'Entregado' (Finaliza la Orden)")
    def mark_as_delivered(self, request, queryset):
        for shipment in queryset:
            shipment.status = 'delivered'
            shipment.delivered_at = timezone.now()
            shipment.save()
            order = shipment.order
            order.status = 'finalized'
            order.save()
        self.message_user(request, f"{queryset.count()} envío(s) entregados y pedido(s) finalizados.")

    @admin.action(description="Marcar envío(s) como 'Devuelto' (Envía la Orden a Refabricación)")
    def mark_as_returned(self, request, queryset):
        for shipment in queryset:
            shipment.status = 'returned'
            shipment.save()
            order = shipment.order
            order.status = 'returned_manufacturing'
            order.save()
        self.message_user(request, f"{queryset.count()} envío(s) marcados como devueltos.")
