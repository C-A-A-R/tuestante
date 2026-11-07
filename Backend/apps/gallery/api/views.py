from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from apps.base.api import BaseViewSet
from apps.gallery.models import Gallery
from apps.gallery.api.serializers import GallerySerializer


class GalleryViewSet(BaseViewSet):
    """
    ViewSet para la gestión CRUD de la Galería.
    - Lectura pública: los usuarios y clientes solo pueden ver la multimedia aprobada o subida por el admin.
    - Creación: usuarios autenticados (clientes suben en estado pendiente; administradores pueden aprobar directamente).
    - Aprobación/Rechazo/Edición/Eliminación: restringido a usuarios administradores.
    - Herencia de BaseViewSet para borrado lógico.
    """

    serializer_class = GallerySerializer
    search_fields = ['caption', 'social_network', 'social_media_handle', 'user__username', 'user__email']
    ordering_fields = ['created_at', 'status', 'is_active', 'id']

    def get_permissions(self):
        """Asigna permisos según la acción solicitada."""
        if self.action in ['list', 'retrieve', 'create']:
            permission_classes = [permissions.AllowAny]
        elif self.action in ['my_uploads']:
            permission_classes = [permissions.IsAuthenticated]
        else:
            permission_classes = [permissions.IsAdminUser]
        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        """Asigna el usuario que subió la multimedia y el estado correspondiente."""
        user = self.request.user if self.request.user and self.request.user.is_authenticated else None

        if user and user.is_staff:
            # Para administradores: respeta la asignación (puede ser None si no se seleccionó usuario)
            assigned_user = serializer.validated_data.get('user', None)
            status_val = serializer.validated_data.get('status', Gallery.STATUS_APPROVED)
            is_active_val = serializer.validated_data.get('is_active')
            if is_active_val is None:
                is_active_val = True
        else:
            assigned_user = user
            status_val = Gallery.STATUS_PENDING
            is_active_val = False

        serializer.save(user=assigned_user, status=status_val, is_active=is_active_val)

    def get_queryset(self):
        """Filtra el queryset según el estado y los permisos del usuario."""
        queryset = Gallery.objects.filter(is_deleted=False).select_related('user')

        # Si no es administrador, mostrar únicamente imágenes activas que estén aprobadas o hayan sido subidas por el admin
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_active=True).filter(
                Q(status=Gallery.STATUS_APPROVED) | Q(user__is_staff=True) | Q(user__isnull=True)
            )
        else:
            # Para administradores, permitir filtrar opcionalmente por estado
            status_param = (
                self.request.query_params.get('status') or
                self.request.query_params.get('estado')
            )
            if status_param:
                status_param = status_param.strip().lower()
                if status_param in ['pending', 'pendiente']:
                    queryset = queryset.filter(status=Gallery.STATUS_PENDING)
                elif status_param in ['approved', 'aprobado', 'aprobada']:
                    queryset = queryset.filter(status=Gallery.STATUS_APPROVED)
                elif status_param in ['rejected', 'rechazado', 'rechazada']:
                    queryset = queryset.filter(status=Gallery.STATUS_REJECTED)

            is_active_param = (
                self.request.query_params.get('is_active') or
                self.request.query_params.get('activo')
            )
            if is_active_param is not None:
                if is_active_param.strip().lower() in ['true', '1', 'yes', 'si']:
                    queryset = queryset.filter(is_active=True)
                elif is_active_param.strip().lower() in ['false', '0', 'no']:
                    queryset = queryset.filter(is_active=False)

        social_network = self.request.query_params.get('social_network')
        if social_network:
            queryset = queryset.filter(social_network=social_network)

        return queryset

    @action(detail=True, methods=['post', 'patch'], permission_classes=[permissions.IsAdminUser], url_path='approve')
    def approve(self, request, pk=None):
        """Endpoint para aprobar una imagen de la galería."""
        gallery_item = self.get_object()
        gallery_item.status = Gallery.STATUS_APPROVED
        gallery_item.is_active = True
        gallery_item.save(update_fields=['status', 'is_active'])
        return Response({
            'message': 'Multimedia aprobada con éxito.',
            'status': gallery_item.status,
            'is_active': gallery_item.is_active,
            'id': gallery_item.id
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post', 'patch'], permission_classes=[permissions.IsAdminUser], url_path='reject')
    def reject(self, request, pk=None):
        """Endpoint para rechazar una imagen de la galería."""
        gallery_item = self.get_object()
        gallery_item.status = Gallery.STATUS_REJECTED
        gallery_item.is_active = False
        gallery_item.save(update_fields=['status', 'is_active'])
        return Response({
            'message': 'Multimedia rechazada con éxito.',
            'status': gallery_item.status,
            'is_active': gallery_item.is_active,
            'id': gallery_item.id
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='my-uploads')
    def my_uploads(self, request):
        """Permite al usuario autenticado consultar el estado de sus propias subidas."""
        queryset = Gallery.objects.filter(is_deleted=False, user=request.user).select_related('user')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

