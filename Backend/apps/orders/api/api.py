from datetime import timedelta
from django.db import transaction
from django.db.models import Case, When, Value, IntegerField, Prefetch, Count
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.base.api import BaseViewSet
from apps.orders.models import Order, OrderDetail, OrderProduct, ManufacturingOrder
from apps.product.models import Product
from apps.shipment.models import Shipment, Distributor
from apps.orders.api.serializers import OrderSerializer, ManufacturingOrderSerializer
from django.contrib.auth import get_user_model

User = get_user_model()


class OrderViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Pedidos.
    - Los usuarios autenticados pueden ver sus propios pedidos y crear nuevos.
    - Los usuarios administradores pueden ver todos los pedidos y editarlos.
    - Utiliza prefetch_related y select_related para evitar N+1 queries.
    """

    serializer_class = OrderSerializer
    search_fields = ['order_number', 'user__first_name', 'user__last_name', 'user__username', 'user__email', 'notes']
    ordering_fields = ['created_at', 'total_price', 'status', 'id']

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
            Prefetch(
                'details',
                queryset=OrderDetail.objects.filter(is_deleted=False).prefetch_related(
                    Prefetch(
                        'order_products',
                        queryset=OrderProduct.objects.filter(is_deleted=False).select_related('product')
                    )
                )
            ),
            Prefetch(
                'manufacturing_orders',
                queryset=ManufacturingOrder.objects.filter(is_deleted=False).select_related('issued_by')
            ),
            Prefetch(
                'shipments',
                queryset=Shipment.objects.filter(is_deleted=False).select_related('distributor')
            )
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

    @action(detail=False, methods=['get'], url_path='dashboard', permission_classes=[permissions.IsAdminUser])
    def dashboard(self, request, *args, **kwargs):
        """Entrega en una sola consulta lógica los datos del dashboard administrativo."""
        queryset = Order.objects.filter(is_deleted=False)
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        status_config = {
            'pending_initial_payment': ('Pendiente de pago', '#f59e0b'),
            'initial_payment_review': ('Pago inicial en revisión', '#f87171'),
            'manufacturing': ('En fabricación', '#8b5cf6'),
            'waiting_final_payment': ('Esperando pago final', '#0ea5e9'),
            'final_payment_review': ('Pago final en revisión', '#10b981'),
            'shipped': ('Enviados', '#4d82bc'),
            'finalized': ('Finalizados', '#005187'),
            'returned_manufacturing': ('Devueltos', '#ec4899'),
            'cancelled': ('Cancelados', '#64748b'),
        }
        non_completed_queryset = queryset.exclude(status='finalized')
        counts = {row['status']: row['total'] for row in non_completed_queryset.values('status').annotate(total=Count('id'))}
        total = non_completed_queryset.count()

        distribution = [
            {
                'id': status_key,
                'label': label,
                'count': counts.get(status_key, 0),
                'color': color,
                'percentage': round((counts.get(status_key, 0) / total) * 100, 2) if total else 0,
            }
            for status_key, (label, color) in status_config.items()
        ]

        recent_orders = []
        for order in queryset.select_related('user').order_by('-created_at', '-id')[:5]:
            recent_orders.append({
                'id': order.id,
                'orderCode': order.order_number or f'#{order.id:05d}',
                'clientName': order.user.get_full_name() or order.user.email or order.user.username,
                'clientEmail': order.user.email or '',
                'total': float(order.total_price or 0),
                'formattedTotal': f'${float(order.total_price or 0):,.2f}',
                'status': order.status,
                'statusLabel': order.get_status_display(),
                'date': order.created_at.strftime('%d/%m/%Y'),
            })

        return Response({
            'metrics': {
                'todayOrders': queryset.filter(created_at=today).count(),
                'yesterdayOrders': queryset.filter(created_at=yesterday).count(),
                'totalOrdersYear': queryset.filter(created_at__year=today.year).count(),
                'pendingPayment': counts.get('pending_initial_payment', 0),
                'inManufacturing': counts.get('manufacturing', 0),
                'reviewPayment': counts.get('initial_payment_review', 0) + counts.get('final_payment_review', 0),
                'shippedOrders': counts.get('shipped', 0),
            },
            'distribution': {'total': total, 'items': distribution},
            'recentOrders': recent_orders,
        }, status=status.HTTP_200_OK)

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

            # Validar que el producto esté activo
            if not product.is_active:
                return Response(
                    {"error": f"El producto '{product.product_name}' no se encuentra disponible (inactivo o agotado)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validar stock en Outlet si el producto es Outlet
            if product.is_outlet:
                if product.quantity <= 0:
                    return Response(
                        {"error": f"El producto '{product.product_name}' está agotado en el Outlet."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if quantity > product.quantity:
                    return Response(
                        {"error": f"No hay suficiente stock en Outlet para '{product.product_name}'. Cantidad solicitada: {quantity}, disponible: {product.quantity}."},
                        status=status.HTTP_400_BAD_REQUEST
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

        target_user = request.user
        selected_user_id = data.get('user') or data.get('client_id') if isinstance(data, dict) else None
        if request.user.is_staff and selected_user_id:
            try:
                target_user = User.objects.get(id=selected_user_id, is_deleted=False, is_staff=False)
            except User.DoesNotExist:
                return Response(
                    {"error": "El cliente seleccionado no existe o no es un cliente válido."},
                    status=status.HTTP_404_NOT_FOUND
                )

        # 3. Crear cabecera de la Orden
        order = Order.objects.create(
            user=target_user,
            status='pending_initial_payment',
            notes=order_notes,
            total_price=0
        )

        total_price = 0

        # 4. Crear detalles y productos de la orden y actualizar stock de outlet
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

            # Si es un producto de Outlet, descontar el inventario del producto
            if product.is_outlet:
                product.quantity = max(0, product.quantity - quantity)
                product.save()

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

    def update(self, request, *args, **kwargs):
        """Bloquea la actualización de pedidos."""
        return Response(
            {"error": "Los pedidos no pueden ser actualizados una vez creados."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def partial_update(self, request, *args, **kwargs):
        """Bloquea la actualización parcial de pedidos."""
        return Response(
            {"error": "Los pedidos no pueden ser actualizados una vez creados."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def destroy(self, request, *args, **kwargs):
        """Bloquea la eliminación de pedidos."""
        return Response(
            {"error": "Los pedidos no pueden ser eliminados."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )


class ManufacturingOrderViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Órdenes de Fabricación.
    - Exclusivo para personal administrador o de producción.
    """
    serializer_class = ManufacturingOrderSerializer
    permission_classes = [permissions.IsAdminUser]
    search_fields = ['manufacturing_order_number', 'order__order_number', 'issued_by__username', 'notes']
    ordering_fields = ['created_at', 'status', 'id']

    def get_queryset(self):
        qs = ManufacturingOrder.objects.filter(is_deleted=False).select_related(
            'order__user',
            'issued_by'
        )
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        order_param = self.request.query_params.get('order_id') or self.request.query_params.get('order')
        if order_param:
            qs = qs.filter(order_id=order_param)
        return qs
