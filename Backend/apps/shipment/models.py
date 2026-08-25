from django.db import models
from django.contrib.auth import get_user_model

from apps.base.models import BaseModel
from apps.orders.models import Order

User = get_user_model()


class Distributor(BaseModel):
    """
    Distribuidor o empresa de transporte encargada de entregar los pedidos.
    """

    name = models.CharField(
        'Nombre del distribuidor',
        max_length=200
    )
    phone = models.CharField(
        'Teléfono',
        max_length=20,
        blank=True,
        null=True
    )
    email = models.EmailField(
        'Correo electrónico',
        blank=True,
        null=True
    )
    rif = models.CharField(
        'RIF',
        max_length=20,
        unique=True,
        help_text='Registro de Información Fiscal del distribuidor'
    )
    is_active = models.BooleanField(
        'Está activo',
        default=True
    )

    class Meta:
        verbose_name = 'Distribuidor'
        verbose_name_plural = 'Distribuidores'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} — {self.rif}"


class Shipment(BaseModel):
    """
    Envío de un pedido.
    Una orden puede tener múltiples envíos (en caso de devolución y reenvío).
    """

    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('in_transit', 'En camino'),
        ('delivered', 'Entregado'),
        ('returned', 'Devuelto'),
        ('failed', 'Fallido'),
    ]

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='shipments',
        verbose_name="Pedido",
        help_text='Una orden puede tener múltiples envíos (p.ej. ante devoluciones)'
    )
    distributor = models.ForeignKey(
        Distributor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipments',
        verbose_name="Distribuidor"
    )
    address = models.TextField(
        'Dirección de entrega'
    )
    phone = models.CharField(
        'Teléfono de contacto',
        max_length=20
    )
    status = models.CharField(
        'Estado',
        max_length=15,
        choices=STATUS_CHOICES,
        default='pending'
    )
    estimated_date = models.DateField(
        'Fecha estimada de entrega',
        null=True,
        blank=True
    )
    price = models.DecimalField(
        'Precio del envío',
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Costo del servicio de envío (opcional)'
    )
    notes = models.TextField(
        'Notas de envío',
        blank=True,
        null=True,
        help_text='Instrucciones especiales para el distribuidor o destinatario'
    )
    delivered_at = models.DateTimeField(
        'Fecha de entrega real',
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = 'Envío'
        verbose_name_plural = 'Envíos'
        ordering = ['-created_at']

    def __str__(self):
        return f"Envío #{self.id} — Pedido #{self.order.id} [{self.get_status_display()}]"
