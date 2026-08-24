from rest_framework import viewsets, status
from rest_framework.response import Response


class BaseViewSet(viewsets.ModelViewSet):
    """
    ViewSet base que implementa borrado lógico y restauración automática
    en caso de registrar objetos previamente eliminados.
    """
    def get_queryset(self):
        model = self.get_serializer().Meta.model
        return model.objects.filter(is_deleted=False)

    def create(self, request, *args, **kwargs):
        """
        Sobrescribe create para interceptar registros duplicados previamente borrados lógicamente,
        restaurándolos y actualizándolos en lugar de fallar por unicidad.
        """
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            model = getattr(serializer.Meta, 'model', None) if hasattr(serializer, 'Meta') else None
            if model and hasattr(model, 'is_deleted'):
                valid_fields = {f.name for f in model._meta.fields}
                temp_kwargs = {k: v for k, v in request.data.items() if k in valid_fields}
                temp_obj = model(**temp_kwargs)
                soft_deleted = temp_obj._find_soft_deleted_duplicate()
                if soft_deleted:
                    for key, val in request.data.items():
                        if key in valid_fields and key not in ('id', 'created_at', 'is_deleted', 'deleted_at'):
                            setattr(soft_deleted, key, val)
                    soft_deleted.is_deleted = False
                    soft_deleted.deleted_at = None
                    soft_deleted.save()

                    out_serializer = self.get_serializer(soft_deleted)
                    return Response(out_serializer.data, status=status.HTTP_201_CREATED)

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