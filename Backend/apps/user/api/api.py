from rest_framework import viewsets

from apps.usuarios.api.permisos import EsLider, EsAdmin
from apps.usuarios.api.serializers import UsuarioSerializer
from apps.usuarios.models import Usuario
from apps.base.api import BaseViewSet


class UsuarioViewSet(BaseViewSet):
    """ViewSet para el modelo Usuario."""

    serializer_class = UsuarioSerializer
    permission_classes = [EsLider]

    def get_queryset(self):
        # Exclude users that belong to the Admin group (developer superusers)

        queryset = Usuario.objects.filter(eliminado=False).exclude(groups__name="Admin")
        print(queryset)
        activo = self.request.query_params.get("esta_activo")
        if activo is not None:
            activo_normalizado = activo.lower() in ["1", "true", "si", "yes"]
            queryset = queryset.filter(is_active=activo_normalizado)
        estado = self.request.query_params.get("estado")
        if estado is not None:
            estado_normalizado = estado.lower() in ["1", "true", "si", "yes"]
            queryset = queryset.filter(state=estado_normalizado)
        return queryset

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.state = False
        instance.save(update_fields=["is_active", "state"])
