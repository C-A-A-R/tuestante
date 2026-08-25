from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.user.models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializador para el modelo User."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "second_name",
            "first_last_name",
            "second_last_name",
            "identity_document",
            "full_name",
            "birth_date",
            "phone",
            "last_login",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "is_deleted",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        """Obtiene el nombre completo del usuario."""
        return obj.get_full_name() or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializador para crear usuarios (clientes o administradores)."""

    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True, required=False)
    first_name = serializers.CharField(allow_blank=True, required=False)
    second_name = serializers.CharField(allow_blank=True, required=False)
    first_last_name = serializers.CharField(allow_blank=True, required=False)
    second_last_name = serializers.CharField(allow_blank=True, required=False)
    identity_document = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    birth_date = serializers.DateField(allow_null=True, required=False)
    phone = serializers.CharField(allow_blank=True, required=False)
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    confirm_password = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )
    is_staff = serializers.BooleanField(required=False, default=False)
    is_active = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "second_name",
            "first_last_name",
            "second_last_name",
            "identity_document",
            "birth_date",
            "phone",
            "password",
            "confirm_password",
            "is_staff",
            "is_active",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password", None)
        password = validated_data.pop("password", None)
        user = User.objects.create_user(password=password, **validated_data)
        return user




class ChangePasswordSerializer(serializers.Serializer):
    """Serializador para cambiar contraseña."""

    user_id = serializers.IntegerField(required=False, allow_null=True)
    current_password = serializers.CharField(required=False, allow_blank=True, style={"input_type": "password"})
    new_password = serializers.CharField(
        required=True, validators=[validate_password], style={"input_type": "password"}
    )
    confirm_new_password = serializers.CharField(required=True, style={"input_type": "password"})

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_new_password"]:
            raise serializers.ValidationError(
                {"new_password": "Las nuevas contraseñas no coinciden."}
            )
        
        # Verificar si se requiere la contraseña actual
        request = self.context.get("request")
        user_id = attrs.get("user_id")
        
        # Si no se proporciona user_id o es el mismo usuario, se requiere current_password
        if not user_id or (request and request.user.id == user_id):
            if not attrs.get("current_password"):
                raise serializers.ValidationError(
                    {"current_password": "La contraseña actual es requerida para cambiar su propia contraseña."}
                )
        
        return attrs

    def validate_current_password(self, value):
        # Solo validar si se proporciona un valor
        if value:
            request = self.context.get("request")
            user = request.user if request else None
            
            if user and not user.check_password(value):
                raise serializers.ValidationError("La contraseña actual es incorrecta.")
        
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializador para solicitar restablecimiento de contraseña."""

    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializador para confirmar restablecimiento de contraseña."""

    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_new_password"]:
            raise serializers.ValidationError({"new_password": "Las contraseñas no coinciden."})
        return attrs

