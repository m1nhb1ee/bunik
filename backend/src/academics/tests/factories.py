import factory
from factory.django import DjangoModelFactory
from src.academics.models import Field, SubjectGroup, MajorCatalog, MajorSubjectGroup


class FieldFactory(DjangoModelFactory):
    class Meta:
        model = Field

    code = factory.Sequence(lambda n: f"FLD{n:03d}")
    name = factory.Sequence(lambda n: f"Field {n}")


class SubjectGroupFactory(DjangoModelFactory):
    class Meta:
        model = SubjectGroup

    code = factory.Sequence(lambda n: f"SG{n:02d}")
    subjects = factory.Faker('text', max_nb_words=5)


class MajorCatalogFactory(DjangoModelFactory):
    class Meta:
        model = MajorCatalog

    code = factory.Sequence(lambda n: f"MAJ{n:04d}")
    name = factory.Sequence(lambda n: f"Major {n}")
    field = factory.SubFactory(FieldFactory)
    description = factory.Faker('text')


class MajorSubjectGroupFactory(DjangoModelFactory):
    class Meta:
        model = MajorSubjectGroup

    major_catalog = factory.SubFactory(MajorCatalogFactory)
    subject_group = factory.SubFactory(SubjectGroupFactory)

