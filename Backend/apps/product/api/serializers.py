from rest_framework import serializers
from apps.product.models import (
    ProductType,
    Product,
    ProductColorImage,
    ProductAngleImage,
    FavoriteProduct
)


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

    product_type_detail = ProductTypeSerializer(source='product_type', read_only=True)
    color_images = ProductColorImageSerializer(many=True, read_only=True)
    angle_images = ProductAngleImageSerializer(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()
    favorites_count = serializers.SerializerMethodField()
    quantity = serializers.IntegerField(required=False)
    stock = serializers.IntegerField(source='quantity', required=False)
    main_color = serializers.CharField(required=False, allow_blank=True)
    color_principal = serializers.CharField(source='main_color', required=False, allow_blank=True)
    product_image = serializers.ImageField(required=False, allow_null=True)
    product_video = serializers.FileField(required=False, allow_null=True)

    def to_internal_value(self, data):
        # QueryDict.copy() hace deepcopy y falla con TemporaryUploadedFile.
        # Construir un dict superficial conserva los archivos sin copiar sus streams.
        if hasattr(data, 'lists'):
            data = {
                key: values[-1] if len(values) == 1 else values
                for key, values in data.lists()
            }
        elif isinstance(data, dict):
            data = data.copy()

        for field in ['product_image', 'product_video']:
            val = data.get(field)
            if val == '' or (isinstance(val, str) and not val.strip()):
                data.pop(field, None)
            elif isinstance(val, str) and (val.startswith('blob:') or val.startswith('http://') or val.startswith('https://')):
                data.pop(field, None)

        return super().to_internal_value(data)

    class Meta:
        model = Product
        fields = [
            'id',
            'product_type',
            'product_type_detail',
            'product_name',
            'description',
            'is_active',
            'is_outlet',
            'is_feature_product',
            'quantity',
            'stock',
            'main_color',
            'color_principal',
            'is_favorite',
            'favorites_count',
            'height_cm',
            'depth_cm',
            'width_cm',
            'security',
            'price',
            'product_image',
            'product_video',
            'color_images',
            'angle_images',
            'is_deleted',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'is_favorite', 'favorites_count', 'is_deleted', 'created_at', 'updated_at']

    def get_favorites_count(self, obj):
        if hasattr(obj, 'favorites_count'):
            return obj.favorites_count
        return obj.favorites.filter(is_deleted=False).count()

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            favorite_ids = self.context.get('favorite_product_ids')
            if favorite_ids is not None:
                return obj.id in favorite_ids
            if hasattr(obj, 'is_favorite_annotated'):
                return bool(obj.is_favorite_annotated)
            return FavoriteProduct.objects.filter(user=request.user, product=obj, is_deleted=False).exists()
        return False


class FavoriteProductSerializer(serializers.ModelSerializer):
    """Serializador para el modelo FavoriteProduct."""

    product_detail = ProductSerializer(source='product', read_only=True)

    class Meta:
        model = FavoriteProduct
        fields = [
            'id',
            'user',
            'product',
            'product_detail',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


