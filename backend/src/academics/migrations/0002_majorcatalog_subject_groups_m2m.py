from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('academics', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='majorsubjectgroup',
            name='major_catalog',
            field=models.ForeignKey(
                on_delete=models.CASCADE,
                related_name='major_subject_groups',
                to='academics.majorcatalog',
            ),
        ),
        migrations.AlterField(
            model_name='majorsubjectgroup',
            name='subject_group',
            field=models.ForeignKey(
                on_delete=models.CASCADE,
                related_name='major_subject_groups',
                to='academics.subjectgroup',
            ),
        ),
        migrations.AddField(
            model_name='majorcatalog',
            name='subject_groups',
            field=models.ManyToManyField(
                related_name='majors',
                through='academics.MajorSubjectGroup',
                to='academics.subjectgroup',
            ),
        ),
    ]
