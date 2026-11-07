from rest_framework import permissions
from apps.base.api import BaseViewSet
from apps.project.models import Project
from apps.project.api.serializers import ProjectSerializer


class ProjectViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Proyectos.
    - Lectura pública.
    - Creación/Edición/Eliminación: restringido a usuarios administradores.
    """
    serializer_class = ProjectSerializer
    search_fields = ['project_name', 'description']
    ordering_fields = ['created_at', 'project_name', 'is_active', 'id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = Project.objects.filter(is_deleted=False)
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

