import type {
  ApiUniversity,
  ApiUniversityDetail,
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
  ApiSubjectProfile,
  ApiAward,
  ApiAchievement,
  ApiCertificate,
  PaginatedResponse,
  UiUniversity,
  UiMajor,
} from '../types/api';

const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');

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

export async function getMySubjectProfile(token: string): Promise<ApiSubjectProfile> {
  return get('/auth/me/subjects/', {}, token);
}

export async function updateMySubjectProfile(
  token: string,
  payload: {
    elective_codes: string[];
    results: Array<{
      subject_code: string;
      numeric_score?: number | null;
      assessment_status?: 'PASSED' | 'FAILED' | null;
    }>;
  },
): Promise<ApiSubjectProfile> {
  return patch('/auth/me/subjects/', payload, token);
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

export async function getUniversityDetailByCode(code: string): Promise<ApiUniversityDetail> {
  return get(`/universities/by-code/${encodeURIComponent(code)}/detail/`);
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

export async function getProgramDetail(programId: string): Promise<ApiUniversityProgram> {
  return get(`/programs/${programId}/`);
}

export async function getUniversityPrograms(params: {
  university_code?: string;
  major_code?: string;
  major_name?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<ApiUniversityProgram>> {
  return get('/programs/', params);
}

export async function getAdmissionScores(params: {
  university_code?: string;
  major_code?: string;
  program_ids?: string;
  admission_method?: string;
  year?: number;
  year_min?: number;
  year_max?: number;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<ApiAdmissionScore>> {
  return get('/scores/', params);
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
    region: api.provinces?.region ?? '',
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

export function normalizeVietnamese(value: string | null | undefined): string {
  return (value || "")
    .replace(/[\u0111\u0110\u00D0]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeScoreTo30(score: number, note: string | null): number {
  const normalizedNote = normalizeVietnamese(note);
  const isScale40 =
    normalizedNote.includes("thang diem 40") ||
    normalizedNote.includes("thang 40") ||
    normalizedNote.includes("40 diem");
  return isScale40 ? +((score * 30) / 40).toFixed(2) : score;
}

/**
 * Normalize an admission score to the 30-point scale for charting.
 * Mirrors the backend `_normalized_thpt_score`: prefer an explicit
 * normalized_score, then the note-based scale-40 flag, then — for THPT only —
 * fall back to treating any score above 30 as a 40-point scale (some sources,
 * e.g. combos with a doubled subject, omit the scale note entirely). Other
 * methods (ĐGNL, ĐGTD, …) keep their own larger scales untouched.
 */
export function normalizeAdmissionScore(item: ApiAdmissionScore): number {
  if (item.normalized_score != null) return item.normalized_score;
  const score = item.score ?? 0;
  const scaled = normalizeScoreTo30(score, item.note);
  if (item.admission_method_code === "THPT" && scaled > 30) {
    return +((scaled * 30) / 40).toFixed(2);
  }
  return scaled;
}

export async function fetchAllPaginated<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<T>>,
  pageSize = 100,
): Promise<T[]> {
  const firstPage = await fetchPage(1, pageSize);
  let results = firstPage.results;
  const actualPageSize = firstPage.page_size || pageSize;
  const totalPages = Math.max(1, Math.ceil((firstPage.count || 0) / actualPageSize));

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchPage(page, pageSize);
    results = results.concat(nextPage.results);
  }

  return results;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function getAllUniversityPrograms(params: { major_code?: string; major_name?: string; university_code?: string }): Promise<ApiUniversityProgram[]> {
  return fetchAllPaginated((page, page_size) => getUniversityPrograms({ ...params, page, page_size }));
}

export async function getAllAdmissionScores(params: Parameters<typeof getAdmissionScores>[0]): Promise<ApiAdmissionScore[]> {
  return fetchAllPaginated((page, page_size) => getAdmissionScores({ ...params, page, page_size }));
}

export async function getAllAdmissionScoresByProgramIds(programIds: string[]): Promise<ApiAdmissionScore[]> {
  const batches = chunkArray(programIds, 50);
  let results: ApiAdmissionScore[] = [];

  for (const batch of batches) {
    const program_ids = batch.join(",");
    const batchScores = await getAllAdmissionScores({ program_ids });
    results = results.concat(batchScores);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Composite fetches used by pages
// ---------------------------------------------------------------------------

export async function getAllUniversities(): Promise<UiUniversity[]> {
  const results = await fetchAllPaginated((page, page_size) => getUniversities({ page, page_size, ordering: 'name' }));
  return results.map(toUiUniversity);
}

export async function getAllMajors(): Promise<UiMajor[]> {
  const overview = await getMajorOverview();
  return overview.results.map((major) => ({
    id: String(major.id),
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
