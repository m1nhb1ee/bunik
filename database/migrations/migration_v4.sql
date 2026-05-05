-- ============================================================
-- Bunik Database v4.0 — Migration Script
-- Supabase / PostgreSQL
-- Thứ tự: tuân thủ FK dependencies
-- ============================================================

-- ── 1. PROVINCES ──────────────────────────────────────────
CREATE TABLE provinces (
    id     SERIAL PRIMARY KEY,
    code   VARCHAR(10)  NOT NULL UNIQUE,
    name   VARCHAR(100) NOT NULL UNIQUE,
    region VARCHAR(20)  NOT NULL CHECK (region IN ('Bắc', 'Trung', 'Nam'))
);

-- ── 2. FIELDS ─────────────────────────────────────────────
CREATE TABLE fields (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(10) NOT NULL UNIQUE,
    description TEXT
);

-- ── 3. SUBJECT_GROUPS ─────────────────────────────────────
CREATE TABLE subject_groups (
    code      VARCHAR(10) NOT NULL PRIMARY KEY,
    subject_1 VARCHAR(30) NOT NULL,
    subject_2 VARCHAR(30) NOT NULL,
    subject_3 VARCHAR(30) NOT NULL
);

-- ── 4. ADMISSION_METHODS ──────────────────────────────────
CREATE TABLE admission_methods (
    code        VARCHAR(20)  NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT
);

-- ── 5. UNIVERSITIES ───────────────────────────────────────
CREATE TABLE universities (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(50)  UNIQUE,
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('công_lập', 'dân_lập', 'quân_sự', 'cao_đẳng')),
    province_id INT          NOT NULL REFERENCES provinces(id),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    logo_url    VARCHAR(500),
    address     TEXT,
    website     VARCHAR(255),
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_universities_province  ON universities (province_id);
CREATE INDEX idx_universities_type      ON universities (type);
CREATE INDEX idx_universities_type_prov ON universities (type, province_id);

-- ── 6. MAJOR_CATALOG ──────────────────────────────────────
CREATE TABLE major_catalog (
    code        VARCHAR(20)  NOT NULL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    field_code  VARCHAR(10)  NOT NULL REFERENCES fields(code),
    description TEXT
);

CREATE INDEX idx_major_catalog_field ON major_catalog (field_code);

-- ── 7. MAJOR_SUBJECT_GROUPS ───────────────────────────────
CREATE TABLE major_subject_groups (
    major_code         VARCHAR(20) NOT NULL REFERENCES major_catalog(code),
    subject_group_code VARCHAR(20) NOT NULL REFERENCES subject_groups(code),
    PRIMARY KEY (major_code, subject_group_code)
);

-- ── 8. UNIVERSITY_PROGRAMS ────────────────────────────────
CREATE TABLE university_programs (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    university_short_name VARCHAR(50) NOT NULL REFERENCES universities(code),
    major_code            VARCHAR(20) NOT NULL REFERENCES major_catalog(code),
    is_active             BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_univ_prog_major  ON university_programs (major_code);
CREATE INDEX idx_univ_prog_active ON university_programs (university_short_name, is_active);

-- ── 9. ADMISSION_SCORES ───────────────────────────────────
CREATE TABLE admission_scores (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    university_program_id UUID         NOT NULL REFERENCES university_programs(id),
    admission_method_code VARCHAR(20)  NOT NULL REFERENCES admission_methods(code),
    year                  SMALLINT     NOT NULL CHECK (year >= 2000 AND year <= 2100),
    score                 DECIMAL(6,2) NOT NULL CHECK (score >= 0),
    note                  TEXT,
    UNIQUE (university_program_id, admission_method_code, year)
);

CREATE INDEX idx_scores_year      ON admission_scores (year DESC);
CREATE INDEX idx_scores_prog_year ON admission_scores (university_program_id, year DESC);

-- ============================================================
-- TRIGGER: auto-update updated_at khi UPDATE universities
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_universities_updated_at
BEFORE UPDATE ON universities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MATERIALIZED VIEW 1: v_admission_overview
-- ============================================================
CREATE MATERIALIZED VIEW v_admission_overview AS
SELECT
    u.id                  AS university_id,
    u.name                AS university_name,
    u.code                AS university_code,
    u.type                AS university_type,
    p.name                AS province,
    p.region,
    up.id                 AS university_program_id,
    up.major_code,
    mc.name               AS major_name,
    f.description         AS field_description,
    s.year,
    s.score,
    s.admission_method_code,
    am.name               AS admission_method,
    s.note
FROM admission_scores s
JOIN university_programs up ON up.id          = s.university_program_id
JOIN universities u         ON u.code         = up.university_short_name
JOIN provinces p            ON p.id           = u.province_id
JOIN major_catalog mc       ON mc.code        = up.major_code
JOIN fields f               ON f.code         = mc.field_code
JOIN admission_methods am   ON am.code        = s.admission_method_code
WHERE up.is_active = TRUE
  AND u.is_active  = TRUE;

CREATE UNIQUE INDEX ON v_admission_overview (university_program_id, admission_method_code, year);
CREATE INDEX ON v_admission_overview (year DESC, score DESC);
CREATE INDEX ON v_admission_overview (province, university_type);

-- ============================================================
-- MATERIALIZED VIEW 2: v_university_stats
-- ============================================================
CREATE MATERIALIZED VIEW v_university_stats AS
WITH latest_year AS (
    SELECT MAX(year) AS yr FROM admission_scores
)
SELECT
    u.id,
    u.name,
    u.code,
    u.type,
    p.name   AS province,
    p.region,
    COUNT(DISTINCT up.major_code) AS total_majors,
    COUNT(DISTINCT up.id)         AS total_programs,
    ROUND(AVG(s.score), 2)        AS avg_score,
    MIN(s.score)                  AS min_score,
    MAX(s.score)                  AS max_score
FROM universities u
JOIN provinces p                 ON p.id                 = u.province_id
LEFT JOIN university_programs up ON up.university_short_name = u.code AND up.is_active = TRUE
LEFT JOIN admission_scores s     ON s.university_program_id  = up.id
                                AND s.year = (SELECT yr FROM latest_year)
WHERE u.is_active = TRUE
GROUP BY u.id, u.name, u.code, u.type, p.name, p.region;

-- ============================================================
-- Refresh views (chạy sau khi import data xong)
-- ============================================================
-- REFRESH MATERIALIZED VIEW CONCURRENTLY v_admission_overview;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY v_university_stats;
