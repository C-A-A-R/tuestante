# base/reportes/pdf_componentes/single_table.py

from reportlab.platypus import Table
from reportlab.platypus import TableStyle
from reportlab.lib import colors


class ReportSingleTable:

    TABLE_WIDTH = 820

    @staticmethod
    def build(columns, rows):

        data = [columns]

        for row in rows:
            data.append(
                [str(value) for value in row]
            )

        col_width = (
            ReportSingleTable.TABLE_WIDTH
            / len(columns)
        )

        table = Table(
            data,
            colWidths=[
                col_width
            ] * len(columns)
        )

        table.setStyle(
            TableStyle([
                ("GRID",(0,0),(-1,-1),1,colors.black),
                ("BACKGROUND",(0,0),(-1,0),colors.lightgrey),
                ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
                ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ])
        )

        return table