from django.db import models
from apps.base.models import BaseModel
from apps.orders.models import Order


class Invoice(BaseModel):
    """
    Modelo para representar la Factura electrónica / fiscal de una orden.
    """

    # 🔢 Control Fiscal
    invoice_number = models.CharField(
        max_length=50, 
        unique=True, 
        verbose_name="Número de Factura",
        help_text="Formato FAC-nnnn-año (ej. FAC-0001-2026)"
    )
    
    # 🔗 Relación Única: Una orden genera exactamente una factura al completarse el pago
    order = models.OneToOneField(
        Order, 
        on_delete=models.PROTECT, 
        related_name='invoice',
        verbose_name="Orden"
    )
    
    # 👤 Datos del Cliente en el momento de facturar (Copia fija)
    customer_name = models.CharField(max_length=255, verbose_name="Nombre o Razón Social")
    customer_tax_id = models.CharField(max_length=50, verbose_name="DNI / RIF / NIT / RUT")
    customer_email = models.EmailField(verbose_name="Correo Electrónico")
    billing_address = models.TextField(verbose_name="Dirección de Facturación")
    
    # 📊 Desglose Económico Congelado
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Subtotal")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="Descuento Aplicado")
    total = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Total Facturado")
    
    # 📦 Captura de Productos Vendidos
    # Guardar un JSON evita depender de la tabla de productos si un artículo se borra del catálogo en el futuro
    items_snapshot = models.JSONField(
        help_text="Lista con nombre, cantidad y precio unitario de los productos facturados."
    )
    
    # 📄 Archivo Digital
    pdf_file = models.FileField(
        upload_to='invoices_pdf/', 
        blank=True, 
        null=True, 
        verbose_name="Factura en PDF"
    )

    class Meta:
        verbose_name = "Factura"
        verbose_name_plural = "Facturas"
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        """Asigna automáticamente el número de factura si no está establecido."""
        if not self.invoice_number:
            from apps.invoice.utils import generate_invoice_number
            self.invoice_number = generate_invoice_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Factura {self.invoice_number} — {self.customer_name} (Orden #{self.order.id})"
