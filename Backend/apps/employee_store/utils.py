import re
from django.utils import timezone


def generate_internal_order_number():
    """
    Genera un número de orden interno único correlativo para el año en curso
    siguiendo el formato ORD-INTnnnn-año (ej. ORD-INT0001-2026).
    """
    from apps.employee_store.models import InternalOrder

    year = timezone.now().year
    prefix = "ORD-INT"
    suffix = f"-{year}"

    last_order = (
        InternalOrder.objects.filter(
            order_number__startswith=prefix,
            order_number__endswith=suffix
        )
        .order_by('-id')
        .first()
    )

    if last_order and last_order.order_number:
        match = re.match(r'^ORD-INT(\d+)-\d{4}$', last_order.order_number)
        if match:
            new_seq = int(match.group(1)) + 1
        else:
            new_seq = (
                InternalOrder.objects.filter(
                    order_number__startswith=prefix,
                    order_number__endswith=suffix
                ).count() + 1
            )
    else:
        new_seq = 1

    order_number = f"ORD-INT{new_seq:04d}-{year}"
    while InternalOrder.objects.filter(order_number=order_number).exists():
        new_seq += 1
        order_number = f"ORD-INT{new_seq:04d}-{year}"

    return order_number


def generate_employee_number():
    """
    Genera un número/código de trabajador único correlativo para el año en curso
    siguiendo el formato TRA-nnnn-año (ej. TRA-0001-2026).
    """
    from apps.employee_store.models import EmployeeProfile

    year = timezone.now().year
    prefix = "TRA-"
    suffix = f"-{year}"

    last_employee = (
        EmployeeProfile.objects.filter(
            employee_number__startswith=prefix,
            employee_number__endswith=suffix
        )
        .order_by('-id')
        .first()
    )

    if last_employee and last_employee.employee_number:
        match = re.match(r'^TRA-(\d+)-\d{4}$', last_employee.employee_number)
        if match:
            new_seq = int(match.group(1)) + 1
        else:
            new_seq = (
                EmployeeProfile.objects.filter(
                    employee_number__startswith=prefix,
                    employee_number__endswith=suffix
                ).count() + 1
            )
    else:
        new_seq = 1

    emp_number = f"TRA-{new_seq:04d}-{year}"
    while EmployeeProfile.objects.filter(employee_number=emp_number).exists():
        new_seq += 1
        emp_number = f"TRA-{new_seq:04d}-{year}"

    return emp_number
