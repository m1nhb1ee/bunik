# Pipeline tính Rating trường Đại học (Bunik)

Tài liệu tổng hợp toàn bộ quy trình xử lý dữ liệu và công thức thuật toán để tính **rating thang 5.0** cho các trường đại học, gồm 4 khâu:

```
[1] Crawl VNUR  →  [2] Rerank (penalty)  →  [4] Rating cuối (5.0)
                                              ↑
[3] Score điểm chuẩn (Supabase) ─────────────┘
```

| Khâu | Input | Output | Script |
|---|---|---|---|
| 1. Crawl VNUR | vnur.vn | `vnur_overall_rankings_from_home.csv`, `vnur_rankings_by_criteria_from_2025_url.csv` | (crawler phiên trước) |
| 2. Rerank | output khâu 1 | `rerank/vnur_rerank_universities.csv`, `rerank/vnur_score_universities.csv` | (rerank phiên trước) |
| 3. Score điểm chuẩn | Supabase `admission_scores` | `score/university_latest_admission_score_stats.csv` | `build_rating.py` |
| 4. Rating cuối | output khâu 2 + 3 | `star/rating_universities_final_5.csv` + excluded + audit + methodology | `build_rating.py` |

---

## Khâu 1 — Crawl VNUR

Nguồn: **VNUR (Vietnam University Rankings, vnur.vn)** — bảng xếp hạng đại học Việt Nam, công bố công khai hằng năm.

Crawl 2 bảng:
- **Bảng tổng (trang chủ):** top 100 trường mỗi năm (2023–2026), kèm hạng tổng + hạng từng tiêu chí. → `vnur_overall_rankings_from_home.csv` (~400 dòng = 4 năm × 100).
- **Bảng theo tiêu chuẩn (2026):** hạng của từng trường theo 6 tiêu chí. → `vnur_rankings_by_criteria_from_2025_url.csv` (~600 dòng = 6 tiêu chí × 100).

**6 tiêu chí VNUR:**
1. Chất lượng được công nhận
2. Dạy học
3. Công bố bài báo khoa học
4. Nhiệm vụ khoa học công nghệ & sáng chế
5. Chất lượng người học
6. Cơ sở vật chất

**Làm sạch:** chuẩn hóa tên trường (bỏ ngoặc đơn, không phân biệt hoa/thường/dấu, `Đ/đ → D/d`, chuẩn hóa "TP. Hồ Chí Minh", coi "Trường Đại học X" ≡ "Đại học X"), phát hiện & gộp trùng tên, ưu tiên dòng năm 2026.

---

## Khâu 2 — Rerank (xếp lại + phạt trường rớt top)

Mục tiêu: gộp 4 năm dữ liệu, **phạt nặng hơn các trường đã rớt khỏi top 100 hiện tại** (2026) — vì hạng cũ không còn phản ánh đúng.

Hằng số: `CURRENT_YEAR = 2026`, `EVALUATED_TOTAL = 193` (tổng số trường được đánh giá), `PENALTY_RATE = 0.5`.

### 2a. Trường đang trong top 100 (2026)
```
avg_rank = mean(  mean(overall_2026_rank_i, criteria_2026_rank_i)  với i = 6 tiêu chí  )
rerank_score_100 = 100 × (193 − clamp(avg_rank, 1, 193)) / 192
```

### 2b. Trường đã rớt khỏi top 100 (2026) — bị phạt
```
source_year         = năm gần nhất trường còn xuất hiện trong top 100 (trước 2026)
base_avg_rank       = mean(6 hạng tiêu chí của source_year)
penalty_multiplier  = 1 + (2026 − source_year) × 0.5 × (national_rank_source_year / 193)
adjusted_avg_rank   = clamp(base_avg_rank × penalty_multiplier, 1, 193)
rerank_score_100    = 100 × (193 − adjusted_avg_rank) / 192
```
→ Rớt càng lâu (`2026 − source_year` lớn) và hạng quốc gia càng thấp (`national_rank` lớn) thì phạt càng nặng.

### 2c. Quy điểm 6 tiêu chí về thang 100
Mỗi tiêu chí: `score_100 = 100 × (193 − rank_used) / 192` (hạng 1 → ~99.5; hạng 193 → 0).
File `vnur_score_universities.csv` chứa `recognized_quality_score_100`, `teaching_score_100`, `publications_score_100`, `science_tech_innovation_score_100`, `learner_quality_score_100`, `facilities_score_100` (+ `avg_6criteria_score_100`). **Đây là input VNUR cho khâu 4.**

---

## Khâu 3 — Score điểm chuẩn (từ Supabase)

Lấy điểm chuẩn THPT mới nhất mỗi trường từ Supabase (`admission_scores`), quy về thang 30.

**Chỉ dùng phương thức THPT** vì chỉ THPT có cột `normalized_score` (thang 30 chung). Các phương thức khác (DGNL_HN 0–150, DGTD 0–87.5, KH 0–1500, HBA 0–40) thang khác nhau, **không trộn được**. Riêng trường có VNUR mà thiếu THPT thì fallback HBA (xem khâu 4).

### 3a. Khóa gom (admission_key) — đã sửa lỗi đếm đôi
```
key = university_program_id | subject_group_code | gender | region_code
```
Lấy **MAX `normalized_score`** mỗi key theo từng năm.
> ⚠️ **Không** dùng `variant_label` và `variant_key` dạng `"source:..."` trong khóa — chúng tạo nhiều dòng cùng một điểm chuẩn (vd 1 program ghi 2 dòng chỉ khác chú thích) làm `top10` bị phồng. (Khác với `TruongDetailPage.getVariantIdentity` vốn dùng để *hiển thị* từng dòng.)

### 3b. Chọn năm & thống kê
```
latest_year = 2025 nếu có dữ liệu, ngược lại năm mới nhất có điểm
vals        = danh sách MAX-score mỗi key trong latest_year
avg_thpt_score              = mean(vals)
top10_variant_avg_thpt_score = mean(10 giá trị cao nhất của vals)
```

---

## Khâu 4 — Rating cuối (thang 5.0)

Phạm vi: **86 trường có trong bảng `universities` Supabase**. Mỗi trường rơi vào một nhóm:

```
┌─ Quân đội/công an (15) ──────────────→ EXCLUDED (VNUR không xếp hạng)
│
├─ Có trong VNUR:
│    ├─ có THPT ───────────────────────→ RATED, rating_type = full (admission_source=THPT)
│    ├─ không THPT, có HBA ────────────→ RATED, rating_type = full (admission_source=HBA)
│    └─ không có điểm chuẩn nào ───────→ EXCLUDED (matched_vnur_no_admission)
│
└─ Không có trong VNUR:
     ├─ có THPT ───────────────────────→ RATED, rating_type = vnur_imputed
     └─ không có điểm chuẩn ───────────→ EXCLUDED (not_in_vnur_no_admission)
```

### 4a. Năm thành phần (mỗi cái thang 0–1)
| | Thành phần | Công thức |
|---|---|---|
| C1 | quality_teaching | `mean(recognized_quality, teaching) / 100` |
| C2 | research_innovation | `mean(publications, science_tech_innovation) / 100` |
| C3 | learner_facilities | `mean(learner_quality, facilities) / 100` |
| C4 | avg_admission | `avg_thpt_score / 30`, clamp [0,1] |
| C5 | top10_admission | `top10_variant_avg_thpt_score / 30`, clamp [0,1] |

C1–C3 gói 6 tiêu chí VNUR (mỗi cái = TB của 2 tiêu chí gốc).

### 4b. Công thức rating — trọng số 50/50
```
vnur_score       = mean(C1, C2, C3)          # nhóm VNUR, 0..1
admission_score  = mean(C4, C5)              # nhóm điểm chuẩn, 0..1
final_rating_5   = 5 × (W_VNUR × vnur_score + W_ADMISSION × admission_score)
```
Hiện `W_VNUR = W_ADMISSION = 0.5` (chỉnh được trong `build_rating.py`).

> **Vì sao chuẩn hóa từng nhóm về 0–1 (chia số thành phần) trước khi gán trọng số?**
> Nhóm VNUR có 3 thành phần, nhóm điểm chuẩn có 2. Nếu chỉ viết `0.5×(C1+C2+C3) + 0.5×(C4+C5)` thì VNUR vẫn nặng 3:2 = **60:40** (và thang tối đa chỉ còn 2.5). Phải lấy *trung bình* mỗi nhóm thì 50/50 mới đúng.

### 4c. Fallback HBA (trường có VNUR nhưng thiếu THPT)
Dùng điểm HBA (học bạ + năng khiếu) thay cho C4/C5, tự quy về thang 30:
```
nếu trường có giá trị raw > 30 → coi là thang 40, nhân 30/40; ngược lại coi như đã thang 30
```
Ví dụ: **ĐH Mỹ thuật VN** (điểm "kết hợp học bạ + thi năng khiếu", thang 40).

### 4d. Suy diễn VNUR cho trường không có trong VNUR (`vnur_imputed`)
Trường không nộp hồ sơ VNUR (thường yếu) nhưng có THPT → **suy diễn** 3 tiêu chí VNUR từ phân bố dữ liệu, không hardcode:
```
C1_imp, C2_imp, C3_imp = mean(component) − σ(component)   # tính trên các trường rating_type=full
```
Rồi áp công thức 4b như bình thường. Penalty tự sinh từ dữ liệu (chạy lại data tự cập nhật).

---

## Các cột trong `rating_universities_final_5.csv`

| Cột | Ý nghĩa |
|---|---|
| `rating_rank` | Thứ hạng (1 = cao nhất) |
| `institution` / `university_code` | Tên / mã trường (Supabase) |
| `final_rating_5` | **Điểm rating cuối, thang 5.0** (công thức 4b) |
| `rating_type` | `full` (VNUR thật) · `vnur_imputed` (VNUR suy diễn) |
| `vnur_score_1` | Điểm nhóm VNUR 0–1 = mean(C1,C2,C3) |
| `admission_score_1` | Điểm nhóm điểm chuẩn 0–1 = mean(C4,C5) |
| `quality_teaching_score_1` (C1) | TB: Chất lượng được công nhận + Dạy học |
| `research_innovation_score_1` (C2) | TB: Công bố khoa học + Nhiệm vụ KHCN & sáng chế |
| `learner_facilities_score_1` (C3) | TB: Chất lượng người học + Cơ sở vật chất |
| `avg_admission_score_1` (C4) | Điểm chuẩn TB / 30 |
| `top10_admission_score_1` (C5) | Điểm chuẩn top10 / 30 |
| `avg_thpt_score` / `top10_variant_avg_thpt_score` | Điểm chuẩn **thô** thang 30 (= C4×30 / C5×30) |
| `admission_latest_year` | Năm dữ liệu điểm chuẩn (ưu tiên 2025) |
| `admission_source` | `THPT` hoặc `HBA` |
| `vnur_source_institution` | Tên trường VNUR đã khớp |
| `match_status` | `matched` / `matched_alias` / `matched_vnu_hn_cluster` / `not_in_vnur_imputed` |

**File phụ:** `excluded_universities.csv` (trường bị loại + lý do), `match_audit.csv` (audit khớp VNUR từng trường), `*_methodology.json` (ghi lại tham số mỗi lần chạy).

---

## Quy tắc đặc biệt

- **Cluster ĐHQGHN:** 9 trường thành viên (QHI, QHS, QHX, QHT, QHE, QHF, QHY, QHQ, QHL) dùng **điểm chuẩn riêng** nhưng lấy 6 tiêu chí VNUR từ **trường mẹ "Đại học Quốc gia Hà Nội"**.
- **Khớp tên VNUR↔Supabase:** chuẩn hóa có xử lý `Đ/đ` (NFD không tách), + 6 alias đã xác minh thủ công (FPT, Nội vụ, Tài nguyên & MT, Kinh doanh & CN, Tài chính-NH HN, Công nghệ GTVT).
- **Loại trừ:** 15 quân đội/công an + 5 trường không VNUR & không điểm chuẩn (Dân tộc, Mỹ thuật CN, Âm nhạc, Sân khấu, SP TDTT).

## Kết quả hiện tại
**66 trường rated** (58 full + 8 vnur_imputed) · **20 excluded** (15 quân đội + 5 không-data) · tổng 86 · rating ∈ [1.73, 4.68].

## Tái chạy
```bash
python database/rating/build_rating.py
```
Đọc `backend/.env` (Supabase REST), fetch điểm chuẩn mới nhất, đọc `rerank/vnur_score_universities.csv`, xuất lại toàn bộ file ở `star/` và `score/`.
