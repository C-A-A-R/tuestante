from rest_framework.routers import DefaultRouter
from apps.production.api.views import ProductionOrderViewSet, ProductionProductViewSet

router = DefaultRouter()
router.register(r'production-orders', ProductionOrderViewSet, basename='production-orders')
router.register(r'ordenes-produccion', ProductionOrderViewSet, basename='ordenes-produccion')
router.register(r'production-products', ProductionProductViewSet, basename='production-products')
router.register(r'productos-produccion', ProductionProductViewSet, basename='productos-produccion')

urlpatterns = router.urls

