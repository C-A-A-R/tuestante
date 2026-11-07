from rest_framework.routers import DefaultRouter
from apps.payment.api.views import PaymentViewSet

router = DefaultRouter()
router.register(r'payments', PaymentViewSet, basename='payments')

urlpatterns = router.urls
