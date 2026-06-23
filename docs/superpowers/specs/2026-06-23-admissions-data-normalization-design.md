# Admissions Data Normalization Design

Date: 2026-06-23

## Objective

Correct the known admission-score corruption, preserve historical cutoff variants without treating them as current programs, and make all admission analytics compare only compatible scores.

Success means:

- the 285 incorrectly scaled `KH` scores match the crawler output again;
- only four explicitly reviewed decimal repairs remain;
- every cutoff row has a stable variant identity;
- historical region/gender program codes resolve to a canonical program without losing their original code or score metadata;
- backend upsert uses a real unique key;
- university statistics and major trends use normalized THPT scores only;
- CSV output, migrations, backend behavior, tests, and live Supabase data agree.

## Scope

### Included

- v4 crawler-clean-final data pipeline;
- admission-score CSVs and correction audit;
- canonical program and historical program aliases;
- cutoff variant columns and uniqueness;
- catalog aggregation by program and admission method;
- known incorrect subject-group definitions;
- missing program metadata produced by the clean pipeline;
- materialized admission views and analytics;
- backend score serializers, bulk upsert, score listing, recommendations, and major trends;
- migration and live Supabase rollout.

### Explicitly excluded

- RLS, grants, and the user-score view security audit, per the user's earlier instruction;
- removal of zero DGTD/DGNL scores. They represent methods unavailable in the historical year and will only be excluded from analytics;
- automatic verification of unresolved major fields, aliases, or subject groups when no authoritative source exists. They remain explicitly unverified rather than being guessed;
- treating the 8,061 `course_catalog.csv` rows as duplicates. Their grain is program plus admission method.

## Data Model

### Canonical programs

`university_programs` continues to represent current or enduring programs. Historical region/gender/source-code variants remain temporarily as inactive compatibility rows, but each historical row points to its canonical row through a new nullable `canonical_program_id` self-reference.

Canonical selection is deterministic:

1. Prefer an active exact/base program.
2. If active gender-specific programs exist, map region-specific variants to the matching gender program.
3. If only one active program exists in a family, map all historical variants to it.
4. If multiple candidates remain ambiguous, do not guess; leave the mapping null and emit a review record.

`base_program_code` is backfilled for canonical and historical rows. The family key is `(university_short_name, base_program_code)`.

### Historical program aliases

Add `university_program_aliases`:

- `id bigint identity primary key`
- `university_short_name varchar not null`
- `old_program_id uuid null`
- `old_program_code varchar not null`
- `canonical_program_id uuid not null`
- `effective_from_year smallint null`
- `effective_to_year smallint null`
- `reason text null`
- `is_verified boolean not null default false`
- `created_at timestamptz not null default now()`

The table preserves old codes and UUID resolution while new API responses use canonical programs.

### Cutoff variants

Add these columns to `admission_scores`:

- `variant_key varchar not null`
- `source_program_code varchar null`
- `variant_label text null`
- `gender varchar null`, constrained to `nam`, `nu`, or `all`
- `region_code varchar null`
- `subject_group_code varchar null references subject_groups(code)`
- `normalized_score numeric null`
- `normalized_scale smallint null`

Historical rows are backfilled as follows:

- `variant_key = 'source:' || source_id` when `source_id` exists;
- otherwise `variant_key = 'row:' || id`;
- `source_program_code` comes from the pre-canonical program row;
- `variant_label` preserves the original note;
- gender and region are parsed only from explicit source code/note patterns;
- `subject_group_code` remains null unless the source row itself proves the mapping;
- no subject group is inferred from the program-wide catalog.

The new unique key is:

```sql
(university_program_id, admission_method_code, year, variant_key)
```

The existing source identity uniqueness remains in place.

### Catalog options

Preserve the catalog's program-plus-method grain in `university_program_admission_options`:

- one row per program and admission method;
- method-specific quota is preserved;
- conflicting program-level quota is no longer resolved by taking the last CSV row;
- subject groups are unioned per option and copied to the program-level junction only as a compatibility union.

Add `university_program_admission_option_subject_groups` for the option-to-subject-group relationship.

The catalog loader aggregates rows rather than overwriting a dictionary entry keyed only by program.

## Score Correction Policy

Remove the cap-based repeated division heuristic entirely.

Use an explicit reviewed correction allowlist:

- source `134489`: `2337 -> 23.37` (`THPT`)
- source `134490`: `193 -> 19.3` (`THPT`)
- source `194887`: `2333 -> 23.33` (`HBA`)
- source `148424`: `2600 -> 26` (`KH`, combined graduation score and international certificate)

All other scores retain the clean-input value. This restores 285 `KH` rows, including SAT and scale-100 talent/portfolio scores.

The correction audit records source ID, method, original value, fixed value, and reason.

The existing two-decimal rounding remains for compatibility with `numeric(6,2)`. It is documented as accepted precision loss; exact three-decimal preservation is not required by this rollout.

## Normalization and Analytics

Only THPT rows participate in comparable university and major analytics.

THPT normalization:

- score `0` is excluded;
- values explicitly marked as scale 40, or THPT values over 30, are normalized to scale 30 with `score * 30 / 40`;
- other THPT scores remain unchanged on scale 30.

For each canonical program and year, calculate:

- minimum normalized cutoff;
- maximum normalized cutoff;
- median normalized cutoff.

University and major aggregates use one median per canonical program so programs with many region/gender variants do not receive extra weight.

`v_university_stats` is rebuilt from latest-year normalized THPT program summaries. It exposes meaningful min, max, and average-of-program-medians.

`MajorTrendsView` filters THPT, excludes zero, normalizes scale 40, groups variants per canonical program, and then aggregates program medians by major and year.

Recommendations use the most recent program median, with deterministic year and score ordering. They no longer select an arbitrary first row.

## Backend Contract

Score list/detail responses include variant fields and normalized values.

Bulk upsert:

- accepts `variant_key` and optional variant metadata;
- removes the hard `score <= 40` validation because raw scales vary;
- validates non-negative score and normalized scale metadata;
- uses the new four-column conflict key;
- does not overwrite distinct historical variants.

Current program endpoints return canonical active programs. Old program codes resolve through the alias table where needed.

## Remaining Data Cleanup

The rollout also fixes mechanically verifiable issues:

- preserve `missing_reason` and `base_program_code` for complete program rows;
- stop representing unknown quota as zero; use null and a reason/review flag;
- correct the known substantive subject mappings for `A03`, `A04`, `A06`, and `A07`;
- preserve the 18 unresolved subject groups as unverified placeholders;
- encode the confirmed `5248020 -> cntt` field correction in the pipeline so CSV and Supabase do not drift;
- keep unresolved fields and unverified aliases in review reports rather than guessing values.

## Migration Sequence

1. Snapshot counts and the four affected datasets.
2. Add new tables and nullable columns.
3. Backfill variant keys, source program codes, dimensions, base codes, and canonical mappings.
4. Populate aliases and catalog option tables.
5. Remap admission scores only where canonical mapping is deterministic.
6. Add validated checks, foreign keys, and indexes.
7. Add the variant unique index after duplicate verification.
8. Regenerate final CSVs with the explicit score correction policy.
9. Update live score values and import the new dimensions transactionally.
10. Rebuild and refresh materialized views.
11. Deploy backend changes and invalidate affected cache versions.

Every destructive or remapping step runs in a transaction and aborts on count, FK, or uniqueness mismatch.

## Verification

Data checks:

- 19,796 score source IDs remain present exactly once;
- exactly four correction audit rows remain;
- all other final score values equal the clean input;
- the 285 restored KH values equal the clean input and SAT values remain on their original scale;
- every score has a variant key;
- the new unique key has zero duplicates;
- zero DGTD/DGNL rows remain stored but contribute zero rows to analytics;
- no score or option orphan exists;
- CSV and Supabase imported columns match exactly.

Analytics checks:

- university statistics contain THPT only;
- normalized scores remain in the expected 0-30 range;
- no university average exceeds 30;
- each program contributes one median per year;
- major trends contain no SAT, DGNL, DGTD, HBA, KH, or OTHER values.

Backend tests:

- bulk upsert preserves two variants for the same program/method/year;
- bulk upsert accepts SAT-scale raw values;
- conflict updates only the matching variant;
- recommendations choose the latest deterministic program median;
- score responses expose variant metadata;
- existing program filters and pagination continue to work.

## Rollback

Before migration, retain the current final CSVs and pre-change row counts. Schema additions are backward compatible until the backend deploy. If verification fails, roll back the database transaction and restore the current final CSVs; no partial canonical remapping is committed.
