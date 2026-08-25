class BaseReportService:

    @staticmethod
    def get_queryset(model): return model.objects.filter(eliminado=False)

    @staticmethod
    def build_response( filename, columns, rows):
        return {
            "filename": filename,
            "columns": columns,
            "rows": rows,
        }