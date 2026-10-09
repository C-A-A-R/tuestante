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
    technical_design = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Diseño Técnico Paramétrico (JSON)",
        help_text="Snapshot del diseño técnico paramétrico del pedido para el taller"
    )
    blueprint_svg = models.TextField(
        null=True,
        blank=True,
        verbose_name="Plano Gráfico SVG",
        help_text="Plano 2D en formato SVG con cotas técnicas en milímetros"
    )

    class Meta:
        verbose_name = "Orden de Fabricación"
        verbose_name_plural = "Órdenes de Fabricación"
        ordering = ['-created_at', '-id']

    def __str__(self):
        order_ref = self.order.order_number or f"Pedido #{self.order.id}"
        iter_str = f" (Iteración #{self.iteration})" if self.iteration > 1 else ""
        return f"Producción - {order_ref}{iter_str} [{self.get_status_display()}]"

    def ensure_production_products(self):
        """
        Garantiza que existan registros de ProductionProduct para cada producto/unidad del pedido.
        Si una línea de pedido tiene quantity=3, crea 3 unidades individuales (unidad 1, 2 y 3).
        """
        if not self.order:
            return []

        existing = list(self.products.filter(is_deleted=False))
        if existing:
            return existing

        created_products = []
        unit_counter = 1
        for detail in self.order.details.filter(is_deleted=False):
            op = detail.order_products.filter(is_deleted=False).first()
            catalog_product = op.product if op else None
            qty = detail.quantity or 1

            for u in range(1, qty + 1):
                order_ref = (self.order.order_number or f"ORD{self.order.id}").replace('-', '').replace(' ', '')
                candidate_number = f"PRD-{order_ref}-{unit_counter:02d}"

                suffix = 1
                while ProductionProduct.objects.filter(product_number=candidate_number).exists():
                    candidate_number = f"PRD-{order_ref}-{unit_counter:02d}-{suffix}"
                    suffix += 1

                item = ProductionProduct.objects.create(
                    production_order=self,
                    order_detail=detail,
                    product=catalog_product,
                    product_number=candidate_number,
                    unit_index=u,
                    status=self.status,
                    notes=detail.notes or '',
                    technical_design=detail.technical_design
                )
                created_products.append(item)
                unit_counter += 1

        return created_products

    def sync_from_products(self):
        """
        Sincroniza automáticamente el estado de la Orden de Fabricación
        con base en el estado de sus productos individuales.
        """
        prods = list(self.products.filter(is_deleted=False))
        if not prods:
            return

        all_completed = all(p.status == 'completed' for p in prods)
        all_queued = all(p.status == 'queued' for p in prods)

        if all_completed:
            if self.status != 'completed':
                self.status = 'completed'
                self.actual_completion_date = timezone.now()
                self.save()
        elif all_queued:
            if self.status != 'queued':
                self.status = 'queued'
                self.save()
        else:
            # Hay productos en progreso
            if self.status == 'queued':
                self.status = 'assembling'
                if not self.start_date:
                    self.start_date = timezone.now()
                self.save()
            elif self.status == 'completed':
                self.status = 'quality_check'
                self.save()

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


class ProductionProduct(BaseModel):
    """
    Modelo de Producto Físico individual dentro de una Orden de Fabricación.
    Permite seguimiento independiente por producto o pieza, con su propio número
    de producto de taller (distinto del ID de BD), estado individual y registro de
    fechas en que pasó por cada fase de fabricación.
    """

    production_order = models.ForeignKey(
        ProductionOrder,
        on_delete=models.CASCADE,
        related_name='products',
        verbose_name="Orden de Fabricación"
    )
    order_detail = models.ForeignKey(
        'orders.OrderDetail',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_products',
        verbose_name="Detalle de Pedido"
    )
    product = models.ForeignKey(
        'product.Product',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='production_items',
        verbose_name="Producto del Catálogo"
    )
    product_number = models.CharField(
        'Número de producto',
        max_length=60,
        unique=True,
        blank=True,
        db_index=True,
        help_text='Identificador único de producción/taller para este producto físico (ej. PRD-ORD-0001-01)'
    )
    unit_index = models.PositiveIntegerField(
        'Índice de unidad',
        default=1,
        help_text='Número correlativo de la unidad (ej. unidad 1 de 3)'
    )
    status = models.CharField(
        'Estado de fabricación',
        max_length=20,
        choices=ProductionOrder.STATUS_CHOICES,
        default='queued'
    )

    # Fechas en que el producto estuvo o pasó por cada estado de fabricación
    queued_at = models.DateTimeField('Fecha en Cola de Espera', null=True, blank=True)
    assembling_at = models.DateTimeField('Fecha en Corte y Ensamblaje', null=True, blank=True)
    painting_at = models.DateTimeField('Fecha en Pintura y Acabado', null=True, blank=True)
    quality_check_at = models.DateTimeField('Fecha en Control de Calidad', null=True, blank=True)
    completed_at = models.DateTimeField('Fecha de Fabricación Completada', null=True, blank=True)

    # Historial cronológico de cambios de estado para trazabilidad
    stage_history = models.JSONField(
        'Historial de Fases',
        default=list,
        blank=True,
        help_text='Registro histórico de transiciones de estado con fecha y observaciones'
    )

    notes = models.TextField(
        'Notas u observaciones técnicas',
        blank=True,
        null=True,
        help_text='Observaciones particulares o especificaciones para este producto'
    )
    technical_design = models.JSONField(
        'Diseño Técnico Paramétrico (JSON)',
        null=True,
        blank=True,
        help_text='Snapshot paramétrico específico para este producto'
    )

    class Meta:
        verbose_name = "Producto en Fabricación"
        verbose_name_plural = "Productos en Fabricación"
        ordering = ['production_order', 'unit_index', 'id']

    def __str__(self):
        prod_name = self.product.product_name if self.product else "Producto"
        return f"{self.product_number or f'Prod #{self.id}'} ({prod_name}) [{self.get_status_display()}]"

    def record_stage_transition(self, new_status, notes=None):
        """Registra el cambio de estado y actualiza las marcas de tiempo correspondientes."""
        old_status = self.status
        now = timezone.now()

        self.status = new_status
        if notes is not None:
            self.notes = notes

        # Asignar timestamp de la etapa si aún no está asignado
        if new_status == 'queued' and not self.queued_at:
            self.queued_at = now
        elif new_status == 'assembling' and not self.assembling_at:
            self.assembling_at = now
        elif new_status == 'painting' and not self.painting_at:
            self.painting_at = now
        elif new_status == 'quality_check' and not self.quality_check_at:
            self.quality_check_at = now
        elif new_status == 'completed' and not self.completed_at:
            self.completed_at = now

        # Registrar en el historial
        history = list(self.stage_history or [])
        history.append({
            'from_status': old_status,
            'to_status': new_status,
            'timestamp': now.isoformat(),
            'notes': notes or self.notes or ''
        })
        self.stage_history = history

    def save(self, *args, **kwargs):
        now = timezone.now()

        # 1. Auto-generar product_number si no se suministró
        if not self.product_number:
            order_ref = "ORD"
            if self.production_order and self.production_order.order:
                order_ref = (self.production_order.order.order_number or f"ORD{self.production_order.order.id}").replace('-', '').replace(' ', '')
            base_number = f"PRD-{order_ref}-{self.unit_index:02d}"
            candidate = base_number
            suffix = 1
            while ProductionProduct.objects.filter(product_number=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base_number}-{suffix}"
                suffix += 1
            self.product_number = candidate

        # 2. Registrar fechas de estados
        if self.status == 'queued' and not self.queued_at:
            self.queued_at = now
        elif self.status == 'assembling' and not self.assembling_at:
            self.assembling_at = now
        elif self.status == 'painting' and not self.painting_at:
            self.painting_at = now
        elif self.status == 'quality_check' and not self.quality_check_at:
            self.quality_check_at = now
        elif self.status == 'completed' and not self.completed_at:
            self.completed_at = now

        # 3. Registrar estado inicial en stage_history si es nuevo
        if not self.pk and not self.stage_history:
            self.stage_history = [{
                'from_status': None,
                'to_status': self.status,
                'timestamp': now.isoformat(),
                'notes': self.notes or 'Producto registrado en taller'
            }]

        super().save(*args, **kwargs)

        # 4. Sincronizar orden de fabricación madre si aplica
        if self.production_order_id and kwargs.get('update_fields') != ['is_deleted']:
            try:
                self.production_order.sync_from_products()
            except Exception:
                pass
