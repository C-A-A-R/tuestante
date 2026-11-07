from reportlab.platypus import Table
from reportlab.platypus import TableStyle

from reportlab.lib import colors


class ReportNestedTable:

    TABLE_WIDTH = 820

    @classmethod
    def build(
        cls,
        sections,
    ):

        content = []

        for section in sections:

            parent_columns = section["columns"]
            parent_rows = section["rows"]

            child_columns = section["child_columns"]
            child_rows = section["child_rows"]

            # =====================
            # TABLA HIJA
            # =====================

            child_data = [child_columns]

            for row in child_rows:

                child_data.append(
                    [str(v) for v in row]
                )

            child_width = (
                cls.TABLE_WIDTH /
                len(child_columns)
            )

            child_table = Table(
                child_data,
                colWidths=[
                    child_width
                ] * len(child_columns)
            )

            child_table.setStyle(
                TableStyle([
                    ("GRID",(0,0),(-1,-1),1,colors.black),
                    ("BACKGROUND",(0,0),(-1,0),colors.lightgrey),
                    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
                ])
            )

            # =====================
            # TABLA PADRE
            # =====================

            parent_data = [parent_columns]

            for row in parent_rows:

                parent_data.append(
                    [str(v) for v in row]
                )

            parent_data.append(
                [child_table] +
                [""] * (
                    len(parent_columns) - 1
                )
            )

            last_row = (
                len(parent_data) - 1
            )

            parent_width = (
                cls.TABLE_WIDTH /
                len(parent_columns)
            )

            parent_table = Table(
                parent_data,
                colWidths=[
                    parent_width
                ] * len(parent_columns)
            )

            parent_table.setStyle(
                TableStyle([
                    ("GRID",(0,0),(-1,-1),1,colors.black),
                    ("BACKGROUND",(0,0),(-1,0),colors.lightgrey),
                    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),

                    (
                        "SPAN",
                        (0,last_row),
                        (-1,last_row)
                    ),
                ])
            )

            content.append([parent_table])

        container = Table(
            content,
            colWidths=[cls.TABLE_WIDTH]
        )

        container.setStyle(
            TableStyle([
                ("LEFTPADDING",(0,0),(-1,-1),0),
                ("RIGHTPADDING",(0,0),(-1,-1),0),
                ("TOPPADDING",(0,0),(-1,-1),6),
                ("BOTTOMPADDING",(0,0),(-1,-1),6),
            ])
        )

        return container