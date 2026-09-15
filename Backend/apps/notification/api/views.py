from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Prefetch, Q

from apps.base.api import BaseViewSet
from apps.notification.models import Notification, NotificationMedia
from apps.notification.api.serializers import NotificationSerializer
from apps.notification.services.notification_service import send_notification



class NotificationViewSet(BaseViewSet):
    """
    ViewSet para la gestión de Notificaciones.
    - Lectura/Eliminación lógica: Restringido al usuario dueño de la notificación (o admin).
    - Optimización: prefetch_related con filtro is_deleted=False para evitar N+1 queries.
    """

    serializer_class = NotificationSerializer
    search_fields = [
        'title',
        'message',
        'user__first_name',
        'user__first_last_name',
        'user__username',
        'user__email',
        'order__order_number',
    ]
    ordering_fields = ['created_at', 'is_read', 'id', 'status', 'is_manual']
    ordering = ['-created_at', '-id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'destroy', 'mark_as_read', 'mark_all_as_read', 'unread_count', 'by_order']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        """
        Retorna notificaciones no eliminadas.
        - Por defecto filtra por el usuario autenticado (incluso para admins, para su panel personal).
        - Si es staff y se pasa ?all=true o ?user_id=X, permite consultar notificaciones globales.
        - Excluye media eliminada y órdenes eliminadas.
        """
        media_prefetch = Prefetch(
            'media_files',
            queryset=NotificationMedia.objects.filter(is_deleted=False)
        )
        queryset = Notification.objects.filter(
            is_deleted=False
        ).filter(
            Q(order__isnull=True) | Q(order__is_deleted=False)
        ).prefetch_related(media_prefetch).select_related('user', 'order', 'internal_order')

        # Filtro de usuario
        user_param = self.request.query_params.get('user_id')
        all_param = self.request.query_params.get('all')
        if self.request.user and self.request.user.is_staff and (all_param == 'true' or user_param):
            if user_param:
                queryset = queryset.filter(user_id=user_param)
        elif self.request.user and self.request.user.is_authenticated:
            queryset = queryset.filter(user=self.request.user)

        # Filtro is_manual (Manual / Automática)
        is_manual_param = self.request.query_params.get('is_manual')
        if is_manual_param is not None:
            if is_manual_param.lower() in ['true', '1', 'yes', 'manual']:
                queryset = queryset.filter(is_manual=True)
            elif is_manual_param.lower() in ['false', '0', 'no', 'auto', 'automatica', 'automática']:
                queryset = queryset.filter(is_manual=False)

        # Filtro status ('sent', 'pending', 'read')
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        is_read_param = self.request.query_params.get('is_read')
        if is_read_param is not None:
            is_read_bool = is_read_param.lower() in ['true', '1', 'yes', 'si']
            queryset = queryset.filter(is_read=is_read_bool)

        notification_type = self.request.query_params.get('notification_type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        order_id = self.request.query_params.get('order_id')
        if order_id:
            queryset = queryset.filter(order_id=order_id)

        internal_order_id = self.request.query_params.get('internal_order_id')
        if internal_order_id:
            queryset = queryset.filter(internal_order_id=internal_order_id)

        return queryset

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Retorna el número de notificaciones no leídas del usuario autenticado."""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread_count": count}, status=status.HTTP_200_OK)

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

    @action(detail=False, methods=['get'])
    def by_order(self, request):
        """
        Retorna pedidos agrupados con sus respectivas notificaciones para la vista de tabla 'Pedidos con notificaciones'.
        """
        from apps.orders.models import Order

        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip()
        type_filter = request.query_params.get('type', '').strip().lower()

        # Obtener IDs de pedidos con notificaciones
        notif_base = Notification.objects.filter(is_deleted=False, order__isnull=False)
        order_ids = list(notif_base.values_list('order_id', flat=True).distinct())

        orders_qs = Order.objects.filter(id__in=order_ids, is_deleted=False).select_related('user').order_by('-created_at')

        if search:
            clean_search = search.replace('#', '')
            orders_qs = orders_qs.filter(
                Q(order_number__icontains=search) |
                Q(id__icontains=clean_search) |
                Q(user__first_name__icontains=search) |
                Q(user__first_last_name__icontains=search) |
                Q(user__email__icontains=search)
            )

        media_prefetch = Prefetch(
            'media_files',
            queryset=NotificationMedia.objects.filter(is_deleted=False)
        )

        results = []
        for ord_obj in orders_qs:
            notifs_qs = ord_obj.notifications.filter(is_deleted=False).prefetch_related(media_prefetch).order_by('-created_at')

            if type_filter == 'manual':
                notifs_qs = notifs_qs.filter(is_manual=True)
            elif type_filter in ['auto', 'automatica', 'automática']:
                notifs_qs = notifs_qs.filter(is_manual=False)

            if status_filter:
                notifs_qs = notifs_qs.filter(status=status_filter)

            notifs_list = list(notifs_qs)
            if not notifs_list and (type_filter or status_filter):
                continue

            last_notif = notifs_list[0] if notifs_list else None
            client_name = ord_obj.user.get_full_name() or ord_obj.user.username if ord_obj.user else 'Cliente'
            client_email = ord_obj.user.email if ord_obj.user else ''
            ord_num = ord_obj.order_number or f"#{ord_obj.id:05d}"

            results.append({
                'order_id': ord_obj.id,
                'order_number': ord_num,
                'client_id': ord_obj.user_id,
                'client_name': client_name,
                'client_email': client_email,
                'total_price': float(ord_obj.total_price or 0),
                'order_status': ord_obj.status,
                'order_status_display': ord_obj.get_status_display(),
                'notifications_count': len(notifs_list),
                'last_notification': {
                    'id': last_notif.id if last_notif else None,
                    'title': last_notif.title if last_notif else '',
                    'created_at': str(last_notif.created_at) if last_notif else None,
                    'is_manual': last_notif.is_manual if last_notif else False,
                    'status': last_notif.status if last_notif else '',
                    'status_display': last_notif.get_status_display() if last_notif else '',
                } if last_notif else None,
                'notifications': NotificationSerializer(notifs_list, many=True).data,
            })

        return Response(results, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def create_manual(self, request):
        """
        Permite a un administrador redactar y enviar una notificación manual,
        opcionalmente vinculada a un pedido y con archivos adjuntos (imágenes o videos).
        """
        title = request.data.get('title')
        message = request.data.get('message')
        order_id = request.data.get('order_id')
        user_id = request.data.get('user_id')
        status_val = request.data.get('status', 'sent')

        if not title or not message:
            return Response(
                {"error": "El asunto (title) y el mensaje (message) son requeridos."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth import get_user_model
        from apps.orders.models import Order
        User = get_user_model()

        order_instance = None
        user_instance = None

        if order_id:
            try:
                order_instance = Order.objects.get(id=order_id, is_deleted=False)
                user_instance = order_instance.user
            except Order.DoesNotExist:
                return Response({"error": "El pedido especificado no existe."}, status=status.HTTP_404_NOT_FOUND)
        elif user_id:
            try:
                user_instance = User.objects.get(id=user_id, is_deleted=False)
            except User.DoesNotExist:
                return Response({"error": "El usuario especificado no existe."}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response(
                {"error": "Debe especificar un pedido (order_id) o un usuario (user_id)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Crear notificación manual
        notification = send_notification(
            user=user_instance,
            title=title,
            message=message,
            notification_type='order' if order_instance else 'general',
            order=order_instance,
            is_manual=True,
            status=status_val
        )

        # Procesar archivos adjuntos si se enviaron
        uploaded_files = request.FILES.getlist('files') or request.FILES.getlist('media') or []
        for f in uploaded_files:
            content_type = getattr(f, 'content_type', '')
            media_type = 'video' if 'video' in content_type else 'image'
            NotificationMedia.objects.create(
                notification=notification,
                file=f,
                media_type=media_type
            )

        serializer = self.get_serializer(notification)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """
        Permite a un administrador actualizar el asunto (title), mensaje y adjuntos de una notificación manual.
        """
        notification = self.get_object()
        title = request.data.get('title')
        message = request.data.get('message')

        if title:
            notification.title = title.strip()
        if message:
            notification.message = message.strip()
        notification.save()

        # Procesar eliminación de adjuntos si se indicaron IDs
        deleted_media_raw = request.data.getlist('deleted_media_ids') or request.data.get('deleted_media_ids')
        if deleted_media_raw:
            deleted_ids = []
            if isinstance(deleted_media_raw, list):
                for item in deleted_media_raw:
                    if isinstance(item, str) and ',' in item:
                        deleted_ids.extend([x.strip() for x in item.split(',') if x.strip()])
                    elif item:
                        deleted_ids.append(item)
            elif isinstance(deleted_media_raw, str):
                import json
                try:
                    parsed = json.loads(deleted_media_raw)
                    if isinstance(parsed, list):
                        deleted_ids = parsed
                    else:
                        deleted_ids = [deleted_media_raw]
                except Exception:
                    deleted_ids = [x.strip() for x in deleted_media_raw.split(',') if x.strip()]

            if deleted_ids:
                NotificationMedia.objects.filter(
                    id__in=deleted_ids,
                    notification=notification,
                    is_deleted=False
                ).update(is_deleted=True)

        # Procesar nuevos archivos adjuntos si se enviaron
        uploaded_files = request.FILES.getlist('files') or request.FILES.getlist('media') or []
        for f in uploaded_files:
            content_type = getattr(f, 'content_type', '')
            media_type = 'video' if 'video' in content_type else 'image'
            NotificationMedia.objects.create(
                notification=notification,
                file=f,
                media_type=media_type
            )

        serializer = self.get_serializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def send_broadcast(self, request):
        """
        Permite a un administrador enviar una notificación general a un usuario.
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
            notification_type='general',
            is_manual=True,
            status='sent'
        )

        serializer = self.get_serializer(notification)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
