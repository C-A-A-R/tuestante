import json
from django.utils import timezone
from django.db.models import Count, Q, Prefetch
from rest_framework import status, generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.base.api import BaseViewSet
from apps.product.models import (
    ProductType,
    Product,
    ProductColorImage,
    ProductAngleImage,
    FavoriteProduct
)
from apps.product.api.serializers import (
    ProductTypeSerializer,
    ProductSerializer,
    FavoriteProductSerializer
)


class ProductTypeViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Tipos de Productos.
    - Lectura pública.
    - Creación/Edición/Eliminación: restringido a usuarios administradores.
    """
    serializer_class = ProductTypeSerializer
    search_fields = ['product_type_name', 'description']
    ordering_fields = ['product_type_name', 'products_count', 'created_at', 'id']

    def get_queryset(self):
        return ProductType.objects.filter(is_deleted=False).annotate(
            products_count=Count('products', filter=Q(products__is_deleted=False))
        )

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def perform_create(self, serializer):
        instance = serializer.save()
        # Si no se definió plantilla arquitectónica previa, invocar a la IA para inferir arquitectura base
        if not instance.layout_template or self.request.data.get('auto_infer_architecture', True):
            try:
                from apps.product.services.architecture_service import ProductTypeArchitectureService
                ProductTypeArchitectureService.auto_populate_product_type(instance)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Error al auto-inferir arquitectura de ProductType {instance.id}: {e}")

    def perform_update(self, serializer):
        instance = serializer.save()
        # Si se solicita explícitamente re-inferir o falta la plantilla, regenerarla
        if self.request.data.get('reinfer_architecture', False) or not instance.layout_template:
            try:
                from apps.product.services.architecture_service import ProductTypeArchitectureService
                force = bool(self.request.data.get('reinfer_architecture', False))
                ProductTypeArchitectureService.auto_populate_product_type(instance, force=force)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Error al actualizar arquitectura de ProductType {instance.id}: {e}")

    @action(detail=True, methods=['post'], url_path='infer-architecture', permission_classes=[permissions.IsAdminUser])
    def infer_architecture(self, request, pk=None):
        """
        Endpoint para forzar la re-inferencia por IA de la arquitectura de este tipo de producto.
        """
        product_type = self.get_object()
        from apps.product.services.architecture_service import ProductTypeArchitectureService
        ProductTypeArchitectureService.auto_populate_product_type(product_type, force=True)
        serializer = self.get_serializer(product_type)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='preview-architecture', permission_classes=[permissions.IsAdminUser])
    def preview_architecture(self, request):
        """
        Permite previsualizar la inferencia arquitectónica y plantilla de secciones
        para un nombre y descripción propuestos antes de crear el tipo.
        """
        name = request.data.get('product_type_name', '')
        desc = request.data.get('description', '')
        if not name:
            return Response({"error": "Debe especificar 'product_type_name'."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.product.services.architecture_service import ProductTypeArchitectureService
        inference = ProductTypeArchitectureService.infer_architecture(name=name, description=desc)
        return Response(inference.model_dump(mode='json'), status=status.HTTP_200_OK)


class FeaturedProductsAPIView(generics.ListAPIView):
    """
    APIView dedicada para obtener únicamente los productos destacados (is_feature_product=True y is_active=True).
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
            is_active=True,
            product_type__is_deleted=False,
            is_feature_product=True
        ).prefetch_related(
            Prefetch('color_images', queryset=ProductColorImage.objects.filter(is_deleted=False)),
            Prefetch('angle_images', queryset=ProductAngleImage.objects.filter(is_deleted=False))
        ).select_related('product_type').annotate(
            favorites_count=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True)
        )

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.exclude(is_outlet=True, quantity__lte=0)

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
        queryset = Product.objects.filter(
            is_deleted=False,
            is_active=True,
            is_feature_product=True
        ).prefetch_related(
            'color_images',
            'angle_images'
        ).select_related('product_type').annotate(
            favorites_count=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True)
        )
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.exclude(is_outlet=True, quantity__lte=0)
        return queryset.order_by('favorites_count', '-created_at', '-id')


class ProductViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Productos.
    - Lectura pública (por defecto solo productos activos para usuarios comunes).
    - Creación/Edición/Eliminación: restringido a usuarios administradores.
    """
    serializer_class = ProductSerializer
    search_fields = ['product_name', 'description', 'security', 'product_type__product_type_name']
    ordering_fields = ['product_name', 'price', 'created_at', 'quantity', 'favorites_count', 'id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'featured']:
            return [permissions.AllowAny()]
        if self.action in ['toggle_active']:
            return [permissions.IsAuthenticated()]
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
        queryset = Product.objects.filter(
            is_deleted=False,
            product_type__is_deleted=False
        ).prefetch_related(
            Prefetch('color_images', queryset=ProductColorImage.objects.filter(is_deleted=False)),
            Prefetch('angle_images', queryset=ProductAngleImage.objects.filter(is_deleted=False))
        ).select_related('product_type').annotate(
            favorites_count=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True)
        )

        # Filtro de activación y disponibilidad:
        # - Para clientes públicos: solo productos activos (is_active=True).
        # - En modo administración (staff o parámetro admin=true): se muestran todos, o se filtra según el selector.
        # - Los productos outlet que no tengan cantidad (quantity <= 0) NO pueden verse para los clientes.
        # - Los productos regulares sí pueden verse con stock 0 (se fabrican bajo pedido).
        is_admin_view = bool(
            (self.request.user and (self.request.user.is_staff or self.request.user.is_superuser)) or
            self.request.query_params.get('admin') in ['true', '1'] or
            self.request.query_params.get('manage') in ['true', '1']
        )

        if not is_admin_view:
            queryset = queryset.filter(is_active=True).exclude(is_outlet=True, quantity__lte=0)
        else:
            is_active_param = (
                self.request.query_params.get('is_active') or
                self.request.query_params.get('es_activo') or
                self.request.query_params.get('activo') or
                self.request.query_params.get('status')
            )
            if is_active_param is not None and is_active_param.strip().lower() != 'all':
                if is_active_param.strip().lower() in ['true', '1', 'yes', 'si', 'active', 'activo']:
                    queryset = queryset.filter(is_active=True)
                elif is_active_param.strip().lower() in ['false', '0', 'no', 'inactive', 'inactivo']:
                    queryset = queryset.filter(is_active=False)

        # Filtro por tipo de producto
        type_param = self.request.query_params.get('type') or self.request.query_params.get('product_type')
        if type_param and type_param.lower() != 'all':
            queryset = queryset.filter(product_type__id=type_param)

        # Filtro por Outlet
        outlet_param = self.request.query_params.get('outlet') or self.request.query_params.get('is_outlet')
        if outlet_param is not None and outlet_param.strip().lower() in ['true', '1', 'yes']:
            queryset = queryset.filter(is_outlet=True)
            if not is_admin_view:
                queryset = queryset.filter(quantity__gt=0)

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

    @action(detail=False, methods=['get'], url_path='metrics', permission_classes=[permissions.IsAdminUser])
    def metrics(self, request, *args, **kwargs):
        """Retorna los KPI agregados del catálogo sin cargar todos los productos."""
        queryset = Product.objects.filter(is_deleted=False)
        totals = queryset.aggregate(
            total=Count('id'),
            active=Count('id', filter=Q(is_active=True)),
            inactive=Count('id', filter=Q(is_active=False)),
            outlet=Count('id', filter=Q(is_outlet=True)),
            featured=Count('id', filter=Q(is_feature_product=True)),
            favorites=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True),
        )
        return Response(totals, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post', 'patch'], url_path='toggle-active', permission_classes=[permissions.IsAuthenticated])
    def toggle_active(self, request, pk=None):
        """Alterna el estado is_active del producto de forma atómica y rápida."""
        product = Product.objects.filter(id=pk, is_deleted=False).first()
        if not product:
            return Response({'detail': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if 'is_active' in request.data:
            val = request.data.get('is_active')
            if isinstance(val, str):
                product.is_active = val.lower() in ['true', '1', 'yes']
            else:
                product.is_active = bool(val)
        else:
            product.is_active = not product.is_active

        product.save(update_fields=['is_active', 'updated_at'])
        serializer = self.get_serializer(product)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        # Verificar si existe alguno de los parámetros opcionales indicados
        include_param = (
            request.query_params.get('include_info') or
            request.query_params.get('include_extra') or
            request.query_params.get('include_metadata') or
            request.query_params.get('extra_info')
        )

        if include_param is not None and include_param.lower() in ['true', '1', 'yes', '']:
            product_types = ProductType.objects.filter(is_deleted=False)
            product_types_serializer = ProductTypeSerializer(product_types, many=True)

            custom_data = {
                'products': response.data,
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
            request.query_params.get('extra_info')
        )

        if include_param is not None and include_param.lower() in ['true', '1', 'yes', '']:
            product_types = ProductType.objects.filter(is_deleted=False)
            product_types_serializer = ProductTypeSerializer(product_types, many=True)

            custom_data = {
                'product': response.data,
                'product_types': product_types_serializer.data
            }
            return Response(custom_data, status=status.HTTP_200_OK)

        return response

    def create(self, request, *args, **kwargs):
        """Crea el producto y registra las variantes de color y ángulos enviadas."""
        response = super().create(request, *args, **kwargs)
        if response.status_code == status.HTTP_201_CREATED:
            product_id = response.data.get('id')
            if product_id:
                product = Product.objects.filter(id=product_id).first()
                if product:
                    self._handle_color_and_angle_images(product, request)
                    serializer = self.get_serializer(product)
                    response.data = serializer.data
        return response

    def update(self, request, *args, **kwargs):
        """Actualiza el producto y sus variantes de color y ángulos si fueron enviadas."""
        response = super().update(request, *args, **kwargs)
        if response.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]:
            product = self.get_object()
            if 'colors_data' in request.data or 'color_images' in request.data:
                ProductColorImage.objects.filter(product=product).update(is_deleted=True)
            if 'angles_data' in request.data or 'angle_images' in request.data:
                ProductAngleImage.objects.filter(product=product).update(is_deleted=True)
            self._handle_color_and_angle_images(product, request)
            response.data = self.get_serializer(product).data
        return response

    def _handle_color_and_angle_images(self, product, request):
        """Procesa y guarda registros de ProductColorImage y ProductAngleImage."""
        # 1. Variantes de color
        colors_raw = request.data.get('colors_data')
        colors_data = []
        if isinstance(colors_raw, str):
            try:
                colors_data = json.loads(colors_raw)
            except Exception:
                colors_data = []
        elif isinstance(colors_raw, list):
            colors_data = colors_raw
        elif not colors_raw:
            colors_data = request.data.get('color_images', [])

        if isinstance(colors_data, list):
            for idx, item in enumerate(colors_data):
                if not isinstance(item, dict):
                    continue
                c_name = item.get('color_name') or f"Color {idx + 1}"
                c_hex = item.get('color_hex') or "#000000"
                c_file = request.FILES.get(f'color_file_{idx}') or request.FILES.get(f'color_image_{idx}')
                color_id = item.get('id')
                color = ProductColorImage.objects.filter(id=color_id, product=product).first() if color_id else None
                if color:
                    color.color_name = c_name
                    color.color_hex = c_hex
                    color.is_deleted = False
                    if c_file:
                        color.color_image = c_file
                    color.save()
                else:
                    ProductColorImage.objects.create(
                        product=product,
                        color_name=c_name,
                        color_hex=c_hex,
                        color_image=c_file
                    )

        # 2. Variantes de ángulos
        angles_raw = request.data.get('angles_data')
        angles_data = []
        if isinstance(angles_raw, str):
            try:
                angles_data = json.loads(angles_raw)
            except Exception:
                angles_data = []
        elif isinstance(angles_raw, list):
            angles_data = angles_raw
        elif not angles_raw:
            angles_data = request.data.get('angle_images', [])

        if isinstance(angles_data, list):
            for idx, item in enumerate(angles_data):
                if not isinstance(item, dict):
                    continue
                a_angle = item.get('angle') or f"Vista {idx + 1}"
                a_file = request.FILES.get(f'angle_file_{idx}') or request.FILES.get(f'angle_image_{idx}')
                angle_id = item.get('id')
                angle = ProductAngleImage.objects.filter(id=angle_id, product=product).first() if angle_id else None
                if angle:
                    angle.angle = a_angle
                    angle.is_deleted = False
                    if a_file:
                        angle.image = a_file
                    angle.save()
                else:
                    ProductAngleImage.objects.create(
                        product=product,
                        angle=a_angle,
                        image=a_file
                    )


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
            'color_images',
            'angle_images'
        ).select_related('product_type').annotate(
            favorites_count=Count('favorites', filter=Q(favorites__is_deleted=False), distinct=True)
        ).distinct()

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_active=True).exclude(is_outlet=True, quantity__lte=0)

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
