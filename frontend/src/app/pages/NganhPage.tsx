import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, TrendingUp, TrendingDown, Minus, ChevronRight, X } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { getAllMajors } from "../services/api";
import type { UiMajor } from "../types/api";

const dotBg = {
  backgroundImage: "radial-gradient(circle, #d0cef0 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#FAFAF8",
};

const handCard = {
  background: "#fff",
  borderRadius: 20,
  border: "2px solid rgba(91,79,207,0.12)",
  boxShadow: "4px 4px 0px rgba(91,79,207,0.09)",
};

function MiniSparkline({ scores, color = "#5B4FCF" }: { scores: number[]; color?: string }) {
  const data = scores.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width={70} height={30}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const groupColors: { [k: string]: string } = {
  "Kỹ thuật - Công nghệ": "#5B4FCF",
  "Kinh tế - Quản trị": "#43D9A3",
  "Sức khỏe": "#FF6B6B",
  "Ngôn ngữ - Văn hóa": "#FFB347",
  "Luật - Chính trị": "#9C27B0",
  "Kiến trúc - Xây dựng": "#2196F3",
};

const majorGroups = [
  "Kỹ thuật - Công nghệ",
  "Kinh tế - Quản trị",
  "Sức khỏe",
  "Ngôn ngữ - Văn hóa",
  "Luật - Chính trị",
  "Kiến trúc - Xây dựng",
];

const examBlocks = ["A00", "A01", "B00", "C00", "D01", "V00", "ĐGNL"];

export default function NganhPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [majors, setMajors] = useState<UiMajor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllMajors()
      .then(setMajors)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleGroup = (g: string) => setSelectedGroups((p) => p.includes(g) ? p.filter((x) => x !== g) : [...p, g]);
  const toggleBlock = (b: string) => setSelectedBlocks((p) => p.includes(b) ? p.filter((x) => x !== b) : [...p, b]);
  const toggleCompare = (id: string) =>
    setCompareList((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 5 ? [...p, id] : p));

  const filtered = useMemo(() => {
    let list = [...majors];
    if (search) list = list.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.code.includes(search));
    if (selectedGroups.length > 0) list = list.filter((m) => selectedGroups.includes(m.group));
    if (selectedBlocks.length > 0 && selectedBlocks[0] !== "—") list = list.filter((m) => selectedBlocks.includes(m.block));
    return list;
  }, [search, selectedGroups, selectedBlocks, majors]);

  return (
    <div style={dotBg} className="min-h-screen">
      {/* Header */}
      <div
        className="py-10 px-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(67,217,163,0.08) 0%, rgba(91,79,207,0.06) 100%)",
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.8rem,4vw,2.5rem)" }}>
          📚 Danh Sách Ngành Học
        </h1>
        <p style={{ color: "#4A4A6A", marginTop: 6, fontSize: 15 }}>
          Tra cứu điểm chuẩn và xu hướng tuyển sinh theo từng ngành
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search bar */}
        <div
          className="flex items-center gap-2 mb-6 px-4 py-3 rounded-2xl"
          style={{ background: "#fff", border: "2px solid rgba(91,79,207,0.15)", boxShadow: "3px 3px 0px rgba(91,79,207,0.08)" }}
        >
          <Search size={18} color="#9090AA" />
          <input
            type="text"
            placeholder="Tìm ngành học, mã ngành..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 outline-none bg-transparent text-sm"
            style={{ color: "#1A1A2E" }}
          />
        </div>

        {/* Group filter chips */}
        <div className="mb-4">
          <p style={{ fontSize: 13, color: "#9090AA", fontWeight: 700, marginBottom: 10 }}>Nhóm ngành:</p>
          <div className="flex flex-wrap gap-2">
            {majorGroups.map((g) => {
              const active = selectedGroups.includes(g);
              const color = groupColors[g] || "#5B4FCF";
              return (
                <button
                  key={g}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-sm transition-all"
                  style={{
                    background: active ? color : "rgba(91,79,207,0.06)",
                    color: active ? "#fff" : color,
                    border: `2px solid ${active ? color : `${color}30`}`,
                    fontWeight: 700,
                  }}
                  onClick={() => toggleGroup(g)}
                >
                  {g}
                  {active && <X size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Block filter chips */}
        <div className="mb-6">
          <p style={{ fontSize: 13, color: "#9090AA", fontWeight: 700, marginBottom: 10 }}>Khối xét tuyển:</p>
          <div className="flex flex-wrap gap-2">
            {examBlocks.map((b) => {
              const active = selectedBlocks.includes(b);
              return (
                <button
                  key={b}
                  className="px-3 py-1.5 rounded-xl text-sm transition-all"
                  style={{
                    background: active ? "#5B4FCF" : "rgba(91,79,207,0.06)",
                    color: active ? "#fff" : "#5B4FCF",
                    border: `2px solid ${active ? "#5B4FCF" : "rgba(91,79,207,0.2)"}`,
                    fontWeight: 700,
                  }}
                  onClick={() => toggleBlock(b)}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">⏳</div>
            <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Đang tải dữ liệu...</p>
          </div>
        ) : (
          <>
            <p style={{ color: "#9090AA", fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
              Hiển thị {filtered.length} ngành
            </p>

            {/* Table */}
            <div style={{ ...handCard, overflow: "hidden" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "rgba(91,79,207,0.05)", borderBottom: "2px solid rgba(91,79,207,0.1)" }}>
                      <th className="px-4 py-3 text-left w-8">
                        <span style={{ fontSize: 11, color: "#9090AA" }}>SS</span>
                      </th>
                      <th className="px-4 py-3 text-left" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>Tên ngành</th>
                      <th className="px-4 py-3 text-left" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>Nhóm ngành</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>Khối</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>2023</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>2024</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>2025</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}>Xu hướng</th>
                      <th className="px-4 py-3 text-center" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 800 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m, i) => {
                      const scoreVals = Object.values(m.scores);
                      const diff2524 = scoreVals.length >= 2
                        ? (m.scores["2025"] || 0) - (m.scores["2024"] || 0)
                        : 0;
                      const color = groupColors[m.group] || "#5B4FCF";
                      const inCompare = compareList.includes(m.id);

                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: i < filtered.length - 1 ? "1px solid rgba(91,79,207,0.06)" : "none",
                            background: inCompare ? "rgba(67,217,163,0.04)" : "transparent",
                          }}
                        >
                          <td className="px-4 py-3">
                            <div
                              className="w-5 h-5 rounded-lg flex items-center justify-center cursor-pointer"
                              style={{
                                border: `2px solid ${inCompare ? "#43D9A3" : "#D0D0E0"}`,
                                background: inCompare ? "#43D9A3" : "#fff",
                              }}
                              onClick={() => toggleCompare(m.id)}
                            >
                              {inCompare && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/nganh/${m.id}`}
                              style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14, textDecoration: "none" }}
                            >
                              {m.name}
                            </Link>
                            <p style={{ fontSize: 11, color: "#9090AA" }}>{m.code}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2.5 py-1 rounded-xl text-xs"
                              style={{ background: `${color}15`, color, fontWeight: 700 }}
                            >
                              {m.group}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: "rgba(91,79,207,0.1)", color: "#5B4FCF", fontWeight: 700 }}>
                              {m.block}
                            </span>
                          </td>
                          {["2023", "2024", "2025"].map((y) => (
                            <td key={y} className="px-4 py-3 text-center" style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15 }}>
                              {m.scores[y] || "—"}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {scoreVals.length >= 2 ? (
                                <MiniSparkline scores={scoreVals} color={color} />
                              ) : (
                                <span style={{ fontSize: 12, color: "#9090AA" }}>—</span>
                              )}
                              <span style={{ fontSize: 12, color: diff2524 > 0 ? "#16A34A" : diff2524 < 0 ? "#DC2626" : "#9090AA", fontWeight: 700 }}>
                                {scoreVals.length >= 2
                                  ? (diff2524 > 0 ? <TrendingUp size={13} /> : diff2524 < 0 ? <TrendingDown size={13} /> : <Minus size={13} />)
                                  : null}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/nganh/${m.id}`}
                              className="flex items-center gap-1 text-xs"
                              style={{ color: "#5B4FCF", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
                            >
                              Chi tiết <ChevronRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">📚</div>
                <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Không tìm thấy ngành phù hợp</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Compare floating bar */}
      {compareList.length >= 2 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 rounded-2xl"
          style={{
            background: "#fff",
            border: "2px solid rgba(67,217,163,0.3)",
            boxShadow: "0 8px 32px rgba(67,217,163,0.2)",
          }}
        >
          <div className="flex gap-2">
            {compareList.map((id) => {
              const m = majors.find((x) => x.id === id);
              return (
                <div key={id} className="px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(67,217,163,0.1)", color: "#16A34A", fontWeight: 700 }}>
                  {m?.name.slice(0, 12)}...
                </div>
              );
            })}
          </div>
          <Link
            to={`/so-sanh?type=nganh&ids=${compareList.join(",")}`}
            className="px-5 py-2 rounded-xl text-sm"
            style={{
              background: "linear-gradient(135deg, #43D9A3 0%, #16A34A 100%)",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            So sánh ngay ⚖️
          </Link>
          <button onClick={() => setCompareList([])} style={{ color: "#9090AA" }}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
