"""
apps.base.utils.videos
======================
Utilidades reutilizables para el manejo, renombramiento y compresión de videos.
Pueden importarse desde cualquier app del proyecto:

    from apps.base.utils.videos import rename_video_upload_to, compress_and_save_video

Nota sobre compresión de video:
    La compresión de video requiere FFmpeg instalado en el sistema operativo.
    Puedes instalarlo con:  sudo apt install ffmpeg
    Si FFmpeg no está disponible, la función ``compress_and_save_video`` deja el
    archivo original intacto y registra un aviso en el log.
"""

import io
import logging
import os
import shutil
import subprocess
import tempfile
import uuid

from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuración de compresión (ajustable sin cambiar el código de los modelos)
# ---------------------------------------------------------------------------
VIDEO_MAX_WIDTH = 1280      # px – resolución máxima de salida (720p ancho)
VIDEO_MAX_HEIGHT = 720      # px
VIDEO_CRF = 28              # Constante de tasa (18 = lossless aprox, 28 = buena relación tamaño/calidad)
VIDEO_PRESET = 'fast'       # ultrafast | superfast | veryfast | faster | fast | medium | slow
VIDEO_AUDIO_BITRATE = '96k' # bitrate de audio de salida
VIDEO_OUTPUT_EXT = 'mp4'    # extensión del archivo de salida


# ---------------------------------------------------------------------------
# Upload-to helpers
# ---------------------------------------------------------------------------

def rename_video_upload_to(instance, filename, folder_name=None):
    """
    Callable para el parámetro ``upload_to`` de cualquier FileField de video.
    Genera un nombre único basado en UUID y determina la subcarpeta
    utilizando el nombre de la clase del modelo (en minúsculas) o el valor
    especificado en ``folder_name``.

    Ejemplo:
    - Instancia de Product -> 'product/<uuid>.mp4'
    """
    ext = VIDEO_OUTPUT_EXT
    new_filename = f"{uuid.uuid4().hex}.{ext}"

    if folder_name:
        folder = folder_name
    elif instance is not None and hasattr(instance, '__class__'):
        folder = instance.__class__.__name__.lower()
    else:
        folder = 'videos'

    return os.path.join(folder, new_filename)


# ---------------------------------------------------------------------------
# Compresión de video via FFmpeg
# ---------------------------------------------------------------------------

def _ffmpeg_available():
    """Verifica si FFmpeg está disponible en el sistema."""
    return shutil.which('ffmpeg') is not None


def compress_and_save_video(video_field,
                             folder_name=None,
                             max_width=VIDEO_MAX_WIDTH,
                             max_height=VIDEO_MAX_HEIGHT,
                             crf=VIDEO_CRF,
                             preset=VIDEO_PRESET,
                             audio_bitrate=VIDEO_AUDIO_BITRATE):
    """
    Comprime el video almacenado en un ``FileField`` utilizando FFmpeg (H.264 / AAC).
    Preserva la estructura de directorio basada en la clase del modelo o el parámetro ``folder_name``.

    Llamar desde ``save()`` del modelo **después** del primer ``super().save()``,
    o en una señal ``post_save``.

    Ejemplo de uso en un modelo::

        def save(self, *args, **kwargs):
            super().save(*args, **kwargs)
            if self.product_video:
                compress_and_save_video(self.product_video)

    Si FFmpeg no está instalado, el video original se conserva sin cambios y se
    registra un aviso en el log.

    :param video_field:    Instancia de ``FieldFile`` (ej. ``instance.product_video``).
    :param folder_name:    Nombre del directorio personalizado (opcional).
    :param max_width:      Ancho máximo de salida en píxeles.
    :param max_height:     Alto máximo de salida en píxeles.
    :param crf:            Calidad constante CRF (18=alta calidad, 28=buena compresión).
    :param preset:         Velocidad de codificación FFmpeg.
    :param audio_bitrate:  Bitrate de audio (ej. '96k', '128k').
    :returns:              ``True`` si la compresión fue exitosa, ``False`` en caso contrario.
    """
    if not video_field:
        return False

    if not _ffmpeg_available():
        logger.warning(
            "compress_and_save_video: FFmpeg no está instalado. El video '%s' "
            "se guardó sin comprimir. Instala FFmpeg con: sudo apt install ffmpeg",
            getattr(video_field, 'name', '?')
        )
        return False

    tmp_input = None
    tmp_output = None

    try:
        # 1. Leer el contenido del campo a un archivo temporal de entrada
        video_field.open('rb')
        input_bytes = video_field.read()
        video_field.close()

        tmp_input = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        tmp_input.write(input_bytes)
        tmp_input.flush()
        tmp_input.close()

        # 2. Archivo temporal de salida
        tmp_output_path = tempfile.mktemp(suffix='.mp4')

        # 3. Escalar manteniendo proporción: no superar max_width × max_height
        scale_filter = (
            f"scale='if(gt(iw,ih),min({max_width},iw),-2)':"
            f"'if(gt(iw,ih),-2,min({max_height},ih))',"
            f"scale=trunc(iw/2)*2:trunc(ih/2)*2"
        )

        cmd = [
            'ffmpeg', '-y',
            '-i', tmp_input.name,
            '-vf', scale_filter,
            '-c:v', 'libx264',
            '-crf', str(crf),
            '-preset', preset,
            '-c:a', 'aac',
            '-b:a', audio_bitrate,
            '-movflags', '+faststart',
            tmp_output_path
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos máximo
        )

        if result.returncode != 0:
            logger.warning(
                "compress_and_save_video: FFmpeg terminó con error para '%s'.\n"
                "STDERR: %s",
                getattr(video_field, 'name', '?'), result.stderr[-2000:]
            )
            return False

        # 4. Reemplazar el contenido del campo con el video comprimido
        with open(tmp_output_path, 'rb') as f:
            compressed_bytes = f.read()

        if not is_committed:
            # Caso A: El archivo aún no se ha guardado en disco (_committed == False).
            orig_name = getattr(video_field.file, 'name', '') or getattr(video_field, 'name', '')
            base = os.path.splitext(os.path.basename(orig_name))[0] if orig_name else uuid.uuid4().hex
            new_filename = f"{base}.{VIDEO_OUTPUT_EXT}"

            content_file = ContentFile(compressed_bytes, name=new_filename)
            video_field.file = content_file
            video_field.name = new_filename
        else:
            # Caso B: El archivo ya está guardado en almacenamiento (_committed == True).
            storage = video_field.storage
            target_path = video_field.name

            if target_path:
                if storage.exists(target_path):
                    storage.delete(target_path)
                storage.save(target_path, ContentFile(compressed_bytes))

        logger.info(
            "compress_and_save_video: '%s' comprimido. "
            "Original: %d KB → Comprimido: %d KB",
            getattr(video_field, 'name', '?'),
            len(input_bytes) // 1024,
            len(compressed_bytes) // 1024
        )

        return True

    except Exception as exc:
        logger.warning(
            "compress_and_save_video: error inesperado comprimiendo '%s'. Causa: %s",
            getattr(video_field, 'name', '?'), exc
        )
        return False

    finally:
        # Limpiar temporales
        if tmp_input and os.path.exists(tmp_input.name):
            os.unlink(tmp_input.name)
        if tmp_output and os.path.exists(tmp_output):
            os.unlink(tmp_output)
