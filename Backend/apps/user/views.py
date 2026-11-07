from django.shortcuts import render
from django.views import View

from apps.user.utils.email_tokens import check_activation_token


class AccountActivationView(View):
    """Muestra el resultado de la activación de cuenta en HTML."""

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
            context = {"success": False, "message": "El enlace de activación no es válido o ha expirado."}

        return render(request, "activate_acount_screen.html", context)

