from django.db import migrations


def seed_distributors_and_coverages(apps, schema_editor):
    Distributor = apps.get_model('shipment', 'Distributor')
    DistributorCoverage = apps.get_model('shipment', 'DistributorCoverage')

    # 1. Distribuidor Nacional: MRW
    mrw, _ = Distributor.objects.get_or_create(
        rif='J-00000001-1',
        defaults={
            'name': 'MRW Envíos Nacionales',
            'phone': '0500-679-0000',
            'email': 'atencion@mrw.com.ve',
            'coverage_type': 'national',
            'is_active': True
        }
    )
    if mrw.coverage_type != 'national':
        mrw.coverage_type = 'national'
        mrw.save()

    # 2. Distribuidor Nacional: Tealca
    tealca, _ = Distributor.objects.get_or_create(
        rif='J-00000002-2',
        defaults={
            'name': 'Tealca Courier Nacional',
            'phone': '0500-832-5221',
            'email': 'contacto@tealca.com',
            'coverage_type': 'national',
            'is_active': True
        }
    )
    if tealca.coverage_type != 'national':
        tealca.coverage_type = 'national'
        tealca.save()

    # 3. Transportista Regional: Flete Express TuEstante (Eje Central)
    flete_propio, _ = Distributor.objects.get_or_create(
        rif='J-50123456-7',
        defaults={
            'name': 'Flete Directo TuEstante (Eje Central)',
            'phone': '+58 412 1234567',
            'email': 'logistica@tuestante.com',
            'coverage_type': 'regional',
            'is_active': True
        }
    )

    # Zonas de cobertura específicas para Flete Directo TuEstante
    zonas_eje_central = [
        # Carabobo
        {'state': 'Carabobo', 'municipality': 'Valencia', 'city': 'Valencia', 'min_days': 1, 'max_days': 2, 'cost': 5.00},
        {'state': 'Carabobo', 'municipality': 'Naguanagua', 'city': 'Naguanagua', 'min_days': 1, 'max_days': 2, 'cost': 5.00},
        {'state': 'Carabobo', 'municipality': 'San Diego', 'city': 'San Diego', 'min_days': 1, 'max_days': 2, 'cost': 5.00},
        {'state': 'Carabobo', 'municipality': 'Guacara', 'city': 'Guacara', 'min_days': 1, 'max_days': 2, 'cost': 8.00},
        {'state': 'Carabobo', 'municipality': 'Puerto Cabello', 'city': 'Puerto Cabello', 'min_days': 2, 'max_days': 3, 'cost': 12.00},
        # Aragua
        {'state': 'Aragua', 'municipality': 'Girardot', 'city': 'Maracay', 'min_days': 1, 'max_days': 3, 'cost': 10.00},
        {'state': 'Aragua', 'municipality': 'Santiago Mariño', 'city': 'Turmero', 'min_days': 2, 'max_days': 3, 'cost': 12.00},
        # Distrito Capital
        {'state': 'Distrito Capital', 'municipality': 'Libertador', 'city': 'Caracas', 'min_days': 2, 'max_days': 3, 'cost': 15.00},
        # Miranda (Gran Caracas y Altos Mirandinos)
        {'state': 'Miranda', 'municipality': 'Chacao', 'city': 'Caracas', 'min_days': 2, 'max_days': 3, 'cost': 15.00},
        {'state': 'Miranda', 'municipality': 'Baruta', 'city': 'Caracas', 'min_days': 2, 'max_days': 3, 'cost': 15.00},
        {'state': 'Miranda', 'municipality': 'Sucre', 'city': 'Caracas', 'min_days': 2, 'max_days': 3, 'cost': 15.00},
        {'state': 'Miranda', 'municipality': 'Los Salias', 'city': 'San Antonio de Los Altos', 'min_days': 2, 'max_days': 4, 'cost': 18.00},
        # Cobertura a todo el estado Yaracuy
        {'state': 'Yaracuy', 'municipality': '', 'city': '', 'min_days': 2, 'max_days': 4, 'cost': 20.00},
    ]

    for z in zonas_eje_central:
        DistributorCoverage.objects.get_or_create(
            distributor=flete_propio,
            state=z['state'],
            municipality=z['municipality'],
            city=z['city'],
            defaults={
                'estimated_days_min': z['min_days'],
                'estimated_days_max': z['max_days'],
                'base_shipping_cost': z['cost'],
                'is_active': True
            }
        )


def reverse_seed(apps, schema_editor):
    Distributor = apps.get_model('shipment', 'Distributor')
    Distributor.objects.filter(rif__in=['J-00000001-1', 'J-00000002-2', 'J-50123456-7']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('shipment', '0005_remove_historicalshipment_coverage_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_distributors_and_coverages, reverse_seed),
    ]
