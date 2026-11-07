from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField

from apps.user.models import User
from apps.base.admin import BaseAdmin


class UserCreationForm(forms.ModelForm):
    """Formulario de creación para el admin (con soporte para usuarios sin contraseña)."""

    password1 = forms.CharField(label="Contraseña", widget=forms.PasswordInput, required=False)
    password2 = forms.CharField(label="Confirmar contraseña", widget=forms.PasswordInput, required=False)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "first_name",
            "second_name",
            "first_last_name",
            "second_last_name",
            "document_type",
            "identity_document",
            "phone",
            "is_registered",
            "is_active",
            "is_staff",
            "is_superuser",
        )

    def clean_password2(self):
        p1 = self.cleaned_data.get("password1")
        p2 = self.cleaned_data.get("password2")
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError("Las contraseñas no coinciden")
        if (p1 and not p2) or (p2 and not p1):
            raise forms.ValidationError("Debe ingresar y confirmar la contraseña")
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        p1 = self.cleaned_data.get("password1")
        if p1:
            user.set_password(p1)
            user.is_registered = True
        else:
            user.set_unusable_password()
            if 'is_registered' not in self.cleaned_data:
                user.is_registered = False
        if commit:
            user.save()
        return user


class UserChangeForm(forms.ModelForm):
    """Formulario de edición para el admin; muestra contraseña en modo solo lectura."""

    password = ReadOnlyPasswordHashField(
        help_text="Las contraseñas no se almacenan como texto plano. "
                  "Para cambiarla use el formulario de cambio de contraseña."
    )

    class Meta:
        model = User
        fields = "__all__"

    def clean_password(self):
        return self.initial.get("password")


@admin.register(User)
class UserAdmin(BaseAdmin, DjangoUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm

    list_display = [
        "id",
        "username",
        "email",
        "first_name",
        "first_last_name",
        "document_type",
        "identity_document",
        "phone",
        "is_registered",
        "is_active",
        "is_staff",
        "is_superuser",
        "created_at",
    ]

    fieldsets = (
        (None, {"fields": ("username", "email", "password")}),
        (
            "Datos personales y de identidad",
            {
                "fields": (
                    "first_name",
                    "second_name",
                    "first_last_name",
                    "second_last_name",
                    "last_name",
                    "document_type",
                    "identity_document",
                    "birth_date",
                    "phone",
                )
            },
        ),
        (
            "Permisos y Estado",
            {
                "fields": (
                    "is_registered",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
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
                    "second_name",
                    "first_last_name",
                    "second_last_name",
                    "document_type",
                    "identity_document",
                    "phone",
                    "password1",
                    "password2",
                    "is_registered",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )

    search_fields = [
        "username",
        "email",
        "first_name",
        "first_last_name",
        "identity_document",
        "phone",
    ]
    list_filter = ["is_registered", "is_active", "is_staff", "is_superuser", "is_deleted", "created_at"]
    ordering = ["-date_joined"]
