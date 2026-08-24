from django.db import models
from apps.base.models import BaseModel
from apps.base.utils import rename_document_upload_to, rename_image_upload_to, compress_and_save_image


class Project(BaseModel):
    """Modelo para representar los Proyectos."""

    project_name = models.CharField('Nombre del Proyecto', max_length=255)
    description = models.TextField('Descripción', null=True, blank=True)
    project_document = models.FileField(
        'Documento del Proyecto (PDF)',
        upload_to=rename_document_upload_to,
        null=True,
        blank=True,
        help_text='Archivo del proyecto (usualmente formato PDF)'
    )
    project_images = models.ImageField(
        'Imágenes del Proyecto',
        upload_to=rename_image_upload_to,
        null=True,
        blank=True,
        help_text='Imagen representativa del proyecto'
    )

    class Meta:
        verbose_name = 'Proyecto'
        verbose_name_plural = 'Proyectos'
        ordering = ['id']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.project_images:
            compress_and_save_image(self.project_images)

    def __str__(self):
        return self.project_name
