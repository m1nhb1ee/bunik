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
  id: number;
  university_short_name: string;
  major_code: string;
  is_active: boolean;
  universities: ApiUniversity | null;
  major_catalog: {
    code: string;
    name: string;
    field_code: string;
  } | null;
};

export type ApiAdmissionScore = {
  id: number;
  year: number;
  score: number | null;
  note: string | null;
  admission_method_code: string;
  admission_methods: ApiAdmissionMethod | null;
  university_program_id: number;
  university_programs?: {
    id: number;
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

export type ApiReview = {
  id: number;
  author: string;
  avatar: string;
  rating: number;
  content: string;
  date: string;
  category: string;
};

export type ApiUserRanking = {
  rank: number;
  id: number;
  name: string;
  tier: 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
  score: number;
  avatar: string;
  topSubject: string;
  anonymous: boolean;
};

export type ApiMajorTrend = {
  name: string;
  scores: number[];
  color: string;
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
  method: string;
  universityId: string;
  scores: { [year: string]: number };
  trend: 'up' | 'down' | 'stable';
  quota: number;
  description: string;
};
