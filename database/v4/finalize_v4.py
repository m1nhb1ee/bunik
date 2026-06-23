"""
finalize_v4.py — Turn clean_import/ CSVs into Supabase-ready import CSVs.

Runs AFTER clean_tuyensinh247_import.py. Applies the decisions agreed for the
v4 cleanup:

  1. fields.csv is generated (major_catalog.field_code FK was unsatisfied).
  2. Major variant suffixes are collapsed to the canonical national code
     (7140201A/B/C/K -> 7140201). The suffix stays on program_source_code.
     The variant->canonical map is emitted to major_code_aliases.csv.
  3. admission_methods gains HBA (Xét học bạ); every năng-khiếu subject group
     referenced by data is seeded into subject_groups.
  4. university_programs_complete + _missing are merged into ONE
     university_programs.csv (1.2k scores referenced the "missing" side).
  5. Only explicitly reviewed missing-decimal scores are repaired. Every
     change is logged to review_score_corrections.csv.

Output: database/v4/supabase_ready/*.csv  +  import_v4.sql
"""
from __future__ import annotations

import csv
import re
import unicodedata
import uuid
from collections import Counter, defaultdict
from pathlib import Path

BASE   = Path(__file__).resolve().parent
CLEAN  = BASE / "bunik_crawl_output" / "clean_import"
OUT    = BASE / "supabase_ready"
UUID_NAMESPACE = uuid.UUID("6de5f8e4-2d5b-48f6-a2fb-e5d5ab0c4127")

# ── CSV helpers ───────────────────────────────────────────────────────────────

def rd(name: str) -> list[dict[str, str]]:
    p = CLEAN / name
    if not p.exists():
        return []
    with p.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def wr(name: str, fieldnames: list[str], rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / name).open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

def stable_uuid(*parts: object) -> str:
    return str(uuid.uuid5(UUID_NAMESPACE, "|".join(str(part).strip() for part in parts)))

# ── Reference data ────────────────────────────────────────────────────────────

# Vietnamese MOET field taxonomy (codes used by major_field_code()).
FIELD_DESCRIPTIONS = {
    "giao_duc":          "Khoa học giáo dục và đào tạo giáo viên",
    "nghe_thuat":        "Nghệ thuật",
    "nhan_van":          "Nhân văn",
    "khoa_hoc_xa_hoi":   "Khoa học xã hội và hành vi",
    "truyen_thong":      "Báo chí và thông tin",
    "kinh_te":           "Kinh doanh và quản lý",
    "phap_luat":         "Pháp luật",
    "khoa_hoc_su_song":  "Khoa học sự sống",
    "khoa_hoc_tu_nhien": "Khoa học tự nhiên",
    "toan_va_thong_ke":  "Toán và thống kê",
    "cntt":              "Máy tính và công nghệ thông tin",
    "dien_tu":           "Công nghệ kỹ thuật điện, điện tử và viễn thông",
    "ky_thuat":          "Kỹ thuật",
    "san_xuat_che_bien": "Sản xuất và chế biến",
    "xay_dung":          "Kiến trúc và xây dựng",
    "nong_lam":          "Nông, lâm nghiệp và thủy sản",
    "thu_y":             "Thú y",
    "y_te":              "Sức khỏe",
    "xa_hoi":            "Dịch vụ xã hội",
    "du_lich":           "Du lịch, khách sạn, thể thao và dịch vụ cá nhân",
    "van_tai":           "Dịch vụ vận tải",
    "moi_truong":        "Môi trường và bảo vệ môi trường",
    "an_ninh":           "An ninh, quốc phòng",
    "khac":              "Khác / chưa phân loại",
}

# Authoritative tổ hợp xét tuyển (subject groups) supplied by the user.
# Encoded compactly: token shortcut -> Vietnamese subject name, then one line
# per code. Codes not listed here but referenced by data stay as unverified
# placeholders so the FK still resolves.
_SUBJ_TOKEN = {
    "T": "Toán", "L": "Lý", "H": "Hóa", "S": "Sinh", "A": "Tiếng Anh",
    "LS": "Lịch sử", "DL": "Địa lý", "Su": "Sử", "Di": "Địa", "V": "Văn",
    "NV": "Ngữ văn", "GD": "Giáo dục công dân", "KTN": "Khoa học tự nhiên",
    "KXH": "Khoa học xã hội", "DH": "Đọc hiểu", "TH": "Tin học",
    "VNK": "Vẽ Năng khiếu", "NBC": "Năng khiếu báo chí",
    "NAB": "Năng khiếu ảnh báo chí", "NQP": "Năng khiếu quay phim truyền hình",
    "QD": "Điểm quy đổi chứng chỉ Tiếng Anh", "FR": "Tiếng Pháp",
    "DE": "Tiếng Đức", "ES": "Tiếng Tây Ban Nha", "ZH": "Tiếng Trung",
    "JA": "Tiếng Nhật", "KO": "Tiếng Hàn",
}
_SUBJ_RAW = {
    "A00": "T L H", "A01": "T L A", "A02": "T L S", "A03": "T L LS", "A04": "T L DL",
    "A05": "T H LS", "A06": "T H DL", "A07": "T LS DL", "A08": "T LS GD", "A09": "T DL A",
    "A10": "T L GD", "A11": "T L S", "A12": "T L A", "A13": "T L H", "A14": "T L A",
    "A15": "T L S", "A16": "T KTN NV", "A17": "T L S", "A18": "T L A", "A19": "T L H",
    "B00": "T H S", "B01": "T S A", "B02": "T S DL", "B03": "T S LS", "B04": "T H DL",
    "B05": "T H S", "B08": "T S GD",
    "C00": "V Su Di", "C01": "V T L", "C02": "V T H", "C03": "V T Su", "C04": "V T Di",
    "C05": "V L H", "C06": "V L Di", "C07": "V H Di", "C08": "V H S", "C09": "V L Su",
    "C10": "T Su Di", "C11": "V Su Di", "C12": "V Su Di", "C13": "V Su Di", "C14": "V T GD",
    "C15": "V T A", "C16": "V L A", "C19": "V Su A", "C20": "V Di A",
    "D00": "V T A", "D01": "V T A", "D02": "T L H", "D03": "T H S", "D04": "T L S",
    "D05": "V Su Di", "D06": "T L A", "D07": "T H A", "D08": "T S A", "D09": "T LS A",
    "D10": "T DL A", "D11": "T L GD", "D12": "T H GD", "D13": "T S GD", "D14": "V Su A",
    "D15": "V Di A", "D16": "V L A", "D20": "T L H", "D21": "T H S", "D22": "T L S",
    "D23": "V T A", "D24": "V L A", "D25": "V H A", "D26": "V S A", "D27": "T Su Di",
    "D28": "T Su A", "D29": "T Di A", "D30": "T LS GD", "D31": "T DL GD", "D32": "T T A",
    "D33": "L H S", "D34": "L H A", "D35": "H S A", "D40": "T A FR", "D41": "T A DE",
    "D42": "T A ES", "D43": "T A ZH", "D44": "T A JA", "D45": "T A KO", "D55": "T A A",
    "D61": "L H DL", "D62": "L H LS", "D63": "L S DL", "D64": "L S LS", "D65": "H S DL",
    "D66": "V T JA", "D68": "T L DL", "D69": "T H DL", "D70": "T S DL", "D71": "T L LS",
    "D72": "T H LS", "D78": "T S LS", "D83": "NV KXH ZH", "D84": "L S GD", "D89": "H S GD",
    "D90": "T KTN A", "D91": "T A FR", "D96": "T L FR", "D97": "T L DE", "D98": "T L JA",
    "H00": "T L H", "H01": "T H S", "H02": "T L S", "H04": "T L A", "H05": "NV KXH VNK",
    "H06": "T H A", "H07": "T S A", "H08": "T L LS", "H09": "T L DL",
    "K00": "T L H", "K01": "T A TH", "K02": "T DH A",
    "M00": "T H S", "M01": "T L S", "M02": "T L H",
    "N00": "V Su Di", "N01": "V Su A", "N02": "V Di A",
    "Q00": "T L H", "R00": "T H S",
    "R05": "NV A NBC", "R06": "NV KTN NBC", "R07": "NV T NAB", "R08": "NV A NAB",
    "R09": "NV KTN NAB", "R11": "NV T NQP", "R12": "NV A NQP", "R13": "NV KTN NQP",
    "R15": "NV T NBC", "R16": "NV KXH NBC", "R17": "NV KXH NAB", "R18": "NV KXH NQP",
    "R19": "NV QD NBC", "R20": "NV QD NAB", "R21": "NV QD NQP", "R22": "T L A",
    "R23": "T L H", "R24": "NV T QD", "R25": "T H S", "R26": "T S A", "R27": "T L S",
    "S00": "T L H",
    "T00": "T H S", "T01": "T L S", "T02": "T L H", "T05": "T L A", "T08": "T H A",
    "T09": "T S A", "T10": "T L LS", "T11": "T L DL", "T49": "V Su Di",
    "V00": "V Su Di", "V01": "V Su A", "V02": "V Di A", "V03": "V T A", "V05": "V L A",
    "V06": "V T H", "V10": "V T S",
    "X01": "T L H", "X02": "T L S", "X03": "T H S", "X04": "T L A", "X05": "T H A",
    "X06": "T S A", "X07": "T L LS", "X08": "T L DL", "X09": "T H LS", "X10": "T H DL",
    "X11": "T S LS", "X12": "T S DL", "X13": "T LS DL", "X14": "T L GD", "X15": "T H GD",
    "X16": "T S GD", "X17": "T LS GD", "X18": "T DL GD", "X21": "V T L", "X22": "V T H",
    "X23": "V T S", "X24": "V T A", "X25": "V T LS", "X26": "V T DL", "X27": "V T GD",
    "X28": "V L A", "X37": "V Su Di", "X53": "L H S", "X56": "L H A", "X57": "L S A",
    "X58": "H S A", "X62": "L H LS", "X70": "L H DL", "X71": "L S DL", "X74": "L LS DL",
    "X78": "H S LS", "X79": "H S DL", "X80": "H LS DL", "X90": "S LS DL", "Y09": "T L H",
}
SUBJECTS_VERIFIED = {
    code: tuple(_SUBJ_TOKEN[t] for t in toks.split())
    for code, toks in _SUBJ_RAW.items()
}

# Explicit allowlist reviewed against the crawler output. Generic method caps
# are intentionally not used because KH contains SAT, scale-100 and scale-30
# values in the same source method.
SCORE_CORRECTIONS = {
    "134489": ("2337", "23.37", "THPT missing decimal after two digits"),
    "134490": ("193", "19.3", "THPT missing decimal after two digits"),
    "194887": ("2333", "23.33", "HBA missing decimal after two digits"),
    "148424": ("2600", "26", "Combined graduation score missing decimal"),
}

# ── 1. Canonical major collapse ───────────────────────────────────────────────

def canonical_code(code: str) -> str:
    """Reduce a code to its 7-digit national major code when it is a variant.

    Handles: pure 7-digit (7310101), 7-digit + suffix (7140201A, 7310101_1,
    7340101_AP, 7220201_Nam) and 8-9 digit specialisation codes
    (73101011/2/3 -> 7310101). Alpha school codes (BANK02, BF1) and 3-digit
    legacy codes (522) have no national code and are kept as-is.
    """
    code = code.strip()
    m = re.match(r"^(\d{7})(\D|$)", code)   # 7 digits then a non-digit or end
    if m:
        return m.group(1)
    m = re.match(r"^(\d{7})\d+$", code)     # 8-9 digit -> 7-digit base
    if m:
        return m.group(1)
    return code

def normalized_text(value: str) -> str:
    text = value.replace("đ", "d").replace("Đ", "d")
    text = "".join(
        char for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"\s+", " ", text.lower()).strip()

def program_family_code(program_code: str) -> str:
    code = program_code.strip()
    gender_variant = re.match(r"^(.+?)_(?:Nam|Nu)(?:_[A-Za-z0-9]+)*$", code, re.IGNORECASE)
    if gender_variant:
        return gender_variant.group(1)
    return code

def program_gender_code(program_code: str) -> str:
    match = re.match(r"^(.+?_(?:Nam|Nu))(?:_[A-Za-z0-9]+)+$", program_code, re.IGNORECASE)
    return match.group(1) if match else ""

def extract_variant_metadata(program_code: str, note: str) -> tuple[str, str]:
    combined = normalized_text(f"{program_code} {note}")
    gender = ""
    if re.search(r"\bnu\b", combined):
        gender = "nu"
    elif re.search(r"\bnam\b", combined):
        gender = "nam"

    region = ""
    code_match = re.search(r"_(?:Nam|Nu)_([0-9]+)(?:_|$)", program_code, re.IGNORECASE)
    note_match = re.search(r"\b(?:dia ban|khu vuc|vung)\s*([0-9]+)\b", combined)
    if code_match:
        region = code_match.group(1)
    elif note_match:
        region = note_match.group(1)
    return gender, region

def normalized_thpt_score(method: str, score: str, note: str) -> tuple[str, str]:
    if method != "THPT":
        return "", ""
    try:
        value = float(score)
    except (TypeError, ValueError):
        return "", ""
    if value <= 0:
        return "", ""
    if value > 30 or "thang diem 40" in normalized_text(note):
        value = value * 30 / 40
    return f"{value:.2f}".rstrip("0").rstrip("."), "30"

def build_program_canonical_map(programs: list[dict]) -> tuple[dict[str, str], list[dict]]:
    active_by_code = {
        (program["university_short_name"], program["program_source_code"].lower()): program
        for program in programs if program["is_active"] == "true"
    }
    active_by_major: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for program in programs:
        if program["is_active"] == "true":
            active_by_major[(program["university_short_name"], program["major_code"])].append(program)

    canonical_map: dict[str, str] = {}
    alias_rows: list[dict] = []
    for program in programs:
        code = program["program_source_code"]
        family_code = program_family_code(code)
        program["base_program_code"] = (
            family_code if family_code != code
            else program.get("base_program_code") or family_code
        )
        program["canonical_program_id"] = ""
        if program["is_active"] == "true":
            continue

        target = None
        gender_code = program_gender_code(code)
        candidate_codes = [program.get("base_program_code", ""), gender_code, family_code]
        for candidate_code in candidate_codes:
            if not candidate_code or candidate_code.lower() == code.lower():
                continue
            target = active_by_code.get((program["university_short_name"], candidate_code.lower()))
            if target:
                break
        if target is None:
            candidates = active_by_major.get((program["university_short_name"], program["major_code"]), [])
            if len(candidates) == 1:
                target = candidates[0]
        if target is None:
            continue

        canonical_map[program["id"]] = target["id"]
        program["canonical_program_id"] = target["id"]
        program["base_program_code"] = program_family_code(target["program_source_code"])
        alias_rows.append({
            "university_short_name": program["university_short_name"],
            "old_program_id": program["id"],
            "old_program_code": code,
            "canonical_program_id": target["id"],
            "effective_from_year": "",
            "effective_to_year": "",
            "reason": program.get("missing_reason") or "Historical program variant",
            "is_verified": "false",
        })
    return canonical_map, alias_rows

def build_major_map(majors: list[dict], programs: list[dict]):
    """Return (canonical_majors, variant->canonical map)."""
    # weight each variant code by how many programs use it (for name picking)
    prog_weight: Counter[str] = Counter(p["major_code"] for p in programs)

    groups: dict[str, list[dict]] = defaultdict(list)
    var_map: dict[str, str] = {}
    for m in majors:
        canon = canonical_code(m["code"])
        var_map[m["code"]] = canon
        groups[canon].append(m)

    canonical_majors: list[dict] = []
    for canon, rows in sorted(groups.items()):
        # name: most-used variant name, tie-break shortest (base name is shortest)
        name_score: Counter[str] = Counter()
        for r in rows:
            name_score[r["name"]] += prog_weight.get(r["code"], 0) + 1
        best = sorted(name_score.items(), key=lambda kv: (-kv[1], len(kv[0])))[0][0]
        # field: prefer a resolved (non-khac) field among the variants
        fields = [r["field_code"] for r in rows if r["field_code"] != "khac"]
        field = Counter(fields).most_common(1)[0][0] if fields else "khac"
        if canon == "5248020":
            field = "cntt"
        canonical_majors.append({
            "code": canon, "name": best, "field_code": field, "description": "",
        })
    return canonical_majors, var_map

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    provinces = rd("provinces.csv")
    unis      = rd("universities.csv")
    methods   = rd("admission_methods.csv")
    sgroups   = rd("subject_groups.csv")
    majors    = rd("major_catalog.csv")
    msg       = rd("major_subject_groups.csv")
    prog_c    = rd("university_programs_complete.csv")
    prog_m    = rd("university_programs_missing.csv")
    upsg      = rd("university_program_subject_groups.csv")
    options   = rd("university_program_admission_options.csv")
    option_sg = rd("university_program_admission_option_subject_groups.csv")
    scores    = rd("admission_scores.csv")

    report: list[str] = []
    def log(*a): report.append(" ".join(str(x) for x in a))

    # ---- merge programs into one table ----
    PROG_COLS = ["id", "university_short_name", "major_code", "is_active",
                 "program_source_code", "program_name", "source",
                 "source_school_id", "missing_reason", "base_program_code", "quota",
                 "canonical_program_id"]
    programs: list[dict] = []
    for p in prog_c:
        programs.append({**{k: p.get(k, "") for k in PROG_COLS}})
    for p in prog_m:
        programs.append({**{k: p.get(k, "") for k in PROG_COLS}})
    log(f"university_programs merged: {len(prog_c)} complete + {len(prog_m)} missing = {len(programs)}")

    # ---- canonical major collapse ----
    canonical_majors, var_map = build_major_map(majors, programs)
    log(f"major_catalog: {len(majors)} variant codes -> {len(canonical_majors)} canonical")

    # remap programs.major_code
    for p in programs:
        p["major_code"] = var_map.get(p["major_code"], canonical_code(p["major_code"]))
    canonical_program_map, program_alias_rows = build_program_canonical_map(programs)
    log(f"program aliases mapped to canonical programs: {len(program_alias_rows)}")
    # remap + dedup major_subject_groups
    msg_seen: set[tuple[str, str]] = set()
    msg_out: list[dict] = []
    for r in msg:
        mc = var_map.get(r["major_code"], canonical_code(r["major_code"]))
        key = (mc, r["subject_group_code"])
        if key in msg_seen:
            continue
        msg_seen.add(key)
        msg_out.append({"major_code": mc, "subject_group_code": r["subject_group_code"]})
    log(f"major_subject_groups: {len(msg)} -> {len(msg_out)} after canonical remap+dedup")

    canon_set = {m["code"] for m in canonical_majors}
    bad = [p for p in programs if p["major_code"] not in canon_set]
    log(f"programs with major_code not in canonical major_catalog: {len(bad)}")

    # variant -> canonical aliases (only true variants, where code changed)
    alias_rows = [
        {"old_code": old, "new_code": new, "effective_year": "",
         "reason": "Chuyên ngành/biến thể của mã ngành quốc gia (campus/CLC/chuyên ngành)", "is_verified": "false"}
        for old, new in sorted(var_map.items()) if old != new
    ]
    log(f"major_code_aliases generated: {len(alias_rows)}")

    # ---- fields ----
    used_fields = {m["field_code"] for m in canonical_majors} | {"khac"}
    field_rows = [
        {"id": i, "code": code, "description": FIELD_DESCRIPTIONS.get(code, code)}
        for i, code in enumerate(sorted(used_fields), start=1)
    ]
    log(f"fields seeded: {len(field_rows)} -> {[f['code'] for f in field_rows]}")

    # ---- admission_methods (+HBA) ----
    method_codes = {m["code"] for m in methods}
    if "HBA" not in method_codes:
        methods.append({"code": "HBA", "name": "Xet hoc ba THPT", "description": ""})
    # ensure every method actually used by scores exists
    used_methods = {s["admission_method_code"] for s in scores}
    for mc in sorted(used_methods - {m["code"] for m in methods}):
        methods.append({"code": mc, "name": mc, "description": ""})
    log(f"admission_methods: {len(methods)} (used by scores: {sorted(used_methods)})")

    # ---- subject_groups: authoritative list, then fill referenced codes ----
    # Priority: user-supplied SUBJECTS_VERIFIED > already-verified clean_import
    # subjects > unverified placeholder (kept so FK references resolve).
    existing = {s["code"]: s for s in sgroups}
    referenced = {r["subject_group_code"] for r in upsg} | {r["subject_group_code"] for r in msg_out}
    all_codes = set(SUBJECTS_VERIFIED) | set(existing) | {c for c in referenced if c}

    sgroups = []
    for code in sorted(all_codes):
        subs = SUBJECTS_VERIFIED.get(code)
        if not subs:
            ex = existing.get(code)
            if ex and ex.get("is_verified", "").lower() == "true" and ex.get("subject_1"):
                subs = (ex["subject_1"], ex["subject_2"], ex["subject_3"])
        if subs:
            s1, s2, s3 = subs
            sgroups.append({"code": code, "subject_1": s1, "subject_2": s2, "subject_3": s3,
                            "display_name": code, "is_verified": "true"})
        else:
            sgroups.append({"code": code, "subject_1": "", "subject_2": "", "subject_3": "",
                            "display_name": f"Tổ hợp {code}", "is_verified": "false"})
    n_verif = sum(1 for s in sgroups if s["is_verified"] == "true")
    still_unv = sorted(s["code"] for s in sgroups if s["is_verified"] == "false")
    log(f"subject_groups: total {len(sgroups)} (verified {n_verif}, unverified {len(still_unv)})")
    log(f"  still unverified (no official tổ hợp): {still_unv}")

    # ---- score variants + reviewed decimal-point repairs ----
    corrections: list[dict] = []
    program_by_id = {program["id"]: program for program in programs}
    active_program_by_code = {
        (program["university_short_name"], program["program_source_code"].lower()): program
        for program in programs if program["is_active"] == "true"
    }
    for s in scores:
        source_id = str(s.get("source_id", "")).strip()
        original_program_id = s["university_program_id"]
        original_program = program_by_id[original_program_id]
        source_program_code = s.get("source_program_code") or original_program["program_source_code"]
        gender, region_code = extract_variant_metadata(source_program_code, s.get("note", ""))

        target_program_id = canonical_program_map.get(original_program_id, original_program_id)
        if target_program_id == original_program_id and original_program["is_active"] != "true" and gender:
            gender_suffix = "Nam" if gender == "nam" else "Nu"
            gender_code = f"{program_family_code(source_program_code)}_{gender_suffix}"
            target = active_program_by_code.get((original_program["university_short_name"], gender_code.lower()))
            if target:
                target_program_id = target["id"]
        s["university_program_id"] = target_program_id
        s["variant_key"] = s.get("variant_key") or (
            f"source:{source_id}" if source_id else f"row:{s['id']}"
        )
        s["source_program_code"] = source_program_code
        s["variant_label"] = s.get("variant_label") or s.get("note", "")
        s["gender"] = s.get("gender") or gender
        s["region_code"] = s.get("region_code") or region_code
        s["subject_group_code"] = s.get("subject_group_code", "")

        correction = SCORE_CORRECTIONS.get(source_id)
        if correction:
            expected, fixed, reason = correction
            if s["score"] != expected:
                raise ValueError(
                    f"Reviewed correction source_id={source_id} expected {expected}, got {s['score']}"
                )
            corrections.append({
                "id": s["id"], "source_id": source_id,
                "method": s["admission_method_code"], "year": s["year"],
                "original_score": s["score"], "fixed_score": fixed,
                "reason": reason,
            })
            s["score"] = fixed

        normalized_score, normalized_scale = normalized_thpt_score(
            s["admission_method_code"], s["score"], s.get("note", ""),
        )
        s["normalized_score"] = normalized_score
        s["normalized_scale"] = normalized_scale
    by_method = Counter(c["method"] for c in corrections)
    log(f"score corrections: {len(corrections)} rows  by method: {dict(by_method)}")

    # ---- remap program-level subject links to canonical programs ----
    upsg_seen: set[tuple[str, str]] = set()
    upsg_out: list[dict] = []
    for row in upsg:
        program_id = canonical_program_map.get(row["university_program_id"], row["university_program_id"])
        key = (program_id, row["subject_group_code"])
        if key in upsg_seen:
            continue
        upsg_seen.add(key)
        upsg_out.append({
            "university_program_id": program_id,
            "subject_group_code": row["subject_group_code"],
        })

    # ---- merge catalog options after canonical program remap ----
    subjects_by_option: dict[str, set[str]] = defaultdict(set)
    for row in option_sg:
        subjects_by_option[row["admission_option_id"]].add(row["subject_group_code"])
    option_groups: dict[tuple[str, str, str], dict] = {}
    for option in options:
        program_id = canonical_program_map.get(
            option["university_program_id"], option["university_program_id"],
        )
        key = (program_id, option["admission_method_code"], option["effective_year"])
        group = option_groups.setdefault(key, {
            "quotas": set(),
            "source": option.get("source", "tuyensinh247"),
            "subject_groups": set(),
        })
        if option.get("quota"):
            group["quotas"].add(option["quota"])
        group["subject_groups"].update(subjects_by_option.get(option["id"], set()))

    option_rows_out: list[dict] = []
    option_subject_rows_out: list[dict] = []
    for key, group in sorted(option_groups.items()):
        program_id, method_code, effective_year = key
        option_id = stable_uuid(
            "tuyensinh247", "catalog_option", program_id, method_code, effective_year,
        )
        option_rows_out.append({
            "id": option_id,
            "university_program_id": program_id,
            "admission_method_code": method_code,
            "effective_year": effective_year,
            "quota": next(iter(group["quotas"])) if len(group["quotas"]) == 1 else "",
            "source": group["source"],
        })
        for subject_code in sorted(group["subject_groups"]):
            option_subject_rows_out.append({
                "admission_option_id": option_id,
                "subject_group_code": subject_code,
            })
    log(f"catalog options: {len(options)} -> {len(option_rows_out)} after canonical remap")

    # ---- write everything ----
    wr("provinces.csv", ["id", "code", "name", "region"], provinces)
    wr("fields.csv", ["id", "code", "description"], field_rows)
    wr("admission_methods.csv", ["code", "name", "description"], methods)
    wr("subject_groups.csv",
       ["code", "subject_1", "subject_2", "subject_3", "display_name", "is_verified"], sgroups)
    wr("universities.csv", ["name", "code", "type", "province_id", "is_active"], unis)
    wr("major_catalog.csv", ["code", "name", "field_code", "description"], canonical_majors)
    wr("major_code_aliases.csv",
       ["old_code", "new_code", "effective_year", "reason", "is_verified"], alias_rows)
    wr("major_subject_groups.csv", ["major_code", "subject_group_code"], msg_out)
    wr("university_programs.csv", PROG_COLS, programs)
    wr("university_program_aliases.csv",
       ["university_short_name", "old_program_id", "old_program_code", "canonical_program_id",
        "effective_from_year", "effective_to_year", "reason", "is_verified"],
       program_alias_rows)
    wr("university_program_subject_groups.csv",
       ["university_program_id", "subject_group_code"], upsg_out)
    wr("university_program_admission_options.csv",
       ["id", "university_program_id", "admission_method_code", "effective_year", "quota", "source"],
       option_rows_out)
    wr("university_program_admission_option_subject_groups.csv",
       ["admission_option_id", "subject_group_code"], option_subject_rows_out)
    wr("admission_scores.csv",
       ["id", "university_program_id", "admission_method_code", "year",
        "score", "note", "source", "source_id", "source_method_id", "source_method_name",
        "variant_key", "source_program_code", "variant_label", "gender", "region_code",
        "subject_group_code", "normalized_score", "normalized_scale"], scores)
    wr("review_score_corrections.csv",
       ["id", "source_id", "method", "year", "original_score", "fixed_score", "reason"], corrections)

    print("\n".join(report))
    print(f"\nOutput -> {OUT}")


if __name__ == "__main__":
    main()
