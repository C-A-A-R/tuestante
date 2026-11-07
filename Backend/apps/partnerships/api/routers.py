from rest_framework.routers import DefaultRouter
from apps.partnerships.api.views import PartnershipViewSet

router = DefaultRouter()
router.register(r'partnerships', PartnershipViewSet, basename='partnerships')

urlpatterns = router.urls
