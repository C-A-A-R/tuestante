from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.product.models import Product, ProductType
from apps.orders.models import Order
from apps.shipment.models import Shipment, Distributor

User = get_user_model()


class OrderAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testcustomer',
            email='customer@example.com',
            password='password123'
        )
        self.product_type = ProductType.objects.create(product_type_name='Estantería')
        self.product = Product.objects.create(
            product_name='Estante Modular',
            product_type=self.product_type,
            price=150.00
        )
        self.distributor = Distributor.objects.create(
            name='MRW Express',
            rif='J-99887766-5',
            coverage_type='national'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_order_without_shipment(self):
        """Verifica que se pueda crear una orden sin datos de envío."""
        payload = {
            "notes": "Entrega normal",
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": 2,
                    "notes": "Color nogal"
                }
            ]
        }

        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, 201, f"Response: {response.data}")
        self.assertEqual(response.data['total_price'], '300.00')
        self.assertTrue(response.data['order_number'].startswith('ORD-'))
        self.assertEqual(len(response.data['shipments']), 0)
        self.assertEqual(Shipment.objects.count(), 0)
        self.assertEqual(Order.objects.count(), 1)

    def test_order_number_format_and_sequence(self):
        """Verifica el formato ORD-nnnn-año y la secuencia correlativa."""
        order1 = Order.objects.create(user=self.user, total_price=100)
        order2 = Order.objects.create(user=self.user, total_price=200)

        import re
        from django.utils import timezone
        year = timezone.now().year

        pattern = rf'^ORD-\d{{4}}-{year}$'
        self.assertTrue(re.match(pattern, order1.order_number))
        self.assertTrue(re.match(pattern, order2.order_number))
        self.assertNotEqual(order1.order_number, order2.order_number)

    def test_create_order_with_items_list_without_shipment(self):
        """Verifica compatibilidad con payload enviado como lista directa de items."""
        payload = [
            {
                "product_id": self.product.id,
                "quantity": 1
            }
        ]

        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data['shipments']), 0)

    def test_create_order_with_shipment(self):
        """Verifica que se cree la orden y el registro de envío cuando se proporcionan los datos."""
        payload = {
            "notes": "Pedido urgente",
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": 1,
                    "notes": "Color blanco"
                }
            ],
            "shipment": {
                "distributor_id": self.distributor.id,
                "state": "Apure",
                "municipality": "Páez",
                "city": "Guasdualito",
                "address": "Av. Miranda cruce con Calle Comercio, Casa #12",
                "notes": "Tocar timbre blanco",
                "price": "15.00"
            }
        }

        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, 201, f"Response: {response.data}")
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Shipment.objects.count(), 1)

        shipment = Shipment.objects.first()
        self.assertEqual(shipment.order_id, response.data['id'])
        self.assertEqual(shipment.distributor, self.distributor)
        self.assertEqual(shipment.state, "Apure")
        self.assertEqual(shipment.municipality, "Páez")
        self.assertEqual(shipment.city, "Guasdualito")
        self.assertEqual(shipment.address, "Av. Miranda cruce con Calle Comercio, Casa #12")
        self.assertEqual(shipment.notes, "Tocar timbre blanco")

        self.assertEqual(len(response.data['shipments']), 1)
        self.assertEqual(response.data['shipments'][0]['address'], "Av. Miranda cruce con Calle Comercio, Casa #12")

    def test_create_order_with_shipment_missing_address(self):
        """Verifica que retorne error si se envía shipment sin el campo obligatorio address."""
        payload = {
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": 1
                }
            ],
            "shipment": {
                "state": "Apure",
                "city": "Guasdualito"
            }
        }

        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(Shipment.objects.count(), 0)

    def test_create_order_with_invalid_distributor(self):
        """Verifica que retorne error si el distribuidor especificado no existe."""
        payload = {
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": 1
                }
            ],
            "shipment": {
                "distributor_id": 99999,
                "address": "Calle Falsa 123"
            }
        }

        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Order.objects.count(), 0)

    def test_list_orders_regular_user_prioritize_unfinished(self):
        """Verifica que el parámetro prioritize_unfinished posicione las órdenes no finalizadas de primeras."""
        order_finalized = Order.objects.create(user=self.user, status='finalized', total_price=100)
        order_manufacturing = Order.objects.create(user=self.user, status='manufacturing', total_price=120)
        order_pending = Order.objects.create(user=self.user, status='pending_initial_payment', total_price=150)

        # Sin el parámetro opcional (orden cronológico descendente por defecto)
        response_default = self.client.get('/api/orders/')
        self.assertEqual(response_default.status_code, 200)
        default_ids = [o['id'] for o in response_default.data]
        self.assertEqual(default_ids, [order_pending.id, order_manufacturing.id, order_finalized.id])

        # Con prioritize_unfinished=true
        response_prioritized = self.client.get('/api/orders/?prioritize_unfinished=true')
        self.assertEqual(response_prioritized.status_code, 200)
        prioritized_ids = [o['id'] for o in response_prioritized.data]
        # Las no finalizadas (pending, manufacturing) deben ir antes de la finalizada
        self.assertEqual(prioritized_ids, [order_pending.id, order_manufacturing.id, order_finalized.id])

        # Creamos una orden finalizada más reciente para comprobar que queda al final a pesar de ser la más nueva
        recent_finalized = Order.objects.create(user=self.user, status='finalized', total_price=200)
        
        response_prioritized2 = self.client.get('/api/orders/?prioritize_unfinished=true')
        self.assertEqual(response_prioritized2.status_code, 200)
        prioritized_ids2 = [o['id'] for o in response_prioritized2.data]
        # Las no finalizadas deben estar de primeras, luego las finalizadas
        self.assertEqual(prioritized_ids2[:2], [order_pending.id, order_manufacturing.id])
        self.assertEqual(prioritized_ids2[2:], [recent_finalized.id, order_finalized.id])

    def test_list_orders_admin_all_and_user_filter_prioritize_unfinished(self):
        """Verifica que el administrador pueda listar todas las órdenes o filtrar por usuario con prioridad a no finalizadas."""
        admin_user = User.objects.create_superuser(username='adminuser', password='password123', email='admin@example.com')
        other_user = User.objects.create_user(username='othercustomer', password='password123', email='other@example.com')

        order_u1_finalized = Order.objects.create(user=self.user, status='finalized', total_price=50)
        order_u1_pending = Order.objects.create(user=self.user, status='pending_initial_payment', total_price=60)
        order_u2_finalized = Order.objects.create(user=other_user, status='finalized', total_price=70)
        order_u2_shipping = Order.objects.create(user=other_user, status='shipped', total_price=80)

        self.client.force_authenticate(user=admin_user)

        # 1. Todas las órdenes con prioritize_unfinished=true
        response_all = self.client.get('/api/orders/?prioritize_unfinished=true')
        self.assertEqual(response_all.status_code, 200)
        all_ids = [o['id'] for o in response_all.data]
        # Las no finalizadas (u2_shipping, u1_pending) primero, luego finalizadas (u2_finalized, u1_finalized)
        self.assertEqual(all_ids[:2], [order_u2_shipping.id, order_u1_pending.id])
        self.assertEqual(all_ids[2:], [order_u2_finalized.id, order_u1_finalized.id])

        # 2. Órdenes por usuario específico con query param user_id y prioritize_unfinished=true
        response_u1 = self.client.get(f'/api/orders/?user_id={self.user.id}&prioritize_unfinished=true')
        self.assertEqual(response_u1.status_code, 200)
        u1_ids = [o['id'] for o in response_u1.data]
        self.assertEqual(u1_ids, [order_u1_pending.id, order_u1_finalized.id])

        # 3. Órdenes por endpoint auxiliar /user/<id>/ con prioritize_unfinished=true
        response_u2_action = self.client.get(f'/api/orders/user/{other_user.id}/?prioritize_unfinished=true')
        self.assertEqual(response_u2_action.status_code, 200)
        u2_ids = [o['id'] for o in response_u2_action.data]
        self.assertEqual(u2_ids, [order_u2_shipping.id, order_u2_finalized.id])

    def test_prioritize_unfinished_aliases(self):
        """Verifica compatibilidad con alias en español e inglés del parámetro."""
        order_finalized = Order.objects.create(user=self.user, status='finalized', total_price=100)
        order_pending = Order.objects.create(user=self.user, status='pending_initial_payment', total_price=150)

        aliases = [
            'prioritize_unfinished=1',
            'priorizar_no_finalizadas=true',
            'unfinished_first=yes',
            'prioridad_no_finalizadas=si',
            'priorizar_pendientes=1',
            'prioritize_unfinished'
        ]

        for alias in aliases:
            response = self.client.get(f'/api/orders/?{alias}')
            self.assertEqual(response.status_code, 200, f"Fallo con alias: {alias}")
            ids = [o['id'] for o in response.data]
            self.assertEqual(ids, [order_pending.id, order_finalized.id], f"Fallo orden con alias: {alias}")

    def test_regular_user_my_orders_and_user_orders_endpoint(self):
        """Verifica que un cliente regular pueda consultar sus órdenes en /my-orders/ y /user/<id>/ pero no las de otros."""
        other_user = User.objects.create_user(username='othercustomer2', password='password123', email='other2@example.com')

        order_u1_finalized = Order.objects.create(user=self.user, status='finalized', total_price=50)
        order_u1_pending = Order.objects.create(user=self.user, status='pending_initial_payment', total_price=60)
        Order.objects.create(user=other_user, status='pending_initial_payment', total_price=70)

        # Autenticado como cliente regular
        self.client.force_authenticate(user=self.user)

        # 1. /api/orders/my-orders/?prioritize_unfinished=true
        response_my = self.client.get('/api/orders/my-orders/?prioritize_unfinished=true')
        self.assertEqual(response_my.status_code, 200)
        my_ids = [o['id'] for o in response_my.data]
        self.assertEqual(my_ids, [order_u1_pending.id, order_u1_finalized.id])

        # 2. /api/orders/user/<self.user.id>/?prioritize_unfinished=true (permitido para sus propias órdenes)
        response_self = self.client.get(f'/api/orders/user/{self.user.id}/?prioritize_unfinished=true')
        self.assertEqual(response_self.status_code, 200)
        self_ids = [o['id'] for o in response_self.data]
        self.assertEqual(self_ids, [order_u1_pending.id, order_u1_finalized.id])

        # 3. /api/orders/user/<other_user.id>/ (denegado para órdenes de otros clientes)
        response_forbidden = self.client.get(f'/api/orders/user/{other_user.id}/')
        self.assertEqual(response_forbidden.status_code, 403)

    def test_store_validations_cannot_purchase_more_than_outlet_quantity(self):
        """Verifica que la tienda no permita comprar más de la cantidad disponible en el Outlet."""
        outlet_prod = Product.objects.create(
            product_name='Estante Oferta Limitada',
            product_type=self.product_type,
            price=100.00,
            is_active=True,
            is_outlet=True,
            quantity=3
        )

        # 1. Intentar comprar 4 unidades cuando solo hay 3 disponibles -> Debe fallar con error 400
        payload_exceed = {
            "items": [
                {
                    "product_id": outlet_prod.id,
                    "quantity": 4
                }
            ]
        }
        response_exceed = self.client.post('/api/orders/', payload_exceed, format='json')
        self.assertEqual(response_exceed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No hay suficiente stock en Outlet", response_exceed.data['error'])

        # 2. Comprar exactamente 3 unidades -> Debe descontar stock a 0 e inactivar el producto
        payload_exact = {
            "items": [
                {
                    "product_id": outlet_prod.id,
                    "quantity": 3
                }
            ]
        }
        response_exact = self.client.post('/api/orders/', payload_exact, format='json')
        self.assertEqual(response_exact.status_code, status.HTTP_201_CREATED)

        outlet_prod.refresh_from_db()
        self.assertEqual(outlet_prod.quantity, 0)
        self.assertFalse(outlet_prod.is_active)  # Inactivo al agotarse para que no se muestre a clientes

        # 3. Intentar comprar nuevamente el producto ahora agotado -> Debe ser rechazado
        response_again = self.client.post('/api/orders/', payload_exact, format='json')
        self.assertEqual(response_again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_store_cannot_purchase_inactive_product(self):
        """Verifica que un producto marcado manualmente como inactivo no pueda ser ordenado."""
        inactive_prod = Product.objects.create(
            product_name='Estante Inactivo',
            product_type=self.product_type,
            price=200.00,
            is_active=False
        )

        payload = {
            "items": [
                {
                    "product_id": inactive_prod.id,
                    "quantity": 1
                }
            ]
        }
        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no se encuentra disponible", response.data['error'])

    def test_order_cannot_be_updated_or_deleted(self):
        """Valida que un pedido no pueda ser modificado (PUT/PATCH) ni eliminado (DELETE)."""
        admin = User.objects.create_superuser(username='admin_test_imm', email='admin_imm@example.com', password='adminpassword')
        self.client.force_authenticate(user=admin)
        order = Order.objects.create(
            user=self.user,
            status='pending_initial_payment',
            total_price=100.00
        )

        # 1. Intentar PUT (Bloqueado 405)
        put_response = self.client.put(f'/api/orders/{order.id}/', {'notes': 'Nueva nota'}, format='json')
        self.assertEqual(put_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertIn("no pueden ser actualizados", put_response.data['error'])

        # 2. Intentar PATCH por cliente no-staff (Bloqueado 403)
        self.client.force_authenticate(user=self.user)
        patch_cust_response = self.client.patch(f'/api/orders/{order.id}/', {'notes': 'Nueva nota'}, format='json')
        self.assertEqual(patch_cust_response.status_code, status.HTTP_403_FORBIDDEN)

        # 3. PATCH permitido solo para staff (200 OK)
        self.client.force_authenticate(user=admin)
        patch_admin_response = self.client.patch(f'/api/orders/{order.id}/', {'notes': 'Nota admin'}, format='json')
        self.assertEqual(patch_admin_response.status_code, status.HTTP_200_OK)

        # 4. Intentar DELETE (Bloqueado 405)
        delete_response = self.client.delete(f'/api/orders/{order.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertIn("no pueden ser eliminados", delete_response.data['error'])

    def test_create_order_with_address_as_string(self):
        """Valida que el servicio normalice la dirección recibida como string."""
        payload = {
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "shipment": "Calle Comercio, Guasdualito, Páez, Apure"
        }
        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        shipment = Shipment.objects.filter(order_id=response.data['id']).first()
        self.assertIsNotNone(shipment)
        self.assertEqual(shipment.address, "Calle Comercio")
        self.assertEqual(shipment.city, "Guasdualito")
        self.assertEqual(shipment.municipality, "Páez")
        self.assertEqual(shipment.state, "Apure")

    def test_create_order_with_address_as_list(self):
        """Valida que el servicio normalice la dirección recibida como lista."""
        payload = {
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "shipment": ["Barinas", "Barinas", "Ciudad Barinas", "Calle 15 con Av. Industrial"]
        }
        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        shipment = Shipment.objects.filter(order_id=response.data['id']).first()
        self.assertIsNotNone(shipment)
        self.assertEqual(shipment.state, "Barinas")
        self.assertEqual(shipment.municipality, "Barinas")
        self.assertEqual(shipment.city, "Ciudad Barinas")
        self.assertEqual(shipment.address, "Calle 15 con Av. Industrial")

    def test_create_order_with_shipment_data(self):
        """Valida que la orden se cree con su envío correctamente normalizado."""
        payload = {
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "shipment": {
                "address": "Av. Los Próceres #10",
                "state": "Carabobo",
                "city": "Valencia"
            }
        }
        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        shipment = Shipment.objects.filter(order_id=response.data['id']).first()
        self.assertIsNotNone(shipment)
        self.assertEqual(shipment.address, "Av. Los Próceres #10")
        self.assertEqual(shipment.state, "Carabobo")
        self.assertEqual(shipment.city, "Valencia")

    def test_create_order_with_distributor_coverage_validation(self):
        """Verifica que no se permita comprar si el distribuidor regional no cubre la zona indicada."""
        regional_distributor = Distributor.objects.create(
            name='Transportes Carabobo Regional',
            rif='J-11223344-5',
            coverage_type='regional'
        )
        # 1. Sin cobertura para Zulia -> Debe rechazar con HTTP 400
        payload = {
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "shipment": {
                "distributor_id": regional_distributor.id,
                "state": "Zulia",
                "municipality": "Maracaibo",
                "address": "Calle 72 con Av. Bella Vista"
            }
        }
        response = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no posee cobertura", response.data['error'])

        # 2. Con cobertura agregada -> Debe permitir la creación
        from apps.shipment.models import DistributorCoverage
        DistributorCoverage.objects.create(
            distributor=regional_distributor,
            state="Zulia",
            municipality="Maracaibo"
        )
        response_ok = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(response_ok.status_code, status.HTTP_201_CREATED)

    def test_receive_order_with_notes_action(self):
        """Verifica la acción de recepción de pedido con notas u observaciones."""
        order = Order.objects.create(user=self.user, status='shipped', total_price=150)
        shipment = Shipment.objects.create(order=order, address="Calle 1", status='in_transit')

        # Cliente confirma recepción con observaciones
        response = self.client.post(f'/api/orders/{order.id}/receive/', {'notes': 'Recibido en excelente estado, sin rayaduras'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('mensaje', response.data)

        order.refresh_from_db()
        shipment.refresh_from_db()
        self.assertEqual(order.status, 'finalized')
        self.assertEqual(order.reception_notes, 'Recibido en excelente estado, sin rayaduras')
        self.assertIsNotNone(order.reception_date)
        self.assertEqual(shipment.status, 'delivered')




