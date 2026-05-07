"""
Clean Tuyensinh247 crawler CSVs into database import CSVs.

Input defaults:
    datav2/bunik_crawl_output/admission_scores.csv
    datav2/bunik_crawl_output/major_subject_groups.csv
    datav2/universities.txt

Output defaults:
    datav2/bunik_crawl_output/clean_import/*.csv
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


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_DIR = BASE_DIR / "bunik_crawl_output"
DEFAULT_OUTPUT_DIR = DEFAULT_INPUT_DIR / "clean_import"
DEFAULT_UNIVERSITIES_FILE = BASE_DIR / "universities.txt"
SOURCE = "tuyensinh247"
UUID_NAMESPACE = uuid.UUID("6de5f8e4-2d5b-48f6-a2fb-e5d5ab0c4127")
PROVINCES = {
    "HN": {"id": 1, "code": "HN", "name": "Hà Nội", "region": "Bắc"},
}


FIELD_BY_PREFIX = {
    "714": "giao_duc",
    "721": "nghe_thuat",
    "722": "nhan_van",
    "731": "khoa_hoc_xa_hoi",
    "732": "truyen_thong",
    "734": "kinh_te",
    "738": "phap_luat",
    "742": "khoa_hoc_su_song",
    "744": "khoa_hoc_tu_nhien",
    "746": "toan_va_thong_ke",
    "748": "cntt",
    "751": "dien_tu",
    "752": "ky_thuat",
    "754": "san_xuat_che_bien",
    "758": "xay_dung",
    "762": "nong_lam",
    "764": "thu_y",
    "772": "y_te",
    "776": "xa_hoi",
    "781": "du_lich",
    "784": "van_tai",
    "785": "moi_truong",
    "786": "an_ninh",
    "220": "nhan_van",
    "340": "kinh_te",
    "380": "phap_luat",
    "480": "cntt",
    "520": "ky_thuat",
    "620": "nong_lam",
    "640": "thu_y",
    "860": "an_ninh",
    "861": "an_ninh",
}

FIELD_BY_NAME_KEYWORDS = [
    (
        "cntt",
        [
            "cong nghe thong tin",
            "khoa hoc may tinh",
            "may tinh",
            "mang may tinh",
            "an toan khong gian so",
            "cyber security",
            "he thong nhung",
            "iot",
            "toan tin",
        ],
    ),
    (
        "dien_tu",
        [
            "dien tu vien thong",
            "ky thuat dien tu",
            "tu dong hoa",
            "he thong dien",
            "ky thuat dieu khien",
            "tin hoc cong nghiep",
            "robot",
            "nang luong tai tao",
        ],
    ),
    (
        "khoa_hoc_xa_hoi",
        ["xa hoi hoc", "xay dung dang", "chinh quyen nha nuoc", "quan ly nha nuoc", "khoa hoc quan ly"],
    ),
    ("xay_dung", ["kien truc", "quy hoach", "xay dung", "xdct", "cau duong", "cap thoat nuoc"]),
    ("y_te", ["dieu duong", "y sinh", "y khoa", "vat ly y khoa", "hoa duoc"]),
    ("thu_y", ["thu y"]),
    ("nong_lam", ["thuy san", "nong", "lam nghiep"]),
    ("moi_truong", ["moi truong", "tai nguyen thien nhien", "tai nguyen va moi truong"]),
    ("san_xuat_che_bien", ["thuc pham", "det may", "det", "ky thuat in", "cong nghe che bien"]),
    ("khoa_hoc_su_song", ["cong nghe sinh hoc", "ky thuat sinh hoc"]),
    ("khoa_hoc_tu_nhien", ["hoa hoc", "vat ly", "vat lieu", "hat nhan"]),
    ("phap_luat", ["luat"]),
    ("truyen_thong", ["bao chi", "truyen thong", "luu tru hoc", "quan ly thong tin"]),
    ("nhan_van", ["tieng anh", "ton giao hoc", "quoc te hoc"]),
    ("giao_duc", ["su pham", "giao duc"]),
    ("du_lich", ["du lich", "khach san"]),
    ("van_tai", ["van tai"]),
    (
        "kinh_te",
        [
            "kinh te",
            "tai chinh",
            "ngan hang",
            "ke toan",
            "quan tri kinh doanh",
            "logistics",
            "chuoi cung ung",
            "phan tich kinh doanh",
            "quan ly cong nghiep",
            "kinh doanh quoc te",
            "pohe",
            "quan ly xay dung",
            "he thong thong tin quan ly",
        ],
    ),
    (
        "ky_thuat",
        ["ky thuat", "cong nghe ky thuat", "cnkt", "co khi", "co dien tu", "che tao may", "o to", "hang khong", "nhiet"],
    ),
]


SUBJECTS = {
    "A00": ("Toán", "Vật lý", "Hóa học"),
    "A01": ("Toán", "Vật lý", "Tiếng Anh"),
    "A02": ("Toán", "Vật lý", "Sinh học"),
    "A03": ("Toán", "Vật lý", "Lịch sử"),
    "A04": ("Toán", "Vật lý", "Địa lý"),
    "A05": ("Toán", "Hóa học", "Lịch sử"),
    "A06": ("Toán", "Hóa học", "Địa lý"),
    "A07": ("Toán", "Lịch sử", "Địa lý"),
    "A08": ("Toán", "Lịch sử", "Giáo dục công dân"),
    "A09": ("Toán", "Địa lý", "Giáo dục công dân"),
    "A10": ("Toán", "Vật lý", "Giáo dục công dân"),
    "A11": ("Toán", "Hóa học", "Giáo dục công dân"),
    "A12": ("Toán", "Khoa học tự nhiên", "Khoa học xã hội"),
    "A14": ("Toán", "Khoa học tự nhiên", "Địa lý"),
    "A15": ("Toán", "Khoa học tự nhiên", "Giáo dục công dân"),
    "A16": ("Toán", "Khoa học tự nhiên", "Ngữ văn"),
    "B00": ("Toán", "Hóa học", "Sinh học"),
    "B01": ("Toán", "Sinh học", "Lịch sử"),
    "B02": ("Toán", "Sinh học", "Địa lý"),
    "B03": ("Toán", "Sinh học", "Ngữ văn"),
    "B04": ("Toán", "Sinh học", "Giáo dục công dân"),
    "B08": ("Toán", "Sinh học", "Tiếng Anh"),
    "C00": ("Ngữ văn", "Lịch sử", "Địa lý"),
    "C01": ("Ngữ văn", "Toán", "Vật lý"),
    "C02": ("Ngữ văn", "Toán", "Hóa học"),
    "C03": ("Ngữ văn", "Toán", "Lịch sử"),
    "C04": ("Ngữ văn", "Toán", "Địa lý"),
    "C05": ("Ngữ văn", "Vật lý", "Hóa học"),
    "C06": ("Ngữ văn", "Vật lý", "Sinh học"),
    "C07": ("Ngữ văn", "Vật lý", "Lịch sử"),
    "C08": ("Ngữ văn", "Hóa học", "Sinh học"),
    "C09": ("Ngữ văn", "Vật lý", "Địa lý"),
    "C10": ("Ngữ văn", "Hóa học", "Lịch sử"),
    "C14": ("Ngữ văn", "Toán", "Giáo dục công dân"),
    "C15": ("Ngữ văn", "Toán", "Khoa học xã hội"),
    "C19": ("Ngữ văn", "Lịch sử", "Giáo dục công dân"),
    "C20": ("Ngữ văn", "Địa lý", "Giáo dục công dân"),
    "D01": ("Ngữ văn", "Toán", "Tiếng Anh"),
    "D07": ("Toán", "Hóa học", "Tiếng Anh"),
    "D08": ("Toán", "Sinh học", "Tiếng Anh"),
    "D09": ("Toán", "Lịch sử", "Tiếng Anh"),
    "D10": ("Toán", "Địa lý", "Tiếng Anh"),
    "D14": ("Ngữ văn", "Lịch sử", "Tiếng Anh"),
    "D15": ("Ngữ văn", "Địa lý", "Tiếng Anh"),
    "D66": ("Ngữ văn", "Giáo dục công dân", "Tiếng Anh"),
    "D78": ("Ngữ văn", "Khoa học xã hội", "Tiếng Anh"),
    "D90": ("Toán", "Khoa học tự nhiên", "Tiếng Anh"),
    "D96": ("Toán", "Khoa học xã hội", "Tiếng Anh"),
    "D83": ("Ngữ văn", "Khoa học xã hội", "Tiếng Trung"),
    "H05": ("Ngữ văn", "Khoa học xã hội", "Vẽ Năng khiếu"),
    "K01": ("Toán", "Tiếng Anh", "Tin học"),
    "K02": ("Toán", "Đọc hiểu", "Tiếng Anh"),
    "R05": ("Ngữ văn", "Tiếng Anh", "Năng khiếu báo chí"),
    "R06": ("Ngữ văn", "Khoa học tự nhiên", "Năng khiếu báo chí"),
    "R07": ("Ngữ văn", "Toán", "Năng khiếu ảnh báo chí"),
    "R08": ("Ngữ văn", "Tiếng Anh", "Năng khiếu ảnh báo chí"),
    "R09": ("Ngữ văn", "Khoa học tự nhiên", "Năng khiếu ảnh báo chí"),
    "R11": ("Ngữ văn", "Toán", "Năng khiếu quay phim truyền hình"),
    "R12": ("Ngữ văn", "Tiếng Anh", "Năng khiếu quay phim truyền hình"),
    "R13": ("Ngữ văn", "Khoa học tự nhiên", "Năng khiếu quay phim truyền hình"),
    "R15": ("Ngữ văn", "Toán", "Năng khiếu báo chí"),
    "R16": ("Ngữ văn", "Khoa học xã hội", "Năng khiếu báo chí"),
    "R17": ("Ngữ văn", "Khoa học xã hội", "Năng khiếu ảnh báo chí"),
    "R18": ("Ngữ văn", "Khoa học xã hội", "Năng khiếu quay phim truyền hình"),
    "R19": ("Ngữ văn", "Điểm quy đổi chứng chỉ Tiếng Anh", "Năng khiếu báo chí"),
    "R20": ("Ngữ văn", "Điểm quy đổi chứng chỉ Tiếng Anh", "Năng khiếu ảnh báo chí"),
    "R21": ("Ngữ văn", "Điểm quy đổi chứng chỉ Tiếng Anh", "Năng khiếu quay phim truyền hình"),
    "R24": ("Ngữ văn", "Toán", "Điểm quy đổi chứng chỉ Tiếng Anh"),
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()


def search_text(value: Any) -> str:
    text = clean_text(value).lower().replace("đ", "d")
    text = "".join(
        char
        for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def stable_uuid(*parts: Any) -> str:
    key = "|".join(clean_text(part) for part in parts)
    return str(uuid.uuid5(UUID_NAMESPACE, key))


def score_value(value: str) -> str | None:
    cleaned = clean_text(value).replace(",", ".")
    if not cleaned:
        return None
    try:
        score = float(cleaned)
    except ValueError:
        return None
    if score < 0:
        return None
    return f"{score:.2f}".rstrip("0").rstrip(".")


def source_int(value: str) -> int | str:
    cleaned = clean_text(value)
    return int(cleaned) if cleaned.isdigit() else ""


def major_field_code(major_code: str, major_name: str = "") -> str:
    code = clean_text(major_code)
    field_code = FIELD_BY_PREFIX.get(code[:3]) if code else None
    if field_code:
        return field_code

    normalized_name = search_text(major_name)
    for field_code, keywords in FIELD_BY_NAME_KEYWORDS:
        if any(keyword in normalized_name for keyword in keywords):
            return field_code
    return "khac"


def normalize_major_code(raw_code: str, fallback_code: str = "") -> str:
    text = clean_text(raw_code)
    if not text:
        text = clean_text(fallback_code)
    if not text:
        return ""

    # Prefer canonical 7-digit education codes when present.
    seven_digit = re.findall(r"\b\d{7}\b", text)
    if seven_digit:
        return seven_digit[0]

    # Then support older 3-digit codes used in some legacy rows.
    three_digit = re.findall(r"\b\d{3}\b", text)
    if three_digit:
        return three_digit[0]

    # Fall back to the first clean token.
    token_match = re.search(r"[A-Za-z0-9_-]+", text)
    if token_match:
        return token_match.group(0)
    return text


def build_legacy_field_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    rows = read_csv(path)
    candidates: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        normalized = normalize_major_code(row.get("code", ""))
        field_code = clean_text(row.get("field_code"))
        if not normalized or not field_code:
            continue
        if field_code == "khac":
            continue
        candidates[normalized][field_code] += 1
    return {
        code: counter.most_common(1)[0][0]
        for code, counter in candidates.items()
        if counter
    }


def load_universities(path: Path) -> dict[str, dict[str, str]]:
    universities: dict[str, dict[str, str]] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [clean_text(part) for part in line.split("|")]
        if len(parts) < 4:
            continue
        name, url, uni_type, province_code = parts[:4]
        match = re.search(r"-([A-Z0-9]{2,8})\.html$", url)
        if not match:
            continue
        code = match.group(1)
        universities[code] = {
            "code": code,
            "name": name,
            "type": uni_type,
            "province_id": str(PROVINCES.get(province_code, PROVINCES["HN"])["id"]),
            "is_active": "true",
        }
    return universities


def pick_major_names(score_rows: list[dict[str, str]]) -> dict[str, str]:
    names: dict[str, Counter[str]] = defaultdict(Counter)
    for row in score_rows:
        major_code = clean_text(row.get("major_code"))
        major_name = clean_text(row.get("major_name"))
        if major_code and major_name:
            names[major_code][major_name] += 1
    return {code: counter.most_common(1)[0][0] for code, counter in names.items()}


def build_subject_groups(raw_subject_rows: list[dict[str, str]], input_dir: Path) -> list[dict[str, Any]]:
    legacy_subjects: dict[str, tuple[str, str, str]] = {}
    legacy_path = input_dir / "subject_groups.csv"
    if legacy_path.exists():
        for row in read_csv(legacy_path):
            code = clean_text(row.get("code")).upper()
            subject_1 = clean_text(row.get("subject_1"))
            subject_2 = clean_text(row.get("subject_2"))
            subject_3 = clean_text(row.get("subject_3"))
            if code and subject_1 and subject_2 and subject_3:
                legacy_subjects[code] = (subject_1, subject_2, subject_3)

    codes = {clean_text(row.get("subject_group_code")).upper() for row in raw_subject_rows}
    output = []
    for code in sorted(c for c in codes if c):
        subjects = legacy_subjects.get(code) or SUBJECTS.get(code)
        if subjects:
            subject_1, subject_2, subject_3 = subjects
            output.append(
                {
                    "code": code,
                    "subject_1": subject_1,
                    "subject_2": subject_2,
                    "subject_3": subject_3,
                    "display_name": code,
                    "is_verified": "true",
                }
            )
        else:
            output.append(
                {
                    "code": code,
                    "subject_1": "",
                    "subject_2": "",
                    "subject_3": "",
                    "display_name": f"Tổ hợp {code}",
                    "is_verified": "false",
                }
            )
    return output


def build_admission_methods(input_dir: Path) -> list[dict[str, str]]:
    existing = input_dir / "admission_methods.csv"
    if existing.exists():
        rows = read_csv(existing)
        return [
            {
                "code": clean_text(row.get("code")),
                "name": clean_text(row.get("name")),
                "description": clean_text(row.get("description")),
            }
            for row in rows
            if clean_text(row.get("code"))
        ]
    return [
        {"code": "THPT", "name": "Ket qua thi THPT Quoc gia", "description": ""},
        {"code": "HSA", "name": "Xet hoc ba THPT", "description": ""},
        {"code": "DGNL_HN", "name": "Danh gia nang luc DHQG Ha Noi", "description": ""},
        {"code": "DGNL_HCM", "name": "Danh gia nang luc DHQG TP.HCM", "description": ""},
        {"code": "DGTD", "name": "Danh gia tu duy", "description": ""},
        {"code": "KH", "name": "Xet tuyen ket hop", "description": ""},
        {"code": "XTT", "name": "Xet tuyen thang", "description": ""},
        {"code": "OTHER", "name": "Phuong thuc khac", "description": ""},
    ]


def clean(input_dir: Path, output_dir: Path, universities_file: Path) -> None:
    raw_scores = read_csv(input_dir / "admission_scores.csv")
    raw_subjects = read_csv(input_dir / "major_subject_groups.csv")
    universities = load_universities(universities_file)

    clean_scores = []
    seen_scores: set[tuple[str, str, str, str, str]] = set()
    for row in raw_scores:
        score = score_value(row.get("score", ""))
        source_id = clean_text(row.get("source_id"))
        university_code = clean_text(row.get("university_short_name"))
        program_code = clean_text(row.get("program_source_code"))
        major_code = normalize_major_code(row.get("major_code", ""), program_code)
        method_code = clean_text(row.get("admission_method_code")) or "OTHER"
        year = clean_text(row.get("year"))
        if not score or not source_id or not university_code or not program_code or not major_code or not year:
            continue
        key = (university_code, year, method_code, program_code, source_id)
        if key in seen_scores:
            continue
        seen_scores.add(key)
        clean_scores.append(
            {
                **row,
                "source_id": source_id,
                "source_school_id": source_int(row.get("source_school_id", "")),
                "source_method_id": source_int(row.get("source_method_id", "")),
                "university_short_name": university_code,
                "university_name": clean_text(row.get("university_name")),
                "program_source_code": program_code,
                "major_code": major_code,
                "major_name": clean_text(row.get("major_name")),
                "admission_method_code": method_code,
                "admission_method_name": clean_text(row.get("admission_method_name")),
                "year": int(year),
                "score": score,
                "note": clean_text(row.get("note")),
            }
        )

    major_names = pick_major_names(clean_scores)
    legacy_field_map = build_legacy_field_map(input_dir / "major_catalog.csv")
    major_catalog_rows = [
        {
            "code": code,
            "name": name,
            "field_code": legacy_field_map.get(code) or major_field_code(code, name),
            "description": "",
        }
        for code, name in sorted(major_names.items())
    ]

    program_map: dict[tuple[str, str], str] = {}
    program_name_counter: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    program_meta: dict[tuple[str, str], dict[str, Any]] = {}
    for row in clean_scores:
        key = (row["university_short_name"], row["program_source_code"])
        program_map[key] = stable_uuid(SOURCE, *key)
        program_name_counter[key][row["major_name"]] += 1
        program_meta.setdefault(
            key,
            {
                "id": program_map[key],
                "university_short_name": row["university_short_name"],
                "major_code": row["major_code"],
                "program_source_code": row["program_source_code"],
                "source": SOURCE,
                "source_school_id": row.get("source_school_id", ""),
                "is_active": "true",
            },
        )

    program_rows = []
    for key, meta in sorted(program_meta.items()):
        counter = program_name_counter[key]
        program_rows.append({**meta, "program_name": counter.most_common(1)[0][0] if counter else ""})

    score_import_rows = []
    for row in clean_scores:
        program_id = program_map[(row["university_short_name"], row["program_source_code"])]
        source_id = source_int(row["source_id"])
        score_import_rows.append(
            {
                "id": stable_uuid(SOURCE, row["source_id"]),
                "university_program_id": program_id,
                "admission_method_code": row["admission_method_code"],
                "year": row["year"],
                "score": row["score"],
                "note": row["note"],
                "source": SOURCE,
                "source_id": source_id,
                "source_method_id": row.get("source_method_id", ""),
                "source_method_name": row["admission_method_name"],
            }
        )

    valid_programs = set(program_map)
    program_subject_seen: set[tuple[str, str]] = set()
    major_subject_seen: set[tuple[str, str]] = set()
    program_subject_rows = []
    major_subject_rows = []
    for row in raw_subjects:
        key = (clean_text(row.get("university_short_name")), clean_text(row.get("program_source_code")))
        subject_code = clean_text(row.get("subject_group_code")).upper()
        if key not in valid_programs or not subject_code:
            continue
        program_id = program_map[key]
        subject_key = (program_id, subject_code)
        if subject_key in program_subject_seen:
            continue
        program_subject_seen.add(subject_key)
        program_subject_rows.append(
            {
                "university_program_id": program_id,
                "subject_group_code": subject_code,
            }
        )
        major_code = normalize_major_code(row.get("major_code", ""))
        major_subject_key = (major_code, subject_code)
        if major_code and major_subject_key not in major_subject_seen:
            major_subject_seen.add(major_subject_key)
            major_subject_rows.append(
                {
                    "major_code": major_code,
                    "subject_group_code": subject_code,
                }
            )

    university_rows = [
        universities[code]
        for code in sorted({row["university_short_name"] for row in clean_scores})
        if code in universities
    ]
    subject_group_rows = build_subject_groups(raw_subjects, input_dir)
    unresolved_majors = [
        row
        for row in major_catalog_rows
        if row["field_code"] == "khac"
    ]

    write_csv(
        output_dir / "provinces.csv",
        ["id", "code", "name", "region"],
        sorted(PROVINCES.values(), key=lambda row: row["id"]),
    )
    write_csv(
        output_dir / "universities.csv",
        ["name", "code", "type", "province_id", "is_active"],
        university_rows,
    )
    write_csv(
        output_dir / "admission_methods.csv",
        ["code", "name", "description"],
        build_admission_methods(input_dir),
    )
    write_csv(
        output_dir / "subject_groups.csv",
        ["code", "subject_1", "subject_2", "subject_3", "display_name", "is_verified"],
        subject_group_rows,
    )
    write_csv(
        output_dir / "major_catalog.csv",
        ["code", "name", "field_code", "description"],
        major_catalog_rows,
    )
    write_csv(
        output_dir / "major_code_aliases.csv",
        ["old_code", "new_code", "effective_year", "reason", "is_verified"],
        [],
    )
    write_csv(
        output_dir / "major_subject_groups.csv",
        ["major_code", "subject_group_code"],
        major_subject_rows,
    )
    write_csv(
        output_dir / "university_programs.csv",
        [
            "id",
            "university_short_name",
            "major_code",
            "program_source_code",
            "program_name",
            "source",
            "source_school_id",
            "is_active",
        ],
        program_rows,
    )
    write_csv(
        output_dir / "university_program_subject_groups.csv",
        ["university_program_id", "subject_group_code"],
        program_subject_rows,
    )
    write_csv(
        output_dir / "admission_scores.csv",
        [
            "id",
            "university_program_id",
            "admission_method_code",
            "year",
            "score",
            "note",
            "source",
            "source_id",
            "source_method_id",
            "source_method_name",
        ],
        score_import_rows,
    )
    write_csv(
        output_dir / "review_unresolved_major_fields.csv",
        ["code", "name", "field_code", "description"],
        unresolved_majors,
    )

    print(f"Clean scores: {len(score_import_rows)}")
    print(f"Programs: {len(program_rows)}")
    print(f"Program-subject links: {len(program_subject_rows)}")
    print(f"Major-subject links: {len(major_subject_rows)}")
    print(f"Subject groups: {len(subject_group_rows)}")
    print(f"Unresolved major field mappings: {len(unresolved_majors)}")
    print(f"Output: {output_dir}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean Tuyensinh247 crawler CSVs for DB import.")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--universities-file", type=Path, default=DEFAULT_UNIVERSITIES_FILE)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    clean(args.input_dir, args.output_dir, args.universities_file)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
