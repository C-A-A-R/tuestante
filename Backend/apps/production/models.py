from django.db import models
from django.utils import timezone
from apps.base.models import BaseModel
from apps.orders.models import Order


class ProductionOrder(BaseModel):
    """
    Modelo de Orden de Fabricación para el control interno de producción en taller.
    Un pedido puede tener múltiples órdenes de fabricación en casos de refabricación o devoluciones.
    """

    STATUS_CHOICES = [
        ('queued', 'En Cola de Espera'),
        ('assembling', 'En Corte y Ensamblaje'),
        ('painting', 'En Pintura y Acabado'),
        ('quality_check', 'En Control de Calidad'),
        ('completed', 'Fabricación Completada'),  # Activa el cobro final restante
    ]

    # Relación de Muchos a Uno: Un pedido puede generar órdenes de trabajo (incluyendo refabricaciones por devolución)
    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        related_name='production_orders',
        verbose_name="Pedido"
    )

    iteration = models.PositiveIntegerField(
        'Iteración / Refabricación',
        default=1,
        help_text='Número de iteración para este pedido (incrementa en refabricaciones por devolución)'
    )
    
    status = models.CharField(
        'Estado de fabricación',
        max_length=20,
        choices=STATUS_CHOICES,
        default='queued'
    )
    
    # Control de tiempos internos para la empresa
    start_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Inicio de fabricación"
    )
    estimated_completion_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha estimada de fin"
    )
    actual_completion_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha real de fin"
    )
    
    # Notas para el artesano/obrero
    technical_notes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Notas técnicas",
        help_text="Medidas especiales, colores de puertas, especificaciones de corte, etc."
    )

    class Meta:
        verbose_name = "Orden de Fabricación"
        verbose_name_plural = "Órdenes de Fabricación"
        ordering = ['-created_at', '-id']

    def __str__(self):
        order_ref = self.order.order_number or f"Pedido #{self.order.id}"
        iter_str = f" (Iteración #{self.iteration})" if self.iteration > 1 else ""
        return f"Producción - {order_ref}{iter_str} [{self.get_status_display()}]"

    def save(self, *args, **kwargs):
        # Auto-asignar iteración si es nueva orden y ya existen otras para este pedido
        if not self.pk and self.iteration == 1 and self.order_id:
            existing_count = ProductionOrder.objects.filter(order_id=self.order_id).count()
            if existing_count > 0:
                self.iteration = existing_count + 1

        # Si inicia corte y ensamblaje o etapas posteriores, registrar fecha de inicio
        if self.status in ['assembling', 'painting', 'quality_check', 'completed'] and not self.start_date:
            self.start_date = timezone.now()

        # Si pasa a completado, registrar fecha real de fin y sincronizar pedido a 'waiting_final_payment'
        if self.status == 'completed':
            if not self.actual_completion_date:
                self.actual_completion_date = timezone.now()

            # Sincronizar estado del pedido si aún está en fabricación
            if self.order and self.order.status in ['manufacturing', 'returned_manufacturing']:
                self.order.status = 'waiting_final_payment'
                self.order.save(update_fields=['status'])
        elif self.status in ['assembling', 'painting', 'quality_check']:
            # Sincronizar pedido a fabricación si estaba pendiente
            if self.order and self.order.status == 'pending_initial_payment':
                pass
            elif self.order and self.order.status not in ['manufacturing', 'returned_manufacturing']:
                if self.order.status == 'waiting_final_payment' or self.order.status == 'initial_payment_review':
                    self.order.status = 'manufacturing'
                    self.order.save(update_fields=['status'])

        super().save(*args, **kwargs)
