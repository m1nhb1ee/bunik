# Bunik v8 — Báo cáo clean và thiết kế schema

Thư mục này là bộ import hoàn chỉnh được tạo theo chuỗi:

1. `../clean_tuyensinh247_import.py`
2. `../finalize_v4.py`
3. `../migration_v8.sql`
4. `import_v4.sql`

## Trạng thái dữ liệu

- Giữ đủ **19.796/19.796** dòng điểm và source ID từ file crawl.
- Chỉ còn **4 correction đã đối soát**:
  - `148424`: KH `2600 → 26`
  - `134489`: THPT `2337 → 23,37`
  - `134490`: THPT `193 → 19,3`
  - `194887`: HBA `2333 → 23,33`
- Đã khôi phục 285 correction KH bị chia sai trước đó về giá trị file crawl.
- Có 255 điểm thập phân được làm tròn đến 2 chữ số, sai số tối đa `0,005`.
- Giữ nguyên 770 điểm bằng 0 đã có trong nguồn: DGNL_HN 433, DGTD 330,
  HBA 6, KH 1. Điểm 0 không tham gia analytics.
- `course_catalog.csv` có 8.061 dòng vì mỗi ngành có thể lặp theo phương thức và
  tổ hợp. Sau tổng hợp có 1.924 chương trình active và 6.306 option
  chương trình–phương thức; đây không phải duplicate chương trình.

## Thay đổi cấu trúc v8

### Chương trình canonical và mã lịch sử

- `university_programs.canonical_program_id` trỏ mã lịch sử/inactive đến chương
  trình active tương ứng.
- `university_program_aliases` lưu 677 ánh xạ có thể xác định chắc chắn.
- Các mã cũ vẫn được giữ để truy vết; điểm được remap sang chương trình canonical
  khi ánh xạ đủ chắc chắn.
- 1.477 điểm còn gắn với chương trình inactive chưa thể ánh xạ chắc chắn. Chúng
  vẫn tồn tại trong `admission_scores`, nhưng bị loại khỏi analytics chương trình
  active để tránh gộp sai.

### Dimension cho cutoff

`admission_scores` có thêm:

- `variant_key` — khóa bắt buộc, phân biệt cutoff trong cùng chương trình/phương
  thức/năm.
- `source_program_code`, `variant_label` — dữ liệu truy vết từ nguồn.
- `gender`, `region_code`, `subject_group_code` — các dimension tách được từ dữ
  liệu crawl.
- `normalized_score`, `normalized_scale` — chỉ chuẩn hóa điểm THPT dương về thang
  30; không trộn thang SAT, DGNL, DGTD, HBA hoặc KH.

Khóa conflict/upsert hiện tại:

```text
(university_program_id, admission_method_code, year, variant_key)
```

### Catalog theo phương thức

- `university_program_admission_options`: 6.306 dòng chương trình–phương thức.
- `university_program_admission_option_subject_groups`: 23.669 liên kết tổ hợp
  thuộc từng option.
- `university_program_subject_groups`: 17.630 liên kết union ở cấp chương trình.

### Analytics

- `v_university_stats` chỉ dùng THPT dương của năm mới nhất, chuẩn hóa về thang
  30 và lấy median các biến thể theo chương trình trước khi tổng hợp theo trường.
- `MajorTrendsView` áp dụng cùng quy tắc, không còn trộn các phương thức khác thang.
- Sau import live: `max(avg_score) = 28,67`, `max(max_score) = 30,00`.

## Các sửa lỗi khác

- Chuẩn hóa 1.831 mã ngành biến thể thành 1.342 mã ngành canonical; sinh 503
  `major_code_aliases`.
- Sửa field của ngành `5248020` thành `cntt`.
- Sửa định nghĩa A03, A04, A06, A07.
- Mở rộng liên kết tổ hợp từ dữ liệu catalog; không còn overwrite khi một ngành
  xuất hiện ở nhiều phương thức.
- Quota thiếu được giữ `NULL`, không đổi thành 0.

## Điểm còn cần đối soát thủ công

Không tự đoán các giá trị không có nguồn xác thực:

- 201 chương trình không khớp `course_catalog`, vẫn được giữ với
  `missing_reason` và `is_active = false`.
- 18 tổ hợp chưa có định nghĩa môn chính thức: M03, M10, N03, N05, N06, Q01–Q10,
  Q21, T04, Y08. Chúng được giữ với `is_verified = false`.
- RLS/bảo mật nằm ngoài phạm vi phiên này theo yêu cầu.

## Số lượng file import

| File/table | Số dòng |
|---|---:|
| provinces | 1 |
| fields | 24 |
| admission_methods | 9 |
| subject_groups | 222 |
| universities | 86 |
| major_catalog | 1.342 |
| major_code_aliases | 503 |
| major_subject_groups | 9.767 |
| university_programs | 2.856 |
| university_program_aliases | 677 |
| university_program_subject_groups | 17.630 |
| university_program_admission_options | 6.306 |
| university_program_admission_option_subject_groups | 23.669 |
| admission_scores | 19.796 |
| review_score_corrections | 4 |
