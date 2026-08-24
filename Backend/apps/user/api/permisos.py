from rest_framework import permissions


class EsLider(permissions.BasePermission):
    message = "Solo el usuario con rol Lider puede realizar esta accion."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.groups.filter(name="Lider").exists()


class EsAdmin(permissions.BasePermission):
    message = "Solo el usuario con rol Admin puede realizar esta accion."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.groups.filter(name="Admin").exists()


class EsVocero(permissions.BasePermission):
    message = "Solo el usuario con rol Vocero puede realizar esta accion."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.groups.filter(name="Vocero").exists()


class PuedeActualizarContrasena(permissions.BasePermission):
    """
    Permiso personalizado para el endpoint de cambio de contraseña.
    - Líder puede actualizar contraseñas de cualquier vocero
    - Vocero solo puede actualizar sus propias credenciales
    - Admin solo puede actualizar sus propias credenciales
    
    Este permiso debe usarse con una vista que proporcione el usuario a modificar
    a través de get_object() o de otra manera.
    """
    
    message = "No tiene permisos para actualizar esta contraseña."
    
    def has_permission(self, request, view):
        # Todos los usuarios autenticados pueden acceder a esta vista
        # La validación específica se hará en has_object_permission
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Si el usuario es el mismo que el objeto (actualiza su propia contraseña)
        if request.user == obj:
            return True
        
        # Si el usuario es Líder, puede actualizar contraseñas de cualquier vocero
        if request.user.groups.filter(name="Lider").exists():
            # Verificar que el usuario a modificar sea un vocero
            if obj.groups.filter(name="Vocero").exists():
                return True
            else:
                # Líder solo puede modificar voceros, no otros líderes o admins
                return False
        
        # Si el usuario es Admin o Vocero y no es él mismo, no puede modificar otros usuarios
        return False