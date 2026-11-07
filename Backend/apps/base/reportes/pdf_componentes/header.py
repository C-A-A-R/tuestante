from pathlib import Path

from reportlab.platypus import Image, Table, Paragraph, Spacer


from .styles import get_report_styles


BASE_DIR = Path(__file__).resolve().parent.parent

IMAGES_DIR = BASE_DIR / "assets" / "images"

class ReportHeader:

    @staticmethod
    def build():

        styles = get_report_styles()

        elements = []

        logo_gobierno = Image(
            str(IMAGES_DIR / "logo_gobierno.png"),
            width=600,
            height=35
        )

        logo_comuna = Image(
            str(IMAGES_DIR / "logo_comuna.png"),
            width=70,
            height=70
        )

        top_table = Table(
            [[logo_gobierno, logo_comuna]],
            colWidths=[620, 90]
        )

        elements.append(top_table)
        elements.append(Spacer(1, 15))

        logo_consejo = Image( str(IMAGES_DIR / "logo_consejo.png"), width=220, height=80)
        logo_consejo.hAlign = "CENTER"
        elements.append(logo_consejo)

        elements.append(
            Paragraph(
                "CONSEJO COMUNAL LOS POSITOS",
                styles["Institution"]
            )
        )

        elements.append(
            Spacer(1, 20)
        )

        return elements