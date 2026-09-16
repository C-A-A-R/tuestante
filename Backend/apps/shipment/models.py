from django.db import models
from django.contrib.auth import get_user_model

from apps.base.models import BaseModel
from apps.orders.models import Order

User = get_user_model()


class Distributor(BaseModel):
    """
    Distribuidor o empresa de transporte encargada de entregar los pedidos.
    """

    COVERAGE_TYPE_CHOICES = [
        ('national', 'Nacional (Todo el país)'),
        ('regional', 'Regional (Estados/Zonas específicas)'),
        ('local', 'Local (Ciudad/Municipio específico)'),
    ]

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
    coverage_type = models.CharField(
        'Tipo de cobertura',
        max_length=20,
        choices=COVERAGE_TYPE_CHOICES,
        default='regional',
        help_text='Alcance geográfico de distribución'
    )
    is_active = models.BooleanField(
        'Está activo',
        default=True
    )

    class Meta:
        verbose_name = 'Distribuidor'
        verbose_name_plural = 'Distribuidores'
        ordering = ['name']

    def covers_location(self, state, municipality=None):
        """
        Verifica si el distribuidor puede entregar en el estado/municipio indicado.
        """
        if not self.is_active:
            return False
        if self.coverage_type == 'national':
            return True
        if not state:
            return False
        clean_state = str(state).strip()
        qs = self.coverages.filter(is_active=True, state__iexact=clean_state)
        if municipality and str(municipality).strip():
            clean_muni = str(municipality).strip()
            return qs.filter(
                models.Q(municipality__iexact=clean_muni) |
                models.Q(municipality='') |
                models.Q(municipality__isnull=True)
            ).exists()
        return qs.exists()

    @property
    def cobertura_resumen(self):
        """Retorna una descripción legible del alcance de cobertura."""
        if self.coverage_type == 'national':
            return 'Nacional (Cubre todo el país)'
        coverages_qs = self.coverages.filter(is_active=True)
        count = coverages_qs.count()
        if count == 0:
            return 'Sin zonas específicas registradas'
        states = list(coverages_qs.values_list('state', flat=True).distinct()[:3])
        states_str = ', '.join(states)
        if count > 3:
            states_str += f" (+{count - len(states)} zonas más)"
        return f"{self.get_coverage_type_display()}: {states_str}"

    def __str__(self):
        return f"{self.name} — {self.rif} [{self.get_coverage_type_display()}]"


class DistributorCoverage(BaseModel):
    """
    Zonas específicas a las que un distribuidor presta servicio de entrega,
    con tiempos estimados y tarifas base.
    """

    distributor = models.ForeignKey(
        Distributor,
        on_delete=models.CASCADE,
        related_name='coverages',
        verbose_name='Distribuidor'
    )
    state = models.CharField(
        'Estado',
        max_length=100,
        help_text='Estado de cobertura (ej. Carabobo, Miranda, Aragua)'
    )
    municipality = models.CharField(
        'Municipio',
        max_length=100,
        blank=True,
        null=True,
        help_text='Municipio específico. Dejar vacío si cubre TODO el estado'
    )
    city = models.CharField(
        'Ciudad / Localidad',
        max_length=100,
        blank=True,
        null=True
    )
    estimated_days_min = models.PositiveIntegerField(
        'Días mínimos de entrega',
        default=1
    )
    estimated_days_max = models.PositiveIntegerField(
        'Días máximos de entrega',
        default=3
    )
    base_shipping_cost = models.DecimalField(
        'Costo base de flete',
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    is_active = models.BooleanField(
        'Activa',
        default=True
    )

    class Meta:
        verbose_name = 'Cobertura de Distribuidor'
        verbose_name_plural = 'Coberturas de Distribuidores'
        ordering = ['state', 'municipality']
        unique_together = ('distributor', 'state', 'municipality', 'city')

    def __str__(self):
        muni = f" - {self.municipality}" if self.municipality else " (Todo el estado)"
        return f"{self.distributor.name} cubre {self.state}{muni}"


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
    state = models.CharField(
        'Estado',
        max_length=100,
        default='',
        help_text='Estado de entrega'
    )
    municipality = models.CharField(
        'Municipio',
        max_length=100,
        default='',
        help_text='Municipio de entrega'
    )
    city = models.CharField(
        'Ciudad / Localidad',
        max_length=100,
        default='',
        help_text='Ciudad o localidad de entrega'
    )
    address = models.TextField(
        'Sector / Dirección exacta',
        help_text='Indica la calle, avenida, urbanización, edificio o punto de referencia'
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
