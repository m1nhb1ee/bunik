import {
  admissionMethods,
  fields,
  majors,
  programs,
  provinces,
  scores,
  subjectGroups,
  universities
} from '../mockData';
import type {
  AdmissionMethod,
  AdmissionScore,
  Field,
  MajorCatalog,
  Province,
  SubjectGroup,
  University,
  UniversityProgram
} from '../types';

const NETWORK_DELAY = 220;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BootstrapPayload {
  provinces: Province[];
  universities: University[];
  fields: Field[];
  subjectGroups: SubjectGroup[];
  majors: MajorCatalog[];
  admissionMethods: AdmissionMethod[];
  programs: UniversityProgram[];
  scores: AdmissionScore[];
}

export interface PaginationMeta {
  count: number;
  page: number;
  pageSize: number;
}

export interface Paginated<T> extends PaginationMeta {
  results: T[];
}

export interface UniversityQuery {
  search?: string;
  type?: University['type'];
  province?: number;
  region?: Province['region'];
  page?: number;
  pageSize?: number;
}

export async function getBootstrapData(): Promise<BootstrapPayload> {
  await wait(NETWORK_DELAY);
  return {
    provinces,
    universities,
    fields,
    subjectGroups,
    majors,
    admissionMethods,
    programs,
    scores
  };
}

export async function listUniversities(query: UniversityQuery = {}): Promise<Paginated<University>> {
  await wait(NETWORK_DELAY);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const search = query.search?.trim().toLowerCase() ?? '';

  const regionProvinceIds = query.region
    ? new Set(provinces.filter((item) => item.region === query.region).map((item) => item.id))
    : null;

  const filtered = universities.filter((item) => {
    if (!item.is_active) return false;
    if (query.type && item.type !== query.type) return false;
    if (query.province && item.province !== query.province) return false;
    if (regionProvinceIds && !regionProvinceIds.has(item.province)) return false;
    if (!search) return true;
    return item.name.toLowerCase().includes(search) || item.short_name.toLowerCase().includes(search);
  });

  const start = (page - 1) * pageSize;
  return {
    count: filtered.length,
    page,
    pageSize,
    results: filtered.slice(start, start + pageSize)
  };
}
