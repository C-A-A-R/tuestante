from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.contrib.auth import get_user_model

User = get_user_model()

class EmailTokenGenerator(PasswordResetTokenGenerator):
    """
    Generador de tokens seguros para activación de cuenta y recuperación de contraseña.
    """
    pass

account_activation_token = EmailTokenGenerator()


def generate_activation_link(user, request):
    """
    Genera un enlace único de activación de cuenta para el usuario.
    """
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = account_activation_token.make_token(user)
    domain = request.get_host()
    protocol = 'https' if request.is_secure() else 'http'
    activation_url = f"{protocol}://{domain}/api/usuarios/activar/{uid}/{token}/"
    return activation_url


def check_activation_token(uidb64, token):
    """
    Valida el token de activación y retorna el usuario si es válido, si no retorna None.
    """
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid, is_deleted=False)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None
    if user and account_activation_token.check_token(user, token):
        return user
    return None

