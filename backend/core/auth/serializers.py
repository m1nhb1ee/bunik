import re
from datetime import date

from rest_framework import serializers

SPECIAL_SUBJECT_CHOICES = [
    'toan', 'ly', 'hoa', 'sinh', 'tin', 'ngoai_ngu', 'van', 'su', 'dia',
]
PRIZE_CANONICAL = {'Khuyen Khich': 'Khuyến Khích', 'Ba': 'Ba', 'Nhi': 'Nhì', 'Nhat': 'Nhất'}
PRIZE_ACCEPTED = {
    'Khuyen Khich', 'Ba', 'Nhi', 'Nhat',
    'Khuyến Khích', 'Nhì', 'Nhất',
}


class RegisterSerializer(serializers.Serializer):
    user_name = serializers.CharField(min_length=3, max_length=30)
    full_name = serializers.CharField()
    grade = serializers.IntegerField(min_value=10, max_value=12)
    dob = serializers.DateField()
    gender = serializers.ChoiceField(choices=['MALE', 'FEMALE'])
    gmail = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_user_name(self, value):
        if not re.fullmatch(r'^\w+$', value):
            raise serializers.ValidationError('user_name must contain only alphanumeric characters and underscore.')
        return value

    def validate_full_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('full_name is required.')
        return value.strip()

    def validate_dob(self, value):
        if value >= date.today():
            raise serializers.ValidationError('dob must be in the past.')
        return value


class LoginSerializer(serializers.Serializer):
    gmail = serializers.EmailField()
    password = serializers.CharField()


class UserProfileSerializer(serializers.Serializer):
    id = serializers.CharField()
    user_name = serializers.CharField()
    full_name = serializers.CharField()
    grade = serializers.IntegerField()
    dob = serializers.DateField()
    gender = serializers.CharField()
    gmail = serializers.EmailField()
    math = serializers.FloatField(required=False)
    literature = serializers.FloatField(required=False)
    english = serializers.FloatField(required=False)
    physics = serializers.FloatField(required=False)
    chemistry = serializers.FloatField(required=False)
    biology = serializers.FloatField(required=False)
    history = serializers.FloatField(required=False)
    geography = serializers.FloatField(required=False)
    is_special = serializers.BooleanField(required=False)
    special_subject = serializers.ChoiceField(required=False, choices=SPECIAL_SUBJECT_CHOICES)
    special_score = serializers.FloatField(required=False)
    base_score = serializers.FloatField(required=False)


class ProfileUpdateSerializer(serializers.Serializer):
    user_name = serializers.CharField(required=False, min_length=3, max_length=30)
    full_name = serializers.CharField(required=False)
    grade = serializers.IntegerField(required=False, min_value=1, max_value=12)
    dob = serializers.DateField(required=False)
    gender = serializers.ChoiceField(required=False, choices=['MALE', 'FEMALE'])
    math = serializers.FloatField(required=False, min_value=0, max_value=10)
    literature = serializers.FloatField(required=False, min_value=0, max_value=10)
    english = serializers.FloatField(required=False, min_value=0, max_value=10)
    physics = serializers.FloatField(required=False, min_value=0, max_value=10)
    chemistry = serializers.FloatField(required=False, min_value=0, max_value=10)
    biology = serializers.FloatField(required=False, min_value=0, max_value=10)
    history = serializers.FloatField(required=False, min_value=0, max_value=10)
    geography = serializers.FloatField(required=False, min_value=0, max_value=10)
    is_special = serializers.BooleanField(required=False)
    special_subject = serializers.ChoiceField(required=False, choices=SPECIAL_SUBJECT_CHOICES)
    special_score = serializers.FloatField(required=False, min_value=0, max_value=10)
    base_score = serializers.FloatField(required=False, min_value=0)

    def validate_user_name(self, value):
        if not re.fullmatch(r'^\w+$', value):
            raise serializers.ValidationError('user_name must contain only alphanumeric characters and underscore.')
        return value

    def validate_full_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('full_name is required.')
        return value.strip()

    def validate_dob(self, value):
        if value >= date.today():
            raise serializers.ValidationError('dob must be in the past.')
        return value


class AwardSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    level = serializers.CharField()


class AchievementSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    user_id = serializers.CharField()
    award_id = serializers.IntegerField()
    name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    prize = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    date = serializers.DateField(required=False)
    is_verified = serializers.BooleanField(required=False)
    awards = AwardSerializer(required=False)


class AchievementCreateSerializer(serializers.Serializer):
    award_id = serializers.IntegerField()
    prize = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    date = serializers.DateField(required=False)

    def validate_prize(self, value):
        if value in (None, ''):
            return None
        if value not in PRIZE_ACCEPTED:
            raise serializers.ValidationError('prize is invalid.')
        return PRIZE_CANONICAL.get(value, value)


class CertificateSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    user_id = serializers.CharField()
    name = serializers.CharField()
    score = serializers.FloatField(required=False, allow_null=True)
    date = serializers.DateField(required=False, allow_null=True)
    is_verified = serializers.BooleanField(required=False, allow_null=True)


class CertificateCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    score = serializers.FloatField(required=False, allow_null=True, min_value=0)
    date = serializers.DateField(required=False, allow_null=True)
