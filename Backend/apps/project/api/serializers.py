from rest_framework import serializers
from apps.project.models import Project


class ProjectSerializer(serializers.ModelSerializer):
    """Serializador para el modelo Project."""

    class Meta:
        model = Project
        fields = ['id', 'project_name', 'description', 'is_active', 'project_document', 'project_images', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        if hasattr(data, '_mutable'):
            data = data.copy()
            if 'is_active' in data:
                val = str(data['is_active']).strip().lower()
                data['is_active'] = val in ['true', '1', 'yes', 't', 'si', 'activo']
            if self.instance:
                if 'project_document' in data and data['project_document'] in ['', 'null', 'undefined', None]:
                    data.pop('project_document', None)
                if 'project_images' in data and data['project_images'] in ['', 'null', 'undefined', None]:
                    data.pop('project_images', None)
        elif isinstance(data, dict):
            data = dict(data)
            if 'is_active' in data:
                val = str(data['is_active']).strip().lower()
                data['is_active'] = val in ['true', '1', 'yes', 't', 'si', 'activo']
            if self.instance:
                if data.get('project_document') in ['', 'null', 'undefined', None]:
                    data.pop('project_document', None)
                if data.get('project_images') in ['', 'null', 'undefined', None]:
                    data.pop('project_images', None)
        return super().to_internal_value(data)
