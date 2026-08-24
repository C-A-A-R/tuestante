from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.base.api import BaseViewSet
from apps.product.models import Category, ProductType, Product
from apps.product.api.serializers import (
    CategorySerializer,
    ProductTypeSerializer,
    ProductSerializer
)


class CategoryViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Categorías.
    Hereda de BaseViewSet para borrado lógico.
    """
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class ProductTypeViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Tipos de Productos.
    Hereda de BaseViewSet para borrado lógico.
    """
    serializer_class = ProductTypeSerializer
    permission_classes = [permissions.AllowAny]


class FeaturedProductsAPIView(generics.ListAPIView):
    """
    APIView dedicada para obtener únicamente los productos destacados (is_feature_product=True).
    """
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Product.objects.filter(is_deleted=False, is_feature_product=True)


class ProductViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Productos.
    Soporta múltiples categorías por producto y filtrado directo.
    """
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Product.objects.filter(is_deleted=False).prefetch_related('categories', 'color_images', 'angle_images').select_related('product_type')
        cat_param = self.request.query_params.get('category') or self.request.query_params.get('cat')
        type_param = self.request.query_params.get('type') or self.request.query_params.get('product_type')
        
        if cat_param and cat_param.lower() != 'all':
            queryset = queryset.filter(categories__id=cat_param)
        if type_param and type_param.lower() != 'all':
            queryset = queryset.filter(product_type__id=type_param)
            
        return queryset.distinct()

    @action(detail=False, methods=['get'], url_path='featured')
    def featured(self, request, *args, **kwargs):
        """Endpoint dentro del ViewSet para listar solo productos destacados."""
        featured_products = Product.objects.filter(is_deleted=False, is_feature_product=True)
        page = self.paginate_queryset(featured_products)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(featured_products, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        
        # Verificar si existe alguno de los parámetros opcionales indicados
        include_param = (
            request.query_params.get('include_info') or
            request.query_params.get('include_extra') or
            request.query_params.get('include_metadata') or
            request.query_params.get('include_categories_and_types') or
            request.query_params.get('extra_info')
        )
        
        if include_param is not None and include_param.lower() in ['true', '1', 'yes', '']:
            categories = Category.objects.filter(is_deleted=False)
            categories_serializer = CategorySerializer(categories, many=True)
            
            product_types = ProductType.objects.filter(is_deleted=False)
            product_types_serializer = ProductTypeSerializer(product_types, many=True)
            
            custom_data = {
                'products': response.data,
                'categories': categories_serializer.data,
                'product_types': product_types_serializer.data
            }
            return Response(custom_data, status=status.HTTP_200_OK)
            
        return response

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        
        include_param = (
            request.query_params.get('include_info') or
            request.query_params.get('include_extra') or
            request.query_params.get('include_metadata') or
            request.query_params.get('include_categories_and_types') or
            request.query_params.get('extra_info')
        )
        
        if include_param is not None and include_param.lower() in ['true', '1', 'yes', '']:
            categories = Category.objects.filter(is_deleted=False)
            categories_serializer = CategorySerializer(categories, many=True)
            
            product_types = ProductType.objects.filter(is_deleted=False)
            product_types_serializer = ProductTypeSerializer(product_types, many=True)
            
            custom_data = {
                'product': response.data,
                'categories': categories_serializer.data,
                'product_types': product_types_serializer.data
            }
            return Response(custom_data, status=status.HTTP_200_OK)
            
        return response
