from django.test import TestCase
from django.contrib.auth import get_user_model, authenticate
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class SuperUserCreationTests(TestCase):
    """Pruebas para la creación y autenticación de superusuarios y usuarios normales."""

    def setUp(self):
        self.client = APIClient()

    def test_create_superuser_is_active(self):
        """Verifica que create_superuser crea un usuario con is_active=True, is_staff=True, is_superuser=True."""
        superuser = User.objects.create_superuser(
            username='admin_test',
            email='admin_test@example.com',
            password='AdminPassword123!',
            first_name='Admin',
            first_last_name='Principal',
        )

        self.assertTrue(superuser.is_active)
        self.assertTrue(superuser.is_staff)
        self.assertTrue(superuser.is_superuser)
        self.assertEqual(superuser.username, 'admin_test')
        self.assertEqual(superuser.email, 'admin_test@example.com')
        self.assertEqual(superuser.get_full_name(), 'Admin Principal')

    def test_authenticate_superuser(self):
        """Verifica que authenticate() funciona exitosamente para un superusuario recién creado."""
        User.objects.create_superuser(
            username='admin_auth',
            email='admin_auth@example.com',
            password='AdminPassword123!',
        )

        auth_user = authenticate(username='admin_auth', password='AdminPassword123!')
        self.assertIsNotNone(auth_user)
        self.assertEqual(auth_user.username, 'admin_auth')
        self.assertTrue(auth_user.is_active)

    def test_superuser_login_api(self):
        """Verifica que el superusuario puede iniciar sesión a través del endpoint /api/user/login/."""
        User.objects.create_superuser(
            username='admin_api',
            email='admin_api@example.com',
            password='AdminPassword123!',
        )

        # Login por username
        response = self.client.post('/api/user/login/', {
            'username': 'admin_api',
            'password': 'AdminPassword123!',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertTrue(response.data['is_superuser'])
        self.assertTrue(response.data['is_staff'])

        # Login por email
        response_email = self.client.post('/api/user/login/', {
            'email': 'admin_api@example.com',
            'password': 'AdminPassword123!',
        }, format='json')

        self.assertEqual(response_email.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response_email.data)

    def test_inactive_user_cannot_login(self):
        """Verifica que un usuario inactivo no puede iniciar sesión por API."""
        User.objects.create_user(
            username='inactive_user',
            email='inactive@example.com',
            password='Password123!',
            is_active=False,
        )

        response = self.client.post('/api/user/login/', {
            'username': 'inactive_user',
            'password': 'Password123!',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get('error'), 'La cuenta está desactivada')

    def test_create_user_defaults(self):
        """Verifica los valores por defecto al crear usuario normal."""
        user = User.objects.create_user(
            username='normal_user',
            email='normal@example.com',
            password='Password123!',
        )
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        # is_active toma el valor por defecto del modelo (False) para requerir activación por correo
        self.assertFalse(user.is_active)

    def test_create_superuser_validation_errors(self):
        """Verifica que create_superuser lanza ValueError si se intentan invalidar flags."""
        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                username='fail1', email='f1@example.com', password='p', is_superuser=False
            )

        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                username='fail2', email='f2@example.com', password='p', is_staff=False
            )

        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                username='fail3', email='f3@example.com', password='p', is_active=False
            )
