-- ============================================================
-- Bunik Database v8.0 - Canonical programs and cutoff variants
-- ============================================================

BEGIN;

ALTER TABLE public.university_programs
    ADD COLUMN IF NOT EXISTS canonical_program_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'university_programs_canonical_program_id_fkey'
          AND conrelid = 'public.university_programs'::regclass
    ) THEN
        ALTER TABLE public.university_programs
            ADD CONSTRAINT university_programs_canonical_program_id_fkey
            FOREIGN KEY (canonical_program_id)
            REFERENCES public.university_programs(id)
            ON DELETE RESTRICT
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_up_canonical_program_id
    ON public.university_programs (canonical_program_id)
    WHERE canonical_program_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_up_university_base_program
    ON public.university_programs (university_short_name, base_program_code);

CREATE TABLE IF NOT EXISTS public.university_program_aliases (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_short_name varchar(50) NOT NULL
        REFERENCES public.universities(code),
    old_program_id uuid
        REFERENCES public.university_programs(id) ON DELETE CASCADE,
    old_program_code varchar(100) NOT NULL,
    canonical_program_id uuid NOT NULL
        REFERENCES public.university_programs(id) ON DELETE RESTRICT,
    effective_from_year smallint,
    effective_to_year smallint,
    reason text,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT university_program_aliases_year_order_check CHECK (
        effective_from_year IS NULL OR effective_to_year IS NULL
        OR effective_from_year <= effective_to_year
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_university_program_alias_code_period
    ON public.university_program_aliases (
        university_short_name,
        old_program_code,
        COALESCE(effective_from_year, 0),
        COALESCE(effective_to_year, 0)
    );

CREATE INDEX IF NOT EXISTS idx_university_program_alias_canonical
    ON public.university_program_aliases (canonical_program_id);

CREATE TABLE IF NOT EXISTS public.university_program_admission_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    university_program_id uuid NOT NULL
        REFERENCES public.university_programs(id) ON DELETE CASCADE,
    admission_method_code varchar(20) NOT NULL
        REFERENCES public.admission_methods(code),
    effective_year smallint NOT NULL,
    quota integer,
    source varchar(50) NOT NULL DEFAULT 'tuyensinh247',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT university_program_admission_options_year_check
        CHECK (effective_year BETWEEN 2000 AND 2100),
    CONSTRAINT university_program_admission_options_quota_check
        CHECK (quota IS NULL OR quota >= 0),
    CONSTRAINT uq_university_program_admission_option
        UNIQUE (university_program_id, admission_method_code, effective_year)
);

CREATE INDEX IF NOT EXISTS idx_program_admission_options_method_year
    ON public.university_program_admission_options (admission_method_code, effective_year);

CREATE TABLE IF NOT EXISTS public.university_program_admission_option_subject_groups (
    admission_option_id uuid NOT NULL
        REFERENCES public.university_program_admission_options(id) ON DELETE CASCADE,
    subject_group_code varchar(20) NOT NULL
        REFERENCES public.subject_groups(code),
    PRIMARY KEY (admission_option_id, subject_group_code)
);

CREATE INDEX IF NOT EXISTS idx_program_admission_option_subject_code
    ON public.university_program_admission_option_subject_groups (subject_group_code);

ALTER TABLE public.admission_scores
    ADD COLUMN IF NOT EXISTS variant_key varchar(100),
    ADD COLUMN IF NOT EXISTS source_program_code varchar(100),
    ADD COLUMN IF NOT EXISTS variant_label text,
    ADD COLUMN IF NOT EXISTS gender varchar(10),
    ADD COLUMN IF NOT EXISTS region_code varchar(20),
    ADD COLUMN IF NOT EXISTS subject_group_code varchar(20),
    ADD COLUMN IF NOT EXISTS normalized_score numeric(8,2),
    ADD COLUMN IF NOT EXISTS normalized_scale smallint;

UPDATE public.admission_scores s
SET
    variant_key = COALESCE(
        s.variant_key,
        CASE WHEN s.source_id IS NOT NULL THEN 'source:' || s.source_id::text
             ELSE 'row:' || s.id::text END
    ),
    source_program_code = COALESCE(s.source_program_code, up.program_source_code),
    variant_label = COALESCE(s.variant_label, s.note),
    normalized_score = COALESCE(
        s.normalized_score,
        CASE
            WHEN s.admission_method_code <> 'THPT' OR s.score <= 0 THEN NULL
            WHEN s.score > 30 THEN ROUND(s.score * 30 / 40, 2)
            ELSE s.score
        END
    ),
    normalized_scale = COALESCE(
        s.normalized_scale,
        CASE
            WHEN s.admission_method_code = 'THPT' AND s.score > 0 THEN 30
            ELSE NULL
        END
    )
FROM public.university_programs up
WHERE up.id = s.university_program_id;

ALTER TABLE public.admission_scores
    ALTER COLUMN variant_key SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'admission_scores_subject_group_code_fkey'
          AND conrelid = 'public.admission_scores'::regclass
    ) THEN
        ALTER TABLE public.admission_scores
            ADD CONSTRAINT admission_scores_subject_group_code_fkey
            FOREIGN KEY (subject_group_code)
            REFERENCES public.subject_groups(code);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'admission_scores_gender_check'
          AND conrelid = 'public.admission_scores'::regclass
    ) THEN
        ALTER TABLE public.admission_scores
            ADD CONSTRAINT admission_scores_gender_check
            CHECK (gender IS NULL OR gender IN ('nam', 'nu', 'all'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'admission_scores_normalized_score_check'
          AND conrelid = 'public.admission_scores'::regclass
    ) THEN
        ALTER TABLE public.admission_scores
            ADD CONSTRAINT admission_scores_normalized_score_check
            CHECK (
                normalized_score IS NULL
                OR normalized_scale IS NOT NULL AND normalized_score BETWEEN 0 AND normalized_scale
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_scores_program_method_year_variant
    ON public.admission_scores (
        university_program_id,
        admission_method_code,
        year,
        variant_key
    );

CREATE INDEX IF NOT EXISTS idx_admission_scores_subject_group
    ON public.admission_scores (subject_group_code)
    WHERE subject_group_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admission_scores_thpt_year_program
    ON public.admission_scores (year DESC, university_program_id, normalized_score)
    WHERE admission_method_code = 'THPT' AND score > 0;

DROP MATERIALIZED VIEW IF EXISTS public.v_admission_overview;
DROP MATERIALIZED VIEW IF EXISTS public.v_university_stats;

CREATE MATERIALIZED VIEW public.v_admission_overview AS
SELECT
    u.id AS university_id,
    u.name AS university_name,
    u.code AS university_code,
    u.type AS university_type,
    p.name AS province,
    p.region,
    up.id AS university_program_id,
    up.program_source_code,
    up.base_program_code,
    up.program_name,
    up.major_code,
    mc.name AS major_name,
    f.description AS field_description,
    s.id AS admission_score_id,
    s.source,
    s.source_id,
    s.source_method_id,
    s.source_method_name,
    s.source_program_code,
    s.variant_key,
    s.variant_label,
    s.gender,
    s.region_code,
    s.subject_group_code,
    s.year,
    s.score,
    s.normalized_score,
    s.normalized_scale,
    s.admission_method_code,
    am.name AS admission_method,
    s.note,
    up.missing_reason
FROM public.admission_scores s
JOIN public.university_programs up ON up.id = s.university_program_id
JOIN public.universities u ON u.code = up.university_short_name
JOIN public.provinces p ON p.id = u.province_id
JOIN public.major_catalog mc ON mc.code = up.major_code
JOIN public.fields f ON f.code = mc.field_code
JOIN public.admission_methods am ON am.code = s.admission_method_code
WHERE up.is_active = true
  AND u.is_active = true;

CREATE UNIQUE INDEX uq_v_admission_overview_score
    ON public.v_admission_overview (admission_score_id);
CREATE INDEX idx_v_admission_overview_year_score
    ON public.v_admission_overview (year DESC, score DESC);
CREATE INDEX idx_v_admission_overview_university
    ON public.v_admission_overview (university_code, year DESC);

CREATE MATERIALIZED VIEW public.v_university_stats AS
WITH latest_year AS (
    SELECT MAX(year) AS year
    FROM public.admission_scores
    WHERE admission_method_code = 'THPT' AND score > 0
),
program_scores AS (
    SELECT
        s.university_program_id,
        MIN(s.normalized_score) AS min_score,
        MAX(s.normalized_score) AS max_score,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY s.normalized_score)::numeric AS median_score
    FROM public.admission_scores s
    JOIN public.university_programs up ON up.id = s.university_program_id
    WHERE s.admission_method_code = 'THPT'
      AND s.score > 0
      AND s.year = (SELECT year FROM latest_year)
      AND up.is_active = true
    GROUP BY s.university_program_id
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
    ROUND(AVG(ps.median_score), 2) AS avg_score,
    MIN(ps.min_score) AS min_score,
    MAX(ps.max_score) AS max_score
FROM public.universities u
JOIN public.provinces p ON p.id = u.province_id
LEFT JOIN public.university_programs up
    ON up.university_short_name = u.code
   AND up.is_active = true
LEFT JOIN program_scores ps ON ps.university_program_id = up.id
WHERE u.is_active = true
GROUP BY u.id, u.name, u.code, u.type, p.name, p.region;

CREATE UNIQUE INDEX uq_v_university_stats_id
    ON public.v_university_stats (id);
CREATE INDEX idx_v_university_stats_score
    ON public.v_university_stats (avg_score DESC, max_score DESC);

COMMIT;
