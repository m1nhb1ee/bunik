-- Add dedicated subject for specialized class profile.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS special_subject VARCHAR(20);

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_special_subject_check;

ALTER TABLE public.users
ADD CONSTRAINT users_special_subject_check
CHECK (
    special_subject IS NULL
    OR special_subject IN (
        'toan', 'ly', 'hoa', 'sinh', 'tin', 'ngoai_ngu', 'van', 'su', 'dia'
    )
);
