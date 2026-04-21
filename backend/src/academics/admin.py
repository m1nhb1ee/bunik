from django.contrib import admin
from apps.academics.models import Field, SubjectGroup, MajorCatalog, MajorSubjectGroup


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ['code', 'name']
    search_fields = ['code', 'name']
    ordering = ['code']


@admin.register(SubjectGroup)
class SubjectGroupAdmin(admin.ModelAdmin):
    list_display = ['code', 'subjects']
    search_fields = ['code', 'subjects']
    ordering = ['code']


class MajorSubjectGroupInline(admin.TabularInline):
    model = MajorSubjectGroup
    extra = 1


@admin.register(MajorCatalog)
class MajorCatalogAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'field']
    list_filter = ['field']
    search_fields = ['code', 'name']
    inlines = [MajorSubjectGroupInline]
    readonly_fields = []
    ordering = ['code']
