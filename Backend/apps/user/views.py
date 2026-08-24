from django.shortcuts import render
from django.views import View

from apps.usuarios.utils.email_tokens import check_activation_token


class VistaActivacionCuenta(View):
	"""Muestra el resultado de la activacion de cuenta en HTML."""

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
			contexto = {"success": False, "message": "El enlace de activacion no es valido o ha expirado."}

		return render(request, "activate_acount_screen.html", contexto)
