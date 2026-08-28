from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from django.http import FileResponse, Http404

from apps.invoice.models import Invoice
from apps.invoice.api.serializers import InvoiceSerializer
from apps.invoice.services import generate_invoice_pdf


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para la consulta de Facturas.
    - Soporta exclusivamente peticiones de lectura (GET, HEAD, OPTIONS).
    - Los usuarios autenticados pueden ver únicamente las facturas de sus propios pedidos.
    - Los administradores pueden ver todas las facturas.
    """

    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'head', 'options']

    def get_queryset(self):
        """
        Retorna el queryset de facturas no eliminadas lógicamente.
        - Filtra por el usuario autenticado a menos que sea staff/administrador.
        """
        queryset = Invoice.objects.filter(is_deleted=False).select_related('order__user')

        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(order__user=self.request.user)

        return queryset

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """
        Permite descargar el archivo PDF de la factura directamente.
        Si aún no se ha generado el archivo PDF, lo genera sobre la marcha.
        """
        invoice = self.get_object()
        if not invoice.pdf_file:
            generate_invoice_pdf(invoice)
            invoice.save()

        if invoice.pdf_file:
            response = FileResponse(
                invoice.pdf_file.open('rb'),
                content_type='application/pdf',
                as_attachment=True,
                filename=f"{invoice.invoice_number}.pdf"
            )
            return response

        raise Http404("El archivo PDF de la factura no se encuentra disponible.")
