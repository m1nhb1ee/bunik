export type Province = {
  id: number;
  code: string;
  name: string;
  region: string;
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
  note: string | null;
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
  ranking: number;    // position in list
  avgAdmScore: number;
  socialScore: number;
  userRating: number;
  ratingCount: number;
  overallScore: number;
  established: number;
  radarScores: { criteria: string; score: number }[];
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
