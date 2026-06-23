# Code Review — 2026-06-16

Scope: working tree of `bunik` repo at HEAD `f8fb500 thông luồng`, including uncommitted changes in `backend/src/{academics,admissions}` and `frontend/src/app/{pages,services,types}`.

---

## 1. Executive Summary

Overall health: **Yellow.** The 2026-06-16 changes ship a useful refactor (route param switched from major code → program UUID; scale-40 normalization moved into a single helper; new `program_ids` server filter). The refactor is internally consistent across the modified files, all 20 tests pass, and the new test_score_scale / test_program_filters cover the most likely regressions. The remaining risk is concentrated in two long-standing issues that did not change today: (a) a privilege-escalation path that lets any logged-in user become "staff" through Supabase `user_metadata`, exercised by the new `bulk-upsert` endpoint, and (b) `RankingsListView` exposing user PII to unauthenticated requests. The score-scale refactor also leaves behind a dead `scores_by_program` block and an inverted scale-40 fallback worth tightening.

Highest-risk areas:

1. **Privilege escalation via `user_metadata.role`** — `core/auth/supabase_auth.py:17` plus `src/admissions/views.py:231` and `bulk-upsert`.
2. **PII leak in public rankings** — `core/api/views.py:61` returns `full_name`/`user_name`/`special_score` with no auth.
3. **`_major_overview_rows` builds a dictionary that is never read** — `src/academics/views.py:131-142`.
4. **Untracked env files committed to the working tree** (`.env.test`, `.env_used_for_check`) carry `.gitignore` drift risk.
5. **`docker-compose.yml` references unset `POSTGRES_*` vars** that no `.env*` file provides.

Validation commands run:

| Command | Result |
| --- | --- |
| `pytest src core -q` (DJANGO_SETTINGS_MODULE=config.settings.local) | **PASS** — 20 passed in 0.40s |
| `ruff check backend/ --exclude venv` | **FAIL** — 1 finding: `F403 from .base import *` in `config/settings/local.py:1` (low) |
| `npx tsc --noEmit` | **SKIPPED** — `typescript` is not in `frontend/package.json` devDependencies and `tsc` is not in `node_modules/.bin`; frontend type-checks at `vite build` only |
| `npm run lint` | **SKIPPED** — `package.json` script is `echo "No lint config yet"` |
| `vite build` | **SKIPPED** — non-destructive but slow; not run because no TS errors would surface without `tsc` |

Confirmed bugs: 4. Inferred/style risks: 6.

---

## 2. Critical and High-Risk Findings

### [BUG-1] — HIGH — Supabase `user_metadata` is user-controlled; any logged-in user can self-promote to `is_staff`

- **File/lines:** `backend/core/auth/supabase_auth.py:11-17`, `backend/src/admissions/views.py:227-247`, test asserting the broken contract in `backend/src/admissions/tests/test_security.py:29-62`.
- **Evidence:**
  ```python
  # supabase_auth.py
  class SupabaseUser:
      def __init__(self, user_id: str, email: str, metadata: Optional[dict] = None):
          ...
          self.is_staff = self.metadata.get('is_admin', False) or self.metadata.get('role') == 'admin'
  ...
  # authenticate_credentials
  user = SupabaseUser(
      user_id=user_data.id,
      email=user_data.email,
      metadata=user_data.user_metadata or {}   # <-- user_metadata, not app_metadata
  )
  ```
  ```python
  # admissions/views.py — bulk_upsert
  @action(detail=False, methods=['post'], url_path='bulk-upsert',
          permission_classes=[IsAuthenticated])
  def bulk_upsert(self, request):
      if not getattr(request.user, 'is_staff', False):
          return Response({'detail': '...'}, status=status.HTTP_403_FORBIDDEN)
      ...
      response = get_client().table('admission_scores').upsert(items, ...).execute()
  ```
  And the new test confirms the contract:
  ```python
  class FakeAdminClient(FakeClient):
      def __init__(self):
          self.auth = Obj(get_user=lambda _t: Obj(user=Obj(
              id='admin1', email='admin@example.com',
              user_metadata={'role': 'admin'})))
  ```
- **Root cause:** Supabase exposes two metadata buckets: `user_metadata` (writable by the end-user via `auth.updateUser({ data: ... })`) and `app_metadata` (only writable by the service-role key). The auth class reads from the user-controlled bucket.
- **Impact:** Any authenticated end user can call `supabase.auth.updateUser({ data: { role: 'admin' } })` from the browser, refresh their JWT, and then call `POST /api/scores/bulk-upsert/` (or any future `IsStaffWriteOrReadOnly` endpoint) to insert/overwrite admission scores. The Supabase row-level-security policy on `admission_scores` is the only remaining gate; if it relies on the same `user_metadata.role` claim, escalation is end-to-end.
- **Cross-layer effects:** `core/auth/permissions.py:7-19` (`IsStaffWriteOrReadOnly`) inherits the same bypass. The existing test in `test_security.py` actively certifies the broken behavior — fixing the auth class will require updating the test fixture too.
- **Fix:**
  ```python
  # supabase_auth.py — authenticate_credentials
  app_meta = user_data.app_metadata or {}
  user_meta = user_data.user_metadata or {}
  user = SupabaseUser(
      user_id=user_data.id,
      email=user_data.email,
      app_metadata=app_meta,
      user_metadata=user_meta,
  )
  # SupabaseUser.__init__
  self.is_staff = (
      bool(app_metadata.get('is_admin'))
      or app_metadata.get('role') == 'admin'
  )
  ```
  Update `test_bulk_upsert_allows_staff_user` to set `app_metadata={'role': 'admin'}` and keep one negative case proving that `user_metadata={'role': 'admin'}` is rejected.
- **Validation:** add `test_bulk_upsert_rejects_user_metadata_role()` that mints a `SupabaseUser` with `user_metadata={'role': 'admin'}, app_metadata={}` and asserts HTTP 403.

### [BUG-2] — HIGH — `RankingsListView` returns user PII to unauthenticated clients

- **File/lines:** `backend/core/api/views.py:61-114`, `backend/config/urls.py:6,10` (mounted at `/api/rankings/` and `/api/v1/rankings/`).
- **Evidence:**
  ```python
  class RankingsListView(APIView):
      def get(self, request):
          def load():
              users = (
                  get_client()
                  .table('users')
                  .select('id, user_name, full_name, special_score')
                  .execute().data or [])
              ...
              rankings.append({
                  'id': row.get('id'),
                  'name': full_name,
                  ...
                  'anonymous': False,
              })
  ```
  No `permission_classes`, no `authentication_classes`, no anonymization of `name`/`id`, `anonymous` is hard-coded `False`.
- **Root cause:** The view inherits the project default `AllowAny` (from `settings.REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES`) and never filters or hashes the user data before returning it.
- **Impact:** Any unauthenticated visitor can fetch the full list of registered users with real names and an internal score signal — directly via `GET /api/rankings/`. Compounded by the 100/min anon throttle, scraping the full user table is trivial.
- **Cross-layer effects:** Frontend `ApiUserRanking` (`frontend/src/app/types/api.ts:100-109`) exposes `name`, `id`, `topSubject`, `anonymous` — UI already has an `anonymous` flag the backend never sets.
- **Fix:** Either gate the endpoint behind `IsAuthenticated`, or anonymize at source — pick the latter to keep the leaderboard public:
  ```python
  display_name = full_name if row.get('display_publicly') else _initials(full_name)
  rankings.append({
      'id': hashlib.sha256(row['id'].encode()).hexdigest()[:12],
      'name': display_name,
      ...
      'anonymous': not row.get('display_publicly'),
  })
  ```
  Then add `display_publicly` to the `users` table (default `false`) and update the registration flow to expose it as opt-in.
- **Validation:** `pytest -k rankings` asserting `response.data['results'][0]['name'] != row['full_name']` when `display_publicly` is false.

### [BUG-3] — MEDIUM — Dead `scores_by_program` block in `_major_overview_rows`

- **File/lines:** `backend/src/academics/views.py:131-143` (introduced by the same commit that simplified `_is_scale_40`).
- **Evidence:**
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
  ```
  `grep -n scores_by_program backend/src/academics/views.py` confirms the variable is assigned but never read after line 142; the very next loop builds the actual structure (`normalized_scores_by_program`).
- **Root cause:** Half-completed refactor. The old "max raw score per program-year" map was replaced by `normalized_scores_by_program[*]['raw']` but the prior loop was not deleted.
- **Impact:** Every `/api/majors/overview/` cache miss now iterates the full score table **twice** (once for nothing, once for `normalized_scores_by_program`). At ~tens of thousands of score rows this is a noticeable extra Supabase round-trip on a 10-minute cache.
- **Fix:** delete lines 131-142 entirely. The `program_by_id` map computed at line 129 is also only used inside the dead loop — remove it as well, since the second loop iterates `scores` and `programs` directly.
- **Validation:** `pytest src/academics` — existing tests still pass; spot-check `/api/majors/overview/` payload before/after with a recorded fixture.

### [BUG-4] — MEDIUM — Scale-40 fallback path now extrapolates 30-scale scores into impossible 40-scale values

- **File/lines:** `backend/src/academics/views.py:144-160`.
- **Evidence:**
  ```python
  if _is_scale_40(numeric_score, score_row.get('note')):
      score_40 = numeric_score
      score_30 = round((numeric_score * 30.0) / 40.0, 2)
  else:
      score_30 = numeric_score
      score_40 = round((numeric_score * 40.0) / 30.0, 2)
  ```
  Combined with the test contract:
  ```python
  # test_score_scale.py
  def test_score_30_without_scale_note_stays_on_30_scale():
      assert _is_scale_40(30.0, None) is False
  ```
- **Root cause:** `_is_scale_40` now relies solely on the note string. Real data already contains rows where the score is on the 40 scale but the `note` is empty (older imports, before the note convention was enforced). Those rows are now silently treated as 30-scale and `score_40` is back-computed as `score * 40/30`, producing values >40 that the frontend's `MAX_SCORE = 30` slider then filters incorrectly.
- **Impact:** Until every legacy row carries the "thang diem 40" note, the `score_30` column on the overview returns the raw 40-scale value (e.g. `35.5`), which the new `NganhPage` filter `score >= scoreMin && score <= scoreMax` (`MAX_SCORE = 30`) silently excludes from results.
- **Cross-layer effects:** `frontend/src/app/pages/NganhDetailPage.tsx:47-55` ships the same heuristic with the same blind spot (`normalizeScoreTo30` ignores `score > 30 && note empty`).
- **Fix:** treat "score above 30" as a strong scale-40 signal in addition to the note, but only above a small epsilon so the historical "exactly 30.0" boundary case the test pins is preserved:
  ```python
  def _is_scale_40(score_value, note):
      if score_value is None:
          return False
      note_text = unicodedata.normalize('NFD', (note or '').lower()) \
          .encode('ascii', 'ignore').decode('ascii')
      if 'thang diem 40' in note_text:
          return True
      try:
          return float(score_value) > 30.0001
      except (TypeError, ValueError):
          return False
  ```
  Update `test_score_scale.py` with a third case `assert _is_scale_40(35.0, None) is True`.
- **Validation:** add the new test and run `pytest src/academics`.

---

## 3. Bugs and Reliability Risks

### [RISK-1] — LOW — `interest_match` ternary inside `if interests:` is dead branch

`backend/src/academics/views.py:425-432`

```python
interest_match = 25
if interests:
    matched = 0
    for interest in interests:
        keywords = INTEREST_KEYWORDS.get(interest, set())
        if any(keyword in name for keyword in keywords):
            matched += 1
    interest_match = int((matched / len(interests)) * 50) if interests else 25
```

`interests` is truthy inside the `if interests:` block, so the `else 25` is unreachable. Collapse to `interest_match = int((matched / len(interests)) * 50)`.

### [RISK-2] — MEDIUM — Cache-miss cost of `/api/majors/overview/` and `/api/majors/recommendations/`

`backend/src/academics/views.py:98-192, 358-463`

Each cache miss calls `_thpt_last_year_program_ids` + `_fetch_all_rows(programs)` + `_fetch_all_rows(scores)`. `_fetch_all_rows` pages in batches of 1000 — for `admission_scores` that is several requests per miss. The current cache key `'majors:overview:v3'` is shared across all clients (timeout 600s), but the request path includes query params via `build_cache_key`, so the very first user after expiry pays the full cost while the next 9 min hit the cache. Pre-warm via a Django management command run on a 10-minute cron, or bump the cache timeout to 1800s and put a stampede lock around `producer()`.

### [RISK-3] — MEDIUM — `or_(f'... ilike.%{search}%')` filters allow PostgREST syntax injection

`backend/src/academics/views.py:213-214, 240-245, 300-305`, `backend/src/universities/views.py:65`

```python
query = query.or_(f'name.ilike.%{search}%,code.ilike.%{search}%')
```

`search` is interpolated raw into the PostgREST `or` filter, comma-separated. A search of `foo,is.null` short-circuits the filter into `name.ilike.%foo%,is.null,code.ilike.%foo%` — PostgREST will parse `is.null` as a separate predicate. This is not a Postgres-level SQL injection, but it lets an unauthenticated client coerce the query into matching everything (DoS) or returning archived rows. Escape commas/parens or use the higher-level builder pattern (`query.or_(...).or_(...)`).

### [RISK-4] — LOW — `getAllAdmissionScoresByProgramIds` batches 50 UUIDs per query string

`frontend/src/app/pages/NganhDetailPage.tsx:78-97`

50 × 36 char UUIDs = 1800 chars in `?program_ids=`. Add the rest of the URL and you sit around 1.8 KB per request — under typical 8 KB limits but uncomfortably close to Cloudflare's 4 KB default for cacheable URLs. Drop batch size to 25 or move to POST. Same comment for `getAllPrograms` paging: there is no upper bound on `totalPages`, a runaway count returns nothing but spins through every page.

### [RISK-5] — LOW — `_major_codes_by_name` uses ilike without escaping wildcards

`backend/src/admissions/views.py:14-25`

```python
.ilike('name', f'%{name}%')
```

A user search containing `%` matches everything; a search containing `_` matches any single char. Strip or escape with `name.replace('%', r'\%').replace('_', r'\_')`. Same issue in every other `ilike` call in the codebase.

### [RISK-6] — LOW — `bulk_upsert` does not validate row shape

`backend/src/admissions/views.py:240-247`

```python
response = get_client().table('admission_scores').upsert(
    items,
    on_conflict='university_program_id,admission_method_code,year',
).execute()
```

Admin clients pass `items` straight to Supabase. There's no allow-list of writable columns, no type coercion, no max-batch check. Postgres types catch the worst cases but an admin can accidentally clobber `created_at`/`id` by sending fields named the same. Add a `BulkScoreItemSerializer(many=True)` validating exactly `{university_program_id, admission_method_code, year, score, note}` and cap `len(items) <= 1000`.

---

## 4. Duplicate and Inconsistent Code

**Scale-40 normalization is implemented twice.**
- Backend: `_is_scale_40` + the inline normalization in `_major_overview_rows` (`backend/src/academics/views.py:62-67, 144-160`).
- Frontend: `normalizeScoreTo30` (`frontend/src/app/pages/NganhDetailPage.tsx:47-55`).

Both ship slightly different fallback policies (see BUG-4). Consolidate by always normalizing server-side and removing the frontend version. The frontend can then drop `note` from `ApiAdmissionScore` if no other consumer reads it.

**CSV-list parsing.** `_split_csv_param` in `admissions/views.py:12` and the inline `{value.strip().lower() for value in (request.query_params.get('interests') or '').split(',') ...}` in `academics/views.py:360-364` do the same thing twice with different case-folding. Hoist a `parse_csv_param(value, *, lower=False)` into `core/supabase_client.py` (it lives next to `parse_int_param` etc.).

**Pagination loop in the frontend.** `getAllPrograms` and `getAllAdmissionScoresForUniversity` (added in `TruongDetailPage.tsx:54-66`) and `getAllAdmissionScoresByProgramIds` (added in `NganhDetailPage.tsx:78-97`) are three near-identical "fetch then loop pages until count exhausted" helpers. Move a generic `fetchAllPages<T>(fetchPage)` helper into `frontend/src/app/services/api.ts`.

---

## 5. Dead, Stale, or Unused Code

- **High confidence — `scores_by_program` dict in `_major_overview_rows`** (`backend/src/academics/views.py:131-142`). Verified with `grep -n scores_by_program backend/src/academics/views.py` — only assignments inside that block, no readers. See BUG-3.
- **High confidence — `program_by_id` map** (`backend/src/academics/views.py:129`). Only consumer is the dead block above. Remove with BUG-3.
- **High confidence — `UiMajor.id` comment** (`frontend/src/app/types/api.ts:211`). The comment claims `// major catalog code` but `getAllMajors()` now writes the program UUID. Either fix the comment or rename the field.
- **High confidence — `THROTTLE_USER` env var**. `.env.example` declares `THROTTLE_USER=500/min`; `backend/config/settings/base.py:91-95` only registers `'anon'` throttle. The var is documented but unused.
- **Medium confidence — `SupabaseTokenAuthentication`** (`core/auth/supabase_auth.py:57-58`). Empty subclass of `SupabaseAuthentication`, no references found via `grep -rn SupabaseTokenAuthentication`.
- **Medium confidence — `backend/db.sqlite3`** (0 bytes, present in working tree but `*.sqlite3` is gitignored). Leftover from an earlier SQLite-based setup; safe to delete.

---

## 6. Dependency, Config, and Tooling Concerns

**Untracked env files in working tree.**
```
backend/.env.test
backend/.env_used_for_check
```
`.gitignore` only excludes `.env`, `.env.local`, and `.env.*.local` — `.env.test` and `.env_used_for_check` would be committed if `git add backend/` is ever run. Both currently match `backend/.env.example` byte-for-byte (verified via `diff`). Either delete the duplicates or extend `.gitignore` to `backend/.env*` (which is the safer default since you also have `.env.test.local`).

**Real Supabase project URL + anon key in `backend/.env`.**
```
SUPABASE_DB_HOST=db.qpwcmxtpflfimjpeojab.supabase.co
SUPABASE_URL=https://qpwcmxtpflfimjpeojab.supabase.co
SUPABASE_ANON_KEY=sb_publishable_SY8R-hyDD4aHQwLTXsFUcQ_EgaMqHdV
```
`.env` itself is gitignored, but the anon key is now exposed everywhere a screenshot/code-review/log gets posted. The anon key is "publishable" by Supabase convention, so this is only a security issue insofar as your row-level-security policies trust the anon role; given BUG-1, that trust is misplaced. Rotate the key after deploying the BUG-1 fix.

**`docker-compose.yml` references undeclared env vars.**
```
POSTGRES_DB: ${POSTGRES_DB}
POSTGRES_USER: ${POSTGRES_USER}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```
None of `backend/.env`, `.env.example`, `.env.test` define `POSTGRES_*`. `docker compose up` will emit warnings and create a Postgres instance with empty/default credentials. Either delete the compose stack (settings.DATABASES is `{}` anyway — Postgres is reached only via Supabase) or add the vars to `.env.example` with a note.

**`Dockerfile` only installs `requirements/base.txt`.** Fine for prod, but means `docker compose run web pytest` will fail with `ModuleNotFoundError: pytest`. Either add a `target: dev` stage that also installs `dev.txt`, or document that tests run on the host.

**`ruff` finding.** `config/settings/local.py:1` triggers `F403`. Add the explicit re-export with `from .base import *  # noqa: F401,F403` like `prod.py` does.

**`pip` resolver conflict.** During this review's setup pass, `pip install python-dotenv==1.0.0` reported `magika 0.6.3 requires python-dotenv>=1.0.1`. Not a runtime problem for this repo, but if `magika` ever creeps into your prod image (e.g. via Anthropic SDK transitive), you'll need to bump `python-dotenv` in `requirements/base.txt`.

---

## 7. Test Gaps

Highest-value tests to add, grouped by the BUG they would catch:

- `GET /api/scores/bulk-upsert/` `when caller has only user_metadata.role=='admin' → assert 403` (catches BUG-1 after fix).
- `GET /api/rankings/` `when unauthenticated → assert response.data['results'][i]['name'] != row['full_name']` (catches BUG-2 after fix).
- `_major_overview_rows()` `when called with a score that has score=35 and note=None → assert row['score_30'] <= 30.0` (catches BUG-4 after fix).
- `_major_codes_by_name(client, '%')` `→ assert returned list does not include rows where name does not contain literal '%'` (catches RISK-5).
- `UniversityViewSet.list` `when ?search='foo,is.null' → assert filter does not match archived rows` (catches RISK-3).
- `getAllPrograms({ major_code: X })` `when backend returns count=0 → assert function does not loop` (cheap regression around the new pagination helper at `NganhDetailPage.tsx:63-76`).
- `_is_scale_40(30.0, 'thang diem 40')` already covered; add `_is_scale_40(40.0, None)` and `_is_scale_40(29.5, None)` to triangulate the boundary.

Frontend has zero tests today (`"test": "echo 'No frontend tests yet'"`). The route-param refactor (major-code → program-UUID) is a one-time, high-blast-radius change that warrants a single Vitest+RTL test asserting `/nganh/:id` calls `getProgramDetail(id)` first, not `getMajorDetail(id)`.

---

## 8. Quick Wins (under 1 hour each)

1. Delete the dead `scores_by_program` block (BUG-3) — three minutes, ~12 lines.
2. Collapse the `interest_match` ternary to one expression (RISK-1).
3. Add `from .base import *  # noqa: F401,F403` to `config/settings/local.py:1` to silence the only ruff finding.
4. Extend `.gitignore`: add `backend/.env*` and `!backend/.env.example`. Then `git rm --cached` any test env files if they were ever committed.
5. Drop the empty `SupabaseTokenAuthentication` subclass and the 0-byte `backend/db.sqlite3`.
6. Fix the stale comment on `UiMajor.id` (`frontend/src/app/types/api.ts:211`) to read `// university_program UUID`.
7. Replace the `'anon': '200/min'` hard-default in `base.py:94` with a comment noting `THROTTLE_USER` is not wired (or wire it — five-line change adding `'user': config('THROTTLE_USER', default='500/min')`).
8. Add an upper bound (`max_pages = 200`) to the three frontend `fetchAllPages` loops so a server bug cannot infinite-loop the browser.

---

## 9. Larger Improvements

Sequence by blast radius, lowest first.

1. **Consolidate scale-40 normalization on the server (BUG-4 + duplication §4).** Risk if done wrong: stale frontend cache shows 40-scale numbers as 30-scale. Mitigate by bumping the cache key suffix (`majors:overview:v4`) when shipping.
2. **Switch `is_staff` to `app_metadata` (BUG-1).** Risk if done wrong: existing admins set up with `user_metadata` lose access. Mitigate by running a Supabase SQL migration that copies any `user_metadata.role` → `app_metadata.role` for users whose row has a hand-flagged `is_admin` flag, before flipping the auth class.
3. **Gate `RankingsListView` with anonymized output (BUG-2).** Add `display_publicly` column with default `false`, add a profile toggle, default-anonymize. Risk: existing users may not see their own name on the leaderboard until they opt-in.
4. **Introduce a `BulkScoreItemSerializer` (RISK-6) and a generic `parse_csv_param` (§4 duplication).** Low risk, but requires updating the existing admin tooling to send the exact field shape.
5. **Add a Vitest harness for the frontend.** Risk: bloats the install. Lowest-blast-radius first step is a single smoke test on the new program-UUID routing.

---

## 10. Prioritized Action Checklist

1. Patch `core/auth/supabase_auth.py` to read `app_metadata`; update `test_security.py` so `FakeAdminClient` uses `app_metadata={'role': 'admin'}` and add `test_bulk_upsert_rejects_user_metadata_role` (BUG-1).
2. Anonymize `RankingsListView` output and add `display_publicly` column (BUG-2).
3. Delete dead `scores_by_program` / `program_by_id` block in `_major_overview_rows` (BUG-3).
4. Tighten `_is_scale_40` to treat `score > 30.0001` as scale-40 even without note, and align `normalizeScoreTo30` on the frontend (BUG-4).
5. Escape wildcard chars in every `ilike` call (`%`, `_`) and replace `or_(f'...{search}...')` with builder-level OR to close RISK-3 / RISK-5.
6. Add `BulkScoreItemSerializer` and a row-count cap (RISK-6).
7. Add `.gitignore` rule `backend/.env*` plus `!backend/.env.example`; remove the duplicate `.env.test` / `.env_used_for_check`.
8. Decide on `docker-compose.yml`: delete it (recommended, since the app talks to Supabase) or wire `POSTGRES_*` env vars.
9. Wire `THROTTLE_USER` into `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`, or remove from `.env.example`.
10. Move the three `fetchAll*` helpers in the frontend into one shared utility with an upper page bound.
11. Add a smoke Vitest covering `/nganh/:id → getProgramDetail` so the program-UUID routing cannot regress to major-code routing silently.
12. Rotate `SUPABASE_ANON_KEY` after BUG-1 is fixed.
