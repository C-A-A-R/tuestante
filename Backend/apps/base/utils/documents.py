"""
apps.base.utils.documents
=========================
Utilidades para el renombrado y manejo de documentos (PDFs, etc.).
"""

import os
import uuid

def rename_document_upload_to(instance, filename, folder_name=None):
    """
    Callable para el parámetro ``upload_to`` de cualquier FileField de documentos.
    Genera un nombre único basado en UUID y determina la subcarpeta.
    """
    ext = filename.split('.')[-1].lower() if '.' in filename else 'pdf'
    new_filename = f"{uuid.uuid4().hex}.{ext}"

    if folder_name:
        folder = folder_name
    elif instance is not None and hasattr(instance, '__class__'):
        folder = instance.__class__.__name__.lower()
    else:
        folder = 'documents'

    return os.path.join(folder, new_filename)
