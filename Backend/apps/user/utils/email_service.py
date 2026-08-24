from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings


def send_html_email(subject, to_email, template_name, context, from_email=None, text_content=None):
    """
    Envía un email usando una plantilla HTML y contexto.
    - subject: Asunto del email
    - to_email: Lista o string con el destinatario
    - template_name: Ruta de la plantilla HTML (por ejemplo, 'emails/activate_account.html')
    - context: Diccionario de contexto para la plantilla
    - from_email: Remitente (opcional, usa DEFAULT_FROM_EMAIL si no se especifica)
    """
    from_email = from_email or settings.DEFAULT_FROM_EMAIL
    html_content = render_to_string(template_name, context)
    if not text_content:
        try:
            text_content = render_to_string(template_name.replace('.html', '.txt'), context)
        except Exception:
            # Si no hay plantilla de texto, usar solo el HTML como texto plano
            import re
            text_content = re.sub('<[^<]+?>', '', html_content)

    msg = EmailMultiAlternatives(subject, text_content, from_email, [to_email] if isinstance(to_email, str) else to_email)
    msg.attach_alternative(html_content, "text/html")
    msg.send()
