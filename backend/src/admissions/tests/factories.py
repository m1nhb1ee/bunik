import factory
from factory.django import DjangoModelFactory
from apps.admissions.models import AdmissionMethod, UniversityProgram, AdmissionScore
from apps.universities.tests.factories import UniversityFactory
from apps.academics.tests.factories import MajorCatalogFactory


class AdmissionMethodFactory(DjangoModelFactory):
    class Meta:
        model = AdmissionMethod

    code = factory.Sequence(lambda n: f"MTHD{n:02d}")
    name = factory.Sequence(lambda n: f"Admission Method {n}")
    description = factory.Faker('text')


class UniversityProgramFactory(DjangoModelFactory):
    class Meta:
        model = UniversityProgram

    university = factory.SubFactory(UniversityFactory)
    major_catalog = factory.SubFactory(MajorCatalogFactory)
    internal_code = factory.Sequence(lambda n: f"PROG{n:03d}")
    internal_name = factory.Sequence(lambda n: f"Program {n}")


class AdmissionScoreFactory(DjangoModelFactory):
    class Meta:
        model = AdmissionScore

    university_program = factory.SubFactory(UniversityProgramFactory)
    admission_method = factory.SubFactory(AdmissionMethodFactory)
    year = factory.Faker('year', start_datetime=None, end_datetime=None)
    score = factory.Faker('pydecimal', left_digits=2, right_digits=2, positive=True)
    quota = factory.Faker('pyint', min_value=1, max_value=100)
    note = factory.Faker('text')
