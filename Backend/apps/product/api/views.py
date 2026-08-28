from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import status, generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.base.api import BaseViewSet
from apps.product.models import Category, ProductType, Product, FavoriteProduct
from apps.product.api.serializers import (
    CategorySerializer,
    ProductTypeSerializer,
    ProductSerializer,
    FavoriteProductSerializer
)


class CategoryViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Categorías.
    - Lectura pública.
    - Creación/Edición/Eliminación: restringido a usuarios administradores.
    """
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]


class ProductTypeViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Tipos de Productos.
    - Lectura pública.
    - Creación/Edición/Eliminación: restringido a usuarios administradores.
    """
    serializer_class = ProductTypeSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]


class FeaturedProductsAPIView(generics.ListAPIView):
    """
    APIView dedicada para obtener únicamente los productos destacados (is_feature_product=True).
    """
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request and self.request.user and self.request.user.is_authenticated:
            fav_ids = set(FavoriteProduct.objects.filter(
                user=self.request.user,
                is_deleted=False
            ).values_list('product_id', flat=True))
            context['favorite_product_ids'] = fav_ids
        return context

    def get_queryset(self):
        queryset = Product.objects.filter(
            is_deleted=False,
            is_feature_product=True
        ).prefetch_related(
            'categories',
            'color_images',
            'angle_images'
        ).select_related('product_type').annotate(
            favorites_count=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True)
        )

        sort_fav_param = (
            self.request.query_params.get('sort_by_favorites') or
            self.request.query_params.get('order_by_favorites') or
            self.request.query_params.get('most_favorited') or
            self.request.query_params.get('popular') or
            self.request.query_params.get('ranking_favorites') or
            self.request.query_params.get('mas_favoritos') or
            self.request.query_params.get('por_favoritos') or
            self.request.query_params.get('favoritos_desc')
        )
        sort_param = self.request.query_params.get('sort') or self.request.query_params.get('ordering')

        is_sort_by_favorites = False
        if sort_fav_param is not None:
            is_sort_by_favorites = sort_fav_param.strip().lower() not in ['false', '0', 'no']
        elif sort_param and sort_param.strip().lower() in [
            'favorites', 'most_favorite', 'most_favorited', 'popular',
            '-favorites_count', 'favorites_count', 'favoritos', '-favoritos', 'mas_favoritos'
        ]:
            is_sort_by_favorites = True

        if is_sort_by_favorites:
            return queryset.order_by('-favorites_count', '-created_at', '-id')

        return queryset.order_by('-created_at', '-id')


class FeaturedProductsLeastFavoritesAPIView(generics.ListAPIView):
    """
    APIView dedicada para retornar todos los productos destacados ordenados
    desde el que MENOS favoritos tenga al que MÁS tiene (orden ascendente por favorites_count).
    Endpoint: GET /api/products/featured-products/least-favorites/
    """
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request and self.request.user and self.request.user.is_authenticated:
            fav_ids = set(FavoriteProduct.objects.filter(
                user=self.request.user,
                is_deleted=False
            ).values_list('product_id', flat=True))
            context['favorite_product_ids'] = fav_ids
        return context

    def get_queryset(self):
        return Product.objects.filter(
            is_deleted=False,
            is_feature_product=True
        ).prefetch_related(
            'categories',
            'color_images',
            'angle_images'
        ).select_related('product_type').annotate(
            favorites_count=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True)
        ).order_by('favorites_count', '-created_at', '-id')



class ProductViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Productos.
    - Lectura pública.
    - Creación/Edición/Eliminación: restringido a usuarios administradores.
    """
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'featured']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_serializer_context(self):
        """Inyecta los IDs de favoritos del usuario en el contexto para optimizar consultas a O(1)."""
        context = super().get_serializer_context()
        if self.request and self.request.user and self.request.user.is_authenticated:
            fav_ids = set(FavoriteProduct.objects.filter(
                user=self.request.user,
                is_deleted=False
            ).values_list('product_id', flat=True))
            context['favorite_product_ids'] = fav_ids
        return context

    def get_queryset(self):
        queryset = Product.objects.filter(is_deleted=False).prefetch_related(
            'categories',
            'color_images',
            'angle_images'
        ).select_related('product_type').annotate(
            favorites_count=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True)
        )

        cat_param = self.request.query_params.get('category') or self.request.query_params.get('cat')
        type_param = self.request.query_params.get('type') or self.request.query_params.get('product_type')

        if cat_param and cat_param.lower() != 'all':
            queryset = queryset.filter(categories__id=cat_param)
        if type_param and type_param.lower() != 'all':
            queryset = queryset.filter(product_type__id=type_param)

        # Filtro opcional para obtener únicamente los favoritos del usuario autenticado
        fav_param = (
            self.request.query_params.get('only_favorites') or
            self.request.query_params.get('favorites') or
            self.request.query_params.get('wishlist') or
            self.request.query_params.get('favoritos') or
            self.request.query_params.get('is_favorite')
        )
        if fav_param is not None and fav_param.strip().lower() in ['true', '1', 'yes', 'si', '']:
            if self.request.user and self.request.user.is_authenticated:
                queryset = queryset.filter(favorites__user=self.request.user, favorites__is_deleted=False)
            else:
                queryset = queryset.none()

        # Ordenamiento opcional de más favorito a menos favorito
        sort_fav_param = (
            self.request.query_params.get('sort_by_favorites') or
            self.request.query_params.get('order_by_favorites') or
            self.request.query_params.get('most_favorited') or
            self.request.query_params.get('popular') or
            self.request.query_params.get('ranking_favorites') or
            self.request.query_params.get('mas_favoritos') or
            self.request.query_params.get('por_favoritos') or
            self.request.query_params.get('favoritos_desc')
        )
        sort_param = self.request.query_params.get('sort') or self.request.query_params.get('ordering')

        is_sort_by_favorites = False
        if sort_fav_param is not None:
            is_sort_by_favorites = sort_fav_param.strip().lower() not in ['false', '0', 'no']
        elif sort_param and sort_param.strip().lower() in [
            'favorites', 'most_favorite', 'most_favorited', 'popular',
            '-favorites_count', 'favorites_count', 'favoritos', '-favoritos', 'mas_favoritos'
        ]:
            is_sort_by_favorites = True

        if is_sort_by_favorites:
            queryset = queryset.order_by('-favorites_count', '-created_at', '-id')

        return queryset.distinct()

    @action(detail=False, methods=['get'], url_path='featured')
    def featured(self, request, *args, **kwargs):
        """Endpoint dentro del ViewSet para listar solo productos destacados."""
        featured_products = self.get_queryset().filter(is_feature_product=True)
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


# =========================================================================
# APIViews DEDICADAS PARA PRODUCTOS FAVORITOS / WISHLIST
# =========================================================================

class UserFavoritesAPIView(generics.ListAPIView):
    """
    APIView para listar todos los productos favoritos / deseados del usuario autenticado.
    Endpoint: GET /api/products/favorites/ o GET /api/products/wishlist/
    Soporta ordenamiento de más favorito a menos favorito (?sort_by_favorites=true).
    """
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        fav_ids = set(FavoriteProduct.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).values_list('product_id', flat=True))
        context['favorite_product_ids'] = fav_ids
        return context

    def get_queryset(self):
        queryset = Product.objects.filter(
            favorites__user=self.request.user,
            favorites__is_deleted=False,
            is_deleted=False
        ).prefetch_related(
            'categories',
            'color_images',
            'angle_images'
        ).select_related('product_type').annotate(
            favorites_count=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True)
        ).distinct()

        sort_fav_param = (
            self.request.query_params.get('sort_by_favorites') or
            self.request.query_params.get('order_by_favorites') or
            self.request.query_params.get('most_favorited') or
            self.request.query_params.get('popular') or
            self.request.query_params.get('ranking_favorites') or
            self.request.query_params.get('mas_favoritos') or
            self.request.query_params.get('por_favoritos') or
            self.request.query_params.get('favoritos_desc')
        )
        sort_param = self.request.query_params.get('sort') or self.request.query_params.get('ordering')

        is_sort_by_favorites = False
        if sort_fav_param is not None:
            is_sort_by_favorites = sort_fav_param.strip().lower() not in ['false', '0', 'no']
        elif sort_param and sort_param.strip().lower() in [
            'favorites', 'most_favorite', 'most_favorited', 'popular',
            '-favorites_count', 'favorites_count', 'favoritos', '-favoritos', 'mas_favoritos'
        ]:
            is_sort_by_favorites = True

        if is_sort_by_favorites:
            queryset = queryset.order_by('-favorites_count', '-created_at', '-id')
        else:
            queryset = queryset.order_by('-created_at', '-id')

        return queryset


class ToggleFavoriteAPIView(APIView):
    """
    APIView para alternar (toggle) el estado de favorito de un producto.
    Endpoint: POST /api/products/favorites/<product_id>/toggle/ o /api/products/wishlist/<product_id>/toggle/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, product_id):
        try:
            product = Product.objects.get(id=product_id, is_deleted=False)
        except Product.DoesNotExist:
            return Response(
                {"error": f"El producto con ID {product_id} no existe o ha sido eliminado."},
                status=status.HTTP_404_NOT_FOUND
            )

        fav = FavoriteProduct.objects.filter(user=request.user, product=product).first()

        if fav:
            if fav.is_deleted:
                fav.is_deleted = False
                fav.deleted_at = None
                fav.save(update_fields=['is_deleted', 'deleted_at'])
                is_fav = True
                message = f"'{product.product_name}' fue agregado a tus favoritos."
            else:
                fav.is_deleted = True
                fav.deleted_at = timezone.now().date()
                fav.save(update_fields=['is_deleted', 'deleted_at'])
                is_fav = False
                message = f"'{product.product_name}' fue eliminado de tus favoritos."
        else:
            FavoriteProduct.objects.create(user=request.user, product=product)
            is_fav = True
            message = f"'{product.product_name}' fue agregado a tus favoritos."

        return Response({
            'is_favorite': is_fav,
            'message': message,
            'product_id': product.id
        }, status=status.HTTP_200_OK)


class FavoriteProductAPIView(APIView):
    """
    APIView para gestionar el favorito de un producto específico.
    - POST /api/products/favorites/<product_id>/ : Marcar producto como favorito.
    - DELETE /api/products/favorites/<product_id>/ : Desmarcar producto de favoritos.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, product_id):
        try:
            product = Product.objects.get(id=product_id, is_deleted=False)
        except Product.DoesNotExist:
            return Response(
                {"error": f"El producto con ID {product_id} no existe o ha sido eliminado."},
                status=status.HTTP_404_NOT_FOUND
            )

        fav = FavoriteProduct.objects.filter(user=request.user, product=product).first()
        if fav:
            if fav.is_deleted:
                fav.is_deleted = False
                fav.deleted_at = None
                fav.save(update_fields=['is_deleted', 'deleted_at'])
        else:
            FavoriteProduct.objects.create(user=request.user, product=product)

        return Response({
            'is_favorite': True,
            'message': f"'{product.product_name}' fue agregado a tus favoritos.",
            'product_id': product.id
        }, status=status.HTTP_200_OK)

    def delete(self, request, product_id):
        try:
            product = Product.objects.get(id=product_id, is_deleted=False)
        except Product.DoesNotExist:
            return Response(
                {"error": f"El producto con ID {product_id} no existe o ha sido eliminado."},
                status=status.HTTP_404_NOT_FOUND
            )

        fav = FavoriteProduct.objects.filter(user=request.user, product=product, is_deleted=False).first()
        if fav:
            fav.is_deleted = True
            fav.deleted_at = timezone.now().date()
            fav.save(update_fields=['is_deleted', 'deleted_at'])

        return Response({
            'is_favorite': False,
            'message': f"'{product.product_name}' fue eliminado de tus favoritos.",
            'product_id': product.id
        }, status=status.HTTP_200_OK)
