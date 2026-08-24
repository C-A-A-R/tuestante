from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.product.models import Category, ProductType, Product, ProductColorImage, ProductAngleImage


class ProductColorImageInline(admin.TabularInline):
    model = ProductColorImage
    extra = 1
    fields = ('color_image', 'color_hex', 'color_name')


class ProductAngleImageInline(admin.TabularInline):
    model = ProductAngleImage
    extra = 1
    fields = ('image', 'angle')


@admin.register(Category)
class CategoryAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo Category."""

    list_display = (
        'id',
        'category_name',
        'description',
        'is_deleted',
        'created_at',
        'updated_at'
    )
    search_fields = ('category_name', 'description')
    list_filter = ('is_deleted', 'created_at')
    ordering = ('id',)


@admin.register(ProductType)
class ProductTypeAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo ProductType."""

    list_display = (
        'id',
        'product_type_name',
        'description',
        'is_deleted',
        'created_at',
        'updated_at'
    )
    search_fields = ('product_type_name', 'description')
    list_filter = ('is_deleted', 'created_at')
    ordering = ('id',)


@admin.register(Product)
class ProductAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo Product."""

    inlines = [ProductColorImageInline, ProductAngleImageInline]
    list_display = (
        'id',
        'product_name',
        'get_categories',
        'product_type',
        'price',
        'is_feature_product',
        'height_cm',
        'depth_cm',
        'width_cm',
        'product_image',
        'product_video',
        'is_deleted',
        'created_at'
    )
    list_editable = ('is_feature_product',)
    search_fields = ('product_name', 'description', 'product_type__product_type_name', 'security')
    list_filter = ('is_feature_product', 'categories', 'product_type', 'is_deleted', 'created_at')
    ordering = ('id',)
    filter_horizontal = ('categories',)

    def get_categories(self, obj):
        return ", ".join([c.category_name for c in obj.categories.all()])
    get_categories.short_description = 'Categorías'


@admin.register(ProductColorImage)
class ProductColorImageAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo ProductColorImage."""

    list_display = ('id', 'product', 'color_hex', 'color_name', 'color_image', 'is_deleted', 'created_at')
    search_fields = ('product__product_name', 'color_hex', 'color_name')
    list_filter = ('is_deleted', 'created_at')
    ordering = ('id',)


@admin.register(ProductAngleImage)
class ProductAngleImageAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo ProductAngleImage."""

    list_display = ('id', 'product', 'angle', 'image', 'is_deleted', 'created_at')
    search_fields = ('product__product_name', 'angle')
    list_filter = ('is_deleted', 'created_at')
    ordering = ('id',)

