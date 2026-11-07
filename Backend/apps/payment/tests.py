from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.orders.models import Order, OrderDetail, OrderProduct
from apps.product.models import Product, ProductType
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

    def test_total_payment_validations_and_instant_invoice_approval(self):
        """Verifica las validaciones de pago total/único y que al aprobarse avance a shipped y cree factura."""
        new_order = Order.objects.create(
            user=self.user,
            total_price=350.00,
            status='pending_initial_payment'
        )
        OrderDetail.objects.create(
            order=new_order,
            quantity=1,
            unit_price=350.00
        )

        self.client.force_authenticate(user=self.user)

        # 1. Pago total con monto insuficiente -> Debe fallar
        res_invalid = self.client.post('/api/payments/', {
            'order': new_order.id,
            'payment_stage': 'total',
            'amount': 200.00,
            'payment_method': 'transfer'
        }, format='json')
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('amount', res_invalid.data)

        # 2. Pago total con monto correcto (100%) -> Exitoso
        res_valid = self.client.post('/api/payments/', {
            'order': new_order.id,
            'payment_stage': 'total',
            'amount': 350.00,
            'payment_method': 'transfer'
        }, format='json')
        self.assertEqual(res_valid.status_code, status.HTTP_201_CREATED)
        payment_id = res_valid.data['id']

        new_order.refresh_from_db()
        self.assertEqual(new_order.status, 'initial_payment_review')

        # 3. Administrador aprueba el pago total -> Debe pasar a shipped y crear factura
        self.client.force_authenticate(user=self.admin_user)
        res_review = self.client.post(f'/api/payments/{payment_id}/review/', {'status': 'approved'}, format='json')
        self.assertEqual(res_review.status_code, status.HTTP_200_OK)

        new_order.refresh_from_db()
        self.assertEqual(new_order.status, 'manufacturing')

        # Comprobar factura generada
        invoice = Invoice.objects.filter(order=new_order).first()
        self.assertIsNotNone(invoice)
        self.assertEqual(float(invoice.total), 350.00)
