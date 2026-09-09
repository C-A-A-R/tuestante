from django.contrib import admin
from apps.base.admin import BaseAdmin
from apps.product.models import (
    ProductType,
    Product,
    ProductColorImage,
    ProductAngleImage,
    FavoriteProduct
)


class ProductColorImageInline(admin.TabularInline):
    model = ProductColorImage
    extra = 1
    fields = ('color_image', 'color_hex', 'color_name')


class ProductAngleImageInline(admin.TabularInline):
    model = ProductAngleImage
    extra = 1
    fields = ('image', 'angle')


@admin.register(ProductType)
class ProductTypeAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo ProductType."""

    list_display = (
        'product_type_name',
        'description',
        'product_type_image',
        'created_at',
        'updated_at'
    )
    search_fields = ('product_type_name', 'description')
    list_filter = ('created_at',)
    ordering = ('id',)


@admin.register(Product)
class ProductAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo Product."""

    inlines = [ProductColorImageInline, ProductAngleImageInline]
    list_display = (
        'product_name',
        'product_type',
        'price',
        'is_active',
        'is_outlet',
        'is_feature_product',
        'quantity',
        'height_cm',
        'depth_cm',
        'width_cm',
        'product_image',
        'product_video',
        'created_at'
    )
    list_editable = ('is_active', 'is_outlet', 'is_feature_product', 'quantity')
    search_fields = ('product_name', 'description', 'product_type__product_type_name', 'security')
    list_filter = ('is_active', 'is_outlet', 'is_feature_product', 'product_type', 'created_at')
    ordering = ('id',)


@admin.register(ProductColorImage)
class ProductColorImageAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo ProductColorImage."""

    list_display = ('product', 'color_hex', 'color_name', 'color_image', 'created_at')
    search_fields = ('product__product_name', 'color_hex', 'color_name')
    list_filter = ('created_at',)
    ordering = ('id',)


@admin.register(ProductAngleImage)
class ProductAngleImageAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo ProductAngleImage."""

    list_display = ('product', 'angle', 'image', 'created_at')
    search_fields = ('product__product_name', 'angle')
    list_filter = ('created_at',)
    ordering = ('id',)


@admin.register(FavoriteProduct)
class FavoriteProductAdmin(BaseAdmin):
    """Configuración del panel de administración para el modelo FavoriteProduct."""

    list_display = ('id', 'user', 'product', 'created_at', 'is_deleted')
    search_fields = ('user__username', 'user__email', 'product__product_name')
    list_filter = ('is_deleted', 'created_at')
    ordering = ('-created_at',)


