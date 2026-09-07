from rest_framework.routers import DefaultRouter
from apps.production.api.views import ProductionOrderViewSet

router = DefaultRouter()
router.register(r'production-orders', ProductionOrderViewSet, basename='production-orders')
router.register(r'ordenes-produccion', ProductionOrderViewSet, basename='ordenes-produccion')

urlpatterns = router.urls
