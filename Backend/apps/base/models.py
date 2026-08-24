from django.db import models
from django.utils import timezone
from django.conf import settings
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
        que coincida en los campos con unique=True o en unique_together.
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

        return None

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
                    setattr(existing, field.name, getattr(self, field.name))

                existing.is_deleted = False
                existing.deleted_at = None

                # Eliminar force_insert de kwargs al actualizar el registro existente
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
        """Meta definición para BaseModel."""
        abstract = True
        verbose_name = 'Modelo Base'
        verbose_name_plural = 'Modelos Base'
