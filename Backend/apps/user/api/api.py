from django.utils import timezone
from rest_framework import viewsets

from apps.user.api.permisos import IsAdmin
from apps.user.api.serializers import UserSerializer
from apps.user.models import User
from apps.base.api import BaseViewSet


class UserViewSet(BaseViewSet):
    """ViewSet para el modelo User. Acceso restringido a administradores y superusuarios."""

    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        # Filtrar usuarios no eliminados lógicamente
        queryset = User.objects.filter(is_deleted=False)
        
        is_active = self.request.query_params.get("is_active") or self.request.query_params.get("esta_activo")
        if is_active is not None:
            is_active_normalized = is_active.lower() in ["1", "true", "si", "yes"]
            queryset = queryset.filter(is_active=is_active_normalized)

        is_staff = self.request.query_params.get("is_staff")
        if is_staff is not None:
            is_staff_normalized = is_staff.lower() in ["1", "true", "si", "yes"]
            queryset = queryset.filter(is_staff=is_staff_normalized)
            
        return queryset

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.is_deleted = True
        instance.deleted_at = timezone.now().date()
        instance.save(update_fields=["is_active", "is_deleted", "deleted_at"])

