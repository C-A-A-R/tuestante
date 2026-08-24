from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField

from apps.usuarios.models import Usuario


class UsuarioCreacionForm(forms.ModelForm):
    """Formulario de creacion para el admin (con confirmacion de contrasena)."""

    password1 = forms.CharField(label="Contrasena", widget=forms.PasswordInput)
    password2 = forms.CharField(label="Confirmar contrasena", widget=forms.PasswordInput)

    class Meta:
        model = Usuario
        fields = ("username", "email", "first_name", "last_name", "habitante")

    def clean_password2(self):
        p1 = self.cleaned_data.get("password1")
        p2 = self.cleaned_data.get("password2")
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError("Las contrasenas no coinciden")
        return p2

    def save(self, commit=True):
        usuario = super().save(commit=False)
        usuario.set_password(self.cleaned_data["password1"])
        if commit:
            usuario.save()
        return usuario


class UsuarioCambioForm(forms.ModelForm):
    """Formulario de edicion para el admin; muestra contrasena en modo solo lectura."""

    password = ReadOnlyPasswordHashField()

    class Meta:
        model = Usuario
        fields = "__all__"

    def clean_password(self):
        return self.initial.get("password")


@admin.register(Usuario)
class UsuarioAdmin(DjangoUserAdmin):
    form = UsuarioCambioForm
    add_form = UsuarioCreacionForm

    list_display = [
        "username",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_staff",
        "is_superuser",
        "state",
        "eliminado",
        "historical",
    ]

    fieldsets = (
        (None, {"fields": ("username", "email", "password")}),
        (
            "Datos personales",
            {"fields": ("first_name", "last_name", "habitante")},
        ),
        (
            "Permisos",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                    "state",
                )
            },
        ),
        ("Fechas importantes", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "first_name",
                    "last_name",
                    "habitante",
                    "password1",
                    "password2",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "state",
                ),
            },
        ),
    )

    search_fields = ["username", "email", "first_name", "last_name"]
    list_filter = ["is_active", "is_staff", "is_superuser", "state"]
    ordering = ["-date_joined"]
