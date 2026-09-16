from django.db import models
from django.contrib.auth import get_user_model

from apps.base.models import BaseModel
from apps.product.models import Product

User = get_user_model()


class Order(BaseModel):
    """
    Modelo principal de Pedido.
    Sigue el flujo completo desde el registro hasta la entrega o devolución.
    """

    STATUS_CHOICES = [
        # Fase 1: Registro y pago inicial
        ('pending_initial_payment', 'Pendiente de pago inicial'),
        ('initial_payment_review', 'Pago inicial en revisión'),
        # Fase 2: Fabricación
        ('manufacturing', 'En fabricación'),
        # Fase 3: Pago final
        ('waiting_final_payment', 'Esperando pago final'),
        ('final_payment_review', 'Pago final en revisión'),
        # Fase 4: Envío y entrega
        ('shipped', 'Enviado'),
        ('finalized', 'Finalizado'),
        # Casos especiales
        ('returned_manufacturing', 'Devuelto / En refabricación'),
        ('cancelled', 'Cancelado'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='orders',
        verbose_name="Cliente"
    )
    order_number = models.CharField(
        'Número de orden',
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        help_text='Formato ORD-nnnn-año (ej. ORD-0001-2026)'
    )
    status = models.CharField(
        'Estado',
        max_length=30,
        choices=STATUS_CHOICES,
        default='pending_initial_payment'
    )
    total_price = models.DecimalField(
        'Precio total',
        max_digits=12,
        decimal_places=2,
        default=0.00
    )
    notes = models.TextField(
        'Notas del pedido',
        blank=True,
        null=True,
        help_text='Observaciones adicionales del cliente sobre el pedido'
    )
    reception_notes = models.TextField(
        'Notas u observaciones de recepción',
        blank=True,
        null=True,
        help_text='Observaciones del cliente al recibir los productos'
    )
    reception_date = models.DateTimeField(
        'Fecha y hora de recepción',
        blank=True,
        null=True,
        help_text='Momento exacto en que se confirmó la recepción del pedido'
    )

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        """Asigna automáticamente el número de orden si no está establecido."""
        if not self.order_number:
            from apps.orders.utils import generate_order_number
            self.order_number = generate_order_number()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Impide la eliminación lógica o física de un pedido."""
        from django.core.exceptions import ValidationError
        raise ValidationError("Un pedido no puede ser eliminado.")

    def __str__(self):
        number = self.order_number or f"#{self.id}"
        return f"Pedido {number} — {self.user.username} [{self.get_status_display()}]"


class OrderDetail(BaseModel):
    """
    Detalle de pedido: agrupa los productos de una línea dentro del pedido.
    Un pedido puede tener varios detalles (por ejemplo, distintos modelos).
    """

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='details',
        verbose_name="Pedido"
    )
    quantity = models.PositiveIntegerField(
        'Cantidad',
        default=1
    )
    unit_price = models.DecimalField(
        'Precio unitario',
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text='Precio acordado por unidad en el momento del pedido'
    )
    final_price = models.DecimalField(
        'Precio final',
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text='Precio total de este detalle (quantity × unit_price)'
    )
    notes = models.TextField(
        'Especificaciones',
        blank=True,
        null=True,
        help_text='Especificaciones personalizadas del producto (color, dimensiones, etc.)'
    )

    class Meta:
        verbose_name = 'Detalle de pedido'
        verbose_name_plural = 'Detalles de pedido'

    def save(self, *args, **kwargs):
        """Calcula automáticamente el precio final antes de guardar."""
        self.final_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Detalle #{self.id} — Pedido #{self.order.id}"


class OrderProduct(BaseModel):
    """
    Producto asociado a un detalle de pedido.
    Registra el producto y su precio en el momento del pedido (snapshot de precio).
    """

    order_detail = models.ForeignKey(
        OrderDetail,
        on_delete=models.CASCADE,
        related_name='order_products',
        verbose_name="Detalle de pedido"
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='order_products',
        verbose_name="Producto"
    )
    # Snapshot del precio al momento del pedido
    price_at_order = models.DecimalField(
        'Precio al momento del pedido',
        max_digits=12,
        decimal_places=2,
        help_text='Precio del producto registrado en el momento en que se realizó el pedido'
    )

    class Meta:
        verbose_name = 'Producto en pedido'
        verbose_name_plural = 'Productos en pedido'

    def __str__(self):
        return f"{self.product.product_name} — Detalle #{self.order_detail.id}"


class ManufacturingOrder(BaseModel):
    """
    Orden de Fabricación.
    Documento generado cuando un pedido pasa al estado 'manufacturing'.
    Es el documento que la gerencia envía a la fábrica para iniciar la producción.
    Puede regenerarse en caso de devolución/refabricación.
    """

    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('in_progress', 'En progreso'),
        ('completed', 'Completada'),
        ('cancelled', 'Cancelada'),
    ]

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='manufacturing_orders',
        verbose_name="Pedido"
    )
    status = models.CharField(
        'Estado',
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    # Número de iteración — incrementa cuando se regenera por devolución
    iteration = models.PositiveIntegerField(
        'Iteración',
        default=1,
        help_text='Número de orden de fabricación para este pedido (incrementa en refabricaciones)'
    )
    issued_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='issued_manufacturing_orders',
        verbose_name="Emitida por"
    )
    issued_at = models.DateTimeField(
        'Fecha de emisión',
        auto_now_add=True
    )
    completed_at = models.DateTimeField(
        'Fecha de completado',
        null=True,
        blank=True
    )
    notes = models.TextField(
        'Notas de fabricación',
        blank=True,
        null=True,
        help_text='Instrucciones especiales para la fábrica'
    )

    class Meta:
        verbose_name = 'Orden de fabricación'
        verbose_name_plural = 'Órdenes de fabricación'
        ordering = ['-issued_at']

    def __str__(self):
        return f"OF-{self.id} (Pedido #{self.order.id}) — Iteración {self.iteration}"


