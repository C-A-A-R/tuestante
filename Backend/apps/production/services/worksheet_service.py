"""
Servicio para la generación de Hojas de Ruta de Taller / Órdenes de Fabricación.
Centraliza en el Backend la construcción técnica del documento imprimible
garantizando fidelidad dimensional, visualización de planos vectoriales y control de calidad.
"""

import html
from typing import Dict, Any, Optional, List
from django.utils import timezone


class ProductionWorksheetService:
    """
    Servicio de backend encargado de compilar y generar la Hoja de Taller (Worksheet)
    en formato HTML estándar de alta precisión para impresión física y guardado en PDF.
    """

    @classmethod
    def format_date(cls, dt_val) -> str:
        """Formatea fechas en formato estándar legible dd/mm/aaaa."""
        if not dt_val:
            return 'En espera'
        try:
            if isinstance(dt_val, str):
                from django.utils.dateparse import parse_datetime, parse_date
                parsed = parse_datetime(dt_val) or parse_date(dt_val)
                if parsed:
                    dt_val = parsed
                else:
                    return dt_val
            if hasattr(dt_val, 'strftime'):
                return dt_val.strftime('%d/%m/%Y')
            return str(dt_val)
        except Exception:
            return str(dt_val)

    @classmethod
    def get_export_timestamp(cls, current_dt=None) -> str:
        """Retorna la fecha y hora de emisión en formato dd/mm/aaaa hh:mm:ss AM/PM."""
        dt = current_dt or timezone.localtime(timezone.now())
        try:
            # Formato de 12 horas con AM/PM
            date_part = dt.strftime('%d/%m/%Y')
            time_part = dt.strftime('%I:%M:%S %p')
            return f"{date_part} {time_part}"
        except Exception:
            return dt.strftime('%d/%m/%Y %H:%M:%S')

    @classmethod
    def generate_worksheet_html(
        cls,
        production_order,
        mode: str = 'with_design'
    ) -> str:
        """
        Genera el documento HTML completo de la Orden de Fabricación para taller.
        
        :param production_order: Instancia de apps.production.models.ProductionOrder (o ID int)
        :param mode: 'with_design' (incluye planos vectoriales 2.5D) o 'text_only' (ficha analítica sin gráficos)
        :return: Cadena de texto con el HTML completo y estilos @page exactos.
        """
        # Si se pasa un ID, buscar la orden en base de datos
        if isinstance(production_order, (int, str)):
            from apps.production.models import ProductionOrder
            production_order = ProductionOrder.objects.select_related(
                'order', 'order__user'
            ).prefetch_related(
                'order__details__order_products__product'
            ).get(id=int(production_order))

        order = production_order.order
        if not order:
            raise ValueError(f"La orden de producción #{production_order.id} no tiene un pedido asociado.")

        # Garantizar que existan el diseño paramétrico y el plano SVG si mode == 'with_design'
        if mode == 'with_design' and (not production_order.blueprint_svg or not production_order.technical_design):
            try:
                from apps.production.services.parametric_service import ParametricDesignService
                design, svg_content, _ = ParametricDesignService.build_order_blueprint(
                    order,
                    custom_notes=production_order.technical_notes or ''
                )
                if svg_content:
                    production_order.technical_design = design
                    production_order.blueprint_svg = svg_content
                    production_order.save(update_fields=['technical_design', 'blueprint_svg'])
            except Exception:
                pass

        design = production_order.technical_design or {}
        dims = design.get('dimensions_mm') or {'height': 1800, 'width': 900, 'depth': 400}
        grid = design.get('grid') or {'rows': 3, 'columns': 1}
        color = design.get('main_color') or '#005187'
        is_multi = bool(design.get('is_multi_product') and isinstance(design.get('items'), list) and len(design['items']) > 1)

        # Metadatos del encabezado
        year_code = production_order.created_at.year if production_order.created_at else timezone.now().year
        production_code = f"OF-{year_code}-{production_order.id:04d}"
        order_number = order.order_number or f"#{order.id}"
        
        client_name = "Cliente TuEstante"
        if order.user:
            client_name = order.user.get_full_name() or order.user.username or order.user.email

        start_date_str = cls.format_date(production_order.start_date or production_order.created_at)
        estimated_date_str = cls.format_date(production_order.estimated_completion_date)
        export_timestamp = cls.get_export_timestamp()

        technical_notes = (production_order.technical_notes or '').strip()
        order_notes = (order.notes or '').strip()

        # Construir sección técnica / dossier
        blueprint_section_html = cls._build_blueprint_section(
            design=design,
            dims=dims,
            grid=grid,
            color=color,
            is_multi=is_multi,
            order=production_order,
            mode=mode
        )

        # Construir filas de la tabla de productos (Sin SKU)
        items_html = cls._build_items_rows(order, design)

        # Construcción del HTML maestro
        return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden de Fabricación - {html.escape(production_code)}</title>
  <style>
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    @page {{
      size: auto;
      margin: 0;
    }}
    body {{
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #0f172a;
      padding: 14mm 16mm 16mm 16mm;
      background: #fff;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #005187;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }}
    .logo-text {{
      font-size: 22px;
      font-weight: 800;
      color: #005187;
    }}
    .logo-sub {{
      font-size: 12px;
      color: #64748b;
    }}
    .order-code-box {{
      text-align: right;
    }}
    .order-code {{
      font-size: 24px;
      font-weight: 800;
      color: #005187;
    }}
    .meta-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      padding: 12px 14px;
      border-radius: 6px;
      margin-bottom: 18px;
      font-size: 12px;
    }}
    .meta-item strong {{
      display: block;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }}
    .tech-notes-box {{
      background: #fffbeb;
      border: 1px solid #fde68a;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 18px;
      font-size: 13px;
      color: #92400e;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }}
    th {{
      background: #005187 !important;
      color: #fff !important;
      padding: 9px 8px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    td {{
      padding: 9px 8px;
      border-bottom: 1px solid #e2e8f0;
    }}
    .checklist-section {{
      margin-top: 24px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
    }}
    .checklist-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      font-size: 12px;
    }}
    .checklist-box {{
      border: 1px solid #cbd5e1;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
    }}
    .signature-section {{
      margin-top: 80px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      page-break-inside: avoid;
    }}
    .sig-line {{
      width: 220px;
      border-top: 1.5px solid #0f172a;
      text-align: center;
      padding-top: 8px;
      font-weight: 700;
      color: #1e293b;
    }}
    svg {{
      max-width: 100%;
      max-height: 460px;
      height: auto;
      display: block;
      margin: 0 auto;
    }}
    @media print {{
      body {{
        padding: 12mm 15mm 15mm 15mm !important;
        margin: 0 !important;
      }}
      .no-print {{
        display: none !important;
      }}
      svg {{
        max-height: 430px !important;
      }}
    }}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-text">TuEstante OMS</div>
      <div class="logo-sub">Hoja de Ruta de Taller / Orden de Fabricación</div>
    </div>
    <div class="order-code-box">
      <div class="order-code">{html.escape(production_code)}</div>
      <div style="font-size: 12px; color: #475569;">Pedido Asociado: <strong>{html.escape(order_number)}</strong></div>
      <div style="font-size: 11px; color: #005187; margin-top: 4px; font-weight: 700;">
        🕒 Emitida: {html.escape(export_timestamp)}
      </div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <strong>Cliente:</strong>
      {html.escape(client_name)}
    </div>
    <div class="meta-item">
      <strong>Fecha de Inicio:</strong>
      {html.escape(start_date_str)}
    </div>
    <div class="meta-item">
      <strong>Fecha Estimada Entrega:</strong>
      <span style="font-weight: bold; color: #005187;">{html.escape(estimated_date_str)}</span>
    </div>
    <div class="meta-item">
      <strong>Fecha/Hora Emisión:</strong>
      <span style="font-weight: 700; color: #0f172a;">{html.escape(export_timestamp)}</span>
    </div>
  </div>

  {cls._build_tech_notes_box(technical_notes, order_notes)}

  {blueprint_section_html}

  <table>
    <thead>
      <tr>
        <th style="width: 40px; text-align: center;">#</th>
        <th>Producto</th>
        <th>Especificaciones / Acabados</th>
        <th style="width: 70px; text-align: center;">Cant.</th>
        <th style="width: 210px; text-align: center; white-space: nowrap;">Control Taller</th>
      </tr>
    </thead>
    <tbody>
      {items_html}
    </tbody>
  </table>

  <div class="checklist-section">
    <h4 style="font-size: 12px; text-transform: uppercase; margin-bottom: 8px; color: #475569;">Control de Fases de Taller:</h4>
    <div class="checklist-grid">
      <div class="checklist-box">1. Corte y Dimensionado<br><br>[ &nbsp; ] Firma: _________</div>
      <div class="checklist-box">2. Ensamblaje / Estructura<br><br>[ &nbsp; ] Firma: _________</div>
      <div class="checklist-box">3. Pintura / Acabado<br><br>[ &nbsp; ] Firma: _________</div>
      <div class="checklist-box">4. Control de Calidad<br><br>[ &nbsp; ] Firma: _________</div>
    </div>
  </div>

  <!-- Notas y Resultados de Taller antes de las firmas (al menos media hoja, completamente vacía) -->
  <div style="margin-top: 20px; border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;">
      <thead>
        <tr>
          <th style="background-color: #0f172a !important; color: #ffffff !important; padding: 10px 14px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border-bottom: 2px solid #0f172a;">
            📋 Notas y Resultados de Taller / Control de Calidad y Tolerancias
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="height: 400px; min-height: 400px; background: #ffffff;">&nbsp;</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="signature-section">
    <div class="sig-line">Responsable de Taller</div>
    <div class="sig-line">Inspector de Calidad</div>
    <div class="sig-line">Despacho y Embalaje</div>
  </div>

  <script>
    window.onload = function() {{
      setTimeout(function() {{
        window.print();
      }}, 350);
    }};
  </script>
</body>
</html>"""

    @classmethod
    def _build_tech_notes_box(cls, technical_notes: str, order_notes: str) -> str:
        if not technical_notes and not order_notes:
            return ""
        tech_p = f'<p style="margin-top: 4px;"><strong>Taller:</strong> {html.escape(technical_notes)}</p>' if technical_notes else ''
        ord_p = f'<p style="margin-top: 4px;"><strong>Pedido / Cliente:</strong> {html.escape(order_notes)}</p>' if order_notes else ''
        return f"""
        <div class="tech-notes-box">
          <strong>Instrucciones y Observaciones Técnicas de Taller:</strong>
          {tech_p}
          {ord_p}
        </div>
        """

    @classmethod
    def _build_blueprint_section(
        cls,
        design: Dict[str, Any],
        dims: Dict[str, Any],
        grid: Dict[str, Any],
        color: str,
        is_multi: bool,
        order,
        mode: str
    ) -> str:
        """Construye el dossier gráfico o la especificación técnica en modo solo texto."""
        if is_multi:
            items_list = design.get('items', [])
            if mode == 'text_only':
                cards_html = []
                for idx, it in enumerate(items_list):
                    it_design = it.get('technical_design') or {}
                    it_dims = it_design.get('dimensions_total_mm') or it_design.get('dimensions_mm') or {'height': 1800, 'width': 900, 'depth': 400}
                    it_grid = it_design.get('grid') or {'rows': 1, 'columns': 1}
                    it_color = it_design.get('main_color') or '#334155'
                    it_arch = str(it_design.get('archetype') or 'caja_cerrada').upper()
                    comps = it_design.get('compartments') or []
                    has_doors = any(c.get('has_door') for c in comps) if comps else True
                    has_vent = any(c.get('has_ventilation') for c in comps) if comps else True
                    handle_type = comps[0].get('handle_type', 'Tirador con cerradura') if comps else 'Tirador con cerradura'
                    pname = str(it.get('product_name') or 'PRODUCTO').upper()
                    qty = it.get('quantity', 1)
                    it_notes = it.get('notes') or it_design.get('original_notes')

                    notes_row = f"""
                    <tr>
                      <td style="font-weight: 700; color: #92400e; background: #fffbeb; padding: 8px 12px;" colspan="4">
                        <strong>Notas Técnicas del Producto:</strong> {html.escape(it_notes)}
                      </td>
                    </tr>
                    """ if it_notes else ""

                    cards_html.append(f"""
                      <div style="margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
                        <div style="background: #0f172a; color: #ffffff; padding: 9px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                          <div style="font-weight: 800; font-size: 12px; letter-spacing: 0.5px;">
                            [MODELO {idx + 1} DE {len(items_list)}] {html.escape(pname)}
                          </div>
                          <div style="background: #0284c7; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                            CANTIDAD: {qty} UDS.
                          </div>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 12px;">
                          <tbody>
                            <tr style="background: #f8fafc;">
                              <td style="width: 25%; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Dimensiones:</td>
                              <td style="width: 25%; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;"><strong>Alto:</strong> {it_dims.get('height', 1800)} mm &nbsp;|&nbsp; <strong>Ancho:</strong> {it_dims.get('width', 900)} mm &nbsp;|&nbsp; <strong>Fondo:</strong> {it_dims.get('max_depth') or it_dims.get('depth') or 400} mm</td>
                              <td style="width: 25%; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Distribución:</td>
                              <td style="width: 25%; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">{it_grid.get('rows', 1)} Filas × {it_grid.get('columns', 1)} Columnas ({it_grid.get('rows', 1) * it_grid.get('columns', 1)} Casillas)</td>
                            </tr>
                            <tr>
                              <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Arquetipo:</td>
                              <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">{html.escape(it_arch)}</td>
                              <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Acabado Pintura:</td>
                              <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">
                                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background: {html.escape(it_color)}; vertical-align: middle; margin-right: 4px; border: 1px solid #94a3b8;"></span>
                                <strong>{html.escape(it_color)}</strong>
                              </td>
                            </tr>
                            <tr style="background: #f8fafc;">
                              <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Puertas y Ventilación:</td>
                              <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Puertas: {'Sí (bisel 3D)' if has_doors else 'Sin puerta'} &nbsp;|&nbsp; Ventilación: {'Troquelada' if has_vent else 'Sin ranuras'}</td>
                              <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Herrajes:</td>
                              <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">{html.escape(handle_type)}</td>
                            </tr>
                            {notes_row}
                          </tbody>
                        </table>
                      </div>
                    """)

                return f"""
                <div style="margin-bottom: 24px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #005187; padding-bottom: 6px;">
                    <h4 style="font-size: 13px; text-transform: uppercase; color: #005187; font-weight: 800; letter-spacing: 0.5px;">
                      📋 Especificación Técnica de Fabricación ({len(items_list)} Modelos Distintos - Solo Texto)
                    </h4>
                    <span style="font-size: 11px; background: #f1f5f9; color: #334155; padding: 3px 8px; border-radius: 4px; font-weight: 700; border: 1px solid #cbd5e1;">
                      Tolerancia: ±1.5 mm | Norma ISO
                    </span>
                  </div>
                  {''.join(cards_html)}
                </div>
                """
            else:
                # Mode with design (multi-product)
                cards_html = []
                for idx, it in enumerate(items_list):
                    it_design = it.get('technical_design') or {}
                    it_dims = it_design.get('dimensions_total_mm') or it_design.get('dimensions_mm') or {'height': 1800, 'width': 900, 'depth': 400}
                    it_grid = it_design.get('grid') or {'rows': 1, 'columns': 1}
                    it_color = it_design.get('main_color') or '#334155'
                    it_svg = it.get('blueprint_svg') or ''
                    pname = str(it.get('product_name') or 'PRODUCTO').upper()
                    qty = it.get('quantity', 1)
                    raw_notes = it.get('notes') or it_design.get('original_notes')
                    custom_summary = it.get('customization_summary')

                    notes_box = ""
                    if raw_notes or custom_summary:
                        notes_box = f"""
                        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 8px 14px; font-size: 11px; color: #92400e; border-bottom: 1px solid #fef3c7;">
                          <strong>📝 Especificaciones / Notas de Fabricación:</strong> {html.escape(raw_notes or '')}
                          {f'<div style="font-size: 10px; color: #b45309; margin-top: 3px;"><em>⚙️ {html.escape(custom_summary)}</em></div>' if custom_summary else ''}
                        </div>
                        """

                    svg_box = f"""
                    <div style="background: #0b1120; padding: 12px; text-align: center;">
                      <div style="max-height: 440px; display: flex; justify-content: center; align-items: center;">
                        {it_svg}
                      </div>
                    </div>
                    """ if it_svg else ""

                    cards_html.append(f"""
                      <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
                        <div style="background: #f1f5f9; padding: 8px 14px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                          <div style="font-weight: 800; font-size: 12px; color: #0f172a;">
                            [MODELO {idx + 1} DE {len(items_list)}] {html.escape(pname)}
                          </div>
                          <div style="background: #0284c7; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                            CANTIDAD: {qty} UDS.
                          </div>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 14px; background: #f8fafc; padding: 8px 14px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">
                          <span><strong>Alto:</strong> {it_dims.get('height', 1800)} mm</span>
                          <span style="color: #cbd5e1;">|</span>
                          <span><strong>Ancho:</strong> {it_dims.get('width', 900)} mm</span>
                          <span style="color: #cbd5e1;">|</span>
                          <span><strong>Fondo:</strong> {it_dims.get('max_depth') or it_dims.get('depth') or 400} mm</span>
                          <span style="color: #cbd5e1;">|</span>
                          <span><strong>Distribución:</strong> {it_grid.get('rows', 1)}F × {it_grid.get('columns', 1)}C</span>
                          <span style="color: #cbd5e1;">|</span>
                          <span><strong>Color:</strong> {html.escape(it_color)}</span>
                        </div>
                        {notes_box}
                        {svg_box}
                      </div>
                    """)

                return f"""
                <div style="margin-bottom: 24px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #005187; padding-bottom: 6px;">
                    <h4 style="font-size: 13px; text-transform: uppercase; color: #005187; font-weight: 800; letter-spacing: 0.5px;">
                      📐 Dossier Técnico de Fabricación Multi-Producto ({len(items_list)} Modelos Distintos)
                    </h4>
                    <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: 700; border: 1px solid #bae6fd;">
                      Tolerancia: ±1.5 mm | Norma ISO
                    </span>
                  </div>
                  {''.join(cards_html)}
                </div>
                """
        else:
            # Single product
            archetype = str(design.get('archetype') or 'caja_cerrada').upper()
            if mode == 'text_only':
                door_desc = 'Sin puertas (Estructura abierta)' if design.get('archetype') == 'estante_abierto' else 'Puertas metálicas con bisel 3D perimetral'
                return f"""
                <div style="margin-bottom: 24px; border: 1.5px solid #005187; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
                  <div style="background: #005187; color: #ffffff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="font-weight: 800; font-size: 13px; letter-spacing: 0.5px;">
                      📋 ESPECIFICACIONES TÉCNICAS Y DIMENSIONALES DE FABRICACIÓN (SOLO TEXTO)
                    </div>
                    <div style="background: #ffffff; color: #005187; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">
                      Tolerancia: ±1.5 mm | Norma ISO
                    </div>
                  </div>
                  
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 12px;">
                    <tbody>
                      <tr style="background: #f8fafc;">
                        <td style="width: 25%; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Dimensiones Exteriores:</td>
                        <td style="width: 25%; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;"><strong>Alto:</strong> {dims.get('height', 1800)} mm &nbsp;|&nbsp; <strong>Ancho:</strong> {dims.get('width', 900)} mm &nbsp;|&nbsp; <strong>Fondo:</strong> {dims.get('depth', 400)} mm</td>
                        <td style="width: 25%; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Distribución Modular:</td>
                        <td style="width: 25%; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">{grid.get('rows', 1)} Filas × {grid.get('columns', 1)} Columnas ({grid.get('rows', 1) * grid.get('columns', 1)} Casillas)</td>
                      </tr>
                      <tr>
                        <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Arquetipo Constructivo:</td>
                        <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">{html.escape(archetype)}</td>
                        <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Acabado Pintura:</td>
                        <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">
                          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background: {html.escape(color)}; vertical-align: middle; margin-right: 4px; border: 1px solid #94a3b8;"></span>
                          <strong>{html.escape(color)}</strong> (Pintura Electrostática)
                        </td>
                      </tr>
                      <tr style="background: #f8fafc;">
                        <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Detalle de Puertas:</td>
                        <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">{door_desc}</td>
                        <td style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Ventilación y Cerradura:</td>
                        <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 12px;">Ranuras troqueladas (louvers) &nbsp;|&nbsp; Placa empotrada con bombín</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                """
            elif order.blueprint_svg:
                item_first_notes = design.get('original_notes')
                notes_block = ""
                if item_first_notes:
                    notes_block = f"""
                    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; font-size: 12px; color: #92400e; border-radius: 4px; margin-bottom: 12px; border: 1px solid #fde68a;">
                      <strong>📝 Especificaciones / Notas de Fabricación del Producto:</strong>
                      <div style="margin-top: 3px;">{html.escape(item_first_notes)}</div>
                    </div>
                    """

                return f"""
                <div style="margin-bottom: 24px; page-break-inside: avoid;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1.5px solid #005187; padding-bottom: 6px;">
                    <h4 style="font-size: 13px; text-transform: uppercase; color: #005187; font-weight: 800; letter-spacing: 0.5px;">
                      📐 Especificaciones Paramétricas y Plano Vectorial de Taller (Cotas en mm)
                    </h4>
                    <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: 700; border: 1px solid #bae6fd;">
                      Tolerancia: ±1.5 mm
                    </span>
                  </div>

                  <div style="display: flex; flex-wrap: wrap; gap: 14px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
                    <span><strong>Alto:</strong> {dims.get('height', 1800)} mm</span>
                    <span style="color: #cbd5e1;">|</span>
                    <span><strong>Ancho:</strong> {dims.get('width', 900)} mm</span>
                    <span style="color: #cbd5e1;">|</span>
                    <span><strong>Fondo:</strong> {dims.get('depth', 400)} mm</span>
                    <span style="color: #cbd5e1;">|</span>
                    <span><strong>Distribución:</strong> {grid.get('rows', 1)} Filas × {grid.get('columns', 1)} Columnas</span>
                    <span style="color: #cbd5e1;">|</span>
                    <span><strong>Color / Acabado:</strong> {html.escape(color)}</span>
                  </div>

                  {notes_block}

                  <div style="border: 1px solid #334155; border-radius: 6px; overflow: hidden; background: #0f172a; text-align: center; padding: 12px;">
                    <div style="max-height: 480px; display: flex; justify-content: center; align-items: center;">
                      {order.blueprint_svg}
                    </div>
                  </div>
                </div>
                """
        return ""

    @classmethod
    def _build_items_rows(cls, order, design: Dict[str, Any]) -> str:
        """Construye las filas de productos sin SKU y con checkboxes horizontales."""
        rows = []
        details = order.details.filter(is_deleted=False).prefetch_related('order_products__product')
        
        # Mapeo de notas si existen en el diseño técnico
        design_items = design.get('items', []) if isinstance(design.get('items'), list) else []
        notes_by_detail = {d.get('detail_id'): d.get('notes') for d in design_items if d.get('detail_id')}

        for idx, detail in enumerate(details):
            target_product = None
            for op in detail.order_products.filter(is_deleted=False):
                if op.product and not op.product.is_deleted:
                    target_product = op.product
                    break

            prod_name = target_product.product_name if target_product else "Producto Estándar"
            qty = detail.quantity or 1
            item_notes = (detail.notes or notes_by_detail.get(detail.id) or '').strip()
            specs = item_notes or 'Estándar'

            note_badge = ""
            if item_notes:
                note_badge = f'<div style="margin-top: 4px; font-size: 11px; color: #92400e; background: #fffbeb; padding: 4px 8px; border-radius: 4px; border: 1px solid #fde68a;"><strong>Nota de Fabricación:</strong> {html.escape(item_notes)}</div>'

            rows.append(f"""
            <tr>
              <td style="text-align: center; font-weight: bold;">{idx + 1}</td>
              <td>
                <strong style="color: #0f172a; font-size: 13px;">{html.escape(prod_name)}</strong>
                {note_badge}
              </td>
              <td style="color: #334155;">{html.escape(specs)}</td>
              <td style="text-align: center; font-weight: bold; font-size: 1.1rem; color: #0f172a;">{qty}</td>
              <td style="text-align: center; color: #334155; white-space: nowrap;">
                <span style="display: inline-block; white-space: nowrap; margin-right: 14px;">[ &nbsp; ] Pendiente</span>
                <span style="display: inline-block; white-space: nowrap;">[ &nbsp; ] Listo</span>
              </td>
            </tr>
            """)

        return "".join(rows)
