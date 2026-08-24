from rest_framework import serializers
from apps.project.models import Project


class ProjectSerializer(serializers.ModelSerializer):
    """Serializador para el modelo Project."""

    class Meta:
        model = Project
        fields = ['id', 'project_name', 'description', 'project_document', 'project_images', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
