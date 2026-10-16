"""
Signals para generación automática de notificaciones en la Tienda de Empleados.
Notifica al usuario asociado al perfil de empleado ante:
1. Creación de un pedido interno (InternalOrder).
2. Cambio de estado de una orden interna (DELIVERED, CANCELLED, PAID).
3. Registro de un abono o deducción de nómina (DebtPayment).
"""

from django.db.models.signals import post_save, post_init
from django.dispatch import receiver
from apps.employee_store.models import InternalOrder, DebtPayment


@receiver(post_init, sender=InternalOrder)
def remember_order_initial_status(sender, instance, **kwargs):
    """Guarda el estado inicial del pedido al cargarse de la BD para detectar transiciones."""
    instance._initial_status = instance.status


@receiver(post_save, sender=InternalOrder)
def on_internal_order_change(sender, instance, created, **kwargs):
    """Notifica al empleado y a los administradores ante la creación o cambio de estado de un pedido interno."""
    from apps.notification.services.notification_service import send_notification, send_notification_to_admins

    # Notificar a los administradores ante un nuevo pedido interno
    if created:
        emp_name = getattr(instance.employee, 'full_name', None) or (
            instance.employee.user.get_full_name() if instance.employee and getattr(instance.employee, 'user', None) else None
        ) or "Empleado"
        send_notification_to_admins(
            title=f"Nuevo Pedido Empleado #{instance.order_number}",
            message=f"El empleado {emp_name} ha realizado el pedido #{instance.order_number} por un monto de ${instance.total_amount}.",
            notification_type='employee_order',
            internal_order=instance,
        )

    # Obtener el usuario Django del empleado para notificarle personalmente
    user = getattr(instance.employee, 'user', None)
    if not user:
        return

    if created:
        send_notification(
            user=user,
            title="Pedido Registrado",
            message=(
                f"Tu pedido #{instance.order_number} por un monto de ${instance.total_amount} "
                "ha sido registrado con éxito en la tienda de empleados."
            ),
            notification_type='employee_order',
            internal_order=instance,
        )
        return

    # Verificar si hubo cambio de estado
    initial_status = getattr(instance, '_initial_status', None)
    if initial_status == instance.status:
        return

    # Actualizar estado recordado
    instance._initial_status = instance.status

    STATUS_MESSAGES = {
        'DELIVERED': (
            "Pedido Entregado",
            f"Tu pedido #{instance.order_number} ha sido despachado y entregado. "
            "Los consumos correspondientes se reflejarán en tu estado de cuenta.",
        ),
        'CANCELLED': (
            "Pedido Cancelado",
            f"Tu pedido #{instance.order_number} ha sido cancelado y las existencias han retornado al almacén.",
        ),
        'PAID': (
            "Pedido Pagado",
            f"Tu pedido #{instance.order_number} por un monto de ${instance.total_amount} "
            "ha sido liquidado y marcado como pagado.",
        ),
    }

    if instance.status in STATUS_MESSAGES:
        title, message = STATUS_MESSAGES[instance.status]
        send_notification(
            user=user,
            title=title,
            message=message,
            notification_type='employee_order',
            internal_order=instance,
        )


@receiver(post_save, sender=DebtPayment)
def on_debt_payment_created(sender, instance, created, **kwargs):
    """Notifica al empleado y a administradores cuando se registra un abono o deducción de nómina y sincroniza el estado de sus órdenes."""
    if not created:
        return

    from apps.employee_store.services import sync_employee_orders_paid_status
    from apps.notification.services.notification_service import send_notification, send_notification_to_admins

    # Si el abono está asociado a una orden específica, marcar esa orden como PAID
    if instance.order and instance.order.status != 'PAID':
        instance.order.status = 'PAID'
        instance.order.save(update_fields=['status', 'updated_at'])

    # Sincronizar órdenes acumuladas (FIFO)
    sync_employee_orders_paid_status(instance.employee)

    emp_name = getattr(instance.employee, 'full_name', None) or (
        instance.employee.user.get_full_name() if instance.employee and getattr(instance.employee, 'user', None) else None
    ) or "Empleado"
    tipo_display = instance.get_payment_type_display() if hasattr(instance, 'get_payment_type_display') else 'Abono'

    # Notificar a los administradores
    send_notification_to_admins(
        title=f"Abono de Empleado Registrado ({emp_name})",
        message=f"Se ha registrado un abono de ${instance.amount} ({tipo_display}) a la cuenta de {emp_name}.",
        notification_type='payroll',
        internal_order=instance.order,
    )

    user = getattr(instance.employee, 'user', None)
    if not user:
        return

    send_notification(
        user=user,
        title="Abono a tu Cuenta Registrado",
        message=(
            f"Se ha registrado un abono de ${instance.amount} ({tipo_display}) a tu estado de cuenta. "
            "Tu saldo deudor ha sido actualizado."
        ),
        notification_type='payroll',
    )
