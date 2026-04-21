import uuid
from django.db import models


class RegionChoices(models.TextChoices):
    NORTH = 'Bắc', 'Bắc'
    CENTRAL = 'Trung', 'Trung'
    SOUTH = 'Nam', 'Nam'


class Province(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    region = models.CharField(max_length=20, choices=RegionChoices.choices)

    class Meta:
        verbose_name = 'Tỉnh'
        verbose_name_plural = 'Tỉnh/Thành phố'
        ordering = ['name']

    def __str__(self):
        return self.name


class UniversityTypeChoices(models.TextChoices):
    PUBLIC = 'công_lập', 'Công lập'
    PRIVATE = 'dân_lập', 'Dân lập'
    MILITARY = 'quân_sự', 'Quân sự'


class University(models.Model):
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, unique=True, null=True, blank=True)
    type = models.CharField(max_length=20, choices=UniversityTypeChoices.choices)
    province = models.ForeignKey(Province, on_delete=models.PROTECT, related_name='universities')
    is_active = models.BooleanField(default=True)
    logo_url = models.CharField(max_length=500, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    website = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Trường đại học'
        verbose_name_plural = 'Các trường đại học'
        ordering = ['name']
        indexes = [
            models.Index(fields=['province']),
            models.Index(fields=['type']),
            models.Index(fields=['type', 'province']),
        ]

    def __str__(self):
        return self.name
