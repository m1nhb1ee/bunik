import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, ChevronRight, X } from "lucide-react";
import { getAllMajors } from "../services/api";
import type { UiMajor } from "../types/api";

const dotBg = {
  backgroundImage: "radial-gradient(circle, #d0cef0 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#FAFAF8",
  animation: "dotDrift 24s linear infinite",
};

const handCard = {
  background: "#fff",
  borderRadius: 20,
  border: "2px solid rgba(91,79,207,0.12)",
  boxShadow: "4px 4px 0px rgba(91,79,207,0.09)",
};

const PAGE_SIZE = 10;

const groupColors: { [k: string]: string } = {
  "Kỹ thuật - Công nghệ": "#5B4FCF",
  "Kinh tế - Quản trị": "#43D9A3",
  "Sức khỏe": "#5B4FCF",
  "Ngôn ngữ - Văn hóa": "#FFB347",
  "Luật - Chính trị": "#9C27B0",
  "Kiến trúc - Xây dựng": "#2196F3",
};

export default function NganhPage() {
  const lastYear = String(new Date().getFullYear() - 1);
  const MIN_SCORE = 0;
  const MAX_SCORE = 30;
  const scoreRange = MAX_SCORE - MIN_SCORE;
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [showBlockFilters, setShowBlockFilters] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [majors, setMajors] = useState<UiMajor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [scoreSort, setScoreSort] = useState<"desc" | "asc">("desc");
  const [scoreMin, setScoreMin] = useState(MIN_SCORE);
  const [scoreMax, setScoreMax] = useState(MAX_SCORE);

  useEffect(() => {
    getAllMajors()
      .then(setMajors)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleGroup = (g: string) => setSelectedGroups((p) => p.includes(g) ? p.filter((x) => x !== g) : [...p, g]);
  const toggleBlock = (b: string) => setSelectedBlocks((p) => p.includes(b) ? p.filter((x) => x !== b) : [...p, b]);
  const toggleCompare = (id: string) => setCompareList((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 5 ? [...p, id] : p));

  const majorGroups = useMemo(() => Array.from(new Set(majors.map((m) => m.group).filter(Boolean))), [majors]);
  const examBlocks = useMemo(
    () => Array.from(new Set(majors.flatMap((m) => m.blocks || []).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [majors],
  );

  const filtered = useMemo(() => {
    let list = [...majors];
    if (search) list = list.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.code.includes(search));
    if (selectedGroups.length > 0) list = list.filter((m) => selectedGroups.includes(m.group));
    if (selectedBlocks.length > 0) list = list.filter((m) => (m.blocks || []).some((block) => selectedBlocks.includes(block)));
    list = list.filter((m) => {
      const score = m.score30;
      if (typeof score !== "number") return false;
      return score >= scoreMin && score <= scoreMax;
    });
    list.sort((a, b) => {
      const av = a.score30;
      const bv = b.score30;
      const aVal = typeof av === "number" ? av : (scoreSort === "desc" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
      const bVal = typeof bv === "number" ? bv : (scoreSort === "desc" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
      return scoreSort === "desc" ? bVal - aVal : aVal - bVal;
    });
    return list;
  }, [search, selectedGroups, selectedBlocks, majors, scoreSort, lastYear, scoreMin, scoreMax]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedMajors = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  const minPct = ((scoreMin - MIN_SCORE) / scoreRange) * 100;
  const maxPct = ((scoreMax - MIN_SCORE) / scoreRange) * 100;

  useEffect(() => {
    setPage(1);
  }, [search, selectedGroups, selectedBlocks, scoreMin, scoreMax]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div style={dotBg} className="min-h-screen">
      <style>{`
        .score-range {
          pointer-events: none;
        }
        .score-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ffffff;
          border: 3px solid #5B4FCF;
          box-shadow: 0 2px 8px rgba(91,79,207,0.25);
          cursor: pointer;
        }
        .score-range::-moz-range-thumb {
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ffffff;
          border: 3px solid #5B4FCF;
          box-shadow: 0 2px 8px rgba(91,79,207,0.25);
          cursor: pointer;
        }
      `}</style>
      <div className="py-10 px-6 text-center" style={{ background: "linear-gradient(135deg, rgba(67,217,163,0.08) 0%, rgba(91,79,207,0.06) 100%)", borderBottom: "2px solid rgba(91,79,207,0.08)" }}>
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.8rem,4vw,2.5rem)" }}>Danh Sách Ngành Học</h1>
        <p style={{ color: "#4A4A6A", marginTop: 6, fontSize: 15 }}>Tra cứu điểm THPT và trường đào tạo theo từng ngành</p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-2xl" style={{ background: "#fff", border: "2px solid rgba(91,79,207,0.15)", boxShadow: "3px 3px 0px rgba(91,79,207,0.08)" }}>
          <Search size={18} color="#9090AA" />
          <input type="text" placeholder="Tìm ngành học, mã ngành..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 outline-none bg-transparent text-sm" style={{ color: "#1A1A2E" }} />
        </div>

        <div className="mb-4">
          <p style={{ fontSize: 13, color: "#9090AA", fontWeight: 700, marginBottom: 10 }}>Nhóm ngành:</p>
          <div className="flex flex-wrap gap-2">
            {majorGroups.map((g) => {
              const active = selectedGroups.includes(g);
              const color = groupColors[g] || "#5B4FCF";
              return (
                <button key={g} className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-sm transition-all" style={{ background: active ? color : "rgba(91,79,207,0.06)", color: active ? "#fff" : color, border: `2px solid ${active ? color : `${color}30`}`, fontWeight: 700 }} onClick={() => toggleGroup(g)}>
                  {g}
                  {active && <X size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6 relative z-20 flex items-center gap-2">
          <button className="px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(232,93,117,0.08)", color: "#E85D75", border: "2px solid rgba(232,93,117,0.25)", fontWeight: 700 }} onClick={() => setScoreSort((prev) => (prev === "desc" ? "asc" : "desc"))}>
            Điểm chuẩn quy đổi: {scoreSort === "desc" ? "Cao → Thấp" : "Thấp → Cao"}
          </button>
          <button className="px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(232,93,117,0.08)", color: "#E85D75", border: "2px solid rgba(232,93,117,0.25)", fontWeight: 700 }} onClick={() => setShowBlockFilters((v) => !v)}>
            Khối xét tuyển ({selectedBlocks.length}) {showBlockFilters ? "Ẩn" : "Hiện"}
          </button>
          {showBlockFilters && (
            <div className="absolute left-0 top-full mt-2 p-3 rounded-2xl z-30 w-[min(760px,90vw)]" style={{ background: "#fff", border: "2px solid rgba(91,79,207,0.2)", boxShadow: "0 10px 24px rgba(91,79,207,0.14)" }}>
              <div className="flex flex-wrap gap-2">
                {examBlocks.map((b) => {
                  const active = selectedBlocks.includes(b);
                  return (
                    <button key={b} className="px-3 py-1.5 rounded-xl text-sm transition-all" style={{ background: active ? "#5B4FCF" : "rgba(91,79,207,0.06)", color: active ? "#fff" : "#5B4FCF", border: `2px solid ${active ? "#5B4FCF" : "rgba(91,79,207,0.2)"}`, fontWeight: 700 }} onClick={() => toggleBlock(b)}>
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 px-4 py-3 rounded-2xl" style={{ background: "#fff", border: "2px solid rgba(91,79,207,0.15)", boxShadow: "3px 3px 0px rgba(91,79,207,0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>Ngưỡng điểm THPT quy đổi (/30)</p>
            <p style={{ fontSize: 13, color: "#5B4FCF", fontWeight: 800 }}>{scoreMin.toFixed(1)} - {scoreMax.toFixed(1)}</p>
          </div>
          <div className="relative pt-6 pb-3">
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "rgba(91,79,207,0.12)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 24,
                left: `${minPct}%`,
                width: `${Math.max(maxPct - minPct, 0)}%`,
                height: 8,
                borderRadius: 999,
                background: "linear-gradient(90deg, #5B4FCF 0%, #43D9A3 100%)",
              }}
            />
            <input
              type="range"
              min={MIN_SCORE}
              max={MAX_SCORE}
              step={0.1}
              value={scoreMin}
              onChange={(e) => {
                const next = Number(e.target.value);
                setScoreMin(Math.min(next, scoreMax));
              }}
              className="score-range absolute left-0 top-0 w-full h-8 appearance-none bg-transparent"
              style={{ zIndex: scoreMin > MAX_SCORE - 3 ? 5 : 4 }}
            />
            <input
              type="range"
              min={MIN_SCORE}
              max={MAX_SCORE}
              step={0.1}
              value={scoreMax}
              onChange={(e) => {
                const next = Number(e.target.value);
                setScoreMax(Math.max(next, scoreMin));
              }}
              className="score-range absolute left-0 top-0 w-full h-8 appearance-none bg-transparent"
              style={{ zIndex: 6 }}
            />
            <div className="flex justify-between mt-2" style={{ fontSize: 11, color: "#9090AA", fontWeight: 700 }}>
              <span>{MIN_SCORE}</span>
              <span>{MAX_SCORE}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20"><p style={{ color: "#4A4A6A", fontWeight: 700 }}>Đang tải dữ liệu...</p></div>
        ) : (
          <>
            <p style={{ color: "#9090AA", fontSize: 13, marginBottom: 16, fontWeight: 600 }}>Hiển thị {filtered.length} ngành</p>

            <div style={{ ...handCard, overflow: "hidden" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "rgba(91,79,207,0.05)", borderBottom: "2px solid rgba(91,79,207,0.1)" }}>
                      <th className="px-4 py-3 text-left w-8"><span style={{ fontSize: 11, color: "#9090AA" }}>CH</span></th>
                      <th className="px-4 py-3 text-left" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>Tên ngành</th>
                      <th className="px-4 py-3 text-left" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>Nhóm ngành</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>Điểm THPT {lastYear}</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>Trường</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMajors.map((m, i) => {
                      const color = groupColors[m.group] || "#5B4FCF";
                      const inCompare = compareList.includes(m.id);
                      return (
                        <tr key={m.id} style={{ borderBottom: i < paginatedMajors.length - 1 ? "1px solid rgba(91,79,207,0.06)" : "none", background: inCompare ? "rgba(67,217,163,0.04)" : "transparent" }}>
                          <td className="px-4 py-3">
                            <div className="w-5 h-5 rounded-lg flex items-center justify-center cursor-pointer" style={{ border: `2px solid ${inCompare ? "#43D9A3" : "#D0D0E0"}`, background: inCompare ? "#43D9A3" : "#fff" }} onClick={() => toggleCompare(m.id)}>
                              {inCompare && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/nganh/${m.id}`}
                              style={{
                                fontWeight: 700,
                                color: "#1A1A2E",
                                fontSize: 14,
                                textDecoration: "none",
                                display: "inline-block",
                                maxWidth: 280,
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                              }}
                              title={m.name}
                            >
                              {m.name}
                            </Link>
                            <p style={{ fontSize: 11, color: "#9090AA" }}>{m.code}</p>
                          </td>
                          <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-xl text-xs" style={{ background: `${color}15`, color, fontWeight: 700 }}>{m.group}</span></td>
                          <td className="px-4 py-3 text-center" style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15 }}>
                            {m.score30 ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center" style={{ color: "#4A4A6A", fontWeight: 700 }}>{m.universityName || m.universityShortName || "—"}</td>
                          <td className="px-4 py-3">
                            <Link to={`/nganh/${m.id}`} className="flex items-center gap-1 text-xs" style={{ color: "#5B4FCF", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Chi tiết <ChevronRight size={12} /></Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filtered.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <p style={{ fontSize: 12, color: "#9090AA", fontWeight: 600 }}>Trang {page}/{totalPages}</p>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-xl text-sm" style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#5B4FCF", fontWeight: 700, opacity: page === 1 ? 0.4 : 1 }} disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</button>
                  <button className="px-3 py-1.5 rounded-xl text-sm" style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#5B4FCF", fontWeight: 700, opacity: page === totalPages ? 0.4 : 1 }} disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sau</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
