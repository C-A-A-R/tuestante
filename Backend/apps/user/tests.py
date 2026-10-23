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


class UnregisteredUserTests(TestCase):
    """Pruebas para usuarios no registrados y actualización automática en re-registro."""

    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_superuser(
            username='admin_unreg_test',
            email='admin_unreg@example.com',
            password='AdminPassword123!',
            first_name='Admin',
            first_last_name='Test'
        )
        self.client.force_authenticate(user=self.admin_user)

    def test_create_unregistered_user_manager(self):
        """Verifica la creación de un usuario no registrado mediante el CustomUserManager."""
        user = User.objects.create_unregistered_user(
            email='invitado@example.com',
            first_name='Juan',
            first_last_name='Pérez',
            phone='+584121234567',
            identity_document='V-10203040'
        )

        self.assertFalse(user.is_registered)
        self.assertFalse(user.has_usable_password())
        self.assertTrue(user.is_active)
        self.assertEqual(user.username, 'invitado@example.com')
        self.assertEqual(user.get_full_name(), 'Juan Pérez')

    def test_create_unregistered_user_without_email(self):
        """Verifica que se puede crear un usuario no registrado sin correo (usando documento de identidad)."""
        user = User.objects.create_unregistered_user(
            identity_document='V-99887766',
            first_name='Carlos',
            first_last_name='Gómez',
            phone='+584149999999'
        )

        self.assertIsNone(user.email)
        self.assertEqual(user.username, 'V-99887766')
        self.assertFalse(user.is_registered)
        self.assertFalse(user.has_usable_password())

    def test_create_unregistered_user_without_email_or_document(self):
        """Verifica que se genera un username único cuando no hay email ni documento."""
        user = User.objects.create_unregistered_user(
            first_name='Cliente',
            first_last_name='Casual',
            phone='+584241112233'
        )

        self.assertIsNone(user.email)
        self.assertIsNone(user.identity_document)
        self.assertTrue(user.username.startswith('user_'))
        self.assertFalse(user.is_registered)

    def test_api_create_unregistered_user(self):
        """Verifica la creación de un usuario no registrado a través del endpoint API."""
        response = self.client.post('/api/user/register/', {
            'email': 'cliente_pos@example.com',
            'first_name': 'Ana',
            'first_last_name': 'Martínez',
            'phone': '+584165555555',
            'identity_document': 'V-33445566'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        user_data = response.data['user']
        self.assertEqual(user_data['email'], 'cliente_pos@example.com')
        self.assertFalse(user_data['is_registered'])

        created_user = User.objects.get(email='cliente_pos@example.com')
        self.assertFalse(created_user.has_usable_password())
        self.assertFalse(created_user.is_registered)

    def test_api_reregister_unregistered_user_updates_data(self):
        """
        Verifica que al intentar registrar nuevamente un usuario no registrado existente
        por email, en lugar de error se actualizan sus datos con los nuevos valores.
        """
        # Creación inicial
        initial_user = User.objects.create_unregistered_user(
            email='actualizar@example.com',
            first_name='Pedro',
            first_last_name='López',
            phone='04140000000'
        )

        # Intento de segundo registro con datos actualizados
        response = self.client.post('/api/user/register/', {
            'email': 'actualizar@example.com',
            'first_name': 'Pedro Antonio',
            'second_name': 'José',
            'first_last_name': 'López',
            'second_last_name': 'Rivas',
            'phone': '04149999999',
            'identity_document': 'V-77889900'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(email='actualizar@example.com').count(), 1)

        updated_user = User.objects.get(email='actualizar@example.com')
        self.assertEqual(updated_user.id, initial_user.id)
        self.assertEqual(updated_user.first_name, 'Pedro Antonio')
        self.assertEqual(updated_user.second_name, 'José')
        self.assertEqual(updated_user.second_last_name, 'Rivas')
        self.assertEqual(updated_user.phone, '04149999999')
        self.assertEqual(updated_user.identity_document, 'V-77889900')

    def test_api_reregister_by_identity_document_updates_data(self):
        """Verifica que el re-registro identifica por documento de identidad y actualiza."""
        user = User.objects.create_unregistered_user(
            identity_document='V-55667788',
            first_name='Laura',
            phone='04121111111'
        )

        response = self.client.post('/api/user/register/', {
            'identity_document': 'V-55667788',
            'email': 'laura.nueva@example.com',
            'first_name': 'Laura María',
            'phone': '04122222222'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(identity_document='V-55667788').count(), 1)

        updated_user = User.objects.get(identity_document='V-55667788')
        self.assertEqual(updated_user.id, user.id)
        self.assertEqual(updated_user.email, 'laura.nueva@example.com')
        self.assertEqual(updated_user.first_name, 'Laura María')
        self.assertEqual(updated_user.phone, '04122222222')

    def test_api_claim_unregistered_user_with_password(self):
        """
        Verifica que cuando un usuario no registrado se registra formalmente con contraseña,
        se le asigna la contraseña, se actualizan sus datos y pasa a is_registered=True.
        """
        unreg_user = User.objects.create_unregistered_user(
            email='migrar@example.com',
            first_name='Marta',
            first_last_name='Díaz'
        )
        self.assertFalse(unreg_user.is_registered)
        self.assertFalse(unreg_user.has_usable_password())

        response = self.client.post('/api/user/register/', {
            'email': 'migrar@example.com',
            'username': 'martadiaz',
            'first_name': 'Marta Elena',
            'password': 'PasswordSegura123!',
            'confirm_password': 'PasswordSegura123!',
            'phone': '04245554433'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        claimed_user = User.objects.get(id=unreg_user.id)
        self.assertTrue(claimed_user.is_registered)
        self.assertTrue(claimed_user.has_usable_password())
        self.assertTrue(claimed_user.check_password('PasswordSegura123!'))
        self.assertEqual(claimed_user.first_name, 'Marta Elena')
        self.assertEqual(claimed_user.username, 'martadiaz')

    def test_api_reregister_soft_deleted_user_restores_and_updates(self):
        """Verifica que un usuario borrado lógicamente es restaurado y actualizado al registrarse de nuevo."""
        deleted_user = User.objects.create_unregistered_user(
            email='borrado@example.com',
            first_name='Borrado',
            first_last_name='Inicial'
        )
        deleted_user.delete()
        self.assertTrue(deleted_user.is_deleted)

        response = self.client.post('/api/user/register/', {
            'email': 'borrado@example.com',
            'first_name': 'Restaurado',
            'first_last_name': 'Nuevo'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        restored = User.objects.get(email='borrado@example.com')
        self.assertFalse(restored.is_deleted)
        self.assertIsNone(restored.deleted_at)
        self.assertEqual(restored.first_name, 'Restaurado')

    def test_api_cross_user_conflict_validation(self):
        """Verifica que si se envían identificadores que pertenecen a 2 usuarios distintos se lance error."""
        User.objects.create_unregistered_user(
            email='user1@example.com',
            identity_document='V-11111111'
        )
        User.objects.create_unregistered_user(
            email='user2@example.com',
            identity_document='V-22222222'
        )

        response = self.client.post('/api/user/register/', {
            'email': 'user1@example.com',
            'identity_document': 'V-22222222',
            'first_name': 'Conflicto'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('identity_document', response.data)

    def test_unregistered_user_cannot_login(self):
        """Verifica que un usuario no registrado (sin contraseña utilizable) no puede iniciar sesión."""
        User.objects.create_unregistered_user(
            email='sinpassword@example.com',
            first_name='Sin',
            first_last_name='Password'
        )

        self.client.logout()
        response = self.client.post('/api/user/login/', {
            'email': 'sinpassword@example.com',
            'password': 'AnyPassword123!'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_viewset_create_and_reregister(self):
        """Verifica que el UserViewSet (/api/user/) permite crear y re-registrar/actualizar usuarios no registrados."""
        # 1. Crear usuario no registrado vía /api/user/
        response1 = self.client.post('/api/user/', {
            'email': 'viewset_unreg@example.com',
            'first_name': 'Cliente',
            'first_last_name': 'ViewSet',
            'phone': '123456789'
        }, format='json')

        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response1.data['is_registered'])
        user_id = response1.data['id']

        # 2. Re-registrar vía /api/user/ con nuevos datos
        response2 = self.client.post('/api/user/', {
            'email': 'viewset_unreg@example.com',
            'first_name': 'Cliente Modificado',
            'phone': '987654321'
        }, format='json')

        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.data['id'], user_id)
        self.assertEqual(response2.data['first_name'], 'Cliente Modificado')
        self.assertEqual(response2.data['phone'], '987654321')

    def test_user_viewset_filter_by_is_registered(self):
        """Verifica el filtro de usuarios por is_registered en /api/user/."""
        User.objects.create_unregistered_user(
            email='unregistered_list@example.com',
            first_name='Unreg'
        )
        User.objects.create_user(
            username='registered_list',
            email='registered_list@example.com',
            password='Password123!'
        )

        # Filtrar no registrados
        res_unreg = self.client.get('/api/user/?is_registered=false')
        self.assertEqual(res_unreg.status_code, status.HTTP_200_OK)
        results = res_unreg.data if isinstance(res_unreg.data, list) else res_unreg.data.get('results', [])
        emails = [u['email'] for u in results]
        self.assertIn('unregistered_list@example.com', emails)
        self.assertNotIn('registered_list@example.com', emails)

        # Filtrar registrados
        res_reg = self.client.get('/api/user/?is_registered=true')
        self.assertEqual(res_reg.status_code, status.HTTP_200_OK)
        results_reg = res_reg.data if isinstance(res_reg.data, list) else res_reg.data.get('results', [])
        emails_reg = [u['email'] for u in results_reg]
        self.assertIn('registered_list@example.com', emails_reg)
        self.assertNotIn('unregistered_list@example.com', emails_reg)


class IdentityDocumentLoginTests(TestCase):
    """Pruebas para inicio de sesión con documento de identidad y cédula."""

    def setUp(self):
        self.client = APIClient()
        from apps.employee_store.models import EmployeeProfile

        # Administrador con cédula
        self.admin = User.objects.create_superuser(
            username='admin_cedula',
            email='admin_cedula@example.com',
            password='AdminPassword123!',
            identity_document='31701988',
            document_type='V',
        )

        # Trabajador activo con cédula y perfil de empleado
        self.worker = User.objects.create_user(
            username='worker_cedula',
            email='worker_cedula@example.com',
            password='WorkerPassword123!',
            identity_document='27658671',
            document_type='V',
            is_active=True,
        )
        self.worker_profile = EmployeeProfile.objects.create(
            user=self.worker,
            employee_number='TRA-99001',
            department='Ventas',
            position='Asesor',
            is_active=True,
        )

        # Cliente normal con cédula
        self.client_user = User.objects.create_user(
            username='client_cedula@example.com',
            email='client_cedula@example.com',
            password='ClientPassword123!',
            identity_document='V-12345678',
            document_type='V',
            is_active=True,
        )

    def test_admin_can_login_with_cedula(self):
        """Verifica que un administrador puede iniciar sesión con su cédula (directa y con prefijo V-)."""
        # Con número directo
        res1 = self.client.post('/api/user/login/', {
            'username': '31701988',
            'password': 'AdminPassword123!',
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertTrue(res1.data['is_superuser'])
        self.assertIn('tokens', res1.data)

        # Con prefijo V-
        res2 = self.client.post('/api/user/login/', {
            'username': 'V-31701988',
            'password': 'AdminPassword123!',
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        # Con puntos de formato V-31.701.988
        res3 = self.client.post('/api/user/login/', {
            'username': 'V-31.701.988',
            'password': 'AdminPassword123!',
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)

    def test_worker_can_login_with_cedula_and_employee_number(self):
        """Verifica que un trabajador puede iniciar sesión con su cédula o ficha de empleado."""
        # Con cédula directa
        res1 = self.client.post('/api/user/login/', {
            'username': '27658671',
            'password': 'WorkerPassword123!',
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertTrue(res1.data['is_employee'])
        self.assertIn('tokens', res1.data)

        # Con formato V-27.658.671
        res2 = self.client.post('/api/user/login/', {
            'username': 'V-27.658.671',
            'password': 'WorkerPassword123!',
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data['is_employee'])

        # Con número de ficha / empleado
        res3 = self.client.post('/api/user/login/', {
            'username': 'TRA-99001',
            'password': 'WorkerPassword123!',
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertTrue(res3.data['is_employee'])

    def test_client_cannot_login_with_cedula(self):
        """Verifica que un cliente no puede iniciar sesión con cédula y recibe 403 Forbidden."""
        res = self.client.post('/api/user/login/', {
            'username': 'V-12345678',
            'password': 'ClientPassword123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('únicamente para trabajadores y administradores', res.data['error'])

        # Intentar con solo números
        res_digits = self.client.post('/api/user/login/', {
            'username': '12345678',
            'password': 'ClientPassword123!',
        }, format='json')
        self.assertEqual(res_digits.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_can_login_with_email(self):
        """Verifica que un cliente sí puede iniciar sesión normalmente con su correo electrónico."""
        res = self.client.post('/api/user/login/', {
            'email': 'client_cedula@example.com',
            'password': 'ClientPassword123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['is_employee'])
        self.assertFalse(res.data['is_staff'])

