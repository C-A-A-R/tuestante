from django.db import transaction
from django.db.models import Case, When, Value, IntegerField
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.base.api import BaseViewSet
from apps.orders.models import Order, OrderDetail, OrderProduct, ManufacturingOrder
from apps.product.models import Product
from apps.shipment.models import Shipment, Distributor
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
        if self.action in ['list', 'retrieve', 'create', 'my_orders', 'user_orders']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        """
        Retorna el queryset optimizado.
        - Filtra registros eliminados lógicamente (is_deleted=False).
        - Si no es administrador, filtra solo las órdenes del usuario actual.
        - Si es administrador y se envía user o user_id, filtra por ese usuario.
        - Si se envía el parámetro opcional (e.g. prioritize_unfinished, priorizar_no_finalizadas, unfinished_first),
          se da prioridad a las órdenes que no están finalizadas (status != 'finalized') colocándolas de primeras en el listado.
        """
        queryset = Order.objects.filter(is_deleted=False).select_related('user').prefetch_related(
            'details__order_products__product',
            'manufacturing_orders__issued_by',
            'shipments__distributor'
        )

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(user=self.request.user)
        else:
            user_param = (
                self.request.query_params.get('user_id') or
                self.request.query_params.get('user') or
                self.request.query_params.get('usuario')
            )
            if user_param:
                if str(user_param).isdigit():
                    queryset = queryset.filter(user_id=int(user_param))
                else:
                    queryset = queryset.filter(user__username=user_param)

        status_param = self.request.query_params.get('status') or self.request.query_params.get('estado')
        if status_param:
            queryset = queryset.filter(status=status_param)

        # Parámetro opcional para priorizar órdenes no finalizadas
        prioritize_param = (
            self.request.query_params.get('prioritize_unfinished') or
            self.request.query_params.get('priorizar_no_finalizadas') or
            self.request.query_params.get('priority_unfinished') or
            self.request.query_params.get('unfinished_first') or
            self.request.query_params.get('prioridad_no_finalizadas') or
            self.request.query_params.get('no_finalizadas_primero') or
            self.request.query_params.get('priorizar_pendientes') or
            self.request.query_params.get('pendientes_primero')
        )
        priority_val = self.request.query_params.get('priority')
        sort_val = self.request.query_params.get('sort') or self.request.query_params.get('ordering')

        is_prioritize = False
        if prioritize_param is not None:
            is_prioritize = prioritize_param.strip().lower() not in ['false', '0', 'no']
        elif priority_val and priority_val.strip().lower() in ['unfinished', 'no_finalizadas', 'pendientes', 'true', '1']:
            is_prioritize = True
        elif sort_val and sort_val.strip().lower() in ['unfinished_first', 'no_finalizadas_primero', 'pendientes_primero', 'prioritize_unfinished']:
            is_prioritize = True

        if is_prioritize:
            queryset = queryset.annotate(
                is_finalized=Case(
                    When(status='finalized', then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField()
                )
            ).order_by('is_finalized', '-created_at', '-id')
        else:
            queryset = queryset.order_by('-created_at', '-id')

        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Crea un pedido con sus detalles y productos en una transacción atómica.
        Opcionalmente, crea el registro de envío (shipment) si se envían los datos de envío.

        Formato esperado de request.data (objeto):
        {
            "notes": "Notas del pedido",
            "items": [
                {
                    "product_id": 1,
                    "quantity": 2,
                    "notes": "Especificaciones del producto (dimensiones, color, etc.)"
                }
            ],
            "shipment": {
                "distributor_id": 1,
                "state": "Apure",
                "municipality": "Páez",
                "city": "Guasdualito",
                "address": "Calle 5 con Av. Miranda",
                "notes": "Dejar en portería"
            }
        }
        O también lista directa de items:
        [
            {
                "product_id": 1,
                "quantity": 2,
                "notes": "Especificaciones..."
            }
        ]
        """
        data = request.data
        if isinstance(data, list):
            items = data
            order_notes = ''
            shipment_data = None
        elif isinstance(data, dict):
            items = data.get('items', [])
            order_notes = data.get('notes', '')
            shipment_data = data.get('shipment') or data.get('shipping') or data.get('envio')
        else:
            items = []
            order_notes = ''
            shipment_data = None

        if not items:
            return Response(
                {"error": "Debe incluir al menos un producto en el pedido (campo 'items' o array de productos)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Validar productos y cantidades
        validated_items = []
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

            validated_items.append({
                'product': product,
                'quantity': quantity,
                'notes': item_notes
            })

        # 2. Validar datos de envío si fueron proporcionados (opcional)
        distributor = None
        if shipment_data and isinstance(shipment_data, dict):
            address = shipment_data.get('address')
            if not address:
                return Response(
                    {"error": "El campo 'address' es obligatorio para los datos de envío."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            distributor_id = shipment_data.get('distributor_id') or shipment_data.get('distributor')
            if distributor_id:
                try:
                    distributor = Distributor.objects.get(id=distributor_id, is_deleted=False)
                except Distributor.DoesNotExist:
                    return Response(
                        {"error": f"El distribuidor con ID {distributor_id} no existe o ha sido eliminado."},
                        status=status.HTTP_404_NOT_FOUND
                    )

        # 3. Crear cabecera de la Orden
        order = Order.objects.create(
            user=request.user,
            status='pending_initial_payment',
            notes=order_notes,
            total_price=0
        )

        total_price = 0

        # 4. Crear detalles y productos de la orden
        for item_data in validated_items:
            product = item_data['product']
            quantity = item_data['quantity']
            item_notes = item_data['notes']

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

        # Guardar precio total final
        order.total_price = total_price
        order.save()

        # 5. Crear registro de envío si fue provisto
        if shipment_data and isinstance(shipment_data, dict):
            Shipment.objects.create(
                order=order,
                distributor=distributor,
                state=shipment_data.get('state', ''),
                municipality=shipment_data.get('municipality', ''),
                city=shipment_data.get('city', ''),
                address=shipment_data.get('address'),
                notes=shipment_data.get('notes', ''),
                price=shipment_data.get('price', None),
                estimated_date=shipment_data.get('estimated_date', None)
            )

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

    @action(detail=False, methods=['get'], url_path='my-orders', permission_classes=[permissions.IsAuthenticated])
    def my_orders(self, request):
        """
        Endpoint directo para que el usuario autenticado consulte sus propios pedidos.
        Ejemplo: GET /api/orders/my-orders/?prioritize_unfinished=true
        """
        queryset = self.get_queryset().filter(user=request.user)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='user/(?P<user_id>[^/.]+)', permission_classes=[permissions.IsAuthenticated])
    def user_orders(self, request, user_id=None):
        """
        Permite consultar las órdenes de un usuario específico por ID o username.
        - Clientes autenticados: solo pueden consultar sus propios pedidos.
        - Administradores: pueden consultar los pedidos de cualquier cliente.
        Ejemplo: GET /api/orders/user/3/?prioritize_unfinished=true
        """
        is_owner = (
            str(user_id).isdigit() and request.user.id == int(user_id)
        ) or (
            request.user.username == str(user_id)
        )

        if not (request.user.is_staff or is_owner):
            return Response(
                {"error": "No tienes permiso para ver los pedidos de otro usuario."},
                status=status.HTTP_403_FORBIDDEN
            )

        queryset = self.get_queryset()
        if str(user_id).isdigit():
            queryset = queryset.filter(user_id=int(user_id))
        else:
            queryset = queryset.filter(user__username=user_id)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


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
