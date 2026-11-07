from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal

from apps.base.models import BaseModel
from apps.product.models import Product

from apps.orders.utils import (
    generate_order_number, 
    get_bcv_usd_rate, 
    get_or_create_daily_exchange_rate
)

User = get_user_model()


class ExchangeRate(BaseModel):
    """
    Registro histórico y persistente de la tasa oficial del Banco Central de Venezuela (BCV).
    Se crea o actualiza una sola vez al día para evitar que las publicaciones vespertinas
    del BCV (con fecha valor del día hábil siguiente) alteren transacciones del día en curso.
    """
    date = models.DateField(
        'Fecha de vigencia',
        unique=True,
        db_index=True,
        help_text='Fecha calendario a la que aplica esta tasa oficial'
    )
    rate = models.DecimalField(
        'Tasa oficial (Bs./USD)',
        max_digits=12,
        decimal_places=4,
        help_text='Monto en Bolívares por Dólar (USD)'
    )
    source = models.CharField(
        'Fuente',
        max_length=50,
        default='BCV',
        help_text='Entidad emisora de la tasa (ej. Banco Central de Venezuela)'
    )
    is_manual = models.BooleanField(
        'Ajuste manual',
        default=False,
        help_text='Indica si la tasa fue ingresada o editada manualmente por el administrador'
    )
    notes = models.CharField(
        'Notas u observaciones',
        max_length=255,
        blank=True,
        null=True
    )

    class Meta:
        verbose_name = 'Tasa de Cambio'
        verbose_name_plural = 'Tasas de Cambio'
        ordering = ['-date']

    def __str__(self):
        return f"{self.date}: {self.rate} Bs./USD ({self.source})"


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
    exchange_rate = models.ForeignKey(
        'ExchangeRate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='Tasa de cambio aplicada',
        help_text='Registro de la tasa oficial del día aplicada al pedido'
    )
    bcv_rate = models.DecimalField(
        'Tasa BCV',
        max_digits=12,
        decimal_places=4,
        default=0.00,
        help_text='Tasa oficial en Bs./USD congelada para el pedido'
    )

    @property
    def total_price_bs(self):
        """Calcula el total del pedido en Bolívares."""
        if self.bcv_rate and self.total_price:
            return (self.total_price * self.bcv_rate).quantize(Decimal('0.01'))
        return Decimal('0.00')

    @property
    def paid_amount(self):
        """Suma de pagos aprobados en USD."""
        return sum(
            p.amount for p in self.payments.filter(status='approved', is_deleted=False)
        )

    @property
    def pending_balance(self):
        """Saldo pendiente por pagar en USD."""
        return max(Decimal('0.00'), self.total_price - self.paid_amount)
    
    

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        """Asigna automáticamente el número de orden y la tasa BCV del día."""
        if not self.order_number:
            self.order_number = generate_order_number()

        # Si la tasa no está definida o está en 0.00, consulta o asigna la tasa oficial fija del día
        if not self.bcv_rate or self.bcv_rate == Decimal('0.00'):
            rate_record = get_or_create_daily_exchange_rate()
            if rate_record:
                self.exchange_rate = rate_record
                self.bcv_rate = rate_record.rate
        elif not self.exchange_rate and self.bcv_rate > Decimal('0.00'):
            # Si ya se especificó bcv_rate numérico, intentar vincular el registro del día
            order_date = self.created_at or timezone.localdate()
            rate_record = ExchangeRate.objects.filter(date=order_date, is_deleted=False).first()
            if rate_record:
                self.exchange_rate = rate_record

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
    technical_design = models.JSONField(
        'Diseño Técnico Paramétrico (JSON)',
        null=True,
        blank=True,
        help_text='Snapshot inmutable definitivo del diseño en milímetros para fabricación'
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
    technical_design = models.JSONField(
        'Diseño Técnico Paramétrico (JSON)',
        null=True,
        blank=True,
        help_text='Snapshot del diseño técnico paramétrico del pedido para fabricación'
    )
    blueprint_svg = models.TextField(
        'Plano Gráfico SVG',
        null=True,
        blank=True,
        help_text='Plano 2D generado en formato SVG con cotas técnicas en milímetros'
    )

    class Meta:
        verbose_name = 'Orden de fabricación'
        verbose_name_plural = 'Órdenes de fabricación'
        ordering = ['-issued_at']

    def __str__(self):
        return f"OF-{self.id} (Pedido #{self.order.id}) — Iteración {self.iteration}"


