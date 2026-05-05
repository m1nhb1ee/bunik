from django.db import models


class Field(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=10, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'fields'
        ordering = ['code']

    def __str__(self):
        return self.code


class SubjectGroup(models.Model):
    code = models.CharField(max_length=10, primary_key=True)
    subject_1 = models.CharField(max_length=30)
    subject_2 = models.CharField(max_length=30)
    subject_3 = models.CharField(max_length=30)

    class Meta:
        managed = False
        db_table = 'subject_groups'
        ordering = ['code']

    def __str__(self):
        return f'{self.code}: {self.subject_1}, {self.subject_2}, {self.subject_3}'


class MajorCatalog(models.Model):
    code = models.CharField(max_length=20, primary_key=True)
    name = models.CharField(max_length=255)
    field = models.ForeignKey(
        Field,
        on_delete=models.PROTECT,
        to_field='code',
        db_column='field_code',
        related_name='majors',
    )
    description = models.TextField(null=True, blank=True)
    subject_groups = models.ManyToManyField(
        SubjectGroup,
        through='MajorSubjectGroup',
        related_name='majors',
    )

    class Meta:
        managed = False
        db_table = 'major_catalog'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} - {self.name}'


class MajorSubjectGroup(models.Model):
    major_catalog = models.ForeignKey(
        MajorCatalog,
        on_delete=models.CASCADE,
        db_column='major_code',
    )
    subject_group = models.ForeignKey(
        SubjectGroup,
        on_delete=models.CASCADE,
        db_column='subject_group_code',
    )

    class Meta:
        managed = False
        db_table = 'major_subject_groups'
        unique_together = [('major_catalog', 'subject_group')]

    def __str__(self):
        return f'{self.major_catalog_id} - {self.subject_group_id}'
