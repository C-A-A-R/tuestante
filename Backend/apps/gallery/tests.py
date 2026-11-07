import io
from PIL import Image
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from apps.gallery.models import Gallery

User = get_user_model()


def get_test_image(name="test_gallery.jpg"):
    file_obj = io.BytesIO()
    img = Image.new("RGB", (50, 50), color=(0, 81, 135))
    img.save(file_obj, format="JPEG")
    file_obj.seek(0)
    return SimpleUploadedFile(name, file_obj.read(), content_type="image/jpeg")


class GalleryModelAndAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Administrador
        self.admin_user = User.objects.create_superuser(
            username="admin_gallery",
            email="admin_gallery@tuestante.com",
            password="adminpassword123"
        )

        # Clientes
        self.client_user = User.objects.create_user(
            username="cliente_gallery",
            email="cliente_gallery@example.com",
            password="password123"
        )
        self.other_client = User.objects.create_user(
            username="cliente2_gallery",
            email="cliente2_gallery@example.com",
            password="password123"
        )

        # 1. Imagen subida por Admin (debe ser visible para clientes)
        self.admin_media = Gallery.objects.create(
            user=self.admin_user,
            image=get_test_image("admin.jpg"),
            caption="Media Admin Oficial",
            status=Gallery.STATUS_APPROVED,
            is_active=True
        )

        # 2. Imagen legacy sin usuario (subida por admin/sistema, debe ser visible para clientes)
        self.legacy_media = Gallery.objects.create(
            user=None,
            image=get_test_image("legacy.jpg"),
            caption="Media Sistema",
            status=Gallery.STATUS_APPROVED,
            is_active=True
        )

        # 3. Imagen de cliente PENDIENTE (NO debe ser visible para clientes públicos)
        self.user_pending_media = Gallery.objects.create(
            user=self.client_user,
            image=get_test_image("pending.jpg"),
            caption="Media Cliente Pendiente",
            status=Gallery.STATUS_PENDING,
            is_active=True
        )

        # 4. Imagen de cliente RECHAZADA (NO debe ser visible para clientes públicos)
        self.user_rejected_media = Gallery.objects.create(
            user=self.client_user,
            image=get_test_image("rejected.jpg"),
            caption="Media Cliente Rechazada",
            status=Gallery.STATUS_REJECTED,
            is_active=True
        )

        # 5. Imagen de cliente APROBADA (SÍ debe ser visible para clientes públicos)
        self.user_approved_media = Gallery.objects.create(
            user=self.other_client,
            image=get_test_image("approved.jpg"),
            caption="Media Cliente Aprobada",
            status=Gallery.STATUS_APPROVED,
            is_active=True
        )

    def test_clients_only_see_approved_media_or_admin_uploaded(self):
        """Verifica que los clientes solo vean multimedia aprobada o subida por el admin."""
        response = self.client.get('/api/gallery/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data if isinstance(response.data, list) else response.data.get('results', [])
        ids = [item['id'] for item in results]

        # Visibles:
        self.assertIn(self.admin_media.id, ids)
        self.assertIn(self.legacy_media.id, ids)
        self.assertIn(self.user_approved_media.id, ids)

        # NO visibles para clientes:
        self.assertNotIn(self.user_pending_media.id, ids)
        self.assertNotIn(self.user_rejected_media.id, ids)

    def test_client_cannot_retrieve_pending_or_rejected_user_media(self):
        """Verifica que un cliente reciba 404 al intentar obtener directamente multimedia no aprobada."""
        # Intento de ver multimedia pendiente
        res_pending = self.client.get(f'/api/gallery/{self.user_pending_media.id}/')
        self.assertEqual(res_pending.status_code, status.HTTP_404_NOT_FOUND)

        # Intento de ver multimedia rechazada
        res_rejected = self.client.get(f'/api/gallery/{self.user_rejected_media.id}/')
        self.assertEqual(res_rejected.status_code, status.HTTP_404_NOT_FOUND)

        # Intento de ver multimedia aprobada de usuario -> 200 OK
        res_approved = self.client.get(f'/api/gallery/{self.user_approved_media.id}/')
        self.assertEqual(res_approved.status_code, status.HTTP_200_OK)

    def test_admin_can_view_all_statuses_and_filter(self):
        """Verifica que los administradores puedan ver todas las imágenes y filtrar por estado."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/gallery/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data if isinstance(response.data, list) else response.data.get('results', [])
        ids = [item['id'] for item in results]

        # El admin ve todas
        self.assertIn(self.admin_media.id, ids)
        self.assertIn(self.legacy_media.id, ids)
        self.assertIn(self.user_pending_media.id, ids)
        self.assertIn(self.user_rejected_media.id, ids)
        self.assertIn(self.user_approved_media.id, ids)

        # Filtro por pendientes
        res_pending = self.client.get('/api/gallery/?status=pending')
        pending_results = res_pending.data if isinstance(res_pending.data, list) else res_pending.data.get('results', [])
        pending_ids = [item['id'] for item in pending_results]
        self.assertIn(self.user_pending_media.id, pending_ids)
        self.assertNotIn(self.admin_media.id, pending_ids)

    def test_authenticated_client_can_upload_and_status_defaults_to_pending(self):
        """Verifica que un cliente autenticado pueda subir multimedia y su estado sea forzado a 'pending'."""
        self.client.force_authenticate(user=self.client_user)

        new_image = get_test_image("client_upload.jpg")
        data = {
            'image': new_image,
            'caption': 'Mi estante en la sala',
            'social_network': 'instagram',
            'social_media_handle': '@mi_cuenta',
            'status': 'approved'  # El cliente intenta auto-aprobarse
        }

        response = self.client.post('/api/gallery/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_item = Gallery.objects.get(id=response.data['id'])
        self.assertEqual(created_item.user, self.client_user)
        # Debe ignorar 'approved' y quedar en 'pending'
        self.assertEqual(created_item.status, Gallery.STATUS_PENDING)
        self.assertEqual(created_item.estado, 'Pendiente')
        self.assertEqual(created_item.caption, 'Mi estante en la sala')

    def test_unauthenticated_user_cannot_upload(self):
        """Verifica que un usuario no autenticado no pueda subir multimedia."""
        new_image = get_test_image("anon_upload.jpg")
        data = {
            'image': new_image,
            'caption': 'Intento anónimo'
        }
        response = self.client.post('/api/gallery/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_approve_and_reject_actions(self):
        """Verifica las acciones de aprobación y rechazo por parte del administrador."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Aprobar multimedia pendiente
        res_approve = self.client.post(f'/api/gallery/{self.user_pending_media.id}/approve/')
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        self.user_pending_media.refresh_from_db()
        self.assertEqual(self.user_pending_media.status, Gallery.STATUS_APPROVED)

        # 2. Rechazar multimedia
        res_reject = self.client.post(f'/api/gallery/{self.user_pending_media.id}/reject/')
        self.assertEqual(res_reject.status_code, status.HTTP_200_OK)
        self.user_pending_media.refresh_from_db()
        self.assertEqual(self.user_pending_media.status, Gallery.STATUS_REJECTED)

    def test_my_uploads_endpoint(self):
        """Verifica el endpoint /api/gallery/my-uploads/ para ver las subidas propias del usuario autenticado."""
        self.client.force_authenticate(user=self.client_user)
        response = self.client.get('/api/gallery/my-uploads/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data if isinstance(response.data, list) else response.data.get('results', [])
        ids = [item['id'] for item in results]

        # Debe contener solo las subidas de self.client_user (incluso pendientes y rechazadas)
        self.assertIn(self.user_pending_media.id, ids)
        self.assertIn(self.user_rejected_media.id, ids)
        self.assertNotIn(self.admin_media.id, ids)
        self.assertNotIn(self.user_approved_media.id, ids)
