from rest_framework.routers import DefaultRouter
from django.urls import path

from apps.usuarios.api.api import UsuarioViewSet
from apps.usuarios.api.authentication_api_view import (
    RegistroUsuarioView,
    ActivarCuentaView,
    InicioSesionView,
    CerrarSesionView,
    RenovarTokenView,
    CambiarContrasenaView,
    SolicitarRestablecimientoContrasenaView,
    ConfirmarRestablecimientoContrasenaView,
)
from apps.usuarios.report.views import UsuariosReportView

# Router para usuarios (CRUD)
user_router = DefaultRouter()
user_router.register(r"", UsuarioViewSet, basename="usuarios")

# URLs de autenticación
auth_urlpatterns = [
    path("registro/", RegistroUsuarioView.as_view(), name="registro"),
    path("activar/<uidb64>/<token>/", ActivarCuentaView.as_view(), name="activar-cuenta"),
    path("inicio-sesion/", InicioSesionView.as_view(), name="inicio-sesion"),
    path("cerrar-sesion/", CerrarSesionView.as_view(), name="cerrar-sesion"),
    path("renovar-token/", RenovarTokenView.as_view(), name="renovar-token"),
    path("cambiar-contrasena/", CambiarContrasenaView.as_view(), name="cambiar-contrasena"),
    path("restablecer-contrasena/", SolicitarRestablecimientoContrasenaView.as_view(), name="solicitar-restablecimiento-contrasena"),
    path("restablecer-contrasena/confirmar/<uidb64>/<token>/", ConfirmarRestablecimientoContrasenaView.as_view(), name="confirmar-restablecimiento-contrasena"),
]

# URLs de usuarios
user_urlpatterns = user_router.urls

# URLs de reportes
report_urlpatterns = [
    path("reportes/<str:report_type>/", UsuariosReportView.as_view(), name="usuarios-reporte"),
]

# Combinar todas las URLs
urlpatterns = auth_urlpatterns + user_urlpatterns + report_urlpatterns
