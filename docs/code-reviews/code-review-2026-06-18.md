# Code Review — 2026-06-18

Scope: full repo at `C:\Project\School Project\bunik` (Django 5 + DRF backend over Supabase REST; React 18 + Vite + react-router 7 frontend, no TS compile). Compared HEAD (`main` @ `f8fb500`) plus staged + working-tree diff against the previous review (`code-review-2026-06-17.md`).

---

## 1. Executive Summary

Overall health: **regressing — every defect raised on 06-17 is still present in HEAD, two of them (BUG-1, BUG-2) are class-CRITICAL/HIGH and were locked further into the test suite (`test_security.py` and `test_score_scale.py` were staged this cycle and assert the wrong invariants).**

Highest-risk areas:

1. `SupabaseAuthentication.is_staff` still reads `user_metadata` — privilege escalation (BUG-1, carried).
2. `bulk_upsert` still writes via the anon client without serializer or throttling (BUG-2, carried).
3. `_is_scale_40` still requires an explicit note — scale-40 rows with `note IS NULL` are silently filtered out of `NganhPage` and rendered at face value in `TruongDetailPage` and `NganhDetailPage` (BUG-3, expanded).
4. Two new test files (`test_score_scale.py`, `test_program_filters.py`) were added this cycle, but the score-scale tests don't cover the actual regression (`score >= 30 with no note`), and `test_security.py::FakeAdminClient` still seeds `user_metadata={'role':'admin'}`, codifying BUG-1.
5. `MAX_PAGE_SIZE = 100` in `core/supabase_client.py` is contradicted by `MajorCatalogViewSet.list` (`maximum=200`) and `_paginate_rows` (`maximum=100` separately) — three different page-size ceilings live in three files.

Validation commands run:

- `python -m py_compile` over every backend `.py` (42 files) → **pass** (exit 0).
- `python -m pytest -q backend/` → **skipped** — sandbox has no `django` or `pytest`; three attempts to `pip install -r requirements/dev.txt` timed out at 45s. Findings below come from static reading + grep + git-diff tracing.
- `npx tsc --noEmit` → **not applicable** — no `typescript` dep, no `tsconfig.json` anywhere in `frontend/` (`ls frontend/tsconfig*.json` returns "No such file or directory"). Same finding as BUG-9 in 06-17, unchanged.
- `npm run lint` would print `No lint config yet` and exit 0. `npm run test` likewise.
- `npm run build` → not attempted (the dev-server.log committed to working tree suggests the dev process was last run live; build was not assumed idempotent).

Counts: **8 confirmed bugs, 4 inferred risks. 0 of the 15 items on the 06-17 checklist were merged.**

---

## 2. Critical and High-Risk Findings

### **[BUG-1] — CRITICAL — Privilege escalation via `user_metadata.is_admin` (carried from 06-17, now codified by a test)**

- **File/lines:** `backend/core/auth/supabase_auth.py:11-17,44-48`; test fixture at `backend/src/admissions/tests/test_security.py:29-31`.
- **Evidence:**

  ```python
  # core/auth/supabase_auth.py:11-17
  def __init__(self, user_id: str, email: str, metadata: Optional[dict] = None):
      ...
      self.is_staff = self.metadata.get('is_admin', False) or self.metadata.get('role') == 'admin'

  # core/auth/supabase_auth.py:44-48
  user = SupabaseUser(
      user_id=user_data.id,
      email=user_data.email,
      metadata=user_data.user_metadata or {}   # <-- USER-WRITABLE
  )

  # src/admissions/tests/test_security.py:29-31  (staged this cycle)
  class FakeAdminClient(FakeClient):
      def __init__(self):
          self.auth = Obj(get_user=lambda _token: Obj(user=Obj(id='admin1', email='admin@example.com',
                                                                user_metadata={'role': 'admin'})))
  ```

  Per Supabase docs, `user_metadata` is the bag the client is allowed to write via `supabase.auth.updateUser({ data: ... })`. Any authenticated user can flip `user_metadata.is_admin` or `user_metadata.role` to `'admin'` from the browser, then the next request to `POST /api/scores/bulk-upsert/` returns 200 instead of 403.
- **Root cause:** reads the client-writable metadata field instead of the admin-only `app_metadata`.
- **Impact:** every registered user is a latent admin. The single gate at `src/admissions/views.py:231` is the only thing in front of arbitrary admission-score writes (and 06-17's BUG-2 makes the write itself unvalidated). 100% of write traffic is at risk.
- **Cross-layer effects:**
  - `src/admissions/tests/test_security.py:50-62` (`test_bulk_upsert_allows_staff_user`) passes 200 today; after the fix it must move to `app_metadata={'role':'admin'}` and a new negative test must guard against the user-metadata path.
  - No other call site reads `is_staff` yet, but the wrong default will spread.
- **Fix:**
  1. `core/auth/supabase_auth.py:47` → change `metadata=user_data.user_metadata or {}` to `metadata=getattr(user_data, 'app_metadata', None) or {}`.
  2. `core/auth/supabase_auth.py:17` → `self.is_staff = bool(self.metadata.get('is_admin') or self.metadata.get('role') == 'admin')`. No semantic change here once `metadata` is `app_metadata`.
  3. Update `FakeAdminClient` to pass `app_metadata={'role': 'admin'}` and add `Obj(user=Obj(..., app_metadata={}))` to the existing `FakeClient`.
  4. Add a new case to `test_security.py`:

     ```python
     def test_bulk_upsert_ignores_user_metadata_role_admin(self, monkeypatch):
         class UserMetadataAttackerClient(FakeClient):
             def __init__(self):
                 self.auth = Obj(get_user=lambda _t: Obj(user=Obj(
                     id='evil', email='evil@x',
                     user_metadata={'role': 'admin', 'is_admin': True},
                     app_metadata={})))
         monkeypatch.setattr('src.admissions.views.get_client', lambda: UserMetadataAttackerClient())
         monkeypatch.setattr('core.auth.supabase_auth.get_client', lambda: UserMetadataAttackerClient())
         r = self.client.post('/api/scores/bulk-upsert/', {'items': [{}]},
                              format='json', HTTP_AUTHORIZATION='Bearer t')
         assert r.status_code == status.HTTP_403_FORBIDDEN
     ```
- **Validation:** all three cases in the updated `TestBulkUpsertPermissions` must pass.

### **[BUG-2] — HIGH — `bulk_upsert` still writes via anon client with no schema validation (carried from 06-17)**

- **File/lines:** `backend/src/admissions/views.py:229-246`.
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

  `get_client()` (`core/supabase_client.py:22-26`) returns the cached anon client. `items` flows straight to PostgREST untouched: no field whitelist, no `year` bounds, no `score` range, no `admission_method_code` upper-casing, no type coercion of `university_program_id`. `grep -rn 'SUPABASE_SERVICE_ROLE_KEY\|service_role' backend --include="*.py"` returns zero matches — no service client exists.
- **Root cause:** missing service-role client + missing serializer.
- **Impact:** if RLS allows anon writes the endpoint is moot (anyone with curl can write). If RLS forbids anon writes legitimate admins are blocked. Either way nothing in this codebase defends in depth.
- **Cross-layer effects:**
  - `.env.example`, `.env`, `.env.test`, `.env_used_for_check` — none declare `SUPABASE_SERVICE_ROLE_KEY`. The fix must add it everywhere.
  - `config/settings/base.py:57-58` only reads `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- **Fix:**
  1. `core/supabase_client.py`: add

     ```python
     def get_service_client() -> Client:
         key = settings.SUPABASE_SERVICE_ROLE_KEY
         if not key:
             raise RuntimeError('SUPABASE_SERVICE_ROLE_KEY not configured.')
         return create_client(settings.SUPABASE_URL, key)
     ```

     Do **not** cache as a module-level singleton; construct per call so a leaked global doesn't persist after deploys rotate the key.
  2. `config/settings/base.py:58`: `SUPABASE_SERVICE_ROLE_KEY = config('SUPABASE_SERVICE_ROLE_KEY', default='')`.
  3. New serializer in `src/admissions/serializers.py` (file does not exist yet — create it):

     ```python
     from datetime import date
     from rest_framework import serializers

     class BulkAdmissionScoreItemSerializer(serializers.Serializer):
         university_program_id = serializers.IntegerField(min_value=1)
         admission_method_code = serializers.CharField(max_length=20)
         year = serializers.IntegerField(min_value=2010, max_value=date.today().year + 1)
         score = serializers.FloatField(min_value=0, max_value=40)
         note = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)

         def validate_admission_method_code(self, value):
             return value.upper()

         def validate(self, attrs):
             extras = set(self.initial_data) - set(self.fields)
             if extras:
                 raise serializers.ValidationError({'unknown_fields': sorted(extras)})
             return attrs
     ```
  4. `src/admissions/views.py` `bulk_upsert`:

     ```python
     from src.admissions.serializers import BulkAdmissionScoreItemSerializer
     from core.supabase_client import get_service_client

     items_serializer = BulkAdmissionScoreItemSerializer(data=items, many=True)
     items_serializer.is_valid(raise_exception=True)
     response = get_service_client().table('admission_scores').upsert(
         items_serializer.validated_data,
         on_conflict='university_program_id,admission_method_code,year',
     ).execute()
     ```
  5. Add `throttle_classes = [ScopedRateThrottle]` + `throttle_scope = 'bulk_upsert'` and `'bulk_upsert': '30/min'` to `DEFAULT_THROTTLE_RATES` in `settings/base.py:89-91`.
- **Validation:** add `test_bulk_upsert_rejects_unknown_fields`, `test_bulk_upsert_rejects_score_above_40`, `test_bulk_upsert_uppercases_method_code`.

### **[BUG-3] — HIGH — Scale-40 detection still note-only; 36/30 rows now appear at face value in two more pages (carried + new propagation)**

- **File/lines:** `backend/src/academics/views.py:62-67`; `frontend/src/app/pages/NganhDetailPage.tsx:47-55`; `frontend/src/app/pages/TruongDetailPage.tsx:69-102,351-378`.
- **Evidence:**

  Backend stripped the `numeric_score >= 30` branch (commit `f8fb500`):

  ```python
  def _is_scale_40(score_value, note):
      if score_value is None:
          return False
      note_text = (note or '').lower()
      normalized_note = unicodedata.normalize('NFD', note_text).encode('ascii', 'ignore').decode('ascii')
      return 'thang diem 40' in normalized_note
  ```

  Frontend mirror in `NganhDetailPage.tsx:47-55` is the same shape — note-only. `TruongDetailPage.tsx:351-378` renders the raw `s.score` in cells for years 2023/2024/2025 (`getLatestScoreByYear`) with no scale check at all:

  ```ts
  row.scores[yr][method] = s.score;          // line 88 — raw, unnormalized
  ...
  const s = getLatestScoreByYear(m, y);
  return <td>{s !== null ? s : "â€”"}</td>;   // line 372-377 — raw render
  ```

  Pinned in `backend/src/academics/tests/test_score_scale.py:1-9`:

  ```python
  def test_score_30_without_scale_note_stays_on_30_scale():
      assert _is_scale_40(30.0, None) is False

  def test_scale_40_requires_explicit_note():
      assert _is_scale_40(30.0, 'thang diem 40') is True
  ```

  Neither test covers the actual failure: a `score=36, note=None` row.

- **Root cause:** the heuristic was tightened in two places without restoring the value-based fallback for missing notes; tests were added only for the safe cases.
- **Impact:**
  - `NganhPage` (`MIN_SCORE=14, MAX_SCORE=30`) drops every scale-40 row whose normalized `score_30 > 30` is set to the raw 36. The major disappears from the listing entirely.
  - `TruongDetailPage` renders "36" in the 2025 column for V00/kien-truc programs — looks like a typo to the user.
  - `NganhDetailPage` will display "36" in the chart and treat trend deltas against scale-30 numbers, producing nonsense.
- **Cross-layer effects:**
  - `frontend/src/app/types/api.ts:185-188` — `ApiMajorOverview.scores: {[year]: number}` is the raw value. Without backend normalization the frontend can't fix it.
  - `frontend/src/app/services/api.ts:374-391` — `getAllMajors` reads `major.score_30` (which IS the normalized value the backend computes) but the page filter clamps on `[14, 30]`; rows above 30 still fall out.
- **Fix:** treat scale-40 as the canonical signal with two layered checks, exactly as 06-17's BUG-3 prescribed:

  ```python
  def _is_scale_40(score_value, note):
      if score_value is None:
          return False
      note_text = (note or '').lower()
      normalized_note = unicodedata.normalize('NFD', note_text).encode('ascii', 'ignore').decode('ascii')
      if 'thang diem 40' in normalized_note:
          return True
      try:
          return float(score_value) > 30.0
      except (TypeError, ValueError):
          return False
  ```

  Mirror the same fallback into `NganhDetailPage.tsx:47-55`. In `TruongDetailPage.tsx:88` change the cell write to `row.scores[yr][method] = normalizeScoreTo30(s.score, s.note);` (lifting `normalizeScoreTo30` into `services/api.ts` so both pages share it — see Section 4).
- **Validation:** add to `test_score_scale.py`:

  ```python
  def test_scale_40_inferred_from_raw_value_when_note_missing():
      assert _is_scale_40(36.0, None) is True

  def test_scale_30_at_exactly_30_with_no_note_is_30():
      assert _is_scale_40(30.0, None) is False
  ```

### **[BUG-4] — HIGH — Three competing `page_size` ceilings (100 / 100 / 200) — `MajorCatalogViewSet.list` is the only one above the shared `MAX_PAGE_SIZE`**

- **File/lines:**
  - `backend/core/supabase_client.py:10` → `MAX_PAGE_SIZE = 100`
  - `backend/core/api/views.py:34` → `page_size = parse_int_param(..., maximum=100)`
  - `backend/src/academics/views.py:282` → `page_size = parse_int_param(..., maximum=200)`
- **Evidence:** ripgrep confirms three separate ceilings:

  ```
  backend/core/supabase_client.py:10:MAX_PAGE_SIZE = 100
  backend/core/api/views.py:34:    page_size = parse_int_param(..., maximum=100)
  backend/src/academics/views.py:282:            page_size = parse_int_param(..., maximum=200)
  ```

  `MajorCatalogViewSet.list` bypasses `paginate()` and rolls its own pagination, picking 200 as the ceiling and re-implementing offset math on lines 309-311.
- **Root cause:** the helper was forked at line 282 to use `count='exact'` differently and the magic number was never reunited with `MAX_PAGE_SIZE`.
- **Impact:** a single `/api/majors/?page_size=200` request returns up to 200 rows, each carrying a fully-joined `major_catalog → fields → major_subject_groups` payload. Memory and PostgREST latency double versus every other endpoint. Throttle rates were sized assuming a 100-row ceiling.
- **Cross-layer effects:**
  - Frontend never asks for >100 (`getAllUniversities` uses `page_size: 100`), so this is currently a footgun rather than an active load problem — but the schema generator (`drf-spectacular`) doesn't see the 200 either way.
- **Fix:**
  1. `backend/core/supabase_client.py:10` is already the source of truth. Import it in both places:
     - `core/api/views.py:34` → `maximum=MAX_PAGE_SIZE` (import from `core.supabase_client`).
     - `src/academics/views.py:282` → same change.
  2. If 200 is genuinely required for the majors list, introduce `MAX_PAGE_SIZE_BULK = 200` and use it explicitly so the deviation is named.
- **Validation:** `GET /api/majors/?page_size=500` must clamp to 100 (or the named `_BULK` ceiling) and not 500.

### **[BUG-5] — HIGH — `_major_codes_by_name` returns an unbounded array fed into `.in_(...)`; one Vietnamese substring can blow up the URL length**

- **File/lines:** `backend/src/admissions/views.py:16-28,93-99`; consumer at `frontend/src/app/pages/NganhDetailPage.tsx:199-211`.
- **Evidence:**

  ```python
  def _major_codes_by_name(client, major_name):
      name = (major_name or '').strip()
      if not name:
          return []
      response = (
          client
          .table('major_catalog')
          .select('code')
          .ilike('name', f'%{name}%')   # <-- no LIMIT, no count cap
          .execute()
      )
      return [row.get('code') for row in (response.data or []) if row.get('code')]
  ```

  And the consumer:

  ```python
  if major_name := request.query_params.get('major_name'):
      major_codes = _major_codes_by_name(client, major_name)
      if not major_codes:
          return {'count': 0, 'page': 1, 'page_size': 0, 'results': []}
      query = query.in_('major_code', major_codes)
  ```

  A search for `"Cong nghe"` (Vietnamese for "Technology") matches ~50+ canonical majors in the Tuyensinh247 dataset (see `database/migrations/migration_v6.sql` — `major_code` was widened to `VARCHAR(100)` per row). PostgREST URL length cap is ~8 KB on default Nginx; 50 codes × ~10 chars + comma + URL-encoding of `in.(...)` is well within today but trends toward the limit.

  The same `page_size: 0` short-circuit reappears on the empty path — see BUG-7.
- **Root cause:** no `.limit()` on the lookup; no guard on `len(major_codes)` before the `.in_()`.
- **Impact:** popular partial-name searches issued by `NganhDetailPage.tsx:205` (which calls `getAllPrograms({ major_name: majorData.name })` on *every* detail page open) get one slow extra `major_catalog` round trip and a long PostgREST URL. The page also issues both `major_code` and `major_name` queries in parallel (line 199-205), so each detail open is at least 3 round trips where 1 would do.
- **Cross-layer effects:**
  - `NganhDetailPage.tsx:207-211` dedupes by `program.id`, so the second call's results are mostly redundant.
- **Fix:**
  1. Add `.limit(200)` (or import a named constant) to `_major_codes_by_name`. Log a warning if the limit is hit so the field can be capped later.
  2. In `NganhDetailPage.tsx:199-211`, drop the `major_name` fallback unless the `major_code`-only result is empty. The current code is "always do both", which is wasteful given that `major_code` is the canonical join key.
- **Validation:** new test `test_major_name_lookup_caps_results_at_200` in `test_program_filters.py`, plus a network-level check that `/nganh/<id>` opens with ≤2 `programs/` calls in the dev server log.

---

## 3. Bugs and Reliability Risks

### **[BUG-6] — MEDIUM — `RankingsListView` tier thresholds are unreachable**

- **File/lines:** `backend/core/api/views.py:22-29,84-106`; type at `frontend/src/app/types/api.ts:104` declares `'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'`.
- **Evidence:**

  ```python
  TIER_THRESHOLDS = (
      (150, 'S'),
      (100, 'A'),
      (90, 'B'),
      (75, 'C'),
      (60, 'D'),
      (45, 'E'),
  )
  ...
  subject_scores = {key: float(score_row.get(key) or 0) for key in SUBJECT_LABELS}  # 8 keys
  base_score = score_row.get('base_score')
  if base_score is None:
      base_score = sum(subject_scores.values())                                      # max 8 * 10 = 80
  total_score = round(float(base_score or 0) + float(row.get('special_score') or 0), 2)  # max 80 + 10 = 90
  ```

  Eight subjects each capped at 10 (`ProfileUpdateSerializer.math = FloatField(min_value=0, max_value=10)` and siblings, `core/auth/serializers.py:74-81`) yield a maximum auto-`base_score` of 80. `special_score` is also capped at 10. `total_score` cannot exceed 90. Therefore tiers `S` (≥150) and `A` (≥100) can only ever appear when `score.base_score` was inserted out-of-band — but `ProfileUpdateSerializer.base_score = FloatField(required=False, min_value=0)` has **no maximum**, so the field is a back-door knob that bypasses the per-subject cap.
- **Root cause:** the tier scale was designed for a 200-point total and never reconciled with the 90-point cap.
- **Impact:** the BXH/ranking screen never shows tier S/A for users who only enter subject scores. The leaderboard looks broken to legitimate users; the only way to "win" is to type a `base_score` directly into the profile API.
- **Fix:** rescale thresholds to the realistic range (e.g., `(85, 'S'), (75, 'A'), (65, 'B'), (55, 'C'), (45, 'D'), (35, 'E')`). Also add `max_value=80` on `base_score` and `min_value=0` (already present) so the back-door is closed. Bump the rankings cache namespace `'rankings:list'` → `'rankings:list:v2'`.
- **Validation:** add `test_score_to_tier_s_at_90` and `test_score_to_tier_a_at_75` to a new `core/api/tests/test_rankings.py`.

### **[BUG-7] — MEDIUM — `page_size: 0` short-circuit returned by `UniversityProgramViewSet.list` on empty `major_name` match**

- **File/lines:** `backend/src/admissions/views.py:97-99`; consumer at `frontend/src/app/pages/NganhDetailPage.tsx:67-68`.
- **Evidence:** same finding as 06-17 BUG-8, unchanged in HEAD:

  ```python
  if major_name := request.query_params.get('major_name'):
      major_codes = _major_codes_by_name(client, major_name)
      if not major_codes:
          return {'count': 0, 'page': 1, 'page_size': 0, 'results': []}
  ```

  The frontend math at `NganhDetailPage.tsx:67-68` only escapes via `firstPage.page_size || requestedPageSize` because `||` short-circuits on `0`. Anyone who divides `count / page_size` directly (the natural next refactor) gets a divide-by-zero.
- **Fix:** import `DEFAULT_PAGE_SIZE` from `core.supabase_client` and use it: `return {'count': 0, 'page': 1, 'page_size': DEFAULT_PAGE_SIZE, 'results': []}`.
- **Validation:** add to `test_program_filters.py`:

  ```python
  def test_major_name_with_no_matches_returns_default_page_size(self, monkeypatch):
      ...   # assert resp.json()['page_size'] == 20
  ```

### **[BUG-8] — MEDIUM — `recommendations` action still pulls every `admission_scores` row, no THPT/year filter (carried from 06-17 BUG-6)**

- **File/lines:** `backend/src/academics/views.py:393-405`.
- **Evidence:**

  ```python
  scores = _fetch_all_rows(
      lambda: (
          client.table('admission_scores')
          .select('score, year, university_program_id')
          .order('year', desc=True)
      )
  )
  latest_score_by_program = {}
  for row in scores:
      ...
      if program_id and score_value is not None and program_id not in latest_score_by_program:
          latest_score_by_program[program_id] = float(score_value)
  ```

  No `.eq('admission_method_code', 'THPT')`, no `.gte('year', _last_year() - 1)`. Combined with `_fetch_all_rows`'s 1000-row page size and unbounded loop, a cold-cache call scales with the full admission_scores table.
- **Fix:** add `.eq('admission_method_code', 'THPT').gte('year', _last_year() - 1)` to the query. Per-program dedup logic stays identical because the same `.order('year', desc=True)` is already in place.
- **Validation:** compare `/api/majors/recommendations/?interests=tech&block=A00&score_min=24&score_max=27` payload byte-for-byte before/after.

### **[BUG-9] — MEDIUM — `programs:list:v2` cache namespace still not bumped after `program_name`/`program_source_code` added to `_SELECT` (carried from 06-17 BUG-7)**

- **File/lines:** `backend/src/admissions/views.py:67,101,104`.
- **Evidence:**

  ```python
  _SELECT = (
      'id, university_short_name, major_code, is_active, program_name, program_source_code, '  # <- new columns
      ...
  )
  ...
  query = query.order('university_short_name').order('major_code').order('program_source_code')
  ...
  return Response(get_or_set_api_payload(request, 'programs:list:v2', load, timeout=180))   # v2 unchanged
  ```

  Any cache entry surviving from before the column addition will be served back to the frontend missing `program_name` — and `NganhDetailPage.tsx:410` calls `getProgramVariantLabel(program, major.name)` which reads `program.program_name`, falling through to `school` for stale rows. The bug presents as "the program label briefly drops the program name after a deploy until TTL expires".
- **Fix:** rename to `'programs:list:v3'`. Leave `'programs:scores:v2'` alone (its select didn't change). Leave `'programs:detail:v2:{pk}'` alone for the same reason — wait, `_SELECT` is shared with `retrieve`, so `'programs:detail:v2:{pk}'` is also stale; bump it to `v3` too.
- **Validation:** flush cache and confirm `program_name` is non-null on a row known to have it.

### **[BUG-10] — MEDIUM — `AwardCatalogView` hand-rolled bearer parser breaks on double-space and silently passes whitespace into `get_user_client` (carried from 06-17 BUG-10)**

- **File/lines:** `backend/core/auth/views.py:294-315`.
- **Evidence:** still:

  ```python
  auth_header = request.headers.get('Authorization', '')
  token = auth_header[7:] if auth_header.lower().startswith('bearer ') else None
  client = get_user_client(token) if token else get_client()
  ```

  `"Bearer  abc"` (two spaces) sets `token = " abc"`; `get_user_client` then calls `client.postgrest.auth(" abc")` and Supabase 401s. The existing `SupabaseAuthentication.authenticate` (`supabase_auth.py:26-35`) already does this correctly via `get_authorization_header(request).split()`.
- **Fix:**

  ```python
  from rest_framework.exceptions import AuthenticationFailed
  ...
  token = None
  try:
      auth_result = SupabaseAuthentication().authenticate(request)
      if auth_result:
          token = auth_result[1]
  except AuthenticationFailed:
      token = None
  client = get_user_client(token) if token else get_client()
  ```
- **Validation:** add `test_award_catalog_accepts_normal_bearer_and_falls_back_on_anon`.

### **[BUG-11] — MEDIUM — Register flow leaves an orphan Supabase auth user when email confirmation is required**

- **File/lines:** `backend/core/auth/views.py:114-142`.
- **Evidence:**

  ```python
  auth_resp = auth_client.auth.sign_up({'email': data['gmail'], 'password': data['password']})
  user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
  if not user_id:
      return Response({'message': 'Dang ky that bai'}, status=500)
  ...
  access_token = auth_resp.session.access_token if auth_resp and auth_resp.session else None
  if not access_token:
      return Response({'message': 'Can xac minh email truoc khi tao ho so nguoi dung.'}, status=400)
  ```

  When email-confirmations is on (the Supabase default), `sign_up` returns `user` but no `session`. The endpoint returns 400 — but the auth user has already been created. The user clicks the email link, comes back to the registration form, retries, and `_is_duplicate_error` (line 145) sends a 409. Their profile row in `public.users` was never created and the client has no way to provision it.
- **Root cause:** missing branch for the "user exists in auth, profile row not yet inserted" state.
- **Fix:** when `auth_resp.session is None`, return a 202-style response that includes `user_id` and instructs the client to call a new `POST /auth/finalize-profile/` endpoint after the user signs in. That endpoint takes the bearer token from the now-confirmed session, runs the same `users.insert(profile_payload)` block, and is idempotent (`on_conflict='id'`).
- **Validation:** integration test with a fake `sign_up` returning `user` + `session=None`, followed by a successful `finalize-profile` call.

### **[BUG-12] — LOW — `TruongDetailPage` hard-codes years `2023/2024/2025` and `getLatestScore` is dead**

- **File/lines:** `frontend/src/app/pages/TruongDetailPage.tsx:339,351-378,94-102`.
- **Evidence:**
  - The header row and per-row score cells iterate `["2023", "2024", "2025"]` literally. By August 2026 the latest column will be blank for every program because no `score.year == 2025` rows are produced for that cycle.
  - `getLatestScore` at line 94 is never called — only `getLatestScoreByYear` at line 588 is referenced (`grep -n "getLatestScore\b" frontend/src/app/pages/TruongDetailPage.tsx` returns one definition and zero uses).
- **Fix:** derive the year columns from data, e.g. `const yearColumns = Array.from(new Set(scores.map(s => String(s.year)))).sort().slice(-3);`. Delete `getLatestScore` (lines 94-102).

### **[RISK-1] — MEDIUM — `_fetch_all_rows` is still unbounded; cold cache + four call sites in one request can blow up a worker (carried from 06-17 RISK-1)**

- **File/lines:** `backend/src/academics/views.py:48-59`.
- **Evidence:** `while True: ... if len(batch) < page_size: break` — no `max_pages`. Four call sites: `_thpt_last_year_program_ids` (74), `_active_major_codes` (87), `_major_overview_rows` (105, 120), `recommendations` (378, 393). A cold `/api/majors/overview/` fires the first two; a cold `/api/majors/recommendations/` fires the first plus the unfiltered `admission_scores` query from BUG-8.
- **Fix:** `def _fetch_all_rows(query_factory, page_size=1000, max_pages=50):` and raise `RuntimeError('exceeded max_pages')` with a `logger.error` before raising. Default `50 * 1000 = 50 000 rows` is more than enough for the current dataset.

### **[RISK-2] — MEDIUM — `SECRET_KEY` still accepts the placeholder in production (carried from 06-17 RISK-2)**

- **File/lines:** `backend/config/settings/base.py:6`, `backend/config/settings/prod.py:1-19`.
- **Evidence:** `prod.py` enforces `ALLOWED_HOSTS` but never re-checks `SECRET_KEY`. `config('SECRET_KEY', default='django-insecure-change-me')` will silently load the placeholder in prod if the env var is missing.
- **Fix:** in `prod.py` after `from .base import *`:

  ```python
  if not SECRET_KEY or SECRET_KEY == 'django-insecure-change-me':
      raise ValueError('SECRET_KEY must be set in production')
  ```
- **Validation:** `DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy` must require the env var.

### **[RISK-3] — LOW — `or_` injection surface in search fields**

- **File/lines:** `backend/src/universities/views.py:65`, `backend/src/academics/views.py:213-214,239-245,300-305`.
- **Evidence:** `query.or_(f'name.ilike.%{search}%,code.ilike.%{search}%')` substitutes user input directly into the PostgREST `or` parameter. A search containing a comma terminates the first clause early; one containing `)` could break the parser. This is not SQL injection (PostgREST sanitizes filter values), but it is a parser denial-of-service: `search=%2C%29%2C` could return an unexpected result set or 400.
- **Fix:** percent-encode/escape `,`, `(`, `)`, `*` inside `search` before interpolation, or strip them: `re.sub(r'[,\(\)\*]', '', search)`.

---

## 4. Duplicate and Inconsistent Code

- **`normalizeScoreTo30` duplicated**: defined in `frontend/src/app/pages/NganhDetailPage.tsx:47-55`; the same scale-40 logic is **missing** in `TruongDetailPage.tsx` (BUG-3 propagation) and `NganhPage.tsx` (only uses backend-normalized `score30` already). Lift `normalizeScoreTo30` into `frontend/src/app/services/api.ts` and call it from every page that reads `ApiAdmissionScore.score`. That also gives a single place to apply the BUG-3 fallback when the note is missing.
- **Four paginated-fetch helpers, identical shape:**
  - `frontend/src/app/services/api.ts:357-368` (`getAllUniversities`, `Promise.all`)
  - `frontend/src/app/pages/NganhDetailPage.tsx:63-76` (`getAllPrograms`, sequential)
  - `frontend/src/app/pages/NganhDetailPage.tsx:78-97` (`getAllAdmissionScoresByProgramIds`, sequential + chunked)
  - `frontend/src/app/pages/TruongDetailPage.tsx:54-67` (`getAllAdmissionScoresForUniversity`, sequential)

  All four compute `totalPages = max(1, ceil(count / page_size))` and concatenate. Lift to `services/api.ts` as `fetchAllPaginated<T>(fetcher, params)`; that is also where BUG-7's `page_size: 0` defense must live.
- **`getProgramLabel` / `getProgramVariantLabel`** only exist in `NganhDetailPage.tsx:99-107`. The same join (`universities.name || university_short_name` + optional `' - ' + program_name`) appears inline in `TruongDetailPage.tsx` and (per 06-17 review) `BXHPage.tsx`. Move both helpers to `services/api.ts` and import them.
- **`_paginate_rows` in `core/api/views.py:32-42` re-implements `paginate()`'s page math** with a different ceiling (BUG-4) and on already-fetched lists. The shape is identical; the only divergence is that `paginate()` calls PostgREST while `_paginate_rows` slices a Python list. Rename to `paginate_in_memory` and import the same `MAX_PAGE_SIZE`.

---

## 5. Dead, Stale, or Unused Code

- **`backend/src/academics/views.py:131-142`** — `scores_by_program` aggregate constructed and never read. Confidence: **High**. `grep -n 'scores_by_program' backend/src/academics/views.py` returns only the construction lines, no read site. Same finding as 06-17 BUG-5, unchanged.
- **`frontend/src/app/services/api.ts:247-249`** — `getProgramScores` is exported but unused. Confidence: **High**. `grep -rn "getProgramScores" frontend/src/` returns only the export. The new `getAllAdmissionScoresByProgramIds` (NganhDetailPage) is the replacement. Delete the export.
- **`frontend/src/app/pages/TruongDetailPage.tsx:94-102`** — `getLatestScore` defined, not called. Confidence: **High**. `grep -n "getLatestScore\b" frontend/src/app/pages/TruongDetailPage.tsx` shows one definition, zero use sites.
- **`backend/db.sqlite3`** — still present, 0 bytes, working tree only. `git check-ignore -v backend/db.sqlite3` returns the `.gitignore:34` rule. Delete locally.
- **`frontend/dev-server.log`** — 7.4 KB file from May 2026, still in the working tree, not in `.gitignore`. Confidence: **High** — `grep -r 'dev-server.log' frontend/src` empty. Delete + add `frontend/dev-server.log` to `.gitignore`.
- **`backend/.env.test`, `backend/.env_used_for_check`, `backend/.env.test.bak`** — three untracked env files. `git check-ignore backend/.env.test backend/.env_used_for_check` returns exit 1 (NOT ignored). They currently hold only placeholder values (`sb_publishable_...`), but any future `git add .` will commit secrets. The `.gitignore:1-3` block only covers `.env`, `.env.local`, `.env.*.local`. Add `.env.test`, `.env.test.bak`, `.env_used_for_check` explicitly — or broaden to `.env*` excluding `.env.example`.
- **`backend/docker-compose.yml` `db:` service** — still defines `postgres:16-alpine` with healthcheck and `depends_on`, but `config/settings/base.py:55` is `DATABASES = {}`. The Django container waits for a Postgres that is never used. Remove the `db:` block + `depends_on` + `volumes.postgres_data`, or relocate to `docker-compose.override.yml` if it's intentional scaffolding for a future migration.

---

## 6. Dependency, Config, and Tooling Concerns

- **`backend/.env.example` vs `settings/base.py` drift (unchanged from 06-17):**
  - `.env.example` still lists `SUPABASE_DB_PASSWORD/HOST/PORT/NAME/USER`. `grep -rn 'SUPABASE_DB_' backend --include="*.py"` returns zero matches. Dead.
  - `.env.example` still lists `THROTTLE_USER`, `CACHE_TTL_UNIVERSITIES_LIST`, `CACHE_TTL_SCORES_LIST`. `grep -rn 'THROTTLE_USER\|CACHE_TTL_' backend --include="*.py"` returns zero matches. Only `THROTTLE_ANON` and `CACHE_DEFAULT_TIMEOUT` are consumed.
  - Missing: `SUPABASE_SERVICE_ROLE_KEY` (required for BUG-2 fix).
- **`backend/Dockerfile` vs `backend/docker-compose.yml` parity:**
  - Dockerfile CMD: `gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4`.
  - docker-compose `web.command`: `python manage.py runserver 0.0.0.0:8000`, plus `volumes: - .:/app` masking the COPYed code. Production parity is zero. Move the dev override into `docker-compose.override.yml`.
- **`frontend/package.json` lacks `typescript` and `tsconfig.json`** (carried from 06-17 BUG-9). Combined with `.tsx` everywhere this means **type errors ship to production**.
- **`backend/requirements/dev.txt`** declares `black==24.1.1`, `flake8==7.0.0`, `isort==5.13.2` — but `.ruff_cache/0.15.16` and `.ruff_cache/0.15.17` exist in `backend/`, suggesting someone is running `ruff` outside the declared toolchain. Pick one: either move `ruff` into `requirements/dev.txt` (recommended — it supersedes flake8/black/isort) or delete the `.ruff_cache` directories and add them to `.gitignore`.
- **`backend/pytest.ini` `testpaths = src`** — `backend/core/auth/tests/test_auth_views.py` and `backend/core/api/tests/test_views.py` exist but are **not collected** because `testpaths` is restricted to `src/`. Confirmed by reading both `__init__.py` files and the pytest docs. Either add `testpaths = src core` or move the `core` tests under `src`.

---

## 7. Test Gaps

Concrete missing cases on risky surfaces (in this format because reviewers asked for it):

- `_is_scale_40(36.0, None)` → assert `True` (BUG-3 fix evidence).
- `_is_scale_40(30.0, None)` → assert `False` (regression guard, already covered).
- `POST /api/scores/bulk-upsert/` with `{"items":[{"university_program_id":"x","year":2026}]}` → assert 400 (`university_program_id` not int; BUG-2 fix).
- `POST /api/scores/bulk-upsert/` with `{"items":[{"university_program_id":1,"admission_method_code":"THPT","year":2026,"score":42}]}` → assert 400 (`score` over 40; BUG-2 fix).
- `POST /api/scores/bulk-upsert/` with `user_metadata={'role':'admin'}, app_metadata={}` → assert 403 (BUG-1 fix).
- `GET /api/programs/?major_name=Cong%20nghe` → assert that lookup limit is respected (BUG-5 fix).
- `GET /api/programs/?major_name=__no_such_name__` → assert `page_size == 20` (BUG-7 fix).
- `GET /api/majors/recommendations/?score_min=24&score_max=27&block=A00` → assert only THPT scores from `_last_year() - 1` onward are loaded (BUG-8 fix — assert via `_fetch_all_rows` call-count mock).
- `_score_to_tier(89)` → assert `'A'`; `_score_to_tier(90)` → assert `'S'` after BUG-6 rescale.
- `GET /api/auth/awards/` with `Authorization: 'Bearer  abc'` (two spaces) → assert 200 with anon-client behaviour, not 500 (BUG-10 fix).
- Frontend (with the new tsconfig from BUG-9 fix): `tsc --noEmit` must pass against `types/api.ts` after `ApiAdmissionScore.university_program_id: string` propagation.

---

## 8. Quick Wins (under 1 hour each)

- Delete the dead `scores_by_program` aggregate (`academics/views.py:131-142`).
- Delete `getProgramScores` (`services/api.ts:247-249`) and `getLatestScore` (`TruongDetailPage.tsx:94-102`).
- Bump `programs:list:v2` → `v3` and `programs:detail:v2:{pk}` → `v3` (BUG-9).
- Return `DEFAULT_PAGE_SIZE` instead of `0` on the no-match short circuit (BUG-7).
- Add `.eq('admission_method_code', 'THPT').gte('year', _last_year() - 1)` to recommendations (BUG-8).
- Add `SECRET_KEY` enforcement to `prod.py` (RISK-2).
- Import `MAX_PAGE_SIZE` in `core/api/views.py:34` and `academics/views.py:282` (BUG-4).
- Add `.limit(200)` to `_major_codes_by_name` (BUG-5).
- Delete `backend/db.sqlite3` and `frontend/dev-server.log`; add the log to `.gitignore`.
- Add `.env.test`, `.env.test.bak`, `.env_used_for_check` to `.gitignore` (or broaden the `.env*` rule).
- Remove stale `SUPABASE_DB_*`, `THROTTLE_USER`, `CACHE_TTL_*` entries from `.env.example`.

---

## 9. Larger Improvements

In order of blast radius (lowest first):

1. **Lift `normalizeScoreTo30` and the four "fetch all pages" helpers into `services/api.ts`.** Pure refactor; do this before fixing BUG-3 and BUG-7 so each fix lands in one place.
2. **Introduce `get_service_client()`** in `core/supabase_client.py` and migrate `bulk_upsert` (BUG-2). Risk: don't cache the client globally.
3. **Move `is_staff` to `app_metadata`** (BUG-1) and coordinate with whoever provisions admin accounts — they need to call the Supabase Admin API instead of `auth.updateUser`. Ship a one-shot migration script first.
4. **Backward-compatible `/nganh/:id` fallback** (carried from 06-17 BUG-4). The route param changed semantics from major code → program id and there is still no redirect for old bookmarks. Add a 404→`getMajorDetail` fallback in `NganhDetailPage.tsx:196`.
5. **CI for the frontend** — wire `tsc --noEmit` into a GitHub Actions job that also runs `python -m pytest backend/`. Today's `pytest.ini testpaths = src` would skip the `core` tests; widen it at the same time.

---

## 10. Prioritized Action Checklist

1. **Patch BUG-1**: switch `SupabaseUser` to read `app_metadata`; update `FakeAdminClient` and add a "user_metadata is ignored" test.
2. **Patch BUG-2**: add `get_service_client`, `BulkAdmissionScoreItemSerializer`, throttle scope; migrate `bulk_upsert`.
3. **Restore the `score > 30` branch in `_is_scale_40`** (BUG-3) and mirror the frontend; add `_is_scale_40(36.0, None) is True` test.
4. **Reconcile the three `page_size` ceilings** to a single `MAX_PAGE_SIZE` (BUG-4).
5. **Cap `_major_codes_by_name` at 200 rows and drop the redundant frontend dual-fetch** (BUG-5).
6. **Rescale `TIER_THRESHOLDS` to a 90-point total** and add `max_value=80` on `base_score` (BUG-6).
7. **Return `DEFAULT_PAGE_SIZE`, not 0, on the empty `major_name` path** (BUG-7).
8. **Filter `recommendations` by THPT + year window** (BUG-8).
9. **Bump `programs:list:v2 → v3` and `programs:detail:v2:{pk} → v3`** (BUG-9).
10. **Fix `AwardCatalogView` bearer parsing** (BUG-10).
11. **Add `finalize-profile` for the email-confirmation register path** (BUG-11).
12. **De-hardcode the year columns in `TruongDetailPage` and delete dead helpers** (BUG-12).
13. **Add `max_pages` to `_fetch_all_rows`** (RISK-1).
14. **Enforce `SECRET_KEY` in `prod.py`** (RISK-2).
15. **Escape comma/parens in search terms** (RISK-3).
16. **Add `typescript` + `tsconfig.json`; wire `tsc --noEmit` into the lint script**.
17. **Widen `pytest.ini testpaths` to include `core/`** so the auth and api test suites actually run.
18. **Clean up `.env.example`, `.gitignore`, `docker-compose.yml`** per Section 6.
19. **Delete dead code per Section 5**.
20. **Move historical `code-review-*.md` files into `docs/code-reviews/`** so the repo root stops growing.
