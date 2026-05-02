# API_ENDPOINT.md

Latest endpoint summary for current backend implementation.

## Base URLs
```
http://localhost:8000/api/
http://localhost:8000/api/v1/
```

Both prefixes are supported.

## Auth
```
POST /api/auth/token/
POST /api/auth/token/refresh/
POST /api/v1/auth/token/
POST /api/v1/auth/token/refresh/
```

## Resources
```
GET/POST/... /api/provinces/
GET/POST/... /api/universities/
GET/POST/... /api/fields/
GET/POST/... /api/subject-groups/
GET/POST/... /api/majors/
GET         /api/majors/{id}/subject-groups/
GET/POST/... /api/admission-methods/
GET/POST/... /api/programs/
GET         /api/programs/{id}/scores/        # New
GET/POST/... /api/scores/
POST        /api/scores/bulk-upsert/          # New
```

Equivalent `/api/v1/...` routes are available for all endpoints above.

## Docs
```
GET /api/schema/
GET /api/docs/
GET /api/v1/schema/
GET /api/v1/docs/
```

## Permissions
- Read methods (`GET`, `HEAD`, `OPTIONS`): public
- Write methods (`POST`, `PUT`, `PATCH`, `DELETE`): authenticated `is_staff=true`

## Error Format
```json
{
  "code": "http_<status>",
  "message": "...",
  "details": {},
  "request_id": "..."
}
```
