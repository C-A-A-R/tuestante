from django.utils import timezone
from django.db import transaction
from django.db.models import Count, Q, Prefetch
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.base.api import BaseViewSet
from apps.orders.models import Order, OrderDetail, OrderProduct
from apps.production.models import ProductionOrder
from apps.production.api.serializers import (
    ProductionOrderSerializer,
    ProductionOrderStatusUpdateSerializer,
)


class ProductionOrderViewSet(BaseViewSet):
    """
    ViewSet para la gestión y seguimiento de Órdenes de Fabricación en taller.
    - Clientes: pueden consultar el estado de fabricación de sus pedidos.
    - Administradores: controlan y actualizan las etapas de producción en el taller.
    """

    serializer_class = ProductionOrderSerializer
    search_fields = [
        'order__order_number',
        'order__user__first_name',
        'order__user__first_last_name',
        'order__user__username',
        'order__user__email',
        'technical_notes',
    ]
    ordering_fields = ['created_at', 'status', 'iteration', 'id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'by_order', 'my_orders']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        details_prefetch = Prefetch(
            'order__details',
            queryset=OrderDetail.objects.filter(is_deleted=False).prefetch_related(
                Prefetch(
                    'order_products',
                    queryset=OrderProduct.objects.filter(is_deleted=False).select_related('product')
                )
            )
        )
        queryset = ProductionOrder.objects.filter(
            is_deleted=False,
            order__is_deleted=False
        ).select_related(
            'order', 'order__user'
        ).prefetch_related(
            details_prefetch
        )

        # Si es cliente normal, filtrar solo sus pedidos
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(order__user=self.request.user)
        else:
            # Filtros para administradores
            user_param = self.request.query_params.get('user_id') or self.request.query_params.get('user')
            if user_param:
                if str(user_param).isdigit():
                    queryset = queryset.filter(order__user_id=int(user_param))
                else:
                    queryset = queryset.filter(order__user__username=user_param)

        # Filtro por estado de producción
        status_param = self.request.query_params.get('status') or self.request.query_params.get('estado')
        if status_param and status_param != 'all' and status_param != 'todos':
            queryset = queryset.filter(status=status_param)

        # Filtro por ID de Pedido
        order_param = self.request.query_params.get('order_id') or self.request.query_params.get('order')
        if order_param:
            queryset = queryset.filter(order_id=order_param)

        # Filtro por término de búsqueda
        search = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(order__order_number__icontains=search) |
                Q(order__user__first_name__icontains=search) |
                Q(order__user__first_last_name__icontains=search) |
                Q(order__user__username__icontains=search) |
                Q(order__user__email__icontains=search) |
                Q(technical_notes__icontains=search)
            )

        return queryset

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def update_status(self, request, pk=None):
        """
        Actualiza el estado de la orden de producción en taller y sincroniza el pedido.
        Payload esperado:
        {
            "status": "queued" | "assembling" | "painting" | "quality_check" | "completed",
            "technical_notes": "Notas adicionales opcionales...",
            "actual_completion_date": "2026-09-03T18:00:00Z" (opcional)
        }
        """
        production_order = self.get_object()
        serializer = ProductionOrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        technical_notes = serializer.validated_data.get('technical_notes')
        actual_completion_date = serializer.validated_data.get('actual_completion_date')

        production_order.status = new_status
        if technical_notes is not None:
            production_order.technical_notes = technical_notes
        if actual_completion_date is not None:
            production_order.actual_completion_date = actual_completion_date

        production_order.save()

        out_serializer = self.get_serializer(production_order)
        return Response(
            {
                "message": f"Estado de fabricación actualizado a '{production_order.get_status_display()}'.",
                "production_order": out_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def advance_stage(self, request, pk=None):
        """Avanza automáticamente la orden de producción a la siguiente fase del taller."""
        production_order = self.get_object()
        stages_flow = ['queued', 'assembling', 'painting', 'quality_check', 'completed']
        
        try:
            current_idx = stages_flow.index(production_order.status)
            if current_idx < len(stages_flow) - 1:
                next_stage = stages_flow[current_idx + 1]
                production_order.status = next_stage
                production_order.save()
                
                out_serializer = self.get_serializer(production_order)
                return Response(
                    {
                        "message": f"Orden avanzada exitosamente a '{production_order.get_status_display()}'.",
                        "production_order": out_serializer.data,
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                return Response(
                    {"error": "La orden de fabricación ya se encuentra en su fase final (Completada)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except ValueError:
            return Response(
                {"error": "Estado actual no reconocido para el flujo automático."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """Retorna estadísticas generales de fabricación en taller."""
        queryset = self.get_queryset()
        
        counts_by_status = queryset.values('status').annotate(total=Count('id'))
        status_dict = {item['status']: item['total'] for item in counts_by_status}

        data = {
            "total_orders": queryset.count(),
            "queued": status_dict.get('queued', 0),
            "assembling": status_dict.get('assembling', 0),
            "painting": status_dict.get('painting', 0),
            "quality_check": status_dict.get('quality_check', 0),
            "completed": status_dict.get('completed', 0),
            "in_progress_total": (
                status_dict.get('assembling', 0) +
                status_dict.get('painting', 0) +
                status_dict.get('quality_check', 0)
            ),
        }
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='order/(?P<order_id>[^/.]+)')
    def by_order(self, request, order_id=None):
        """Consulta todas las órdenes de fabricación (incluidas refabricaciones) asociadas a un pedido."""
        queryset = self.get_queryset().filter(order_id=order_id).order_by('iteration')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
