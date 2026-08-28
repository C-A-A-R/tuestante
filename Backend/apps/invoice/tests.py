import re
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.invoice.models import Invoice
from apps.invoice.utils import generate_invoice_number
from apps.invoice.services import generate_invoice_pdf

User = get_user_model()


class InvoiceModelAndAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='client1',
            email='client1@example.com',
            password='password123'
        )
        self.other_user = User.objects.create_user(
            username='client2',
            email='client2@example.com',
            password='password123'
        )
        self.admin_user = User.objects.create_superuser(
            username='adminuser',
            email='admin@example.com',
            password='adminpassword123'
        )

        self.order = Order.objects.create(
            user=self.user,
            total_price=250.00
        )
        self.other_order = Order.objects.create(
            user=self.other_user,
            total_price=400.00
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_generate_invoice_number_format(self):
        """Verifica que el número de factura siga el formato FAC-nnnn-año."""
        year = timezone.now().year
        inv_num1 = generate_invoice_number()
        pattern = rf'^FAC-\d{{4}}-{year}$'
        self.assertTrue(re.match(pattern, inv_num1))

    def test_invoice_creation_and_auto_number(self):
        """Verifica la creación del modelo Invoice y asignación automática del número."""
        invoice = Invoice.objects.create(
            order=self.order,
            customer_name='Empresa ABC, C.A.',
            customer_tax_id='J-12345678-0',
            customer_email='contacto@empresaabc.com',
            billing_address='Av. Bolívar, Edificio Centro, Piso 3',
            subtotal=250.00,
            discount_amount=0.00,
            total=250.00,
            items_snapshot=[
                {'name': 'Estante Ejecutivo', 'quantity': 1, 'unit_price': 250.00}
            ]
        )

        self.assertIsNotNone(invoice.invoice_number)
        self.assertTrue(invoice.invoice_number.startswith('FAC-'))
        self.assertEqual(invoice.customer_name, 'Empresa ABC, C.A.')

    def test_invoice_pdf_generation_service(self):
        """Verifica el servicio de generación de PDF."""
        invoice = Invoice.objects.create(
            order=self.order,
            customer_name='Juan Pérez',
            customer_tax_id='V-12345678',
            customer_email='juan@example.com',
            billing_address='Calle Principal #45',
            subtotal=250.00,
            discount_amount=10.00,
            total=240.00,
            items_snapshot=[
                {'name': 'Mesa Lateral', 'quantity': 2, 'unit_price': 125.00}
            ]
        )

        pdf_file = generate_invoice_pdf(invoice)
        invoice.save()

        self.assertTrue(bool(invoice.pdf_file))
        self.assertTrue(invoice.pdf_file.name.endswith('.pdf'))

    def test_invoice_api_list_and_retrieve_authenticated_user(self):
        """Verifica que el usuario sólo pueda listar sus propias facturas vía GET."""
        invoice1 = Invoice.objects.create(
            order=self.order,
            customer_name='Juan Pérez',
            customer_tax_id='V-12345678',
            customer_email='juan@example.com',
            billing_address='Calle Principal #45',
            subtotal=250.00,
            total=250.00,
            items_snapshot=[]
        )
        invoice2 = Invoice.objects.create(
            order=self.other_order,
            customer_name='Pedro Gómez',
            customer_tax_id='V-87654321',
            customer_email='pedro@example.com',
            billing_address='Av. 2 #10',
            subtotal=400.00,
            total=400.00,
            items_snapshot=[]
        )

        # GET List
        response = self.client.get('/api/invoices/')
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], invoice1.id)

        # GET Retrieve propio
        detail_response = self.client.get(f'/api/invoices/{invoice1.id}/')
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data['invoice_number'], invoice1.invoice_number)

        # GET Retrieve de otro usuario debe dar 404
        forbidden_response = self.client.get(f'/api/invoices/{invoice2.id}/')
        self.assertEqual(forbidden_response.status_code, 404)

    def test_invoice_api_only_supports_get(self):
        """Verifica que las peticiones POST, PUT, PATCH, DELETE retornen 405 Method Not Allowed."""
        payload = {
            "customer_name": "Test",
            "total": 100.00
        }

        post_res = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(post_res.status_code, 405)

        invoice = Invoice.objects.create(
            order=self.order,
            customer_name='Juan Pérez',
            customer_tax_id='V-12345678',
            customer_email='juan@example.com',
            billing_address='Calle Principal #45',
            subtotal=250.00,
            total=250.00,
            items_snapshot=[]
        )

        put_res = self.client.put(f'/api/invoices/{invoice.id}/', payload, format='json')
        self.assertEqual(put_res.status_code, 405)

        patch_res = self.client.patch(f'/api/invoices/{invoice.id}/', payload, format='json')
        self.assertEqual(patch_res.status_code, 405)

        delete_res = self.client.delete(f'/api/invoices/{invoice.id}/')
        self.assertEqual(delete_res.status_code, 405)

    def test_invoice_api_download_pdf(self):
        """Verifica la acción de descarga directa de PDF de la factura."""
        invoice = Invoice.objects.create(
            order=self.order,
            customer_name='Juan Pérez',
            customer_tax_id='V-12345678',
            customer_email='juan@example.com',
            billing_address='Calle Principal #45',
            subtotal=250.00,
            total=250.00,
            items_snapshot=[{'name': 'Producto 1', 'quantity': 1, 'unit_price': 250.00}]
        )

        response = self.client.get(f'/api/invoices/{invoice.id}/download_pdf/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
