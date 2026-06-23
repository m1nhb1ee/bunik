# Code Review — 2026-06-19 (afternoon)

Scope: uncommitted changes on the working tree (backend `_is_scale_40` rewrite,
new admissions filters, frontend program-id rewiring), plus surrounding
read-through of `core/` and the rewritten `NganhDetailPage.tsx`.

---

## 1. Executive Summary

Overall health: **the scale-40 rewrite ships a real regression** that silently
breaks the only piece of business logic the new tests are supposed to cover.
The rest of the diff (admissions filters, frontend program-id contract) is
internally consistent but introduces an unbounded `ilike` substring match that
will overmatch popular major names and inflate every NganhDetailPage load to
~N+M network round-trips.

Highest-risk areas, in order:

1. `_is_scale_40` no longer matches the most common note form (`"thang điểm 40"`
   with Vietnamese diacritics). NFD does **not** decompose `đ`, so the ASCII
   filter eats the `d`. Identical bug in the frontend's `normalizeScoreTo30`.
2. `_major_codes_by_name` does an unanchored `ilike` on `major_catalog.name`
   without escaping `%`/`_`, with no length floor, and is invoked from
   NganhDetailPage with the major name as found — short or generic names will
   merge unrelated majors into a single "program selector".
3. `bulk_upsert` writes raw `items` from the request body straight to
   `admission_scores.upsert(...)`. The only gate is `is_staff`. No whitelist,
   no shape validation.
4. NganhDetailPage now performs a cascade of paginated calls
   (`getProgramDetail` → `getMajorDetail` → two `getAllPrograms` → batched
   `getAdmissionScores`). For a popular major this is tens of round-trips per
   page view; nothing caches across re-renders.
5. `.env.test`, `.env.test.bak`, and `.env_used_for_check` are sitting
   untracked next to `.env.example`. They should not exist as committed
   artifacts and `.env.test.bak` in particular should not exist at all.

Validation commands run:

- `python -m py_compile` on the four touched Python files → **pass**.
- `python -m pytest` → **skipped**. The workspace VM does not have Django,
  DRF, supabase-py, or pytest-django installed and `pip install` for the full
  stack exceeded the 45 s shell budget. Confirmed behaviour by reproducing the
  `_is_scale_40` function in isolation (`python -c`) and feeding it the
  real-world note shapes — see Evidence under BUG-1.
- `npx tsc --noEmit` → **skipped**. `node_modules` is partially deleted
  (visible in `git status`), so no node toolchain is currently usable in the
  workspace.
- `npm run lint` → **n/a**. `package.json` defines `"lint": "echo \"No lint
  config yet\""`.

Confirmed bugs: **2**. Inferred risks (logic / scale / security): **5**.

---

## 2. Critical and High-Risk Findings

### [BUG-1] — CRITICAL — `_is_scale_40` silently fails for the actual Vietnamese note format

**File/lines:** `backend/src/academics/views.py:62-67`

**Evidence:**

```python
def _is_scale_40(score_value, note):
    if score_value is None:
        return False
    note_text = (note or '').lower()
    normalized_note = unicodedata.normalize('NFD', note_text).encode('ascii', 'ignore').decode('ascii')
    return 'thang diem 40' in normalized_note
```

Reproduced in-process against the same call shape the view uses:

```
>>> _is_scale_40(30.0, 'thang điểm 40')      # the real DB form
False
>>> _is_scale_40(30.0, 'THANG ĐIỂM 40 (FULL)')
False
>>> _is_scale_40(30.0, 'thang diem 40')      # only matches the diacritic-free form
True
```

And, in raw NFD:

```
>>> unicodedata.normalize('NFD', 'thang điểm 40').encode('ascii','ignore').decode('ascii')
'thang iem 40'
```

**Root cause:** `unicodedata.normalize('NFD', …)` decomposes combining marks
(e.g. `ể` → `e` + U+0306 + U+0309), but `đ` is U+0111 *LATIN SMALL LETTER D
WITH STROKE* — a precomposed letter with no canonical decomposition. So the
`đ` survives NFD, then `.encode('ascii', 'ignore')` drops it entirely, and
`'diem'` becomes `'iem'`. The previous implementation explicitly tested both
literals: `'thang diem 40' in note_text or 'thang điểm 40' in note_text`.

**Impact:** every admission score whose note uses the diacriticised form
(which is what gets stored from Vietnamese tooling) is now classified as a
30-scale score. `_major_overview_rows` therefore writes the raw 40-scale value
into `score_30`, and writes `raw * 40 / 30 ≈ 53` into `score_40`. End-users
see the wrong "score quy đổi" on `/nganh` and `/nganh/:id`. The same column
also feeds the `/nganh` slider filter, so 40-scale programs disappear from
the 14–30 score window or surface in the wrong bucket entirely.

**Cross-layer effects:**

- `frontend/src/app/pages/NganhDetailPage.tsx:47-55` has the **same bug** in
  `normalizeScoreTo30`. It also relies on NFD-then-strip-combining to detect
  the note, so any score with `"thang điểm 40"` is rendered un-normalized.
- The two new tests in `backend/src/academics/tests/test_score_scale.py` only
  pass `None` and the ASCII form, so they pass while the production path is
  broken.
- `score_30` / `score_40` go into the `majors:overview:v3` cache (TTL 600 s),
  so a fix needs a cache-key bump.

**Fix:** strip `đ`/`Đ` explicitly before NFD (or just match both literals as
the old code did). Concrete patch:

```python
def _is_scale_40(score_value, note):
    if score_value is None:
        return False
    note_text = (note or '').lower().replace('đ', 'd')
    normalized = unicodedata.normalize('NFD', note_text).encode('ascii', 'ignore').decode('ascii')
    return 'thang diem 40' in normalized
```

Mirror the same `.replace('đ', 'd')` (and `'Đ' → 'D'` if you ever feed it
non-lowercased input) in `NganhDetailPage.tsx:normalizeScoreTo30`. Bump the
overview cache namespace to `majors:overview:v4`.

**Validation:** add to `test_score_scale.py`:

```python
def test_scale_40_with_vietnamese_diacritics():
    assert _is_scale_40(30.0, 'thang điểm 40') is True
    assert _is_scale_40(30.0, 'THANG ĐIỂM 40 (FULL)') is True
```

These will fail on the current code and pass after the patch.

---

### [BUG-2] — HIGH — `_major_codes_by_name` overmatches and ignores `%`/`_`

**File/lines:** `backend/src/admissions/views.py:16-28`, invoked at
`NganhDetailPage.tsx:205`.

**Evidence:**

```python
def _major_codes_by_name(client, major_name):
    name = (major_name or '').strip()
    if not name:
        return []
    response = (
        client.table('major_catalog')
        .select('code')
        .ilike('name', f'%{name}%')
        .execute()
    )
    return [row.get('code') for row in (response.data or []) if row.get('code')]
```

And the caller:

```ts
const majorName = (majorData.name || "").trim();
const programsByName = majorName ? await getAllPrograms({ major_name: majorName }) : [];
```

**Root cause:** `f'%{name}%'` is built without escaping. Two distinct problems:

1. `%` and `_` in user input become wildcards. Not a SQL-injection risk
   (PostgREST parameterises) but the matching semantics depend on the caller
   not containing those characters.
2. Far more importantly, the match is *substring*. `majorData.name` here is
   the canonical major name from `major_catalog`. For names like `"Cong nghe
   thong tin"` the substring `"Cong nghe"` is enough to match every
   `Cong nghe …` major (sinh hoc, ky thuat hoa hoc, thuc pham, …). The
   frontend then merges every returned `university_programs` row into the
   `programs` array used by the variant selector — i.e. the "Chon truong" chip
   list on `/nganh/:id` ends up containing programs from unrelated majors.

**Impact:** for any major whose name is a prefix of another, the detail page
shows the wrong programs and computes the wrong average score. The page only
behaves correctly for majors whose `major_catalog.name` is unique-as-substring
across the catalog.

**Cross-layer effects:** `NganhDetailPage`'s selected-program memo
(`programs.find(... === selectedProgramId)`) still resolves to the routed
program, but the chip list and any averaged metric drawn from
`scoresByProgram` are polluted.

**Fix:** match on `major_code` instead of `name` — every program for the same
major shares a `major_code` (or, if "same major across slightly different
codes" really is a product requirement, store an explicit `major_group_id` and
filter on that). If you must keep the name-based lookup, change the call site
to skip it whenever `major_code` already returned ≥1 program, and at minimum
escape user-controlled `%`/`_`:

```python
escaped = name.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
.ilike('name', f'%{escaped}%')
```

**Validation:**

```
GET /api/programs/?major_name=Cong%20nghe → expect <= programs with major_code matching that name only
```

Add a backend test that seeds `major_catalog` rows for both
`"Cong nghe thong tin"` and `"Cong nghe sinh hoc"` and asserts that
`_major_codes_by_name(client, 'Cong nghe thong tin')` returns *only* the IT
code.

---

### [RISK-1] — HIGH — `bulk_upsert` accepts unvalidated payloads

**File/lines:** `backend/src/admissions/views.py:225-246`

**Evidence:**

```python
@action(detail=False, methods=['post'], url_path='bulk-upsert', permission_classes=[IsAuthenticated])
def bulk_upsert(self, request):
    if not getattr(request.user, 'is_staff', False):
        return Response({'detail': 'You do not have permission to perform this action.'}, status=status.HTTP_403_FORBIDDEN)

    items = request.data.get('items')
    if not isinstance(items, list) or not items:
        return Response({'detail': 'items is required.'}, status=status.HTTP_400_BAD_REQUEST)

    response = get_client().table('admission_scores').upsert(
        items,
        on_conflict='university_program_id,admission_method_code,year',
    ).execute()
```

**Root cause:** every key in every dict in `items` is forwarded to Supabase
verbatim. There is no DRF serializer, no required-key check, no type coercion,
no per-row error handling. The `is_staff` gate keeps the public out, but a
typo in a CSV-import script overwrites whatever column it names (including
`created_at`, foreign keys, etc.) without surfacing the typo.

**Impact:** silent data corruption from internal tools is the realistic risk.
A single bad upsert that flips `university_program_id` across hundreds of
rows is hard to detect after the fact.

**Fix:** wrap `items` in a DRF `ListSerializer` of an explicit
`AdmissionScoreUpsertSerializer` with the four real fields
(`university_program_id`, `admission_method_code`, `year`, `score`, `note`),
`required=True` on the conflict key, validation on `year`/`score` ranges, and
chunk the upsert (e.g. 500 at a time) so a single bad row doesn't blow up the
whole call.

**Validation:** pytest case that posts `{'items': [{'evil': 1}]}` and asserts
400, plus a case that posts a well-formed row and asserts the response shape.

---

### [RISK-2] — HIGH — NganhDetailPage fan-out per page view

**File/lines:** `frontend/src/app/pages/NganhDetailPage.tsx:188-242`

**Evidence:**

```ts
const currentProgram = await getProgramDetail(routeProgramId);
const majorCode = currentProgram.major_code;
const [majorData, programsByCode] = await Promise.all([
  getMajorDetail(majorCode),
  getAllPrograms({ major_code: majorCode }),
]);
const majorName = (majorData.name || "").trim();
const programsByName = majorName ? await getAllPrograms({ major_name: majorName }) : [];
…
const allScores = await getAllAdmissionScoresByProgramIds(sameMajorPrograms.map((program) => program.id));
```

Then `getAllPrograms` paginates 100 per page until exhausted, and
`getAllAdmissionScoresByProgramIds` chunks ids into batches of 50 and again
paginates per batch.

**Root cause:** the detail page resolves the program → major → "all programs
for this major" → "all programs whose major name matches" (see BUG-2) →
"all admission scores for those programs". Each step is sequential except the
single `Promise.all` for `majorData`/`programsByCode`.

**Impact:** for a major with 200 programs and 5 years of data, this is 1 +
1 + ⌈200/100⌉ + ⌈200/100⌉ + 4 × 2 ≈ 14+ HTTP round-trips before the page
renders. With BUG-2 widening the matched set, that multiplies.

**Fix:**

- Drop the name-based call entirely (see BUG-2 fix).
- Make a new backend endpoint that returns the program *and* its sibling
  programs *and* their scores in one shot
  (`GET /api/programs/<id>/peers-with-scores/`), keyed by the same cache
  layer as the existing endpoints.
- Until that exists, kick off `getAllPrograms({major_code})` and the score
  fetch in parallel by passing the major_code straight to a scores endpoint
  that filters `university_programs.major_code` server-side instead of doing
  the in-list join client-side.

**Validation:** record-and-replay one detail-page navigation and count
network calls; target is ≤ 3.

---

### [RISK-3] — HIGH — `_split_csv_param` exposes scores list to URL-length blow-up

**File/lines:** `backend/src/admissions/views.py:12-13, 190-191`

**Evidence:**

```python
def _split_csv_param(value):
    return [item.strip() for item in (value or '').split(',') if item.strip()]
…
if program_ids := _split_csv_param(params.get('program_ids')):
    query = query.in_('university_program_id', program_ids)
```

**Root cause:** no upper bound on the number of comma-separated ids. The
frontend currently batches 50 per call (see
`NganhDetailPage.tsx:80`), so the in-product caller is fine. But any client
that passes 500 ids will produce a PostgREST URL longer than the default 8 KB
nginx/cloud-proxy limit, returning 414 with no usable error.

**Fix:**

```python
def _split_csv_param(value, *, max_items: int = 100):
    items = [item.strip() for item in (value or '').split(',') if item.strip()]
    return items[:max_items]
```

And return 400 (not silently truncate) once you've established what's expected
contractually. Document the limit in the `OpenApiParameter` description.

**Validation:** pytest case that posts `program_ids=` with 1000 ids and
asserts 400 with a clear error.

---

## 3. Bugs and Reliability Risks

### [BUG-3] — MEDIUM — Dead first-pass loop in `_major_overview_rows`

`backend/src/academics/views.py:131-142` builds `scores_by_program` (max
score per program per year) but the resulting dict is never read anywhere
else in the function. `normalized_scores_by_program` is the only structure
that drives the response. Delete lines 131-142.

### [BUG-4] — MEDIUM — `maybe_single()` ambiguity in auth flows

`core/auth/views.py:29, 37` rely on `client.table(...).maybe_single().execute()`
returning a response with `.data = None` for the zero-row case.
`supabase-py >= 2.x` raises `APIError` (PGRST116) for that case on some
versions and returns `data=None` on others. The functions catch `Exception`
and re-raise, so login/profile fetches fall through to a 500 instead of a
404. Pin behaviour with either an explicit pre-check or a try/except for
PGRST116 returning the 404/profile-missing message you intend.

### [BUG-5] — LOW — `_is_scale_40` regression also drops `score >= 30` shortcut

Previous behaviour treated any score ≥ 30 as 40-scale (since the THPT max is
30). The new code requires the note marker. This is consistent with the new
test `test_score_30_without_scale_note_stays_on_30_scale`, but it means any
40-scale row whose note is empty/null is now silently classified as 30-scale
and gets `score_40 = 40` in the overview. The DB has scores like 31.5/32 that
were 40-scale; if their note column is null they will now show as a 30-scale
"impossible" 31.5. Either keep the `>= 30` shortcut as a fallback, or do a
data-quality pass to make sure every 40-scale row carries the note.

### [RISK-4] — MEDIUM — `unicodedata` import is wasted after BUG-1 fix

If BUG-1 is fixed with the explicit `đ → d` replacement above, NFD adds
nothing the simple `.replace` doesn't already cover for the literal `"thang
diem 40"` test. Either keep NFD and document it (it gives you graceful
handling of accidentally-typed `e+◌̂` style sequences), or remove it.

### [RISK-5] — LOW — `program_source_code` ordering is unspecified for NULLs

`backend/src/admissions/views.py:101` adds
`.order('program_source_code')`. PostgREST defaults to NULLS LAST for ASC.
Rows with no `program_source_code` will land at the bottom of every page; if
that's intentional, leave a comment. Otherwise pass `nullsfirst=True` /
`nullslast=False` explicitly so the contract is in code.

---

## 4. Duplicate and Inconsistent Code

- **Scale-40 logic duplicated.** Backend `_is_scale_40`
  (`academics/views.py:62`) and frontend `normalizeScoreTo30`
  (`NganhDetailPage.tsx:47`) implement the same rule with the same bug. The
  backend `_major_overview_rows` *already* normalizes to `score_30` /
  `score_40` and returns both; the frontend should consume those columns and
  drop `normalizeScoreTo30` entirely.

- **Manual pagination loop.** Three near-identical implementations:
  - `getAllUniversities` in `services/api.ts:356-370`
  - `getAllPrograms` in `NganhDetailPage.tsx:63-76`
  - `getAllAdmissionScoresForUniversity` in `TruongDetailPage.tsx:46-67`
  Extract one generic helper `paginateAll<T>(fetchPage: (page: number) =>
  Promise<PaginatedResponse<T>>)`.

- **Error classifiers by substring.** `_is_duplicate_error`,
  `_is_invalid_credentials_error`, `_is_rate_limited_error`, `_is_rls_error`,
  `_is_missing_column_error` in `core/auth/views.py:81-103` all do `str(exc)
  .lower()` substring sniffing. Lift them into a single
  `classify_supabase_error(exc) -> Enum` so the patterns live in one place.

---

## 5. Dead, Stale, or Unused Code

- **`_major_overview_rows` lines 131-142** — `scores_by_program` built but
  never read. **High** confidence (grep `scores_by_program` returns only the
  two lines that build it).
- **`toUiMajor` in `services/api.ts:328-350`** — exported but no caller
  references it. `grep "toUiMajor" frontend/src/app -r` returns only the
  definition. The actual page (`NganhPage`) goes through `getAllMajors`
  which uses `ApiMajorOverview` directly. **High** confidence; safe to delete.
- **`DEFAULT_RADAR` and `radarScores` field on `UiUniversity`** — populated
  with literal placeholders, never updated. Either wire the radar data or
  drop the field.

---

## 6. Dependency, Config, and Tooling Concerns

- **`backend/.env.test`, `backend/.env.test.bak`, `backend/.env_used_for_check`
  are untracked but present.** `.env.test.bak` in particular is a leftover
  rename — delete it and add `*.bak` plus `.env_used_for_check` to
  `.gitignore`.
- **`backend/db.sqlite3` is checked in.** The README says "Khong co
  migration/runtime DB local trong backend" yet the SQLite file lives
  alongside `manage.py`. It's almost certainly the django auto-created
  sessions/admin db. Add `db.sqlite3` to `.gitignore`; if the file was ever
  committed (`git ls-files | grep db.sqlite3`), follow up with a
  `git rm --cached`.
- **Frontend lint and tests are no-ops.** `"lint": "echo \"No lint config
  yet\""` and `"test": "echo \"No frontend tests yet\""` will let CI pass on
  a broken build. Either wire ESLint + `tsc --noEmit` in CI now (the change
  set already moves type contracts), or delete the scripts so nobody mistakes
  them for working.
- **`frontend/node_modules/` is partially deleted in the working tree** (~all
  `.bin/*` entries show as `D` in `git status`). That means somebody at some
  point committed parts of `node_modules`. Make sure `node_modules/` is in
  `.gitignore` and that the deletions are committed so the index agrees with
  reality.

---

## 7. Test Gaps

The two new tests only cover the happy path of the change set. Missing
coverage for risky behaviour:

- `_is_scale_40` when `note='thang điểm 40'` (with Vietnamese diacritics) →
  assert `True`. **This test would have caught BUG-1.**
- `_is_scale_40` when `note='THANG ĐIỂM 40'` (uppercase) → assert `True`.
- `_major_codes_by_name(client, 'Cong nghe')` when the catalog contains both
  `Cong nghe thong tin` and `Cong nghe sinh hoc` → assert *exact-name* match
  semantics (i.e. the change you make for BUG-2).
- `_major_codes_by_name(client, '%')` → assert that the wildcard input does
  not silently match everything.
- `AdmissionScoreViewSet.list` with `program_ids` containing 1 valid id and
  1 garbage id → assert that the response still returns the valid id's
  scores instead of 500-ing on the DB.
- `bulk_upsert` with `items=[{}]` from a staff user → assert 400, not 500.
- `UniversityProgramViewSet.list` with `major_name='Cong nghe'` and a
  matching catalog row → assert the right `major_code` filter is applied.
  The placeholder test in `test_program_filters.py` only verifies the
  pattern string, not the integration with the list endpoint.

---

## 8. Quick Wins

1. In `backend/src/academics/views.py:65`, add `.replace('đ', 'd')` before
   the NFD step to fix BUG-1.
2. In `frontend/src/app/pages/NganhDetailPage.tsx:48`, prefix the same
   `.replace(/đ/g, 'd')` to the lowercase pipeline.
3. Delete `backend/src/academics/views.py:131-142` (BUG-3).
4. `git rm backend/.env.test.bak backend/.env_used_for_check` and add a
   `.env*.bak` pattern to `.gitignore`. Move `.env.test` to `.env.test.local`
   (which already exists) or document why both should coexist.
5. Add `db.sqlite3` to `backend/.gitignore`; verify with `git ls-files |
   grep db.sqlite3`.
6. Cap `_split_csv_param` at 100 items (RISK-3) — single-line change.
7. Wire `npm run typecheck` (`"typecheck": "tsc --noEmit"`) and have CI fail
   on it. The id-type changes in `types/api.ts` make this immediately useful.

---

## 9. Larger Improvements

Order from smallest blast radius to largest. For each, what to do first to
reduce risk:

1. **Stop duplicating scale-40 logic.** Have the backend overview /
   programs / scores endpoints return both `score_30` and `score_40` (the
   overview already does), and delete `normalizeScoreTo30` from the
   frontend. First step: bump the overview cache key to `:v4` so the next
   deploy invalidates stale entries that were computed with the buggy
   normalizer (BUG-1).

2. **Replace the name-based "sibling programs" lookup with a structural
   relationship.** Either fold "variants of the same major" into a single
   `major_code` (preferred) or add a `major_group_id` column on
   `university_programs` and migrate. First step: dump the current
   `major_catalog` and check how often two distinct codes share a name; the
   answer determines whether you need the new column at all.

3. **Move score aggregation to the backend.** Today every page averages
   scores client-side from a paginated fetch. Build a
   `GET /api/programs/<id>/score-summary/` that returns
   `{ year, method, mean, p25, p75, sample_size }` and have the detail page
   consume it. First step: instrument the existing detail-page network
   timeline so you have a baseline to compare against.

4. **Lock down `bulk_upsert`.** Introduce a DRF serializer (RISK-1) and an
   audit-log row per upsert call. First step: gate behind a Django Admin
   page or a CLI command instead of an HTTP endpoint while the serializer
   is being written.

---

## 10. Prioritized Action Checklist

1. Add `note.replace('đ', 'd')` to `_is_scale_40` (academics/views.py:65)
   and `normalizeScoreTo30` (NganhDetailPage.tsx:48). Re-deploy after
   bumping `majors:overview:v3` → `:v4`. **(BUG-1)**
2. Add the diacritic test cases listed in §7 to
   `backend/src/academics/tests/test_score_scale.py`. **(BUG-1)**
3. Replace `_major_codes_by_name` with a `major_code`-based lookup; remove
   the second `getAllPrograms({major_name})` call in NganhDetailPage.
   **(BUG-2, RISK-2)**
4. Delete dead `scores_by_program` loop in
   `academics/views.py:131-142`. **(BUG-3)**
5. Cap `_split_csv_param` at 100 items and document the limit in
   `OpenApiParameter`. **(RISK-3)**
6. Add a DRF serializer to `AdmissionScoreViewSet.bulk_upsert`. **(RISK-1)**
7. `.gitignore` hygiene: ignore `*.bak`, `db.sqlite3`, `node_modules/`;
   remove the three untracked `.env.test*` / `.env_used_for_check` files.
8. Wire `tsc --noEmit` into the frontend CI step.
9. Replace `maybe_single()` calls in `core/auth/views.py` with an explicit
   pre-check or `APIError` handling. **(BUG-4)**
10. Extract the three frontend "fetch every page" helpers into one
    `paginateAll` utility.
