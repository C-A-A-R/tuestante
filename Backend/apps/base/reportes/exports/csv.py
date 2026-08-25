import csv

from django.http import HttpResponse


class CsvExporter:

    content_type = "text/csv"
    
    def export(self, filename, columns, rows):
        response = HttpResponse(content_type=self.content_type)

        response[ "Content-Disposition" ] = f'attachment; filename="{filename}.csv"'

        writer = csv.writer(response)

        writer.writerow(columns)

        for row in rows:
            writer.writerow(row)

        return response