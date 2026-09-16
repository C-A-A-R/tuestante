from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, timedelta

User = get_user_model()


class GoogleAuthAndProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch('apps.user.api.authentication_api_view.verify_google_id_token')
    def test_google_auth_new_user_registration(self, mock_verify):
        """Prueba registro de usuario nuevo vía Google."""
        mock_verify.return_value = {
            'sub': 'google_123456789',
            'email': 'usuario.google@example.com',
            'given_name': 'Pedro',
            'family_name': 'Pérez',
            'picture': 'https://lh3.googleusercontent.com/avatar.jpg'
        }

        response = self.client.post('/api/user/google/', {'credential': 'mock_valid_token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['is_new_user'])
        self.assertFalse(data['profile_completed'])
        self.assertIn('tokens', data)
        self.assertIn('access', data['tokens'])

        user = User.objects.get(email='usuario.google@example.com')
        self.assertEqual(user.google_id, 'google_123456789')
        self.assertEqual(user.first_name, 'Pedro')
        self.assertEqual(user.first_last_name, 'Pérez')
        self.assertEqual(user.avatar_url, 'https://lh3.googleusercontent.com/avatar.jpg')
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_registered)
        self.assertFalse(user.has_usable_password())

    @patch('apps.user.api.authentication_api_view.verify_google_id_token')
    def test_google_auth_existing_user_link(self, mock_verify):
        """Prueba vinculación de usuario existente con Google si coincide el correo."""
        User.objects.create_user(
            username='existente@example.com',
            email='existente@example.com',
            password='Password123!',
            first_name='Carlos',
            first_last_name='Gómez',
            identity_document='V-12345678',
            phone='+584121234567',
            birth_date=date(1995, 5, 20)
        )

        mock_verify.return_value = {
            'sub': 'google_existing_999',
            'email': 'existente@example.com',
            'given_name': 'Carlos',
            'family_name': 'Gómez',
            'picture': 'https://lh3.googleusercontent.com/photo.jpg'
        }

        response = self.client.post('/api/user/google/', {'credential': 'mock_token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data['is_new_user'])
        self.assertTrue(data['profile_completed'])

        user = User.objects.get(email='existente@example.com')
        self.assertEqual(user.google_id, 'google_existing_999')

    def test_complete_profile_flow_and_validations(self):
        """Prueba culminación de perfil y validaciones de teléfono y fecha de nacimiento."""
        user = User.objects.create(
            username='test_flow@example.com',
            email='test_flow@example.com',
            first_name='Ana',
            first_last_name='Morales',
            google_id='google_flow_123',
            is_active=True,
            is_registered=True
        )
        self.client.force_authenticate(user=user)

        # 1. Teléfono inválido (contiene letras o caracteres prohibidos)
        bad_phone_payload = {
            'document_type': 'V',
            'identity_document': '18765432',
            'phone': '0412-123-abc',
            'birth_date': '1998-08-15'
        }
        res = self.client.patch('/api/user/profile/', bad_phone_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', res.json())

        # 2. Fecha de nacimiento futura (inválida)
        future_date = (date.today() + timedelta(days=1)).isoformat()
        bad_date_payload = {
            'document_type': 'V',
            'identity_document': '18765432',
            'phone': '+584141234567',
            'birth_date': future_date
        }
        res2 = self.client.patch('/api/user/profile/', bad_date_payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('birth_date', res2.json())

        # 3. Payload válido con número con signo + y fecha correcta
        valid_payload = {
            'document_type': 'V',
            'identity_document': '18765432',
            'phone': '+584241234567',
            'birth_date': '1996-03-22'
        }
        res3 = self.client.patch('/api/user/profile/', valid_payload, format='json')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        data = res3.json()
        self.assertTrue(data['profile_completed'])

        user.refresh_from_db()
        self.assertEqual(user.identity_document, '18765432')
        self.assertEqual(user.phone, '+584241234567')
        self.assertEqual(user.birth_date, date(1996, 3, 22))
