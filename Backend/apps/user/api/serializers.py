from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.usuarios.models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializador para el modelo Usuario con nombres en espanol."""

    nombre_usuario = serializers.CharField(source="username")
    correo_electronico = serializers.EmailField(source="email", allow_blank=True)
    nombre = serializers.CharField(source="first_name", allow_blank=True)
    apellido = serializers.CharField(source="last_name", allow_blank=True)
    nombre_completo = serializers.SerializerMethodField()
    grupos = serializers.SerializerMethodField()
    ultimo_acceso = serializers.DateTimeField(source="last_login", allow_null=True)
    esta_activo = serializers.BooleanField(source="is_active")
    es_administrador = serializers.BooleanField(source="is_staff")
    es_super_usuario = serializers.BooleanField(source="is_superuser")
    fecha_registro = serializers.DateTimeField(source="date_joined")
    estado = serializers.BooleanField(source="state")

    class Meta:
        model = Usuario
        fields = [
            "id",
            "habitante",
            "nombre_usuario",
            "correo_electronico",
            "nombre",
            "apellido",
            "nombre_completo",
            "ultimo_acceso",
            "esta_activo",
            "es_administrador",
            "es_super_usuario",
            "fecha_registro",
            "estado",
            "grupos",
        ]

    def get_nombre_completo(self, obj):
        # Prefer the related Habitante if available (contains two names and two surnames)
        habitante = getattr(obj, "habitante", None)
        if habitante:
            try:
                return habitante.nombre_completo()
            except Exception:
                partes_h = [
                    getattr(habitante, "primer_nombre", ""),
                    getattr(habitante, "segundo_nombre", ""),
                    getattr(habitante, "primer_apellido", ""),
                    getattr(habitante, "segundo_apellido", ""),
                ]
                return " ".join(p for p in partes_h if p)

        # Fallback to user first_name/last_name
        partes = [getattr(obj, "first_name", ""), getattr(obj, "last_name", "")]
        return " ".join(p for p in partes if p)

    def get_grupos(self, obj):
        # Devuelve una lista de nombres de los grupos a los que pertenece el usuario
        try:
            nombres = list(obj.groups.values_list("name", flat=True))
            return nombres[0] if nombres else None
        except Exception:
            return None


class UsuarioCrearSerializer(serializers.ModelSerializer):
    """Serializador para crear usuarios con rol asignado."""

    nombre_usuario = serializers.CharField(source="username")
    correo_electronico = serializers.EmailField(source="email", allow_blank=True, required=False)
    nombre = serializers.CharField(source="first_name", allow_blank=True, required=False)
    apellido = serializers.CharField(source="last_name", allow_blank=True, required=False)
    contrasena = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    contrasena2 = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )
    rol = serializers.ChoiceField(choices=["Lider", "Vocero"], default="Vocero")
    esta_activo = serializers.BooleanField(source="is_active", required=False, default=True)

    class Meta:
        model = Usuario
        fields = [
            "habitante",
            "nombre_usuario",
            "correo_electronico",
            "nombre",
            "apellido",
            "contrasena",
            "contrasena2",
            "rol",
            "esta_activo",
        ]

    def validate(self, attrs):
        if attrs["contrasena"] != attrs["contrasena2"]:
            raise serializers.ValidationError({"contrasena": "Las contrasenas no coinciden."})
        return attrs

    def create(self, validated_data):
        rol = validated_data.pop("rol", "Vocero")
        validated_data.pop("contrasena2", None)
        password = validated_data.pop("contrasena", None)
        usuario = Usuario.objects.create_user(password=password, **validated_data)

        grupo, _ = Group.objects.get_or_create(name=rol)
        usuario.groups.add(grupo)
        return usuario


class CambioContrasenaSerializer(serializers.Serializer):
    """Serializador para cambiar contrasena."""

    usuario_id = serializers.IntegerField(required=False, allow_null=True)
    contrasena_actual = serializers.CharField(required=False, allow_blank=True, style={"input_type": "password"})
    nueva_contrasena = serializers.CharField(
        required=True, validators=[validate_password], style={"input_type": "password"}
    )
    nueva_contrasena2 = serializers.CharField(required=True, style={"input_type": "password"})

    def validate(self, attrs):
        if attrs["nueva_contrasena"] != attrs["nueva_contrasena2"]:
            raise serializers.ValidationError(
                {"nueva_contrasena": "Las nuevas contrasenas no coinciden."}
            )
        
        # Verificar si se requiere la contraseña actual
        request = self.context.get("request")
        usuario_id = attrs.get("usuario_id")
        
        # Si no se proporciona usuario_id o es el mismo usuario, se requiere contrasena_actual
        if not usuario_id or (request and request.user.id == usuario_id):
            if not attrs.get("contrasena_actual"):
                raise serializers.ValidationError(
                    {"contrasena_actual": "La contraseña actual es requerida para cambiar su propia contraseña."}
                )
        
        return attrs

    def validate_contrasena_actual(self, value):
        # Solo validar si se proporciona un valor
        if value:
            request = self.context.get("request")
            usuario = request.user if request else None
            
            if usuario and not usuario.check_password(value):
                raise serializers.ValidationError("La contrasena actual es incorrecta.")
        
        return value


class SolicitudRestablecimientoContrasenaSerializer(serializers.Serializer):
    """Serializador para solicitar restablecimiento de contrasena."""

    correo_electronico = serializers.EmailField()


class ConfirmacionRestablecimientoContrasenaSerializer(serializers.Serializer):
    """Serializador para confirmar restablecimiento de contrasena."""

    nueva_contrasena = serializers.CharField(write_only=True, min_length=8)
    nueva_contrasena2 = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        if data["nueva_contrasena"] != data["nueva_contrasena2"]:
            raise serializers.ValidationError({"nueva_contrasena": "Las contrasenas no coinciden."})
        return data
