# University Detail Single-Request Design

## Goal

Opening `/truong/:code` must issue exactly one application API request and render admission scores in a separate table for each admission method.

## API contract

Add `GET /api/universities/by-code/{code}/detail/` without changing existing university or score endpoints.

Successful response:

```json
{
  "university": {},
  "scores": []
}
```

- `university` uses the existing university detail shape.
- `scores` uses the existing admission-score shape.
- Only scores belonging to the requested university code are returned.
- The endpoint is not paginated because the detail page must make one request.
- A university with no scores returns `200` with an empty `scores` array.
- An unknown university code returns `404`.

The backend must use an inner relationship filter when selecting admission scores so unrelated parent rows are excluded rather than returned with a null embedded program.

## Frontend data flow

`TruongDetailPage` calls one service function for the composite endpoint. It no longer searches the university list or walks every page of `/scores/`.

Scores are grouped first by admission method and then by a stable row identity consisting of:

- university program ID;
- variant key;
- subject group code;
- gender;
- region code.

This keeps every score variant on its own row. Each method renders as a separate table. A row contains the program name and code, variant metadata, the three most recent years available for that method, and a trend computed only between comparable scores in that same row.

When `normalized_score` is present, the UI uses it. Otherwise it displays the raw score. A trend is omitted when the two values do not share a comparable scale.

## Error handling

- Loading and not-found states remain consistent with the current page.
- A failed composite request logs the error and leaves the page in its existing not-found/error fallback.
- Empty score data shows a concise empty state rather than an empty table.

## Verification

- Backend tests cover success, exact university filtering, empty scores, and unknown codes.
- Frontend tests cover method grouping, distinct variant rows, normalized score preference, and one service call.
- Browser verification confirms one `/api/universities/by-code/{code}/detail/` request and no `/api/scores/` request when opening a university.

## Scope

This change does not redesign unrelated pages, alter existing endpoint contracts, implement reviews, or change ranking behavior.
