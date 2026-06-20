## Table `achievements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `user_id` | `uuid` |  Nullable |
| `award_id` | `int8` |  Nullable |
| `name` | `varchar` |  Nullable |
| `prize` | `varchar` |  Nullable |
| `date` | `date` |  |
| `is_verified` | `bool` |  Nullable |

## Table `admission_methods`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `varchar` | Primary |
| `name` | `varchar` |  |
| `description` | `text` |  Nullable |

## Table `admission_scores`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `university_program_id` | `uuid` |  |
| `admission_method_code` | `varchar` |  |
| `year` | `int2` |  |
| `score` | `numeric` |  |
| `note` | `text` |  Nullable |
| `source` | `varchar` |  |
| `source_id` | `int8` |  Nullable |
| `source_method_id` | `int4` |  Nullable |
| `source_method_name` | `text` |  Nullable |

## Table `awards`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `name` | `varchar` |  Nullable |
| `level` | `varchar` |  Nullable |

## Table `certificates`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `user_id` | `uuid` |  Nullable |
| `name` | `varchar` |  |
| `score` | `float4` |  Nullable |
| `date` | `date` |  Nullable |
| `is_verified` | `bool` |  Nullable |

## Table `fields`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `code` | `varchar` |  Unique |
| `description` | `text` |  Nullable |

## Table `major_catalog`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `varchar` | Primary |
| `name` | `text` |  |
| `field_code` | `varchar` |  |
| `description` | `text` |  Nullable |

## Table `major_code_aliases`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `old_code` | `varchar` |  |
| `new_code` | `varchar` |  |
| `effective_year` | `int2` |  Nullable |
| `reason` | `text` |  Nullable |
| `is_verified` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `major_subject_groups`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `major_code` | `varchar` | Primary |
| `subject_group_code` | `varchar` | Primary |

## Table `provinces`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `code` | `varchar` |  Unique |
| `name` | `varchar` |  Unique |
| `region` | `varchar` |  |

## Table `score`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable Unique |
| `math` | `float4` |  Nullable |
| `physics` | `float4` |  Nullable |
| `chemistry` | `float4` |  Nullable |
| `biology` | `float4` |  Nullable |
| `english` | `float4` |  Nullable |
| `literature` | `float4` |  Nullable |
| `history` | `float4` |  Nullable |
| `geography` | `float4` |  Nullable |
| `base_score` | `numeric` |  Nullable |

## Table `subject_groups`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `varchar` | Primary |
| `subject_1` | `varchar` |  Nullable |
| `subject_2` | `varchar` |  Nullable |
| `subject_3` | `varchar` |  Nullable |
| `display_name` | `varchar` |  Nullable |
| `is_verified` | `bool` |  |

## Table `universities`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `varchar` |  |
| `code` | `varchar` |  Nullable Unique |
| `type` | `varchar` |  |
| `province_id` | `int4` |  |
| `is_active` | `bool` |  |
| `logo_url` | `varchar` |  Nullable |
| `address` | `text` |  Nullable |
| `website` | `varchar` |  Nullable |
| `description` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `university_program_subject_groups`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `university_program_id` | `uuid` | Primary |
| `subject_group_code` | `varchar` | Primary |

## Table `university_programs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `university_short_name` | `varchar` |  |
| `major_code` | `varchar` |  |
| `is_active` | `bool` |  |
| `program_source_code` | `varchar` |  |
| `program_name` | `text` |  Nullable |
| `source` | `varchar` |  |
| `source_school_id` | `int4` |  Nullable |

## Table `users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_name` | `varchar` |  Unique |
| `full_name` | `text` |  |
| `grade` | `int2` |  Nullable |
| `dob` | `date` |  Nullable |
| `gender` | `varchar` |  Nullable |
| `gmail` | `varchar` |  Unique |
| `created_at` | `timestamptz` |  |
| `score` | `float4` |  Nullable |
| `is_special` | `bool` |  Nullable |
| `special_score` | `float4` |  Nullable |
| `is_admin` | `bool` |  Nullable |
| `special_subject` | `varchar` |  Nullable |

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.achievements (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid DEFAULT gen_random_uuid(),
  award_id bigint,
  name character varying,
  prize character varying CHECK (prize::text = ANY (ARRAY['Khuyến Khích'::character varying, 'Ba'::character varying, 'Nhì'::character varying, 'Nhất'::character varying]::text[])),
  date date NOT NULL,
  is_verified boolean,
  CONSTRAINT achievements_pkey PRIMARY KEY (id),
  CONSTRAINT achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT achievements_award_id_fkey FOREIGN KEY (award_id) REFERENCES public.awards(id),
  CONSTRAINT fk_achievements_user FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT fk_achievements_award FOREIGN KEY (award_id) REFERENCES public.awards(id)
);
CREATE TABLE public.admission_methods (
  code character varying NOT NULL,
  name character varying NOT NULL,
  description text,
  CONSTRAINT admission_methods_pkey PRIMARY KEY (code)
);
CREATE TABLE public.admission_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  university_program_id uuid NOT NULL,
  admission_method_code character varying NOT NULL,
  year smallint NOT NULL CHECK (year >= 2000 AND year <= 2100),
  score numeric NOT NULL CHECK (score >= 0::numeric),
  note text,
  source character varying NOT NULL DEFAULT 'tuyensinh247'::character varying,
  source_id bigint,
  source_method_id integer,
  source_method_name text,
  CONSTRAINT admission_scores_pkey PRIMARY KEY (id),
  CONSTRAINT admission_scores_university_program_id_fkey FOREIGN KEY (university_program_id) REFERENCES public.university_programs(id),
  CONSTRAINT admission_scores_admission_method_code_fkey FOREIGN KEY (admission_method_code) REFERENCES public.admission_methods(code)
);
CREATE TABLE public.awards (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying,
  level character varying CHECK (level::text = ANY (ARRAY['Tỉnh'::character varying, 'Quốc gia'::character varying, 'Quốc tế'::character varying]::text[])),
  CONSTRAINT awards_pkey PRIMARY KEY (id)
);
CREATE TABLE public.certificates (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  score real,
  date date,
  is_verified boolean,
  CONSTRAINT certificates_pkey PRIMARY KEY (id),
  CONSTRAINT certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT fk_certificates_user FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.fields (
  id integer NOT NULL DEFAULT nextval('fields_id_seq'::regclass),
  code character varying NOT NULL UNIQUE,
  description text,
  CONSTRAINT fields_pkey PRIMARY KEY (id)
);
CREATE TABLE public.major_catalog (
  code character varying NOT NULL,
  name text NOT NULL,
  field_code character varying NOT NULL,
  description text,
  CONSTRAINT major_catalog_pkey PRIMARY KEY (code),
  CONSTRAINT major_catalog_field_code_fkey FOREIGN KEY (field_code) REFERENCES public.fields(code)
);
CREATE TABLE public.major_code_aliases (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  old_code character varying NOT NULL,
  new_code character varying NOT NULL,
  effective_year smallint CHECK (effective_year IS NULL OR effective_year >= 2000 AND effective_year <= 2100),
  reason text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT major_code_aliases_pkey PRIMARY KEY (id)
);
CREATE TABLE public.major_subject_groups (
  major_code character varying NOT NULL,
  subject_group_code character varying NOT NULL,
  CONSTRAINT major_subject_groups_pkey PRIMARY KEY (major_code, subject_group_code),
  CONSTRAINT major_subject_groups_major_code_fkey FOREIGN KEY (major_code) REFERENCES public.major_catalog(code),
  CONSTRAINT major_subject_groups_subject_group_code_fkey FOREIGN KEY (subject_group_code) REFERENCES public.subject_groups(code)
);
CREATE TABLE public.provinces (
  id integer NOT NULL DEFAULT nextval('provinces_id_seq'::regclass),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL UNIQUE,
  region character varying NOT NULL CHECK (region::text = ANY (ARRAY['Bắc'::character varying, 'Trung'::character varying, 'Nam'::character varying]::text[])),
  CONSTRAINT provinces_pkey PRIMARY KEY (id)
);
CREATE TABLE public.score (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT gen_random_uuid() UNIQUE,
  math real CHECK (math IS NULL OR math >= 0::double precision AND math <= 10::double precision),
  physics real CHECK (physics IS NULL OR physics >= 0::double precision AND physics <= 10::double precision),
  chemistry real CHECK (chemistry IS NULL OR chemistry >= 0::double precision AND chemistry <= 10::double precision),
  biology real CHECK (biology IS NULL OR biology >= 0::double precision AND biology <= 10::double precision),
  english real CHECK (english IS NULL OR english >= 0::double precision AND english <= 10::double precision),
  literature real CHECK (literature IS NULL OR literature >= 0::double precision AND literature <= 10::double precision),
  history real CHECK (history IS NULL OR history >= 0::double precision AND history <= 10::double precision),
  geography real CHECK (geography IS NULL OR geography >= 0::double precision AND geography <= 10::double precision),
  base_score numeric DEFAULT (((((((COALESCE(math, (0)::real) + COALESCE(physics, (0)::real)) + COALESCE(chemistry, (0)::real)) + COALESCE(biology, (0)::real)) + COALESCE(english, (0)::real)) + COALESCE(literature, (0)::real)) + COALESCE(history, (0)::real)) + COALESCE(geography, (0)::real)),
  CONSTRAINT score_pkey PRIMARY KEY (id),
  CONSTRAINT score_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT fk_score_user FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.subject_groups (
  code character varying NOT NULL,
  subject_1 character varying,
  subject_2 character varying,
  subject_3 character varying,
  display_name character varying,
  is_verified boolean NOT NULL DEFAULT false,
  CONSTRAINT subject_groups_pkey PRIMARY KEY (code)
);
CREATE TABLE public.universities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  code character varying UNIQUE,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['công_lập'::character varying::text, 'dân_lập'::character varying::text, 'quân_sự'::character varying::text, 'cao_đẳng'::character varying::text])),
  province_id integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  logo_url character varying,
  address text,
  website character varying,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT universities_pkey PRIMARY KEY (id),
  CONSTRAINT universities_province_id_fkey FOREIGN KEY (province_id) REFERENCES public.provinces(id)
);
CREATE TABLE public.university_program_subject_groups (
  university_program_id uuid NOT NULL,
  subject_group_code character varying NOT NULL,
  CONSTRAINT university_program_subject_groups_pkey PRIMARY KEY (university_program_id, subject_group_code),
  CONSTRAINT university_program_subject_groups_university_program_id_fkey FOREIGN KEY (university_program_id) REFERENCES public.university_programs(id),
  CONSTRAINT university_program_subject_groups_subject_group_code_fkey FOREIGN KEY (subject_group_code) REFERENCES public.subject_groups(code)
);
CREATE TABLE public.university_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  university_short_name character varying NOT NULL,
  major_code character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  program_source_code character varying NOT NULL,
  program_name text,
  source character varying NOT NULL DEFAULT 'tuyensinh247'::character varying,
  source_school_id integer,
  CONSTRAINT university_programs_pkey PRIMARY KEY (id),
  CONSTRAINT university_programs_university_short_name_fkey FOREIGN KEY (university_short_name) REFERENCES public.universities(code),
  CONSTRAINT university_programs_major_code_fkey FOREIGN KEY (major_code) REFERENCES public.major_catalog(code)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_name character varying NOT NULL UNIQUE,
  full_name text NOT NULL,
  grade smallint,
  dob date,
  gender character varying CHECK (gender::text = ANY (ARRAY['MALE'::character varying, 'FEMALE'::character varying]::text[])),
  gmail character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  score real,
  is_special boolean,
  special_score real CHECK (special_score IS NULL OR special_score >= 0::double precision AND special_score <= 10::double precision),
  is_admin boolean,
  special_subject character varying CHECK (special_subject IS NULL OR (special_subject::text = ANY (ARRAY['toan'::character varying, 'ly'::character varying, 'hoa'::character varying, 'sinh'::character varying, 'tin'::character varying, 'ngoai_ngu'::character varying, 'van'::character varying, 'su'::character varying, 'dia'::character varying]::text[]))),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);