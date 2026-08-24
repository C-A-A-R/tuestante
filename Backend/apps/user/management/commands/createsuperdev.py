from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from datetime import date
from uuid import uuid4
import getpass

from apps.habitantes.models import Vivienda, Habitante

User = get_user_model()

class Command(BaseCommand):
    help = "Crear un superusuario de desarrollo que no aparece en endpoints (pertenece al grupo Admin)."

    def handle(self, *args, **options):
        self.stdout.write("Creando superusuario de desarrollo. Responda los datos solicitados.")

        # username
        while True:
            username = input("Nombre de usuario: ").strip()
            if username:
                if User.objects.filter(username=username).exists():
                    self.stderr.write("Ya existe un usuario con ese nombre. Intente con otro.")
                    continue
                break

        # password
        while True:
            password = getpass.getpass("Contrasena: ")
            password2 = getpass.getpass("Confirmar contrasena: ")
            if password != password2:
                self.stderr.write("Las contrasenas no coinciden. Intente de nuevo.")
                continue
            if not password:
                self.stderr.write("La contrasena no puede estar vacia.")
                continue
            break

        primer_nombre = input("Primer nombre: ").strip()
        segundo_nombre = input("Segundo nombre (opcional): ").strip()
        primer_apellido = input("Primer apellido: ").strip()
        segundo_apellido = input("Segundo apellido (opcional): ").strip()
        correo = input("Correo electronico (opcional): ").strip() or None
        cedula = input("Cedula (opcional): ").strip() or None

        # Crear vivienda y habitante placeholder para asociar al usuario
        vivienda = Vivienda.objects.create(calle="Sin definir")

        # fecha_nacimiento por defecto y fecha_residencia hoy
        fecha_nacimiento = date(2000, 1, 1)
        fecha_residencia = timezone.now().date()

        habitante = Habitante.objects.create(
            jefe_familia=None,
            primer_nombre=primer_nombre or "",
            segundo_nombre=segundo_nombre or "",
            primer_apellido=primer_apellido or "",
            segundo_apellido=segundo_apellido or "",
            cedula=cedula or f"DEV-{uuid4().hex[:8]}",
            fecha_nacimiento=fecha_nacimiento,
            telefono=None,
            correo=correo,
            fecha_residencia=fecha_residencia,
            vivienda=vivienda,
            es_jefe_familia=True,
        )
        habitante.jefe_familia = habitante
        habitante.save(update_fields=["jefe_familia"]) 

        # Crear usuario superuser y asociarlo al habitante
        user = User.objects.create_superuser(username, correo, password,
                             first_name=primer_nombre or "",
                             last_name=primer_apellido or "",
                             habitante=habitante)

        # Asignar grupo Admin por defecto
        grupo, _ = Group.objects.get_or_create(name="Admin")
        user.groups.add(grupo)

        self.stdout.write(self.style.SUCCESS(f"Superusuario '{username}' creado y asignado al grupo 'Admin'."))
*** End Patch