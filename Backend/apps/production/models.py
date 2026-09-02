from django.db import models
from apps.base.models import BaseModel
from apps.orders.models import Order

class ProductionOrder(BaseModel):
    STATUS_CHOICES = [
        ('queued', 'En Cola de Espera'),
        ('assembling', 'En Corte y Ensamblaje'),
        ('painting', 'En Pintura y Acabado'),
        ('quality_check', 'En Control de Calidad'),
        ('completed', 'Fabricación Completada') # <-- Este activa el cobro del 50% restante
    ]

    # Relación Uno a Uno: Cada pedido genera una sola orden de trabajo en el taller
    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name='production')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    
    # Control de tiempos internos para la empresa
    start_date = models.DateTimeField(null=True, blank=True, verbose_name="Inicio de fabricación")
    estimated_completion_date = models.DateTimeField(verbose_name="Fecha estimada de fin")
    actual_completion_date = models.DateTimeField(null=True, blank=True, verbose_name="Fecha real de fin")
    
    # Notas para el artesano/obrero
    technical_notes = models.TextField(blank=True, null=True, help_text="Medidas especiales, colores de puertas, etc.")

    class Meta:
        verbose_name = "Orden de Fabricación"
        verbose_name_plural = "Órdenes de Fabricación"
