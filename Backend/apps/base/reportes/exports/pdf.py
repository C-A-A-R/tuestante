import io

from django.http import HttpResponse
from django.utils import timezone

from reportlab.lib.pagesizes import landscape
from reportlab.lib.pagesizes import letter

from reportlab.platypus import  SimpleDocTemplate, Paragraph, Spacer

from apps.base.reportes.pdf_componentes.header import ReportHeader
from apps.base.reportes.pdf_componentes.single_table import ReportSingleTable
from apps.base.reportes.pdf_componentes.nested_table import ReportNestedTable
from apps.base.reportes.pdf_componentes.styles import get_report_styles
from apps.base.reportes.pdf_componentes.header_table import ReportHeaderTable


class PdfExporter:

    def export(
        self,
        filename,
        title,
        columns=None,
        rows=None,
        subtitle=None,
        header_table=None,
        extra_content=None,
        nested_tables=None,
    ):

        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),  # horizontal
            leftMargin=25,
            rightMargin=25,
            topMargin=20,
            bottomMargin=20,
        )

        styles = get_report_styles()

        story = []

        story.extend(ReportHeader.build())

        story.append(Paragraph(title, styles["ReportTitle"]))

        if header_table:
            header_tables = ReportHeaderTable.build(
                header_table
            )

            story.extend(header_tables)

            story.append(
                Spacer(1, 12)
            )

        if extra_content:
            story.extend(extra_content)
            story.append(Spacer(1, 10))

        if subtitle:
            story.append(
                Paragraph(
                    subtitle,
                    styles["TableTitle"]
                )
            )

        if nested_tables:
            story.append(
                ReportNestedTable.build(
                    nested_tables
                )
            )

        if columns and rows:
            story.append(
                ReportSingleTable.build(
                    columns,
                    rows
                )
            )

        doc.build(story)

        pdf = buffer.getvalue()

        buffer.close()

        response = HttpResponse(
            pdf,
            content_type="application/pdf"
        )
        response[
            "Content-Disposition"
        ] = f'attachment; filename="{filename or title}-{timezone.localdate()}.pdf"'

        return response