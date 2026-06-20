"""
Clean Tuyensinh247 crawler CSVs into database import CSVs.

Input defaults:
    bunik_crawl_output/admission_scores.csv
    bunik_crawl_output/major_subject_groups.csv
    bunik_crawl_output/course_catalog.csv

Output defaults:
    bunik_crawl_output/clean_import/*.csv

Thay đổi mới nhất:
    - Tích hợp Multi-step Matching (hậu tố, reverse, name-based match).
    - Chia output university_programs thành: complete và missing.
    - Missing Data có thêm lý do (`missing_reason`) và truy vết mã gốc (`base_program_code`).
    - Ngăn chặn triệt để lặp Quota cho các mã ngành cũ/biến thể.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import unicodedata
import uuid
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

BASE_DIR             = Path(__file__).resolve().parent
DEFAULT_INPUT_DIR    = BASE_DIR / "bunik_crawl_output"
DEFAULT_OUTPUT_DIR   = DEFAULT_INPUT_DIR / "clean_import"
DEFAULT_UNIVERSITIES_FILE = BASE_DIR / "universities.txt"
SOURCE               = "tuyensinh247"
UUID_NAMESPACE       = uuid.UUID("6de5f8e4-2d5b-48f6-a2fb-e5d5ab0c4127")

PROVINCES = {
    "HN": {"id": 1, "code": "HN", "name": "Hà Nội", "region": "Bắc"},
}

# ── Field mappings ────────────────────────────────────────────────────────────

FIELD_BY_PREFIX = {
    "714": "giao_duc", "721": "nghe_thuat", "722": "nhan_van",
    "731": "khoa_hoc_xa_hoi", "732": "truyen_thong", "734": "kinh_te",
    "738": "phap_luat", "742": "khoa_hoc_su_song", "744": "khoa_hoc_tu_nhien",
    "746": "toan_va_thong_ke", "748": "cntt", "751": "dien_tu",
    "752": "ky_thuat", "754": "san_xuat_che_bien", "758": "xay_dung",
    "762": "nong_lam", "764": "thu_y", "772": "y_te",
    "776": "xa_hoi", "781": "du_lich", "784": "van_tai",
    "785": "moi_truong", "786": "an_ninh", "220": "nhan_van",
    "340": "kinh_te", "380": "phap_luat", "480": "cntt",
    "520": "ky_thuat", "620": "nong_lam", "640": "thu_y",
    "860": "an_ninh", "861": "an_ninh",
}

FIELD_BY_NAME_KEYWORDS = [
    ("cntt",            ["cong nghe thong tin", "khoa hoc may tinh", "may tinh", "mang may tinh",
                         "an toan khong gian so", "cyber security", "he thong nhung", "iot", "toan tin"]),
    ("dien_tu",         ["dien tu vien thong", "ky thuat dien tu", "tu dong hoa", "he thong dien",
                         "ky thuat dieu khien", "tin hoc cong nghiep", "robot", "nang luong tai tao"]),
    ("khoa_hoc_xa_hoi", ["xa hoi hoc", "xay dung dang", "chinh quyen nha nuoc",
                         "quan ly nha nuoc", "khoa hoc quan ly"]),
    ("xay_dung",        ["kien truc", "quy quy hoach", "xay dung", "xdct", "cau duong", "cap thoat nuoc"]),
    ("y_te",            ["dieu duong", "y sinh", "y khoa", "vat ly y khoa", "hoa duoc"]),
    ("thu_y",           ["thu y"]),
    ("nong_lam",        ["thuy san", "nong", "lam nghiep"]),
    ("moi_truong",      ["moi truong", "tai nguyen thien nhien", "tai nguyen va moi truong"]),
    ("san_xuat_che_bien", ["thuc pham", "det may", "det", "ky thuat in", "cong nghe che biến"]),
    ("khoa_hoc_su_song", ["cong nghe sinh hoc", "ky thuat sinh hoc"]),
    ("khoa_hoc_tu_nhien", ["hoa hoc", "vat ly", "vat lieu", "hat nhan"]),
    ("phap_luat",       ["luat"]),
    ("truyen_thong",    ["bao chi", "truyen thong", "luu tru hoc", "quan ly thong kho"]),
    ("nhan_van",        ["tieng anh", "ton giao hoc", "quoc te hoc"]),
    ("giao_duc",        ["su pham", "giao duc"]),
    ("du_lich",         ["du lich", "khach san"]),
    ("van_tai",         ["van tai"]),
    ("kinh_te",         ["kinh te", "tai chinh", "ngan hang", "ke toan", "quan tri kinh doanh",
                         "logistics", "chuoi cung ung", "phan tich kinh doanh", "quan ly cong nghiep",
                         "kinh doanh quoc te", "pohe", "quan ly xay dung", "he thong thong tin quan ly"]),
    ("ky_thuat",        ["ky thuat", "cong nghe ky thuat", "cnkt", "co khi", "co dien tu",
                         "che tao may", "o to", "hang khong", "nhiet"]),
]

SUBJECTS = {
    "A00": ("Toán", "Vật lý", "Hóa học"), "A01": ("Toán", "Vật lý", "Tiếng Anh"),
    "A02": ("Toán", "Vật lý", "Sinh học"), "A03": ("Toán", "Vật lý", "Lịch sử"),
    "A04": ("Toán", "Vật lý", "Địa lý"), "A05": ("Toán", "Hóa học", "Lịch sử"),
    "A06": ("Toán", "Hóa học", "Địa lý"), "A07": ("Toán", "Lịch sử", "Địa lý"),
    "B00": ("Toán", "Hóa học", "Sinh học"), "C00": ("Ngữ văn", "Lịch sử", "Địa lý"),
    "D01": ("Ngữ văn", "Toán", "Tiếng Anh"), "D07": ("Toán", "Hóa học", "Tiếng Anh"),
    "D08": ("Toán", "Sinh học", "Tiếng Anh"), "D09": ("Toán", "Lịch sử", "Tiếng Anh"),
    "D10": ("Toán", "Địa lý", "Tiếng Anh"), "D14": ("Ngữ văn", "Lịch sử", "Tiếng Anh"),
    "D15": ("Ngữ văn", "Địa lý", "Tiếng Anh"),
}

# ── BẢN VÁ: XỬ LÝ MÃ NGOẠI LỆ VÀ LỘT RÁC TÊN NGÀNH ──────────────────────────
HARDCODED_ALIASES = {
    "7860218_Nam_B_A00": "7860218_Nam_B",
    "7860218_Nam_B_A01": "7860218_Nam_B",
    "7860218_Nam_N_A00": "7860218_Nam_N",
    "7860218_Nam_N_A01": "7860218_Nam_N",
    "7860218_Nu_B_A00": "7860218_Nu_B",
    "7860218_Nu_B_A01": "7860218_Nu_B",
    "7860218_Nu_N_A00": "7860218_Nu_N",
    "7860218_Nu_N_A01": "7860218_Nu_N",
    "73101013": "7310101_3",
    "7540106DKD": "7540106DKK",
    "7540203DKD": "7540203DKK"
}

def clean_major_name_for_match(name: str) -> str:
    text = search_text(name)
    # Lột sạch các từ khóa dễ gây lệch chuỗi
    noise_words = r'\b(nganh|nhom nganh|chuyen nganh|thi sinh|nam|nu|vung|he|dai tra|clc|chat luong cao|chuong trinh)\b'
    text = re.sub(noise_words, ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

# ── CSV helpers ───────────────────────────────────────────────────────────────

def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

# ── Text utilities ────────────────────────────────────────────────────────────

def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()

def search_text(value: Any) -> str:
    text = clean_text(value).lower().replace("đ", "d")
    text = "".join(
        ch for ch in unicodedata.normalize("NFD", text)
        if unicodedata.category(ch) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", " ", text).strip()

def stable_uuid(*parts: Any) -> str:
    key = "|".join(clean_text(p) for p in parts)
    return str(uuid.uuid5(UUID_NAMESPACE, key))

def score_value(value: str) -> str | None:
    cleaned = clean_text(value).replace(",", ".")
    if not cleaned:
        return None
    try:
        s = float(cleaned)
    except ValueError:
        return None
    if s < 0:
        return None
    return f"{s:.2f}".rstrip("0").rstrip(".")

def source_int(value: str) -> int | str:
    cleaned = clean_text(value)
    return int(cleaned) if cleaned.isdigit() else ""

def major_field_code(major_code: str, major_name: str = "") -> str:
    code = clean_text(major_code)
    field = FIELD_BY_PREFIX.get(code[:3]) if code else None
    if field:
        return field
    norm = search_text(major_name)
    for field_code, keywords in FIELD_BY_NAME_KEYWORDS:
        if any(kw in norm for kw in keywords):
            return field_code
    return "khac"

def normalize_major_code(raw_code: str, fallback_code: str = "") -> str:
    text = clean_text(raw_code) or clean_text(fallback_code)
    if not text:
        return ""
    seven = re.findall(r"\b\d{7}\b", text)
    if seven:
        return seven[0]
    three = re.findall(r"\b\d{3}\b", text)
    if three:
        return three[0]
    m = re.search(r"[A-Za-z0-9_-]+", text)
    return m.group(0) if m else text

# ── Load course_catalog ───────────────────────────────────────────────────────

def load_course_catalog(
    input_dir: Path,
) -> dict[str, dict[str, dict[str, Any]]]:
    catalog_path = input_dir / "course_catalog.csv"
    if not catalog_path.exists():
        return {}

    catalog: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for row in read_csv(catalog_path):
        uni_code     = clean_text(row.get("university_short_name"))
        program_code = clean_text(row.get("program_source_code"))
        if not uni_code or not program_code:
            continue

        quota_raw = clean_text(row.get("quota", ""))
        catalog[uni_code][program_code] = {
            "program_source_code": program_code, # LƯU MÃ GỐC ĐỂ DÙNG TRONG LOOKUP
            "major_name":          clean_text(row.get("major_name")),
            "quota":               int(quota_raw) if quota_raw.isdigit() else None,
            "admission_methods":   [m for m in row.get("admission_methods", "").split(",") if m],
            "subject_groups":      [g for g in row.get("subject_groups", "").split(",") if g],
            "is_verified":         row.get("is_verified", "false").lower() == "true",
        }
    return dict(catalog)

# ── Hệ thống Khớp dữ liệu Nâng cao ───────────────────────────────────────────

def _extract_base_code(program_code: str) -> list[str]:
    code = str(program_code).strip()
    candidates = [code]
    
    # Ép kiểu cho các mã lỗi nhập liệu đã biết
    if code in HARDCODED_ALIASES:
        candidates.append(HARDCODED_ALIASES[code])
        
    if "," in code: candidates = [p.strip() for p in code.split(",") if p.strip()] + candidates
    if re.match(r"^\d{3,6}M$", code): candidates.append(code[:-1])
    if "_" in code: candidates.append(code.split("_")[0])
    m = re.match(r"^(\d{7})[^0-9_,]", code)
    if m: candidates.append(m.group(1))
    for trim in (1, 2):
        if code[:-trim]: candidates.append(code[:-trim])
    seen = set()
    return [c for c in candidates if not (c in seen or seen.add(c))]

def _reverse_lookup(
    uni_catalog: dict[str, dict[str, Any]],
    score_code: str,
) -> dict | None:
    for cat_code, entry in uni_catalog.items():
        if not cat_code.startswith(score_code):
            continue
        rest = cat_code[len(score_code):]
        if rest and not rest[0].isdigit():
            return entry
    return None

def catalog_lookup(catalog: dict, uni_code: str, program_code: str, major_name: str = "") -> dict | None:
    uni_cat = catalog.get(uni_code, {})
    if not uni_cat: return None
    
    for candidate in _extract_base_code(program_code):
        if candidate in uni_cat: return uni_cat[candidate]
        
    rev_entry = _reverse_lookup(uni_cat, program_code)
    if rev_entry: return rev_entry
    
    if major_name:
        score_norm = search_text(major_name).replace(" ", "")
        score_clean = clean_major_name_for_match(major_name)
        
        if score_norm:
            for entry in uni_cat.values():
                cat_name = entry.get("major_name", "")
                if cat_name and search_text(cat_name).replace(" ", "") == score_norm: return entry
            for entry in uni_cat.values():
                cat_name = entry.get("major_name", "")
                if cat_name:
                    cat_norm = search_text(cat_name).replace(" ", "")
                    if len(cat_norm) >= 6 and (cat_norm in score_norm or score_norm in cat_norm): return entry
                    
        # LOGIC MỚI: Khớp chính xác 100% tên sau khi đã lột rác
        if score_clean and len(score_clean) > 4:
            for entry in uni_cat.values():
                cat_name = entry.get("major_name", "")
                if cat_name:
                    cat_clean = clean_major_name_for_match(cat_name)
                    if cat_clean == score_clean:
                        return entry
                        
    return None

# ── Helpers ───────────────────────────────────────────────────────────────────

def build_legacy_field_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    rows = read_csv(path)
    candidates: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        normalized = normalize_major_code(row.get("code", ""))
        field_code = clean_text(row.get("field_code"))
        if not normalized or not field_code or field_code == "khac":
            continue
        candidates[normalized][field_code] += 1
    return {
        code: counter.most_common(1)[0][0]
        for code, counter in candidates.items() if counter
    }

def load_universities(path: Path) -> dict[str, dict[str, str]]:
    universities: dict[str, dict[str, str]] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [clean_text(p) for p in line.split("|")]
        if len(parts) < 4:
            continue
        name, url, uni_type, province_code = parts[:4]
        m = re.search(r"-([A-Z0-9]{2,8})\.html$", url)
        if not m:
            continue
        code = m.group(1)
        universities[code] = {
            "code":        code,
            "name":        name,
            "type":        uni_type,
            "province_id": str(PROVINCES.get(province_code, PROVINCES["HN"])["id"]),
            "is_active":   "true",
        }
    return universities

def pick_major_names(
    score_rows: list[dict[str, Any]],
    catalog: dict[str, dict[str, dict[str, Any]]],
) -> dict[str, str]:
    catalog_names: dict[str, str] = {}
    for uni_catalog in catalog.values():
        for program_code, entry in uni_catalog.items():
            major_code = normalize_major_code(program_code)
            if major_code and entry.get("major_name") and entry.get("is_verified"):
                catalog_names[major_code] = entry["major_name"]

    names: dict[str, Counter[str]] = defaultdict(Counter)
    for row in score_rows:
        major_code = clean_text(row.get("major_code"))
        major_name = clean_text(row.get("major_name"))
        if major_code and major_name:
            names[major_code][major_name] += 1

    result: dict[str, str] = {}
    all_codes = set(catalog_names) | set(names)
    for code in all_codes:
        if code in catalog_names:
            result[code] = catalog_names[code]
        elif code in names:
            result[code] = names[code].most_common(1)[0][0]
    return result

def build_subject_groups(
    raw_subject_rows: list[dict[str, str]],
    input_dir: Path,
    catalog: dict[str, dict[str, dict[str, Any]]],
) -> list[dict[str, Any]]:
    legacy_subjects: dict[str, tuple[str, str, str]] = {}
    legacy_path = input_dir / "subject_groups.csv"
    if legacy_path.exists():
        for row in read_csv(legacy_path):
            code = clean_text(row.get("code", "")).upper()
            s1, s2, s3 = (clean_text(row.get(f"subject_{i}")) for i in (1, 2, 3))
            if code and s1 and s2 and s3:
                legacy_subjects[code] = (s1, s2, s3)

    catalog_verified_groups: set[str] = set()
    for uni_catalog in catalog.values():
        for entry in uni_catalog.values():
            if entry.get("is_verified"):
                catalog_verified_groups.update(entry.get("subject_groups", []))

    codes = {clean_text(row.get("subject_group_code", "")).upper() for row in raw_subject_rows}
    output = []
    for code in sorted(c for c in codes if c):
        subjects = legacy_subjects.get(code) or SUBJECTS.get(code)
        is_verified = subjects is not None or code in catalog_verified_groups
        if subjects:
            s1, s2, s3 = subjects
        else:
            s1 = s2 = s3 = ""
        output.append({
            "code":         code,
            "subject_1":    s1,
            "subject_2":    s2,
            "subject_3":    s3,
            "display_name": f"Tổ hợp {code}" if not subjects else code,
            "is_verified":  "true" if is_verified else "false",
        })
    return output

def build_admission_methods(input_dir: Path) -> list[dict[str, str]]:
    existing = input_dir / "admission_methods.csv"
    if existing.exists():
        rows = read_csv(existing)
        return [
            {
                "code":        clean_text(row.get("code")),
                "name":        clean_text(row.get("name")),
                "description": clean_text(row.get("description")),
            }
            for row in rows if clean_text(row.get("code"))
        ]
    return [
        {"code": "THPT",      "name": "Ket qua thi THPT Quoc gia",          "description": ""},
        {"code": "HSA",       "name": "Xet hoc ba THPT",                     "description": ""},
        {"code": "DGNL_HN",   "name": "Danh gia nang luc DHQG Ha Noi",       "description": ""},
        {"code": "DGNL_HCM",  "name": "Danh gia nang luc DHQG TP.HCM",       "description": ""},
        {"code": "DGTD",      "name": "Danh gia tu duy",                     "description": ""},
        {"code": "KH",        "name": "Xet tuyen ket hop",                   "description": ""},
        {"code": "XTT",       "name": "Xet tuyen thang",                     "description": ""},
        {"code": "OTHER",     "name": "Phuong thuc khac",                    "description": ""},
    ]

# ── Main clean() ──────────────────────────────────────────────────────────────

def clean(input_dir: Path, output_dir: Path, universities_file: Path) -> None:
    raw_scores   = read_csv(input_dir / "admission_scores.csv")
    raw_subjects = read_csv(input_dir / "major_subject_groups.csv")
    universities = load_universities(universities_file)

    catalog = load_course_catalog(input_dir)
    has_catalog = bool(catalog)
    if has_catalog:
        total_catalog = sum(len(v) for v in catalog.values())
        print(f"Đã load course_catalog: {len(catalog)} trường, {total_catalog} ngành")
    else:
        print("Không tìm thấy course_catalog.csv — chạy không có catalog reference")

    # ── Clean scores ──────────────────────────────────────────────────────────
    clean_scores: list[dict[str, Any]] = []
    seen_scores: set[tuple[str, ...]] = set()

    for row in raw_scores:
        score        = score_value(row.get("score", ""))
        source_id    = clean_text(row.get("source_id"))
        uni_code     = clean_text(row.get("university_short_name"))
        program_code = clean_text(row.get("program_source_code"))
        major_code   = normalize_major_code(row.get("major_code", ""), program_code)
        method_code  = clean_text(row.get("admission_method_code")) or "OTHER"
        year         = clean_text(row.get("year"))

        if not score or not source_id or not uni_code or not program_code or not major_code or not year:
            continue

        key = (uni_code, year, method_code, program_code, source_id)
        if key in seen_scores:
            continue
        seen_scores.add(key)

        major_name_raw = clean_text(row.get("major_name"))
        catalog_entry = catalog_lookup(catalog, uni_code, program_code, major_name_raw)
        
        major_name = (
            catalog_entry["major_name"]
            if catalog_entry and catalog_entry.get("major_name")
            else major_name_raw
        )

        # Chặn copy quota tại điểm chuẩn nếu không khớp chính xác
        quota = ""
        if catalog_entry:
            base_code = catalog_entry.get("program_source_code", "")
            if base_code == program_code and catalog_entry.get("quota") is not None:
                quota = catalog_entry["quota"]

        clean_scores.append({
            **row,
            "source_id":             source_id,
            "source_school_id":      source_int(row.get("source_school_id", "")),
            "source_method_id":      source_int(row.get("source_method_id", "")),
            "university_short_name": uni_code,
            "university_name":       clean_text(row.get("university_name")),
            "program_source_code":   program_code,
            "major_code":            major_code,
            "major_name":            major_name,
            "admission_method_code": method_code,
            "admission_method_name": clean_text(row.get("admission_method_name")),
            "year":                  int(year),
            "score":                 score,
            "note":                  clean_text(row.get("note")),
            "quota":                 quota,
        })

    # ── Major catalog ─────────────────────────────────────────────────────────
    major_names      = pick_major_names(clean_scores, catalog)
    legacy_field_map = build_legacy_field_map(input_dir / "major_catalog.csv")
    major_catalog_rows = [
        {
            "code":        code,
            "name":        name,
            "field_code":  legacy_field_map.get(code) or major_field_code(code, name),
            "description": "",
        }
        for code, name in sorted(major_names.items())
    ]

    # ── University programs ───────────────────────────────────────────────────
    program_map:          dict[tuple[str, str], str] = {}
    program_name_counter: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    program_meta:         dict[tuple[str, str], dict[str, Any]] = {}

    if has_catalog:
        for uni_code_cat, uni_programs_cat in catalog.items():
            for program_code_cat, cat_entry in uni_programs_cat.items():
                key = (uni_code_cat, program_code_cat)
                program_map[key] = stable_uuid(SOURCE, *key)
                major_code_cat = normalize_major_code(program_code_cat)
                program_meta.setdefault(key, {
                    "id":                    program_map[key],
                    "university_short_name": uni_code_cat,
                    "major_code":            major_code_cat,
                    "program_source_code":   program_code_cat,
                    "source":                SOURCE,
                    "source_school_id":      "",
                    "is_active":             "true",
                })
                if cat_entry.get("major_name"):
                    program_name_counter[key][cat_entry["major_name"]] += 1

    for row in clean_scores:
        key = (row["university_short_name"], row["program_source_code"])
        program_map[key] = stable_uuid(SOURCE, *key)
        program_name_counter[key][row["major_name"]] += 1
        program_meta.setdefault(key, {
            "id":                    program_map[key],
            "university_short_name": row["university_short_name"],
            "major_code":            row["major_code"],
            "program_source_code":   row["program_source_code"],
            "source":                SOURCE,
            "source_school_id":      row.get("source_school_id", ""),
            "is_active":             "true",
        })
        if row.get("source_school_id"):
            program_meta[key]["source_school_id"] = row.get("source_school_id", "")

    # ── TÁCH FILE COMPLETE & MISSING LOGIC (MỚI) ──
    program_rows_complete: list[dict[str, Any]] = []
    program_rows_missing: list[dict[str, Any]] = []

    for key, meta in sorted(program_meta.items()):
        uni_code, program_code = key
        counter      = program_name_counter[key]
        
        major_name_raw = counter.most_common(1)[0][0] if counter else ""
        catalog_entry = catalog_lookup(catalog, uni_code, program_code, major_name_raw)

        quota = ""
        missing_reason = ""
        base_code = ""

        if catalog_entry:
            base_code = catalog_entry.get("program_source_code", "")
            # Phân biệt dòng gốc và dòng biến thể lịch sử
            is_exact_match = (base_code == program_code)
            
            if is_exact_match:
                cat_quota = catalog_entry.get("quota")
                if cat_quota == 0:
                    quota = 0
                    missing_reason = "1. Dữ liệu crawl ra Quota = 0"
                elif cat_quota is None or cat_quota == "":
                    missing_reason = "2. Không crawl được (Web trống dữ liệu Quota)"
                else:
                    quota = cat_quota
            else:
                missing_reason = "3. Dữ liệu quá khứ (Mã nhánh/Biến thể của hệ thống cũ)"
                quota = "" # Đảm bảo xóa quota để không lặp kép
        else:
            missing_reason = "3. Dữ liệu quá khứ (Ngành đã khai tử, năm nay không tuyển)"
            quota = ""

        if not major_name_raw:
            missing_reason = "Thiếu tên ngành | " + (missing_reason if missing_reason else "")

        row_data = {
            **meta,
            "program_name": major_name_raw,
            "quota":        quota,
        }

        # Nếu bị xếp vào diện Missing Data
        if not major_name_raw or quota == "" or quota == 0:
            row_data["missing_reason"] = missing_reason
            row_data["base_program_code"] = base_code
            program_rows_missing.append(row_data)
        else:
            program_rows_complete.append(row_data)

    # ── Admission scores (import) ─────────────────────────────────────────────
    score_import_rows: list[dict[str, Any]] = []
    for row in clean_scores:
        program_id = program_map[(row["university_short_name"], row["program_source_code"])]
        score_import_rows.append({
            "id":                   stable_uuid(SOURCE, row["source_id"]),
            "university_program_id": program_id,
            "admission_method_code": row["admission_method_code"],
            "year":                 row["year"],
            "score":                row["score"],
            "note":                 row["note"],
            "source":               SOURCE,
            "source_id":            source_int(row["source_id"]),
            "source_method_id":     row.get("source_method_id", ""),
            "source_method_name":   row["admission_method_name"],
        })

    # ── Subject groups ────────────────────────────────────────────────────────
    valid_programs = set(program_map)
    program_subject_seen: set[tuple[str, str]] = set()
    major_subject_seen:   set[tuple[str, str]] = set()
    program_subject_rows: list[dict[str, Any]] = []
    major_subject_rows:   list[dict[str, Any]] = []

    for row in raw_subjects:
        key          = (clean_text(row.get("university_short_name")), clean_text(row.get("program_source_code")))
        subject_code = clean_text(row.get("subject_group_code", "")).upper()
        if key not in valid_programs or not subject_code:
            continue

        program_id  = program_map[key]
        subject_key = (program_id, subject_code)
        if subject_key not in program_subject_seen:
            program_subject_seen.add(subject_key)
            program_subject_rows.append({
                "university_program_id": program_id,
                "subject_group_code":    subject_code,
            })

        major_code       = normalize_major_code(row.get("major_code", ""))
        major_subj_key   = (major_code, subject_code)
        if major_code and major_subj_key not in major_subject_seen:
            major_subject_seen.add(major_subj_key)
            major_subject_rows.append({
                "major_code":         major_code,
                "subject_group_code": subject_code,
            })

    if has_catalog:
        for uni_code_cat, uni_programs_cat in catalog.items():
            for program_code_cat, cat_entry in uni_programs_cat.items():
                key = (uni_code_cat, program_code_cat)
                if key not in program_map:
                    continue
                program_id = program_map[key]
                for subject_code in cat_entry.get("subject_groups", []):
                    subject_code = subject_code.upper().strip()
                    if not subject_code:
                        continue
                    subject_key = (program_id, subject_code)
                    if subject_key not in program_subject_seen:
                        program_subject_seen.add(subject_key)
                        program_subject_rows.append({
                            "university_program_id": program_id,
                            "subject_group_code":    subject_code,
                        })

    # ── Ghi output ────────────────────────────────────────────────────────────
    all_uni_codes = {r["university_short_name"] for r in clean_scores} | set(catalog.keys())
    university_rows    = [universities[c] for c in sorted(all_uni_codes) if c in universities]
    subject_group_rows = build_subject_groups(raw_subjects, input_dir, catalog)
    unresolved_majors  = [r for r in major_catalog_rows if r["field_code"] == "khac"]

    unmatched_programs: list[dict[str, Any]] = []
    seen_unmatched: set[tuple[str,str]] = set()
    if has_catalog:
        for row in clean_scores:
            uni_code     = row["university_short_name"]
            program_code = row["program_source_code"]
            dedup = (uni_code, program_code)
            if dedup in seen_unmatched:
                continue
            
            if uni_code in catalog and catalog_lookup(catalog, uni_code, program_code, row["major_name"]) is None:
                seen_unmatched.add(dedup)
                uni_cat = catalog.get(uni_code, {})
                has_suffix_base = any(
                    program_code.lower().startswith(c.lower()) and program_code != c
                    for c in uni_cat
                )
                reason = (
                    "suffix code không khớp catalog (base code tồn tại)"
                    if has_suffix_base
                    else "program_code không có trong course_catalog"
                )
                unmatched_programs.append({
                    "university_short_name": uni_code,
                    "program_source_code":   program_code,
                    "major_name_from_score": row["major_name"],
                    "year":                  row["year"],
                    "reason":                reason,
                })

    write_csv(output_dir / "provinces.csv",
              ["id", "code", "name", "region"],
              sorted(PROVINCES.values(), key=lambda r: r["id"]))

    write_csv(output_dir / "universities.csv",
              ["name", "code", "type", "province_id", "is_active"],
              university_rows)

    write_csv(output_dir / "admission_methods.csv",
              ["code", "name", "description"],
              build_admission_methods(input_dir))

    write_csv(output_dir / "subject_groups.csv",
              ["code", "subject_1", "subject_2", "subject_3", "display_name", "is_verified"],
              subject_group_rows)

    write_csv(output_dir / "major_catalog.csv",
              ["code", "name", "field_code", "description"],
              major_catalog_rows)

    write_csv(output_dir / "major_code_aliases.csv",
              ["old_code", "new_code", "effective_year", "reason", "is_verified"],
              [])

    write_csv(output_dir / "major_subject_groups.csv",
              ["major_code", "subject_group_code"],
              major_subject_rows)

    # Ghi file chứa các ngành ĐẦY ĐỦ thông tin
    write_csv(output_dir / "university_programs_complete.csv",
              ["id", "university_short_name", "major_code", "program_source_code",
               "program_name", "quota", "source", "source_school_id", "is_active"],
              program_rows_complete)

    # Ghi file chứa các ngành BỊ THIẾU thông tin (Có thêm lý do và truy vết mã gốc)
    write_csv(output_dir / "university_programs_missing.csv",
              ["id", "university_short_name", "major_code", "program_source_code",
               "program_name", "quota", "missing_reason", "base_program_code", "source", "source_school_id", "is_active"],
              program_rows_missing)

    write_csv(output_dir / "university_program_subject_groups.csv",
              ["university_program_id", "subject_group_code"],
              program_subject_rows)

    write_csv(output_dir / "admission_scores.csv",
              ["id", "university_program_id", "admission_method_code", "year",
               "score", "note", "source", "source_id", "source_method_id", "source_method_name"],
              score_import_rows)

    write_csv(output_dir / "review_unresolved_major_fields.csv",
              ["code", "name", "field_code", "description"],
              unresolved_majors)

    write_csv(output_dir / "review_unmatched_programs.csv",
              ["university_short_name", "program_source_code", "major_name_from_score", "year", "reason"],
              unmatched_programs)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"Clean scores       : {len(score_import_rows)}")
    print(f"Programs (Complete): {len(program_rows_complete)} → university_programs_complete.csv")
    print(f"Programs (Missing) : {len(program_rows_missing)} → university_programs_missing.csv")
    print(f"Program-subject    : {len(program_subject_rows)}")
    print(f"Major-subject      : {len(major_subject_rows)}")
    print(f"Subject groups     : {len(subject_group_rows)}")
    print(f"Unresolved fields  : {len(unresolved_majors)}  → review_unresolved_major_fields.csv")
    print(f"Unmatched programs : {len(unmatched_programs)} → review_unmatched_programs.csv")
    print(f"Output             : {output_dir}")

# ── Entry point ───────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean Tuyensinh247 crawler CSVs for DB import.")
    parser.add_argument("--input-dir",         type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-dir",        type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--universities-file", type=Path, default=DEFAULT_UNIVERSITIES_FILE)
    return parser.parse_args()

def main() -> int:
    args = parse_args()
    clean(args.input_dir, args.output_dir, args.universities_file)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())