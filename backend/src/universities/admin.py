from django.contrib import admin
from apps.universities.models import Province, University


@admin.register(Province)
class ProvinceAdmin(admin.ModelAdmin):
    list_display = ['name', 'region']
    list_filter = ['region']
    search_fields = ['name']


@admin.register(University)
class UniversityAdmin(admin.ModelAdmin):
    list_display = ['name', 'short_name', 'type', 'province', 'is_active']
    list_filter = ['type', 'province__region', 'is_active']
    search_fields = ['name', 'short_name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Thông tin cơ bản', {
            'fields': ('name', 'short_name', 'type', 'province', 'is_active')
        }),
        ('Chi tiết', {
            'fields': ('logo_url', 'address', 'website', 'description')
        }),
        ('Thời gian', {
            'fields': ('created_at', 'updated_at')
        }),
    )
