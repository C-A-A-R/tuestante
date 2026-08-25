from django.db import models
from apps.base.models import BaseModel


class Gallery(BaseModel):
    """Modelo para la galería de imágenes."""

    image = models.ImageField(
        'Imagen',
        upload_to='gallery/'
    )
    caption = models.CharField(
        'Descripción',
        max_length=255,
        blank=True,
        null=True
    )
    is_active = models.BooleanField(
        'Está activo',
        default=True
    )
    social_network = models.CharField(
        'Red social',
        max_length=50,
        blank=True,
        null=True
    )
    social_media_handle = models.CharField(
        'Usuario de red social',
        max_length=100,
        blank=True,
        null=True
    )
    social_media_url = models.URLField(
        'Enlace de la red social',
        blank=True,
        null=True
    )

    class Meta:
        verbose_name = "Galería"
        verbose_name_plural = "Galerías"
        ordering = ['-created_at']

    def __str__(self):
        return self.caption or f"Imagen #{self.id}"
