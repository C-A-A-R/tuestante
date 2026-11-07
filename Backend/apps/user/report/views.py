from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound

from apps.user.api.permisos import IsAdmin
from apps.base.reportes.views.base_export_view import BaseExportView
from apps.base.reportes.constantes import REPORT_FORMAT_PDF, REPORT_FORMAT_EXCEL
from apps.user.report.services import UsuariosReportService


class UsuariosReportView(BaseExportView):
    """
    Vista de exportación de reportes del módulo de usuarios.
    """

    permission_classes = [IsAdmin]


    REPORTS = {
        "usuarios": UsuariosReportService.usuarios,
        "administradores": UsuariosReportService.administradores,
        "usuario_detalle": UsuariosReportService.usuario_detalle,
        "usuario-detalle": UsuariosReportService.usuario_detalle,
    }

    REPORT_TITLES = {
        "usuarios": "REPORTE DE USUARIOS DEL SISTEMA",
        "administradores": "REPORTE DE ADMINISTRADORES DEL SISTEMA",
        "usuario_detalle": "DETALLE DE USUARIO",
        "usuario-detalle": "DETALLE DE USUARIO",
    }

    def get(self, request, report_type):
        """
        Genera y exporta el reporte solicitado.
        """

        report_function = self.REPORTS.get(report_type)

        if not report_function:
            raise NotFound(
                detail=(
                    f"Tipo de reporte '{report_type}' no encontrado. "
                    f"Opciones válidas: {', '.join(self.REPORTS.keys())}"
                )
            )

        report_format = request.query_params.get(
            "tipo",
            REPORT_FORMAT_EXCEL,
        ).lower()

        report_data = report_function(request.query_params)

        exporter = self.get_exporter(report_format)

        title = self.REPORT_TITLES[report_type]

        if report_format == REPORT_FORMAT_PDF:
            return exporter.export(
                filename=report_data["filename"],
                title=title,
                columns=report_data.get("columns"),
                rows=report_data.get("rows"),
                header_table=report_data.get("header_table"),
                nested_tables=report_data.get("nested_tables"),
            )

        if report_format == REPORT_FORMAT_EXCEL:
            # Preparar header_table para Excel (agrupando de 3 en 3 elementos por fila)
            excel_header_table = report_data.get("header_table")
            if excel_header_table:
                excel_header_table = [
                    excel_header_table[i:i+3]
                    for i in range(0, len(excel_header_table), 3)
                ]

            tables = []
            if "columns" in report_data and "rows" in report_data:
                tables.append({
                    "title": title,
                    "columns": report_data["columns"],
                    "rows": report_data["rows"],
                })

            return exporter.export(
                filename=report_data["filename"],
                title=title,
                tables=tables if tables else None,
                header_table=excel_header_table,
                nested_tables=report_data.get("nested_tables"),
            )

        # Fallback para CSV
        return exporter.export(
            filename=report_data["filename"],
            columns=report_data.get("columns", []),
            rows=report_data.get("rows", []),
        )
