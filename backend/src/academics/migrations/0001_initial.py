# Generated migration for academics app

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Field',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=10, unique=True)),
                ('name', models.CharField(max_length=150)),
            ],
            options={
                'verbose_name': 'Ngành học',
                'verbose_name_plural': 'Các ngành học',
                'ordering': ['code'],
            },
        ),
        migrations.CreateModel(
            name='SubjectGroup',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=10, unique=True)),
                ('subjects', models.CharField(max_length=255)),
            ],
            options={
                'verbose_name': 'Nhóm môn',
                'verbose_name_plural': 'Các nhóm môn',
                'ordering': ['code'],
            },
        ),
        migrations.CreateModel(
            name='MajorCatalog',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=20, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('field', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='majors', to='academics.field')),
            ],
            options={
                'verbose_name': 'Chuyên ngành',
                'verbose_name_plural': 'Các chuyên ngành',
                'ordering': ['code'],
            },
        ),
        migrations.CreateModel(
            name='MajorSubjectGroup',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('major_catalog', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subject_groups', to='academics.majorcatalog')),
                ('subject_group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='major_catalogs', to='academics.subjectgroup')),
            ],
            options={
                'verbose_name': 'Chuyên ngành - Nhóm môn',
                'verbose_name_plural': 'Chuyên ngành - Nhóm môn',
            },
        ),
        migrations.AddIndex(
            model_name='majorcatalog',
            index=models.Index(fields=['field'], name='academics_majorca_field_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='majorsubjectgroup',
            unique_together={('major_catalog', 'subject_group')},
        ),
    ]

