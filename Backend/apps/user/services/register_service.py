from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from apps.usuarios.utils.email_tokens import account_activation_token
from apps.usuarios.utils.email_service import send_html_email


def send_account_activation_email(user, request):
    """
    Envía un email de activación de cuenta al usuario.
    """
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = account_activation_token.make_token(user)
    activation_link = f"{request.scheme}://{request.get_host()}/api/usuarios/activar/{uid}/{token}/"
    text_content = (
        f"Hola {user.username},\n\n"
        "Gracias por registrarte. Para activar tu cuenta, haz clic en el siguiente enlace:\n"
        f"{activation_link}\n\n"
        "Si no creaste esta cuenta, puedes ignorar este correo.\n\n"
        "Gracias,\nEl equipo de Diegos Grill"
    )
    send_html_email(
        subject='Activa tu cuenta',
        to_email=user.email,
        template_name='activate_account_email.html',
        context={'user': user, 'activation_link': activation_link},
        text_content=text_content
    )
