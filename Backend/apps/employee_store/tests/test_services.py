from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.employee_store.models import (
    EmployeeProfile,
    InternalCategory,
    InternalProduct,
    InternalOrder,
    InternalOrderItem,
    DebtPayment,
)
from apps.notification.models import Notification
from apps.employee_store.services import (
    checkout_internal_order,
    has_overdue_weekly_debt,
    calculate_employee_debt,
    validate_weekly_limit,
)

User = get_user_model()


class EmployeeStoreServicesTestCase(TestCase):
    def setUp(self):
        # Crear usuario para empleado
        self.user = User.objects.create_user(
            username='emp001',
            email='emp001@example.com',
            password='Password123!',
            first_name='Juan',
            first_last_name='Perez'
        )
        self.employee = EmployeeProfile.objects.create(
            user=self.user,
            employee_number='EMP-001',
            department='Producción',
            position='Soldador',
            salary=Decimal('500.00')
        )

        # Crear usuario administrador
        self.admin_user = User.objects.create_superuser(
            username='admin_store',
            email='admin@example.com',
            password='AdminPassword123!',
            first_name='Admin',
            first_last_name='Store'
        )

        # Categoría y productos
        self.category = InternalCategory.objects.create(
            name='Snacks y Bebidas',
            description='Alimentos y bebidas'
        )
        self.product1 = InternalProduct.objects.create(
            category=self.category,
            barcode='75010001',
            name='Refresco 500ml',
            price=Decimal('1.50'),
            stock=20,
            weekly_limit_per_employee=3
        )
        self.product2 = InternalProduct.objects.create(
            category=self.category,
            barcode='75010002',
            name='Galletas',
            price=Decimal('1.00'),
            stock=5,
            weekly_limit_per_employee=0  # Sin límite
        )

    def test_weekly_limit_validation(self):
        """Intento de compra superando el límite semanal en 7 días debe lanzar ValidationError."""
        # 1. Comprar 2 refrescos (límite es 3)
        order1 = checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product1.barcode, 'quantity': 2}],
            user=self.admin_user
        )
        self.assertEqual(order1.items.first().quantity, 2)

        # 2. Intentar comprar 2 refrescos más (2 + 2 = 4 > 3)
        with self.assertRaises(ValidationError) as ctx:
            checkout_internal_order(
                employee=self.employee,
                items_data=[{'barcode': self.product1.barcode, 'quantity': 2}],
                user=self.admin_user
            )
        self.assertIn("límite semanal", str(ctx.exception).lower())

        # 3. Comprar exactamente 1 refresco (2 + 1 = 3 == límite) debe permitirse
        order2 = checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product1.barcode, 'quantity': 1}],
            user=self.admin_user
        )
        self.assertEqual(order2.items.first().quantity, 1)

        # 4. Con is_admin_override=True, el administrador puede exceder el límite semanal
        order_override = checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product1.barcode, 'quantity': 5}],
            user=self.admin_user,
            is_admin_override=True
        )
        self.assertIsNotNone(order_override)
        self.assertEqual(order_override.items.first().quantity, 5)

    def test_concurrency_and_insufficient_stock(self):
        """Fallo si el stock físico no es suficiente y comprobación de integridad del stock."""
        # Intentar comprar 10 galletas cuando solo hay 5
        with self.assertRaises(ValidationError) as ctx:
            checkout_internal_order(
                employee=self.employee,
                items_data=[{'barcode': self.product2.barcode, 'quantity': 10}],
                user=self.admin_user
            )
        self.assertIn("stock insuficiente", str(ctx.exception).lower())

        # Verificar que el stock no fue alterado
        self.product2.refresh_from_db()
        self.assertEqual(self.product2.stock, 5)

    def test_current_debt_calculation(self):
        """Precisión matemática de current_debt tras órdenes y abonos parciales."""
        self.assertEqual(self.employee.current_debt, Decimal('0.00'))

        # Orden 1: 2 refrescos = $3.00
        checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product1.barcode, 'quantity': 2}],
            user=self.admin_user
        )
        self.assertEqual(self.employee.current_debt, Decimal('3.00'))

        # Orden 2: 2 galletas = $2.00 -> Deuda total = $5.00
        checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product2.barcode, 'quantity': 2}],
            user=self.admin_user
        )
        self.assertEqual(self.employee.current_debt, Decimal('5.00'))

        # Abono parcial de $2.00 -> Deuda restante = $3.00
        DebtPayment.objects.create(
            employee=self.employee,
            amount=Decimal('2.00'),
            payment_type='CASH',
            registered_by=self.admin_user
        )
        self.assertEqual(self.employee.current_debt, Decimal('3.00'))

        # Abono total de $3.00 -> Deuda restante = $0.00
        DebtPayment.objects.create(
            employee=self.employee,
            amount=Decimal('3.00'),
            payment_type='PAYROLL_DEDUCTION',
            registered_by=self.admin_user
        )
        self.assertEqual(self.employee.current_debt, Decimal('0.00'))

    def test_price_immutability(self):
        """Modificar el precio de un InternalProduct no altera el subtotal de órdenes previas."""
        # Comprar 2 galletas a $1.00 = $2.00
        order = checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product2.barcode, 'quantity': 2}],
            user=self.admin_user
        )
        self.assertEqual(order.total_amount, Decimal('2.00'))
        item = order.items.first()
        self.assertEqual(item.unit_price, Decimal('1.00'))

        # Aumentar precio del producto a $5.00
        self.product2.price = Decimal('5.00')
        self.product2.save()

        # Comprobar que la orden histórica mantiene $2.00 y su unit_price es $1.00
        order.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(order.total_amount, Decimal('2.00'))
        self.assertEqual(item.unit_price, Decimal('1.00'))

    def test_overdue_debt_rule_and_admin_override(self):
        """
        Un trabajador no puede comprar si tiene deuda acarreada de la semana pasada,
        pero un administrador sí puede registrarle compras aún con pagos atrasados.
        """
        # Crear orden antigua generada hace 14 días (semana anterior)
        old_date = timezone.now().date() - timedelta(days=14)
        old_order = InternalOrder.objects.create(
            employee=self.employee,
            order_number='ORD-OLD-001',
            total_amount=Decimal('15.00'),
            status='COMPLETED',
            created_by=self.admin_user
        )
        # Forzar created_at a fecha antigua
        InternalOrder.objects.filter(id=old_order.id).update(created_at=old_date)

        # 1. El trabajador intenta comprar sin override -> debe ser bloqueado
        with self.assertRaises(ValidationError) as ctx:
            checkout_internal_order(
                employee=self.employee,
                items_data=[{'barcode': self.product2.barcode, 'quantity': 1}],
                user=self.user,
                is_admin_override=False
            )
        self.assertIn("semanas anteriores", str(ctx.exception).lower())

        # 2. El administrador registra la compra con override -> debe permitirse
        admin_order = checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product2.barcode, 'quantity': 1}],
            user=self.admin_user,
            is_admin_override=True
        )
        self.assertIsNotNone(admin_order)

        # 3. El empleado liquida la deuda vieja con un abono de $15.00
        DebtPayment.objects.create(
            employee=self.employee,
            amount=Decimal('15.00'),
            payment_type='PAYROLL_DEDUCTION',
            registered_by=self.admin_user
        )

        # 4. Ahora el trabajador ya no tiene deuda anterior bloqueante y puede comprar
        worker_order = checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product2.barcode, 'quantity': 1}],
            user=self.user,
            is_admin_override=False
        )
        self.assertIsNotNone(worker_order)

    def test_employee_store_notification_signals(self):
        """Verificar que la creación y cambios de estado de orden interna y pagos generen notificaciones."""
        # 1. Crear una orden
        order = checkout_internal_order(
            employee=self.employee,
            items_data=[{'barcode': self.product1.barcode, 'quantity': 1}],
            user=self.user,
        )
        # Debe haberse creado una notificación de tipo employee_order
        notif_order = Notification.objects.filter(
            user=self.user,
            internal_order=order,
            notification_type='employee_order'
        ).first()
        self.assertIsNotNone(notif_order)
        self.assertIn("Pedido Registrado", notif_order.title)
        self.assertFalse(notif_order.is_read)

        # 2. Cambiar estado a DELIVERED
        order.status = 'DELIVERED'
        order.save()
        notif_delivered = Notification.objects.filter(
            user=self.user,
            internal_order=order,
            title__icontains="Entregado"
        ).first()
        self.assertIsNotNone(notif_delivered)

        # 3. Registrar abono de nómina
        DebtPayment.objects.create(
            employee=self.employee,
            amount=Decimal('10.00'),
            payment_type='PAYROLL_DEDUCTION',
            registered_by=self.admin_user
        )
        notif_payment = Notification.objects.filter(
            user=self.user,
            notification_type='payroll'
        ).first()
        self.assertIsNotNone(notif_payment)
        self.assertIn("Abono", notif_payment.title)
