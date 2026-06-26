export type Province = {
  id: number;
  code: string;
  name: string;
  region: string;
};

export type ApiUniversityRating = {
  rating_rank: number | null;
  final_rating_5: number | null;
  vnur_score_1: number | null;
  admission_score_1: number | null;
  rating_type: string | null;
  admission_source: string | null;
};

export type ApiVnurScores = {
  recognized_quality_score_100: number | null;
  teaching_score_100: number | null;
  publications_score_100: number | null;
  science_tech_innovation_score_100: number | null;
  learner_quality_score_100: number | null;
  facilities_score_100: number | null;
};

export type ApiAdmissionStats = {
  avg_thpt_score: number | null;
  top10_variant_avg_thpt_score: number | null;
  avg_admission_score_1: number | null;
  top10_admission_score_1: number | null;
};

export type ApiUniversity = {
  id: string;
  name: string;
  code: string;
  type: string | null;
  province_id: number | null;
  is_active: boolean;
  logo_url: string | null;
  address: string | null;
  website: string | null;
  description: string | null;
  provinces: Province | null;
  // Embed rating (xem PIPELINE.md). null khi truong khong co du lieu tuong ung.
  university_ratings?: ApiUniversityRating | null;
  vnur_universities?: ApiVnurScores | null;
  university_admission_score_stats?: ApiAdmissionStats | null;
};

export type ApiField = {
  id: number;
  code: string;
  description: string;
};

export type ApiMajorCatalog = {
  code: string;
  name: string;
  field_code: string;
  fields: ApiField | null;
  major_subject_groups?: Array<{
    subject_group_code: string;
  }>;
};

export type ApiMajorDetail = ApiMajorCatalog & {
  major_subject_groups: Array<{
    subject_group_code: string;
    subject_groups: {
      code: string;
      subject_1: string;
      subject_2: string;
      subject_3: string;
    } | null;
  }>;
};

export type ApiAdmissionMethod = {
  code: string;
  name: string;
};

export type ApiUniversityProgram = {
  id: string;
  university_short_name: string;
  major_code: string;
  is_active: boolean;
  program_name?: string | null;
  program_source_code?: string | null;
  universities: ApiUniversity | null;
  major_catalog: {
    code: string;
    name: string;
    field_code: string;
  } | null;
};

export type ApiAdmissionScore = {
  id: string;
  year: number;
  score: number | null;
  normalized_score: number | null;
  normalized_scale: number | null;
  note: string | null;
  variant_key: string | null;
  source_program_code: string | null;
  variant_label: string | null;
  gender: string | null;
  region_code: string | null;
  subject_group_code: string | null;
  admission_score_subject_groups?: { subject_group_code: string }[];
  admission_method_code: string;
  admission_methods: ApiAdmissionMethod | null;
  university_program_id: string;
  university_programs?: {
    id: string;
    university_short_name: string;
    major_code: string;
    universities: { id: string; name: string; code: string } | null;
    major_catalog: { code: string; name: string } | null;
  };
};

export type ApiUniversityDetail = {
  university: ApiUniversity;
  scores: ApiAdmissionScore[];
};

export type PaginatedResponse<T> = {
  count: number;
  page: number;
  page_size: number;
  results: T[];
};

export type ApiExamBlock = {
  code: string;
  name: string;
  subjects: string[];
};

export type ApiUserRanking = {
  rank: number;
  id: string;
  name: string;
  tier: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  score: number;
  avatar: string;
  topSubject: string;
  anonymous: boolean;
};

export type ApiProfile = {
  id: string;
  user_name: string;
  full_name: string;
  grade: number;
  dob: string;
  gender: string;
  gmail: string;
  math?: number;
  literature?: number;
  english?: number;
  physics?: number;
  chemistry?: number;
  biology?: number;
  history?: number;
  geography?: number;
  is_special?: boolean;
  special_subject?: 'toan' | 'ly' | 'hoa' | 'sinh' | 'tin' | 'ngoai_ngu' | 'van' | 'su' | 'dia';
  special_score?: number;
  base_score?: number;
};

export type ApiSchoolSubject = {
  code: string;
  name: string;
  curriculum_group: 'COMPULSORY' | 'ELECTIVE';
  assessment_type: 'NUMERIC' | 'PASS_FAIL';
  counts_as_core: boolean;
  is_active: boolean;
};

export type ApiSubjectResult = {
  subject_code: string;
  numeric_score: number | null;
  assessment_status: 'PASSED' | 'FAILED' | null;
  updated_at?: string;
};

export type ApiAcademicScore = {
  is_complete: boolean;
  score_80: number | null;
  numeric_average: number | null;
  numeric_count: number;
  passed_count: number;
  failed_count: number;
  missing_subject_codes: string[];
};

export type ApiSubjectProfile = {
  subjects: ApiSchoolSubject[];
  selected_elective_codes: string[];
  results: ApiSubjectResult[];
  academic_score: ApiAcademicScore;
};

export type ApiAward = {
  id: number;
  name: string;
  level: string;
};

export type ApiAchievement = {
  id: number;
  user_id: string;
  award_id: number;
  name?: string | null;
  prize?: 'Khuyen Khich' | 'Ba' | 'Nhi' | 'Nhat' | 'Khuyến Khích' | 'Nhì' | 'Nhất' | null;
  date?: string | null;
  is_verified?: boolean | null;
  awards?: ApiAward;
};

export type ApiCertificate = {
  id: number;
  user_id: string;
  name: string;
  score?: number | null;
  date?: string | null;
  is_verified?: boolean | null;
};

export type ApiMajorTrend = {
  name: string;
  scores: number[];
  color: string;
};

export type ApiMajorRecommendation = {
  id: string;
  code: string;
  name: string;
  group: string;
  block: string;
  blocks: string[];
  score_2025: number | null;
  match_score: number;
  university_name: string | null;
};

export type ApiMajorOverview = {
  id: string;
  code: string;
  name: string;
  group: string;
  program_name?: string;
  blocks: string[];
  university_short_name: string;
  university_name?: string;
  scores: { [year: string]: number };
  score_30?: number | null;
  score_40?: number | null;
};

// UI-adapted types used by pages
export type UiUniversity = {
  id: string;         // backend code e.g. "HUST"
  name: string;
  abbr: string;       // same as code
  color: string;      // deterministic from code
  city: string;
  region: string;
  address: string;
  website: string;
  ranking: number;    // rating_rank tu Supabase (999 neu chua xep hang)
  avgAdmScore: number;
  userRating: number;
  ratingCount: number;
  overallScore: number;
  established: number;
  radarScores: { criteria: string; score: number }[];   // 6 truc gop (trang chi tiet)
  criteriaScores: { criteria: string; score: number }[]; // 8 truc goc (trang so sanh)
};

export type UiMajor = {
  id: string;         // major catalog code
  name: string;
  code: string;
  group: string;
  block: string;
  blocks: string[];
  universityShortName: string;
  universityName?: string;
  score30?: number | null;
  score40?: number | null;
  method: string;
  universityId: string;
  scores: { [year: string]: number };
  trend: 'up' | 'down' | 'stable';
  quota: number;
  description: string;
};
