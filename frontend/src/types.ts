export type Region = 'Bắc' | 'Trung' | 'Nam';
export type UniversityType = 'công_lập' | 'dân_lập' | 'quân_sự';

export interface Province {
  id: number;
  name: string;
  region: Region;
}

export interface University {
  id: string;
  name: string;
  short_name: string;
  type: UniversityType;
  province: number;
  is_active: boolean;
  website?: string | null;
  description?: string | null;
}

export interface Field {
  id: number;
  code: string;
  name: string;
}

export interface SubjectGroup {
  id: number;
  code: string;
  subjects: string;
}

export interface MajorCatalog {
  id: number;
  code: string;
  name: string;
  field: number;
  description?: string | null;
  subject_group_ids: number[];
}

export interface AdmissionMethod {
  id: number;
  code: string;
  name: string;
}

export interface UniversityProgram {
  id: string;
  university: string;
  major_catalog: number;
  internal_code?: string | null;
  internal_name?: string | null;
}

export interface AdmissionScore {
  id: string;
  university_program: string;
  admission_method: number;
  year: number;
  score: number;
  quota?: number | null;
  note?: string | null;
}
