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
    GoogleAuthSerializer,
    CompleteProfileSerializer,
)
from apps.user.models import User
from apps.user.services.password_service import (
    send_password_reset_email,
    reset_user_password,
    get_user_by_uidb64,
    is_valid_password_reset_token,
)
from apps.user.utils.email_tokens import check_activation_token
from apps.user.utils.email_service import EmailDeliveryError


class UserRegisterView(APIView):
    """Vista para registrar usuarios."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)

        username = data.get("username") or data.get("nombre_usuario")
        email = data.get("email") or data.get("correo")
        
        is_admin_requester = bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )
        if not is_admin_requester:
            data["is_staff"] = False
            data["is_superuser"] = False

        # Cuando no se recibe username y no sea un administrador, reemplaza el username por el correo
        if not username and email:
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

        try:
            send_password_reset_email(user, request)
        except EmailDeliveryError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
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

        is_employee = False
        try:
            from apps.employee_store.models import EmployeeProfile
            is_employee = EmployeeProfile.objects.filter(
                user=auth_user,
                is_deleted=False,
                is_active=True
            ).exists()
        except Exception:
            is_employee = False

        return Response(
            {
                "message": "Inicio de sesión exitoso",
                "user": UserSerializer(auth_user).data,
                "is_staff": auth_user.is_staff,
                "is_superuser": auth_user.is_superuser,
                "is_employee": is_employee,
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


def verify_google_id_token(credential):
    """
    Verifica una credencial/ID Token de Google Identity Services.
    Consulta el endpoint oficial de Google: https://oauth2.googleapis.com/tokeninfo?id_token=...
    Retorna el diccionario con la información del usuario de Google o lanza ValidationError si es inválido.
    """
    import urllib.request
    import urllib.error
    import json
    from django.conf import settings

    if not credential or not isinstance(credential, str):
        raise serializers.ValidationError({"credential": "La credencial de Google es requerida."})

    credential_str = credential.strip()
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential_str}"
    payload = None

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'TuEstante-Backend'})
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                payload = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        # Si falla en Google o si estamos en entorno local/test con un token mock
        if settings.DEBUG:
            try:
                import jwt
                payload = jwt.decode(credential_str, options={"verify_signature": False})
            except Exception:
                pass

        if not payload:
            err_msg = "Token de Google no válido o expirado."
            try:
                err_data = json.loads(e.read().decode('utf-8'))
                if 'error_description' in err_data:
                    err_msg = err_data['error_description']
            except Exception:
                pass
            raise serializers.ValidationError({"credential": f"Error de verificación con Google: {err_msg}"})
    except urllib.error.URLError as e:
        if settings.DEBUG:
            try:
                import jwt
                payload = jwt.decode(credential_str, options={"verify_signature": False})
            except Exception:
                raise serializers.ValidationError({"credential": f"No se pudo contactar al servidor de Google: {str(e.reason)}"})
        else:
            raise serializers.ValidationError({"credential": f"No se pudo contactar al servidor de Google: {str(e.reason)}"})
    except Exception as e:
        raise serializers.ValidationError({"credential": f"Error al procesar el token de Google: {str(e)}"})

    if not payload or not isinstance(payload, dict):
        raise serializers.ValidationError({"credential": "No se pudo obtener información válida del token de Google."})

    if not payload.get('sub') or not payload.get('email'):
        raise serializers.ValidationError({"credential": "El token de Google no contiene la información mínima requerida (sub o email)."})

    # Validar client_id si está configurado en settings
    google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None)
    if google_client_id and str(google_client_id).strip():
        aud = payload.get('aud')
        azp = payload.get('azp')
        if aud != google_client_id and azp != google_client_id:
            raise serializers.ValidationError({"credential": "El token no corresponde al Client ID configurado para esta aplicación."})

    return payload


class GoogleAuthView(APIView):
    """
    Vista para iniciar sesión o registrarse mediante Google Identity Services.
    Recibe la credencial (ID token) emitida por Google.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        credential = serializer.validated_data["credential"]

        payload = verify_google_id_token(credential)

        google_id = str(payload.get("sub")).strip()
        email = str(payload.get("email")).strip().lower()
        given_name = str(payload.get("given_name") or payload.get("name") or "").strip()
        family_name = str(payload.get("family_name") or "").strip()
        avatar_url = str(payload.get("picture") or "").strip()

        # 1. Buscar usuario existente por google_id
        user = User.objects.filter(google_id=google_id, is_deleted=False).first()
        is_new_user = False

        if not user:
            # 2. Si no existe por google_id, buscar por correo
            user = User.objects.filter(email__iexact=email, is_deleted=False).first()
            if user:
                # Vincular google_id al usuario existente
                user.google_id = google_id
                if not user.avatar_url and avatar_url:
                    user.avatar_url = avatar_url
                if not user.is_active:
                    user.is_active = True
                user.save()
            else:
                # 3. Crear nuevo usuario a partir de los datos de Google
                is_new_user = True
                user = User(
                    username=email,
                    email=email,
                    first_name=given_name,
                    first_last_name=family_name,
                    google_id=google_id,
                    avatar_url=avatar_url or None,
                    is_active=True,
                    is_registered=True,
                )
                user.set_unusable_password()
                user.save()

        # Comprobar si el perfil está completo (Cédula, Teléfono y Fecha de Nacimiento obligatoria)
        profile_completed = bool(
            user.identity_document
            and user.phone
            and user.birth_date
        )

        refresh = RefreshToken.for_user(user)

        is_employee = False
        try:
            from apps.employee_store.models import EmployeeProfile
            is_employee = EmployeeProfile.objects.filter(
                user=user,
                is_deleted=False,
                is_active=True
            ).exists()
        except Exception:
            is_employee = False

        return Response(
            {
                "message": "Autenticación con Google exitosa.",
                "user": UserSerializer(user).data,
                "is_new_user": is_new_user,
                "profile_completed": profile_completed,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "is_employee": is_employee,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_200_OK,
        )


class UserProfileView(APIView):
    """
    Vista para consultar y actualizar el perfil del usuario autenticado actual.
    Permite culminar el registro (cédula, teléfono que sólo admite números y +, fecha de nacimiento obligatoria).
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = CompleteProfileSerializer(
            instance=request.user,
            data=request.data,
            partial=True,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        profile_completed = bool(
            user.identity_document
            and user.phone
            and user.birth_date
        )

        return Response(
            {
                "message": "Perfil actualizado exitosamente.",
                "user": UserSerializer(user).data,
                "profile_completed": profile_completed
            },
            status=status.HTTP_200_OK
        )

    def put(self, request):
        return self.patch(request)

