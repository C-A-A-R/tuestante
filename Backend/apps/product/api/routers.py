from django.urls import path
from rest_framework.routers import DefaultRouter
from apps.product.api.views import (
    ProductTypeViewSet,
    ProductViewSet,
    FeaturedProductsAPIView,
    FeaturedProductsLeastFavoritesAPIView,
    UserFavoritesAPIView,
    ToggleFavoriteAPIView,
    FavoriteProductAPIView
)

router = DefaultRouter()

router.register(r'product-types', ProductTypeViewSet, basename='product-types')
router.register(r'products', ProductViewSet, basename='products')

urlpatterns = [
    # Productos destacados
    path('featured-products/', FeaturedProductsAPIView.as_view(), name='featured-products'),
    path('featured-products/least-favorites/', FeaturedProductsLeastFavoritesAPIView.as_view(), name='featured-products-least-favorites'),
    path('featured-products-least-favorites/', FeaturedProductsLeastFavoritesAPIView.as_view(), name='featured-products-least-favorites-alias'),
    path('featured-products/ascending-favorites/', FeaturedProductsLeastFavoritesAPIView.as_view(), name='featured-products-ascending-favorites'),

    # Favoritos / Wishlist del usuario autenticado
    path('favorites/', UserFavoritesAPIView.as_view(), name='user-favorites'),
    path('wishlist/', UserFavoritesAPIView.as_view(), name='user-wishlist'),

    # Gestión de favorito por producto (POST / DELETE)
    path('favorites/<int:product_id>/', FavoriteProductAPIView.as_view(), name='favorite-product-detail'),
    path('wishlist/<int:product_id>/', FavoriteProductAPIView.as_view(), name='wishlist-product-detail'),

    # Alternar (toggle) favorito de un producto (POST)
    path('favorites/<int:product_id>/toggle/', ToggleFavoriteAPIView.as_view(), name='toggle-favorite'),
    path('wishlist/<int:product_id>/toggle/', ToggleFavoriteAPIView.as_view(), name='wishlist-toggle'),
] + router.urls
