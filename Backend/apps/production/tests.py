from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.orders.models import Order, OrderDetail, OrderProduct
from apps.product.models import Product, ProductType
from apps.production.models import ProductionOrder

User = get_user_model()


class ProductionOrderTests(TestCase):
    """Suite de pruebas para la aplicación de Producción (ProductionOrder)."""

    def setUp(self):
        self.client = APIClient()

        # Usuario Cliente
        self.customer = User.objects.create_user(
            username='cliente_prod',
            email='cliente_prod@example.com',
            password='Password123!',
            first_name='Cliente',
            first_last_name='Produccion',
            is_active=True
        )

        # Otro Cliente
        self.other_customer = User.objects.create_user(
            username='otro_cliente',
            email='otro_cliente@example.com',
            password='Password123!',
            first_name='Otro',
            first_last_name='Cliente',
            is_active=True
        )

        # Administrador
        self.admin = User.objects.create_superuser(
            username='admin_prod',
            email='admin_prod@example.com',
            password='AdminPassword123!',
            first_name='Admin',
            first_last_name='Taller'
        )

        # Tipo de Producto y Producto
        self.product_type = ProductType.objects.create(product_type_name='Estante Modular')
        self.product = Product.objects.create(
            product_name='Estante Roble',
            product_type=self.product_type,
            price=150.00
        )

        # Pedido 1 (del cliente)
        self.order = Order.objects.create(
            user=self.customer,
            order_number='ORD-0001-2026',
            status='manufacturing',
            total_price=300.00
        )
        self.order_detail = OrderDetail.objects.create(
            order=self.order,
            quantity=2,
            unit_price=150.00,
            final_price=300.00,
            notes='Acabado barniz mate'
        )
        self.order_product = OrderProduct.objects.create(
            order_detail=self.order_detail,
            product=self.product,
            price_at_order=150.00
        )

        # Pedido 2 (del otro cliente)
        self.order2 = Order.objects.create(
            user=self.other_customer,
            order_number='ORD-0002-2026',
            status='manufacturing',
            total_price=150.00
        )

    def test_create_production_order_model(self):
        """Verifica la creación básica de una orden de producción y su representación."""
        po = ProductionOrder.objects.create(
            order=self.order,
            status='queued',
            technical_notes='Cortar tablas a 120cm'
        )

        self.assertEqual(po.order, self.order)
        self.assertEqual(po.status, 'queued')
        self.assertEqual(po.iteration, 1)
        self.assertIn('ORD-0001-2026', str(po))
        self.assertIn('En Cola de Espera', str(po))

    def test_multiple_production_orders_per_order_iteration(self):
        """
        Verifica que un pedido puede tener múltiples órdenes de producción
        (por ejemplo en caso de devolución/refabricación) e incrementa la iteración.
        """
        po1 = ProductionOrder.objects.create(
            order=self.order,
            status='completed',
            technical_notes='Primera fabricación'
        )
        self.assertEqual(po1.iteration, 1)

        # El pedido es devuelto y se genera una nueva orden de refabricación
        po2 = ProductionOrder.objects.create(
            order=self.order,
            status='queued',
            technical_notes='Refabricación por devolución de cliente'
        )
        self.assertEqual(po2.iteration, 2)
        self.assertEqual(self.order.production_orders.count(), 2)

    def test_status_transition_assembling_sets_start_date(self):
        """Verifica que al pasar a ensamblaje se asigna automáticamente la fecha de inicio."""
        po = ProductionOrder.objects.create(
            order=self.order,
            status='queued'
        )
        self.assertIsNone(po.start_date)

        po.status = 'assembling'
        po.save()

        po.refresh_from_db()
        self.assertIsNotNone(po.start_date)

    def test_status_transition_completed_sets_completion_date_and_order_status(self):
        """
        Verifica que al completar la fabricación:
        1. Se asigna actual_completion_date.
        2. Se actualiza el estado del pedido a 'waiting_final_payment'.
        """
        self.order.status = 'manufacturing'
        self.order.save()

        po = ProductionOrder.objects.create(
            order=self.order,
            status='quality_check'
        )
        self.assertIsNone(po.actual_completion_date)

        po.status = 'completed'
        po.save()

        po.refresh_from_db()
        self.order.refresh_from_db()

        self.assertIsNotNone(po.actual_completion_date)
        self.assertEqual(self.order.status, 'waiting_final_payment')

    def test_api_list_permissions_customer_vs_admin(self):
        """Verifica que un cliente solo ve sus órdenes de producción y un admin ve todas."""
        po1 = ProductionOrder.objects.create(order=self.order, status='assembling')
        po2 = ProductionOrder.objects.create(order=self.order2, status='painting')

        # Como cliente normal
        self.client.force_authenticate(user=self.customer)
        response = self.client.get('/api/production/production-orders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data if isinstance(response.data, list) else response.data.get('results', [])
        ids = [item['id'] for item in results]
        self.assertIn(po1.id, ids)
        self.assertNotIn(po2.id, ids)

        # Como administrador
        self.client.force_authenticate(user=self.admin)
        response_admin = self.client.get('/api/production/production-orders/')
        self.assertEqual(response_admin.status_code, status.HTTP_200_OK)
        admin_results = response_admin.data if isinstance(response_admin.data, list) else response_admin.data.get('results', [])
        admin_ids = [item['id'] for item in admin_results]
        self.assertIn(po1.id, admin_ids)
        self.assertIn(po2.id, admin_ids)

    def test_api_update_status_endpoint(self):
        """Verifica el endpoint update_status para actualizar fases de fabricación."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/production/production-orders/{po.id}/update_status/', {
            'status': 'painting',
            'technical_notes': 'Pintado con electrostática color negro'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, 'painting')
        self.assertEqual(po.technical_notes, 'Pintado con electrostática color negro')

    def test_api_advance_stage_endpoint(self):
        """Verifica el endpoint advance_stage que avanza en cascada las etapas de taller."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')

        self.client.force_authenticate(user=self.admin)
        
        # 1. queued -> assembling
        res1 = self.client.post(f'/api/production/production-orders/{po.id}/advance_stage/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, 'assembling')

        # 2. assembling -> painting
        res2 = self.client.post(f'/api/production/production-orders/{po.id}/advance_stage/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, 'painting')

    def test_api_metrics_endpoint(self):
        """Verifica el endpoint de métricas del taller."""
        ProductionOrder.objects.create(order=self.order, status='queued')
        ProductionOrder.objects.create(order=self.order2, status='assembling')

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/production/production-orders/metrics/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_orders', response.data)
        self.assertIn('queued', response.data)
        self.assertIn('assembling', response.data)
        self.assertIn('in_progress_total', response.data)
        self.assertGreaterEqual(response.data['total_orders'], 2)

    def test_api_by_order_endpoint(self):
        """Verifica el endpoint by_order para obtener las órdenes de un pedido específico."""
        po1 = ProductionOrder.objects.create(order=self.order, status='completed')
        po2 = ProductionOrder.objects.create(order=self.order, status='queued')

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f'/api/production/production-orders/order/{self.order.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        iterations = [item['iteration'] for item in response.data]
        self.assertIn(1, iterations)
        self.assertIn(2, iterations)
