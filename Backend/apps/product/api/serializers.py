from rest_framework import serializers
from apps.product.models import Category, ProductType, Product, ProductColorImage, ProductAngleImage


class CategorySerializer(serializers.ModelSerializer):
    """Serializador para el modelo Category."""

    class Meta:
        model = Category
        fields = ['id', 'category_name', 'description', 'category_image', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductTypeSerializer(serializers.ModelSerializer):
    """Serializador para el modelo ProductType."""

    class Meta:
        model = ProductType
        fields = ['id', 'product_type_name', 'description', 'product_type_image', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductColorImageSerializer(serializers.ModelSerializer):
    """Serializador para el modelo ProductColorImage (imágenes por color)."""

    class Meta:
        model = ProductColorImage
        fields = ['id', 'color_image', 'color_hex', 'color_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductAngleImageSerializer(serializers.ModelSerializer):
    """Serializador para el modelo ProductAngleImage (imágenes por ángulo)."""

    class Meta:
        model = ProductAngleImage
        fields = ['id', 'image', 'angle', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductSerializer(serializers.ModelSerializer):
    """Serializador para el modelo Product."""

    categories_detail = CategorySerializer(source='categories', many=True, read_only=True)
    category_detail = CategorySerializer(source='category', read_only=True)
    product_type_detail = ProductTypeSerializer(source='product_type', read_only=True)
    color_images = ProductColorImageSerializer(many=True, read_only=True)
    angle_images = ProductAngleImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'categories',
            'categories_detail',
            'category_detail',
            'product_type',
            'product_type_detail',
            'product_name',
            'description',
            'is_feature_product',
            'height_cm',
            'depth_cm',
            'width_cm',
            'security',
            'price',
            'product_image',
            'product_video',
            'color_images',
            'angle_images',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

