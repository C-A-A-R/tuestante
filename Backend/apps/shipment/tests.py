from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.orders.models import Order
from apps.shipment.models import Shipment, Distributor

User = get_user_model()


class ShipmentModelAndAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword123'
        )
        self.admin = User.objects.create_superuser(
            username='adminuser',
            email='admin@example.com',
            password='adminpassword123'
        )
        self.order = Order.objects.create(
            user=self.user,
            status='pending_initial_payment',
            total_price=100.00
        )
        self.distributor = Distributor.objects.create(
            name='MRW',
            phone='04141234567',
            email='mrw@example.com',
            rif='J-12345678-9'
        )

    def test_create_shipment_with_detailed_address(self):
        shipment = Shipment.objects.create(
            order=self.order,
            distributor=self.distributor,
            state='Apure',
            municipality='Páez',
            city='Guasdualito',
            address='Pueblo viejo alto de periquera'
        )

        self.assertEqual(shipment.state, 'Apure')
        self.assertEqual(shipment.municipality, 'Páez')
        self.assertEqual(shipment.city, 'Guasdualito')
        self.assertEqual(shipment.address, 'Pueblo viejo alto de periquera')

    def test_shipment_api_serialization(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        payload = {
            'order': self.order.id,
            'distributor': self.distributor.id,
            'state': 'Apure',
            'municipality': 'Páez',
            'city': 'Guasdualito',
            'address': 'Pueblo viejo alto de periquera'
        }

        response = client.post('/api/shipments/', payload, format='json')
        self.assertEqual(response.status_code, 201, f"Response: {response.data}")
        self.assertEqual(response.data['state'], 'Apure')
        self.assertEqual(response.data['municipality'], 'Páez')
        self.assertEqual(response.data['city'], 'Guasdualito')
        self.assertEqual(response.data['address'], 'Pueblo viejo alto de periquera')

    def test_shipment_metrics_endpoint(self):
        Shipment.objects.create(
            order=self.order,
            distributor=self.distributor,
            status='pending',
            price=15.00
        )
        Shipment.objects.create(
            order=self.order,
            distributor=self.distributor,
            status='in_transit',
            price=25.00
        )

        client = APIClient()
        client.force_authenticate(user=self.admin)
        response = client.get('/api/shipments/metrics/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('pending', response.data)
        self.assertEqual(response.data['pending']['count'], 1)
        self.assertEqual(response.data['in_transit']['count'], 1)
        self.assertIn('pending_count', response.data)

