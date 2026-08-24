from django.db import models

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager
from datetime import date
from uuid import uuid4

from django.utils import timezone

from apps.base.models import BaseModel
from apps.habitantes.models import Habitante, Vivienda


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def _crear_habitante_placeholder(self):
        vivienda = Vivienda.objects.create(calle="Sin definir")
        habitante = Habitante.objects.create(
            jefe_familia=None,
            primer_nombre="Administrador",
            segundo_nombre="",
            primer_apellido="Sistema",
            segundo_apellido="",
            cedula=f"ADM-{uuid4().hex[:8]}",
            fecha_nacimiento=date(2000, 1, 1),
            telefono=None,
            correo=None,
            fecha_residencia=timezone.now().date(),
            vivienda=vivienda,
            es_jefe_familia=True,
        )
        habitante.jefe_familia = habitante
        habitante.save(update_fields=["jefe_familia"])
        return habitante

    def _crear_usuario(self, nombre_usuario, password=None, crear_habitante=True, **extra_fields):
        if not nombre_usuario:
            raise ValueError("El nombre de usuario es obligatorio")
        if crear_habitante and extra_fields.get("habitante") is None:
            extra_fields["habitante"] = self._crear_habitante_placeholder()
        usuario = self.model(username=nombre_usuario, **extra_fields)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def crear_usuario(self, nombre_usuario, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("is_active", True)
        return self._crear_usuario(nombre_usuario, password, crear_habitante=True, **extra_fields)

    def crear_superusuario(self, nombre_usuario, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("El superusuario debe tener es_administrador=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("El superusuario debe tener es_super_usuario=True.")

        extra_fields.setdefault("habitante", None)
        return self._crear_usuario(
            nombre_usuario,
            password,
            crear_habitante=False,
            **extra_fields,
        )

    def create_user(self, username, email=None, password=None, **extra_fields):
        if email is not None:
            extra_fields.setdefault("email", self.normalize_email(email))
        return self.crear_usuario(username, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        if email is not None:
            extra_fields.setdefault("email", self.normalize_email(email))
        return self.crear_superusuario(username, password, **extra_fields)


class Usuario(AbstractUser, BaseModel):
    """Modelo de usuario del sistema."""

    habitante = models.OneToOneField(
        "habitantes.Habitante",
        on_delete=models.PROTECT,
        related_name="usuario",
        null=True,
        blank=True,
        verbose_name="Habitante",
    )

    username = models.CharField(
        "Nombre de usuario",
        max_length=50,
        unique=True,
        help_text="Requerido. 50 caracteres o menos. Solo letras, digitos y @/./+/-/_",
    )
    email = models.EmailField("Correo electronico", blank=True)
    first_name = models.CharField("Nombre", max_length=150, blank=True)
    last_name = models.CharField("Apellido", max_length=150, blank=True)

    last_login = models.DateTimeField(
        "Ultimo acceso",
        null=True,
        blank=True,
        help_text="Fecha y hora del ultimo acceso del usuario",
    )
    date_joined = models.DateTimeField(
        "Fecha de registro",
        default=timezone.now,
        help_text="Fecha y hora cuando el usuario se registro",
    )
    is_superuser = models.BooleanField(
        "Es super usuario",
        default=False,
        help_text="Tiene todos los permisos sin asignarlos explicitamente",
    )
    is_staff = models.BooleanField(
        "Es administrador",
        default=False,
        help_text="Permite ingresar al panel de administracion",
    )
    is_active = models.BooleanField(
        "Esta activo",
        default=True,
        help_text="Determina si la cuenta puede iniciar sesion",
    )

    state = models.BooleanField("Estado", default=True)
    

    objects = UsuarioManager()

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.username

    def get_full_name(self):
        nombre = " ".join(part for part in [self.first_name, self.last_name] if part)
        return nombre

    def get_short_name(self):
        return self.first_name or self.username

    def nombre_completo(self):
        return self.get_full_name()

    def nombre_corto(self):
        return self.get_short_name()

    def delete(self, using=None, keep_parents=False):
        self.is_active = False
        self.state = False
        super().delete(using=using, keep_parents=keep_parents)
