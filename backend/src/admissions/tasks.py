import logging

from django.db import transaction

from src.admissions.models import AdmissionScore


logger = logging.getLogger('audit')


def bulk_upsert_admission_scores(items):
    created = 0
    updated = 0

    with transaction.atomic():
        for item in items:
            lookup = {
                'university_program_id': item['university_program'],
                'admission_method_id': item['admission_method'],  # code string
                'year': item['year'],
            }
            defaults = {
                'score': item['score'],
                'note': item.get('note'),
            }
            _, was_created = AdmissionScore.objects.update_or_create(
                **lookup,
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                updated += 1

    logger.info(
        'action=bulk_upsert resource=admission_score created=%s updated=%s',
        created,
        updated,
    )
    return {'created': created, 'updated': updated, 'total': len(items)}
