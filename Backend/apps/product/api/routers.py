from django.urls import path
from rest_framework.routers import DefaultRouter
from apps.product.api.views import (
    CategoryViewSet,
    ProductTypeViewSet,
    ProductViewSet,
    FeaturedProductsAPIView
)

router = DefaultRouter()

router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'product-types', ProductTypeViewSet, basename='product-types')
router.register(r'products', ProductViewSet, basename='products')

urlpatterns = [
    path('featured-products/', FeaturedProductsAPIView.as_view(), name='featured-products'),
] + router.urls
