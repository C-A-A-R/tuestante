from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class BasePagination(PageNumberPagination):
    """
    Paginador base flexible y retrocompatible para TuEstante.
    
    Características:
    - Tamaño por defecto: 20 registros por página.
    - El cliente puede personalizar con ?page_size=N (máximo 100).
    - Activación inteligente: Se activa automáticamente si la petición incluye
      los parámetros '?page=' o '?page_size=', o si la vista define 'paginate_by_default = True'.
    - Si no se solicita paginación explícita, retorna la lista completa para preservar
      compatibilidad con vistas legacy y pruebas automatizadas.
    """

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        if (
            'page' in request.query_params or
            'page_size' in request.query_params or
            getattr(view, 'paginate_by_default', False)
        ):
            return super().paginate_queryset(queryset, request, view)
        return None

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data
        })
