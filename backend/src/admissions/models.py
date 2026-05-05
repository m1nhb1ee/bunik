import uuid
from django.db import models


class AdmissionMethod(models.Model):
    code = models.CharField(max_length=20, primary_key=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'admission_methods'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.name}'


class UniversityProgram(models.Model):
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)
    university = models.ForeignKey(
        'universities.University',
        on_delete=models.CASCADE,
        to_field='code',
        db_column='university_short_name',
        related_name='programs',
    )
    major_catalog = models.ForeignKey(
        'academics.MajorCatalog',
        on_delete=models.PROTECT,
        db_column='major_code',
        related_name='programs',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'university_programs'
        ordering = ['university__name', 'major_catalog__code']

    def __str__(self):
        return f'{self.university_id} - {self.major_catalog_id}'


class AdmissionScore(models.Model):
    id = models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)
    university_program = models.ForeignKey(
        UniversityProgram,
        on_delete=models.CASCADE,
        related_name='admission_scores',
    )
    admission_method = models.ForeignKey(
        AdmissionMethod,
        on_delete=models.PROTECT,
        db_column='admission_method_code',
        related_name='scores',
    )
    year = models.SmallIntegerField()
    score = models.DecimalField(max_digits=6, decimal_places=2)
    note = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'admission_scores'
        ordering = ['-year', '-score']
        constraints = [
            models.UniqueConstraint(
                fields=['university_program', 'admission_method', 'year'],
                name='uq_score_program_method_year',
            ),
        ]

    def __str__(self):
        return f'{self.university_program_id} - {self.admission_method_id} - {self.year}: {self.score}'
