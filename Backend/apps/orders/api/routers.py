from rest_framework.routers import DefaultRouter
from apps.orders.api.api import OrderViewSet, ManufacturingOrderViewSet

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='orders')
router.register(r'manufacturing-orders', ManufacturingOrderViewSet, basename='manufacturing-orders')

urlpatterns = router.urls
