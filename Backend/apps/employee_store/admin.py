from django.contrib import admin
from apps.employee_store.models import (
    EmployeeProfile,
    InternalCategory,
    InternalSubCategory,
    InternalProduct,
    InternalOrder,
    InternalOrderItem,
    DebtPayment
)


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ('employee_number', 'get_full_name', 'department', 'position', 'salary', 'get_current_debt', 'is_active')
    search_fields = ('employee_number', 'user__first_name', 'user__last_name', 'user__username', 'department', 'position')
    list_filter = ('is_active', 'department', 'is_deleted')
    readonly_fields = ('created_at', 'updated_at', 'deleted_at', 'get_current_debt')

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
    get_full_name.short_description = 'Nombre Completo'

    def get_current_debt(self, obj):
        return f"${obj.current_debt:,.2f}"
    get_current_debt.short_description = 'Deuda Acumulada'


class InternalSubCategoryInline(admin.TabularInline):
    model = InternalSubCategory
    extra = 1
    fields = ('name', 'description', 'image')


@admin.register(InternalCategory)
class InternalCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'image', 'created_at', 'is_deleted')
    search_fields = ('name',)
    list_filter = ('is_deleted',)
    inlines = [InternalSubCategoryInline]


@admin.register(InternalSubCategory)
class InternalSubCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'category', 'image', 'created_at', 'is_deleted')
    search_fields = ('name', 'category__name')
    list_filter = ('category', 'is_deleted')


@admin.register(InternalProduct)
class InternalProductAdmin(admin.ModelAdmin):
    list_display = ('barcode', 'name', 'category', 'subcategory', 'price', 'stock', 'weekly_limit_per_employee', 'image', 'is_active', 'is_deleted')
    search_fields = ('barcode', 'name', 'category__name', 'subcategory__name')
    list_filter = ('category', 'subcategory', 'is_active', 'is_deleted')
    readonly_fields = ('created_at', 'updated_at', 'deleted_at')


class InternalOrderItemInline(admin.TabularInline):
    model = InternalOrderItem
    extra = 0
    readonly_fields = ('product', 'quantity', 'unit_price', 'subtotal')
    can_delete = False


@admin.register(InternalOrder)
class InternalOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'employee', 'total_amount', 'status', 'created_by', 'created_at', 'is_deleted')
    search_fields = ('order_number', 'employee__employee_number', 'employee__user__first_name', 'employee__user__last_name')
    list_filter = ('status', 'created_at', 'is_deleted')
    readonly_fields = ('order_number', 'total_amount', 'created_at', 'updated_at', 'deleted_at')
    inlines = [InternalOrderItemInline]


@admin.register(DebtPayment)
class DebtPaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'employee', 'amount', 'payment_type', 'registered_by', 'reference', 'created_at', 'is_deleted')
    search_fields = ('employee__employee_number', 'employee__user__first_name', 'employee__user__last_name', 'reference')
    list_filter = ('payment_type', 'created_at', 'is_deleted')
    readonly_fields = ('created_at', 'updated_at', 'deleted_at')
