from rest_framework import serializers
from apps.academics.models import Field, SubjectGroup, MajorCatalog, MajorSubjectGroup


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
        major = MajorCatalog.objects.create(**validated_data)
        
        for subject_group in subject_groups:
            MajorSubjectGroup.objects.create(
                major_catalog=major,
                subject_group=subject_group
            )
        
        return major

    def update(self, instance, validated_data):
        subject_groups = validated_data.pop('subject_group_ids', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if subject_groups is not None:
            instance.subject_groups.all().delete()
            for subject_group in subject_groups:
                MajorSubjectGroup.objects.create(
                    major_catalog=instance,
                    subject_group=subject_group
                )
        
        return instance
