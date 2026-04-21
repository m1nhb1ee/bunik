import django_filters
from django.db.models import Q
from apps.admissions.models import AdmissionScore, UniversityProgram
from apps.universities.models import University


class AdmissionScoreFilterSet(django_filters.FilterSet):
    year_min = django_filters.NumberFilter(field_name='year', lookup_expr='gte')
    year_max = django_filters.NumberFilter(field_name='year', lookup_expr='lte')
    score_min = django_filters.NumberFilter(field_name='score', lookup_expr='gte')
    score_max = django_filters.NumberFilter(field_name='score', lookup_expr='lte')
    university_short_name = django_filters.CharFilter(
        field_name='university_program__university__short_name',
        lookup_expr='icontains'
    )
    major_code = django_filters.CharFilter(
        field_name='university_program__major_catalog__code',
        lookup_expr='icontains'
    )
    region = django_filters.CharFilter(
        field_name='university_program__university__province__region',
        lookup_expr='exact'
    )

    class Meta:
        model = AdmissionScore
        fields = [
            'university_program__university',
            'university_program__major_catalog',
            'admission_method',
            'year',
            'year_min',
            'year_max',
            'score_min',
            'score_max',
            'university_short_name',
            'major_code',
            'region'
        ]
