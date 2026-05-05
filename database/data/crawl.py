"""
Crawler điểm chuẩn đại học từ tuyensinh247.com
Phiên bản refactored: config tập trung, logging, retry logic, data validation.
"""

import pandas as pd
import time
import re
import logging
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import (
    WebDriverException,
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
)

import database.data.config as config

# ============================================================
# LOGGING
# ============================================================
logger = logging.getLogger("crawler")
logger.setLevel(logging.DEBUG)

# Console handler
_console = logging.StreamHandler(sys.stdout)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(config.LOG_FORMAT, config.LOG_DATE_FORMAT))
logger.addHandler(_console)

# File handler
_file = logging.FileHandler(config.LOG_FILE, encoding="utf-8")
_file.setLevel(logging.DEBUG)
_file.setFormatter(logging.Formatter(config.LOG_FORMAT, config.LOG_DATE_FORMAT))
logger.addHandler(_file)

# ============================================================
# LOAD DANH SÁCH TRƯỜNG TỪ FILE
# ============================================================

def load_universities(filepath: str) -> list[dict]:
    """
    Đọc file universities.txt, mỗi dòng có dạng:
        Tên trường|URL
    Bỏ qua dòng trống và dòng bắt đầu bằng #.
    """
    universities = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line_no, raw_line in enumerate(f, start=1):
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("|", maxsplit=1)
                if len(parts) != 2:
                    logger.warning(
                        "Dòng %d không hợp lệ (thiếu '|'): %s", line_no, line
                    )
                    continue
                name, url = parts[0].strip(), parts[1].strip()
                if not url.startswith("http"):
                    logger.warning(
                        "Dòng %d URL không hợp lệ: %s", line_no, url
                    )
                    continue
                universities.append({"name": name, "url": url})
    except FileNotFoundError:
        logger.error("Không tìm thấy file: %s", filepath)
        sys.exit(1)

    logger.info("Đã load %d trường từ %s", len(universities), filepath)
    return universities

# ============================================================
# HELPER
# ============================================================

def extract_year(text: str) -> str:
    """Trích xuất năm (20xx) từ chuỗi văn bản."""
    match = re.search(r"20\d{2}", text)
    return match.group() if match else "N/A"


def create_chrome_driver() -> webdriver.Chrome:
    """Tạo Chrome WebDriver với cấu hình từ config."""
    chrome_options = Options()
    if config.CHROME_HEADLESS:
        chrome_options.add_argument("--headless")
    if config.CHROME_DISABLE_GPU:
        chrome_options.add_argument("--disable-gpu")
    if config.CHROME_NO_SANDBOX:
        chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument(f"--window-size={config.CHROME_WINDOW_SIZE}")

    if config.CHROME_DISABLE_IMAGES:
        prefs = {"profile.managed_default_content_settings.images": 2}
        chrome_options.add_experimental_option("prefs", prefs)

    return webdriver.Chrome(options=chrome_options)

# ============================================================
# CRAWL 1 TRƯỜNG
# ============================================================

def crawl_university(uni: dict) -> list[dict]:
    """
    Crawl dữ liệu điểm chuẩn cho 1 trường.
    Hỗ trợ retry khi gặp lỗi mạng/WebDriver.
    """
    for attempt in range(1, config.MAX_RETRIES + 1):
        driver = None
        try:
            driver = create_chrome_driver()
            results = _do_crawl(driver, uni)
            logger.info(
                "[Xong] %s — %d dòng (lần thử %d)",
                uni["name"], len(results), attempt,
            )
            return results

        except (WebDriverException, TimeoutException) as e:
            logger.warning(
                "[Retry %d/%d] %s: %s",
                attempt, config.MAX_RETRIES, uni["name"], e,
            )
            if attempt < config.MAX_RETRIES:
                time.sleep(config.RETRY_DELAY)
        except Exception as e:
            logger.error("[Lỗi] %s: %s", uni["name"], e, exc_info=True)
            return []
        finally:
            if driver:
                driver.quit()

    logger.error(
        "[Thất bại] %s sau %d lần thử", uni["name"], config.MAX_RETRIES
    )
    return []


def _do_crawl(driver: webdriver.Chrome, uni: dict) -> list[dict]:
    """Logic crawl chính (không retry — được gọi bởi crawl_university)."""
    local_results = []

    logger.info("[Bắt đầu] %s", uni["name"])
    driver.get(uni["url"])

    # --- 1. MỞ RỘNG TẤT CẢ CÁC BẢNG (click "Xem thêm năm 20xx") ---
    while True:
        buttons = driver.find_elements(
            By.XPATH, "//a[contains(text(), 'Xem thêm') and contains(text(), 'năm 20')]"
        )
        target_btn = None
        for btn in buttons:
            try:
                y = extract_year(btn.text)
                if y != "N/A" and int(y) >= config.MIN_YEAR:
                    target_btn = btn
                    break
            except (ValueError, StaleElementReferenceException):
                continue

        if not target_btn:
            break

        before_count = len(driver.find_elements(By.TAG_NAME, "table"))
        try:
            driver.execute_script(
                "arguments[0].scrollIntoView({block: 'center'});", target_btn
            )
            time.sleep(config.CLICK_WAIT)
            driver.execute_script("arguments[0].click();", target_btn)

            # Chờ bảng mới xuất hiện
            start_wait = time.time()
            while len(driver.find_elements(By.TAG_NAME, "table")) <= before_count:
                time.sleep(config.TABLE_POLL_INTERVAL)
                if time.time() - start_wait > config.PAGE_LOAD_TIMEOUT:
                    break
        except StaleElementReferenceException:
            logger.debug("Stale element khi click, bỏ qua")
            break

    # --- 2. TRÍCH XUẤT DỮ LIỆU ---
    tables = driver.find_elements(By.TAG_NAME, "table")
    for table in tables:
        # Lấy tiêu đề bảng
        try:
            title_el = table.find_element(
                By.XPATH,
                "./preceding::*[self::h2 or self::h3 or self::strong or self::p][1]",
            )
            table_title = title_el.text
        except NoSuchElementException:
            table_title = "Dữ liệu không rõ"

        year_val = extract_year(table_title)
        if year_val != "N/A" and int(year_val) < config.MIN_YEAR:
            continue

        rows = table.find_elements(By.CSS_SELECTOR, "tr")[1:]  # bỏ header
        for row in rows:
            cols = row.find_elements(By.TAG_NAME, "td")
            if len(cols) >= 5:
                record = {
                    "Trường": uni["name"],
                    "Năm": year_val,
                    "Mã ngành": cols[1].text.strip(),
                    "Tên ngành": cols[2].text.strip(),
                    "Tổ hợp môn": cols[3].text.strip(),
                    "Điểm chuẩn": cols[4].text.strip(),
                    "Ghi chú": (
                        f"[{table_title}] {cols[5].text.strip() if len(cols) > 5 else ''}"
                    ).strip(),
                }
                # Validate: bỏ qua dòng thiếu thông tin quan trọng
                if record["Mã ngành"] and record["Tên ngành"]:
                    local_results.append(record)
                else:
                    logger.debug(
                        "Bỏ dòng thiếu mã/tên ngành: %s", record
                    )

    return local_results

# ============================================================
# CHƯƠNG TRÌNH CHÍNH
# ============================================================

if __name__ == "__main__":
    start_time = time.time()

    universities = load_universities(config.UNIVERSITIES_FILE)
    if not universities:
        logger.error("Danh sách trường rỗng — dừng chương trình.")
        sys.exit(1)

    logger.info("Bắt đầu crawl %d trường với %d luồng...",
                len(universities), config.MAX_WORKERS)

    all_final_results: list[dict] = []

    with ThreadPoolExecutor(max_workers=config.MAX_WORKERS) as executor:
        future_to_uni = {
            executor.submit(crawl_university, uni): uni for uni in universities
        }
        for future in as_completed(future_to_uni):
            uni = future_to_uni[future]
            try:
                result = future.result()
                all_final_results.extend(result)
            except Exception as e:
                logger.error("[Lỗi thread] %s: %s", uni["name"], e)

    # Xuất file Excel
    if all_final_results:
        df = pd.DataFrame(all_final_results)
        df.to_excel(config.OUTPUT_PATH, index=False)
        logger.info("Đã xuất %d dòng → %s", len(df), config.OUTPUT_PATH)
    else:
        logger.warning("Không có dữ liệu để xuất!")

    elapsed = round((time.time() - start_time) / 60, 2)
    logger.info("--- HOÀN THÀNH TRONG %s PHÚT ---", elapsed)