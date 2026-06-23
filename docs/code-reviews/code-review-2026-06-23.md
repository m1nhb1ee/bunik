# Code Review — Bunik — 2026-06-23

## 1. Executive Summary

**Health verdict.** The codebase is well-structured for a school project (Django REST + Vite/React/TS + Supabase), with reasonable test coverage on auth and admission permissions and a clean middleware/cache/error layer. However, there are real cross-layer bugs — most importantly the user-facing **tier ladder is inconsistent** between backend rankings and frontend profile, and one Supabase pagination helper raises on an off-by-one boundary. Test coverage outside auth/admission permissions is thin.

**Highest-risk areas.**
1. Frontend `getTierThreshold` ≠ backend `_score_to_tier` — same score yields different tier on the BXH page vs the Ho So page.
2. `core.supabase_client._fetch_all_rows` (via `src/academics/views.py:52`) raises `RuntimeError` when the dataset is exactly `N * page_size` rows because of an incorrect `for/else`.
3. `RegisterSerializer.validate_grade` requires grade ∈ [10,12], but `AuthPage.tsx` renders a `<select>` with grades 1–12, so client side will let the user pick 1–9 and the server will 400.
4. `database/migrations/migration_v6.sql` references DB objects but `DATABASES = {}` in Django; the `db` service in `docker-compose.yml` is dead — confusing for new contributors and a deploy footgun.
5. `docs/API_ENDPOINTS.md` is stale (documents `/api/auth/token/` JWT flow, `next/previous` keys) but the live API is Supabase-based with a different envelope.

**Validation commands run.**
- `python -m pytest --tb=short -q` → **PASS** (28 passed in 1.25s).
- `python manage.py check` → **PASS** (System check identified no issues).
- `tsc --noEmit` → **PASS** (exit 0).
- `npm run build`, `eslint`, `flake8`, `black --check` → **SKIPPED** (no eslint config; no incremental risk to running build in a review pass; `npm run lint` is aliased to `tsc --noEmit`, already covered).

**Confirmed bugs:** 4. **Inferred risks:** 5.

---

## 2. Critical and High-Risk Findings

### [BUG-1] — High — Tier thresholds disagree between backend and frontend

- **File/lines:** `backend/core/api/views.py:22-29` (and `_score_to_tier` at 45-49) vs `frontend/src/app/data/mockData.ts:613-621`.
- **Evidence (backend):**
  ```python
  TIER_THRESHOLDS = (
      (90, 'S'), (80, 'A'), (70, 'B'),
      (60, 'C'), (45, 'D'), (30, 'E'),
  )
  ```
- **Evidence (frontend):**
  ```ts
  export const getTierThreshold = (score: number): string => {
    if (score >= 150) return "S";
    if (score >= 100) return "A";
    if (score >= 90)  return "B";
    if (score >= 75)  return "C";
    if (score >= 60)  return "D";
    if (score >= 45)  return "E";
    return "F";
  };
  ```
- **Root cause:** Two independent constant tables encoding the same business rule diverged.
- **Impact:** A user with `score = 85` is rendered as tier **A** on `/bxh` (uses backend `tier`) and tier **C** on `/ho-so` (uses frontend `getTierThreshold(totalScore)`). The "Bang Tier" cheat-sheet in `HoSoPage.tsx:686-705` shows the wrong cutoffs as well.
- **Cross-layer effects:** `BXHPage.tsx` displays `user.tier` from API; `HoSoPage.tsx:234` calls `getTierThreshold(totalScore)`. Any future docs or share-graphs will inherit whichever is wrong.
- **Fix:** Choose one authoritative ladder, then either (a) move tier to the backend and remove `getTierThreshold` from the frontend, having `HoSoPage` show only the numeric score plus a single shared ladder constant exposed over a `/api/tiers/` endpoint, or (b) duplicate the same numbers verbatim in both places with a comment pointing at the other. Until then, at minimum update `frontend/src/app/data/mockData.ts` so the seven cutoffs match `TIER_THRESHOLDS`.
- **Validation:** After fix, add a test asserting that for a few canonical scores (29, 30, 59, 60, 80, 90), the backend `_score_to_tier(s)` and frontend `getTierThreshold(s)` agree (the latter via a small JS unit test or a snapshot test).

### [BUG-2] — High — `_fetch_all_rows` raises on exact-multiple result sizes

- **File/lines:** `backend/src/academics/views.py:52-66`.
- **Evidence:**
  ```python
  def _fetch_all_rows(query_factory, page_size=1000, max_pages=50):
      rows = []
      start = 0
      for _page in range(max_pages):
          ...
          if len(batch) < page_size:
              break
          start += page_size
      else:
          logger.error('Supabase fetch exceeded max_pages=%s page_size=%s', max_pages, page_size)
          raise RuntimeError('Supabase fetch exceeded maximum page count')
      return rows
  ```
- **Root cause:** The `for/else` only fires when the loop exhausts without `break`. With 50,000 rows (exactly `max_pages * page_size`), the 50th batch is exactly full, the loop completes without break, and the `else` raises — even though the function actually fetched every row correctly.
- **Impact:** As Supabase data grows, calls like `_major_overview_rows`, `_thpt_last_year_program_ids`, `_active_major_codes`, and `recommendations` may start failing intermittently with 500s the moment any of those tables hit a page-size boundary (e.g. `university_programs` = 50,000). At the smaller `_thpt_last_year_program_ids` and `_active_major_codes` calls there's no detection that fetching was actually complete vs. truncated — the function happily returns a *partial* set when fewer than 50 pages are reached, but the `if` branch is only triggered by `len(batch) < page_size`.
- **Cross-layer effects:** Every cached endpoint that runs through `/api/majors/`, `/api/majors/overview/`, `/api/majors/recommendations/` will return a 500 on this boundary.
- **Fix:** Issue one extra probe page after a full batch to confirm there are no more rows, or use a `received_so_far < total_count` loop with PostgREST `count='exact'`. Concretely:
  ```python
  for _page in range(max_pages):
      response = query_factory().range(start, start + page_size - 1).execute()
      batch = response.data or []
      rows.extend(batch)
      if len(batch) < page_size:
          return rows
      start += page_size
  logger.error('Supabase fetch exceeded max_pages=%s page_size=%s', max_pages, page_size)
  raise RuntimeError('Supabase fetch exceeded maximum page count')
  ```
- **Validation:** Add a unit test that monkeypatches `query_factory` to return exactly `max_pages * page_size` rows and asserts it returns the full list without raising. Add another test where the API returns fewer rows than `page_size` to verify early termination.

### [BUG-3] — High — `AuthPage` lets users pick a grade the server will reject

- **File/lines:** `frontend/src/app/pages/AuthPage.tsx:252-258`; backend `core/auth/serializers.py:18` (`grade = serializers.IntegerField(min_value=10, max_value=12)`).
- **Evidence (frontend):**
  ```tsx
  {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
    <option key={grade} value={grade}>{grade}</option>
  ))}
  ```
- **Root cause:** The select renders 1..12 instead of 10..12.
- **Impact:** Any user who picks 1–9 will hit a 400 on `/api/auth/register/` with no grade-specific message — only the generic catch-all the page surfaces.
- **Fix:** Change to `Array.from({ length: 3 }, (_, i) => i + 10)`. While here, the page initializes `grade: "11"`, so default behavior is fine; but the dropdown should match the server's accepted range.
- **Validation:** Manual: register with grade 9 from the UI; should never be selectable. Or add a frontend snapshot/DOM test asserting only options 10/11/12 are rendered.

### [BUG-4] — High — `Authorization` header forwarded with `undefined`/missing tokens, but `getAwardsCatalog(token?)` typing allows `token === undefined` while several callers always pass a token

- **File/lines:** `frontend/src/app/services/api.ts:27-45` (`get` helper) and consumers like `HoSoPage.tsx:158-163`.
- **Evidence:**
  ```ts
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  ```
- **Root cause:** This particular form is *fine* for `undefined` (no header sent), but `getAwardsCatalog` declares `token?: string` and is invoked from `HoSoPage.tsx:160` with a token *only* after the page asserts the user is authenticated. The same `getAwardsCatalog` is also exposed for use without a token via the public `AwardCatalogView` (backend `core/auth/views.py:352-378`). The frontend never exercises the no-token path. The mismatch is subtle but means an anonymous render of the page (e.g. mobile prefetch) will pass `undefined` and skip authentication, which is correct — but the surrounding error handling in `HoSoPage.tsx:194-203` only recognizes `errorMsg.includes("401")`. The backend's standard error envelope is `{ code: "http_401", message: ..., details: ... }` (see `core/errors/handlers.py:53-58`), so `err.message` will be the localized `"Token khong hop le"` or `Request failed`, never the literal `401`.
- **Impact:** When the access token expires, the user sees the generic Vietnamese error and the page never auto-clears the stale localStorage, so subsequent refreshes loop on the same error.
- **Fix:** Either (a) include the HTTP status in the thrown `Error`, e.g.
  ```ts
  const error = new Error(message);
  (error as Error & { status?: number }).status = res.status;
  throw error;
  ```
  then check `err.status === 401`; or (b) have the backend put `code: "unauthorized"` on 401s and check `errorMsg === "Token khong hop le"`. Option (a) is cleaner.
- **Validation:** Expire the token in localStorage, reload `/ho-so`, confirm it surfaces the "Phien dang nhap da het han" message and clears tokens.

---

## 3. Bugs and Reliability Risks

### [BUG-5] — Medium — `ProvinceViewSet.list` skips the search sanitization used elsewhere

- **File/lines:** `backend/src/universities/views.py:23-28`.
- **Evidence:** `query = query.ilike('name', f'%{search}%')` — no `_sanitize_postgrest_search(search)` applied, even though the same module defines that helper at line 12 and uses it in `UniversityViewSet.list`.
- **Impact:** A user search containing `,`, `(`, `)`, `*`, `%` or `_` reaches PostgREST raw and either breaks the filter syntax (`,`/`(`/`)`) or silently bypasses LIKE escaping (`%`/`_`).
- **Fix:** Mirror the pattern used in `UniversityViewSet.list`:
  ```python
  safe_search = _sanitize_postgrest_search(search)
  if safe_search:
      query = query.ilike('name', f'%{safe_search}%')
  ```

### [BUG-6] — Medium — `maybe_single()` on profile/score lookups can raise when the row is missing, returning 500 to legitimate flows

- **File/lines:** `backend/core/auth/views.py:37-49` (`_profile_by_id`, `_score_by_user_id`).
- **Evidence:** Both helpers call `.maybe_single().execute()` and re-raise on any exception. In some supabase-py / PostgREST configurations, `maybe_single()` raises `APIError(code='PGRST116')` when no row is found instead of returning `data=None`. The view's catch-all `except Exception` then returns `Internal server error` (500).
- **Impact:** A freshly registered user who has not yet pushed scores will hit `/api/auth/me/` → score row missing → 500 instead of `score=null` fields. Same for `/api/auth/login/` post-register before profile insert lands.
- **Fix:** In both helpers, wrap the call and treat the "no rows" condition as `data=None`:
  ```python
  try:
      return client.table('users').select('*').eq('id', user_id).maybe_single().execute()
  except Exception as exc:
      if 'PGRST116' in str(exc) or 'No rows' in str(exc):
          return type('Resp', (), {'data': None})()
      raise
  ```
  Better: switch to `.limit(1).execute()` and read `data[0] if data else None`.
- **Validation:** Add a regression test that simulates the supabase client raising a `PGRST116`-shaped error from `_score_by_user_id` during `/me` and asserts a 200 with `math` etc. omitted.

### [RISK-1] — Medium — Cache key omits the bearer token, so anonymous and authenticated responses can be cross-served

- **File/lines:** `backend/core/api/cache.py:15-19`.
- **Evidence:** `raw = f'{namespace}:{request.path}?{query}'` — no user/token component.
- **Impact:** Today only `AwardCatalogView` chooses anon-vs-user client based on auth header (`core/auth/views.py:355-365`), and that endpoint doesn't use the cache. But the moment another cached endpoint conditionally returns different content for logged-in vs. anonymous users (e.g. recommendations using profile preferences), the wrong payload will be served to the wrong user. Treat this as a sharp edge.
- **Fix:** When introducing per-user payloads, add a discriminator to `namespace` — e.g., `f'{namespace}:user:{request.user.id}'` — or refuse to cache for authenticated requests by returning `producer()` early when `request.user.is_authenticated`.

### [RISK-2] — Medium — Token storage in `localStorage` is XSS-readable

- **File/lines:** `frontend/src/app/pages/AuthPage.tsx:176-178`, `Layout.tsx:30-50`.
- **Evidence:** `localStorage.setItem("gr1_access_token", response.access_token)` and `localStorage.setItem("gr1_refresh_token", response.refresh_token)`.
- **Impact:** Any XSS (e.g. via an upstream dependency or a future user-content render) will exfiltrate both access *and* refresh tokens. The refresh token is the higher-value secret.
- **Fix:** Move to httpOnly cookie set by the backend after `/login`; or at minimum, avoid storing the refresh token in `localStorage` (keep only the short-lived access token, and require re-login when it expires). This is a scope-shift, so flag it for a follow-up.

### [RISK-3] — Medium — `HoSoPage` save loop deletes all achievements then re-inserts them — not atomic

- **File/lines:** `frontend/src/app/pages/HoSoPage.tsx:310-315`.
- **Evidence:**
  ```ts
  for (const achievement of savedAchievements) {
    await deleteMyAchievement(token, achievement.id);
  }
  for (const item of selectedAchievements) {
    await addMyAchievement(token, { award_id: item.award_id, prize: item.prize });
  }
  ```
- **Impact:** If the user closes the tab, loses connection, or the second loop hits a 5xx, achievements are gone. There is no server-side transaction.
- **Fix:** Add a server-side `/api/auth/me/achievements/bulk-replace/` that does delete+insert in a Supabase RPC or in a single staged call. Until then, sequence as additions-first, then deletions; on partial failure, refetch and let the user see actual state.

### [RISK-4] — Low — `revoke_session` hard-coded 5-second `urlopen` timeout, no error swallowing

- **File/lines:** `backend/core/supabase_client.py:37-49`.
- **Evidence:** `with urlrequest.urlopen(request, timeout=5):` — raises on connection failure; the caller (`LogoutView`) catches `Exception` and returns 500 unless `is_invalid_credentials_error` matches.
- **Impact:** A transient Supabase blip during logout produces a 500. Logout should arguably succeed locally even if the remote revoke times out.
- **Fix:** In `LogoutView`, classify `urlopen` timeout as a soft failure and still return 200 with a warning logged — the client will clear localStorage anyway.

### [RISK-5] — Low — `_paginate_rows` in `core/api/views.py` recomputes the entire ranking dataset for every page

- **File/lines:** `backend/core/api/views.py:32-42` together with the `load()` closure in `RankingsListView.get`.
- **Evidence:** Cache key includes page/page_size; every cache miss runs `load()` which always selects every user + every score row, sorts, then slices.
- **Impact:** Acceptable at current scale (120s cache) but a hot pagination footprint as user count grows.
- **Fix:** Cache the *sorted* full list under a key independent of `page`/`page_size`, then slice inside the view. This means storing the entire ranking once per 120s instead of once per page-size pair.

---

## 4. Duplicate and Inconsistent Code

- `_sanitize_postgrest_search` is defined twice — `backend/src/academics/views.py:88` and `backend/src/universities/views.py:12` — with identical bodies. Move it to `backend/core/supabase_client.py` and import from both views. (Real maintenance risk: two copies have already started to drift in terms of which callers use it; see BUG-5.)
- `Obj` test-helper class duplicated verbatim in `backend/core/auth/tests/test_auth_views.py:5-8` and `backend/src/admissions/tests/test_security.py:5-8`. Move to `backend/conftest.py` to make new tests cheaper.
- The validation block (`if not user_id or not access_token: return 401`) is repeated in 8 places across `core/auth/views.py` (lines 211, 257, 277, 387, 401, 438, 464, 478, 511). Extract a `require_auth(request)` helper that returns `(user_id, access_token)` or raises `AuthenticationFailed`.

## 5. Dead, Stale, or Unused Code

- **`backend/docker-compose.yml` `db` service.** Confidence: High. `config/settings/base.py:55` is `DATABASES = {}` — Django never connects. The compose file still spins up Postgres 16, the Dockerfile installs `postgresql-client`. A new contributor will wire it up by accident.
- **`backend/Dockerfile` `postgresql-client` install.** Confidence: High. Not used at runtime.
- **`docs/db_ver1/`** directory. Confidence: Medium. `database/migrations/migration_v6.sql` is the active schema; v1 docs are visibly older. Verify before deleting.
- **`docs/API_ENDPOINTS.md`** describes a SimpleJWT-style `/api/auth/token/` flow and `next/previous` pagination that the live code does not implement. Confidence: High — `core/auth/urls.py:17-28` shows no `/token/` endpoints, and `core/supabase_client.py:155-170` returns `{count, page, page_size, results}` with no `next`/`previous`.
- **`backend/src/academics/tests/__init__.py`** and **`backend/src/admissions/tests/__init__.py`** are missing. Pytest discovers tests via rootdir scan so they still run, but Django/IDE tooling that imports the test package will fail. Confidence: High (verified by `ls`).

## 6. Dependency, Config, and Tooling Concerns

- `Dockerfile` pins `python:3.12-slim` but local dev runs Python 3.10 (per the in-repo `venv/pyvenv.cfg`). Pin the version in `requirements/base.txt` constraints or in CI; runtime mismatch can let bugs slip past local tests (e.g. PEP 695 syntax). The current code uses `str | None` PEP 604 unions which work in both 3.10+ and 3.12, so no immediate breakage — but the divergence is a known foot-gun.
- `frontend/package.json:scripts.lint` is aliased to `tsc --noEmit`. ESLint is not installed. The repo has reached non-trivial size (5,400+ lines of TSX); add ESLint with `@typescript-eslint` + the React Hooks plugin to catch unused vars, missing deps in `useEffect`, etc. The `HoSoPage` `useEffect` at line 149 with empty deps `[]` is the kind of issue ESLint's `react-hooks/exhaustive-deps` would flag.
- `backend/pytest.ini` sets `testpaths = src core`. The `core/api/tests/__init__.py` is present; the others under `src/` are not (see §5). Either add the init files or set `python_classes = Test*` consistently — pytest works today but the discovery model is fragile.
- `backend/requirements/base.txt` pins `Django==5.0.1` (released Jan 2024). Django 5.0 reaches end-of-life April 2025; this codebase is dated 2026. Plan to bump to 5.1 LTS-bridge or 5.2 LTS.
- `frontend/package.json` declares **42 `@radix-ui` packages** plus shadcn-style UI scaffolding. Most are imported only inside `src/app/components/ui/*.tsx` shadcn primitives. If the app actually uses only Buttons/Inputs/Selects/Tabs/Dialogs (which is what I see in `AuthPage`/`HoSoPage`), 30+ of these can be removed to cut install time. Grep first; treat as Quick Win.

## 7. Test Gaps

The pytest suite is 28 tests, mostly happy-path or single-auth-failure cases. Concrete missing tests, in priority order:

- `GET /api/rankings/?page=2` when there are >page_size users → assert each user appears in exactly one page and the union equals the full list (would catch any future regression in `_paginate_rows`).
- `_fetch_all_rows` with a mock returning exactly `max_pages * page_size` rows → assert it returns the full list, not RuntimeError (BUG-2 regression test).
- `_score_by_user_id` when supabase raises `PGRST116` (no rows) → assert `/api/auth/me/` returns 200 with score fields omitted (BUG-6 regression test).
- `GET /api/provinces/?search=*` (special PostgREST char) → assert no 500, no crash (BUG-5 regression test).
- `POST /api/scores/bulk-upsert/` with > 1,000 items → assert reasonable behavior (currently no upper bound, no chunking; the serializer will validate all but a single Supabase upsert may exceed PostgREST request size).
- `LogoutView` when `revoke_session` raises `socket.timeout` → assert 200 (RISK-4).
- `frontend/src/app/services/api.ts` `fetchAllPaginated` when first page has `page_size: 0` or `count: 0` → assert no infinite loop (today `Math.max(1, Math.ceil(0/100)) = 1`, so first page already covered; add a snapshot just to lock it in).
- Frontend `getTierThreshold` tier table vs backend `_score_to_tier` (BUG-1 regression test — best done as a JSON fixture both sides import).

## 8. Quick Wins (under 1 hour each)

- Replace `Array.from({ length: 12 }, (_, i) => i + 1)` with `Array.from({ length: 3 }, (_, i) => i + 10)` in `AuthPage.tsx:253` (BUG-3 fix).
- Sync `frontend/src/app/data/mockData.ts:613-621` thresholds with backend `TIER_THRESHOLDS` (or vice-versa) — half of BUG-1.
- Apply `_sanitize_postgrest_search` to `ProvinceViewSet.list` (BUG-5).
- Add `__init__.py` files to `backend/src/academics/tests/` and `backend/src/admissions/tests/`.
- Move `core/api/cache.py` cache key to include `request.user.id` for authenticated requests (RISK-1 preemptive fix).
- Delete the `db` service and `postgresql-client` install from `backend/docker-compose.yml` / `Dockerfile` (or document why they stay).
- Refactor the `if not user_id or not access_token: return 401` pattern into a `require_auth(request)` helper in `core/auth/views.py` (§4).

## 9. Larger Improvements

Sequenced by blast radius, lowest first:

1. **Unify tier ladder.** Introduce a single source of truth — `backend/core/tiers.py` with `TIER_THRESHOLDS`, exposed at `/api/tiers/`. Frontend fetches once on app load and uses it everywhere. Blast radius: small (HoSoPage, BXHPage). What breaks if done wrong: tier labels flicker on first paint. Mitigation: ship with current frontend constants as fallback.
2. **Fix `_fetch_all_rows`** (BUG-2). Blast radius: medium (all `/api/majors/*` endpoints). Risk: introducing a new pagination bug. Mitigation: write the regression test first.
3. **Profile/score lookups must tolerate missing rows.** BUG-6. Blast radius: medium (auth/profile). Mitigation: convert to `.limit(1).execute()` and add the missing-user regression test before touching any code.
4. **Token storage hardening.** Move refresh token to httpOnly cookie (RISK-2). Blast radius: large (all authenticated flows). Mitigation: feature-flag a new `/auth/login-cookie/` path while the old `/login/` keeps returning the body token; cut over once stable. Requires CORS `credentials: include` changes on every fetch.
5. **Atomic profile save** (RISK-3). Add a `/api/auth/me/achievements/bulk-replace/` endpoint; do the delete-then-insert server-side and ideally inside a Supabase RPC. Blast radius: medium (HoSoPage). Mitigation: make the new endpoint additive; keep the per-item endpoints for compatibility.

## 10. Prioritized Action Checklist

1. Patch `AuthPage.tsx` grade dropdown to 10/11/12 (BUG-3).
2. Patch tier thresholds in `mockData.ts` to match backend (half of BUG-1); add a unit test that fixes both ends.
3. Rewrite `_fetch_all_rows` to `return rows` inside the loop (BUG-2); add a regression test.
4. Wrap `_profile_by_id` / `_score_by_user_id` to swallow PGRST116/no-rows and return `data=None` (BUG-6); add a regression test.
5. Apply `_sanitize_postgrest_search` in `ProvinceViewSet.list` (BUG-5).
6. Add `Authorization` 401 detection by HTTP status instead of `errorMsg.includes("401")` in `HoSoPage.tsx` (BUG-4).
7. Add `__init__.py` to `src/academics/tests/` and `src/admissions/tests/`.
8. Extract duplicated `_sanitize_postgrest_search` into `core/supabase_client.py`.
9. Add `request.user.id` to cache key in `core/api/cache.py` (RISK-1 preemptive).
10. Update `docs/API_ENDPOINTS.md` to match real endpoints (remove `/api/auth/token/`, drop `next`/`previous` from sample payloads).
11. Delete dead `db` service + `postgresql-client` from `Dockerfile` / `docker-compose.yml` or document their purpose.
12. Add ESLint + `react-hooks/exhaustive-deps`.
13. Plan refresh-token migration to httpOnly cookies (RISK-2) — schedule, do not rush.
14. Plan `/achievements/bulk-replace/` server-side atomic endpoint (RISK-3).
15. Bump Django to a supported version (5.1+) ahead of EOL.
