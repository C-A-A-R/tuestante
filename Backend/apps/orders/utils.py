import re
from django.utils import timezone


def generate_order_number():
    """
    Genera un número de orden único correlativo para el año en curso
    siguiendo el formato ORD-nnnn-año (ej. ORD-0001-2026).
    """
    from apps.orders.models import Order

    year = timezone.now().year
    prefix = "ORD-"
    suffix = f"-{year}"

    last_order = (
        Order.objects.filter(order_number__startswith=prefix, order_number__endswith=suffix)
        .order_by('-id')
        .first()
    )

    if last_order and last_order.order_number:
        match = re.match(r'^ORD-(\d+)-\d{4}$', last_order.order_number)
        if match:
            new_seq = int(match.group(1)) + 1
        else:
            new_seq = Order.objects.filter(order_number__endswith=suffix).count() + 1
    else:
        new_seq = 1

    order_number = f"ORD-{new_seq:04d}-{year}"
    while Order.objects.filter(order_number=order_number).exists():
        new_seq += 1
        order_number = f"ORD-{new_seq:04d}-{year}"

    return order_number
