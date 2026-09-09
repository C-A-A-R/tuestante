from datetime import timedelta
from decimal import Decimal
import uuid

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.employee_store.models import (
    EmployeeProfile,
    InternalProduct,
    InternalOrder,
    InternalOrderItem,
    DebtPayment,
)


def get_last_cutoff_date(reference_date=None):
    """
    Calcula la fecha de corte del viernes anterior (cierre de la semana pasada).
    En el ciclo laboral y comercial semanal, el corte ocurre los viernes.
    Cualquier día de la semana actual toma como corte el viernes de la semana pasada.
    """
    if reference_date is None:
        reference_date = timezone.now().date()

    # weekday(): Lunes=0, Martes=1, Miércoles=2, Jueves=3, Viernes=4, Sábado=5, Domingo=6
    weekday = reference_date.weekday()
    days_back = (weekday - 4) % 7
    if days_back == 0:
        days_back = 7  # Si hoy es viernes, el corte cerrado es el viernes de hace 7 días

    return reference_date - timedelta(days=days_back)


def has_overdue_weekly_debt(employee, reference_date=None):
    """
    Determina si el empleado tiene deuda acarreada de semanas anteriores (previa al último viernes).
    Retorna una tupla: (tiene_deuda: bool, monto_deuda: Decimal, fecha_corte: date).
    """
    cutoff_date = get_last_cutoff_date(reference_date)

    # Total consumido en órdenes no canceladas creadas hasta el viernes anterior inclusive
    old_orders_sum = employee.orders.filter(
        is_deleted=False,
        status__in=['UNDELIVERED', 'DELIVERED', 'COMPLETED', 'PAID'],
        created_at__lte=cutoff_date
    ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

    # Total de abonos registrados históricamente hasta la fecha
    all_payments_sum = employee.payments.filter(
        is_deleted=False
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    unsettled_old_debt = old_orders_sum - all_payments_sum

    if unsettled_old_debt > Decimal('0.00'):
        return True, unsettled_old_debt, cutoff_date
    return False, Decimal('0.00'), cutoff_date


def validate_weekly_limit(employee, product, requested_quantity):
    """
    Valida si la cantidad solicitada de un producto excede el límite semanal de consumo
    del trabajador en los últimos 7 días.
    """
    if product.weekly_limit_per_employee <= 0:
        return

    since_date = timezone.now().date() - timedelta(days=7)

    consumed_qty = InternalOrderItem.objects.filter(
        order__employee=employee,
        product=product,
        order__created_at__gte=since_date,
        order__is_deleted=False,
        order__status__in=['UNDELIVERED', 'DELIVERED', 'COMPLETED', 'PAID'],
        is_deleted=False
    ).aggregate(total=Sum('quantity'))['total'] or 0

    if consumed_qty + requested_quantity > product.weekly_limit_per_employee:
        raise ValidationError(
            f"El producto '{product.name}' tiene un límite semanal de {product.weekly_limit_per_employee} unidades. "
            f"El empleado ya ha consumido {consumed_qty} en los últimos 7 días y no puede adquirir {requested_quantity} más."
        )


def checkout_internal_order(employee, items_data, user=None, notes='', is_admin_override=False, status='UNDELIVERED'):
    """
    Ejecuta el despacho y registro atómico de una orden de consumo interno.
    - Aplica bloqueo con select_for_update sobre los productos.
    - Valida deudas de semanas anteriores (con posibilidad de override para administradores).
    - Valida stock disponible y límites semanales de consumo.
    - Descuenta stock de forma atómica y guarda el snapshot inmutable del precio unitario.
    """
    if not items_data:
        raise ValidationError("La orden debe contener al menos un producto.")

    if not employee.is_active or employee.is_deleted:
        raise ValidationError("El empleado no se encuentra activo para compras en la tienda.")

    # 1. Validación de deuda de semana pasada (bloquea solo si no es override administrativo)
    if not is_admin_override:
        has_debt, debt_amount, cutoff_date = has_overdue_weekly_debt(employee)
        if has_debt:
            raise ValidationError(
                f"El trabajador tiene una deuda pendiente de semanas anteriores (${debt_amount:,.2f}) "
                f"correspondiente al corte del {cutoff_date}. Debe liquidar su saldo anterior antes de realizar nuevas compras."
            )

    # 2. Transacción atómica con bloqueo a nivel de fila
    with transaction.atomic():
        # Obtener lista de códigos o IDs de productos
        barcodes = [item.get('barcode') for item in items_data if item.get('barcode')]
        product_ids = [item.get('product_id') for item in items_data if item.get('product_id')]

        # Bloquear productos para evitar condiciones de carrera en stock
        queryset = InternalProduct.objects.select_for_update()
        if barcodes:
            products_by_barcode = {p.barcode: p for p in queryset.filter(barcode__in=barcodes, is_deleted=False)}
        else:
            products_by_barcode = {}

        if product_ids:
            products_by_id = {p.id: p for p in queryset.filter(id__in=product_ids, is_deleted=False)}
        else:
            products_by_id = {}

        # Generar número de orden interno único (format ORD-INT0001-2026)
        from apps.employee_store.utils import generate_internal_order_number
        order_number = generate_internal_order_number()

        order = InternalOrder(
            employee=employee,
            order_number=order_number,
            total_amount=Decimal('0.00'),
            status=status,
            created_by=user, 
            notes=notes
        )43
        order.save()

        total_amount = Decimal('0.00')
        order_items = []

        for item_data in items_data:
            barcode = item_data.get('barcode')
            product_id = item_data.get('product_id')
            quantity = int(item_data.get('quantity', 1))

            if quantity <= 0:
                raise ValidationError("La cantidad debe ser mayor a cero.")

            product = products_by_barcode.get(barcode) or products_by_id.get(product_id)
            if not product:
                raise ValidationError(f"Producto con identificador '{barcode or product_id}' no encontrado o inactivo.")

            if not product.is_active:
                raise ValidationError(f"El producto '{product.name}' se encuentra inactivo.")

            if product.stock < quantity:
                raise ValidationError(
                    f"Stock insuficiente para '{product.name}'. "
                    f"Disponible: {product.stock}, Solicitado: {quantity}."
                )

            # Validar límite semanal por empleado
            validate_weekly_limit(employee, product, quantity)

            # Descontar stock
            product.stock -= quantity
            product.save(update_fields=['stock', 'updated_at'])

            # Snapshot del precio unitario e inmutabilidad
            unit_price = product.price
            subtotal = unit_price * quantity
            total_amount += subtotal

            order_items.append(
                InternalOrderItem(
                    order=order,
                    product=product,
                    quantity=quantity,
                    unit_price=unit_price,
                    subtotal=subtotal
                )
            )

        InternalOrderItem.objects.bulk_create(order_items)

        order.total_amount = total_amount
        order.save(update_fields=['total_amount', 'updated_at'])

        return order


def calculate_employee_debt(employee):
    """Retorna la deuda actual acumulada del empleado."""
    return employee.current_debt


def generate_settlement_report(start_date, end_date, employee_id=None):
    """
    Genera el reporte consolidado de consumos, abonos y balance por empleado en un rango de fechas.
    Ideal para nómina / Recursos Humanos en cortes quincenales o mensuales.
    """
    profiles = EmployeeProfile.objects.filter(is_deleted=False)
    if employee_id:
        profiles = profiles.filter(id=employee_id)

    report_data = []

    for emp in profiles:
        orders = emp.orders.filter(
            is_deleted=False,
            status__in=['UNDELIVERED', 'DELIVERED', 'COMPLETED', 'PAID'],
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        orders_sum = orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        orders_count = orders.count()

        payments = emp.payments.filter(
            is_deleted=False,
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        payments_sum = payments.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        payments_count = payments.count()

        net_period = orders_sum - payments_sum

        report_data.append({
            'employee_id': emp.id,
            'employee_number': emp.employee_number,
            'full_name': emp.user.get_full_name() or emp.user.username,
            'department': emp.department,
            'position': emp.position,
            'salary': emp.salary,
            'period_orders_count': orders_count,
            'period_orders_total': orders_sum,
            'period_payments_count': payments_count,
            'period_payments_total': payments_sum,
            'period_net_balance': net_period,
            'current_total_debt': emp.current_debt,
        })

    return report_data
