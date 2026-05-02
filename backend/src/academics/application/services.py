from django.db import transaction

from src.academics.models import MajorCatalog, MajorSubjectGroup


def _sync_major_subject_groups(major: MajorCatalog, subject_groups):
    target_ids = {subject_group.id for subject_group in subject_groups}
    existing_ids = set(
        MajorSubjectGroup.objects.filter(major_catalog=major).values_list('subject_group_id', flat=True)
    )

    to_remove = existing_ids - target_ids
    to_add = target_ids - existing_ids

    if to_remove:
        MajorSubjectGroup.objects.filter(
            major_catalog=major,
            subject_group_id__in=to_remove,
        ).delete()

    if to_add:
        MajorSubjectGroup.objects.bulk_create(
            [
                MajorSubjectGroup(major_catalog=major, subject_group_id=subject_group_id)
                for subject_group_id in to_add
            ],
            ignore_conflicts=True,
        )


@transaction.atomic
def create_major(validated_data, subject_groups):
    major = MajorCatalog.objects.create(**validated_data)
    _sync_major_subject_groups(major, subject_groups)
    return major


@transaction.atomic
def update_major(instance: MajorCatalog, validated_data, subject_groups=None):
    for attr, value in validated_data.items():
        setattr(instance, attr, value)
    instance.save()

    if subject_groups is not None:
        _sync_major_subject_groups(instance, subject_groups)

    return instance
