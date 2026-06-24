import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { getAllUniversities } from "../services/api";
import type { UiUniversity } from "../types/api";
import { B, StarRow, SketchHeading, dashedRule, CenterNote } from "../components/bunik";

const sortChips = [
  { value: "ranking", label: "Xếp hạng" },
  { value: "score_desc", label: "Điểm chuẩn cao" },
  { value: "score_asc", label: "Điểm chuẩn thấp" },
  { value: "rating", label: "Yêu thích" },
  { value: "name", label: "Tên A→Z" },
];

const regionChips = [
  { value: "", label: "Tất cả" },
  { value: "Bắc", label: "Miền Bắc" },
  { value: "Trung", label: "Miền Trung" },
  { value: "Nam", label: "Miền Nam" },
];

function Chip({ active, label, accent, onClick }: { active: boolean; label: string; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bunik-card"
      style={{
        background: active ? accent : B.paper,
        color: active ? B.paperLight : B.ink,
        border: `2px solid ${B.ink}`,
        borderRadius: "15px 11px 14px 12px/12px 14px 11px 15px",
        padding: "6px 14px",
        fontFamily: "'Be Vietnam Pro'",
        fontWeight: 600,
        fontSize: 13,
        ["--rot" as string]: "0deg",
      }}
    >
      {label}
    </button>
  );
}

export default function TruongPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortBy, setSortBy] = useState("ranking");
  const [region, setRegion] = useState("");
  const [compareList, setCompareList] = useState<string[]>([]);
  const [universities, setUniversities] = useState<UiUniversity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUniversities()
      .then(setUniversities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleCompare = (id: string) => {
    setCompareList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const filtered = useMemo(() => {
    let list = [...universities];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.abbr.toLowerCase().includes(q));
    }
    if (region) list = list.filter((u) => u.region === region);
    switch (sortBy) {
      case "score_desc": list.sort((a, b) => b.avgAdmScore - a.avgAdmScore); break;
      case "score_asc": list.sort((a, b) => a.avgAdmScore - b.avgAdmScore); break;
      case "rating": list.sort((a, b) => b.userRating - a.userRating); break;
      case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: list.sort((a, b) => a.ranking - b.ranking);
    }
    return list;
  }, [search, sortBy, region, universities]);

  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "42px 24px 60px" }}>
      <div style={{ animation: "riseIn .6s both" }}>
        <SketchHeading kicker="tra cứu —" width="72%">Danh sách trường đại học</SketchHeading>
        <p style={{ color: B.body, fontSize: 15, margin: "20px 0 0" }}>
          Hiện có <strong style={{ color: B.terracotta }}>{filtered.length}</strong> trường khớp bộ lọc — bấm vào để xem chi tiết.
        </p>
      </div>

      {/* Search */}
      <div style={{ animation: "riseIn .6s both .05s", marginTop: 22, maxWidth: 520 }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: B.paperLight, border: `2.5px solid ${B.ink}`,
            borderRadius: "22px 16px 20px 17px/17px 20px 16px 22px",
            boxShadow: `5px 5px 0 ${B.terracotta}`, padding: "7px 14px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ flex: "none", overflow: "visible" }}>
            <circle cx="10.5" cy="10.5" r="7" fill="none" stroke={B.ink} strokeWidth="2.1" filter="url(#inkrough2)" />
            <path d="M15.6 15.6 L21 21" stroke={B.ink} strokeWidth="2.4" strokeLinecap="round" filter="url(#inkrough2)" />
          </svg>
          <input
            type="text"
            placeholder="Tìm theo tên trường, viết tắt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "'Be Vietnam Pro'", fontSize: 15, color: B.ink, padding: "6px 0" }}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center", margin: "22px 0", animation: "riseIn .6s both .08s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 18, color: B.muted }}>khu vực:</span>
          {regionChips.map((r) => (
            <Chip key={r.value} active={region === r.value} label={r.label} accent={B.terracotta} onClick={() => setRegion(r.value)} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 18, color: B.muted }}>sắp xếp:</span>
          {sortChips.map((s) => (
            <Chip key={s.value} active={sortBy === s.value} label={s.label} accent={B.teal} onClick={() => setSortBy(s.value)} />
          ))}
        </div>
      </div>

      {loading ? (
        <CenterNote title="Đang tải dữ liệu…" sub="lật từng trang sổ tay một chút nhé" />
      ) : filtered.length === 0 ? (
        <CenterNote title="Không tìm thấy trường phù hợp" sub="thử bỏ bớt bộ lọc xem sao" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 22 }}>
          {filtered.map((u) => {
            const inCompare = compareList.includes(u.id);
            return (
              <div
                key={u.id}
                data-clk
                onClick={() => navigate(`/truong/${u.id}`)}
                className="bunik-lift"
                style={{
                  position: "relative",
                  background: B.paperLight, border: `2px solid ${B.ink}`,
                  borderRadius: "19px 23px 18px 22px/22px 18px 23px 19px",
                  boxShadow: "5px 6px 0 rgba(43,39,34,0.13)", padding: 20,
                }}
              >
                {/* Compare toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCompare(u.id); }}
                  title="Thêm vào so sánh"
                  style={{
                    position: "absolute", top: 12, right: 12, width: 26, height: 26,
                    display: "grid", placeItems: "center",
                    borderRadius: "9px 7px 8px 10px/10px 8px 7px 9px",
                    border: `2px solid ${B.ink}`, background: inCompare ? B.olive : B.paper,
                  }}
                >
                  {inCompare && (
                    <svg width="11" height="9" viewBox="0 0 11 9"><path d="M1 5 L4 8 L10 1" stroke={B.paperLight} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </button>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 13, paddingRight: 26 }}>
                  <span style={{ width: 54, height: 54, flex: "none", borderRadius: "15px 18px 13px 16px/16px 13px 18px 15px", border: `2px solid ${B.ink}`, background: u.color, display: "grid", placeItems: "center", fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 15, color: B.paperLight, boxShadow: "2px 2px 0 rgba(43,39,34,0.18)" }}>
                    {u.abbr.slice(0, 4)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "inline-block", fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: B.muted, lineHeight: 1 }}>hạng #{u.ranking}</span>
                    <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 17, lineHeight: 1.2, color: B.ink, margin: "3px 0 0" }}>{u.name}</p>
                  </div>
                </div>
                <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 17, color: B.muted, margin: "12px 0 0" }}>
                  {u.city}{u.region ? ` · ${u.region}` : ""}
                </p>
                <div style={{ ...dashedRule, margin: "13px 0" }} />
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 15, color: B.muted, margin: 0, lineHeight: 1 }}>Điểm chuẩn TB</p>
                    <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 23, color: u.color, margin: "2px 0 0", lineHeight: 1 }}>
                      {u.avgAdmScore > 0 ? u.avgAdmScore : "—"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}><StarRow value={u.userRating} size={13} /></div>
                    <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 15, color: B.muted, margin: "4px 0 0" }}>
                      {u.ratingCount > 0 ? `${u.ratingCount.toLocaleString()} đánh giá` : "chưa có đánh giá"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compare floating bar */}
      {compareList.length >= 2 && (
        <div
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 50,
            display: "flex", alignItems: "center", gap: 16, padding: "12px 22px",
            background: B.paperLight, border: `2.5px solid ${B.ink}`,
            borderRadius: "18px 22px 16px 20px/20px 16px 22px 18px",
            boxShadow: `6px 7px 0 ${B.terracotta}`,
          }}
        >
          <span style={{ fontWeight: 700, color: B.ink, fontSize: 14 }}>Đã chọn {compareList.length} trường</span>
          <button
            onClick={() => navigate(`/so-sanh?ids=${compareList.join(",")}`)}
            className="bunik-press"
            style={{ background: B.terracotta, color: B.paperLight, border: `2px solid ${B.ink}`, borderRadius: "13px 10px 12px 11px/11px 12px 10px 13px", padding: "9px 18px", fontWeight: 700, fontSize: 14, ["--sh" as string]: B.ink }}
          >
            So sánh ngay
          </button>
        </div>
      )}
    </section>
  );
}
