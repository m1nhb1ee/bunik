import uuid
from django.db import models
from django.db.models import Q


class AdmissionMethod(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = 'Phương thức tuyển sinh'
        verbose_name_plural = 'Các phương thức tuyển sinh'
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"


class UniversityProgram(models.Model):
    from apps.universities.models import University
    from apps.academics.models import MajorCatalog

    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name='programs')
    major_catalog = models.ForeignKey(MajorCatalog, on_delete=models.PROTECT, related_name='programs')
    internal_code = models.CharField(max_length=30, null=True, blank=True)
    internal_name = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        verbose_name = 'Chương trình đào tạo'
        verbose_name_plural = 'Các chương trình đào tạo'
        ordering = ['university__name', 'major_catalog__code']
        indexes = [
            models.Index(fields=['major_catalog']),
            models.Index(fields=['university', 'internal_code']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['university', 'internal_code'],
                condition=Q(internal_code__isnull=False),
                name='uq_prog_with_internal_code'
            ),
        ]

    @property
    def display_name(self):
        if self.internal_name:
            return self.internal_name
        return self.major_catalog.name

    def __str__(self):
        return f"{self.university.short_name or self.university.name} - {self.major_catalog.code}"


class AdmissionScore(models.Model):
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)
    university_program = models.ForeignKey(
        UniversityProgram,
        on_delete=models.CASCADE,
        related_name='admission_scores'
    )
    admission_method = models.ForeignKey(
        AdmissionMethod,
        on_delete=models.PROTECT,
        related_name='scores'
    )
    year = models.SmallIntegerField()
    score = models.DecimalField(max_digits=6, decimal_places=2)
    quota = models.IntegerField(null=True, blank=True)
    note = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = 'Điểm trúng tuyển'
        verbose_name_plural = 'Các điểm trúng tuyển'
        ordering = ['-year', '-score']
        indexes = [
            models.Index(fields=['-year']),
            models.Index(fields=['university_program', '-year']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['university_program', 'admission_method', 'year'],
                name='uq_score_program_method_year'
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.year < 2000 or self.year > 2100:
            raise ValidationError({'year': 'Năm phải nằm trong khoảng 2000-2100'})
        if self.score < 0:
            raise ValidationError({'score': 'Điểm phải lớn hơn hoặc bằng 0'})
        if self.quota is not None and self.quota <= 0:
            raise ValidationError({'quota': 'Chỉ tiêu phải lớn hơn 0'})

    def __str__(self):
        return f"{self.university_program} - {self.admission_method.code} - {self.year}: {self.score}"
