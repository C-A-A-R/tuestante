from rest_framework.routers import DefaultRouter
from apps.shipment.api.views import DistributorViewSet, DistributorCoverageViewSet, ShipmentViewSet

router = DefaultRouter()
router.register(r'distributors', DistributorViewSet, basename='distributors')
router.register(r'distributor-coverages', DistributorCoverageViewSet, basename='distributor-coverages')
router.register(r'shipments', ShipmentViewSet, basename='shipments')

urlpatterns = router.urls

