"""
Cấu hình tập trung cho crawler điểm chuẩn đại học.
Tất cả các giá trị hardcode được quản lý tại đây.
"""

import os

# --- Đường dẫn ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UNIVERSITIES_FILE = os.path.join(BASE_DIR, "universities.txt")
OUTPUT_FILENAME = "diem_chuan_da_luong.xlsx"
OUTPUT_PATH = os.path.join(BASE_DIR, OUTPUT_FILENAME)

# --- Crawler ---
MAX_WORKERS = 4          # Số luồng chạy song song (3-5 để tránh bị chặn)
MIN_YEAR = 2021          # Chỉ lấy dữ liệu từ năm này trở đi
MAX_RETRIES = 2          # Số lần retry khi gặp lỗi
RETRY_DELAY = 3          # Giây chờ giữa các lần retry

# --- Chrome Options ---
CHROME_HEADLESS = True
CHROME_WINDOW_SIZE = "1920,1080"
CHROME_DISABLE_GPU = True
CHROME_NO_SANDBOX = True
CHROME_DISABLE_IMAGES = True   # Tắt load ảnh để tăng tốc

# --- Timeout ---
PAGE_LOAD_TIMEOUT = 10   # Giây chờ tối đa khi click "Xem thêm"
CLICK_WAIT = 0.5         # Giây chờ sau khi scroll trước khi click
TABLE_POLL_INTERVAL = 0.5  # Giây giữa mỗi lần kiểm tra bảng mới

# --- Logging ---
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
LOG_FILE = os.path.join(BASE_DIR, "crawl.log")
