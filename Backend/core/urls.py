from django.contrib import admin
from django.urls import path,include,re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi


schema_view = get_schema_view(
    openapi.Info(
        title="Documentación de API",
        default_version='v0.1',
        description="Documentación privada de API de gestion de pedidos",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="aragozaca@gmail.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)


urlpatterns = [
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    
    path('admin/', admin.site.urls),
    path('api/products/', include('apps.product.api.routers')),
    path('api/projects/', include('apps.project.api.routers')),
    path('api/gallery/', include('apps.gallery.api.routers')),
    path('api/user/', include('apps.user.api.routers')),
    path('api/', include('apps.orders.api.routers')),

    path('api/', include('apps.payment.api.routers')),
    path('api/', include('apps.production.api.routers')),
    path('api/production/', include('apps.production.api.routers')),
    path('api/', include('apps.shipment.api.routers')),
    path('api/shipments/', include('apps.shipment.api.routers')),
    path('api/', include('apps.notification.api.routers')),
    path('api/', include('apps.invoice.api.routers')),
    path('api/employee-store/', include('apps.employee_store.api.routers')),
]






import mimetypes
import os
import re
from django.http import HttpResponse, StreamingHttpResponse, Http404


def ranged_media_serve(request, path, document_root=None):
    """
    Sirve archivos estáticos y multimedia en desarrollo con soporte completo para
    cabeceras HTTP Range (206 Partial Content), permitiendo reproducir, adelantar
    y retroceder videos (MP4, WebM, etc.) fluidamente en el navegador.
    """
    if not document_root:
        raise Http404("Document root not specified")

    full_path = os.path.abspath(os.path.join(document_root, path))
    doc_root = os.path.abspath(document_root)

    if not full_path.startswith(doc_root):
        raise Http404("File not found")
    if not os.path.exists(full_path) or os.path.isdir(full_path):
        raise Http404("File not found")

    file_size = os.path.getsize(full_path)
    content_type, encoding = mimetypes.guess_type(full_path)
    content_type = content_type or 'application/octet-stream'

    range_header = request.headers.get('range', '').strip()
    range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)

    if range_match:
        start = int(range_match.group(1))
        end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
        if start >= file_size:
            response = HttpResponse(status=416)
            response['Content-Range'] = f'bytes */{file_size}'
            return response
        end = min(end, file_size - 1)
        length = end - start + 1

        def file_iterator(file_path, offset, req_len, chunk_size=32768):
            with open(file_path, 'rb') as f:
                f.seek(offset)
                remaining = req_len
                while remaining > 0:
                    read_size = min(remaining, chunk_size)
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        response = StreamingHttpResponse(
            file_iterator(full_path, start, length),
            status=206,
            content_type=content_type
        )
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Content-Length'] = str(length)
    else:
        def file_iterator_full(file_path, chunk_size=32768):
            with open(file_path, 'rb') as f:
                while True:
                    data = f.read(chunk_size)
                    if not data:
                        break
                    yield data

        response = StreamingHttpResponse(
            file_iterator_full(full_path),
            status=200,
            content_type=content_type
        )
        response['Content-Length'] = str(file_size)

    response['Accept-Ranges'] = 'bytes'
    if encoding:
        response['Content-Encoding'] = encoding
    return response


# Configuración para servir archivos multimedia en desarrollo
if settings.DEBUG:
    media_url = settings.MEDIA_URL.lstrip('/')
    urlpatterns += [
        re_path(rf'^{media_url}(?P<path>.*)$', ranged_media_serve, {'document_root': settings.MEDIA_ROOT}),
    ]
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)


