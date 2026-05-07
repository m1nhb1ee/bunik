"""
Fast CSV crawler for Tuyensinh247 cutoff-score pages.

This script uses the JSON endpoint that powers the "Xem them" tables instead
of driving Selenium through rendered HTML.

Default output:
    datav2/bunik_crawl_output/admission_scores.csv
    datav2/bunik_crawl_output/major_subject_groups.csv
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
from dataclasses import dataclass
from typing import Any

import requests

import config


BASE_URL = "https://diemthi.tuyensinh247.com"
DEFAULT_YEARS = tuple(range(2021, 2026))
DEFAULT_WORKERS = 4
REQUEST_TIMEOUT = 20

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
]

SUBJECT_COLUMNS = [
    "id",
    "university_short_name",
    "program_source_code",
    "major_code",
    "subject_group_code",
]

logger = logging.getLogger("tuyensinh247_api_crawler")


@dataclass(frozen=True)
class University:
    name: str
    url: str
    short_name: str


@dataclass(frozen=True)
class Method:
    id: int
    name: str


def configure_logging() -> None:
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(config.LOG_FORMAT, config.LOG_DATE_FORMAT))
    logger.handlers.clear()
    logger.addHandler(handler)


def load_universities(path: str) -> list[University]:
    universities: list[University] = []
    with open(path, encoding="utf-8") as file:
        for line_no, raw_line in enumerate(file, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            parts = [part.strip() for part in line.split("|")]
            if len(parts) < 2:
                logger.warning("Skip line %d: missing URL separator", line_no)
                continue

            name, url = parts[0], parts[1]
            if not url.startswith("http"):
                logger.warning("Skip line %d: invalid URL %s", line_no, url)
                continue

            universities.append(
                University(
                    name=name,
                    url=url,
                    short_name=extract_short_name(url, name),
                )
            )

    return universities


def extract_short_name(url: str, fallback_name: str) -> str:
    match = re.search(r"-([A-Z0-9]{2,8})\.html$", url)
    if match:
        return match.group(1)
    return re.sub(r"\W+", "", fallback_name.upper())[:8]


def fetch_json(session: requests.Session, url: str) -> dict[str, Any] | None:
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        return None
    return payload


def fetch_html(session: requests.Session, url: str) -> str:
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    response.encoding = "utf-8"
    return response.text


def parse_school_id(html: str) -> int | None:
    match = re.search(r'\\?"school_id\\?":(\d+)', html)
    return int(match.group(1)) if match else None


def parse_current_methods(html: str) -> list[Method]:
    methods: dict[int, str] = {}
    for row in parse_embedded_rows(html):
        method_id = row.get("mark_type")
        method_name = clean_text(row.get("admission_name"))
        if isinstance(method_id, int) and method_name:
            methods[method_id] = method_name
    return [Method(id=method_id, name=name) for method_id, name in sorted(methods.items())]


def parse_embedded_rows(html: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    pattern = re.compile(
        r'\d+:(\{\\"id\\":\d+.*?\\"admission_alias\\":\\".*?\\"\})',
        re.DOTALL,
    )
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
    replacements = {
        "đ": "d",
        "Đ": "d",
    }
    text = "".join(replacements.get(ch, ch) for ch in value)
    text = text.lower()
    accents = {
        "áàảãạăắằẳẵặâấầẩẫậ": "a",
        "éèẻẽẹêếềểễệ": "e",
        "íìỉĩị": "i",
        "óòỏõọôốồổỗộơớờởỡợ": "o",
        "úùủũụưứừửữự": "u",
        "ýỳỷỹỵ": "y",
    }
    for chars, replacement in accents.items():
        for ch in chars:
            text = text.replace(ch, replacement)
    return re.sub(r"\s+", " ", text).strip()


def normalize_method(raw_name: str) -> str:
    text = normalize_for_match(raw_name)
    checks = [
        (("dgnl dhqghn", "dgnl ha noi", "danh gia nang luc dhqg ha noi"), "DGNL_HN"),
        (("dgnl hcm", "dgnl tphcm", "danh gia nang luc dhqg tp hcm"), "DGNL_HCM"),
        (("danh gia nang luc", "dgnl"), "DGNL_HN"),
        (("danh gia tu duy", "dgtd", "tu duy"), "DGTD"),
        (("diem thi thpt", "ket qua thi thpt", "thi thpt", "thpt"), "THPT"),
        (("xet hoc ba", "hoc ba"), "HSA"),
        (("xet tuyen thang", "tuyen thang"), "XTT"),
        (("chung chi quoc te", "ket hop"), "KH"),
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
) -> dict[str, Any] | None:
    program_code = clean_text(source_row.get("code"))
    major_code = clean_text(source_row.get("display_code")) or program_code
    major_name = clean_text(source_row.get("name"))
    score = score_value(source_row.get("mark"))

    if not program_code or not major_code or not major_name or score is None:
        return None

    admission_name = clean_text(source_row.get("admission_name")) or method.name
    note = clean_text(source_row.get("introtext"))

    return {
        "id": str(uuid.uuid4()),
        "source_id": clean_text(source_row.get("id")),
        "source_school_id": school_id,
        "source_method_id": method.id,
        "university_short_name": uni.short_name,
        "university_name": uni.name,
        "program_source_code": program_code,
        "major_code": major_code,
        "major_name": major_name,
        "admission_method_code": normalize_method(admission_name),
        "admission_method_name": admission_name,
        "year": source_row.get("year"),
        "score": score,
        "note": note,
    }


def crawl_university(
    uni: University,
    years: tuple[int, ...],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0 Safari/537.36"
            )
        }
    )

    html = fetch_html(session, uni.url)
    school_id = parse_school_id(html)
    if school_id is None:
        logger.warning("[%s] Cannot find school_id", uni.short_name)
        return [], []

    methods = parse_current_methods(html)
    if not methods:
        logger.warning("[%s] Cannot find admission methods", uni.short_name)
        return [], []

    score_rows: list[dict[str, Any]] = []
    subject_rows: list[dict[str, Any]] = []
    seen_scores: set[tuple[Any, ...]] = set()
    seen_subjects: set[tuple[str, str, str, str]] = set()

    for method in methods:
        for year in years:
            api_url = (
                f"{BASE_URL}/api/common/cutoff-score"
                f"?school_id={school_id}&method_id={method.id}&year={year}"
            )
            try:
                payload = fetch_json(session, api_url)
            except requests.RequestException as exc:
                logger.warning("[%s] API failed %s: %s", uni.short_name, api_url, exc)
                continue

            rows = payload.get("data") if payload else None
            if not isinstance(rows, list):
                continue

            for source_row in rows:
                if not isinstance(source_row, dict):
                    continue

                program_code = clean_text(source_row.get("code"))
                source_id = clean_text(source_row.get("id"))
                dedup_key = (uni.short_name, year, method.id, program_code, source_id)
                if dedup_key in seen_scores:
                    continue
                seen_scores.add(dedup_key)

                score_row = build_score_row(uni, source_row, method, school_id)
                if score_row is None:
                    continue
                score_rows.append(score_row)

                for subject_code in split_subject_groups(source_row.get("block")):
                    subject_key = (
                        uni.short_name,
                        score_row["program_source_code"],
                        score_row["major_code"],
                        subject_code,
                    )
                    if subject_key in seen_subjects:
                        continue
                    seen_subjects.add(subject_key)
                    subject_rows.append(
                        {
                            "id": str(uuid.uuid4()),
                            "university_short_name": uni.short_name,
                            "program_source_code": score_row["program_source_code"],
                            "major_code": score_row["major_code"],
                            "subject_group_code": subject_code,
                        }
                    )

    logger.info("[%s] %d scores, %d subject links", uni.short_name, len(score_rows), len(subject_rows))
    return score_rows, subject_rows


def write_csv(path: str, columns: list[str], rows: list[dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def parse_years(value: str) -> tuple[int, ...]:
    if "-" in value:
        start, end = [int(part.strip()) for part in value.split("-", maxsplit=1)]
        return tuple(range(start, end + 1))
    return tuple(int(part.strip()) for part in value.split(",") if part.strip())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl Tuyensinh247 cutoff scores via JSON API.")
    parser.add_argument("--universities-file", default=config.UNIVERSITIES_FILE)
    parser.add_argument("--output-dir", default=config.OUTPUT_DIR)
    parser.add_argument("--years", default="2021-2025", help="Year range like 2021-2025 or list like 2021,2022")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--limit", type=int, default=None, help="Only crawl the first N universities")
    return parser.parse_args()


def main() -> int:
    configure_logging()
    args = parse_args()
    years = parse_years(args.years)
    universities = load_universities(args.universities_file)
    if args.limit is not None:
        universities = universities[: args.limit]

    if not universities:
        logger.error("No universities loaded")
        return 1

    all_scores: list[dict[str, Any]] = []
    all_subjects: list[dict[str, Any]] = []

    logger.info("Crawling %d universities for years %s", len(universities), ", ".join(map(str, years)))
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        future_to_uni = {
            executor.submit(crawl_university, uni, years): uni for uni in universities
        }
        for future in as_completed(future_to_uni):
            uni = future_to_uni[future]
            try:
                score_rows, subject_rows = future.result()
            except Exception as exc:
                logger.error("[%s] Failed: %s", uni.short_name, exc, exc_info=True)
                continue
            all_scores.extend(score_rows)
            all_subjects.extend(subject_rows)

    write_csv(os.path.join(args.output_dir, "admission_scores.csv"), SCORE_COLUMNS, all_scores)
    write_csv(os.path.join(args.output_dir, "major_subject_groups.csv"), SUBJECT_COLUMNS, all_subjects)

    logger.info("Wrote %d admission scores", len(all_scores))
    logger.info("Wrote %d major-subject rows", len(all_subjects))
    logger.info("Output directory: %s", args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
