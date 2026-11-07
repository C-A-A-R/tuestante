import getpass
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()


class Command(BaseCommand):
    help = "Crear un superusuario interactivo con is_active=True y asignado al grupo Admin."

    def handle(self, *args, **options):
        self.stdout.write("Creando superusuario de administración. Responda los datos solicitados.")

        # username
        while True:
            username = input("Nombre de usuario: ").strip()
            if not username:
                self.stderr.write("El nombre de usuario no puede estar vacío.")
                continue
            if User.objects.filter(username=username).exists():
                self.stderr.write("Ya existe un usuario con ese nombre. Intente con otro.")
                continue
            break

        # email
        while True:
            correo = input("Correo electrónico: ").strip()
            if not correo:
                self.stderr.write("El correo electrónico es requerido.")
                continue
            if User.objects.filter(email=correo).exists():
                self.stderr.write("Ya existe un usuario con ese correo. Intente con otro.")
                continue
            break

        # password
        while True:
            password = getpass.getpass("Contraseña: ")
            password2 = getpass.getpass("Confirmar contraseña: ")
            if not password:
                self.stderr.write("La contraseña no puede estar vacía.")
                continue
            if password != password2:
                self.stderr.write("Las contraseñas no coinciden. Intente de nuevo.")
                continue
            break

        primer_nombre = input("Primer nombre (opcional): ").strip()
        segundo_nombre = input("Segundo nombre (opcional): ").strip()
        primer_apellido = input("Primer apellido (opcional): ").strip()
        segundo_apellido = input("Segundo apellido (opcional): ").strip()
        cedula = input("Documento de identidad (opcional): ").strip() or None
        telefono = input("Teléfono (opcional): ").strip()

        # Crear usuario superuser activo
        user = User.objects.create_superuser(
            username=username,
            email=correo,
            password=password,
            first_name=primer_nombre,
            second_name=segundo_nombre,
            first_last_name=primer_apellido,
            second_last_name=segundo_apellido,
            identity_document=cedula,
            phone=telefono,
            is_active=True,
        )

        # Asignar grupo Admin
        grupo, _ = Group.objects.get_or_create(name="Admin")
        user.groups.add(grupo)

        self.stdout.write(self.style.SUCCESS(f"Superusuario '{username}' creado exitosamente como activo y asignado al grupo 'Admin'."))