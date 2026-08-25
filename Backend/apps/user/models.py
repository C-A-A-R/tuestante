from django.db import models
from django.contrib.auth.models import AbstractUser, PermissionsMixin
from django.utils import timezone

from apps.base.models import BaseModel


class User(AbstractUser, PermissionsMixin, BaseModel):
    """Modelo de Usuario personalizado que hereda de BaseModel y AbstractUser."""

    # Campos básicos de identificación
    username = models.CharField(
        'Nombre de usuario',
        max_length=150,
        unique=True,
        help_text='Requerido. 150 caracteres o menos. Solo letras, dígitos y @/./+/-/_'
    )
    email = models.EmailField(
        'Correo electrónico',
        unique=True,
        help_text='Correo electrónico único del usuario'
    )
    
    # Campos de estado del usuario
    is_staff = models.BooleanField(
        'Es personal',
        default=False,
        help_text='Indica si el usuario puede acceder al sitio de administración'
    )
    is_superuser = models.BooleanField(
        'Es superusuario',
        default=False,
        help_text='Indica si el usuario tiene todos los permisos sin asignarlos explícitamente'
    )
    is_active = models.BooleanField(
        'Está activo',
        default=False,
        help_text='Indica si el usuario debe ser tratado como activo'
    )
    
    # Campos de fechas
    last_login = models.DateTimeField(
        'Último acceso',
        null=True,
        blank=True,
        help_text='Fecha y hora del último acceso del usuario'
    )
    date_joined = models.DateTimeField(
        'Fecha de registro',
        default=timezone.now,
        help_text='Fecha y hora cuando el usuario se registró'
    )
    
    # Campos de información personal e identidad
    first_name = models.CharField(
        'Primer nombre',
        max_length=150,
        blank=True,
        help_text='Primer nombre del usuario'
    )
    second_name = models.CharField(
        'Segundo nombre',
        max_length=150,
        blank=True,
        help_text='Segundo nombre del usuario'
    )
    first_last_name = models.CharField(
        'Primer apellido',
        max_length=150,
        blank=True,
        help_text='Primer apellido del usuario'
    )
    second_last_name = models.CharField(
        'Segundo apellido',
        max_length=150,
        blank=True,
        help_text='Segundo apellido del usuario'
    )
    identity_document = models.CharField(
        'Documento de identidad',
        max_length=30,
        unique=True,
        null=True,
        blank=True,
        help_text='Número o documento de identidad del usuario'
    )
    birth_date = models.DateField(
        'Fecha de nacimiento',
        null=True,
        blank=True,
        help_text='Fecha de nacimiento del usuario'
    )
    
    # Campos de contacto
    phone = models.CharField(
        'Teléfono',
        max_length=20,
        blank=True,
        help_text='Número de teléfono del usuario'
    )


    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name']

    def __str__(self):
        """String representation of User."""
        return f"{self.username} - {self.get_full_name() or self.email}"

    def get_full_name(self):
        """Retorna el nombre completo del usuario concatenando nombres y apellidos."""
        name_parts = [
            self.first_name,
            self.second_name,
            self.last_name,
            self.second_last_name,
        ]
        full_name = " ".join(part for part in name_parts if part)
        return full_name or self.username

    def get_short_name(self):
        """Retorna el nombre corto del usuario."""
        return self.first_name or self.username

    def delete(self, using=None, keep_parents=False):
        """Desactiva el usuario al realizar el borrado lógico."""
        self.is_active = False
        super().delete(using=using, keep_parents=keep_parents)


