from django.db import models
from django.conf import settings
from apps.base.models import BaseModel
from apps.base.utils import rename_image_upload_to, compress_and_save_image


class Gallery(BaseModel):
    """Modelo para la galería de imágenes."""

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pendiente'),
        (STATUS_APPROVED, 'Aprobado'),
        (STATUS_REJECTED, 'Rechazado'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gallery_media',
        verbose_name='Usuario',
        null=True,
        blank=True,
        help_text='Usuario que subió la multimedia'
    )
    image = models.ImageField(
        'Imagen',
        upload_to=rename_image_upload_to
    )
    caption = models.CharField(
        'Descripción',
        max_length=255,
        blank=True,
        null=True
    )
    status = models.CharField(
        'Estado',
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        help_text='Estado de moderación de la imagen (Pendiente, Aprobado o Rechazado)'
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

    @property
    def estado(self):
        return self.get_status_display()

    @property
    def is_approved(self):
        return self.status == self.STATUS_APPROVED

    class Meta:
        verbose_name = "Galería"
        verbose_name_plural = "Galerías"
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.status:
            if (self.user and self.user.is_staff) or self.user is None:
                self.status = self.STATUS_APPROVED
            else:
                self.status = self.STATUS_PENDING
        if self.image:
            compress_and_save_image(self.image)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.caption or f"Imagen #{self.id}"

