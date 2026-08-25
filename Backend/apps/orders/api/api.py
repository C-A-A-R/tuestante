from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.base.api import BaseViewSet
from apps.orders.models import Order, OrderDetail, OrderProduct, ManufacturingOrder
from apps.product.models import Product
from apps.orders.api.serializers import OrderSerializer, ManufacturingOrderSerializer


class OrderViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Pedidos.
    - Los usuarios autenticados pueden ver sus propios pedidos y crear nuevos.
    - Los usuarios administradores pueden ver todos los pedidos y editarlos.
    - Utiliza prefetch_related y select_related para evitar N+1 queries.
    """

    serializer_class = OrderSerializer

    def get_permissions(self):
        """Define permisos dinámicos según la acción."""
        if self.action in ['list', 'retrieve', 'create']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        """
        Retorna el queryset optimizado.
        - Filtra registros eliminados lógicamente (is_deleted=False).
        - Si no es administrador, filtra solo las órdenes del usuario actual.
        """
        queryset = Order.objects.filter(is_deleted=False).select_related('user').prefetch_related(
            'details__order_products__product',
            'manufacturing_orders__issued_by'
        )

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(user=self.request.user)

        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Crea un pedido con sus detalles y productos en una transacción atómica.
        Formato esperado de request.data:
        {
            "notes": "Notas del pedido",
            "items": [
                {
                    "product_id": 1,
                    "quantity": 2,
                    "notes": "Especificaciones del producto (dimensiones, color, etc.)"
                }
            ]
        }
        """
        data = request.data
        items = data.get('items', [])

        if not items:
            return Response(
                {"error": "Debe incluir al menos un producto en el pedido (campo 'items')."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Crear cabecera de la Orden
        order = Order.objects.create(
            user=request.user,
            status='pending_initial_payment',
            notes=data.get('notes', ''),
            total_price=0
        )

        total_price = 0

        # 2. Procesar detalles
        for item in items:
            product_id = item.get('product_id')
            quantity = item.get('quantity', 1)
            item_notes = item.get('notes', '')

            try:
                quantity = int(quantity)
                if quantity <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                return Response(
                    {"error": f"La cantidad para el producto ID {product_id} debe ser un entero positivo."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Buscar producto no eliminado
            try:
                product = Product.objects.get(id=product_id, is_deleted=False)
            except Product.DoesNotExist:
                return Response(
                    {"error": f"El producto con ID {product_id} no existe o ha sido eliminado."},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Crear detalle de la orden
            detail = OrderDetail.objects.create(
                order=order,
                quantity=quantity,
                unit_price=product.price,
                notes=item_notes
            )

            # Guardar el snapshot del producto en este detalle
            OrderProduct.objects.create(
                order_detail=detail,
                product=product,
                price_at_order=product.price
            )

            total_price += detail.final_price

        # 3. Guardar precio total final
        order.total_price = total_price
        order.save()

        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def issue_manufacturing_order(self, request, pk=None):
        """
        Permite a un administrador generar manualmente una nueva orden de fabricación
        (p. ej. en casos de refabricación o para forzar una nueva iteración).
        """
        order = self.get_object()
        last_iteration = ManufacturingOrder.objects.filter(order=order).count()

        mo = ManufacturingOrder.objects.create(
            order=order,
            status='pending',
            iteration=last_iteration + 1,
            issued_by=request.user,
            notes=request.data.get('notes', 'Generada desde el panel API por administración')
        )

        serializer = ManufacturingOrderSerializer(mo)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ManufacturingOrderViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Órdenes de Fabricación.
    - Exclusivo para personal administrador o de producción.
    """
    serializer_class = ManufacturingOrderSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return ManufacturingOrder.objects.filter(is_deleted=False).select_related(
            'order__user',
            'issued_by'
        )
