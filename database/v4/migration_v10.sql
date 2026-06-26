-- migration_v10: remove the obsolete user-score sync triggers/functions.
--
-- The legacy `public.score` table was dropped in migration_v9 (academic scores
-- now live in user_subject_results / are computed in the app). However three
-- triggers and two helper functions that maintained the denormalized
-- `users.score` column still reference `public.score`. They were created
-- directly in Supabase and never tracked here, so they survived the drop.
--
-- Any write that fires them now fails with:
--   ERROR 42P01: relation "public.score" does not exist
-- This broke saving the profile (special_score), achievements and certificates
-- (each table has an AFTER INSERT/UPDATE/DELETE trigger calling the function).
--
-- Nothing in the codebase reads `users.score`; scores are recomputed in Python
-- and other RPCs. So we drop the broken sync mechanism entirely.

BEGIN;

DROP TRIGGER IF EXISTS trg_users_update_user_score        ON public.users;
DROP TRIGGER IF EXISTS trg_achievements_update_user_score ON public.achievements;
DROP TRIGGER IF EXISTS trg_certificates_update_user_score ON public.certificates;

DROP FUNCTION IF EXISTS public.trg_sync_user_score();
DROP FUNCTION IF EXISTS public.calculate_user_score(uuid);

COMMIT;

-- Note: the now-unused `users.score` column is intentionally left in place to
-- avoid touching anything that might still SELECT it. Drop it separately later
-- if confirmed unused:
--   ALTER TABLE public.users DROP COLUMN IF EXISTS score;
