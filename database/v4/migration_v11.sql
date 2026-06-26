-- migration_v11: model admission score <-> subject group as many-to-many.
--
-- admission_scores.subject_group_code (a single FK to subject_groups) cannot
-- represent a cutoff that applies to several khối (e.g. one THPT score for
-- A00, A01, D01, D07). That forced multi-khối rows to stay NULL and collapse
-- into a single "Điểm chung" row in the UI.
--
-- This junction lets one score link to N subject groups. The legacy
-- admission_scores.subject_group_code column is kept (nullable) for backward
-- compatibility during the transition; the junction is the source of truth.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admission_score_subject_groups (
  admission_score_id uuid    NOT NULL REFERENCES public.admission_scores(id) ON DELETE CASCADE,
  subject_group_code varchar NOT NULL REFERENCES public.subject_groups(code),
  PRIMARY KEY (admission_score_id, subject_group_code)
);

CREATE INDEX IF NOT EXISTS ix_assg_subject_group_code
  ON public.admission_score_subject_groups (subject_group_code);

-- Public read, mirroring admission_scores / subject_groups.
ALTER TABLE public.admission_score_subject_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_assg_public_read ON public.admission_score_subject_groups;
CREATE POLICY pol_assg_public_read
  ON public.admission_score_subject_groups
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Seed the junction from the single codes already present.
INSERT INTO public.admission_score_subject_groups (admission_score_id, subject_group_code)
SELECT id, subject_group_code
FROM public.admission_scores
WHERE subject_group_code IS NOT NULL AND subject_group_code <> ''
ON CONFLICT DO NOTHING;

COMMIT;
