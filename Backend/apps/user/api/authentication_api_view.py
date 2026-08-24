from django.contrib.auth import authenticate
from django.shortcuts import render
from rest_framework import serializers, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.usuarios.api.permisos import EsLider, PuedeActualizarContrasena
from apps.usuarios.api.serializers import (
    UsuarioCrearSerializer,
    UsuarioSerializer,
    CambioContrasenaSerializer,
    SolicitudRestablecimientoContrasenaSerializer,
    ConfirmacionRestablecimientoContrasenaSerializer,
)
from apps.usuarios.models import Usuario
from apps.usuarios.services.password_service import (
    send_password_reset_email,
    reset_user_password,
    get_user_by_uidb64,
    is_valid_password_reset_token,
)
from apps.usuarios.utils.email_tokens import check_activation_token


class RegistroUsuarioView(APIView):
    """Vista para registrar usuarios (solo Lider)."""

    permission_classes = [EsLider]

    def post(self, request):
        serializer = UsuarioCrearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return Response(
            {
                "message": "Usuario registrado exitosamente.",
                "user": UsuarioSerializer(usuario).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ActivarCuentaView(APIView):
    """Vista para activar la cuenta del usuario desde el enlace del correo."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, uidb64, token):
        usuario = check_activation_token(uidb64, token)
        if usuario:
            if not usuario.is_active:
                usuario.is_active = True
                usuario.state = True
                usuario.save(update_fields=["is_active", "state"])
                contexto = {"success": True, "message": "Cuenta activada exitosamente."}
            else:
                contexto = {"success": True, "message": "La cuenta ya estaba activada."}
        else:
            contexto = {"success": False, "message": "El enlace de activación no es válido o expiró."}

        return render(request, "activate_acount_screen.html", contexto)


class SolicitarRestablecimientoContrasenaView(APIView):
    """Vista para solicitar el restablecimiento de contrasena."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SolicitudRestablecimientoContrasenaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correo = serializer.validated_data["correo_electronico"]

        try:
            usuario = Usuario.objects.get(email=correo, state=True, eliminado=False)
        except Usuario.DoesNotExist:
            return Response({"error": "No existe una cuenta con ese correo."}, status=status.HTTP_404_NOT_FOUND)

        send_password_reset_email(usuario, request)
        return Response({"message": "Si el correo existe, se envio un enlace para restablecer la contrasena."})


class ConfirmarRestablecimientoContrasenaView(APIView):
    """Vista para confirmar el restablecimiento de contrasena."""

    permission_classes = [permissions.AllowAny]

    def post(self, request, uidb64, token):
        serializer = ConfirmacionRestablecimientoContrasenaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        usuario = get_user_by_uidb64(uidb64)
        if not usuario:
            return Response({"error": "El enlace no es valido."}, status=status.HTTP_400_BAD_REQUEST)

        if not is_valid_password_reset_token(usuario, token):
            return Response({"error": "El enlace ha expirado o no es valido."}, status=status.HTTP_400_BAD_REQUEST)

        reset_user_password(usuario, serializer.validated_data["nueva_contrasena"])
        return Response({"message": "Contrasena restablecida exitosamente."})


class InicioSesionView(APIView):
    """Vista para inicio de sesion."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        nombre_usuario = request.data.get("nombre_usuario") or request.data.get("username")
        contrasena = request.data.get("contrasena") or request.data.get("password")

        if not nombre_usuario or not contrasena:
            return Response(
                {"error": "Debe proporcionar nombre_usuario y contrasena"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            usuario = Usuario.objects.get(username=nombre_usuario)
        except Usuario.DoesNotExist:
            return Response({"error": "Credenciales invalidas"}, status=status.HTTP_401_UNAUTHORIZED)

        if not usuario.is_active:
            return Response(
                {"error": "La cuenta esta desactivada"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not usuario.state:
            return Response(
                {"error": "La cuenta ha sido eliminada"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if usuario.eliminado:
            return Response(
                {"error": "La cuenta ha sido eliminada"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        auth_user = authenticate(request, username=nombre_usuario, password=contrasena)
        if not auth_user:
            return Response({"error": "Credenciales invalidas"}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(auth_user)

        return Response(
            {
                "message": "Inicio de sesion exitoso",
                "user": UsuarioSerializer(auth_user).data,
                "grupos": list(auth_user.groups.values_list("name", flat=True)),
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_200_OK,
        )


class CerrarSesionView(APIView):
    """Vista para cerrar sesion."""

    permission_classes = [EsLider]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                return Response(
                    {"message": "Sesion cerrada exitosamente"},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": "Se requiere refresh_token"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response({"error": "Token invalido"}, status=status.HTTP_400_BAD_REQUEST)


class RenovarTokenView(APIView):
    """Vista para renovar el token de acceso."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            if refresh_token:
                token = RefreshToken(refresh_token)
                return Response(
                    {"access": str(token.access_token), "refresh": str(token)},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": "Se requiere refresh_token"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response(
                {"error": "Token invalido o expirado"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class CambiarContrasenaView(APIView):
    """Vista para cambiar contrasena con permisos diferenciados."""

    permission_classes = [permissions.IsAuthenticated, PuedeActualizarContrasena]

    def get_object(self):
        """
        Obtiene el usuario que se va a modificar basado en el usuario_id en request.data.
        Esto permite que el permiso PuedeActualizarContrasena funcione correctamente.
        """
        # Primero validamos los datos para obtener el usuario_id
        serializer = CambioContrasenaSerializer(data=self.request.data, context={"request": self.request})
        serializer.is_valid(raise_exception=True)
        
        usuario_id = serializer.validated_data.get("usuario_id")
        
        if usuario_id:
            try:
                return Usuario.objects.get(id=usuario_id, state=True, eliminado=False)
            except Usuario.DoesNotExist:
                raise serializers.ValidationError({"usuario_id": "Usuario no encontrado"})
        else:
            # Si no se proporciona usuario_id, se asume que el usuario quiere cambiar su propia contraseña
            return self.request.user

    def post(self, request):
        # Primero obtenemos el objeto para que los permisos puedan validarlo
        try:
            usuario_a_modificar = self.get_object()
        except serializers.ValidationError as e:
            return Response(
                {"error": str(e.detail)},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        # Ahora validamos los datos completos del serializer
        serializer = CambioContrasenaSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        
        # Cambiar la contraseña
        usuario_a_modificar.set_password(serializer.validated_data["nueva_contrasena"])
        usuario_a_modificar.save(update_fields=["password"])

        return Response(
            {"message": {
                "titulo": "Contraseña actualizada",
                "mensaje": "La contraseña se actualizo exitosamente.",
                "tipo": "success",
                }
            },
            status=status.HTTP_200_OK,
        )
