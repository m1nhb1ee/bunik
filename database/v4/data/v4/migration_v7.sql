-- ============================================================
-- Bunik Database v7.0 - Data Pipeline Refinement
-- Adds missing_reason and base_program_code to handle historical data
-- and prevent double-counting of quotas.
-- ============================================================

-- 1. Update Table Schema
ALTER TABLE public.university_programs
ADD COLUMN IF NOT EXISTS missing_reason TEXT,
ADD COLUMN IF NOT EXISTS base_program_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_up_base_program_code 
ON public.university_programs (base_program_code);

-- 2. Update Materialized Views
DROP MATERIALIZED VIEW IF EXISTS public.v_admission_overview;
DROP MATERIALIZED VIEW IF EXISTS public.v_university_stats;

-- 2a. Recreate v_admission_overview to include the new columns
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
    up.base_program_code,
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
    s.note,
    up.missing_reason
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

-- 2b. Recreate v_university_stats to EXCLUDE historical/branch programs from counts
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
   AND up.missing_reason IS NULL -- Only count exact canonical programs
LEFT JOIN public.admission_scores s
    ON s.university_program_id = up.id
   AND s.year = (SELECT yr FROM latest_year)
WHERE u.is_active = TRUE
GROUP BY u.id, u.name, u.code, u.type, p.name, p.region;

CREATE UNIQUE INDEX IF NOT EXISTS uq_v_university_stats_id
ON public.v_university_stats (id);

CREATE INDEX IF NOT EXISTS idx_v_university_stats_score
ON public.v_university_stats (avg_score DESC, max_score DESC);
