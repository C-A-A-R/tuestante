from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderDetail, OrderProduct
from apps.product.models import Product, ProductType, Category
from apps.payment.models import Payment
from apps.invoice.models import Invoice

User = get_user_model()


class PaymentAndInvoiceAutomationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='cliente_test',
            first_name='Carlos',
            first_last_name='Aragoza',
            identity_document='V-12345678',
            email='carlos@example.com',
            password='password123'
        )
        self.admin_user = User.objects.create_superuser(
            username='admin_test',
            email='admin@example.com',
            password='adminpassword123'
        )

        self.category = Category.objects.create(category_name='Oficina')
        self.product_type = ProductType.objects.create(product_type_name='Muebles')
        self.product = Product.objects.create(
            product_name='Escritorio Gamer',
            product_type=self.product_type,
            price=200.00
        )

        self.order = Order.objects.create(
            user=self.user,
            total_price=200.00,
            status='waiting_final_payment'
        )
        self.detail = OrderDetail.objects.create(
            order=self.order,
            quantity=1,
            unit_price=200.00,
            notes='Acabado negro mate'
        )
        self.order_product = OrderProduct.objects.create(
            order_detail=self.detail,
            product=self.product,
            price_at_order=200.00
        )

        self.client = APIClient()

    def test_approve_initial_payment_does_not_create_invoice(self):
        """Verifica que aprobar el pago inicial avance el pedido a fabricación sin crear factura."""
        self.client.force_authenticate(user=self.admin_user)

        payment = Payment.objects.create(
            order=self.order,
            payment_stage='initial',
            amount=100.00,
            status='pending'
        )

        response = self.client.post(
            f'/api/payments/{payment.id}/review/',
            {'status': 'approved'},
            format='json'
        )
        self.assertEqual(response.status_code, 200)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'manufacturing')
        self.assertFalse(Invoice.objects.filter(order=self.order).exists())

    def test_approve_final_payment_creates_invoice_automatically(self):
        """Verifica que aprobar el pago final cree automáticamente la factura en la base de datos y su PDF."""
        self.client.force_authenticate(user=self.admin_user)

        payment = Payment.objects.create(
            order=self.order,
            payment_stage='final',
            amount=100.00,
            status='pending'
        )

        response = self.client.post(
            f'/api/payments/{payment.id}/review/',
            {'status': 'approved'},
            format='json'
        )
        self.assertEqual(response.status_code, 200)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'shipped')

        # Verificar que la factura se creó automáticamente
        invoice = Invoice.objects.filter(order=self.order).first()
        self.assertIsNotNone(invoice)
        self.assertEqual(invoice.customer_name, 'Carlos Aragoza')
        self.assertEqual(invoice.customer_tax_id, 'V-12345678')
        self.assertEqual(invoice.customer_email, 'carlos@example.com')
        self.assertEqual(float(invoice.total), 200.00)
        self.assertTrue(invoice.invoice_number.startswith('FAC-'))
        self.assertEqual(len(invoice.items_snapshot), 1)
        self.assertEqual(invoice.items_snapshot[0]['name'], 'Escritorio Gamer')
        self.assertTrue(bool(invoice.pdf_file))
