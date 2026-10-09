from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.orders.models import Order, OrderDetail, OrderProduct
from apps.product.models import Product, ProductType
from apps.production.models import ProductionOrder, ProductionProduct

User = get_user_model()


class ProductionOrderTests(TestCase):
    """Suite de pruebas para la aplicación de Producción (ProductionOrder)."""

    def setUp(self):
        self.client = APIClient()

        # Usuario Cliente
        self.customer = User.objects.create_user(
            username='cliente_prod',
            email='cliente_prod@example.com',
            password='Password123!',
            first_name='Cliente',
            first_last_name='Produccion',
            is_active=True
        )

        # Otro Cliente
        self.other_customer = User.objects.create_user(
            username='otro_cliente',
            email='otro_cliente@example.com',
            password='Password123!',
            first_name='Otro',
            first_last_name='Cliente',
            is_active=True
        )

        # Administrador
        self.admin = User.objects.create_superuser(
            username='admin_prod',
            email='admin_prod@example.com',
            password='AdminPassword123!',
            first_name='Admin',
            first_last_name='Taller'
        )

        # Tipo de Producto y Producto
        self.product_type = ProductType.objects.create(product_type_name='Estante Modular')
        self.product = Product.objects.create(
            product_name='Estante Roble',
            product_type=self.product_type,
            price=150.00
        )

        # Pedido 1 (del cliente)
        self.order = Order.objects.create(
            user=self.customer,
            order_number='ORD-0001-2026',
            status='manufacturing',
            total_price=300.00
        )
        self.order_detail = OrderDetail.objects.create(
            order=self.order,
            quantity=2,
            unit_price=150.00,
            final_price=300.00,
            notes='Acabado barniz mate'
        )
        self.order_product = OrderProduct.objects.create(
            order_detail=self.order_detail,
            product=self.product,
            price_at_order=150.00
        )

        # Pedido 2 (del otro cliente)
        self.order2 = Order.objects.create(
            user=self.other_customer,
            order_number='ORD-0002-2026',
            status='manufacturing',
            total_price=150.00
        )

    def test_create_production_order_model(self):
        """Verifica la creación básica de una orden de producción y su representación."""
        po = ProductionOrder.objects.create(
            order=self.order,
            status='queued',
            technical_notes='Cortar tablas a 120cm'
        )

        self.assertEqual(po.order, self.order)
        self.assertEqual(po.status, 'queued')
        self.assertEqual(po.iteration, 1)
        self.assertIn('ORD-0001-2026', str(po))
        self.assertIn('En Cola de Espera', str(po))

    def test_multiple_production_orders_per_order_iteration(self):
        """
        Verifica que un pedido puede tener múltiples órdenes de producción
        (por ejemplo en caso de devolución/refabricación) e incrementa la iteración.
        """
        po1 = ProductionOrder.objects.create(
            order=self.order,
            status='completed',
            technical_notes='Primera fabricación'
        )
        self.assertEqual(po1.iteration, 1)

        # El pedido es devuelto y se genera una nueva orden de refabricación
        po2 = ProductionOrder.objects.create(
            order=self.order,
            status='queued',
            technical_notes='Refabricación por devolución de cliente'
        )
        self.assertEqual(po2.iteration, 2)
        self.assertEqual(self.order.production_orders.count(), 2)

    def test_status_transition_assembling_sets_start_date(self):
        """Verifica que al pasar a ensamblaje se asigna automáticamente la fecha de inicio."""
        po = ProductionOrder.objects.create(
            order=self.order,
            status='queued'
        )
        self.assertIsNone(po.start_date)

        po.status = 'assembling'
        po.save()

        po.refresh_from_db()
        self.assertIsNotNone(po.start_date)

    def test_status_transition_completed_sets_completion_date_and_order_status(self):
        """
        Verifica que al completar la fabricación:
        1. Se asigna actual_completion_date.
        2. Se actualiza el estado del pedido a 'waiting_final_payment'.
        """
        self.order.status = 'manufacturing'
        self.order.save()

        po = ProductionOrder.objects.create(
            order=self.order,
            status='quality_check'
        )
        self.assertIsNone(po.actual_completion_date)

        po.status = 'completed'
        po.save()

        po.refresh_from_db()
        self.order.refresh_from_db()

        self.assertIsNotNone(po.actual_completion_date)
        self.assertEqual(self.order.status, 'waiting_final_payment')

    def test_api_list_permissions_customer_vs_admin(self):
        """Verifica que un cliente solo ve sus órdenes de producción y un admin ve todas."""
        po1 = ProductionOrder.objects.create(order=self.order, status='assembling')
        po2 = ProductionOrder.objects.create(order=self.order2, status='painting')

        # Como cliente normal
        self.client.force_authenticate(user=self.customer)
        response = self.client.get('/api/production/production-orders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data if isinstance(response.data, list) else response.data.get('results', [])
        ids = [item['id'] for item in results]
        self.assertIn(po1.id, ids)
        self.assertNotIn(po2.id, ids)

        # Como administrador
        self.client.force_authenticate(user=self.admin)
        response_admin = self.client.get('/api/production/production-orders/')
        self.assertEqual(response_admin.status_code, status.HTTP_200_OK)
        admin_results = response_admin.data if isinstance(response_admin.data, list) else response_admin.data.get('results', [])
        admin_ids = [item['id'] for item in admin_results]
        self.assertIn(po1.id, admin_ids)
        self.assertIn(po2.id, admin_ids)

    def test_api_update_status_endpoint(self):
        """Verifica el endpoint update_status para actualizar fases de fabricación."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/production/production-orders/{po.id}/update_status/', {
            'status': 'painting',
            'technical_notes': 'Pintado con electrostática color negro'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, 'painting')
        self.assertEqual(po.technical_notes, 'Pintado con electrostática color negro')

    def test_api_advance_stage_endpoint(self):
        """Verifica el endpoint advance_stage que avanza en cascada las etapas de taller."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')

        self.client.force_authenticate(user=self.admin)
        
        # 1. queued -> assembling
        res1 = self.client.post(f'/api/production/production-orders/{po.id}/advance_stage/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, 'assembling')

        # 2. assembling -> painting
        res2 = self.client.post(f'/api/production/production-orders/{po.id}/advance_stage/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, 'painting')

    def test_api_metrics_endpoint(self):
        """Verifica el endpoint de métricas del taller."""
        ProductionOrder.objects.create(order=self.order, status='queued')
        ProductionOrder.objects.create(order=self.order2, status='assembling')

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/production/production-orders/metrics/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_orders', response.data)
        self.assertIn('queued', response.data)
        self.assertIn('assembling', response.data)
        self.assertIn('in_progress_total', response.data)
        self.assertGreaterEqual(response.data['total_orders'], 2)

    def test_api_by_order_endpoint(self):
        """Verifica el endpoint by_order para obtener las órdenes de un pedido específico."""
        po1 = ProductionOrder.objects.create(order=self.order, status='completed')
        po2 = ProductionOrder.objects.create(order=self.order, status='queued')

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f'/api/production/production-orders/order/{self.order.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        iterations = [item['iteration'] for item in response.data]
        self.assertIn(1, iterations)
        self.assertIn(2, iterations)

    def test_parametric_design_service_base_mapping(self):
        """Verifica la conversión de dimensiones cm a mm y la cuadrícula de compartimentos."""
        from apps.production.services.parametric_service import ParametricDesignService
        self.product.height_cm = 180.0
        self.product.width_cm = 90.0
        self.product.depth_cm = 40.0
        self.product.columns_count = 2
        self.product.rows_count = 3
        self.product.has_doors = True
        self.product.main_color = '#FFFFFF'
        self.product.save()

        design = ParametricDesignService.build_base_parametric_design(self.product)
        self.assertEqual(design['dimensions_mm']['height'], 1800)
        self.assertEqual(design['dimensions_mm']['width'], 900)
        self.assertEqual(design['dimensions_mm']['depth'], 400)
        self.assertEqual(design['grid']['rows'], 3)
        self.assertEqual(design['grid']['columns'], 2)
        self.assertEqual(len(design['compartments']), 6)
        self.assertTrue(design['compartments'][0]['has_door'])

    def test_ai_customizer_empty_notes(self):
        """Verifica que notas vacías no consumen tokens ni alteran el diseño."""
        from apps.production.services.parametric_service import ParametricDesignService
        from apps.production.services.ai_customizer_service import AICustomizerService

        design = ParametricDesignService.build_base_parametric_design(self.product)
        custom_design, has_changes, msg = AICustomizerService.apply_customizations(design, "   ")
        self.assertFalse(has_changes)
        self.assertEqual(custom_design, design)

    def test_svg_blueprint_generator(self):
        """Verifica que el generador SVG produzca un XML/SVG válido con cotas técnicas."""
        from apps.production.services.parametric_service import ParametricDesignService
        from apps.production.services.svg_generator_service import SVGBlueprintGenerator

        self.product.height_cm = 200.0
        self.product.width_cm = 100.0
        self.product.depth_cm = 50.0
        self.product.columns_count = 2
        self.product.rows_count = 4
        self.product.save()

        design = ParametricDesignService.build_base_parametric_design(self.product)
        svg = SVGBlueprintGenerator.generate_svg(design, title="TEST BLUEPRINT")
        self.assertIn('<svg', svg)
        self.assertIn('</svg>', svg)
        self.assertIn('ANCHO 1000 mm', svg)
        self.assertIn('ALTO 2000 mm', svg)
        self.assertIn('500 mm', svg)  # Fondo

    def test_order_blueprint_api_endpoint(self):
        """Verifica el endpoint GET /api/orders/{id}/blueprint/."""
        detail = OrderDetail.objects.create(order=self.order, quantity=1, unit_price=150.0)
        OrderProduct.objects.create(order_detail=detail, product=self.product, price_at_order=150.0)

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f'/api/orders/{self.order.id}/blueprint/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('technical_design', response.data)
        self.assertIn('blueprint_svg', response.data)
        self.assertIn('<svg', response.data['blueprint_svg'])

    def test_parametric_design_stacking_sections_compound(self):
        """Verifica que el Stacking Layout Engine genere secciones apiladas para compuesto_locker_banca."""
        from apps.production.services.parametric_service import ParametricDesignService

        self.product_type.archetype = 'compuesto_locker_banca'
        self.product_type.save()

        self.product.height_cm = 180.0
        self.product.width_cm = 90.0
        self.product.depth_cm = 40.0
        self.product.columns_count = 2
        self.product.rows_count = 2
        self.product.has_doors = True
        self.product.save()

        design = ParametricDesignService.build_base_parametric_design(self.product)
        self.assertEqual(design['archetype'], 'compuesto_locker_banca')
        self.assertIn('sections', design)
        self.assertEqual(len(design['sections']), 2)

        # Sección 1: Banca inferior
        sec_bench = design['sections'][0]
        self.assertEqual(sec_bench['block_type'], 'asiento_banca')
        self.assertEqual(sec_bench['zone'], 'inferior')
        self.assertTrue(sec_bench['accessories']['has_tubular_legs'])
        self.assertFalse(sec_bench['accessories']['has_doors'])

        # Sección 2: Casillero superior
        sec_locker = design['sections'][1]
        self.assertEqual(sec_locker['block_type'], 'caja_puertas')
        self.assertEqual(sec_locker['zone'], 'superior')
        self.assertTrue(sec_locker['accessories']['has_doors'])
        self.assertTrue(sec_locker['accessories']['has_bevels'])
        self.assertTrue(sec_locker['accessories']['has_ventilation'])

    def test_heuristic_filter_logistics_zero_tokens(self):
        """Verifica que notas puramente logísticas se descartan en 0 tokens sin invocar IA."""
        from apps.production.services.parametric_service import ParametricDesignService
        from apps.production.services.ai_customizer_service import AICustomizerService

        design = ParametricDesignService.build_base_parametric_design(self.product)
        logistics_notes = "Por favor entregar en horas de la mañana, llamar antes al 0414-5555555 y enviar por Tealca. Muchas gracias!"
        custom_design, has_changes, msg = AICustomizerService.apply_customizations(design, logistics_notes)

        self.assertFalse(has_changes)
        self.assertIn("0 tokens", msg)
        self.assertEqual(custom_design['dimensions_mm'], design['dimensions_mm'])

    def test_product_type_architecture_inference(self):
        """Verifica la inferencia heurística offline de arquitectura para tipos de productos desconocidos."""
        from apps.product.services.architecture_service import ProductTypeArchitectureService

        # 1. Producto tipo banca
        inf_bench = ProductTypeArchitectureService._fallback_heuristic_inference("Banca de vestuario para gimnasio", "Estructura metálica para sentarse")
        self.assertEqual(inf_bench.archetype, 'banca')
        self.assertFalse(inf_bench.default_has_doors)

        # 2. Producto tipo estante
        inf_shelf = ProductTypeArchitectureService._fallback_heuristic_inference("Librero modular de 5 entrepaños", "Estantes abiertos para libros")
        self.assertEqual(inf_shelf.archetype, 'estante_abierto')
        self.assertFalse(inf_shelf.default_has_doors)

        # 3. Compuesto locker-banca
        inf_comp = ProductTypeArchitectureService._fallback_heuristic_inference("Casillero metálico con banca integrada", "Locker con asiento inferior")
        self.assertEqual(inf_comp.archetype, 'compuesto_locker_banca')
        self.assertTrue(inf_comp.default_has_doors)

    def test_svg_2_5d_renders_bevels_and_louvers(self):
        """Verifica que el SVG 2.5D contenga las caras sombreadas, biseles y ranuras de ventilación."""
        from apps.production.services.parametric_service import ParametricDesignService
        from apps.production.services.svg_generator_service import SVGBlueprintGenerator

        self.product.height_cm = 180.0
        self.product.width_cm = 40.0
        self.product.depth_cm = 45.0
        self.product.columns_count = 1
        self.product.rows_count = 1
        self.product.has_doors = True
        self.product.main_color = '#C0392B'  # Rojo locker
        self.product.save()

        design = ParametricDesignService.build_base_parametric_design(self.product)
        svg = SVGBlueprintGenerator.generate_svg(design, title="LOCKER TEST 2.5D")

        self.assertIn('polygon', svg)
        self.assertIn('Cara Lateral Sombreada', svg)
        self.assertIn('Bisel perimetral en relieve', svg)
        self.assertIn('Ranuras de ventilación', svg)
        self.assertIn('Placa metálica de cerradura/tirador', svg)
        self.assertIn('ANCHO 400 mm', svg)
        self.assertIn('ALTO 1800 mm', svg)
        self.assertIn('FONDO 450 mm', svg)

    def test_multi_product_order_blueprint_generation(self):
        """Verifica que un pedido con múltiples productos genere un plano y diseño técnico multi-producto consolidado."""
        from apps.production.services.parametric_service import ParametricDesignService
        from apps.production.api.serializers import ProductionOrderSerializer

        # Segundo tipo de producto y segundo producto en la misma orden
        pt2 = ProductType.objects.create(product_type_name='Casillero Metálico')
        prod2 = Product.objects.create(
            product_name='Locker 4 Puertas',
            product_type=pt2,
            price=220.00,
            height_cm=180.0,
            width_cm=80.0,
            depth_cm=50.0,
            columns_count=2,
            rows_count=2,
            has_doors=True,
            main_color='#005187'
        )
        detail2 = OrderDetail.objects.create(
            order=self.order,
            quantity=3,
            unit_price=220.00,
            final_price=660.00,
            notes='Pintura epoxi azul corporativo'
        )
        OrderProduct.objects.create(
            order_detail=detail2,
            product=prod2,
            price_at_order=220.00
        )

        # Generar blueprint del pedido multi-producto
        composite_design, multi_svg, summary = ParametricDesignService.build_order_blueprint(self.order)

        self.assertIsNotNone(composite_design)
        self.assertTrue(composite_design.get('is_multi_product'))
        self.assertEqual(composite_design.get('total_products'), 2)
        self.assertEqual(composite_design.get('total_units'), 5)  # 2 + 3 unidades
        self.assertEqual(len(composite_design.get('items')), 2)

        # Verificar que cada detalle guardó su propio diseño técnico
        self.order_detail.refresh_from_db()
        detail2.refresh_from_db()
        self.assertIsNotNone(self.order_detail.technical_design)
        self.assertIsNotNone(detail2.technical_design)

        # Verificar contenido de la lámina vectorial multi-producto
        self.assertIn('DOSSIER TALLER: 2 MODELOS DISTINTOS', multi_svg)
        self.assertIn('5 UNIDADES EN TOTAL A FABRICAR', multi_svg)
        self.assertIn('ESTANTE ROBLE', multi_svg.upper())
        self.assertIn('LOCKER 4 PUERTAS', multi_svg.upper())
        self.assertIn('CANTIDAD: 2 UDS.', multi_svg)
        self.assertIn('CANTIDAD: 3 UDS.', multi_svg)

        # Verificar serializer
        po = ProductionOrder.objects.create(
            order=self.order,
            status='queued',
            technical_design=composite_design,
            blueprint_svg=multi_svg
        )
        serializer = ProductionOrderSerializer(po)
        items_summary = serializer.data.get('order_items_summary', [])
        self.assertEqual(len(items_summary), 2)
        self.assertEqual(items_summary[0]['detail_id'], self.order_detail.id)
        self.assertEqual(items_summary[1]['detail_id'], detail2.id)
        self.assertIsNotNone(items_summary[0]['technical_design'])
        self.assertIsNotNone(items_summary[1]['technical_design'])

    def test_production_product_generation_and_numbering(self):
        """Verifica la generación automática de productos independientes con número único y fechas."""
        po = ProductionOrder.objects.create(
            order=self.order,
            status='queued'
        )
        products = po.ensure_production_products()
        self.assertEqual(len(products), 2)  # self.order_detail.quantity = 2

        p1, p2 = products[0], products[1]
        self.assertNotEqual(p1.product_number, p2.product_number)
        self.assertTrue(p1.product_number.startswith('PRD-'))
        self.assertEqual(p1.unit_index, 1)
        self.assertEqual(p2.unit_index, 2)
        self.assertEqual(p1.status, 'queued')
        self.assertIsNotNone(p1.queued_at)
        self.assertIsNone(p1.assembling_at)
        self.assertIsNone(p1.completed_at)

    def test_production_product_stage_transition_and_history(self):
        """Verifica que cada producto registre las fechas y bitácora de cada fase constructiva."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')
        p = po.ensure_production_products()[0]

        # Transición a ensamblaje
        p.record_stage_transition('assembling', notes='Iniciando corte y armado')
        p.save()
        self.assertEqual(p.status, 'assembling')
        self.assertIsNotNone(p.assembling_at)
        self.assertEqual(len(p.stage_history), 2)
        self.assertEqual(p.stage_history[-1]['to_status'], 'assembling')

        # Transición a pintura
        p.record_stage_transition('painting', notes='Aplicando sellador')
        p.save()
        self.assertEqual(p.status, 'painting')
        self.assertIsNotNone(p.painting_at)

        # Transición a control de calidad
        p.record_stage_transition('quality_check', notes='Inspección visual')
        p.save()
        self.assertEqual(p.status, 'quality_check')
        self.assertIsNotNone(p.quality_check_at)

        # Transición a completado
        p.record_stage_transition('completed', notes='Listo para despacho')
        p.save()
        self.assertEqual(p.status, 'completed')
        self.assertIsNotNone(p.completed_at)

    def test_production_product_api_single_update(self):
        """Verifica el endpoint individual de actualización de estado de producto."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')
        p = po.ensure_production_products()[0]

        self.client.force_authenticate(user=self.admin)
        url = f'/api/production-products/{p.id}/update_status/'
        response = self.client.post(url, {'status': 'assembling', 'notes': 'Corte iniciado'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        p.refresh_from_db()
        self.assertEqual(p.status, 'assembling')
        self.assertIsNotNone(p.assembling_at)
        self.assertEqual(p.notes, 'Corte iniciado')

    def test_production_product_api_advance_stage(self):
        """Verifica el endpoint para avanzar de fase un producto físico individual."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')
        p = po.ensure_production_products()[0]

        self.client.force_authenticate(user=self.admin)
        url = f'/api/production-products/{p.id}/advance_stage/'
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        p.refresh_from_db()
        self.assertEqual(p.status, 'assembling')
        self.assertIsNotNone(p.assembling_at)

    def test_production_product_api_bulk_update_homogeneous(self):
        """Verifica la actualización en lote de varios productos al mismo estado simultáneamente."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')
        prods = po.ensure_production_products()
        p1, p2 = prods[0], prods[1]

        self.client.force_authenticate(user=self.admin)
        url = '/api/production-products/bulk_update_status/'
        response = self.client.post(url, {
            'product_ids': [p1.id, p2.id],
            'status': 'painting',
            'notes': 'Pintura electrostática aplicada en lote'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('updated_count'), 2)

        p1.refresh_from_db()
        p2.refresh_from_db()
        self.assertEqual(p1.status, 'painting')
        self.assertEqual(p2.status, 'painting')
        self.assertIsNotNone(p1.painting_at)
        self.assertIsNotNone(p2.painting_at)

    def test_production_product_api_bulk_update_heterogeneous(self):
        """Verifica la actualización en lote con estados diferenciados por producto."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')
        prods = po.ensure_production_products()
        p1, p2 = prods[0], prods[1]

        self.client.force_authenticate(user=self.admin)
        url = '/api/production-products/bulk_update_status/'
        response = self.client.post(url, {
            'items': [
                {'id': p1.id, 'status': 'completed', 'notes': 'Finalizado'},
                {'id': p2.id, 'status': 'quality_check', 'notes': 'En revisión'}
            ]
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('updated_count'), 2)

        p1.refresh_from_db()
        p2.refresh_from_db()
        self.assertEqual(p1.status, 'completed')
        self.assertEqual(p2.status, 'quality_check')
        self.assertIsNotNone(p1.completed_at)
        self.assertIsNotNone(p2.quality_check_at)

    def test_production_order_sync_from_products(self):
        """Verifica que la orden de producción se sincronice al completar todos sus productos."""
        po = ProductionOrder.objects.create(order=self.order, status='queued')
        prods = po.ensure_production_products()

        for p in prods:
            p.record_stage_transition('completed')
            p.save()

        po.sync_from_products()
        po.refresh_from_db()
        self.order.refresh_from_db()

        self.assertEqual(po.status, 'completed')
        self.assertIsNotNone(po.actual_completion_date)
        self.assertEqual(self.order.status, 'waiting_final_payment')

