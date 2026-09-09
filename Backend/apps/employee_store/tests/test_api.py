from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.employee_store.models import (
    EmployeeProfile,
    InternalCategory,
    InternalProduct,
    InternalOrder,
    DebtPayment,
)

User = get_user_model()


class EmployeeStoreAPITestCase(APITestCase):
    def setUp(self):
        # Admin / Staff user
        self.admin = User.objects.create_superuser(
            username='admin_pos',
            email='admin_pos@example.com',
            password='AdminPass123!',
            first_name='Admin',
            first_last_name='POS'
        )
        refresh = RefreshToken.for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

        # Regular employee user
        self.worker_user = User.objects.create_user(
            username='worker_01',
            email='worker@example.com',
            password='WorkerPass123!',
            first_name='Carlos',
            first_last_name='Gomez'
        )
        self.employee = EmployeeProfile.objects.create(
            user=self.worker_user,
            employee_number='EMP-100',
            department='Armado',
            position='Operador',
            salary=Decimal('450.00')
        )

        # Products
        self.category = InternalCategory.objects.create(name='Snacks')
        self.product = InternalProduct.objects.create(
            category=self.category,
            barcode='999000111',
            name='Jugo de Naranja',
            price=Decimal('2.50'),
            stock=15,
            weekly_limit_per_employee=5
        )

    def test_product_search_by_barcode(self):
        """Búsqueda rápida de producto por lector de código de barras."""
        url = f'/api/employee-store/products/?barcode={self.product.barcode}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that result list contains our product
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['barcode'], self.product.barcode)
        self.assertEqual(results[0]['name'], 'Jugo de Naranja')

    def test_order_creation_endpoint(self):
        """Registro y despacho de consumo interno vía POST /orders/."""
        url = '/api/employee-store/orders/'
        payload = {
            'employee_id': self.employee.id,
            'items': [
                {
                    'barcode': self.product.barcode,
                    'quantity': 2
                }
            ],
            'notes': 'Despacho rápido POS'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['employee_number'], 'EMP-100')
        self.assertEqual(Decimal(str(response.data['total_amount'])), Decimal('5.00'))
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(response.data['items'][0]['quantity'], 2)
        self.assertEqual(Decimal(str(response.data['items'][0]['unit_price'])), Decimal('2.50'))

        # Validar descuento de stock
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 13)

    def test_employee_statement_endpoint(self):
        """Consulta del estado de cuenta de un empleado con compras y abonos."""
        # Crear orden
        order_url = '/api/employee-store/orders/'
        self.client.post(order_url, {
            'employee_id': self.employee.id,
            'items': [{'barcode': self.product.barcode, 'quantity': 1}]
        }, format='json')

        # Consultar statement
        url = f'/api/employee-store/employees/{self.employee.id}/statement/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(response.data['current_debt'])), Decimal('2.50'))
        self.assertEqual(len(response.data['orders']), 1)
        self.assertEqual(len(response.data['payments']), 0)

    def test_payment_registration_endpoint(self):
        """Registro inmediato de abono o descuento de nómina asignando registered_by = request.user."""
        url = '/api/employee-store/payments/'
        payload = {
            'employee': self.employee.id,
            'amount': '25.00',
            'payment_type': 'PAYROLL_DEDUCTION',
            'reference': 'NOM-Q1-2026',
            'notes': 'Descuento aplicado en primera quincena'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['employee_number'], 'EMP-100')
        self.assertEqual(Decimal(str(response.data['amount'])), Decimal('25.00'))

        payment = DebtPayment.objects.get(id=response.data['id'])
        self.assertEqual(payment.registered_by, self.admin)

    def test_settlement_report_endpoint(self):
        """Generación de reporte de liquidación / corte para Recursos Humanos."""
        today = timezone.now().date().strftime('%Y-%m-%d')
        url = f'/api/employee-store/reports/settlement/?start_date={today}&end_date={today}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_employees', response.data)
        self.assertIn('grand_orders_total', response.data)
        self.assertIn('data', response.data)

    def test_order_status_lifecycle(self):
        """Validar los estados Sin entregar, Entregado, Pagado y Cancelado."""
        url = '/api/employee-store/orders/'
        payload = {
            'employee_id': self.employee.id,
            'items': [{'barcode': self.product.barcode, 'quantity': 1}],
            'status': 'UNDELIVERED',
            'notes': 'Pedido web online'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.data['id']
        self.assertEqual(response.data['status'], 'UNDELIVERED')

        # 1. Cambiar a DELIVERED (Entregado)
        detail_url = f'/api/employee-store/orders/{order_id}/'
        res_deliv = self.client.patch(detail_url, {'status': 'DELIVERED'}, format='json')
        self.assertEqual(res_deliv.status_code, status.HTTP_200_OK)
        self.assertEqual(res_deliv.data['status'], 'DELIVERED')

        # 2. Cambiar a PAID (Pagado)
        res_paid = self.client.patch(detail_url, {'status': 'PAID'}, format='json')
        self.assertEqual(res_paid.status_code, status.HTTP_200_OK)
        self.assertEqual(res_paid.data['status'], 'PAID')

        # 3. Intentar anular una orden ya finalizada (PAID) debe ser rechazado con 400
        res_cancel_finalized = self.client.patch(detail_url, {'status': 'CANCELLED'}, format='json')
        self.assertEqual(res_cancel_finalized.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Crear una nueva orden en estado UNDELIVERED para validar anulación y reversión de inventario
        res_order2 = self.client.post(url, payload, format='json')
        self.assertEqual(res_order2.status_code, status.HTTP_201_CREATED)
        order2_id = res_order2.data['id']
        self.product.refresh_from_db()
        stock_before_cancel = self.product.stock

        # Cancelar la orden UNDELIVERED debe retornar 200 y revertir inventario
        detail_url2 = f'/api/employee-store/orders/{order2_id}/'
        res_cancel = self.client.patch(detail_url2, {'status': 'CANCELLED'}, format='json')
        self.assertEqual(res_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cancel.data['status'], 'CANCELLED')

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, stock_before_cancel + 1)


