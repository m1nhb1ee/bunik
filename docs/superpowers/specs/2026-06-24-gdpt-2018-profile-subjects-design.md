# GDPT 2018 Profile Subjects Design

## Goal

Replace the fixed eight-column score profile with a normalized subject profile that represents the GDPT 2018 upper-secondary subject structure. A user selects four elective subjects, stores one current result per subject, and receives a comparable academic score on an 80-point scale.

## Curriculum model

The subject catalog contains:

- eight compulsory subjects or educational activities: Mathematics, Literature, English, History, Physical Education, National Defense and Security Education, Experiential/Career Guidance, and Local Education Content;
- nine elective subjects: Geography, Economic and Legal Education, Physics, Chemistry, Biology, Informatics, Technology, Music, and Fine Arts.

Only the following eight subjects form the academic-profile calculation:

- four fixed core subjects: Mathematics, Literature, English, and History;
- the user's four selected elective subjects.

Other compulsory subjects remain in the catalog but do not contribute to the academic-profile score.

## Database schema

### `school_subjects`

| Column | Type | Rules |
| --- | --- | --- |
| `code` | text | primary key, stable machine code |
| `name` | text | required |
| `curriculum_group` | text | `COMPULSORY` or `ELECTIVE` |
| `assessment_type` | text | `NUMERIC` or `PASS_FAIL` |
| `counts_as_core` | boolean | true only for the four fixed core subjects |
| `is_active` | boolean | defaults to true |

### `user_elective_subjects`

| Column | Type | Rules |
| --- | --- | --- |
| `user_id` | uuid | references `users(id)` with cascade delete |
| `subject_code` | text | references `school_subjects(code)` |
| `selected_at` | timestamptz | defaults to current time |

The composite primary key is `(user_id, subject_code)`. The foreign-key columns are indexed. Only active elective subjects may be selected.

### `user_subject_results`

| Column | Type | Rules |
| --- | --- | --- |
| `user_id` | uuid | references `users(id)` with cascade delete |
| `subject_code` | text | references `school_subjects(code)` |
| `numeric_score` | numeric(4,2) | nullable, between 0 and 10 |
| `assessment_status` | text | nullable, `PASSED` or `FAILED` |
| `updated_at` | timestamptz | required |

The composite primary key is `(user_id, subject_code)`. Exactly one result representation is allowed: a numeric result or an assessment status, never both. The representation must match the subject's assessment type; this cross-table rule is enforced by the save function.

## Atomic save function

Add `save_user_subject_profile(elective_codes text[], results jsonb)`. It runs as the authenticated user and:

1. verifies `auth.uid()`;
2. requires exactly four distinct active elective subject codes;
3. requires results only for the four core subjects, the four selected electives, or non-scoring compulsory subjects;
4. validates numeric/pass-fail representation against the catalog;
5. replaces elective selections and upserts results in one transaction;
6. removes stale results for electives that were deselected.

RLS allows users to read and modify only their own selections and results. The backend invokes the function with the user's Supabase access token.

## Academic score

The calculation uses the four core subjects plus four selected electives.

Let:

- `S` be the sum of numeric results;
- `N` be the number of numeric results;
- `P` be the number of `PASSED` results;
- `F` be the number of `FAILED` results.

When all eight results are present and `N > 0`:

```text
numeric_average = S / N
academic_score_80 = S + numeric_average * P + 0 * F
```

This is equivalent to a normal sum when all eight subjects are numeric. A passed pass/fail subject receives the user's numeric average; a failed subject receives zero. The result is rounded to two decimal places and remains between 0 and 80.

If four electives or any of the eight contributing results are missing, the profile is incomplete and no final score is returned.

The calculation lives in a database view or stable SQL function so the API, ranking, and future consumers share one implementation.

## API contract

### `GET /api/auth/me/subjects/`

Returns:

```json
{
  "subjects": [],
  "selected_elective_codes": [],
  "results": [],
  "academic_score": {
    "is_complete": false,
    "score_80": null,
    "numeric_average": null,
    "missing_subject_codes": []
  }
}
```

### `PATCH /api/auth/me/subjects/`

Accepts all four elective codes and the current subject results. Validation errors return field-level HTTP 400 responses. A successful response returns the same shape as GET.

The existing `/api/auth/me/` identity/profile contract remains available. Legacy scalar score fields are deprecated and are no longer written by the new profile UI.

## Frontend behavior

The academic profile editor contains:

1. four fixed numeric core subjects;
2. an elective picker requiring exactly four of nine subjects;
3. dynamic result controls: numeric input for numeric subjects and Passed/Failed choice for pass/fail subjects;
4. optional display of non-scoring compulsory activities;
5. an 80-point score card with a visible calculation breakdown and incomplete-profile guidance.

Subject-combination recommendations use the user's selected and core subjects, matched against the existing subject-group catalog. They no longer infer combinations from the three highest scores.

## Migration

1. Create and seed the catalog and normalized user tables.
2. Backfill positive/non-null legacy values:
   - `math`, `literature`, `english`, and `history` become core results;
   - `physics`, `chemistry`, `biology`, and `geography` become elective results.
3. Select legacy electives only when four unambiguous elective results exist. Otherwise leave the normalized profile incomplete for user confirmation.
4. Switch the API and UI to normalized storage.
5. Keep the legacy `score` table temporarily for rollback and historical comparison; stop writing to it from the new UI.

The migration is idempotent and does not overwrite normalized results already confirmed by a user.

## Verification

- Migration and constraint tests cover idempotency and preservation of legacy data.
- API tests cover authorization, exactly four distinct electives, assessment-type validation, atomic rollback, and incomplete profiles.
- Formula tests cover eight numeric results, passed subjects, failed subjects, missing results, and bounds.
- Frontend checks cover selection limits, dynamic input type, save/reload, score breakdown, and subject-group recommendations.
- Browser QA verifies the complete authenticated profile flow without writes to the legacy `score` table.

## Out of scope

- semester or grade-level history;
- transcript document verification;
- changing admission-score data;
- assigning official admission eligibility solely from this profile score.
