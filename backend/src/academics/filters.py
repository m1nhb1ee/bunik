import django_filters
from src.academics.models import MajorCatalog, Field


class MajorCatalogFilterSet(django_filters.FilterSet):
    class Meta:
        model = MajorCatalog
        fields = ['field']

