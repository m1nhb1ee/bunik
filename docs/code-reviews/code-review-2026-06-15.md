# Bunik — Code Review 2026-06-15

Reviewer: senior engineer pass over backend, frontend, database, and docs.
Today: 2026-06-15. Last review on file: 2026-06-14.

---

## 1. Executive Summary

**Verdict:** the system works end-to-end and the test suite passes, but two write-path mismatches (admission-score upsert vs. v6 schema, plain anon client used inside an admin-gated mutation) and a clutch of cross-layer drift (Supabase region encoding vs. frontend, stale docs, stale `.env` file with a real project ref) are the real risks. Read-path code is mostly clean; the bigger surface today is duplication and stale prose, not crashing bugs.

**Top 5 risks**

1. `POST /api/scores/bulk-upsert/` references a unique constraint that migration_v6 explicitly dropped — production upserts will error.
2. The same `bulk-upsert` endpoint authorizes via DRF then calls Supabase with the anon client — RLS sees an unauthenticated request, so it either fails uniformly (good) or, if anon was granted writes, lets *any* signed-in admin bypass per-row RLS.
3. `_major_overview_rows` builds `scores_by_program` but never reads it (dead branch, lines 131–142 in `src/academics/views.py`) — masks the fact that two different aggregation strategies were prototyped and only one wired up.
4. `backend/.env` committed-to-disk references a real Supabase project ref `qpwcmxtpflfimjpeojab.supabase.co` with the live publishable anon key. `.gitignore` excludes `.env`, so it's local-only, but the duplicate `backend/.env_used_for_check` is a verbatim copy of `.env.test` — drift that confuses which file is authoritative.
5. Docs (`docs/API_ENDPOINTS.md`, `docs/API_ENDPOINT.md`, `docs/backend/FILE_REFERENCE.md`, `docs/backend/DEPLOYMENT.md`) describe a JWT/SimpleJWT auth stack and an `apps/...` layout that don't exist. New contributors reading these will write the wrong client code.

**Validation commands run**

| Command | Result |
|---|---|
| `python -m py_compile` over all backend `.py` files | PASS (no errors) |
| `DJANGO_SETTINGS_MODULE=config.settings.local python -m pytest -q` | PASS — `6 passed in 0.62s` |
| `python manage.py check` | PASS — `System check identified no issues (0 silenced).` |
| `python -m flake8 --select=F` | 2 findings, both expected (`F403/F401` from `from .base import *` in `local.py`) |
| frontend `tsc --noEmit` | Skipped — `frontend/tsconfig.json` does not exist; Vite transpiles without type-check. **This is itself a finding** (see RISK-3). |
| frontend `npm run lint`, `npm test` | Both are `echo` no-ops in `package.json` |
| `npm run build` | not run (would download lockfile + write to repo) |

**Counts**

- Confirmed bugs: 4 (BUG-1 through BUG-4)
- High-confidence risks: 3 (RISK-1 through RISK-3)
- Medium / low items: see §3–§5

---

## 2. Critical and High-Risk Findings

### [BUG-1] — CRITICAL — bulk-upsert relies on a unique constraint that v6 dropped

**File/lines:** `backend/src/admissions/views.py` lines 238–242, against `database/migrations/migration_v6.sql` line 110.

**Evidence:**

```python
# src/admissions/views.py
response = get_client().table('admission_scores').upsert(
    items,
    on_conflict='university_program_id,admission_method_code,year',
).execute()
```

```sql
-- migration_v6.sql
ALTER TABLE public.admission_scores
    DROP CONSTRAINT IF EXISTS admission_scores_university_program_id_admission_method_code_year_key;
```

v4 created that constraint at `admission_scores.UNIQUE(university_program_id, admission_method_code, year)` (line 93 of `migration_v4.sql`). v6 drops it and replaces it with a partial unique index `uq_admission_scores_source_id (source, source_id) WHERE source_id IS NOT NULL`.

**Root cause:** PostgREST's `?on_conflict=col_a,col_b` requires a UNIQUE/EXCLUSION constraint on exactly those columns. v6 removed it without updating the API.

**Impact:** every call to `POST /api/scores/bulk-upsert/` on a v6 schema returns a PostgREST error like `there is no unique or exclusion constraint matching the ON CONFLICT specification`. Tests pass because the fake Supabase client in `test_security.py` ignores `on_conflict`. So this bug is invisible to CI but breaks the only authenticated write surface in the API.

**Cross-layer effects:** the test in `backend/src/admissions/tests/test_security.py::test_bulk_upsert_allows_staff_user` only asserts the 200 path under a mock that ignores `on_conflict`. The "happy path" passes on a fake but would fail in prod. Frontend doesn't call this endpoint today (no `bulkUpsert` in `frontend/src/app/services/api.ts`), so the regression has been hidden.

**Fix:** decide which "natural key" v6 wants and re-create the constraint, then update either the SQL or the upsert call to match. Two viable patches:

a. Restore the v4 constraint on the live schema (also the simplest API patch):

```sql
ALTER TABLE public.admission_scores
    ADD CONSTRAINT admission_scores_program_method_year_key
    UNIQUE (university_program_id, admission_method_code, year);
```

b. If duplicates by source are intentional, upsert against `(source, source_id)` instead and require the API caller to send those:

```python
response = get_client().table('admission_scores').upsert(
    items,
    on_conflict='source,source_id',
).execute()
```

Pick (a) only if you are sure v6 dedup logic actually preserves one row per `(program, method, year)`.

**Validation:** add a contract test that runs against a real Postgres (or a mock that respects on_conflict by raising when the constraint is absent). At minimum, an integration check that does an actual `upsert()` on a temp schema once per CI run.

---

### [BUG-2] — HIGH — bulk-upsert authenticates with DRF but writes with the anon Supabase client

**File/lines:** `backend/src/admissions/views.py` lines 229–242.

**Evidence:**

```python
@action(detail=False, methods=['post'], url_path='bulk-upsert', permission_classes=[IsAuthenticated])
def bulk_upsert(self, request):
    if not getattr(request.user, 'is_staff', False):
        return Response({'detail': 'You do not have permission to perform this action.'},
                        status=status.HTTP_403_FORBIDDEN)
    items = request.data.get('items')
    if not isinstance(items, list) or not items:
        return Response({'detail': 'items is required.'}, status=status.HTTP_400_BAD_REQUEST)

    response = get_client().table('admission_scores').upsert(
        items,
        on_conflict='university_program_id,admission_method_code,year',
    ).execute()
```

Compare to `core/auth/views.py` where every authenticated mutation correctly does `get_user_client(access_token)` so the user's JWT is presented to PostgREST and RLS sees the user.

**Root cause:** `get_client()` is the cached anon client (`core/supabase_client.py` lines 22–26). The JWT from the request is never forwarded to Supabase, so RLS evaluates the upsert as `anon`.

**Impact:** depends on RLS policy.

- If `anon` cannot insert/upsert into `admission_scores` (the safe default): every staff-authenticated request fails with an RLS error after passing DRF auth — staff effectively can't write, and the BUG-1 error is masked by this one.
- If `anon` *can* write (current code suggests this was the intent because there's no per-row identity check in SQL): then any unauthenticated client that hits Supabase directly with the publishable anon key can also write, bypassing the `is_staff` gate. The DRF check is then security theater.

Either way, the design is wrong: a privileged write should ride the privileged JWT, with a SQL RLS policy like `auth.jwt() ->> 'role' = 'admin'`.

**Cross-layer effects:** `core/auth/supabase_auth.py` decides `is_staff` from `user_metadata.is_admin` or `user_metadata.role`. Those are *user-editable* metadata fields in Supabase by default unless you've explicitly locked them; a determined user can write `{"is_admin": true}` from the client. Combined with this bug, that gives a path to staff in DRF without staff in DB. (Confirm whether you store admin status in `user_metadata` or `app_metadata`; the latter is server-only.)

**Fix:**

```python
access_token = request.auth
response = get_user_client(access_token).table('admission_scores').upsert(
    items,
    on_conflict='university_program_id,admission_method_code,year',
).execute()
```

And move the `is_admin`/`role` flag into `app_metadata` so users can't self-promote. Add a SQL RLS policy that gates `INSERT/UPDATE` on `admission_scores` to `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`.

**Validation:** add a test where the fake client raises on `get_client()` (to prove no anon writes happen) and only `get_user_client(token)` returns the upsert client.

---

### [BUG-3] — HIGH — `_major_overview_rows` builds a `scores_by_program` dict that's never read

**File/lines:** `backend/src/academics/views.py` lines 131–142.

**Evidence:**

```python
scores_by_program = {}
for score in scores:
    score_value = score.get('score')
    program = program_by_id.get(score.get('university_program_id'))
    if score_value is None or not program:
        continue
    program_id = program.get('id')
    year = str(score.get('year'))
    if not program_id or year != str(last_year):
        continue
    year_scores = scores_by_program.setdefault(program_id, {})
    year_scores[year] = max(year_scores.get(year, score_value), score_value)

normalized_scores_by_program = {}
for score_row in scores:
    ...
```

`scores_by_program` is then never referenced again — `rows` at line 178 reads from `normalized_scores_by_program` only. `grep -n scores_by_program src/academics/views.py` returns three matches all inside the dead branch.

**Root cause:** two parallel aggregation strategies were prototyped (one filtered by `year == last_year`, one not) and only the second was kept, but the first wasn't deleted. The dead loop also still scans the entire `scores` list, doubling the time complexity of this endpoint.

**Impact:** wasted CPU per request on the `/api/majors/overview/` endpoint (which fetches all admission_scores rows for `last_year` and then iterates them twice). Worse, this hides the fact that the two strategies disagree: the dead branch uses `max(year_scores.get(year, score_value), score_value)` which is a no-op-against-default and would always return `score_value` even if a higher score had been seen earlier — a real aggregation bug *if it were live*. Leaving it in invites someone to plug it back in.

**Fix:** delete lines 131–142 of `src/academics/views.py`. If you want to keep the "max per year" logic for future use, push it into `normalized_scores_by_program` (which already implements the same idea correctly).

**Validation:** existing test `test_score_scale.py` covers `_is_scale_40` only. Add a test for `_major_overview_rows` with multiple scores for the same `(program_id, last_year)` to lock in "max" behavior.

---

### [BUG-4] — MEDIUM — Profile save deletes all achievements before re-inserting; an inserter failure wipes the user's data

**File/lines:** `frontend/src/app/pages/HoSoPage.tsx` lines 310–324.

**Evidence:**

```tsx
await updateMyProfile(token, payload);

for (const achievement of savedAchievements) {
  await deleteMyAchievement(token, achievement.id);
}
for (const item of selectedAchievements) {
  await addMyAchievement(token, { award_id: item.award_id, prize: item.prize });
}
const refreshed = await getMyAchievements(token);
```

**Root cause:** delete-then-recreate with no transaction and no rollback. If `addMyAchievement` throws part-way (network, RLS, rate-limit at 429 from `_is_rate_limited_error`), every old achievement is already gone and only some new ones are inserted.

**Impact:** silent data loss for the most common user-edit flow. The user sees an error banner via `setError(err.message)` and has no way to recover their previous achievements.

**Cross-layer effects:** the backend `AchievementListCreateView.post` (`core/auth/views.py` lines 336–367) does not de-duplicate or upsert; it inserts unconditionally. So even a successful "save the same thing twice" results in duplicate rows after the partial-failure path.

**Fix (frontend, fastest):** compute the diff client-side instead of teardown-rebuild.

```tsx
const existing = new Map(savedAchievements.map((a) => [a.id, a]));
const desired = new Map(selectedAchievements.map((s) => [s.clientId, s]));
const toDelete = savedAchievements.filter((a) => !desired.has(`saved-${a.id}-…`));
const toAdd = selectedAchievements.filter((s) => !s.clientId.startsWith("saved-"));
```

Then only delete/insert the actual deltas. If you also want to fix the duplication risk, add a `POST /api/auth/me/achievements/bulk-replace/` endpoint that does the swap inside one Supabase transaction.

**Validation:** Cypress/Playwright test that opens HoSoPage, deletes one award, kills the network during save, and asserts the original list is unchanged on reload.

---

### [RISK-1] — HIGH — Stale public-facing docs describe an API that doesn't exist

**File/lines:** `docs/API_ENDPOINTS.md`, `docs/API_ENDPOINT.md`, `docs/backend/FILE_REFERENCE.md`, `docs/backend/DEPLOYMENT.md`.

**Evidence:**

`docs/API_ENDPOINTS.md` lines 50–68:

```
POST /api/auth/token/
{
    "username": "...", "password": "..."
}
Response (200):
{
    "access": "eyJ0eXAiOiJKV1Qi...",
    "refresh": "eyJ0eXAiOiJKV1Qi..."
}
```

The actual endpoint is `POST /api/auth/login/` (`backend/core/auth/urls.py` line 18) taking `{gmail, password}` and returning `{access_token, refresh_token, user, message}`. There is no `/api/auth/token/` or SimpleJWT in this codebase.

`docs/backend/FILE_REFERENCE.md` describes `apps/universities/{models.py,admin.py,filters.py,serializers.py}`. The actual layout is `backend/src/universities/{apps.py,urls.py,views.py,tests/}` — no `models.py`, no `admin.py`, no `filters.py`. Django apps in this codebase store no models because `DATABASES = {}` (settings/base.py line 55).

`docs/backend/DEPLOYMENT.md` lines 21–35 lists `POSTGRES_*` env vars; the live `backend/.env.example` uses `SUPABASE_DB_*` instead.

**Root cause:** docs were written for the v1-Django + SimpleJWT design that was replaced by a Supabase-PostgREST proxy. The migration was never reflected in `docs/`.

**Impact:** any new contributor or LLM agent reading `docs/` will write client code against endpoints that 404, and waste time hunting for `apps/universities/models.py` that doesn't exist.

**Fix:** the four files above should either be rewritten or deleted. Generate the endpoint reference from `drf-spectacular` (`/api/schema/`) instead of maintaining hand-written prose. As a minimum, prepend each stale file with a `> STATUS: OUTDATED — see api/schema/` banner.

**Validation:** add CI step `pytest backend/ && python manage.py spectacular --file docs/api-schema.json` and diff `docs/api-schema.json` to catch drift.

---

### [RISK-2] — MEDIUM — Admin status comes from user-controllable Supabase metadata

**File/lines:** `backend/core/auth/supabase_auth.py` line 17.

**Evidence:**

```python
self.is_staff = self.metadata.get('is_admin', False) or self.metadata.get('role') == 'admin'
```

`self.metadata = user_data.user_metadata or {}` (line 47). `user_metadata` is editable by the user via the Supabase JS auth API (`supabase.auth.updateUser({ data: {...} })`); `app_metadata` is server-only.

**Root cause:** chose `user_metadata` instead of `app_metadata`.

**Impact:** if BUG-2 is fixed but RLS still trusts the JWT's claim, a user can promote themselves by updating their own metadata client-side. Combined with BUG-2 unfixed, the impact compounds.

**Fix:**

```python
app_metadata = getattr(user_data, 'app_metadata', None) or {}
self.is_staff = bool(app_metadata.get('is_admin') or app_metadata.get('role') == 'admin')
```

Then migrate any existing admin flags from `user_metadata` to `app_metadata` in Supabase (admin-only operation).

**Validation:** add a test that mocks `auth.get_user` returning a user whose `user_metadata.is_admin=True` and `app_metadata={}`, and assert `request.user.is_staff is False`.

---

### [RISK-3] — MEDIUM — Frontend has no `tsconfig.json`, so TypeScript is never type-checked

**File/lines:** `frontend/` directory.

**Evidence:**

```
$ ls /sessions/.../bunik/frontend/tsconfig*
ls: cannot access 'tsconfig*': No such file or directory
$ cat frontend/package.json | grep -E 'lint|test|tsc'
    "lint": "echo \"No lint config yet\"",
    "test": "echo \"No frontend tests yet\""
```

Vite transpiles `.tsx` to JS without type-checking; `npm run build` will succeed even when types are broken.

**Root cause:** project was scaffolded from a Vite + React + JS template, then `.tsx` was added without bringing in a `tsconfig`. There are no test/lint scripts either.

**Impact:** real type errors are invisible. Examples spotted by eye in `frontend/src/app/types/api.ts` and `frontend/src/app/services/api.ts`:

- `ApiUserRanking.id` is `number` in `types/api.ts`, but the backend returns the Supabase `user.id` UUID string (`backend/core/api/views.py` line 99 — `'id': row.get('id')`). The frontend types are silently wrong.
- `ApiAchievement` has no `award_id` mentioned in `types/api.ts` as required for the create payload, yet `addMyAchievement` requires it.
- `ApiMajorRecommendation.id` is `string` but backend assigns `program.get('id')` which is a UUID string — OK; but `code` and `name` could be `null` from the DB and aren't typed as such.

**Fix:** add a minimal `frontend/tsconfig.json` and wire `tsc --noEmit` into `npm run lint`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "src/app/components/ui"]
}
```

Add `typescript`, `@types/react`, `@types/react-dom` to `devDependencies`, then `npm run lint` becomes `tsc --noEmit`.

**Validation:** the first run will likely flag dozens of errors — that's the point.

---

## 3. Bugs and Reliability Risks (medium / low)

### [BUG-5] — `Province.region` schema vs. frontend display

`migration_v4.sql` line 12 constrains region to `('Bắc', 'Trung', 'Nam')`. `frontend/src/app/services/api.ts` line 314 defaults to `'Mien Bac'` when `provinces.region` is missing, and `toUiUniversity` then renders the DB value directly. Result: the live data shows `'Bắc'/'Trung'/'Nam'` for connected rows but `'Mien Bac'` for unconnected ones — inconsistent labelling in the same list. Fix: pick one (the DB form) and normalize at the adapter boundary.

### [BUG-6] — `_paginate_rows` calls `parse_int_param` twice without sharing minimum/maximum

`backend/core/api/views.py` lines 33–34 and `backend/src/academics/views.py` lines 281–282 each re-implement pagination parsing with different maxima (`100` vs. `200`). `core/supabase_client.py` exports a `paginate(request, query)` you can use for queryset-backed pagination, but there's no single helper for row-list pagination. Result: a client asking `page_size=150` gets paged at 150 from `MajorCatalogViewSet.list` but capped at 100 from `RankingsListView`. Fix: extract one helper.

### [BUG-7] — Login swallows the profile-missing case as a 500

`backend/core/auth/views.py` lines 177–180:

```python
profile_resp = _profile_by_id(profile_client, user_id)
if not profile_resp.data:
    logger.error('Profile missing for gmail=%s', data['gmail'])
    return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

A user who confirmed their email but whose profile row was never inserted (register-flow partial failure) cannot log in and gets a 500. They get a generic "system error" message and no way out. Fix: detect this case, re-issue the same profile insert (or surface a 409 with a recovery code).

### [BUG-8] — Logout treats every error as a 500, including expired tokens

`backend/core/auth/views.py` lines 472–484. `_is_invalid_credentials_error` is matched on the string `'invalid login credentials'` from `sign_in_with_password`; Supabase's `sign_out` returns different error strings (e.g., `Auth session missing`). An already-expired token therefore returns 500 instead of 401. Fix: also match `'jwt expired'`, `'auth session missing'`, `'token has expired'`.

### [BUG-9] — `MajorCatalogViewSet.list` `.or_` filter mixes a related-table column with own columns

`backend/src/academics/views.py` lines 300–305:

```python
query = query.or_(
    f'major_code.ilike.%{search}%,'
    f'program_name.ilike.%{search}%,'
    f'major_catalog.name.ilike.%{search}%'
)
```

`major_catalog.name` is on the joined table. PostgREST allows this only via the `embedded.or` syntax (`major_catalog.or=(name.ilike.…)`), not via a comma-joined top-level `or`. The clause is silently treated as a malformed filter on `university_programs`. Fix: split into two queries (one filtering by joined name, one by own columns) and union client-side, or change the schema design.

### [BUG-10] — `_split_csv_param` empties on the form `program_ids=,`, then PostgREST still filters

`backend/src/admissions/views.py` line 190: `if program_ids := _split_csv_param(params.get('program_ids')):`. When the caller sends `program_ids=,abc`, `_split_csv_param` strips the empty, leaving `['abc']`. OK. When the caller sends just `program_ids=`, `_split_csv_param` returns `[]`, so the filter is skipped. OK. But when the user sends `program_ids=invalid-uuid`, PostgREST returns a 4xx that's caught only by the global handler. Add a UUID sanity-check before the IN filter.

### [BUG-11] — `LogoutView.post` does not invalidate the Bearer token in Supabase reliably

`get_user_client(access_token).auth.sign_out()` — `sign_out` with a fresh user-scoped client sometimes throws because the client wasn't created via `sign_in`. The intended call is `client.auth.admin.sign_out(jwt)` from a server-side client with the service key. Without that, the token is still valid until natural expiry, and "Đăng xuất" is purely cosmetic. Fix: keep the service-role key server-side and call `admin.sign_out` (or `admin.delete_session`).

### [BUG-12] — `Login` returns refresh_token but no refresh endpoint exists

`backend/core/auth/views.py` line 188 returns `refresh_token`, and `frontend/src/app/components/Layout.tsx` line 46 stores it. There is no `POST /api/auth/refresh/` route in `backend/core/auth/urls.py`, and `frontend/src/app/services/api.ts` has no `refreshToken` function. The stored refresh token is dead weight. Either add the endpoint or drop the field.

---

## 4. Duplicate and Inconsistent Code

### Duplicate pagination helpers

`paginate(request, query)` in `core/supabase_client.py` (lines 115–142) and `_paginate_rows(request, rows)` in `core/api/views.py` (lines 32–42) and `src/academics/views.py` (lines 39–45 — `_static_paginated_payload`) all implement page/page_size slicing, with different defaults and maxima (DEFAULT_PAGE_SIZE 20, MAX_PAGE_SIZE 100, but `academics.MajorCatalogViewSet.list` allows 200). Consolidate into `core/api/pagination.py` with one `paginate_query`, one `paginate_rows`, one set of constants, and import everywhere.

### Duplicate error-string-matching predicates

`_is_duplicate_error`, `_is_invalid_credentials_error`, `_is_rate_limited_error`, `_is_rls_error`, `_is_missing_column_error` are defined in `core/auth/views.py` lines 81–103, and `is_supabase_error` is re-derived inline in `core/errors/handlers.py` lines 16–21 and again inside `execute_with_retry` (`core/supabase_client.py` lines 92–112). All of them substring-match `str(exc).lower()`. Consolidate into `core/supabase_client/errors.py` with one classifier returning an enum, and use it from auth views, the error handler, and the retry helper.

### Duplicate UUID/embedded-select strings in views

`UniversityProgramViewSet._SELECT` (`src/admissions/views.py` line 66) and `AdmissionScoreViewSet._SELECT` (line 146) each repeat the embed `universities!university_programs_university_short_name_fkey(...)`. Extract a constant per related table so renaming the FK doesn't require chasing four call sites.

### Duplicate `.env` look-alikes

`backend/.env`, `backend/.env.example`, `backend/.env.test`, `backend/.env.test.local`, `backend/.env_used_for_check`. `.env.test.local` is a byte-for-byte copy of `.env.test`, and `.env_used_for_check` is also identical. Pick one canonical `.env.test`, delete the rest, and document which file pytest reads.

### Inline `style={...}` blocks duplicated across all pages

`frontend/src/app/pages/*.tsx` repeat the same hand-drawn card styling (`background, borderRadius, border, boxShadow`) and the orange palette (`#ff947a, #5B4FCF, #1A1A2E, #4A4A6A, #9090AA`) ~6× per page. Extract a small `styles/tokens.ts` and a `<HandCard>` component; this is the right shared abstraction.

---

## 5. Dead, Stale, or Unused Code

| Item | Confidence | How verified |
|---|---|---|
| `backend/db.sqlite3` exists despite `DATABASES = {}` (settings/base.py line 55) and the app having no Django models. | High | `find backend -name db.sqlite3` returns one file; `grep -rn "models.Model" backend/src` returns 0 hits. |
| `frontend/src/app/data/mockData.ts` — file is ~600 lines of mock university and major data with mojibake (`Äáº¡i há»c`) but only `getTierColor`, `getTierThreshold`, `getTierBg` are used (`grep -rn "from.*mockData" frontend/src` shows just two import sites). | High | Imports are only `getTierColor` and `getTierThreshold` (see grep output in evidence). The mock arrays are imported nowhere. |
| `getTierBg` exported from `mockData.ts` line 600 — never imported. | High | `grep -rn getTierBg frontend/src` returns one definition and zero usages. |
| `backend/src/academics/views.py` lines 131–142 — see BUG-3. | High | Confirmed by `grep -n scores_by_program src/academics/views.py`. |
| `backend/core/auth/permissions.py::IsStaffWriteOrReadOnly` and `IsSupabaseAuthenticated`. | High | `grep -rn "IsStaffWriteOrReadOnly\|IsSupabaseAuthenticated" backend/` returns only the definitions. The intended write-protection is implemented per-view with `IsAuthenticated` + an `is_staff` check. |
| `backend/core/auth/supabase_auth.py::SupabaseTokenAuthentication` (line 57). | High | Subclass with no overrides; `grep -rn SupabaseTokenAuthentication backend/` returns the one definition. |
| `backend/.env_used_for_check`. | High | Not referenced by any settings file. |
| `frontend/dist/` — built artifacts tracked in git. | Medium | `git ls-files frontend/dist/` returns hashed bundle files; `dist/` is in `.gitignore`. Likely added before `.gitignore` was updated. Worth `git rm -r --cached frontend/dist`. |
| Old code-review files (`code-review-2026-05-10.md` through `code-review-2026-06-14.md`). | Medium | These are valid historical artifacts but consume 25 review files at the repo root. Move to `docs/reviews/`. |

---

## 6. Dependency, Config, and Tooling Concerns

- **Drift between `.env.example`, `.env.test`, `.env.test.local`, `.env_used_for_check`.** All four have the same body. Suggest keeping `.env.example` (documented placeholders) and `.env.test` (real test fixtures) and deleting the other two.
- **`backend/requirements/base.txt` pins `Django==5.0.1`** which is already on the 5.0.x security branch but behind `5.0.14` (latest 5.0 patch). Bump to `5.0.*` or `5.2.*` depending on your support policy.
- **`frontend/package.json` "react": "18.3.1"` is in `peerDependencies` with `optional: true`** but the app imports React directly. Move `react` and `react-dom` into `dependencies`; the current setup works only because npm installs optional peers in development.
- **`frontend/package.json` lacks `lint` and `test` scripts** — both are `echo` no-ops. See RISK-3.
- **`frontend/vite.config.ts`** ships `figmaAssetResolver()` plugin that resolves `figma:asset/<file>` imports to `src/assets/`. `grep -rn 'figma:asset/' frontend/src` returns 0 hits — the plugin is currently dead. Keep it only if you're still pulling Figma exports; otherwise delete.
- **`backend/docker-compose.yml` references `${POSTGRES_DB}` etc.,** but `.env.example` documents `SUPABASE_DB_*` instead. The compose file's `db` service is also pointless if the app talks to Supabase via REST (DATABASES = {}); the `web` service can't connect to local Postgres because there's no Django ORM. Either: drop the `db` service, or wire the Django ORM in and drop Supabase.
- **`backend/Dockerfile` `pip install -r base.txt`** but does not install `dev.txt`, which is fine for prod but means `gunicorn` runs without pytest. The image also doesn't copy `requirements/dev.txt`, so multi-stage builds need both.
- **`backend/.vscode/settings.json`** is committed despite `.vscode/` being in `.gitignore` (line 38). `git rm -r --cached backend/.vscode` or remove it from the ignore.
- **`backend/conftest.py` has an unused `authenticated_client` fixture** that's literally `return api_client`. Remove or implement.

---

## 7. Test Gaps

These should exist and currently don't:

- `POST /api/scores/bulk-upsert/` when the unique constraint is absent → assert PostgREST 4xx and propagated 5xx with a meaningful code (would have caught BUG-1).
- `POST /api/scores/bulk-upsert/` should call `get_user_client(access_token)`, not `get_client()` → mock raises if `get_client()` is called (would catch BUG-2).
- `core.auth.supabase_auth.SupabaseUser.__init__` when only `user_metadata.is_admin=true` (no `app_metadata`) → assert `is_staff is False` once you migrate to `app_metadata`.
- `_major_overview_rows` with two rows for the same `(program_id, last_year)` → assert the response's `score_30` is the max, not the last-seen.
- `MajorCatalogViewSet.list` with `search=…` that matches only on `major_catalog.name` → currently broken (BUG-9), so test should fail today.
- `MajorTrendsView` when `_last_year()` has no scores → assert empty `results: []`, not a crash.
- `RegisterView.post` when Supabase returns a user but no session (email confirmation required) → assert 400 with the `Can xac minh email` message (this path exists but is uncovered).
- `RankingsListView` when a user has `null` for `full_name` and `user_name` → currently returns `'Nguoi dung'`; assert that and the rank ordering still holds.
- `ProfileView.put`/`.patch` with `score_fields` only (no `user_fields`) → assert the `users` table is NOT touched (current code returns the profile fine, but there's no test).

---

## 8. Quick Wins (under 1 hour each)

1. Delete dead loop in `backend/src/academics/views.py` lines 131–142.
2. Remove `frontend/src/app/data/mockData.ts` mock arrays; keep only `getTierColor` and `getTierThreshold`. Move those to `frontend/src/app/data/tiers.ts`.
3. Add `frontend/tsconfig.json` (RISK-3) and switch `lint`/`test` scripts to `tsc --noEmit`.
4. Replace `permission_classes=[IsAuthenticated]` + inline `is_staff` check in `bulk_upsert` with the unused `IsStaffWriteOrReadOnly` from `core/auth/permissions.py`.
5. Delete `backend/.env.test.local` and `backend/.env_used_for_check`.
6. `git rm -r --cached backend/.vscode frontend/dist backend/db.sqlite3` and re-commit so the tree matches `.gitignore`.
7. Hoist the orange palette and `handCard` style into `frontend/src/app/styles/tokens.ts`.
8. Add `auth.session missing` / `jwt expired` to `_is_invalid_credentials_error` matchers (BUG-8).
9. Remove `LoginResponse.refresh_token` from the API response (BUG-12) — or add `/api/auth/refresh/`.
10. Delete the unused `SupabaseTokenAuthentication` subclass in `core/auth/supabase_auth.py` line 57.
11. Move the 25 historical `code-review-*.md` files into `docs/reviews/` to clear the root.

---

## 9. Larger Improvements

Sequenced by blast radius (lowest first).

1. **Reissue `docs/`** — write a single `docs/api.md` generated from `python manage.py spectacular`, and delete the four stale files. Failure mode if done wrong: stale doc still around. Low risk.
2. **Pick one source of truth for unique constraints** (BUG-1) — restore the v4 constraint or migrate `bulk_upsert` to `(source, source_id)`. Test against a real Postgres before deploy. Failure mode if done wrong: silent dedup breakage on import.
3. **Consolidate Supabase client usage** — every privileged write goes through `get_user_client(access_token)`. Audit grep: `grep -rn "get_client()\.table" backend/` and ensure each call site is read-only or has a deliberate reason to use anon. Failure mode if done wrong: RLS denies and writes fail; ship behind a feature flag.
4. **Move admin flag to `app_metadata`** (RISK-2). One-time migration of the existing user-metadata flag plus a backfill script. Failure mode if done wrong: current admins lose access until migrated.
5. **Add `tsconfig.json` and fix the type errors** (RISK-3). Will produce a backlog of small fixes; do them in one PR or in waves. Failure mode if done wrong: extracts `strict: true` errors that block CI for everyone — land behind a `tsc --noEmit | grep -v "^src/app/components/ui"` filter at first.
6. **Replace the delete-then-recreate save** in `HoSoPage.tsx` (BUG-4) with a diff-based save or a `bulk-replace` endpoint. Failure mode if done wrong: the user's already-saved achievements are still wiped. Do it server-side (one transaction) for safety.
7. **Audit RLS for every table the API touches.** Currently the API trusts DRF auth and forwards the JWT in some cases, the anon key in others. Document each table's policies in `database/RLS.md`.

---

## 10. Prioritized Action Checklist

1. Patch BUG-1 (admission_scores constraint or upsert key) — production write path.
2. Patch BUG-2 (bulk_upsert uses `get_user_client(token)`) — together with #1.
3. Patch RISK-2 (`app_metadata` for `is_admin`) — security.
4. Delete BUG-3 dead loop in `src/academics/views.py`.
5. Add `frontend/tsconfig.json` and switch `npm run lint` to `tsc --noEmit`.
6. Fix BUG-4 with a `bulk-replace` endpoint and a diff-based save.
7. Rewrite or delete `docs/API_ENDPOINTS.md`, `docs/API_ENDPOINT.md`, `docs/backend/FILE_REFERENCE.md`, `docs/backend/DEPLOYMENT.md`.
8. Delete duplicates: `.env.test.local`, `.env_used_for_check`, `SupabaseTokenAuthentication`, the unused `IsStaffWriteOrReadOnly`/`IsSupabaseAuthenticated`, and the `mockData.ts` arrays.
9. Fix BUG-9 (`MajorCatalogViewSet.list` joined-table search).
10. Patch BUG-8 (logout error classification) and BUG-12 (drop or implement `refresh_token`).
11. Consolidate pagination helpers (BUG-6) and error-classifier predicates.
12. `git rm -r --cached frontend/dist backend/.vscode backend/db.sqlite3` to align tree with `.gitignore`.
13. Move historical code-review files into `docs/reviews/`.
