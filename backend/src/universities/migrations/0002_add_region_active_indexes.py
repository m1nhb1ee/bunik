from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('universities', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='province',
            index=models.Index(fields=['region'], name='univ_province_region_idx'),
        ),
        migrations.AddIndex(
            model_name='university',
            index=models.Index(fields=['is_active'], name='univ_active_idx'),
        ),
        migrations.AddIndex(
            model_name='university',
            index=models.Index(
                fields=['is_active', 'type', 'province'],
                name='univ_active_type_prov_idx',
            ),
        ),
    ]
