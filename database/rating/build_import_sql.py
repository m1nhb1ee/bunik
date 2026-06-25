"""Sinh SQL INSERT cho 3 bảng rating từ các CSV (xem schema_rating.sql).
Chạy: python database/rating/build_import_sql.py
Xuất: database/migrations/data_rating.sql  (chạy được trong Supabase SQL editor)
"""
import csv
import os

BASE = os.path.dirname(__file__)
OUT = os.path.join(BASE, "..", "migrations", "data_rating.sql")


def read_csv(path):
    with open(os.path.join(BASE, path), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def q(v):
    """Quote 1 giá trị thành literal SQL; rỗng -> NULL."""
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def num(v):
    return "NULL" if v is None or v == "" else str(v)


def insert(table, cols, rows):
    out = [f"INSERT INTO public.{table} ({', '.join(cols)}) VALUES"]
    out.append(",\n".join(rows) + ";")
    return "\n".join(out)


# --- Bảng 1: vnur_universities, PK=university_code, chỉ trường Supabase có VNUR ---
#   match_audit: code -> vnur_source_institution. Join rerank & score theo institution.
rerank_by_inst = {r["institution"]: r for r in read_csv("rerank/vnur_rerank_universities.csv")}
score_by_inst = {r["institution"]: r for r in read_csv("rerank/vnur_score_universities.csv")}
rows = []
for a in read_csv("star/match_audit.csv"):  # đủ 86 trường Supabase
    inst = a.get("vnur_source_institution")
    r = rerank_by_inst.get(inst) if inst else None
    s = score_by_inst.get(inst, {}) if r else {}
    if r is None:  # trường không có VNUR -> để NULL toàn bộ (12 cột sau university_code)
        rows.append("(" + q(a["code"]) + ", " + ", ".join(["NULL"] * 12) + ")")
        continue
    rows.append("(" + ", ".join([
        q(a["code"]), q(inst), num(r["rerank_rank"]), q(r["method_group"]),
        num(r["source_year"]), num(r["rerank_score_100"]),
        num(s.get("recognized_quality_score_100")), num(s.get("teaching_score_100")),
        num(s.get("publications_score_100")), num(s.get("science_tech_innovation_score_100")),
        num(s.get("learner_quality_score_100")), num(s.get("facilities_score_100")),
        num(s.get("avg_6criteria_score_100")),
    ]) + ")")
sql1 = insert("vnur_universities", [
    "university_code", "institution", "rerank_rank", "method_group", "source_year", "rerank_score_100",
    "recognized_quality_score_100", "teaching_score_100", "publications_score_100",
    "science_tech_innovation_score_100", "learner_quality_score_100",
    "facilities_score_100", "avg_6criteria_score_100",
], rows)

# --- Bảng 2: university_admission_score_stats (cột _1 generated, không insert) ---
rows = []
for r in read_csv("score/university_latest_admission_score_stats.csv"):
    rows.append("(" + ", ".join([
        q(r["university_code"]), num(r["latest_year"]),
        num(r["avg_thpt_score"]), num(r["top10_variant_avg_thpt_score"]),
    ]) + ")")
sql2 = insert("university_admission_score_stats",
              ["university_code", "latest_year", "avg_thpt_score", "top10_variant_avg_thpt_score"],
              rows)

# --- Bảng 3: university_ratings (gộp match_status + nguồn VNUR vào notes) ---
rows = []
for r in read_csv("star/rating_universities_final_5.csv"):
    note_parts = []
    if r.get("match_status"):
        note_parts.append(r["match_status"])
    if r.get("vnur_source_institution"):
        note_parts.append("VNUR: " + r["vnur_source_institution"])
    notes = " | ".join(note_parts)
    rows.append("(" + ", ".join([
        q(r["university_code"]), num(r["rating_rank"]), num(r["final_rating_5"]),
        num(r["vnur_score_1"]), num(r["admission_score_1"]),
        q(r["rating_type"]), q(r["admission_source"]), q(notes),
    ]) + ")")
sql3 = insert("university_ratings", [
    "university_code", "rating_rank", "final_rating_5", "vnur_score_1",
    "admission_score_1", "rating_type", "admission_source", "notes",
], rows)

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("-- Data import cho 3 bảng rating (sinh tự động bởi build_import_sql.py).\n")
    f.write("-- Chạy SAU schema_rating.sql. Idempotent: TRUNCATE trước khi insert.\n\n")
    f.write("TRUNCATE public.university_ratings, public.university_admission_score_stats, public.vnur_universities;\n\n")
    f.write("-- Bảng 1\n" + sql1 + "\n\n")
    f.write("-- Bảng 2\n" + sql2 + "\n\n")
    f.write("-- Bảng 3\n" + sql3 + "\n")

print("Wrote", os.path.relpath(OUT, BASE))
