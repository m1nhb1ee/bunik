# Generated migration for admissions app

from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.db.models import Q


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('universities', '0001_initial'),
        ('academics', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdmissionMethod',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=20, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'Phương thức tuyển sinh',
                'verbose_name_plural': 'Các phương thức tuyển sinh',
                'ordering': ['code'],
            },
        ),
        migrations.CreateModel(
            name='UniversityProgram',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('internal_code', models.CharField(blank=True, max_length=30, null=True)),
                ('internal_name', models.CharField(blank=True, max_length=255, null=True)),
                ('major_catalog', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='programs', to='academics.majorcatalog')),
                ('university', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='programs', to='universities.university')),
            ],
            options={
                'verbose_name': 'Chương trình đào tạo',
                'verbose_name_plural': 'Các chương trình đào tạo',
                'ordering': ['university__name', 'major_catalog__code'],
            },
        ),
        migrations.CreateModel(
            name='AdmissionScore',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('year', models.SmallIntegerField()),
                ('score', models.DecimalField(decimal_places=2, max_digits=6)),
                ('quota', models.IntegerField(blank=True, null=True)),
                ('note', models.TextField(blank=True, null=True)),
                ('admission_method', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='scores', to='admissions.admissionmethod')),
                ('university_program', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='admission_scores', to='admissions.universityprogram')),
            ],
            options={
                'verbose_name': 'Điểm trúng tuyển',
                'verbose_name_plural': 'Các điểm trúng tuyển',
                'ordering': ['-year', '-score'],
            },
        ),
        migrations.AddIndex(
            model_name='universityprogram',
            index=models.Index(fields=['major_catalog'], name='admissions_univers_major_idx'),
        ),
        migrations.AddIndex(
            model_name='universityprogram',
            index=models.Index(fields=['university', 'internal_code'], name='admissions_univers_univ_code_idx'),
        ),
        migrations.AddConstraint(
            model_name='universityprogram',
            constraint=models.UniqueConstraint(
                condition=Q(('internal_code__isnull', False)),
                fields=('university', 'internal_code'),
                name='uq_prog_with_internal_code'
            ),
        ),
        migrations.AddIndex(
            model_name='admissionscore',
            index=models.Index(fields=['-year'], name='admissions_admission_year_idx'),
        ),
        migrations.AddIndex(
            model_name='admissionscore',
            index=models.Index(fields=['university_program', '-year'], name='admissions_admission_prog_year_idx'),
        ),
        migrations.AddConstraint(
            model_name='admissionscore',
            constraint=models.UniqueConstraint(
                fields=('university_program', 'admission_method', 'year'),
                name='uq_score_program_method_year'
            ),
        ),
        migrations.RunSQL(
            sql="""
                CREATE UNIQUE INDEX uq_prog_no_internal_code
                ON admissions_universityprogram (university_id, major_catalog_id)
                WHERE internal_code IS NULL;
            """,
            reverse_sql="DROP INDEX IF EXISTS uq_prog_no_internal_code;",
        ),
    ]

