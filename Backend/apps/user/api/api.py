from django.utils import timezone
from rest_framework import viewsets

from apps.user.api.permisos import IsAdmin
from apps.user.api.serializers import UserSerializer, UserCreateSerializer
from apps.user.models import User
from apps.base.api import BaseViewSet


class UserViewSet(BaseViewSet):
    """ViewSet para el modelo User. Acceso restringido a administradores y superusuarios."""

    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    search_fields = [
        'username',
        'email',
        'first_name',
        'first_last_name',
        'second_name',
        'second_last_name',
        'identity_document',
        'phone',
    ]
    ordering_fields = ['username', 'email', 'date_joined', 'created_at', 'id']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

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

        is_registered = self.request.query_params.get("is_registered") or self.request.query_params.get("esta_registrado")
        if is_registered is not None:
            is_registered_normalized = is_registered.lower() in ["1", "true", "si", "yes"]
            queryset = queryset.filter(is_registered=is_registered_normalized)
            
        return queryset

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.is_deleted = True
        instance.deleted_at = timezone.now().date()
        instance.save(update_fields=["is_active", "is_deleted", "deleted_at"])

