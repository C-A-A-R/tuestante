from rest_framework.routers import DefaultRouter
from apps.project.api.views import ProjectViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')

urlpatterns = router.urls
