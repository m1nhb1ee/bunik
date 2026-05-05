import type {
  ApiUniversity,
  ApiMajorCatalog,
  ApiMajorDetail,
  ApiUniversityProgram,
  ApiAdmissionScore,
  ApiExamBlock,
  ApiReview,
  ApiUserRanking,
  ApiMajorTrend,
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
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
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

export async function getUniversityReviews(universityCode: string): Promise<PaginatedResponse<ApiReview>> {
  return get(`/universities/${universityCode}/reviews/`);
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
  { criteria: 'Cơ sở vật chất', score: 75 },
  { criteria: 'Nghiên cứu KH', score: 75 },
  { criteria: 'Chất lượng đào tạo', score: 75 },
  { criteria: 'Chất lượng SV', score: 75 },
  { criteria: 'Điểm đầu ra', score: 75 },
  { criteria: 'Điểm đầu vào', score: 75 },
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
    region: api.provinces?.region ?? 'Miền Bắc',
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
  return {
    id: api.code,
    name: api.name,
    code: api.code,
    group: api.fields?.description ?? api.field_code,
    block: '—',
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
  const first = await getMajors({ page_size: 100 });
  const total = first.count;
  let results = first.results;
  if (total > 100) {
    const pages = Math.ceil(total / 100);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => getMajors({ page_size: 100, page: i + 2 })),
    );
    for (const r of rest) results = results.concat(r.results);
  }
  return results.map(toUiMajor);
}
