# Bunik Backend (DRF + Supabase)

Backend API cho Bunik, dùng Django REST Framework làm lớp HTTP/API và dùng Supabase làm data/auth backend.

## Current Architecture

- API framework: Django + DRF
- Data access: query trực tiếp Supabase (`supabase-py`)
- Auth: Supabase Auth token (`Bearer`)
- Schema docs: drf-spectacular
- Caching: Django cache (`locmem` hoặc Redis qua `REDIS_URL`)

Luu y:
- Khong su dung Django ORM cho luong API runtime.
- Khong co migration/runtime DB local trong backend.

## Project Layout

- `config/`: Django settings + URL router
- `core/auth/`: Auth/profile/awards/achievements endpoints
- `core/api/`: endpoints tong hop (`rankings`, `major-trends`)
- `core/supabase_client.py`: Supabase client + parse/order/paginate helpers
- `src/universities/`, `src/academics/`, `src/admissions/`: domain endpoints

## Environment Variables

Bat buoc:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SECRET_KEY`

Tuy chon:
- `DEBUG`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CORS_ALLOW_ALL_ORIGINS`
- `REDIS_URL`
- `CACHE_DEFAULT_TIMEOUT`
- `THROTTLE_ANON`
- `DJANGO_LOG_LEVEL`

## Run Local

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements/dev.txt
python manage.py runserver
```

API docs:
- `/api/docs/`
- `/api/schema/`

## API Endpoints

Auth:
- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`
- `PATCH /api/auth/me/`
- `GET /api/awards/`
- `GET /api/auth/me/achievements/`
- `POST /api/auth/me/achievements/`
- `DELETE /api/auth/me/achievements/{achievement_id}/`
- `GET /api/auth/me/certificates/`
- `POST /api/auth/me/certificates/`
- `DELETE /api/auth/me/certificates/{certificate_id}/`

Universities:
- `GET /api/provinces/`
- `GET /api/provinces/{id}/`
- `GET /api/universities/`
- `GET /api/universities/{id}/`

Academics:
- `GET /api/exam-blocks/`
- `GET /api/fields/`
- `GET /api/fields/{id}/`
- `GET /api/subject-groups/`
- `GET /api/subject-groups/{code}/`
- `GET /api/majors/`
- `GET /api/majors/{code}/`
- `GET /api/majors/{code}/subject-groups/`
- `GET /api/majors/overview/`
- `GET /api/majors/recommendations/`

Admissions:
- `GET /api/admission-methods/`
- `GET /api/admission-methods/{code}/`
- `GET /api/programs/`
- `GET /api/programs/{id}/`
- `GET /api/programs/{id}/scores/`
- `GET /api/scores/`
- `GET /api/scores/{id}/`
- `POST /api/scores/bulk-upsert/`

Analytics:
- `GET /api/rankings/`
- `GET /api/major-trends/`

## Query Parameters (selected)

`/api/universities/`:
- `search`, `type`, `province`, `is_active`, `ordering`, `page`, `page_size`

`/api/programs/`:
- `university_code`, `major_code`, `is_active`, `page`, `page_size`

`/api/scores/`:
- `university_code`, `major_code`, `admission_method`
- `year`, `year_min`, `year_max`
- `score_min`, `score_max`
- `ordering` (ho tro multi field, vd `-year,-score`)
- `page`, `page_size`

`/api/majors/recommendations/`:
- `interests`, `block`, `score_min`, `score_max`, `is_chuyen_class`, `limit`

## Supabase Schema Requirements (from current code)

Code hien tai dang ky vong cac cot sau:

- `users`: `id`, `user_name`, `full_name`, `grade`, `dob`, `gender`, `gmail`, `special_score`, `is_special`
- `score`: `user_id`, `base_score`, `math`, `literature`, `english`, `physics`, `chemistry`, `biology`, `history`, `geography`
- `achievements`: `id`, `user_id`, `award_id`, `name`, `prize`, `date`, `is_verified`
- `awards`: `id`, `name`, `level`
- Cac bang domain: `provinces`, `universities`, `fields`, `subject_groups`, `major_catalog`, `major_subject_groups`, `university_programs`, `admission_methods`, `admission_scores`

Neu schema Supabase thuc te khac danh sach tren, can cap nhat backend hoac tao view/RPC tuong thich.

## Test

Smoke tests dang co:

```bash
pytest core/auth/tests/test_auth_views.py core/api/tests/test_views.py src/admissions/tests/test_security.py -q
```

## Notes

- `/api/` va `/api/v1/` cung tro vao cung bo route.
- Rate limit anon duoc cau hinh qua DRF throttle.
- Cac list endpoint co cache payload theo query string.
