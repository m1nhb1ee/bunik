"""
config.py — Cấu hình tập trung cho Bunik Crawler v4
Tương thích với Bunik Database v4.0 (3NF / UNIVERSITY_PROGRAMS schema)

Output (trong bunik_crawl_output/):
  CSV + JSON cho mỗi bảng:
    admission_methods.csv / .json   → bảng ADMISSION_METHODS  (seed cố định)
    subject_groups.csv / .json      → bảng SUBJECT_GROUPS
    major_subject_groups.csv / .json→ bảng MAJOR_SUBJECT_GROUPS (M2M junction)
    major_catalog.csv / .json       → bảng MAJOR_CATALOG       (có field_id)
    university_programs.csv / .json → bảng UNIVERSITY_PROGRAMS
    admission_scores.csv / .json    → bảng ADMISSION_SCORES
    raw_all_data.xlsx               → debug
"""

import os

# ============================================================
# ĐƯỜNG DẪN
# ============================================================
BASE_DIR          = os.path.dirname(os.path.abspath(__file__))
UNIVERSITIES_FILE = os.path.join(BASE_DIR, "universities.txt")
OUTPUT_DIR        = os.path.join(BASE_DIR, "bunik_crawl_output")

# ============================================================
# CRAWLER
# ============================================================
MAX_WORKERS  = 4    # Số luồng song song (3–5 để tránh bị chặn)
MIN_YEAR     = 2023 # Chỉ lấy dữ liệu từ năm này trở đi (2023–2025)
MAX_RETRIES  = 2    # Số lần retry khi gặp lỗi WebDriver/mạng
RETRY_DELAY  = 3    # Giây chờ giữa các lần retry

# ============================================================
# CHROME OPTIONS
# ============================================================
CHROME_HEADLESS       = True
CHROME_WINDOW_SIZE    = "1920,1080"
CHROME_DISABLE_GPU    = True
CHROME_NO_SANDBOX     = True
CHROME_DISABLE_IMAGES = True  # Tắt load ảnh → tăng tốc độ crawl

# ============================================================
# TIMEOUT & TIMING
# ============================================================
PAGE_LOAD_WAIT      = 2    # Giây chờ sau driver.get() trước khi thao tác
PAGE_LOAD_TIMEOUT   = 8    # Giây chờ tối đa bảng mới xuất hiện sau click
CLICK_WAIT          = 0.4  # Giây chờ sau khi scroll trước khi click
TABLE_POLL_INTERVAL = 0.3  # Giây giữa mỗi lần poll kiểm tra bảng mới
MAX_EXPAND_LOOPS    = 20   # Số vòng click "Xem thêm" tối đa

# ============================================================
# LOGGING
# ============================================================
LOG_FORMAT      = "%(asctime)s [%(levelname)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
LOG_FILE        = os.path.join(BASE_DIR, "crawl.log")

# ============================================================
# SEED: ADMISSION_METHODS
# Danh sách cố định — không phụ thuộc vào kết quả crawl.
# Code phải khớp với dữ liệu seed trong DB production.
# ============================================================
ADMISSION_METHODS_SEED = [
    {
        "code":        "THPT",
        "name":        "Kết quả thi THPT Quốc gia",
        "description": "Xét theo điểm thi THPT quốc gia, thang 30 điểm",
    },
    {
        "code":        "HSA",
        "name":        "Xét học bạ THPT",
        "description": "Xét theo điểm học bạ THPT",
    },
    {
        "code":        "DGNL_HN",
        "name":        "Đánh giá năng lực ĐHQG Hà Nội",
        "description": "Bài thi ĐGNL do ĐHQG Hà Nội tổ chức, thang 150 điểm",
    },
    {
        "code":        "DGNL_HCM",
        "name":        "Đánh giá năng lực ĐHQG TP.HCM",
        "description": "Bài thi ĐGNL do ĐHQG TP.HCM tổ chức, thang 1200 điểm",
    },
    {
        "code":        "DGTD",
        "name":        "Đánh giá tư duy (ĐHBK Hà Nội)",
        "description": "Bài thi tư duy do ĐH Bách khoa Hà Nội tổ chức",
    },
    {
        "code":        "KH",
        "name":        "Xét tuyển kết hợp",
        "description": "Kết hợp nhiều tiêu chí: THPT + học bạ + chứng chỉ ngoại ngữ...",
    },
    {
        "code":        "XTT",
        "name":        "Xét tuyển thẳng",
        "description": "Xét thẳng theo quy định ưu tiên của Bộ GD&ĐT",
    },
    {
        "code":        "OTHER",
        "name":        "Phương thức khác",
        "description": "Phương thức xét tuyển đặc thù của từng trường",
    },
]

# ============================================================
# MAPPING: text thô từ tuyensinh247 → code trong ADMISSION_METHODS
# Duyệt theo thứ tự — từ khóa dài/cụ thể trước, tránh match nhầm.
# ============================================================
METHOD_KEYWORD_MAP: list[tuple[str, str]] = [
    ("đgnl đhqghn",            "DGNL_HN"),
    ("đgnl hà nội",            "DGNL_HN"),
    ("đgnl hcm",               "DGNL_HCM"),
    ("đgnl tphcm",             "DGNL_HCM"),
    ("đánh giá năng lực",      "DGNL_HN"),
    ("đánh giá tư duy",        "DGTD"),
    ("tư duy",                 "DGTD"),
    ("đgtd",                   "DGTD"),
    ("kết quả thi thpt",       "THPT"),
    ("điểm thi thpt",          "THPT"),
    ("thi thpt",               "THPT"),
    ("thpt",                   "THPT"),
    ("xét học bạ",             "HSA"),
    ("học bạ",                 "HSA"),
    ("xét tuyển thẳng",        "XTT"),
    ("tuyển thẳng",            "XTT"),
    ("kết hợp",                "KH"),
    ("đgnl",                   "DGNL_HN"),
]

# ============================================================
# MAPPING: prefix mã ngành → field_code trong FIELDS
#
# Mã ngành Bộ GD&ĐT có dạng 7XXXXXX.
# 3 ký tự đầu (VD: "748") xác định nhóm ngành → field.
# field_code dùng để JOIN với bảng FIELDS khi import DB.
# Bổ sung thêm nếu phát sinh prefix mới trong quá trình crawl.
# ============================================================
MAJOR_PREFIX_TO_FIELD: dict[str, str] = {
    # Khoa học máy tính & CNTT
    "748": "CNTT",          # Máy tính và CNTT
    "752": "CNTT",          # Hệ thống thông tin
    "480": "CNTT",          # Công nghệ thông tin (mã cũ)

    # Kỹ thuật & Công nghệ
    "752": "KY_THUAT",      # Kỹ thuật
    "758": "KY_THUAT",      # Kỹ thuật điện, điện tử
    "760": "KY_THUAT",      # Kỹ thuật cơ khí
    "762": "KY_THUAT",      # Kỹ thuật hoá học
    "764": "KY_THUAT",      # Kỹ thuật môi trường
    "766": "KY_THUAT",      # Kỹ thuật địa chất
    "768": "KY_THUAT",      # Kỹ thuật xây dựng
    "770": "KY_THUAT",      # Kỹ thuật giao thông
    "772": "KY_THUAT",      # Kỹ thuật hàng không
    "774": "KY_THUAT",      # Kỹ thuật vũ khí
    "776": "KY_THUAT",      # Kỹ thuật năng lượng
    "778": "KY_THUAT",      # Kỹ thuật dệt may, da giày
    "520": "KY_THUAT",      # Kỹ thuật (mã cũ)

    # Kinh tế & Quản trị
    "734": "KINH_TE",       # Kinh doanh & quản lý
    "736": "KINH_TE",       # Tài chính ngân hàng
    "738": "KINH_TE",       # Kế toán kiểm toán
    "340": "KINH_TE",       # Kinh tế (mã cũ)

    # Luật & Xã hội
    "738": "LUAT",          # Pháp luật
    "380": "LUAT",          # Luật (mã cũ)
    "756": "XA_HOI",        # Khoa học xã hội & nhân văn
    "310": "XA_HOI",        # Khoa học xã hội (mã cũ)

    # Ngôn ngữ & Văn hóa
    "722": "NGON_NGU",      # Ngôn ngữ học
    "220": "NGON_NGU",      # Ngôn ngữ (mã cũ)

    # Sư phạm & Giáo dục
    "714": "SU_PHAM",       # Giáo dục học
    "716": "SU_PHAM",       # Sư phạm các môn
    "140": "SU_PHAM",       # Sư phạm (mã cũ)

    # Y - Dược - Sức khỏe
    "720": "Y_DUOC",        # Y học
    "724": "Y_DUOC",        # Dược học
    "726": "Y_DUOC",        # Y tế công cộng
    "728": "Y_DUOC",        # Điều dưỡng
    "730": "Y_DUOC",        # Kỹ thuật y tế
    "580": "Y_DUOC",        # Y dược (mã cũ)

    # Nông - Lâm - Ngư
    "620": "NONG_LAM",      # Nông lâm nghiệp
    "640": "NONG_LAM",      # Thú y

    # Nghệ thuật
    "210": "NGHE_THUAT",    # Nghệ thuật
    "215": "NGHE_THUAT",    # Âm nhạc, sân khấu, điện ảnh

    # Thể dục thể thao
    "810": "THE_THAO",      # Thể dục thể thao

    # Quân sự - An ninh
    "860": "QUAN_SU",       # Quân sự
    "861": "QUAN_SU",       # An ninh

    # Khoa học tự nhiên
    "744": "KHOA_HOC_TN",   # Khoa học tự nhiên
    "440": "KHOA_HOC_TN",   # Khoa học tự nhiên (mã cũ)

    # Du lịch - Khách sạn
    "810": "DU_LICH",       # Du lịch khách sạn
}
