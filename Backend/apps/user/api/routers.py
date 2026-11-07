from rest_framework.routers import DefaultRouter
from django.urls import path

from apps.user.api.api import UserViewSet
from apps.user.api.authentication_api_view import (
    UserRegisterView,
    ActivateAccountView,
    LoginView,
    LogoutView,
    TokenRefreshView,
    ChangePasswordView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    GoogleAuthView,
    UserProfileView,
)
from apps.user.report.views import UsuariosReportView

# Router para usuarios (CRUD)
user_router = DefaultRouter()
user_router.register(r"", UserViewSet, basename="users")

# URLs de autenticación
auth_urlpatterns = [
    path("register/", UserRegisterView.as_view(), name="register"),
    path("activate/<uidb64>/<token>/", ActivateAccountView.as_view(), name="activate-account"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("password/change/", ChangePasswordView.as_view(), name="change-password"),
    path("password/reset/", PasswordResetRequestView.as_view(), name="request-password-reset"),
    path("password/reset/confirm/<uidb64>/<token>/", PasswordResetConfirmView.as_view(), name="confirm-password-reset"),
    path("google/", GoogleAuthView.as_view(), name="google-auth"),
    path("profile/", UserProfileView.as_view(), name="user-profile"),

    # Rutas en español para mantener compatibilidad
    path("registro/", UserRegisterView.as_view(), name="registro"),
    path("activar/<uidb64>/<token>/", ActivateAccountView.as_view(), name="activar-cuenta"),
    path("inicio-sesion/", LoginView.as_view(), name="inicio-sesion"),
    path("cerrar-sesion/", LogoutView.as_view(), name="cerrar-sesion"),
    path("renovar-token/", TokenRefreshView.as_view(), name="renovar-token"),
    path("cambiar-contrasena/", ChangePasswordView.as_view(), name="cambiar-contrasena"),
    path("restablecer-contrasena/", PasswordResetRequestView.as_view(), name="solicitar-restablecimiento-contrasena"),
    path("restablecer-contrasena/confirmar/<uidb64>/<token>/", PasswordResetConfirmView.as_view(), name="confirmar-restablecimiento-contrasena"),
    path("perfil/", UserProfileView.as_view(), name="perfil-usuario"),
]

# URLs de usuarios
user_urlpatterns = user_router.urls

# URLs de reportes
report_urlpatterns = [
    path("reports/<str:report_type>/", UsuariosReportView.as_view(), name="users-report"),
    path("reportes/<str:report_type>/", UsuariosReportView.as_view(), name="usuarios-reporte"),
]

# Combinar todas las URLs
urlpatterns = auth_urlpatterns + user_urlpatterns + report_urlpatterns
