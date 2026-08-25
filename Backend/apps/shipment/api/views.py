from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.db import transaction

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

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        """
        Retorna envíos no eliminados.
        - Filtra por el usuario autenticado a menos que sea personal/admin.
        """
        queryset = Shipment.objects.filter(is_deleted=False).select_related('order__user', 'distributor')

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(order__user=self.request.user)

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
