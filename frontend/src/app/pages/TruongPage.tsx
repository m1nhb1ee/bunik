import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Filter, Star, ChevronDown, BarChart3, Eye, SlidersHorizontal } from "lucide-react";
import { getAllUniversities } from "../services/api";
import type { UiUniversity } from "../types/api";

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

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EEF8" }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${(value / max) * 100}%`, background: color }}
      />
    </div>
  );
}

const sortOptions = [
  { value: "ranking", label: "Xếp hạng (Cao → Thấp)" },
  { value: "score_desc", label: "Điểm (Cao → Thấp)" },
  { value: "score_asc", label: "Điểm (Thấp → Cao)" },
  { value: "rating", label: "Đánh giá người dùng" },
  { value: "name", label: "Tên A→Z" },
];

const regions = ["Miền Bắc", "Miền Trung", "Miền Nam"];

export default function TruongPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortBy, setSortBy] = useState("ranking");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 30]);
  const [showFilter, setShowFilter] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [universities, setUniversities] = useState<UiUniversity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUniversities()
      .then(setUniversities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleRegion = (r: string) => {
    setSelectedRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const toggleCompare = (id: string) => {
    setCompareList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const filtered = useMemo(() => {
    let list = [...universities];
    if (search) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.abbr.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (selectedRegions.length > 0) {
      list = list.filter((u) => selectedRegions.includes(u.region));
    }
    if (scoreRange[1] < 30) {
      list = list.filter(
        (u) => u.avgAdmScore === 0 || (u.avgAdmScore >= scoreRange[0] && u.avgAdmScore <= scoreRange[1])
      );
    }
    switch (sortBy) {
      case "score_desc":
        list.sort((a, b) => b.avgAdmScore - a.avgAdmScore);
        break;
      case "score_asc":
        list.sort((a, b) => a.avgAdmScore - b.avgAdmScore);
        break;
      case "rating":
        list.sort((a, b) => b.userRating - a.userRating);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort((a, b) => a.ranking - b.ranking);
    }
    return list;
  }, [search, sortBy, selectedRegions, scoreRange, universities]);

  return (
    <div style={dotBg} className="min-h-screen">
      {/* Header */}
      <div
        className="py-10 px-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(91,79,207,0.08) 0%, rgba(67,217,163,0.05) 100%)",
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        <h1
          style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.8rem,4vw,2.5rem)" }}
        >
          🏛️ Danh Sách Trường Đại Học
        </h1>
        <p style={{ color: "#4A4A6A", marginTop: 6, fontSize: 15 }}>
          Khám phá hơn 200 trường đại học trên cả nước với thông tin tuyển sinh đầy đủ
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search + sort bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div
            className="flex items-center gap-2 flex-1 px-4 py-3 rounded-2xl"
            style={{ background: "#fff", border: "2px solid rgba(91,79,207,0.15)", boxShadow: "3px 3px 0px rgba(91,79,207,0.08)" }}
          >
            <Search size={18} color="#9090AA" />
            <input
              type="text"
              placeholder="Tìm theo tên trường, viết tắt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 outline-none bg-transparent text-sm"
              style={{ color: "#1A1A2E" }}
            />
          </div>

          <div className="flex gap-2">
            <div
              className="relative flex items-center gap-2 px-4 py-3 rounded-2xl cursor-pointer flex-shrink-0"
              style={{ background: "#fff", border: "2px solid rgba(91,79,207,0.15)", minWidth: 200 }}
            >
              <select
                className="appearance-none flex-1 outline-none bg-transparent text-sm cursor-pointer pr-4"
                style={{ color: "#1A1A2E", fontWeight: 600 }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={14} color="#9090AA" className="flex-shrink-0" />
            </div>

            <button
              className="flex items-center gap-2 px-4 py-3 rounded-2xl flex-shrink-0 text-sm"
              style={{
                background: showFilter ? "rgba(91,79,207,0.1)" : "#fff",
                border: `2px solid ${showFilter ? "rgba(91,79,207,0.4)" : "rgba(91,79,207,0.15)"}`,
                color: "#5B4FCF",
                fontWeight: 700,
              }}
              onClick={() => setShowFilter(!showFilter)}
            >
              <SlidersHorizontal size={16} />
              Lọc
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar filter */}
          {showFilter && (
            <aside
              className="w-64 flex-shrink-0 hidden md:block"
              style={{ ...handCard, padding: 20, alignSelf: "flex-start", position: "sticky", top: 80 }}
            >
              <h3 style={{ fontWeight: 800, color: "#1A1A2E", marginBottom: 16, fontSize: 15 }}>
                <Filter size={14} className="inline mr-1" /> Bộ lọc
              </h3>

              {/* Region filter */}
              <div className="mb-5">
                <p style={{ fontWeight: 700, color: "#4A4A6A", fontSize: 13, marginBottom: 10 }}>📍 Khu vực</p>
                {regions.map((r) => (
                  <label key={r} className="flex items-center gap-2 mb-2 cursor-pointer">
                    <div
                      className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        border: `2px solid ${selectedRegions.includes(r) ? "#5B4FCF" : "#D0D0E0"}`,
                        background: selectedRegions.includes(r) ? "#5B4FCF" : "#fff",
                      }}
                      onClick={() => toggleRegion(r)}
                    >
                      {selectedRegions.includes(r) && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 13, color: "#4A4A6A" }}>{r}</span>
                  </label>
                ))}
              </div>

              {/* Score range */}
              <div className="mb-5">
                <p style={{ fontWeight: 700, color: "#4A4A6A", fontSize: 13, marginBottom: 10 }}>
                  📊 Điểm chuẩn TB: {scoreRange[0]} – {scoreRange[1]}
                </p>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={scoreRange[1]}
                  onChange={(e) => setScoreRange([scoreRange[0], Number(e.target.value)])}
                  className="w-full"
                  style={{ accentColor: "#5B4FCF" }}
                />
              </div>

              <button
                className="w-full py-2 rounded-xl text-sm"
                style={{ background: "rgba(91,79,207,0.08)", color: "#5B4FCF", fontWeight: 700 }}
                onClick={() => { setSelectedRegions([]); setScoreRange([0, 30]); }}
              >
                Xóa bộ lọc
              </button>
            </aside>
          )}

          {/* Main grid */}
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">⏳</div>
                <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Đang tải dữ liệu...</p>
              </div>
            ) : (
              <>
                <p style={{ color: "#9090AA", fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
                  Hiển thị {filtered.length} trường
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filtered.map((u) => (
                    <div
                      key={u.id}
                      className="relative transition-all hover:-translate-y-1 duration-200"
                      style={handCard}
                    >
                      {/* Compare checkbox */}
                      <div
                        className="absolute top-3 right-3 w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer z-10"
                        style={{
                          border: `2px solid ${compareList.includes(u.id) ? "#43D9A3" : "#D0D0E0"}`,
                          background: compareList.includes(u.id) ? "#43D9A3" : "#fff",
                        }}
                        onClick={() => toggleCompare(u.id)}
                        title="Thêm vào so sánh"
                      >
                        {compareList.includes(u.id) && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>

                      <div className="p-5">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-4 pr-6">
                          <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${u.color} 0%, ${u.color}88 100%)`,
                              fontFamily: "'Baloo 2', cursive",
                              fontWeight: 800,
                              fontSize: 16,
                              boxShadow: `3px 3px 0px ${u.color}30`,
                            }}
                          >
                            {u.abbr.slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="px-2 py-0.5 rounded-lg text-xs"
                                style={{
                                  background: u.ranking <= 3 ? "linear-gradient(135deg,#FFB347,#FF6B6B)" : "rgba(91,79,207,0.1)",
                                  color: u.ranking <= 3 ? "#fff" : "#5B4FCF",
                                  fontWeight: 800,
                                }}
                              >
                                ★ #{u.ranking}
                              </span>
                              <span style={{ fontSize: 11, color: "#9090AA" }}>{u.city}</span>
                            </div>
                            <p style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 14, lineHeight: 1.4 }}>{u.name}</p>
                          </div>
                        </div>

                        {/* Progress bars */}
                        <div className="space-y-2.5 mb-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1" style={{ color: "#9090AA" }}>
                              <span>Điểm chuẩn TB</span>
                              <span style={{ fontWeight: 700, color: "#5B4FCF" }}>
                                {u.avgAdmScore > 0 ? `${u.avgAdmScore}/30` : "Chưa có"}
                              </span>
                            </div>
                            <ProgressBar value={u.avgAdmScore} max={30} color="#5B4FCF" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1" style={{ color: "#9090AA" }}>
                              <span>Mạng xã hội</span>
                              <span style={{ fontWeight: 700, color: "#43D9A3" }}>
                                {u.socialScore > 0 ? `${u.socialScore}/100` : "Chưa có"}
                              </span>
                            </div>
                            <ProgressBar value={u.socialScore} color="#43D9A3" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1" style={{ color: "#9090AA" }}>
                              <span>Đánh giá ND</span>
                              <span style={{ fontWeight: 700, color: "#FFB347" }}>
                                {u.userRating > 0 ? `${(u.userRating * 20).toFixed(0)}/100` : "Chưa có"}
                              </span>
                            </div>
                            <ProgressBar value={u.userRating * 20} color="#FFB347" />
                          </div>
                        </div>

                        {/* Score + stars */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                size={13}
                                fill={u.userRating > 0 && i <= Math.round(u.userRating) ? "#FFB347" : "none"}
                                color={u.userRating > 0 && i <= Math.round(u.userRating) ? "#FFB347" : "#D0D0D0"}
                              />
                            ))}
                            {u.userRating > 0 && (
                              <span style={{ fontSize: 12, color: "#4A4A6A", marginLeft: 2, fontWeight: 700 }}>
                                {u.userRating}
                              </span>
                            )}
                          </div>
                          {u.overallScore > 0 && (
                            <div
                              className="px-3 py-1 rounded-xl text-sm"
                              style={{ background: "linear-gradient(135deg, #5B4FCF22, #5B4FCF11)", color: "#5B4FCF", fontWeight: 900, fontSize: 16 }}
                            >
                              {u.overallScore}đ
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Link
                            to={`/truong/${u.id}`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm"
                            style={{
                              background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
                              color: "#fff",
                              fontWeight: 700,
                              boxShadow: "2px 2px 0px rgba(91,79,207,0.25)",
                              textDecoration: "none",
                            }}
                          >
                            <Eye size={14} />
                            Xem chi tiết
                          </Link>
                          <Link
                            to={`/so-sanh?ids=${u.id}`}
                            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-2xl text-sm"
                            style={{
                              border: "2px solid rgba(91,79,207,0.2)",
                              color: "#5B4FCF",
                              fontWeight: 700,
                              textDecoration: "none",
                            }}
                          >
                            <BarChart3 size={14} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filtered.length === 0 && !loading && (
                  <div className="text-center py-20">
                    <div className="text-5xl mb-4">🔍</div>
                    <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Không tìm thấy trường phù hợp</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Compare floating bar */}
      {compareList.length >= 2 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 rounded-2xl"
          style={{
            background: "#fff",
            border: "2px solid rgba(91,79,207,0.2)",
            boxShadow: "0 8px 32px rgba(91,79,207,0.2)",
          }}
        >
          <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14 }}>
            Đã chọn {compareList.length} trường
          </span>
          <Link
            to={`/so-sanh?ids=${compareList.join(",")}`}
            className="px-5 py-2 rounded-xl text-sm"
            style={{
              background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            So sánh ngay ⚖️
          </Link>
        </div>
      )}
    </div>
  );
}
