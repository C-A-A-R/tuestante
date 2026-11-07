from django.db import models
from apps.base.models import BaseModel
from apps.base.utils.images import rename_image_upload_to, compress_and_save_image


class Partnership(BaseModel):
    """Modelo para representar empresas aliadas o alianzas estratégicas."""

    name = models.CharField(
        'Nombre de la Empresa',
        max_length=255,
        help_text='Nombre de la empresa aliada'
    )
    logo = models.ImageField(
        'Logo de la Empresa',
        upload_to=rename_image_upload_to,
        null=True,
        blank=True,
        help_text='Logo o imagen representativa de la empresa'
    )
    description = models.TextField(
        'Descripción',
        null=True,
        blank=True,
        help_text='Breve descripción de la alianza o de la empresa'
    )
    is_active = models.BooleanField(
        'Está activo',
        default=True,
        help_text='Indica si la alianza se encuentra activa y visible'
    )

    class Meta:
        verbose_name = 'Alianza'
        verbose_name_plural = 'Alianzas'
        ordering = ['id']

    @property
    def company_name(self):
        """Alias para mantener compatibilidad con referencias a company_name."""
        return self.name

    def save(self, *args, **kwargs):
        if self.logo:
            compress_and_save_image(self.logo)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
