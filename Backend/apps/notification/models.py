from django.db import models
from django.contrib.auth import get_user_model

from apps.base.models import BaseModel

User = get_user_model()


class Notification(BaseModel):
    """
    Notificación del sistema enviada a un usuario.
    Las notificaciones se entregan en tiempo real vía WebSocket (Django Channels)
    y también quedan registradas en base de datos para su consulta posterior.
    """

    TYPE_CHOICES = [
        # Notificación vinculada a una orden (cubre pagos, envíos, fabricación, etc.)
        ('order', 'Pedido'),
        # Notificación general del sistema, sin orden asociada
        ('general', 'General'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name="Usuario"
    )
    title = models.CharField(
        'Título',
        max_length=255
    )
    message = models.TextField(
        'Mensaje'
    )
    notification_type = models.CharField(
        'Tipo',
        max_length=20,
        choices=TYPE_CHOICES,
        default='general'
    )
    is_read = models.BooleanField(
        'Fue leído',
        default=False
    )
    # FK directa a Order — obligatoria cuando notification_type='order', nula para notificaciones generales
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name="Pedido relacionado",
        help_text='Pedido que originó la notificación. Nulo solo en notificaciones generales.'
    )

    class Meta:
        verbose_name = 'Notificación'
        verbose_name_plural = 'Notificaciones'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_notification_type_display()}] {self.title} → {self.user.username}"

    def mark_as_read(self):
        """Marca la notificación como leída."""
        if not self.is_read:
            self.is_read = True
            self.save(update_fields=['is_read', 'updated_at'])


class NotificationMedia(BaseModel):
    """
    Archivo multimedia adjunto a una notificación (imagen o video).
    """

    MEDIA_TYPE_CHOICES = [
        ('image', 'Imagen'),
        ('video', 'Video'),
    ]

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name='media_files',
        verbose_name="Notificación"
    )
    file = models.FileField(
        'Archivo',
        upload_to='notifications/media/'
    )
    media_type = models.CharField(
        'Tipo de media',
        max_length=10,
        choices=MEDIA_TYPE_CHOICES
    )

    class Meta:
        verbose_name = 'Media de notificación'
        verbose_name_plural = 'Media de notificaciones'

    def __str__(self):
        return f"{self.get_media_type_display()} — Notificación #{self.notification.id}"
