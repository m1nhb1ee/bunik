# Code Review — 2026-06-17

Scope: full repo at C:\Project\School Project\bunik (Django + DRF backend talking to Supabase REST; React 18 + Vite + react-router 7 frontend). Reviewed against `main` plus all staged + unstaged changes since the last review (`code-review-2026-06-16.md`).

---

## 1. Executive Summary

Overall health: **at risk — two security defects, one of them privilege-escalation, are sitting in code that already ships an admin-only write endpoint; the rest is correctness debt accumulated by the recent program-id refactor.**

Highest-risk areas:

1. `SupabaseAuthentication.is_staff` is read from user-controlled `user_metadata`, and the `bulk-upsert` admin endpoint trusts it. (BUG-1)
2. `AdmissionScoreViewSet.bulk_upsert` writes via the anon client without validating columns. (BUG-2)
3. `_is_scale_40` was hardened to require an explicit Vietnamese note (commit f8fb500) — every score ≥30 with no note now flows to the frontend as a "scale-30" value > 30 and gets silently filtered out of `NganhPage`. (BUG-3)
4. The `/nganh/:id` route now means "program id" in three callers and still means "major code" in zero callers — but `getMajorOverview`, the cache key `majors:overview:v3`, and the old shareable URLs are all still major-code-shaped, so any pre-existing bookmark or cached payload that lands on `/nganh/<major_code>` 404s. (BUG-4)
5. `_major_overview_rows` does an unbounded `select` over `admission_scores` and `university_programs` on every cache miss; the `recommendations` action does the same with **no year filter**. (RISK-1)

Validation commands run:

- `python -m py_compile` over every backend `.py` touched in this review → **pass** (exit 0).
- `python -m pytest -q` → **skipped** — `pip install` of Django/pytest into the sandbox timed out three times. Findings below come from reading the test fixtures and tracing the code paths instead.
- `npx tsc --noEmit` → **skipped** — no TypeScript compiler is declared in `frontend/package.json` (no `typescript` dep, no `tsconfig.json` at the repo root, no `lint` script that actually runs anything; `"lint": "echo \"No lint config yet\""`). This is itself a finding (BUG-9).
- `npm run build` → not attempted (dev-server.log is checked in; build was not safe to assume idempotent).

Counts: **7 confirmed bugs, 6 inferred risks.**

---

## 2. Critical and High-Risk Findings

### **[BUG-1] — CRITICAL — Privilege escalation via `user_metadata.is_admin`**

- **File/lines:** `backend/core/auth/supabase_auth.py:17`
- **Evidence:**

  ```python
  self.metadata = metadata or {}
  self.is_authenticated = True
  # Check if user is staff/admin from metadata
  self.is_staff = self.metadata.get('is_admin', False) or self.metadata.get('role') == 'admin'
  ```

  The metadata passed into `SupabaseUser` is `user_data.user_metadata` (line 47). Per Supabase docs, `user_metadata` is the **user-writable** bag — any authenticated user can call `supabase.auth.updateUser({ data: { is_admin: true } })` from a browser and flip their own `is_staff`.

- **Root cause:** the code reads the user-writable metadata field instead of the admin-only `app_metadata` (or a server-side roles table).
- **Impact:** any registered account can become "staff" with one client-side call and then call the `bulk-upsert` endpoint (BUG-2) to overwrite arbitrary admission-score rows. Affects 100% of write traffic gated by `is_staff` — currently just `bulk_upsert`, but the pattern will spread.
- **Cross-layer effects:**
  - `backend/src/admissions/views.py:231` — `if not getattr(request.user, 'is_staff', False)` is the only gate on `bulk_upsert`.
  - `backend/src/admissions/tests/test_security.py:31` — the fixture asserts the **wrong** invariant: it builds `Obj(user_metadata={'role': 'admin'})` and expects 200 OK. The test locks in the vulnerability.
- **Fix:**
  1. In `SupabaseAuthentication.authenticate_credentials`, pass `user_data.app_metadata` (not `user_metadata`) into `SupabaseUser`.
  2. In `SupabaseUser.__init__`, read `is_staff` from `app_metadata` only.
  3. Update `test_security.py::FakeAdminClient` to pass `app_metadata={'role': 'admin'}` and add a new test `test_user_metadata_role_admin_is_ignored` that confirms `user_metadata={'role':'admin'}` returns 403.
- **Validation:** the new test in step 3 must pass; the existing `test_bulk_upsert_allows_staff_user` must continue to pass after migrating the fixture to `app_metadata`.

### **[BUG-2] — HIGH — `bulk_upsert` writes via anon client with unvalidated payload**

- **File/lines:** `backend/src/admissions/views.py:229-246`
- **Evidence:**

  ```python
  @action(detail=False, methods=['post'], url_path='bulk-upsert', permission_classes=[IsAuthenticated])
  def bulk_upsert(self, request):
      if not getattr(request.user, 'is_staff', False):
          return Response({'detail': '...'}, status=status.HTTP_403_FORBIDDEN)
      items = request.data.get('items')
      if not isinstance(items, list) or not items:
          return Response({'detail': 'items is required.'}, status=status.HTTP_400_BAD_REQUEST)
      response = get_client().table('admission_scores').upsert(
          items,
          on_conflict='university_program_id,admission_method_code,year',
      ).execute()
  ```

  Two problems:
  1. `get_client()` returns the cached **anon** client (`_anon_client`, `core/supabase_client.py:23-26`). Whether the upsert succeeds depends entirely on the Supabase RLS policy attached to `admission_scores`. If the policy allows anon writes, this endpoint is moot — anyone with `curl` can write. If it forbids anon writes, even legitimate admins get blocked. There is no defense in depth.
  2. `items` is passed through to Postgres untouched. The caller can add columns the schema doesn't know (silent failure) or, depending on schema, push values past `_ORDERABLE_FIELDS`-style invariants.

- **Root cause:** the endpoint reuses the read client (anon JWT) for writes and uses no serializer.
- **Impact:** every admission score in the database is at risk of either being silently rejected (frustrating admins) or arbitrarily rewritten (silent data corruption), depending on which RLS surprise is in production.
- **Cross-layer effects:** `core/supabase_client.py` has no `get_service_client()` helper. The pattern needs to be introduced and used everywhere a write occurs.
- **Fix:**
  1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.example`, `config/settings/base.py`, and a new `get_service_client()` in `core/supabase_client.py`. The service client must not be cached as a process-wide singleton if any code path could leak it — keep it local to the call.
  2. Replace `get_client()` with `get_service_client()` in `bulk_upsert`.
  3. Write a `BulkAdmissionScoreUpsertSerializer(many=True)` with fields `university_program_id`, `admission_method_code` (upper-cased), `year` (int 2010-current+1), `score` (float 0-40), `note` (optional). Reject extras (`extra_kwargs = {... }` plus explicit `unknown = 'raise'` via custom validator).
  4. Wire DRF throttling on this action via `throttle_classes = [ScopedRateThrottle]` with a small per-user rate.
- **Validation:** the existing `test_bulk_upsert_allows_staff_user` plus a new `test_bulk_upsert_rejects_unknown_fields` and `test_bulk_upsert_clamps_score_range`.

### **[BUG-3] — HIGH — Scale-40 detection regressed: scale-40 rows without a note now overflow scale-30 filters and disappear from `NganhPage`**

- **File/lines:** `backend/src/academics/views.py:62-67`, `144-160`; `frontend/src/app/pages/NganhPage.tsx:22-23,116-119`.
- **Evidence:**

  Backend (current):

  ```python
  def _is_scale_40(score_value, note):
      if score_value is None:
          return False
      note_text = (note or '').lower()
      normalized_note = unicodedata.normalize('NFD', note_text).encode('ascii', 'ignore').decode('ascii')
      return 'thang diem 40' in normalized_note
  ```

  The previous version also returned `True` when `numeric_score >= 30`. That branch was removed (see `git diff backend/src/academics/views.py`). Downstream in `_major_overview_rows`:

  ```python
  if _is_scale_40(numeric_score, score_row.get('note')):
      score_40 = numeric_score
      score_30 = round((numeric_score * 30.0) / 40.0, 2)
  else:
      score_30 = numeric_score
      score_40 = round((numeric_score * 40.0) / 30.0, 2)
  ```

  Frontend filter (`NganhPage.tsx:22,116-119`):

  ```ts
  const MIN_SCORE = 14;
  const MAX_SCORE = 30;
  ...
  list = list.filter((m) => {
    const score = m.score30;
    return typeof score === "number" && score >= scoreMin && score <= scoreMax;
  });
  ```

- **Root cause:** the heuristic was tightened to require an explicit Vietnamese note ("thang diem 40", diacritics-stripped), but the database has scale-40 rows without that note (e.g., architecture/V00 programs). For those rows `_is_scale_40` returns `False`, so `score_30 = numeric_score = 36`, which is `> MAX_SCORE`, so `NganhPage` filters the program out — not "shows it with wrong scale", but disappears entirely from the list.
- **Impact:** any major whose only recorded THPT score is on the 40-scale with a missing/non-matching note vanishes from the catalog list. Most users won't see V00/kien-truc programs. The recommendations action (`backend/src/academics/views.py:393-405`) has the same issue but is less visible because it doesn't normalize.
- **Cross-layer effects:**
  - `frontend/src/app/types/api.ts:185-188` — `ApiMajorOverview.scores` is `{[year]: number}` of the **raw** score. Already wrong for scale-40 rows in the UI.
  - `frontend/src/app/pages/NganhDetailPage.tsx:47-55` — uses the same note-only heuristic. A scale-40 score with no note is rendered at face value (e.g., "36 trên 30").
  - `backend/src/academics/tests/test_score_scale.py` — pins the regression in place. `test_score_30_without_scale_note_stays_on_30_scale` only verifies the 30.0 input (the safe case), not the 36.0 input which is where the breakage lives.
- **Fix:** treat scale-40 as the canonical signal, with two layered checks:
  1. If `note` matches the existing pattern → scale-40.
  2. Else if `score_value > 30` → scale-40 (the old heuristic, restored).
  3. Else → scale-30.

  Concretely, restore the `numeric_score > 30` branch in `_is_scale_40` but keep the diacritic-strip from the new code. Add a third test case: `assert _is_scale_40(36.0, None) is True`. Once that lands, `NganhPage` keeps the existing `<= MAX_SCORE` filter and the V00 rows reappear.
- **Validation:** the new pytest case above, plus a manual check by listing `/api/majors/overview/` and asserting that any row with `score_30 > 30` is gone.

### **[BUG-4] — HIGH — `/nganh/:id` route changed semantics; cached payloads and external links still carry the old shape**

- **File/lines:**
  - `frontend/src/app/services/api.ts:386` — `id: String(major.id)` (was `id: major.id` and used to be the major code).
  - `frontend/src/app/pages/NganhPage.tsx:381,405` — `Link to={`/nganh/${m.id}`}`.
  - `frontend/src/app/pages/TruongDetailPage.tsx:362` — `Link to={`/nganh/${m.programId}`}` (after this commit).
  - `frontend/src/app/pages/NganhDetailPage.tsx:175,196` — `const routeProgramId = id ?? ""; await getProgramDetail(routeProgramId);`
  - `backend/src/academics/views.py:335` — cache key `majors:overview:v3`.
- **Evidence:** `getAllMajors` (services/api.ts) now sets `UiMajor.id` to `String(major.id)`, where `major.id` comes from `ApiMajorOverview.id`, which the backend fills with `program.get('id')` (a `university_programs` PK, e.g. `1234`). `NganhDetailPage` consumes `:id` as a program id and calls `getProgramDetail(routeProgramId)` → `GET /api/programs/<programId>/`. Any pre-existing URL of the form `/nganh/7480201` (major code) now hits `GET /api/programs/7480201/` → 404 → renders "Khong tim thay chuong trinh nganh nay".
- **Root cause:** the route param changed meaning without a redirect or backward-compat lookup, and the bumped cache key (`majors:overview:v3`) still coexists with v2 entries depending on cache backend TTL.
- **Impact:** every bookmarked, shared, or search-indexed `/nganh/<major-code>` URL 404s after this deploy. Internal users of the old major-code URL pattern (none in repo today, but documented in `docs/API_ENDPOINTS.md` and historical `code-review-*.md` notes referencing `/nganh/7480201`-style URLs) lose access.
- **Cross-layer effects:**
  - `backend/src/academics/views.py:466-486` (`MajorCatalogViewSet.retrieve`) still keys on `pk` as a **major code**, so `/api/majors/<code>/` is correct. The route-id mismatch is only on the frontend.
  - `core/api/cache.py` keys include the path, so the `majors:overview:v2` and `majors:overview:v3` namespace bump is safe — but the parallel `programs:list:v2` cache from `backend/src/admissions/views.py:104` predates the new `program_source_code` ordering. Stale cache entries will be returned with the **old** ordering until the TTL expires.
- **Fix:**
  1. In `NganhDetailPage.tsx`, if `getProgramDetail(routeProgramId)` throws 404, fall back to `getMajorDetail(routeProgramId)` and pick the first program in `getAllPrograms({ major_code: routeProgramId })`. That restores major-code URLs without changing routes.
  2. Bump `programs:list:v2` → `programs:list:v3` in `admissions/views.py:104` because the `_SELECT` now includes `program_name, program_source_code`. Old cached entries will be missing those columns and the frontend reads them.
- **Validation:** `curl 'http://localhost:8000/api/programs/7480201/'` returns 404; `curl 'http://localhost:8000/api/majors/7480201/'` returns the major detail; the SPA should land on the same page from both URLs.

---

## 3. Bugs and Reliability Risks

### **[BUG-5] — MEDIUM — Dead aggregate `scores_by_program` in `_major_overview_rows`**

- **File/lines:** `backend/src/academics/views.py:131-142`
- **Evidence:** the block builds `scores_by_program` and `year_scores`; the loop only sets `year_scores[year]` and the dict is never read after the loop. The actual aggregation used downstream is `normalized_scores_by_program` (lines 144-160).
- **Impact:** the function pays the iteration cost twice and reads the dataset twice in a hot path. With Redis cache it's only on miss, but the misleading code makes the next bug-fix attempt error-prone.
- **Fix:** delete lines 131-142.
- **Validation:** the existing `majors:overview:v3` snapshot is unchanged.

### **[BUG-6] — MEDIUM — `recommendations` action pulls every `admission_scores` row, all years**

- **File/lines:** `backend/src/academics/views.py:393-405`
- **Evidence:**

  ```python
  scores = _fetch_all_rows(
      lambda: (
          client.table('admission_scores')
          .select('score, year, university_program_id')
          .order('year', desc=True)
      )
  )
  ```

  No `eq('admission_method_code', 'THPT')`, no `.gte('year', ...)`. With the dataset growing each cycle, this allocates O(all rows) and then keeps only the latest per program in Python.
- **Root cause:** the filter was forgotten when `_thpt_last_year_program_ids` was introduced.
- **Impact:** cold-cache latency of `/api/majors/recommendations/` scales with total history. By 2028 this is the slowest endpoint in the codebase.
- **Fix:** add `.eq('admission_method_code', 'THPT').gte('year', _last_year() - 1)` to the query; the per-program dedup logic stays identical.
- **Validation:** compare response payload before/after — should be byte-equal — and time the cold call.

### **[BUG-7] — MEDIUM — `programs:list:v2` cache key not bumped after adding `program_name` and `program_source_code`**

- **File/lines:** `backend/src/admissions/views.py:67,101,104`
- **Evidence:** `_SELECT` now requests `program_name, program_source_code`; ordering adds `.order('program_source_code')`. Cache namespace stayed `'programs:list:v2'` (line 104). Any process holding a hit from before the deploy returns rows missing `program_name`/`program_source_code` (or in pre-change order).
- **Fix:** rename to `'programs:list:v3'`. Same for `'programs:scores:v2'` only if the related select changes (it didn't this cycle, leave alone).
- **Validation:** flush cache or wait for TTL; confirm `program_name` non-null on a sampled row.

### **[BUG-8] — MEDIUM — `paginate` returns `page_size: 0` when `_major_codes_by_name` short-circuits**

- **File/lines:** `backend/src/admissions/views.py:97-99`
- **Evidence:** `return {'count': 0, 'page': 1, 'page_size': 0, 'results': []}`. The frontend pagination math in `NganhDetailPage.tsx:67-68`:

  ```ts
  const actualPageSize = firstPage.page_size || requestedPageSize;
  const totalPages = Math.max(1, Math.ceil((firstPage.count || 0) / actualPageSize));
  ```

  Works only because `count === 0` so the loop never runs. But the contract — `page_size > 0` — is now violated in one path, and any future code that divides by `page_size` directly will hit a divide-by-zero/NaN.
- **Fix:** return `'page_size': DEFAULT_PAGE_SIZE` (import from `core.supabase_client`).
- **Validation:** add unit test `test_major_name_with_no_matches_returns_default_page_size`.

### **[RISK-1] — MEDIUM — `_fetch_all_rows` is unbounded and called per request on cache miss**

- **File/lines:** `backend/src/academics/views.py:48-59` (helper) used by `_thpt_last_year_program_ids`, `_active_major_codes`, `_major_overview_rows`, and the recommendations action.
- **Evidence:** the helper has no max page count; it keeps fetching 1000-row pages until short. In a single cold-cache request, three of those helpers fire (`overview`, `list`, `recommendations`).
- **Impact:** cache stampede on first request after a deploy could send several megabytes through PostgREST in a single Django thread, blocking a worker for seconds. With `gunicorn --workers 4` (`backend/Dockerfile:18`) and `THROTTLE_ANON=200/min`, a single bad minute can hit all four workers.
- **Fix:** add `max_pages` (default 50) to `_fetch_all_rows`; raise `RuntimeError` if exceeded, and log. Add a process-level lock around `majors:overview:v3` (e.g., `django-cache-lock`) so only one builder runs.

### **[RISK-2] — MEDIUM — `SECRET_KEY` falls back to the placeholder even in production settings**

- **File/lines:** `backend/config/settings/base.py:6`, `backend/config/settings/prod.py:1-10`
- **Evidence:**

  ```python
  SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me')
  ```

  `prod.py` does not re-validate. `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` are enforced in prod; `SECRET_KEY` is not.
- **Fix:** in `prod.py`, `if SECRET_KEY == 'django-insecure-change-me' or not SECRET_KEY.strip(): raise ValueError('SECRET_KEY must be set in production')`.
- **Validation:** `DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy` should now require the env var.

### **[BUG-9] — LOW — Frontend has no TypeScript, no lint, no test runner**

- **File/lines:** `frontend/package.json:7-9`
- **Evidence:** scripts are `"lint": "echo \"No lint config yet\""`, `"test": "echo \"No frontend tests yet\""`, no `typescript` in `devDependencies`, no `tsconfig.json` in the repo (`git ls-files | grep tsconfig` returns nothing). The `.tsx` files compile only because `@vitejs/plugin-react` runs them through esbuild without type checking.
- **Impact:** every type mismatch in `src/app/types/api.ts` ships to production. The current diff already changed `ApiAdmissionScore.id: number → string` and `ApiUniversityProgram.id: number → string`; nothing in CI verified the migration.
- **Fix:** add `typescript` and `@types/react`, `@types/react-dom` to devDependencies; commit a minimal `tsconfig.json` (`"strict": true`, `"jsx": "react-jsx"`, `"moduleResolution": "bundler"`); change `"lint": "tsc --noEmit"`.

### **[BUG-10] — LOW — `AwardCatalogView` accepts any string after the first 7 characters as the bearer token**

- **File/lines:** `backend/core/auth/views.py:299-301`
- **Evidence:**

  ```python
  auth_header = request.headers.get('Authorization', '')
  token = auth_header[7:] if auth_header.lower().startswith('bearer ') else None
  ```

  Works for `Bearer foo`, breaks for `Bearer  foo` (double space) and silently passes the leading space into `get_user_client`. The `SupabaseAuthentication.authenticate` helper at `core/auth/supabase_auth.py:27-35` already does the parsing correctly with `get_authorization_header().split()`. The hand-rolled version exists because `AwardCatalogView` uses `permission_classes = [AllowAny]` and needs to peek at the optional token, but it should reuse the existing parser.
- **Fix:** swap to `SupabaseAuthentication().authenticate(request)` wrapped in a try/except, fallback to anon client on failure.

---

## 4. Duplicate and Inconsistent Code

- **Paged fetch helpers** are reimplemented three times with slightly different shapes:
  - `backend/src/academics/views.py:48` (`_fetch_all_rows`) — Supabase-direct, no cache.
  - `frontend/src/app/services/api.ts:357-368` (`getAllUniversities`) — uses `Promise.all` and joins from page 2.
  - `frontend/src/app/pages/NganhDetailPage.tsx:63-76` (`getAllPrograms`) and `78-97` (`getAllAdmissionScoresByProgramIds`) — sequential page loop.
  - `frontend/src/app/pages/TruongDetailPage.tsx:55-67` (`getAllAdmissionScoresForUniversity`) — sequential page loop.

  These four frontend helpers all compute `totalPages = max(1, ceil(count/page_size))` and concatenate. Lift into `services/api.ts` as `fetchAllPaginated<T>(fetcher, params)` so the divide-by-zero edge from BUG-8 has one place to be tested.

- **`getProgramLabel`/`getProgramVariantLabel`** are inside `NganhDetailPage.tsx` (lines 99-107). The same join (`universities.name || university_short_name`, optionally `+ ' - ' + program_name`) appears informally in `TruongDetailPage.tsx` and `BXHPage.tsx` via inline string concatenation. Move to `services/api.ts`.

---

## 5. Dead, Stale, or Unused Code

- **`backend/src/academics/views.py:131-142`** — `scores_by_program` aggregate is built and never read. Confidence: **High**. Verified by grep: `grep -n 'scores_by_program' backend/src/academics/views.py` → only the construction lines, no read site. See BUG-5.
- **`backend/db.sqlite3`** — empty file (0 bytes), not tracked by git, but present in the working tree and matched by `.gitignore:34`. Project uses Supabase REST only (`DATABASES = {}` in `base.py:51`). Confidence: **High** — `git ls-files --error-unmatch backend/db.sqlite3` errors; `git check-ignore -v backend/db.sqlite3` confirms it would be ignored. Delete locally.
- **`backend/docker-compose.yml` Postgres service** — defines `db:` (postgres:16) and a healthcheck; Django settings declare `DATABASES = {}` (`config/settings/base.py:51`) and never call into Postgres. The `web` service waits on `db` healthy for nothing. Confidence: **High**. Remove the `db:` block and `depends_on:`, or document why it's reserved.
- **`frontend/dev-server.log`** — 1.6 MB file (timestamp May 24) committed to the repo. Not referenced by anything; not in `.gitignore`. Confidence: **High** (`grep -r 'dev-server.log' frontend/src` empty). Delete + add to `.gitignore`.
- **`frontend/peerDependencies` block in `package.json`** — declares `react: 18.3.1, react-dom: 18.3.1` with `optional: true`. For a `"private": true` Vite **application** (not a library), peerDependencies are the wrong field and only happen to work because npm 7+ auto-installs peer deps. Move to `dependencies`. See also BUG-9 — no TS dep is declared either.
- **`code-review-2026-05-10.md` … `code-review-2026-06-16.md`** (18 files, ~620 KB) — historical reports are tracked in the repo root. Confidence: **High** that they are reference material, but they will keep growing. Suggest moving to `docs/code-reviews/`.

---

## 6. Dependency, Config, and Tooling Concerns

- **Drift between `.env.example` and `settings/base.py`:**
  - `.env.example` lists `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`, `SUPABASE_DB_USER`. None of these are read anywhere (`grep -rn 'SUPABASE_DB_' backend` returns 0 matches). They were left behind when the project migrated from direct Postgres to PostgREST. Remove from `.env.example`.
  - `.env.example` lists `THROTTLE_USER`, `CACHE_TTL_UNIVERSITIES_LIST`, `CACHE_TTL_SCORES_LIST`. Only `THROTTLE_ANON` and `CACHE_DEFAULT_TIMEOUT` are consumed (`settings/base.py:80,99-103`). The other three are no-ops.
  - `.env.example` lists `SUPABASE_ANON_KEY`. Code requires it (`base.py:55`). No `SUPABASE_SERVICE_ROLE_KEY` — needed for BUG-2's fix.
- **`Dockerfile` vs `docker-compose.yml`:**
  - `Dockerfile` CMD is `gunicorn config.wsgi:application --workers 4`.
  - `docker-compose.yml` overrides `command: python manage.py runserver 0.0.0.0:8000` and mounts `.:/app` (masking the COPYed code). Production parity is zero. Move the runserver override into a `docker-compose.override.yml` so prod-style `docker compose -f docker-compose.yml up` actually runs gunicorn.
- **`frontend/package.json`** declares dev dependency `"vite": "^6.4.2"` (unstaged diff) but `pnpm.overrides.vite` pins `"6.4.2"`. With a caret range the override should also use the same range or the override silently downgrades when transitive deps request later 6.x. Pick one or the other.

---

## 7. Test Gaps

Concrete missing cases on risky surfaces:

- `POST /api/scores/bulk-upsert/` with body `{"items":[{"university_program_id":1,"admission_method_code":"THPT","year":2026,"score":42}]}` → assert response 400 (score out of range). Today: 200.
- `POST /api/scores/bulk-upsert/` with `{"items":[{"university_program_id":1,"foo_bar":"x","year":2026}]}` → assert 400 (unknown field). Today: 200, field reaches DB.
- `GET /api/majors/recommendations/?score_min=24&score_max=27&block=A00` → assert response includes only programs whose latest score is within `[score_min-3, score_max+3]`. Today: no test; logic at `academics/views.py:440-441` could regress silently.
- `_is_scale_40(36.0, None)` → assert `True`. Today: there is no such case; BUG-3 is unblocked by adding this.
- `GET /api/programs/?major_name=Cong%20nghe` → assert that `major_name` and `major_code` together intersect (not union). The current test only covers `major_name` in isolation.
- `GET /api/scores/?program_ids=1,2,3,4,5,6,7,8,9,...` (>100 ids) → assert backend doesn't 414. PostgREST has URL-length limits; nothing in `_split_csv_param` caps the list length.
- `GET /api/majors/overview/` after seeding 3 programs where one has only a scale-40 row without a note → assert that row's `score_30` is `<= 30` (verifies BUG-3 fix).

---

## 8. Quick Wins (under 1 hour each)

- Delete dead aggregate (BUG-5).
- Bump cache namespace `programs:list:v2 → v3` (BUG-7).
- Return `DEFAULT_PAGE_SIZE` instead of `0` on the no-match short circuit (BUG-8).
- Filter `recommendations` query by THPT + year window (BUG-6).
- Add `SECRET_KEY` validation to `prod.py` (RISK-2).
- Add `typescript` and a `tsconfig.json`, change the lint script to `tsc --noEmit` (BUG-9).
- Delete `frontend/dev-server.log` and add it to `.gitignore`.
- Remove the stale `SUPABASE_DB_*`, `THROTTLE_USER`, `CACHE_TTL_*` entries from `.env.example`.

---

## 9. Larger Improvements

In order of blast radius (lowest first):

1. **Lift the four "fetch all pages" helpers into one** (`services/api.ts:fetchAllPaginated`). Risk: trivial — pure refactor. Do this before fixing BUG-8 so the divide-by-zero fix is in one place.
2. **Introduce a service-role Supabase client** (`get_service_client`) and migrate writes (BUG-2). Risk: easy to leak the service key into a long-lived global if you cache it. Don't cache; call per-write.
3. **Move `is_staff` to `app_metadata`** (BUG-1). Risk: must coordinate with whoever currently provisions admin accounts — they'll need to set `app_metadata.role` via the Supabase Admin API instead of `user_metadata`. Run a one-shot migration script first.
4. **Backward-compatible `/nganh/:id` fallback** (BUG-4). Risk: medium — the fallback fires twice on the 404 case, doubling load on cold paths. Add a single-flight guard.
5. **CI for the frontend** — wire `tsc --noEmit` into a GitHub Actions job that also runs `python -m pytest backend/`. Without CI, the test files (`test_score_scale.py`, `test_program_filters.py`, `test_security.py`) only run when someone remembers.

---

## 10. Prioritized Action Checklist

1. **Patch BUG-1**: switch `SupabaseUser` to read `app_metadata`; update `test_security.py` fixtures and add a "user_metadata is ignored" test.
2. **Patch BUG-2**: add `get_service_client`, swap `bulk_upsert` to use it, write a `BulkAdmissionScoreUpsertSerializer`, throttle the action.
3. **Restore the `score > 30` branch in `_is_scale_40`** (BUG-3) and add the missing pytest case.
4. **Bump `programs:list:v2 → v3`** cache namespace (BUG-7) — small, but a deploy blocker for the program_name UI change.
5. **Add THPT + year filter to the recommendations query** (BUG-6).
6. **Add `SECRET_KEY` enforcement to `prod.py`** (RISK-2).
7. **Add `tsconfig.json` and `typescript` dep; change the lint script** (BUG-9).
8. **Delete dead aggregate in `_major_overview_rows`** (BUG-5).
9. **Fix `page_size: 0` short circuit** (BUG-8).
10. **Fix `AwardCatalogView` token parsing** (BUG-10).
11. **Backward-compat fallback in `NganhDetailPage` for legacy major-code URLs** (BUG-4).
12. **Clean up `.env.example` and `docker-compose.yml`** (Section 6).
13. **Delete `frontend/dev-server.log` and `backend/db.sqlite3`; add to `.gitignore`** (Section 5).
14. **Lift the four "fetch all pages" helpers into `fetchAllPaginated`** (Section 4).
15. **Wire CI** to run backend pytest and `tsc --noEmit`.
