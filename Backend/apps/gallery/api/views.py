from rest_framework import permissions
from apps.base.api import BaseViewSet
from apps.gallery.models import Gallery
from apps.gallery.api.serializers import GallerySerializer


class GalleryViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de la Galería.
    - Lectura pública: muestra imágenes activas.
    - Creación/Edición/Eliminación: restringido a usuarios administradores.
    - Herencia de BaseViewSet para borrado lógico.
    """

    serializer_class = GallerySerializer
    search_fields = ['caption', 'social_network', 'social_media_handle']
    ordering_fields = ['created_at', 'is_active', 'id']

    def get_permissions(self):
        """Asigna permisos según la acción solicitada."""
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAdminUser]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """Filtra el queryset según el estado y los permisos del usuario."""
        queryset = Gallery.objects.filter(is_deleted=False)

        # Si no es administrador, mostrar únicamente las imágenes activas
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_active=True)

        social_network = self.request.query_params.get('social_network')
        if social_network:
            queryset = queryset.filter(social_network=social_network)

        return queryset
