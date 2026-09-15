from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.db import transaction
from django.db.models import Count, Sum

from apps.base.api import BaseViewSet
from apps.shipment.models import Distributor, Shipment
from apps.shipment.api.serializers import DistributorSerializer, ShipmentSerializer


class DistributorViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Distribuidores.
    - Lectura: Autenticados.
    - Escritura: Administradores.
    """

    serializer_class = DistributorSerializer
    search_fields = ['name', 'phone', 'email']
    ordering_fields = ['name', 'created_at', 'id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = Distributor.objects.filter(is_deleted=False)
        # Los clientes normales solo ven distribuidores activos
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_active=True)
        return queryset


class ShipmentViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Envíos.
    - Los usuarios autenticados pueden ver el envío de sus pedidos.
    - Los administradores pueden crear, modificar y cambiar el estado de cualquier envío.
    """

    serializer_class = ShipmentSerializer
    search_fields = [
        'tracking_number',
        'order__order_number',
        'distributor__name',
        'city',
        'state',
        'address'
    ]
    ordering_fields = ['created_at', 'status', 'id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'metrics']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        """
        Retorna envíos no eliminados.
        - Filtra por el usuario autenticado a menos que sea personal/admin.
        - Excluye órdenes eliminadas lógicamente.
        """
        queryset = Shipment.objects.filter(
            is_deleted=False,
            order__is_deleted=False
        ).select_related('order', 'order__user', 'distributor')

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(order__user=self.request.user)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        order_id = self.request.query_params.get('order_id')
        if order_id:
            queryset = queryset.filter(order_id=order_id)

        distributor_id = self.request.query_params.get('distributor_id')
        if distributor_id:
            queryset = queryset.filter(distributor_id=distributor_id)

        return queryset

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def update_status(self, request, pk=None):
        """
        Endpoint para actualizar el estado del envío y sincronizar la orden.
        Body:
        {
            "status": "in_transit" | "delivered" | "returned" | "failed"
        }
        """
        shipment = self.get_object()
        new_status = request.data.get('status')

        if new_status not in ['in_transit', 'delivered', 'returned', 'failed']:
            return Response(
                {"error": "Estado de envío no válido."},
                status=status.HTTP_400_BAD_REQUEST
            )

        shipment.status = new_status
        order = shipment.order

        if new_status == 'in_transit':
            order.status = 'shipped'
        elif new_status == 'delivered':
            shipment.delivered_at = timezone.now()
            order.status = 'finalized'
        elif new_status == 'returned':
            order.status = 'returned_manufacturing'

        shipment.save()
        order.save()

        serializer = self.get_serializer(shipment)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """
        Retorna estadísticas y KPIs generales de envíos para el panel administrativo.
        """
        queryset = self.get_queryset()

        counts_by_status = queryset.values('status').annotate(
            total=Count('id'),
            total_amount=Sum('price')
        )
        status_dict = {item['status']: item['total'] for item in counts_by_status}
        status_amount_dict = {item['status']: float(item['total_amount'] or 0) for item in counts_by_status}

        now = timezone.now()
        today = now.date()
        month_start = today.replace(day=1)

        delivered_today_qs = queryset.filter(status='delivered', delivered_at__date=today)
        delivered_month_qs = queryset.filter(status='delivered', delivered_at__date__gte=month_start)

        delivered_today_count = delivered_today_qs.count()
        delivered_today_amount = float(delivered_today_qs.aggregate(total=Sum('price'))['total'] or 0)

        delivered_month_count = delivered_month_qs.count()
        delivered_month_amount = float(delivered_month_qs.aggregate(total=Sum('price'))['total'] or 0)

        rate_ves = 36.50

        pending_count = status_dict.get('pending', 0)
        pending_amount = status_amount_dict.get('pending', 0.0)

        transit_count = status_dict.get('in_transit', 0)
        transit_amount = status_amount_dict.get('in_transit', 0.0)

        returned_count = status_dict.get('returned', 0)
        returned_amount = status_amount_dict.get('returned', 0.0)

        data = {
            "pending": {
                "count": pending_count,
                "amount_usd": pending_amount,
                "amount_ves": round(pending_amount * rate_ves, 2)
            },
            "in_transit": {
                "count": transit_count,
                "amount_usd": transit_amount,
                "amount_ves": round(transit_amount * rate_ves, 2)
            },
            "delivered_today": {
                "count": delivered_today_count,
                "amount_usd": delivered_today_amount,
                "amount_ves": round(delivered_today_amount * rate_ves, 2)
            },
            "delivered_month": {
                "count": delivered_month_count,
                "amount_usd": delivered_month_amount,
                "amount_ves": round(delivered_month_amount * rate_ves, 2)
            },
            "returned": {
                "count": returned_count,
                "amount_usd": returned_amount,
                "amount_ves": round(returned_amount * rate_ves, 2)
            },
            "pending_count": pending_count,
            "in_transit_count": transit_count,
            "delivered_today_count": delivered_today_count,
            "delivered_month_count": delivered_month_count,
            "returned_count": returned_count,
        }
        return Response(data, status=status.HTTP_200_OK)
