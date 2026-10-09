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


from django.utils.http import http_date


def ranged_media_serve(request, path, document_root=None):
    """
    Sirve archivos estáticos y multimedia en desarrollo con soporte completo para
    cabeceras HTTP Range (RFC 7233, 206 Partial Content), permitiendo reproducir,
    adelantar y retroceder videos (MP4, WebM, etc.) fluidamente en cualquier navegador.
    """
    if not document_root:
        raise Http404("Document root not specified")

    full_path = os.path.abspath(os.path.join(document_root, path))
    doc_root = os.path.abspath(document_root)

    if not full_path.startswith(doc_root):
        raise Http404("File not found")
    if not os.path.exists(full_path) or os.path.isdir(full_path):
        raise Http404("File not found")

    origin = request.headers.get('origin')

    # Manejar peticiones OPTIONS preflight de CORS
    if request.method == 'OPTIONS':
        options_response = HttpResponse(status=204)
        if origin:
            options_response['Access-Control-Allow-Origin'] = origin
            options_response['Access-Control-Allow-Credentials'] = 'true'
        else:
            options_response['Access-Control-Allow-Origin'] = '*'
        options_response['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        options_response['Access-Control-Allow-Headers'] = 'Range, Authorization, Content-Type, Accept'
        options_response['Access-Control-Max-Age'] = '86400'
        return options_response

    statobj = os.stat(full_path)
    file_size = statobj.st_size
    content_type, encoding = mimetypes.guess_type(full_path)
    content_type = content_type or 'application/octet-stream'

    etag = f'"{int(statobj.st_mtime)}-{file_size}"'
    last_modified = http_date(statobj.st_mtime)

    # Validación de caché condicional (304 Not Modified)
    if request.headers.get('if-none-match') == etag:
        not_modified = HttpResponse(status=304)
        not_modified['ETag'] = etag
        not_modified['Last-Modified'] = last_modified
        return not_modified

    # Función auxiliar para configurar cabeceras comunes
    def set_common_headers(res):
        res['Accept-Ranges'] = 'bytes'
        res['Last-Modified'] = last_modified
        res['ETag'] = etag
        filename = os.path.basename(full_path)
        res['Content-Disposition'] = f'inline; filename="{filename}"'
        if origin:
            res['Access-Control-Allow-Origin'] = origin
            res['Access-Control-Allow-Credentials'] = 'true'
            res['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            res['Access-Control-Allow-Headers'] = 'Range, Authorization, Content-Type, Accept'
        res['Access-Control-Expose-Headers'] = 'Content-Disposition, Content-Range, Content-Length, Accept-Ranges, ETag, Last-Modified'
        if encoding:
            res['Content-Encoding'] = encoding
        return res

    # Peticiones HEAD: retornar cabeceras sin procesar/transmitir el cuerpo
    if request.method == 'HEAD':
        head_response = HttpResponse('', status=200, content_type=content_type)
        head_response['Content-Length'] = str(file_size)
        return set_common_headers(head_response)

    # Análisis de la cabecera Range según RFC 7233
    range_header = request.headers.get('range', '').strip()
    range_match = re.match(r'bytes=(\d*)-(\d*)', range_header) if range_header else None

    range_spec = None
    if range_match:
        s_str, e_str = range_match.groups()
        if not s_str and not e_str:
            range_spec = None
        elif not s_str:  # bytes=-500 (últimos N bytes)
            suffix_len = int(e_str)
            if suffix_len > 0:
                start = max(0, file_size - suffix_len)
                end = file_size - 1
                range_spec = (start, end)
        elif not e_str:  # bytes=500- (desde byte 500 hasta el final)
            start = int(s_str)
            end = file_size - 1
            range_spec = (start, end)
        else:            # bytes=500-1000
            start = int(s_str)
            end = int(e_str)
            range_spec = (start, end)

    chunk_size = 131072  # 128 KB para streaming fluido

    if range_spec:
        start, end = range_spec
        if start >= file_size or start > end:
            error_response = HttpResponse(status=416)
            error_response['Content-Range'] = f'bytes */{file_size}'
            return set_common_headers(error_response)

        end = min(end, file_size - 1)
        length = end - start + 1

        def file_iterator_range(fpath, offset, req_len, c_size=chunk_size):
            with open(fpath, 'rb') as f:
                f.seek(offset)
                remaining = req_len
                while remaining > 0:
                    read_size = min(remaining, c_size)
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        response = StreamingHttpResponse(
            file_iterator_range(full_path, start, length),
            status=206,
            content_type=content_type
        )
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Content-Length'] = str(length)
    else:
        def file_iterator_full(fpath, c_size=chunk_size):
            with open(fpath, 'rb') as f:
                while True:
                    data = f.read(c_size)
                    if not data:
                        break
                    yield data

        response = StreamingHttpResponse(
            file_iterator_full(full_path),
            status=200,
            content_type=content_type
        )
        response['Content-Length'] = str(file_size)

    return set_common_headers(response)


# Configuración para servir archivos multimedia en desarrollo
if settings.DEBUG:
    media_url = settings.MEDIA_URL.lstrip('/')
    urlpatterns += [
        re_path(rf'^{media_url}(?P<path>.*)$', ranged_media_serve, {'document_root': settings.MEDIA_ROOT}),
    ]
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)


