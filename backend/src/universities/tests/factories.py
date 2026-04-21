import factory
from factory.django import DjangoModelFactory
from apps.universities.models import Province, University


class ProvinceFactory(DjangoModelFactory):
    class Meta:
        model = Province

    name = factory.Sequence(lambda n: f"Province {n}")
    region = factory.Iterator(['Bắc', 'Trung', 'Nam'])


class UniversityFactory(DjangoModelFactory):
    class Meta:
        model = University

    name = factory.Sequence(lambda n: f"University {n}")
    short_name = factory.Sequence(lambda n: f"U{n}")
    type = factory.Iterator(['công_lập', 'dân_lập', 'quân_sự'])
    province = factory.SubFactory(ProvinceFactory)
    is_active = True
    logo_url = factory.Faker('url')
    address = factory.Faker('address')
    website = factory.Faker('url')
    description = factory.Faker('text')
