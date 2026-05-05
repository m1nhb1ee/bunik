"""
crawl.py — Bunik Crawler v4
Crawl điểm chuẩn 87 trường ĐH Hà Nội từ tuyensinh247.com
Tương thích với Bunik Database v4.0 (3NF / UNIVERSITY_PROGRAMS schema)

Cách chạy:
    python crawl.py

Output (trong bunik_crawl_output/):
    admission_methods.csv / .json    → ADMISSION_METHODS  (seed cố định)
    subject_groups.csv / .json       → SUBJECT_GROUPS
    major_subject_groups.csv / .json → MAJOR_SUBJECT_GROUPS (M2M junction)
    major_catalog.csv / .json        → MAJOR_CATALOG (có field_code)
    university_programs.csv / .json  → UNIVERSITY_PROGRAMS
    admission_scores.csv / .json     → ADMISSION_SCORES
    raw_all_data.xlsx                → debug
"""

import json
import os
import re
import sys
import time
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import (
    WebDriverException,
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
)

import config

# ============================================================
# LOGGING
# ============================================================
logger = logging.getLogger("bunik_crawler")
logger.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stdout)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(config.LOG_FORMAT, config.LOG_DATE_FORMAT))
logger.addHandler(_console)

_file_handler = logging.FileHandler(config.LOG_FILE, encoding="utf-8")
_file_handler.setLevel(logging.DEBUG)
_file_handler.setFormatter(logging.Formatter(config.LOG_FORMAT, config.LOG_DATE_FORMAT))
logger.addHandler(_file_handler)


# ============================================================
# LOAD DANH SÁCH TRƯỜNG
# ============================================================

def load_universities(filepath: str) -> list[dict]:
    """
    Đọc universities.txt — mỗi dòng: Tên trường|URL|type|province_code
    Tự động trích short_name từ cuối URL (VD: ...-BKA.html → BKA).
    Bỏ qua dòng trống và dòng bắt đầu bằng #.

    FIX: Đọc thêm 2 cột bắt buộc của model University:
         type (công_lập / dân_lập / quân_sự) và province_code (HN, HB...)
    """
    universities = []
    valid_types = {"công_lập", "dân_lập", "quân_sự"}

    try:
        with open(filepath, encoding="utf-8") as f:
            for line_no, raw in enumerate(f, start=1):
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue

                parts = line.split("|")
                if len(parts) < 4:
                    logger.warning(
                        "Dòng %d — thiếu cột (cần 4: tên|url|type|province_code): %s",
                        line_no, line,
                    )
                    continue

                name          = parts[0].strip()
                url           = parts[1].strip()
                uni_type      = parts[2].strip()
                province_code = parts[3].strip()

                if not url.startswith("http"):
                    logger.warning("Dòng %d — URL không hợp lệ: %s", line_no, url)
                    continue

                if uni_type not in valid_types:
                    logger.warning(
                        "Dòng %d — type '%s' không hợp lệ (dùng: %s)",
                        line_no, uni_type, " | ".join(valid_types),
                    )
                    continue

                if not province_code:
                    logger.warning("Dòng %d — province_code rỗng: %s", line_no, name)
                    continue

                # Trích short_name từ URL: "...-BKA.html" → "BKA"
                m = re.search(r"-([A-Z0-9]{2,6})\.html$", url)
                short_name = m.group(1) if m else name[:6].upper().replace(" ", "")

                universities.append({
                    "short_name":    short_name,
                    "name":          name,
                    "url":           url,
                    "type":          uni_type,       # → UNIVERSITIES.type
                    "province_code": province_code,  # → UNIVERSITIES.province_id (cần resolve)
                })

    except FileNotFoundError:
        logger.error("Không tìm thấy file: %s", filepath)
        sys.exit(1)

    logger.info("Đã load %d trường từ %s", len(universities), filepath)
    return universities


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def extract_year(text: str) -> str | None:
    """Trích năm hợp lệ (2023–2099) từ chuỗi tiêu đề bảng."""
    m = re.search(r"20([2-9]\d)", text)
    return m.group() if m else None


def normalize_method(raw_text: str) -> str:
    """
    Chuẩn hóa text tiêu đề bảng → code trong ADMISSION_METHODS.
    Duyệt METHOD_KEYWORD_MAP theo thứ tự ưu tiên (từ khóa dài trước).
    """
    text = raw_text.lower().strip()
    for keyword, code in config.METHOD_KEYWORD_MAP:
        if keyword in text:
            return code
    return "OTHER"


def resolve_field_code(major_code: str) -> str | None:
    """
    FIX: Tự động điền field_code cho MAJOR_CATALOG dựa trên prefix mã ngành.
    VD: "7480201" → prefix "748" → field_code "CNTT"
    Trả về None nếu không tìm thấy mapping (cần điền thủ công sau).
    """
    if not major_code or len(major_code) < 3:
        return None
    prefix = major_code[:3]
    return config.MAJOR_PREFIX_TO_FIELD.get(prefix)


def parse_score(raw: str) -> float | None:
    """
    Chuyển điểm thô về float.
    Xử lý: '25.5', '25,5', '750' (ĐGNL), '–', '-', '' → None nếu không hợp lệ.
    """
    cleaned = raw.strip().replace(",", ".").replace("–", "").replace("-", "").strip()
    try:
        val = float(cleaned)
        return val if val > 0 else None
    except ValueError:
        return None


def parse_quota(raw: str) -> int | None:
    """Chuyển chỉ tiêu về int, bỏ ký tự rác."""
    digits = re.sub(r"[^\d]", "", raw.strip())
    return int(digits) if digits else None


def split_subject_groups(raw: str) -> list[str]:
    """
    Tách chuỗi tổ hợp môn thành danh sách code chuẩn.
    VD: "A00, A01, D07" → ["A00", "A01", "D07"]
        "A00/A01/D07"   → ["A00", "A01", "D07"]
    """
    if not raw:
        return []
    # Tách bằng dấu phẩy, dấu gạch chéo, hoặc khoảng trắng
    parts = re.split(r"[,/;\s]+", raw.strip())
    # Giữ lại các code hợp lệ (1 chữ cái + 2 chữ số, VD: A00, D07, C01...)
    return [p.strip().upper() for p in parts if re.match(r"^[A-Z]\d{2}$", p.strip())]


def create_chrome_driver() -> webdriver.Chrome:
    """Khởi tạo Chrome WebDriver theo cấu hình từ config."""
    opts = Options()
    if config.CHROME_HEADLESS:
        opts.add_argument("--headless")
    if config.CHROME_DISABLE_GPU:
        opts.add_argument("--disable-gpu")
    if config.CHROME_NO_SANDBOX:
        opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(f"--window-size={config.CHROME_WINDOW_SIZE}")
    opts.add_argument("--lang=vi-VN")
    if config.CHROME_DISABLE_IMAGES:
        opts.add_experimental_option(
            "prefs", {"profile.managed_default_content_settings.images": 2}
        )
    return webdriver.Chrome(options=opts)


# ============================================================
# CRAWL LOGIC
# ============================================================

def crawl_university(uni: dict) -> list[dict]:
    """
    Crawl 1 trường với retry.
    Trả về list[dict] — mỗi dict là 1 dòng điểm chuẩn thô,
    đã chuẩn hóa sẵn để map vào schema DB v4.
    """
    for attempt in range(1, config.MAX_RETRIES + 1):
        driver = None
        try:
            driver = create_chrome_driver()
            results = _do_crawl(driver, uni)
            logger.info(
                "[✓] %s — %d dòng (lần thử %d)",
                uni["short_name"], len(results), attempt,
            )
            return results
        except (WebDriverException, TimeoutException) as e:
            logger.warning(
                "[Retry %d/%d] %s: %s",
                attempt, config.MAX_RETRIES, uni["short_name"], e,
            )
            if attempt < config.MAX_RETRIES:
                time.sleep(config.RETRY_DELAY)
        except Exception as e:
            logger.error("[✗] %s: %s", uni["short_name"], e, exc_info=True)
            return []
        finally:
            if driver:
                driver.quit()

    logger.error("[Thất bại] %s sau %d lần thử", uni["short_name"], config.MAX_RETRIES)
    return []


def _do_crawl(driver: webdriver.Chrome, uni: dict) -> list[dict]:
    """
    Logic crawl chính cho 1 trường (không retry).

    Mỗi dict trả về map sang schema DB v4:
        university_short_name  → UNIVERSITIES.short_name
        university_type        → UNIVERSITIES.type
        university_province    → UNIVERSITIES.province_code
        major_code             → MAJOR_CATALOG.code
        major_name             → MAJOR_CATALOG.name
        field_code             → MAJOR_CATALOG.field_code  (đã resolve từ prefix)
        subject_group_codes    → MAJOR_SUBJECT_GROUPS      (list[str])
        admission_method_code  → ADMISSION_METHODS.code
        internal_code          → UNIVERSITY_PROGRAMS.internal_code
        year                   → ADMISSION_SCORES.year
        score                  → ADMISSION_SCORES.score
        quota                  → ADMISSION_SCORES.quota
        note                   → ADMISSION_SCORES.note
    """
    rows = []
    logger.debug("[▶] %s — %s", uni["short_name"], uni["url"])

    driver.get(uni["url"])
    time.sleep(config.PAGE_LOAD_WAIT)

    # ── BƯỚC 1: Mở rộng tất cả bảng "Xem thêm năm 20xx" ──────────────
    for _ in range(config.MAX_EXPAND_LOOPS):
        btns = driver.find_elements(
            By.XPATH,
            "//a[contains(translate(text(),"
            "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),"
            "'xem thêm') and contains(text(), '20')]",
        )
        target_btn = None
        for btn in btns:
            try:
                y = extract_year(btn.text)
                if y and int(y) >= config.MIN_YEAR:
                    target_btn = btn
                    break
            except (ValueError, StaleElementReferenceException):
                continue

        if not target_btn:
            break

        before_count = len(driver.find_elements(By.TAG_NAME, "table"))
        try:
            driver.execute_script(
                "arguments[0].scrollIntoView({block:'center'});", target_btn
            )
            time.sleep(config.CLICK_WAIT)
            driver.execute_script("arguments[0].click();", target_btn)

            deadline = time.time() + config.PAGE_LOAD_TIMEOUT
            while time.time() < deadline:
                if len(driver.find_elements(By.TAG_NAME, "table")) > before_count:
                    break
                time.sleep(config.TABLE_POLL_INTERVAL)
        except StaleElementReferenceException:
            logger.debug("%s — Stale element khi click, dừng expand", uni["short_name"])
            break

    # ── BƯỚC 2: Trích xuất dữ liệu từ các bảng ───────────────────────
    tables = driver.find_elements(By.TAG_NAME, "table")

    for table in tables:
        try:
            title_el = table.find_element(
                By.XPATH,
                "./preceding::*[self::h2 or self::h3 or self::strong or self::p][1]",
            )
            table_title = title_el.text.strip()
        except NoSuchElementException:
            table_title = ""

        year_val = extract_year(table_title)
        if not year_val or int(year_val) < config.MIN_YEAR:
            continue

        method_code = normalize_method(table_title)

        data_rows = table.find_elements(By.CSS_SELECTOR, "tr")[1:]
        for row in data_rows:
            cols = row.find_elements(By.TAG_NAME, "td")
            if len(cols) < 4:
                continue

            # Cấu trúc cột phổ biến trên tuyensinh247:
            # col[0]=STT | col[1]=Mã ngành | col[2]=Tên ngành
            # col[3]=Tổ hợp môn (nếu có) hoặc Điểm chuẩn
            # col[4]=Điểm chuẩn hoặc Chỉ tiêu | col[5]=Chỉ tiêu | col[6+]=Ghi chú

            major_code = cols[1].text.strip() if len(cols) > 1 else ""
            major_name = cols[2].text.strip() if len(cols) > 2 else ""

            if not major_code or not major_name:
                logger.debug(
                    "%s — Bỏ dòng thiếu mã/tên ngành (năm %s)", uni["short_name"], year_val
                )
                continue

            # Phát hiện cột tổ hợp môn (pattern A00, D01...)
            col3_text = cols[3].text.strip() if len(cols) > 3 else ""
            has_subject_col = bool(re.search(r"\b[A-Z]\d{2}\b", col3_text))

            if has_subject_col:
                subject_groups_raw = col3_text
                score_raw  = cols[4].text.strip() if len(cols) > 4 else ""
                quota_raw  = cols[5].text.strip() if len(cols) > 5 else ""
                note_extra = cols[6].text.strip() if len(cols) > 6 else ""
            else:
                subject_groups_raw = ""
                score_raw  = col3_text
                quota_raw  = cols[4].text.strip() if len(cols) > 4 else ""
                note_extra = cols[5].text.strip() if len(cols) > 5 else ""

            score = parse_score(score_raw)
            quota = parse_quota(quota_raw)

            if score is None:
                logger.debug(
                    "%s — Bỏ dòng điểm không hợp lệ '%s' (%s / năm %s)",
                    uni["short_name"], score_raw, major_code, year_val,
                )
                continue

            # Phát hiện mã chương trình nội bộ trong ngoặc:
            # "Công nghệ thông tin (IT1)" → internal_code = "IT1"
            internal_code = None
            ic_match = re.search(r"\(([A-Z]{2,6}\d{0,2})\)\s*$", major_name)
            if ic_match:
                internal_code = ic_match.group(1)
                major_name = major_name[: ic_match.start()].strip()

            # FIX: Tách tổ hợp môn thành list code chuẩn
            subject_group_codes = split_subject_groups(subject_groups_raw)

            # FIX: Resolve field_code từ prefix mã ngành
            field_code = resolve_field_code(major_code)

            note_parts = []
            if table_title:
                note_parts.append(f"[{table_title}]")
            if note_extra:
                note_parts.append(note_extra)

            rows.append({
                # ── Map sang schema DB v4 ──────────────────────────────
                "university_short_name": uni["short_name"],
                "university_type":       uni["type"],          # FIX: thêm type
                "university_province":   uni["province_code"], # FIX: thêm province
                "major_code":            major_code,
                "major_name":            major_name,
                "field_code":            field_code,           # FIX: đã resolve từ prefix
                "subject_group_codes":   subject_group_codes,  # FIX: list thay vì string thô
                "admission_method_code": method_code,
                "internal_code":         internal_code,
                "year":                  int(year_val),
                "score":                 score,
                "quota":                 quota,
                "note":                  " ".join(note_parts).strip(),
            })

    return rows


# ============================================================
# HELPER: Xuất cả CSV và JSON cho 1 dataset
# ============================================================

def _save(name: str, data: list[dict]) -> None:
    """Lưu 1 dataset thành cả .csv và .json trong OUTPUT_DIR."""
    out = config.OUTPUT_DIR

    # CSV
    df = pd.DataFrame(data)
    csv_path = os.path.join(out, f"{name}.csv")
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    # JSON — dùng ensure_ascii=False để giữ tiếng Việt đọc được
    json_path = os.path.join(out, f"{name}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info("[OUT] %s — %d bản ghi → .csv + .json", name, len(data))


# ============================================================
# HẬU XỬ LÝ: Tách output theo schema DB v4
# ============================================================

def build_outputs(all_rows: list[dict], universities: list[dict]) -> None:
    """
    Từ danh sách dòng thô → tách thành đầy đủ CSV + JSON theo schema DB v4.

    Các bảng được xuất (theo đúng dependency order để import DB):
        1. admission_methods   — seed cố định
        2. subject_groups      — FIX: tách riêng từ dữ liệu crawl
        3. major_catalog       — FIX: có field_code đã resolve
        4. major_subject_groups— FIX: junction M2M mới
        5. university_programs — có internal_code
        6. admission_scores    — UNIQUE enforced
        + raw_all_data.xlsx    — debug
    """
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)

    # ── 1. ADMISSION_METHODS — seed cố định ───────────────────────────
    _save("admission_methods", config.ADMISSION_METHODS_SEED)

    # ── 2. SUBJECT_GROUPS — FIX: tách riêng thành bảng độc lập ────────
    # Collect tất cả code tổ hợp môn unique từ dữ liệu crawl
    # SUBJECT_GROUPS.subjects là display string (A00 = "Toán, Lý, Hóa")
    SUBJECT_DISPLAY: dict[str, str] = {
        "A00": "Toán, Lý, Hóa",
        "A01": "Toán, Lý, Tiếng Anh",
        "A02": "Toán, Lý, Sinh",
        "A04": "Toán, Lý, Lịch sử",
        "A05": "Toán, Hóa, Lịch sử",
        "A06": "Toán, Lý, Địa lý",
        "A08": "Toán, Lịch sử, Giáo dục công dân",
        "A09": "Toán, Địa lý, Tiếng Anh",
        "A10": "Toán, Lý, Giáo dục công dân",
        "A16": "Toán, Khoa học tự nhiên, Ngữ văn",
        "B00": "Toán, Hóa, Sinh",
        "B01": "Toán, Sinh, Tiếng Anh",
        "B02": "Toán, Sinh, Địa lý",
        "B03": "Toán, Sinh, Lịch sử",
        "B04": "Toán, Hóa, Địa lý",
        "B08": "Toán, Sinh, Giáo dục công dân",
        "C00": "Văn, Sử, Địa",
        "C01": "Văn, Toán, Lý",
        "C02": "Văn, Toán, Hóa",
        "C03": "Văn, Toán, Sử",
        "C04": "Văn, Toán, Địa",
        "C05": "Văn, Lý, Hóa",
        "C06": "Văn, Lý, Địa",
        "C07": "Văn, Hóa, Địa",
        "C08": "Văn, Hóa, Sinh",
        "C09": "Văn, Lý, Sử",
        "C10": "Toán, Sử, Địa",
        "C14": "Văn, Toán, Giáo dục công dân",
        "C15": "Văn, Toán, Tiếng Anh",
        "C16": "Văn, Lý, Tiếng Anh",
        "C17": "Văn, Hóa, Tiếng Anh",
        "C19": "Văn, Sử, Tiếng Anh",
        "C20": "Văn, Địa, Tiếng Anh",
        "D01": "Văn, Toán, Tiếng Anh",
        "D07": "Toán, Hóa, Tiếng Anh",
        "D08": "Toán, Sinh, Tiếng Anh",
        "D09": "Toán, Lịch sử, Tiếng Anh",
        "D10": "Toán, Địa lý, Tiếng Anh",
        "D14": "Văn, Sử, Tiếng Anh",
        "D15": "Văn, Địa, Tiếng Anh",
        "D66": "Văn, Toán, Tiếng Nhật",
        "D90": "Toán, Khoa học tự nhiên, Tiếng Anh",
    }

    seen_sg: set[str] = set()
    for r in all_rows:
        for code in r["subject_group_codes"]:
            seen_sg.add(code)

    sg_rows = [
        {
            "code":     code,
            "subjects": SUBJECT_DISPLAY.get(code, f"Tổ hợp {code}"),
        }
        for code in sorted(seen_sg)
    ]
    _save("subject_groups", sg_rows)

    # ── 3. MAJOR_CATALOG — FIX: có field_code từ prefix mapping ────────
    seen_majors: dict[str, dict] = {}   # code → {name, field_code}
    for r in all_rows:
        code = r["major_code"]
        if code and code not in seen_majors:
            seen_majors[code] = {
                "code":       code,
                "name":       r["major_name"],
                "field_code": r["field_code"],  # FIX: đã resolve, không còn None
                "description": None,
            }
    major_catalog_rows = list(seen_majors.values())
    _save("major_catalog", major_catalog_rows)

    # ── 4. MAJOR_SUBJECT_GROUPS — FIX: file junction M2M mới ───────────
    seen_msg: set[tuple] = set()
    msg_rows = []
    for r in all_rows:
        for sg_code in r["subject_group_codes"]:
            key = (r["major_code"], sg_code)
            if key not in seen_msg:
                seen_msg.add(key)
                msg_rows.append({
                    "major_code":         r["major_code"],   # cần resolve → major_catalog_id
                    "subject_group_code": sg_code,           # cần resolve → subject_group_id
                })
    _save("major_subject_groups", msg_rows)

    # ── 5. UNIVERSITY_PROGRAMS ─────────────────────────────────────────
    # Kèm theo thông tin university để script import biết type + province
    seen_programs: dict[tuple, str] = {}
    program_rows = []
    for r in all_rows:
        key = (r["university_short_name"], r["major_code"], r["internal_code"])
        if key not in seen_programs:
            prog_id = str(uuid.uuid4())
            seen_programs[key] = prog_id
            program_rows.append({
                "id":                    prog_id,
                "university_short_name": r["university_short_name"],
                "university_type":       r["university_type"],       # FIX: có type
                "university_province":   r["university_province"],   # FIX: có province
                "major_code":            r["major_code"],
                "internal_code":         r["internal_code"],
                "internal_name":         None,
                "program_type":          None,
                "is_active":             True,
            })
    _save("university_programs", program_rows)

    # ── 6. ADMISSION_SCORES ────────────────────────────────────────────
    score_rows = []
    seen_score_keys: set[tuple] = set()
    for r in all_rows:
        key_prog = (r["university_short_name"], r["major_code"], r["internal_code"])
        prog_id = seen_programs.get(key_prog)
        if not prog_id:
            continue

        # Enforce UNIQUE (university_program_id, admission_method_code, year)
        dedup_key = (prog_id, r["admission_method_code"], r["year"])
        if dedup_key in seen_score_keys:
            continue
        seen_score_keys.add(dedup_key)

        score_rows.append({
            "id":                    str(uuid.uuid4()),
            "university_program_id": prog_id,
            "admission_method_code": r["admission_method_code"],
            "year":                  r["year"],
            "score":                 r["score"],
            "quota":                 r["quota"],
            "note":                  r["note"],
        })
    _save("admission_scores", score_rows)

    # ── 7. XLSX debug ──────────────────────────────────────────────────
    # Flatten subject_group_codes thành string để Excel hiển thị được
    debug_rows = []
    for r in all_rows:
        row_copy = dict(r)
        row_copy["subject_group_codes"] = ", ".join(r["subject_group_codes"])
        debug_rows.append(row_copy)

    xlsx_path = os.path.join(config.OUTPUT_DIR, "raw_all_data.xlsx")
    pd.DataFrame(debug_rows).to_excel(xlsx_path, index=False)
    logger.info("[OUT] raw_all_data.xlsx — %d dòng (debug)", len(debug_rows))

    # ── Tổng kết ──────────────────────────────────────────────────────
    logger.info(
        "\n  Thống kê output:\n"
        "    Trường (universities.txt) : %d\n"
        "    Ngành unique (major_catalog)     : %d\n"
        "    Tổ hợp môn (subject_groups)      : %d\n"
        "    Junction M2M (major_subj_groups) : %d\n"
        "    Chương trình (university_programs): %d\n"
        "    Bản ghi điểm (admission_scores)  : %d",
        len(universities),
        len(major_catalog_rows),
        len(sg_rows),
        len(msg_rows),
        len(program_rows),
        len(score_rows),
    )


# ============================================================
# CHƯƠNG TRÌNH CHÍNH
# ============================================================

if __name__ == "__main__":
    t0 = time.time()

    universities = load_universities(config.UNIVERSITIES_FILE)
    if not universities:
        logger.error("Danh sách trường rỗng — dừng chương trình.")
        sys.exit(1)

    logger.info(
        "Bắt đầu crawl %d trường với %d luồng song song...",
        len(universities), config.MAX_WORKERS,
    )

    all_rows: list[dict] = []

    with ThreadPoolExecutor(max_workers=config.MAX_WORKERS) as executor:
        future_to_uni = {
            executor.submit(crawl_university, uni): uni for uni in universities
        }
        for future in as_completed(future_to_uni):
            uni = future_to_uni[future]
            try:
                all_rows.extend(future.result())
            except Exception as e:
                logger.error("[Lỗi thread] %s: %s", uni["short_name"], e)

    elapsed = round((time.time() - t0) / 60, 1)
    logger.info(
        "Crawl xong — %d dòng tổng — %.1f phút — đang xuất file...",
        len(all_rows), elapsed,
    )

    if not all_rows:
        logger.warning("Không có dữ liệu để xuất!")
        sys.exit(0)

    build_outputs(all_rows, universities)

    logger.info("✅ HOÀN THÀNH — Output: %s", config.OUTPUT_DIR)
    logger.info(
        "\n"
        "  Thứ tự import vào PostgreSQL (đúng dependency order):\n"
        "  1. provinces          — seed thủ công / fixture\n"
        "  2. fields             — seed thủ công / fixture\n"
        "  3. universities       — từ university_programs.csv (university_short_name + type + province)\n"
        "  4. admission_methods  — admission_methods.csv\n"
        "  5. subject_groups     — subject_groups.csv\n"
        "  6. major_catalog      — major_catalog.csv (resolve field_code → field_id)\n"
        "  7. major_subject_groups — major_subject_groups.csv (resolve codes → ids)\n"
        "  8. university_programs— university_programs.csv (resolve short_name + major_code → ids)\n"
        "  9. admission_scores   — admission_scores.csv (resolve program_id + method_code → ids)\n"
    )
