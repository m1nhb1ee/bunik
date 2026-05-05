from rest_framework import serializers
from src.academics.application.services import create_major, update_major
from src.academics.models import Field, SubjectGroup, MajorCatalog


class FieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = Field
        fields = ['id', 'code', 'description']


class SubjectGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectGroup
        fields = ['code', 'subject_1', 'subject_2', 'subject_3']


class MajorCatalogListSerializer(serializers.ModelSerializer):
    field_code = serializers.CharField(source='field.code', read_only=True)

    class Meta:
        model = MajorCatalog
        fields = ['code', 'name', 'field_code']


class MajorCatalogDetailSerializer(serializers.ModelSerializer):
    field = FieldSerializer(read_only=True)
    subject_groups = SubjectGroupSerializer(many=True, read_only=True)

    class Meta:
        model = MajorCatalog
        fields = ['code', 'name', 'field', 'description', 'subject_groups']
        read_only_fields = ['code']


class MajorCatalogWriteSerializer(serializers.ModelSerializer):
    subject_group_codes = serializers.PrimaryKeyRelatedField(
        queryset=SubjectGroup.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source='subject_group_ids',
    )

    class Meta:
        model = MajorCatalog
        fields = ['code', 'name', 'field', 'description', 'subject_group_codes']

    def create(self, validated_data):
        subject_groups = validated_data.pop('subject_group_ids', [])
        return create_major(validated_data=validated_data, subject_groups=subject_groups)

    def update(self, instance, validated_data):
        subject_groups = validated_data.pop('subject_group_ids', None)
        return update_major(instance=instance, validated_data=validated_data, subject_groups=subject_groups)
