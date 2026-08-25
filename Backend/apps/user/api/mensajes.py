"""Mensajes estándar para los endpoints de Usuarios.

Cada mensaje es un dict con `titulo`, `mensaje` y `tipo` ('success'|'error').
"""

MESSAGES = {
    "PASSWORD_CHANGE_SUCCESS": {
        "titulo": "Cambio de contraseña",
        "mensaje": "La contraseña se actualizó exitosamente",
        "tipo": "success",
    },
    "PASSWORD_CHANGE_ERROR": {
        "titulo": "Cambio de contraseña",
        "mensaje": "Error al cambiar la contraseña",
        "tipo": "error",
    },
}

__all__ = ["MESSAGES"]

