from rest_framework import serializers
from src.admissions.models import AdmissionMethod, UniversityProgram, AdmissionScore


class AdmissionMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionMethod
        fields = ['code', 'name', 'description']


class UniversityProgramListSerializer(serializers.ModelSerializer):
    university_code = serializers.CharField(source='university.code', read_only=True)
    university_name = serializers.CharField(source='university.name', read_only=True)
    major_code = serializers.CharField(source='major_catalog.code', read_only=True)
    major_name = serializers.CharField(source='major_catalog.name', read_only=True)

    class Meta:
        model = UniversityProgram
        fields = ['id', 'university_code', 'university_name', 'major_code', 'major_name', 'is_active']


class UniversityProgramDetailSerializer(serializers.ModelSerializer):
    from src.universities.serializers import UniversityDetailSerializer
    from src.academics.serializers import MajorCatalogDetailSerializer

    university = UniversityDetailSerializer(read_only=True)
    major_catalog = MajorCatalogDetailSerializer(read_only=True)

    class Meta:
        model = UniversityProgram
        fields = ['id', 'university', 'major_catalog', 'is_active']
        read_only_fields = ['id']


class UniversityProgramWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityProgram
        fields = ['university', 'major_catalog', 'is_active']


class AdmissionScoreListSerializer(serializers.ModelSerializer):
    university_name = serializers.CharField(
        source='university_program.university.name', read_only=True
    )
    university_code = serializers.CharField(
        source='university_program.university.code', read_only=True
    )
    major_code = serializers.CharField(
        source='university_program.major_catalog.code', read_only=True
    )
    admission_method_code = serializers.CharField(
        source='admission_method.code', read_only=True
    )

    class Meta:
        model = AdmissionScore
        fields = [
            'id', 'university_name', 'university_code', 'major_code',
            'year', 'score', 'admission_method_code',
        ]


class AdmissionScoreDetailSerializer(serializers.ModelSerializer):
    university_program = UniversityProgramListSerializer(read_only=True)
    admission_method = AdmissionMethodSerializer(read_only=True)

    class Meta:
        model = AdmissionScore
        fields = ['id', 'university_program', 'admission_method', 'year', 'score', 'note']
        read_only_fields = ['id']


class AdmissionScoreWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionScore
        fields = ['university_program', 'admission_method', 'year', 'score', 'note']

    def validate(self, data):
        year = data.get('year')
        if year < 2000 or year > 2100:
            raise serializers.ValidationError({'year': 'Năm phải nằm trong khoảng 2000-2100'})
        if data.get('score') < 0:
            raise serializers.ValidationError({'score': 'Điểm phải lớn hơn hoặc bằng 0'})
        return data


class AdmissionScoreBulkUpsertItemSerializer(serializers.Serializer):
    university_program = serializers.UUIDField()
    admission_method = serializers.CharField(max_length=20)
    year = serializers.IntegerField()
    score = serializers.DecimalField(max_digits=6, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class AdmissionScoreBulkUpsertRequestSerializer(serializers.Serializer):
    items = AdmissionScoreBulkUpsertItemSerializer(many=True)
