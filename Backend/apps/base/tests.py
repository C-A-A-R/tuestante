import io
import os
import shutil
import tempfile
from PIL import Image
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from apps.product.models import ProductType, Product

User = get_user_model()
TEMP_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class ImageCompressionTest(TestCase):
    def tearDown(self):
        if os.path.exists(TEMP_MEDIA_ROOT):
            shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def create_dummy_image(self, width=2500, height=2500, format='JPEG'):
        buffer = io.BytesIO()
        image = Image.new('RGB', (width, height), color='red')
        image.save(buffer, format=format)
        buffer.seek(0)
        return buffer.getvalue()

    def test_single_compressed_file_saved(self):
        """Verifica que solo se guarde una versión comprimida y ligera de la imagen y no la original pesada."""
        raw_bytes = self.create_dummy_image()
        uploaded_file = SimpleUploadedFile("test_large_image.jpg", raw_bytes, content_type="image/jpeg")

        product_type = ProductType.objects.create(
            product_type_name="Tipo Test",
            product_type_image=uploaded_file
        )

        self.assertTrue(bool(product_type.product_type_image.name))

        saved_file_path = product_type.product_type_image.path
        self.assertTrue(os.path.exists(saved_file_path))

        # Verificar que solo exista 1 archivo en la carpeta de tipos
        type_dir = os.path.dirname(saved_file_path)
        files_in_dir = [f for f in os.listdir(type_dir) if os.path.isfile(os.path.join(type_dir, f))]
        self.assertEqual(len(files_in_dir), 1, f"Se esperaba 1 solo archivo pero hay {len(files_in_dir)}: {files_in_dir}")

        # Verificar que el peso guardado sea menor que el original
        saved_size = os.path.getsize(saved_file_path)
        original_size = len(raw_bytes)
        self.assertLess(saved_size, original_size)

        # Verificar que la imagen guardada sea de formato WEBP y dimensiones <= 1920x1920
        with Image.open(saved_file_path) as img:
            self.assertEqual(img.format, 'WEBP')
            self.assertLessEqual(img.width, 1920)
            self.assertLessEqual(img.height, 1920)

    def test_product_compressed_image_saved(self):
        """Verifica que para un Producto sólo se almacene y sirva la imagen comprimida."""
        raw_bytes = self.create_dummy_image()
        uploaded_file = SimpleUploadedFile("product_photo.jpg", raw_bytes, content_type="image/jpeg")

        product_type = ProductType.objects.create(product_type_name="Tipo General")
        product = Product.objects.create(
            product_type=product_type,
            product_name="Producto Test",
            price=100.00,
            product_image=uploaded_file
        )

        saved_file_path = product.product_image.path
        self.assertTrue(os.path.exists(saved_file_path))

        product_dir = os.path.dirname(saved_file_path)
        files_in_dir = [f for f in os.listdir(product_dir) if os.path.isfile(os.path.join(product_dir, f))]
        self.assertEqual(len(files_in_dir), 1)

        saved_size = os.path.getsize(saved_file_path)
        self.assertLess(saved_size, len(raw_bytes))

        with Image.open(saved_file_path) as img:
            self.assertEqual(img.format, 'WEBP')

    def test_update_model_does_not_create_duplicate_files(self):
        """Verifica que actualizar otros campos del modelo no genere duplicados u otros archivos huérfanos."""
        raw_bytes = self.create_dummy_image()
        uploaded_file = SimpleUploadedFile("test_large_image.jpg", raw_bytes, content_type="image/jpeg")

        product_type = ProductType.objects.create(
            product_type_name="Tipo Test Duplicate",
            product_type_image=uploaded_file
        )

        saved_file_path = product_type.product_type_image.path
        type_dir = os.path.dirname(saved_file_path)

        # Actualizar un campo no relacionado con la imagen
        product_type.product_type_name = "Tipo Test Actualizado"
        product_type.save()

        # Debe permanecer exactamente 1 archivo en el directorio
        files_in_dir = [f for f in os.listdir(type_dir) if os.path.isfile(os.path.join(type_dir, f))]
        self.assertEqual(len(files_in_dir), 1)


class SoftDeleteRestoreTest(TestCase):
    def test_restore_soft_deleted_model_on_recreation(self):
        # 1. Crear y eliminar lógicamente un tipo de producto
        type1 = ProductType.objects.create(product_type_name="Electrónica", description="Descripción antigua")
        type1_id = type1.id
        type1.delete()

        self.assertTrue(ProductType.objects.get(id=type1_id).is_deleted)

        # 2. Intentar crear un nuevo tipo con el mismo nombre único
        new_type = ProductType(product_type_name="Electrónica", description="Descripción nueva")
        new_type.full_clean()
        new_type.save()

        # 3. Verificar que se restauró el registro original (mismo ID) y se actualizaron los campos
        restored = ProductType.objects.get(id=type1_id)
        self.assertFalse(restored.is_deleted)
        self.assertIsNone(restored.deleted_at)
        self.assertEqual(restored.description, "Descripción nueva")

        # 4. Verificar que no se creó un registro duplicado
        self.assertEqual(ProductType.objects.filter(product_type_name="Electrónica").count(), 1)

    def test_restore_via_admin_form(self):
        """Verifica la restauración y actualización de un registro borrado a través del Django Admin."""
        from django.contrib.admin.sites import AdminSite
        from apps.product.admin import ProductTypeAdmin

        t = ProductType.objects.create(product_type_name="Muebles", description="Vieja descripción")
        t_id = t.id
        t.delete()

        admin_site = AdminSite()
        type_admin = ProductTypeAdmin(ProductType, admin_site)

        # Obtener el formulario del admin para crear un nuevo tipo de producto
        FormClass = type_admin.get_form(None)
        form = FormClass(data={'product_type_name': 'Muebles', 'description': 'Descripción desde Admin'})

        self.assertTrue(form.is_valid(), f"Errores en el formulario de Admin: {form.errors}")
        saved_obj = form.save()

        self.assertEqual(saved_obj.id, t_id)
        restored = ProductType.objects.get(id=t_id)
        self.assertFalse(restored.is_deleted)
        self.assertEqual(restored.description, "Descripción desde Admin")
        self.assertEqual(ProductType.objects.filter(product_type_name="Muebles").count(), 1)

    def test_restore_via_drf_api(self):
        """Verifica la restauración y actualización de un registro borrado a través del endpoint de la API REST."""
        from rest_framework.test import APIClient
        admin_user = User.objects.create_superuser(username='admin_restore', password='password123', email='admin_restore@example.com')
        client = APIClient()
        client.force_authenticate(user=admin_user)

        t = ProductType.objects.create(product_type_name="Herramientas", description="Sin descripción")
        t_id = t.id
        t.delete()

        response = client.post('/api/products/product-types/', {'product_type_name': 'Herramientas', 'description': 'Herramientas de construcción'}, format='json')
        self.assertEqual(response.status_code, 201, f"Error API: {response.data}")

        restored = ProductType.objects.get(id=t_id)
        self.assertFalse(restored.is_deleted)
        self.assertEqual(restored.description, "Herramientas de construcción")
        self.assertEqual(ProductType.objects.filter(product_type_name="Herramientas").count(), 1)


class BasePaginationAndSearchTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username='admin_pagination',
            password='password123',
            email='admin_pagination@example.com'
        )
        self.client.force_authenticate(user=self.admin)

        # Create multiple product types
        for i in range(25):
            ProductType.objects.create(
                product_type_name=f"Categoría {i:02d}",
                description=f"Descripción {i}"
            )

    def test_unpaginated_by_default_preserves_list(self):
        """Si no se solicitan parámetros de página, se preserva compatibilidad con formato de lista."""
        response = self.client.get('/api/products/product-types/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 25)

    def test_dynamic_pagination_on_page_param(self):
        """Al especificar ?page=1 se activa la paginación con count, next, previous y results."""
        response = self.client.get('/api/products/product-types/?page=1&page_size=10')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, dict)
        self.assertIn('count', response.data)
        self.assertIn('results', response.data)
        self.assertIn('next', response.data)
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 10)

    def test_search_filter_functionality(self):
        """Búsqueda por texto filtra correctamente los resultados."""
        response = self.client.get('/api/products/product-types/?search=Categoría 05')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['product_type_name'], 'Categoría 05')

    def test_ordering_filter_functionality(self):
        """Ordenamiento por campos permitidos."""
        response = self.client.get('/api/products/product-types/?ordering=-product_type_name')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['product_type_name'], 'Categoría 24')


class SoftDeleteShieldingTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username='admin_shield',
            password='password123',
            email='admin_shield@example.com'
        )
        self.client.force_authenticate(user=self.admin)

    def test_soft_deleted_parent_and_children_excluded(self):
        """Registros marcados como is_deleted=True nunca aparecen en listados ni endpoints."""
        pt = ProductType.objects.create(product_type_name="Activo")
        p1 = Product.objects.create(product_type=pt, product_name="Mueble Visible", price=50.0)
        p2 = Product.objects.create(product_type=pt, product_name="Mueble Borrado", price=50.0)
        p2.delete()  # soft delete

        response = self.client.get('/api/products/products/')
        self.assertEqual(response.status_code, 200)
        names = [p['product_name'] for p in response.data]
        self.assertIn("Mueble Visible", names)
        self.assertNotIn("Mueble Borrado", names)


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class ModelMediaCompressionIntegrityTest(TestCase):
    def tearDown(self):
        if os.path.exists(TEMP_MEDIA_ROOT):
            shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def create_dummy_image(self, width=2000, height=2000, format='JPEG'):
        buffer = io.BytesIO()
        image = Image.new('RGB', (width, height), color='blue')
        image.save(buffer, format=format)
        buffer.seek(0)
        return buffer.getvalue()

    def test_gallery_image_compressed_to_webp(self):
        from apps.gallery.models import Gallery
        raw_bytes = self.create_dummy_image()
        uploaded_file = SimpleUploadedFile("gallery_test.jpg", raw_bytes, content_type="image/jpeg")

        gallery = Gallery.objects.create(
            caption="Foto de taller",
            image=uploaded_file
        )

        saved_path = gallery.image.path
        self.assertTrue(os.path.exists(saved_path))
        self.assertLess(os.path.getsize(saved_path), len(raw_bytes))
        with Image.open(saved_path) as img:
            self.assertEqual(img.format, 'WEBP')

    def test_notification_media_image_compressed(self):
        from apps.notification.models import Notification, NotificationMedia
        raw_bytes = self.create_dummy_image()
        uploaded_file = SimpleUploadedFile("notify_img.jpg", raw_bytes, content_type="image/jpeg")

        user = User.objects.create_user(username="notify_user", email="n@test.com")
        notif = Notification.objects.create(user=user, title="Alerta", message="Mensaje")
        media = NotificationMedia.objects.create(
            notification=notif,
            file=uploaded_file,
            media_type='image'
        )

        saved_path = media.file.path
        self.assertTrue(os.path.exists(saved_path))
        self.assertLess(os.path.getsize(saved_path), len(raw_bytes))
        with Image.open(saved_path) as img:
            self.assertEqual(img.format, 'WEBP')

    def test_re_saving_model_does_not_recompress_committed_image(self):
        """Asegura que actualizar un modelo con imagen no sufra el cuello de botella de re-comprimir."""
        from apps.gallery.models import Gallery
        raw_bytes = self.create_dummy_image()
        uploaded_file = SimpleUploadedFile("perf_test.jpg", raw_bytes, content_type="image/jpeg")

        gallery = Gallery.objects.create(
            caption="Original",
            image=uploaded_file
        )
        original_mtime = os.path.getmtime(gallery.image.path)

        # Modificar sólo texto
        gallery.caption = "Actualizado"
        gallery.save()

        new_mtime = os.path.getmtime(gallery.image.path)
        # El archivo físico no debe haber sido re-escrito
        self.assertEqual(original_mtime, new_mtime)




