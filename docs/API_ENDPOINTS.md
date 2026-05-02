# Bunik API Endpoints Reference

## Base URL
```
http://localhost:8000/api/
```

## Endpoint Update (Latest)

This file contains legacy endpoint references. The backend has been updated with:

1. Versioned API namespace:
```
/api/v1/*
```
Equivalent routes now exist for auth, resources, schema, and docs.

2. New endpoint:
```
GET /api/programs/{id}/scores/
GET /api/v1/programs/{id}/scores/
```

3. New endpoint:
```
POST /api/scores/bulk-upsert/
POST /api/v1/scores/bulk-upsert/
```

4. Response contract update:
- Errors now use standardized envelope:
```json
{
  "code": "http_<status>",
  "message": "...",
  "details": {...},
  "request_id": "..."
}
```

5. Permission update:
- Read methods are public.
- Write methods require authenticated `is_staff=true` user.

---

## Authentication Endpoints

### Obtain JWT Token
```
POST /api/auth/token/
Content-Type: application/json

{
    "username": "your_username",
    "password": "your_password"
}

Response (200):
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Refresh Token
```
POST /api/auth/token/refresh/
Content-Type: application/json

{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Response (200):
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

## Provinces Endpoints

### List All Provinces
```
GET /api/provinces/
GET /api/provinces/?page=1&page_size=20

Response (200):
{
    "count": 63,
    "next": "http://localhost:8000/api/provinces/?page=2",
    "previous": null,
    "results": [
        {
            "id": 1,
            "name": "Hà Nội",
            "region": "Bắc"
        },
        ...
    ]
}
```

### Search Provinces
```
GET /api/provinces/?search=Hà

Response (200):
{
    "count": 1,
    "next": null,
    "previous": null,
    "results": [
        {
            "id": 1,
            "name": "Hà Nội",
            "region": "Bắc"
        }
    ]
}
```

### Retrieve Single Province
```
GET /api/provinces/{id}/

Response (200):
{
    "id": 1,
    "name": "Hà Nội",
    "region": "Bắc"
}
```

---

## Universities Endpoints

### List Universities (Active Only)
```
GET /api/universities/
GET /api/universities/?page=1&page_size=20

Response (200):
{
    "count": 120,
    "next": "http://localhost:8000/api/universities/?page=2",
    "previous": null,
    "results": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "Đại học Bách khoa Hà Nội",
            "short_name": "HUST",
            "type": "công_lập",
            "province_name": "Hà Nội",
            "is_active": true
        },
        ...
    ]
}
```

### Filter Universities by Type
```
GET /api/universities/?type=công_lập

GET /api/universities/?type=dân_lập

GET /api/universities/?type=quân_sự
```

### Filter Universities by Province
```
GET /api/universities/?province=1

Response (200): Universities in province with id=1
```

### Filter Universities by Active Status
```
GET /api/universities/?is_active=true

GET /api/universities/?is_active=false
```

### Search Universities
```
GET /api/universities/?search=Bách

GET /api/universities/?search=HUST
```

### Combined Filters
```
GET /api/universities/?type=công_lập&province=1&is_active=true&search=đại

GET /api/universities/?type=dân_lập&is_active=true
```

### Order Universities
```
GET /api/universities/?ordering=name

GET /api/universities/?ordering=-created_at

GET /api/universities/?ordering=name&page_size=50
```

### Retrieve University Details
```
GET /api/universities/{id}/

Response (200):
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Đại học Bách khoa Hà Nội",
    "short_name": "HUST",
    "type": "công_lập",
    "province": {
        "id": 1,
        "name": "Hà Nội",
        "region": "Bắc"
    },
    "is_active": true,
    "logo_url": "https://example.com/logo.png",
    "address": "1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
    "website": "https://hust.edu.vn",
    "description": "Trường Đại học Bách khoa Hà Nội...",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
}
```

### Create University (Authenticated)
```
POST /api/universities/
Authorization: Bearer {access_token}
Content-Type: application/json

{
    "name": "Đại học Mới",
    "short_name": "DMO",
    "type": "dân_lập",
    "province": 1,
    "is_active": true,
    "address": "123 Main Street",
    "website": "https://example.com",
    "description": "A new university..."
}

Response (201): Created university object
```

---

## Academic Fields Endpoints

### List Fields
```
GET /api/fields/
GET /api/fields/?search=CS&ordering=code
```

### Retrieve Field
```
GET /api/fields/{id}/
```

---

## Subject Groups Endpoints

### List Subject Groups
```
GET /api/subject-groups/
GET /api/subject-groups/?search=A&ordering=code
```

### Retrieve Subject Group
```
GET /api/subject-groups/{id}/
```

---

## Major Catalog Endpoints

### List Majors
```
GET /api/majors/
GET /api/majors/?page_size=50&ordering=code

Response (200):
{
    "count": 500,
    "results": [
        {
            "id": 1,
            "code": "CS001",
            "name": "Khoa học Máy tính",
            "field_name": "Công nghệ Thông tin"
        },
        ...
    ]
}
```

### Filter Majors by Field
```
GET /api/majors/?field=2
```

### Search Majors
```
GET /api/majors/?search=Máy

GET /api/majors/?search=CS
```

### Retrieve Major Details (with Subject Groups)
```
GET /api/majors/{id}/

Response (200):
{
    "id": 1,
    "code": "CS001",
    "name": "Khoa học Máy tính",
    "field": {
        "id": 2,
        "code": "IT",
        "name": "Công nghệ Thông tin"
    },
    "description": "Ngành đào tạo về khoa học máy tính...",
    "subject_groups": [
        {
            "id": 5,
            "code": "A00",
            "subjects": "Toán, Vật lý, Tiếng Anh"
        },
        {
            "id": 6,
            "code": "A01",
            "subjects": "Toán, Tiếng Anh, Thông tin"
        }
    ]
}
```

### Get Subject Groups for a Major (Extra Action)
```
GET /api/majors/{id}/subject-groups/

Response (200):
[
    {
        "id": 5,
        "code": "A00",
        "subjects": "Toán, Vật lý, Tiếng Anh"
    },
    ...
]
```

---

## Admission Methods Endpoints

### List Admission Methods
```
GET /api/admission-methods/
GET /api/admission-methods/?search=Thường&ordering=code
```

### Retrieve Admission Method
```
GET /api/admission-methods/{id}/
```

---

## University Programs Endpoints

### List University Programs
```
GET /api/programs/
GET /api/programs/?page=1&page_size=20

Response (200):
{
    "count": 5000,
    "results": [
        {
            "id": "660e8400-e29b-41d4-a716-446655440001",
            "university_short_name": "HUST",
            "major_code": "CS001",
            "major_name": "Khoa học Máy tính",
            "internal_code": "PROG_001",
            "display_name": "Khoa học Máy tính"
        },
        ...
    ]
}
```

### Filter Programs by University
```
GET /api/programs/?university=550e8400-e29b-41d4-a716-446655440000
```

### Filter Programs by Major
```
GET /api/programs/?major_catalog=1
```

### Filter Programs by Field
```
GET /api/programs/?major_catalog__field=2
```

### Search Programs
```
GET /api/programs/?search=PROG_001

GET /api/programs/?search=HUST&ordering=university__name
```

### Combined Filters
```
GET /api/programs/?university=uuid&major_catalog=1&search=CS
```

### Retrieve Program Details (with Nested Data)
```
GET /api/programs/{id}/

Response (200):
{
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "university": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Đại học Bách khoa Hà Nội",
        ...
    },
    "major_catalog": {
        "id": 1,
        "code": "CS001",
        "name": "Khoa học Máy tính",
        ...
    },
    "internal_code": "PROG_001",
    "internal_name": "Khoa học Máy tính",
    "display_name": "Khoa học Máy tính",
    "admission_scores": [
        {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "year": 2024,
            "score": "25.5",
            "quota": 100,
            "admission_method_code": "THƯỜNG"
        },
        ...
    ]
}
```

---

## Admission Scores Endpoints

### List Admission Scores
```
GET /api/scores/
GET /api/scores/?page=1&page_size=20

Response (200):
{
    "count": 50000,
    "results": [
        {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "university_name": "Đại học Bách khoa Hà Nội",
            "major_code": "CS001",
            "internal_code": "PROG_001",
            "year": 2024,
            "score": "25.5",
            "quota": 100,
            "admission_method_code": "THƯỜNG"
        },
        ...
    ]
}
```

### Filter by Year
```
GET /api/scores/?year=2024

GET /api/scores/?year_min=2023&year_max=2024
```

### Filter by Score
```
GET /api/scores/?score_min=20&score_max=30
```

### Filter by University
```
GET /api/scores/?university_program__university=uuid
```

### Filter by Major
```
GET /api/scores/?university_program__major_catalog=1
```

### Filter by Admission Method
```
GET /api/scores/?admission_method=1
```

### Filter by Region
```
GET /api/scores/?region=Bắc

GET /api/scores/?region=Trung

GET /api/scores/?region=Nam
```

### Filter by University Short Name
```
GET /api/scores/?university_short_name=HUST

GET /api/scores/?university_short_name=BK
```

### Filter by Major Code
```
GET /api/scores/?major_code=CS
```

### Complex Filtering Example
```
GET /api/scores/?year_min=2023&year_max=2024&score_min=24&score_max=30&region=Bắc&university_short_name=BK

GET /api/scores/?year=2024&score_min=25&admission_method=1&major_code=CS&ordering=-score
```

### Order Scores
```
GET /api/scores/?ordering=year

GET /api/scores/?ordering=-year

GET /api/scores/?ordering=score

GET /api/scores/?ordering=-score

GET /api/scores/?ordering=-year,-score
```

### Search Scores
```
GET /api/scores/?search=PROG_001

GET /api/scores/?search=CS001&ordering=-year
```

### Retrieve Score Details (Full Nested Data)
```
GET /api/scores/{id}/

Response (200):
{
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "university_program": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "university": { ... },
        "major_catalog": { ... },
        ...
    },
    "admission_method": {
        "id": 1,
        "code": "THƯỜNG",
        "name": "Xét tuyển thường xuyên",
        "description": "..."
    },
    "year": 2024,
    "score": "25.5",
    "quota": 100,
    "note": "Năm 2024 đã tăng chỉ tiêu"
}
```

### Create Score (Authenticated)
```
POST /api/scores/
Authorization: Bearer {access_token}
Content-Type: application/json

{
    "university_program": "660e8400-e29b-41d4-a716-446655440001",
    "admission_method": 1,
    "year": 2024,
    "score": "25.5",
    "quota": 100,
    "note": "..."
}

Response (201): Created score object
```

---

## Documentation Endpoints

### Swagger UI
```
GET /api/docs/

Opens interactive Swagger UI for exploring all endpoints
```

### OpenAPI Schema
```
GET /api/schema/

Returns OpenAPI 3.0 schema in JSON format
```

---

## Common Query Parameters

### Pagination
```
?page=1          # Current page (default: 1)
?page_size=50    # Items per page (default: 20)
```

### Searching
```
?search=keyword  # Full-text search on specified fields
```

### Ordering
```
?ordering=field              # Ascending order
?ordering=-field             # Descending order
?ordering=field1,field2      # Multiple fields
?ordering=-field1,field2     # Mixed order
```

### Filtering
```
?field=value              # Exact match
?field__gte=value         # Greater than or equal
?field__lte=value         # Less than or equal
?field__gt=value          # Greater than
?field__lt=value          # Less than
?field__icontains=value   # Case-insensitive contains
```

---

## Response Format

### Success Response (200 OK)
```json
{
    "count": 100,
    "next": "http://...",
    "previous": null,
    "results": [...]
}
```

### Created Response (201 Created)
```json
{
    "id": "...",
    "field": "value",
    ...
}
```

### Validation Error Response (400 Bad Request)
```json
{
    "field_name": ["Error message"],
    "another_field": ["Another error"]
}
```

### Authentication Error Response (401 Unauthorized)
```json
{
    "detail": "Authentication credentials were not provided."
}
```

### Not Found Response (404 Not Found)
```json
{
    "detail": "Not found."
}
```

---

## Authentication

All endpoints except `/api/docs/` and `/api/schema/` accept JWT tokens.

### Bearer Token Format
```
Authorization: Bearer <access_token>
```

### Example Request with Authentication
```bash
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1Q..." \
     http://localhost:8000/api/universities/
```

---

## Rate Limiting & Pagination

- Default page size: 20 items
- Maximum items per request: 100
- Pagination uses cursor or page numbers

---

## Status Codes

- `200 OK` — Request successful
- `201 Created` — Resource created
- `204 No Content` — Successful deletion
- `400 Bad Request` — Validation error
- `401 Unauthorized` — Authentication required
- `403 Forbidden` — Permission denied
- `404 Not Found` — Resource not found
- `500 Internal Server Error` — Server error

---

End of API Reference
