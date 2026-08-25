from django.db import models
from django.utils import timezone
from django.conf import settings
from django.core.exceptions import ValidationError
from simple_history.models import HistoricalRecords


class BaseModel(models.Model):
    """Modelo base con campos comunes para auditoría y borrado lógico."""

    id = models.AutoField(primary_key=True)
    is_deleted = models.BooleanField('Eliminado', default=False)
    created_at = models.DateField('Fecha de Creación', auto_now=False, auto_now_add=True)
    updated_at = models.DateField('Fecha de Modificación', auto_now=True, auto_now_add=False)
    deleted_at = models.DateField('Fecha de Eliminación', null=True, blank=True)
    historical = HistoricalRecords(user_model=settings.AUTH_USER_MODEL, inherit=True)

    def _find_soft_deleted_duplicate(self):
        """
        Busca si existe un registro previamente borrado lógicamente (is_deleted=True)
        que coincida en los campos con unique=True, unique_together o UniqueConstraint.
        """
        if self.pk is not None:
            return None

        model_class = self.__class__
        opts = model_class._meta

        # 1. Buscar por campos únicos individuales
        for field in opts.fields:
            if field.unique and not field.primary_key and field.name not in ('id', 'is_deleted', 'deleted_at'):
                val = getattr(self, field.name, None)
                if val is not None and val != '':
                    filter_kwargs = {field.name: val, 'is_deleted': True}
                    existing = model_class.objects.filter(**filter_kwargs).first()
                    if existing:
                        return existing

        # 2. Buscar por grupos de campos unique_together
        if opts.unique_together:
            for group in opts.unique_together:
                filter_kwargs = {'is_deleted': True}
                match = True
                for field_name in group:
                    val = getattr(self, field_name, None)
                    if val is None or val == '':
                        match = False
                        break
                    filter_kwargs[field_name] = val
                if match:
                    existing = model_class.objects.filter(**filter_kwargs).first()
                    if existing:
                        return existing

        # 3. Buscar por Meta.constraints (UniqueConstraint)
        if hasattr(opts, 'constraints'):
            for constraint in opts.constraints:
                if isinstance(constraint, models.UniqueConstraint):
                    filter_kwargs = {'is_deleted': True}
                    match = True
                    for field_name in constraint.fields:
                        val = getattr(self, field_name, None)
                        if val is None or val == '':
                            match = False
                            break
                        filter_kwargs[field_name] = val
                    if match:
                        existing = model_class.objects.filter(**filter_kwargs).first()
                        if existing:
                            return existing

        return None

    def validate_unique(self, exclude=None):
        """
        Sobrescribe validate_unique para ignorar conflictos de unicidad con
        registros borrados lógicamente (is_deleted=True). Si sólo existe un
        registro borrado lógicamente con este valor único, save() lo restaurará.
        """
        try:
            super().validate_unique(exclude=exclude)
        except ValidationError as e:
            error_dict = e.error_dict if hasattr(e, 'error_dict') else {}
            filtered_errors = {}

            for field_name, errors in error_dict.items():
                keep_errors = []
                for error in errors:
                    is_unique_err = (
                        getattr(error, 'code', None) == 'unique' or
                        'ya existe' in str(getattr(error, 'message', '')).lower() or
                        'already exists' in str(getattr(error, 'message', '')).lower()
                    )
                    if is_unique_err:
                        val = getattr(self, field_name, None)
                        if val is not None and hasattr(self.__class__, 'is_deleted'):
                            # Verificar si existe un registro ACTIVO (is_deleted=False) distinto a este
                            active_exists = self.__class__.objects.filter(
                                **{field_name: val, 'is_deleted': False}
                            ).exclude(pk=self.pk if self.pk else None).exists()

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

    def save(self, *args, **kwargs):
        """
        Sobrescribe save() para que, si se intenta crear un nuevo registro que coincide
        con uno borrado lógicamente (is_deleted=True) en sus campos únicos, lo restaure
        y actualice sus valores en lugar de intentar una nueva inserción.
        """
        if self.pk is None:
            existing = self._find_soft_deleted_duplicate()
            if existing:
                # Actualizar los campos del registro borrado con los datos del nuevo objeto
                for field in self._meta.fields:
                    if field.primary_key or field.name in ('created_at', 'is_deleted', 'deleted_at'):
                        continue
                    new_val = getattr(self, field.name, None)
                    setattr(existing, field.name, new_val)

                existing.is_deleted = False
                existing.deleted_at = None

                save_kwargs = kwargs.copy()
                save_kwargs.pop('force_insert', None)
                existing.save(**save_kwargs)

                # Sincronizar el objeto actual con el registro restaurado
                self.pk = existing.pk
                self.id = existing.id
                self.is_deleted = False
                self.deleted_at = None
                self.created_at = existing.created_at
                self.updated_at = existing.updated_at
                return

        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        """Borrado lógico: marca el objeto como inactivo y registra la fecha de eliminación."""
        self.is_deleted = True
        self.deleted_at = timezone.now().date()
        self.save()

    class Meta:
        abstract = True
        verbose_name = 'Modelo Base'
        verbose_name_plural = 'Modelos Base'

