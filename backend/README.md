# Bunik API v4.1 — Vietnamese University Admission Score Database

A production-ready Django REST API for managing Vietnamese university admission scores, programs, and academic fields.

## Features

- **RESTful API** with comprehensive filtering, searching, and pagination
- **JWT Authentication** via `djangorestframework-simplejwt`
- **PostgreSQL** database with optimized indexes and constraints
- **Swagger UI** documentation at `/api/docs/`
- **Admin Panel** for data management
- **Docker Compose** for easy local development and deployment
- **Comprehensive Tests** with pytest and factory-boy
- **Performance Optimized** with select_related and prefetch_related

## Technology Stack

- **Django** 5.0.x
- **Django REST Framework** 3.15.x
- **PostgreSQL** 16
- **Python** 3.12
- **Docker** & Docker Compose
- **pytest** for testing

## Project Structure

```
bunik/
├── config/                    # Django configuration
│   ├── settings/
│   │   ├── base.py           # Base settings
│   │   └── local.py          # Local development settings
│   ├── urls.py               # Main URL router
│   └── wsgi.py               # WSGI application
├── apps/
│   ├── universities/         # Province & University models
│   ├── academics/            # Fields & Major Catalog models
│   └── admissions/           # University Programs & Admission Scores models
├── requirements/
│   ├── base.txt              # Production dependencies
│   └── dev.txt               # Development dependencies
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile                # Docker image definition
├── manage.py                 # Django management script
├── pytest.ini                # pytest configuration
└── conftest.py               # pytest fixtures
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Python 3.12+ (for local development without Docker)
- PostgreSQL 16 (or use Docker)

### Installation

#### Option 1: Using Docker Compose (Recommended)

1. Clone the repository:
```bash
cd bunik
```

2. Create `.env` from `.env.example`:
```bash
cp .env.example .env
```

3. Build and start containers:
```bash
docker-compose up --build
```

4. Run migrations:
```bash
docker-compose exec web python manage.py migrate
```

5. Create a superuser:
```bash
docker-compose exec web python manage.py createsuperuser
```

6. Access the API:
- API: http://localhost:8000/api/
- Swagger UI: http://localhost:8000/api/docs/
- Admin Panel: http://localhost:8000/admin/

#### Option 2: Local Development

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements/dev.txt
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with your local database credentials

5. Run migrations:
```bash
python manage.py migrate
```

6. Create superuser:
```bash
python manage.py createsuperuser
```

7. Start development server:
```bash
python manage.py runserver
```

## API Endpoints

### Authentication
- `POST /api/auth/token/` - Obtain JWT token (username + password)
- `POST /api/auth/token/refresh/` - Refresh access token

### Provinces & Universities
- `GET /api/provinces/` - List all provinces
- `GET /api/provinces/{id}/` - Retrieve province
- `GET /api/universities/` - List all universities (filtered to active only)
- `GET /api/universities/{id}/` - Retrieve university
- `POST /api/universities/` - Create university (authenticated)
- `PUT/PATCH /api/universities/{id}/` - Update university (authenticated)

### Academic Data
- `GET /api/fields/` - List academic fields
- `GET /api/subject-groups/` - List subject groups
- `GET /api/majors/` - List major catalogs with search and filtering
- `GET /api/majors/{id}/` - Retrieve major catalog with subject groups
- `GET /api/majors/{id}/subject-groups/` - List subject groups for a major

### Admission Data
- `GET /api/admission-methods/` - List admission methods
- `GET /api/programs/` - List university programs with advanced filtering
- `GET /api/programs/{id}/` - Retrieve program with nested admission scores
- `GET /api/scores/` - List admission scores with complex filtering
- `GET /api/scores/{id}/` - Retrieve admission score

### Documentation
- `GET /api/docs/` - Swagger UI
- `GET /api/schema/` - OpenAPI schema

## Filtering & Searching

### Universities
```
GET /api/universities/?type=công_lập&province=1&search=Hà&ordering=name
```

### Majors
```
GET /api/majors/?field=1&search=CS&ordering=code
```

### Admission Scores
```
GET /api/scores/?year_min=2023&year_max=2024&score_min=20&score_max=30&region=Bắc&university_short_name=BK
```

## Admin Panel

Access Django admin at `/admin/` with superuser credentials.

Features:
- Manage provinces with region filtering
- Manage universities with active status and region filtering
- Manage academic fields and major catalogs with inline subject groups
- Manage university programs with nested filtering
- Manage admission scores with year and method filtering

## Testing

### Run all tests:
```bash
pytest
```

### Run tests with coverage:
```bash
pytest --cov=apps
```

### Run specific test file:
```bash
pytest apps/universities/tests/test_views.py
```

### Run specific test class:
```bash
pytest apps/universities/tests/test_views.py::TestUniversityViewSet
```

### Run specific test method:
```bash
pytest apps/universities/tests/test_views.py::TestUniversityViewSet::test_university_list_returns_200
```

## Database Schema

### Universities App
- **Province**: Regions (North/Central/South)
- **University**: University details with soft-delete via `is_active`

### Academics App
- **Field**: Academic fields (e.g., Engineering, Medicine)
- **SubjectGroup**: Subject combinations (e.g., A00, B00, C00)
- **MajorCatalog**: Specific majors within fields
- **MajorSubjectGroup**: M2M relationship between majors and subjects

### Admissions App
- **AdmissionMethod**: Admission methods (Regular, Priority, etc.)
- **UniversityProgram**: Program offering with partial unique constraints
- **AdmissionScore**: Admission scores by year and method

## Performance Optimizations

- Indexed fields: `University(province, type, type+province)`
- Indexed fields: `MajorCatalog(field)`
- Indexed fields: `UniversityProgram(major_catalog, university+internal_code)`
- Indexed fields: `AdmissionScore(year DESC, university_program+year DESC)`
- `select_related()` for foreign keys in list endpoints
- `prefetch_related()` for reverse relations
- Partial unique index on `UniversityProgram` for soft-delete behavior

## Deployment

### Production Docker Build

```bash
docker build -t bunik-api:latest .
docker run -p 8000:8000 \
  -e SECRET_KEY=your-secret-key \
  -e DEBUG=False \
  -e POSTGRES_HOST=db-host \
  -e POSTGRES_DB=bunik_prod \
  bunik-api:latest
```

### Environment Variables

See `.env.example` for all required variables.

## API Examples

### Get access token:
```bash
curl -X POST http://localhost:8000/api/auth/token/ \
  -d "username=admin&password=password"
```

### List universities in North region:
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/scores/?region=Bắc"
```

### Search for Computer Science programs:
```bash
curl "http://localhost:8000/api/programs/?search=Computer&ordering=university__name"
```

## Development Commands

### Create migrations:
```bash
python manage.py makemigrations
```

### Apply migrations:
```bash
python manage.py migrate
```

### Create superuser:
```bash
python manage.py createsuperuser
```

### Django shell:
```bash
python manage.py shell
```

### Format code:
```bash
black apps/ config/
```

### Lint code:
```bash
flake8 apps/ config/
```

## License

Proprietary - Bunik Project

## Support

For issues and questions, contact the development team.
