from rest_framework.views import APIView
from rest_framework.renderers import StaticHTMLRenderer

from apps.base.reportes.constantes import REPORT_FORMAT_CSV, REPORT_FORMAT_EXCEL, REPORT_FORMAT_PDF 
from apps.base.reportes.exports.csv import CsvExporter
from apps.base.reportes.exports.exel import ExcelExporter
from apps.base.reportes.exports.pdf import PdfExporter


class BaseExportView(APIView):
    renderer_classes = [StaticHTMLRenderer]

    def get_exporter(self, report_format):

        exporters = {
            REPORT_FORMAT_CSV: CsvExporter,
            REPORT_FORMAT_EXCEL: ExcelExporter,
            REPORT_FORMAT_PDF: PdfExporter,
        }

        exporter = exporters.get(report_format)

        if exporter is None:
            raise ValueError(f"Formato no soportado: {report_format}")

        return exporter()