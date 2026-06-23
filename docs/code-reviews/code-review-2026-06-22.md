# Code Review — 2026-06-22

Scope: `backend/` (Django 5 + DRF + Supabase REST), `frontend/` (Vite + React 18 + react-router 7), `database/` (Supabase migrations + crawl/import scripts).
Reviewer: senior-engineer pass focused on correctness, security, cross-layer drift, and dev-velocity blockers. Previous review on 2026-06-20 resolved BUG-1..5 from that pass; this review covers regressions/gaps not addressed there.

---

## 1. Executive Summary

**Health verdict:** Tests pass and TypeScript compiles, but there are three confirmed correctness bugs that silently corrupt user-facing data (mojibake mock list, time-bombed score validator, grade dropdown out of valid range) and one functional bug in the exception classifier that swallows real Supabase outages as 500s. Caching and RLS assumptions also create one privacy/perf risk in the rankings endpoint.

**Top risk areas:**
1. `BulkAdmissionScoreItemSerializer.year` upper bound is frozen at process-start, not evaluated per-request (BUG-1).
2. `is_supabase_error` in the exception handler has inverted logic — real Supabase connection failures return generic 500 (BUG-2).
3. `frontend/src/app/data/mockData.ts` is double-encoded UTF-8 (mojibake) — every Vietnamese label on `/xep-hang` and elsewhere is garbled (BUG-3).
4. Tier thresholds disagree between backend (`core/api/views.py`) and frontend (`mockData.getTierThreshold`) — the same user score yields a different "tier" depending on which page renders it (BUG-4).
5. Register grade `<select>` offers 1–12 but backend serializer rejects anything outside 10–12 — half the options always 400 (BUG-5).

**Validation commands run (exact results):**

| Command | Result |
|---|---|
| `pytest --tb=short -q` (backend, `testpaths=src core`) | **28 passed in 0.63s** |
| `python -c "django.setup(); call_command('check')"` | **System check identified no issues (0 silenced).** |
| `tsc --noEmit` (frontend) | **exit 0, no output** (clean) |
| `vite build` | **Skipped** — sandbox timeout (>45s). Existing `dist/` indicates prior builds succeed. |
| `file frontend/src/app/data/mockData.ts` | **UTF-8 (with BOM)** — but content is mojibake; confirmed by grepping `Ä\|»\|Æ`: 180 matches. |
| `python3 -c "BulkAdmissionScoreItemSerializer().fields['year'].max_value"` | **2027** (today's year is 2026 → max=year+1=2027, fine right now; bomb is in the **next** Jan-1 rollover). |

**Counts:** 5 confirmed bugs · 4 medium reliability/security risks · 4 cross-layer drifts · 3 quick wins.

---

## 2. Critical and High-Risk Findings

### [BUG-1] — HIGH — `BulkAdmissionScoreItemSerializer.year` upper bound is evaluated once at import, not per-request

- **File/lines:** `backend/src/admissions/serializers.py:9`
- **Evidence:**
  ```python
  class BulkAdmissionScoreItemSerializer(serializers.Serializer):
      university_program_id = serializers.UUIDField()
      admission_method_code = serializers.CharField(max_length=20)
      year = serializers.IntegerField(min_value=2000, max_value=date.today().year + 1)
  ```
  Runtime check confirms: with today = 2026-06-22, `BulkAdmissionScoreItemSerializer().fields['year'].max_value` returns `2027` — frozen at first import.
- **Root cause:** `date.today()` is called at class-definition time. Long-running gunicorn workers carry the boot-day's value indefinitely. On the next New Year's Day the server still believes the max year is last year + 1 until it restarts.
- **Impact:** Admins importing the new admission cycle on Jan-1 will see `year` rejected as "Ensure this value is less than or equal to N" with the wrong N. The error is silent in the sense that it is not flagged by any test (no test exercises the boundary).
- **Cross-layer effects:** Bulk-upsert endpoint (`/api/scores/bulk-upsert/`) — the only path that uses this serializer.
- **Fix:** Move the bound into `validate_year`:
  ```python
  from datetime import date
  ...
  year = serializers.IntegerField(min_value=2000)

  def validate_year(self, value):
      max_year = date.today().year + 1
      if value > max_year:
          raise serializers.ValidationError(f'year must be <= {max_year}')
      return value
  ```
- **Validation:** Add a unit test that monkeypatches `date.today` to `date(2027, 1, 5)` and asserts `year=2028` validates, `year=2029` raises.

---

### [BUG-2] — HIGH — `is_supabase_error` classifier is logically inverted; real Supabase outages return 500

- **File/lines:** `backend/core/errors/handlers.py:18-22`
- **Evidence:**
  ```python
  error_msg = str(exc).lower()
  is_supabase_error = any([
      'remoteprotocolerror' in error_msg,
      'server disconnected' in error_msg,
      'connection' in error_msg and 'supabase' not in error_msg.lower(),
  ])
  ```
- **Root cause:** The third predicate fires only for connection errors that **don't** mention Supabase. Anything emitted by `httpx`/`postgrest` that includes the host (e.g. `Connection refused to ...supabase.co`) is treated as **not** a Supabase error and falls through to the generic 500 branch. The two specific markers above (`remoteprotocolerror`, `server disconnected`) still work, so the bug is partial — but any other transport failure that mentions the URL ends up as `500 Internal Server Error` instead of `503 Service Unavailable`.
- **Impact:** Operators lose the signal needed to alert on third-party outages; clients can't distinguish between a real bug and a Supabase brownout. The retry helper in `core/supabase_client.execute_with_retry` covers most cases, but anything that gets through still misclassifies.
- **Cross-layer effects:** Every endpoint that uses `standard_exception_handler` (i.e. every endpoint).
- **Fix:** Replace with the same check used elsewhere in the codebase (`core/errors/classification.is_transient_error`), which is already the canonical list:
  ```python
  from core.errors.classification import is_transient_error
  ...
  is_supabase_error = is_transient_error(exc)
  ```
- **Validation:** Add a test in `core/api/tests/test_views.py` that raises `Exception('connection refused to db.xxx.supabase.co')` from inside a view and asserts response status is 503.

---

### [BUG-3] — HIGH — `frontend/src/app/data/mockData.ts` is double-encoded UTF-8 (mojibake)

- **File/lines:** `frontend/src/app/data/mockData.ts:60-80, 615-632` (and ~180 matches)
- **Evidence:** `file` reports `UTF-8 (with BOM)`. Source contains:
  ```ts
  name: "Äáº¡i há»c BÃ¡ch Khoa HÃ  Ná»™i",
  city: "HÃ  Ná»™i",
  region: "Miá»n Báº¯c",
  ...
  export const examBlocks = ["A00", "A01", "B00", "C00", "D01", "V00", "ÄGNL"];
  ```
  Intended strings are `Đại học Bách Khoa Hà Nội`, `Hà Nội`, `Miền Bắc`, `ĐGNL`. The file was saved as UTF-8 after being interpreted as latin-1 — every multi-byte UTF-8 code-point is now stored as its UTF-8 of the latin-1 view.
- **Root cause:** Editor encoding misconfiguration when saving. The BOM is present but the bytes underneath are double-encoded.
- **Impact:** Every page that consumes `mockData.universities`, `mockData.majorGroups`, and `mockData.examBlocks` renders garbled text. `XepHangPage.tsx` and `SoSanhPage.tsx` are direct consumers. Even after the live API replaces these on production, **`getTierColor` / `getTierThreshold` / `getTierBg` are imported from the same file**, so the file cannot just be deleted.
- **Cross-layer effects:** Frontend display only; backend is unaffected.
- **Fix:** Re-save the file as UTF-8 (no BOM) with the corrected literals. Or, since most live data now comes from the API, strip out the mock seed arrays and keep only `getTierColor`, `getTierBg`, `getTierThreshold`, `majorGroups`, `examBlocks` (the four exports actually imported elsewhere — verified by grep). Minimal patch: re-write those four exports with the proper Vietnamese strings.
- **Validation:** `grep -c '[ÄÆá»ºá¿]' frontend/src/app/data/mockData.ts` should drop to 0; `npm run build` succeeds; visit `/bxh` and `/xep-hang` and confirm city/region labels render correctly.

---

### [BUG-4] — HIGH — Tier thresholds disagree between backend (`/api/rankings/`) and frontend (`/ho-so`)

- **File/lines:**
  - Backend: `backend/core/api/views.py:21-28` —
    ```python
    TIER_THRESHOLDS = ((90,'S'),(80,'A'),(70,'B'),(60,'C'),(45,'D'),(30,'E'))
    ```
  - Frontend: `frontend/src/app/data/mockData.ts:610-617` —
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
- **Root cause:** Two independent ladders, never reconciled. The backend ladder also has an unreachable `S` tier: `base_score` is sum of 8 subjects ≤ 80 plus `special_score` ≤ 10 → max possible 90 → S only at exact 90.
- **Impact:** A logged-in user with `total_score = 95` sees themselves as **A** on `/bxh` (backend `RankingsListView` tier), and **B** on `/ho-so` (frontend `getTierThreshold` returns "B" for 90 ≤ x < 100). Same score, two different tiers in the same session.
- **Cross-layer effects:** Both `BXHPage.tsx` and `XepHangPage.tsx`/`HoSoPage.tsx`. Also affects `getTierColor`/`getTierBg` rendering (different colors per page).
- **Fix:** Choose one ladder (recommend frontend's broader range since the bonus calculator on `HoSoPage` produces totals up to ~250 with awards). Move the ladder into a single source on the backend, expose it via the rankings response, and have the frontend consume that. Concretely: add `tier` to backend `total_score` calculation using thresholds aligned with `HoSoPage`'s `totalScore` (which includes `awardBonus + certBonus`), and delete frontend's local ladder.
- **Validation:** Manual: log in as a user with `base_score=88, special_score=2, IELTS=7, no awards`. Confirm both pages show the same tier letter and color.

---

### [BUG-5] — HIGH — Register grade dropdown offers grades 1–12 but backend rejects anything outside 10–12

- **File/lines:** `frontend/src/app/pages/AuthPage.tsx:243-247`
- **Evidence:**
  ```tsx
  <select value={form.grade} onChange={...}>
    {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
      <option key={grade} value={grade}>{grade}</option>
    ))}
  </select>
  ```
  Backend (`backend/core/auth/serializers.py:18`): `grade = serializers.IntegerField(min_value=10, max_value=12)`.
- **Root cause:** Hardcoded `length: 12` starting at 1 instead of 3 starting at 10.
- **Impact:** New users who pick grade 1–9 (the default selection is `"11"` — string — but the UI presents 1 as a valid option) get a generic "Da xay ra loi he thong" or a serializer-level 400 on submit. The form does not clearly indicate which grades are allowed.
- **Cross-layer effects:** Only the AuthPage register form.
- **Fix:**
  ```tsx
  {[10, 11, 12].map((grade) => (
    <option key={grade} value={grade}>{grade}</option>
  ))}
  ```
- **Validation:** Manual: register with grade=9 — option no longer present.

---

## 3. Bugs and Reliability Risks

### [RISK-1] — MEDIUM — Refresh token is stored but never used; revoke endpoint only invalidates access token

- **File/lines:** `frontend/src/app/pages/AuthPage.tsx:177`, `backend/core/supabase_client.py:30-41`
- **Evidence:** Login stores `gr1_refresh_token` in localStorage. `Layout.logout()` only removes it client-side. `revoke_session` in `core/supabase_client.py` POSTs to `/auth/v1/logout` with the **access** token (no `scope` parameter, no refresh-token revocation). Supabase's logout supports `?scope=global` and a refresh-token revocation; neither is requested.
- **Impact:** A stolen refresh token (e.g. via XSS, since tokens live in localStorage) remains valid after the user "logs out" and can mint fresh access tokens.
- **Fix:** Either move tokens to `HttpOnly` cookies (preferred), or revoke explicitly: pass `?scope=global` to `/auth/v1/logout` and document the limitation.

### [RISK-2] — MEDIUM — `_delete_auth_user_if_possible` silently swallows the missing service-role key

- **File/lines:** `backend/core/auth/views.py:121-127`, `backend/core/supabase_client.py:24-28`
- **Evidence:**
  ```python
  def _delete_auth_user_if_possible(user_id):
      try:
          get_service_client().auth.admin.delete_user(user_id)
      except Exception as exc:
          logger.warning('Could not clean up Supabase auth user %s: %s', user_id, exc)
  ```
  `get_service_client` raises `RuntimeError('SUPABASE_SERVICE_ROLE_KEY is not configured')` when the key is empty (the default in `settings/base.py`).
- **Impact:** Profile-insert failures after sign_up — including unique-violation races, RLS denial, or transient errors — leave orphan rows in `auth.users`. The 2026-06-20 review's BUG-1 fix is only partial: the pre-check narrows the window, but the cleanup path is a no-op in dev/test where the service key is absent.
- **Fix:** Surface a clear warning on Django startup if `SUPABASE_SERVICE_ROLE_KEY` is empty and the register path is reachable. Alternatively, gate sign_up behind a server-side claim check that uses the service role to also delete on failure — making the key a hard requirement.

### [RISK-3] — MEDIUM — `RankingsListView` reads the entire `users` and `score` tables on every cache miss

- **File/lines:** `backend/core/api/views.py:64-119`
- **Evidence:**
  ```python
  users = get_client().table('users').select('id, user_name, full_name, special_score').execute().data or []
  scores = get_client().table('score').select('user_id, base_score, math, ...').execute().data or []
  ```
  No range/pagination — Supabase clients default cap at 1000 rows. So if the user base exceeds 1000, results are silently truncated; if under 1000, the entire payload is built and sorted on every cache miss every 120 s.
- **Impact:** (a) Silent truncation at 1000 users — ranks beyond will simply be absent. (b) Every 120s a full scan + sort runs; doesn't scale.
- **Fix:** Use `range(0, n)` with a hard cap (e.g. top 500) and an explicit `order` on `base_score+special_score` server-side. Even better, materialize the ranking with a SQL view + RPC.

### [RISK-4] — MEDIUM — Cache leaks personal data across users for authenticated endpoints

- **File/lines:** `backend/core/api/cache.py`
- **Evidence:** `build_cache_key` hashes `namespace + path + query`. Authorization headers and `request.user.id` are **not** part of the key.
- **Impact:** Today's per-user endpoints (`/api/auth/me/...`) bypass the cache (they don't use `get_or_set_api_payload`), so this is not actively wrong. But the helper is a public utility — any future per-user endpoint that uses it will serve another user's payload. Should be made user-aware by default.
- **Fix:** Mix `getattr(request.user, 'id', 'anon')` into the cache key.

### [RISK-5] — LOW — `HoSoPage.handleSave` deletes all achievements then re-inserts, with no rollback

- **File/lines:** `frontend/src/app/pages/HoSoPage.tsx:296-315`
- **Evidence:**
  ```ts
  for (const achievement of savedAchievements) {
    await deleteMyAchievement(token, achievement.id);
  }
  for (const item of selectedAchievements) {
    await addMyAchievement(token, { award_id: item.award_id, prize: item.prize });
  }
  ```
- **Impact:** If the user's session drops or the network blips between the two loops, all achievements are deleted and not restored. The user would need to re-enter every entry from the still-mounted UI state.
- **Fix:** Compute set-diff and only delete/insert deltas. Or expose a server-side `replace` endpoint that takes the full set atomically.

### [RISK-6] — LOW — `HoSoPage.handleSave` force-overwrites `full_name` with a placeholder when input is empty

- **File/lines:** `frontend/src/app/pages/HoSoPage.tsx:286`
- **Evidence:** `full_name: userName.trim() || "Hoc sinh cua toi"` — if the user clears the name input, the placeholder string is **persisted** to the DB.
- **Impact:** A user who accidentally cleared the name input loses their real full_name silently.
- **Fix:** Omit `full_name` from the payload when empty, or block save with a validation error.

---

## 4. Duplicate and Inconsistent Code

### Two implementations of `_sanitize_postgrest_search`

`backend/src/universities/views.py:9-12` and `backend/src/academics/views.py:81-84` define the identical helper. Move to `core/supabase_client.py` and import.

### Two implementations of Vietnamese diacritic stripping

Backend `core/supabase_client.py`/`src/academics/views.py:_normalize_vietnamese_text` and frontend `services/api.ts:normalizeVietnamese` + `pages/HoSoPage.tsx:normalizeText`. Behaviours match today but drift later is easy. Pick one canonical implementation per language and re-export.

### Tier ladder defined in two places — see BUG-4.

### `getTierThreshold`/`getTierColor`/`getTierBg` live in `mockData.ts`

A pure-utility file that imports from `mockData` carries an editor-defaults UTF-8 trap (BUG-3). Move the three tier helpers to `src/app/utils/tier.ts` and let the mock seeds rot independently.

---

## 5. Dead, Stale, or Unused Code

| Item | Confidence | Verification |
|---|---|---|
| `backend/docker-compose.yml` `db` service (postgres:16-alpine) | **High** | `config/settings/base.py:53` declares `DATABASES = {}`; `requirements/base.txt` has no `psycopg`. Backend never connects. Postgres container is wasted resources in dev. |
| `frontend/src/app/data/mockData.ts` `universities`, `majors`, `reviews`, `mockRankings` arrays | **Medium** | `grep -rn "from.*mockData" frontend/src/app` shows imports only of `getTierColor`, `getTierThreshold`, `getTierBg`, `majorGroups`, `examBlocks`. The seed arrays appear dead. |
| `backend/database/data/` (selenium-based `crawl.py`, plus `xlsx_to_json.py`) | **Medium** | `database/datav2/crawl_tuyensinh247_api.py` is the current importer per file timestamps and the `bunik_crawl_output/` payload structure. `v4`/`v5`/`v6` SQL migrations target the v2 importer's schema. The v1 crawler can probably move to `archive/`. |
| `backend/core/auth/permissions.py:IsSupabaseAuthenticated` and `IsStaffWriteOrReadOnly` | **High** | `grep -rn "IsSupabaseAuthenticated\|IsStaffWriteOrReadOnly" backend/` — zero usages outside the file itself. Delete or wire up. |
| `frontend/src/app/components/figma/ImageWithFallback.tsx` | **Medium** | `grep -rn "ImageWithFallback" frontend/src/app` — no consumers. |

---

## 6. Dependency, Config, and Tooling Concerns

### `docker-compose.yml` drift
`docker-compose.yml` declares a `db` postgres service and `env_file: .env`, but the Django settings declare `DATABASES = {}` and require `SUPABASE_URL`. The compose stack will start a postgres no one uses. Either remove the `db` service or repoint Django at it (this is a one-or-the-other decision; today is neither).

### `requirements/dev.txt` and `pytest.ini`
`pytest.ini` says `DJANGO_SETTINGS_MODULE = config.settings.local` but `conftest.py` does not set required Supabase env vars. Running `pytest` without `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the environment fails at `from decouple import config; config('SUPABASE_URL')`. Fix by adding sensible defaults in `local.py`:
```python
SUPABASE_URL = config('SUPABASE_URL', default='http://localhost:0')
SUPABASE_ANON_KEY = config('SUPABASE_ANON_KEY', default='dummy')
```

### `frontend/package.json` "lint" is a typecheck alias
`"lint": "npm run typecheck"` — there is no ESLint config. For a 5,000-LOC frontend, adding `eslint-config-react`/`@typescript-eslint` is warranted. Today, unused vars, missing dep arrays in `useEffect`, etc. go undetected.

### `frontend/package.json` "test" is a no-op
`"test": "echo \"No frontend tests yet\""`. Combined with zero `.test.tsx` files in the tree, this is a regression hazard given the heavy state in `HoSoPage` and `BXHPage`.

### Vite override pins via pnpm-only field
`package.json` declares `pnpm.overrides`, but the lockfile is `package-lock.json` (npm). The override is silently ignored in npm installs. If the intent was a security pin on `vite`, encode it in `overrides` (npm's syntax) too.

---

## 7. Test Gaps

Required high-value tests, in the format `[method] [endpoint] when [condition] → assert [outcome]`:

- `POST /api/scores/bulk-upsert/` when `year == today.year + 2` and we monkeypatched `date.today` to a future date → assert 400, not silent acceptance (covers BUG-1).
- `GET /api/something/` when the inner Supabase call raises `Exception('connection refused to db.xxx.supabase.co')` → assert 503 (covers BUG-2 regression).
- `POST /api/auth/register/` when the `users` insert raises (mocked) and `SUPABASE_SERVICE_ROLE_KEY` is empty → assert response is 5xx **and** the auth user was attempted to be cleaned via a logged warning. Currently the cleanup is a silent no-op (RISK-2).
- `GET /api/rankings/` when the `users` table contains 1500 rows → assert results are not silently truncated at 1000 (RISK-3).
- `POST /api/auth/me/` (PATCH) when `full_name` is sent as the empty string → assert 400, not silent overwrite with "Hoc sinh cua toi" (RISK-6, requires the fix first).
- `GET /api/programs/` with `major_name='abc%def'` → assert escape works (current `_escape_like_literal` escapes `%`, `_`, `\` — add the regression test).
- `GET /api/scores/` with `program_ids` containing exactly 101 UUIDs → assert 400 (boundary on `MAX_PROGRAM_IDS`).

---

## 8. Quick Wins (< 1 hour each)

1. **BUG-5 fix:** Replace `Array.from({ length: 12 }, (_, i) => i + 1)` with `[10, 11, 12]` in `AuthPage.tsx:243`.
2. **BUG-1 fix:** Move `max_value=date.today().year + 1` into a `validate_year` method in `BulkAdmissionScoreItemSerializer`.
3. **BUG-2 fix:** Replace the `is_supabase_error` `any([...])` block in `core/errors/handlers.py:18` with `is_transient_error(exc)`.
4. **Dead code:** Delete `IsSupabaseAuthenticated`, `IsStaffWriteOrReadOnly` from `core/auth/permissions.py` (no consumers) or wire them up to the views that should be using them.
5. **Config defaults:** Add `default='http://localhost:0'` to `SUPABASE_URL` in `settings/base.py` so local tests run without env files.
6. **Cache safety:** Add `getattr(request.user, 'id', 'anon')` into `build_cache_key` even if no per-user view uses it yet (defensive, covers RISK-4).

---

## 9. Larger Improvements (sequenced by blast radius)

1. **Move tier ladder + bonus calc to backend** (resolves BUG-4 permanently). Risk if done wrong: rankings page renders empty or with wrong colors. Mitigation: ship as an additive field (`tier`), keep frontend fallback for one release, then delete frontend ladder.

2. **Re-encode `mockData.ts` to clean UTF-8, then split.** Risk if done wrong: build breaks because three other files import `getTierColor`/`getTierThreshold`/`getTierBg` from that path. Mitigation: do the re-save first, then in a separate PR extract the three tier helpers into `src/app/utils/tier.ts` and update imports.

3. **Move tokens out of localStorage into HttpOnly cookies** (resolves RISK-1). Risk: changes the auth wire format; cross-origin cookie behavior is fragile. Mitigation: ship behind a feature flag, keep localStorage path as fallback for one release.

4. **Replace `RankingsListView`'s in-memory join with a SQL view / RPC.** Risk: RLS misconfiguration could expose users that should be hidden. Mitigation: define the view in `migration_v7.sql`, add Supabase RLS policy explicitly, expose via `rpc()` rather than a public table.

5. **Reconcile `docker-compose.yml` with the Supabase-only architecture.** Either delete the postgres service or repoint Django at it. Risk: dev environments may be relying on the unused postgres for ad-hoc psql. Mitigation: announce in CHANGELOG and ship in a single PR.

---

## 10. Prioritized Action Checklist

1. Patch `AuthPage.tsx:243` grade options to `[10, 11, 12]` (BUG-5).
2. Move `year` upper-bound into `validate_year` in `BulkAdmissionScoreItemSerializer` (BUG-1).
3. Replace `is_supabase_error` predicate in `core/errors/handlers.py` with `is_transient_error(exc)` (BUG-2).
4. Re-save `frontend/src/app/data/mockData.ts` as clean UTF-8 with the corrected Vietnamese strings (BUG-3).
5. Add backend tier in rankings response and update frontend to consume it; remove frontend `getTierThreshold` ladder (BUG-4).
6. Update `logout` flow to revoke refresh token (RISK-1).
7. Make `SUPABASE_SERVICE_ROLE_KEY` a hard requirement when register is enabled; log a clear startup warning (RISK-2).
8. Cap and pre-order `RankingsListView` server-side; remove client-side `_paginate_rows` over the entire user list (RISK-3).
9. Mix user id into `build_cache_key` (RISK-4).
10. Replace the delete-then-insert achievement save with a set-diff (RISK-5).
11. Delete (or wire up) unused `permissions.py` classes and unused mock arrays in `mockData.ts`.
12. Add ESLint config; replace the no-op `npm test` with a Vitest harness and one smoke test per page.

---

*Cross-reference: BUG-1..5 from 2026-06-20 were addressed in the current codebase (RegisterView pre-checks for conflict, LogoutView uses `revoke_session`, region drift fix in `provinces` mapping, BXHPage now resolves the logged-in user's row, auth transient errors return 503 via `is_transient_error`). The findings above are net-new or partial-regressions.*
