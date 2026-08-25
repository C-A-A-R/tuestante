from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.styles import ParagraphStyle


def get_report_styles():

    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            fontSize=16,
            leading=20,
            alignment=1,
            spaceAfter=20,
        )
    )

    styles.add(
        ParagraphStyle(
            name="Institution",
            fontSize=11,
            alignment=1,
        )
    )

    return styles