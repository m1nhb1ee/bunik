from rest_framework import serializers
from apps.universities.models import Province, University


class ProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ['id', 'name', 'region']


class UniversityListSerializer(serializers.ModelSerializer):
    province_name = serializers.CharField(source='province.name', read_only=True)

    class Meta:
        model = University
        fields = ['id', 'name', 'short_name', 'type', 'province_name', 'is_active']


class UniversityDetailSerializer(serializers.ModelSerializer):
    province = ProvinceSerializer(read_only=True)

    class Meta:
        model = University
        fields = [
            'id', 'name', 'short_name', 'type', 'province', 'is_active',
            'logo_url', 'address', 'website', 'description',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UniversityWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = [
            'name', 'short_name', 'type', 'province', 'is_active',
            'logo_url', 'address', 'website', 'description'
        ]
