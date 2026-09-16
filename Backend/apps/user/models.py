from django.db import models
from django.contrib.auth.models import AbstractUser, PermissionsMixin, UserManager
from django.utils import timezone

from apps.base.models import BaseModel


class CustomUserManager(UserManager):
    """Gestor personalizado para el modelo User que asegura que los superusuarios sean creados como activos."""

    def create_user(self, username=None, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        if 'is_registered' not in extra_fields:
            extra_fields['is_registered'] = bool(password)
        if not password and 'is_active' not in extra_fields:
            extra_fields['is_active'] = True

        if email:
            email = self.normalize_email(email)

        if not username:
            if email:
                username = email
            elif extra_fields.get('identity_document'):
                username = extra_fields.get('identity_document')
            else:
                import uuid
                username = f"user_{uuid.uuid4().hex[:10]}"

        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_unregistered_user(self, email=None, first_name='', first_last_name='', identity_document=None, phone='', **extra_fields):
        """Crea un usuario no registrado con información básica."""
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        extra_fields.setdefault('is_active', True)
        extra_fields['is_registered'] = False
        return self.create_user(
            username=None,
            email=email,
            password=None,
            first_name=first_name,
            first_last_name=first_last_name,
            identity_document=identity_document,
            phone=phone,
            **extra_fields
        )

    def create_superuser(self, username=None, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_registered', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('El superusuario debe tener is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('El superusuario debe tener is_superuser=True.')
        if extra_fields.get('is_active') is not True:
            raise ValueError('El superusuario debe tener is_active=True.')

        return self._create_user(username, email, password, **extra_fields)


class User(AbstractUser, PermissionsMixin, BaseModel):
    """Modelo de Usuario personalizado que hereda de BaseModel y AbstractUser."""

    class DocumentType(models.TextChoices):
        VENEZOLANO = 'V', 'Venezolano'
        EXTRANJERO = 'E', 'Extranjero'
        JURIDICO = 'J', 'Jurídico'
        GUBERNAMENTAL = 'G', 'Gubernamental'
        PASAPORTE = 'P', 'Pasaporte'
        REGISTRO = 'R', 'Firma Personal / Registro'

    DOCUMENT_TYPE_CHOICES = DocumentType.choices

    # Campos básicos de identificación
    username = models.CharField(
        'Nombre de usuario',
        max_length=150,
        unique=True,
        null=True,
        blank=True,
        help_text='150 caracteres o menos. Opcional para usuarios no registrados.'
    )
    email = models.EmailField(
        'Correo electrónico',
        unique=True,
        null=True,
        blank=True,
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
    is_registered = models.BooleanField(
        'Está registrado',
        default=True,
        help_text='Indica si el usuario completó su registro formal con contraseña o es un usuario no registrado'
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
    document_type = models.CharField(
        'Tipo de documento',
        max_length=2,
        choices=DocumentType.choices,
        default=DocumentType.VENEZOLANO,
        null=True,
        blank=True,
        help_text='Tipo de documento de identidad (V, E, J, G, P, R)'
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

    # Campos de integración externa (Google OAuth)
    google_id = models.CharField(
        'ID de Google',
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text='Identificador único de usuario en Google OAuth (sub)'
    )
    avatar_url = models.URLField(
        'URL de foto de perfil',
        max_length=500,
        null=True,
        blank=True,
        help_text='URL de la foto de perfil (obtenida de Google o externa)'
    )

    objects = CustomUserManager()

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'first_last_name']

    def __str__(self):
        """String representation of User."""
        return f"{self.username or self.identity_document or self.id} - {self.get_full_name() or self.email or 'Sin nombre'}"

    def get_full_name(self):
        """Retorna el nombre completo del usuario concatenando nombres y apellidos."""
        name_parts = [
            self.first_name,
            self.second_name,
            self.first_last_name or self.last_name,
            self.second_last_name,
        ]
        full_name = " ".join(part for part in name_parts if part)
        return full_name or self.username or ''

    def get_short_name(self):
        """Retorna el nombre corto del usuario."""
        return self.first_name or self.username or ''

    def save(self, *args, **kwargs):
        """Normaliza datos y asigna username si no se especifica."""
        import uuid

        if self.email == '':
            self.email = None
        if self.identity_document == '':
            self.identity_document = None
        if self.username == '':
            self.username = None
        if self.document_type == '':
            self.document_type = None
        if self.google_id == '':
            self.google_id = None

        # Si no se asignó document_type pero identity_document contiene prefijo (ej: V-12345678)
        if self.identity_document and not self.document_type:
            doc_str = str(self.identity_document).strip().upper()
            if len(doc_str) >= 2 and doc_str[1] == '-' and doc_str[0] in dict(self.DocumentType.choices):
                self.document_type = doc_str[0]

        if not self.username and not self.is_staff and not self.is_superuser:
            if self.email:
                self.username = self.email
            elif self.identity_document:
                self.username = self.identity_document
            else:
                self.username = f"user_{uuid.uuid4().hex[:10]}"

        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        """Desactiva el usuario al realizar el borrado lógico."""
        self.is_active = False
        super().delete(using=using, keep_parents=keep_parents)




