from datetime import date

from rest_framework import serializers


class BulkAdmissionScoreItemSerializer(serializers.Serializer):
    university_program_id = serializers.UUIDField()
    admission_method_code = serializers.CharField(max_length=20)
    year = serializers.IntegerField(min_value=2000, max_value=date.today().year + 1)
    variant_key = serializers.CharField(max_length=100)
    score = serializers.FloatField(min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    source_program_code = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=100)
    variant_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    gender = serializers.ChoiceField(required=False, allow_null=True, choices=('nam', 'nu', 'all'))
    region_code = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    subject_group_code = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    normalized_score = serializers.FloatField(required=False, allow_null=True, min_value=0)
    normalized_scale = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    def validate(self, attrs):
        normalized_score = attrs.get('normalized_score')
        normalized_scale = attrs.get('normalized_scale')
        if normalized_score is not None and normalized_scale is None:
            raise serializers.ValidationError({'normalized_scale': 'Required when normalized_score is provided.'})
        if normalized_score is not None and normalized_score > normalized_scale:
            raise serializers.ValidationError({'normalized_score': 'Must not exceed normalized_scale.'})
        return attrs
