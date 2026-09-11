from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.employee_store.api.views import (
    EmployeeProfileViewSet,
    InternalCategoryViewSet,
    InternalSubCategoryViewSet,
    InternalProductViewSet,
    InternalOrderViewSet,
    DebtPaymentViewSet,
    SettlementReportAPIView,
    GlobalSearchAPIView,
)

router = DefaultRouter()
router.register(r'employees', EmployeeProfileViewSet, basename='employee-profiles')
router.register(r'categories', InternalCategoryViewSet, basename='internal-categories')
router.register(r'subcategories', InternalSubCategoryViewSet, basename='internal-subcategories')
router.register(r'products', InternalProductViewSet, basename='internal-products')
router.register(r'orders', InternalOrderViewSet, basename='internal-orders')
router.register(r'payments', DebtPaymentViewSet, basename='debt-payments')

urlpatterns = [
    path('reports/settlement/', SettlementReportAPIView.as_view(), name='settlement-report'),
    path('global-search/', GlobalSearchAPIView.as_view(), name='global-search'),
] + router.urls
