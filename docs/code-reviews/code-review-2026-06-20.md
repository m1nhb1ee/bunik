# Code Review — 2026-06-20

Scope: `backend/` (Django + DRF + Supabase REST), `frontend/` (Vite + React + react-router 7), `database/` (Supabase migrations + seed data).
Reviewer: Senior engineer pass focused on correctness, security, and cross-layer drift.

---

## 1. Executive Summary

**Health verdict:** The app runs and the test suite passes, but the auth flow has two correctness defects that produce orphaned accounts and a fake "your rank" widget, and four cross-layer contract mismatches between DB ↔ DRF ↔ TypeScript silently break filters and types. None of these would be caught by the current test suite — coverage is essentially absent outside three smoke tests.

**Highest-risk areas:**
1. RegisterView creates Supabase auth users without rollback on profile-insert failure → orphaned auth records (BUG-1).
2. `provinces.region` is stored as `'Bắc' | 'Trung' | 'Nam'`, frontend filters by `'Miền Bắc' | 'Miền Trung' | 'Miền Nam'` → region filter never matches (BUG-2).
3. `LogoutView` calls `sign_out()` on a brand-new anon client → token is never revoked server-side (BUG-3).
4. `BXHPage` shows whoever is in `rankings[7]` as "your rank" with no relation to the logged-in user (BUG-4).
5. `SupabaseAuthentication.authenticate_credentials` wraps the entire flow in `except Exception` → Supabase outages surface as 401s instead of 503s (BUG-5).

**Validation commands run:**
- `python -m pytest --tb=short -q` (testpaths=src) → **6 passed in 0.95s**
- `python -m pytest core/ --tb=short -q` → **14 passed in 0.71s**
- `python -m py_compile` on all backend modules → **OK**
- `npx tsc --noEmit` → **SKIPPED** — no `tsconfig.json` exists in `frontend/` despite extensive `.ts`/`.tsx` source; type errors below are read from source.
- `npm run lint` → effectively skipped: `package.json` script is literally `"echo \"No lint config yet\""`.
- `npm run build` → not executed (would touch network; build artifacts already present in `dist/`).

**Counts:** 5 confirmed bugs (BUG-1..5), 6 confirmed cross-layer contract mismatches (RISK-1..6), plus quality issues.

---

## 2. Critical and High-Risk Findings

### [BUG-1] — HIGH — Register creates orphaned Supabase auth users when profile insert fails

- **File/lines:** `backend/core/auth/views.py` 109–157
- **Evidence:**
  ```python
  auth_resp = auth_client.auth.sign_up({'email': data['gmail'], 'password': data['password']})
  user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
  ...
  get_user_client(access_token).table('users').insert(profile_payload).execute()
  ...
  except Exception as exc:
      logger.exception('Register failed.')
      if _is_duplicate_error(exc):
          return Response({'message': 'gmail hoac user_name da ton tai'}, status=status.HTTP_409_CONFLICT)
  ```
- **Root cause:** The Supabase `auth.sign_up` call commits the auth row before the `users` profile insert runs. If the profile insert fails (most commonly because `user_name` is unique-violated, but also on RLS or transient errors), there is no compensating delete on the auth user.
- **Impact:** Every collided `user_name` retry produces a permanent dangling row in `auth.users` with the same email. The user then cannot retry with the same email (sign_up returns "already registered") and the original auth row has no profile row, so `LoginView` returns "Da xay ra loi he thong" at line 180 forever. This has likely already polluted the dev project's auth table.
- **Cross-layer effects:** Hits `users` table integrity (no FK back-reference is broken because the FK direction is `users.id → auth.users.id`, but the orphan still exists). Login path in `views.py` 178–180 hard-fails for these orphans.
- **Fix:** Validate `user_name` uniqueness against `public.users` *before* calling `auth.sign_up`, OR call `client.auth.admin.delete_user(user_id)` in the `except` branch (requires service-role key, not anon). Concretely, insert this check before line 116:
  ```python
  existing = get_client().table('users').select('id').or_(
      f"user_name.eq.{data['user_name']},gmail.eq.{data['gmail']}"
  ).limit(1).execute()
  if existing.data:
      return Response({'message': 'gmail hoac user_name da ton tai'},
                      status=status.HTTP_409_CONFLICT)
  ```
  This narrows the window dramatically; for full safety also add admin-key cleanup in the except.
- **Validation:** Add a test that monkeypatches the `users` insert to raise, then asserts the test client called `auth.admin.delete_user` with the just-created id.

### [BUG-2] — HIGH — Region filter on TruongPage never matches because DB ≠ UI vocabulary

- **File/lines:**
  - DB constraint: `database/migrations/migration_v4.sql` (table provinces): `region VARCHAR(20) NOT NULL CHECK (region IN ('Bắc', 'Trung', 'Nam'))`
  - Seed sample: `database/datav2/bunik_crawl_output/clean_import/provinces.csv` → `1,HN,Hà Nội,Bắc`
  - Frontend filter values: `frontend/src/app/pages/TruongPage.tsx:40`
    ```ts
    const regions = ["Miền Bắc", "Miền Trung", "Miền Nam"];
    ```
    used in the filter at lines 79–81:
    ```ts
    if (selectedRegions.length > 0) {
      list = list.filter((u) => selectedRegions.includes(u.region));
    }
    ```
  - Mapping: `frontend/src/app/services/api.ts:314` `region: api.provinces?.region ?? 'Mien Bac'`
- **Root cause:** Three different region representations coexist: DB stores `'Bắc'`, the api adapter's *default* string is `'Mien Bac'` (no diacritics, with prefix), and the UI filter compares against `'Miền Bắc'` (with diacritics, with prefix). None of the three match exactly.
- **Impact:** Selecting any region in `/truong` empties the list. This affects every user who tries to filter by region — the visible UI control is silently broken. The default `'Mien Bac'` also misclassifies every university whose province row is missing.
- **Cross-layer effects:** Same `region` field flows into `SoSanhPage`/`UiUniversity`; any consumer is wrong too. The default string in `toUiUniversity` is inconsistent with both the DB and the UI.
- **Fix:** Pick one canonical representation. Recommendation: keep DB short codes (`'Bắc' | 'Trung' | 'Nam'`) and put the display mapping in the frontend.
  - In `TruongPage.tsx`:
    ```ts
    const regions = [
      { value: "Bắc", label: "Miền Bắc" },
      { value: "Trung", label: "Miền Trung" },
      { value: "Nam", label: "Miền Nam" },
    ];
    ```
    Update `toggleRegion`/`selectedRegions` to store the value and render the label.
  - In `services/api.ts:314`, drop the bogus fallback string — use `region: api.provinces?.region ?? ''` and let the filter ignore unknown rows.
- **Validation:** Manual: load `/truong`, tick "Miền Bắc", see northern universities appear. Add a unit test on the filter helper once it's extracted.

### [BUG-3] — HIGH — Logout never revokes the user's Supabase session

- **File/lines:** `backend/core/auth/views.py` 469–484, `backend/core/supabase_client.py` 29–32
- **Evidence:**
  ```python
  # supabase_client.py
  def get_user_client(access_token: str) -> Client:
      client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
      client.postgrest.auth(access_token)
      return client

  # views.py LogoutView
  get_user_client(access_token).auth.sign_out()
  ```
- **Root cause:** `get_user_client` only attaches the token to the PostgREST sub-client; the GoTrue (auth) sub-client is brand new with no session. `client.auth.sign_out()` on a fresh client with no internal session is a no-op against the server — it just clears in-memory state that was never set.
- **Impact:** After "Dang xuat", the stolen/cached access token remains valid until its natural expiry. Combined with `AuthPage` storing the token in `localStorage` (XSS-reachable), this is a real security regression versus what the endpoint claims to do.
- **Cross-layer effects:** Frontend `HoSoPage` clears tokens from `localStorage` on 401, but a logged-out token is still server-valid, so any leaked copy keeps working.
- **Fix:** Call the GoTrue revoke endpoint directly using the user's token:
  ```python
  import httpx
  def revoke_session(access_token: str) -> None:
      httpx.post(
          f"{settings.SUPABASE_URL}/auth/v1/logout",
          headers={
              'Authorization': f'Bearer {access_token}',
              'apikey': settings.SUPABASE_ANON_KEY,
          },
          timeout=5,
      )
  ```
  Call this from `LogoutView.post` instead of the broken `sign_out()`.
- **Validation:** Integration test: log in, call `/api/auth/logout/`, then call `/api/auth/me/` with the same token — must 401.

### [BUG-4] — HIGH — "Your rank" widget on `/bxh` shows a random other user

- **File/lines:** `frontend/src/app/pages/BXHPage.tsx` 100–101, 320–335, 357
- **Evidence:**
  ```ts
  // line 100–101
  // My rank for demo (using first user in API response or default)
  const myRank = rankings[7] || rankings[0];
  ...
  // 332–334
  <span style={{ color: "#fff", fontWeight: 800 }}>#{myRank.rank}</span>
  <TierBadge tier={myRank.tier} />
  <span ...>{myRank.score}đ</span>
  ...
  // 357
  const isMe = user.id === myRank.id;
  ```
- **Root cause:** The "Vi tri cua ban" highlight literally hard-codes index 7 of the rankings array. There is no lookup against the logged-in user. The "← Bạn" label on the table is decided by comparing other users' ids against that arbitrary id.
- **Impact:** Every visitor sees the same fake "your rank" pointing at the 8th-ranked student, including their score and tier. For a leaderboard with real users, this is a privacy and trust problem: rank #8 is publicly labeled "← Bạn" to everyone, and the visitor's actual rank is never shown.
- **Cross-layer effects:** Tied to BUG/RISK-3 (`ApiUserRanking.id` typed as `number` but is a UUID string), which is why the comparison would also break if it were attempted correctly.
- **Fix:** Pull the logged-in user from `localStorage.getItem("gr1_user")`, then find by id:
  ```ts
  const me = JSON.parse(localStorage.getItem("gr1_user") ?? "null") as { id: string } | null;
  const myRank = me ? rankings.find(r => String(r.id) === String(me.id)) : undefined;
  ...
  {myRank ? (<>... vi tri cua ban ...</>) : null}
  ```
  Remove the `rankings[7]` fallback entirely.
- **Validation:** Manual: log in as a known account, navigate to `/bxh`, confirm the highlight shows your actual rank and that no row is marked "← Bạn" when not logged in.

### [BUG-5] — HIGH — Supabase transient errors during auth are reported as 401, not 503

- **File/lines:** `backend/core/auth/supabase_auth.py` 37–51
- **Evidence:**
  ```python
  def authenticate_credentials(self, token):
      try:
          client = get_client()
          user_response = client.auth.get_user(token)
          if not user_response or not user_response.user:
              raise AuthenticationFailed('Invalid authentication token.')
          ...
          return (user, token)
      except Exception:
          raise AuthenticationFailed('Invalid authentication token.')
  ```
- **Root cause:** The blanket `except Exception` collapses every failure mode — RemoteProtocolError, ConnectionReset, DNS, schema errors — into a single 401. The retry helper in `core/supabase_client.py:execute_with_retry` is never used here, and the global `standard_exception_handler` would have classified these into 503 if the exception had bubbled.
- **Impact:** During Supabase blips, authenticated users get logged out (frontend treats 401 as session expiry — `HoSoPage.tsx:196–200` wipes `localStorage` on any "401" substring in the error message). Single transient blip → silent mass logout.
- **Cross-layer effects:** Pairs with `HoSoPage.tsx:196` which explicitly listens for "401" in error text and clears tokens. So a 503-worthy outage causes session loss across all open tabs.
- **Fix:** Differentiate auth failures from infrastructure failures:
  ```python
  from rest_framework.exceptions import APIException

  class SupabaseUnavailable(APIException):
      status_code = 503
      default_code = 'service_unavailable'
      default_detail = 'Authentication service temporarily unavailable.'

  def authenticate_credentials(self, token):
      try:
          user_response = get_client().auth.get_user(token)
      except Exception as exc:
          msg = str(exc).lower()
          if any(m in msg for m in TRANSIENT_ERROR_MARKERS):  # reuse from supabase_client
              raise SupabaseUnavailable() from exc
          raise AuthenticationFailed('Invalid authentication token.') from exc
      if not user_response or not user_response.user:
          raise AuthenticationFailed('Invalid authentication token.')
      ...
  ```
- **Validation:** Test with a monkeypatched `get_client` whose `auth.get_user` raises `httpx.RemoteProtocolError`; assert response is 503, not 401.

---

## 3. Bugs and Reliability Risks

### [RISK-1] — MED — `ApiUserRanking.id` is typed `number` but the API returns a UUID string

- **Files:** `frontend/src/app/types/api.ts:102` vs `backend/core/api/views.py:99` (`'id': row.get('id')` from `users.id uuid`).
- **Why it's a bug now:** `BXHPage.tsx:357` does `user.id === myRank.id`. Both are strings at runtime; TypeScript thinks they're numbers. Today the equality still works because both sides are equally wrong; the moment any other consumer (e.g. `key={String(user.id)}` vs numeric arithmetic) is added, behaviour will diverge from the types.
- **Fix:** `id: string` in `ApiUserRanking`.

### [RISK-2] — MED — `ApiAchievement` type is missing fields the backend always returns

- **File/lines:** `frontend/src/app/types/api.ts:140–147` vs `backend/core/auth/views.py:67–78`.
- **Evidence:** Backend returns `name`, `prize`, `date`, `is_verified`, `awards` for each enriched row; the TS type only declares `id`, `user_id`, `award_id`, `prize`, `created_at`, `awards`. `created_at` is not in the backend response.
- **Impact:** `HoSoPage` uses `item.prize` and `item.award_id` only, so nothing breaks today, but a future call to `achievement.date` or `achievement.name` won't type-check despite being valid at runtime. Conversely `achievement.created_at` will type-check but always be `undefined`.
- **Fix:** Align the type:
  ```ts
  export type ApiAchievement = {
    id: number;
    user_id: string;
    award_id: number;
    name?: string | null;
    prize?: 'Khuyen Khich' | 'Ba' | 'Nhi' | 'Nhat' | 'Khuyến Khích' | 'Nhì' | 'Nhất' | null;
    date?: string;
    is_verified?: boolean;
    awards?: ApiAward;
  };
  ```
  (Note `prize` is also returned canonicalized to Vietnamese diacritics by `PRIZE_CANONICAL`.)

### [RISK-3] — MED — `ApiAward.prize` doesn't exist on the wire

- **File/lines:** `frontend/src/app/types/api.ts:133–138` vs `backend/core/auth/views.py:60–64` (only `id, name, level` returned).
- **Impact:** Misleads consumers and the level/prize confusion seeps into `HoSoPage.getAwardBonus` (which already correctly uses `level`).
- **Fix:** Remove `prize?: string | null` from `ApiAward`.

### [RISK-4] — MED — `ProfileUpdateSerializer.grade` accepts 1–12, registration requires 10–12

- **File/lines:** `backend/core/auth/serializers.py:19, 71`.
- **Evidence:**
  ```python
  # RegisterSerializer
  grade = serializers.IntegerField(min_value=10, max_value=12)
  ...
  # ProfileUpdateSerializer
  grade = serializers.IntegerField(required=False, min_value=1, max_value=12)
  ```
- **Impact:** A user can register as grade 10 and PATCH grade=1, then they fall outside the registration contract. Tier/ranking logic doesn't care today, but recommendations might.
- **Fix:** Use `min_value=10` in `ProfileUpdateSerializer`. Pick one canonical range.

### [RISK-5] — MED — `bulk_upsert` runs as the anonymous Supabase client even though caller is authenticated

- **File/lines:** `backend/src/admissions/views.py:229–246`.
- **Evidence:** The view checks `request.user.is_staff` but then writes with `get_client()` (anon key). The user's JWT is never forwarded.
- **Impact:** RLS will allow or deny based on the anon role, not the calling admin. If the table requires the `admin` role for inserts, this endpoint cannot work in production. If it allows anon writes (per current dev policies), anyone who can guess the URL could craft a row (the staff check is the only gate — fine in code, but the underlying DB has no defense in depth).
- **Fix:** `get_user_client(request.auth)` instead of `get_client()`; document that the table's RLS must enforce `is_admin`. Add an `authentication_classes = [SupabaseAuthentication]` declaration to the ViewSet (`DEFAULT_AUTHENTICATION_CLASSES` covers it now, but being explicit avoids regressions when defaults change).

### [RISK-6] — MED — Admin detection reads `auth.users.user_metadata.is_admin`; profile row's `users.is_admin` is ignored

- **File/lines:** `backend/core/auth/supabase_auth.py:17` (`self.is_staff = self.metadata.get('is_admin', False) or self.metadata.get('role') == 'admin'`) vs `database/database.md` `users.is_admin bool nullable`.
- **Impact:** The schema implies the source of truth is the profile row, but the code reads only Supabase user metadata. Toggling `users.is_admin` in SQL has zero effect on authorization. New admins must be set via `auth.admin.update_user_by_id(..., user_metadata={'is_admin': True})` — undocumented, easy to miss.
- **Fix:** Either drop `users.is_admin` (cheaper) or — better — fetch the profile row once in `authenticate_credentials` and merge:
  ```python
  profile = get_client().table('users').select('is_admin').eq('id', user_data.id).maybe_single().execute()
  self.is_staff = bool((profile.data or {}).get('is_admin')) or self.metadata.get('is_admin') or self.metadata.get('role') == 'admin'
  ```
  Document the chosen path in the README.

### [RISK-7] — LOW — Frontend asks for `page_size: 500`, backend caps at 200

- **File/lines:** `frontend/src/app/pages/TimNganhPage.tsx:51` vs `backend/src/academics/views.py:282` (`maximum=200`).
- **Impact:** `examBlocks` is silently derived from the first 200 majors; some exam-block codes that only appear on later pages won't be in the dropdown.
- **Fix:** Either raise the backend max to 500 with a guard, or call `getMajorOverview()` (already returns all rows) once and derive blocks from there.

### [RISK-8] — LOW — `MajorCatalogViewSet.list` filters on embedded relation columns; count and OR semantics are PostgREST-specific

- **File/lines:** `backend/src/academics/views.py:300–311`.
- **Evidence:** `query.or_(f'major_code.ilike.%{search}%,program_name.ilike.%{search}%,major_catalog.name.ilike.%{search}%')` and `query.eq('major_catalog.field_code', field)`.
- **Why risky:** Filtering on an embedded relation in PostgREST does not exclude parent rows where the embed is NULL by default; it only nulls out the embed. So `count='exact'` may overcount and the search may include programs whose `major_catalog` doesn't match the name.
- **Fix:** Resolve `field_code` to a list of `major_code` first (one extra query), then `.in_('major_code', codes)`. Same pattern as `_major_codes_by_name`.

### [RISK-9] — LOW — `_score_to_tier` runs unconditionally on a 0 score

- **File/lines:** `backend/core/api/views.py:32–49, 84–112`.
- **Impact:** Users who have not entered any subject scores are still ranked at `tier='F', score=0`. Combined with BUG-4, this means the leaderboard publicly displays "empty" profiles for every registered student. Consider filtering out users with `base_score IS NULL AND special_score IS NULL` before ranking.

### [RISK-10] — LOW — `localStorage` is the only auth store; XSS = full takeover

- **File/lines:** `frontend/src/app/pages/AuthPage.tsx:176–178`.
- **Impact:** The token can be lifted by any injected script. There is no httpOnly cookie path. Acceptable for a school project; document the threat model.

---

## 4. Duplicate and Inconsistent Code

- **Pagination payloads built three different ways.**
  - `paginate(...)` in `core/supabase_client.py:115` returns `{count, page, page_size, results}` from Supabase.
  - `_paginate_rows(...)` in `core/api/views.py:32` and `_static_paginated_payload(...)` in `src/academics/views.py:39` re-implement the same shape against in-memory lists.
  - `AdmissionMethodViewSet.list` (`src/admissions/views.py:33–43`) inlines a fourth copy.
  - **Fix:** Move one helper into `core/api/cache.py` or a new `core/api/pagination.py` and have all four call it. Reduces the chance of `count` drifting from `len(results)` again.

- **Three different "is this exception transient/duplicate/rls/credentials/rate-limited?" sniffers.**
  - `_is_duplicate_error`, `_is_invalid_credentials_error`, `_is_rate_limited_error`, `_is_rls_error`, `_is_missing_column_error` in `core/auth/views.py:81–103`, plus `TRANSIENT_ERROR_MARKERS` in `core/supabase_client.py:11`, plus the bespoke `is_supabase_error` check in `core/errors/handlers.py:17–21`.
  - **Fix:** Consolidate into `core/errors/classification.py` with a single `classify_supabase_error(exc) -> Literal['duplicate','credentials','rate_limited','rls','missing_column','transient','unknown']`. All views and handlers consult one source.

- **Token extraction repeated.** `AwardCatalogView` (`core/auth/views.py:299–301`) parses `Authorization: Bearer …` manually instead of using `authentication_classes`. Drop the manual parse, set `authentication_classes = [SupabaseAuthentication]`, `permission_classes = [AllowAny]`, and read `request.auth`.

---

## 5. Dead, Stale, or Unused Code

- **`backend/docker-compose.yml`** declares a full `postgres:16-alpine` service with `${POSTGRES_DB}`, mount, healthcheck — but `config/settings/base.py:55` sets `DATABASES = {}` and the project talks only to Supabase REST. The DB service is never used.
  - **Confidence:** High. Verified via `grep -n "DATABASES" backend/config/settings/`.
  - **Fix:** Remove the `db` service and its `depends_on` from compose, or document explicitly that it's only there for a future migration.

- **`backend/db.sqlite3`** exists in the repo working tree but `DATABASES = {}` means Django never creates or uses it. It's also listed in `.gitignore` (`db.sqlite3`). It's untracked, just leftover.
  - **Confidence:** High. `git ls-files | grep sqlite` returns nothing.
  - **Fix:** `rm backend/db.sqlite3`.

- **`SupabaseTokenAuthentication`** in `core/auth/supabase_auth.py:57–58` is an empty subclass of `SupabaseAuthentication`. No file references it.
  - **Confidence:** High. `grep -r "SupabaseTokenAuthentication" backend/` returns one definition, zero usages.
  - **Fix:** Delete.

- **`/api/v1/` URL prefix** is registered (`config/urls.py:16`) but unused by the frontend (`services/api.ts:21` defaults to `/api`). No deprecation policy.
  - **Confidence:** High.
  - **Fix:** Either delete the v1 routes or migrate the frontend to them so the unversioned prefix can be retired.

- **`backend/.env.test`, `.env.test.bak`, `.env_used_for_check`** are untracked secrets next to the app. They are not in the diff but exist on disk.
  - **Confidence:** High. `git ls-files --others --exclude-standard` lists them.
  - **Fix:** Verify they don't contain production keys, then delete or move to a personal scratch dir.

- **`backend/conftest.py:13`** defines `authenticated_client` that just returns the unauthenticated `api_client`. Misleading name.
  - **Fix:** Remove or implement actual token injection.

- **27 dated `code-review-*.md` files in the repo root** (untracked). They aren't real source but they show up in editor file trees and grep. Consider moving to `docs/reviews/`.

---

## 6. Dependency, Config, and Tooling Concerns

- **No `tsconfig.json`** in `frontend/`. Vite compiles `.tsx`/`.ts` via esbuild without type-checking; `npm run lint` is a no-op echo; `npm run test` is a no-op echo. Effectively zero static checking on a 60+ file TypeScript codebase. **Add a minimal `tsconfig.json`:**
  ```jsonc
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "moduleResolution": "bundler",
      "jsx": "react-jsx",
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "skipLibCheck": true,
      "esModuleInterop": true,
      "allowSyntheticDefaultImports": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "baseUrl": ".",
      "paths": { "@/*": ["src/*"] }
    },
    "include": ["src"]
  }
  ```
  Then wire `"typecheck": "tsc --noEmit"` into `package.json`.

- **`package.json`** lists `react` and `react-dom` under `peerDependencies` and `peerDependenciesMeta` as optional. This is the shape of a library, not an application. They are still installed because npm hoists them through transitive needs, but if a future cleanup removes transitive entries the app silently breaks. **Move them to `dependencies`.**

- **`Dockerfile` uses Python 3.12**; the rest of the project (and Supabase client httpx versions) is tested on 3.10 locally (`python -V` is 3.10.12 in the dev shell). Pin a single supported version in `README.md` and CI.

- **`SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me')`** in `base.py:6` has no enforcement in `prod.py`. `ALLOWED_HOSTS` is enforced (line 8–9 of prod.py); `SECRET_KEY` should be too. Add:
  ```python
  if SECRET_KEY == 'django-insecure-change-me':
      raise ValueError('SECRET_KEY must be set in production')
  ```

- **CORS_ALLOW_ALL_ORIGINS default is False** — good. But `prod.py` never validates `CORS_ALLOWED_ORIGINS` is non-empty; an empty env var silently drops the browser. Add a guard symmetrical to `ALLOWED_HOSTS`.

- **`frontend/dev-server.log`** is committed to working tree (untracked). Add `dev-server.log` and `dist/` to a frontend `.gitignore`.

- **`drf-spectacular`** version pinned to `0.27.0` which is compatible with Django 5 but verify the `SPECTACULAR_SETTINGS.SERVERS` list is overridden in prod — the only entry is `http://localhost:8000`.

---

## 7. Test Gaps

Only three tests run against `src/`, all happy-path. The Phase-1 audit found defects that none of them would catch. Highest-value additions:

- `POST /api/auth/register/` when `users` insert raises `_is_duplicate_error` → assert the auth row is rolled back (mock admin client) AND response is 409.
- `POST /api/auth/logout/` after a successful login → re-using the same token on `GET /api/auth/me/` must return 401.
- `GET /api/auth/me/` when `auth.get_user` raises `httpx.RemoteProtocolError` → assert 503, not 401.
- `GET /api/rankings/` when `users` returns 0 rows → assert empty pagination, not a 500 from `max(subject_scores, key=...)`.
- `GET /api/majors/?field=07&search=cong+nghe` → assert response.count equals `len(results)` (regression guard for the embedded-relation OR bug, RISK-8).
- `POST /api/scores/bulk-upsert/` with `{"items": [{...}]}` from a staff user → assert the Supabase call was made with the user's access token, not the anon client (RISK-5).
- `GET /api/universities/?province=99` (nonexistent) → assert empty result with `count: 0`, not 500.
- `PATCH /api/auth/me/` with `{"grade": 1}` from a registered grade-10 user → assert 400 once RISK-4 is fixed.

Frontend: any tests at all would be new ground. Highest leverage is a Vitest + React-Testing-Library sanity test of `TruongPage` filter (post BUG-2 fix) and `BXHPage` `myRank` lookup (post BUG-4 fix).

---

## 8. Quick Wins (under 1 hour each)

1. Delete `SupabaseTokenAuthentication` (dead).
2. Delete `backend/db.sqlite3` and confirm `.gitignore` covers it.
3. Replace `regions = ["Miền Bắc", ...]` in `TruongPage.tsx` with `{value, label}` pairs (fixes BUG-2 client side; pair with `services/api.ts:314` default change).
4. Replace `const myRank = rankings[7] || rankings[0]` with a `localStorage.getItem('gr1_user')` lookup (fixes BUG-4).
5. Change `ApiUserRanking.id` to `string` (RISK-1) and `ApiAchievement` to match the backend shape (RISK-2).
6. Remove `prize?: string | null` from `ApiAward` (RISK-3).
7. `min_value=10` on `ProfileUpdateSerializer.grade` (RISK-4).
8. Add `dev-server.log` to a frontend `.gitignore` and delete the file.
9. Put a real `tsconfig.json` in `frontend/` and run `npx tsc --noEmit` once — the strict-mode errors found will be a list of free leads for follow-up.
10. Switch `bulk_upsert` to `get_user_client(request.auth)` (RISK-5).

---

## 9. Larger Improvements

Sequenced lowest-blast-radius first:

1. **Centralize Supabase error classification** (one helper, one place). Low blast radius because every caller already does its own ad-hoc sniffing; consolidating means fixing them one-by-one without breaking the others.
2. **Fix the register transaction** (BUG-1) by adding the pre-check insert. If/when an admin key is provisioned, add post-failure auth cleanup. Blast: only the register path.
3. **Replace `LogoutView.sign_out()`** with a direct GoTrue revoke call (BUG-3). Blast: only logout; tested in isolation.
4. **Differentiate 401 vs 503 in `SupabaseAuthentication`** (BUG-5). Blast: every authenticated endpoint. Add an integration test first.
5. **Decide who owns `is_admin`** and either drop the column or merge it into auth (RISK-6). Blast: all admin-only endpoints (currently just `bulk_upsert`).
6. **Introduce `tsconfig.json` + strict mode** and fix the cascade of small type errors it reveals. Blast: frontend-wide, but incremental — turn on `strict: true` first, then `noUncheckedIndexedAccess`.
7. **Replace `localStorage` tokens with cookie-based session** if/when this leaves school-project scope.

---

## 10. Prioritized Action Checklist

1. Fix BUG-1: add `user_name`/`gmail` pre-check in `RegisterView.post` before `auth.sign_up`.
2. Fix BUG-3: implement `revoke_session(access_token)` and call it from `LogoutView`.
3. Fix BUG-5: catch transient Supabase errors in `SupabaseAuthentication.authenticate_credentials` and raise a 503 `APIException`, not `AuthenticationFailed`.
4. Fix BUG-2: change `TruongPage.tsx` regions to `{value, label}` and remove the `'Mien Bac'` default in `services/api.ts`.
5. Fix BUG-4: replace `rankings[7]` with a `localStorage` lookup in `BXHPage.tsx`.
6. Fix RISK-5: switch `AdmissionScoreViewSet.bulk_upsert` to use `get_user_client(request.auth)`.
7. Align types: `ApiUserRanking.id: string`, expand `ApiAchievement`, drop `prize` from `ApiAward`.
8. Add `tsconfig.json` to `frontend/` and wire `npm run typecheck`.
9. Add the seven backend regression tests listed in section 7.
10. Consolidate Supabase error classification into `core/errors/classification.py`.
11. Decide on `users.is_admin` ownership and document it.
12. Tidy: delete `SupabaseTokenAuthentication`, `db.sqlite3`, stale `.env.test*` files, frontend `dev-server.log`; add them to ignores.
13. Cap or document the `page_size: 500` request in `TimNganhPage.tsx` vs the backend's 200 ceiling.
14. Replace embedded-relation filters in `MajorCatalogViewSet.list` with a two-step `.in_(major_code, codes)` pattern.
15. Add `SECRET_KEY` and `CORS_ALLOWED_ORIGINS` enforcement in `config/settings/prod.py`.
