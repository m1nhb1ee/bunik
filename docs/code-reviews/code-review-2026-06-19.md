# Code Review — 2026-06-19

Scope: full repo at `C:\Project\School Project\bunik` (Django 5 + DRF backend over Supabase REST; React 18 + Vite + react-router 7 frontend, no TS compile). Compared HEAD (`main` @ `f8fb500`) plus staged + working-tree diff against the previous review (`code-review-2026-06-18.md`).

---

## 1. Executive Summary

Overall health: **regressing further — the working-tree patch to `_is_scale_40` (academics/views.py) and its frontend mirror (`normalizeScoreTo30`, NganhDetailPage.tsx) both replaced the bilingual literal check with a single NFD-strip-ASCII pass that silently drops Vietnamese `đ`. Result: zero scale-40 rows are detected from the canonical note text 'Thang điểm 40'. 257 rows in the import set hit this branch.** Every defect raised on 06-18 is still present in HEAD; one of them (BUG-3) got worse, not better.

Highest-risk areas:

1. **NEW BUG-1 (CRITICAL data-quality)** — `_is_scale_40` and `normalizeScoreTo30` strip `đ` and never match the canonical Vietnamese note 'Thang điểm 40'. Two layers of normalization, both wrong the same way. Confirmed with a Python and a Node REPL run against the actual CSV import.
2. **NEW BUG-2 (HIGH)** — the score-based fallback (`numeric_score >= 30`) was deleted from `_is_scale_40` this cycle. So scale-40 rows with `note IS NULL` (the previous failure mode) now ALSO escape detection — the regression is wider than 06-18's BUG-3.
3. **NEW TEST CODIFIES THE BUG** — `test_scale_40_requires_explicit_note` asserts `_is_scale_40(30.0, 'thang diem 40') is True` (ASCII input). With the canonical DB string 'Thang điểm 40' the function returns `False`. The test passes; the production data does not.
4. **BUG-1 from 06-18 (CRITICAL — `is_staff` reads user-writable `user_metadata`) is still present**, and `FakeAdminClient` in `test_security.py:29-31` still uses `user_metadata={'role':'admin'}`. Codified.
5. **BUG-9 from 06-18 (cache namespace `programs:list:v2` / `programs:detail:v2` stale)** — the working tree just added `program_name, program_source_code` to `_SELECT` and a new `order('program_source_code')`. Cache namespace was NOT bumped. After deploy + cache warm, the frontend will display program buttons with `program_name=undefined` until each TTL (600s / 180s) expires.

Validation commands run, exact results:

- `python -m py_compile` over every backend `.py` (44 files) → **pass** (exit 0 across the board).
- `python -m pytest -q backend/` → **skipped** — sandbox has no Django/DRF (`ModuleNotFoundError: No module named 'django'`). Findings below come from static reading + targeted Python/Node REPL runs against the actual import CSV + git diff tracing.
- `node -e "..."` to exercise the new frontend `normalizeScoreTo30` and the new backend `_is_scale_40` against 'Thang điểm 40' → **both return false** (see BUG-1 evidence).
- `grep -c "[Tt]hang [Đđ]iểm 40" database/datav2/bunik_crawl_output/clean_import/admission_scores.csv` → **257 rows** with the canonical-spelling note.
- `npx tsc --noEmit` → **not applicable** — still no `typescript` dep, no `tsconfig.json` anywhere in `frontend/`. Same finding as 06-18 BUG-9, unchanged.
- `npm run lint` / `npm run test` → both `echo "No ... config yet" && exit 0`.
- `npm run build` → not attempted (no idempotency contract; build is owned by deploy pipeline).

Counts: **2 new confirmed bugs (BUG-1, BUG-2) on top of the 12 carry-overs from 06-18. 0 of the 06-18 prioritized checklist were merged.**

---

## 2. Critical and High-Risk Findings

### **[BUG-1] — CRITICAL — `_is_scale_40` (and frontend `normalizeScoreTo30`) silently misclassify all 'Thang điểm 40' rows because NFD-normalize does NOT decompose `đ` (U+0111)**

- **File/lines:**
  - `backend/src/academics/views.py:62-67`
  - `frontend/src/app/pages/NganhDetailPage.tsx:47-55`
  - regression test: `backend/src/academics/tests/test_score_scale.py:8-9`
- **Evidence (backend, working tree):**

  ```python
  def _is_scale_40(score_value, note):
      if score_value is None:
          return False
      note_text = (note or '').lower()
      normalized_note = unicodedata.normalize('NFD', note_text).encode('ascii', 'ignore').decode('ascii')
      return 'thang diem 40' in normalized_note
  ```

  REPL against the CSV's canonical note text:

  ```
  $ python3 -c "import unicodedata; s='thang điểm 40'; \
      n=unicodedata.normalize('NFD', s).encode('ascii','ignore').decode('ascii'); \
      print(repr(n), 'thang diem 40' in n)"
  'thang iem 40' False
  ```

  The reason: `LATIN SMALL LETTER D WITH STROKE` (U+0111, `đ`) is a precomposed-with-no-decomposition codepoint. `unicodedata.normalize('NFD', 'đ')` returns `'đ'` unchanged; `.encode('ascii', 'ignore')` then drops it entirely, leaving `'iem'`. Same for the capital `Đ` U+0110.

  The frontend mirror has the identical bug:

  ```ts
  // frontend/src/app/pages/NganhDetailPage.tsx:47-55
  function normalizeScoreTo30(score: number, note: string | null): number {
    const noteText = (note || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    const isScale40 = noteText.includes("thang diem 40");
    if (!isScale40) return score;
    return +((score * 30) / 40).toFixed(2);
  }
  ```

  Node REPL:

  ```
  $ node -e "console.log('thang điểm 40'.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase())"
  thang điem 40
  ```

  And from the import set:

  ```
  $ grep -c "[Tt]hang [Đđ]iểm 40\|[Tt]hang [đd]iem 40" database/datav2/bunik_crawl_output/clean_import/admission_scores.csv
  257
  $ grep "[Tt]hang [Đđ]iểm 40" database/datav2/.../admission_scores.csv | head -1
  ...,THPT,2022,34.35,Thang điểm 40,tuyensinh247,113929,1,Điểm thi THPT
  ```

  257 rows with scores 33–36+ on a 40-point scale will be classified as scale-30 by both the backend overview and the frontend chart.

- **Root cause:** the author replaced the 06-18 bilingual check `'thang diem 40' in note_text or 'thang điểm 40' in note_text` with an NFD-strip pass, assuming NFD would decompose `đ`. It doesn't. `đ` is a separate Unicode letter, not 'd' + combining.
- **Impact:**
  - `_major_overview_rows()` (academics/views.py:144-160) sets `score_30 = 34.35` for those rows; `NganhPage` (`MIN_SCORE=14, MAX_SCORE=30`) drops them via `score >= scoreMin && score <= scoreMax`. The majors disappear from the listing.
  - `TruongDetailPage` writes raw 34/35 into the year cells (no normalization at all) — looks like a typo to the user.
  - `NganhDetailPage` chart now feeds 34.35 to the line chart with `YAxis domain={["auto", "auto"]}` — the trend looks like a sudden +5 spike vs THPT scale-30 years.
- **Cross-layer effects:**
  - Both new tests (`test_score_scale.py:4-9`) pass because they only exercise ASCII-input and the `score=30, note=None` boundary. Neither covers the canonical 'Thang điểm 40' string. The test suite cannot catch this regression.
- **Fix:**
  1. Add an explicit `đ→d, Đ→D` translation table BEFORE the NFD strip, in both languages:

     ```python
     # backend/src/academics/views.py
     _DSTROKE_TRANSLATE = str.maketrans({'đ': 'd', 'Đ': 'd', 'Ð': 'd'})

     def _is_scale_40(score_value, note):
         if score_value is None:
             return False
         note_text = (note or '').lower().translate(_DSTROKE_TRANSLATE)
         normalized_note = unicodedata.normalize('NFD', note_text).encode('ascii', 'ignore').decode('ascii')
         if 'thang diem 40' in normalized_note:
             return True
         try:
             return float(score_value) > 30.0
         except (TypeError, ValueError):
             return False
     ```

     The trailing `>30.0` branch is the BUG-2 fix below; keep them in one place.

     Frontend mirror in `NganhDetailPage.tsx:47-55`:

     ```ts
     function normalizeScoreTo30(score: number, note: string | null): number {
       const noteText = (note || "")
         .replace(/[đĐÐ]/g, "d")
         .normalize("NFD")
         .replace(/[̀-ͯ]/g, "")
         .toLowerCase();
       const isScale40 = noteText.includes("thang diem 40") || score > 30;
       if (!isScale40) return score;
       return +((score * 30) / 40).toFixed(2);
     }
     ```
  2. Lift `normalizeScoreTo30` into `frontend/src/app/services/api.ts` so `TruongDetailPage.tsx:88` and any future page reuse the same logic. The carry-over from 06-18's Section 4 still applies.
- **Validation:** replace `test_scale_40_requires_explicit_note` with the real input strings and add the negative case:

  ```python
  def test_scale_40_recognized_with_canonical_vietnamese_note():
      assert _is_scale_40(34.35, 'Thang điểm 40') is True

  def test_scale_40_recognized_with_lowercase_canonical_note():
      assert _is_scale_40(34.35, 'thang điểm 40') is True

  def test_scale_40_recognized_with_capital_dstroke():
      assert _is_scale_40(34.35, 'Thang Điểm 40') is True

  def test_scale_40_recognized_when_score_above_30_with_no_note():
      assert _is_scale_40(36.0, None) is True

  def test_scale_30_at_boundary_with_no_note_is_not_40():
      assert _is_scale_40(30.0, None) is False
  ```

### **[BUG-2] — HIGH — score-based fallback for scale-40 was deleted this cycle, widening the 06-18 regression**

- **File/lines:** `backend/src/academics/views.py:62-67`. Same fix block as BUG-1 closes this; calling out independently because the import path is independent (rows whose note is `NULL` were the original failure case in 06-18).
- **Evidence:** the staged diff in working tree:

  ```diff
  - try:
  -     numeric_score = float(score_value)
  - except (TypeError, ValueError):
  -     return False
  - if numeric_score >= 30:
  -     return True
    note_text = (note or '').lower()
  - return 'thang diem 40' in note_text or 'thang điểm 40' in note_text
  + normalized_note = unicodedata.normalize('NFD', note_text).encode('ascii', 'ignore').decode('ascii')
  + return 'thang diem 40' in normalized_note
  ```

  HEAD's `numeric_score >= 30` branch was a load-bearing fallback for rows with `note IS NULL` and `score > 30`. It was removed wholesale, not relaxed. With the NFD bug from BUG-1, both the explicit-note path and the score-value path now fail for the same row.
- **Root cause:** two independent normalizations were collapsed into one without coverage for the third case ("note missing, score > 30").
- **Impact:** rows like `score=36.5, note=NULL` are now classified as scale-30. Same downstream cascade as BUG-1.
- **Fix:** the unified function in BUG-1's fix (`if 'thang diem 40' in normalized_note: return True; try: return float(score_value) > 30.0; except: return False`) covers this case; the `>30.0` branch is the explicit restoration.
- **Validation:** `test_scale_40_recognized_when_score_above_30_with_no_note` in BUG-1's test block.

### **[BUG-3] — CRITICAL (carry-over) — Privilege escalation via `user_metadata.is_admin` / `user_metadata.role == 'admin'`**

Same finding as 06-18 BUG-1, present and unfixed at HEAD and in the working tree.

- **File/lines:** `backend/core/auth/supabase_auth.py:11-17,44-48`; test fixture at `backend/src/admissions/tests/test_security.py:29-31`.
- **Evidence:**

  ```python
  # backend/core/auth/supabase_auth.py:11-17
  def __init__(self, user_id: str, email: str, metadata: Optional[dict] = None):
      self.id = user_id
      self.email = email
      self.metadata = metadata or {}
      self.is_authenticated = True
      self.is_staff = self.metadata.get('is_admin', False) or self.metadata.get('role') == 'admin'

  # backend/core/auth/supabase_auth.py:44-48
  user = SupabaseUser(
      user_id=user_data.id,
      email=user_data.email,
      metadata=user_data.user_metadata or {}   # <- USER-WRITABLE per Supabase docs
  )

  # backend/src/admissions/tests/test_security.py:29-31
  class FakeAdminClient(FakeClient):
      def __init__(self):
          self.auth = Obj(get_user=lambda _token: Obj(user=Obj(
              id='admin1', email='admin@example.com',
              user_metadata={'role': 'admin'})))   # codifies the bug
  ```

  Any authenticated client can call `supabase.auth.updateUser({ data: { role: 'admin' } })` from the browser and become staff. The single gate at `src/admissions/views.py:231` (`if not getattr(request.user, 'is_staff', False)`) then waves them through to the unvalidated `bulk_upsert` (BUG-4 below).
- **Fix and validation:** identical to 06-18 BUG-1 — switch `metadata=user_data.user_metadata or {}` to `metadata=getattr(user_data, 'app_metadata', None) or {}`, update `FakeAdminClient` to `app_metadata={'role':'admin'}`, and add a `test_bulk_upsert_ignores_user_metadata_role_admin` negative test that asserts 403 when only `user_metadata` is set.

### **[BUG-4] — HIGH (carry-over) — `bulk_upsert` writes via anon client with no field whitelist, no range checks, no throttle**

Same finding as 06-18 BUG-2, unchanged at HEAD; `src/admissions/views.py:229-246` is byte-identical to last cycle. No serializer file exists for admissions (`ls backend/src/admissions/` returns only `__init__.py, apps.py, tests, urls.py, views.py` — no `serializers.py`). No service-role client exists (`grep -rn 'SUPABASE_SERVICE_ROLE_KEY\|service_role' backend --include='*.py'` returns zero).

Fix and validation block from 06-18 BUG-2 still applies verbatim; see Section 9 for ordering.

### **[BUG-5] — HIGH — Cache namespace `programs:list:v2` / `programs:detail:v2` not bumped after `_SELECT` change + new `order('program_source_code')`**

- **File/lines:** `backend/src/admissions/views.py:66-70,101,104,120`.
- **Evidence:** the working-tree diff added `program_name, program_source_code` to `_SELECT` and reordered the list with `.order('program_source_code')`, but the cache namespaces stayed at `v2`:

  ```python
  _SELECT = (
      'id, university_short_name, major_code, is_active, program_name, program_source_code, '
      'universities!university_programs_university_short_name_fkey(id, name, code, type), '
      'major_catalog(code, name, field_code)'
  )
  ...
  query = query.order('university_short_name').order('major_code').order('program_source_code')
  return paginate(request, query)

  return Response(get_or_set_api_payload(request, 'programs:list:v2', load, timeout=180))
  ...
  return Response(get_or_set_api_payload(request, f'programs:detail:v2:{pk}', load, timeout=600))
  ```

  Cache TTLs are 180 s (list) and 600 s (detail). After deploy + first warm read, stale entries WITHOUT `program_name` flow back to the frontend until each key expires. `frontend/src/app/pages/NganhDetailPage.tsx:410` calls `getProgramVariantLabel(program, major.name)` which reads `program.program_name`; for stale rows that returns `undefined` and the program button collapses to just the school name. Same bug class as 06-18 BUG-9, just with new column names.
- **Fix:** rename both keys to `'programs:list:v3'` and `'programs:detail:v3:{pk}'`. Keep `'programs:scores:v2'` (its select didn't change). Do the rename in the same commit as the SELECT change so cache invalidation rides on the deploy.
- **Validation:** after deploy, hit `GET /api/programs/?major_code=7480201&page_size=5` twice (warm + cold) and confirm every row has `program_name` populated.

### **[BUG-6] — HIGH (carry-over) — Three competing `page_size` ceilings (100 / 100 / 200)**

Identical to 06-18 BUG-4. `backend/core/supabase_client.py:10` is `MAX_PAGE_SIZE = 100`; `backend/core/api/views.py:34` hard-codes `maximum=100`; `backend/src/academics/views.py:282` hard-codes `maximum=200`. Fix: import `MAX_PAGE_SIZE` in both places, or introduce `MAX_PAGE_SIZE_BULK = 200` if the majors list really needs the larger ceiling.

### **[BUG-7] — HIGH (carry-over) — `_major_codes_by_name` is unbounded; the new `_split_csv_param` path makes the same shape mistake**

- **File/lines:**
  - `backend/src/admissions/views.py:12-13` (`_split_csv_param`)
  - `backend/src/admissions/views.py:16-28` (`_major_codes_by_name`)
  - `backend/src/admissions/views.py:190-191` (consumer: `program_ids` filter)
- **Evidence:**

  ```python
  def _split_csv_param(value):
      return [item.strip() for item in (value or '').split(',') if item.strip()]

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

  # consumer for program_ids
  if program_ids := _split_csv_param(params.get('program_ids')):
      query = query.in_('university_program_id', program_ids)
  ```

  Two unbounded `.in_(...)` paths now exist: `major_code` (called by `NganhDetailPage` on every detail open via `getAllPrograms({ major_name })`) and `university_program_id` (called via `getAllAdmissionScoresByProgramIds` which already pre-chunks at `chunkArray(programIds, 50)` in `NganhDetailPage.tsx:80`).
  - `_major_codes_by_name` has no `.limit()` — a Vietnamese substring `"Cong nghe"` matches 50+ rows in `database/datav2/.../major_catalog.csv`.
  - `_split_csv_param('a,,b,  ,c')` returns `['a','b','c']` — that's fine — but `_split_csv_param('not_a_uuid,still_not_a_uuid')` passes garbage straight to `.in_('university_program_id', [...])`. PostgREST will 400 with `invalid input syntax for type uuid`, the DRF exception handler returns 500, and the frontend shows the generic `'Da xay ra loi he thong'` toast.
- **Root cause:** missing `.limit(200)` on the major-name lookup; missing UUID/integer validation on the `program_ids` CSV.
- **Impact:** popular partial-name searches issued by `NganhDetailPage` open three round trips (`programDetail` + `major_code` + `major_name` lookups) and the third can return arbitrarily large payloads. Garbage `program_ids` returns a generic 500 — debugging is needlessly hard.
- **Fix:**
  1. `_major_codes_by_name` — add `.limit(200)` (or import a named constant):

     ```python
     def _major_codes_by_name(client, major_name, limit: int = 200):
         name = (major_name or '').strip()
         if not name:
             return []
         response = (
             client
             .table('major_catalog')
             .select('code')
             .ilike('name', f'%{name}%')
             .limit(limit)
             .execute()
         )
         codes = [row.get('code') for row in (response.data or []) if row.get('code')]
         if len(codes) == limit:
             logger.warning('major_name lookup hit limit=%s for %r', limit, name)
         return codes
     ```
  2. `_split_csv_param` — accept a `validator` callable, or split into two: keep the existing helper for whitespace-tolerant CSV, and add `_parse_uuid_csv(value)` that re-raises a DRF `ValidationError` on bad UUIDs. Then call it in `AdmissionScoreViewSet.list` so the user sees a 400 with `{"program_ids":["Must be a valid UUID."]}` instead of a 500.
  3. `NganhDetailPage.tsx:199-211` — drop the `getAllPrograms({ major_name })` fallback unless `major_code` returns empty. Right now the page issues both unconditionally and dedupes by `program.id`.
- **Validation:** add `test_major_name_lookup_caps_results_at_200`, `test_program_ids_with_invalid_uuid_returns_400`, and a Playwright assertion that `/nganh/<id>` opens with ≤2 `programs/` calls.

---

## 3. Bugs and Reliability Risks

### **[BUG-8] — MEDIUM (carry-over) — `RankingsListView` tier thresholds are unreachable**

Same finding as 06-18 BUG-6. `backend/core/api/views.py:22-29` still has tiers S≥150, A≥100; the realistic total cap is 90 (8 subjects × 10 = 80 from `ProfileUpdateSerializer.math…geography` (max 10 each) + `special_score` max 10). `base_score` has `min_value=0` and no max in `ProfileUpdateSerializer:85`, so the only way to reach S today is to PATCH `base_score` directly — a back-door knob. Fix: rescale tiers to a 90-point cap, add `max_value=80` on `base_score`, bump cache namespace `'rankings:list'` → `'rankings:list:v2'`.

### **[BUG-9] — MEDIUM (carry-over) — `page_size: 0` short-circuit returned by `UniversityProgramViewSet.list` on empty `major_name` match**

Same finding as 06-18 BUG-7. `backend/src/admissions/views.py:97-99` returns `{'page_size': 0}`; `frontend/src/app/pages/NganhDetailPage.tsx:67-68` only escapes via `firstPage.page_size || requestedPageSize` because `||` short-circuits on `0`. Anyone who divides `count / page_size` directly (the natural next refactor) gets a divide-by-zero. Fix: return `DEFAULT_PAGE_SIZE` (import from `core.supabase_client`) instead of `0`.

### **[BUG-10] — MEDIUM (carry-over) — `recommendations` action pulls every `admission_scores` row, no THPT/year filter**

Same finding as 06-18 BUG-8, unchanged at `backend/src/academics/views.py:393-405`. Fix: add `.eq('admission_method_code', 'THPT').gte('year', _last_year() - 1)` to the query. Existing dedup logic via `.order('year', desc=True)` continues to pick the latest.

### **[BUG-11] — MEDIUM (carry-over) — `AwardCatalogView` hand-rolled bearer parser breaks on double-space**

Same finding as 06-18 BUG-10, unchanged at `backend/core/auth/views.py:298-301`. Fix: reuse `SupabaseAuthentication().authenticate(request)` and treat `AuthenticationFailed` as "fall through to anon client".

### **[BUG-12] — MEDIUM (carry-over) — Register flow leaves an orphan Supabase auth user when email confirmation is required**

Same finding as 06-18 BUG-11, unchanged at `backend/core/auth/views.py:114-142`. Fix: when `auth_resp.session is None`, return a 202-style response with `user_id` and add `POST /auth/finalize-profile/` that uses the now-confirmed bearer to insert the profile row idempotently (`on_conflict='id'`).

### **[BUG-13] — LOW (carry-over) — `TruongDetailPage` hard-codes years 2023/2024/2025 and `getLatestScore` is dead**

Same finding as 06-18 BUG-12, unchanged at `frontend/src/app/pages/TruongDetailPage.tsx:339,351-378,94-102`. Fix: derive the year columns from data (`Array.from(new Set(scores.map(s => String(s.year)))).sort().slice(-3)`). Delete `getLatestScore` (lines 94-102).

### **[RISK-1] — MEDIUM (carry-over) — `_fetch_all_rows` is still unbounded**

`backend/src/academics/views.py:48-59` has no `max_pages`. Four hot call sites (`_thpt_last_year_program_ids`, `_active_major_codes`, `_major_overview_rows` (×2), `recommendations`). Fix: cap at `max_pages=50` and `logger.error` before raising `RuntimeError`.

### **[RISK-2] — MEDIUM (carry-over) — `SECRET_KEY` still accepts the placeholder in production**

`backend/config/settings/prod.py:1-19` enforces `ALLOWED_HOSTS` but never re-checks `SECRET_KEY`. Add after `from .base import *`:

```python
if not SECRET_KEY or SECRET_KEY == 'django-insecure-change-me':
    raise ValueError('SECRET_KEY must be set in production')
```

### **[RISK-3] — LOW (carry-over) — `or_` injection surface in search fields**

`backend/src/universities/views.py:65`, `backend/src/academics/views.py:213-214,239-245,300-305` still interpolate `search` directly into PostgREST `or` filter strings. Strip `[,()*]` or percent-encode before interpolation.

### **[RISK-4] — LOW (NEW) — `_split_csv_param(',  ,,,')` returns `[]` and the walrus pattern silently drops the filter**

- **File/lines:** `backend/src/admissions/views.py:190-191`.
- **Evidence:** `if program_ids := _split_csv_param(params.get('program_ids')):` — if the caller sent `program_ids=,,,` (or just whitespace) the walrus assigns `[]` and the body is skipped. The user expected to filter by program_ids; the response returns the unfiltered admission-score list. Not exploitable, but quietly mis-handles a malformed call.
- **Fix:** distinguish "missing" from "explicitly empty":

  ```python
  raw_program_ids = params.get('program_ids')
  if raw_program_ids is not None:
      program_ids = _split_csv_param(raw_program_ids)
      if not program_ids:
          return Response({'detail': 'program_ids must contain at least one id.'}, status=status.HTTP_400_BAD_REQUEST)
      query = query.in_('university_program_id', program_ids)
  ```

---

## 4. Duplicate and Inconsistent Code

- **`normalizeScoreTo30` duplicated and now broken in two languages (BUG-1).** Lift the JS version into `frontend/src/app/services/api.ts`, lift the Python version into `core/supabase_client.py` (or `core/normalization.py`), and use the same `đ→d, Đ→D` translation in both. Cite the carry-over from 06-18 Section 4 — still not done.
- **Four paginated-fetch helpers, identical shape** (carry-over): `frontend/src/app/services/api.ts:357-368`, `frontend/src/app/pages/NganhDetailPage.tsx:63-76`, `:78-97`, `frontend/src/app/pages/TruongDetailPage.tsx:54-67`. All compute `totalPages = max(1, ceil(count / page_size))`. Lift to a single `fetchAllPaginated<T>` helper. That's also where BUG-9's `page_size: 0` defense belongs.
- **`getProgramLabel` / `getProgramVariantLabel`** exist only in `NganhDetailPage.tsx:99-107` but the same join (`universities.name || university_short_name` + optional `program_name` suffix) appears inline in `TruongDetailPage.tsx`. Move to `services/api.ts`.
- **`_paginate_rows` in `core/api/views.py:32-42` re-implements `paginate()`'s page math** on already-fetched lists with a different ceiling (BUG-6). Rename to `paginate_in_memory` and import `MAX_PAGE_SIZE`.
- **`_split_csv_param` (admissions/views.py:12-13) duplicates `apply_ordering`'s split logic** (`core/supabase_client.py:74`). Both call `[s.strip() for s in (v or '').split(',') if s.strip()]`. Pull into `core.supabase_client` as `parse_csv_param(value, *, parser=None)` so the BUG-7 UUID validator can plug in.

---

## 5. Dead, Stale, or Unused Code

- **`backend/src/academics/views.py:131-142` — `scores_by_program` aggregate constructed and never read.** Confidence: **High**. `grep -n 'scores_by_program' backend/src/academics/views.py` returns only construction lines; no read. Carry-over from 06-18.
- **`frontend/src/app/services/api.ts:247-249` — `getProgramScores` exported, no callers.** Confidence: **High**. `grep -rn "getProgramScores" frontend/src/` returns one match (the export). Replaced by `getAllAdmissionScoresByProgramIds` in NganhDetailPage. Delete.
- **`frontend/src/app/pages/TruongDetailPage.tsx:94-102` — `getLatestScore` defined, never called.** Confidence: **High**. Only `getLatestScoreByYear` (line 588) is referenced. Delete.
- **`backend/db.sqlite3`** — 0-byte file, working tree only. `git check-ignore -v backend/db.sqlite3` returns `.gitignore:34:db.sqlite3`. Delete locally.
- **`frontend/dev-server.log`** — currently IGNORED by `.gitignore:32:*.log` (verified just now with `git check-ignore`), but still present in the working tree from a previous run. Carry-over from 06-18; the ignore rule is correct so just `rm` it locally.
- **`backend/.env.test`, `backend/.env_used_for_check`, `backend/.env.test.bak`** — three untracked env files. `git check-ignore` returns exit 1 (NOT ignored). Currently hold placeholder values (`sb_publishable_...`). `git add .` on a future commit will commit them. Add `.env.test`, `.env.test.bak`, `.env_used_for_check` to `.gitignore`, or broaden the existing block to `.env*` with an explicit re-include of `.env.example`.
- **`backend/docker-compose.yml` `db:` service** — still defines `postgres:16-alpine` with healthcheck and `depends_on`, but `config/settings/base.py:55` is `DATABASES = {}`. Move the dev `db:` block + `depends_on` + `volumes.postgres_data` into `docker-compose.override.yml` so prod parity isn't muddied.

---

## 6. Dependency, Config, and Tooling Concerns

- **`backend/.env.example` vs `settings/base.py` drift (carry-over):**
  - `.env.example` still lists `SUPABASE_DB_PASSWORD/HOST/PORT/NAME/USER`. `grep -rn 'SUPABASE_DB_' backend --include="*.py"` returns zero matches. Dead.
  - `.env.example` still lists `THROTTLE_USER`, `CACHE_TTL_UNIVERSITIES_LIST`, `CACHE_TTL_SCORES_LIST`. Only `THROTTLE_ANON` and `CACHE_DEFAULT_TIMEOUT` are consumed.
  - Missing: `SUPABASE_SERVICE_ROLE_KEY` (required for BUG-4 fix).
- **`backend/Dockerfile` vs `backend/docker-compose.yml` parity:** Dockerfile CMD is `gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4`; docker-compose `web.command` is `python manage.py runserver 0.0.0.0:8000`, plus `volumes: - .:/app` masking the COPYed code. Production parity is zero. Move the dev override into `docker-compose.override.yml`.
- **`frontend/package.json` lacks `typescript` and `tsconfig.json`** (carry-over from 06-18 BUG-9). Type errors ship to production. The two new helpers `_split_csv_param` and `_major_codes_by_name` have integration points in the frontend (`program_ids` CSV, `major_name` partial match) that should be typed at the service boundary; without TS that's enforced nowhere.
- **`backend/requirements/dev.txt`** declares `black==24.1.1`, `flake8==7.0.0`, `isort==5.13.2` — but `backend/.ruff_cache/0.15.16/` and `backend/.ruff_cache/0.15.17/` exist, suggesting someone is running `ruff` outside the declared toolchain. Add `ruff` to `requirements/dev.txt` or delete the `.ruff_cache` dirs and add them to `.gitignore`.
- **`backend/pytest.ini` `testpaths = src`** — `backend/core/auth/tests/test_auth_views.py` and `backend/core/api/tests/test_views.py` exist but are NOT collected because `testpaths` is restricted to `src/`. Confirmed by reading both `__init__.py` files. The new `test_program_filters.py` and `test_score_scale.py` ARE collected (they're under `src/`), but a meaningful `bulk_upsert` test belongs under `core/auth/tests/` and would silently fail to run. Either change `testpaths = src core` or move the existing `core` tests under `src`.

---

## 7. Test Gaps

Concrete missing cases on risky surfaces:

- `_is_scale_40(34.35, 'Thang điểm 40')` → assert `True` (BUG-1 fix evidence).
- `_is_scale_40(34.35, 'Thang Điểm 40')` → assert `True` (capital `Đ`).
- `_is_scale_40(34.35, 'thang điểm 40')` → assert `True` (lowercase canonical).
- `_is_scale_40(36.0, None)` → assert `True` (BUG-2 fix evidence — value fallback).
- `_is_scale_40(30.0, None)` → assert `False` (already covered).
- `normalizeScoreTo30(34.35, 'Thang điểm 40')` → assert returns `25.76` (BUG-1 mirror, frontend test once tsconfig+vitest exist).
- `GET /api/programs/?major_name=Cong%20nghe` → assert returned page count ≤ `MAX_PAGE_SIZE`, asserted via mocked client that returns 500 rows; assert the helper calls `.limit(200)` (BUG-7 fix evidence).
- `GET /api/programs/?major_name=__no_such_name__` → assert `page_size == 20`, not `0` (BUG-9 fix).
- `GET /api/scores/?program_ids=,,,` → assert `400` instead of `500` (RISK-4 fix).
- `GET /api/scores/?program_ids=not_a_uuid,also_not_a_uuid` → assert `400` (BUG-7 fix).
- `POST /api/scores/bulk-upsert/` with `Authorization: Bearer t` and `user_metadata={'role':'admin'}, app_metadata={}` → assert `403` (BUG-3 fix evidence).
- `POST /api/scores/bulk-upsert/` with `{"items":[{"university_program_id":"x","year":2026}]}` → assert `400` (BUG-4 fix evidence).
- `POST /api/scores/bulk-upsert/` with `{"items":[{"university_program_id":1,"admission_method_code":"THPT","year":2026,"score":42}]}` → assert `400` (BUG-4 — score above 40).
- `GET /api/majors/recommendations/?score_min=24&score_max=27&block=A00` → assert only THPT scores from `_last_year() - 1` onward are loaded (BUG-10 fix — assert via `_fetch_all_rows` call-count mock).
- `_score_to_tier(89)` → assert `'A'`; `_score_to_tier(90)` → assert `'S'` after BUG-8 rescale.
- `GET /api/awards/` with `Authorization: 'Bearer  abc'` (two spaces) → assert `200` with anon-client behaviour (BUG-11 fix).

---

## 8. Quick Wins (under 1 hour each)

- **Add `đ→d, Đ→D` translation to `_is_scale_40` and `normalizeScoreTo30` and restore the `>30.0` fallback** (BUG-1, BUG-2). Single-file fix in each of two files.
- **Bump `programs:list:v2 → v3` and `programs:detail:v2:{pk} → v3`** (BUG-5).
- **Replace `test_scale_40_requires_explicit_note` with the canonical-spelling input** (`'Thang điểm 40'`) so the regression cannot pass review again.
- **Delete dead `scores_by_program` aggregate** (`academics/views.py:131-142`).
- **Delete `getProgramScores`** (`services/api.ts:247-249`) and `getLatestScore` (`TruongDetailPage.tsx:94-102`).
- **Return `DEFAULT_PAGE_SIZE` instead of `0` on the no-match short circuit** (BUG-9).
- **Add `.eq('admission_method_code', 'THPT').gte('year', _last_year() - 1)` to recommendations** (BUG-10).
- **Add `SECRET_KEY` enforcement to `prod.py`** (RISK-2).
- **Import `MAX_PAGE_SIZE` in `core/api/views.py:34` and `academics/views.py:282`** (BUG-6).
- **Add `.limit(200)` to `_major_codes_by_name`** (BUG-7 part 1).
- **Distinguish "missing" from "empty" for `program_ids`** (RISK-4).
- **Delete `backend/db.sqlite3`**.
- **Add `.env.test`, `.env.test.bak`, `.env_used_for_check` to `.gitignore`** (or broaden the `.env*` rule).
- **Remove stale `SUPABASE_DB_*`, `THROTTLE_USER`, `CACHE_TTL_*` entries from `.env.example`**.

---

## 9. Larger Improvements

In order of blast radius (lowest first):

1. **Centralize Vietnamese normalization.** Create `core/normalization.py::normalize_vietnamese(text)` (translate `đĐÐ → d`, then NFD-strip diacritics, then lower) and have BOTH `_is_scale_40` and any future filter use it. Mirror as `normalizeVietnamese` in `frontend/src/app/services/api.ts`. BUG-1 happened because the normalization rule is reinvented per site.
2. **Lift `normalizeScoreTo30` and the four "fetch all pages" helpers into `services/api.ts`.** Pure refactor; do this before fixing BUG-1's frontend half so the fix lands once.
3. **Introduce `get_service_client()`** in `core/supabase_client.py` and migrate `bulk_upsert` (BUG-4). Don't cache the service client globally — construct per call so key rotation propagates.
4. **Move `is_staff` to `app_metadata`** (BUG-3) and coordinate with whoever provisions admin accounts — they need to call the Supabase Admin API instead of `auth.updateUser`. Ship a one-shot migration script first that copies `user_metadata.role/is_admin` to `app_metadata.role/is_admin` for current admins.
5. **Backward-compatible `/nganh/:id` fallback** (carry-over from 06-18 BUG-4). The route param changed semantics from major code → program id and there is still no redirect for old bookmarks. Add a 404→`getMajorDetail` fallback in `NganhDetailPage.tsx:196`.
6. **CI for the frontend** — add `typescript` + `tsconfig.json`, wire `tsc --noEmit` into a GitHub Actions job that also runs `python -m pytest backend/` with `testpaths = src core`. The current `pytest.ini testpaths = src` skips the `core` tests entirely.

---

## 10. Prioritized Action Checklist

1. **Patch BUG-1 + BUG-2 together**: unified `_is_scale_40` with `đ`-translation + `>30.0` value fallback; mirror in `normalizeScoreTo30`. Replace the misleading `test_scale_40_requires_explicit_note` with the canonical Vietnamese-input cases listed in Section 7.
2. **Patch BUG-3**: switch `SupabaseUser` to read `app_metadata`; update `FakeAdminClient` to `app_metadata={'role':'admin'}` and add the "user_metadata is ignored" test.
3. **Patch BUG-4**: add `get_service_client`, `BulkAdmissionScoreItemSerializer`, throttle scope; migrate `bulk_upsert`.
4. **Patch BUG-5**: rename `programs:list:v2 → v3` and `programs:detail:v2:{pk} → v3` in the same commit as the `_SELECT` change so deploy invalidates cache.
5. **Reconcile the three `page_size` ceilings** to a single `MAX_PAGE_SIZE` (BUG-6).
6. **Cap `_major_codes_by_name` at 200 rows; UUID-validate `program_ids`; drop redundant frontend dual-fetch** (BUG-7).
7. **Rescale `TIER_THRESHOLDS` to a 90-point total and add `max_value=80` on `base_score`** (BUG-8). Bump `rankings:list → v2`.
8. **Return `DEFAULT_PAGE_SIZE`, not 0, on the empty `major_name` path** (BUG-9).
9. **Filter `recommendations` by THPT + year window** (BUG-10).
10. **Fix `AwardCatalogView` bearer parsing** (BUG-11).
11. **Add `finalize-profile` for the email-confirmation register path** (BUG-12).
12. **De-hardcode the year columns in `TruongDetailPage` and delete dead helpers** (BUG-13).
13. **Distinguish missing vs empty `program_ids`** (RISK-4).
14. **Add `max_pages` to `_fetch_all_rows`** (RISK-1).
15. **Enforce `SECRET_KEY` in `prod.py`** (RISK-2).
16. **Escape comma/parens in search terms** (RISK-3).
17. **Add `typescript` + `tsconfig.json`; wire `tsc --noEmit` into the lint script.**
18. **Widen `pytest.ini testpaths` to include `core/`** so the auth and api test suites actually run.
19. **Clean up `.env.example`, `.gitignore`, `docker-compose.yml`** per Section 6.
20. **Delete dead code per Section 5.**
21. **Move historical `code-review-*.md` files into `docs/code-reviews/`** so the repo root stops growing (this file makes 27).
