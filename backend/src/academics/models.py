from django.db import models


class Field(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=150)

    class Meta:
        verbose_name = 'NgÃ nh há»c'
        verbose_name_plural = 'CÃ¡c ngÃ nh há»c'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.name}'


class SubjectGroup(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=10, unique=True)
    subjects = models.CharField(max_length=255)

    class Meta:
        verbose_name = 'NhÃ³m mÃ´n'
        verbose_name_plural = 'CÃ¡c nhÃ³m mÃ´n'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.subjects}'


class MajorCatalog(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255)
    field = models.ForeignKey(Field, on_delete=models.PROTECT, related_name='majors')
    description = models.TextField(null=True, blank=True)
    subject_groups = models.ManyToManyField(
        SubjectGroup,
        through='MajorSubjectGroup',
        related_name='majors',
    )

    class Meta:
        verbose_name = 'ChuyÃªn ngÃ nh'
        verbose_name_plural = 'CÃ¡c chuyÃªn ngÃ nh'
        ordering = ['code']
        indexes = [
            models.Index(fields=['field'], name='academics_majorca_field_idx'),
        ]

    def __str__(self):
        return f'{self.code} - {self.name}'


class MajorSubjectGroup(models.Model):
    id = models.AutoField(primary_key=True)
    major_catalog = models.ForeignKey(
        MajorCatalog,
        on_delete=models.CASCADE,
        related_name='major_subject_groups',
    )
    subject_group = models.ForeignKey(
        SubjectGroup,
        on_delete=models.CASCADE,
        related_name='major_subject_groups',
    )

    class Meta:
        verbose_name = 'ChuyÃªn ngÃ nh - NhÃ³m mÃ´n'
        verbose_name_plural = 'ChuyÃªn ngÃ nh - NhÃ³m mÃ´n'
        unique_together = [('major_catalog', 'subject_group')]

    def __str__(self):
        return f'{self.major_catalog.code} - {self.subject_group.code}'
