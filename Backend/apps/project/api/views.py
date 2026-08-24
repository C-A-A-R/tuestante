from rest_framework import permissions
from apps.base.api import BaseViewSet
from apps.project.models import Project
from apps.project.api.serializers import ProjectSerializer


class ProjectViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de Proyectos.
    Hereda de BaseViewSet para borrado lógico.
    """
    serializer_class = ProjectSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Project.objects.filter(is_deleted=False)
