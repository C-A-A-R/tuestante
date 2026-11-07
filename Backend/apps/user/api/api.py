from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Sum, Max, Q, Subquery, OuterRef, Value, DecimalField
from django.db.models.functions import Coalesce
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.user.api.permisos import IsAdmin
from apps.user.api.serializers import UserSerializer, UserCreateSerializer
from apps.user.models import User
from apps.orders.models import Order
from apps.shipment.models import Shipment
from apps.base.api import BaseViewSet


class UserViewSet(BaseViewSet):
    """
    ViewSet para el modelo User y gestión de clientes.
    Acceso restringido a administradores y superusuarios.
    """

    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    ordering = ['-date_joined', '-id']
    search_fields = [
        'username',
        'email',
        'first_name',
        'first_last_name',
        'second_name',
        'second_last_name',
        'document_type',
        'identity_document',
        'phone',
    ]
    ordering_fields = [
        'username',
        'email',
        'date_joined',
        'created_at',
        'id',
        'orders_count',
        'total_spent',
        'last_order_date',
        'first_name',
        'first_last_name',
    ]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        # Base: usuarios no eliminados
        queryset = User.objects.filter(is_deleted=False)

        # Filtro de Rol / Staff
        role = self.request.query_params.get("role") or self.request.query_params.get("tipo")
        is_client_query = False
        if role in ["client", "cliente"]:
            queryset = queryset.filter(is_staff=False, is_superuser=False)
            is_client_query = True
        else:
            is_staff = self.request.query_params.get("is_staff")
            if is_staff is not None:
                is_staff_normalized = is_staff.lower() in ["1", "true", "si", "yes"]
                queryset = queryset.filter(is_staff=is_staff_normalized)
                if not is_staff_normalized:
                    is_client_query = True

        # Excluir trabajadores a no ser de que tengan algún pedido registrado de la tienda principal
        if is_client_query:
            is_not_worker = Q(employee_profile__isnull=True) | Q(employee_profile__is_deleted=True)
            is_worker_with_orders = Q(
                employee_profile__isnull=False,
                employee_profile__is_deleted=False,
                orders__is_deleted=False
            )
            queryset = queryset.filter(is_not_worker | is_worker_with_orders).distinct()

        # Filtro de Estado (is_active / status)
        status_param = self.request.query_params.get("status") or self.request.query_params.get("is_active") or self.request.query_params.get("estado")
        if status_param and status_param.lower() not in ["all", "todos", ""]:
            is_active_normalized = status_param.lower() in ["1", "true", "si", "yes", "active", "activo"]
            queryset = queryset.filter(is_active=is_active_normalized)

        # Filtro de registro formal
        is_registered = self.request.query_params.get("is_registered") or self.request.query_params.get("esta_registrado")
        if is_registered is not None:
            is_registered_normalized = is_registered.lower() in ["1", "true", "si", "yes"]
            queryset = queryset.filter(is_registered=is_registered_normalized)

        # Filtro por Rango / Período de Fecha de Registro
        period = self.request.query_params.get("period") or self.request.query_params.get("periodo") or self.request.query_params.get("fecha_registro")
        now = timezone.now()
        if period:
            p = period.lower().strip()
            if p in ["today", "hoy"]:
                queryset = queryset.filter(date_joined__date=now.date())
            elif p in ["this_week", "semana", "esta_semana"]:
                start_week = now - timedelta(days=7)
                queryset = queryset.filter(date_joined__gte=start_week)
            elif p in ["this_month", "mes", "este_mes"]:
                queryset = queryset.filter(date_joined__year=now.year, date_joined__month=now.month)
            elif p in ["this_year", "ano", "año", "este_ano", "este_año"]:
                queryset = queryset.filter(date_joined__year=now.year)

        date_from = self.request.query_params.get("date_from") or self.request.query_params.get("fecha_desde")
        if date_from:
            queryset = queryset.filter(date_joined__date__gte=date_from)

        date_to = self.request.query_params.get("date_to") or self.request.query_params.get("fecha_hasta")
        if date_to:
            queryset = queryset.filter(date_joined__date__lte=date_to)

        # Filtro por Ciudad
        city_param = self.request.query_params.get("city") or self.request.query_params.get("ciudad")
        if city_param and city_param.lower() not in ["all", "todas", ""]:
            c_term = city_param.strip()
            queryset = queryset.filter(
                Q(city__iexact=c_term) |
                Q(orders__shipments__city__iexact=c_term, orders__shipments__is_deleted=False)
            ).distinct()

        # Subconsultas para la ciudad y estado del envío más reciente
        latest_shipment_city = Shipment.objects.filter(
            order__user=OuterRef('pk'),
            is_deleted=False
        ).order_by('-created_at').values('city')[:1]

        latest_shipment_state = Shipment.objects.filter(
            order__user=OuterRef('pk'),
            is_deleted=False
        ).order_by('-created_at').values('state')[:1]

        # Anotaciones de métricas por cliente
        queryset = queryset.annotate(
            orders_count=Count('orders', filter=Q(orders__is_deleted=False), distinct=True),
            total_spent=Coalesce(
                Sum('orders__total_price', filter=Q(orders__is_deleted=False)),
                Value(0.00),
                output_field=DecimalField(max_digits=12, decimal_places=2)
            ),
            last_order_date=Max('orders__created_at', filter=Q(orders__is_deleted=False)),
            latest_shipment_city=Subquery(latest_shipment_city),
            latest_shipment_state=Subquery(latest_shipment_state),
        )

        return queryset

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.is_deleted = True
        instance.deleted_at = timezone.now().date()
        instance.save(update_fields=["is_active", "is_deleted", "deleted_at"])

    @action(detail=False, methods=['get'], url_path='metrics')
    def metrics(self, request):
        """
        Retorna las 5 métricas consolidadas requeridas para las tarjetas KPI de Clientes.
        """
        now = timezone.now()
        start_of_current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Mes anterior para cálculo comparativo
        if start_of_current_month.month == 1:
            start_of_last_month = start_of_current_month.replace(year=start_of_current_month.year - 1, month=12)
        else:
            start_of_last_month = start_of_current_month.replace(month=start_of_current_month.month - 1)

        # Base de clientes (excluye administradores y trabajadores sin pedidos en tienda principal)
        is_not_worker = Q(employee_profile__isnull=True) | Q(employee_profile__is_deleted=True)
        is_worker_with_orders = Q(
            employee_profile__isnull=False,
            employee_profile__is_deleted=False,
            orders__is_deleted=False
        )
        clients_qs = User.objects.filter(
            is_deleted=False, 
            is_staff=False, 
            is_superuser=False
        ).filter(is_not_worker | is_worker_with_orders).distinct()
        total_clients = clients_qs.count()

        # Clientes nuevos este mes
        new_clients_this_month = clients_qs.filter(date_joined__gte=start_of_current_month).count()
        new_clients_last_month = clients_qs.filter(
            date_joined__gte=start_of_last_month,
            date_joined__lt=start_of_current_month
        ).count()

        # Porcentaje de crecimiento vs mes anterior
        if new_clients_last_month > 0:
            growth = ((new_clients_this_month - new_clients_last_month) / new_clients_last_month) * 100
            growth_str = f"{'+' if growth >= 0 else ''}{growth:.1f}% vs mes anterior"
        else:
            growth_str = f"+{new_clients_this_month} este mes" if new_clients_this_month > 0 else "0% vs mes anterior"

        # Clientes con pedidos
        clients_with_orders = clients_qs.filter(orders__is_deleted=False).distinct().count()
        clients_with_orders_pct = (clients_with_orders / total_clients * 100) if total_clients > 0 else 0.0

        # Gasto total de clientes y ticket promedio
        client_orders = Order.objects.filter(is_deleted=False, user__in=clients_qs)
        total_spent_val = client_orders.aggregate(s=Sum('total_price'))['s'] or 0.00
        total_orders_count = client_orders.count()
        avg_ticket = (float(total_spent_val) / total_orders_count) if total_orders_count > 0 else 0.00

        data = {
            "total_clients": total_clients,
            "new_clients_this_month": new_clients_this_month,
            "growth_percentage": growth_str,
            "clients_with_orders": clients_with_orders,
            "clients_with_orders_percentage": f"{clients_with_orders_pct:.1f}%",
            "total_spent": float(total_spent_val),
            "total_orders": total_orders_count,
            "avg_ticket": round(avg_ticket, 2)
        }

        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='cities')
    def cities(self, request):
        """
        Retorna el listado de ciudades únicas donde hay clientes o envíos registrados.
        """
        db_cities = list(
            Shipment.objects.filter(is_deleted=False)
            .exclude(city__exact='')
            .values_list('city', flat=True)
            .distinct()
        )

        default_cities = [
            "Caracas",
            "Valencia",
            "Maracaibo",
            "Barquisimeto",
            "Maracay",
            "Puerto La Cruz",
            "Mérida",
            "San Cristóbal",
        ]

        all_cities = sorted(list(set(filter(None, db_cities + default_cities))))
        return Response(all_cities, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='me')
    def me(self, request):
        """
        Retorna o actualiza la información del perfil del usuario autenticado actual.
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "No autenticado."}, status=status.HTTP_401_UNAUTHORIZED)

        if request.method == 'GET':
            serializer = UserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # PUT o PATCH
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        
        # Si se envía 'full_name' sin first_name explícito, dividir en nombre y apellido
        if 'full_name' in data and not data.get('first_name'):
            parts = str(data['full_name']).strip().split(' ', 1)
            data['first_name'] = parts[0]
            if len(parts) > 1:
                data['first_last_name'] = parts[1]

        serializer = UserSerializer(user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if 'address' in data:
            user.address = data['address']
            user.save(update_fields=['address'])

        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)

