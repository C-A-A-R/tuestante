from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Permiso que otorga acceso solo a usuarios administradores o superusuarios."""
    message = "Solo un usuario administrador o superusuario puede realizar esta acción."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )


class CanUpdatePassword(permissions.BasePermission):
    """
    Permiso personalizado para el endpoint de cambio de contraseña.
    - Administrador/Superusuario puede actualizar contraseñas de cualquier usuario.
    - Usuario cliente solo puede actualizar su propia contraseña.
    """

    message = "No tiene permisos para actualizar esta contraseña."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        # El usuario puede actualizar su propia contraseña
        if request.user == obj:
            return True

        # Administrador o superusuario puede actualizar la contraseña de cualquier usuario
        if request.user.is_staff or request.user.is_superuser:
            return True

        return False
