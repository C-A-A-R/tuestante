from django.contrib.auth import authenticate
from django.db.models import Q
from django.shortcuts import render
from rest_framework import serializers, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.user.api.permisos import IsAdmin, CanUpdatePassword
from apps.user.api.serializers import (
    UserCreateSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from apps.user.models import User
from apps.user.services.password_service import (
    send_password_reset_email,
    reset_user_password,
    get_user_by_uidb64,
    is_valid_password_reset_token,
)
from apps.user.utils.email_tokens import check_activation_token


class UserRegisterView(APIView):
    """Vista para registrar usuarios (solo Administrador o Superusuario)."""

    permission_classes = [IsAdmin]

    def post(self, request):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)

        username = data.get("username") or data.get("nombre_usuario")
        email = data.get("email") or data.get("correo")
        is_staff = data.get("is_staff", False)
        is_superuser = data.get("is_superuser", False)

        # Cuando no se recibe username y no sea un administrador, reemplaza el username por el correo
        if not username and not is_staff and not is_superuser and email:
            data["username"] = email

        serializer = UserCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "message": "Usuario registrado exitosamente.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ActivateAccountView(APIView):
    """Vista para activar la cuenta del usuario desde el enlace del correo."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, uidb64, token):
        user = check_activation_token(uidb64, token)
        if user:
            if not user.is_active:
                user.is_active = True
                user.save(update_fields=["is_active"])
                context = {"success": True, "message": "Cuenta activada exitosamente."}
            else:
                context = {"success": True, "message": "La cuenta ya estaba activada."}
        else:
            context = {"success": False, "message": "El enlace de activación no es válido o expiró."}

        return render(request, "activate_acount_screen.html", context)


class PasswordResetRequestView(APIView):
    """Vista para solicitar el restablecimiento de contraseña."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email=email, is_deleted=False)
        except User.DoesNotExist:
            return Response({"error": "No existe una cuenta con ese correo."}, status=status.HTTP_404_NOT_FOUND)

        send_password_reset_email(user, request)
        return Response({"message": "Si el correo existe, se envió un enlace para restablecer la contraseña."})


class PasswordResetConfirmView(APIView):
    """Vista para confirmar el restablecimiento de contraseña."""

    permission_classes = [permissions.AllowAny]

    def post(self, request, uidb64, token):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = get_user_by_uidb64(uidb64)
        if not user:
            return Response({"error": "El enlace no es válido."}, status=status.HTTP_400_BAD_REQUEST)

        if not is_valid_password_reset_token(user, token):
            return Response({"error": "El enlace ha expirado o no es válido."}, status=status.HTTP_400_BAD_REQUEST)

        reset_user_password(user, serializer.validated_data["new_password"])
        return Response({"message": "Contraseña restablecida exitosamente."})


class LoginView(APIView):
    """Vista para inicio de sesión."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (
            request.data.get("username")
            or request.data.get("nombre_usuario")
            or request.data.get("email")
            or request.data.get("correo")
        )
        password = request.data.get("password") or request.data.get("contrasena")

        if not username or not password:
            return Response(
                {"error": "Debe proporcionar usuario y contraseña"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Buscar usuario por nombre de usuario o por correo
        user = User.objects.filter(
            Q(username=username) | Q(email=username),
            is_deleted=False
        ).first()

        if not user:
            return Response({"error": "Credenciales inválidas"}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response(
                {"error": "La cuenta está desactivada"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        auth_user = authenticate(request, username=user.username, password=password)
        if not auth_user:
            return Response({"error": "Credenciales inválidas"}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(auth_user)

        return Response(
            {
                "message": "Inicio de sesión exitoso",
                "user": UserSerializer(auth_user).data,
                "is_staff": auth_user.is_staff,
                "is_superuser": auth_user.is_superuser,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_200_OK,
        )



class LogoutView(APIView):
    """Vista para cerrar sesión."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                return Response(
                    {"message": "Sesión cerrada exitosamente"},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": "Se requiere refresh_token"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response({"error": "Token inválido"}, status=status.HTTP_400_BAD_REQUEST)



class TokenRefreshView(APIView):
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
                {"error": "Token inválido o expirado"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class ChangePasswordView(APIView):
    """Vista para cambiar contraseña con permisos diferenciados."""

    permission_classes = [permissions.IsAuthenticated, CanUpdatePassword]

    def get_object(self):
        """
        Obtiene el usuario que se va a modificar basado en user_id en request.data.
        Esto permite que el permiso CanUpdatePassword funcione correctamente.
        """
        serializer = ChangePasswordSerializer(data=self.request.data, context={"request": self.request})
        serializer.is_valid(raise_exception=True)
        
        user_id = serializer.validated_data.get("user_id")
        
        if user_id:
            try:
                return User.objects.get(id=user_id, is_deleted=False)
            except User.DoesNotExist:
                raise serializers.ValidationError({"user_id": "Usuario no encontrado"})
        else:
            return self.request.user

    def post(self, request):
        try:
            user_to_modify = self.get_object()
        except serializers.ValidationError as e:
            return Response(
                {"error": str(e.detail)},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        
        user_to_modify.set_password(serializer.validated_data["new_password"])
        user_to_modify.save(update_fields=["password"])

        return Response(
            {
                "message": {
                    "titulo": "Contraseña actualizada",
                    "mensaje": "La contraseña se actualizó exitosamente.",
                    "tipo": "success",
                }
            },
            status=status.HTTP_200_OK,
        )

