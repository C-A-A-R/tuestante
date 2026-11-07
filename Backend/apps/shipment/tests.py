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

    def test_distributor_coverage_and_available_endpoint(self):
        """Verifica que los distribuidores nacionales cubran todo y los regionales solo sus zonas."""
        from apps.shipment.models import DistributorCoverage

        # 1. Distribuidor Nacional
        dist_nacional = Distributor.objects.create(
            name='Zoom Envíos',
            rif='J-99999999-1',
            coverage_type='national',
            is_active=True
        )
        self.assertTrue(dist_nacional.covers_location('Zulia', 'Maracaibo'))
        self.assertTrue(dist_nacional.covers_location('Amazonas', 'Atures'))

        # 2. Distribuidor Regional
        dist_regional = Distributor.objects.create(
            name='Flete Carabobo Express',
            rif='J-88888888-2',
            coverage_type='regional',
            is_active=True
        )
        DistributorCoverage.objects.create(
            distributor=dist_regional,
            state='Carabobo',
            municipality='Valencia',
            city='Valencia',
            base_shipping_cost=7.50,
            estimated_days_min=1,
            estimated_days_max=2
        )
        # Cubre Carabobo - Valencia
        self.assertTrue(dist_regional.covers_location('Carabobo', 'Valencia'))
        # NO cubre Zulia
        self.assertFalse(dist_regional.covers_location('Zulia', 'Maracaibo'))

        # 3. Probar endpoint /api/shipments/distributors/available/?state=Carabobo&municipality=Valencia
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get('/api/shipments/distributors/available/?state=Carabobo&municipality=Valencia')
        self.assertEqual(response.status_code, 200)
        ids = [d['id'] for d in response.data['distributors']]
        self.assertIn(dist_nacional.id, ids)
        self.assertIn(dist_regional.id, ids)

        # 4. Probar en ubicación donde solo el nacional llega
        res_zulia = client.get('/api/shipments/distributors/available/?state=Zulia&municipality=Maracaibo')
        self.assertEqual(res_zulia.status_code, 200)
        zulia_ids = [d['id'] for d in res_zulia.data['distributors']]
        self.assertIn(dist_nacional.id, zulia_ids)
        self.assertNotIn(dist_regional.id, zulia_ids)


