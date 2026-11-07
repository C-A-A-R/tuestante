from django.utils import timezone
from django.db import transaction
from django.db.models import Count, Q, Prefetch
from rest_framework import permissions, status, renderers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.base.api import BaseViewSet
from apps.orders.models import Order, OrderDetail, OrderProduct
from apps.production.models import ProductionOrder, ProductionProduct
from apps.production.api.serializers import (
    ProductionOrderSerializer,
    ProductionOrderStatusUpdateSerializer,
    ProductionProductSerializer,
    ProductionProductStatusUpdateSerializer,
    ProductionProductBulkUpdateSerializer,
)


class ProductionOrderViewSet(BaseViewSet):
    """
    ViewSet para la gestión y seguimiento de Órdenes de Fabricación en taller.
    - Clientes: pueden consultar el estado de fabricación de sus pedidos.
    - Administradores: controlan y actualizan las etapas de producción en el taller.
    """

    serializer_class = ProductionOrderSerializer
    search_fields = [
        'order__order_number',
        'order__user__first_name',
        'order__user__first_last_name',
        'order__user__username',
        'order__user__email',
        'technical_notes',
    ]
    ordering_fields = ['created_at', 'status', 'iteration', 'id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'by_order', 'my_orders', 'blueprint', 'worksheet']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        details_prefetch = Prefetch(
            'order__details',
            queryset=OrderDetail.objects.filter(is_deleted=False).prefetch_related(
                Prefetch(
                    'order_products',
                    queryset=OrderProduct.objects.filter(is_deleted=False).select_related('product')
                )
            )
        )
        queryset = ProductionOrder.objects.filter(
            is_deleted=False,
            order__is_deleted=False
        ).select_related(
            'order', 'order__user'
        ).prefetch_related(
            details_prefetch
        )

        # Si es cliente normal, filtrar solo sus pedidos
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(order__user=self.request.user)
        else:
            # Filtros para administradores
            user_param = self.request.query_params.get('user_id') or self.request.query_params.get('user')
            if user_param:
                if str(user_param).isdigit():
                    queryset = queryset.filter(order__user_id=int(user_param))
                else:
                    queryset = queryset.filter(order__user__username=user_param)

        # Filtro por estado de producción
        status_param = self.request.query_params.get('status') or self.request.query_params.get('estado')
        if status_param and status_param != 'all' and status_param != 'todos':
            queryset = queryset.filter(status=status_param)

        # Filtro por ID de Pedido
        order_param = self.request.query_params.get('order_id') or self.request.query_params.get('order')
        if order_param:
            queryset = queryset.filter(order_id=order_param)

        # Filtro por término de búsqueda
        search = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(order__order_number__icontains=search) |
                Q(order__user__first_name__icontains=search) |
                Q(order__user__first_last_name__icontains=search) |
                Q(order__user__username__icontains=search) |
                Q(order__user__email__icontains=search) |
                Q(technical_notes__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        if instance.order and (not instance.blueprint_svg or instance.technical_notes):
            try:
                from apps.production.services.parametric_service import ParametricDesignService
                design, svg_content, _ = ParametricDesignService.build_order_blueprint(
                    instance.order,
                    custom_notes=instance.technical_notes or ''
                )
                if svg_content:
                    instance.technical_design = design
                    instance.blueprint_svg = svg_content
                    instance.save(update_fields=['technical_design', 'blueprint_svg'])
            except Exception:
                pass
        instance.ensure_production_products()

    def retrieve(self, request, *args, **kwargs):
        """
        Retorna los detalles de la orden de producción. Si aún no cuenta con plano SVG
        o diseño técnico paramétrico, lo genera automáticamente. Asegura además que existan
        los productos físicos de taller.
        """
        instance = self.get_object()
        instance.ensure_production_products()
        force_refresh = request.query_params.get('refresh') in ['1', 'true', 'yes']
        has_old_badge = bool(instance.blueprint_svg and 'opacity="0.9"' in instance.blueprint_svg and 'FONDO' in instance.blueprint_svg)
        if (force_refresh or not instance.blueprint_svg or has_old_badge) and instance.order:
            try:
                from apps.production.services.parametric_service import ParametricDesignService
                design, svg_content, _ = ParametricDesignService.build_order_blueprint(
                    instance.order,
                    custom_notes=instance.technical_notes or ''
                )
                if svg_content:
                    instance.technical_design = design
                    instance.blueprint_svg = svg_content
                    instance.save(update_fields=['technical_design', 'blueprint_svg'])
            except Exception:
                pass

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='blueprint', permission_classes=[permissions.IsAuthenticated])
    def blueprint(self, request, pk=None):
        """
        Retorna el plano técnico SVG y diseño técnico de la orden de producción.
        Soporta ?format=svg para renderizado/descarga directa de la imagen vectorial.
        """
        po = self.get_object()
        svg_content = po.blueprint_svg
        design = po.technical_design

        force_refresh = request.query_params.get('refresh') in ['1', 'true', 'yes']
        has_old_badge = bool(svg_content and 'opacity="0.9"' in svg_content and 'FONDO' in svg_content)
        if (force_refresh or not svg_content or has_old_badge) and po.order:
            try:
                from apps.production.services.parametric_service import ParametricDesignService
                design, svg_content, _ = ParametricDesignService.build_order_blueprint(
                    po.order,
                    custom_notes=po.technical_notes or ''
                )
                if svg_content:
                    po.technical_design = design
                    po.blueprint_svg = svg_content
                    po.save(update_fields=['technical_design', 'blueprint_svg'])
            except Exception:
                pass

        if request.query_params.get('format') == 'svg' or 'image/svg+xml' in request.META.get('HTTP_ACCEPT', ''):
            from django.http import HttpResponse
            return HttpResponse(svg_content or '<svg></svg>', content_type='image/svg+xml')

        return Response({
            "production_order_id": po.id,
            "order_id": po.order_id,
            "order_number": po.order.order_number if po.order else "",
            "technical_design": design,
            "blueprint_svg": svg_content
        }, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['get'],
        url_path='worksheet',
        permission_classes=[permissions.IsAuthenticated],
        renderer_classes=[renderers.StaticHTMLRenderer, renderers.JSONRenderer]
    )
    def worksheet(self, request, pk=None):
        """
        Genera y retorna la Hoja de Ruta de Taller / Orden de Fabricación construida en el Backend.
        Parámetros query:
        - mode: 'with_design' (default) o 'text_only'
        - format: 'html' (default) o 'json'
        """
        po = self.get_object()
        mode = request.query_params.get('mode', 'with_design')
        format_param = request.query_params.get('export_format') or request.query_params.get('format', 'html')

        from apps.production.services.worksheet_service import ProductionWorksheetService
        html_content = ProductionWorksheetService.generate_worksheet_html(po, mode=mode)

        if format_param == 'json' or (hasattr(request, 'accepted_renderer') and request.accepted_renderer.format == 'json' and format_param != 'html'):
            year_code = po.created_at.year if po.created_at else timezone.now().year
            prod_code = f"OF-{year_code}-{po.id:04d}"
            return Response({
                "production_order_id": po.id,
                "production_code": prod_code,
                "mode": mode,
                "html": html_content
            }, status=status.HTTP_200_OK)

        return Response(html_content, content_type='text/html; charset=utf-8')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def update_status(self, request, pk=None):
        """
        Actualiza el estado de la orden de producción en taller y sincroniza el pedido.
        Payload esperado:
        {
            "status": "queued" | "assembling" | "painting" | "quality_check" | "completed",
            "technical_notes": "Notas adicionales opcionales...",
            "actual_completion_date": "2026-09-03T18:00:00Z" (opcional)
        }
        """
        production_order = self.get_object()
        serializer = ProductionOrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        technical_notes = serializer.validated_data.get('technical_notes')
        actual_completion_date = serializer.validated_data.get('actual_completion_date')

        production_order.status = new_status
        if technical_notes is not None:
            production_order.technical_notes = technical_notes
            if production_order.order:
                try:
                    from apps.production.services.parametric_service import ParametricDesignService
                    design, svg_content, _ = ParametricDesignService.build_order_blueprint(
                        production_order.order,
                        custom_notes=production_order.technical_notes or ''
                    )
                    if svg_content:
                        production_order.technical_design = design
                        production_order.blueprint_svg = svg_content
                except Exception:
                    pass
        if actual_completion_date is not None:
            production_order.actual_completion_date = actual_completion_date

        production_order.save()

        out_serializer = self.get_serializer(production_order)
        return Response(
            {
                "message": f"Estado de fabricación actualizado a '{production_order.get_status_display()}'.",
                "production_order": out_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def advance_stage(self, request, pk=None):
        """Avanza automáticamente la orden de producción a la siguiente fase del taller."""
        production_order = self.get_object()
        stages_flow = ['queued', 'assembling', 'painting', 'quality_check', 'completed']
        
        try:
            current_idx = stages_flow.index(production_order.status)
            if current_idx < len(stages_flow) - 1:
                next_stage = stages_flow[current_idx + 1]
                production_order.status = next_stage
                production_order.save()
                
                out_serializer = self.get_serializer(production_order)
                return Response(
                    {
                        "message": f"Orden avanzada exitosamente a '{production_order.get_status_display()}'.",
                        "production_order": out_serializer.data,
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                return Response(
                    {"error": "La orden de fabricación ya se encuentra en su fase final (Completada)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except ValueError:
            return Response(
                {"error": "Estado actual no reconocido para el flujo automático."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """Retorna estadísticas generales de fabricación en taller."""
        queryset = self.get_queryset()
        
        counts_by_status = queryset.values('status').annotate(total=Count('id'))
        status_dict = {item['status']: item['total'] for item in counts_by_status}

        data = {
            "total_orders": queryset.count(),
            "queued": status_dict.get('queued', 0),
            "assembling": status_dict.get('assembling', 0),
            "painting": status_dict.get('painting', 0),
            "quality_check": status_dict.get('quality_check', 0),
            "completed": status_dict.get('completed', 0),
            "in_progress_total": (
                status_dict.get('assembling', 0) +
                status_dict.get('painting', 0) +
                status_dict.get('quality_check', 0)
            ),
        }
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='order/(?P<order_id>[^/.]+)')
    def by_order(self, request, order_id=None):
        """Consulta todas las órdenes de fabricación (incluidas refabricaciones) asociadas a un pedido."""
        queryset = self.get_queryset().filter(order_id=order_id).order_by('iteration')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def update_products_status(self, request, pk=None):
        """
        Actualiza el estado de productos pertenecientes a esta orden de fabricación en lote.
        Soporta:
        - product_ids: [1, 2] + status: "painting" + notes
        - items: [{id: 1, status: "painting"}, {id: 2, status: "completed"}]
        """
        po = self.get_object()
        po.ensure_production_products()

        payload = request.data
        if isinstance(payload, list):
            payload = {'items': payload}

        serializer = ProductionProductBulkUpdateSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        product_ids = serializer.validated_data.get('product_ids')
        target_status = serializer.validated_data.get('status')
        common_notes = serializer.validated_data.get('notes')
        items = serializer.validated_data.get('items')

        updated_instances = []
        if product_ids and target_status:
            qs = po.products.filter(id__in=product_ids, is_deleted=False)
            for p in qs:
                p.record_stage_transition(target_status, notes=common_notes)
                p.save()
                updated_instances.append(p)
        elif items:
            item_map = {it['id']: it for it in items}
            qs = po.products.filter(id__in=item_map.keys(), is_deleted=False)
            for p in qs:
                it = item_map[p.id]
                p.record_stage_transition(it['status'], notes=it.get('notes'))
                p.save()
                updated_instances.append(p)

        po.sync_from_products()
        po_serializer = self.get_serializer(po)

        return Response({
            "message": f"Se actualizaron {len(updated_instances)} producto(s) de la orden {po.order.order_number or po.id}.",
            "updated_count": len(updated_instances),
            "production_order": po_serializer.data,
        }, status=status.HTTP_200_OK)


class ProductionProductViewSet(BaseViewSet):
    """
    ViewSet para la gestión individual y por lote de productos físicos en taller.
    - Consulta de productos con su propio número de producto y registro de fechas por fase.
    - Actualización individual y avance de fase.
    - Actualización masiva simultánea / por lote (bulk_update_status).
    """

    serializer_class = ProductionProductSerializer
    search_fields = [
        'product_number',
        'product__product_name',
        'production_order__order__order_number',
        'production_order__order__user__username',
        'production_order__order__user__first_name',
        'production_order__order__user__first_last_name',
        'notes',
    ]
    ordering_fields = ['created_at', 'status', 'product_number', 'unit_index', 'id']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'by_order', 'by_production_order']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = ProductionProduct.objects.filter(
            is_deleted=False,
            production_order__is_deleted=False
        ).select_related(
            'production_order',
            'production_order__order',
            'production_order__order__user',
            'product',
            'order_detail'
        )

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(production_order__order__user=self.request.user)
        else:
            # Filtro por usuario
            user_param = self.request.query_params.get('user_id') or self.request.query_params.get('user')
            if user_param:
                if str(user_param).isdigit():
                    queryset = queryset.filter(production_order__order__user_id=int(user_param))
                else:
                    queryset = queryset.filter(production_order__order__user__username=user_param)

        # Filtro por orden de fabricación
        po_param = self.request.query_params.get('production_order_id') or self.request.query_params.get('production_order')
        if po_param:
            queryset = queryset.filter(production_order_id=po_param)

        # Filtro por pedido
        order_param = self.request.query_params.get('order_id') or self.request.query_params.get('order')
        if order_param:
            queryset = queryset.filter(production_order__order_id=order_param)

        # Filtro por fase
        status_param = self.request.query_params.get('status') or self.request.query_params.get('estado')
        if status_param and status_param not in ['all', 'todos']:
            queryset = queryset.filter(status=status_param)

        # Filtro por rango de fechas
        date_from = self.request.query_params.get('date_from') or self.request.query_params.get('desde')
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        date_to = self.request.query_params.get('date_to') or self.request.query_params.get('hasta')
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        # Búsqueda
        search = self.request.query_params.get('search') or self.request.query_params.get('q')
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(product_number__icontains=search) |
                Q(product__product_name__icontains=search) |
                Q(production_order__order__order_number__icontains=search) |
                Q(production_order__order__user__first_name__icontains=search) |
                Q(production_order__order__user__first_last_name__icontains=search) |
                Q(production_order__order__user__username__icontains=search) |
                Q(notes__icontains=search)
            )

        return queryset

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def update_status(self, request, pk=None):
        """Actualiza la fase y observaciones de un producto individual."""
        prod = self.get_object()
        serializer = ProductionProductStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes')

        prod.record_stage_transition(new_status, notes=notes)
        prod.save()

        out_serializer = self.get_serializer(prod)
        return Response({
            "message": f"Producto '{prod.product_number}' actualizado a '{prod.get_status_display()}'.",
            "product": out_serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def advance_stage(self, request, pk=None):
        """Avanza automáticamente el producto individual a la siguiente fase del taller."""
        prod = self.get_object()
        stages_flow = ['queued', 'assembling', 'painting', 'quality_check', 'completed']

        try:
            curr_idx = stages_flow.index(prod.status)
            if curr_idx < len(stages_flow) - 1:
                next_stage = stages_flow[curr_idx + 1]
                prod.record_stage_transition(next_stage)
                prod.save()

                out_serializer = self.get_serializer(prod)
                return Response({
                    "message": f"Producto '{prod.product_number}' avanzado a '{prod.get_status_display()}'.",
                    "product": out_serializer.data
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {"error": "El producto ya se encuentra en su fase final (Completado)."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response(
                {"error": "Estado actual no reconocido."},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    @transaction.atomic
    def bulk_update_status(self, request):
        """
        Actualiza el estado de múltiples productos de taller simultáneamente o por lote.
        Soporta:
        1. {"product_ids": [1, 2, 3], "status": "painting", "notes": "Cabina 1"}
        2. {"items": [{"id": 1, "status": "painting"}, {"id": 2, "status": "completed"}]}
        3. [{"id": 1, "status": "painting"}, {"id": 2, "status": "completed"}] (array directo)
        """
        payload = request.data
        if isinstance(payload, list):
            payload = {'items': payload}

        serializer = ProductionProductBulkUpdateSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        product_ids = serializer.validated_data.get('product_ids')
        target_status = serializer.validated_data.get('status')
        common_notes = serializer.validated_data.get('notes')
        items = serializer.validated_data.get('items')

        updated_instances = []
        affected_production_orders = set()

        if product_ids and target_status:
            products_qs = ProductionProduct.objects.filter(
                id__in=product_ids,
                is_deleted=False
            ).select_related('production_order')

            for p in products_qs:
                p.record_stage_transition(target_status, notes=common_notes)
                p.save()
                updated_instances.append(p)
                if p.production_order_id:
                    affected_production_orders.add(p.production_order)

        elif items:
            item_map = {item['id']: item for item in items}
            products_qs = ProductionProduct.objects.filter(
                id__in=item_map.keys(),
                is_deleted=False
            ).select_related('production_order')

            for p in products_qs:
                item_data = item_map[p.id]
                new_st = item_data['status']
                notes = item_data.get('notes')
                p.record_stage_transition(new_st, notes=notes)
                p.save()
                updated_instances.append(p)
                if p.production_order_id:
                    affected_production_orders.add(p.production_order)

        # Sincronizar órdenes madre afectadas
        for po in affected_production_orders:
            po.sync_from_products()

        out_serializer = ProductionProductSerializer(
            updated_instances,
            many=True,
            context={'request': request}
        )

        return Response({
            "message": f"Se actualizaron {len(updated_instances)} producto(s) exitosamente.",
            "updated_count": len(updated_instances),
            "products": out_serializer.data
        }, status=status.HTTP_200_OK)
