import os
import uuid
from django.db import models
from apps.base.models import BaseModel
from apps.base.utils.images import rename_image_upload_to, compress_and_save_image
from apps.base.utils.videos import rename_video_upload_to, compress_and_save_video


class Category(BaseModel):
    """Modelo para representar las Categorías de productos."""

    category_name = models.CharField('Nombre de Categoría', max_length=150, unique=True)
    description = models.TextField('Descripción', null=True, blank=True)
    category_image = models.ImageField('Imagen de Categoría', upload_to=rename_image_upload_to, null=True, blank=True)

    class Meta:
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['category_name']

    def __str__(self):
        return self.category_name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.category_image:
            compress_and_save_image(self.category_image)


class ProductType(BaseModel):
    """Modelo para representar los Tipos de Productos."""

    product_type_name = models.CharField('Nombre del Tipo', max_length=100, unique=True)
    description = models.TextField('Descripción', null=True, blank=True)
    product_type_image = models.ImageField('Imagen del Tipo', upload_to=rename_image_upload_to, null=True, blank=True)

    class Meta:
        verbose_name = 'Tipo de Producto'
        verbose_name_plural = 'Tipos de Productos'
        ordering = ['product_type_name']

    def __str__(self):
        return self.product_type_name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.product_type_image:
            compress_and_save_image(self.product_type_image)


class Product(BaseModel):
    """Modelo para representar los Productos."""

    categories = models.ManyToManyField(
        Category,
        related_name='products',
        verbose_name='Categorías',
        blank=True
    )
    product_type = models.ForeignKey(
        ProductType,
        on_delete=models.CASCADE,
        related_name='products',
        verbose_name='Tipo de Producto'
    )
    product_name = models.CharField('Nombre del Producto', max_length=200)
    description = models.TextField('Descripción', null=True, blank=True)
    is_feature_product = models.BooleanField('Producto Destacado', default=False)
    height_cm = models.DecimalField('Alto (cm)', max_digits=10, decimal_places=2, default=0)
    depth_cm = models.DecimalField('Profundo (cm)', max_digits=10, decimal_places=2, default=0)
    width_cm = models.DecimalField('Ancho (cm)', max_digits=10, decimal_places=2, default=0)
    security = models.CharField('Seguridad', max_length=255, default='', blank=True)
    price = models.DecimalField('Precio', max_digits=12, decimal_places=2, default=0)
    product_image = models.ImageField('Imagen del Producto', upload_to=rename_image_upload_to, null=True, blank=True)
    product_video = models.FileField('Video del Producto', upload_to=rename_video_upload_to, null=True, blank=True)

    class Meta:
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['product_name']

    @property
    def category(self):
        """Retorna la primera categoría asignada para mantener compatibilidad hacia atrás."""
        return self.categories.first()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.product_image:
            compress_and_save_image(self.product_image)
        if self.product_video:
            compress_and_save_video(self.product_video)

    def __str__(self):
        return self.product_name


class ProductColorImage(BaseModel):
    """Modelo para representar múltiples imágenes asociadas a un producto, asignando un color hexadecimal."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='color_images',
        verbose_name='Producto'
    )
    color_image = models.ImageField(
        'Imagen',
        upload_to=rename_image_upload_to,
        null=True,
        blank=True
    )
    color_hex = models.CharField(
        'Color Hexadecimal',
        max_length=7,
        default='#000000',
        help_text='Código de color hexadecimal (ej. #FF5733)'
    )
    color_name = models.CharField(
        'Nombre del Color',
        max_length=100,
        null=True,
        blank=True,
        help_text='Nombre del color asociado a la imagen (ej. Rojo, Azul, Verde)'
    )

    class Meta:
        verbose_name = 'Color de Producto'
        verbose_name_plural = 'Colores de los Productos'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.color_image:
            compress_and_save_image(self.color_image)

    def __str__(self):
        return f"Imagen ({self.color_hex}) - {self.product.product_name}"


class ProductAngleImage(BaseModel):
    """Modelo para representar imágenes de diferentes ángulos asociadas a un producto."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='angle_images',
        verbose_name='Producto'
    )
    image = models.ImageField(
        'Imagen del Ángulo',
        upload_to=rename_image_upload_to,
        null=True,
        blank=True
    )
    angle = models.CharField(
        'Ángulo / Vista',
        max_length=100,
        null=True,
        blank=True,
        help_text='Nombre o tipo de ángulo (ej. Frente, Lateral, Posterior, Detalle)'
    )

    class Meta:
        verbose_name = 'Ángulo de Producto'
        verbose_name_plural = 'Ángulos de Productos'
        ordering = ['id']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.image:
            compress_and_save_image(self.image)

    def __str__(self):
        angle_str = f" - {self.angle}" if self.angle else ""
        return f"Ángulo{angle_str} - {self.product.product_name}"

