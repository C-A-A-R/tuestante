from decimal import Decimal
from django.db import models
from django.db.models import Sum
from django.conf import settings
from apps.base.models import BaseModel
from apps.base.utils.images import rename_image_upload_to, compress_and_save_image


class EmployeeProfile(BaseModel):
    """Perfil del empleado para control de compras internas y crédito en tienda."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employee_profile',
        verbose_name='Usuario'
    )
    employee_number = models.CharField(
        'Número de Empleado',
        max_length=50,
        unique=True,
        help_text='Código o ficha identificadora del trabajador en la empresa'
    )
    department = models.CharField('Departamento', max_length=100)
    position = models.CharField('Cargo', max_length=100)
    salary = models.DecimalField('Salario', max_digits=12, decimal_places=2, default=Decimal('0.00'))
    photo = models.ImageField(
        'Foto del Trabajador',
        upload_to=rename_image_upload_to,
        null=True,
        blank=True
    )
    is_active = models.BooleanField('Activo en Tienda', default=True)

    class Meta:
        verbose_name = 'Perfil de Empleado'
        verbose_name_plural = 'Perfiles de Empleados'
        ordering = ['employee_number']

    def __str__(self):
        full_name = self.user.get_full_name() if hasattr(self.user, 'get_full_name') else ''
        return f"{self.employee_number} - {full_name or self.user.username}"

    def save(self, *args, **kwargs):
        if not self.employee_number:
            from apps.employee_store.utils import generate_employee_number
            self.employee_number = generate_employee_number()
        if self.photo:
            compress_and_save_image(self.photo)
        super().save(*args, **kwargs)

    @property
    def current_debt(self):
        """
        Calcula la deuda acumulada actual del empleado:
        (Total de órdenes no canceladas no eliminadas) - (Total de abonos/pagos no eliminados).
        """
        total_orders = self.orders.filter(
            is_deleted=False,
            status__in=['UNDELIVERED', 'DELIVERED', 'COMPLETED', 'PAID']
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        total_payments = self.payments.filter(
            is_deleted=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        debt = total_orders - total_payments
        return max(Decimal('0.00'), debt)


class InternalCategory(BaseModel):
    """Categoría para los productos de consumo interno."""

    name = models.CharField('Nombre de Categoría', max_length=100)
    description = models.TextField('Descripción', blank=True)
    image = models.ImageField(
        'Imagen',
        upload_to=rename_image_upload_to,
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = 'Categoría Interna'
        verbose_name_plural = 'Categorías Internas'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.image:
            compress_and_save_image(self.image)
        super().save(*args, **kwargs)


class InternalSubCategory(BaseModel):
    """Subcategoría para clasificar de forma más granular los productos internos."""

    category = models.ForeignKey(
        InternalCategory,
        on_delete=models.CASCADE,
        related_name='subcategories',
        verbose_name='Categoría Principal'
    )
    name = models.CharField('Nombre de Subcategoría', max_length=100)
    description = models.TextField('Descripción', blank=True)
    image = models.ImageField(
        'Imagen',
        upload_to=rename_image_upload_to,
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = 'Subcategoría Interna'
        verbose_name_plural = 'Subcategorías Internas'
        ordering = ['category__name', 'name']

    def __str__(self):
        return f"{self.category.name} > {self.name}"

    def save(self, *args, **kwargs):
        if self.image:
            compress_and_save_image(self.image)
        super().save(*args, **kwargs)


class InternalProduct(BaseModel):
    """Producto disponible en la tienda interna de empleados."""

    category = models.ForeignKey(
        InternalCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='Categoría'
    )
    subcategory = models.ForeignKey(
        InternalSubCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='Subcategoría'
    )
    barcode = models.CharField(
        'Código de Barras',
        max_length=100,
        unique=True,
        db_index=True,
        help_text='Código único para lectura rápida en punto de venta'
    )
    name = models.CharField('Nombre del Producto', max_length=200)
    description = models.TextField('Descripción', blank=True)
    price = models.DecimalField('Precio Unitario', max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField('Stock Físico', default=0)
    weekly_limit_per_employee = models.PositiveIntegerField(
        'Límite Semanal por Empleado',
        default=0,
        help_text='Máximo de unidades que un trabajador puede comprar en 7 días (0 = sin límite)'
    )
    image = models.ImageField(
        'Imagen',
        upload_to=rename_image_upload_to,
        null=True,
        blank=True
    )
    is_active = models.BooleanField('Activo', default=True)

    class Meta:
        verbose_name = 'Producto Interno'
        verbose_name_plural = 'Productos Internos'
        ordering = ['name']

    def __str__(self):
        return f"{self.barcode} - {self.name} (${self.price})"

    def save(self, *args, **kwargs):
        if self.image:
            compress_and_save_image(self.image)
        super().save(*args, **kwargs)


class InternalOrder(BaseModel):
    """Orden de consumo interno realizada por un empleado."""

    STATUS_CHOICES = (
        ('UNDELIVERED', 'Sin entregar'),
        ('DELIVERED', 'Entregado'),
        ('CANCELLED', 'Cancelado'),
        ('PAID', 'Pagado'),
        ('COMPLETED', 'Entregado'),  # Retrocompatibilidad
    )

    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.PROTECT,
        related_name='orders',
        verbose_name='Empleado'
    )
    order_number = models.CharField('Número de Orden', max_length=50, unique=True)
    total_amount = models.DecimalField('Monto Total', max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField('Estado', max_length=20, choices=STATUS_CHOICES, default='UNDELIVERED')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='internal_orders_created',
        verbose_name='Despachado por'
    )
    notes = models.TextField('Notas u Observaciones', blank=True)

    class Meta:
        verbose_name = 'Orden Interna'
        verbose_name_plural = 'Órdenes Internas'
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f"Orden #{self.order_number} - {self.employee.employee_number} (${self.total_amount})"


class InternalOrderItem(BaseModel):
    """Línea de ítem de una orden interna con snapshot inmutable del precio unitario."""

    order = models.ForeignKey(
        InternalOrder,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Orden'
    )
    product = models.ForeignKey(
        InternalProduct,
        on_delete=models.PROTECT,
        related_name='order_items',
        verbose_name='Producto'
    )
    quantity = models.PositiveIntegerField('Cantidad', default=1)
    unit_price = models.DecimalField(
        'Precio Unitario (Snapshot)',
        max_digits=10,
        decimal_places=2,
        help_text='Precio al momento exacto de la compra (inmutable)'
    )
    subtotal = models.DecimalField('Subtotal', max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = 'Ítem de Orden Interna'
        verbose_name_plural = 'Ítems de Órdenes Internas'

    def __str__(self):
        return f"{self.quantity}x {self.product.name} (${self.unit_price}) = ${self.subtotal}"


class DebtPayment(BaseModel):
    """Registro de abono a la deuda o descuento aplicado en nómina."""

    PAYMENT_TYPES = (
        ('PAYROLL_DEDUCTION', 'Descuento de Nómina'),
        ('CASH', 'Efectivo'),
        ('TRANSFER', 'Transferencia Bancaria'),
    )

    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.PROTECT,
        related_name='payments',
        verbose_name='Empleado'
    )
    amount = models.DecimalField('Monto del Abono', max_digits=12, decimal_places=2)
    payment_type = models.CharField(
        'Tipo de Pago',
        max_length=30,
        choices=PAYMENT_TYPES,
        default='PAYROLL_DEDUCTION'
    )
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='debt_payments_registered',
        verbose_name='Registrado por'
    )
    reference = models.CharField('Referencia / Comprobante', max_length=100, blank=True)
    notes = models.TextField('Notas', blank=True)

    class Meta:
        verbose_name = 'Abono / Pago de Deuda'
        verbose_name_plural = 'Abonos / Pagos de Deuda'
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f"Abono ${self.amount} - {self.employee.employee_number} ({self.get_payment_type_display()})"
