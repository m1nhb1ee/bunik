import type {
  ApiUniversity,
  ApiMajorCatalog,
  ApiMajorDetail,
  ApiUniversityProgram,
  ApiAdmissionScore,
  ApiExamBlock,
  ApiUserRanking,
  ApiMajorTrend,
  ApiMajorRecommendation,
  ApiMajorOverview,
  ApiProfile,
  ApiAward,
  ApiAchievement,
  ApiCertificate,
  PaginatedResponse,
  UiUniversity,
  UiMajor,
} from '../types/api';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function get<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  token?: string,
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message ?? data?.detail ?? `API ${res.status}: ${path}`;
    throw new Error(message);
  }
  return data;
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message ?? data?.detail ?? `API ${res.status}: ${path}`;
    throw new Error(message);
  }
  return data;
}

async function patch<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message ?? data?.detail ?? `API ${res.status}: ${path}`;
    throw new Error(message);
  }
  return data;
}

async function del<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message ?? data?.detail ?? `API ${res.status}: ${path}`;
    throw new Error(message);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Auth functions
// ---------------------------------------------------------------------------

export type RegisterPayload = {
  user_name: string;
  full_name: string;
  grade: number;
  dob: string;
  gender: 'MALE' | 'FEMALE';
  gmail: string;
  password: string;
};

export type LoginPayload = {
  gmail: string;
  password: string;
};

export type AuthUser = {
  id: string;
  user_name: string;
  full_name: string;
  grade: number;
  dob: string;
  gender: string;
  gmail: string;
};

export type AuthResponse = {
  message: string;
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
};

export type ProfileUpdatePayload = {
  user_name?: string;
  full_name?: string;
  grade?: number;
  dob?: string;
  gender?: 'MALE' | 'FEMALE';
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

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  return post('/auth/register/', payload);
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return post('/auth/login/', payload);
}

export async function getMyProfile(token: string): Promise<{ user: ApiProfile }> {
  return get('/auth/me/', {}, token);
}

export async function updateMyProfile(token: string, payload: ProfileUpdatePayload): Promise<{ message: string; user: ApiProfile }> {
  return patch('/auth/me/', payload, token);
}

export async function getAwardsCatalog(token?: string): Promise<{ results: ApiAward[] }> {
  return get('/awards/', {}, token);
}

export async function getMyAchievements(token: string): Promise<{ results: ApiAchievement[] }> {
  return get('/auth/me/achievements/', {}, token);
}

export async function addMyAchievement(
  token: string,
  payload: { award_id: number; prize?: 'Khuyen Khich' | 'Ba' | 'Nhi' | 'Nhat' | null; date?: string },
): Promise<{ message: string; achievement: ApiAchievement }> {
  return post('/auth/me/achievements/', payload, token);
}

export async function deleteMyAchievement(token: string, achievementId: number): Promise<{ message: string }> {
  return del(`/auth/me/achievements/${achievementId}/`, token);
}

export async function getMyCertificates(token: string): Promise<{ results: ApiCertificate[] }> {
  return get('/auth/me/certificates/', {}, token);
}

// ---------------------------------------------------------------------------
// API fetch functions
// ---------------------------------------------------------------------------

export async function getUniversities(params: {
  search?: string;
  type?: string;
  province?: number;
  is_active?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<ApiUniversity>> {
  return get('/universities/', params);
}

export async function getMajors(params: {
  search?: string;
  field?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<ApiMajorCatalog>> {
  return get('/majors/', params);
}

export async function getMajorDetail(code: string): Promise<ApiMajorDetail> {
  return get(`/majors/${code}/`);
}

export async function getUniversityPrograms(params: {
  university_code?: string;
  major_code?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<ApiUniversityProgram>> {
  return get('/programs/', params);
}

export async function getAdmissionScores(params: {
  university_code?: string;
  major_code?: string;
  admission_method?: string;
  year?: number;
  year_min?: number;
  year_max?: number;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<ApiAdmissionScore>> {
  return get('/scores/', params);
}

export async function getProgramScores(programId: number): Promise<PaginatedResponse<ApiAdmissionScore>> {
  return get(`/programs/${programId}/scores/`);
}

export async function getExamBlocks(): Promise<PaginatedResponse<ApiExamBlock>> {
  return get('/exam-blocks/');
}

export async function getRankings(params: {
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<ApiUserRanking>> {
  return get('/rankings/', params);
}

export async function getMajorTrends(): Promise<PaginatedResponse<ApiMajorTrend>> {
  return get('/major-trends/');
}

export async function getMajorRecommendations(params: {
  interests?: string;
  block?: string;
  score_min?: number;
  score_max?: number;
  is_chuyen_class?: boolean;
  limit?: number;
} = {}): Promise<ApiMajorRecommendation[]> {
  return get('/majors/recommendations/', params);
}

export async function getMajorOverview(): Promise<PaginatedResponse<ApiMajorOverview>> {
  return get('/majors/overview/');
}

// ---------------------------------------------------------------------------
// UI adapter helpers
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  '#E53E3E', '#2B6CB0', '#276749', '#744210', '#553C9A',
  '#065666', '#1A365D', '#7B341E', '#285E61', '#44337A',
  '#D44000', '#4A235A', '#1B4F72', '#145A32', '#6E2F1A',
  '#1A5276', '#512E5F', '#0E6655', '#922B21', '#1F618D',
];

const DEFAULT_RADAR = [
  { criteria: 'Co so vat chat', score: 75 },
  { criteria: 'Nghien cuu KH', score: 75 },
  { criteria: 'Chat luong dao tao', score: 75 },
  { criteria: 'Chat luong SV', score: 75 },
  { criteria: 'Diem dau ra', score: 75 },
  { criteria: 'Diem dau vao', score: 75 },
];

export function codeToColor(code: string): string {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return COLOR_PALETTE[h % COLOR_PALETTE.length];
}

export function toUiUniversity(api: ApiUniversity, index: number): UiUniversity {
  return {
    id: api.code,
    name: api.name,
    abbr: api.code,
    color: codeToColor(api.code),
    city: api.provinces?.name ?? '',
    region: api.provinces?.region ?? 'Mien Bac',
    address: api.address ?? '',
    website: api.website ?? '',
    ranking: index + 1,
    avgAdmScore: 0,
    socialScore: 0,
    userRating: 0,
    ratingCount: 0,
    overallScore: 0,
    established: 0,
    radarScores: DEFAULT_RADAR,
  };
}

export function toUiMajor(api: ApiMajorCatalog): UiMajor {
  const blocks = (api.major_subject_groups ?? [])
    .map((item) => item.subject_group_code)
    .filter(Boolean);
  return {
    id: api.code,
    name: api.name,
    code: api.code,
    group: api.fields?.description ?? api.field_code,
    block: blocks[0] ?? '-',
    blocks,
    universityShortName: '',
    universityName: '',
    score30: null,
    score40: null,
    method: 'THPT',
    universityId: '',
    scores: {},
    trend: 'stable',
    quota: 0,
    description: '',
  };
}

// ---------------------------------------------------------------------------
// Composite fetches used by pages
// ---------------------------------------------------------------------------

export async function getAllUniversities(): Promise<UiUniversity[]> {
  const first = await getUniversities({ page_size: 100, ordering: 'name' });
  const total = first.count;
  let results = first.results;
  if (total > 100) {
    const pages = Math.ceil(total / 100);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        getUniversities({ page_size: 100, page: i + 2, ordering: 'name' }),
      ),
    );
    for (const r of rest) results = results.concat(r.results);
  }
  return results.map(toUiUniversity);
}

export async function getAllMajors(): Promise<UiMajor[]> {
  const overview = await getMajorOverview();
  return overview.results.map((major) => ({
    id: major.id,
    name: major.program_name || major.name,
    code: major.code,
    group: major.group,
    block: major.blocks[0] ?? '-',
    blocks: major.blocks,
    universityShortName: major.university_short_name,
    universityName: major.university_name || '',
    score30: major.score_30 ?? null,
    score40: major.score_40 ?? null,
    method: 'THPT',
    universityId: major.university_short_name,
    scores: major.scores,
    trend: 'stable',
    quota: 0,
    description: '',
  }));
}



