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

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        return Project.objects.filter(is_deleted=False)

