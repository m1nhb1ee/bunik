-- ============================================================
-- Bunik v4 — Supabase import
-- Run with psql from THIS directory (database/v4/supabase_ready):
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f import_v4.sql
--
-- All CSVs are UTF-8 with BOM and a header row. \copy reads client-side,
-- so paths are relative to where psql is launched.
-- Load order respects every foreign key. CSVs omit columns that have DB
-- defaults (uuid ids, timestamps) — explicit column lists handle that.
-- ============================================================

BEGIN;

-- Optional clean slate (reverse FK order). Comment out for append-only loads.
TRUNCATE TABLE
    university_program_admission_option_subject_groups,
    university_program_admission_options,
    university_program_aliases,
    admission_scores,
    university_program_subject_groups,
    university_programs,
    major_subject_groups,
    major_code_aliases,
    major_catalog,
    subject_groups,
    admission_methods,
    fields,
    universities,
    provinces
RESTART IDENTITY CASCADE;

-- 1. provinces (explicit id)
\copy provinces (id, code, name, region) FROM 'provinces.csv' WITH (FORMAT csv, HEADER true);

-- 2. fields (explicit id) — REQUIRED: major_catalog.field_code references this
\copy fields (id, code, description) FROM 'fields.csv' WITH (FORMAT csv, HEADER true);
SELECT setval(pg_get_serial_sequence('fields','id'), (SELECT MAX(id) FROM fields));

-- 3. admission_methods
\copy admission_methods (code, name, description) FROM 'admission_methods.csv' WITH (FORMAT csv, HEADER true);

-- 4. subject_groups
\copy subject_groups (code, subject_1, subject_2, subject_3, display_name, is_verified) FROM 'subject_groups.csv' WITH (FORMAT csv, HEADER true);

-- 5. universities (id defaults to gen_random_uuid())
\copy universities (name, code, type, province_id, is_active) FROM 'universities.csv' WITH (FORMAT csv, HEADER true);

-- 6. major_catalog
\copy major_catalog (code, name, field_code, description) FROM 'major_catalog.csv' WITH (FORMAT csv, HEADER true);

-- 7. major_code_aliases (id is IDENTITY -> omit it)
\copy major_code_aliases (old_code, new_code, effective_year, reason, is_verified) FROM 'major_code_aliases.csv' WITH (FORMAT csv, HEADER true);

-- 8. major_subject_groups
\copy major_subject_groups (major_code, subject_group_code) FROM 'major_subject_groups.csv' WITH (FORMAT csv, HEADER true);

-- 9. university_programs (explicit uuid id; quota/missing_reason/base_program_code per v7 schema)
\copy university_programs (id, university_short_name, major_code, is_active, program_source_code, program_name, source, source_school_id, missing_reason, base_program_code, quota, canonical_program_id) FROM 'university_programs.csv' WITH (FORMAT csv, HEADER true);

-- 10. historical program aliases
\copy university_program_aliases (university_short_name, old_program_id, old_program_code, canonical_program_id, effective_from_year, effective_to_year, reason, is_verified) FROM 'university_program_aliases.csv' WITH (FORMAT csv, HEADER true);

-- 11. university_program_subject_groups
\copy university_program_subject_groups (university_program_id, subject_group_code) FROM 'university_program_subject_groups.csv' WITH (FORMAT csv, HEADER true);

-- 12. program-method catalog options
\copy university_program_admission_options (id, university_program_id, admission_method_code, effective_year, quota, source) FROM 'university_program_admission_options.csv' WITH (FORMAT csv, HEADER true);

-- 13. subject groups belonging to each program-method option
\copy university_program_admission_option_subject_groups (admission_option_id, subject_group_code) FROM 'university_program_admission_option_subject_groups.csv' WITH (FORMAT csv, HEADER true);

-- 14. admission_scores (explicit uuid id and cutoff variant identity)
\copy admission_scores (id, university_program_id, admission_method_code, year, score, note, source, source_id, source_method_id, source_method_name, variant_key, source_program_code, variant_label, gender, region_code, subject_group_code, normalized_score, normalized_scale) FROM 'admission_scores.csv' WITH (FORMAT csv, HEADER true);

COMMIT;

REFRESH MATERIALIZED VIEW public.v_admission_overview;
REFRESH MATERIALIZED VIEW public.v_university_stats;
