from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField

from apps.user.models import User
from apps.base.admin import BaseAdmin


class UserCreationForm(forms.ModelForm):
    """Formulario de creación para el admin (con confirmación de contraseña)."""

    password1 = forms.CharField(label="Contraseña", widget=forms.PasswordInput)
    password2 = forms.CharField(label="Confirmar contraseña", widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "first_name",
            "second_name",
            "first_last_name",
            "second_last_name",
            "identity_document",
            "phone",
        )

    def clean_password2(self):
        p1 = self.cleaned_data.get("password1")
        p2 = self.cleaned_data.get("password2")
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError("Las contraseñas no coinciden")
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
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
        "identity_document",
        "phone",
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
                    "identity_document",
                    "birth_date",
                    "phone",
                )
            },
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
                    "identity_document",
                    "phone",
                    "password1",
                    "password2",
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
    list_filter = ["is_active", "is_staff", "is_superuser", "is_deleted", "created_at"]
    ordering = ["-date_joined"]
