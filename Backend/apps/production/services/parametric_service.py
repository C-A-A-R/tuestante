"""
Servicio de Mapeo Algorítmico Base para Diseño Paramétrico (Consumo: 0 Tokens).
Implementa el Stacking Layout Engine: arquitectura modular de bloques apilados
para productos simples (lockers, estantes, bancas) y productos compuestos híbridos.
Garantiza inmutabilidad y transferencia a ManufacturingOrder.
"""

from typing import Dict, Any, Optional, List, Tuple
from apps.product.models import Product


class ParametricDesignService:
    """
    Construye la representación paramétrica técnica modular para fabricación
    a partir de los datos almacenados en base de datos.
    Opera bajo un enfoque determinista de 0 consumo de tokens.
    """

    COLOR_MAP = {
        'blanco': '#FFFFFF',
        'negro': '#1A1A1A',
        'roble': '#A67B5B',
        'madera': '#8B5A2B',
        'nogal': '#5C4033',
        'gris': '#7F8C8D',
        'azul': '#2980B9',
        'rojo': '#C0392B',
        'rojo granate': '#900C3F',
        'verde': '#27AE60',
        'grafito': '#2C3E50',
    }

    @classmethod
    def normalize_color(cls, color_str: str) -> str:
        """Normaliza el color a código hexadecimal."""
        c = str(color_str or '').strip().lower()
        if not c:
            return '#2C3E50'
        if c.startswith('#') and len(c) in [4, 7]:
            return c.upper()
        return cls.COLOR_MAP.get(c, '#2C3E50')

    @classmethod
    def build_base_parametric_design(
        cls,
        product: Product,
        order_detail=None,
        custom_notes: str = "",
        force_rebuild: bool = False
    ) -> Dict[str, Any]:
        """
        Genera el diccionario técnico paramétrico base en milímetros.
        Sin llamadas externas ni consumo de tokens (0 tokens).
        """
        pname_l = (product.product_name or '').lower()
        product_type = getattr(product, 'product_type', None)
        furniture_type = getattr(product_type, 'product_type_name', 'Mobiliario Modular') if product_type else 'Mobiliario Modular'
        ftype_l = (furniture_type or '').lower()
        is_shelf = any(term in pname_l or term in ftype_l for term in ['estante', 'estanteria', 'estantería', 'repisa', 'balda', 'librero', 'biblioteca'])

        # Si el detalle de pedido ya posee un diseño técnico inmutable definitivo, respetarlo solo si no es reconstrucción forzada y no está corrupto
        if not force_rebuild and order_detail and hasattr(order_detail, 'technical_design') and order_detail.technical_design:
            if isinstance(order_detail.technical_design, dict) and order_detail.technical_design.get('sections'):
                td = order_detail.technical_design
                # Si es un estante pero fue guardado con caja_cerrada o sin grid, ignorar caché corrupta
                is_stale_shelf = is_shelf and (td.get('archetype') != 'estante_abierto' or not td.get('grid'))
                if not is_stale_shelf:
                    return order_detail.technical_design

        # 1. Dimensiones en milímetros (cm * 10)
        height_cm = float(product.height_cm or 0)
        width_cm = float(product.width_cm or 0)
        depth_cm = float(product.depth_cm or 0)

        height_mm = round(height_cm * 10) if height_cm > 0 else 1800
        width_mm = round(width_cm * 10) if width_cm > 0 else 900
        depth_mm = round(depth_cm * 10) if depth_cm > 0 else 400

        # 2. Distribución geométrica
        cols = max(1, int(getattr(product, 'columns', None) or getattr(product, 'columns_count', 1) or 1))
        rows = max(1, int(getattr(product, 'rows', None) or getattr(product, 'rows_count', 1) or 1))
        default_has_doors = bool(getattr(product, 'has_doors', False))

        # 3. Colores y tipología
        # Preferir el hex guardado directamente; si no, normalizarlo del nombre
        saved_hex = str(getattr(product, 'main_color_hex', '') or '').strip()
        if saved_hex and saved_hex.startswith('#'):
            main_color = saved_hex
        else:
            main_color = cls.normalize_color(product.main_color)
        main_color_hex = main_color  # garantizamos que siempre sea hex

        archetype = getattr(product_type, 'archetype', 'caja_cerrada') or 'caja_cerrada'
        layout_template = getattr(product_type, 'layout_template', None)

        if is_shelf:
            archetype = 'estante_abierto'
            default_has_doors = False
        elif not default_has_doors and product_type and getattr(product_type, 'default_has_doors', False):
            default_has_doors = True

        # 4. Construcción modular de Secciones (Stacking Layout Engine)
        sections = cls._build_modular_sections(
            archetype=archetype,
            layout_template=layout_template,
            height_mm=height_mm,
            width_mm=width_mm,
            depth_mm=depth_mm,
            cols=cols,
            rows=rows,
            default_has_doors=default_has_doors,
            main_color=main_color
        )

        # Cálculo de profundidad máxima exterior considerando salientes (ej. bancas)
        max_depth_mm = max([depth_mm] + [s.get('local_dimensions_mm', {}).get('depth', depth_mm) for s in sections])

        # 5. Generación de matriz clásica de compartimentos para retrocompatibilidad
        compartments = []
        for r in range(1, rows + 1):
            for c in range(1, cols + 1):
                compartments.append({
                    "row": r,
                    "col": c,
                    "has_door": default_has_doors if not is_shelf else False,
                    "door_color": main_color if (default_has_doors and not is_shelf) else None,
                    "has_ventilation": (archetype in ['caja_cerrada', 'compuesto_locker_banca']) and not is_shelf,
                    "notes": ""
                })

        detail_notes = ""
        if order_detail and hasattr(order_detail, 'notes') and order_detail.notes:
            detail_notes = str(order_detail.notes).strip()
        elif custom_notes:
            detail_notes = str(custom_notes).strip()

        design = {
            "product_id": product.id,
            "product_name": product.product_name,
            "furniture_type": furniture_type,
            "archetype": archetype,
            "main_color": main_color,
            "dimensions_total_mm": {
                "height": height_mm,
                "width": width_mm,
                "max_depth": max_depth_mm
            },
            # Campos retrocompatibles para consumo directo
            "dimensions_mm": {
                "height": height_mm,
                "width": width_mm,
                "depth": depth_mm
            },
            "grid": {
                "rows": rows,
                "columns": cols
            },
            "sections": sections,
            "compartments": compartments,
            "main_color_hex": main_color_hex,
            "original_notes": detail_notes
        }

        return design

    @classmethod
    def _build_modular_sections(
        cls,
        archetype: str,
        layout_template: Optional[Dict[str, Any]],
        height_mm: int,
        width_mm: int,
        depth_mm: int,
        cols: int,
        rows: int,
        default_has_doors: bool,
        main_color: str
    ) -> List[Dict[str, Any]]:
        """
        Genera la lista de bloques constructivos normalizados.
        Si existe un layout_template en el ProductType, lo escala con precisión.
        De lo contrario, aplica la arquitectura por arquetipo.
        """
        # Caso A: Existe layout_template definido (ej. inferido dinámicamente por IA al crear el tipo)
        if layout_template and isinstance(layout_template, dict) and layout_template.get('sections'):
            raw_sections = layout_template.get('sections', [])
            sections = []
            for idx, r_sec in enumerate(raw_sections):
                ratios = r_sec.get('local_dimensions_ratio', {})
                h_ratio = float(ratios.get('height_ratio', 1.0 / max(1, len(raw_sections))))
                d_offset = int(ratios.get('depth_offset_mm', 0))

                sec_h = max(100, round(height_mm * h_ratio))
                sec_d = max(100, depth_mm + d_offset)

                raw_acc = r_sec.get('accessories', {})
                has_doors = raw_acc.get('has_doors', default_has_doors)
                if default_has_doors:
                    has_doors = True

                sections.append({
                    "section_id": r_sec.get('section_id', f"sec_{idx + 1}"),
                    "stack_order": int(r_sec.get('stack_order', idx + 1)),
                    "zone": r_sec.get('zone', 'cuerpo_principal'),
                    "block_type": r_sec.get('block_type', 'caja_puertas' if has_doors else 'estanteria_baldas'),
                    "local_dimensions_mm": {
                        "height": sec_h,
                        "width": width_mm,
                        "depth": sec_d
                    },
                    "grid": {
                        "columns": cols,
                        "rows": max(1, round(rows * h_ratio)) if rows > 1 else 1
                    },
                    "accessories": {
                        "has_doors": has_doors,
                        "has_handles": raw_acc.get('has_handles', has_doors),
                        "has_bevels": raw_acc.get('has_bevels', has_doors),
                        "has_ventilation": raw_acc.get('has_ventilation', False),
                        "has_tubular_legs": raw_acc.get('has_tubular_legs', False),
                        "has_plinth": raw_acc.get('has_plinth', True)
                    },
                    "color_mapping": {
                        "body_color": main_color,
                        "doors_color": main_color if has_doors else None,
                        "seat_color": "#A67B5B" if r_sec.get('block_type') == 'asiento_banca' else None
                    }
                })
            return sections

        # Caso B: Generadores nativos por arquetipo
        if archetype == 'compuesto_locker_banca':
            bench_h = min(450, round(height_mm * 0.25)) if height_mm >= 1200 else 400
            locker_h = max(200, height_mm - bench_h)
            bench_depth = max(depth_mm + 200, 600)  # Saliente frontal de 200 mm
            locker_depth = depth_mm

            return [
                {
                    "section_id": "sec_bench_base",
                    "stack_order": 1,
                    "zone": "inferior",
                    "block_type": "asiento_banca",
                    "local_dimensions_mm": {
                        "height": bench_h,
                        "width": width_mm,
                        "depth": bench_depth
                    },
                    "grid": {
                        "columns": cols,
                        "rows": 1
                    },
                    "accessories": {
                        "has_doors": False,
                        "has_handles": False,
                        "has_bevels": False,
                        "has_ventilation": False,
                        "has_tubular_legs": True,
                        "has_plinth": False
                    },
                    "color_mapping": {
                        "body_color": "#1A252F",
                        "doors_color": None,
                        "seat_color": "#A67B5B"
                    }
                },
                {
                    "section_id": "sec_upper_locker",
                    "stack_order": 2,
                    "zone": "superior",
                    "block_type": "caja_puertas",
                    "local_dimensions_mm": {
                        "height": locker_h,
                        "width": width_mm,
                        "depth": locker_depth
                    },
                    "grid": {
                        "columns": cols,
                        "rows": rows
                    },
                    "accessories": {
                        "has_doors": True,
                        "has_handles": True,
                        "has_bevels": True,
                        "has_ventilation": True,
                        "has_tubular_legs": False,
                        "has_plinth": False
                    },
                    "color_mapping": {
                        "body_color": main_color,
                        "doors_color": main_color
                    }
                }
            ]

        if archetype == 'banca':
            return [
                {
                    "section_id": "sec_bench",
                    "stack_order": 1,
                    "zone": "cuerpo_principal",
                    "block_type": "asiento_banca",
                    "local_dimensions_mm": {
                        "height": height_mm,
                        "width": width_mm,
                        "depth": depth_mm
                    },
                    "grid": {
                        "columns": cols,
                        "rows": 1
                    },
                    "accessories": {
                        "has_doors": False,
                        "has_handles": False,
                        "has_bevels": False,
                        "has_ventilation": False,
                        "has_tubular_legs": True,
                        "has_plinth": False
                    },
                    "color_mapping": {
                        "body_color": "#1A252F",
                        "doors_color": None,
                        "seat_color": main_color
                    }
                }
            ]

        if archetype == 'estante_abierto':
            return [
                {
                    "section_id": "sec_open_shelf",
                    "stack_order": 1,
                    "zone": "cuerpo_principal",
                    "block_type": "estanteria_baldas",
                    "local_dimensions_mm": {
                        "height": height_mm,
                        "width": width_mm,
                        "depth": depth_mm
                    },
                    "grid": {
                        "columns": cols,
                        "rows": rows
                    },
                    "accessories": {
                        "has_doors": False,
                        "has_handles": False,
                        "has_bevels": False,
                        "has_ventilation": False,
                        "has_tubular_legs": False,
                        "has_plinth": True
                    },
                    "color_mapping": {
                        "body_color": main_color,
                        "doors_color": None
                    }
                }
            ]

        # Por defecto: caja_cerrada o generico_modular
        return [
            {
                "section_id": "sec_cabinet_body",
                "stack_order": 1,
                "zone": "cuerpo_principal",
                "block_type": "caja_puertas" if default_has_doors else "estanteria_baldas",
                "local_dimensions_mm": {
                    "height": height_mm,
                    "width": width_mm,
                    "depth": depth_mm
                },
                "grid": {
                    "columns": cols,
                    "rows": rows
                },
                "accessories": {
                    "has_doors": default_has_doors,
                    "has_handles": default_has_doors,
                    "has_bevels": default_has_doors,
                    "has_ventilation": default_has_doors,
                    "has_tubular_legs": False,
                    "has_plinth": True
                },
                "color_mapping": {
                    "body_color": main_color,
                    "doors_color": main_color if default_has_doors else None
                }
            }
        ]

    @classmethod
    def build_order_blueprint(cls, order, custom_notes: str = ""):
        """
        Genera el snapshot de diseño técnico paramétrico (JSON) y el plano SVG
        a partir de TODOS los productos y notas asociados a una orden.
        Para pedidos de un solo producto, genera la ficha estándar.
        Para pedidos con múltiples productos, genera un dossier técnico consolidado
        multi-producto con planos 2.5D acotados individuales y colectivos.
        Persiste inmutablemente en cada OrderDetail.technical_design.
        """
        from apps.production.services.ai_customizer_service import AICustomizerService
        from apps.production.services.svg_generator_service import SVGBlueprintGenerator

        # Buscar todos los productos del pedido a partir de los detalles
        details = order.details.filter(is_deleted=False).prefetch_related('order_products__product')
        
        items_designs = []
        overall_notes = [str(order.notes).strip()] if order.notes else []
        if custom_notes:
            overall_notes.append(str(custom_notes).strip())
        global_notes_str = " | ".join([n for n in overall_notes if n])

        for detail in details:
            # Buscar el producto activo del detalle
            target_product = None
            for op in detail.order_products.filter(is_deleted=False):
                if op.product and not op.product.is_deleted:
                    target_product = op.product
                    break
            
            if not target_product:
                continue

            # Consolidar notas específicas para este ítem
            item_notes_parts = []
            if detail.notes:
                item_notes_parts.append(str(detail.notes).strip())
            if global_notes_str:
                item_notes_parts.append(global_notes_str)
            item_combined_notes = " | ".join([p for p in item_notes_parts if p])

            # 1. Generar diseño base en milímetros (0 tokens si no hay notas de personalización)
            base_design = cls.build_base_parametric_design(target_product, detail, custom_notes=item_combined_notes, force_rebuild=True)

            # 2. Aplicar IA para personalizaciones si existen notas físicas
            final_design, has_changes, item_summary = AICustomizerService.apply_customizations(base_design, item_combined_notes)

            # 3. Persistir diseño actualizado en OrderDetail
            try:
                detail.technical_design = final_design
                detail.save(update_fields=['technical_design'])
            except Exception:
                pass

            # 4. Generar plano individual para este producto
            item_title = f"{target_product.product_name.upper()} — CANTIDAD: {detail.quantity} UDS."
            item_svg = SVGBlueprintGenerator.generate_svg(final_design, title=item_title)

            items_designs.append({
                'detail_id': detail.id,
                'product_id': target_product.id,
                'product_name': target_product.product_name,
                'sku': f"PROD-{target_product.id}",
                'quantity': detail.quantity,
                'notes': detail.notes or '',
                'technical_design': final_design,
                'blueprint_svg': item_svg,
                'has_customizations': has_changes,
                'customization_summary': item_summary if has_changes else None,
            })

        if not items_designs:
            return None, None, "El pedido no contiene productos válidos para fabricación."

        order_ref = order.order_number or f"#{order.id:05d}"

        # Caso 1: Orden con Producto Único
        if len(items_designs) == 1:
            single_item = items_designs[0]
            final_design = dict(single_item['technical_design'])
            final_design['is_multi_product'] = False
            final_design['items'] = items_designs

            title = f"PLANO TÉCNICO DE FABRICACIÓN - PEDIDO {order_ref}"
            blueprint_svg = SVGBlueprintGenerator.generate_svg(final_design, title=title)
            summary = single_item.get('customization_summary') or "Diseño paramétrico estándar de catálogo calculado sin consumo de tokens."
            return final_design, blueprint_svg, summary

        # Caso 2: Orden Multi-Producto (Todos los productos del pedido incluidos)
        total_units = sum(it['quantity'] for it in items_designs)
        custom_summaries = [
            f"[{it['product_name']}]: {it['customization_summary']}"
            for it in items_designs if it.get('customization_summary')
        ]
        summary = (
            " | ".join(custom_summaries)
            if custom_summaries
            else f"Dossier técnico multi-producto ({len(items_designs)} modelos, {total_units} unidades) generado sin consumo de tokens."
        )

        composite_design = {
            'is_multi_product': True,
            'order_id': order.id,
            'order_number': order_ref,
            'total_products': len(items_designs),
            'total_units': total_units,
            'items': items_designs,
            # Fallback root fields mapped to the primary/first item
            'archetype': items_designs[0]['technical_design'].get('archetype', 'caja_cerrada'),
            'furniture_type': f"Orden Multi-Producto ({len(items_designs)} modelos)",
            'product_name': f"Conjunto Técnico de Producción ({len(items_designs)} modelos)",
            'dimensions_total_mm': items_designs[0]['technical_design'].get('dimensions_total_mm', {}),
            'dimensions_mm': items_designs[0]['technical_design'].get('dimensions_mm', {}),
            'grid': items_designs[0]['technical_design'].get('grid', {}),
            'main_color': items_designs[0]['technical_design'].get('main_color', '#334155'),
            'sections': items_designs[0]['technical_design'].get('sections', []),
        }

        master_title = f"PLANO TÉCNICO MULTI-PRODUCTO - PEDIDO {order_ref}"
        blueprint_svg = SVGBlueprintGenerator.generate_multi_product_svg(items_designs, order_title=master_title)

        return composite_design, blueprint_svg, summary
