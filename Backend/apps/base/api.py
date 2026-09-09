from rest_framework import viewsets, status, filters
from rest_framework.response import Response

from apps.base.pagination import BasePagination


class BaseViewSet(viewsets.ModelViewSet):
    """
    ViewSet base para la plataforma TuEstante.
    - Implementa borrado lógico (is_deleted=False).
    - Soporta paginación flexible y retrocompatible (BasePagination).
    - Soporta búsqueda y ordenamiento estándar (SearchFilter, OrderingFilter).
    - Restaura automáticamente registros duplicados borrados lógicamente.
    """
    pagination_class = BasePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    def get_queryset(self):
        if hasattr(self, 'queryset') and self.queryset is not None:
            return self.queryset.filter(is_deleted=False)
        serializer_class = self.get_serializer_class()
        model = getattr(serializer_class, 'Meta', None)
        if model and hasattr(model, 'model'):
            return model.model.objects.filter(is_deleted=False)
        return super().get_queryset().filter(is_deleted=False)

    def create(self, request, *args, **kwargs):
        """
        Sobrescribe create para interceptar registros duplicados previamente borrados lógicamente,
        restaurándolos y actualizándolos en lugar de fallar por unicidad.
        """
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            model = getattr(serializer.Meta, 'model', None) if hasattr(serializer, 'Meta') else None
            if model and hasattr(model, 'is_deleted'):
                try:
                    valid_fields = {f.name for f in model._meta.fields}
                    temp_kwargs = {}
                    for k, v in request.data.items():
                        if k in valid_fields:
                            field_obj = model._meta.get_field(k)
                            if field_obj.is_relation and not isinstance(v, field_obj.related_model):
                                temp_kwargs[f"{k}_id"] = v
                            else:
                                temp_kwargs[k] = v

                    temp_obj = model(**temp_kwargs)
                    soft_deleted = temp_obj._find_soft_deleted_duplicate()
                    if soft_deleted:
                        for key, val in request.data.items():
                            if key in valid_fields and key not in ('id', 'created_at', 'is_deleted', 'deleted_at'):
                                field_obj = model._meta.get_field(key)
                                if field_obj.is_relation and not isinstance(val, field_obj.related_model):
                                    setattr(soft_deleted, f"{key}_id", val)
                                else:
                                    setattr(soft_deleted, key, val)
                        soft_deleted.is_deleted = False
                        soft_deleted.deleted_at = None
                        soft_deleted.save()

                        out_serializer = self.get_serializer(soft_deleted)
                        return Response(out_serializer.data, status=status.HTTP_201_CREATED)
                except Exception:
                    pass

            serializer.is_valid(raise_exception=True)

        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Soporta borrado lógico y opcionalmente un mensaje personalizado."""
        message = kwargs.pop("message", None)
        instance = self.get_object()
        instance.delete()

        if message is not None:
            serializer = self.get_serializer(instance)
            return Response({"mensaje": message, "objeto": serializer.data}, status=status.HTTP_200_OK)

        return Response({"message": "Borrado exitoso"}, status=status.HTTP_204_NO_CONTENT)