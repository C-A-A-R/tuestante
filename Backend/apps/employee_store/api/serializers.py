from decimal import Decimal
from rest_framework import serializers
from apps.employee_store.models import (
    EmployeeProfile,
    InternalCategory,
    InternalSubCategory,
    InternalProduct,
    InternalOrder,
    InternalOrderItem,
    DebtPayment,
)
from apps.employee_store.services import has_overdue_weekly_debt


class InternalSubCategorySerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')

    class Meta:
        model = InternalSubCategory
        fields = ('id', 'category', 'category_name', 'name', 'description', 'image', 'created_at')


class InternalCategorySerializer(serializers.ModelSerializer):
    subcategories = InternalSubCategorySerializer(many=True, read_only=True)

    class Meta:
        model = InternalCategory
        fields = ('id', 'name', 'description', 'image', 'subcategories', 'created_at')


class InternalProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    subcategory_name = serializers.ReadOnlyField(source='subcategory.name')

    class Meta:
        model = InternalProduct
        fields = (
            'id',
            'category',
            'category_name',
            'subcategory',
            'subcategory_name',
            'barcode',
            'name',
            'description',
            'price',
            'stock',
            'weekly_limit_per_employee',
            'image',
            'is_active',
            'created_at',
        )


class EmployeeProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    username = serializers.ReadOnlyField(source='user.username')
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    second_name = serializers.CharField(source='user.second_name', required=False, allow_blank=True)
    last_name = serializers.CharField(source='user.last_name', required=False, allow_blank=True)
    second_last_name = serializers.CharField(source='user.second_last_name', required=False, allow_blank=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.CharField(source='user.email', required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(source='user.phone', required=False, allow_blank=True)
    document_type = serializers.CharField(source='user.document_type', required=False, allow_blank=True, allow_null=True)
    document_type_display = serializers.CharField(source='user.get_document_type_display', read_only=True)
    id_number = serializers.CharField(source='user.identity_document', required=False, allow_blank=True, allow_null=True)
    identity_document = serializers.CharField(source='user.identity_document', required=False, allow_blank=True, allow_null=True)
    birth_date = serializers.DateField(source='user.birth_date', required=False, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    photo = serializers.ImageField(required=False, allow_null=True)
    current_debt = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    has_overdue_debt = serializers.SerializerMethodField()
    overdue_debt_amount = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = (
            'id',
            'user',
            'username',
            'first_name',
            'second_name',
            'last_name',
            'second_last_name',
            'full_name',
            'email',
            'phone',
            'document_type',
            'document_type_display',
            'id_number',
            'identity_document',
            'birth_date',
            'password',
            'employee_number',
            'department',
            'position',
            'salary',
            'photo',
            'is_active',
            'current_debt',
            'has_overdue_debt',
            'overdue_debt_amount',
            'created_at',
        )

    def get_full_name(self, obj):
        return obj.user.get_full_name() or f"{obj.user.first_name or ''} {obj.user.last_name or ''}".strip() or obj.user.username

    def get_has_overdue_debt(self, obj):
        has_debt, _, _ = has_overdue_weekly_debt(obj)
        return has_debt

    def get_overdue_debt_amount(self, obj):
        _, debt_amount, _ = has_overdue_weekly_debt(obj)
        return debt_amount

    def validate_password(self, value):
        if value:
            if len(value) < 6:
                raise serializers.ValidationError("La contraseña debe tener al menos 6 caracteres.")
            if not any(c.isupper() for c in value):
                raise serializers.ValidationError("La contraseña debe contener al menos una letra mayúscula.")
            if not any(c.isdigit() for c in value):
                raise serializers.ValidationError("La contraseña debe contener al menos un número.")
        return value

    def validate_birth_date(self, value):
        if value:
            from datetime import date
            today = date.today()
            if value > today:
                raise serializers.ValidationError("La fecha de nacimiento no puede ser una fecha futura.")
            age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
            if age < 15:
                raise serializers.ValidationError("El trabajador debe tener al menos 15 años de edad cumplidos.")
            if age > 100:
                raise serializers.ValidationError("Por favor ingresa una fecha de nacimiento válida (edad superior a 100 años no permitida).")
        return value

    def validate(self, attrs):
        if not self.instance:
            pwd = attrs.get('password')
            if not pwd:
                raise serializers.ValidationError({'password': 'La contraseña es obligatoria para registrar un nuevo trabajador.'})
        return attrs

    def create(self, validated_data):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_data = validated_data.pop('user', {})
        password = validated_data.pop('password', None)

        document_type = user_data.get('document_type') or None
        identity_doc = user_data.get('identity_document') or validated_data.get('employee_number')
        first_name = user_data.get('first_name', '')
        second_name = user_data.get('second_name', '')
        last_name = user_data.get('last_name', '')
        second_last_name = user_data.get('second_last_name', '')
        birth_date = user_data.get('birth_date', None) or None
        email = user_data.get('email', None) or None
        phone = user_data.get('phone', '')

        user = None
        if identity_doc:
            user = User.objects.filter(identity_document=identity_doc).first()
        if not user and email:
            user = User.objects.filter(email=email).first()
        if not user:
            import uuid
            uname = identity_doc or f"emp_{uuid.uuid4().hex[:8]}"
            user = User.objects.create_user(
                username=uname,
                email=email,
                document_type=document_type,
                identity_document=identity_doc or None,
                first_name=first_name,
                second_name=second_name,
                last_name=last_name,
                first_last_name=last_name,
                second_last_name=second_last_name,
                birth_date=birth_date,
                phone=phone,
                is_registered=False
            )
            if password:
                user.set_password(password)
                user.save()
        else:
            update_fields = []
            if document_type is not None:
                user.document_type = document_type
                update_fields.append('document_type')
            if first_name:
                user.first_name = first_name; update_fields.append('first_name')
            if second_name is not None:
                user.second_name = second_name; update_fields.append('second_name')
            if last_name:
                user.last_name = last_name
                user.first_last_name = last_name
                update_fields.extend(['last_name', 'first_last_name'])
            if second_last_name is not None:
                user.second_last_name = second_last_name; update_fields.append('second_last_name')
            if birth_date is not None:
                user.birth_date = birth_date; update_fields.append('birth_date')
            if phone is not None:
                user.phone = phone; update_fields.append('phone')
            if password:
                user.set_password(password)
                update_fields.append('password')
            if update_fields:
                user.save()

        validated_data['user'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        password = validated_data.pop('password', None)
        if user_data or password:
            user = instance.user
            user_update_fields = []
            user_field_map = {
                'first_name': 'first_name',
                'second_name': 'second_name',
                'last_name': 'last_name',
                'second_last_name': 'second_last_name',
                'document_type': 'document_type',
                'identity_document': 'identity_document',
                'birth_date': 'birth_date',
                'email': 'email',
                'phone': 'phone',
            }
            for attr, field in user_field_map.items():
                if attr in user_data:
                    val = user_data[attr]
                    if val == '' and attr in ['identity_document', 'email', 'birth_date', 'document_type']:
                        val = None
                    setattr(user, field, val)
                    user_update_fields.append(field)
                    if attr == 'last_name':
                        user.first_last_name = val or ''
                        user_update_fields.append('first_last_name')
                    if attr == 'second_last_name':
                        user.second_last_name = val or ''
            if password:
                user.set_password(password)
                user_update_fields.append('password')
            if user_update_fields:
                user.save()
        return super().update(instance, validated_data)


class InternalOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_barcode = serializers.ReadOnlyField(source='product.barcode')

    class Meta:
        model = InternalOrderItem
        fields = (
            'id',
            'product',
            'product_name',
            'product_barcode',
            'quantity',
            'unit_price',
            'subtotal',
        )


class InternalOrderDetailSerializer(serializers.ModelSerializer):
    employee_number = serializers.ReadOnlyField(source='employee.employee_number')
    employee_name = serializers.SerializerMethodField()
    employee_doc = serializers.SerializerMethodField()
    employee_identity_document = serializers.SerializerMethodField()
    employee_department = serializers.ReadOnlyField(source='employee.department')
    employee_position = serializers.ReadOnlyField(source='employee.position')
    created_by_name = serializers.SerializerMethodField()
    items = InternalOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = InternalOrder
        fields = (
            'id',
            'order_number',
            'employee',
            'employee_number',
            'employee_name',
            'employee_doc',
            'employee_identity_document',
            'employee_department',
            'employee_position',
            'total_amount',
            'status',
            'created_by',
            'created_by_name',
            'notes',
            'items',
            'created_at',
        )

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        return 'Trabajador'

    def get_employee_doc(self, obj):
        if obj.employee and obj.employee.user:
            return getattr(obj.employee.user, 'identity_document', None) or obj.employee.employee_number or ''
        return ''

    def get_employee_identity_document(self, obj):
        if obj.employee and obj.employee.user:
            return getattr(obj.employee.user, 'identity_document', None) or ''
        return ''

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'Sistema'


class InternalOrderItemInputSerializer(serializers.Serializer):
    barcode = serializers.CharField(required=False, allow_blank=True, default='')
    product_id = serializers.IntegerField(required=False)
    quantity = serializers.IntegerField(min_value=1, default=1)

    def validate(self, attrs):
        if not attrs.get('barcode') and not attrs.get('product_id'):
            raise serializers.ValidationError("Debe indicar el 'barcode' o el 'product_id'.")
        return attrs


class InternalOrderCreateSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    items = InternalOrderItemInputSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    status = serializers.ChoiceField(choices=InternalOrder.STATUS_CHOICES, required=False, default='UNDELIVERED')
    is_admin_override = serializers.BooleanField(required=False, default=False)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La orden debe tener al menos un producto.")
        return value


class DebtPaymentSerializer(serializers.ModelSerializer):
    employee_number = serializers.ReadOnlyField(source='employee.employee_number')
    employee_name = serializers.SerializerMethodField()
    registered_by_name = serializers.SerializerMethodField()
    order_number = serializers.ReadOnlyField(source='order.order_number')

    class Meta:
        model = DebtPayment
        fields = (
            'id',
            'employee',
            'employee_number',
            'employee_name',
            'order',
            'order_number',
            'amount',
            'payment_type',
            'registered_by',
            'registered_by_name',
            'reference',
            'voucher',
            'notes',
            'created_at',
        )
        read_only_fields = ('registered_by',)

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username

    def get_registered_by_name(self, obj):
        if obj.registered_by:
            return obj.registered_by.get_full_name() or obj.registered_by.username
        return ''


class BulkPayrollCutItemSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    reference = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class BulkPayrollCutSerializer(serializers.Serializer):
    payroll_reference = serializers.CharField(required=False, allow_blank=True, default='CORTE-NOMINA')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    voucher = serializers.FileField(required=False, allow_null=True, default=None)
    cuts = BulkPayrollCutItemSerializer(many=True)

    def validate_cuts(self, value):
        if not value:
            raise serializers.ValidationError("Debe seleccionar al menos un trabajador para procesar el corte de nómina.")
        return value
