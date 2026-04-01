import pandas as pd
import time
import re
from concurrent.futures import ThreadPoolExecutor
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

universities = [
    {"name": "Học viện An ninh nhân dân", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-an-ninh-nhan-dan-ANH.html"},
    {"name": "Học viện Báo chí và Tuyên truyền", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-bao-chi-va-tuyen-truyen-HBT.html"},
    {"name": "Học viện Biên phòng", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-bien-phong-BPH.html"},
    {"name": "Học viện Cảnh sát nhân dân", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-canh-sat-nhan-dan-CSH.html"},
    {"name": "Học viện Chính sách và Phát triển", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-chinh-sach-va-phat-trien-HCP.html"},
    {"name": "HV Công nghệ Bưu chính Viễn thông", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-cong-nghe-buu-chinh-vien-thong-phia-bac-BVH.html"},
    {"name": "Học viện Hậu cần", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-hau-can-HEH.html"},
    {"name": "Học viện Khoa học Quân sự", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-khoa-hoc-quan-su-NQH.html"},
    {"name": "Học viện Kỹ thuật Mật mã", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-ky-thuat-mat-ma-KMA.html"},
    {"name": "Học viện Kỹ thuật Quân sự", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-ky-thuat-quan-su-KQH.html"},
    {"name": "Học viện Ngân hàng", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-ngan-hang-NHH.html"},
    {"name": "Học viện Ngoại giao", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-ngoai-giao-HQT.html"},
    {"name": "Học viện Nông nghiệp Việt Nam", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-nong-nghiep-viet-nam-HVN.html"},
    {"name": "HV Phòng không - Không quân", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-phong-khong-khong-quan-PKH.html"},
    {"name": "Học viện Phụ nữ Việt Nam", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-phu-nu-viet-nam-HPN.html"},
    {"name": "Học viện Quản lý Giáo dục", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-quan-ly-giao-duc-HVQ.html"},
    {"name": "Học viện Quân y", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-quan-y-he-quan-su-phia-bac-YQH.html"},
    {"name": "Học viện Tài chính", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-tai-chinh-HTC.html"},
    {"name": "HV Thanh thiếu niên Việt Nam", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-thanh-thieu-nien-viet-nam-HTN.html"},
    {"name": "Học viện Tòa án", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-toa-an-HTA.html"},
    {"name": "ĐH Công nghệ – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cong-nghe-dai-hoc-quoc-gia-ha-noi-QHI.html"},
    {"name": "ĐH Giáo dục – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-giao-duc-dai-hoc-quoc-gia-ha-noi-QHS.html"},
    {"name": "ĐH Khoa học Tự nhiên – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-khoa-hoc-tu-nhien-dai-hoc-quoc-gia-ha-noi-QHT.html"},
    {"name": "ĐH KHXH & Nhân văn – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-khoa-hoc-xa-hoi-va-nhan-van-dai-hoc-quoc-gia-ha-noi-QHX.html"},
    {"name": "ĐH Kinh tế – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-kinh-te-dai-hoc-quoc-gia-ha-noi-QHE.html"},
    {"name": "ĐH Luật – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-luat-dai-hoc-quoc-gia-ha-noi-QHL.html"},
    {"name": "ĐH Ngoại ngữ – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-ngoai-ngu-dai-hoc-quoc-gia-ha-noi-QHF.html"},
    {"name": "ĐH Y Dược – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/truong-dai-hoc-y-duoc-dai-hoc-quoc-gia-ha-noi-QHY.html"},
    {"name": "Trường Quốc tế – ĐHQGHN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/khoa-quoc-te-dai-hoc-quoc-gia-ha-noi-QHQ.html"},
    {"name": "ĐH Bách khoa Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-bach-khoa-ha-noi-BKA.html"},
    {"name": "ĐH Kinh tế Quốc dân", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-kinh-te-quoc-dan-KHA.html"},
    {"name": "ĐH Ngoại thương", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-ngoai-thuong-co-so-phia-bac-NTH.html"},
    {"name": "ĐH Thương mại", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-thuong-mai-TMU.html"},
    {"name": "ĐH Giao thông Vận tải", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-giao-thong-van-tai-ha-noi-GHA.html"},
    {"name": "ĐH Công nghiệp Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cong-nghiep-ha-noi-DCN.html"},
    {"name": "ĐH Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-ha-noi-NHF.html"},
    {"name": "ĐH Xây dựng Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-xay-dung-XDA.html"},
    {"name": "ĐH Luật Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-luat-ha-noi-LPH.html"},
    {"name": "ĐH Y Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-y-ha-noi-YHB.html"},
    {"name": "ĐH Dược Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-duoc-ha-noi-DKH.html"},
    {"name": "ĐH Điện lực", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-dien-luc-DDL.html"},
    {"name": "ĐH Mỏ - Địa chất", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-mo-dia-chat-MDA.html"},
    {"name": "ĐH Thủy lợi", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-thuy-loi-co-so-1-TLA.html"},
    {"name": "ĐH Công nghệ GTVT", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cong-nghe-giao-thong-van-tai-GTA.html"},
    {"name": "ĐH Mở Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-mo-ha-noi-MHN.html"},
    {"name": "ĐH Sư phạm Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-su-pham-ha-noi-SPH.html"},
    {"name": "ĐH Kiến trúc Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-kien-truc-ha-noi-KTA.html"},
    {"name": "ĐH Văn hóa Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-van-hoa-ha-noi-VHH.html"},
    {"name": "ĐH Tài nguyên & Môi trường", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-tai-nguyen-va-moi-truong-ha-noi-DMT.html"},
    {"name": "ĐH Nội vụ", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-noi-vu-ha-noi-DNV.html"},
    {"name": "ĐH Công đoàn", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cong-doan-LDA.html"},
    {"name": "ĐH Lao động Xã hội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-lao-dong-xa-hoi-co-so-ha-noi-DLX.html"},
    {"name": "ĐH Phenikaa", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-phenikaa-PKA.html"},
    {"name": "ĐH Thăng Long", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-thang-long-DTL.html"},
    {"name": "ĐH FPT Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-fpt-ha-noi-FPT.html"},
    {"name": "ĐH Kinh tế Kỹ thuật Công nghiệp", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-kinh-te-ky-thuat-cong-nghiep-DKK.html"},
    {"name": "ĐH Kiểm sát Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-kiem-sat-ha-noi-DKS.html"},
    {"name": "ĐH Thủ đô Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-thu-do-ha-noi-HNM.html"},
    {"name": "ĐH Y tế Công cộng", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-y-te-cong-cong-YTC.html"},
    {"name": "ĐH Kinh doanh & Công nghệ", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-kinh-doanh-va-cong-nghe-ha-noi-DQK.html"},
    {"name": "ĐH Công nghiệp Việt Hung", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cong-nghiep-viet-hung-VHD.html"},
    {"name": "ĐH Công nghiệp Dệt may HN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cong-nghiep-det-may-ha-noi-CCM.html"},
    {"name": "ĐH Công nghệ Đông Á", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cong-nghe-dong-a-DDA.html"},
    {"name": "ĐH Thành Đô", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-thanh-do-TDD.html"},
    {"name": "Trường Sĩ quan Lục quân 1", "url": "https://diemthi.tuyensinh247.com/diem-chuan/truong-si-quan-luc-quan-1-dai-hoc-tran-quoc-tuan-LAH.html"},
    {"name": "ĐH Phòng cháy chữa cháy", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-phong-chay-chua-chay-he-dan-su-phia-bac-PCH.html"},
    {"name": "HV Âm Nhạc Quốc Gia", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-am-nhac-quoc-gia-viet-nam-NVH.html"},
    {"name": "HV Chính Trị Công An Nhân Dân", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-chinh-tri-cong-an-nhan-dan-HCA.html"},
    {"name": "HV Dân Tộc", "url": "https://diemthi.tuyensinh247.com/diem-chuan/hoc-vien-dan-toc-HVD.html"},
    {"name": "Trường Sĩ quan Lục quân 2", "url": "https://diemthi.tuyensinh247.com/diem-chuan/truong-si-quan-luc-quan-2-dai-hoc-nguyen-hue-LBH.html"},
    {"name": "Trường Sĩ quan Phòng Hoá", "url": "https://diemthi.tuyensinh247.com/diem-chuan/truong-si-quan-phong-hoa-HGH.html"},
    {"name": "Trường Sĩ quan Đặc Công", "url": "https://diemthi.tuyensinh247.com/diem-chuan/truong-si-quan-dac-cong-DCH.html"},
    {"name": "ĐH CMC", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cmc-CMC.html"},
    {"name": "ĐH Hoà Bình", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-hoa-binh-ETU.html"},
    {"name": "ĐH Khoa Học và Công Nghệ Hà Nội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-khoa-hoc-va-cong-nghe-ha-noi-KCN.html"},
    {"name": "ĐH Lâm Nghiệp", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-lam-nghiep-LNH.html"},
    {"name": "ĐH Lao Động Xã Hội", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-lao-dong-xa-hoi-co-so-ha-noi-DLX.html"},
    {"name": "ĐH Mỹ thuật Công nghiệp", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-my-thuat-cong-nghiep-MTC.html"},
    {"name": "ĐH Mỹ thuật Việt Nam", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-my-thuat-viet-nam-MTH.html"},
    {"name": "ĐH Nguyễn Trãi", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-nguyen-trai-NTU.html"},
    {"name": "ĐH Phương Đông", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-phuong-dong-DPD.html"},
    {"name": "ĐH Sân khấu Điện ảnh HN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-san-khau-dien-anh-ha-noi-SKD.html"},
    {"name": "ĐH Sư Phạm Nghệ Thuật Trung Ương", "url": "hhttps://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-su-pham-nghe-thuat-trung-uong-GNT.html"},
    {"name": "ĐH Sư Phạm Thể Dục Thể Thao HN", "url": "hhttps://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-su-pham-the-duc-the-thao-ha-noi-TDH.html"},
    {"name": "ĐH Tài Chính Ngân Hàng HN", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-tai-chinh-ngan-hang-ha-noi-FBU.html"},
    {"name": "ĐH Đông Đô", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-dong-do-DDU.html"},
    {"name": "ĐH Công nghệ và Quản lí hữu nghị", "url": "https://diemthi.tuyensinh247.com/diem-chuan/dai-hoc-cong-nghe-va-quan-ly-huu-nghi-DCQ.html"}
]

def extract_year(text):
    match = re.search(r'20\d{2}', text)
    return match.group() if match else "N/A"

def crawl_university(uni):
    """Hàm xử lý cho duy nhất 1 trường, sẽ được gọi bởi từng luồng riêng biệt"""
    local_results = []
    
    # Cấu hình Chrome chạy ẩn (Headless) để không tốn tài nguyên hiển thị
    chrome_options = Options()
    chrome_options.add_argument("--headless") 
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--window-size=1920,1080")
    # Tắt load ảnh để nhanh hơn
    prefs = {"profile.managed_default_content_settings.images": 2}
    chrome_options.add_experimental_option("prefs", prefs)

    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        print(f"[Bắt đầu] {uni['name']}")
        driver.get(uni['url'])
        
        # 1. MỞ RỘNG TẤT CẢ CÁC BẢNG (ĐA PHƯƠNG THỨC)
        while True:
            buttons = driver.find_elements(By.XPATH, "//a[contains(text(), 'Xem thêm') and contains(text(), 'năm 20')]")
            target_btn = None
            for btn in buttons:
                try:
                    y = extract_year(btn.text)
                    if y != "N/A" and int(y) >= 2021:
                        target_btn = btn
                        break
                except: continue
            
            if not target_btn: break
            
            before_count = len(driver.find_elements(By.TAG_NAME, "table"))
            try:
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", target_btn)
                time.sleep(0.5)
                driver.execute_script("arguments[0].click();", target_btn)
                
                # Chờ bảng mới xuất hiện
                start_wait = time.time()
                while len(driver.find_elements(By.TAG_NAME, "table")) <= before_count:
                    time.sleep(0.5)
                    if time.time() - start_wait > 10: break
            except: break

        # 2. TRÍCH XUẤT DỮ LIỆU
        tables = driver.find_elements(By.TAG_NAME, "table")
        for table in tables:
            try:
                title_el = table.find_element(By.XPATH, "./preceding::*[self::h2 or self::h3 or self::strong or self::p][1]")
                table_title = title_el.text
            except: table_title = "Dữ liệu không rõ"

            year_val = extract_year(table_title)
            if year_val != "N/A" and int(year_val) < 2021: continue
            
            rows = table.find_elements(By.CSS_SELECTOR, "tr")[1:]
            for row in rows:
                cols = row.find_elements(By.TAG_NAME, "td")
                if len(cols) >= 5:
                    local_results.append({
                        "Trường": uni['name'],
                        "Năm": year_val,
                        "Mã ngành": cols[1].text.strip(),
                        "Tên ngành": cols[2].text.strip(),
                        "Tổ hợp môn": cols[3].text.strip(),
                        "Điểm chuẩn": cols[4].text.strip(),
                        "Ghi chú": f"[{table_title}] {cols[5].text.strip() if len(cols) > 5 else ''}".strip()
                    })
        print(f"[Xong] {uni['name']} - Lấy được {len(local_results)} dòng.")
        return local_results

    except Exception as e:
        print(f"[Lỗi] {uni['name']}: {e}")
        return []
    finally:
        driver.quit()

# --- CHƯƠNG TRÌNH CHÍNH ---
if __name__ == "__main__":
    start_time = time.time()
    all_final_results = []
    
    # Số luồng chạy song song (Nên để từ 3-5 để tránh treo máy hoặc bị chặn)
    MAX_WORKERS = 4 
    
    print(f"Bắt đầu crawl với {MAX_WORKERS} luồng...")
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Gửi danh sách công việc cho các luồng
        results = list(executor.map(crawl_university, universities))
    
    # Gộp kết quả từ các luồng lại
    for res_list in results:
        all_final_results.extend(res_list)
    
    # Xuất file Excel
    df = pd.DataFrame(all_final_results)
    df.to_excel("diem_chuan_da_luong.xlsx", index=False)
    
    end_time = time.time()
    print(f"\n--- HOÀN THÀNH TRONG {round((end_time - start_time)/60, 2)} PHÚT ---")