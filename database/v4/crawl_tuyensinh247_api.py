"""
Fast CSV crawler for Tuyensinh247 cutoff-score pages.

Phase 1 — crawl_course_info()  : fetch /thong-tin-... → course_catalog.csv
Giai đoạn 2 — crawl_university()   : fetch /diem-chuan-... JSON API → admission_scores.csv
Giai đoạn 3 — merge_and_enrich()  : Khớp và làm giàu dữ liệu qua Multi-step Mapping.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any

import requests

# Fallback configuration defaults (replace via CLI args if needed)
LOG_FORMAT = "%(asctime)s %(levelname)s %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
UNIVERSITIES_FILE = "v4/universities.txt"
INFO_FILE = "v4/university_course_links.txt"
# Restore original crawler output folder used by older pipeline
OUTPUT_DIR = "v4/bunik_crawl_output"

BASE_URL = "https://diemthi.tuyensinh247.com"
DEFAULT_YEARS = tuple(range(2021, 2026))
DEFAULT_WORKERS = 4
REQUEST_TIMEOUT = 20

# ── Output columns ──────────────────────────────────────────────────────────

CATALOG_COLUMNS = [
    "university_short_name",
    "program_source_code",
    "major_name",
    "quota",
    "admission_methods",
    "subject_groups",
    "is_verified",
]

SCORE_COLUMNS = [
    "id",
    "source_id",
    "source_school_id",
    "source_method_id",
    "university_short_name",
    "university_name",
    "program_source_code",
    "major_code",
    "major_name",
    "admission_method_code",
    "admission_method_name",
    "year",
    "score",
    "note",
    "subject_group_codes",
    "quota",
]

SUBJECT_COLUMNS = [
    "id",
    "university_short_name",
    "program_source_code",
    "major_code",
    "subject_group_code",
]

logger = logging.getLogger("tuyensinh247_api_crawler")

# ── Dataclasses ──────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class University:
    name: str
    url: str
    short_name: str
    info_url: str = ""

@dataclass(frozen=True)
class Method:
    id: int
    name: str

@dataclass
class CourseCatalogEntry:
    university_short_name: str
    program_source_code: str
    major_name: str
    quota: int | None
    admission_methods: list[str]
    subject_groups: list[str]

# ── Logging ──────────────────────────────────────────────────────────────────

def configure_logging() -> None:
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, LOG_DATE_FORMAT))
    logger.handlers.clear()
    logger.addHandler(handler)

# ── Load universities ────────────────────────────────────────────────────────

def load_universities(
    score_path: str,
    info_path: str | None = None,
) -> list[University]:
    info_map: dict[str, str] = {}
    if info_path and os.path.exists(info_path):
        with open(info_path, encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                parts = [p.strip() for p in line.split("|")]
                if len(parts) < 2:
                    continue
                info_url = parts[1]
                m = re.search(r"-([A-Z0-9]{2,8})\.html$", info_url)
                if m:
                    info_map[m.group(1)] = info_url

    universities: list[University] = []
    with open(score_path, encoding="utf-8") as f:
        for line_no, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 2:
                logger.warning("Skip line %d: thiếu URL", line_no)
                continue
            name, url = parts[0], parts[1]
            if not url.startswith("http"):
                logger.warning("Skip line %d: URL không hợp lệ %s", line_no, url)
                continue
            short_name = extract_short_name(url, name)
            universities.append(University(
                name=name,
                url=url,
                short_name=short_name,
                info_url=info_map.get(short_name, ""),
            ))
    return universities

def extract_short_name(url: str, fallback_name: str) -> str:
    match = re.search(r"-([A-Z0-9]{2,8})\.html$", url)
    if match:
        return match.group(1)
    return re.sub(r"\W+", "", fallback_name.upper())[:8]

# ── HTTP helpers ──────────────────────────────────────────────────────────────

def fetch_json(session: requests.Session, url: str) -> dict[str, Any] | None:
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, dict) else None

def fetch_html(session: requests.Session, url: str) -> str:
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    response.encoding = "utf-8"
    return response.text

# ── Phase 1: crawl_course_info() ─────────────────────────────────────────────

_MARK_TYPE_METHOD: dict[int, str] = {
    1:  "THPT", 2:  "HBA", 3:  "DGNL_HN", 4:  "DGNL_HCM",
    5:  "DGTD", 6:  "DGTD", 7:  "XTT", 8:  "KH",
    9:  "KH", 10: "DGTD", 11: "DGNL_HN", 12: "HBA",
}

def _parse_mark_types(mark_type_str: str) -> list[str]:
    codes: list[str] = []
    seen: set[str] = set()
    for part in mark_type_str.split(","):
        part = part.strip()
        if not part.isdigit():
            continue
        code = _MARK_TYPE_METHOD.get(int(part))
        if code and code not in seen:
            codes.append(code)
            seen.add(code)
    return codes

def _parse_school_majors_json(html: str) -> list[dict[str, Any]]:
    pattern = re.compile(r'\\"schoolMajors\\":\[(\{.*?\})\]', re.DOTALL)
    match = pattern.search(html)
    if not match:
        pattern2 = re.compile(r'"schoolMajors"\s*:\s*(\[.*?\])\s*[,}]', re.DOTALL)
        match2 = pattern2.search(html)
        if match2:
            try:
                return json.loads(match2.group(1))
            except json.JSONDecodeError:
                pass
        return []

    raw_escaped = match.group(0)
    raw_escaped = raw_escaped.replace('\\"', '"')
    raw_escaped = raw_escaped.replace('\\\\', '\\')

    array_match = re.search(r'"schoolMajors"\s*:\s*(\[.*\])', raw_escaped, re.DOTALL)
    if not array_match:
        return []

    try:
        return json.loads(array_match.group(1))
    except json.JSONDecodeError:
        return []

def crawl_course_info(
    uni: University,
    session: requests.Session,
) -> list[CourseCatalogEntry]:
    if not uni.info_url:
        return []

    try:
        html = fetch_html(session, uni.info_url)
    except requests.RequestException as exc:
        logger.warning("[%s] Lỗi fetch info_url: %s", uni.short_name, exc)
        return []

    raw_majors = _parse_school_majors_json(html)
    if not raw_majors:
        return []
    entries: list[CourseCatalogEntry] = []

    # Do not aggregate admission methods here. Return one entry per
    # program + admission method so cleaning/normalization can be done
    # after the full crawl of all universities.
    for item in raw_majors:
        if not isinstance(item, dict):
            continue

        program_code = clean_text(item.get("code"))
        if not program_code:
            continue

        major_name = clean_text(item.get("name"))
        if not major_name:
            continue

        quota_raw = item.get("quota")
        try:
            quota_int = int(quota_raw) if quota_raw is not None else None
            quota = quota_int if (quota_int is not None and quota_int > 0) else None
        except (ValueError, TypeError):
            quota = None

        block_str = clean_text(item.get("block", ""))
        mark_type_str = clean_text(item.get("mark_type", ""))

        subject_groups = sorted(set(re.findall(r"\b[A-Z]\d{2}\b", block_str.upper())))
        admission_methods = _parse_mark_types(mark_type_str)

        # If no admission method listed, still emit a single entry with empty method
        if not admission_methods:
            entries.append(CourseCatalogEntry(
                university_short_name=uni.short_name,
                program_source_code=program_code,
                major_name=major_name,
                quota=quota,
                admission_methods=[],
                subject_groups=subject_groups,
            ))
            continue

        for method in admission_methods:
            entries.append(CourseCatalogEntry(
                university_short_name=uni.short_name,
                program_source_code=program_code,
                major_name=major_name,
                quota=quota,
                admission_methods=[method],
                subject_groups=subject_groups,
            ))

    logger.info("[%s] course_info: %d raw items", uni.short_name, len(entries))
    return entries

# ── Phase 2: crawl_university() ──────────────────────────────────────────────

def crawl_university(
    uni: University,
    years: tuple[int, ...],
    catalog: dict[str, CourseCatalogEntry],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    session = _make_session()

    html = fetch_html(session, uni.url)
    school_id = parse_school_id(html)
    if school_id is None:
        return [], []

    methods = parse_current_methods(html)
    if not methods:
        return [], []

    score_rows: list[dict[str, Any]] = []
    subject_rows: list[dict[str, Any]] = []
    seen_scores: set[tuple[Any, ...]] = set()
    seen_subjects: set[tuple[str, str, str, str]] = set()

    for method in methods:
        for year in years:
            api_url = f"{BASE_URL}/api/common/cutoff-score?school_id={school_id}&method_id={method.id}&year={year}"
            try:
                payload = fetch_json(session, api_url)
            except requests.RequestException:
                continue

            rows = payload.get("data") if payload else None
            if not isinstance(rows, list):
                continue

            for source_row in rows:
                if not isinstance(source_row, dict):
                    continue

                program_code = clean_text(source_row.get("code"))
                source_id    = clean_text(source_row.get("id"))
                dedup_key    = (uni.short_name, year, method.id, program_code, source_id)
                if dedup_key in seen_scores:
                    continue
                seen_scores.add(dedup_key)

                score_row = build_score_row(uni, source_row, method, school_id, catalog)
                if score_row is None:
                    continue
                score_rows.append(score_row)

                catalog_entry = catalog_lookup(catalog, program_code, clean_text(source_row.get("name")))
                if catalog_entry and catalog_entry.subject_groups:
                    subject_codes = catalog_entry.subject_groups
                else:
                    subject_codes = split_subject_groups(source_row.get("block"))

                for subject_code in subject_codes:
                    subject_key = (uni.short_name, score_row["program_source_code"], score_row["major_code"], subject_code)
                    if subject_key in seen_subjects:
                        continue
                    seen_subjects.add(subject_key)
                    subject_rows.append({
                        "id": str(uuid.uuid4()),
                        "university_short_name": uni.short_name,
                        "program_source_code": score_row["program_source_code"],
                        "major_code": score_row["major_code"],
                        "subject_group_code": subject_code,
                    })

    return score_rows, subject_rows

def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    })
    return session

# ── Phase 3: Thuật toán Lookup & Khớp chuỗi nâng cao ────────────────────────

def _extract_base_code(program_code: str) -> list[str]:
    code = program_code.strip()
    candidates: list[str] = [code]

    if "," in code:
        parts = [p.strip() for p in code.split(",") if p.strip()]
        candidates = parts + candidates

    if re.match(r"^\d{3,6}M$", code):
        candidates.append(code[:-1])

    if "_" in code:
        base = code.split("_")[0]
        if re.match(r"^\d{7}$", base):
            candidates.append(base)

    m = re.match(r"^(\d{7})[^0-9_,]", code)
    if m:
        candidates.append(m.group(1))

    for trim in (1, 2):
        trimmed = code[:-trim]
        if trimmed and trimmed not in candidates:
            candidates.append(trimmed)

    seen: set[str] = set()
    result: list[str] = []
    for c in candidates:
        c = c.strip()
        if c and c not in seen:
            seen.add(c)
            result.append(c)
    return result

def _reverse_lookup(
    uni_catalog: dict[str, CourseCatalogEntry],
    score_code: str,
) -> CourseCatalogEntry | None:
    for cat_code, entry in uni_catalog.items():
        if not cat_code.startswith(score_code):
            continue
        rest = cat_code[len(score_code):]
        if rest and not rest[0].isdigit():
            return entry
    return None

def catalog_lookup(
    uni_catalog: dict[str, CourseCatalogEntry],
    program_code: str,
    major_name: str = ""
) -> CourseCatalogEntry | None:
    """Tra cứu nâng cao kết hợp đối sánh Tên ngành cho Crawler."""
    if not uni_catalog:
        return None

    # 1. Exact + forward candidates
    for candidate in _extract_base_code(program_code):
        entry = uni_catalog.get(candidate)
        if entry:
            return entry

    # 2. Reverse lookup
    rev_entry = _reverse_lookup(uni_catalog, program_code)
    if rev_entry:
        return rev_entry

    # 3. Name-based fallback matching
    if major_name:
        score_norm = normalize_for_match(major_name).replace(" ", "")
        if score_norm:
            # 3a. Exact string name match
            for cat_code, entry in uni_catalog.items():
                cat_name = entry.major_name
                if cat_name and normalize_for_match(cat_name).replace(" ", "") == score_norm:
                    return entry
            
            # 3b. Substring name match
            for cat_code, entry in uni_catalog.items():
                cat_name = entry.major_name
                if cat_name:
                    cat_norm = normalize_for_match(cat_name).replace(" ", "")
                    if cat_norm and len(cat_norm) >= 6:
                        if cat_norm in score_norm or score_norm in cat_norm:
                            return entry
    return None

def merge_and_enrich(
    score_rows: list[dict[str, Any]],
    catalog_by_uni: dict[str, dict[str, CourseCatalogEntry]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    enriched: list[dict[str, Any]] = []
    flagged:  list[dict[str, Any]] = []
    seen_flagged: set[tuple[str, str]] = set()

    for row in score_rows:
        uni_code     = row.get("university_short_name", "")
        program_code = row.get("program_source_code", "")
        uni_catalog  = catalog_by_uni.get(uni_code, {})
        
        entry = catalog_lookup(uni_catalog, program_code, row.get("major_name", ""))

        if entry:
            row = {
                **row,
                "major_name": entry.major_name,
                "quota":      entry.quota if entry.quota is not None else "",
            }
        else:
            row = {**row, "quota": ""}
            if uni_catalog:
                dedup_key = (uni_code, program_code)
                if dedup_key not in seen_flagged:
                    seen_flagged.add(dedup_key)
                    flagged.append({
                        "university_short_name": uni_code,
                        "program_source_code":   program_code,
                        "major_name_from_score": row.get("major_name", ""),
                        "reason": "program_code không có trong course_catalog (dữ liệu vẫn được giữ)",
                    })

        enriched.append(row)
    return enriched, flagged

# ── Text utilities ────────────────────────────────────────────────────────────

def parse_school_id(html: str) -> int | None:
    match = re.search(r'\\?"school_id\\?":(\d+)', html)
    return int(match.group(1)) if match else None

def parse_current_methods(html: str) -> list[Method]:
    methods: dict[int, str] = {}
    for row in parse_embedded_rows(html):
        method_id   = row.get("mark_type")
        method_name = clean_text(row.get("admission_name"))
        if isinstance(method_id, int) and method_name:
            methods[method_id] = method_name
    return [Method(id=mid, name=name) for mid, name in sorted(methods.items())]

def parse_embedded_rows(html: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    pattern = re.compile(r'\d+:(\{\\"id\\":\d+.*?\\"admission_alias\\":\\".*?\\"\})', re.DOTALL)
    for match in pattern.finditer(html):
        raw_object = match.group(1).replace('\\"', '"')
        try:
            row = json.loads(raw_object)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict):
            rows.append(row)
    return rows

def normalize_for_match(value: str) -> str:
    replacements = {"đ": "d", "Đ": "d"}
    text = "".join(replacements.get(ch, ch) for ch in value)
    text = text.lower()
    accents = {
        "áàảãạăắằẳẵặâấầẩẫậ": "a", "éèẻẽẹêếềểễệ": "e", "íìỉĩị": "i",
        "óòỏõọôốồổỗộơớờởỡợ": "o", "úùủũụưứừửữự": "u", "ýỳỷỹỵ": "y",
    }
    for chars, replacement in accents.items():
        for ch in chars:
            text = text.replace(ch, replacement)
    return re.sub(r"\s+", " ", text).strip()

def normalize_method(raw_name: str) -> str:
    text = normalize_for_match(raw_name)
    checks = [
        (("dgnl dhqghn", "dgnl ha noi", "danh gia nang luc dhqg ha noi"), "DGNL_HN"),
        (("dgnl hcm", "dgnl tphcm", "danh gia nang luc dhqg tp hcm"),    "DGNL_HCM"),
        (("danh gia nang luc", "dgnl"),                                    "DGNL_HN"),
        (("danh gia tu duy", "dgtd", "tu duy"),                            "DGTD"),
        (("diem thi thpt", "ket qua thi thpt", "thi thpt", "thpt"),       "THPT"),
        (("xet hoc ba", "hoc ba"),                                         "HBA"),
        (("xet tuyen thang", "tuyen thang"),                               "XTT"),
        (("chung chi quoc te", "ket hop"),                                 "KH"),
    ]
    for keywords, code in checks:
        if any(keyword in text for keyword in keywords):
            return code
    return "OTHER"

def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()

def split_subject_groups(raw_block: Any) -> list[str]:
    text = clean_text(raw_block).upper()
    if not text:
        return []
    return sorted(set(re.findall(r"\b[A-Z]\d{2}\b", text)))

def score_value(raw_score: Any) -> str | None:
    if raw_score is None or raw_score == "":
        return None
    if isinstance(raw_score, (int, float)):
        return str(raw_score)
    cleaned = clean_text(raw_score).replace(",", ".")
    try:
        return str(float(cleaned))
    except ValueError:
        return None

def build_score_row(
    uni: University,
    source_row: dict[str, Any],
    method: Method,
    school_id: int,
    catalog: dict[str, CourseCatalogEntry],
) -> dict[str, Any] | None:
    program_code  = clean_text(source_row.get("code"))
    major_code    = clean_text(source_row.get("display_code")) or program_code
    score         = score_value(source_row.get("mark"))

    if not program_code or not major_code or score is None:
        return None

    catalog_entry = catalog_lookup(catalog, program_code, clean_text(source_row.get("name")))
    major_name    = catalog_entry.major_name if catalog_entry else clean_text(source_row.get("name"))

    if not major_name:
        return None

    admission_name = clean_text(source_row.get("admission_name")) or method.name
    note           = clean_text(source_row.get("introtext"))
    # All khối this cutoff applies to. Stored as a comma-joined list so the
    # cleaner can build the admission_score <-> subject_group junction (a single
    # cutoff may cover several combos, e.g. "A00,A01,D01,D07").
    subject_group_codes = ",".join(split_subject_groups(source_row.get("block")))

    return {
        "id":                    str(uuid.uuid4()),
        "source_id":             clean_text(source_row.get("id")),
        "source_school_id":      school_id,
        "source_method_id":      method.id,
        "university_short_name": uni.short_name,
        "university_name":       uni.name,
        "program_source_code":   program_code,
        "major_code":            major_code,
        "major_name":            major_name,
        "admission_method_code": normalize_method(admission_name),
        "admission_method_name": admission_name,
        "year":                  source_row.get("year"),
        "score":                 score,
        "note":                  note,
        "subject_group_codes":   subject_group_codes,
    }

# ── CSV I/O ───────────────────────────────────────────────────────────────────

def write_csv(path: str, columns: list[str], rows: list[dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

def catalog_entry_to_row(entry: CourseCatalogEntry) -> dict[str, Any]:
    return {
        "university_short_name": entry.university_short_name,
        "program_source_code":   entry.program_source_code,
        "major_name":            entry.major_name,
        "quota":                 entry.quota if entry.quota is not None else "",
        "admission_methods":     ",".join(entry.admission_methods),
        "subject_groups":        ",".join(entry.subject_groups),
        "is_verified":           "true",
    }

# ── Arg parsing ───────────────────────────────────────────────────────────────

def parse_years(value: str) -> tuple[int, ...]:
    if "-" in value:
        start, end = [int(p.strip()) for p in value.split("-", maxsplit=1)]
        return tuple(range(start, end + 1))
    return tuple(int(p.strip()) for p in value.split(",") if p.strip())

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl Tuyensinh247: Phase 1 (catalog) → Phase 2 (điểm chuẩn).")
    parser.add_argument("--universities-file",  default=UNIVERSITIES_FILE)
    parser.add_argument("--info-file",          default=INFO_FILE, help="Path tới university_course_links.txt")
    parser.add_argument("--output-dir",         default=OUTPUT_DIR)
    parser.add_argument("--years",              default="2021-2025")
    parser.add_argument("--workers",            type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--limit",              type=int, default=None)
    parser.add_argument("--skip-catalog",       action="store_true")
    return parser.parse_args()

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    configure_logging()
    args      = parse_args()
    years     = parse_years(args.years)
    unis      = load_universities(args.universities_file, args.info_file)

    if args.limit is not None:
        unis = unis[: args.limit]
    if not unis:
        return 1

    catalog_by_uni: dict[str, dict[str, CourseCatalogEntry]] = {}
    all_catalog_rows: list[dict[str, Any]] = []

    if not args.skip_catalog:
        unis_with_info = [u for u in unis if u.info_url]
        logger.info("Phase 1 — Crawl catalog cho %d/%d trường", len(unis_with_info), len(unis))
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            future_map = {executor.submit(crawl_course_info, uni, _make_session()): uni for uni in unis_with_info}
            for future in as_completed(future_map):
                uni = future_map[future]
                try:
                    entries = future.result()
                except Exception as exc:
                    logger.error("[%s] Phase 1 thất bại: %s", uni.short_name, exc)
                    entries = []
                # Build lookup map but do not overwrite existing program entries
                if uni.short_name not in catalog_by_uni:
                    catalog_by_uni[uni.short_name] = {}
                for e in entries:
                    if e.program_source_code not in catalog_by_uni[uni.short_name]:
                        catalog_by_uni[uni.short_name][e.program_source_code] = e
                # Emit one CSV row per entry (one per admission method)
                all_catalog_rows.extend(catalog_entry_to_row(e) for e in entries)

        write_csv(os.path.join(args.output_dir, "course_catalog.csv"), CATALOG_COLUMNS, all_catalog_rows)
    else:
        logger.info("Phase 1 bị bỏ qua (--skip-catalog)")

    logger.info("Phase 2 — Crawl điểm chuẩn cho %d trường", len(unis))
    all_scores:   list[dict[str, Any]] = []
    all_subjects: list[dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        future_map = {executor.submit(crawl_university, uni, years, catalog_by_uni.get(uni.short_name, {})): uni for uni in unis}
        for future in as_completed(future_map):
            uni = future_map[future]
            try:
                score_rows, subject_rows = future.result()
            except Exception as exc:
                logger.error("[%s] Phase 2 thất bại: %s", uni.short_name, exc)
                continue
            all_scores.extend(score_rows)
            all_subjects.extend(subject_rows)

    logger.info("Phase 3 — Merge & enrich %d score rows", len(all_scores))
    enriched_scores, flagged = merge_and_enrich(all_scores, catalog_by_uni)

    write_csv(os.path.join(args.output_dir, "admission_scores.csv"),    SCORE_COLUMNS,   enriched_scores)
    write_csv(os.path.join(args.output_dir, "major_subject_groups.csv"),       SUBJECT_COLUMNS, all_subjects)
    write_csv(
        os.path.join(args.output_dir, "review_unmatched_programs.csv"),
        ["university_short_name", "program_source_code", "major_name_from_score", "reason"],
        flagged,
    )
    return 0

if __name__ == "__main__":
    raise SystemExit(main())