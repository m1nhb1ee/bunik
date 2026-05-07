-- ============================================================
-- Bunik Database v6.0 - Tuyensinh247 source-aware admissions
-- Separates canonical majors from university-specific programs.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS public.v_admission_overview;
DROP MATERIALIZED VIEW IF EXISTS public.v_university_stats;

-- 1. SUBJECT_GROUPS: allow unknown source groups such as X26.
INSERT INTO public.fields (code, description)
VALUES ('khac', 'Nhom nganh chua phan loai hoac can review thu cong')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.fields
    ALTER COLUMN code TYPE VARCHAR(50);

ALTER TABLE public.major_catalog
    ALTER COLUMN code TYPE VARCHAR(100),
    ALTER COLUMN name TYPE TEXT,
    ALTER COLUMN field_code TYPE VARCHAR(50);

ALTER TABLE public.major_subject_groups
    ALTER COLUMN major_code TYPE VARCHAR(100),
    ALTER COLUMN subject_group_code TYPE VARCHAR(20);

ALTER TABLE public.subject_groups
    ALTER COLUMN code TYPE VARCHAR(20),
    ALTER COLUMN subject_1 TYPE VARCHAR(100),
    ALTER COLUMN subject_2 TYPE VARCHAR(100),
    ALTER COLUMN subject_3 TYPE VARCHAR(100);

ALTER TABLE public.universities
    ALTER COLUMN code TYPE VARCHAR(50),
    ALTER COLUMN type TYPE VARCHAR(50);

ALTER TABLE public.university_programs
    ALTER COLUMN university_short_name TYPE VARCHAR(50),
    ALTER COLUMN major_code TYPE VARCHAR(100);

ALTER TABLE public.admission_methods
    ALTER COLUMN code TYPE VARCHAR(20),
    ALTER COLUMN name TYPE VARCHAR(150);

ALTER TABLE public.admission_scores
    ALTER COLUMN admission_method_code TYPE VARCHAR(20);

ALTER TABLE public.subject_groups
    ALTER COLUMN subject_1 DROP NOT NULL,
    ALTER COLUMN subject_2 DROP NOT NULL,
    ALTER COLUMN subject_3 DROP NOT NULL;

ALTER TABLE public.subject_groups
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.subject_groups
SET
    display_name = COALESCE(display_name, code),
    is_verified = TRUE
WHERE subject_1 IS NOT NULL
  AND subject_2 IS NOT NULL
  AND subject_3 IS NOT NULL;

-- 2. UNIVERSITY_PROGRAMS: store source program variants.
ALTER TABLE public.university_programs
    ADD COLUMN IF NOT EXISTS program_source_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS program_name TEXT,
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'tuyensinh247',
    ADD COLUMN IF NOT EXISTS source_school_id INTEGER;

UPDATE public.university_programs
SET program_source_code = major_code
WHERE program_source_code IS NULL OR program_source_code = '';

-- Existing legacy data may already have duplicate (school, major) rows.
-- Keep the first row as the plain major code, then suffix the duplicates so
-- the source-code unique index can be created without deleting history.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY university_short_name, source, program_source_code
            ORDER BY id
        ) AS rn
    FROM public.university_programs
)
UPDATE public.university_programs up
SET program_source_code = up.program_source_code || '_legacy_' || LEFT(up.id::TEXT, 8)
FROM ranked r
WHERE r.id = up.id
  AND r.rn > 1;

ALTER TABLE public.university_programs
    ALTER COLUMN program_source_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_university_programs_source_code
ON public.university_programs (university_short_name, source, program_source_code);

CREATE INDEX IF NOT EXISTS idx_univ_prog_source_school
ON public.university_programs (source, source_school_id);

-- 3. ADMISSION_SCORES: keep source identity and raw method metadata.
ALTER TABLE public.admission_scores
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'tuyensinh247',
    ADD COLUMN IF NOT EXISTS source_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_method_id INTEGER,
    ADD COLUMN IF NOT EXISTS source_method_name TEXT;

ALTER TABLE public.admission_scores
    DROP CONSTRAINT IF EXISTS admission_scores_university_program_id_admission_method_code_year_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_scores_source_id
ON public.admission_scores (source, source_id)
WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scores_program_method_year
ON public.admission_scores (university_program_id, admission_method_code, year DESC);

CREATE INDEX IF NOT EXISTS idx_scores_source_method
ON public.admission_scores (source, source_method_id);

-- 4. Program-level subject groups.
CREATE TABLE IF NOT EXISTS public.university_program_subject_groups (
    university_program_id UUID NOT NULL REFERENCES public.university_programs(id) ON DELETE CASCADE,
    subject_group_code VARCHAR(20) NOT NULL REFERENCES public.subject_groups(code),
    PRIMARY KEY (university_program_id, subject_group_code)
);

CREATE INDEX IF NOT EXISTS idx_univ_prog_subject_groups_subject
ON public.university_program_subject_groups (subject_group_code);

-- 5. Verified/manual major-code aliases for code changes over time.
CREATE TABLE IF NOT EXISTS public.major_code_aliases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    old_code VARCHAR(100) NOT NULL,
    new_code VARCHAR(100) NOT NULL,
    effective_year SMALLINT CHECK (effective_year IS NULL OR (effective_year >= 2000 AND effective_year <= 2100)),
    reason TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT major_code_aliases_no_self_alias CHECK (old_code <> new_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_major_code_aliases_pair_year
ON public.major_code_aliases (old_code, new_code, COALESCE(effective_year, 0));

-- 6. Rebuild materialized views so they support source-aware programs.
CREATE MATERIALIZED VIEW public.v_admission_overview AS
SELECT
    u.id                  AS university_id,
    u.name                AS university_name,
    u.code                AS university_code,
    u.type                AS university_type,
    p.name                AS province,
    p.region,
    up.id                 AS university_program_id,
    up.program_source_code,
    up.program_name,
    up.major_code,
    mc.name               AS major_name,
    f.description         AS field_description,
    s.id                  AS admission_score_id,
    s.source,
    s.source_id,
    s.source_method_id,
    s.source_method_name,
    s.year,
    s.score,
    s.admission_method_code,
    am.name               AS admission_method,
    s.note
FROM public.admission_scores s
JOIN public.university_programs up ON up.id = s.university_program_id
JOIN public.universities u         ON u.code = up.university_short_name
JOIN public.provinces p            ON p.id = u.province_id
JOIN public.major_catalog mc       ON mc.code = up.major_code
JOIN public.fields f               ON f.code = mc.field_code
JOIN public.admission_methods am   ON am.code = s.admission_method_code
WHERE up.is_active = TRUE
  AND u.is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_v_admission_overview_score
ON public.v_admission_overview (admission_score_id);

CREATE INDEX IF NOT EXISTS idx_v_admission_overview_year_score
ON public.v_admission_overview (year DESC, score DESC);

CREATE INDEX IF NOT EXISTS idx_v_admission_overview_university
ON public.v_admission_overview (university_code, year DESC);

CREATE MATERIALIZED VIEW public.v_university_stats AS
WITH latest_year AS (
    SELECT MAX(year) AS yr FROM public.admission_scores
)
SELECT
    u.id,
    u.name,
    u.code,
    u.type,
    p.name AS province,
    p.region,
    COUNT(DISTINCT up.major_code) AS total_majors,
    COUNT(DISTINCT up.id) AS total_programs,
    ROUND(AVG(s.score), 2) AS avg_score,
    MIN(s.score) AS min_score,
    MAX(s.score) AS max_score
FROM public.universities u
JOIN public.provinces p ON p.id = u.province_id
LEFT JOIN public.university_programs up
    ON up.university_short_name = u.code
   AND up.is_active = TRUE
LEFT JOIN public.admission_scores s
    ON s.university_program_id = up.id
   AND s.year = (SELECT yr FROM latest_year)
WHERE u.is_active = TRUE
GROUP BY u.id, u.name, u.code, u.type, p.name, p.region;

CREATE UNIQUE INDEX IF NOT EXISTS uq_v_university_stats_id
ON public.v_university_stats (id);

CREATE INDEX IF NOT EXISTS idx_v_university_stats_score
ON public.v_university_stats (avg_score DESC, max_score DESC);
