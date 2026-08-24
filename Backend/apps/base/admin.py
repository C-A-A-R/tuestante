from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from simple_history.admin import SimpleHistoryAdmin


class BaseAdmin(SimpleHistoryAdmin):
    """
    Clase Admin base que fuerza el borrado lógico en todas las pantallas del Django Admin.

    - `get_queryset()`: Muestra por defecto solo registros no eliminados (`is_deleted=False`).
    - `delete_model()`: Ejecuta `obj.delete()` para el borrado suave individual.
    - `delete_queryset()`: Sobrescribe el borrado masivo por defecto para iterar los objetos.
    - `get_form()`: Ignora registros eliminados lógicamente durante la validación de campos únicos.
    - `formfield_for_foreignkey` / `formfield_for_manytomany`: Filtra selectores para excluir inactivos.
    """

    def get_queryset(self, request):
        """Filtra el queryset del admin para mostrar solo elementos no eliminados."""
        qs = super().get_queryset(request)
        return qs.filter(is_deleted=False)

    def delete_model(self, request, obj):
        """Aplica borrado lógico en la eliminación individual desde el formulario."""
        obj.delete()

    def delete_queryset(self, request, queryset):
        """Aplica borrado lógico en la eliminación masiva desde el listado de elementos."""
        for obj in queryset:
            obj.delete()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Excluye de las opciones ForeignKey los registros borrados lógicamente."""
        if hasattr(db_field.remote_field.model, 'is_deleted'):
            kwargs["queryset"] = db_field.remote_field.model.objects.filter(is_deleted=False)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        """Excluye de las opciones ManyToMany los registros borrados lógicamente."""
        if hasattr(db_field.remote_field.model, 'is_deleted'):
            kwargs["queryset"] = db_field.remote_field.model.objects.filter(is_deleted=False)
        return super().formfield_for_manytomany(db_field, request, **kwargs)

    def get_form(self, request, obj=None, **kwargs):
        """
        Personaliza la validación de campos únicos del formulario de Django Admin
        para excluir los registros borrados lógicamente (is_deleted=True).
        """
        form_class = super().get_form(request, obj, **kwargs)

        class SoftDeleteModelForm(form_class):
            def validate_unique(cls_self):
                try:
                    super().validate_unique()
                except ValidationError as e:
                    error_dict = e.error_dict if hasattr(e, 'error_dict') else {}
                    filtered_errors = {}

                    for field_name, errors in error_dict.items():
                        keep_errors = []
                        for error in errors:
                            is_unique_err = (
                                getattr(error, 'code', None) == 'unique' or
                                'ya existe' in str(error.message).lower() or
                                'already exists' in str(error.message).lower()
                            )
                            if is_unique_err:
                                field_val = cls_self.cleaned_data.get(field_name)
                                model_class = cls_self._meta.model
                                if field_val is not None and hasattr(model_class, 'is_deleted'):
                                    active_exists = model_class.objects.filter(
                                        **{field_name: field_val, 'is_deleted': False}
                                    ).exclude(pk=cls_self.instance.pk if cls_self.instance else None).exists()

                                    if active_exists:
                                        keep_errors.append(error)
                                else:
                                    keep_errors.append(error)
                            else:
                                keep_errors.append(error)

                        if keep_errors:
                            filtered_errors[field_name] = keep_errors

                    if filtered_errors:
                        raise ValidationError(filtered_errors)

        return SoftDeleteModelForm
