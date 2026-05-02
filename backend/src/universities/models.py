import uuid

from django.db import models


class RegionChoices(models.TextChoices):
    NORTH = 'B\u00e1\u00ba\u00afc', 'B\u00e1\u00ba\u00afc'
    CENTRAL = 'Trung', 'Trung'
    SOUTH = 'Nam', 'Nam'


class Province(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    region = models.CharField(max_length=20, choices=RegionChoices.choices)

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['region'])]

    def __str__(self):
        return self.name


class UniversityTypeChoices(models.TextChoices):
    PUBLIC = 'c\u00c3\u00b4ng_l\u00e1\u00ba\u00adp', 'C\u00c3\u00b4ng l\u00e1\u00ba\u00adp'
    PRIVATE = 'd\u00c3\u00a2n_l\u00e1\u00ba\u00adp', 'D\u00c3\u00a2n l\u00e1\u00ba\u00adp'
    MILITARY = 'qu\u00c3\u00a2n_s\u00e1\u00bb\u00b1', 'Qu\u00c3\u00a2n s\u00e1\u00bb\u00b1'


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
        ordering = ['name']
        indexes = [
            models.Index(fields=['province']),
            models.Index(fields=['type']),
            models.Index(fields=['type', 'province']),
            models.Index(fields=['is_active']),
            models.Index(fields=['is_active', 'type', 'province']),
        ]

    def __str__(self):
        return self.name
