-- ============================================================
-- Bunik Database v9.0 - GDPT 2018 normalized subject profiles
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.school_subjects (
    code text PRIMARY KEY,
    name text NOT NULL,
    curriculum_group text NOT NULL,
    assessment_type text NOT NULL,
    counts_as_core boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT school_subjects_curriculum_group_check
        CHECK (curriculum_group IN ('COMPULSORY', 'ELECTIVE')),
    CONSTRAINT school_subjects_assessment_type_check
        CHECK (assessment_type IN ('NUMERIC', 'PASS_FAIL')),
    CONSTRAINT school_subjects_core_group_check
        CHECK (NOT counts_as_core OR curriculum_group = 'COMPULSORY')
);

INSERT INTO public.school_subjects (
    code, name, curriculum_group, assessment_type, counts_as_core
) VALUES
    ('math', 'Toán', 'COMPULSORY', 'NUMERIC', true),
    ('literature', 'Ngữ văn', 'COMPULSORY', 'NUMERIC', true),
    ('english', 'Tiếng Anh', 'COMPULSORY', 'NUMERIC', true),
    ('history', 'Lịch sử', 'COMPULSORY', 'NUMERIC', true),
    ('physical_education', 'Giáo dục thể chất', 'COMPULSORY', 'PASS_FAIL', false),
    ('national_defense_security', 'Giáo dục Quốc phòng và An ninh', 'COMPULSORY', 'NUMERIC', false),
    ('experiential_career', 'Hoạt động trải nghiệm, hướng nghiệp', 'COMPULSORY', 'PASS_FAIL', false),
    ('local_education', 'Nội dung giáo dục địa phương', 'COMPULSORY', 'PASS_FAIL', false),
    ('geography', 'Địa lí', 'ELECTIVE', 'NUMERIC', false),
    ('economic_law', 'Giáo dục Kinh tế và Pháp luật', 'ELECTIVE', 'NUMERIC', false),
    ('physics', 'Vật lí', 'ELECTIVE', 'NUMERIC', false),
    ('chemistry', 'Hóa học', 'ELECTIVE', 'NUMERIC', false),
    ('biology', 'Sinh học', 'ELECTIVE', 'NUMERIC', false),
    ('informatics', 'Tin học', 'ELECTIVE', 'NUMERIC', false),
    ('technology', 'Công nghệ', 'ELECTIVE', 'NUMERIC', false),
    ('music', 'Âm nhạc', 'ELECTIVE', 'PASS_FAIL', false),
    ('fine_arts', 'Mĩ thuật', 'ELECTIVE', 'PASS_FAIL', false)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    curriculum_group = EXCLUDED.curriculum_group,
    assessment_type = EXCLUDED.assessment_type,
    counts_as_core = EXCLUDED.counts_as_core,
    is_active = true;

CREATE TABLE IF NOT EXISTS public.user_elective_subjects (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subject_code text NOT NULL REFERENCES public.school_subjects(code) ON DELETE RESTRICT,
    selected_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, subject_code)
);

CREATE INDEX IF NOT EXISTS idx_user_elective_subjects_subject_code
    ON public.user_elective_subjects (subject_code);

CREATE TABLE IF NOT EXISTS public.user_subject_results (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subject_code text NOT NULL REFERENCES public.school_subjects(code) ON DELETE RESTRICT,
    numeric_score numeric(4,2),
    assessment_status text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, subject_code),
    CONSTRAINT user_subject_results_numeric_score_check
        CHECK (numeric_score IS NULL OR numeric_score BETWEEN 0 AND 10),
    CONSTRAINT user_subject_results_assessment_status_check
        CHECK (assessment_status IS NULL OR assessment_status IN ('PASSED', 'FAILED')),
    CONSTRAINT user_subject_results_exactly_one_result_check
        CHECK ((numeric_score IS NOT NULL) <> (assessment_status IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_user_subject_results_subject_code
    ON public.user_subject_results (subject_code);

ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_elective_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subject_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_subjects_read_active ON public.school_subjects;
CREATE POLICY school_subjects_read_active
    ON public.school_subjects
    FOR SELECT
    TO authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS user_elective_subjects_own_rows ON public.user_elective_subjects;
CREATE POLICY user_elective_subjects_own_rows
    ON public.user_elective_subjects
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS user_subject_results_own_rows ON public.user_subject_results;
CREATE POLICY user_subject_results_own_rows
    ON public.user_subject_results
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.school_subjects TO authenticated;
GRANT SELECT ON public.user_elective_subjects TO authenticated;
GRANT SELECT ON public.user_subject_results TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_elective_subjects FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_subject_results FROM authenticated;

CREATE OR REPLACE FUNCTION public.save_user_subject_profile(
    p_elective_codes text[],
    p_results jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_elective_count integer;
    v_distinct_elective_count integer;
    v_result_count integer;
    v_distinct_result_count integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    v_elective_count := COALESCE(cardinality(p_elective_codes), 0);
    SELECT COUNT(DISTINCT code)
    INTO v_distinct_elective_count
    FROM unnest(COALESCE(p_elective_codes, ARRAY[]::text[])) AS elective(code);

    IF v_elective_count <> 4 OR v_distinct_elective_count <> 4 THEN
        RAISE EXCEPTION 'Exactly four distinct elective subjects are required'
            USING ERRCODE = '22023';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public.school_subjects
        WHERE code = ANY(p_elective_codes)
          AND curriculum_group = 'ELECTIVE'
          AND is_active = true
    ) <> 4 THEN
        RAISE EXCEPTION 'One or more elective subjects are invalid'
            USING ERRCODE = '22023';
    END IF;

    IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
        RAISE EXCEPTION 'Results must be a JSON array' USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*), COUNT(DISTINCT item->>'subject_code')
    INTO v_result_count, v_distinct_result_count
        FROM jsonb_array_elements(p_results) AS input(item);

    IF v_result_count <> v_distinct_result_count THEN
        RAISE EXCEPTION 'A subject result may only appear once' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_results) AS input(item)
        LEFT JOIN public.school_subjects subject
          ON subject.code = item->>'subject_code'
         AND subject.is_active = true
        WHERE subject.code IS NULL
           OR (
                subject.curriculum_group = 'ELECTIVE'
                AND NOT subject.code = ANY(p_elective_codes)
           )
           OR (
                subject.assessment_type = 'NUMERIC'
                AND (
                    NULLIF(item->>'numeric_score', '') IS NULL
                    OR NULLIF(item->>'assessment_status', '') IS NOT NULL
                    OR (item->>'numeric_score')::numeric NOT BETWEEN 0 AND 10
                )
           )
           OR (
                subject.assessment_type = 'PASS_FAIL'
                AND (
                    NULLIF(item->>'numeric_score', '') IS NOT NULL
                    OR COALESCE(item->>'assessment_status', '') NOT IN ('PASSED', 'FAILED')
                )
           )
    ) THEN
        RAISE EXCEPTION 'One or more subject results are invalid' USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.user_elective_subjects
    WHERE user_id = v_user_id;

    INSERT INTO public.user_elective_subjects (user_id, subject_code)
    SELECT v_user_id, code
    FROM unnest(p_elective_codes) AS elective(code);

    DELETE FROM public.user_subject_results result
    USING public.school_subjects subject
    WHERE result.user_id = v_user_id
      AND result.subject_code = subject.code
      AND (subject.counts_as_core OR subject.curriculum_group = 'ELECTIVE');

    INSERT INTO public.user_subject_results (
        user_id, subject_code, numeric_score, assessment_status, updated_at
    )
    SELECT
        v_user_id,
        item->>'subject_code',
        NULLIF(item->>'numeric_score', '')::numeric,
        NULLIF(item->>'assessment_status', ''),
        now()
    FROM jsonb_array_elements(p_results) AS input(item)
    ON CONFLICT (user_id, subject_code) DO UPDATE SET
        numeric_score = EXCLUDED.numeric_score,
        assessment_status = EXCLUDED.assessment_status,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_academic_score()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
WITH current_account AS (
    SELECT auth.uid() AS user_id
), selected_subjects AS (
    SELECT subject.code, subject.name
    FROM public.school_subjects subject
    WHERE subject.counts_as_core = true
      AND subject.is_active = true
    UNION ALL
    SELECT subject.code, subject.name
    FROM public.user_elective_subjects selected
    JOIN public.school_subjects subject ON subject.code = selected.subject_code
    JOIN current_account ON current_account.user_id = selected.user_id
    WHERE subject.is_active = true
), result_rows AS (
    SELECT
        selected.code,
        selected.name,
        result.numeric_score,
        result.assessment_status
    FROM selected_subjects selected
    LEFT JOIN public.user_subject_results result
      ON result.subject_code = selected.code
     AND result.user_id = (SELECT user_id FROM current_account)
), aggregate_score AS (
    SELECT
        COUNT(*) AS selected_count,
        COUNT(*) FILTER (
            WHERE numeric_score IS NOT NULL OR assessment_status IS NOT NULL
        ) AS result_count,
        COUNT(numeric_score) AS numeric_count,
        COALESCE(SUM(numeric_score), 0) AS numeric_sum,
        COUNT(*) FILTER (WHERE assessment_status = 'PASSED') AS passed_count,
        COUNT(*) FILTER (WHERE assessment_status = 'FAILED') AS failed_count,
        COALESCE(
            jsonb_agg(code ORDER BY code) FILTER (
                WHERE numeric_score IS NULL AND assessment_status IS NULL
            ),
            '[]'::jsonb
        ) AS missing_subject_codes
    FROM result_rows
)
SELECT jsonb_build_object(
    'is_complete', selected_count = 8 AND result_count = 8 AND numeric_count > 0,
    'score_80', CASE
        WHEN selected_count = 8 AND result_count = 8 AND numeric_count > 0
        THEN ROUND(numeric_sum + (numeric_sum / numeric_count) * passed_count, 2)
        ELSE NULL
    END,
    'numeric_average', CASE
        WHEN numeric_count > 0 THEN ROUND(numeric_sum / numeric_count, 2)
        ELSE NULL
    END,
    'numeric_count', numeric_count,
    'passed_count', passed_count,
    'failed_count', failed_count,
    'missing_subject_codes', missing_subject_codes
)
FROM aggregate_score;
$$;

REVOKE ALL ON FUNCTION public.save_user_subject_profile(text[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_academic_score() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_user_subject_profile(text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_academic_score() TO authenticated;

-- Backfill legacy numeric results without overwriting confirmed normalized rows.
INSERT INTO public.user_subject_results (user_id, subject_code, numeric_score)
SELECT legacy.user_id, values.subject_code, values.numeric_score
FROM public.score legacy
CROSS JOIN LATERAL (
    VALUES
        ('math', legacy.math),
        ('literature', legacy.literature),
        ('english', legacy.english),
        ('history', legacy.history),
        ('physics', legacy.physics),
        ('chemistry', legacy.chemistry),
        ('biology', legacy.biology),
        ('geography', legacy.geography)
) AS values(subject_code, numeric_score)
WHERE values.numeric_score IS NOT NULL
  AND values.numeric_score > 0
ON CONFLICT (user_id, subject_code) DO NOTHING;

WITH legacy_electives AS (
    SELECT legacy.user_id, values.subject_code
    FROM public.score legacy
    CROSS JOIN LATERAL (
        VALUES
            ('physics', legacy.physics),
            ('chemistry', legacy.chemistry),
            ('biology', legacy.biology),
            ('geography', legacy.geography)
    ) AS values(subject_code, numeric_score)
    WHERE values.numeric_score IS NOT NULL
      AND values.numeric_score > 0
), complete_legacy_users AS (
    SELECT user_id
    FROM legacy_electives
    GROUP BY user_id
    HAVING COUNT(DISTINCT subject_code) = 4
)
INSERT INTO public.user_elective_subjects (user_id, subject_code)
SELECT elective.user_id, elective.subject_code
FROM legacy_electives elective
JOIN complete_legacy_users complete ON complete.user_id = elective.user_id
WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_elective_subjects existing
    WHERE existing.user_id = elective.user_id
)
ON CONFLICT (user_id, subject_code) DO NOTHING;

COMMIT;
