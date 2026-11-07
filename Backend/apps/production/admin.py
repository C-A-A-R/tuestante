from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.production.models import ProductionOrder, ProductionProduct


class ProductionProductInline(admin.TabularInline):
    model = ProductionProduct
    extra = 0
    fields = ['product_number', 'product', 'unit_index', 'status', 'queued_at', 'assembling_at', 'painting_at', 'quality_check_at', 'completed_at']
    readonly_fields = ['product_number', 'queued_at', 'assembling_at', 'painting_at', 'quality_check_at', 'completed_at']


@admin.register(ProductionOrder)
class ProductionOrderAdmin(BaseAdmin):
    inlines = [ProductionProductInline]
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
    readonly_fields = ['blueprint_preview']
    actions = ['mark_as_assembling', 'mark_as_painting', 'mark_as_quality_check', 'mark_as_completed']

    def blueprint_preview(self, obj):
        if obj.blueprint_svg:
            from django.utils.safestring import mark_safe
            return mark_safe(f'<div style="max-width: 500px; border-radius: 8px; overflow: hidden;">{obj.blueprint_svg}</div>')
        return "Sin plano técnico generado"
    blueprint_preview.short_description = "Plano Técnico SVG"

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


@admin.register(ProductionProduct)
class ProductionProductAdmin(BaseAdmin):
    list_display = [
        'id',
        'product_number',
        'product_name_display',
        'order_number_display',
        'unit_index',
        'status',
        'queued_at',
        'assembling_at',
        'painting_at',
        'quality_check_at',
        'completed_at',
        'created_at',
    ]
    list_filter = ['status', 'is_deleted', 'created_at']
    search_fields = [
        'product_number',
        'product__product_name',
        'production_order__order__order_number',
        'production_order__order__user__username',
        'notes',
    ]
    ordering = ['-created_at', '-id']
    actions = ['bulk_mark_assembling', 'bulk_mark_painting', 'bulk_mark_quality_check', 'bulk_mark_completed']

    @admin.display(description='Producto', ordering='product__product_name')
    def product_name_display(self, obj):
        return obj.product.product_name if obj.product else "Producto"

    @admin.display(description='Pedido', ordering='production_order__order__order_number')
    def order_number_display(self, obj):
        if obj.production_order and obj.production_order.order:
            return obj.production_order.order.order_number or f"Pedido #{obj.production_order.order.id}"
        return "-"

    @admin.action(description='Marcar lote seleccionado: En Corte y Ensamblaje')
    def bulk_mark_assembling(self, request, queryset):
        for p in queryset:
            p.record_stage_transition('assembling')
            p.save()
        self.message_user(request, f"{queryset.count()} producto(s) actualizados a 'En Corte y Ensamblaje'.")

    @admin.action(description='Marcar lote seleccionado: En Pintura y Acabado')
    def bulk_mark_painting(self, request, queryset):
        for p in queryset:
            p.record_stage_transition('painting')
            p.save()
        self.message_user(request, f"{queryset.count()} producto(s) actualizados a 'En Pintura y Acabado'.")

    @admin.action(description='Marcar lote seleccionado: En Control de Calidad')
    def bulk_mark_quality_check(self, request, queryset):
        for p in queryset:
            p.record_stage_transition('quality_check')
            p.save()
        self.message_user(request, f"{queryset.count()} producto(s) actualizados a 'En Control de Calidad'.")

    @admin.action(description='Marcar lote seleccionado: Fabricación Completada')
    def bulk_mark_completed(self, request, queryset):
        for p in queryset:
            p.record_stage_transition('completed')
            p.save()
        self.message_user(request, f"{queryset.count()} producto(s) completados.")


