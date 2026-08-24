"""
apps.base.utils.images
======================
Utilidades reutilizables para el manejo, renombramiento y compresión de imágenes.
Pueden importarse desde cualquier app del proyecto:

    from apps.base.utils.images import rename_image_upload_to, compress_and_save_image
"""

import io
import logging
import os
import uuid

from django.core.files.base import ContentFile
from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuración de compresión (ajustable sin cambiar el código de los modelos)
# ---------------------------------------------------------------------------
IMAGE_MAX_WIDTH = 1920          # px – ancho máximo permitido
IMAGE_MAX_HEIGHT = 1920         # px – alto máximo permitido
IMAGE_QUALITY = 82              # 0-95  (JPEG / WEBP quality)
IMAGE_OUTPUT_FORMAT = 'WEBP'    # JPEG | WEBP  (recomendado WEBP: mejor ratio)
IMAGE_OUTPUT_EXT = 'webp'       # extensión del archivo de salida


# ---------------------------------------------------------------------------
# Upload-to helpers
# ---------------------------------------------------------------------------

def rename_image_upload_to(instance, filename, folder_name=None):
    """
    Callable para el parámetro ``upload_to`` de cualquier ImageField.
    Genera un nombre único basado en UUID y determina la subcarpeta
    utilizando el nombre de la clase del modelo (en minúsculas) o el valor
    especificado en ``folder_name``.

    Ejemplos:
    - Instancia de Category     -> 'category/<uuid>.webp'
    - Instancia de Product      -> 'product/<uuid>.webp'
    - Instancia de ProductType  -> 'producttype/<uuid>.webp'
    - Instancia de ProductImage -> 'productimage/<uuid>.webp'
    """
    ext = IMAGE_OUTPUT_EXT
    new_filename = f"{uuid.uuid4().hex}.{ext}"

    if folder_name:
        folder = folder_name
    elif instance is not None and hasattr(instance, '__class__'):
        folder = instance.__class__.__name__.lower()
    else:
        folder = 'images'

    return os.path.join(folder, new_filename)


# ---------------------------------------------------------------------------
# Compresión / redimensionamiento
# ---------------------------------------------------------------------------

def compress_and_save_image(image_field, folder_name=None, max_width=IMAGE_MAX_WIDTH,
                             max_height=IMAGE_MAX_HEIGHT, quality=IMAGE_QUALITY,
                             output_format=IMAGE_OUTPUT_FORMAT):
    """
    Comprime y redimensiona la imagen almacenada en un ``ImageField`` (o
    cualquier ``FileField`` que contenga una imagen). Preserva la estructura
    de directorio basada en la clase del modelo o el parámetro ``folder_name``.

    Llamar desde ``save()`` del modelo **después** del primer ``super().save()``,
    o en una señal ``post_save``.

    Ejemplo de uso en un modelo::

        def save(self, *args, **kwargs):
            super().save(*args, **kwargs)
            if self.image:
                compress_and_save_image(self.image)

    :param image_field:  Instancia de ``ImageFieldFile`` (ej. ``instance.image``).
    :param folder_name:  Nombre del directorio personalizado (opcional).
    :param max_width:    Ancho máximo en píxeles.
    :param max_height:   Alto máximo en píxeles.
    :param quality:      Calidad de compresión (0-95).
    :param output_format: Formato Pillow de salida ('JPEG', 'WEBP', etc.).
    :returns:            ``True`` si se realizó la compresión, ``False`` en caso contrario.
    """
    if not image_field:
        return False

    try:
        image_field.open()
        img = Image.open(image_field)

        # Convertir a RGB si es necesario (e.g., PNG con transparencia RGBA)
        if img.mode not in ('RGB', 'RGBA') or (output_format == 'JPEG' and img.mode == 'RGBA'):
            img = img.convert('RGB')

        # Redimensionar respetando la proporción
        original_width, original_height = img.size
        needs_resize = original_width > max_width or original_height > max_height

        if needs_resize:
            img.thumbnail((max_width, max_height), Image.LANCZOS)

        # Guardar en buffer
        buffer = io.BytesIO()
        save_kwargs = {'format': output_format, 'quality': quality, 'optimize': True}
        if output_format == 'WEBP':
            save_kwargs['method'] = 6  # mayor compresión
        img.save(buffer, **save_kwargs)
        buffer.seek(0)

        # Determinar directorio preservando la carpeta original o el nombre de la clase
        dirname = folder_name
        if not dirname and image_field.name:
            dirname = os.path.dirname(image_field.name)
        if not dirname and hasattr(image_field, 'instance') and image_field.instance:
            dirname = image_field.instance.__class__.__name__.lower()
        if not dirname:
            dirname = 'images'

        ext = IMAGE_OUTPUT_EXT
        new_filename = f"{uuid.uuid4().hex}.{ext}"
        new_path = os.path.join(dirname, new_filename)

        image_field.save(new_path, ContentFile(buffer.read()), save=False)
        return True

    except Exception as exc:
        logger.warning(
            "compress_and_save_image: no se pudo comprimir '%s'. Causa: %s",
            getattr(image_field, 'name', '?'), exc
        )
        return False
