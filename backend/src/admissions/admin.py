from django.contrib import admin
from src.admissions.models import AdmissionMethod, UniversityProgram, AdmissionScore


@admin.register(AdmissionMethod)
class AdmissionMethodAdmin(admin.ModelAdmin):
    list_display = ['code', 'name']
    search_fields = ['code', 'name']
    ordering = ['code']


@admin.register(UniversityProgram)
class UniversityProgramAdmin(admin.ModelAdmin):
    list_display = ['university', 'major_catalog', 'internal_code', 'display_name']
    list_filter = ['university', 'major_catalog__field', 'university__province__region']
    search_fields = ['university__name', 'major_catalog__code', 'internal_code']
    readonly_fields = ['id', 'display_name']
    ordering = ['university__name', 'major_catalog__code']


@admin.register(AdmissionScore)
class AdmissionScoreAdmin(admin.ModelAdmin):
    list_display = ['university_program', 'admission_method', 'year', 'score', 'quota']
    list_filter = ['year', 'admission_method', 'university_program__university__province']
    search_fields = [
        'university_program__university__name',
        'university_program__major_catalog__name',
        'university_program__internal_code'
    ]
    readonly_fields = ['id']
    ordering = ['-year', '-score']
    fieldsets = (
        ('Chương trình & Phương thức', {
            'fields': ('university_program', 'admission_method')
        }),
        ('Thông tin tuyển sinh', {
            'fields': ('year', 'score', 'quota')
        }),
        ('Ghi chú', {
            'fields': ('note',)
        }),
    )

