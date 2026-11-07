from rest_framework import permissions
from apps.base.api import BaseViewSet
from apps.partnerships.models import Partnership
from apps.partnerships.api.serializers import PartnershipSerializer


class PartnershipViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Empresas Aliadas / Partnerships.
    - Lectura pública para visitantes de la tienda.
    - Creación/Edición/Eliminación: restringido a usuarios administradores.
    """
    serializer_class = PartnershipSerializer
    search_fields = ['name', 'description']
    ordering_fields = ['id', 'name', 'created_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = Partnership.objects.filter(is_deleted=False)
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_active=True)
        else:
            is_active_param = self.request.query_params.get('is_active')
            if is_active_param is not None:
                if is_active_param.strip().lower() in ['true', '1', 'yes', 'si']:
                    queryset = queryset.filter(is_active=True)
                elif is_active_param.strip().lower() in ['false', '0', 'no']:
                    queryset = queryset.filter(is_active=False)
        return queryset
