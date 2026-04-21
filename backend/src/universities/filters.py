import django_filters
from apps.universities.models import Province, University


class UniversityFilterSet(django_filters.FilterSet):
    class Meta:
        model = University
        fields = ['type', 'province', 'is_active']
