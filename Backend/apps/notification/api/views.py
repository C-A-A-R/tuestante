from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction

from apps.base.api import BaseViewSet
from apps.notification.models import Notification, NotificationMedia
from apps.notification.api.serializers import NotificationSerializer
from apps.notification.services.notification_service import send_notification



class NotificationViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Notificaciones.
    - Lectura/Eliminación lógica: Restringido al usuario dueño de la notificación (o admin).
    - Optimización: prefetch_related para evitar N+1 queries.
    """

    serializer_class = NotificationSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'destroy', 'mark_as_read', 'mark_all_as_read']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        """
        Retorna notificaciones no eliminadas.
        - Filtra por el usuario autenticado a menos que sea personal/admin.
        """
        queryset = Notification.objects.filter(is_deleted=False).prefetch_related('media_files').select_related('user', 'order')

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(user=self.request.user)

        return queryset

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """Marca una notificación específica como leída."""
        notification = self.get_object()
        notification.mark_as_read()
        serializer = self.get_serializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """Marca todas las notificaciones del usuario como leídas."""
        queryset = self.get_queryset().filter(is_read=False)
        count = queryset.update(is_read=True)
        return Response(
            {"message": f"{count} notificación(es) marcada(s) como leída(s)."},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def send_broadcast(self, request):
        """
        Permite a un administrador enviar una notificación general a un usuario.
        Body:
        {
            "user_id": 1,
            "title": "...",
            "message": "..."
        }
        """
        user_id = request.data.get('user_id')
        title = request.data.get('title')
        message = request.data.get('message')

        if not all([user_id, title, message]):
            return Response(
                {"error": "Debe especificar 'user_id', 'title' y 'message'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            target_user = User.objects.get(id=user_id, is_deleted=False)
        except User.DoesNotExist:
            return Response(
                {"error": "El usuario destino no existe o ha sido eliminado."},
                status=status.HTTP_404_NOT_FOUND
            )

        notification = send_notification(
            user=target_user,
            title=title,
            message=message,
            notification_type='general'
        )


        serializer = self.get_serializer(notification)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
