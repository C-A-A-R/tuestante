import io
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_invoice_pdf(invoice):
    """
    Genera el archivo PDF de la factura utilizando ReportLab y lo guarda en invoice.pdf_file.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1E293B'),
        alignment=0
    )

    header_style = ParagraphStyle(
        'InvoiceHeader',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569')
    )

    bold_style = ParagraphStyle(
        'InvoiceBold',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1E293B')
    )

    elements = []

    # Cabecera / Título
    elements.append(Paragraph("<b>TuEstante</b> — Factura Comercial", title_style))
    elements.append(Spacer(1, 12))

    order_num = getattr(invoice.order, 'order_number', f"#{invoice.order.id}") or f"#{invoice.order.id}"
    date_str = invoice.created_at.strftime('%d/%m/%Y') if hasattr(invoice.created_at, 'strftime') else str(invoice.created_at)

    header_data = [
        [
            Paragraph(
                f"<b>Nº Factura:</b> {invoice.invoice_number}<br/>"
                f"<b>Nº Orden:</b> {order_num}<br/>"
                f"<b>Fecha de Emisión:</b> {date_str}",
                header_style
            ),
            Paragraph(
                f"<b>Cliente:</b> {invoice.customer_name}<br/>"
                f"<b>DNI / RIF / NIT:</b> {invoice.customer_tax_id}<br/>"
                f"<b>Email:</b> {invoice.customer_email}<br/>"
                f"<b>Dirección:</b> {invoice.billing_address}",
                header_style
            )
        ]
    ]

    header_table = Table(header_data, colWidths=[270, 270])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 20))

    # Tabla de productos
    table_data = [
        [
            Paragraph("<b>Producto / Descripción</b>", bold_style),
            Paragraph("<b>Cantidad</b>", bold_style),
            Paragraph("<b>Precio Unitario</b>", bold_style),
            Paragraph("<b>Total</b>", bold_style)
        ]
    ]

    items = invoice.items_snapshot or []
    if isinstance(items, list) and len(items) > 0:
        for item in items:
            name = item.get('name', item.get('product_name', 'Producto'))
            qty = item.get('quantity', 1)
            unit_price = float(item.get('unit_price', item.get('price', 0.0)))
            total_item = float(qty) * unit_price
            table_data.append([
                Paragraph(str(name), header_style),
                Paragraph(str(qty), header_style),
                Paragraph(f"${unit_price:.2f}", header_style),
                Paragraph(f"${total_item:.2f}", header_style)
            ])
    else:
        table_data.append([
            Paragraph("Productos de la orden", header_style),
            Paragraph("1", header_style),
            Paragraph(f"${float(invoice.total):.2f}", header_style),
            Paragraph(f"${float(invoice.total):.2f}", header_style)
        ])

    items_table = Table(table_data, colWidths=[260, 80, 100, 100])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 15))

    # Totales
    totals_data = [
        [Paragraph("<b>Subtotal:</b>", header_style), Paragraph(f"${float(invoice.subtotal):.2f}", bold_style)],
        [Paragraph("<b>Descuento:</b>", header_style), Paragraph(f"${float(invoice.discount_amount):.2f}", bold_style)],
        [Paragraph("<b>Total Facturado:</b>", bold_style), Paragraph(f"${float(invoice.total):.2f}", bold_style)],
    ]
    totals_table = Table(totals_data, colWidths=[120, 100], hAlign='RIGHT')
    totals_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEABOVE', (0, 2), (1, 2), 1, colors.HexColor('#0F172A')),
    ]))
    elements.append(totals_table)

    doc.build(elements)
    pdf_data = buffer.getvalue()
    buffer.close()

    filename = f"{invoice.invoice_number}.pdf"
    invoice.pdf_file.save(filename, ContentFile(pdf_data), save=False)
    return invoice.pdf_file


def create_invoice_for_order(order):
    """
    Crea automáticamente la factura asociada a un pedido cuando se aprueba el pago final.
    Si ya existe una factura para este pedido, la retorna sin duplicar.
    """
    from apps.invoice.models import Invoice

    # Si ya existe una factura para la orden, no crear duplicados
    existing_invoice = Invoice.objects.filter(order=order, is_deleted=False).first()
    if existing_invoice:
        return existing_invoice

    user = order.user
    full_name = f"{user.first_name} {user.first_last_name}".strip() if hasattr(user, 'first_last_name') else user.get_full_name()
    customer_name = full_name if full_name else user.username
    customer_tax_id = getattr(user, 'identity_document', None) or "S/D"
    customer_email = user.email or "sin_correo@ejemplo.com"

    # Obtener dirección de envío si existe
    shipment = order.shipments.filter(is_deleted=False).first()
    if shipment:
        parts = [shipment.address, shipment.city, shipment.municipality, shipment.state]
        billing_address = ", ".join([p for p in parts if p])
    else:
        billing_address = order.notes if order.notes else "Dirección no especificada"

    # Captura snapshot de los productos
    items_snapshot = []
    for detail in order.details.filter(is_deleted=False):
        for op in detail.order_products.filter(is_deleted=False):
            items_snapshot.append({
                'product_id': op.product.id,
                'name': op.product.product_name,
                'quantity': detail.quantity,
                'unit_price': float(op.price_at_order if op.price_at_order is not None else op.product.price),
                'total_price': float(detail.final_price),
                'notes': detail.notes or ''
            })

    invoice = Invoice.objects.create(
        order=order,
        customer_name=customer_name,
        customer_tax_id=customer_tax_id,
        customer_email=customer_email,
        billing_address=billing_address,
        subtotal=order.total_price,
        discount_amount=0.00,
        total=order.total_price,
        items_snapshot=items_snapshot
    )

    try:
        generate_invoice_pdf(invoice)
        invoice.save()
    except Exception:
        pass

    return invoice

