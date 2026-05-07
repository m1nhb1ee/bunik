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
  tier: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  score: number;
  avatar: string;
  topSubject: string;
  anonymous: boolean;
};

export const universities: University[] = [
  {
    id: 1,
    name: "Äáº¡i há»c BÃ¡ch Khoa HÃ  Ná»™i",
    abbr: "HUST",
    logo: "BK",
    city: "HÃ  Ná»™i",
    region: "Miá»n Báº¯c",
    ranking: 1,
    overallScore: 92.5,
    avgAdmScore: 27.8,
    socialScore: 89,
    userRating: 4.8,
    ratingCount: 2341,
    website: "hust.edu.vn",
    address: "Sá»‘ 1, Äáº¡i Cá»“ Viá»‡t, Hai BÃ  TrÆ°ng, HÃ  Ná»™i",
    established: 1956,
    color: "#E53E3E",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 88 },
      { criteria: "NghiÃªn cá»©u KH", score: 95 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 94 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 92 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 90 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 93 },
    ],
  },
  {
    id: 2,
    name: "Äáº¡i há»c BÃ¡ch Khoa TP.HCM",
    abbr: "HCMUT",
    logo: "BK",
    city: "TP.HCM",
    region: "Miá»n Nam",
    ranking: 2,
    overallScore: 90.2,
    avgAdmScore: 27.2,
    socialScore: 85,
    userRating: 4.7,
    ratingCount: 1987,
    website: "hcmut.edu.vn",
    address: "268 LÃ½ ThÆ°á»ng Kiá»‡t, Q.10, TP.HCM",
    established: 1957,
    color: "#2B6CB0",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 90 },
      { criteria: "NghiÃªn cá»©u KH", score: 88 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 92 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 89 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 87 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 91 },
    ],
  },
  {
    id: 3,
    name: "Äáº¡i há»c Kinh táº¿ Quá»‘c dÃ¢n",
    abbr: "NEU",
    logo: "NEU",
    city: "HÃ  Ná»™i",
    region: "Miá»n Báº¯c",
    ranking: 3,
    overallScore: 88.7,
    avgAdmScore: 26.5,
    socialScore: 83,
    userRating: 4.6,
    ratingCount: 1654,
    website: "neu.edu.vn",
    address: "207 Giáº£i PhÃ³ng, Hai BÃ  TrÆ°ng, HÃ  Ná»™i",
    established: 1956,
    color: "#276749",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 82 },
      { criteria: "NghiÃªn cá»©u KH", score: 79 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 91 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 88 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 93 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 87 },
    ],
  },
  {
    id: 4,
    name: "Äáº¡i há»c Ngoáº¡i ThÆ°Æ¡ng",
    abbr: "FTU",
    logo: "FTU",
    city: "HÃ  Ná»™i",
    region: "Miá»n Báº¯c",
    ranking: 4,
    overallScore: 87.3,
    avgAdmScore: 27.0,
    socialScore: 82,
    userRating: 4.7,
    ratingCount: 1432,
    website: "ftu.edu.vn",
    address: "91 ChÃ¹a LÃ¡ng, Äá»‘ng Äa, HÃ  Ná»™i",
    established: 1960,
    color: "#744210",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 80 },
      { criteria: "NghiÃªn cá»©u KH", score: 75 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 90 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 92 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 94 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 89 },
    ],
  },
  {
    id: 5,
    name: "Äáº¡i há»c Y HÃ  Ná»™i",
    abbr: "HMU",
    logo: "HMU",
    city: "HÃ  Ná»™i",
    region: "Miá»n Báº¯c",
    ranking: 5,
    overallScore: 86.9,
    avgAdmScore: 28.5,
    socialScore: 78,
    userRating: 4.5,
    ratingCount: 1123,
    website: "hmu.edu.vn",
    address: "1 TÃ´n Tháº¥t TÃ¹ng, Äá»‘ng Äa, HÃ  Ná»™i",
    established: 1902,
    color: "#553C9A",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 85 },
      { criteria: "NghiÃªn cá»©u KH", score: 92 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 95 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 90 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 88 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 96 },
    ],
  },
  {
    id: 6,
    name: "Äáº¡i há»c Kinh táº¿ TP.HCM",
    abbr: "UEH",
    logo: "UEH",
    city: "TP.HCM",
    region: "Miá»n Nam",
    ranking: 6,
    overallScore: 85.4,
    avgAdmScore: 25.8,
    socialScore: 81,
    userRating: 4.5,
    ratingCount: 1876,
    website: "ueh.edu.vn",
    address: "59C Nguyá»…n ÄÃ¬nh Chiá»ƒu, Q.3, TP.HCM",
    established: 1976,
    color: "#065666",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 87 },
      { criteria: "NghiÃªn cá»©u KH", score: 78 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 88 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 86 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 91 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 83 },
    ],
  },
  {
    id: 7,
    name: "HV CÃ´ng nghá»‡ BÆ°u chÃ­nh Viá»…n thÃ´ng",
    abbr: "PTIT",
    logo: "PTIT",
    city: "HÃ  Ná»™i",
    region: "Miá»n Báº¯c",
    ranking: 7,
    overallScore: 83.2,
    avgAdmScore: 24.5,
    socialScore: 76,
    userRating: 4.3,
    ratingCount: 987,
    website: "ptit.edu.vn",
    address: "122 HoÃ ng Quá»‘c Viá»‡t, Cáº§u Giáº¥y, HÃ  Ná»™i",
    established: 1997,
    color: "#1A365D",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 80 },
      { criteria: "NghiÃªn cá»©u KH", score: 79 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 85 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 82 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 87 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 80 },
    ],
  },
  {
    id: 8,
    name: "ÄH Khoa há»c Tá»± nhiÃªn HÃ  Ná»™i",
    abbr: "HUS",
    logo: "HUS",
    city: "HÃ  Ná»™i",
    region: "Miá»n Báº¯c",
    ranking: 8,
    overallScore: 82.7,
    avgAdmScore: 24.8,
    socialScore: 74,
    userRating: 4.4,
    ratingCount: 876,
    website: "hus.vnu.edu.vn",
    address: "334 Nguyá»…n TrÃ£i, Thanh XuÃ¢n, HÃ  Ná»™i",
    established: 1956,
    color: "#7B341E",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 78 },
      { criteria: "NghiÃªn cá»©u KH", score: 90 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 86 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 83 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 80 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 82 },
    ],
  },
  {
    id: 9,
    name: "Äáº¡i há»c Má»Ÿ TP.HCM",
    abbr: "OU",
    logo: "OU",
    city: "TP.HCM",
    region: "Miá»n Nam",
    ranking: 9,
    overallScore: 79.3,
    avgAdmScore: 21.5,
    socialScore: 72,
    userRating: 4.2,
    ratingCount: 654,
    website: "ou.edu.vn",
    address: "97 VÃµ VÄƒn Táº§n, Q.3, TP.HCM",
    established: 1993,
    color: "#285E61",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 75 },
      { criteria: "NghiÃªn cá»©u KH", score: 68 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 78 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 76 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 80 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 70 },
    ],
  },
  {
    id: 10,
    name: "Äáº¡i há»c ÄÃ  Náºµng",
    abbr: "UD",
    logo: "UD",
    city: "ÄÃ  Náºµng",
    region: "Miá»n Trung",
    ranking: 10,
    overallScore: 77.8,
    avgAdmScore: 22.5,
    socialScore: 70,
    userRating: 4.1,
    ratingCount: 543,
    website: "udn.vn",
    address: "41 LÃª Duáº©n, Háº£i ChÃ¢u, ÄÃ  Náºµng",
    established: 1994,
    color: "#44337A",
    radarScores: [
      { criteria: "CÆ¡ sá»Ÿ váº­t cháº¥t", score: 82 },
      { criteria: "NghiÃªn cá»©u KH", score: 72 },
      { criteria: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o", score: 79 },
      { criteria: "Cháº¥t lÆ°á»£ng SV", score: 77 },
      { criteria: "Äiá»ƒm Ä‘áº§u ra", score: 75 },
      { criteria: "Äiá»ƒm Ä‘áº§u vÃ o", score: 74 },
    ],
  },
];

export const majors: Major[] = [
  {
    id: 1,
    name: "CÃ´ng nghá»‡ ThÃ´ng tin",
    code: "48020201",
    group: "Ká»¹ thuáº­t - CÃ´ng nghá»‡",
    block: "A00",
    method: "THPT",
    universityId: 1,
    scores: { "2021": 26.2, "2022": 27.0, "2023": 27.5, "2024": 28.0, "2025": 28.5 },
    trend: "up",
    quota: 300,
    description: "ÄÃ o táº¡o ká»¹ sÆ° CNTT vá»›i chuyÃªn sÃ¢u vá» láº­p trÃ¬nh, há»‡ thá»‘ng, AI",
  },
  {
    id: 2,
    name: "Ká»¹ thuáº­t Pháº§n má»m",
    code: "48020301",
    group: "Ká»¹ thuáº­t - CÃ´ng nghá»‡",
    block: "A00",
    method: "THPT",
    universityId: 1,
    scores: { "2021": 25.5, "2022": 26.2, "2023": 27.0, "2024": 27.8, "2025": 28.2 },
    trend: "up",
    quota: 250,
    description: "ChuyÃªn ngÃ nh phÃ¡t triá»ƒn pháº§n má»m chuyÃªn nghiá»‡p",
  },
  {
    id: 3,
    name: "TrÃ­ tuá»‡ NhÃ¢n táº¡o",
    code: "48020402",
    group: "Ká»¹ thuáº­t - CÃ´ng nghá»‡",
    block: "A00",
    method: "THPT",
    universityId: 1,
    scores: { "2021": 24.0, "2022": 25.5, "2023": 26.8, "2024": 27.5, "2025": 28.0 },
    trend: "up",
    quota: 150,
    description: "NgÃ nh há»c má»›i nháº¥t vá» AI/ML vÃ  Data Science",
  },
  {
    id: 4,
    name: "Y Ä‘a khoa",
    code: "72010100",
    group: "Sá»©c khá»e",
    block: "B00",
    method: "THPT",
    universityId: 5,
    scores: { "2021": 28.0, "2022": 28.2, "2023": 28.5, "2024": 28.7, "2025": 29.0 },
    trend: "up",
    quota: 400,
    description: "ÄÃ o táº¡o bÃ¡c sÄ© Ä‘a khoa theo tiÃªu chuáº©n quá»‘c táº¿",
  },
  {
    id: 5,
    name: "Quáº£n trá»‹ Kinh doanh",
    code: "34010201",
    group: "Kinh táº¿ - Quáº£n trá»‹",
    block: "A00",
    method: "Há»c báº¡",
    universityId: 3,
    scores: { "2021": 25.0, "2022": 25.5, "2023": 26.0, "2024": 26.3, "2025": 26.5 },
    trend: "up",
    quota: 350,
    description: "ÄÃ o táº¡o nhÃ  quáº£n lÃ½ doanh nghiá»‡p toÃ n diá»‡n",
  },
  {
    id: 6,
    name: "Kinh táº¿ Quá»‘c táº¿",
    code: "31010600",
    group: "Kinh táº¿ - Quáº£n trá»‹",
    block: "D01",
    method: "THPT",
    universityId: 4,
    scores: { "2021": 26.5, "2022": 26.8, "2023": 27.0, "2024": 27.2, "2025": 27.5 },
    trend: "up",
    quota: 200,
    description: "ChuyÃªn ngÃ nh kinh táº¿ trong bá»‘i cáº£nh há»™i nháº­p quá»‘c táº¿",
  },
  {
    id: 7,
    name: "Luáº­t",
    code: "38010101",
    group: "Luáº­t - ChÃ­nh trá»‹",
    block: "C00",
    method: "THPT",
    universityId: 3,
    scores: { "2021": 25.5, "2022": 25.8, "2023": 26.0, "2024": 26.2, "2025": 26.5 },
    trend: "stable",
    quota: 180,
    description: "ÄÃ o táº¡o cá»­ nhÃ¢n luáº­t vá»›i kiáº¿n thá»©c phÃ¡p luáº­t toÃ n diá»‡n",
  },
  {
    id: 8,
    name: "DÆ°á»£c há»c",
    code: "72040101",
    group: "Sá»©c khá»e",
    block: "B00",
    method: "THPT",
    universityId: 5,
    scores: { "2021": 27.5, "2022": 27.7, "2023": 27.8, "2024": 27.9, "2025": 28.0 },
    trend: "stable",
    quota: 200,
    description: "ÄÃ o táº¡o dÆ°á»£c sÄ© Ä‘áº¡i há»c Ä‘áº¡t tiÃªu chuáº©n quá»‘c táº¿",
  },
  {
    id: 9,
    name: "Kiáº¿n trÃºc",
    code: "58010101",
    group: "Kiáº¿n trÃºc - XÃ¢y dá»±ng",
    block: "V00",
    method: "THPT",
    universityId: 1,
    scores: { "2021": 24.5, "2022": 24.8, "2023": 25.0, "2024": 25.2, "2025": 25.5 },
    trend: "up",
    quota: 120,
    description: "ÄÃ o táº¡o kiáº¿n trÃºc sÆ° vá»›i tÆ° duy sÃ¡ng táº¡o hiá»‡n Ä‘áº¡i",
  },
  {
    id: 10,
    name: "NgÃ´n ngá»¯ Anh",
    code: "22020201",
    group: "NgÃ´n ngá»¯ - VÄƒn hÃ³a",
    block: "D01",
    method: "THPT",
    universityId: 4,
    scores: { "2021": 27.0, "2022": 27.2, "2023": 27.3, "2024": 27.4, "2025": 27.5 },
    trend: "stable",
    quota: 160,
    description: "ChuyÃªn ngÃ nh ngÃ´n ngá»¯ vá»›i Ä‘á»‹nh hÆ°á»›ng quá»‘c táº¿",
  },
  {
    id: 11,
    name: "TÃ i chÃ­nh - NgÃ¢n hÃ ng",
    code: "34020201",
    group: "Kinh táº¿ - Quáº£n trá»‹",
    block: "A00",
    method: "THPT",
    universityId: 6,
    scores: { "2021": 25.2, "2022": 25.5, "2023": 25.8, "2024": 26.0, "2025": 26.2 },
    trend: "up",
    quota: 280,
    description: "ÄÃ o táº¡o chuyÃªn gia tÃ i chÃ­nh vÃ  ngÃ¢n hÃ ng",
  },
  {
    id: 12,
    name: "Marketing",
    code: "34010301",
    group: "Kinh táº¿ - Quáº£n trá»‹",
    block: "A00",
    method: "Há»c báº¡",
    universityId: 6,
    scores: { "2021": 24.0, "2022": 24.5, "2023": 25.0, "2024": 25.3, "2025": 25.5 },
    trend: "up",
    quota: 200,
    description: "ÄÃ o táº¡o chuyÃªn gia Marketing Ä‘a ná»n táº£ng",
  },
  {
    id: 13,
    name: "Äiá»‡n tá»­ Viá»…n thÃ´ng",
    code: "52520208",
    group: "Ká»¹ thuáº­t - CÃ´ng nghá»‡",
    block: "A00",
    method: "THPT",
    universityId: 7,
    scores: { "2021": 23.5, "2022": 23.8, "2023": 24.0, "2024": 24.3, "2025": 24.5 },
    trend: "up",
    quota: 220,
    description: "Ká»¹ thuáº­t Ä‘iá»‡n tá»­ vÃ  há»‡ thá»‘ng viá»…n thÃ´ng",
  },
  {
    id: 14,
    name: "Ká»¹ thuáº­t CÆ¡ Ä‘iá»‡n tá»­",
    code: "52520114",
    group: "Ká»¹ thuáº­t - CÃ´ng nghá»‡",
    block: "A00",
    method: "THPT",
    universityId: 2,
    scores: { "2021": 24.0, "2022": 24.5, "2023": 25.0, "2024": 25.5, "2025": 26.0 },
    trend: "up",
    quota: 180,
    description: "TÃ­ch há»£p cÆ¡ khÃ­, Ä‘iá»‡n tá»­ vÃ  Ä‘iá»u khiá»ƒn tá»± Ä‘á»™ng",
  },
  {
    id: 15,
    name: "Khoa há»c MÃ¡y tÃ­nh",
    code: "48020101",
    group: "Ká»¹ thuáº­t - CÃ´ng nghá»‡",
    block: "A00",
    method: "ÄGNL",
    universityId: 8,
    scores: { "2021": 23.0, "2022": 23.5, "2023": 24.0, "2024": 24.5, "2025": 25.0 },
    trend: "up",
    quota: 150,
    description: "NghiÃªn cá»©u cÆ¡ báº£n vÃ  á»©ng dá»¥ng khoa há»c mÃ¡y tÃ­nh",
  },
];

export const reviews: Review[] = [
  {
    id: 1,
    universityId: 1,
    author: "Nguyá»…n Minh Tuáº¥n",
    avatar: "MT",
    rating: 5,
    content: "HUST lÃ  trÆ°á»ng top Ä‘áº§u Viá»‡t Nam vá» ká»¹ thuáº­t. ChÆ°Æ¡ng trÃ¬nh Ä‘Ã o táº¡o cháº¥t lÆ°á»£ng, giáº£ng viÃªn nhiá»‡t tÃ¬nh vÃ  cÆ¡ sá»Ÿ váº­t cháº¥t ráº¥t tá»‘t!",
    date: "2024-12-15",
    category: "Cháº¥t lÆ°á»£ng Ä‘Ã o táº¡o",
  },
  {
    id: 2,
    universityId: 1,
    author: "Tráº§n Thá»‹ Lan",
    avatar: "TL",
    rating: 4,
    content: "Há»c á»Ÿ Ä‘Ã¢y Ã¡p lá»±c nhÆ°ng xá»©ng Ä‘Ã¡ng. Ra trÆ°á»ng Ä‘Æ°á»£c nhiá»u cÃ´ng ty top tuyá»ƒn tháº³ng. MÃ´i trÆ°á»ng há»c táº­p ráº¥t tá»‘t.",
    date: "2024-11-20",
    category: "CÆ¡ há»™i viá»‡c lÃ m",
  },
  {
    id: 3,
    universityId: 1,
    author: "Pháº¡m VÄƒn HÃ¹ng",
    avatar: "PH",
    rating: 5,
    content: "CÆ¡ sá»Ÿ váº­t cháº¥t hiá»‡n Ä‘áº¡i, phÃ²ng lab Ä‘áº§y Ä‘á»§ thiáº¿t bá»‹. CÃ¡c cÃ¢u láº¡c bá»™ ráº¥t sÃ´i Ä‘á»™ng!",
    date: "2024-10-05",
    category: "CÆ¡ sá»Ÿ váº­t cháº¥t",
  },
  {
    id: 4,
    universityId: 2,
    author: "LÃª Thá»‹ Mai",
    avatar: "LM",
    rating: 5,
    content: "BK HCM ráº¥t tá»‘t, mÃ´i trÆ°á»ng há»c táº­p sÃ´i Ä‘á»™ng. Nhiá»u cÆ¡ há»™i thá»±c táº­p táº¡i cÃ¡c cÃ´ng ty lá»›n á»Ÿ TP.HCM.",
    date: "2024-12-01",
    category: "MÃ´i trÆ°á»ng há»c táº­p",
  },
];

export const userRankings: UserRanking[] = [
  { rank: 1, id: 1, name: "Nguyá»…n VÄƒn An", tier: "S", score: 187, avatar: "VA", topSubject: "ToÃ¡n", anonymous: false },
  { rank: 2, id: 2, name: "Tráº§n Minh Khoa", tier: "S", score: 165, avatar: "MK", topSubject: "LÃ½", anonymous: false },
  { rank: 3, id: 3, name: "Pháº¡m Thu HÃ ", tier: "S", score: 142, avatar: "TH", topSubject: "HÃ³a", anonymous: false },
  { rank: 4, id: 4, name: "***Äƒn BÃ¬nh", tier: "S", score: 128, avatar: "VB", topSubject: "ToÃ¡n", anonymous: true },
  { rank: 5, id: 5, name: "LÃª Thá»‹ Ngá»c", tier: "S", score: 115, avatar: "TN", topSubject: "Anh", anonymous: false },
  { rank: 6, id: 6, name: "HoÃ ng Minh Äá»©c", tier: "S", score: 108, avatar: "MD", topSubject: "Sinh", anonymous: false },
  { rank: 7, id: 7, name: "***á»‹ Lan Anh", tier: "S", score: 102, avatar: "LA", topSubject: "VÄƒn", anonymous: true },
  { rank: 8, id: 8, name: "VÅ© Quá»‘c Huy", tier: "A", score: 95, avatar: "QH", topSubject: "ToÃ¡n", anonymous: false },
  { rank: 9, id: 9, name: "Äáº·ng KhÃ¡nh Linh", tier: "A", score: 88, avatar: "KL", topSubject: "Äá»‹a", anonymous: false },
  { rank: 10, id: 10, name: "BÃ¹i VÄƒn TÃ¢n", tier: "A", score: 82, avatar: "VT", topSubject: "Sá»­", anonymous: false },
  { rank: 11, id: 11, name: "NgÃ´ Thá»‹ Hoa", tier: "B", score: 73, avatar: "TH2", topSubject: "HÃ³a", anonymous: false },
  { rank: 12, id: 12, name: "***Æ°á»ng QuÃ¢n", tier: "B", score: 68, avatar: "TQ", topSubject: "LÃ½", anonymous: true },
  { rank: 13, id: 13, name: "Phan Anh Khoa", tier: "B", score: 65, avatar: "AK", topSubject: "ToÃ¡n", anonymous: false },
  { rank: 14, id: 14, name: "Mai Thá»‹ Thu", tier: "C", score: 52, avatar: "MT2", topSubject: "Anh", anonymous: false },
  { rank: 15, id: 15, name: "LÆ°u ÄÃ¬nh Nam", tier: "C", score: 47, avatar: "DN", topSubject: "VÄƒn", anonymous: false },
];

export const topMajorTrends = [
  { name: "CNTT", scores: [24.5, 25.5, 26.2, 27.5, 28.5], color: "#5B4FCF" },
  { name: "Y Ä‘a khoa", scores: [27.5, 27.8, 28.0, 28.5, 29.0], color: "#FF6B6B" },
  { name: "Kinh táº¿ QT", scores: [25.5, 25.8, 26.2, 27.0, 27.5], color: "#43D9A3" },
  { name: "DÆ°á»£c há»c", scores: [26.5, 27.0, 27.5, 27.8, 28.0], color: "#FFB347" },
  { name: "Ngoáº¡i thÆ°Æ¡ng", scores: [25.0, 25.5, 26.5, 27.0, 27.3], color: "#FC8181" },
];

export const getTierColor = (tier: string): string => {
  const colors: { [key: string]: string } = {
    F: "#3F3F46",
    E: "#F97316",
    D: "#EAB308",
    C: "#4CAF50",
    B: "#2196F3",
    A: "#9C27B0",
    S: "#E11D48",
  };
  return colors[tier] || "#B0B0B0";
};

export const getTierBg = (tier: string): string => {
  const colors: { [key: string]: string } = {
    F: "bg-zinc-700 text-white",
    E: "bg-orange-100 text-orange-700",
    D: "bg-yellow-100 text-yellow-700",
    C: "bg-green-100 text-green-700",
    B: "bg-blue-100 text-blue-700",
    A: "bg-purple-100 text-purple-700",
    S: "bg-gradient-to-r from-rose-600 via-amber-400 to-indigo-600 text-white",
  };
  return colors[tier] || "bg-gray-200 text-gray-600";
};

export const getTierThreshold = (score: number): string => {
  if (score >= 150) return "S";
  if (score >= 100) return "A";
  if (score >= 90) return "B";
  if (score >= 75) return "C";
  if (score >= 60) return "D";
  if (score >= 45) return "E";
  return "F";
};

export const majorGroups = [
  "Ká»¹ thuáº­t - CÃ´ng nghá»‡",
  "Kinh táº¿ - Quáº£n trá»‹",
  "Sá»©c khá»e",
  "NgÃ´n ngá»¯ - VÄƒn hÃ³a",
  "Luáº­t - ChÃ­nh trá»‹",
  "Kiáº¿n trÃºc - XÃ¢y dá»±ng",
];

export const examBlocks = ["A00", "A01", "B00", "C00", "D01", "V00", "ÄGNL"];
