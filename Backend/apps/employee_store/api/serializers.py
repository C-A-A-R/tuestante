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
    last_name = serializers.CharField(source='user.last_name', required=False, allow_blank=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.CharField(source='user.email', required=False, allow_blank=True, allow_null=True)
    id_number = serializers.CharField(source='user.identity_document', required=False, allow_blank=True, allow_null=True)
    identity_document = serializers.CharField(source='user.identity_document', required=False, allow_blank=True, allow_null=True)
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
            'last_name',
            'full_name',
            'email',
            'id_number',
            'identity_document',
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

    def create(self, validated_data):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_data = validated_data.pop('user', {})

        identity_doc = user_data.get('identity_document') or validated_data.get('employee_number')
        first_name = user_data.get('first_name', '')
        last_name = user_data.get('last_name', '')
        email = user_data.get('email', None) or None

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
                identity_document=identity_doc or None,
                first_name=first_name,
                last_name=last_name,
                first_last_name=last_name,
                is_registered=False
            )
        else:
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
                user.first_last_name = last_name
            user.save()

        validated_data['user'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        if user_data:
            user = instance.user
            for attr, val in user_data.items():
                if attr in ['first_name', 'last_name', 'identity_document', 'email']:
                    if val != '' or attr in ['first_name', 'last_name']:
                        setattr(user, attr, val if val != '' else None if attr in ['identity_document', 'email'] else '')
                        if attr == 'last_name':
                            user.first_last_name = val
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
            'total_amount',
            'status',
            'created_by',
            'created_by_name',
            'notes',
            'items',
            'created_at',
        )

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username

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
