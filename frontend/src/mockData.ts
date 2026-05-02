import type {
  AdmissionMethod,
  AdmissionScore,
  Field,
  MajorCatalog,
  Province,
  SubjectGroup,
  University,
  UniversityProgram
} from './types';

export const provinces: Province[] = [
  { id: 1, name: 'Hà Nội', region: 'Bắc' },
  { id: 2, name: 'Hải Phòng', region: 'Bắc' },
  { id: 3, name: 'Đà Nẵng', region: 'Trung' },
  { id: 4, name: 'TP. Hồ Chí Minh', region: 'Nam' }
];

export const universities: University[] = [
  {
    id: 'u-hust',
    name: 'Đại học Bách khoa Hà Nội',
    short_name: 'HUST',
    type: 'công_lập',
    province: 1,
    is_active: true,
    website: 'https://hust.edu.vn',
    description: 'Định hướng kỹ thuật và công nghệ.'
  },
  {
    id: 'u-vnu',
    name: 'Đại học Quốc gia Hà Nội',
    short_name: 'VNU',
    type: 'công_lập',
    province: 1,
    is_active: true
  },
  {
    id: 'u-ptit',
    name: 'Học viện Công nghệ Bưu chính Viễn thông',
    short_name: 'PTIT',
    type: 'công_lập',
    province: 1,
    is_active: true
  },
  {
    id: 'u-tmu',
    name: 'Đại học Thương mại',
    short_name: 'TMU',
    type: 'công_lập',
    province: 1,
    is_active: true
  },
  {
    id: 'u-neu',
    name: 'Đại học Kinh tế Quốc dân',
    short_name: 'NEU',
    type: 'công_lập',
    province: 1,
    is_active: true
  },
  {
    id: 'u-hanu',
    name: 'Đại học Hà Nội',
    short_name: 'HANU',
    type: 'công_lập',
    province: 1,
    is_active: true
  },
  {
    id: 'u-fpt',
    name: 'Đại học FPT',
    short_name: 'FPTU',
    type: 'dân_lập',
    province: 1,
    is_active: true
  },
  {
    id: 'u-mta',
    name: 'Học viện Kỹ thuật Quân sự',
    short_name: 'MTA',
    type: 'quân_sự',
    province: 1,
    is_active: true
  }
];

export const fields: Field[] = [
  { id: 1, code: 'IT', name: 'Công nghệ thông tin' },
  { id: 2, code: 'BUS', name: 'Kinh tế - Quản trị' },
  { id: 3, code: 'LANG', name: 'Ngôn ngữ' },
  { id: 4, code: 'AUTO', name: 'Điện - Tự động hóa' }
];

export const subjectGroups: SubjectGroup[] = [
  { id: 1, code: 'A00', subjects: 'Toán, Lý, Hóa' },
  { id: 2, code: 'A01', subjects: 'Toán, Lý, Anh' },
  { id: 3, code: 'D01', subjects: 'Toán, Văn, Anh' },
  { id: 4, code: 'D07', subjects: 'Toán, Hóa, Anh' }
];

export const majors: MajorCatalog[] = [
  { id: 1, code: 'IT001', name: 'Khoa học máy tính', field: 1, subject_group_ids: [1, 2] },
  { id: 2, code: 'IT002', name: 'Kỹ thuật phần mềm', field: 1, subject_group_ids: [1, 2] },
  { id: 3, code: 'IT003', name: 'An toàn thông tin', field: 1, subject_group_ids: [1, 2] },
  { id: 4, code: 'BUS001', name: 'Thương mại điện tử', field: 2, subject_group_ids: [1, 3] },
  { id: 5, code: 'BUS002', name: 'Marketing', field: 2, subject_group_ids: [3] },
  { id: 6, code: 'LANG001', name: 'Ngôn ngữ Anh', field: 3, subject_group_ids: [3] },
  { id: 7, code: 'AUTO001', name: 'Điều khiển tự động', field: 4, subject_group_ids: [1, 2, 4] },
  { id: 8, code: 'AUTO002', name: 'Robot và hệ thống thông minh', field: 4, subject_group_ids: [1, 2] }
];

export const admissionMethods: AdmissionMethod[] = [
  { id: 1, code: 'THPT', name: 'Xét điểm THPT' },
  { id: 2, code: 'DGNL', name: 'Đánh giá năng lực' },
  { id: 3, code: 'XTT', name: 'Xét tuyển tài năng' }
];

export const programs: UniversityProgram[] = [
  { id: 'p1', university: 'u-hust', major_catalog: 1, internal_code: 'HUST-CS' },
  { id: 'p2', university: 'u-hust', major_catalog: 2, internal_code: 'HUST-SE' },
  { id: 'p3', university: 'u-vnu', major_catalog: 1, internal_code: 'VNU-CS' },
  { id: 'p4', university: 'u-ptit', major_catalog: 3, internal_code: 'PTIT-ATTT' },
  { id: 'p5', university: 'u-neu', major_catalog: 4, internal_code: 'NEU-ECOM' },
  { id: 'p6', university: 'u-tmu', major_catalog: 5, internal_code: 'TMU-MKT' },
  { id: 'p7', university: 'u-hanu', major_catalog: 6, internal_code: 'HANU-ENG' },
  { id: 'p8', university: 'u-mta', major_catalog: 7, internal_code: 'MTA-AUTO' },
  { id: 'p9', university: 'u-fpt', major_catalog: 2, internal_code: 'FPT-SE' },
  { id: 'p10', university: 'u-hust', major_catalog: 8, internal_code: 'HUST-ROBO' }
];

export const scores: AdmissionScore[] = [
  { id: 's1', university_program: 'p1', admission_method: 1, year: 2023, score: 28.9, quota: 320 },
  { id: 's2', university_program: 'p1', admission_method: 1, year: 2024, score: 29.1, quota: 330 },
  { id: 's3', university_program: 'p1', admission_method: 1, year: 2025, score: 29.4, quota: 340 },
  { id: 's4', university_program: 'p2', admission_method: 1, year: 2023, score: 27.6, quota: 280 },
  { id: 's5', university_program: 'p2', admission_method: 1, year: 2024, score: 28.0, quota: 300 },
  { id: 's6', university_program: 'p2', admission_method: 1, year: 2025, score: 28.3, quota: 300 },
  { id: 's7', university_program: 'p3', admission_method: 1, year: 2023, score: 28.1, quota: 300 },
  { id: 's8', university_program: 'p3', admission_method: 1, year: 2024, score: 28.4, quota: 300 },
  { id: 's9', university_program: 'p3', admission_method: 1, year: 2025, score: 28.7, quota: 310 },
  { id: 's10', university_program: 'p4', admission_method: 1, year: 2023, score: 26.8, quota: 220 },
  { id: 's11', university_program: 'p4', admission_method: 1, year: 2024, score: 27.2, quota: 240 },
  { id: 's12', university_program: 'p4', admission_method: 1, year: 2025, score: 27.5, quota: 250 },
  { id: 's13', university_program: 'p5', admission_method: 1, year: 2023, score: 27.0, quota: 250 },
  { id: 's14', university_program: 'p5', admission_method: 1, year: 2024, score: 27.3, quota: 260 },
  { id: 's15', university_program: 'p5', admission_method: 1, year: 2025, score: 27.8, quota: 270 },
  { id: 's16', university_program: 'p6', admission_method: 1, year: 2023, score: 26.2, quota: 200 },
  { id: 's17', university_program: 'p6', admission_method: 1, year: 2024, score: 26.5, quota: 220 },
  { id: 's18', university_program: 'p6', admission_method: 1, year: 2025, score: 26.9, quota: 230 },
  { id: 's19', university_program: 'p7', admission_method: 1, year: 2023, score: 25.4, quota: 190 },
  { id: 's20', university_program: 'p7', admission_method: 1, year: 2024, score: 25.9, quota: 195 },
  { id: 's21', university_program: 'p7', admission_method: 1, year: 2025, score: 26.2, quota: 200 },
  { id: 's22', university_program: 'p8', admission_method: 1, year: 2023, score: 27.4, quota: 240 },
  { id: 's23', university_program: 'p8', admission_method: 1, year: 2024, score: 27.9, quota: 250 },
  { id: 's24', university_program: 'p8', admission_method: 1, year: 2025, score: 28.1, quota: 260 },
  { id: 's25', university_program: 'p9', admission_method: 1, year: 2023, score: 24.8, quota: 300 },
  { id: 's26', university_program: 'p9', admission_method: 1, year: 2024, score: 25.1, quota: 320 },
  { id: 's27', university_program: 'p9', admission_method: 1, year: 2025, score: 25.6, quota: 350 },
  { id: 's28', university_program: 'p10', admission_method: 1, year: 2023, score: 27.9, quota: 180 },
  { id: 's29', university_program: 'p10', admission_method: 1, year: 2024, score: 28.2, quota: 190 },
  { id: 's30', university_program: 'p10', admission_method: 1, year: 2025, score: 28.6, quota: 210 }
];
