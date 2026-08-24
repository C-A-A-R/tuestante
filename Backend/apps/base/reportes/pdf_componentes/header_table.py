# base/reportes/pdf_componentes/header_table.py

from reportlab.platypus import Table
from reportlab.platypus import TableStyle

from reportlab.lib import colors


class ReportHeaderTable:

    AVAILABLE_WIDTH = 720

    @staticmethod
    def build(data):

        if not data:
            return None

        tables = []

        for i in range(0, len(data), 3):

            group = data[i:i + 3]

            headers = [
                label
                for label, value in group
            ]

            values = [
                str(value)
                for label, value in group
            ]

            columns_count = len(group)

            col_width = (
                ReportHeaderTable.AVAILABLE_WIDTH
                / columns_count
            )

            table = Table(
                [headers, values],
                colWidths=[
                    col_width
                ] * columns_count
            )

            table.setStyle(
                TableStyle([
                    ("GRID",(0,0),(-1,-1),1,colors.black),

                    ("FONTNAME",
                     (0,0),
                     (-1,0),
                     "Helvetica-Bold"),

                    ("FONTNAME",
                     (0,1),
                     (-1,1),
                     "Helvetica"),

                    ("VALIGN",
                     (0,0),
                     (-1,-1),
                     "MIDDLE"),

                    ("BACKGROUND",
                     (0,0),
                     (-1,0),
                     colors.whitesmoke),

                    ("BOTTOMPADDING",
                     (0,0),
                     (-1,-1),
                     6),

                    ("TOPPADDING",
                     (0,0),
                     (-1,-1),
                     6),
                ])
            )

            tables.append(table)

        return tables