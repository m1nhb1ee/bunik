from django.db import models


class Field(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=150)

    class Meta:
        verbose_name = 'Ngành học'
        verbose_name_plural = 'Các ngành học'
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"


class SubjectGroup(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=10, unique=True)
    subjects = models.CharField(max_length=255)

    class Meta:
        verbose_name = 'Nhóm môn'
        verbose_name_plural = 'Các nhóm môn'
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.subjects}"


class MajorCatalog(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255)
    field = models.ForeignKey(Field, on_delete=models.PROTECT, related_name='majors')
    description = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = 'Chuyên ngành'
        verbose_name_plural = 'Các chuyên ngành'
        ordering = ['code']
        indexes = [
            models.Index(fields=['field']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class MajorSubjectGroup(models.Model):
    major_catalog = models.ForeignKey(
        MajorCatalog,
        on_delete=models.CASCADE,
        related_name='subject_groups'
    )
    subject_group = models.ForeignKey(
        SubjectGroup,
        on_delete=models.CASCADE,
        related_name='major_catalogs'
    )

    class Meta:
        verbose_name = 'Chuyên ngành - Nhóm môn'
        verbose_name_plural = 'Chuyên ngành - Nhóm môn'
        unique_together = [('major_catalog', 'subject_group')]

    def __str__(self):
        return f"{self.major_catalog.code} - {self.subject_group.code}"
