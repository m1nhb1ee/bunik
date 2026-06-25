# -*- coding: utf-8 -*-
"""
Tinh rating thang 5.0 cho cac truong dai hoc.

Pham vi (scope):
  - Vu tru = cac truong CO trong bang `universities` cua Supabase (~86 truong).
  - Loai cac hoc vien quan doi / cong an (VNUR khong xep hang -> khong co 6 tieu chi).
  - Loai cac truong khong co mat trong bang xep hang VNUR (khong the tinh 6 tieu chi).
  - Cac truong bi loai duoc ghi ra excluded_universities.csv kem ly do + diem chuan (neu co).

Nguon du lieu:
  - 6 tieu chi VNUR: database/rating/rerank/vnur_score_universities.csv
        (da rerank + penalty o phien truoc; file nay giu nguyen, khong tinh lai).
  - Diem chuan THPT: lay truc tiep tu Supabase (admission_scores), dung normalized_score (thang 30).

Phan loai truong (rating_type):
  - 'full': co CA 6 tieu chi VNUR LAN diem chuan -> final = C1+C2+C3+C4+C5 (max 5.0).
        Diem chuan uu tien THPT; neu khong co THPT thi fallback HBA (hoc ba + nang khieu),
        tu dong quy ve thang 30 (neu co gia tri raw > 30 -> coi la thang 40, nhan 30/40).
  - 'vnur_imputed': KHONG co trong VNUR (thuong la truong chua tot / chua nop ho so kiem dinh)
        nhung CO diem chuan THPT -> SUY DIEN 3 tieu chi VNUR o muc "thap hon trung binh 1 do lech
        chuan" (mean - sigma, tinh tu chinh cac truong full), roi cong tong nhu cong thuc goc:
        final = C1_imp + C2_imp + C3_imp + C4 + C5.
        Penalty tu sinh tu phan bo du lieu, khong dung hang so hardcode.
  - Khong VNUR va khong co diem chuan nao -> excluded (not_in_vnur_no_admission).

Thanh phan (moi cai 0..1):
    C1 quality_teaching     = mean(recognized_quality, teaching) / 100
    C2 research_innovation  = mean(publications, science_tech)   / 100
    C3 learner_facilities   = mean(learner_quality, facilities)  / 100
    C4 avg_admission        = avg_score / 30
    C5 top10_admission      = top10_avg / 30

Khoa gom diem chuan (sua loi dem doi): gom theo CHIEU TUYEN SINH THAT, bo qua variant_label
(chu thich tu do) va variant_key dang "source:..." von tao ra cac dong trung diem:
    program_id | subject_group_code | gender | region_code   (lay MAX normalized_score)
"""

import csv
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # tranh UnicodeEncodeError tren console Windows (cp1252)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RATING_DIR = os.path.join(ROOT, "database", "rating")
ENV_PATH = os.path.join(ROOT, "backend", ".env")
VNUR_SCORE_CSV = os.path.join(RATING_DIR, "rerank", "vnur_score_universities.csv")

# --- cac truong quan doi / cong an: loai khoi bang rating (VNUR khong xep hang) ---
MILITARY_CODES = {
    "ANH", "BPH", "CSH", "DCH", "HCA", "HEH", "HGH", "KMA", "KQH",
    "LAH", "LBH", "NQH", "PCH", "PKH", "YQH",
}

# --- thanh vien Dai hoc Quoc gia Ha Noi: VNUR xep truong me, dung diem chuan rieng ---
VNU_HN_MEMBER_CODES = {"QHI", "QHS", "QHX", "QHT", "QHE", "QHF", "QHY", "QHQ", "QHL"}
VNU_HN_PARENT = "Đại học Quốc gia Hà Nội"

# --- trong so 2 nhom: VNUR (6 tieu chi) vs diem chuan. Hien 50-50 ---
W_VNUR = 0.5
W_ADMISSION = 0.5

# --- khoi quan doi/cong an: VNUR khong xep hang -> 3 tieu chi VNUR = mean truong full
#     (TRUNG TINH, khong thuong khong phat), diem chuan that. Khong cong bonus.

# --- dieu chinh thu cong theo tung truong, ty le voi diem chuan (admission_score_1) ---
#   delta = ADJUST_SCALE * admission_score_1; cong/tru thang vao final_rating_5 (clamp [0,5]).
#   Diem chuan cang cao -> dieu chinh cang manh.
ADJUST_SCALE = 0.5
LIGHT_ADJUST_SCALE = 0.2                              # tru nhe ("mot chut")
# Tru: cac truong thanh vien DHQGHN an theo diem VNUR cao cua truong me -> overrate.
RATING_PENALTY_CODES = {"QHS", "QHX"}                 # Giao duc, KHXH & Nhan van
# Tru nhe: hoc vien quan doi diem chuan rat cao keo rating len hoi qua.
RATING_LIGHT_PENALTY_CODES = {"BPH"}                  # HV Bien phong
# Cong: truong chuyen nganh manh, VNUR (tieu chi rong) underrate.
RATING_BONUS_CODES = {"YHB", "LPH"}                  # Y, Luat HN


def combine_score(c1, c2, c3, c4, c5):
    """Chuan hoa moi nhom ve 0..1 roi gan trong so -> final thang 5.0.
    Tra ve (vnur_score_1, admission_score_1, final_rating_5)."""
    vnur = (c1 + c2 + c3) / 3
    adm = (c4 + c5) / 2
    final = 5 * (W_VNUR * vnur + W_ADMISSION * adm)
    return round(vnur, 4), round(adm, 4), round(final, 4)


# --- alias da xac minh thu cong voi danh sach VNUR thuc te (Supabase code -> ten VNUR) ---
VERIFIED_ALIASES = {
    "FPT": "Trường Đại học FPT",
    "DNV": "Trường Đại học Nội vụ Hà Nội (Công lập)",
    "DMT": "Trường Đại học Tài nguyên và Môi trường Hà Nội",
    "DQK": "TRƯỜNG ĐẠI HỌC KINH DOANH VÀ CÔNG NGHỆ HÀ NỘI (TƯ THỤC)",
    "FBU": "TRƯỜNG ĐẠI HỌC TÀI CHÍNH - NGÂN HÀNG HÀ NỘI (TƯ THỤC)",
    "GTA": "TRƯỜNG ĐẠI HỌC CÔNG NGHỆ GIAO THÔNG VẬN TẢI",
}


def load_env(path):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"').strip("'")
    return env


def norm(s):
    """Chuan hoa ten truong de so khop. Xu ly D/d gach (khong bi NFD tach)."""
    s = (s or "").replace("Đ", "D").replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"\b(truong|dai hoc|dh|hoc vien|hv|university|cong lap|tu thuc|dan lap)\b", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


class Supabase:
    def __init__(self, env):
        self.url = env["SUPABASE_URL"].rstrip("/")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_ANON_KEY")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def fetch_all(self, table, select, extra=""):
        out, off, step = [], 0, 1000
        while True:
            r = requests.get(
                f"{self.url}/rest/v1/{table}?select={select}{extra}",
                headers={**self.h, "Range": f"{off}-{off + step - 1}"},
                timeout=60,
            )
            r.raise_for_status()
            batch = r.json()
            if not isinstance(batch, list) or not batch:
                break
            out += batch
            if len(batch) < step:
                break
            off += step
        return out


def admission_key(s):
    """Khoa gom theo chieu tuyen sinh that (bo variant_label & source-variant_key gay dem doi)."""
    return "|".join([
        str(s.get("university_program_id") or ""),
        s.get("subject_group_code") or "",
        s.get("gender") or "",
        s.get("region_code") or "",
    ])


def _aggregate(rows, prog2code, value_fn):
    """Gom rows -> dict code -> {latest_year, avg, top10}. value_fn(s) tra ve diem thang 30 hoac None."""
    by_code = {}
    for s in rows:
        v = value_fn(s)
        if v is None:
            continue
        code = prog2code.get(s["university_program_id"])
        if not code:
            continue
        year = int(s["year"])
        key = admission_key(s)
        d = by_code.setdefault(code, {})
        y = d.setdefault(year, {})
        if key not in y or v > y[key]:
            y[key] = v

    stats = {}
    for code, years in by_code.items():
        latest_year = 2025 if 2025 in years else max(years)
        vals = sorted(years[latest_year].values(), reverse=True)
        if not vals:
            continue
        stats[code] = {
            "latest_year": latest_year,
            "avg_thpt_score": round(sum(vals) / len(vals), 4),
            "top10_variant_avg_thpt_score": round(sum(vals[:10]) / len(vals[:10]), 4),
        }
    return stats


def compute_admission_stats(db):
    """Diem chuan THPT (dung normalized_score, da o thang 30)."""
    progs = db.fetch_all("university_programs", "id,university_short_name")
    prog2code = {p["id"]: p["university_short_name"] for p in progs}
    rows = db.fetch_all(
        "admission_scores",
        "university_program_id,year,score,normalized_score,subject_group_code,gender,region_code",
        "&admission_method_code=eq.THPT",
    )

    def val(s):
        return float(s["normalized_score"]) if s.get("normalized_score") is not None else None

    return _aggregate(rows, prog2code, val)


def compute_hba_stats(db):
    """Fallback: diem hoc ba + nang khieu (HBA). normalized_score thuong rong -> quy ve thang 30:
    neu truong co gia tri raw > 30 -> coi la thang 40 (nhan 30/40); nguoc lai coi nhu da thang 30."""
    progs = db.fetch_all("university_programs", "id,university_short_name")
    prog2code = {p["id"]: p["university_short_name"] for p in progs}
    rows = db.fetch_all(
        "admission_scores",
        "university_program_id,year,score,normalized_score,subject_group_code,gender,region_code",
        "&admission_method_code=eq.HBA",
    )
    # phat hien thang theo tung truong
    raw_max = {}
    for s in rows:
        if s.get("score") is None:
            continue
        code = prog2code.get(s["university_program_id"])
        if code:
            raw_max[code] = max(raw_max.get(code, 0), float(s["score"]))
    scale = {code: (40 if m > 30 else 30) for code, m in raw_max.items()}

    def val(s):
        if s.get("score") is None:
            return None
        code = prog2code.get(s["university_program_id"])
        if not code:
            return None
        return float(s["score"]) * 30 / scale[code]

    return _aggregate(rows, prog2code, val)


def load_vnur():
    with open(VNUR_SCORE_CSV, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    by_norm = {}
    by_name = {}
    for r in rows:
        by_norm[norm(r["institution"])] = r
        by_name[r["institution"]] = r
    return by_name, by_norm


def match_vnur(uni, vnur_by_name, vnur_by_norm):
    """Tra ve (vnur_row, vnur_source_institution, match_status) hoac (None, None, 'no_vnur')."""
    code = uni["code"]
    if code in VNU_HN_MEMBER_CODES:
        row = vnur_by_name.get(VNU_HN_PARENT)
        return row, VNU_HN_PARENT, "matched_vnu_hn_cluster"
    if code in VERIFIED_ALIASES:
        target = VERIFIED_ALIASES[code]
        # resolve qua norm() de ben voi khac biet hoa/thuong/khoang trang
        row = vnur_by_name.get(target) or vnur_by_norm.get(norm(target))
        if row:
            return row, row["institution"], "matched_alias"
    row = vnur_by_norm.get(norm(uni["name"]))
    if row:
        return row, row["institution"], "matched"
    return None, None, "no_vnur"


def main():
    env = load_env(ENV_PATH)
    db = Supabase(env)

    print("Fetching universities + admission scores from Supabase ...")
    unis = db.fetch_all("universities", "id,name,code,type,province_id")
    adm = compute_admission_stats(db)
    hba = compute_hba_stats(db)
    vnur_by_name, vnur_by_norm = load_vnur()
    print(f"  universities={len(unis)}  with_THPT={len(adm)}  with_HBA={len(hba)}  vnur_rows={len(vnur_by_name)}")

    rated = []
    excluded = []
    audit = []
    pending_not_in_vnur = []  # (uni, admission_stats) xu ly o luot 2 (can stats truong full)
    pending_military = []     # (uni, admission_stats, source) xu ly o luot 2 (VNUR trung tinh + bonus)

    for uni in unis:
        code = uni["code"]
        name = uni["name"]
        a = adm.get(code)

        if code in MILITARY_CODES:
            # VNUR khong xep hang -> tinh bang diem chuan (uu tien THPT, fallback HBA) + bonus
            mil_source = "THPT"
            if not a:
                a = hba.get(code)
                mil_source = "HBA"
            if not a:  # khong co diem chuan nao -> khong tinh duoc
                excluded.append({
                    "code": code, "name": name, "reason": "military_no_admission",
                    "has_admission": False,
                    "avg_thpt_score": "", "top10_variant_avg_thpt_score": "", "latest_year": "",
                })
                audit.append((code, name, "military_no_admission", "", ""))
                continue
            pending_military.append((uni, a, mil_source))  # xu ly o luot 2 (can stats truong full)
            continue

        vrow, vsrc, status = match_vnur(uni, vnur_by_name, vnur_by_norm)

        # === KHONG co trong VNUR ===
        if vrow is None:
            if not a:  # khong VNUR + khong THPT -> khong rating duoc
                excluded.append({
                    "code": code, "name": name, "reason": "not_in_vnur_no_admission",
                    "has_admission": False,
                    "avg_thpt_score": "", "top10_variant_avg_thpt_score": "", "latest_year": "",
                })
                audit.append((code, name, "not_in_vnur_no_admission", "", ""))
                continue
            # co THPT -> xu ly o luot 2 (suy dien VNUR tu stats truong full)
            pending_not_in_vnur.append((uni, a))
            continue

        # === CO trong VNUR ===
        # diem chuan: uu tien THPT, fallback HBA (hoc ba + nang khieu)
        admission_source = "THPT"
        if not a:
            a = hba.get(code)
            admission_source = "HBA"
        if not a:  # co VNUR nhung khong co diem chuan nao
            excluded.append({
                "code": code, "name": name, "reason": "matched_vnur_no_admission",
                "has_admission": False,
                "avg_thpt_score": "", "top10_variant_avg_thpt_score": "", "latest_year": "",
            })
            audit.append((code, name, "matched_vnur_no_admission", vsrc, ""))
            continue

        # --- 3 thanh phan VNUR ---
        q = float(vrow["recognized_quality_score_100"])
        t = float(vrow["teaching_score_100"])
        pub = float(vrow["publications_score_100"])
        sci = float(vrow["science_tech_innovation_score_100"])
        lq = float(vrow["learner_quality_score_100"])
        fac = float(vrow["facilities_score_100"])
        c1 = (q + t) / 2 / 100
        c2 = (pub + sci) / 2 / 100
        c3 = (lq + fac) / 2 / 100

        # --- 2 thanh phan diem chuan ---
        c4 = min(a["avg_thpt_score"] / 30, 1.0)
        c5 = min(a["top10_variant_avg_thpt_score"] / 30, 1.0)

        vnur_s, adm_s, final5 = combine_score(c1, c2, c3, c4, c5)

        rated.append({
            "institution": name, "university_code": code,
            "final_rating_5": final5,
            "rating_type": "full",
            "vnur_score_1": vnur_s, "admission_score_1": adm_s,
            "quality_teaching_score_1": round(c1, 4),
            "research_innovation_score_1": round(c2, 4),
            "learner_facilities_score_1": round(c3, 4),
            "avg_admission_score_1": round(c4, 4),
            "top10_admission_score_1": round(c5, 4),
            "avg_thpt_score": a["avg_thpt_score"],
            "top10_variant_avg_thpt_score": a["top10_variant_avg_thpt_score"],
            "admission_latest_year": a["latest_year"],
            "admission_source": admission_source,
            "vnur_source_institution": vsrc,
            "match_status": status,
        })
        audit.append((code, name, status, vsrc, "full:" + admission_source))

    # === LUOT 2: suy dien VNUR cho truong khong co trong VNUR (mean - sigma tu truong full) ===
    import statistics as _st
    full_rows = [r for r in rated if r["rating_type"] == "full"]
    vnur_cols = ["quality_teaching_score_1", "research_innovation_score_1", "learner_facilities_score_1"]
    imputed, military_vnur = {}, {}
    for col in vnur_cols:
        vals = [float(r[col]) for r in full_rows]
        m, sd = _st.mean(vals), _st.pstdev(vals)
        imputed[col] = round(max(0.0, m - sd), 4)   # truong yeu: phat -1σ
        military_vnur[col] = round(m, 4)             # quan doi/cong an: VNUR trung tinh (mean, khong thuong khong phat)

    for uni, a in pending_not_in_vnur:
        code, name = uni["code"], uni["name"]
        c1, c2, c3 = imputed["quality_teaching_score_1"], imputed["research_innovation_score_1"], imputed["learner_facilities_score_1"]
        c4 = min(a["avg_thpt_score"] / 30, 1.0)
        c5 = min(a["top10_variant_avg_thpt_score"] / 30, 1.0)
        vnur_s, adm_s, final5 = combine_score(c1, c2, c3, c4, c5)
        rated.append({
            "institution": name, "university_code": code,
            "final_rating_5": final5,
            "rating_type": "vnur_imputed",
            "vnur_score_1": vnur_s, "admission_score_1": adm_s,
            "quality_teaching_score_1": c1, "research_innovation_score_1": c2,
            "learner_facilities_score_1": c3,
            "avg_admission_score_1": round(c4, 4), "top10_admission_score_1": round(c5, 4),
            "avg_thpt_score": a["avg_thpt_score"],
            "top10_variant_avg_thpt_score": a["top10_variant_avg_thpt_score"],
            "admission_latest_year": a["latest_year"], "admission_source": "THPT",
            "vnur_source_institution": "", "match_status": "not_in_vnur_imputed",
        })
        audit.append((code, name, "not_in_vnur_imputed", "", "vnur_imputed"))

    # === LUOT 2b: khoi quan doi/cong an = VNUR trung tinh (mean truong full) + diem chuan that ===
    for uni, a, mil_source in pending_military:
        code, name = uni["code"], uni["name"]
        c1, c2, c3 = military_vnur["quality_teaching_score_1"], military_vnur["research_innovation_score_1"], military_vnur["learner_facilities_score_1"]
        c4 = min(a["avg_thpt_score"] / 30, 1.0)
        c5 = min(a["top10_variant_avg_thpt_score"] / 30, 1.0)
        vnur_s, adm_s, final5 = combine_score(c1, c2, c3, c4, c5)
        rated.append({
            "institution": name, "university_code": code,
            "final_rating_5": final5,
            "rating_type": "military_neutral",
            "vnur_score_1": vnur_s, "admission_score_1": adm_s,
            "quality_teaching_score_1": c1, "research_innovation_score_1": c2,
            "learner_facilities_score_1": c3,
            "avg_admission_score_1": round(c4, 4), "top10_admission_score_1": round(c5, 4),
            "avg_thpt_score": a["avg_thpt_score"],
            "top10_variant_avg_thpt_score": a["top10_variant_avg_thpt_score"],
            "admission_latest_year": a["latest_year"], "admission_source": mil_source,
            "vnur_source_institution": "", "match_status": "military_neutral",
        })
        audit.append((code, name, "military_neutral", "", f"military_neutral:{mil_source}"))

    # === Dieu chinh thu cong theo tung truong (ty le voi diem chuan), ap thang vao final ===
    for r in rated:
        code = r["university_code"]
        if code in RATING_BONUS_CODES:
            sign, scale = 1, ADJUST_SCALE
        elif code in RATING_PENALTY_CODES:
            sign, scale = -1, ADJUST_SCALE
        elif code in RATING_LIGHT_PENALTY_CODES:
            sign, scale = -1, LIGHT_ADJUST_SCALE
        else:
            continue
        delta = round(sign * scale * r["admission_score_1"], 4)
        new5 = round(min(max(r["final_rating_5"] + delta, 0.0), 5.0), 4)
        actual = round(new5 - r["final_rating_5"], 4)  # delta thuc te sau clamp
        r["final_rating_5"] = new5
        r["rating_adjustment"] = actual
        r["match_status"] = f"{r['match_status']} | adj{actual:+.3f}(admission-based)"

    for r in rated:
        r.setdefault("rating_adjustment", 0.0)  # cac truong khong dieu chinh -> 0

    rated.sort(key=lambda r: -r["final_rating_5"])
    for i, r in enumerate(rated, 1):
        r["rating_rank"] = i

    # --- ghi file ---
    star_dir = os.path.join(RATING_DIR, "star")
    score_dir = os.path.join(RATING_DIR, "score")
    os.makedirs(star_dir, exist_ok=True)

    rating_cols = [
        "rating_rank", "institution", "university_code", "final_rating_5", "rating_type",
        "vnur_score_1", "admission_score_1", "rating_adjustment",
        "quality_teaching_score_1", "research_innovation_score_1", "learner_facilities_score_1",
        "avg_admission_score_1", "top10_admission_score_1",
        "avg_thpt_score", "top10_variant_avg_thpt_score", "admission_latest_year", "admission_source",
        "vnur_source_institution", "match_status",
    ]
    with open(os.path.join(star_dir, "rating_universities_final_5.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rating_cols)
        w.writeheader()
        w.writerows(rated)

    with open(os.path.join(star_dir, "excluded_universities.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "code", "name", "reason", "has_admission",
            "avg_thpt_score", "top10_variant_avg_thpt_score", "latest_year"])
        w.writeheader()
        w.writerows(excluded)

    with open(os.path.join(star_dir, "match_audit.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["code", "name", "match_status", "vnur_source_institution", "data_completeness"])
        w.writerows(audit)

    # rebuild clean admission stats (chi cac truong khong bi loai)
    with open(os.path.join(score_dir, "university_latest_admission_score_stats.csv"), "w",
              encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["university_code", "university_name", "latest_year",
                    "avg_thpt_score", "top10_variant_avg_thpt_score"])
        code2name = {u["code"]: u["name"] for u in unis}
        for code, s in sorted(adm.items()):
            w.writerow([code, code2name.get(code, ""), s["latest_year"],
                        s["avg_thpt_score"], s["top10_variant_avg_thpt_score"]])

    methodology = {
        "updated_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Cac truong co trong bang universities cua Supabase. Quan doi/cong an: tinh bang diem chuan + bonus (khong loai). Loai cac truong khong co diem chuan nao.",
        "source_vnur": "database/rating/rerank/vnur_score_universities.csv (da rerank+penalty o phien truoc)",
        "source_admission": "Supabase admission_scores; uu tien THPT (normalized_score thang 30), fallback HBA (hoc ba+nang khieu) quy ve thang 30",
        "vnur_imputation": {col: imputed[col] for col in vnur_cols},
        "vnur_imputation_note": "Truong khong co trong VNUR: 3 tieu chi VNUR suy dien = mean - sigma cua tung tieu chi tren cac truong full (penalty tu du lieu, khong hardcode).",
        "military_vnur_neutral": military_vnur,
        "military_note": "Khoi quan doi/cong an (VNUR khong xep hang): 3 tieu chi VNUR = mean cua truong full (TRUNG TINH, khong thuong khong phat), diem chuan that. Khong cong bonus.",
        "manual_adjustment": {
            "formula": "delta = sign * scale * admission_score_1; cong thang vao final_rating_5 (clamp [0,5]).",
            "scale": ADJUST_SCALE,
            "light_scale": LIGHT_ADJUST_SCALE,
            "bonus_codes": sorted(RATING_BONUS_CODES),
            "penalty_codes": sorted(RATING_PENALTY_CODES),
            "light_penalty_codes": sorted(RATING_LIGHT_PENALTY_CODES),
            "note": "Tru QHS/QHX (an theo diem VNUR truong me DHQGHN -> overrate); tru nhe BPH (HV Bien phong); cong Y/Luat/Duoc HN (chuyen nganh manh, VNUR underrate). Dieu chinh ty le voi diem chuan tung truong.",
        },
        "counts": {
            "supabase_universities": len(unis),
            "rated": len(rated),
            "rated_full": sum(1 for r in rated if r["rating_type"] == "full"),
            "rated_vnur_imputed": sum(1 for r in rated if r["rating_type"] == "vnur_imputed"),
            "rated_military_neutral": sum(1 for r in rated if r["rating_type"] == "military_neutral"),
            "excluded_military_no_admission": sum(1 for e in excluded if e["reason"] == "military_no_admission"),
            "excluded_not_in_vnur_no_admission": sum(1 for e in excluded if e["reason"] == "not_in_vnur_no_admission"),
            "excluded_matched_vnur_no_admission": sum(1 for e in excluded if e["reason"] == "matched_vnur_no_admission"),
        },
        "formula": {
            "quality_teaching_score_1": "mean(recognized_quality, teaching) / 100",
            "research_innovation_score_1": "mean(publications, science_tech_innovation) / 100",
            "learner_facilities_score_1": "mean(learner_quality, facilities) / 100",
            "avg_admission_score_1": "avg_thpt_score / 30, clamp [0,1]",
            "top10_admission_score_1": "top10_variant_avg_thpt_score / 30, clamp [0,1]",
            "weights": {"vnur": W_VNUR, "admission": W_ADMISSION},
            "final_rating_5": "5 * (W_VNUR * mean(C1,C2,C3) + W_ADMISSION * mean(C4,C5)). Hien VNUR/diem chuan = 50/50.",
            "vnur_imputed": "Giong cong thuc tren nhung C1,C2,C3 la gia tri suy dien mean-sigma.",
        },
        "hba_fallback": "Truong co VNUR nhung khong co THPT: dung HBA (hoc ba+nang khieu), quy ve thang 30 (raw>30 -> coi thang 40, *30/40). Vd DH My thuat VN.",
        "admission_key": "program_id | subject_group_code | gender | region_code; lay MAX normalized_score moi key theo nam; chon 2025 neu co. (Bo variant_label & source-variant_key de tranh dem doi cung mot diem chuan.)",
        "vnu_hn_cluster_rule": "Thanh vien DHQGHN dung diem chuan rieng nhung lay 6 tieu chi VNUR tu truong me 'Dai hoc Quoc gia Ha Noi'.",
        "verified_aliases": VERIFIED_ALIASES,
        "military_codes": sorted(MILITARY_CODES),
    }
    with open(os.path.join(star_dir, "rating_universities_final_5_methodology.json"), "w", encoding="utf-8") as f:
        json.dump(methodology, f, ensure_ascii=False, indent=2)

    c = methodology["counts"]
    print(f"\nDONE. rated={len(rated)} (full={c['rated_full']}, "
          f"vnur_imputed={c['rated_vnur_imputed']}, military_neutral={c['rated_military_neutral']}), "
          f"excluded={len(excluded)} "
          f"(military_no_adm={c['excluded_military_no_admission']}, "
          f"not_in_vnur_no_adm={c['excluded_not_in_vnur_no_admission']})")
    print(f"VNUR imputed (mean-sigma): {imputed}")
    print("\nBottom 14 (xem nhom vnur_imputed):")
    for r in rated[-14:]:
        print(f"  {r['rating_rank']:2d}. {r['final_rating_5']:.3f}  [{r['rating_type'][:12]:12s}] {r['institution']}")


if __name__ == "__main__":
    main()
