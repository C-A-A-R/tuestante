from django.utils import timezone
from django.db import transaction
from rest_framework import permissions, status, serializers
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.base.api import BaseViewSet
from apps.payment.models import Payment
from apps.payment.api.serializers import PaymentSerializer
from apps.invoice.services import create_invoice_for_order


class PaymentViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Pagos.
    - Los usuarios autenticados pueden registrar y ver sus propios comprobantes de pago.
    - Los administradores pueden ver todos los pagos y aprobarlos o rechazarlos.
    """

    serializer_class = PaymentSerializer
    search_fields = [
        'reference_number',
        'order__order_number',
        'order__user__username',
        'order__user__first_name',
        'order__user__last_name',
        'order__user__email',
        'notes'
    ]
    ordering_fields = ['created_at', 'amount', 'status', 'id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'create']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        """
        Retorna el queryset optimizado de pagos no eliminados.
        - Filtra por el usuario autenticado a menos que sea personal/admin.
        - Soporta filtros por estado, etapa, método y pedido.
        """
        queryset = Payment.objects.filter(
            is_deleted=False,
            order__is_deleted=False
        ).select_related('order__user', 'reviewed_by')

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(order__user=self.request.user)
        else:
            user_param = self.request.query_params.get('user_id') or self.request.query_params.get('user')
            if user_param:
                if str(user_param).isdigit():
                    queryset = queryset.filter(order__user_id=int(user_param))
                else:
                    queryset = queryset.filter(order__user__username=user_param)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        stage_param = self.request.query_params.get('payment_stage') or self.request.query_params.get('stage')
        if stage_param:
            queryset = queryset.filter(payment_stage=stage_param)

        method_param = self.request.query_params.get('payment_method') or self.request.query_params.get('method')
        if method_param:
            queryset = queryset.filter(payment_method=method_param)

        order_param = self.request.query_params.get('order_id') or self.request.query_params.get('order')
        if order_param:
            queryset = queryset.filter(order_id=order_param)

        return queryset

    def perform_create(self, serializer):
        """Establece automáticamente el estado del pedido a revisión al registrar un pago."""
        with transaction.atomic():
            payment = serializer.save()
            order = payment.order
            
            # Al subir el pago, pasamos el pedido al estado de revisión correspondiente
            if payment.payment_stage in ['initial', 'total']:
                order.status = 'initial_payment_review'
            else:
                order.status = 'final_payment_review'
            order.save()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def review(self, request, pk=None):
        """
        Endpoint para que un administrador apruebe o rechace un pago.
        Body:
        {
            "status": "approved" | "rejected",
            "rejection_reason": "Motivo del rechazo (opcional si es rechazado)"
        }
        """
        payment = self.get_object()
        review_status = request.data.get('status')
        rejection_reason = request.data.get('rejection_reason', '')

        if review_status not in ['approved', 'rejected']:
            return Response(
                {"error": "El estado debe ser 'approved' o 'rejected'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment.status = review_status
        payment.reviewed_by = request.user
        payment.reviewed_at = timezone.now()

        order = payment.order

        if review_status == 'approved':
            payment.rejection_reason = None
            if payment.payment_stage == 'total':
                order.status = 'shipped'
                create_invoice_for_order(order)
            elif payment.payment_stage == 'initial':
                order.status = 'manufacturing'
            else:
                order.status = 'shipped'
                create_invoice_for_order(order)
        else:  # rejected
            payment.rejection_reason = rejection_reason or "Rechazado por administración"
            # Si el pago es rechazado, devolvemos el pedido a pendiente de pago
            if payment.payment_stage in ['initial', 'total']:
                order.status = 'pending_initial_payment'
            else:
                order.status = 'waiting_final_payment'

        payment.save()
        order.save()

        serializer = self.get_serializer(payment)
        return Response(serializer.data, status=status.HTTP_200_OK)
