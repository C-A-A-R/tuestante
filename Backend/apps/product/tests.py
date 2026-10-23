from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.product.models import Product, ProductType, FavoriteProduct

User = get_user_model()


class FavoriteProductAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='clientefav',
            email='clientefav@example.com',
            password='password123'
        )
        self.user2 = User.objects.create_user(
            username='clientefav2',
            email='clientefav2@example.com',
            password='password123'
        )
        self.user3 = User.objects.create_user(
            username='clientefav3',
            email='clientefav3@example.com',
            password='password123'
        )
        self.other_user = User.objects.create_user(
            username='otherclient',
            email='otherclient@example.com',
            password='password123'
        )
        self.product_type = ProductType.objects.create(product_type_name='Estantería')

        self.product1 = Product.objects.create(
            product_name='Estante Minimalista',
            product_type=self.product_type,
            price=120.00
        )

        self.product2 = Product.objects.create(
            product_name='Estante Flotante',
            product_type=self.product_type,
            price=80.00
        )

        self.product3 = Product.objects.create(
            product_name='Estante Modular',
            product_type=self.product_type,
            price=150.00
        )

        self.client = APIClient()

    def test_anonymous_user_product_list_is_favorite_false(self):
        """Verifica que para un usuario no autenticado is_favorite siempre sea False."""
        response = self.client.get('/api/products/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for prod in response.data:
            self.assertIn('is_favorite', prod)
            self.assertFalse(prod['is_favorite'])
            self.assertIn('favorites_count', prod)

    def test_authenticated_user_product_list_with_favorites(self):
        """Verifica que el campo is_favorite refleje con precisión si el usuario autenticado tiene el producto en favoritos."""
        FavoriteProduct.objects.create(user=self.user, product=self.product1)

        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/products/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        products_map = {p['id']: p['is_favorite'] for p in response.data}
        self.assertTrue(products_map[self.product1.id])
        self.assertFalse(products_map[self.product2.id])

    def test_toggle_favorite_apiview(self):
        """Verifica ToggleFavoriteAPIView en /api/products/favorites/<id>/toggle/."""
        self.client.force_authenticate(user=self.user)

        # 1. Primer toggle: Agrega a favoritos
        response1 = self.client.post(f'/api/products/favorites/{self.product1.id}/toggle/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertTrue(response1.data['is_favorite'])
        self.assertTrue(FavoriteProduct.objects.filter(user=self.user, product=self.product1, is_deleted=False).exists())

        # 2. Segundo toggle: Elimina de favoritos (borrado lógico)
        response2 = self.client.post(f'/api/products/favorites/{self.product1.id}/toggle/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertFalse(response2.data['is_favorite'])
        self.assertFalse(FavoriteProduct.objects.filter(user=self.user, product=self.product1, is_deleted=False).exists())

        # 3. Tercer toggle via alias /wishlist/: Restaura el favorito
        response3 = self.client.post(f'/api/products/wishlist/{self.product1.id}/toggle/')
        self.assertEqual(response3.status_code, status.HTTP_200_OK)
        self.assertTrue(response3.data['is_favorite'])
        self.assertTrue(FavoriteProduct.objects.filter(user=self.user, product=self.product1, is_deleted=False).exists())

    def test_favorite_product_apiview_post_and_delete(self):
        """Verifica FavoriteProductAPIView en /api/products/favorites/<id>/ con POST y DELETE."""
        self.client.force_authenticate(user=self.user)

        # POST para marcar como favorito
        response_post = self.client.post(f'/api/products/favorites/{self.product2.id}/')
        self.assertEqual(response_post.status_code, status.HTTP_200_OK)
        self.assertTrue(response_post.data['is_favorite'])
        self.assertTrue(FavoriteProduct.objects.filter(user=self.user, product=self.product2, is_deleted=False).exists())

        # DELETE para desmarcar favorito
        response_del = self.client.delete(f'/api/products/favorites/{self.product2.id}/')
        self.assertEqual(response_del.status_code, status.HTTP_200_OK)
        self.assertFalse(response_del.data['is_favorite'])
        self.assertFalse(FavoriteProduct.objects.filter(user=self.user, product=self.product2, is_deleted=False).exists())

    def test_user_favorites_apiview_and_wishlist_alias(self):
        """Verifica UserFavoritesAPIView en /api/products/favorites/ y /api/products/wishlist/."""
        FavoriteProduct.objects.create(user=self.user, product=self.product1)
        FavoriteProduct.objects.create(user=self.other_user, product=self.product2)

        self.client.force_authenticate(user=self.user)

        # Endpoint /favorites/
        response_fav = self.client.get('/api/products/favorites/')
        self.assertEqual(response_fav.status_code, status.HTTP_200_OK)
        fav_ids = [p['id'] for p in response_fav.data]
        self.assertEqual(fav_ids, [self.product1.id])

        # Endpoint /wishlist/
        response_wish = self.client.get('/api/products/wishlist/')
        self.assertEqual(response_wish.status_code, status.HTTP_200_OK)
        wish_ids = [p['id'] for p in response_wish.data]
        self.assertEqual(wish_ids, [self.product1.id])

    def test_filter_by_favorites_query_param(self):
        """Verifica que el parámetro ?favorites=true o ?only_favorites=true filtre la lista de productos."""
        FavoriteProduct.objects.create(user=self.user, product=self.product2)

        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/products/products/?favorites=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in response.data]
        self.assertEqual(ids, [self.product2.id])

    def test_sort_products_from_most_to_least_favorited(self):
        """
        Verifica que al ordenar por favoritos, los productos se listen desde el más favorito
        (mayor cantidad de favoritos) hasta el menos favorito.
        """
        # product3: 3 favoritos (más favorito)
        FavoriteProduct.objects.create(user=self.user, product=self.product3)
        FavoriteProduct.objects.create(user=self.user2, product=self.product3)
        FavoriteProduct.objects.create(user=self.user3, product=self.product3)

        # product1: 2 favoritos
        FavoriteProduct.objects.create(user=self.user, product=self.product1)
        FavoriteProduct.objects.create(user=self.user2, product=self.product1)

        # product2: 0 favoritos (menos favorito)

        # Test con ?sort_by_favorites=true
        response = self.client.get('/api/products/products/?sort_by_favorites=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in response.data]
        self.assertEqual(ids, [self.product3.id, self.product1.id, self.product2.id])

        counts = [p['favorites_count'] for p in response.data]
        self.assertEqual(counts, [3, 2, 0])

        # Test con alias ?most_favorited=true
        response_alias = self.client.get('/api/products/products/?most_favorited=true')
        self.assertEqual(response_alias.status_code, status.HTTP_200_OK)
        ids_alias = [p['id'] for p in response_alias.data]
        self.assertEqual(ids_alias, [self.product3.id, self.product1.id, self.product2.id])

        # Test con alias ?sort=favorites
        response_sort = self.client.get('/api/products/products/?sort=favorites')
        self.assertEqual(response_sort.status_code, status.HTTP_200_OK)
        ids_sort = [p['id'] for p in response_sort.data]
        self.assertEqual(ids_sort, [self.product3.id, self.product1.id, self.product2.id])

    def test_product_auto_featured_when_reaching_twenty_favorites(self):
        """
        Verifica que cuando 20 usuarios asocian un producto como favorito,
        este se marca automáticamente como producto destacado (is_feature_product=True).
        """
        new_product = Product.objects.create(
            product_name='Estante Popular 20',
            product_type=self.product_type,
            price=200.00,
            is_feature_product=False
        )
        self.assertFalse(new_product.is_feature_product)

        # Crear 19 favoritos -> aún no debe ser destacado
        for i in range(1, 20):
            u = User.objects.create_user(
                username=f'user_batch_{i}',
                email=f'user_batch_{i}@test.com',
                password='password123'
            )
            FavoriteProduct.objects.create(user=u, product=new_product)

        new_product.refresh_from_db()
        self.assertFalse(new_product.is_feature_product)
        self.assertEqual(new_product.favorites.filter(is_deleted=False).count(), 19)

        # Crear el favorito número 20
        u20 = User.objects.create_user(
            username='user_batch_20',
            email='user_batch_20@test.com',
            password='password123'
        )
        FavoriteProduct.objects.create(user=u20, product=new_product)

        new_product.refresh_from_db()
        self.assertTrue(new_product.is_feature_product)
        self.assertEqual(new_product.favorites.filter(is_deleted=False).count(), 20)

    def test_featured_products_least_favorites_apiview(self):
        """
        Verifica que FeaturedProductsLeastFavoritesAPIView retorne los productos destacados
        ordenados desde el que MENOS favoritos tiene al que MÁS tiene.
        """
        # Crear 3 productos destacados con diferentes cantidades de favoritos
        feat1 = Product.objects.create(
            product_name='Destacado con 1 fav',
            product_type=self.product_type,
            price=100.00,
            is_feature_product=True
        )
        feat2 = Product.objects.create(
            product_name='Destacado con 3 favs',
            product_type=self.product_type,
            price=110.00,
            is_feature_product=True
        )
        feat3 = Product.objects.create(
            product_name='Destacado con 0 favs',
            product_type=self.product_type,
            price=120.00,
            is_feature_product=True
        )

        # Producto no destacado (no debe salir)
        non_feat = Product.objects.create(
            product_name='No Destacado',
            product_type=self.product_type,
            price=90.00,
            is_feature_product=False
        )

        # Asignar favoritos
        FavoriteProduct.objects.create(user=self.user, product=feat1)

        FavoriteProduct.objects.create(user=self.user, product=feat2)
        FavoriteProduct.objects.create(user=self.user2, product=feat2)
        FavoriteProduct.objects.create(user=self.user3, product=feat2)

        FavoriteProduct.objects.create(user=self.user, product=non_feat)

        response = self.client.get('/api/products/featured-products/least-favorites/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Solo deben salir los 3 destacados y ordenados de menor a mayor favorito (0 -> 1 -> 3)
        returned_ids = [p['id'] for p in response.data]
        self.assertEqual(returned_ids, [feat3.id, feat1.id, feat2.id])

        returned_counts = [p['favorites_count'] for p in response.data]
        self.assertEqual(returned_counts, [0, 1, 3])

    def test_unauthenticated_toggle_favorite_forbidden(self):
        """Verifica que un usuario anónimo no pueda marcar productos como favoritos."""
        response = self.client.post(f'/api/products/favorites/{self.product1.id}/toggle/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class OutletModelAndAPITest(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='admin_outlet',
            email='admin_outlet@example.com',
            password='adminpassword123'
        )
        self.client_user = User.objects.create_user(
            username='cliente_outlet',
            email='cliente_outlet@example.com',
            password='password123'
        )
        self.product_type = ProductType.objects.create(product_type_name='Mobiliario')
        self.product = Product.objects.create(
            product_name='Estante Oferta Outlet',
            product_type=self.product_type,
            price=99.00,
            is_active=True,
            is_outlet=True,
            quantity=5
        )
        self.client = APIClient()

    def test_outlet_product_active_status_persists_on_zero_quantity(self):
        """Verifica que el estado is_active se mantenga y no se fuerce a inactivo al guardar un producto outlet con cantidad 0."""
        self.assertTrue(self.product.is_active)
        self.assertEqual(self.product.quantity, 5)

        # Reducir cantidad a 0 y guardar manteniendo o activando is_active
        self.product.quantity = 0
        self.product.is_active = True
        self.product.save()

        self.product.refresh_from_db()
        self.assertTrue(self.product.is_active)
        self.assertEqual(self.product.quantity, 0)

    def test_outlet_filter_excludes_zero_quantity_for_clients(self):
        """Verifica que productos outlet sin stock (cantidad <= 0) NO puedan verse para los clientes."""
        # Producto outlet con cantidad 0
        self.product.quantity = 0
        self.product.save()

        # Producto outlet con stock disponible
        available_outlet = Product.objects.create(
            product_name='Mueble Outlet Disponible',
            product_type=self.product_type,
            price=120.00,
            is_active=True,
            is_outlet=True,
            quantity=3
        )

        # Producto regular sin stock (se fabrica bajo pedido -> SÍ visible para clientes)
        regular_prod_zero_stock = Product.objects.create(
            product_name='Producto Regular Bajo Pedido',
            product_type=self.product_type,
            price=150.00,
            is_active=True,
            is_outlet=False,
            quantity=0
        )

        response = self.client.get('/api/products/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in response.data]
        self.assertNotIn(self.product.id, ids)  # Outlet sin stock NO se muestra a clientes
        self.assertIn(available_outlet.id, ids)  # Outlet con stock SÍ se muestra
        self.assertIn(regular_prod_zero_stock.id, ids)  # Producto regular con stock 0 SÍ se muestra

    def test_product_main_color_and_stock_fields(self):
        """Verifica los campos main_color, color_principal y el alias stock."""
        prod = Product.objects.create(
            product_name='Mueble Color Nogal',
            product_type=self.product_type,
            price=180.00,
            quantity=12,
            main_color='Nogal Oscuro'
        )
        self.assertEqual(prod.stock, 12)
        self.assertEqual(prod.color_principal, 'Nogal Oscuro')

        response = self.client.get(f'/api/products/products/{prod.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stock'], 12)
        self.assertEqual(response.data['quantity'], 12)
        self.assertEqual(response.data['main_color'], 'Nogal Oscuro')
        self.assertEqual(response.data['color_principal'], 'Nogal Oscuro')

    def test_outlet_zero_stock_retrieve_404_for_clients_200_for_staff(self):
        """Verifica que un cliente reciba 404 al intentar ver el detalle de un outlet sin stock, mientras que el admin lo puede ver."""
        self.product.quantity = 0
        self.product.save()

        # Cliente intenta ver detalle
        res_client = self.client.get(f'/api/products/products/{self.product.id}/')
        self.assertEqual(res_client.status_code, status.HTTP_404_NOT_FOUND)

        # Admin intenta ver detalle
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.get(f'/api/products/products/{self.product.id}/')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin.data['id'], self.product.id)

    def test_featured_and_favorites_exclude_zero_stock_outlet_for_clients(self):
        """Verifica que productos outlet sin stock no se muestren en destacados ni en favoritos para clientes."""
        outlet_destacado_sin_stock = Product.objects.create(
            product_name='Outlet Destacado Agotado',
            product_type=self.product_type,
            price=70.00,
            is_active=True,
            is_outlet=True,
            is_feature_product=True,
            quantity=0
        )
        regular_destacado_sin_stock = Product.objects.create(
            product_name='Regular Destacado Sin Stock',
            product_type=self.product_type,
            price=200.00,
            is_active=True,
            is_outlet=False,
            is_feature_product=True,
            quantity=0
        )

        # Endpoint destacados
        res_featured = self.client.get('/api/products/featured-products/')
        self.assertEqual(res_featured.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in res_featured.data]
        self.assertNotIn(outlet_destacado_sin_stock.id, ids)
        self.assertIn(regular_destacado_sin_stock.id, ids)

        # Endpoint favoritos
        FavoriteProduct.objects.create(user=self.client_user, product=outlet_destacado_sin_stock)
        FavoriteProduct.objects.create(user=self.client_user, product=regular_destacado_sin_stock)

        self.client.force_authenticate(user=self.client_user)
        res_favs = self.client.get('/api/products/favorites/')
        self.assertEqual(res_favs.status_code, status.HTTP_200_OK)
        fav_ids = [p['id'] for p in res_favs.data]
        self.assertNotIn(outlet_destacado_sin_stock.id, fav_ids)
        self.assertIn(regular_destacado_sin_stock.id, fav_ids)


class ProductCreationAPITest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='adminuser',
            email='admin@example.com',
            password='adminpassword'
        )
        self.product_type = ProductType.objects.create(product_type_name='Estanterías Modulares')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_create_product_with_empty_and_blob_media_strings(self):
        """Verifica que strings vacíos o URLs blob en product_image y product_video se saniticen sin generar 400 Bad Request."""
        payload = {
            'product_name': 'Estante Escandinavo',
            'product_type': self.product_type.id,
            'price': '199.99',
            'description': 'Estante de pino natural',
            'product_image': 'blob:http://localhost:8000/some-blob-uuid',
            'product_video': '',
            'colors_data': '[{"color_name": "Azul Rey", "color_hex": "#0272bc"}]',
            'angles_data': '[{"angle": "Vista Frontal"}, {"angle": "Perspectiva 3/4"}]'
        }
        response = self.client.post('/api/products/products/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data
        self.assertEqual(data['product_name'], 'Estante Escandinavo')
        self.assertEqual(len(data['color_images']), 1)
        self.assertEqual(data['color_images'][0]['color_name'], 'Azul Rey')
        self.assertEqual(data['color_images'][0]['color_hex'], '#0272bc')
        self.assertEqual(len(data['angle_images']), 2)
        self.assertEqual(data['angle_images'][0]['angle'], 'Vista Frontal')
        self.assertEqual(data['angle_images'][1]['angle'], 'Perspectiva 3/4')

    def test_create_product_with_uploaded_files(self):
        """Verifica la subida de archivos multipart con portada, variante de color y ángulo."""
        small_gif = b'GIF89a\x01\x00\x01\x00\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
        main_img = SimpleUploadedFile('portada.gif', small_gif, content_type='image/gif')
        color_img = SimpleUploadedFile('color.gif', small_gif, content_type='image/gif')
        angle_img = SimpleUploadedFile('angle.gif', small_gif, content_type='image/gif')

        payload = {
            'product_name': 'Estante Roble Nórdico',
            'product_type': self.product_type.id,
            'price': '250.00',
            'product_image': main_img,
            'colors_data': '[{"color_name": "Roble Natural", "color_hex": "#D2B48C"}]',
            'color_file_0': color_img,
            'angles_data': '[{"angle": "Vista Lateral"}]',
            'angle_file_0': angle_img
        }
        response = self.client.post('/api/products/products/', payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data
        self.assertTrue(data['product_image'])
        self.assertEqual(len(data['color_images']), 1)
        self.assertTrue(data['color_images'][0]['color_image'])
        self.assertEqual(len(data['angle_images']), 1)
        self.assertTrue(data['angle_images'][0]['image'])


class ProductTypeProductsCountTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.pt_armarios = ProductType.objects.create(product_type_name='Armarios Test')
        self.pt_vacio = ProductType.objects.create(product_type_name='Vacio Test')

        Product.objects.create(
            product_name='Armario 1',
            product_type=self.pt_armarios,
            price=100.00
        )
        Product.objects.create(
            product_name='Armario 2',
            product_type=self.pt_armarios,
            price=150.00
        )
        # Producto eliminado no debe contar
        deleted_prod = Product.objects.create(
            product_name='Armario Borrado',
            product_type=self.pt_armarios,
            price=200.00
        )
        deleted_prod.is_deleted = True
        deleted_prod.save()

    def test_product_types_endpoint_returns_correct_products_count(self):
        """Verifica que /api/products/product-types/ devuelve products_count y count exactos."""
        response = self.client.get('/api/products/product-types/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        items = response.data if isinstance(response.data, list) else response.data.get('results', [])
        armarios_data = next((item for item in items if item['id'] == self.pt_armarios.id), None)
        vacio_data = next((item for item in items if item['id'] == self.pt_vacio.id), None)

        self.assertIsNotNone(armarios_data)
        self.assertEqual(armarios_data['products_count'], 2)
        self.assertEqual(armarios_data['count'], 2)

        self.assertIsNotNone(vacio_data)
        self.assertEqual(vacio_data['products_count'], 0)
        self.assertEqual(vacio_data['count'], 0)




