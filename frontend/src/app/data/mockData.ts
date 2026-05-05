export type University = {
  id: number;
  name: string;
  abbr: string;
  logo: string;
  city: string;
  region: string;
  ranking: number;
  overallScore: number;
  avgAdmScore: number;
  socialScore: number;
  userRating: number;
  ratingCount: number;
  website: string;
  address: string;
  established: number;
  color: string;
  radarScores: { criteria: string; score: number }[];
};

export type Major = {
  id: number;
  name: string;
  code: string;
  group: string;
  block: string;
  method: string;
  universityId: number;
  scores: { [year: string]: number };
  trend: 'up' | 'down' | 'stable';
  quota: number;
  description: string;
};

export type Review = {
  id: number;
  universityId: number;
  author: string;
  avatar: string;
  rating: number;
  content: string;
  date: string;
  category: string;
};

export type UserRanking = {
  rank: number;
  id: number;
  name: string;
  tier: 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
  score: number;
  avatar: string;
  topSubject: string;
  anonymous: boolean;
};

export const universities: University[] = [
  {
    id: 1,
    name: "Đại học Bách Khoa Hà Nội",
    abbr: "HUST",
    logo: "BK",
    city: "Hà Nội",
    region: "Miền Bắc",
    ranking: 1,
    overallScore: 92.5,
    avgAdmScore: 27.8,
    socialScore: 89,
    userRating: 4.8,
    ratingCount: 2341,
    website: "hust.edu.vn",
    address: "Số 1, Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
    established: 1956,
    color: "#E53E3E",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 88 },
      { criteria: "Nghiên cứu KH", score: 95 },
      { criteria: "Chất lượng đào tạo", score: 94 },
      { criteria: "Chất lượng SV", score: 92 },
      { criteria: "Điểm đầu ra", score: 90 },
      { criteria: "Điểm đầu vào", score: 93 },
    ],
  },
  {
    id: 2,
    name: "Đại học Bách Khoa TP.HCM",
    abbr: "HCMUT",
    logo: "BK",
    city: "TP.HCM",
    region: "Miền Nam",
    ranking: 2,
    overallScore: 90.2,
    avgAdmScore: 27.2,
    socialScore: 85,
    userRating: 4.7,
    ratingCount: 1987,
    website: "hcmut.edu.vn",
    address: "268 Lý Thường Kiệt, Q.10, TP.HCM",
    established: 1957,
    color: "#2B6CB0",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 90 },
      { criteria: "Nghiên cứu KH", score: 88 },
      { criteria: "Chất lượng đào tạo", score: 92 },
      { criteria: "Chất lượng SV", score: 89 },
      { criteria: "Điểm đầu ra", score: 87 },
      { criteria: "Điểm đầu vào", score: 91 },
    ],
  },
  {
    id: 3,
    name: "Đại học Kinh tế Quốc dân",
    abbr: "NEU",
    logo: "NEU",
    city: "Hà Nội",
    region: "Miền Bắc",
    ranking: 3,
    overallScore: 88.7,
    avgAdmScore: 26.5,
    socialScore: 83,
    userRating: 4.6,
    ratingCount: 1654,
    website: "neu.edu.vn",
    address: "207 Giải Phóng, Hai Bà Trưng, Hà Nội",
    established: 1956,
    color: "#276749",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 82 },
      { criteria: "Nghiên cứu KH", score: 79 },
      { criteria: "Chất lượng đào tạo", score: 91 },
      { criteria: "Chất lượng SV", score: 88 },
      { criteria: "Điểm đầu ra", score: 93 },
      { criteria: "Điểm đầu vào", score: 87 },
    ],
  },
  {
    id: 4,
    name: "Đại học Ngoại Thương",
    abbr: "FTU",
    logo: "FTU",
    city: "Hà Nội",
    region: "Miền Bắc",
    ranking: 4,
    overallScore: 87.3,
    avgAdmScore: 27.0,
    socialScore: 82,
    userRating: 4.7,
    ratingCount: 1432,
    website: "ftu.edu.vn",
    address: "91 Chùa Láng, Đống Đa, Hà Nội",
    established: 1960,
    color: "#744210",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 80 },
      { criteria: "Nghiên cứu KH", score: 75 },
      { criteria: "Chất lượng đào tạo", score: 90 },
      { criteria: "Chất lượng SV", score: 92 },
      { criteria: "Điểm đầu ra", score: 94 },
      { criteria: "Điểm đầu vào", score: 89 },
    ],
  },
  {
    id: 5,
    name: "Đại học Y Hà Nội",
    abbr: "HMU",
    logo: "HMU",
    city: "Hà Nội",
    region: "Miền Bắc",
    ranking: 5,
    overallScore: 86.9,
    avgAdmScore: 28.5,
    socialScore: 78,
    userRating: 4.5,
    ratingCount: 1123,
    website: "hmu.edu.vn",
    address: "1 Tôn Thất Tùng, Đống Đa, Hà Nội",
    established: 1902,
    color: "#553C9A",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 85 },
      { criteria: "Nghiên cứu KH", score: 92 },
      { criteria: "Chất lượng đào tạo", score: 95 },
      { criteria: "Chất lượng SV", score: 90 },
      { criteria: "Điểm đầu ra", score: 88 },
      { criteria: "Điểm đầu vào", score: 96 },
    ],
  },
  {
    id: 6,
    name: "Đại học Kinh tế TP.HCM",
    abbr: "UEH",
    logo: "UEH",
    city: "TP.HCM",
    region: "Miền Nam",
    ranking: 6,
    overallScore: 85.4,
    avgAdmScore: 25.8,
    socialScore: 81,
    userRating: 4.5,
    ratingCount: 1876,
    website: "ueh.edu.vn",
    address: "59C Nguyễn Đình Chiểu, Q.3, TP.HCM",
    established: 1976,
    color: "#065666",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 87 },
      { criteria: "Nghiên cứu KH", score: 78 },
      { criteria: "Chất lượng đào tạo", score: 88 },
      { criteria: "Chất lượng SV", score: 86 },
      { criteria: "Điểm đầu ra", score: 91 },
      { criteria: "Điểm đầu vào", score: 83 },
    ],
  },
  {
    id: 7,
    name: "HV Công nghệ Bưu chính Viễn thông",
    abbr: "PTIT",
    logo: "PTIT",
    city: "Hà Nội",
    region: "Miền Bắc",
    ranking: 7,
    overallScore: 83.2,
    avgAdmScore: 24.5,
    socialScore: 76,
    userRating: 4.3,
    ratingCount: 987,
    website: "ptit.edu.vn",
    address: "122 Hoàng Quốc Việt, Cầu Giấy, Hà Nội",
    established: 1997,
    color: "#1A365D",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 80 },
      { criteria: "Nghiên cứu KH", score: 79 },
      { criteria: "Chất lượng đào tạo", score: 85 },
      { criteria: "Chất lượng SV", score: 82 },
      { criteria: "Điểm đầu ra", score: 87 },
      { criteria: "Điểm đầu vào", score: 80 },
    ],
  },
  {
    id: 8,
    name: "ĐH Khoa học Tự nhiên Hà Nội",
    abbr: "HUS",
    logo: "HUS",
    city: "Hà Nội",
    region: "Miền Bắc",
    ranking: 8,
    overallScore: 82.7,
    avgAdmScore: 24.8,
    socialScore: 74,
    userRating: 4.4,
    ratingCount: 876,
    website: "hus.vnu.edu.vn",
    address: "334 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    established: 1956,
    color: "#7B341E",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 78 },
      { criteria: "Nghiên cứu KH", score: 90 },
      { criteria: "Chất lượng đào tạo", score: 86 },
      { criteria: "Chất lượng SV", score: 83 },
      { criteria: "Điểm đầu ra", score: 80 },
      { criteria: "Điểm đầu vào", score: 82 },
    ],
  },
  {
    id: 9,
    name: "Đại học Mở TP.HCM",
    abbr: "OU",
    logo: "OU",
    city: "TP.HCM",
    region: "Miền Nam",
    ranking: 9,
    overallScore: 79.3,
    avgAdmScore: 21.5,
    socialScore: 72,
    userRating: 4.2,
    ratingCount: 654,
    website: "ou.edu.vn",
    address: "97 Võ Văn Tần, Q.3, TP.HCM",
    established: 1993,
    color: "#285E61",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 75 },
      { criteria: "Nghiên cứu KH", score: 68 },
      { criteria: "Chất lượng đào tạo", score: 78 },
      { criteria: "Chất lượng SV", score: 76 },
      { criteria: "Điểm đầu ra", score: 80 },
      { criteria: "Điểm đầu vào", score: 70 },
    ],
  },
  {
    id: 10,
    name: "Đại học Đà Nẵng",
    abbr: "UD",
    logo: "UD",
    city: "Đà Nẵng",
    region: "Miền Trung",
    ranking: 10,
    overallScore: 77.8,
    avgAdmScore: 22.5,
    socialScore: 70,
    userRating: 4.1,
    ratingCount: 543,
    website: "udn.vn",
    address: "41 Lê Duẩn, Hải Châu, Đà Nẵng",
    established: 1994,
    color: "#44337A",
    radarScores: [
      { criteria: "Cơ sở vật chất", score: 82 },
      { criteria: "Nghiên cứu KH", score: 72 },
      { criteria: "Chất lượng đào tạo", score: 79 },
      { criteria: "Chất lượng SV", score: 77 },
      { criteria: "Điểm đầu ra", score: 75 },
      { criteria: "Điểm đầu vào", score: 74 },
    ],
  },
];

export const majors: Major[] = [
  {
    id: 1,
    name: "Công nghệ Thông tin",
    code: "48020201",
    group: "Kỹ thuật - Công nghệ",
    block: "A00",
    method: "THPT",
    universityId: 1,
    scores: { "2021": 26.2, "2022": 27.0, "2023": 27.5, "2024": 28.0, "2025": 28.5 },
    trend: "up",
    quota: 300,
    description: "Đào tạo kỹ sư CNTT với chuyên sâu về lập trình, hệ thống, AI",
  },
  {
    id: 2,
    name: "Kỹ thuật Phần mềm",
    code: "48020301",
    group: "Kỹ thuật - Công nghệ",
    block: "A00",
    method: "THPT",
    universityId: 1,
    scores: { "2021": 25.5, "2022": 26.2, "2023": 27.0, "2024": 27.8, "2025": 28.2 },
    trend: "up",
    quota: 250,
    description: "Chuyên ngành phát triển phần mềm chuyên nghiệp",
  },
  {
    id: 3,
    name: "Trí tuệ Nhân tạo",
    code: "48020402",
    group: "Kỹ thuật - Công nghệ",
    block: "A00",
    method: "THPT",
    universityId: 1,
    scores: { "2021": 24.0, "2022": 25.5, "2023": 26.8, "2024": 27.5, "2025": 28.0 },
    trend: "up",
    quota: 150,
    description: "Ngành học mới nhất về AI/ML và Data Science",
  },
  {
    id: 4,
    name: "Y đa khoa",
    code: "72010100",
    group: "Sức khỏe",
    block: "B00",
    method: "THPT",
    universityId: 5,
    scores: { "2021": 28.0, "2022": 28.2, "2023": 28.5, "2024": 28.7, "2025": 29.0 },
    trend: "up",
    quota: 400,
    description: "Đào tạo bác sĩ đa khoa theo tiêu chuẩn quốc tế",
  },
  {
    id: 5,
    name: "Quản trị Kinh doanh",
    code: "34010201",
    group: "Kinh tế - Quản trị",
    block: "A00",
    method: "Học bạ",
    universityId: 3,
    scores: { "2021": 25.0, "2022": 25.5, "2023": 26.0, "2024": 26.3, "2025": 26.5 },
    trend: "up",
    quota: 350,
    description: "Đào tạo nhà quản lý doanh nghiệp toàn diện",
  },
  {
    id: 6,
    name: "Kinh tế Quốc tế",
    code: "31010600",
    group: "Kinh tế - Quản trị",
    block: "D01",
    method: "THPT",
    universityId: 4,
    scores: { "2021": 26.5, "2022": 26.8, "2023": 27.0, "2024": 27.2, "2025": 27.5 },
    trend: "up",
    quota: 200,
    description: "Chuyên ngành kinh tế trong bối cảnh hội nhập quốc tế",
  },
  {
    id: 7,
    name: "Luật",
    code: "38010101",
    group: "Luật - Chính trị",
    block: "C00",
    method: "THPT",
    universityId: 3,
    scores: { "2021": 25.5, "2022": 25.8, "2023": 26.0, "2024": 26.2, "2025": 26.5 },
    trend: "stable",
    quota: 180,
    description: "Đào tạo cử nhân luật với kiến thức pháp luật toàn diện",
  },
  {
    id: 8,
    name: "Dược học",
    code: "72040101",
    group: "Sức khỏe",
    block: "B00",
    method: "THPT",
    universityId: 5,
    scores: { "2021": 27.5, "2022": 27.7, "2023": 27.8, "2024": 27.9, "2025": 28.0 },
    trend: "stable",
    quota: 200,
    description: "Đào tạo dược sĩ đại học đạt tiêu chuẩn quốc tế",
  },
  {
    id: 9,
    name: "Kiến trúc",
    code: "58010101",
    group: "Kiến trúc - Xây dựng",
    block: "V00",
    method: "THPT",
    universityId: 1,
    scores: { "2021": 24.5, "2022": 24.8, "2023": 25.0, "2024": 25.2, "2025": 25.5 },
    trend: "up",
    quota: 120,
    description: "Đào tạo kiến trúc sư với tư duy sáng tạo hiện đại",
  },
  {
    id: 10,
    name: "Ngôn ngữ Anh",
    code: "22020201",
    group: "Ngôn ngữ - Văn hóa",
    block: "D01",
    method: "THPT",
    universityId: 4,
    scores: { "2021": 27.0, "2022": 27.2, "2023": 27.3, "2024": 27.4, "2025": 27.5 },
    trend: "stable",
    quota: 160,
    description: "Chuyên ngành ngôn ngữ với định hướng quốc tế",
  },
  {
    id: 11,
    name: "Tài chính - Ngân hàng",
    code: "34020201",
    group: "Kinh tế - Quản trị",
    block: "A00",
    method: "THPT",
    universityId: 6,
    scores: { "2021": 25.2, "2022": 25.5, "2023": 25.8, "2024": 26.0, "2025": 26.2 },
    trend: "up",
    quota: 280,
    description: "Đào tạo chuyên gia tài chính và ngân hàng",
  },
  {
    id: 12,
    name: "Marketing",
    code: "34010301",
    group: "Kinh tế - Quản trị",
    block: "A00",
    method: "Học bạ",
    universityId: 6,
    scores: { "2021": 24.0, "2022": 24.5, "2023": 25.0, "2024": 25.3, "2025": 25.5 },
    trend: "up",
    quota: 200,
    description: "Đào tạo chuyên gia Marketing đa nền tảng",
  },
  {
    id: 13,
    name: "Điện tử Viễn thông",
    code: "52520208",
    group: "Kỹ thuật - Công nghệ",
    block: "A00",
    method: "THPT",
    universityId: 7,
    scores: { "2021": 23.5, "2022": 23.8, "2023": 24.0, "2024": 24.3, "2025": 24.5 },
    trend: "up",
    quota: 220,
    description: "Kỹ thuật điện tử và hệ thống viễn thông",
  },
  {
    id: 14,
    name: "Kỹ thuật Cơ điện tử",
    code: "52520114",
    group: "Kỹ thuật - Công nghệ",
    block: "A00",
    method: "THPT",
    universityId: 2,
    scores: { "2021": 24.0, "2022": 24.5, "2023": 25.0, "2024": 25.5, "2025": 26.0 },
    trend: "up",
    quota: 180,
    description: "Tích hợp cơ khí, điện tử và điều khiển tự động",
  },
  {
    id: 15,
    name: "Khoa học Máy tính",
    code: "48020101",
    group: "Kỹ thuật - Công nghệ",
    block: "A00",
    method: "ĐGNL",
    universityId: 8,
    scores: { "2021": 23.0, "2022": 23.5, "2023": 24.0, "2024": 24.5, "2025": 25.0 },
    trend: "up",
    quota: 150,
    description: "Nghiên cứu cơ bản và ứng dụng khoa học máy tính",
  },
];

export const reviews: Review[] = [
  {
    id: 1,
    universityId: 1,
    author: "Nguyễn Minh Tuấn",
    avatar: "MT",
    rating: 5,
    content: "HUST là trường top đầu Việt Nam về kỹ thuật. Chương trình đào tạo chất lượng, giảng viên nhiệt tình và cơ sở vật chất rất tốt!",
    date: "2024-12-15",
    category: "Chất lượng đào tạo",
  },
  {
    id: 2,
    universityId: 1,
    author: "Trần Thị Lan",
    avatar: "TL",
    rating: 4,
    content: "Học ở đây áp lực nhưng xứng đáng. Ra trường được nhiều công ty top tuyển thẳng. Môi trường học tập rất tốt.",
    date: "2024-11-20",
    category: "Cơ hội việc làm",
  },
  {
    id: 3,
    universityId: 1,
    author: "Phạm Văn Hùng",
    avatar: "PH",
    rating: 5,
    content: "Cơ sở vật chất hiện đại, phòng lab đầy đủ thiết bị. Các câu lạc bộ rất sôi động!",
    date: "2024-10-05",
    category: "Cơ sở vật chất",
  },
  {
    id: 4,
    universityId: 2,
    author: "Lê Thị Mai",
    avatar: "LM",
    rating: 5,
    content: "BK HCM rất tốt, môi trường học tập sôi động. Nhiều cơ hội thực tập tại các công ty lớn ở TP.HCM.",
    date: "2024-12-01",
    category: "Môi trường học tập",
  },
];

export const userRankings: UserRanking[] = [
  { rank: 1, id: 1, name: "Nguyễn Văn An", tier: "SSS", score: 187, avatar: "VA", topSubject: "Toán", anonymous: false },
  { rank: 2, id: 2, name: "Trần Minh Khoa", tier: "SSS", score: 165, avatar: "MK", topSubject: "Lý", anonymous: false },
  { rank: 3, id: 3, name: "Phạm Thu Hà", tier: "SS", score: 142, avatar: "TH", topSubject: "Hóa", anonymous: false },
  { rank: 4, id: 4, name: "***ăn Bình", tier: "SS", score: 128, avatar: "VB", topSubject: "Toán", anonymous: true },
  { rank: 5, id: 5, name: "Lê Thị Ngọc", tier: "S", score: 115, avatar: "TN", topSubject: "Anh", anonymous: false },
  { rank: 6, id: 6, name: "Hoàng Minh Đức", tier: "S", score: 108, avatar: "MD", topSubject: "Sinh", anonymous: false },
  { rank: 7, id: 7, name: "***ị Lan Anh", tier: "S", score: 102, avatar: "LA", topSubject: "Văn", anonymous: true },
  { rank: 8, id: 8, name: "Vũ Quốc Huy", tier: "A", score: 95, avatar: "QH", topSubject: "Toán", anonymous: false },
  { rank: 9, id: 9, name: "Đặng Khánh Linh", tier: "A", score: 88, avatar: "KL", topSubject: "Địa", anonymous: false },
  { rank: 10, id: 10, name: "Bùi Văn Tân", tier: "A", score: 82, avatar: "VT", topSubject: "Sử", anonymous: false },
  { rank: 11, id: 11, name: "Ngô Thị Hoa", tier: "B", score: 73, avatar: "TH2", topSubject: "Hóa", anonymous: false },
  { rank: 12, id: 12, name: "***ường Quân", tier: "B", score: 68, avatar: "TQ", topSubject: "Lý", anonymous: true },
  { rank: 13, id: 13, name: "Phan Anh Khoa", tier: "B", score: 65, avatar: "AK", topSubject: "Toán", anonymous: false },
  { rank: 14, id: 14, name: "Mai Thị Thu", tier: "C", score: 52, avatar: "MT2", topSubject: "Anh", anonymous: false },
  { rank: 15, id: 15, name: "Lưu Đình Nam", tier: "C", score: 47, avatar: "DN", topSubject: "Văn", anonymous: false },
];

export const topMajorTrends = [
  { name: "CNTT", scores: [24.5, 25.5, 26.2, 27.5, 28.5], color: "#5B4FCF" },
  { name: "Y đa khoa", scores: [27.5, 27.8, 28.0, 28.5, 29.0], color: "#FF6B6B" },
  { name: "Kinh tế QT", scores: [25.5, 25.8, 26.2, 27.0, 27.5], color: "#43D9A3" },
  { name: "Dược học", scores: [26.5, 27.0, 27.5, 27.8, 28.0], color: "#FFB347" },
  { name: "Ngoại thương", scores: [25.0, 25.5, 26.5, 27.0, 27.3], color: "#FC8181" },
];

export const getTierColor = (tier: string): string => {
  const colors: { [key: string]: string } = {
    D: "#B0B0B0",
    C: "#4CAF50",
    B: "#2196F3",
    A: "#9C27B0",
    S: "#FF9800",
    SS: "#F44336",
    SSS: "#5B4FCF",
  };
  return colors[tier] || "#B0B0B0";
};

export const getTierBg = (tier: string): string => {
  const colors: { [key: string]: string } = {
    D: "bg-gray-200 text-gray-600",
    C: "bg-green-100 text-green-700",
    B: "bg-blue-100 text-blue-700",
    A: "bg-purple-100 text-purple-700",
    S: "bg-orange-100 text-orange-700",
    SS: "bg-red-100 text-red-700",
    SSS: "bg-gradient-to-r from-pink-500 via-yellow-400 to-indigo-500 text-white",
  };
  return colors[tier] || "bg-gray-200 text-gray-600";
};

export const getTierThreshold = (score: number): string => {
  if (score >= 150) return "SSS";
  if (score >= 100) return "SS";
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  return "D";
};

export const majorGroups = [
  "Kỹ thuật - Công nghệ",
  "Kinh tế - Quản trị",
  "Sức khỏe",
  "Ngôn ngữ - Văn hóa",
  "Luật - Chính trị",
  "Kiến trúc - Xây dựng",
];

export const examBlocks = ["A00", "A01", "B00", "C00", "D01", "V00", "ĐGNL"];
