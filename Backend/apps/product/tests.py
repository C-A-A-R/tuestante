from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.product.models import Product, ProductType, Category, FavoriteProduct

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
        self.category = Category.objects.create(category_name='Sala')
        self.product_type = ProductType.objects.create(product_type_name='Estantería')

        self.product1 = Product.objects.create(
            product_name='Estante Minimalista',
            product_type=self.product_type,
            price=120.00
        )
        self.product1.categories.add(self.category)

        self.product2 = Product.objects.create(
            product_name='Estante Flotante',
            product_type=self.product_type,
            price=80.00
        )
        self.product2.categories.add(self.category)

        self.product3 = Product.objects.create(
            product_name='Estante Modular',
            product_type=self.product_type,
            price=150.00
        )
        self.product3.categories.add(self.category)

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

    def test_unauthenticated_toggle_favorite_forbidden(self):
        """Verifica que un usuario anónimo no pueda marcar productos como favoritos."""
        response = self.client.post(f'/api/products/favorites/{self.product1.id}/toggle/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
