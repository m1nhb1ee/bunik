from rest_framework import serializers
from src.academics.application.services import create_major, update_major
from src.academics.models import Field, SubjectGroup, MajorCatalog


class FieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = Field
        fields = ['id', 'code', 'name']


class SubjectGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectGroup
        fields = ['id', 'code', 'subjects']


class MajorCatalogListSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = MajorCatalog
        fields = ['id', 'code', 'name', 'field_name']


class MajorCatalogDetailSerializer(serializers.ModelSerializer):
    field = FieldSerializer(read_only=True)
    subject_groups = SubjectGroupSerializer(many=True, read_only=True)

    class Meta:
        model = MajorCatalog
        fields = ['id', 'code', 'name', 'field', 'description', 'subject_groups']
        read_only_fields = ['id']


class MajorCatalogWriteSerializer(serializers.ModelSerializer):
    subject_group_ids = serializers.PrimaryKeyRelatedField(
        queryset=SubjectGroup.objects.all(),
        many=True,
        write_only=True,
        required=False
    )

    class Meta:
        model = MajorCatalog
        fields = ['code', 'name', 'field', 'description', 'subject_group_ids']

    def create(self, validated_data):
        subject_groups = validated_data.pop('subject_group_ids', [])
        return create_major(validated_data=validated_data, subject_groups=subject_groups)

    def update(self, instance, validated_data):
        subject_groups = validated_data.pop('subject_group_ids', None)
        return update_major(instance=instance, validated_data=validated_data, subject_groups=subject_groups)

