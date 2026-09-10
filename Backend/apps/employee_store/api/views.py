from datetime import datetime
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Prefetch
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.base.api import BaseViewSet
from apps.employee_store.models import (
    EmployeeProfile,
    InternalCategory,
    InternalSubCategory,
    InternalProduct,
    InternalOrder,
    DebtPayment,
)
from apps.employee_store.api.serializers import (
    EmployeeProfileSerializer,
    InternalCategorySerializer,
    InternalSubCategorySerializer,
    InternalProductSerializer,
    InternalOrderDetailSerializer,
    InternalOrderCreateSerializer,
    DebtPaymentSerializer,
)
from apps.employee_store.services import (
    checkout_internal_order,
    generate_settlement_report,
    has_overdue_weekly_debt,
)


class EmployeeProfileViewSet(BaseViewSet):
    """Gestión de perfiles de empleados y consulta de estado de cuenta."""

    queryset = EmployeeProfile.objects.filter(is_deleted=False).select_related('user')
    serializer_class = EmployeeProfileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['employee_number', 'user__first_name', 'user__last_name', 'user__username', 'department', 'position']
    ordering_fields = ['employee_number', 'department', 'position', 'created_at', 'id']

    def _get_statement_data(self, employee):
        from apps.employee_store.models import InternalOrderItem
        items_prefetch = Prefetch(
            'items',
            queryset=InternalOrderItem.objects.filter(is_deleted=False).select_related('product')
        )
        orders = employee.orders.filter(
            is_deleted=False
        ).select_related('created_by').prefetch_related(items_prefetch).order_by('-created_at')[:50]

        payments = employee.payments.filter(
            is_deleted=False
        ).select_related('registered_by').order_by('-created_at')[:50]

        has_debt, debt_amount, cutoff_date = has_overdue_weekly_debt(employee)

        return {
            'employee': EmployeeProfileSerializer(employee).data,
            'current_debt': employee.current_debt,
            'has_overdue_debt': has_debt,
            'overdue_debt_amount': debt_amount,
            'cutoff_date': cutoff_date,
            'orders': InternalOrderDetailSerializer(orders, many=True).data,
            'payments': DebtPaymentSerializer(payments, many=True).data,
        }

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Retorna el estado de cuenta consolidado: balance, historial de compras y pagos."""
        employee = self.get_object()
        return Response(self._get_statement_data(employee), status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Retorna el perfil y estado de cuenta consolidado del empleado autenticado actual."""
        employee = EmployeeProfile.objects.filter(user=request.user, is_deleted=False).first()
        if not employee:
            # Auto-provisionar perfil de colaborador para el usuario autenticado
            emp_number = f"EMP-{request.user.id:04d}"
            if EmployeeProfile.objects.filter(employee_number=emp_number).exists():
                emp_number = f"EMP-{request.user.id:04d}-{int(timezone.now().timestamp())}"

            department = "Operaciones"
            position = "Colaborador"
            if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
                department = "Administración"
                position = "Supervisor"

            employee = EmployeeProfile.objects.create(
                user=request.user,
                employee_number=emp_number,
                department=department,
                position=position,
                salary=Decimal('500.00'),
                is_active=True
            )
        return Response(self._get_statement_data(employee), status=status.HTTP_200_OK)


class InternalCategoryViewSet(BaseViewSet):
    """Gestión de categorías de productos de la tienda interna."""

    serializer_class = InternalCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at', 'id']

    def get_queryset(self):
        subcategories_prefetch = Prefetch(
            'subcategories',
            queryset=InternalSubCategory.objects.filter(is_deleted=False)
        )
        return InternalCategory.objects.filter(is_deleted=False).prefetch_related(subcategories_prefetch)


class InternalSubCategoryViewSet(BaseViewSet):
    """Gestión de subcategorías de productos de la tienda interna."""

    queryset = InternalSubCategory.objects.filter(is_deleted=False).select_related('category')
    serializer_class = InternalSubCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'category__name']
    ordering_fields = ['name', 'category__name', 'created_at', 'id']

    def get_queryset(self):
        qs = super().get_queryset()
        category_id = self.request.query_params.get('category') or self.request.query_params.get('category_id')
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs


class InternalProductViewSet(BaseViewSet):
    """Catálogo y búsqueda rápida de productos por código de barras para el POS."""

    queryset = InternalProduct.objects.filter(is_deleted=False).select_related('category', 'subcategory')
    serializer_class = InternalProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'barcode', 'category__name', 'subcategory__name']
    ordering_fields = ['name', 'stock', 'cost_price', 'sale_price', 'created_at', 'id']

    def get_queryset(self):
        qs = super().get_queryset()
        barcode = self.request.query_params.get('barcode')
        if barcode:
            qs = qs.filter(barcode=barcode.strip())

        category_id = self.request.query_params.get('category') or self.request.query_params.get('category_id')
        if category_id:
            qs = qs.filter(category_id=category_id)

        subcategory_id = self.request.query_params.get('subcategory') or self.request.query_params.get('subcategory_id')
        if subcategory_id:
            qs = qs.filter(subcategory_id=subcategory_id)

        in_stock = self.request.query_params.get('in_stock')
        if in_stock is not None and str(in_stock).lower() in ('true', '1'):
            qs = qs.filter(stock__gt=0)

        only_active = self.request.query_params.get('is_active')
        if only_active is not None:
            qs = qs.filter(is_active=(only_active.lower() in ('true', '1')))

        return qs


class InternalOrderViewSet(BaseViewSet):
    """Gestión y registro atómico de órdenes de consumo en tienda interna."""

    serializer_class = InternalOrderDetailSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['order_number', 'employee__employee_number', 'employee__user__first_name', 'employee__user__last_name']
    ordering_fields = ['created_at', 'total_amount', 'id']

    def get_queryset(self):
        from apps.employee_store.models import InternalOrderItem
        items_prefetch = Prefetch(
            'items',
            queryset=InternalOrderItem.objects.filter(is_deleted=False).select_related('product')
        )
        return InternalOrder.objects.filter(
            is_deleted=False
        ).select_related('employee', 'employee__user', 'created_by').prefetch_related(items_prefetch)

    def create(self, request, *args, **kwargs):
        """Registro atómico de orden y despacho mediante checkout_internal_order."""
        serializer = InternalOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        employee_id = serializer.validated_data['employee_id']
        employee = get_object_or_404(EmployeeProfile, id=employee_id, is_deleted=False)

        # Determinar si el usuario tiene privilegios de administrador para override de deudas
        is_staff = getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)
        requested_override = serializer.validated_data.get('is_admin_override', False)
        # Si el usuario es admin o staff, se habilita la posibilidad de override
        is_admin_override = is_staff and (requested_override or True)

        order_status = serializer.validated_data.get('status', 'UNDELIVERED')
        order = checkout_internal_order(
            employee=employee,
            items_data=serializer.validated_data['items'],
            user=request.user,
            notes=serializer.validated_data.get('notes', ''),
            is_admin_override=is_admin_override,
            status=order_status
        )

        output_serializer = InternalOrderDetailSerializer(order)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """
        Actualiza el estado de una orden interna.
        La anulación y reversión de inventario solo se permite si la orden no ha sido finalizada
        (es decir, su estado actual es 'UNDELIVERED').
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        new_status = request.data.get('status')

        if new_status and new_status != instance.status:
            # Si se solicita anular la orden
            if new_status == 'CANCELLED':
                if instance.status != 'UNDELIVERED':
                    return Response(
                        {"error": f"No se puede anular ni revertir inventario de una orden en estado '{instance.get_status_display()}'. Solo se pueden anular órdenes en estado 'Sin entregar'."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                with transaction.atomic():
                    # Revertir stock físico en almacén para cada ítem activo
                    for item in instance.items.filter(is_deleted=False).select_related('product'):
                        product = item.product
                        product.stock += item.quantity
                        product.save(update_fields=['stock', 'updated_at'])
                    instance.status = 'CANCELLED'
                    if 'notes' in request.data:
                        instance.notes = request.data['notes']
                    instance.save(update_fields=['status', 'notes', 'updated_at'])
                    serializer = self.get_serializer(instance)
                    return Response(serializer.data, status=status.HTTP_200_OK)

            # Si la orden ya está cancelada, impedir cambiar de estado
            if instance.status == 'CANCELLED':
                return Response(
                    {"error": "No se puede modificar el estado de una orden que ya ha sido cancelada."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Restricción de regresión de estado
            if instance.status in ('DELIVERED', 'COMPLETED') and new_status == 'UNDELIVERED':
                return Response(
                    {"error": "No se puede regresar el estado de una orden de 'Entregado' a 'Sin entregar'."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if instance.status == 'PAID' and new_status in ('UNDELIVERED', 'DELIVERED', 'COMPLETED'):
                return Response(
                    {"error": "No se puede regresar el estado de una orden que ya ha sido marcada como 'Pagada'."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return super().update(request, *args, partial=partial, **kwargs)



class DebtPaymentViewSet(BaseViewSet):
    """Registro y consulta de abonos / deducciones de nómina aplicados."""

    queryset = DebtPayment.objects.filter(
        is_deleted=False
    ).select_related('employee', 'employee__user', 'registered_by')
    serializer_class = DebtPaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['employee__employee_number', 'employee__user__first_name', 'employee__user__last_name', 'reference']
    ordering_fields = ['created_at', 'amount', 'payment_method', 'id']

    def perform_create(self, serializer):
        serializer.save(registered_by=self.request.user)


class SettlementReportAPIView(APIView):
    """Generación de cortes quincenales / mensuales de consumos para Nómina / RRHH."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        employee_id = request.query_params.get('employee_id')

        today = timezone.now().date()
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else today.replace(day=1)
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else today
        except ValueError:
            return Response(
                {"error": "Formato de fecha inválido. Utilice AAAA-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        report = generate_settlement_report(
            start_date=start_date,
            end_date=end_date,
            employee_id=employee_id
        )

        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'total_employees': len(report),
            'grand_orders_total': sum(r['period_orders_total'] for r in report),
            'grand_payments_total': sum(r['period_payments_total'] for r in report),
            'data': report
        }, status=status.HTTP_200_OK)
