# Generated migration for universities app

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Province',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100, unique=True)),
                ('region', models.CharField(choices=[('Bắc', 'Bắc'), ('Trung', 'Trung'), ('Nam', 'Nam')], max_length=20)),
            ],
            options={
                'verbose_name': 'Tỉnh',
                'verbose_name_plural': 'Tỉnh/Thành phố',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='University',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('short_name', models.CharField(blank=True, max_length=50, null=True, unique=True)),
                ('type', models.CharField(choices=[('công_lập', 'Công lập'), ('dân_lập', 'Dân lập'), ('quân_sự', 'Quân sự')], max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('logo_url', models.CharField(blank=True, max_length=500, null=True)),
                ('address', models.TextField(blank=True, null=True)),
                ('website', models.CharField(blank=True, max_length=255, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('province', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='universities', to='universities.province')),
            ],
            options={
                'verbose_name': 'Trường đại học',
                'verbose_name_plural': 'Các trường đại học',
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='university',
            index=models.Index(fields=['province'], name='universities_universit_province_idx'),
        ),
        migrations.AddIndex(
            model_name='university',
            index=models.Index(fields=['type'], name='universities_universit_type_idx'),
        ),
        migrations.AddIndex(
            model_name='university',
            index=models.Index(fields=['type', 'province'], name='universities_universit_type_prov_idx'),
        ),
    ]
