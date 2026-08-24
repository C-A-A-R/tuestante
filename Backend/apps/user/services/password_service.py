from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from apps.usuarios.utils.email_tokens import account_activation_token
from apps.usuarios.utils.email_service import send_html_email
from django.contrib.auth import get_user_model

User = get_user_model()


def send_password_reset_email(user, request):
    """
    Envía un email de restablecimiento de contraseña al usuario.
    """
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = account_activation_token.make_token(user)
    reset_link = f"{request.scheme}://{request.get_host()}/api/usuarios/restablecer-contrasena/confirmar/{uid}/{token}/"
    text_content = (
        f"Hola {user.username},\n\n"
        "Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para cambiarla:\n"
        f"{reset_link}\n\n"
        "Si no solicitaste este cambio, puedes ignorar este correo.\n\n"
        "Gracias,\nEl equipo de Diegos Grill"
    )
    send_html_email(
        subject='Restablecimiento de Contraseña',
        to_email=user.email,
        template_name='password_reset_email.html',
        context={'user': user, 'reset_link': reset_link},
        text_content=text_content
    )


def reset_user_password(user, new_password):
    """
    Cambia la contraseña del usuario y guarda el modelo.
    """
    user.set_password(new_password)
    user.save()


def get_user_by_uidb64(uidb64):
    """
    Obtiene el usuario a partir del uidb64.
    """
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid, state=True, eliminado=False)
        return user
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def is_valid_password_reset_token(user, token):
    """
    Valida si el token de restablecimiento de contraseña es válido para el usuario.
    """
    return account_activation_token.check_token(user, token)

