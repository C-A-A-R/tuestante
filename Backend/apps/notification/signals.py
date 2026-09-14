"""
Signals de Django para auto-generar notificaciones cuando cambia
el estado de un Pedido, se actualiza un Pago o cambia el estado de un Envío.

Todas las notificaciones son de tipo 'order' (vinculadas a un pedido)
o 'general' (sin pedido asociado).

Conectados en NotificationConfig.ready() para garantizar que
se registran al arrancar el servidor.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver


# ─────────────────────────────────────────────
# Señales de Pedido (Order)
# ─────────────────────────────────────────────

@receiver(post_save, sender='orders.Order')
def on_order_status_change(sender, instance, created, **kwargs):
    """
    Envía una notificación al cliente cuando el estado de su pedido cambia,
    y alerta a los administradores cuando se registra un nuevo pedido o pago en revisión.
    """
    from apps.notification.services.notification_service import send_notification, send_notification_to_admins

    if created:
        send_notification(
            user=instance.user,
            title="Pedido registrado",
            message=(
                f"Tu pedido #{instance.id} ha sido registrado exitosamente. "
                "Por favor, procede con el pago inicial."
            ),
            notification_type='order',
            order=instance,
        )

        # Notificar a los administradores
        client_name = instance.user.get_full_name() or instance.user.username if instance.user else "Cliente"
        total = getattr(instance, 'total_price', getattr(instance, 'total_amount', 0))
        send_notification_to_admins(
            title=f"Nuevo Pedido Cliente #{instance.id}",
            message=f"El cliente {client_name} ha creado el pedido #{instance.id} por un monto de ${total}.",
            notification_type='order',
            order=instance,
        )
        return

    # Mensajes según el nuevo estado
    STATUS_MESSAGES = {
        'initial_payment_review': (
            "Pago inicial recibido",
            f"Tu pago inicial del pedido #{instance.id} está siendo revisado por nuestro equipo.",
        ),
        'manufacturing': (
            "Pedido en fabricación",
            f"¡Tu pedido #{instance.id} ha entrado en producción! "
            "Te notificaremos cuando esté listo.",
        ),
        'waiting_final_payment': (
            "Producto listo — Pago final requerido",
            f"Tu pedido #{instance.id} está fabricado y listo. "
            "Por favor, realiza el pago final para coordinar el envío.",
        ),
        'final_payment_review': (
            "Pago final recibido",
            f"Tu pago final del pedido #{instance.id} está siendo verificado.",
        ),
        'shipped': (
            "Pedido enviado",
            f"Tu pedido #{instance.id} ha sido enviado. "
            "Pronto recibirás más información sobre la entrega.",
        ),
        'finalized': (
            "Pedido entregado — ¡Gracias!",
            f"Tu pedido #{instance.id} ha sido marcado como entregado. "
            "Gracias por tu compra.",
        ),
        'returned_manufacturing': (
            "Pedido en refabricación",
            f"Tu pedido #{instance.id} ha sido devuelto y estamos fabricando "
            "un nuevo producto. Te mantendremos informado.",
        ),
        'cancelled': (
            "Pedido cancelado",
            f"Tu pedido #{instance.id} ha sido cancelado. "
            "Contacta con nosotros si tienes alguna pregunta.",
        ),
    }

    if instance.status in STATUS_MESSAGES:
        title, message = STATUS_MESSAGES[instance.status]
        send_notification(
            user=instance.user,
            title=title,
            message=message,
            notification_type='order',
            order=instance,
        )

        # Notificar a los administradores si entra en revisión de pago
        if instance.status in ('initial_payment_review', 'final_payment_review'):
            stage_name = "Pago inicial" if instance.status == 'initial_payment_review' else "Pago final"
            send_notification_to_admins(
                title=f"{stage_name} por verificar en Pedido #{instance.id}",
                message=f"El pedido #{instance.id} tiene un {stage_name.lower()} reportado y pendiente de revisión.",
                notification_type='order',
                order=instance,
            )


# ─────────────────────────────────────────────
# Señales de Pago (Payment)
# ─────────────────────────────────────────────

@receiver(post_save, sender='payment.Payment')
def on_payment_status_change(sender, instance, created, **kwargs):
    """
    Notifica al cliente cuando su pago es aprobado o rechazado por el admin,
    y alerta a los administradores cuando un pago es registrado.
    """
    from apps.notification.services.notification_service import send_notification, send_notification_to_admins

    if created:
        stage_label = instance.get_payment_stage_display() if hasattr(instance, 'get_payment_stage_display') else "Pago"
        order_id = instance.order_id or getattr(instance.order, 'id', '')
        send_notification_to_admins(
            title=f"Nuevo Pago Registrado (Pedido #{order_id})",
            message=f"Se ha registrado un {stage_label.lower()} por ${instance.amount} para el pedido #{order_id}. Requiere verificación.",
            notification_type='order',
            order=instance.order,
        )
        return

    stage_label = instance.get_payment_stage_display()

    if instance.status == 'approved':
        send_notification(
            user=instance.order.user,
            title=f"{stage_label} aprobado",
            message=(
                f"Tu {stage_label.lower()} del pedido #{instance.order.id} "
                "ha sido aprobado. El proceso continúa."
            ),
            notification_type='order',
            order=instance.order,
        )
    elif instance.status == 'rejected':
        reason = instance.rejection_reason or "Sin motivo especificado."
        send_notification(
            user=instance.order.user,
            title=f"{stage_label} rechazado",
            message=(
                f"Tu {stage_label.lower()} del pedido #{instance.order.id} "
                f"fue rechazado. Motivo: {reason}"
            ),
            notification_type='order',
            order=instance.order,
        )


# ─────────────────────────────────────────────
# Señales de Envío (Shipment)
# ─────────────────────────────────────────────

@receiver(post_save, sender='shipment.Shipment')
def on_shipment_status_change(sender, instance, created, **kwargs):
    """
    Notifica al cliente sobre cambios en el estado de su envío.
    La notificación es de tipo 'order' porque el envío está vinculado a un pedido.
    """
    from apps.notification.services.notification_service import send_notification

    if created:
        return

    STATUS_MESSAGES = {
        'in_transit': (
            "Tu pedido está en camino",
            f"Tu pedido #{instance.order.id} ha sido entregado al distribuidor "
            "y está en camino hacia ti.",
        ),
        'delivered': (
            "Pedido entregado",
            f"Tu pedido #{instance.order.id} ha sido entregado. "
            "Por favor, confírmanos la recepción.",
        ),
        'returned': (
            "Envío devuelto",
            f"El envío de tu pedido #{instance.order.id} fue devuelto. "
            "Nuestro equipo se pondrá en contacto contigo.",
        ),
    }

    if instance.status in STATUS_MESSAGES:
        title, message = STATUS_MESSAGES[instance.status]
        send_notification(
            user=instance.order.user,
            title=title,
            message=message,
            notification_type='order',
            order=instance.order,
        )

