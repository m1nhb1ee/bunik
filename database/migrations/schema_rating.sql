-- ============================================================================
-- Rating subsystem schema (Bunik) — 3 bảng, bản tối giản.
-- Pipeline: [2] VNUR rerank+score -> [3] điểm chuẩn -> [4] rating. Xem PIPELINE.md.
-- ============================================================================

-- Bảng 1 — VNUR: rerank + 6 tiêu chí thang 100 (gộp rerank & score).
-- Đủ 86 trường Supabase; trường không có dữ liệu VNUR (imputed/quân đội/no-data) để NULL.
-- institution = tên trường VNUR nguồn, KHÔNG unique: 9 mã cluster ĐHQGHN chung 1 nguồn.
CREATE TABLE public.vnur_universities (
  university_code                   varchar PRIMARY KEY REFERENCES public.universities(code),
  institution                       varchar NOT NULL,    -- khớp VNUR: tên nguồn VNUR; không khớp: tên Supabase
  rerank_rank                       integer,
  method_group                      varchar
    CHECK (method_group IN ('current_top_100', 'outside_current_top_100_latest_prior_year')),
  source_year                       smallint,            -- năm dữ liệu dùng để xếp
  rerank_score_100                  numeric,             -- điểm rerank thang 100
  recognized_quality_score_100      numeric,             -- Chất lượng được công nhận
  teaching_score_100                numeric,             -- Dạy học
  publications_score_100            numeric,             -- Công bố khoa học
  science_tech_innovation_score_100 numeric,             -- Nhiệm vụ KHCN & sáng chế
  learner_quality_score_100         numeric,             -- Chất lượng người học
  facilities_score_100              numeric,             -- Cơ sở vật chất
  avg_6criteria_score_100           numeric              -- TB 6 tiêu chí
);

-- Bảng 2 — Điểm chuẩn TB + top10 (thang 30) và bản chuẩn hóa /30 (tự sinh).
CREATE TABLE public.university_admission_score_stats (
  university_code               varchar PRIMARY KEY REFERENCES public.universities(code),
  latest_year                   smallint NOT NULL,
  avg_thpt_score                numeric NOT NULL,        -- thang 30
  top10_variant_avg_thpt_score  numeric NOT NULL,        -- thang 30
  avg_admission_score_1   numeric GENERATED ALWAYS AS (LEAST(GREATEST(avg_thpt_score/30,0),1)) STORED,
  top10_admission_score_1 numeric GENERATED ALWAYS AS (LEAST(GREATEST(top10_variant_avg_thpt_score/30,0),1)) STORED
);

-- Bảng 3 — Rating cuối: thứ hạng + điểm 5.0 + 2 nhóm điểm + note.
-- Chi tiết 6 tiêu chí join bảng 1; điểm chuẩn thô join bảng 2.
CREATE TABLE public.university_ratings (
  university_code     varchar PRIMARY KEY REFERENCES public.universities(code),
  rating_rank         integer NOT NULL UNIQUE,           -- 1 = cao nhất
  final_rating_5      numeric NOT NULL CHECK (final_rating_5 BETWEEN 0 AND 5),
  vnur_score_1        numeric NOT NULL,                  -- nhóm VNUR 0..1
  admission_score_1   numeric NOT NULL,                  -- nhóm điểm chuẩn 0..1
  rating_type         varchar NOT NULL CHECK (rating_type IN ('full', 'vnur_imputed', 'military_neutral')),
  admission_source    varchar CHECK (admission_source IN ('THPT', 'HBA')),
  notes               text                               -- match_status, trường VNUR nguồn, ghi chú
);
