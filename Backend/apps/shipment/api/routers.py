from rest_framework.routers import DefaultRouter
from apps.shipment.api.views import DistributorViewSet, ShipmentViewSet

router = DefaultRouter()
router.register(r'distributors', DistributorViewSet, basename='distributors')
router.register(r'shipments', ShipmentViewSet, basename='shipments')

urlpatterns = router.urls
