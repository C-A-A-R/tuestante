"""
Motor de Generación Gráfica Vectorial (Renderizado 2.5D en formato SVG).
Genera una ilustración técnica axonométrica/oblicua acotada para taller a partir del
diccionario paramétrico técnico del mueble, con soporte para bloques apilados (Stacking Layout Engine),
proyección de profundidad con caras sombreadas, biseles de puertas, ranuras de ventilación (louvers),
placas metálicas de cerradura y cotas normalizadas en milímetros (mm).
"""

from typing import Dict, Any, List, Tuple, Optional
import math


def parse_hex_color(hex_str: str) -> Tuple[int, int, int]:
    """Convierte un color hex (#RGB o #RRGGBB) a tupla RGB."""
    h = str(hex_str or '').strip().lstrip('#')
    if len(h) == 3:
        h = ''.join([c * 2 for c in h])
    if len(h) != 6:
        return (44, 62, 80)
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except ValueError:
        return (44, 62, 80)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """Convierte RGB a string hex."""
    return f"#{max(0, min(255, r)):02X}{max(0, min(255, g)):02X}{max(0, min(255, b)):02X}"


def darken_color(hex_str: str, factor: float = 0.28) -> str:
    """Oscurece un color hex proporcionalmente para simular cara en sombra lateral."""
    r, g, b = parse_hex_color(hex_str)
    mult = max(0.0, 1.0 - factor)
    return rgb_to_hex(round(r * mult), round(g * mult), round(b * mult))


def lighten_color(hex_str: str, factor: float = 0.18) -> str:
    """Aclara un color hex para simular cara expuesta a luz cenital superior."""
    r, g, b = parse_hex_color(hex_str)
    return rgb_to_hex(
        round(r + (255 - r) * factor),
        round(g + (255 - g) * factor),
        round(b + (255 - b) * factor)
    )


class SVGBlueprintGenerator:
    """
    Genera un plano técnico 2.5D en formato SVG autocontenido con cotas técnicas
    numéricas en milímetros, distribución de compartimentos, bloques apilados y accesorios de chapa.
    """

    @classmethod
    def _get_svg_defs(cls) -> str:
        """Retorna las definiciones vectoriales comunes (marcadores, gradientes y trama)."""
        return '''
          <defs>
            <!-- Marcadores para flechas de cotas DIN/ISO -->
            <marker id="arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 10 0 L 0 5 L 10 10 z" fill="#38BDF8" />
            </marker>
            <marker id="arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#38BDF8" />
            </marker>
            <!-- Gradiente metálico para placa de cerradura y tirador -->
            <linearGradient id="metal-handle-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#94A3B8" />
              <stop offset="35%" stop-color="#F1F5F9" />
              <stop offset="70%" stop-color="#CBD5E1" />
              <stop offset="100%" stop-color="#64748B" />
            </linearGradient>
            <!-- Gradiente para patas tubulares -->
            <linearGradient id="tubular-leg-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#334155" />
              <stop offset="40%" stop-color="#94A3B8" />
              <stop offset="70%" stop-color="#64748B" />
              <stop offset="100%" stop-color="#1E293B" />
            </linearGradient>
            <!-- Cuadrícula técnica milimetrada de fondo -->
            <pattern id="grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
              <rect width="24" height="24" fill="none" stroke="#162032" stroke-width="0.6" />
            </pattern>
          </defs>
        '''

    @classmethod
    def generate_svg(cls, technical_design: Dict[str, Any], title: str = "PLANO TÉCNICO DE FABRICACIÓN") -> str:
        """
        Genera el string SVG con el plano técnico acotado en proyección 2.5D.
        Soporta automáticamente diseños multi-producto si technical_design contiene 'items'.
        """
        if technical_design.get('is_multi_product') and technical_design.get('items'):
            return cls.generate_multi_product_svg(technical_design['items'], order_title=title)

        canvas_w = 880
        canvas_h = 1020

        svg_parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_w} {canvas_h}" '
            f'width="100%" height="100%" style="background-color: #0B1120; font-family: Inter, system-ui, -apple-system, sans-serif;">',
            cls._get_svg_defs(),
            f'<rect width="{canvas_w}" height="{canvas_h}" fill="url(#grid-pattern)" />'
        ]

        cls._render_product_content(
            svg_parts=svg_parts,
            technical_design=technical_design,
            title=title,
            canvas_w=canvas_w
        )

        svg_parts.append('</svg>')
        return "\n".join(svg_parts)

    @classmethod
    def generate_multi_product_svg(cls, items_list: List[Dict[str, Any]], order_title: str = "PLANO TÉCNICO MULTI-PRODUCTO") -> str:
        """
        Genera una lámina vectorial SVG consolidada que contiene los planos técnicos 2.5D
        acotados de TODOS los productos incluidos en la orden de fabricación.
        """
        if not items_list:
            return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 300"><text x="440" y="150" fill="#fff" text-anchor="middle">Sin productos en la orden</text></svg>'

        if len(items_list) == 1:
            first = items_list[0]
            design = first.get('technical_design') or first
            pname = first.get('product_name') or design.get('product_name', 'Mueble')
            qty = first.get('quantity', 1)
            title = f"{order_title} — {pname.upper()} (CANT: {qty} UDS)"
            return cls.generate_svg(design, title=title)

        canvas_w = 880
        master_header_h = 105
        item_block_h = 1020
        n_items = len(items_list)
        total_canvas_h = master_header_h + (n_items * item_block_h) + 20
        total_units = sum(it.get('quantity', 1) for it in items_list)

        svg_parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_w} {total_canvas_h}" '
            f'width="100%" height="100%" style="background-color: #0B1120; font-family: Inter, system-ui, -apple-system, sans-serif;">',
            cls._get_svg_defs(),
            f'<rect width="{canvas_w}" height="{total_canvas_h}" fill="url(#grid-pattern)" />',
            f'''
            <!-- Encabezado Master Consolidado Multi-Producto -->
            <rect x="25" y="18" width="{canvas_w - 50}" height="72" rx="8" fill="#131D31" stroke="#38BDF8" stroke-width="2" />
            <text x="45" y="46" fill="#F8FAFC" font-size="16" font-weight="900" letter-spacing="1">{order_title.upper()}</text>
            <text x="45" y="70" fill="#94A3B8" font-size="13">DOSSIER TALLER: {n_items} MODELOS DISTINTOS | {total_units} UNIDADES EN TOTAL A FABRICAR</text>
            <rect x="{canvas_w - 245}" y="30" width="210" height="46" rx="6" fill="#0B1120" stroke="#10B981" stroke-width="1.5" />
            <text x="{canvas_w - 140}" y="51" fill="#10B981" font-size="11" font-weight="800" text-anchor="middle">HOJA MULTI-PRODUCTO</text>
            <text x="{canvas_w - 140}" y="67" fill="#F8FAFC" font-size="12" font-weight="700" text-anchor="middle">{n_items} MODELOS / {total_units} UDS</text>
            '''
        ]

        for i, item in enumerate(items_list):
            item_design = item.get('technical_design') or item
            qty = item.get('quantity', 1)
            pname = item.get('product_name') or item_design.get('product_name', f'Modelo #{i+1}')
            item_title = f"[ÍTEM {i+1} DE {n_items}] {pname.upper()} — CANTIDAD: {qty} UDS."
            y_offset = master_header_h + (i * item_block_h)

            svg_parts.append(f'''
              <g transform="translate(0, {y_offset})" id="blueprint_item_{i+1}">
                <!-- Separador de Ítem de Producción -->
                <line x1="25" y1="0" x2="{canvas_w - 25}" y2="0" stroke="#334155" stroke-width="2" stroke-dasharray="6 4" />
            ''')

            cls._render_product_content(
                svg_parts=svg_parts,
                technical_design=item_design,
                title=item_title,
                canvas_w=canvas_w,
                item_num=i + 1,
                total_items=n_items,
                quantity=qty
            )

            svg_parts.append('</g>')

        svg_parts.append('</svg>')
        return "\n".join(svg_parts)

    @classmethod
    def _render_product_content(
        cls,
        svg_parts: List[str],
        technical_design: Dict[str, Any],
        title: str,
        canvas_w: int = 880,
        item_num: Optional[int] = None,
        total_items: Optional[int] = None,
        quantity: Optional[int] = None
    ):
        """
        Renderiza la cabecera, dibujo axonométrico 2.5D, cotas acotadas y cajetín
        técnico de un producto individual dentro del flujo de piezas de la orden.
        """
        dims_total = technical_design.get('dimensions_total_mm') or technical_design.get('dimensions_mm', {})
        height_mm = int(dims_total.get('height', 1800))
        width_mm = int(dims_total.get('width', 900))
        depth_mm = int(dims_total.get('max_depth') or dims_total.get('depth', 400))

        grid = technical_design.get('grid') or {}
        sections = technical_design.get('sections', [])
        sec_grid = (sections[0].get('grid', {}) if sections and isinstance(sections, list) and isinstance(sections[0], dict) else {})
        rows = max(1, int(grid.get('rows') or sec_grid.get('rows') or 1))
        cols = max(1, int(grid.get('columns') or sec_grid.get('columns') or 1))

        main_color = technical_design.get('main_color', '#C0392B')
        prod_name = technical_design.get('product_name', 'Mueble Modular')
        furniture_type = technical_design.get('furniture_type', 'Casillero Modular')
        archetype = technical_design.get('archetype', 'caja_cerrada')
        pname_l = (prod_name or '').lower()
        ftype_l = (furniture_type or '').lower()
        if any(term in pname_l or term in ftype_l for term in ['estante', 'estanteria', 'estantería', 'repisa', 'balda', 'librero']):
            archetype = 'estante_abierto'

        # Parámetros de proyección 2.5D Oblicua (Cabinet / Cavalier suave)
        proj_angle_deg = 36.0
        proj_angle_rad = math.radians(proj_angle_deg)
        proj_scale_k = 0.22

        # Escalar dimensiones físicas (mm) al viewport visual disponible
        max_draw_w = 460
        max_draw_h = 580

        scale = min(max_draw_w / max(100, width_mm), max_draw_h / max(100, height_mm))

        cab_w = width_mm * scale
        cab_h = height_mm * scale
        depth_proj_len = depth_mm * scale * proj_scale_k

        dx = depth_proj_len * math.cos(proj_angle_rad)
        dy = depth_proj_len * math.sin(proj_angle_rad)

        # Centrar el dibujo en el área principal
        content_area_x = 160
        content_area_y = 130
        content_area_w = 560
        content_area_h = 670

        cab_x = content_area_x + (content_area_w - cab_w) / 2 + (dx / 2)
        cab_y = content_area_y + (content_area_h - cab_h) / 2 + (dy / 2)

        # Cálculos de sombras y colores paramétricos
        side_color = darken_color(main_color, 0.35)
        top_color = lighten_color(main_color, 0.15)
        bevel_light = lighten_color(main_color, 0.22)
        bevel_dark = darken_color(main_color, 0.40)

        # Cabecera técnica del ítem
        badge_text = f"CANTIDAD: {quantity} UDS." if quantity is not None else "ESPECIFICACIÓN 2.5D OFICIAL"
        sub_text = f"{prod_name} | {furniture_type.upper()} ({archetype})"
        if item_num and total_items:
            sub_text += f" | MODELO {item_num} DE {total_items}"

        svg_parts.append(f'''
          <rect x="25" y="20" width="{canvas_w - 50}" height="66" rx="6" fill="#131D31" stroke="#25354E" stroke-width="1.5" />
          <text x="45" y="47" fill="#F8FAFC" font-size="15" font-weight="800" letter-spacing="1">{title.upper()}</text>
          <text x="45" y="69" fill="#94A3B8" font-size="13">{sub_text}</text>
          <rect x="{canvas_w - 235}" y="33" width="200" height="38" rx="4" fill="#0B1120" stroke="#38BDF8" stroke-width="1.2" />
          <text x="{canvas_w - 135}" y="57" fill="#38BDF8" font-size="12" font-weight="700" text-anchor="middle">{badge_text}</text>
        ''')

        # =====================================================================
        # RENDERIZADO 2.5D: PROYECCIÓN Y BLOQUES APILADOS
        # =====================================================================

        # Verificar si es un mueble compuesto (banca + casillero)
        is_compound = (archetype == 'compuesto_locker_banca')
        if not is_compound and isinstance(sections, list) and len(sections) > 1:
            is_compound = any(isinstance(s, dict) and s.get('block_type') == 'asiento_banca' for s in sections)

        has_bench = (archetype in ['banca', 'compuesto_locker_banca'])
        if not has_bench and isinstance(sections, list):
            has_bench = any(isinstance(s, dict) and s.get('block_type') == 'asiento_banca' for s in sections)

        if is_compound and isinstance(sections, list) and len(sections) >= 2:
            # Renderizado de Bloques Compuestos (Stacking Layout Engine)
            sec_bench = sections[0]
            sec_locker = sections[1]

            bench_h_mm = sec_bench.get('local_dimensions_mm', {}).get('height', 450)
            locker_h_mm = sec_locker.get('local_dimensions_mm', {}).get('height', height_mm - bench_h_mm)
            bench_d_mm = sec_bench.get('local_dimensions_mm', {}).get('depth', depth_mm)
            locker_d_mm = sec_locker.get('local_dimensions_mm', {}).get('depth', max(300, depth_mm - 200))

            bench_h_px = bench_h_mm * scale
            locker_h_px = locker_h_mm * scale

            bench_dx = (bench_d_mm * scale * proj_scale_k) * math.cos(proj_angle_rad)
            bench_dy = (bench_d_mm * scale * proj_scale_k) * math.sin(proj_angle_rad)

            locker_dx = (locker_d_mm * scale * proj_scale_k) * math.cos(proj_angle_rad)
            locker_dy = (locker_d_mm * scale * proj_scale_k) * math.sin(proj_angle_rad)

            # Posición de la banca (base inferior)
            bx = cab_x
            by = cab_y + locker_h_px

            # 1. Patas tubulares de la banca
            leg_w = 14
            leg_h = bench_h_px * 0.75
            leg_y = by + (bench_h_px - leg_h)
            svg_parts.append(f'''
              <!-- Patas tubulares metálicas -->
              <rect x="{bx + 18}" y="{leg_y}" width="{leg_w}" height="{leg_h}" rx="3" fill="url(#tubular-leg-gradient)" stroke="#1E293B" stroke-width="1" />
              <rect x="{bx + cab_w - 32}" y="{leg_y}" width="{leg_w}" height="{leg_h}" rx="3" fill="url(#tubular-leg-gradient)" stroke="#1E293B" stroke-width="1" />
              <!-- Sombra en suelo -->
              <ellipse cx="{bx + (cab_w / 2)}" cy="{by + bench_h_px + 8}" rx="{cab_w * 0.52}" ry="10" fill="#000000" opacity="0.45" />
            ''')

            # 2. Cara lateral de la banca
            svg_parts.append(f'''
              <!-- Cara lateral sombreada de banca -->
              <polygon points="{bx},{by} {bx - bench_dx},{by - bench_dy} {bx - bench_dx},{by + bench_h_px - bench_dy} {bx},{by + bench_h_px}" 
                       fill="#1A252F" stroke="#0F172A" stroke-width="1.5" />
            ''')

            # 3. Cara frontal del asiento de banca
            seat_color = sec_bench.get('color_mapping', {}).get('seat_color') or '#A67B5B'
            svg_parts.append(f'''
              <!-- Frente de la banca -->
              <rect x="{bx}" y="{by}" width="{cab_w}" height="{bench_h_px}" rx="3" fill="#2C3E50" stroke="#1E293B" stroke-width="2" />
              <!-- Tabla de asiento superior de la banca -->
              <polygon points="{bx},{by} {bx - bench_dx},{by - bench_dy} {bx + cab_w - bench_dx},{by - bench_dy} {bx + cab_w},{by}" 
                       fill="{seat_color}" stroke="#0F172A" stroke-width="1.5" />
            ''')

            # 4. Cuerpo de casilleros montado sobre la banca
            lx = bx
            ly = cab_y

            svg_parts.append(f'''
              <!-- Cara lateral sombreada casillero -->
              <polygon points="{lx},{ly} {lx - locker_dx},{ly - locker_dy} {lx - locker_dx},{ly + locker_h_px - locker_dy} {lx},{ly + locker_h_px}" 
                       fill="{side_color}" stroke="#1E293B" stroke-width="1.5" />
              <!-- Cara superior casillero -->
              <polygon points="{lx},{ly} {lx - locker_dx},{ly - locker_dy} {lx + cab_w - locker_dx},{ly - locker_dy} {lx + cab_w},{ly}" 
                       fill="{top_color}" stroke="#1E293B" stroke-width="1.5" />
            ''')

            cls._render_cabinet_front(
                svg_parts=svg_parts,
                x=lx, y=ly, w=cab_w, h=locker_h_px,
                cols=cols, rows=rows,
                main_color=main_color,
                bevel_light=bevel_light,
                bevel_dark=bevel_dark,
                has_doors=True,
                has_ventilation=True
            )

        else:
            # Renderizado estándar de mueble unitario 2.5D
            svg_parts.append(f'''
              <ellipse cx="{cab_x + (cab_w / 2) - (dx / 2)}" cy="{cab_y + cab_h + 12}" rx="{cab_w * 0.52}" ry="12" fill="#000000" opacity="0.5" />
            ''')

            # Cara lateral sombreada
            svg_parts.append(f'''
              <!-- Cara Lateral Sombreada 2.5D -->
              <polygon points="{cab_x},{cab_y} {cab_x - dx},{cab_y - dy} {cab_x - dx},{cab_y + cab_h - dy} {cab_x},{cab_y + cab_h}" 
                       fill="{side_color}" stroke="#0F172A" stroke-width="1.8" />
            ''')

            # Cara superior
            svg_parts.append(f'''
              <!-- Cara Superior Iluminada 2.5D -->
              <polygon points="{cab_x},{cab_y} {cab_x - dx},{cab_y - dy} {cab_x + cab_w - dx},{cab_y - dy} {cab_x + cab_w},{cab_y}" 
                       fill="{top_color}" stroke="#0F172A" stroke-width="1.8" />
            ''')

            # Cara frontal del mueble
            has_doors = (archetype != 'estante_abierto')
            has_vents = (archetype in ['caja_cerrada', 'compuesto_locker_banca'])

            cls._render_cabinet_front(
                svg_parts=svg_parts,
                x=cab_x, y=cab_y, w=cab_w, h=cab_h,
                cols=cols, rows=rows,
                main_color=main_color,
                bevel_light=bevel_light,
                bevel_dark=bevel_dark,
                has_doors=has_doors,
                has_ventilation=has_vents
            )

        # =====================================================================
        # LÍNEAS DE COTA TÉCNICA NORMALIZADAS (DIMENSION LINES EN MM)
        # =====================================================================

        # 1. COTA DE ANCHO TOTAL EXTERIOR (Superior)
        cota_top_y = cab_y - dy - 35
        svg_parts.append(f'''
          <!-- Líneas de extensión de ancho -->
          <line x1="{cab_x}" y1="{cab_y - 6}" x2="{cab_x}" y2="{cota_top_y - 12}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
          <line x1="{cab_x + cab_w}" y1="{cab_y - 6}" x2="{cab_x + cab_w}" y2="{cota_top_y - 12}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
          <!-- Flecha de cota de ancho -->
          <line x1="{cab_x + 8}" y1="{cota_top_y}" x2="{cab_x + cab_w - 8}" y2="{cota_top_y}" 
                stroke="#38BDF8" stroke-width="1.5" marker-start="url(#arrow-start)" marker-end="url(#arrow-end)" />
          <!-- Etiqueta numérica de ancho -->
          <rect x="{cab_x + (cab_w / 2) - 65}" y="{cota_top_y - 12}" width="130" height="24" rx="4" fill="#0B1120" stroke="#38BDF8" stroke-width="1" />
          <text x="{cab_x + (cab_w / 2)}" y="{cota_top_y + 4}" fill="#38BDF8" font-size="12" font-weight="800" text-anchor="middle">
            ANCHO {width_mm} mm
          </text>
        ''')

        # 2. COTA DE ALTO TOTAL EXTERIOR (Lateral Izquierdo)
        cota_left_x = cab_x - dx - 45
        svg_parts.append(f'''
          <!-- Líneas de extensión de alto -->
          <line x1="{cab_x - dx - 6}" y1="{cab_y - dy}" x2="{cota_left_x - 12}" y2="{cab_y - dy}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
          <line x1="{cab_x - dx - 6}" y1="{cab_y + cab_h - dy}" x2="{cota_left_x - 12}" y2="{cab_y + cab_h - dy}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
          <!-- Flecha de cota de alto -->
          <line x1="{cota_left_x}" y1="{cab_y - dy + 8}" x2="{cota_left_x}" y2="{cab_y + cab_h - dy - 8}" 
                stroke="#38BDF8" stroke-width="1.5" marker-start="url(#arrow-start)" marker-end="url(#arrow-end)" />
          <!-- Etiqueta numérica de alto rotada 90° -->
          <g transform="translate({cota_left_x}, {cab_y + (cab_h / 2) - (dy / 2)}) rotate(-90)">
            <rect x="-65" y="-12" width="130" height="24" rx="4" fill="#0B1120" stroke="#38BDF8" stroke-width="1" />
            <text x="0" y="4" fill="#38BDF8" font-size="12" font-weight="800" text-anchor="middle">
              ALTO {height_mm} mm
            </text>
          </g>
        ''')

        # 3. COTA DE PROFUNDIDAD MÁXIMA (Eje Oblicuo Superior Derecho)
        # Se proyecta en la arista de profundidad superior derecha (Back-Right -> Front-Right)
        # con líneas de extensión, línea de cota con flechas y directriz al cajetín de cota,
        # garantizando cero solapamiento con la cota de ALTO (lateral izq) y ANCHO (superior).
        x_fr = cab_x + cab_w
        y_fr = cab_y
        x_br = cab_x + cab_w - dx
        y_br = cab_y - dy

        # Vector normal unitario hacia el exterior superior derecho
        nx = math.sin(proj_angle_rad)
        ny = -math.cos(proj_angle_rad)

        dim_offset = 32
        ext_len = 46

        # Puntos de las líneas de extensión
        p_br_ext_start = (x_br + 4 * nx, y_br + 4 * ny)
        p_br_ext_end = (x_br + ext_len * nx, y_br + ext_len * ny)
        p_fr_ext_start = (x_fr + 4 * nx, y_fr + 4 * ny)
        p_fr_ext_end = (x_fr + ext_len * nx, y_fr + ext_len * ny)

        # Línea de cota paralela a la arista de profundidad
        dim_start = (x_br + dim_offset * nx, y_br + dim_offset * ny)
        dim_end = (x_fr + dim_offset * nx, y_fr + dim_offset * ny)

        mid_dim_x = (dim_start[0] + dim_end[0]) / 2
        mid_dim_y = (dim_start[1] + dim_end[1]) / 2

        badge_w = 120
        badge_h = 24
        badge_x = min(mid_dim_x + 32, canvas_w - badge_w - 28)
        badge_y = mid_dim_y - 12

        svg_parts.append(f'''
          <!-- Líneas de extensión de profundidad (Eje Z oblicuo) -->
          <line x1="{p_br_ext_start[0]}" y1="{p_br_ext_start[1]}" x2="{p_br_ext_end[0]}" y2="{p_br_ext_end[1]}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
          <line x1="{p_fr_ext_start[0]}" y1="{p_fr_ext_start[1]}" x2="{p_fr_ext_end[0]}" y2="{p_fr_ext_end[1]}" stroke="#38BDF8" stroke-width="1" stroke-dasharray="2 2" />
          <!-- Flecha de cota de profundidad -->
          <line x1="{dim_start[0]}" y1="{dim_start[1]}" x2="{dim_end[0]}" y2="{dim_end[1]}" 
                stroke="#38BDF8" stroke-width="1.5" marker-start="url(#arrow-start)" marker-end="url(#arrow-end)" />
          <!-- Directriz y etiqueta de profundidad -->
          <polyline points="{mid_dim_x},{mid_dim_y} {mid_dim_x + 16},{mid_dim_y} {badge_x},{badge_y + (badge_h / 2)}" 
                    stroke="#38BDF8" stroke-width="1" fill="none" />
          <circle cx="{mid_dim_x}" cy="{mid_dim_y}" r="2" fill="#38BDF8" />
          <rect x="{badge_x}" y="{badge_y}" width="{badge_w}" height="{badge_h}" rx="4" fill="#0B1120" stroke="#38BDF8" stroke-width="1" />
          <text x="{badge_x + (badge_w / 2)}" y="{badge_y + 16}" fill="#38BDF8" font-size="12" font-weight="800" text-anchor="middle">
            FONDO {depth_mm} mm
          </text>
        ''')

        # Cuadro de datos técnicos / Pie de plano oficial (Cajetín de Fábrica)
        footer_y = 1020 - 105
        qty_block = f'''
          <rect x="{canvas_w - 235}" y="{footer_y + 16}" width="195" height="52" rx="4" fill="#0B1120" stroke="#10B981" stroke-width="1" />
          <text x="{canvas_w - 137}" y="{footer_y + 35}" fill="#10B981" font-size="12" font-weight="800" text-anchor="middle">CANTIDAD: {quantity} UDS.</text>
          <text x="{canvas_w - 137}" y="{footer_y + 55}" fill="#94A3B8" font-size="11" font-weight="600" text-anchor="middle">TOLERANCIA: ± 1.5 mm</text>
        ''' if quantity is not None else f'''
          <rect x="{canvas_w - 235}" y="{footer_y + 16}" width="195" height="52" rx="4" fill="#0B1120" stroke="#10B981" stroke-width="1" />
          <text x="{canvas_w - 137}" y="{footer_y + 36}" fill="#94A3B8" font-size="10" font-weight="600" text-anchor="middle">TOLERANCIA DIMENSIONAL</text>
          <text x="{canvas_w - 137}" y="{footer_y + 56}" fill="#10B981" font-size="13" font-weight="800" text-anchor="middle">± 1.5 mm (Norma ISO)</text>
        '''

        svg_parts.append(f'''
          <rect x="25" y="{footer_y}" width="{canvas_w - 50}" height="85" rx="6" fill="#131D31" stroke="#25354E" stroke-width="1.2" />
          
          <!-- Columna 1 -->
          <text x="45" y="{footer_y + 26}" fill="#94A3B8" font-size="11" font-weight="600">PROFUNDIDAD MÁXIMA:</text>
          <text x="185" y="{footer_y + 26}" fill="#F8FAFC" font-size="12" font-weight="700">{depth_mm} mm</text>

          <text x="45" y="{footer_y + 55}" fill="#94A3B8" font-size="11" font-weight="600">ARQUETIPO BASE:</text>
          <text x="185" y="{footer_y + 55}" fill="#38BDF8" font-size="12" font-weight="700">{archetype.upper()}</text>

          <!-- Columna 2 -->
          <text x="340" y="{footer_y + 26}" fill="#94A3B8" font-size="11" font-weight="600">DISTRIBUCIÓN MODULAR:</text>
          <text x="485" y="{footer_y + 26}" fill="#F8FAFC" font-size="12" font-weight="700">{rows} Filas × {cols} Columnas</text>

          <text x="340" y="{footer_y + 55}" fill="#94A3B8" font-size="11" font-weight="600">ACABADO PINTURA:</text>
          <rect x="485" y="{footer_y + 42}" width="16" height="16" rx="3" fill="{main_color}" stroke="#CBD5E1" stroke-width="1" />
          <text x="510" y="{footer_y + 55}" fill="#F8FAFC" font-size="12" font-weight="700">{main_color}</text>

          <!-- Columna 3: Norma de Taller -->
          {qty_block}
        ''')

    @classmethod
    def _render_cabinet_front(
        cls,
        svg_parts: List[str],
        x: float,
        y: float,
        w: float,
        h: float,
        cols: int,
        rows: int,
        main_color: str,
        bevel_light: str,
        bevel_dark: str,
        has_doors: bool = True,
        has_ventilation: bool = True
    ):
        """
        Dibuja la cara frontal completa del casillero con marco exterior,
        puertas con biseles en relieve 3D, ranuras de ventilación troqueladas (louvers)
        y placa metálica con tirador y cerradura.
        """
        frame_thick = max(4.0, min(8.0, w * 0.025))

        # Marco estructural exterior
        svg_parts.append(f'''
          <!-- Marco exterior frontal -->
          <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="{main_color}" stroke="#0F172A" stroke-width="{frame_thick}" />
        ''')

        cell_w = w / cols
        cell_h = h / rows

        for r in range(1, rows + 1):
            for c in range(1, cols + 1):
                cx = x + (c - 1) * cell_w
                cy = y + (r - 1) * cell_h

                if not has_doors:
                    # Celda abierta (estantería con baldas metálicas y montantes ranurados)
                    shelf_thick = max(6.0, min(14.0, cell_h * 0.08))
                    shelf_top_y = cy + cell_h - shelf_thick - 1
                    inner_fill = "#0B1120"
                    inner_side = darken_color(main_color, 0.45)
                    shelf_edge_light = lighten_color(main_color, 0.25)
                    shelf_edge_dark = darken_color(main_color, 0.40)

                    # Perforaciones / cremallera en montantes laterales de la bahía
                    slots_html = ""
                    n_slots = max(3, min(8, int(cell_h / 24)))
                    slot_step = (cell_h - shelf_thick - 16) / max(1, n_slots)
                    for s_idx in range(n_slots):
                        s_y = cy + 10 + s_idx * slot_step
                        slots_html += f'<rect x="{cx + 6}" y="{s_y:.1f}" width="3" height="7" rx="1" fill="#334155" opacity="0.8" />'
                        slots_html += f'<rect x="{cx + cell_w - 9}" y="{s_y:.1f}" width="3" height="7" rx="1" fill="#334155" opacity="0.8" />'

                    svg_parts.append(f'''
                      <!-- Vano interior abierto R{r}C{c} -->
                      <rect x="{cx + 2}" y="{cy + 2}" width="{cell_w - 4}" height="{cell_h - 4}" 
                            fill="{inner_fill}" stroke="{inner_side}" stroke-width="1.5" />
                      
                      <!-- Ranuras cremallera de montante -->
                      {slots_html}
                      
                      <!-- Balda / repisa horizontal metálica inferior -->
                      <rect x="{cx + 2}" y="{shelf_top_y}" width="{cell_w - 4}" height="{shelf_thick}" 
                            fill="{main_color}" stroke="{darken_color(main_color, 0.35)}" stroke-width="1" />
                      <line x1="{cx + 2}" y1="{shelf_top_y}" x2="{cx + cell_w - 2}" y2="{shelf_top_y}" 
                            stroke="{shelf_edge_light}" stroke-width="1.5" />
                      <line x1="{cx + 2}" y1="{shelf_top_y + shelf_thick}" x2="{cx + cell_w - 2}" y2="{shelf_top_y + shelf_thick}" 
                            stroke="{shelf_edge_dark}" stroke-width="1.5" />
                    ''')
                    continue

                # Puerta con bisel perimetral en relieve 2.5D (Efecto chapa plegada)
                door_inset = 6
                dx = cx + door_inset
                dy = cy + door_inset
                dw = cell_w - (door_inset * 2)
                dh = cell_h - (door_inset * 2)

                # 1. Cuerpo de la puerta
                svg_parts.append(f'''
                  <!-- Puerta del compartimento R{r}C{c} -->
                  <rect x="{dx}" y="{dy}" width="{dw}" height="{dh}" rx="3" fill="{main_color}" stroke="{darken_color(main_color, 0.4)}" stroke-width="1.5" />
                  
                  <!-- Bisel perimetral en relieve (Luz superior e izquierda) -->
                  <line x1="{dx + 2}" y1="{dy + 2}" x2="{dx + dw - 2}" y2="{dy + 2}" stroke="{bevel_light}" stroke-width="2.5" stroke-linecap="round" />
                  <line x1="{dx + 2}" y1="{dy + 2}" x2="{dx + 2}" y2="{dy + dh - 2}" stroke="{bevel_light}" stroke-width="2.5" stroke-linecap="round" />
                  
                  <!-- Bisel perimetral en relieve (Sombra inferior y derecha) -->
                  <line x1="{dx + 2}" y1="{dy + dh - 2}" x2="{dx + dw - 2}" y2="{dy + dh - 2}" stroke="{bevel_dark}" stroke-width="2.5" stroke-linecap="round" />
                  <line x1="{dx + dw - 2}" y1="{dy + 2}" x2="{dx + dw - 2}" y2="{dy + dh - 2}" stroke="{bevel_dark}" stroke-width="2.5" stroke-linecap="round" />
                ''')

                # 2. Ranuras de ventilación troqueladas (Louvers superiores)
                if has_ventilation:
                    vent_w = min(dw * 0.45, 65)
                    vent_x = dx + (dw - vent_w) / 2
                    num_slots = 4
                    slot_spacing = 6
                    start_vy = dy + (dh * 0.10)

                    svg_parts.append(f'<!-- Ranuras de ventilación (Louvers) -->')
                    for v_i in range(num_slots):
                        vy = start_vy + (v_i * slot_spacing)
                        svg_parts.append(f'''
                          <!-- Ranura {v_i + 1} troquelada con sombra -->
                          <line x1="{vent_x}" y1="{vy}" x2="{vent_x + vent_w}" y2="{vy}" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round" />
                          <line x1="{vent_x}" y1="{vy + 1}" x2="{vent_x + vent_w}" y2="{vy + 1}" stroke="{bevel_light}" stroke-width="0.8" stroke-linecap="round" opacity="0.6" />
                        ''')

                # 3. Placa metálica empotrada con tirador y cerradura
                # Ubicada en el flanco de apertura (cerca del borde izquierdo o derecho)
                is_right_opening = (c % 2 == 1)
                plate_w = min(dw * 0.22, 28)
                plate_h = min(dh * 0.20, 52)
                plate_x = dx + 12 if not is_right_opening else dx + 12  # Como en la imagen, en el flanco izquierdo
                plate_y = dy + (dh * 0.36)

                svg_parts.append(f'''
                  <!-- Placa metálica de cerradura/tirador empotrada -->
                  <rect x="{plate_x}" y="{plate_y}" width="{plate_w}" height="{plate_h}" rx="3" 
                        fill="url(#metal-handle-gradient)" stroke="#475569" stroke-width="1.2" />
                  
                  <!-- Uñero / Cavidad de agarre empotrado -->
                  <path d="M {plate_x + (plate_w * 0.65)} {plate_y + 12} A 8 16 0 0 1 {plate_x + (plate_w * 0.65)} {plate_y + plate_h - 12}" 
                        fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round" />
                  
                  <!-- Bombín de cerradura / llave cilíndrico -->
                  <circle cx="{plate_x + (plate_w * 0.28)}" cy="{plate_y + (plate_h / 2)}" r="3" fill="#1E293B" stroke="#0F172A" stroke-width="1" />
                  <circle cx="{plate_x + (plate_w * 0.28)}" cy="{plate_y + (plate_h / 2)}" r="1" fill="#94A3B8" />
                ''')
