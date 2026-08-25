from rest_framework import serializers
from apps.products.models import MenuItem, Combo, Ingredient
from apps.promotions.models import Promotion
from apps.orders.models import OrderDetail, OrderMenuItems, OrderCombo, OrderPromotion, OrderItemUnit, ExtraIngredients, IngredientsRemoved


def validate_menu_item_stock(menu_item):
    """
    Valida que un elemento del menú tenga stock suficiente de todos sus ingredientes.
    
    Args:
        menu_item: Instancia de MenuItem
        
    Raises:
        serializers.ValidationError: Si algún ingrediente no tiene stock
    """
    for ingredient in menu_item.ingredients.all():
        if not ingredient.in_stock:
            raise serializers.ValidationError(
                f'No hay stock suficiente para el ingrediente {ingredient.name} en el producto {menu_item.name}.'
            )


def validate_combo_stock(combo):
    """
    Valida que un combo tenga stock suficiente de todos los ingredientes de sus productos.
    
    Args:
        combo: Instancia de Combo
        
    Raises:
        serializers.ValidationError: Si algún ingrediente no tiene stock
    """
    for menu_item in combo.menu_items.all():
        validate_menu_item_stock(menu_item)


def validate_and_get_menu_item(menu_item_id):
    """
    Valida y obtiene un elemento del menú por ID.
    
    Args:
        menu_item_id: ID del elemento del menú
        
    Returns:
        MenuItem: Instancia del elemento del menú
        
    Raises:
        serializers.ValidationError: Si el producto no existe o no se puede preparar
    """
    menu_item = MenuItem.objects.filter(id=menu_item_id, state=True, can_prepare=True).first()
    if not menu_item:
        raise serializers.ValidationError(
            f'El producto con id {menu_item_id} no existe, está inactivo o no se puede preparar.'
        )
    validate_menu_item_stock(menu_item)
    return menu_item


def validate_and_get_combo(combo_id):
    """
    Valida y obtiene un combo por ID.
    
    Args:
        combo_id: ID del combo
        
    Returns:
        Combo: Instancia del combo
        
    Raises:
        serializers.ValidationError: Si el combo no existe o no se puede preparar
    """
    combo = Combo.objects.filter(id=combo_id, state=True, can_prepare=True).first()
    if not combo:
        raise serializers.ValidationError(
            f'El combo con id {combo_id} no existe, está inactivo o no se puede preparar.'
        )
    validate_combo_stock(combo)
    return combo


def validate_and_get_promotion(promotion_id):
    """
    Valida y obtiene una promoción por ID.
    
    Args:
        promotion_id: ID de la promoción
        
    Returns:
        Promotion: Instancia de la promoción
        
    Raises:
        serializers.ValidationError: Si la promoción no existe o no está vigente
    """
    promotion = Promotion.objects.filter(id=promotion_id, state=True).first()
    if not promotion:
        raise serializers.ValidationError(
            f'La promoción con id {promotion_id} no existe o está inactiva.'
        )
    if not promotion.is_active:
        raise serializers.ValidationError(
            f'La promoción {promotion.name} no está vigente.'
        )
    return promotion


def process_menu_items(order_detail, menu_items_data):
    """
    Procesa y valida elementos del menú para un detalle de orden.
    
    Args:
        order_detail: Instancia de OrderDetail
        menu_items_data: Lista de datos de elementos del menú
        
    Returns:
        float: Precio total de los elementos del menú
    """
    final_price = 0
    for mi in menu_items_data:
        menu_item_id = mi.get('menu_item_id')
        menu_item = validate_and_get_menu_item(menu_item_id)
        OrderMenuItems.objects.create(order_detail=order_detail, menu_item=menu_item)
        final_price += float(menu_item.price)
    return final_price


def process_combos(order_detail, combos_data):
    """
    Procesa y valida combos para un detalle de orden.
    
    Args:
        order_detail: Instancia de OrderDetail
        combos_data: Lista de datos de combos
        
    Returns:
        float: Precio total de los combos
    """
    final_price = 0
    for c in combos_data:
        combo_id = c.get('combo_id')
        combo = validate_and_get_combo(combo_id)
        OrderCombo.objects.create(order_detail=order_detail, combo=combo)
        final_price += float(combo.price)
    return final_price


def process_promotions(order_detail, promotions_data):
    """
    Procesa y valida promociones para un detalle de orden.
    
    Args:
        order_detail: Instancia de OrderDetail
        promotions_data: Lista de datos de promociones
        
    Returns:
        float: Descuento total aplicado
    """
    total_discount = 0
    for p in promotions_data:
        promotion_id = p.get('promotion_id')
        promotion = validate_and_get_promotion(promotion_id)
        discount_amount = float(p.get('discount_amount', 0))
        OrderPromotion.objects.create(
            order_detail=order_detail, 
            promotion=promotion, 
            discount_amount=discount_amount
        )
        total_discount += discount_amount
    return total_discount


def process_item_units(order_detail, item_units_data):
    """
    Procesa y valida unidades individuales de elementos del menú.
    
    Args:
        order_detail: Instancia de OrderDetail
        item_units_data: Lista de datos de unidades individuales
        
    Returns:
        float: Precio total de las unidades individuales
    """
    final_price = 0
    for iu in item_units_data:
        menu_item_id = iu.get('menu_item_id')
        menu_item = validate_and_get_menu_item(menu_item_id)
        unit_price = float(iu.get('unit_price', menu_item.price))
        
        order_item_unit = OrderItemUnit.objects.create(
            order_detail=order_detail, 
            menu_item=menu_item, 
            unit_price=unit_price
        )
        
        # Procesar ingredientes extra
        for extra in iu.get('extra_ingredients', []):
            ingredient_id = extra.get('ingredient_id')
            ingredient = Ingredient.objects.filter(id=ingredient_id, in_stock=True).first()
            if not ingredient:
                raise serializers.ValidationError(
                    f'El ingrediente extra con id {ingredient_id} no existe o no hay stock.'
                )
            quantity = extra.get('quantity', 1)
            extra_price = float(extra.get('extra_price', 0))
            ExtraIngredients.objects.create(
                order_item_unit=order_item_unit, 
                ingredient=ingredient, 
                quantity=quantity, 
                extra_price=extra_price
            )
            unit_price += extra_price
        
        # Procesar ingredientes removidos
        for removed in iu.get('removed_ingredients', []):
            ingredient_id = removed.get('ingredient_id')
            ingredient = Ingredient.objects.filter(id=ingredient_id).first()
            if not ingredient:
                raise serializers.ValidationError(
                    f'El ingrediente removido con id {ingredient_id} no existe.'
                )
            IngredientsRemoved.objects.create(
                order_item_unit=order_item_unit, 
                ingredient=ingredient
            )
        
        final_price += unit_price
    return final_price


def process_order_detail(order, detail_data):
    """
    Procesa un detalle completo de orden.
    
    Args:
        order: Instancia de Order
        detail_data: Datos del detalle de orden
        
    Returns:
        float: Precio total del detalle
    """
    quantity = detail_data.get('quantity', 1)
    order_detail = OrderDetail.objects.create(order=order, final_price=0, quantity=quantity)
    
    # Procesar cada tipo de elemento
    menu_items_price = process_menu_items(
        order_detail, 
        detail_data.get('menu_items', [])
    )
    combos_price = process_combos(
        order_detail, 
        detail_data.get('combos', [])
    )
    promotions_discount = process_promotions(
        order_detail, 
        detail_data.get('promotions', [])
    )
    item_units_price = process_item_units(
        order_detail, 
        detail_data.get('item_units', [])
    )
    
    # Calcular precio final del detalle
    final_price = (menu_items_price + combos_price + item_units_price - promotions_discount) * quantity
    order_detail.final_price = final_price
    order_detail.save()
    
    return final_price 