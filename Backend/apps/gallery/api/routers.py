from rest_framework.routers import DefaultRouter
from apps.gallery.api.views import GalleryViewSet

router = DefaultRouter()
router.register(r'', GalleryViewSet, basename='gallery')

urlpatterns = router.urls
