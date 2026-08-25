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
    cualquier ``FileField`` que contenga una imagen).

    Si se llama antes de ``super().save()`` (cuando ``_committed`` es ``False``),
    modifica la imagen en memoria para que Django guarde únicamente la versión
    comprimida y descarte la original sin dejar archivos huérfanos ni dobles
    escrituras en disco.

    Si se llama después de ``super().save()`` o sobre un archivo ya guardado
    (cuando ``_committed`` es ``True``), sobrescribe en el almacenamiento la ruta
    actual con la imagen comprimida.

    :param image_field:  Instancia de ``ImageFieldFile`` (ej. ``instance.category_image``).
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
        if not hasattr(image_field, 'file') or not image_field.file:
            return False
    except (ValueError, AttributeError):
        return False

    is_committed = getattr(image_field, '_committed', True)

    try:
        image_field.open()
        img = Image.open(image_field)

        # Auto-rotación según orientación EXIF si está presente
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Conversión de modo según formato de salida (preservar transparencia si es WEBP)
        has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
        if output_format.upper() == 'WEBP':
            target_mode = 'RGBA' if has_alpha else 'RGB'
        else:
            target_mode = 'RGB'

        if img.mode != target_mode:
            img = img.convert(target_mode)

        # Redimensionar respetando la proporción
        original_width, original_height = img.size
        needs_resize = original_width > max_width or original_height > max_height

        if needs_resize:
            img.thumbnail((max_width, max_height), Image.LANCZOS)

        # Guardar en buffer
        buffer = io.BytesIO()
        save_kwargs = {'format': output_format, 'quality': quality, 'optimize': True}
        if output_format.upper() == 'WEBP':
            save_kwargs['method'] = 6  # mayor compresión

        img.save(buffer, **save_kwargs)
        compressed_bytes = buffer.getvalue()
        image_field.close()

        ext = IMAGE_OUTPUT_EXT
        if not is_committed:
            # Caso A: El archivo aún no se ha guardado en disco (_committed == False).
            # Reemplazamos el stream en memoria con la versión comprimida.
            orig_name = getattr(image_field.file, 'name', '') or getattr(image_field, 'name', '')
            base = os.path.splitext(os.path.basename(orig_name))[0] if orig_name else uuid.uuid4().hex
            new_filename = f"{base}.{ext}"

            content_file = ContentFile(compressed_bytes, name=new_filename)
            image_field.file = content_file
            image_field.name = new_filename
            return True
        else:
            # Caso B: El archivo ya está guardado en almacenamiento (_committed == True).
            # Reemplazamos el contenido en storage en la misma ruta sin crear duplicados.
            storage = image_field.storage
            target_path = image_field.name

            if target_path:
                if storage.exists(target_path):
                    storage.delete(target_path)
                storage.save(target_path, ContentFile(compressed_bytes))
            return True

    except Exception as exc:
        logger.warning(
            "compress_and_save_image: no se pudo comprimir '%s'. Causa: %s",
            getattr(image_field, 'name', '?'), exc
        )
        return False
