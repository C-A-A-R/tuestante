from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.user.models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializador para el modelo User."""

    full_name = serializers.SerializerMethodField()
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    orders_count = serializers.IntegerField(read_only=True, default=0)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=0.00)
    last_order_date = serializers.DateField(read_only=True, default=None, allow_null=True)
    city = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()

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
            "document_type",
            "document_type_display",
            "identity_document",
            "full_name",
            "birth_date",
            "phone",
            "last_login",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_registered",
            "date_joined",
            "orders_count",
            "total_spent",
            "last_order_date",
            "city",
            "state",
            "is_deleted",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        """Obtiene el nombre completo del usuario."""
        return obj.get_full_name() or obj.username or ''

    def get_city(self, obj):
        if hasattr(obj, 'city') and obj.city:
            return obj.city
        try:
            from apps.shipment.models import Shipment
            sh = Shipment.objects.filter(order__user=obj, is_deleted=False).order_by('-created_at').first()
            return sh.city if sh else ''
        except Exception:
            return ''

    def get_state(self, obj):
        if hasattr(obj, 'state') and obj.state:
            return obj.state
        try:
            from apps.shipment.models import Shipment
            sh = Shipment.objects.filter(order__user=obj, is_deleted=False).order_by('-created_at').first()
            return sh.state if sh else ''
        except Exception:
            return ''


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializador para crear o actualizar usuarios (registrados o no registrados)."""

    username = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    first_name = serializers.CharField(allow_blank=True, required=False)
    second_name = serializers.CharField(allow_blank=True, required=False)
    first_last_name = serializers.CharField(allow_blank=True, required=False)
    second_last_name = serializers.CharField(allow_blank=True, required=False)
    document_type = serializers.ChoiceField(
        choices=User.DOCUMENT_TYPE_CHOICES,
        required=False,
        allow_blank=True,
        allow_null=True,
        default=User.DocumentType.VENEZOLANO
    )
    identity_document = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    birth_date = serializers.DateField(allow_null=True, required=False)
    phone = serializers.CharField(allow_blank=True, required=False)
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        style={"input_type": "password"},
    )
    confirm_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, allow_null=True, style={"input_type": "password"}
    )
    is_staff = serializers.BooleanField(required=False, default=False)
    is_superuser = serializers.BooleanField(required=False, default=False)
    is_active = serializers.BooleanField(required=False, default=True)
    is_registered = serializers.BooleanField(required=False)

    city = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    state = serializers.CharField(required=False, allow_blank=True, allow_null=True)

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
            "document_type",
            "identity_document",
            "birth_date",
            "phone",
            "password",
            "confirm_password",
            "city",
            "state",
            "is_staff",
            "is_superuser",
            "is_active",
            "is_registered",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "username": {"validators": []},
            "email": {"validators": []},
            "identity_document": {"validators": []},
        }

    def validate(self, attrs):
        password = attrs.get("password")
        confirm_password = attrs.get("confirm_password")
        is_staff = attrs.get("is_staff", False)
        is_superuser = attrs.get("is_superuser", False)

        # Si se envía alguna contraseña, validar coincidencia y complejidad
        if password or confirm_password:
            if password != confirm_password:
                raise serializers.ValidationError({"password": "Las contraseñas no coinciden."})
            validate_password(password)

        username = attrs.get("username")
        email = attrs.get("email")
        identity_document = attrs.get("identity_document")

        if is_staff or is_superuser:
            if not username or not str(username).strip():
                raise serializers.ValidationError(
                    {"username": "El nombre de usuario es requerido para administradores."}
                )
            if not password:
                raise serializers.ValidationError(
                    {"password": "La contraseña es requerida para administradores."}
                )

        # Validar conflictos cruzados entre usuarios distintos
        user_by_email = None
        user_by_doc = None
        user_by_username = None

        if email and str(email).strip():
            user_by_email = User.objects.filter(email__iexact=str(email).strip()).first()
        if identity_document and str(identity_document).strip():
            user_by_doc = User.objects.filter(identity_document__iexact=str(identity_document).strip()).first()
        if username and str(username).strip():
            user_by_username = User.objects.filter(username__iexact=str(username).strip()).first()

        current_id = getattr(self.instance, 'id', None)

        if user_by_email and user_by_doc and user_by_email.id != user_by_doc.id:
            if not current_id or (user_by_email.id != current_id and user_by_doc.id != current_id):
                raise serializers.ValidationError(
                    {"identity_document": "El documento de identidad ya pertenece a otra cuenta distinta al correo proporcionado."}
                )

        if user_by_username and user_by_email and user_by_username.id != user_by_email.id:
            if not current_id or (user_by_username.id != current_id and user_by_email.id != current_id):
                raise serializers.ValidationError(
                    {"username": "El nombre de usuario ya pertenece a otra cuenta."}
                )

        if user_by_username and user_by_doc and user_by_username.id != user_by_doc.id:
            if not current_id or (user_by_username.id != current_id and user_by_doc.id != current_id):
                raise serializers.ValidationError(
                    {"username": "El nombre de usuario ya pertenece a otra cuenta."}
                )

        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password", None)
        password = validated_data.pop("password", None)
        city = validated_data.pop("city", None)
        state = validated_data.pop("state", None)

        email = validated_data.get("email")
        identity_document = validated_data.get("identity_document")
        username = validated_data.get("username")

        # Buscar si ya existe el usuario por email, documento de identidad o username
        existing_user = None
        if email and str(email).strip():
            existing_user = User.objects.filter(email__iexact=str(email).strip()).first()
        if not existing_user and identity_document and str(identity_document).strip():
            existing_user = User.objects.filter(identity_document__iexact=str(identity_document).strip()).first()
        if not existing_user and username and str(username).strip():
            existing_user = User.objects.filter(username__iexact=str(username).strip()).first()

        if existing_user:
            # Restaurar si estaba borrado lógicamente
            if existing_user.is_deleted:
                existing_user.is_deleted = False
                existing_user.deleted_at = None
                existing_user.is_active = True

            # Actualizar datos con los nuevos valores provistos
            for key, val in validated_data.items():
                if val is not None and val != '':
                    setattr(existing_user, key, val)

            if password:
                existing_user.set_password(password)
                existing_user.is_registered = True
            elif 'is_registered' in validated_data:
                existing_user.is_registered = validated_data['is_registered']
            elif not existing_user.has_usable_password():
                existing_user.is_registered = False

            if 'is_active' in validated_data:
                existing_user.is_active = validated_data['is_active']
            elif not existing_user.is_active:
                existing_user.is_active = True

            existing_user.save()
            user = existing_user
        else:
            # Crear nuevo usuario
            if password:
                validated_data.setdefault('is_registered', True)
            else:
                validated_data.setdefault('is_registered', False)
                validated_data.setdefault('is_active', True)

            user = User.objects.create_user(password=password, **validated_data)

        if city or state:
            try:
                from apps.shipment.models import Shipment
                from apps.orders.models import Order
                order = Order.objects.filter(user=user, is_deleted=False).order_by('-created_at').first()
                if order:
                    sh = order.shipments.filter(is_deleted=False).first()
                    if sh:
                        if city: sh.city = city
                        if state: sh.state = state
                        sh.save()
                    else:
                        Shipment.objects.create(order=order, city=city or '', state=state or '', address='Dirección registrada')
            except Exception:
                pass

        return user

    def update(self, instance, validated_data):
        validated_data.pop("confirm_password", None)
        password = validated_data.pop("password", None)
        city = validated_data.pop("city", None)
        state = validated_data.pop("state", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            instance.is_registered = True

        instance.save()

        if city or state:
            try:
                from apps.shipment.models import Shipment
                from apps.orders.models import Order
                order = Order.objects.filter(user=instance, is_deleted=False).order_by('-created_at').first()
                if order:
                    sh = order.shipments.filter(is_deleted=False).first()
                    if sh:
                        if city: sh.city = city
                        if state: sh.state = state
                        sh.save()
                    else:
                        Shipment.objects.create(order=order, city=city or '', state=state or '', address='Dirección registrada')
            except Exception:
                pass

        return instance




class ChangePasswordSerializer(serializers.Serializer):
    """Serializador para cambiar contraseña."""

    user_id = serializers.IntegerField(required=False, allow_null=True)
    current_password = serializers.CharField(required=False, allow_blank=True, style={"input_type": "password"})
    new_password = serializers.CharField(
        required=True, min_length=6, validators=[validate_password], style={"input_type": "password"}
    )
    confirm_new_password = serializers.CharField(required=True, min_length=6, style={"input_type": "password"})

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

    new_password = serializers.CharField(write_only=True, min_length=6)
    confirm_new_password = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_new_password"]:
            raise serializers.ValidationError({"new_password": "Las contraseñas no coinciden."})
        return attrs

