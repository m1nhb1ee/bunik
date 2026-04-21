from rest_framework import serializers
from apps.admissions.models import AdmissionMethod, UniversityProgram, AdmissionScore
from apps.universities.models import University
from apps.academics.models import MajorCatalog


class AdmissionMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionMethod
        fields = ['id', 'code', 'name', 'description']


class UniversityProgramListSerializer(serializers.ModelSerializer):
    university_short_name = serializers.CharField(source='university.short_name', read_only=True)
    major_code = serializers.CharField(source='major_catalog.code', read_only=True)
    major_name = serializers.CharField(source='major_catalog.name', read_only=True)
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = UniversityProgram
        fields = [
            'id', 'university_short_name', 'major_code', 'major_name',
            'internal_code', 'display_name'
        ]


class UniversityProgramDetailSerializer(serializers.ModelSerializer):
    from apps.universities.serializers import UniversityDetailSerializer
    from apps.academics.serializers import MajorCatalogDetailSerializer
    
    university = UniversityDetailSerializer(read_only=True)
    major_catalog = MajorCatalogDetailSerializer(read_only=True)
    admission_scores = serializers.SerializerMethodField()
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = UniversityProgram
        fields = [
            'id', 'university', 'major_catalog', 'internal_code',
            'internal_name', 'display_name', 'admission_scores'
        ]
        read_only_fields = ['id']

    def get_admission_scores(self, obj):
        scores = obj.admission_scores.all().select_related('admission_method')
        return AdmissionScoreListSerializer(scores, many=True).data


class UniversityProgramWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityProgram
        fields = ['university', 'major_catalog', 'internal_code', 'internal_name']


class AdmissionScoreListSerializer(serializers.ModelSerializer):
    university_name = serializers.CharField(
        source='university_program.university.name',
        read_only=True
    )
    major_code = serializers.CharField(
        source='university_program.major_catalog.code',
        read_only=True
    )
    internal_code = serializers.CharField(
        source='university_program.internal_code',
        read_only=True
    )
    admission_method_code = serializers.CharField(
        source='admission_method.code',
        read_only=True
    )

    class Meta:
        model = AdmissionScore
        fields = [
            'id', 'university_name', 'major_code', 'internal_code',
            'year', 'score', 'quota', 'admission_method_code'
        ]


class AdmissionScoreDetailSerializer(serializers.ModelSerializer):
    university_program = UniversityProgramDetailSerializer(read_only=True)
    admission_method = AdmissionMethodSerializer(read_only=True)

    class Meta:
        model = AdmissionScore
        fields = [
            'id', 'university_program', 'admission_method', 'year',
            'score', 'quota', 'note'
        ]
        read_only_fields = ['id']


class AdmissionScoreWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionScore
        fields = ['university_program', 'admission_method', 'year', 'score', 'quota', 'note']

    def validate(self, data):
        year = data.get('year')
        if year < 2000 or year > 2100:
            raise serializers.ValidationError(
                {'year': 'Năm phải nằm trong khoảng 2000-2100'}
            )
        
        score = data.get('score')
        if score < 0:
            raise serializers.ValidationError(
                {'score': 'Điểm phải lớn hơn hoặc bằng 0'}
            )
        
        quota = data.get('quota')
        if quota is not None and quota <= 0:
            raise serializers.ValidationError(
                {'quota': 'Chỉ tiêu phải lớn hơn 0'}
            )
        
        return data
