from django.db import models
from django.contrib.auth import get_user_model

from apps.base.models import BaseModel
from apps.base.utils import compress_and_save_image, is_image_file
from apps.orders.models import Order

User = get_user_model()


class Payment(BaseModel):
    """
    Registro de pago asociado a un pedido.

    El flujo contempla dos etapas:
      - 'initial': Pago inicial (mínimo 50%, puede ser más). El admin confirma manualmente.
      - 'final': Pago final del saldo restante. El admin confirma manualmente.

    El admin es quien aprueba o rechaza cada pago revisando el comprobante adjunto.
    """

    STAGE_CHOICES = [
        ('initial', 'Pago inicial'),
        ('final', 'Pago final'),
        ('total', 'Pago total / único'),
    ]

    METHOD_CHOICES = [
        ('transfer', 'Transferencia bancaria'),
        ('cash', 'Efectivo'),
        ('mobile_payment', 'Pago móvil'),
        ('other', 'Otro'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pendiente de revisión'),
        ('approved', 'Aprobado'),
        ('rejected', 'Rechazado'),
    ]

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name="Pedido"
    )
    payment_stage = models.CharField(
        'Etapa del pago',
        max_length=15,
        choices=STAGE_CHOICES,
        help_text='Indica si es el pago inicial, el pago final o el pago total / único'
    )
    amount = models.DecimalField(
        'Monto pagado (USD)',
        max_digits=12,
        decimal_places=2,
        help_text='Monto equivalente en Dólares ($) registrado en el pedido'
    )
    amount_ves = models.DecimalField(
        'Monto en Bolívares (Bs.)',
        max_digits=16,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Monto real pagado/transferido en Bolívares (VES)'
    )
    exchange_rate = models.DecimalField(
        'Tasa de cambio aplicada',
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        help_text='Tasa oficial BCV utilizada para la conversión en la fecha del pago'
    )
    currency = models.CharField(
        'Moneda del pago',
        max_length=5,
        default='USD',
        choices=[('USD', 'Dólares ($)'), ('VES', 'Bolívares (Bs.)')],
        help_text='Moneda en la que se realizó la transferencia'
    )
    payment_method = models.CharField(
        'Método de pago',
        max_length=20,
        choices=METHOD_CHOICES,
        default='transfer'
    )
    status = models.CharField(
        'Estado',
        max_length=10,
        choices=STATUS_CHOICES,
        default='pending'
    )
    reference_number = models.CharField(
        'Número de referencia',
        max_length=100,
        blank=True,
        null=True,
        help_text='Número de referencia bancaria o comprobante de pago'
    )
    receipt_file = models.FileField(
        'Comprobante de pago',
        upload_to='payments/receipts/',
        blank=True,
        null=True,
        help_text='Imagen o PDF del comprobante de pago'
    )
    notes = models.TextField(
        'Notas',
        blank=True,
        null=True,
        help_text='Observaciones adicionales sobre el pago'
    )
    # Auditoría de revisión
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_payments',
        verbose_name="Revisado por"
    )
    reviewed_at = models.DateTimeField(
        'Fecha de revisión',
        null=True,
        blank=True
    )
    rejection_reason = models.TextField(
        'Motivo de rechazo',
        blank=True,
        null=True,
        help_text='Razón por la que el pago fue rechazado'
    )

    class Meta:
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if self.receipt_file and is_image_file(self.receipt_file):
            compress_and_save_image(self.receipt_file)
        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"Pago #{self.id} — Pedido #{self.order.id} "
            f"[{self.get_payment_stage_display()}] [{self.get_status_display()}]"
        )
