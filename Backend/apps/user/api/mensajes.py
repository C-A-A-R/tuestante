"""Mensajes estándar para los endpoints de Usuarios.

Cada mensaje es un dict con `titulo`, `mensaje` y `tipo` ('success'|'error').
"""

MESSAGES = {
    "CAMBIO_DE_CONTRASEÑA_EXITOSO": {
        "titulo": "Borrado de familia",
        "mensaje": "Borrado de familia exitoso",
        "tipo": "success",
    },
    "CAMBIO_DE_CONTRASEÑA_ERROR": {
        "titulo": "Borrado de familia",
        "mensaje": "Borrado de familia exitoso",
        "tipo": "success",
    },
}

__all__ = ["MESSAGES"]
