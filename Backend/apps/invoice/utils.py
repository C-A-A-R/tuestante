import re
from django.utils import timezone


def generate_invoice_number():
    """
    Genera un número de factura único correlativo para el año en curso
    siguiendo el formato FAC-nnnn-año (ej. FAC-0001-2026).
    """
    from apps.invoice.models import Invoice

    year = timezone.now().year
    prefix = "FAC-"
    suffix = f"-{year}"

    last_invoice = (
        Invoice.objects.filter(invoice_number__startswith=prefix, invoice_number__endswith=suffix)
        .order_by('-id')
        .first()
    )

    if last_invoice and last_invoice.invoice_number:
        match = re.match(r'^FAC-(\d+)-\d{4}$', last_invoice.invoice_number)
        if match:
            new_seq = int(match.group(1)) + 1
        else:
            new_seq = Invoice.objects.filter(invoice_number__endswith=suffix).count() + 1
    else:
        new_seq = 1

    invoice_number = f"FAC-{new_seq:04d}-{year}"
    while Invoice.objects.filter(invoice_number=invoice_number).exists():
        new_seq += 1
        invoice_number = f"FAC-{new_seq:04d}-{year}"

    return invoice_number
